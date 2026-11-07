# Backend — PPIC Alter-S

Deterministic backend for:
- BOM requirement calculation
- Inventory availability (on-hand - reserved)
- Shortage computation
- Draft purchase request creation with idempotency
- State transitions (PENDING_APPROVAL → APPROVED/REJECTED)
- Audit logging

See `docs/PRD.md` sections 4, 5 for functional requirements and MCP tool contracts.
