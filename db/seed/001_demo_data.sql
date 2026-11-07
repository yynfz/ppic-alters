-- PPIC Alter-S — Seed Data (SYNTHETIC DEMO DATA)
-- Run after 001_initial_schema.sql
-- All values are invented for the hackathon golden demo.

-- ─── Products ────────────────────────────────────────────────────────────────

insert into products (product_id, product_name) values
    ('PROD-A', 'Product A')
on conflict (product_id) do nothing;

-- ─── Materials ───────────────────────────────────────────────────────────────

insert into materials (material_id, material_name, unit) values
    ('MAT-A', 'Resin', 'kg'),
    ('MAT-B', 'Packaging', 'pcs'),
    ('MAT-C', 'Label', 'pcs')
on conflict (material_id) do nothing;

-- ─── BOM ─────────────────────────────────────────────────────────────────────
-- qty_per_unit values: MAT-A=2, MAT-B=1, MAT-C=2

insert into bom (product_id, material_id, qty_per_unit, unit) values
    ('PROD-A', 'MAT-A', 2, 'kg'),
    ('PROD-A', 'MAT-B', 1, 'pcs'),
    ('PROD-A', 'MAT-C', 2, 'pcs')
on conflict (product_id, material_id) do nothing;

-- ─── Production Orders ───────────────────────────────────────────────────────
-- MO-001: 500 units (golden demo)
-- MO-002: 100 units (no shortage test case)

insert into production_orders (order_id, product_id, product_name, quantity, unit, due_date, status) values
    ('MO-001', 'PROD-A', 'Product A', 500, 'units', '2026-11-15', 'OPEN'),
    ('MO-002', 'PROD-A', 'Product A', 100, 'units', '2026-11-20', 'OPEN')
on conflict (order_id) do nothing;

-- ─── Inventory ───────────────────────────────────────────────────────────────
-- on_hand / reserved values from demo-data/inventory.csv
-- MAT-A: 760 on hand, 60 reserved  -> available = 700
-- MAT-B: 600 on hand, 50 reserved  -> available = 550
-- MAT-C: 800 on hand, 100 reserved -> available = 700

insert into inventory (material_id, material_name, unit, on_hand, reserved) values
    ('MAT-A', 'Resin', 'kg', 760, 60),
    ('MAT-B', 'Packaging', 'pcs', 600, 50),
    ('MAT-C', 'Label', 'pcs', 800, 100)
on conflict (material_id) do nothing;

-- ─── Purchase Request Draft (MO-001) ─────────────────────────────────────────
-- Expected from the golden demo: shortage MAT-A 300 kg + MAT-C 300 pcs

insert into purchase_requests (pr_id, order_id, product_id, product_name, status, note) values
    ('PR-MO-001', 'MO-001', 'PROD-A', 'Product A', 'PENDING_HUMAN_APPROVAL',
     'DRAFT ONLY — no purchase has been made. A human must review and approve before any PO is created.')
on conflict (pr_id) do nothing;

insert into purchase_request_lines (pr_id, material_id, material_name, unit, quantity) values
    ('PR-MO-001', 'MAT-A', 'Resin', 'kg', 300),
    ('PR-MO-001', 'MAT-C', 'Label', 'pcs', 300)
on conflict do nothing;

-- ─── Audit Log ───────────────────────────────────────────────────────────────

insert into audit_log (action, entity_type, entity_id, actor, details) values
    ('SEED', 'system', 'demo-data', 'migration',
     '{"note": "SYNTHETIC DEMO DATA — seeded from demo-data CSVs"}'::jsonb);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- The view v_material_plan should show:
--   MO-001: MAT-A req=1000 avail=700 short=300, MAT-B req=500 avail=550 short=0, MAT-C req=1000 avail=700 short=300
--   MO-002: all shortage=0

select order_id, material_id, required, available, shortage
from v_material_plan
order by order_id, material_id;
