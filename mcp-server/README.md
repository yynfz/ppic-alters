# MCP Server — PPIC Alter-S

Custom MCP connector exposing PPIC business tools to Tencent WorkBuddy AI.

## P0 Tools

| Tool | Input | Output | Side effect |
|---|---|---|---|
| `get_production_order` | `order_id` | order_id, product, quantity, due_date | Read-only |
| `calculate_material_plan` | `order_id` | lines: required, available, shortage, source | Read-only |
| `create_purchase_request_draft` | `order_id`, `material_lines`, `idempotency_key` | pr_id, status, review_url | Create DRAFT only |
| `get_purchase_request_status` | `pr_id` | status, approved_by, timestamp, audit_id | Read-only |

## P1 (optional)

- `get_audit_events(pr_id)`
- `list_suppliers(material_ids)`

See `docs/PRD.md` section 5.2 for the full tool contract and validation rules.
