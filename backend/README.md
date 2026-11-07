# Backend — PPIC Alter-S

Deterministic logic and calculation scripts for:
- BOM requirement calculation (`required = BOM/unit × qty`)
- Inventory availability (`available = max(on_hand − reserved, 0)`)
- Shortage computation (`shortage = max(required − available, 0)`)
- Draft Purchase Request generation (PENDING_HUMAN_APPROVAL)
- Test evidence and expected-vs-actual results

## Key Principle

All quantity calculations are **deterministic** — computed by scripts/tools, never by AI guesses. The WorkBuddy agent references these outputs but does not invent values.

## Expected Output (MO-001)

```
shortage(MAT-A) = max(500×2 - (760-60), 0) = 300 kg
shortage(MAT-B) = max(500×1 - (600-50), 0) = 0 pcs
shortage(MAT-C) = max(500×2 - (800-100), 0) = 300 pcs

Draft PR: lines = [{MAT-A: 300 kg}, {MAT-C: 300 pcs}]
          status = PENDING_HUMAN_APPROVAL
```

See `docs/PRD.md` sections 2.2, 2.3, and 3.2 for specifications.
