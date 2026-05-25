# Dapodik Local Staging Integration

Dokumen ini menggambarkan integrasi Dapodik yang berlaku saat ini di backend MBG.

Prinsip utamanya:

- backend **tidak** fetch runtime ke endpoint Dapodik upstream
- sumber data Dapodik berasal dari file JSON lokal hasil scraping
- data Dapodik masuk ke tabel staging terlebih dahulu
- tabel `schools` tetap menjadi data operasional utama aplikasi MBG

## Sumber Data

Importer lokal membaca file berikut dari satu directory dataset:

- `provinces.json`
- `cities.json`
- `districts.json`
- `schools-lite.json`
- opsional: `progress.json`
- opsional: `errors.json`

## Tabel Staging

Tabel yang dipakai:

- `dapodik_provinces`
- `dapodik_cities`
- `dapodik_districts`
- `dapodik_schools`
- `school_dapodik_links`
- `dapodik_sync_logs`

`school_dapodik_links` menjaga relasi 1:1 antara sekolah operasional MBG dan satu staging school Dapodik.

## Import CLI

Script resmi:

```bash
npm run import:dapodik -- "C:\path\to\dapodik"
```

Dry run:

```bash
npm run import:dapodik -- "C:\path\to\dapodik" --dry-run
```

Override semester:

```bash
npm run import:dapodik -- "C:\path\to\dapodik" --semester-id 20252
```

Atau set default directory di `.env`:

```env
DAPODIK_DATA_DIR=C:\laragon\www\scriptingjson\schools\data\dapodik
```

Lalu cukup jalankan:

```bash
npm run import:dapodik
```

Perilaku importer:

- upsert provinces/cities/districts/schools berdasarkan key stabil
- sekolah staging dipadankan per semester dengan `dapodik_school_id` atau `npsn`
- setiap batch diberi `import_batch_id` dan `source_hash`
- import ulang dataset yang lebih lengkap **tidak** menyentuh tabel operasional `schools`
- `school_dapodik_links` tetap dipertahankan selama identifier staging yang sama masih ada

## Endpoint Backend

Semua endpoint berikut wajib login.

### Read-only staging

```http
GET /api/dapodik/regions
GET /api/dapodik/schools
GET /api/dapodik/staged-schools
GET /api/dapodik/staged-schools/:id
GET /api/dapodik/sync-logs/latest
```

### Mutasi admin

```http
POST /api/dapodik/import-schools
POST /api/dapodik/staged-schools/:id/promote
POST /api/dapodik/staged-schools/:id/link
POST /api/dapodik/sync-schools
```

Catatan:

- `POST /api/dapodik/sync-schools` sekarang sengaja **disabled** dan akan mengembalikan error `DAPODIK_UPSTREAM_DISABLED`
- jalur yang benar untuk memasukkan data baru adalah importer lokal atau `POST /api/dapodik/import-schools`
- `POST /api/dapodik/import-schools` menerima upload `.json`/`.csv` sampai default 50 MB; ubah `DAPODIK_IMPORT_MAX_FILE_SIZE_MB` bila perlu. Untuk dataset besar, gunakan `multipart/form-data` field `file`, bukan body JSON paste.
- Import sekolah manual tetap menyimpan row sekolah walau kode kecamatan belum ada di staging region; field FK district akan null sampai region terkait di-import.
- Import sekolah manual tidak membuat duplicate untuk data yang sama; row existing dengan isi sekolah sama dihitung `unchangedCount` dan dilewati.

## Search dan Autocomplete

Endpoint utama untuk admin UI:

```http
GET /api/dapodik/staged-schools?search=surabaya&autocomplete=true&limit=10
```

Filter yang tersedia:

- `semester_id`
- `kode_wilayah`
- `province`
- `city`
- `district`
- `education_level`
- `school_status`
- `npsn`
- `search`
- `link_status=linked|unlinked`
- `autocomplete=true|false`

Jika `autocomplete=true`, response dibuat lebih ringan untuk dropdown/modal pencarian.

Contoh hasil item autocomplete:

```json
{
  "id": 123,
  "name": "SDN CONTOH 01",
  "npsn": "20123456",
  "dapodikSchoolId": "ABC123",
  "educationLevel": "SD",
  "schoolStatus": "Negeri",
  "region": {
    "province": "Prov. Jawa Timur",
    "city": "Kota Surabaya",
    "district": "Kec. Tambaksari",
    "districtCode": "056020"
  },
  "linkedSchool": null
}
```

## Preview Staged School

Untuk modal detail sebelum copy/link:

```http
GET /api/dapodik/staged-schools/:id
```

Response sudah memuat:

- identitas sekolah Dapodik
- wilayah
- raw payload
- status apakah sudah linked ke sekolah operasional

## Promote ke Schools Operasional

Untuk membuat sekolah operasional baru atau update sekolah existing yang match berdasarkan `npsn` / `dapodik_school_id`:

```http
POST /api/dapodik/staged-schools/:id/promote
Content-Type: application/json

{
  "sppgId": 1,
  "address": "Jl. Contoh No. 1",
  "totalStudents": 420
}
```

Perilaku:

- kalau ada `schools` yang match, backend update record tersebut
- kalau belum ada, backend create record baru
- setelah itu backend membuat/menjaga `school_dapodik_links`

## Link ke School Existing

Untuk kasus sekolah operasional MBG sudah ada lebih dulu:

```http
POST /api/dapodik/staged-schools/:id/link
Content-Type: application/json

{
  "schoolId": 88,
  "syncFields": true,
  "totalStudents": 420
}
```

Field request:

- `schoolId` wajib
- `syncFields` default `true`
- `address` opsional
- `totalStudents` opsional

Perilaku:

- membuat atau memperbarui row di `school_dapodik_links`
- bila `syncFields=true`, backend menyalin field referensi Dapodik ke `schools`
- `sppgId` dan data distribusi tidak disentuh

## Integrasi UI Admin

Repo frontend belum ada di workspace ini, jadi integrasi UI disiapkan lewat kontrak backend berikut:

1. Admin membuka modal `Cari Sekolah Dapodik`.
2. Frontend memanggil `GET /api/dapodik/staged-schools?autocomplete=true&search=...`.
3. Saat item dipilih, frontend memanggil `GET /api/dapodik/staged-schools/:id`.
4. UI memberi dua aksi:
   - `Copy ke School MBG` -> `POST /api/dapodik/staged-schools/:id/promote`
   - `Link ke School Existing` -> cari sekolah operasional lewat `GET /api/schools?search=...`, lalu submit `POST /api/dapodik/staged-schools/:id/link`
5. Setelah sukses, UI refresh daftar sekolah operasional dan detail staging school.

## Re-import Data Nasional Penuh

Saat dataset nasional lengkap sudah tersedia:

1. jalankan `npm run import:dapodik -- <folder_dataset_baru>`
2. importer akan membuat `import_batch_id` baru
3. staging provinces/cities/districts/schools akan di-upsert
4. tabel operasional `schools`, `distributions`, `validations`, `users`, dan relasi ke `sppg` **tidak** diubah otomatis
5. link yang sudah ada tetap aman selama identifier sekolah Dapodik yang sama masih ditemukan di batch baru

Kalau diperlukan, status import terakhir bisa dicek lewat:

```http
GET /api/dapodik/sync-logs/latest?endpoint=local_directory_import
```
