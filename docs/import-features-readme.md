# README Import Features

Dokumen ini merangkum seluruh fitur import yang tersedia di MBG Transparency System. Jalankan semua command dari folder `Backend` kecuali disebutkan lain.

## Ringkasan Importer

| Fitur | Command / Endpoint | Sumber Data | Target Utama |
| --- | --- | --- | --- |
| Import SPPG | `npm run import:sppg` | 1 file JSON array SPPG | `sppg`, `audit_logs` |
| Import Dapodik Lokal | `npm run import:dapodik` | Folder dataset Dapodik lokal | `dapodik_*`, `school_dapodik_links`, `dapodik_sync_logs` |
| Import Dapodik Manual | `POST /api/dapodik/import-schools` | JSON/CSV upload atau body `items` | `dapodik_schools`, `dapodik_sync_logs` |
| Import Harga Pangan SP2KP | `npm run import:food-prices` atau `POST /api/food-prices/import` | File/folder JSON harga pangan | `food_prices` |
| Generate Threshold Harga | `POST /api/price-thresholds/generate-from-food-prices` | `food_prices` + `production_batches` | `price_thresholds` |

## Prasyarat

1. Install dependency backend:

```bash
cd Backend
npm install
```

2. Pastikan `.env` backend terisi minimal:

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
DAPODIK_DATA_DIR=C:\path\to\dapodik
FOOD_PRICES_PATH=C:\path\to\prices
DAPODIK_DEFAULT_SEMESTER_ID=20252
```

3. Jalankan migration Prisma sebelum import:

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Untuk endpoint HTTP, login sebagai role yang sesuai:

| Endpoint | Role |
| --- | --- |
| `POST /api/food-prices/import` | `admin` |
| `POST /api/dapodik/import-schools` | `admin` |
| `POST /api/price-thresholds/generate-from-food-prices` | `admin` |
| Read-only Dapodik/Food Prices | `admin`, `pemerintah` |

## 1. Import SPPG

Script:

```bash
npm run import:sppg -- C:\path\sppg.json
```

Default project lokal bisa memakai env berikut agar `npm run import:sppg` otomatis membaca file geocoded:

```env
SPPG_IMPORT_PATH=C:\laragon\www\scriptingjson\dapur_sppg_geocoded.json
SPPG_DEFAULT_CAPACITY=1500
```

Dry run:

```bash
npm run import:sppg -- C:\path\sppg.json --dry-run
```

Opsi:

| Opsi | Fungsi |
| --- | --- |
| `--dry-run` | Validasi dan tampilkan summary tanpa menulis DB |
| `--batch-size 100` | Ukuran batch proses, default `100` |
| `--default-capacity 1500` | Kapasitas fallback jika data kosong/tidak valid. Jika tidak diisi, memakai `SPPG_DEFAULT_CAPACITY`, fallback akhir `1` |

Format file input harus berupa array JSON:

```json
[
  {
    "name": "SPPG Bandung Selatan",
    "province": "Jawa Barat",
    "city": "Bandung",
    "address": "Jl. Contoh No. 1",
    "lat": -6.9175,
    "lng": 107.6191,
    "capacity": 1500,
    "status": "active"
  }
]
```

Importer juga mendukung format BGN geocoded seperti `dapur_sppg_geocoded.json`:

```json
[
  {
    "nama": "SPPG Kebumen Buayan Rangkah",
    "alamat": "Jl. Karangbolong, Adiwarno, Kec. Buayan, Kabupaten Kebumen, Jawa Tengah",
    "wilayah": "Provinsi: JAWA TENGAH | Kab/Kota: KEBUMEN | Kecamatan: BUAYAN",
    "lat": -7.6820296,
    "lng": 109.4899392
  }
]
```

Untuk format ini, importer mengambil:

- `name` dari `nama`
- `address` dari `alamat`
- `province` dan `city` dari `wilayah`
- `lat` / `lng` dari hasil geocoding

Field wajib:

- `name`
- `province`
- `city`

Field opsional:

- `address`
- `lat`
- `lng`
- `capacity`
- `status`: `active`, `inactive`, atau `problem`

Perilaku:

- Province dan city dinormalisasi ke uppercase.
- Duplikat dalam file import dilewati.
- Data existing dicari berdasarkan kombinasi `name + province + city + address`.
- Jika data berubah, importer update record existing.
- Setiap create/update menulis audit log dengan `ipAddress = script:import-sppg`.

Output summary contoh:

```json
{
  "filePath": "C:\\path\\sppg.json",
  "totalRows": 120,
  "createCount": 10,
  "updateCount": 3,
  "skippedCount": 2,
  "adjustedCapacityCount": 1,
  "defaultCapacity": 1500,
  "dryRun": false,
  "createdCount": 10,
  "updatedCount": 3
}
```

## 2. Import Dapodik Lokal

Script:

```bash
npm run import:dapodik -- C:\path\to\dapodik
```

Jika `DAPODIK_DATA_DIR` sudah diisi di `.env`, cukup:

```bash
npm run import:dapodik
```

Dry run:

```bash
npm run import:dapodik -- C:\path\to\dapodik --dry-run
```

Override semester:

```bash
npm run import:dapodik -- C:\path\to\dapodik --semester-id 20252
```

Opsi:

| Opsi | Fungsi |
| --- | --- |
| `--dry-run` | Validasi dan buat mutation plan tanpa menulis DB |
| `--semester-id 20252` | Set semester Dapodik, harus 5 digit |
| `--batch-size 500` | Ukuran batch proses, default `500` |

Folder dataset wajib berisi:

```text
provinces.json
cities.json
districts.json
schools-lite.json
```

File opsional:

```text
progress.json
errors.json
```

Perilaku:

- Import masuk ke tabel staging Dapodik, bukan langsung ke `schools`.
- Importer membuat `import_batch_id` dan `source_hash` untuk setiap batch.
- Region dan school staging di-upsert.
- `schools`, `distributions`, `validations`, `users`, dan relasi operasional tidak diubah otomatis.
- Link existing di `school_dapodik_links` tetap dipertahankan selama identifier staging masih sama.
- Setelah import sukses, status dicatat ke `dapodik_sync_logs` dengan endpoint `local_directory_import`.

Output summary berisi:

- `directoryPath`
- `semesterId`
- `importBatchId`
- `sourceHash`
- daftar file yang dipakai
- total row per file
- quality flag seperti partial import
- mutation count untuk provinces/cities/districts/schools

## 3. Import Dapodik Manual via API

Endpoint:

```http
POST /api/dapodik/import-schools
Authorization: Bearer <admin-token>
```

Endpoint ini menerima salah satu dari:

1. `multipart/form-data` dengan field `file`
2. JSON body `items`
3. JSON body `csv`

Contoh JSON body:

```json
{
  "semester_id": "20252",
  "items": [
    {
      "nama_sekolah": "SDN CONTOH 01",
      "npsn": "20123456",
      "sekolah_id": "abc-123",
      "nama_provinsi": "Jawa Barat",
      "nama_kab_kota": "Kab. Bogor",
      "nama_kecamatan": "Cibinong",
      "kode_wilayah": "020301",
      "bentuk_pendidikan": "SD",
      "status_sekolah": "Negeri"
    }
  ]
}
```

Contoh upload file:

```bash
curl -X POST http://localhost:4000/api/dapodik/import-schools ^
  -H "Authorization: Bearer <admin-token>" ^
  -F "semester_id=20252" ^
  -F "file=@C:\path\schools.csv"
```

Field body:

| Field | Keterangan |
| --- | --- |
| `semester_id` | Opsional, default dari `DAPODIK_DEFAULT_SEMESTER_ID` |
| `kode_wilayah` | Opsional, kode wilayah 6 digit |
| `bentuk_pendidikan_id` | Opsional, misalnya `sd`, `smp`, `sma` |
| `items` | Array object sekolah |
| `csv` | String CSV |
| `file` | File `.json` atau `.csv`, max 5 MB |

Perilaku:

- Data masuk ke staging Dapodik.
- JSON harus berupa array atau object dengan `items`/`data`.
- CSV dibaca dari header baris pertama.
- Status import dicatat ke `dapodik_sync_logs` dengan endpoint `manual_school_import`.

## 4. Promote / Link Data Dapodik ke Schools Operasional

Setelah data Dapodik ada di staging, admin bisa menyalin atau menghubungkan data ke tabel operasional.

Cari staging school:

```http
GET /api/dapodik/staged-schools?autocomplete=true&search=surabaya&limit=10
```

Preview detail:

```http
GET /api/dapodik/staged-schools/:id
```

Promote menjadi school operasional:

```http
POST /api/dapodik/staged-schools/:id/promote
Content-Type: application/json

{
  "sppgId": 1,
  "address": "Jl. Contoh No. 1",
  "totalStudents": 420
}
```

Link ke school operasional existing:

```http
POST /api/dapodik/staged-schools/:id/link
Content-Type: application/json

{
  "schoolId": 88,
  "syncFields": true,
  "address": "Jl. Contoh No. 1",
  "totalStudents": 420
}
```

Catatan:

- `promote` akan create school baru atau update school yang cocok berdasarkan `npsn`/`dapodik_school_id`.
- `link` menjaga relasi antara satu staging school dan satu school operasional.
- `sppgId` dan data distribusi tidak disentuh saat link.

## 5. Import Harga Pangan SP2KP

Script:

```bash
npm run import:food-prices -- C:\path\to\prices
```

Jika `FOOD_PRICES_PATH` sudah diisi di `.env`, cukup:

```bash
npm run import:food-prices
```

Mode dry run:

```bash
npm run import:food-prices -- C:\path\to\prices --dry-run
```

Import semua file:

```bash
npm run import:food-prices -- C:\path\to\prices --all
```

Import file terbaru saja:

```bash
npm run import:food-prices -- C:\path\to\prices --latest
```

Import sejak tanggal tertentu:

```bash
npm run import:food-prices -- C:\path\to\prices --since=2026-05-01
```

Import ulang latest meskipun data tanggal itu sudah ada:

```bash
npm run import:food-prices -- C:\path\to\prices --latest --force
```

Import satu file:

```bash
npm run import:food-prices -- C:\path\to\prices\2026-05-18.json
```

Opsi:

| Opsi | Fungsi |
| --- | --- |
| `--dry-run` | Simulasi tanpa insert/update DB |
| `--latest` | Paksa pilih file tanggal terbaru dari folder |
| `--all` | Import semua JSON dalam folder |
| `--since=YYYY-MM-DD` | Import semua file sejak tanggal tertentu |
| `--force` | Tetap import ulang latest walaupun tanggal sudah ada |
| `--limit 100` | Batasi jumlah record yang diproses |

Default behavior:

- Path folder tanpa flag -> import file JSON terbaru saja.
- Path folder + `--all` -> import semua file.
- Path file -> import file itu saja.

Rule pemilihan tanggal latest:

1. Field `date` di JSON.
2. Field `generated_at` / `generatedAt`.
3. Nama file dengan pattern `YYYY-MM-DD`.

Format input utama:

```json
{
  "date": "2026-05-18",
  "source": "SP2KP Kemendag",
  "records": [
    {
      "date": "2026-05-18",
      "harga": 15000,
      "scope": "province",
      "level": "province",
      "kode_provinsi": "32",
      "nama_provinsi": "Jawa Barat",
      "kode_kab_kota": null,
      "nama_kab_kota": null,
      "variant_id": 1,
      "variant": "Beras Medium",
      "satuan": "kg",
      "kuantitas": 1,
      "source_endpoint": "..."
    }
  ]
}
```

Normalizer juga menerima variasi field:

- `price`, `nilai` untuk harga
- `variantId`, `commodity_id`
- `commodity`, `komoditas`
- `province`, `city`
- `unit`, `quantity`

Record wajib punya:

- tanggal
- harga
- `variant_id` / `variantId`
- `variant` / nama komoditas

Unique key:

```text
date + scope + provinceCode + cityCode + variantId
```

Output summary contoh:

```json
{
  "dryRun": false,
  "mode": "latest",
  "selectedFiles": ["C:\\path\\prices\\2026-05-18.json"],
  "latestDate": "2026-05-18",
  "alreadyExists": false,
  "totalFiles": 1,
  "discoveredFiles": 40,
  "totalRecords": 1024,
  "inserted": 900,
  "updated": 124,
  "skipped": 0,
  "errors": []
}
```

Jika latest sudah ada dan tidak memakai `--force`, output akan berisi:

```json
{
  "alreadyExists": true,
  "message": "Data harga pangan tanggal 2026-05-18 sudah ada, skip import. Gunakan --force untuk import ulang."
}
```

## 6. Import Harga Pangan via API

Endpoint:

```http
POST /api/food-prices/import
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "path": "C:\\path\\to\\prices",
  "dryRun": false,
  "latest": true,
  "all": false,
  "force": false,
  "since": "2026-05-01",
  "limit": 100
}
```

Field:

| Field | Keterangan |
| --- | --- |
| `path` | Wajib, file JSON atau folder |
| `dryRun` | Opsional, default `false` |
| `latest` | Opsional, pilih latest |
| `all` | Opsional, import semua file |
| `force` | Opsional, import ulang latest |
| `since` | Opsional, tanggal awal `YYYY-MM-DD` |
| `limit` | Opsional, batasi record |

Response sama dengan summary CLI `import:food-prices`.

## 7. Generate Price Threshold dari Food Prices

Setelah harga pangan diimport, generate threshold:

```http
POST /api/price-thresholds/generate-from-food-prices
Authorization: Bearer <admin-token>
```

Endpoint ini membuat atau memperbarui `price_thresholds` per provinsi.

Sumber perhitungan:

- `food_prices` SP2KP terbaru.
- `production_batches` jika sudah ada costing nyata.
- Multiplier dari `system_configs`.

Config yang dipakai:

| Key | Default |
| --- | --- |
| `mbg_packaging_cost` | `1000` |
| `mbg_operational_cost` | `1500` |
| `mbg_distribution_cost` | `1000` |
| `mbg_threshold_min_multiplier` | `0.85` |
| `mbg_threshold_max_multiplier` | `1.25` |
| `mbg_threshold_actual_cost_weight` | `0.7` |
| `mbg_threshold_food_price_estimate_weight` | `0.3` |

Rumus akhir:

```text
avgReferencePrice =
  weighted average(cost_per_portion production batch wilayah, estimasi food_prices SP2KP)

minPrice = avgReferencePrice * mbg_threshold_min_multiplier
maxPrice = avgReferencePrice * mbg_threshold_max_multiplier
```

## 8. Verifikasi Food Prices dan Anomaly

Script:

```bash
npm run verify:food-prices
```

Mode mutasi:

```bash
npm run verify:food-prices -- --mutate
```

Verifikasi yang dicek:

- import dry-run
- import real
- generate threshold
- `GET /api/food-prices/latest`
- `GET /api/food-prices/estimate`
- distribusi harga normal tidak membuat anomaly
- distribusi harga di luar threshold membuat `PRICE_ANOMALY`

Mode `--mutate` menjalankan tes distribusi dalam transaksi yang sengaja di-rollback.

## 9. Dampak ke Modul Operasional

### Food Prices -> Production Batch

Saat SPPG menambahkan item bahan baku production batch:

1. Sistem mencari harga pasar terbaru dari `food_prices`.
2. Sistem menyimpan:
   - `market_reference_price`
   - `source_price_id`
   - `source_price`
   - `price_difference_percent`
3. Jika harga input bahan baku terlalu tinggi, sistem membuat `RAW_MATERIAL_PRICE_ANOMALY`.

Threshold anomali bahan baku:

```text
system_configs.raw_material_price_anomaly_percent
default: 25
```

### Production Batch -> Distribution

Saat distribusi dibuat:

1. Sistem mencari production batch berdasarkan SPPG dan tanggal distribusi.
2. Jika batch ditemukan, `price_per_portion` default memakai `production_batches.cost_per_portion`.
3. Sistem membandingkan harga porsi dengan `price_thresholds`.
4. Jika di luar batas, sistem membuat `PRICE_ANOMALY`.
5. Jika harga kembali normal saat update, anomaly harga terbuka di-resolve otomatis.

## 10. Troubleshooting

### Prisma table belum ada

Error seperti `does not exist in the current database` berarti migration belum jalan:

```bash
npm run prisma:migrate
npm run prisma:generate
```

### Import Dapodik gagal karena file tidak ditemukan

Pastikan folder berisi file wajib:

```text
provinces.json
cities.json
districts.json
schools-lite.json
```

Atau set:

```env
DAPODIK_DATA_DIR=C:\path\to\dapodik
```

### Import harga pangan skip latest

Itu normal jika data tanggal latest sudah ada. Pakai:

```bash
npm run import:food-prices -- C:\path\to\prices --latest --force
```

### Banyak record food prices skipped

Cek field wajib di JSON:

- tanggal
- harga
- variant id
- variant name

### Dapodik upstream sync error

`POST /api/dapodik/sync-schools` sengaja disabled. Jalur resmi sekarang adalah import lokal:

```bash
npm run import:dapodik -- C:\path\to\dapodik
```

atau endpoint manual:

```http
POST /api/dapodik/import-schools
```

## 11. Checklist Operasional

Untuk setup data awal yang aman:

```bash
cd Backend
npm run prisma:migrate
npm run prisma:generate
npm run seed
npm run import:sppg -- C:\path\sppg.json --dry-run
npm run import:sppg -- C:\path\sppg.json
npm run import:dapodik -- C:\path\dapodik --dry-run
npm run import:dapodik -- C:\path\dapodik
npm run import:food-prices -- C:\path\prices --dry-run
npm run import:food-prices -- C:\path\prices
npm run verify:food-prices
```

Setelah itu, dari API/admin dashboard:

1. Generate price thresholds dari food prices.
2. Promote/link staged Dapodik schools ke `schools`.
3. Buat production batch SPPG.
4. Buat distribusi dan cek anomaly logs.
