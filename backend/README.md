# Backend — PPIC Alter-S

Deterministic logic and calculation scripts for:
- BOM requirement calculation (`required = BOM/unit × qty`)
- Inventory availability (`available = max(on_hand − reserved, 0)`)
- Shortage computation (`shortage = max(required − available, 0)`)
- Draft Purchase Request generation (PENDING_HUMAN_APPROVAL)
- Test evidence and expected-vs-actual results

## Key Principle

All quantity calculations are **deterministic** — computed by scripts/tools, never by AI guesses. The WorkBuddy agent references these outputs but does not invent values.

## Files

- `compute_shortage.py` — the deterministic engine + CLI (stdlib only, no dependencies).
  Run it from the repo root:

```bash
python3 backend/compute_shortage.py MO-001            # prints plan, writes demo-data/purchase_request_draft.json
python3 backend/compute_shortage.py MO-001 --json     # full plan as JSON
python3 backend/compute_shortage.py MO-002 --no-write # no-shortage path (no PR needed)
python3 backend/compute_shortage.py MO-999 --no-write # honest error, exit code 2
```

Exit codes: `0` = plan computed; `2` = input/data error (unknown order,
non-positive quantity, missing BOM or missing stock row). Errors are
reported on stderr — the script never fabricates data.

## Expected Output (MO-001)

```
shortage(MAT-A) = max(500×2 - (760-60), 0) = 300 kg
shortage(MAT-B) = max(500×1 - (600-50), 0) = 0 pcs
shortage(MAT-C) = max(500×2 - (800-100), 0) = 300 pcs

Draft PR: lines = [{MAT-A: 300 kg}, {MAT-C: 300 pcs}]
          status = PENDING_HUMAN_APPROVAL
```

## Pachira DB model behind the demo data

The demo CSVs in `demo-data/` mirror the structure of the real
PT Pachira Distrinusa database. They do **not** contain real company
data — every value is synthetic, invented for the hackathon golden demo.
No real formulas, prices, customers, or suppliers are used.

| Demo file | Pachira equivalent | Notes |
|---|---|---|
| `orders.csv` (MO-001/MO-002) | LHP / production-order records | order, product, quantity |
| `bom.csv` | Formula tables (`fml` / `formula_detail`) | product → components with qty per unit |
| `inventory.csv` | Stock ledger (`stok`) | book stock (`on_hand`) minus quantities already committed/reserved; `available` floored at 0 |
| `purchase_request_draft.json` | Purchase-request draft | draft only — never a sent PO |
| Formulas in `compute_shortage.py` | Deterministic calc rules | same pattern as the Pachira HPP calculator: fixed rules over ledger data, no AI guesses |

See `docs/PRD.md` sections 2.2, 2.3, and 3.2 for specifications.
