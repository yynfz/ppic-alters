# WorkBuddy Agent Configuration

This directory contains WorkBuddy AI agent setup, prompts, and skill policies.

## Files

- `prompts.md` — agent instructions and guardrails
- `setup.md` — WorkBuddy + MCP connection setup guide

## Agent Guardrails (from PRD section 5.4)

- **Planning:** pahami order, minta data produksi, jangan menebak BOM.
- **Inventory:** gunakan available stock dari tool, jangan samakan on-hand dengan free stock.
- **Purchasing:** buat PR draft hanya untuk shortage dan mintakan approval manusia.
- **Orchestrator:** tampilkan alasan, referensi source/tool, exception secara transparan.
- **Approval:** agent tidak boleh memanggil endpoint approve atas nama manusia.
