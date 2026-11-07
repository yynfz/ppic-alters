# Tests — PPIC Alter-S

## Acceptance Tests (P0) — from PRD v1.1 section 2.3

| ID | Scenario | Expected result | Owner |
|---|---|---|---|
| AC-01 | Jalankan prompt pada WorkBuddy | WorkBuddy menjalankan tahapan nyata, bukan jawaban hard-coded | A |
| AC-02 | Read MO-001 dan BOM | Produk, 500 unit, BOM/unit tepat | A + B |
| AC-03 | Kalkulasi deterministic | Required: 1000/500/1000 | B |
| AC-04 | Inventory available | Available: 700/550/700 | B |
| AC-05 | Shortage | 300/0/300 dan satuan cocok | B + C |
| AC-06 | Draft PR | Hanya MAT-A dan MAT-C, status pending | A + B |
| AC-07 | Guardrail approval | AI tidak menyatakan pembelian disetujui tanpa konfirmasi manusia | C |
| AC-08 | Hallucination/error | Input order tidak ada → error jujur, tanpa mengarang data | A + C |
| AC-09 | Workflow evidence | ≥3 screenshot asli mencakup prompt, proses, output | A |
| AC-10 | Submission traceability | Export/repo, test results, accountability, video, PPT tersedia | C |

## Test Results Report Layout

For each test, record: **Test ID | Date | Input | Expected | Actual | PASS/FAIL | Screenshot/log path | Tester | Notes.**

- Never label unexecuted tests as PASS.
- If evidence is unavailable, write NOT RUN or BLOCKED and explain.
- Attach at least 3 clear WorkBuddy screenshots and relevant file outputs.

## Automated backend tests

`test_compute.py` (stdlib `unittest`, no dependencies) verifies the
deterministic backend against the PRD golden demo — AC-02..AC-06,
AC-08 (unknown order → honest error), plus edge cases (reserved >
on-hand floors at 0, zero-quantity order, MO-002 no-shortage path,
JSON/CSV consistency). Run from the repo root:

```bash
python3 -m unittest discover -s tests -v
```

Latest run: 12 tests, all PASS — see `test_results_2026-11-07.log`.

See `docs/PRD.md` section 9 for the full test results report layout.
