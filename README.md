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
ppic-alters/
├── docs/
│   └── PRD.md                 # Product Requirements Document (v1.1)
├── demo-data/                 # SYNTHETIC demo datasets (CSV + JSON)
│   ├── orders.csv / production_order.json
│   ├── bom.csv / bom.json
│   ├── inventory.csv / inventory.json
│   └── purchase_request_draft.json
├── server/                    # Express backend + Agent SDK
│   ├── index.js               # HTTP layer: SSE streaming, health, demo data
│   ├── agent.js               # CodeBuddy Agent SDK session, MCP tool, fallback
│   ├── engine.js              # Node wrapper around the deterministic engine
│   └── compute_shortage.py    # Deterministic BOM/inventory/shortage engine
├── public/                    # Static chat frontend
│   ├── index.html             # Chat UI shell
│   ├── app.js                 # SSE client, streaming render, Markdown
│   └── styles.css             # Professional planner UI theme
├── screenshots/               # Runtime verification screenshots (see below)
├── backend/                   # (PRD reference docs)
├── mcp-server/                # (PRD reference docs)
├── workbuddy/                 # Agent instructions and setup
├── tests/                     # Acceptance test cases (AC-01..AC-10)
├── package.json               # Node deps: @tencent-ai/agent-sdk, express
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

## Screenshots

Captured from the running app (`screenshots/`), one per acceptance scenario:

| File | Scenario | What it proves |
|---|---|---|
| `01-welcome.png` | Landing state | Chat shell, synthetic-data notice, agent mode badge |
| `02-material-plan.png` | MO-001, 500 units | Required 1000/500/1000, available 700/550/700, shortage 300/0/300, calculation trace, draft PR-MO-001 |
| `03-covered-order.png` | MO-002, 100 units | Fully covered order — no purchase request is created |
| `04-unknown-order.png` | MO-999 | Honest error listing known orders, no fabricated data |
| `05-mobile.png` | MO-001 on 390px | Responsive layout, horizontally scrollable plan table |

The badge in each capture reflects the live agent mode, so the screenshots never claim a
language model answered when it did not.

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

This repository includes a **runnable Agent Web application** built with the [CodeBuddy Agent SDK](https://www.npmjs.com/package/@tencent-ai/agent-sdk) (`@tencent-ai/agent-sdk`). The Express backend creates an Agent session with a PPIC Alter-S system prompt and a custom MCP tool (`compute_material_plan`) that delegates all arithmetic to the deterministic Python engine — the AI never invents BOM or stock numbers.

### Prerequisites

- **Node.js** ≥ 18 (tested on Node 22)
- **Python 3** (for the deterministic calculation engine)
- A **CodeBuddy model credential** — set `CODEBUDDY_API_KEY` (get one at
  [codebuddy.ai/profile/keys](https://www.codebuddy.ai/profile/keys)). Without it the app
  still runs, in deterministic mode (see below).

### Install & Run

```bash
npm install
npm start
# → PPIC Alter-S running at http://localhost:3000
```

Open `http://localhost:3000` and ask, for example:

> Can we produce 500 units of Product A for order MO-001?

The planner chat streams the agent's answer, shows the tool call it made, and renders the
material plan table plus the draft PR card.

### Two execution modes

| Mode | When | What answers |
|---|---|---|
| **Agent ready** | `CODEBUDDY_API_KEY` is set and the session connects | A CodeBuddy Agent SDK session. The model interprets the question and calls `compute_material_plan`; it never does arithmetic itself. |
| **Deterministic mode** | No credential, or the credential is rejected | A deterministic orchestrator that resolves the order reference and calls the same tool. Identical numbers, identical guardrails, no model. |

The header badge always states which mode is live, and the first answer in deterministic mode
says so explicitly. The app never pretends a model reasoned when one did not.

To reuse a desktop `codebuddy` login instead of an API key, start with `PPIC_FORCE_SDK=1`.

### API

| Endpoint | Purpose |
|---|---|
| `POST /api/chat` | SSE turn: `mode`, `status`, `tool_start`, `tool_result`, `plan`, `text`, `done` |
| `GET /api/health` | Service status plus `agent.mode`, `agent.verified`, `agent.reason` |
| `GET /api/demo-data` | Read-only synthetic dataset for the side panel |
| `GET /api/plan/:orderId` | Deterministic plan as JSON (404 with an honest error for unknown orders) |

### Architecture (Implementation)

```
Browser (Chat UI)        SSE stream         Express Server            CodeBuddy Agent SDK
   |  user message  ──────────────►  POST /api/chat  ──────►  unstable_v2_createSession()
   |  text_delta    ◄──────────────   (SSE)          ◄──────   Session.stream()
   |  tool_start    ◄──────────────                            ↳ systemPrompt = PPIC Alter-S
   |  plan          ◄──────────────                            ↳ mcpServers.ppic = createSdkMcpServer()
   |  done          ◄──────────────                                ↳ tool compute_material_plan
   |                                                                   → runs compute_shortage.py
```

Every number on screen travels the same path: `engine.js` → `compute_shortage.py`. Both the
model and the deterministic orchestrator can only *read* the result of that call.

**Deterministic rules** (enforced in `compute_shortage.py`, never by the LLM):
- `required = BOM per unit × quantity`
- `available = max(on-hand − reserved, 0)`
- `shortage = max(required − available, 0)`

**Guardrails:**
- The agent is read-only: `Bash`, `Write`, `Edit`, and web tools are disabled, and its only
  allowed tool is `compute_material_plan`.
- It cannot invent numbers — every figure must come back from a tool result.
- Purchase requests are always **drafts** with status `PENDING_HUMAN_APPROVAL`; no real PO is
  ever created, and there is no code path that could create one.
- An unknown order returns an explicit error listing the orders that do exist. Nothing is
  substituted or fabricated, and the UI shows the error verbatim.


## Data Notice

All demo data in this repository is **SYNTHETIC DEMO DATA** — not real production or customer data.

## License

MIT — see [LICENSE](LICENSE).

## Team

**Omni Lobster**

---

_PPIC Alter-S — WorkBuddy-First Hackathon MVP • PRD v1.1 • 06 NOV 2026_
