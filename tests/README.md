# Tests — PPIC Alter-S

## Test Cases (from PRD section 8)

| Test ID | Scenario | Expected Result |
|---|---|---|
| T-01 | Get MO-001 | Product A, qty 500, ID benar |
| T-02 | Compute requirements | MAT-A 1000, MAT-B 500, MAT-C 1000 |
| T-03 | Compute availability | MAT-A 700, MAT-B 550, MAT-C 700 |
| T-04 | Compute shortages | MAT-A 300, MAT-B 0, MAT-C 300 |
| T-05 | Create draft | Hanya MAT-A/MAT-C, status pending |
| T-06 | Retry same idempotency key | Tidak ada duplikasi draft |
| T-07 | Approval | Status berubah hanya setelah user click |
| T-08 | Read final status in WorkBuddy | Agent melaporkan APPROVED plus PR ID |
| T-09 | Invalid order_id / unavailable MCP | Agent memberi error transparan |
| T-10 | Public links incognito | Semua link bisa dibuka |
| T-11 | Security | Tidak ada secret di repo/video/screenshots |
| T-12 | Evidence | 3 screenshot conversation asli dan terbaca |
