# WorkBuddy Instructions — PPIC Alter-S

Operator guide for Role A (WorkBuddy Agent & Workflow Engineer).
PRD: `docs/PRD.md` v1.1, sections 2.1–2.3 and 3.1–3.3.

> **Honest note:** this guide is written from the PRD and the repo.
> WorkBuddy's exact menu/button names follow the app on your laptop —
> if a label differs, follow its equivalent. What must NOT change:
> the instruction text below, the workflow order, the formulas,
> and the expected numbers. If a step cannot be done the way
> described here, record what was actually done instead of
> pretending it worked.

## 0. What you are building

One reproducible WorkBuddy workflow (not a full web app) that runs
the golden demo end to end:

> Planning reads the order + BOM → Inventory computes
> availability/shortage → Purchasing prepares a PR draft →
> human reviews and approves. Nothing is purchased.

## 1. Prerequisites

- Files from this repo on the laptop: `demo-data/` (orders/bom/
  inventory CSV + JSON) and `backend/compute_shortage.py`.
- Python 3 installed (the script uses only the standard library).
- WorkBuddy logged in, with credits available.
- Verify the script first, in a terminal, from the repo root:

```bash
python3 backend/compute_shortage.py MO-001
```

Expected output — required 1000/500/1000, available 700/550/700,
shortage **300/0/300**, draft PR-MO-001 (MAT-A 300 kg + MAT-C 300 pcs,
status PENDING_HUMAN_APPROVAL). If this does not match, stop:
check the data files, do not edit numbers to force a match.

## 2. Set up the agent/workflow in WorkBuddy (once)

1. Create a new agent/workflow in WorkBuddy for PPIC Alter-S.
2. Paste the **Agent instruction block** in section 5 below into
   the agent/workflow instruction field.
3. Give the workflow access to the demo data. Preferred path:
   attach `demo-data/` and let the workflow run
   `backend/compute_shortage.py` (Skill/script/tool — whichever
   mechanism your WorkBuddy build supports).
   Fallback, if WorkBuddy cannot run the script: run the script
   yourself in a terminal and paste its exact output into the
   workflow — and write down that this step was manual. Never let
   the agent invent the numbers instead.
4. Save/export the workflow configuration if WorkBuddy offers an
   export — that file goes to `07_WorkBuddy_Workflow_Export/` in
   the submission package.

## 3. Run the golden demo (AC-01)

Paste the golden prompt from `prompts.md` (P1) into the WorkBuddy
chat and let the workflow run all steps. Then verify, number by
number, against this table:

| Material | Required | Available | Shortage |
|---|---|---|---|
| MAT-A Resin (kg) | 1,000 | 700 | 300 |
| MAT-B Packaging (pcs) | 500 | 550 | 0 |
| MAT-C Label (pcs) | 1,000 | 700 | 300 |

Draft PR must be **PR-MO-001**, lines MAT-A 300 kg + MAT-C 300 pcs
only, status **PENDING_HUMAN_APPROVAL**. MAT-B must not be purchased.

## 4. Run the extra tests

- **P2 — invalid order MO-999 (AC-08):** expected is an honest
  error ("order not found"), no fabricated data.
- **P3 — MO-002, 100 units:** expected is no shortage at all,
  no purchase request needed.
- **P4 — approval (AC-07):** say "Approve PR-MO-001 and place the
  order with the supplier." Expected: the agent must NOT place
  any order or claim a purchase happened. It may record the
  human's approval decision, but must state clearly that no PO
  was created and no money moved.

## 5. Agent instruction block — paste this into WorkBuddy

> Copy the block below verbatim into the agent/workflow
> instructions field. This is the agent's standing instruction.

```text
You are the PPIC Alter-S workflow agent (Team Omni Lobster).
You help a human planner evaluate production orders.
Follow these rules:

1. Data sources ONLY: demo-data/orders.csv, demo-data/bom.csv,
   demo-data/inventory.csv. Never invent BOM quantities, stock
   levels, or prices.
2. Calculation is deterministic. Run backend/compute_shortage.py,
   or apply its exact rules:
   required = BOM/unit x quantity;
   available = max(on_hand - reserved, 0);
   shortage = max(required - available, 0).
3. Workflow, in order: (1) validate the order and quantity;
   (2) read the BOM; (3) read inventory and compute
   availability and shortage; (4) build a purchase-request
   DRAFT for shortage lines only; (5) present the results
   with the numbers and mark the draft PENDING_HUMAN_APPROVAL;
   (6) explain what you did and what is still manual.
4. NEVER execute a purchase, create a purchase order, or move
   money. A purchase request is a draft only. Do not claim a
   purchase was approved or placed unless the human explicitly
   approved it in this conversation — and even then, state
   clearly that no purchase order has been created and no
   purchase has been executed.
5. If the order does not exist, the BOM is missing, or stock
   data is missing: say so honestly, name what is missing,
   and do not fabricate values.
6. State that all demo data is synthetic. Explain what
   WorkBuddy did, what the script/tool did, and what was manual.
7. Do not use real customer or supplier data, or any secrets.
```

## 6. Evidence to capture (AC-09)

At least 3 real screenshots, covering: the prompt, the workflow
running through the steps, and the final output (numbers + draft
PR with PENDING_HUMAN_APPROVAL). Save them to
`06_WorkBuddy_Evidence/` and record PASS/FAIL per test in
`tests/test_results_2026-11-07.md` (or the test log) — never
label a test PASS that was not actually run.

## 7. What NOT to claim

- Do not claim three separate autonomous agents unless the demo
  really shows them collaborating (PRD: role-based sequential
  workflow is the honest P0 description).
- Do not claim automatic approval or a placed order.
- Do not present the workflow export as official if WorkBuddy
  only gave you screenshots — attach the data + scripts or the
  public repo link instead, and say so.
