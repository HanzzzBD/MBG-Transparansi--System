# Local Budget Feature Audit

Tanggal audit: 2026-05-28 10:54-10:56 WIB

Lingkungan:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api`
- Akun: `admin@mbg.go.id` / `password`
- Metode: MCP Playwright untuk login dan membuka halaman target, ditambah inspeksi source lokal dan direct API smoke check.

## Ringkasan Eksekutif

Halaman `/anggaran` sudah memakai API, bukan angka dummy statis. Pada audit awal, data yang tampil belum sepenuhnya merepresentasikan realisasi anggaran karena KPI utama diambil dari `production_batches`, sementara database lokal tidak memiliki batch produksi untuk ringkasan costing. PR 1 sudah memperbaiki fallback agar realisasi legacy dari `/analytics/budget` tampil sebagai `Rp 62.800.000`, `4.700` porsi, dan rata-rata `Rp 13.500` per porsi saat costing batch kosong.

Integrasi dengan `PriceThreshold` dan `FoodPrice` sudah ada melalui endpoint `/analytics/price-per-province`, yang menampilkan threshold dari SP2KP Kemendag. Integrasi dengan `ProductionBatch` juga ada di backend dan halaman `/production-batches`, tetapi data batch lokal kosong untuk tanggal audit. PR 5 sudah mengubah halaman Anggaran agar membaca `AnomalyLog` dari `/anomaly-logs`, sehingga `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY` bisa tampil dari sumber yang sama dengan halaman `/anomaly`. PR 7 sudah memperbaiki tombol export di halaman Anggaran agar membuat job export paket anggaran lengkap, bukan default dataset `distributions`.

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

### PR 5 - Sinkronisasi Anomali Bahan Pangan ke `/anggaran` - 2026-05-28

- Halaman `/anggaran` sekarang mengambil data anomali utama dari `GET /api/anomaly-logs?limit=100`, sehingga tipe `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY` berada di sumber data yang sama dengan halaman `/anomaly`.
- Endpoint lama `GET /api/analytics/price-anomalies?limit=50` tetap dipanggil sebagai fallback jika anomaly log gagal dimuat, sehingga tabel price anomaly lama tidak dihapus.
- Tabel anomali Anggaran sekarang menampilkan kolom:
  - tipe anomali,
  - SPPG,
  - region/provinsi,
  - item bahan pangan atau sekolah,
  - harga aktual,
  - harga referensi atau threshold,
  - selisih,
  - deskripsi,
  - tanggal,
  - status resolved/unresolved,
  - aksi resolve/detail.
- Normalisasi data sudah mendukung metadata `RAW_MATERIAL_PRICE_ANOMALY`, termasuk `commodity_name`, `input_price`, `market_price`, `selisih_percent`, `province`, serta relasi `productionBatch`, `productionBatchItem`, dan `sppg` jika tersedia.
- KPI `Raw Material Anomaly` di `/anggaran` sekarang dihitung dari jumlah `RAW_MATERIAL_PRICE_ANOMALY` unresolved pada anomaly log, bukan dari endpoint price anomaly distribusi.
- Tombol resolve dari `/anggaran` sekarang memakai `PATCH /api/anomaly-logs/:id/resolve`, sesuai route kompatibilitas yang tersedia.
- Empty state tabel diperjelas menjadi `Belum ada anomali harga porsi atau bahan pangan untuk filter ini.` jika anomaly log benar-benar kosong.
- Re-audit Playwright setelah PR 5:
  - `GET /api/analytics/budget-summary` -> 200
  - `GET /api/analytics/price-per-province` -> 200
  - `GET /api/analytics/price-anomalies?limit=50` -> 200
  - `GET /api/anomaly-logs?limit=100` -> 200
  - `GET /api/analytics/budget` -> 200
  - `/anggaran` menampilkan KPI `Raw Material Anomaly: 0` dan tabel empty state karena response lokal `/api/anomaly-logs?limit=100` berisi `data: []`.
  - `/anomaly` memanggil `GET /api/anomaly-logs?status=unresolved&limit=50` -> 200 dan menampilkan `Bahan Baku: 0`, sinkron dengan `/anggaran`.

### PR 6 - Method Resolve Anomaly `/anggaran` - 2026-05-28

- Semua penggunaan resolve anomaly di frontend sudah dicek:
  - `/anomaly` memakai helper `resolveAnomaly()` dari `Frontend/src/services/api.js`.
  - `/anggaran` sebelumnya sudah memakai method `PATCH`, tetapi masih memanggil `apiRequest` langsung.
- Halaman `/anggaran` sekarang memakai helper `resolveAnomaly()` yang sama dengan halaman `/anomaly`, sehingga endpoint resolve konsisten ke `PATCH /api/anomaly-logs/:id/resolve`.
- Setelah resolve berhasil, `/anggaran` sekarang:
  - menandai row lokal sebagai resolved,
  - mengurangi KPI `Price Anomaly` atau `Raw Material Anomaly` sesuai tipe anomali,
  - memperbarui jumlah unresolved yang terlihat di tabel/filter,
  - menampilkan toast sukses.
- Saat request resolve berjalan, tombol row terkait disabled dan menampilkan state `Memproses`.
- Jika resolve gagal, halaman tetap menampilkan toast error dari API atau fallback `Resolve anomali gagal.`, sehingga tidak silent fail.
- Backend tidak ditambah alias `PUT` karena route kompatibilitas `PATCH /api/anomaly-logs/:id/resolve` sudah tersedia dan frontend sudah disamakan ke helper tersebut.
- Data audit lokal dibuat untuk uji tombol:
  - anomaly log id `31`
  - tipe `RAW_MATERIAL_PRICE_ANOMALY`
  - item `Beras PR6 Audit`
  - status awal unresolved, lalu di-resolve lewat tombol `/anggaran`.
- Re-audit Playwright setelah PR 6:
  - `/anggaran` menampilkan `Raw Material Anomaly: 1` sebelum klik resolve.
  - Klik tombol `Resolve` pada row `Beras PR6 Audit`.
  - Network request: `PATCH /api/anomaly-logs/31/resolve` -> 200.
  - Setelah sukses, `/anggaran` menampilkan `Raw Material Anomaly: 0` dan tabel unresolved kembali ke empty state.
  - Verifikasi database lokal: anomaly id `31` memiliki `isResolved: true` dan `resolvedAt` terisi.
  - `/anomaly` tetap memanggil `GET /api/anomaly-logs?status=unresolved&limit=50` -> 200 dan tidak rusak.

### PR 7 - Export Paket Anggaran dari `/anggaran` - 2026-05-28

- Tombol `Export PDF` dan `Export Excel` di halaman `/anggaran` sekarang membuat job lewat helper `createExport()` dan tetap mengirim `type` sesuai pilihan tombol:
  - `pdf` untuk Export PDF.
  - `excel` untuk Export Excel/XLSX.
- Payload `POST /api/exports` sekarang menyertakan paket dataset anggaran lengkap:
  - `budget_by_region`
  - `production_batches`
  - `food_prices`
  - `anomalies`
- `filterParams` dari halaman Anggaran sekarang berisi:
  - `page: "anggaran"`
  - `exportScope: "budget_feature"`
  - `datasets`
  - `datasetModes`
  - `status` dan `anomalyStatus` dari filter anomali UI.
  - `anomalyType` / `anomalyTypes` untuk `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY`.
  - `sortKey` dan `sortDirection`.
  - `dateFrom`, `dateTo`, `start_date`, `end_date`, `province`, dan `provinces` hanya dikirim jika tersedia dan valid dari query halaman.
- Validasi tanggal ditambahkan sebelum membuat export:
  - format harus `YYYY-MM-DD`,
  - `dateFrom` tidak boleh lebih besar dari `dateTo`,
  - tanggal invalid menampilkan toast warning dan tidak membuat job.
- Error export diringkas di UI:
  - invalid date menjadi `Filter tanggal export tidak valid.`,
  - error backend/stack Prisma menjadi `Export gagal diproses backend.`,
  - tidak lagi menampilkan stack panjang ke user.
- Halaman `/anggaran` sekarang punya tombol `Riwayat Export` yang mengarahkan user ke `/export` untuk melihat status dan mengunduh file.
- Halaman `/export` tidak diubah pada PR ini.
- Re-audit Playwright setelah PR 7:
  - Klik `Export PDF` di `/anggaran`: `POST /api/exports` -> 201.
  - Request body PDF:
    - `type: "pdf"`
    - `filterParams.datasets: ["budget_by_region", "production_batches", "food_prices", "anomalies"]`
    - `filterParams.anomalyType: ["PRICE_ANOMALY", "RAW_MATERIAL_PRICE_ANOMALY"]`
  - Klik `Export Excel` di `/anggaran`: `POST /api/exports` -> 201.
  - Request body Excel:
    - `type: "excel"`
    - `filterParams.datasets: ["budget_by_region", "production_batches", "food_prices", "anomalies"]`
    - `filterParams.anomalyType: ["PRICE_ANOMALY", "RAW_MATERIAL_PRICE_ANOMALY"]`
  - Klik `Riwayat Export` mengarah ke `http://localhost:5173/export`.
  - Membuka `/anggaran?dateFrom=bad-date&dateTo=2026-05-28` lalu klik `Export PDF` tidak mengirim `POST /api/exports`; UI menahan request karena filter tanggal invalid.

### PR 8 - Timestamp Data `/anggaran` - 2026-05-28

- Label header `Data diperbarui` di halaman `/anggaran` tidak lagi memakai tanggal browser sebagai timestamp data.
- Halaman sekarang menyimpan timestamp per sumber data:
  - `Budget` dari `updatedAt`, `generatedAt`, atau `createdAt` pada `/analytics/budget-summary` dan fallback `/analytics/budget` jika tersedia.
  - `SP2KP` dari `generatedAt`, `updatedAt`, atau `createdAt` pada row `/analytics/price-per-province`.
  - `Anomali` dari `updatedAt` atau `createdAt` anomaly log.
  - `Batch` dari `updatedAt` atau `createdAt` ProductionBatch jika batch tersedia.
- Jika beberapa sumber memiliki timestamp berbeda, header menampilkan ringkas dalam format sumber per sumber, contoh:
  - `Data diperbarui: SP2KP: 28 Mei 2026, 01.10 | Anomali: 28 Mei 2026, 17.54`
- Attribute `title` pada badge timestamp berisi detail yang sama, sehingga user bisa melihat detail saat hover.
- Jika tidak ada timestamp dari API sama sekali, UI menampilkan `Data diperbarui: Timestamp data tidak tersedia`, bukan tanggal palsu dari browser.
- Tidak ada data dummy yang ditambahkan.
- Re-audit Playwright setelah PR 8:
  - `/anggaran` menampilkan `Data diperbarui: SP2KP: 28 Mei 2026, 01.10 | Anomali: 28 Mei 2026, 17.54` pada data lokal saat audit.
  - Label tidak lagi memakai tanggal lokal/browser sebagai fallback.
  - `GET /api/analytics/price-per-province` -> 200 dan timestamp SP2KP diambil dari `generatedAt`.
  - `GET /api/anomaly-logs?limit=100` -> 200 dan timestamp anomali diambil dari anomaly log yang tersedia.

### PR 9 - Validasi Error Export Lama `/export` - 2026-05-28

- Backend export sekarang memvalidasi filter tanggal dari `filterParams` sebelum row export dibuat dan sebelum job masuk queue.
- Validasi mencakup format `YYYY-MM-DD` untuk `date`, `dateFrom`, `dateTo`, `date_from`, `date_to`, `start_date`, dan `end_date`.
- Jika filter tanggal invalid, endpoint `POST /api/exports` mengembalikan 400 ringkas:
  - `Filter tanggal export tidak valid.`
  - `code: EXPORT_FILTER_DATE_INVALID`
- Jika tanggal awal lebih besar dari tanggal akhir, backend mengembalikan 400 ringkas:
  - `Tanggal awal export tidak boleh lebih besar dari tanggal akhir.`
  - `code: EXPORT_FILTER_DATE_RANGE_INVALID`
- Row export baru tidak dibuat saat filter tanggal invalid. Smoke test API lokal menunjukkan total export tetap `13` sebelum dan sesudah request invalid.
- Retry export lama sekarang memvalidasi `filterParams` tersimpan sebelum status diubah ke `pending`.
- Record lama invalid date id `7` diuji dengan `POST /api/exports/7/retry`:
  - response `400`
  - body `Filter tanggal export tidak valid.`
  - status record tetap `failed`
  - job tidak dikirim ulang ke queue.
- Halaman `/export` sekarang memvalidasi tanggal form lebih ketat di frontend sebelum membuat export.
- Pesan error di halaman `/export` disanitasi:
  - `Invalid export date filter` / `invalid Date` tampil sebagai `Filter tanggal export tidak valid.`
  - stack teknis, error Prisma, dan error multiline disembunyikan dari riwayat/toast user.
- Riwayat export lama tidak dihapus otomatis; UI hanya menampilkan pesan yang lebih manusiawi.
- Re-audit Playwright setelah PR 9:
  - `/export` berhasil memuat form dan riwayat export.
  - Input tanggal valid dari UI membuat `POST /api/exports` -> 201.
  - Request body valid berisi `dateFrom`, `dateTo`, `start_date`, dan `end_date`.
  - Browser native date input menolak nilai `bad-date`; backend invalid-date diverifikasi lewat API lokal dengan response `400`.
  - Riwayat export menampilkan record invalid lama sebagai `Filter tanggal export tidak valid.`, bukan stack processor lama.
  - Retry record invalid lama memanggil `POST /api/exports/7/retry` -> 400 dan tidak mengubah record menjadi pending.

## Bukti Playwright

### Login Admin

Playwright membuka `/anggaran`, diarahkan ke `/login`, klik `Demo Admin`, lalu klik `Masuk`. Login berhasil dan URL akhir `http://localhost:5173/anggaran`.

Request login yang terlihat:
- `POST /api/auth/session` -> 200
- `POST /api/auth/login` -> 200
- `GET /api/me/permissions` -> 200

### Halaman `/anggaran`

Data yang tampil:
- Total Anggaran Digunakan: `Rp 62,8 Juta`
- Avg Cost Per Portion: `Rp 13.500`
- Avg Raw Material Cost: `Rp 0`
- Price Anomaly: `0`
- Raw Material Anomaly: `0`
- Sumber Data: `Distribusi Legacy`
- Tabel Harga Per Porsi per Provinsi:
  - `JAWA BARAT`: avg `Rp 11.489,35`, threshold `Rp 9.765,95 - Rp 14.361,69`, source `SP2KP Kemendag - 26 Mei 2026`, status `Normal`
  - 3 provinsi test `REAL_PERMISSION_GUARD_* PROVINCE`: avg `Rp 11.818,49`, threshold `Rp 10.045,72 - Rp 14.773,11`, source `SP2KP Kemendag - 28 Mei 2026`, status `Normal`
- Chart Distribusi Total Pengeluaran per Provinsi memakai realisasi legacy jika data price-per-province belum punya `totalBudget`.
- Tabel anomali: `0 Anomali Anggaran Terdeteksi`, dengan empty state untuk anomali harga porsi atau bahan pangan.
- Tombol: `Export PDF`, `Export Excel`.

Endpoint yang dipakai halaman Anggaran:
- `GET /api/analytics/budget-summary` -> 200
- `GET /api/analytics/price-per-province` -> 200
- `GET /api/analytics/price-anomalies?limit=50` -> 200
- `GET /api/anomaly-logs?limit=100` -> 200
- `GET /api/analytics/budget` -> 200
- `POST /api/exports` dipakai saat tombol export diklik. Pada re-audit PR 7, tombol PDF dan Excel diklik untuk memastikan payload dataset anggaran lengkap.
- `PATCH /api/anomaly-logs/:id/resolve` dipakai oleh tombol resolve di `Anggaran.jsx`.

Response penting:
- `/analytics/budget-summary`: `total_batches=0`, `total_portions=0`, `total_budget_used=0`, `avg_cost_per_portion=0`, `price_anomaly_count=0`, `raw_material_anomaly_count=0`.
- `/analytics/price-per-province`: 4 row threshold SP2KP, semua `totalBudget=0`, `totalDistributions=0`.
- `/analytics/price-anomalies?limit=50`: empty, `total=0`.
- `/anomaly-logs?limit=100`: empty, `total=0`.
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

Sinkronisasi dengan Anggaran: backend Anggaran sudah membaca agregasi `ProductionBatch`. Karena data batch lokal kosong, status costing tampil `Belum tersedia`, sementara total realisasi memakai fallback distribusi legacy. ProductionBatch sekarang punya field `rawMaterialCost`, `operationalCost`, `packagingCost`, `distributionCost`, `rentCost`, `totalCost`, dan `costPerPortion`; pagu/Banper allocation masih belum ada.

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

Sinkronisasi dengan Anggaran: Anomaly page mendukung `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY`. Sejak PR 5, halaman Anggaran juga mengambil `/anomaly-logs`, sehingga anomali bahan pangan dari `ProductionBatchItem` dapat muncul di tabel Anggaran ketika datanya ada.

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
- Sejak PR 9, pesan invalid date lama ditampilkan sebagai `Filter tanggal export tidak valid.` dan retry invalid date ditahan dengan response 400 sebelum queue.

Sinkronisasi dengan Anggaran: backend Export sudah mendukung `budget_by_region`, `production_batches`, `food_prices`, dan `anomalies`. Sejak PR 7, halaman Anggaran mengirim `filterParams.datasets` berisi empat dataset tersebut saat tombol PDF/Excel diklik.

## Status Hardcode vs API

Temuan:
- Halaman Anggaran tidak memakai array dummy/fallback hardcode untuk data utama.
- Empty state berasal dari response API kosong, bukan data palsu.
- Label KPI, label tabel, dan status UI statis wajar sebagai teks interface.
- Label `Data diperbarui` memakai timestamp API per sumber data sejak PR 8, bukan tanggal browser.

Catatan data:
- KPI Anggaran memakai fallback `/analytics/budget` saat `ProductionBatch` kosong, sehingga total realisasi lokal tampil `Rp 62,8 Juta`.
- Data legacy byProvince ikut digabung ke chart/tabel saat price-per-province tidak memiliki total budget.

## Cek Indikator Dokumen BGN

| Indikator | Status | Catatan |
| --- | --- | --- |
| Tarif Banper Rp13.000/Rp15.000 | Ada | Config BGN tampil di `/anggaran`; status Banper dihitung dari costing ProductionBatch jika batch tersedia. |
| Biaya bahan pangan Rp8.000-Rp10.000 per porsi | Ada | Config BGN tampil dan status bahan pangan dihitung dari `rawMaterialCost / totalPortions` jika batch tersedia. |
| Biaya operasional max Rp3.000 per porsi | Ada | Config BGN tampil dan status operasional dihitung dari `operationalCost / totalPortions` jika batch tersedia. |
| Biaya sewa max Rp2.000 per porsi | Ada | `rentCost` sudah ada di ProductionBatch, form, cost summary, dan status sewa `/anggaran`. |
| Cost per portion | Ada | `costPerPortion` ada di ProductionBatch dan KPI, tetapi kosong karena batch kosong. |
| Total realisasi | Ada | Jika ProductionBatch kosong, total realisasi memakai fallback distribusi legacy dari `/analytics/budget`. |
| Sisa anggaran | Belum ada | Tidak ada pagu/Banper budget allocation dan remaining budget. |
| Status over budget | Parsial | Ada status komponen BGN dan threshold harga, belum over budget terhadap pagu/alokasi. |
| Anomaly harga bahan pangan | Ada | `/anggaran` dan `/anomaly` sama-sama membaca `RAW_MATERIAL_PRICE_ANOMALY` dari `/anomaly-logs`. |

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
- `/analytics/price-anomalies` hanya `PRICE_ANOMALY` distribusi. Sejak PR 5, halaman Anggaran memakai `/anomaly-logs` sebagai sumber utama agar `RAW_MATERIAL_PRICE_ANOMALY` ikut tampil.
- Resolve di Anggaran sudah disamakan ke `PATCH /api/anomaly-logs/:id/resolve` pada PR 5.

### Export

Ada:
- `/exports` smoke check 200.
- Backend export mendukung dataset `budget_by_region`, `production_batches`, `food_prices`, dan `anomalies`.
- Halaman Export lengkap.

Gap:
- Tombol export di halaman Anggaran sudah mengirim dataset anggaran/costing eksplisit sejak PR 7.
- Riwayat export punya record gagal lama akibat invalid date filter, tetapi sejak PR 9 error ditampilkan ringkas dan retry invalid ditahan sebelum masuk queue.

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
- Mismatch method resolve anomali Anggaran sudah diperbaiki pada PR 5 menjadi `PATCH /api/anomaly-logs/:id/resolve`.
- Riwayat export masih menyimpan record gagal lama, tetapi error invalid date sudah disanitasi di UI dan retry invalid date sekarang mengembalikan 400 ringkas.

## Fitur Sudah Ada

- Login admin dan RBAC halaman Anggaran berjalan.
- Halaman Anggaran memakai API untuk KPI, tabel provinsi, anomali, dan export.
- Halaman Anggaran memakai fallback realisasi distribusi legacy saat ProductionBatch kosong.
- Halaman Anggaran menampilkan indikator BGN dari `system_configs`.
- Halaman Anggaran menampilkan status komponen BGN dari costing ProductionBatch jika batch tersedia.
- Halaman Anggaran menampilkan `PRICE_ANOMALY` dan `RAW_MATERIAL_PRICE_ANOMALY` dari `/anomaly-logs`.
- Threshold harga per provinsi dari SP2KP Kemendag tampil.
- Cost per portion tersedia di model dan ProductionBatch UI.
- Production batch costing menghitung bahan baku, operasional, packaging, distribusi, sewa, total, dan cost per portion.
- Backend membandingkan bahan baku dengan FoodPrice/SP2KP dan bisa membuat `RAW_MATERIAL_PRICE_ANOMALY`.
- Anomaly page dapat melihat dan resolve anomaly log.
- Export page mendukung dataset budget, production batches, food prices, anomalies, dan audit logs.
- Audit log berjalan untuk login dan perubahan data.

## Fitur Belum Ada / Belum Lengkap

- Sisa anggaran belum ada karena belum ada pagu alokasi/Banper.
- Over budget belum berbasis pagu dan komponen BGN; saat ini hanya status over/under threshold harga.

## Rekomendasi Perubahan

1. Tambahkan model pagu/alokasi agar halaman Anggaran bisa menghitung:
   - sisa anggaran,
   - over budget berbasis pagu,
   - status pemakaian Banper lintas periode.

2. Tambahkan fitur admin opsional untuk menandai arsip export gagal lama jika dibutuhkan audit operasional. PR 9 tidak menghapus riwayat lama otomatis.
