#!/usr/bin/env python3
"""PPIC Alter-S — deterministic material-plan engine (backend).

Team Omni Lobster — Tencent Cloud AI CAN DO IT Hackathon Indonesia 2026
(Challenge B — The Office Agent).

What this does
--------------
Given a production order, it reads the Bill of Materials (BOM) and the
inventory ledger, then computes — with fixed arithmetic rules, never AI
guesses — how much of each material is required, how much is available,
how much is short, and (only for the short materials) a Purchase Request
draft that stays PENDING_HUMAN_APPROVAL until a person approves it.

Formulas (PRD v1.1 section 2.2)
--------------------------------
    required  = qty_per_unit (BOM) x production quantity
    available = max(on_hand - reserved, 0)
    shortage  = max(required - available, 0)

Pachira DB model behind the demo data
--------------------------------------
The demo CSVs mirror the structure of the real PT Pachira Distrinusa
database — they do NOT contain real company data (all values are
synthetic, invented for the hackathon golden demo):

    production order (orders.csv)  <-> LHP / production-order records
                                       (order, product, quantity)
    BOM (bom.csv)                  <-> formula tables (fml /
                                       formula_detail: product ->
                                       components with qty per unit)
    inventory (inventory.csv)      <-> stock ledger (stok): book stock
                                       minus quantities already
                                       committed/reserved for other
                                       orders; available is floored at 0
    PR draft (JSON output)         <-> purchase-request draft
                                       (never a sent PO)

Usage
-----
    python3 backend/compute_shortage.py MO-001
    python3 backend/compute_shortage.py MO-001 --data-dir demo-data
    python3 backend/compute_shortage.py MO-001 --json
    python3 backend/compute_shortage.py MO-001 --no-write

Exit codes: 0 = plan computed; 2 = input/data error (unknown order,
non-positive quantity, missing BOM or missing stock row). Errors are
reported honestly on stderr — the script never invents data.

Standard library only — no third-party dependencies.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = REPO_ROOT / "demo-data"


class PlanError(Exception):
    """Raised for any input/data problem. Never fabricate data."""


def _read_csv(path: Path):
    if not path.is_file():
        raise PlanError(f"data file not found: {path}")
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _to_number(value, field, where):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise PlanError(f"invalid number for {field} in {where}: {value!r}")
    if number != number:  # NaN guard
        raise PlanError(f"invalid number for {field} in {where}: {value!r}")
    return number


def _to_int(number, field, where):
    if float(number).is_integer():
        return int(number)
    return number


def load_data(data_dir: Path):
    """Load orders, BOM and inventory from the demo-data directory."""
    orders = {}
    for row in _read_csv(data_dir / "orders.csv"):
        order_id = (row.get("order_id") or "").strip()
        if not order_id:
            continue
        qty = _to_number(row.get("quantity"), "quantity", f"order {order_id}")
        orders[order_id] = {
            "order_id": order_id,
            "product_id": (row.get("product_id") or "").strip(),
            "product_name": (row.get("product_name") or "").strip(),
            "quantity": _to_int(qty, "quantity", f"order {order_id}"),
            "unit": (row.get("unit") or "").strip(),
            "due_date": (row.get("due_date") or "").strip(),
            "status": (row.get("status") or "").strip(),
        }

    bom = {}  # product_id -> [lines]
    for row in _read_csv(data_dir / "bom.csv"):
        product_id = (row.get("product_id") or "").strip()
        material_id = (row.get("material_id") or "").strip()
        if not product_id or not material_id:
            continue
        qty_per_unit = _to_number(
            row.get("qty_per_unit"), "qty_per_unit", f"BOM {product_id}/{material_id}"
        )
        bom.setdefault(product_id, []).append(
            {
                "material_id": material_id,
                "material_name": (row.get("material_name") or "").strip(),
                "unit": (row.get("unit") or "").strip(),
                "qty_per_unit": _to_int(
                    qty_per_unit, "qty_per_unit", f"BOM {product_id}/{material_id}"
                ),
            }
        )

    inventory = {}
    for row in _read_csv(data_dir / "inventory.csv"):
        material_id = (row.get("material_id") or "").strip()
        if not material_id:
            continue
        inventory[material_id] = {
            "material_id": material_id,
            "material_name": (row.get("material_name") or "").strip(),
            "unit": (row.get("unit") or "").strip(),
            "on_hand": _to_int(
                _to_number(row.get("on_hand"), "on_hand", f"inventory {material_id}"),
                "on_hand",
                f"inventory {material_id}",
            ),
            "reserved": _to_int(
                _to_number(row.get("reserved"), "reserved", f"inventory {material_id}"),
                "reserved",
                f"inventory {material_id}",
            ),
        }

    return orders, bom, inventory


def compute_plan(order_id: str, data_dir: Path):
    """Compute the material plan for one production order.

    Returns a dict with the order, per-material lines
    (required / available / shortage) and the PR draft.
    Raises PlanError for unknown orders, bad quantities, missing BOM
    or missing stock rows — never invents values.
    """
    orders, bom, inventory = load_data(data_dir)

    order = orders.get(order_id)
    if order is None:
        known = ", ".join(sorted(orders)) or "(none)"
        raise PlanError(
            f"order {order_id!r} not found in orders.csv "
            f"(known orders: {known}). No data fabricated."
        )

    qty = order["quantity"]
    if qty <= 0:
        raise PlanError(
            f"order {order_id} has non-positive quantity ({qty}); "
            "cannot compute a material plan."
        )

    bom_lines = bom.get(order["product_id"])
    if not bom_lines:
        raise PlanError(
            f"no BOM found for product {order['product_id']!r} "
            f"(order {order_id}). Cannot compute requirements."
        )

    lines = []
    for item in bom_lines:
        stock = inventory.get(item["material_id"])
        if stock is None:
            raise PlanError(
                f"no inventory row for material {item['material_id']!r} "
                f"(needed by order {order_id}). Cannot compute availability."
            )
        required = item["qty_per_unit"] * qty
        available = max(stock["on_hand"] - stock["reserved"], 0)
        shortage = max(required - available, 0)
        lines.append(
            {
                "material_id": item["material_id"],
                "material_name": item["material_name"],
                "unit": item["unit"],
                "qty_per_unit": item["qty_per_unit"],
                "required": _to_int(required, "required", item["material_id"]),
                "on_hand": stock["on_hand"],
                "reserved": stock["reserved"],
                "available": _to_int(available, "available", item["material_id"]),
                "shortage": _to_int(shortage, "shortage", item["material_id"]),
            }
        )

    shortage_lines = [line for line in lines if line["shortage"] > 0]
    if shortage_lines:
        pr_draft = {
            "pr_id": f"PR-{order_id}",
            "order_id": order_id,
            "product_id": order["product_id"],
            "product_name": order["product_name"],
            "status": "PENDING_HUMAN_APPROVAL",
            "note": (
                "DRAFT ONLY — no purchase has been made. "
                "A human must review and approve before any PO is created."
            ),
            "lines": [
                {
                    "material_id": line["material_id"],
                    "material_name": line["material_name"],
                    "unit": line["unit"],
                    "quantity": line["shortage"],
                }
                for line in shortage_lines
            ],
        }
    else:
        pr_draft = {
            "pr_id": None,
            "order_id": order_id,
            "product_id": order["product_id"],
            "product_name": order["product_name"],
            "status": "NO_PURCHASE_NEEDED",
            "note": "No material shortage for this order — no purchase request needed.",
            "lines": [],
        }

    return {"order": order, "lines": lines, "pr_draft": pr_draft}


def format_table(plan: dict) -> str:
    order = plan["order"]
    out = [
        f"Material plan — order {order['order_id']} "
        f"({order['product_name']}, {order['quantity']} {order['unit']})",
        "",
        f"{'Material':<28}{'BOM/u':>6}{'Required':>10}"
        f"{'On-hand':>9}{'Reserved':>9}{'Available':>10}{'Shortage':>9}",
        "-" * 81,
    ]
    for line in plan["lines"]:
        out.append(
            f"{line['material_id']} ({line['material_name']})".ljust(28)
            + f"{line['qty_per_unit']:>6}"
            + f"{line['required']:>10}"
            + f"{line['on_hand']:>9}"
            + f"{line['reserved']:>9}"
            + f"{line['available']:>10}"
            + f"{line['shortage']:>9}"
        )
    out.append("-" * 81)
    draft = plan["pr_draft"]
    if draft["lines"]:
        out.append(
            f"Draft PR: {draft['pr_id']} — status {draft['status']} "
            f"({len(draft['lines'])} line(s): "
            + ", ".join(
                f"{item['material_id']} {item['quantity']} {item['unit']}"
                for item in draft["lines"]
            )
            + ")"
        )
    else:
        out.append(f"Draft PR: none — status {draft['status']}.")
    return "\n".join(out)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="PPIC Alter-S deterministic material-plan engine."
    )
    parser.add_argument("order_id", help="production order id, e.g. MO-001")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="directory with orders.csv, bom.csv, inventory.csv "
        "(default: demo-data next to the repo root)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="where to write the PR draft JSON "
        "(default: <data-dir>/purchase_request_draft.json)",
    )
    parser.add_argument(
        "--json", action="store_true", help="print the full plan as JSON"
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="do not write the PR draft file (print only)",
    )
    args = parser.parse_args(argv)

    try:
        plan = compute_plan(args.order_id, args.data_dir)
    except PlanError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(plan, indent=2, ensure_ascii=False))
    else:
        print(format_table(plan))

    if not args.no_write:
        out_path = args.out or (args.data_dir / "purchase_request_draft.json")
        out_path.write_text(
            json.dumps(plan["pr_draft"], indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"\nPR draft written to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
