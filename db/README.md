# Database — Supabase Schema, Seeds, and Client

## Structure

```
db/
├── migrations/
│   └── 001_initial_schema.sql    # Tables, enums, RLS, view, triggers
├── seed/
│   └── 001_demo_data.sql         # SYNTHETIC demo data (MO-001, MO-002, BOM, inventory)
└── README.md                      # This file
```

## Tables

| Table | Description |
|---|---|
| `products` | Product master (PROD-A) |
| `materials` | Material master (MAT-A, MAT-B, MAT-C) |
| `bom` | Bill of Materials: product → materials with qty_per_unit |
| `production_orders` | Production orders (MO-001, MO-002) |
| `inventory` | On-hand and reserved stock per material |
| `purchase_requests` | Draft PRs — always PENDING_HUMAN_APPROVAL |
| `purchase_request_lines` | Line items per draft PR |
| `audit_log` | Every plan computation, PR creation, approval/rejection |

## View: `v_material_plan`

Reproduces the deterministic calculation from `backend/compute_shortage.py`:

```sql
required  = bom.qty_per_unit * production_orders.quantity
available = greatest(inventory.on_hand - inventory.reserved, 0)
shortage  = greatest(required - available, 0)
```

## Setup with Supabase

### Option A: Supabase Cloud (recommended for deployment)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, run:
   - `db/migrations/001_initial_schema.sql`
   - `db/seed/001_demo_data.sql`
3. Go to Settings → API and copy:
   - **Project URL** → `SUPABASE_URL`
   - **Service Role Key** → `SUPABASE_SERVICE_KEY` (use service role for backend)
4. Add to `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   ```

### Option B: Local Supabase (for development)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase init
supabase start

# Run migrations
supabase db reset

# Get local URL and keys
supabase status
```

### Fallback: CSV files (no Supabase needed)

If `SUPABASE_URL` is not set, the backend automatically falls back to reading
`demo-data/*.csv` files and running `compute_shortage.py`. This is the original
WorkBuddy-First mode and requires no database.

## Data Model (mirrors Pachira DB structure)

| Supabase Table | CSV File | Pachira Equivalent |
|---|---|---|
| `production_orders` | orders.csv | LHP / production-order records |
| `bom` | bom.csv | Formula tables (fml / formula_detail) |
| `inventory` | inventory.csv | Stock ledger (stok) |
| `purchase_requests` | purchase_request_draft.json | Purchase-request draft |

All data is **SYNTHETIC DEMO DATA** — invented values for the hackathon golden demo.
