# Demo Data — SYNTHETIC

All data in this directory is **SYNTHETIC DEMO DATA** — not real production, customer, or supplier data.

## Expected Files

- `orders.csv` / `production_order.json` — seeded production order (MO-001, Product A, 500 units)
- `bom.csv` / `bom.json` — Bill of Materials per product
- `inventory.csv` / `inventory.json` — on-hand and reserved stock per SKU
- `purchase_request_draft.json` — generated draft PR output
- `compute_shortage.py` — deterministic shortage calculation script (may also live in `backend/`)

## Demo Dataset (MO-001, 500 units)

| Material | BOM/unit | Required (500) | On-hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| MAT-A Resin (kg) | 2 | 1,000 | 760 | 60 | 700 | 300 |
| MAT-B Packaging (pcs) | 1 | 500 | 600 | 50 | 550 | 0 |
| MAT-C Label (pcs) | 2 | 1,000 | 800 | 100 | 700 | 300 |

**Rules:** `required = BOM/unit × qty`; `available = max(on_hand − reserved, 0)`; `shortage = max(required − available, 0)`

**Expected draft PR:** PR-MO-001, MAT-A 300 kg + MAT-C 300 pcs, status PENDING_HUMAN_APPROVAL.

See `docs/PRD.md` section 2.2 for details.
