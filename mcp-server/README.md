# MCP Server — PPIC Alter-S (optional path)

Custom MCP connector exposing PPIC business tools to Tencent WorkBuddy AI.

> **Note (v1.1):** MCP is one possible tooling path. WorkBuddy Skills/scripts that support computation are equally valid. Don't spend time building an HTTP backend solely for architecture. Choose whichever path WorkBuddy actually supports.

## Possible Tools (if MCP path is used)

| Tool | Input | Output | Side effect |
|---|---|---|---|
| `get_production_order` | `order_id` | order_id, product, quantity, due_date | Read-only |
| `calculate_material_plan` | `order_id` | lines: required, available, shortage, source | Read-only |
| `create_purchase_request_draft` | `order_id`, `material_lines` | pr_id, status (PENDING_HUMAN_APPROVAL) | Create DRAFT only |
| `get_purchase_request_status` | `pr_id` | status, approved_by, audit_id | Read-only |

## Validation Rules

- Parameter unknown ditolak.
- Qty harus numerik dan positif.
- Material harus ada pada BOM dan shortage.
- Draft quantity tidak boleh melebihi shortage.
- Tidak ada approval otomatis oleh agent.

See `docs/PRD.md` section 3.2 for the WorkBuddy workflow specification.
