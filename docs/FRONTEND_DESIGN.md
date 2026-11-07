# Frontend design notes — PRD v1.1

This is a supporting **web demonstration**, not the native Tencent WorkBuddy workflow. The browser never claims a WorkBuddy run has occurred. The hackathon's actual WorkBuddy screenshots, workflow run, and video still need to be captured from WorkBuddy.

## Visual direction

Industrial planning desk: restrained forest green, clean typography, readable tabular numbers, actionable states, low animation. Avoid gimmicky effects, fake counters, arbitrary dashboards, or treating agent-mode fallback as a real AI execution. Keep the existing vanilla HTML/CSS/JS stack.

## Information architecture

1. **Intake** — planner chooses MO-001 (golden), MO-002 (fully covered), or MO-999 (negative case).
2. **Planning** — material plan calculation is requested using existing server API.
3. **Inventory** — only deterministic tool output can mark inventory completed.
4. **Purchasing** — the system can render a draft PR for shortages; no live PO action.
5. **Human review** — if draft lines exist, remain **pending** in the UI; there is no approval endpoint and no simulated button that implies authority.
6. **Explanation** — render tool numbers, per-material calculations, execution mode, and errors.

The stage visualization is **not** a step-by-step trace of WorkBuddy. Planning and Inventory are computed by the same backend tool; stages are presentation labels based on observed events.

## Golden-demo invariants

- MO-001, 500 units: required 1,000/500/1,000; available 700/550/700; shortage 300/0/300, ordered MAT-A, MAT-C only in PR-MO-001.
- MO-002: no shortage; no PR.
- MO-999: honest unknown-order error, never a fabricated plan.
- Always use real server responses rather than hardcoded numbers.
- The web app never approves a purchase or creates a PO.
- When the SDK is unavailable, label output deterministic mode, not an agent response.

## Impeccable installation and execution

The current Impeccable distribution documents installation with:

```bash
npx impeccable install
```

Then launch an **Impeccable-supported coding assistant**, use `/impeccable init` to capture project design context, and apply its audit/refine skills to this frontend. `npx impeccable init` is **not** the documented CLI initialization flow. Check current instructions at https://github.com/pbakaus/impeccable before running anything.

**Not executed in this change:** Impeccable install/init. The GitHub editing integration does not execute CLI commands; this branch applies the same accessibility/clarity goals manually, and documents the follow-up. The frontend was not browser-tested in this integration.

## Suggested focused QA

1. Run `npm install && npm start` in a local checkout; confirm `/api/health` reports the actual mode.
2. Select Golden path: stage labels evolve from Intake → Planning to verified inventory → Draft → Pending review → Explanation. Verify table and quantities, then check the PR remains pending.
3. Select Covered order: no PR card; Review and PR draft stages are skipped.
4. Select Error handling: unknown order error, stage marked failed, no fabricated plan.
5. Test 390px viewport: six stages wrap to two rows, scenario buttons stack, table scrolls horizontally.
6. Keyboard navigation: visible focus and Enter-to-send. Shift+Enter adds a newline.
7. Reduced motion and screen reader: status changes should be understandable without motion.
8. Run `npm test`; record any failures honestly.

**Scope:** PRD explicitly says the native WorkBuddy demonstration and verified evidence take precedence over polished frontend. Do not mistake improved web visuals for AC-01 or AC-09 proof.
