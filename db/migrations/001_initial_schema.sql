-- PPIC Alter-S — Supabase Schema Migration
-- Team Omni Lobster — Tencent Cloud AI CAN DO IT Hackathon Indonesia 2026
--
-- This schema mirrors the CSV demo data structure (orders.csv, bom.csv,
-- inventory.csv) and adds purchase request + audit log tables.
-- All demo data is SYNTHETIC — invented for the hackathon golden demo.

-- Enable extensions
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type order_status as enum ('OPEN', 'CLOSED', 'CANCELLED');

create type pr_status as enum (
    'PENDING_HUMAN_APPROVAL',
    'APPROVED',
    'REJECTED',
    'NO_PURCHASE_NEEDED'
);

-- ─── Products ────────────────────────────────────────────────────────────────

create table if not exists products (
    product_id    text primary key,
    product_name  text not null,
    created_at    timestamptz not null default now()
);

-- ─── Materials ───────────────────────────────────────────────────────────────

create table if not exists materials (
    material_id    text primary key,
    material_name  text not null,
    unit           text not null,
    created_at     timestamptz not null default now()
);

-- ─── Bill of Materials (BOM) ─────────────────────────────────────────────────
-- product_id + material_id is the natural composite key

create table if not exists bom (
    id             uuid primary key default gen_random_uuid(),
    product_id     text not null references products(product_id),
    material_id    text not null references materials(material_id),
    qty_per_unit   numeric not null check (qty_per_unit > 0),
    unit           text not null,
    created_at     timestamptz not null default now(),
    unique (product_id, material_id)
);

create index if not exists idx_bom_product on bom(product_id);

-- ─── Production Orders ───────────────────────────────────────────────────────

create table if not exists production_orders (
    order_id      text primary key,
    product_id    text not null references products(product_id),
    product_name  text not null,
    quantity      numeric not null check (quantity > 0),
    unit          text not null,
    due_date      date,
    status        order_status not null default 'OPEN',
    created_at    timestamptz not null default now()
);

create index if not exists idx_orders_status on production_orders(status);

-- ─── Inventory ───────────────────────────────────────────────────────────────

create table if not exists inventory (
    material_id    text primary key references materials(material_id),
    material_name  text not null,
    unit           text not null,
    on_hand        numeric not null check (on_hand >= 0),
    reserved       numeric not null default 0 check (reserved >= 0),
    updated_at     timestamptz not null default now()
);

-- ─── Purchase Requests (drafts) ──────────────────────────────────────────────

create table if not exists purchase_requests (
    pr_id         text primary key,
    order_id      text not null references production_orders(order_id),
    product_id    text not null references products(product_id),
    product_name  text not null,
    status        pr_status not null default 'PENDING_HUMAN_APPROVAL',
    note          text,
    approved_by   text,
    approved_at   timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists idx_pr_order on purchase_requests(order_id);
create index if not exists idx_pr_status on purchase_requests(status);

-- ─── Purchase Request Lines ──────────────────────────────────────────────────

create table if not exists purchase_request_lines (
    id            uuid primary key default gen_random_uuid(),
    pr_id         text not null references purchase_requests(pr_id) on delete cascade,
    material_id   text not null references materials(material_id),
    material_name text not null,
    unit          text not null,
    quantity      numeric not null check (quantity > 0),
    created_at    timestamptz not null default now()
);

create index if not exists idx_prl_pr on purchase_request_lines(pr_id);

-- ─── Audit Log ───────────────────────────────────────────────────────────────
-- Every plan computation, PR creation, and approval/rejection is logged.

create table if not exists audit_log (
    id            uuid primary key default gen_random_uuid(),
    action        text not null,
    entity_type   text not null,
    entity_id     text not null,
    actor         text not null default 'system',
    details       jsonb,
    created_at    timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_log(entity_type, entity_id);
create index if not exists idx_audit_created on audit_log(created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- For the hackathon demo, we use a permissive policy.
-- In production, restrict to authenticated users only.

alter table products enable row level security;
alter table materials enable row level security;
alter table bom enable row level security;
alter table production_orders enable row level security;
alter table inventory enable row level security;
alter table purchase_requests enable row level security;
alter table purchase_request_lines enable row level security;
alter table audit_log enable row level security;

-- Demo: allow all access (adjust for production)
create policy "demo_read_all" on products for select using (true);
create policy "demo_insert_all" on products for insert with check (true);
create policy "demo_update_all" on products for update using (true);

create policy "demo_read_all" on materials for select using (true);
create policy "demo_insert_all" on materials for insert with check (true);
create policy "demo_update_all" on materials for update using (true);

create policy "demo_read_all" on bom for select using (true);
create policy "demo_insert_all" on bom for insert with check (true);

create policy "demo_read_all" on production_orders for select using (true);
create policy "demo_insert_all" on production_orders for insert with check (true);
create policy "demo_update_all" on production_orders for update using (true);

create policy "demo_read_all" on inventory for select using (true);
create policy "demo_insert_all" on inventory for insert with check (true);
create policy "demo_update_all" on inventory for update using (true);

create policy "demo_read_all" on purchase_requests for select using (true);
create policy "demo_insert_all" on purchase_requests for insert with check (true);
create policy "demo_update_all" on purchase_requests for update using (true);

create policy "demo_read_all" on purchase_request_lines for select using (true);
create policy "demo_insert_all" on purchase_request_lines for insert with check (true);

create policy "demo_read_all" on audit_log for select using (true);
create policy "demo_insert_all" on audit_log for insert with check (true);

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_inventory_updated
    before update on inventory
    for each row execute function update_updated_at();

-- ─── View: Material Plan (computed) ──────────────────────────────────────────
-- This view reproduces the deterministic calculation from compute_shortage.py:
--   required  = BOM qty_per_unit x order quantity
--   available = max(on_hand - reserved, 0)
--   shortage  = max(required - available, 0)

create or replace view v_material_plan as
select
    o.order_id,
    o.product_id,
    o.product_name,
    o.quantity,
    o.unit,
    b.material_id,
    b.material_name,
    b.qty_per_unit,
    (b.qty_per_unit * o.quantity) as required,
    i.on_hand,
    i.reserved,
    greatest(i.on_hand - i.reserved, 0) as available,
    greatest((b.qty_per_unit * o.quantity) - greatest(i.on_hand - i.reserved, 0), 0) as shortage
from production_orders o
join bom b on o.product_id = b.product_id
join inventory i on b.material_id = i.material_id
where o.status = 'OPEN';

comment on table products is 'PPIC Alter-S — Product master (SYNTHETIC DEMO DATA)';
comment on table materials is 'PPIC Alter-S — Material master (SYNTHETIC DEMO DATA)';
comment on table bom is 'PPIC Alter-S — Bill of Materials per product (SYNTHETIC DEMO DATA)';
comment on table production_orders is 'PPIC Alter-S — Production orders (SYNTHETIC DEMO DATA)';
comment on table inventory is 'PPIC Alter-S — On-hand and reserved stock (SYNTHETIC DEMO DATA)';
comment on table purchase_requests is 'PPIC Alter-S — Draft purchase requests (never auto-approved)';
comment on table audit_log is 'PPIC Alter-S — Audit trail for all plan/PR actions';
comment on view v_material_plan is 'PPIC Alter-S — Deterministic material plan view (required/available/shortage)';
