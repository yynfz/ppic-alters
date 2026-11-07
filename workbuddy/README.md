# WorkBuddy Agent Configuration

This directory contains WorkBuddy AI agent setup, instructions, and workflow configuration.

## Files

- `workbuddy-instructions.md` — agent instructions and guardrails
- `prompts.md` — golden prompt and test prompts

## Workflow Steps (from PRD v1.1 section 3.2)

| Step | Responsibility | Input | Output | Guardrail |
|---|---|---|---|---|
| 1. Intake | Validate order and qty | User request | MO-001, Product A, qty 500 | Don't guess unknown orders |
| 2. Planning | Read BOM | order + BOM seed | Material requirements | Reference data, don't invent |
| 3. Inventory | Read Stock | seed + reqs | Available/shortage | Use deterministic arithmetic |
| 4. Purchasing | Build recommendation | shortages | Draft PR pending | No actual purchasing |
| 5. Review | Request human confirmation | draft PR | review decision/status | Human authority required |
| 6. Explanation | Explain tool outputs | tool results | Summary + reasoning | Don't claim failed tool activity |

## Agent Guardrails (from PRD v1.1 section 3.3)

- **Accuracy:** AI tidak menciptakan nilai BOM/stock; semua angka dari fungsi deterministik.
- **Human oversight:** rekomendasi hanya draft; tidak ada PO aktual tanpa persetujuan.
- **Transparency:** jelaskan mana data synthetic, apa yang dikerjakan WorkBuddy, script/tool, dan manual.
- **Privacy:** tidak gunakan data pelanggan/supplier nyata atau token rahasia.
- **Failure handling:** order invalid, stock missing, tool error → respons jujur; tidak berhalusinasi.
- **Accountability:** ada penanggung jawab; hasil uji disimpan.
- **Auditability:** simpan history prompt/output, hasil kalkulasi, keputusan reviewer; scrub secrets.
