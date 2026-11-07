# PPIC Alter-S — Agentic Production Planning & Inventory Intelligence

**Team:** Omni Lobster
**Kompetisi:** Tencent Cloud AI CAN DO IT Hackathon Indonesia 2026
**Challenge:** B — The Office Agent (Automate Better)
**Teknologi utama:** Tencent WorkBuddy AI (agent runtime + MCP tools)
**Versi dokumen:** 1.0 / Final sprint / 6 November 2026
**Deadline submission:** Sabtu, 7 November 2026, 23:59 WIB
**Deadline internal tim:** Sabtu, 7 November 2026, 18:00 WIB
**Status:** Draft eksekusi; pemilik tugas perlu mengisi nama dan memperbarui hasil sebenarnya.

> **Executive decision:** Kunci scope pada satu golden demo: WorkBuddy memeriksa kebutuhan produksi, menghitung shortage material memakai backend deterministik, menyiapkan draft purchase request, dan meminta persetujuan manusia. Semua artefak submission harus selesai sebelum 18:00 WIB agar tersedia buffer.

---

## 1. Ringkasan Produk & Positioning

### 1.1 Problem Statement

Di lingkungan manufaktur, operator PPIC kerap berpindah antara data pesanan produksi, Bill of Materials (BOM), stok, dan pengadaan sebelum dapat menjawab pertanyaan sederhana: apakah order dapat diproduksi tepat waktu? Proses manual menimbulkan keterlambatan identifikasi kekurangan material, miskomunikasi antarfungsi, dan risiko pengajuan pembelian yang salah.

### 1.2 Solusi

PPIC Alter-S adalah prototipe asisten operasional manufaktur berbasis Tencent WorkBuddy AI. Pengguna menyampaikan tujuan dalam bahasa alami. WorkBuddy mengorkestrasi langkah perencanaan, pengecekan inventory, dan persiapan draft pembelian melalui MCP tools. Perhitungan kuantitatif tetap dijalankan backend, dan tindakan pembelian tidak dieksekusi tanpa persetujuan manusia.

**Filosofi produk:** Jogress — Joint Progress. Production Planning dan Inventory Control saling melengkapi; kolaborasi menghasilkan satu keputusan bisnis yang bisa diaudit. Referensi Digimon hanya inspirasi branding internal; narasi submission harus dapat dipahami tanpa referensi IP pihak lain.

### 1.3 Copy untuk Submission

- **Project Title:** PPIC Alter-S — Agentic Production Planning & Inventory Intelligence
- **Description (10 words):** AI agents coordinate production planning, inventory checks, and purchasing approvals.
- **Team:** Omni Lobster
- **Tagline:** Joint Intelligence. Unified Progress.

**Project Description (draft Bahasa Inggris):**

> PPIC Alter-S is an agentic manufacturing operations prototype built by Omni Lobster with Tencent WorkBuddy. It helps production planners check whether a production order is feasible by retrieving a bill of materials, evaluating available inventory, identifying material shortages, and preparing purchase requests. WorkBuddy coordinates the workflow through controlled MCP tools, while deterministic backend rules handle all quantity calculations. Purchase requests remain drafts until a human explicitly approves them, and every important step is recorded for traceability. Our focused demonstration shows how an AI assistant can turn a cross-functional PPIC question into a verified, reviewable business action. The underlying integration pattern is designed to be reusable, but this hackathon prototype intentionally focuses on one end-to-end manufacturing scenario.

> **Important:** Jangan menyatakan Expert Team, deployment publik, atau live API Pachira sebagai sudah tersedia sebelum benar-benar diuji. Jika data sintetis, tulis demo dataset secara eksplisit.

---

## 2. Tujuan, Batasan, dan Indikator Sukses

### 2.1 Product Goals (P0)

1. Pengguna bisa menanyakan kelayakan satu order produksi melalui WorkBuddy.
2. WorkBuddy sungguh-sungguh memanggil tool untuk membaca order dan hasil kalkulasi, bukan memberi jawaban contoh statis.
3. Backend menghitung kebutuhan, stok tersedia, dan shortage secara deterministik.
4. WorkBuddy menghasilkan draft purchase request (PR) yang memuat material, kuantitas, dan referensi order.
5. Sistem menahan approval pada manusia dan mencatat kejadiannya.
6. Alur didemonstrasikan dalam video dan dapat ditelusuri di kode serta screenshot percakapan asli.
7. Seluruh 10 item submission lengkap, URL valid, dan disubmit sebelum deadline internal.

### 2.2 Non-Goals / Out of Scope

- Full ERP/manufacturing lifecycle: produksi real-time, shop floor, MRP multi-level kompleks, accounting, HPP, pajak, actual stock mutation.
- Integrasi OmahKu, integrasi hotel/klinik, serta universal multi-tenant SaaS siap produksi.
- Pembayaran atau pembelian aktual kepada supplier.
- Forecasting canggih, optimisasi jadwal, supplier quotation otomatis, dan dashboard penuh.
- Penggunaan data rahasia Pachira tanpa izin dan sanitasi.

### 2.3 Prioritas

| Level | Harus ada | Catatan |
|---|---|---|
| **P0 — submit** | WorkBuddy aktif, MCP tool call nyata, seeded BOM+stok, kalkulasi shortage, draft PR, human approval, audit event, video, GitHub, 10 artefak | Semua harus terlihat atau dibuktikan |
| **P1 — jika P0 stabil** | WorkBuddy Expert Team dengan role Planning/Inventory/Purchasing, daftar supplier, web review page, unit test tambahan | Dikerjakan hanya jika golden demo sukses |
| **P2 — sesudah hackathon** | Multi-tenant/RBAC penuh, RAG SOP, live ERP integration, optimisasi pembelian, OmahKu connector | Jangan masuk sprint final |

### 2.4 Definisi Sukses

- **Functional:** 1/1 golden scenario selesai tanpa mengedit output AI secara manual; hasil shortage sesuai expected dataset; satu PR berstatus PENDING_APPROVAL lalu APPROVED hanya setelah aksi manusia.
- **Reliability:** 3 kali uji berturut-turut sukses dalam lingkungan demo sebelum rekaman final (jika stabilitas terbatas, rekam percobaan yang benar-benar terjadi dan ungkapkan limitation).
- **Evidence:** Tiga screenshot WorkBuddy menunjukkan prompt, pemanggilan tools, dan hasil; link demo, video, GitHub, dan social post terbuka dari incognito.
- **Submission:** 10/10 item terisi, tidak ada placeholder atau tautan lokal (localhost) pada formulir.

---

## 3. Pengguna, Kebutuhan, dan Alur

### 3.1 Persona

- **PPIC Planner** — ingin jawaban cepat atas kelayakan pesanan dan kekurangan material.
- **Inventory Controller** — memvalidasi stok yang boleh dipakai; stok tersedia = on-hand dikurangi allocated/reserved (untuk MVP, incoming dianggap 0).
- **Purchasing Reviewer / Supervisor** — memeriksa kebutuhan yang diusulkan sebelum menyetujui draft.

### 3.2 User Stories dan Acceptance Criteria

| ID | User Story | Acceptance Criteria |
|---|---|---|
| US-01 | Sebagai planner, saya bertanya apakah Order MO-001 untuk 500 unit bisa dipenuhi. | WorkBuddy menampilkan order, produk, qty, dan asal tool. |
| US-02 | Sebagai planner, saya ingin tahu bahan mana yang kurang. | Backend mengembalikan required, available, shortage per SKU; total sesuai data. |
| US-03 | Sebagai purchasing, saya ingin draft PR dari shortage. | Draft PR memuat order ID, material lines, qty positif, status pending, unique ID. |
| US-04 | Sebagai supervisor, saya ingin memutuskan approve/reject. | Tidak ada approval otomatis oleh agent; tindakan eksplisit memengaruhi status dan audit. |
| US-05 | Sebagai reviewer, saya ingin melihat alasan rekomendasi. | Ringkasan WorkBuddy menyebut data dasar, hasil perhitungan, PR ID, serta status final. |

### 3.3 Golden Demo: Satu Perintah, Satu Keputusan

**Prompt:**

> "Can we produce 500 units of Product A for order MO-001? Check our inventory, identify shortages, and prepare a purchase request for approval."

**Expected sequence:**

1. WorkBuddy mengenali order MO-001, memanggil `get_production_order`.
2. WorkBuddy meminta `calculate_material_plan` pada backend; backend menarik BOM + inventory seeded.
3. WorkBuddy menjelaskan SKU mana yang cukup dan mana yang kurang, beserta angka.
4. WorkBuddy meminta `create_purchase_request_draft` hanya untuk material shortage.
5. Sistem mengembalikan PR ID serta PENDING_APPROVAL dan URL review.
6. Pengguna membuka review page atau tindakan approval yang benar-benar memerlukan konfirmasi manusia; user memilih Approve.
7. WorkBuddy memanggil `get_purchase_request_status` dan menampilkan status + audit reference.

**Data simulasi disepakati** (semua dalam satu tenant DEMO, bukan data Pachira nyata):

| Material | BOM/unit | Required (500 unit) | On hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| MAT-A (Resin, kg) | 2 | 1,000 | 760 | 60 | 700 | 300 |
| MAT-B (Packaging, pcs) | 1 | 500 | 600 | 50 | 550 | 0 |
| MAT-C (Label, pcs) | 2 | 1,000 | 800 | 100 | 700 | 300 |

**Formula:**
- `required = BOM_per_unit × order_qty`
- `available = max(on_hand - reserved, 0)`
- `shortage = max(required - available, 0)`

**Expected draft PR:** MAT-A 300 kg + MAT-C 300 pcs; MAT-B tidak menjadi line pembelian.

**Asumsi MVP:** tidak ada konversi satuan, scrap, lead time, MOQ, atau incoming stock.

---

## 4. Functional Requirements

| ID | Requirement | Priority | Owner | Verifikasi |
|---|---|---|---|---|
| FR-01 | WorkBuddy menjalankan prompt natural language dan memanggil tool setidaknya satu MCP tool yang nyata. | P0 | A | Live conversation / trace |
| FR-02 | `get_production_order` memberikan product, target qty, dan order reference. | P0 | B | Response payload |
| FR-03 | `calculate_material_plan` mengembalikan required, available, shortage deterministik. | P0 | B | Unit test + contoh angka |
| FR-04 | Agent menjelaskan hasil tanpa mengubah angka dari tool. | P0 | A | Bandingkan response dengan UI |
| FR-05 | `create_purchase_request_draft` hanya menerima material shortage dan memakai idempotency key. | P0 | B | Duplicate-call test |
| FR-06 | PR memiliki status PENDING_APPROVAL; tidak otomatis approved. | P0 | B | API state inspection |
| FR-07 | Pengguna harus menekan Approve/Reject secara eksplisit lewat review screen terkontrol. | P0 | B + C | Demo interaction |
| FR-08 | Setelah approval, WorkBuddy membaca status baru melalui tool; hasil ditampilkan ke pengguna. | P0 | A + B | Conversation output |
| FR-09 | Audit mencatat request, draft, action, timestamp, status, dan actor demo. | P0 | B | Audit log sample |
| FR-10 | Tersedia dokumentasi setup reproducible, sample data, dan video. | P0 | B + C | Repo + links |
| FR-11 | Expert Team memisahkan peran Planning, Inventory, Purchasing secara nyata. | P1 | A | Trace role jika tersedia |
| FR-12 | Reviewer dapat membuka publik read-only project/demo page. | P1 | B + C | Incognito URL |

---

## 5. Arsitektur Teknis WorkBuddy

### 5.1 Komponen

1. **Tencent WorkBuddy:** UI percakapan, interpretasi tujuan, urutan tool call, penjelasan hasil. Integrasi melalui custom MCP server; bila siap, Expert Team untuk pembagian peran.
2. **MCP Connector (ppic-alter-s):** expose business tools dengan input/output JSON yang jelas, hanya dari sumber data demo.
3. **PPIC Backend/API:** aturan deterministik untuk BOM requirement, stock available, shortage, validasi draft, state transition, dan audit.
4. **Data demo:** seeded JSON/SQLite/PostgreSQL kecil berisi production order, BOM, inventory, draft PR, approvals, logs.
5. **Review UI:** halaman web minimal untuk memperlihatkan PR dan melakukan explicit approval; demo page publik bersifat read-only bila autentikasi belum matang.
6. **GitHub + Demo Video:** source code, langkah menjalankan WorkBuddy, demo yang bisa dilihat tanpa kredensial rahasia.

**Data flow:**
```
Human → WorkBuddy → MCP Connector → PPIC Backend → Seeded Data
```
Aksi draft kembali `Backend → WorkBuddy`; keputusan manusia via `Review UI → Backend`, lalu agent memeriksa status final.

### 5.2 MCP Tool Contract (P0)

| Tool | Input utama | Output ringkas | Side effect |
|---|---|---|---|
| `get_production_order` | `order_id` | order_id, product, quantity, due_date | Read-only |
| `calculate_material_plan` | `order_id` | lines: required, available, shortage, source | Read-only |
| `create_purchase_request_draft` | `order_id`, `material_lines`, `idempotency_key` | pr_id, status, review_url | Create DRAFT only |
| `get_purchase_request_status` | `pr_id` | status, approved_by, timestamp, audit_id | Read-only |

**Optional P1:** `get_audit_events(pr_id)`, `list_suppliers(material_ids)`.

**Validation contract:**
- Parameter unknown ditolak.
- Qty harus numerik dan positif.
- Material harus ada pada BOM dan shortage.
- Draft quantity tidak boleh melebihi shortage yang dihitung backend kecuali secara eksplisit dibolehkan.
- Idempotency key mencegah duplikasi.

### 5.3 Pseudocode Response dan Invariant

```
GET plan(MO-001):
  shortage(MAT-A) = max(500*2 - (760-60), 0) = 300 kg
  shortage(MAT-B) = max(500*1 - (600-50), 0) = 0 pcs
  shortage(MAT-C) = max(500*2 - (800-100), 0) = 300 pcs

POST draft(MO-001):
  lines = [{sku: MAT-A, qty: 300}, {sku: MAT-C, qty: 300}]
  status = PENDING_APPROVAL

HUMAN approves in review UI:
  status = APPROVED; audit event appended
```

### 5.4 WorkBuddy Agent Instructions — Minimum

- **Planning responsibility:** pahami order, minta data produksi, jangan menebak BOM.
- **Inventory responsibility:** gunakan available stock dari tool, jangan samakan on-hand dengan free stock.
- **Purchasing responsibility:** buat PR draft hanya untuk shortage dan mintakan approval manusia.
- **Orchestrator behavior:** tampilkan alasan, referensi source/tool, exception secara transparan; jangan menyatakan transaksi sudah dibuat jika tool error.
- **Approval guardrail:** agent tidak boleh memanggil endpoint approve atas nama manusia; approval dilakukan melalui tindakan eksplisit yang tercatat.

> **Scope realistis:** Satu WorkBuddy agent dengan tool sequence nyata adalah P0. Memaketkan tiga spesialis menjadi WorkBuddy Expert Team adalah P1 setelah P0 lulus. Jangan mendemokan "tiga agent aktif" jika yang berjalan baru satu orchestrator.

### 5.5 Data / Security / Deployment

- Semua source seed diberi label **SYNTHETIC DEMO DATA**.
- Jangan commit `.env`, API keys, token WorkBuddy, kredensial ERP, atau data pelanggan.
- Demo approval dilakukan dengan role reviewer dan token/session terbatas; bila belum kuat, jangan buka endpoint write ke publik. Gunakan local review UI dan public read-only landing page.
- Log minimal: event_id, timestamp, actor, order_id, pr_id, action, outcome; jangan log secret.
- Pastikan GitHub README berisi arsitektur, setup, MCP installation, demo prompt, mock data, batasan, dan tautan video.
- Untuk URL project demo, host halaman publik berisi overview, sample result, dan langkah menjalankan demo WorkBuddy. Jangan menyebut halaman statis sebagai live WorkBuddy jika memang bukan.

---

## 6. Tanggung Jawab Tiga Orang (RACI Sederhana)

### A — WorkBuddy / AI Engineer (Owner Integrasi AI)

Tugas utama: konfigurasi WorkBuddy, tool use, orchestration, conversation evidence. Tidak bertanggung jawab mengerjakan backend business calculation dari nol.

| Task | Hasil terukur | Deadline WIB | Dependency |
|---|---|---|---|
| A1. Smoke test | Satu tool berhasil dipanggil; screenshot log | 6 Nov, 17:30 | B expose stub |
| A2. Agent prompt + skill policy | Instruction terarsip di GitHub; guardrail valid | 6 Nov, 19:00 | Data contract |
| A3. Connect empat MCP tools | WorkBuddy membaca order dan plan, membuat draft | 6 Nov, 22:00 | B1–B3 |
| A4. Uji end-to-end + failure cases | Screenshot run sukses; catatan error | 7 Nov, 09:00 | B approval |
| A5. Capture 3 screenshot asli | Prompt, tool calls, result/approval jelas | 7 Nov, 10:00 | A4 |
| A6. Rekam segmen WorkBuddy | Footage bersih untuk editor C | 7 Nov, 11:00 | A4 |
| A7. Expert Team (P1, optional) | 3 role benar-benar aktif, bukan simulasi | Setelah P0 stabil | Semua P0 |

**Definition of Done A:** WorkBuddy memanggil MCP tool dan menghasilkan response berdasarkan data backend; tidak ada klaim agent/tool fiktif; tiga screenshot final siap.

### B — Backend / MCP / Deployment Engineer (Owner Sistem Transaksional)

| Task | Hasil terukur | Deadline WIB | Dependency |
|---|---|---|---|
| B1. Seed dataset MO-001, BOM, stok | Angka sesuai tabel dan tersimpan | 6 Nov, 17:00 | Tidak ada |
| B2. Implement deterministic plan calculator | Unit tests shortage 300/0/300 lulus | 6 Nov, 19:00 | B1 |
| B3. Expose MCP tool interfaces | A bisa memanggil 4 tools | 6 Nov, 21:00 | B2 |
| B4. Draft PR + state + idempotency | PR tetap pending; tidak duplikat | 6 Nov, 23:00 | B3 |
| B5. Minimal approval view + audit log | Approve/reject tercatat dan readable | 7 Nov, 09:00 | B4 |
| B6. GitHub README + deploy public demo page | Repo rapi; URL publik bisa dibuka | 7 Nov, 12:00 | B3–B5 |
| B7. Regression test + bug fix | P0 bebas critical defect | 7 Nov, 14:00 | A + C |

**Definition of Done B:** hasil kalkulasi tepat, draft tidak dapat auto-approved, kode dapat dijalankan dari README, URL demo publik valid, tidak ada secret.

### C — Product / QA / Video / Submission Lead (Owner Kelengkapan Submission)

| Task | Hasil terukur | Deadline WIB | Dependency |
|---|---|---|---|
| C1. Finalisasi title, 10 words, description | Copy final sesuai fitur riil | 6 Nov, 18:00 | A/B scope |
| C2. Storyboard & shotlist video | 2–3 menit siap | 6 Nov, 19:00 | Golden scenario |
| C3. Cover + Architecture Diagram PPT | 1 cover + diagram arsitektur editable | 6 Nov, 23:00 | A/B stack |
| C4. UAT test case dan screenshot selection | Bukti demo cocok dengan klaim | 7 Nov, 10:30 | A4–A5 |
| C5. Edit + upload demo video | YouTube unlisted/public, incognito pass | 7 Nov, 14:00 | A6 |
| C6. Publish social media post | X/Threads/YouTube sesuai ketentuan | 7 Nov, 15:00 | C5 |
| C7. Finalize submission matrix & test links | 10/10 item, link verified | 7 Nov, 16:30 | A/B/C |
| C8. Submit + capture confirmation | Bukti submission disimpan tim | 7 Nov, 18:00 | C7 |

**Definition of Done C:** juri dapat memahami masalah/solusi, membuka video dan kode, melihat bukti WorkBuddy; submission sudah terkirim dan ada bukti konfirmasi.

**Cross-help:** A membantu B debug MCP; B membantu C deploy halaman demo; C membantu A sebagai operator approval dan regression tester. Setiap item hanya punya satu owner final.

---

## 7. Jadwal dan Go/No-Go (WIB)

| Waktu | Gate | Kondisi Lulus | Jika Gagal |
|---|---|---|---|
| 6 Nov 17:30 | G1: WorkBuddy Tool Call | Minimal satu tool sederhana berhasil dipanggil | A fokus koneksi, bukan Expert Team |
| 6 Nov 21:00 | G2: Material Plan | Backend hitung shortage 300/0/300 dan terbaca agent | Matikan fitur supplier/multi-agent tambahan |
| 6 Nov 23:00 | G3: Draft PR | PR dibuat dan berstatus pending + proof tool call | Gunakan draft PR lokal; jangan klaim approval otomatis |
| 7 Nov 09:00 | G4: Golden Demo | End-to-end berjalan minimal sekali | Rekam demo paling valid, jelaskan limitation |
| 7 Nov 12:00 | Feature Freeze | Tidak ada fitur baru, hanya critical bug fixes | P1/P2 dibatalkan permanen |
| 7 Nov 14:00 | G5: Video & GitHub | URL video dan repo sudah tersedia | Kurangi animasi/desain; prioritaskan footage aktual |
| 7 Nov 16:30 | G6: Submission QA | 10/10 item, 4 external links lolos incognito | Eskalasi ke semua anggota; isi celah submission dulu |
| 7 Nov 18:00 | Submit | Form submitted + confirmation stored | Sisa waktu sampai 23:59 adalah buffer, bukan waktu pengembangan |

**Meeting:** 6 Nov 17:30, 21:00, 23:00; 7 Nov 09:00, 12:00, 16:30. Durasi maksimal 10 menit. Komunikasi issue memakai format **Blocker — Owner — Need by**.

---

## 8. Test Plan & Acceptance Gate

| Test ID | Scenario | Expected Result | Owner |
|---|---|---|---|
| T-01 | Get MO-001 | Product A, qty 500, ID benar | B |
| T-02 | Compute requirements | MAT-A 1000, MAT-B 500, MAT-C 1000 | B |
| T-03 | Compute availability | MAT-A 700, MAT-B 550, MAT-C 700 | B |
| T-04 | Compute shortages | MAT-A 300, MAT-B 0, MAT-C 300 | B + C |
| T-05 | Create draft | Hanya MAT-A/MAT-C, status pending | A + B |
| T-06 | Retry same idempotency key | Tidak ada duplikasi draft | B |
| T-07 | Approval | Status berubah hanya setelah user click | B + C |
| T-08 | Read final status in WorkBuddy | Agent melaporkan APPROVED plus PR ID | A |
| T-09 | Invalid order_id / unavailable MCP | Agent memberi error transparan, tidak mengarang | A + C |
| T-10 | Public links incognito | Demo, video, GitHub, social bisa dibuka | C |
| T-11 | Security | Tidak ada secret di repo/video/screenshots | B + C |
| T-12 | Evidence | 3 screenshot conversation asli dan terbaca | A + C |

**Acceptance authority:** C melakukan UAT dan menyatakan submission readiness; A/B bertanggung jawab memperbaiki blocker masing-masing. Pada jam 12:00 tanggal 7, hanya perbaikan P0 boleh masuk.

---

## 9. Paket Submission: 10 Item, Owner, dan Format

| # | Requirement | Owner | Gate | Output yang disiapkan |
|---|---|---|---|---|
| 1 | Project Title | C | 6 Nov 18:00 | PPIC Alter-S — Agentic Production Planning & Inventory Intelligence |
| 2 | Description dalam 10 kata | C | 6 Nov 18:00 | "AI agents coordinate production planning, inventory checks, and purchasing approvals." |
| 3 | Project Description | C, review A+B | 7 Nov 12:00 | Bahasa Inggris, 100–160 kata, akurat sesuai fitur nyata |
| 4 | Cover image solusi | C | 6 Nov 23:00 | PNG/JPG resolusi memadai, brand Omni Lobster + PPIC Alter-S |
| 5 | Link project demo | B, review C | 7 Nov 12:00 | Public demo/landing page plus instructions; jangan localhost |
| 6 | Link demo video | C, footage A+B | 7 Nov 14:00 | YouTube unlisted/public; 2–3 menit bila aturan tidak menyebut durasi |
| 7 | WorkBuddy/CodeBuddy conversation history (3 screenshot) | A | 7 Nov 10:00 | 3 gambar asli, prompt/tool/result, rahasia disamarkan |
| 8 | Architecture Diagram PPT | C, validasi A+B | 6 Nov 23:00 | 1–2 slides editable diagram dan aliran data |
| 9 | Source Code (GitHub) | B, support A | 7 Nov 12:00 | Repo reachable, README, sample env, no secrets |
| 10 | Social media post | C | 7 Nov 15:00 | X/Threads/YouTube; URL publik + caption |

> Field list di atas berasal dari daftar persyaratan yang diberikan tim. Periksa kembali format/upload type pada form submission final; jangan berasumsi semua item menerima URL alih-alih file.

### 9.1 Minimum GitHub Repository Structure

```
ppic-alter-s/
├── README.md
├── LICENSE
├── .env.example
├── docs/
│   ├── architecture.png
│   └── submission-copy.md
├── demo-data/
│   ├── production_order.json
│   ├── bom.json
│   └── inventory.json
├── backend/
├── mcp-server/
├── workbuddy/
│   ├── prompts.md
│   └── setup.md
└── tests/
```

### 9.2 Architecture Diagram PPT — Konten Wajib

Satu slide utama: `Human / Planner → Tencent WorkBuddy (AI orchestrator) → MCP Connector (business tools) → PPIC Backend (BOM / Inventory / Draft PR / Audit) → Seeded Demo Data`.

Cabang `Human Reviewer → Approval UI → Backend`. Sertakan label keamanan: **deterministic calculations**, **human-in-the-loop**, dan **audit**. Beri label P1 / optional untuk Expert Team bila belum diimplementasikan.

### 9.3 Video Rundown (2:30–3:00)

| Waktu | Adegan | Narasi inti |
|---|---|---|
| 00:00–00:20 | Masalah PPIC | Order masuk, tetapi kecukupan bahan tidak terlihat |
| 00:20–00:35 | Intro produk | Omni Lobster memperkenalkan PPIC Alter-S |
| 00:35–01:05 | Prompt WorkBuddy | Pengguna meminta analisis MO-001 |
| 01:05–01:40 | MCP results | BOM, inventory, shortage 300/0/300 terlihat |
| 01:40–02:10 | Draft & approval | PR pending → human approves → status terbaca |
| 02:10–02:35 | Architecture | WorkBuddy + MCP + backend + audit |
| 02:35–03:00 | Value / closing | Decisions faster; human remains in control |

**Screen recording:** tampilkan software asli; overlay angka hanya dari output valid; subtitle English dianjurkan; tanpa klaim integrasi live bila menggunakan demo data.

---

## 10. Risiko, Mitigasi, dan Fallback

| Risiko | Probabilitas / dampak | Mitigasi | Trigger fallback |
|---|---|---|---|
| MCP WorkBuddy sulit dikonfigurasi | Tinggi / kritis | Smoke test pertama, gunakan local stdio atau HTTP MCP sesuai dokumentasi | 6 Nov 17:30 |
| Expert Team menyita waktu | Sedang / tinggi | P1; P0 cukup 1 agent dengan role-based workflow nyata | 6 Nov 21:00 |
| UI approval belum aman untuk publik | Sedang / tinggi | Review action lokal/terautentikasi, public demo read-only | 7 Nov 09:00 |
| Agent menghasilkan angka berbeda | Sedang / tinggi | Backend deterministik, prompt melarang hitung/tebak sendiri | Setiap UAT |
| Backend call mengulang draft | Sedang / sedang | Idempotency key dan state check | 6 Nov 23:00 |
| Video baru dikerjakan terakhir | Tinggi / tinggi | C siapkan storyboard sekarang, A rekam begitu run valid | 7 Nov 11:00 |
| URL demo down / repo private | Sedang / tinggi | Incognito check dari perangkat kedua | 7 Nov 16:30 |
| Data pribadi/secrets bocor | Rendah / kritis | Demo dataset sintetis; review sebelum upload repo/screenshots | Sebelum upload |
| Submission form lambat | Sedang / tinggi | Submit 18:00; 5 jam 59 menit buffer | 7 Nov 18:00 |

> **Minimum viable fallback jika integrasi penuh gagal:** WorkBuddy harus tetap memiliki setidaknya satu MCP tool call asli dan membuktikan retrieval/kalkulasi nyata. Draft PR dan approval boleh dijalankan pada UI/backend terpisah bila dijelaskan dengan jujur sebagai keterbatasan. Jangan menggunakan screenshot palsu, tool-call simulasi, atau mengklaim agent terintegrasi penuh jika belum terjadi.

---

## 11. Definition of Done — Release / Submission

- [ ] Kode backend dan MCP berada di GitHub dengan instruksi menjalankan.
- [ ] WorkBuddy memanggil tool riil dan menampilkan analisis MO-001.
- [ ] Output shortage untuk MAT-A / MAT-B / MAT-C = 300 / 0 / 300.
- [ ] Draft PR berisi MAT-A 300 kg dan MAT-C 300 pcs, status pending.
- [ ] User approval eksplisit tercatat; tidak ada action approval oleh AI secara mandiri.
- [ ] 3 screenshot WorkBuddy asli, terbaca, bebas data rahasia.
- [ ] Architecture Diagram PPT sesuai implementasi sebenarnya.
- [ ] Cover image, title, deskripsi 10 kata, dan project description siap.
- [ ] Link project demo, YouTube video, GitHub, dan social post lolos tes incognito.
- [ ] C telah memeriksa semua 10 item dan mendapatkan konfirmasi submit sebelum 18:00 WIB.

---

## 12. Referensi Resmi & Catatan Kejujuran

- Deadline dan challenge: <https://aiclub.id/event/tencent-cloud-hackathon-2026>
- Tencent Cloud Hackathon: <https://tch.tencentcloud.com/contest/47>
- WorkBuddy product: <https://indonesia.tencentcloud.com/products/workbuddy>
- WorkBuddy Connector / MCP + Skill: <https://open.workbuddy.cn/en/docs/connector>
- WorkBuddy Expert Team (optional P1): <https://open.workbuddy.cn/en/docs/expert-team>
- WorkBuddy MCP guide: <https://www.codebuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide>

> **Catatan:** Ini adalah PRD rencana kerja, bukan bukti bahwa solusi sudah dibangun. Item yang belum terverifikasi harus tetap disebut sebagai target, bukan hasil selesai. Deadline internal 18:00 adalah keputusan manajemen risiko tim, bukan ketentuan penyelenggara.

---

_FINAL SPRINT PRD • 06 NOV 2026_
