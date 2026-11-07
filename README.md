# PPIC Alter-S — Agentic Production Planning & Inventory Intelligence

> **Joint Intelligence. Unified Progress.**

PPIC Alter-S is an agentic production planning and inventory control prototype built by **Omni Lobster** using **Tencent WorkBuddy AI** for the **Tencent Cloud AI CAN DO IT Hackathon Indonesia 2026** (Challenge B — The Office Agent).

It helps planners evaluate a production order by reading a bill of materials, checking available inventory, calculating material shortages, and preparing a purchase request draft. WorkBuddy coordinates these steps as a transparent, reviewable workflow. Quantities are computed with deterministic rules rather than AI guesses, and purchasing outputs require explicit human review before any approval.

## Quick Links

- **Competition:** [Tencent Cloud AI CAN DO IT Hackathon 2026](https://tch.tencentcloud.com/contest/47)
- **WorkBuddy:** [Product page](https://indonesia.tencentcloud.com/products/workbuddy)
- **WorkBuddy Connector / MCP + Skill:** [Docs](https://open.workbuddy.cn/en/docs/connector)
- **WorkBuddy MCP Guide:** [Guide](https://www.codebuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)

## Architecture

```
Human Planner
    |
    v
Tencent WorkBuddy AI (conversation + orchestrator)
    |         |         |
    v         v         v
  Planning  Inventory  Purchasing
   step      step       step
    \         |         /
     \        |        /
  WorkBuddy Tool / Skill layer
        |
  Synthetic demo data
  MO-001 | BOM | Inventory
        |
  Deterministic calculation
        |
  PR Draft (Pending Review)
        |
  Human Review Gate
        |
  Test logs + screenshots
```

Key principles:
- **Deterministic calculations** — all math via scripts/tools, never AI guesses
- **Human-in-the-loop** — purchase requests stay as drafts (PENDING_HUMAN_APPROVAL) until explicit human approval
- **Responsible AI** — accuracy, transparency, privacy, failure handling, accountability, auditability
- **Export-first** — WorkBuddy workflow export OR public repo; online project link is optional/bonus

## Repository Structure

```
ppic-alter-s/
├── docs/
│   └── PRD.md                 # Product Requirements Document (v1.1)
├── demo-data/                 # SYNTHETIC demo datasets (CSV/JSON)
├── backend/                   # Deterministic logic & calculation scripts
├── mcp-server/                # MCP connector (if using MCP path)
├── workbuddy/                 # Agent instructions and setup
├── tests/                     # Acceptance test cases (AC-01..AC-10)
├── .env.example               # Environment variable template
├── .gitignore
├── LICENSE                    # MIT
└── README.md
```

## Golden Demo

**Prompt:**
> Can we produce 500 units of Product A for order MO-001? Check the BOM and available inventory, identify shortages, and prepare a purchase request draft for human review.

**Expected result:**

| Material | BOM/unit | Required | On-hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| MAT-A (Resin, kg) | 2 | 1,000 | 760 | 60 | 700 | **300** |
| MAT-B (Packaging, pcs) | 1 | 500 | 600 | 50 | 550 | 0 |
| MAT-C (Label, pcs) | 2 | 1,000 | 800 | 100 | 700 | **300** |

**Formulas:**
- `required = BOM/unit × production quantity`
- `available = max(on_hand − reserved, 0)`
- `shortage = max(required − available, 0)`

**Draft PR:** PR-MO-001, lines MAT-A 300 kg + MAT-C 300 pcs, status PENDING_HUMAN_APPROVAL (MAT-B excluded).

## WorkBuddy Workflow Steps

| Step | Responsibility | Guardrail |
|---|---|---|
| 1. Intake | Validate order and qty | Don't guess unknown orders |
| 2. Planning | Read BOM | Reference data, don't invent |
| 3. Inventory | Read stock, compute available/shortage | Use deterministic arithmetic |
| 4. Purchasing | Build shortage recommendation & draft PR | No actual purchasing |
| 5. Review | Request human confirmation | Human authority required |
| 6. Explanation | Explain tool outputs & reasoning | Don't claim failed tool activity |

## Acceptance Tests (P0)

| ID | Scenario | Expected |
|---|---|---|
| AC-01 | Run prompt on WorkBuddy | Real workflow execution, not hard-coded |
| AC-02 | Read MO-001 and BOM | Product A, 500 units, BOM/unit correct |
| AC-03 | Deterministic calculation | Required: 1000/500/1000 |
| AC-04 | Inventory available | Available: 700/550/700 |
| AC-05 | Shortage | 300/0/300, units match |
| AC-06 | Draft PR | Only MAT-A and MAT-C, status pending |
| AC-07 | Approval guardrail | AI does not claim purchase approved without human |
| AC-08 | Hallucination/error | Invalid order → honest error, no fabricated data |
| AC-09 | Workflow evidence | ≥3 real screenshots covering prompt, process, output |
| AC-10 | Submission traceability | Export/repo, test results, accountability, video, PPT |

## Submission Package

Export-first path:
```
OmniLobster_PPIC-Alter-S_Submission/
├── 01_Project_Copy.txt
├── 02_Accountability_Sheet.pdf
├── 03_Test_Results.pdf
├── 04_Architecture_Diagram.pptx
├── 05_WorkBuddy_Explanation.pdf
├── 06_WorkBuddy_Evidence/        (3 screenshots)
├── 07_WorkBuddy_Workflow_Export/ (or public repo)
├── 08_Demo_Video_Link.txt
├── optional_cover.png
└── optional_social_link.txt
```

Video: 5–8 minutes (target 6:30). See `docs/PRD.md` section 7 for storyboard.

## Setup

> _Detailed setup instructions will be added as implementation progresses._

## Data Notice

All demo data in this repository is **SYNTHETIC DEMO DATA** — not real production or customer data.

## License

MIT — see [LICENSE](LICENSE).

## Team

**Omni Lobster**

---

_PPIC Alter-S — WorkBuddy-First Hackathon MVP • PRD v1.1 • 06 NOV 2026_
