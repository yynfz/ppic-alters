# PPIC Alter-S — WorkBuddy-First Hackathon MVP

**Product Requirements Document (PRD)**
**Team:** Omni Lobster
**Revision:** v1.1 — WorkBuddy-First
**Tanggal revisi:** Jumat, 6 November 2026 (malam)
**Batas submission:** Sabtu, 7 November 2026 (jam penutupan perlu diperiksa pada Google Form/panduan terbaru)
**Deadline internal tim:** 7 November 2026, 18:00 WIB
**Challenge target:** The Office Agent (B)
**Runtime utama:** Tencent WorkBuddy AI
**Status:** Dokumen eksekusi, bukan klaim fitur selesai

> **Sumber perubahan:** Klarifikasi Yayan Fauzi via chat, 6 November 2026 pukul 20:14 WIB, merujuk Bagian 7 Project Submission Requirements.

> **Keputusan final:** Bukan membangun atau men-deploy aplikasi PPIC lengkap. Bangun satu workflow WorkBuddy yang dapat direproduksi, tunjukkan hasil uji dan Responsible AI, lalu kumpulkan workflow export atau repositori publik beserta bukti penggunaan. Project link online opsional/bonus. Video wajib 5–8 menit.

---

## 1. Executive Summary

**Problem.** Perencanaan produksi membutuhkan penggabungan informasi production order, Bill of Materials (BOM), stok tersedia, dan keputusan pengadaan. Proses manual berisiko menghasilkan perhitungan shortage yang lambat/tidak konsisten.

**Solution.** PPIC Alter-S adalah agentic workflow berbasis Tencent WorkBuddy. Pengguna meminta analisis kelayakan order dalam bahasa alami. WorkBuddy mengeksekusi tahapan Planning → Inventory → Purchasing memakai data demo dan kalkulasi deterministik; output akhirnya adalah rekomendasi kebutuhan material serta draft purchase request untuk ditinjau manusia.

**Brand concept.** Omni Lobster; Jogress = Joint Progress. Menggabungkan kemampuan Planning dan Inventory Control melalui orkestrasi agentic, bukan menyatakan model memiliki otoritas melakukan pembelian aktual.

**Core outcome.** Juri dapat melihat satu workflow benar-benar dijalankan, membaca jejak percakapan/penggunaan WorkBuddy, memverifikasi angka, menyaksikan pembatasan tindakan berisiko, dan mengakses artefak ekspor.

### 1.1 Submission Copy (siap pakai; sesuaikan fitur yang benar-benar berjalan)

- **Project Title:** PPIC Alter-S — Agentic Production Planning & Inventory Intelligence
- **Description (exactly 10 words):** AI agents coordinate production planning, inventory checks, and purchasing approvals.
- **Tagline:** Joint Intelligence. Unified Progress.

**Project Description:**

> PPIC Alter-S is an agentic production planning and inventory control prototype built by Omni Lobster using Tencent WorkBuddy. It helps planners evaluate a production order by reading a bill of materials, checking available inventory, calculating material shortages, and preparing a purchase request draft. WorkBuddy coordinates these steps as a transparent, reviewable workflow. Quantities are computed with deterministic rules rather than AI guesses, and purchasing outputs require explicit human review before any approval. The demo uses synthetic manufacturing data and documents test cases, limitations, and an audit trail. Inspired by the idea of Joint Progress, PPIC Alter-S shows how AI can assist cross-functional manufacturing decisions while keeping people responsible for consequential actions.

### 1.2 In Scope / Out of Scope

| In scope (P0) | Out of scope (jangan dikerjakan) |
|---|---|
| WorkBuddy instruction + workflow nyata | Deploy aplikasi web, Play Store, public dashboard |
| Data contoh production order, BOM, stok | Integrasi ERP Pachira live tanpa kebutuhan/izin |
| Kalkulasi shortages melalui script/tool deterministik | ERP manufacturing end-to-end; pembayaran/pembelian nyata |
| Draft Purchase Request, status menunggu review | Multi-tenant SaaS, OmahKu Billing |
| Bukti penggunaan, hasil pengujian, screenshot | Polesan UI kompleks/animasi mewah |
| Workflow export atau public code repo | Wajib GitHub (bukan syarat bila workflow export memadai) |
| Accountability, Responsible AI, diagram dan video | Klaim 3 autonomous agents tanpa bukti |

---

## 2. Requirements & Acceptance Criteria

### 2.1 Golden Demo — 1 Skenario Wajib

**Prompt:**

> "Can we produce 500 units of Product A for order MO-001? Check the BOM and available inventory, identify shortages, and prepare a purchase request draft for human review."

**Flow:**

1. User memasukkan prompt di WorkBuddy.
2. Planning step membaca MO-001 dan BOM terkait.
3. Inventory step membaca stok on_hand dan reserved, lalu menghitung available secara deterministik.
4. Purchasing step menyusun daftar material kekurangan dan draft Purchase Request (PR).
5. WorkBuddy menyajikan hasil beserta basis angka dan menampilkan status PENDING_HUMAN_APPROVAL.
6. Tindakan approve hanya dilakukan setelah persetujuan eksplisit operator; jika tidak tersedia mekanisme stateful, tampilkan draft tetap pending dan jelaskan keterbatasan. Tidak ada pembelian aktual.
7. Semua tahapan didokumentasikan melalui percakapan/tool output dan screenshot.

### 2.2 Dataset Demo Sintetis (tidak memakai data rahasia perusahaan)

| Material | BOM/unit | Required (500) | On-hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| MAT-A Resin (kg) | 2 | 1,000 | 760 | 60 | 700 | 300 |
| MAT-B Packaging (pcs) | 1 | 500 | 600 | 50 | 550 | 0 |
| MAT-C Label (pcs) | 2 | 1,000 | 800 | 100 | 700 | 300 |

**Rules:**
- `required = BOM/unit × production quantity`
- `available = max(on_hand − reserved, 0)`
- `shortage = max(required − available, 0)`

**Expected draft:** PR-MO-001, lines MAT-A 300 kg, MAT-C 300 pcs, status PENDING_HUMAN_APPROVAL (MAT-B must not be purchased).

### 2.3 P0 Acceptance Tests

| ID | Scenario | Expected result | Evidence owner |
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

**Definition of Done:** Semua AC P0 dieksekusi dan dicatat PASS/FAIL; kegagalan dicatat beserta keterbatasan. WorkBuddy secara nyata dipakai untuk mengorkestrasi langkah dan menghasilkan artefak. Tidak mengklaim multi-agent native, export, ataupun approval otomatis sebelum terbukti.

---

## 3. WorkBuddy Technical Design

### 3.1 Architecture — Deliverable Diagram PPT

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
      \       |       /
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

> **P0 implementation:** Satu WorkBuddy workflow/orchestrator yang dapat menjalankan tiga tahapan terdefinisi. Tooling dapat berupa file + WorkBuddy Skills/scripts yang didukung atau MCP tool yang sudah stabil. Jangan menghabiskan waktu membangun HTTP backend hanya demi arsitektur.

> **P1 optional:** Expert Team dengan tiga specialist agents hanya bila terbukti berjalan. Jika tidak, sebut sebagai role-based sequential workflow, bukan tiga agent terpisah.

### 3.2 WorkBuddy Workflow Specification

| Step | Agent responsibility | Input | Output | Guardrail |
|---|---|---|---|---|
| 1. Intake | Validasi order dan qty | User request | MO-001, Product A, qty 500 | Jangan tebak order tak dikenal |
| 2. Planning | Baca BOM | order + BOM seed | Material requirements | Referensikan data |
| 3. Inventory | Baca Stock | seed + reqs | Available/shortage | Gunakan script aritmetika on-hand/reserved, kalkulasi |
| 4. Purchasing | Buat recommendation | shortages | Draft PR pending | Jangan lakukan purchasing nyata dan draft PR |
| 5. Review | Minta konfirmasi manusia | draft PR | review decision/status | Human authority |
| 6. Explanation | Jelaskan tool outputs | tool results | Summary + reasoning | Jangan klaim tool yang gagal aktivitas dan output |

**Possible files:** `orders.csv`, `bom.csv`, `inventory.csv`, `compute_shortage.py` atau workflow built-in yang terbukti mendukung perhitungan, `purchase_request_draft.json`, `workbuddy-instructions.md`. Gunakan hanya format export sesuai kemampuan aktual WorkBuddy.

### 3.3 Responsible AI & Security

- **Accuracy:** angka dihitung fungsi deterministik dan divalidasi test dataset; AI tidak menciptakan nilai BOM/stock.
- **Human oversight:** rekomendasi hanya draft; tidak ada PO aktual atau transfer data/pembayaran tanpa persetujuan yang dapat dilihat.
- **Transparency:** jelaskan mana data synthetic, apa yang dikerjakan WorkBuddy, apa yang dikerjakan script/tool, dan apa yang masih manual.
- **Privacy:** tidak gunakan data pelanggan/supplier nyata atau token rahasia dalam file/video/screenshots.
- **Failure handling:** order invalid, stock data missing, dan tool error harus mendapat respons jujur; tidak berhalusinasi.
- **Accountability:** ada penanggung jawab pembangunan, pengujian, review, dan submission; hasil uji disimpan.
- **Auditability:** simpan history prompt/output, hasil kalkulasi dan keputusan reviewer; scrub secrets.

---

## 4. Tim dan Tasks per Person (3 Orang)

### A — WorkBuddy Agent & Workflow Engineer

**Owner:** konfigurasi WorkBuddy, workflow execution, evidence dari conversation.
**Tidak perlu:** membuat web app atau backend production.

| Task | Deliverable / DONE criteria | Target WIB |
|---|---|---|
| A1. WorkBuddy session & instructions | Agent/workflow memahami golden prompt | 6 Nov 23:00 |
| A2. Connect data/skill/tool dengan B | WorkBuddy membaca order dan BOM dari sumber, bukan angka prompt | 7 Nov 09:00 |
| A3. Orchestrate Planning → Inventory → Purchasing | Satu complete run dengan shortage benar dan draft pending | 7 Nov 10:30 |
| A4. Negative test dan guardrail | Invalid order tidak dihalusinasi, tidak auto-approve | 7 Nov 11:00 |
| A5. Export workflow atau dokumentasikan code fallback | File export siap atau kode publik bisa direproduksi | 7 Nov 12:00 |
| A6. Capture WorkBuddy evidence | 3 screenshot jelas + footage rekaman asli | 7 Nov 12:00 |
| A7. Review bagian 'How WorkBuddy Helps' | Copy cocok dengan implementasi | 7 Nov 13:00 |

**Definition of Done A:** satu run bekerja; evidence asli, bentuk penyerahan kode/workflow jelas; tidak ada klaim fungsi palsu.

### B — Data, Deterministic Logic & QA Engineer

**Owner:** demo dataset, kalkulasi, draft PR, tool/skill integration, bukti perhitungan.
**Tidak perlu:** deploy server publik.

| Task | Deliverable / DONE criteria | Target WIB |
|---|---|---|
| B1. Seed MO, BOM, inventory | CSV/JSON lengkap dan diberi label synthetic | 6 Nov 23:00 |
| B2. Script/logic shortage | Hasil 300/0/300 terbukti dengan test log | 7 Nov 08:30 |
| B3. Draft PR output | Hanya dua shortage lines; PENDING_HUMAN_APPROVAL | 7 Nov 09:30 |
| B4. Sambungkan tool/skill ke WorkBuddy | A dapat menjalankan workflow nyata | 7 Nov 10:00 |
| B5. Test evidence & negative cases | Bukti PASS/FAIL untuk AC-02..08, screenshot/log | 7 Nov 12:00 |
| B6. Package assets | Struktur data + script + instructions/README | 7 Nov 13:00 |
| B7. Repo fallback (hanya jika workflow export tak memadai) | Public repo, tanpa secret; link dibuka incognito | 7 Nov 14:00 |

**Definition of Done B:** output bisa direproduksi, data tidak sensitif, draft tidak mengeksekusi pembelian, file dapat dipakai ulang oleh A.

### C — Product, Responsible AI, Video & Submission Lead

**Owner:** seluruh narasi, accountability, testing document, video 5–8 menit, submission.
**Perlu:** bisa menguji hasil WorkBuddy dan mengerti angka demo.

| Task | Deliverable / DONE criteria | Target WIB |
|---|---|---|
| C1. Submission copy | Title, 10 words, project description | 6 Nov 23:00 |
| C2. Accountability Sheet | PIC/kontribusi, AI usage, test reviewer, risks, mitigation | 7 Nov 09:30 |
| C3. Architecture PPT + cover (jika diperlukan) | Diagram sesuai implementasi sebenarnya, 1–2 slides | 7 Nov 10:30 |
| C4. Test Results Report | AC-01..10 berisi PASS/FAIL, screenshots, limitation | 7 Nov 12:30 |
| C5. Video storyboard + screen record | Rekaman WorkBuddy asli mencakup complete flow | 7 Nov 12:30 |
| C6. Edit/upload video 5–8 menit | Target 6:30, link terbuka incognito | 7 Nov 15:00 |
| C7. Penjelasan 'How WorkBuddy Helps' | Paragraf jelas menyebut orchestration/tools/oversight | 7 Nov 15:00 |
| C8. Google Form final QA + submit | Upload/link valid, konfirmasi submission disimpan | 7 Nov 18:00 |

**Definition of Done C:** submission terkirim; video sesuai durasi; semua bukti valid, dokumen menunjukkan Responsible AI, tidak ada requirement yang lupa.

### 4.1 RACI Mini

| Deliverable | A | B | C |
|---|---|---|---|
| WorkBuddy workflow | R/A | C | I |
| Seed data + calculation script | C | R/A | I |
| Workflow export / code package | R | R | A (kelengkapan) |
| Architecture design | R | R | A (diagram final) |
| Test results + screenshot | R | R | A |
| Accountability sheet | C | C | R/A |
| Video demo 5–8 menit | R (footage) | R (proof) | A (edit/upload) |
| Google Form | I | I | R/A |

_R = Responsible, A=Accountable, C=Consulted, I=Informed._

---

## 5. Execution Schedule — 6 Nov Night / 7 Nov

| Time (WIB) | Gate | Required output | Contingency |
|---|---|---|---|
| 6 Nov 22:30 | Scope freeze | Semua setuju satu golden prompt dan tugas | Buang UI/deployment |
| 6 Nov 23:30 | G1 | Data & WorkBuddy files seed selesai, pertama dibuat | Pakai CSV sederhana |
| 7 Nov 09:00 | G2 | Tool & calculation — WorkBuddy dapat membaca data dan menghitung | Turunkan kompleksitas, tetap nyata |
| 7 Nov 10:30 | G3 | Golden Demo — Hasil shortage 300/0/300 dan draft pending | Jangan tambah Expert Team |
| 7 Nov 12:00 | Feature freeze | Hanya critical fixes, rekam bukti | Video & QA prioritas |
| 7 Nov 13:00 | G4 | Evidence — Export/repo, screenshots, tests, diagram, accountability | Repo fallback jika export gagal |
| 7 Nov 15:00 | G5 | Video — Video 5–8 min diunggah dan link valid | Prioritaskan screen recording asli |
| 7 Nov 16:30 | G6 | Submission check — Form, dokumen, link diperiksa dari incognito | Semua PIC menangani missing item |
| 7 Nov 18:00 | Internal submission | Bukti submit disimpan tim resmi | Periksa jam tutup form |

> **Penting:** Jadwal ini target internal; jam penutupan dari Google Form harus diverifikasi oleh C. Jangan menganggap 23:59 WIB resmi tanpa konfirmasi versi terbaru.

---

## 6. Submission Package — Based on Organizer Clarification

| Item | Status dari klarifikasi | File / Link | PIC |
|---|---|---|---|
| Project title | Required | Field form | C |
| Short description (10 words jika field meminta) | Required | Field form | C |
| Project description | Required | Field form/PDF | C |
| Accountability sheet | Required | PDF/XLSX/format yang diminta form | C |
| Test results and screenshots | Required | PDF + original screenshots | B + C |
| Architecture diagram | Required | PPT/PDF/PNG sesuai form | C, validated A+B |
| Demo video 5–8 minutes | Required | YouTube/Drive link yang bisa diakses | C, footage A+B |
| How WorkBuddy helps | Required | Paragraf pendek + bukti workflow | A + C |
| Source/workflow | Required — choose ONE | Public repo OR WorkBuddy exported workflow + usage evidence (Drive accepted) | A+B |
| Project online link | Optional bonus | Hosted application / demo if already exists | B (only if effortless) |
| 3 conversation screenshots | Requested in earlier checklist / strong evidence | PNG asli, no secrets | A |
| Cover solution image | Earlier checklist; check final Google Form | PNG/JPG | C |
| Social media post link | Earlier checklist; check final Google Form | YouTube/X/Threads | C |

> **Reconciliation:** Jika daftar pada Google Form berbeda, form dan handbook Bagian 7 menjadi sumber final. Jangan membuang cover/social begitu saja sebelum memeriksa field. Jangan membuat GitHub hanya karena checklist lama: cukup satu opsi source/workflow yang valid dan dapat ditinjau.

### 6.1 Package Structure — Export-First Path

```
OmniLobster_PPIC-Alter-S_Submission/
├── 01_Project_Copy.txt
├── 02_Accountability_Sheet.pdf
├── 03_Test_Results.pdf
├── 04_Architecture_Diagram.pptx
├── 05_WorkBuddy_Explanation.pdf
├── 06_WorkBuddy_Evidence/
│   ├── screenshot_01_prompt.png
│   ├── screenshot_02_execution.png
│   └── screenshot_03_result.png
├── 07_WorkBuddy_Workflow_Export/
│   ├── [actual WorkBuddy export artifact]
│   └── README_reproduce.txt
├── 08_Demo_Video_Link.txt
├── optional_cover.png
└── optional_social_link.txt
```

> Jika format export WorkBuddy tidak memuat script/asset pendukung, sertakan lampiran data + scripts atau gunakan public repository sebagai alternatif kode yang lengkap. Jangan mengunggah file seolah itu export resmi jika hanya screenshot.

---

## 7. Demo Video Script / Storyboard (target 6:30)

| Timestamp | Scene | Visual / narration | Owner |
|---|---|---|---|
| 00:00–00:40 | Industry problem | C: mismatch between planning and stock | C |
| 00:40–01:15 | Introduce PPIC Alter-S | C: why WorkBuddy, Joint Progress | C |
| 01:15–02:00 | Prompt + workflow setup | A: native WorkBuddy UI, data source | A |
| 02:00–03:10 | Planning + Inventory | A/B: BOM, available stock, deterministic values | A/B |
| 03:10–04:30 | Purchasing draft | A/B: shortage → PR draft pending review | A/B |
| 04:30–05:15 | Human oversight | A/C: explicit gate + no actual purchase | A/C |
| 05:15–06:00 | Testing + Responsible AI | B/C: test results, error case, synthetic data | B/C |
| 06:00–06:30 | Architecture & closing | C: WorkBuddy contribution, impact, next steps | C |

**Video pass criteria:** total 5:00–8:00; WorkBuddy UI visible; clearly explain what WorkBuddy does vs script vs human; show screenshot/test evidence and limitations; audio audible; no fake actions or secrets; video link accessible without requesting access.

---

## 8. Accountability Sheet — Required Columns

Create table with columns: **Person/PIC, Role, Work completed, WorkBuddy contribution, Dataset/tools used, Validation performed, Responsible AI controls, Evidence filename/URL, Review sign-off, Date.**

Each person confirms only what was actually delivered. Include **Known limitations** section and dataset synthetic disclaimer.

**Suggested allocations:**
- **A:** prompts, agent/workflow setup, execution, screenshots, export or reproducible setup.
- **B:** dataset, formulas, script/tool integration, expected-vs-actual test results, error cases.
- **C:** product copy, responsibility matrix, risk controls, PPT, video, test report, final Google Form.

---

## 9. Test Results Report — Suggested Layout

For AC-01 through AC-10, record: **Test ID | Date | Input | Expected | Actual | PASS/FAIL | Screenshot/log path | Tester | Notes.**

Attach at least 3 clear WorkBuddy screenshots and relevant file outputs. Never label unexecuted tests as PASS. If evidence is unavailable, write NOT RUN or BLOCKED and explain.

---

## 10. How WorkBuddy Helps — Draft Copy

> Tencent WorkBuddy serves as the conversational interface and orchestrator for the PPIC Alter-S workflow. It translates the planner's request into structured steps, obtains production order and inventory evidence through configured tools or Skills, and presents an interpretable material plan and purchase request draft. Deterministic calculations prevent invented quantities, while explicit human review prevents unsupervised purchasing actions. Our implementation uses synthetic data, logs test outputs, and documents limitations for responsible evaluation.

_Revise this paragraph if any cited tool/Skill or control is not actually implemented._

---

## 11. Submission Go / No-Go & Fallback

**GO when:**
- WorkBuddy workflow runs on real dataset
- Shortage numbers match (300/0/300)
- PR remains pending without human approval
- Actual workflow export or public repo is accessible
- Accountability and testing docs are complete
- Video 5–8 min accessible
- Google Form submitted

**If integrations fail:** Reduce to a single WorkBuddy workflow that reads local synthetic files and performs deterministic checks through supported tools. Do not claim separate specialists if only one orchestrator exists.

**If workflow export fails:** Select public repo path and include code, prompts/skills and reproduction steps.

**If project link isn't ready:** Skip it (optional bonus).

**If video is late:** Cut decorative segments, not live demo, Responsible AI, or test results.

### Final Reviewer (C) Checklist

- [ ] Deadline closure hour checked from current form.
- [ ] Title, 10 words, project description filled.
- [ ] Accountability sheet filled and signed-off.
- [ ] Test results include actual PASS/FAIL and screenshots.
- [ ] Architecture diagram matches real workflow.
- [ ] Demo video is between 5 and 8 minutes, link accessible.
- [ ] How WorkBuddy helps is accurate.
- [ ] Public repo OR actual WorkBuddy workflow export plus evidence shared.
- [ ] Any optional project link, cover, social link checked against actual form.
- [ ] Synthetic data and security reviewed, secrets scrubbed.
- [ ] Google Form confirmation saved.

---

## 12. Notes, Evidence and Source Hierarchy

**Top priority:** organizer's 6 November clarification referencing the official handbook Section 7, followed by the currently accessible Google Form fields; earlier informal checklists are provisional where inconsistent.

**Evidence ownership:** Video and screenshots must be generated from real WorkBuddy usage. This PRD describes what to build and submit, not what has already been done.

**Internal milestone 18:00 WIB** is set by Omni Lobster for safety, not confirmed as the organizer's closing time. No production deployment is required per organizer clarification.

---

## References

- Tencent Cloud Hackathon: <https://tch.tencentcloud.com/contest/47>
- WorkBuddy product: <https://indonesia.tencentcloud.com/products/workbuddy>
- WorkBuddy Connector / MCP + Skill: <https://open.workbuddy.cn/en/docs/connector>
- WorkBuddy Expert Team (optional P1): <https://open.workbuddy.cn/en/docs/expert-team>
- WorkBuddy MCP guide: <https://www.codebuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide>

---

_PPIC Alter-S — WorkBuddy-First Hackathon MVP • PRD v1.1 • 06 NOV 2026_
