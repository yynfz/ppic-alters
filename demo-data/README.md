# Demo Data — SYNTHETIC

All data in this directory is **SYNTHETIC DEMO DATA** — not real production, customer, or supplier data. The structure mirrors the PT Pachira Distrinusa database (production orders, BOM/formula tables, stock ledger), but every value is invented for the hackathon golden demo.

## Files

- `orders.csv` / `production_order.json` — seeded production orders (MO-001, Product A, 500 units; MO-002, Product A, 100 units — the no-shortage path)
- `bom.csv` / `bom.json` — Bill of Materials per product
- `inventory.csv` / `inventory.json` — on-hand and reserved stock per SKU
- `purchase_request_draft.json` — generated draft PR output for MO-001 (regenerate with the backend script; do not hand-edit)

## Calculation script

The deterministic script lives in `backend/compute_shortage.py` (stdlib only):

```bash
python3 backend/compute_shortage.py MO-001   # regenerates purchase_request_draft.json
```

## Demo Dataset (MO-001, 500 units)

| Material | BOM/unit | Required (500) | On-hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| MAT-A Resin (kg) | 2 | 1,000 | 760 | 60 | 700 | 300 |
| MAT-B Packaging (pcs) | 1 | 500 | 600 | 50 | 550 | 0 |
| MAT-C Label (pcs) | 2 | 1,000 | 800 | 100 | 700 | 300 |

**Rules:** `required = BOM/unit × qty`; `available = max(on_hand − reserved, 0)`; `shortage = max(required − available, 0)`

**Expected draft PR:** PR-MO-001, MAT-A 300 kg + MAT-C 300 pcs, status PENDING_HUMAN_APPROVAL.

See `docs/PRD.md` section 2.2 for details.
