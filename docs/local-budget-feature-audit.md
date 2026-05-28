# Local Budget Feature Audit

Tanggal audit: 2026-05-28 10:54-10:56 WIB

Lingkungan:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api`
- Akun: `admin@mbg.go.id` / `password`
- Metode: MCP Playwright untuk login dan membuka halaman target, ditambah inspeksi source lokal dan direct API smoke check.

## Ringkasan Eksekutif

Halaman `/anggaran` sudah memakai API, bukan angka dummy statis. Namun data yang tampil belum sepenuhnya merepresentasikan realisasi anggaran karena KPI utama diambil dari `production_batches`, sementara database lokal saat audit tidak memiliki batch produksi untuk ringkasan costing. Akibatnya KPI Anggaran menampilkan `Rp 0`, padahal endpoint legacy `/analytics/budget` mengembalikan realisasi distribusi `Rp 62.800.000`, `4.700` porsi, dan rata-rata `Rp 13.500` per porsi.

Integrasi dengan `PriceThreshold` dan `FoodPrice` sudah ada melalui endpoint `/analytics/price-per-province`, yang menampilkan threshold dari SP2KP Kemendag. Integrasi dengan `ProductionBatch` juga ada di backend dan halaman `/production-batches`, tetapi data batch lokal kosong untuk tanggal audit. Integrasi dengan `AnomalyLog` ada, tetapi halaman Anggaran hanya mengambil `PRICE_ANOMALY` distribusi dan belum menampilkan `RAW_MATERIAL_PRICE_ANOMALY` detail dari production batch. Integrasi Export ada, tetapi tombol export di halaman Anggaran mengirim payload minimal sehingga default backend berpotensi hanya mengekspor dataset `distributions`, bukan paket anggaran/costing/SP2KP yang lengkap.

## Fixed Issues

### PR 1 - Unified Budget Summary `/anggaran` - 2026-05-28

- Halaman `/anggaran` sekarang menggabungkan summary costing dari `/analytics/budget-summary`, realisasi distribusi legacy dari `/analytics/budget`, dan threshold/provinsi dari `/analytics/price-per-province`.
- Jika `ProductionBatch` kosong tetapi `/analytics/budget` memiliki data, KPI `Total Anggaran Digunakan`, `Total Porsi`, dan `Avg Cost Per Portion` memakai fallback realisasi distribusi legacy. Tidak ada data dummy yang ditambahkan.
- UI menampilkan `Sumber Data` dengan nilai `Production Batch`, `Distribusi Legacy`, `Mixed`, atau `Belum ada data`.
- Saat costing batch belum tersedia dan fallback legacy dipakai, UI menampilkan catatan: `Costing production batch belum tersedia, total realisasi menggunakan data distribusi.`
- Data realisasi legacy per provinsi ikut digabung ke chart pengeluaran, sehingga `JAWA BARAT` tidak lagi terbaca sebagai pengeluaran `0` ketika `/analytics/price-per-province` hanya berisi threshold.
- Re-audit Playwright setelah PR 1:
  - `GET /api/analytics/budget-summary` -> 200
  - `GET /api/analytics/price-per-province` -> 200
  - `GET /api/analytics/price-anomalies?limit=50` -> 200
  - `GET /api/analytics/budget` -> 200
  - `/anggaran` menampilkan `Total Anggaran Digunakan: Rp 62,8 Juta`, `Total Porsi: 4.700`, `Avg Cost Per Portion: Rp 13.500`, dan `Sumber Data: Distribusi Legacy`.

### PR 2 - Konfigurasi Indikator Anggaran BGN `/anggaran` - 2026-05-28

- Indikator BGN disimpan di `system_configs`, bukan di-hardcode langsung di komponen UI.
- Seed default menambahkan config:
  - `banper_regular_amount = 13000`
  - `banper_special_amount = 15000`
  - `raw_material_min_per_portion = 8000`
  - `raw_material_max_per_portion = 10000`
  - `operational_max_per_portion = 3000`
  - `rent_max_per_portion = 2000`
- Read-only compat endpoint `/api/system-configs/:key` sekarang mengizinkan role `pemerintah` dan `admin` membaca key config BGN yang di-whitelist. Endpoint lama `/api/system-configs/export_max_rows` tetap ada.
- Halaman `/anggaran` menampilkan section `Referensi Indikator BGN` berisi:
  - Tarif Banper `Rp 13.000 / Rp 15.000`
  - Biaya Bahan Pangan `Rp 8.000 - Rp 10.000`
  - Biaya Operasional `Maks. Rp 3.000`
  - Biaya Sewa `Maks. Rp 2.000`
- Config ini sudah berbentuk state frontend yang bisa dipakai untuk logic status pada PR berikutnya.
- Re-audit Playwright setelah PR 2:
  - `GET /api/system-configs/banper_regular_amount` -> 200
  - `GET /api/system-configs/banper_special_amount` -> 200
  - `GET /api/system-configs/raw_material_min_per_portion` -> 200
  - `GET /api/system-configs/raw_material_max_per_portion` -> 200
  - `GET /api/system-configs/operational_max_per_portion` -> 200
  - `GET /api/system-configs/rent_max_per_portion` -> 200
  - UI `/anggaran` menampilkan semua indikator BGN sesuai nilai config.

### PR 3 - Status Komponen Anggaran BGN `/anggaran` - 2026-05-28

- Halaman `/anggaran` sekarang mengambil costing langsung dari `GET /api/production-batches?limit=100` untuk status komponen BGN.
- Jika batch produksi tersedia, UI menghitung:
  - `rawMaterialCostPerPortion = total rawMaterialCost / totalPortions`
  - `operationalCostPerPortion = total operationalCost / totalPortions`
  - `totalCostPerPortion = total totalCost / totalPortions`
- Status BGN yang disiapkan di frontend:
  - `rawMaterialStatus`: `below_min`, `normal`, atau `above_max` berdasarkan config Rp8.000-Rp10.000 per porsi.
  - `operationalStatus`: `normal` atau `over_limit` berdasarkan config maksimal Rp3.000 per porsi.
  - `banperStatus`: `within_13000`, `within_15000`, atau `over_banper` berdasarkan config Banper Rp13.000/Rp15.000 per porsi.
  - `rentStatus`: `unavailable` karena field biaya sewa belum tersedia di `ProductionBatch`.
- UI menampilkan section `Status Komponen Anggaran BGN` dengan ringkasan `Batch Costing`, `Porsi Costing`, `Total Costing`, serta card status untuk bahan pangan, operasional, Banper, dan sewa.
- Saat database lokal masih belum memiliki `ProductionBatch`, status costing tampil `Belum tersedia` dan tidak memakai fallback distribusi sebagai angka costing. Total realisasi tetap memakai fallback distribusi dari PR 1.
- Re-audit Playwright setelah PR 3:
  - `GET /api/production-batches?limit=100` -> 200
  - `/anggaran` tetap menampilkan `Total Anggaran Digunakan: Rp 62,8 Juta` dari distribusi legacy.
  - Section `Status Komponen Anggaran BGN` tampil dan seluruh costing status menunjukkan `Belum tersedia`.
  - `Status Biaya Sewa` menampilkan `Belum tersedia` dengan catatan field biaya sewa belum tersedia di `ProductionBatch`.

### PR 4 - Biaya Sewa ProductionBatch - 2026-05-28

- Schema `ProductionBatch` sekarang memiliki field `rentCost` yang tersimpan sebagai kolom `rent_cost NUMERIC(14,2) NOT NULL DEFAULT 0`, sehingga data lama aman memakai default `0`.
- Migration `20260528153000_production_batch_rent_cost` sudah diterapkan ke database lokal dan Prisma Client sudah di-generate ulang.
- Endpoint ProductionBatch menerima dan mengembalikan `rentCost`:
  - `GET /api/production-batches`
  - `POST /api/production-batches`
  - `GET /api/production-batches/:id`
  - `GET /api/production-batches/:id/cost-summary`
- Cost summary DTO sekarang menyertakan `rentCost` dan `rentCostPerPortion`.
- Kalkulasi total costing berubah menjadi:
  - `totalCost = rawMaterialCost + operationalCost + packagingCost + distributionCost + rentCost`
  - `costPerPortion = totalCost / totalPortions`
- Endpoint analytics `/api/analytics/budget-summary` sudah menyertakan agregasi `total_rent_cost` dan `avg_rent_cost`; `total_budget_used` tetap berasal dari `totalCost` yang sudah memasukkan `rentCost`.
- Form `/production-batches` sekarang punya input `Biaya Sewa`, dan ringkasan costing menampilkan item `Sewa`.
- Halaman `/anggaran` sekarang membaca `rentCost` dari ProductionBatch untuk `Status Biaya Sewa`; jika batch kosong, status tetap `Belum tersedia` tanpa angka palsu.
- Audit log create/update ProductionBatch tetap mengikuti pattern yang sudah ada karena `rentCost` masuk ke payload batch dan `newData`/`oldData` audit log.
- Re-audit Playwright setelah PR 4:
  - `GET /api/production-batches?date=2026-05-28&limit=25` -> 200
  - `/production-batches` menampilkan input `Biaya Sewa`.
  - `GET /api/analytics/budget-summary` -> 200
  - `GET /api/production-batches?limit=100` -> 200
  - `/anggaran` menampilkan `Status Biaya Sewa`; karena batch lokal masih kosong, nilai tampil `Belum tersedia`.

## Bukti Playwright

### Login Admin

Playwright membuka `/anggaran`, diarahkan ke `/login`, klik `Demo Admin`, lalu klik `Masuk`. Login berhasil dan URL akhir `http://localhost:5173/anggaran`.

Request login yang terlihat:
- `POST /api/auth/session` -> 200
- `POST /api/auth/login` -> 200
- `GET /api/me/permissions` -> 200

### Halaman `/anggaran`

Data yang tampil:
- Total Anggaran Digunakan: `Rp 0`
- Avg Cost Per Portion: `Rp 0`
- Avg Raw Material Cost: `Rp 0`
- Price Anomaly: `0`
- Raw Material Anomaly: `0`
- Tabel Harga Per Porsi per Provinsi:
  - `JAWA BARAT`: avg `Rp 11.489,35`, threshold `Rp 9.765,95 - Rp 14.361,69`, source `SP2KP Kemendag - 26 Mei 2026`, status `Normal`
  - 3 provinsi test `REAL_PERMISSION_GUARD_* PROVINCE`: avg `Rp 11.818,49`, threshold `Rp 10.045,72 - Rp 14.773,11`, source `SP2KP Kemendag - 28 Mei 2026`, status `Normal`
- Chart Distribusi Total Pengeluaran per Provinsi ada, tetapi nilai efektif `0` karena sumber `totalBudget` dari endpoint price-per-province bernilai 0.
- Tabel anomali: `0 Distribusi Terdeteksi Harga Anomali`.
- Tombol: `Export PDF`, `Export Excel`.

Endpoint yang dipakai halaman Anggaran:
- `GET /api/analytics/budget-summary` -> 200
- `GET /api/analytics/price-per-province` -> 200
- `GET /api/analytics/price-anomalies?limit=50` -> 200
- `GET /api/analytics/budget` -> 200
- `POST /api/exports` dipakai saat tombol export diklik, tidak diklik pada audit ini agar tidak membuat artefak.
- `PUT /api/anomaly-logs/:id/resolve` dipakai oleh tombol resolve di `Anggaran.jsx`, tetapi endpoint kompatibilitas utama untuk `/api/anomaly-logs/:id/resolve` adalah `PATCH`. Endpoint admin lama menyediakan `PUT /api/admin/anomaly-logs/:id/resolve`, bukan `/api/anomaly-logs`. Ini berpotensi error saat ada row anomali dan admin menekan Resolve dari halaman Anggaran.

Response penting:
- `/analytics/budget-summary`: `total_batches=0`, `total_portions=0`, `total_budget_used=0`, `avg_cost_per_portion=0`, `price_anomaly_count=0`, `raw_material_anomaly_count=0`.
- `/analytics/price-per-province`: 4 row threshold SP2KP, semua `totalBudget=0`, `totalDistributions=0`.
- `/analytics/price-anomalies?limit=50`: empty, `total=0`.
- `/analytics/budget`: summary distribusi legacy berisi `total_budget=62800000`, `total_portions=4700`, `avg_price_per_portion=13500`, byProvince `JAWA BARAT`.

## Halaman Pendukung

### `/analytics`

Endpoint:
- `GET /api/analytics/summary` -> 200
- `GET /api/production-batches?limit=30` -> 200
- `GET /api/analytics/by-province?limit=10` -> 200
- `GET /api/anomaly-logs?status=unresolved&limit=100` -> 200
- `GET /api/analytics/public-reports-summary` -> 200
- `GET /api/analytics/public-reports-trend` -> 200
- `GET /api/analytics/public-reports-top-regions?limit=10` -> 200

Data tampil:
- Distribusi Hari Ini `0`
- Success Rate `100%`
- Avg Cost/Porsi `Rp 0`
- Anomali Aktif `0`
- Costing kosong karena production batch kosong.
- Distribusi per Provinsi menampilkan `JAWA BARAT`.

Sinkronisasi dengan Anggaran: parsial. Analytics memakai `production-batches` untuk tren costing dan `anomaly-logs` untuk anomali aktif, tetapi tidak menampilkan indikator BGN seperti Banper, sisa anggaran, over budget, atau breakdown biaya per porsi.

### `/production-batches`

Endpoint:
- `GET /api/production-batches?date=2026-05-28&limit=25` -> 200

Data tampil:
- Empty state: `Belum ada batch untuk tanggal ini`.
- Form tersedia untuk `SPPG ID`, `Tanggal Produksi`, `Total Porsi`, `Biaya Operasional`, `Biaya Packaging`, `Biaya Distribusi`, dan item bahan baku.
- UI menyatakan backend menjadi sumber utama costing dan tidak menampilkan angka palsu.

Sinkronisasi dengan Anggaran: backend Anggaran sudah membaca agregasi `ProductionBatch`, tetapi karena data batch kosong maka KPI Anggaran kosong. Production batch punya field `rawMaterialCost`, `operationalCost`, `packagingCost`, `distributionCost`, `totalCost`, `costPerPortion`; belum ada field khusus sewa atau pagu/Banper.

### `/anomaly`

Endpoint:
- `GET /api/anomaly-logs?status=unresolved&limit=50` -> 200
- Request sempat duplikat 200 karena render/mount ulang, bukan failure fungsional.

Data tampil:
- Belum Resolved `0`
- Resolved `0`
- Harga Porsi `0`
- Bahan Baku `0`
- Tabel empty.

Sinkronisasi dengan Anggaran: Anomaly page mendukung `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY`. Halaman Anggaran hanya mengambil `/analytics/price-anomalies`, yang di backend dibatasi ke `PRICE_ANOMALY` berbasis distribusi, sehingga anomali bahan pangan dari `ProductionBatchItem` belum muncul di tabel Anggaran.

### `/audit-log`

Endpoint:
- `GET /api/audit-logs?page=1&limit=10` -> 200
- `GET /api/audit-logs/summary` -> 200

Data tampil:
- Total Aksi Hari Ini `29`
- High Severity `28`
- Active Users `9`
- Severity Count `H 28 / M 326`
- Category Count `D 26.592 / S 297`
- Tabel audit log memuat login/logout/update permission terbaru.

Sinkronisasi dengan Anggaran: audit log sudah mencatat login dan perubahan sistem. Aksi production batch dan item bahan baku di backend juga membuat audit log. Namun halaman Anggaran sendiri tidak menampilkan trace audit untuk perubahan costing, threshold, atau resolve anomali.

### `/export`

Endpoint:
- `GET /api/system-configs/export_max_rows` -> 200
- `GET /api/exports?page=1&limit=10` -> 200
- Ada request aborted saat route berubah: `/system-configs/export_max_rows` dan `/exports?page=1&limit=10` -> `net::ERR_ABORTED`; tidak muncul sebagai error UI akhir.

Data tampil:
- Form PDF/XLSX.
- Dataset tersedia di UI Export: `distributions`, `validations`, `public_reports`, `budget_by_region`, `audit_logs`, `anomalies`, `production_batches`, `food_prices`.
- Limit export `50.000` baris.
- Riwayat export memuat file sukses dan beberapa record gagal dengan pesan `Invalid export date filter` / invalid Date dari processor lama.

Sinkronisasi dengan Anggaran: backend Export sudah mendukung `budget_by_region`, `production_batches`, `food_prices`, dan `anomalies`. Halaman Anggaran belum mengirim `filterParams.datasets`, sehingga export dari halaman Anggaran kemungkinan jatuh ke default `distributions`, bukan laporan anggaran lengkap.

## Status Hardcode vs API

Temuan:
- Halaman Anggaran tidak memakai array dummy/fallback hardcode untuk data utama.
- Empty state berasal dari response API kosong, bukan data palsu.
- Label KPI, label tabel, dan status UI statis wajar sebagai teks interface.
- Nilai tanggal `Data diperbarui` memakai tanggal browser, bukan timestamp API. Ini bisa menyesatkan karena threshold memiliki `generatedAt` berbeda.

Catatan data:
- KPI Anggaran berbasis `ProductionBatch` membuat total realisasi `Rp 0`.
- `/analytics/budget` masih punya realisasi distribusi `Rp 62.800.000`, tetapi hanya dipakai fallback jika endpoint price-per-province kosong. Karena price-per-province tidak kosong, data legacy byProvince tidak tampil.

## Cek Indikator Dokumen BGN

| Indikator | Status | Catatan |
| --- | --- | --- |
| Tarif Banper Rp13.000/Rp15.000 | Belum ada eksplisit | Data distribusi memiliki avg `Rp 13.500` dan min/max `Rp 13.000/Rp 14.000`, tetapi tidak ada field/label Banper 13k/15k atau klasifikasi wilayah. |
| Biaya bahan pangan Rp8.000-Rp10.000 per porsi | Parsial | Ada `rawMaterialCost` dan avg raw material cost, tetapi belum divalidasi terhadap rentang Rp8k-Rp10k per porsi. |
| Biaya operasional max Rp3.000 per porsi | Parsial | `operationalCost` ada pada batch, tetapi UI/backend belum menghitung operasional per porsi dan status max Rp3k. |
| Biaya sewa max Rp2.000 per porsi | Belum ada | Tidak terlihat field sewa di schema/UI. |
| Cost per portion | Ada | `costPerPortion` ada di ProductionBatch dan KPI, tetapi kosong karena batch kosong. |
| Total realisasi | Parsial/bermasalah | Ada `total_budget_used` dari ProductionBatch, tetapi 0. Ada realisasi distribusi di `/analytics/budget` yang tidak menjadi angka utama. |
| Sisa anggaran | Belum ada | Tidak ada pagu/Banper budget allocation dan remaining budget. |
| Status over budget | Parsial | Ada status over/under threshold harga per porsi, belum over budget terhadap pagu/Banper/komponen BGN. |
| Anomaly harga bahan pangan | Parsial | Backend membuat `RAW_MATERIAL_PRICE_ANOMALY`; Anomaly page menampilkan tipe itu. Halaman Anggaran hanya menampilkan price anomaly distribusi. |

## Sinkronisasi Domain Data

### ProductionBatch

Ada dan menjadi sumber utama costing Anggaran:
- `/analytics/budget-summary` agregasi `productionBatch`.
- `/analytics/price-per-province` membaca `productionBatch.costPerPortion` per provinsi.
- `/production-batches/:id/cost-summary` menghitung raw material, operasional, packaging, distribusi, total, dan cost per portion.

Gap:
- Data lokal kosong untuk tanggal audit.
- Tidak ada fallback visual yang menggabungkan realisasi distribusi jika batch belum tersedia.
- Belum ada validasi komponen BGN per porsi.

### FoodPrice

Ada:
- `/food-prices/latest` smoke check 200.
- Backend menghitung estimasi porsi dari SP2KP dan komponen pangan.
- `PriceThreshold` dapat dibuat dari food prices.

Gap:
- Halaman Anggaran tidak memanggil `/food-prices/latest` atau `/food-prices/estimate` langsung.
- Detail komponen harga pangan dan rentang Rp8k-Rp10k belum tampil di Anggaran.

### PriceThreshold

Ada:
- `/price-thresholds` smoke check 200.
- `/analytics/price-per-province` menggabungkan threshold ke tabel Anggaran.
- Source `SP2KP Kemendag` dan `generatedAt` tampil.

Gap:
- Threshold saat ini berbasis multiplier estimasi, bukan indikator BGN Banper 13k/15k atau batas komponen biaya.

### AnomalyLog

Ada:
- `/anomaly-logs` smoke check 200.
- Backend mendukung `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY`.

Gap:
- `/analytics/price-anomalies` hanya `PRICE_ANOMALY` distribusi.
- Resolve di Anggaran memakai `PUT /api/anomaly-logs/:id/resolve`, sedangkan compat route yang tersedia adalah `PATCH /api/anomaly-logs/:id/resolve`.

### Export

Ada:
- `/exports` smoke check 200.
- Backend export mendukung dataset `budget_by_region`, `production_batches`, `food_prices`, dan `anomalies`.
- Halaman Export lengkap.

Gap:
- Tombol export di halaman Anggaran tidak mengirim dataset anggaran/costing eksplisit.
- Riwayat export punya record gagal lama akibat invalid date filter.

## Endpoint Error / Warning

Tidak ada endpoint target yang berakhir error pada state akhir halaman. Semua endpoint utama smoke check 200:
- `/analytics/budget-summary`
- `/analytics/price-per-province`
- `/analytics/price-anomalies?limit=50`
- `/analytics/budget`
- `/production-batches?limit=5`
- `/food-prices/latest`
- `/price-thresholds`
- `/anomaly-logs?status=unresolved&limit=5`
- `/exports?page=1&limit=5`

Warning:
- Beberapa request di Playwright tercatat `net::ERR_ABORTED` saat navigasi cepat, terutama `/dashboard/admin-summary`, `/system-configs/export_max_rows`, dan `/exports`. Ini route-change abort, bukan response backend 4xx/5xx.
- Potensi endpoint mismatch: resolve anomali dari Anggaran memakai `PUT /api/anomaly-logs/:id/resolve`; route kompatibilitas yang tersedia adalah `PATCH /api/anomaly-logs/:id/resolve`.
- Riwayat export menampilkan record gagal dengan error invalid date filter.

## Fitur Sudah Ada

- Login admin dan RBAC halaman Anggaran berjalan.
- Halaman Anggaran memakai API untuk KPI, tabel provinsi, anomali, dan export.
- Threshold harga per provinsi dari SP2KP Kemendag tampil.
- Cost per portion tersedia di model dan ProductionBatch UI.
- Production batch costing menghitung bahan baku, operasional, packaging, distribusi, total, dan cost per portion.
- Backend membandingkan bahan baku dengan FoodPrice/SP2KP dan bisa membuat `RAW_MATERIAL_PRICE_ANOMALY`.
- Anomaly page dapat melihat dan resolve anomaly log.
- Export page mendukung dataset budget, production batches, food prices, anomalies, dan audit logs.
- Audit log berjalan untuk login dan perubahan data.

## Fitur Belum Ada / Belum Lengkap

- Indikator Banper Rp13.000/Rp15.000 belum dimodelkan eksplisit.
- Batas bahan pangan Rp8.000-Rp10.000 per porsi belum divalidasi dan belum tampil sebagai status.
- Batas operasional max Rp3.000 per porsi belum dihitung sebagai status.
- Biaya sewa max Rp2.000 per porsi belum ada field/model/UI.
- Sisa anggaran belum ada karena belum ada pagu alokasi/Banper.
- Over budget belum berbasis pagu dan komponen BGN; saat ini hanya status over/under threshold harga.
- Total realisasi Anggaran tidak sinkron dengan realisasi distribusi saat production batch kosong.
- Halaman Anggaran belum menampilkan anomali harga bahan pangan detail dari `RAW_MATERIAL_PRICE_ANOMALY`.
- Export dari halaman Anggaran belum memilih dataset anggaran lengkap.
- Timestamp `Data diperbarui` memakai tanggal lokal, bukan timestamp data API.

## Rekomendasi Perubahan

1. Jadikan Anggaran punya model summary tunggal yang menggabungkan:
   - realisasi distribusi (`/analytics/budget`) untuk total realisasi aktual,
   - costing batch (`/analytics/budget-summary`) untuk breakdown biaya,
   - threshold SP2KP/BGN untuk status.

2. Tambahkan konfigurasi indikator BGN:
   - `banper_regular_amount = 13000`
   - `banper_special_amount = 15000`
   - `raw_material_min_per_portion = 8000`
   - `raw_material_max_per_portion = 10000`
   - `operational_max_per_portion = 3000`
   - `rent_max_per_portion = 2000`

3. Tambahkan field/komponen biaya sewa pada `ProductionBatch` atau tabel biaya batch terpisah, lalu hitung `rentCostPerPortion`.

4. Tambahkan status BGN per batch/provinsi:
   - `rawMaterialStatus`
   - `operationalStatus`
   - `rentStatus`
   - `banperStatus`
   - `overBudget`
   - `remainingBudget`

5. Perbaiki halaman Anggaran agar:
   - menampilkan total realisasi dari distribusi jika batch belum ada,
   - tetap menampilkan cost per portion dari batch bila tersedia,
   - menampilkan raw material anomaly dari `AnomalyLog`,
   - menampilkan timestamp API/generator, bukan hanya tanggal browser.

6. Perbaiki export Anggaran:
   - kirim `filterParams.datasets = ["budget_by_region", "production_batches", "food_prices", "anomalies"]`,
   - sertakan filter tanggal/provinsi/status dari UI,
   - tampilkan link ke halaman `/export` untuk riwayat.

7. Samakan method resolve anomaly:
   - gunakan helper `resolveAnomaly()` yang sudah memakai `PATCH /api/anomaly-logs/:id/resolve`, atau tambahkan compat `PUT /api/anomaly-logs/:id/resolve`.

8. Bersihkan/validasi export lama:
   - cegah invalid date filter sebelum membuat job,
   - tampilkan error ringkas di UI, bukan stack Prisma penuh.
