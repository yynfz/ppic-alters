# PPIC Alter-S — Agentic Production Planning & Inventory Intelligence

> **Joint Intelligence. Unified Progress.**

PPIC Alter-S is an agentic manufacturing operations prototype built by **Omni Lobster** with **Tencent WorkBuddy AI** for the **Tencent Cloud AI CAN DO IT Hackathon Indonesia 2026** (Challenge B — The Office Agent).

It helps production planners check whether a production order is feasible by retrieving a bill of materials, evaluating available inventory, identifying material shortages, and preparing purchase requests — all coordinated through WorkBuddy via MCP tools.

## Quick Links

- **Competition:** [Tencent Cloud AI CAN DO IT Hackathon 2026](https://tch.tencentcloud.com/contest/47)
- **WorkBuddy:** [Product page](https://indonesia.tencentcloud.com/products/workbuddy)
- **MCP Guide:** [WorkBuddy MCP docs](https://www.codebuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)

## Architecture

```
Human / Planner
    ↓
Tencent WorkBuddy (AI orchestrator)
    ↓
MCP Connector (ppic-alter-s business tools)
    ↓
PPIC Backend (BOM / Inventory / Draft PR / Audit)
    ↓
Seeded Demo Data (SYNTHETIC)
```

Human Reviewer branch: `Reviewer → Approval UI → Backend`

Key principles:
- **Deterministic calculations** — all math in the backend, never in the agent
- **Human-in-the-loop** — purchase requests stay as drafts until explicit approval
- **Full audit trail** — every action is recorded

## Repository Structure

```
ppic-alter-s/
├── docs/
│   └── PRD.md                 # Product Requirements Document
├── demo-data/                 # SYNTHETIC demo datasets
├── backend/                   # PPIC backend (BOM, inventory, plan calculator, PR, audit)
├── mcp-server/                # MCP connector exposing business tools to WorkBuddy
├── workbuddy/                 # Agent prompts and setup instructions
├── tests/                     # Unit and integration tests
├── .env.example               # Environment variable template
└── README.md
```

## Golden Demo

**Prompt:**
> Can we produce 500 units of Product A for order MO-001? Check our inventory, identify shortages, and prepare a purchase request for approval.

**Expected result:**

| Material | Required | Available | Shortage |
|---|---|---|---|
| MAT-A (Resin, kg) | 1,000 | 700 | 300 |
| MAT-B (Packaging, pcs) | 500 | 550 | 0 |
| MAT-C (Label, pcs) | 1,000 | 700 | 300 |

Draft PR: MAT-A 300 kg + MAT-C 300 pcs → status PENDING_APPROVAL → human approves → APPROVED.

## MCP Tools (P0)

| Tool | Input | Output | Side effect |
|---|---|---|---|
| `get_production_order` | `order_id` | order details | Read-only |
| `calculate_material_plan` | `order_id` | required, available, shortage per SKU | Read-only |
| `create_purchase_request_draft` | `order_id`, `material_lines`, `idempotency_key` | pr_id, status, review_url | Create DRAFT only |
| `get_purchase_request_status` | `pr_id` | status, approved_by, audit_id | Read-only |

## Setup

> _Detailed setup instructions will be added as implementation progresses._

## Data Notice

All demo data in this repository is **SYNTHETIC DEMO DATA** — not real production data.

## License

MIT — see [LICENSE](LICENSE).

## Team

**Omni Lobster**

---

_Final Sprint PRD • 06 Nov 2026_
