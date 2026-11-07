#!/usr/bin/env python3
"""Acceptance tests for the PPIC Alter-S deterministic backend.

Covers PRD v1.1 section 2.3 (P0) items that the backend owns:
    AC-02  read MO-001 and BOM (product, qty, BOM/unit)
    AC-03  deterministic required calculation (1000/500/1000)
    AC-04  inventory available (700/550/700)
    AC-05  shortage (300/0/300, units match)
    AC-06  draft PR (only MAT-A + MAT-C, PENDING_HUMAN_APPROVAL)
    AC-08  unknown order -> honest error, no fabricated data

Plus edge cases the PRD formulas imply:
    - reserved > on_hand  -> available floors at 0
    - zero-quantity order -> honest error
    - MO-002 (100 units) -> no shortage, no purchase needed
    - JSON demo files agree with the CSV demo files

Standard library only. Run from the repo root:
    python3 -m unittest discover -s tests -v
    python3 tests/test_compute.py -v
"""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "demo-data"
SCRIPT = REPO_ROOT / "backend" / "compute_shortage.py"

sys.path.insert(0, str(REPO_ROOT / "backend"))
import compute_shortage  # noqa: E402


def _lines_by_material(plan):
    return {line["material_id"]: line for line in plan["lines"]}


class TestGoldenDemoMO001(unittest.TestCase):
    """AC-02..AC-06 on the golden demo order MO-001."""

    @classmethod
    def setUpClass(cls):
        cls.plan = compute_shortage.compute_plan("MO-001", DATA_DIR)
        cls.lines = _lines_by_material(cls.plan)

    def test_ac02_order_and_bom(self):
        order = self.plan["order"]
        self.assertEqual(order["product_name"], "Product A")
        self.assertEqual(order["quantity"], 500)
        self.assertEqual(self.lines["MAT-A"]["qty_per_unit"], 2)
        self.assertEqual(self.lines["MAT-B"]["qty_per_unit"], 1)
        self.assertEqual(self.lines["MAT-C"]["qty_per_unit"], 2)

    def test_ac03_required(self):
        self.assertEqual(self.lines["MAT-A"]["required"], 1000)
        self.assertEqual(self.lines["MAT-B"]["required"], 500)
        self.assertEqual(self.lines["MAT-C"]["required"], 1000)

    def test_ac04_available(self):
        self.assertEqual(self.lines["MAT-A"]["available"], 700)
        self.assertEqual(self.lines["MAT-B"]["available"], 550)
        self.assertEqual(self.lines["MAT-C"]["available"], 700)

    def test_ac05_shortage_and_units(self):
        self.assertEqual(self.lines["MAT-A"]["shortage"], 300)
        self.assertEqual(self.lines["MAT-B"]["shortage"], 0)
        self.assertEqual(self.lines["MAT-C"]["shortage"], 300)
        self.assertEqual(self.lines["MAT-A"]["unit"], "kg")
        self.assertEqual(self.lines["MAT-B"]["unit"], "pcs")
        self.assertEqual(self.lines["MAT-C"]["unit"], "pcs")

    def test_ac06_draft_pr(self):
        draft = self.plan["pr_draft"]
        self.assertEqual(draft["pr_id"], "PR-MO-001")
        self.assertEqual(draft["status"], "PENDING_HUMAN_APPROVAL")
        self.assertEqual(
            [(item["material_id"], item["quantity"], item["unit"])
             for item in draft["lines"]],
            [("MAT-A", 300, "kg"), ("MAT-C", 300, "pcs")],
        )


class TestNoShortagePath(unittest.TestCase):
    """MO-002 (100 units) needs nothing — no PR lines, no purchase."""

    def test_mo002_no_shortage(self):
        plan = compute_shortage.compute_plan("MO-002", DATA_DIR)
        lines = _lines_by_material(plan)
        self.assertEqual([lines[m]["shortage"] for m in ("MAT-A", "MAT-B", "MAT-C")],
                         [0, 0, 0])
        self.assertEqual(plan["pr_draft"]["status"], "NO_PURCHASE_NEEDED")
        self.assertEqual(plan["pr_draft"]["lines"], [])


class TestHonestErrors(unittest.TestCase):
    """AC-08 — the backend must fail honestly, never fabricate data."""

    def test_ac08_unknown_order(self):
        with self.assertRaises(compute_shortage.PlanError) as ctx:
            compute_shortage.compute_plan("MO-999", DATA_DIR)
        self.assertIn("MO-999", str(ctx.exception))
        self.assertIn("not found", str(ctx.exception))

    def test_cli_unknown_order_exit_code_2(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "MO-999", "--no-write"],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("not found", result.stderr)
        # No draft file may be created by a failed run.
        self.assertNotIn("PR-MO-999", result.stdout)

    def test_zero_quantity_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "demo-data"
            shutil.copytree(DATA_DIR, data_dir)
            with (data_dir / "orders.csv").open("a", encoding="utf-8") as f:
                f.write("MO-000,PROD-A,Product A,0,units,2026-11-25,OPEN\n")
            with self.assertRaises(compute_shortage.PlanError) as ctx:
                compute_shortage.compute_plan("MO-000", data_dir)
            self.assertIn("non-positive quantity", str(ctx.exception))


class TestEdgeCases(unittest.TestCase):
    """Formula edges implied by PRD section 2.2."""

    def test_reserved_exceeds_on_hand_floors_at_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "demo-data"
            shutil.copytree(DATA_DIR, data_dir)
            rows = (data_dir / "inventory.csv").read_text(encoding="utf-8")
            rows = rows.replace("MAT-A,Resin,kg,760,60",
                                "MAT-A,Resin,kg,50,80")
            (data_dir / "inventory.csv").write_text(rows, encoding="utf-8")
            plan = compute_shortage.compute_plan("MO-001", data_dir)
            lines = _lines_by_material(plan)
            self.assertEqual(lines["MAT-A"]["available"], 0)
            self.assertEqual(lines["MAT-A"]["shortage"], 1000)

    def test_missing_stock_row_is_an_error_not_a_guess(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "demo-data"
            shutil.copytree(DATA_DIR, data_dir)
            rows = [
                row for row in
                (data_dir / "inventory.csv").read_text(encoding="utf-8").splitlines()
                if not row.startswith("MAT-C,")
            ]
            (data_dir / "inventory.csv").write_text(
                "\n".join(rows) + "\n", encoding="utf-8")
            with self.assertRaises(compute_shortage.PlanError) as ctx:
                compute_shortage.compute_plan("MO-001", data_dir)
            self.assertIn("MAT-C", str(ctx.exception))


class TestJsonMatchesCsv(unittest.TestCase):
    """JSON demo files must agree with the CSV demo files."""

    def test_json_csv_consistency(self):
        orders_json = json.loads(
            (DATA_DIR / "production_order.json").read_text(encoding="utf-8"))
        bom_json = json.loads(
            (DATA_DIR / "bom.json").read_text(encoding="utf-8"))
        inv_json = json.loads(
            (DATA_DIR / "inventory.json").read_text(encoding="utf-8"))
        self.assertTrue(orders_json["synthetic"])
        self.assertTrue(bom_json["synthetic"])
        self.assertTrue(inv_json["synthetic"])
        self.assertEqual(
            {o["order_id"]: o["quantity"] for o in orders_json["orders"]},
            {"MO-001": 500, "MO-002": 100})
        self.assertEqual(
            {line["material_id"]: line["qty_per_unit"]
             for line in bom_json["bom"][0]["lines"]},
            {"MAT-A": 2, "MAT-B": 1, "MAT-C": 2})
        self.assertEqual(
            {(row["material_id"], row["on_hand"], row["reserved"])
             for row in inv_json["inventory"]},
            {("MAT-A", 760, 60), ("MAT-B", 600, 50), ("MAT-C", 800, 100)})


if __name__ == "__main__":
    unittest.main(verbosity=2)
