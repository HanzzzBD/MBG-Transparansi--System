# Role Data Sync Audit

Tanggal audit: 2026-05-27

## Ringkasan

Audit end-to-end dilakukan lewat MCP Playwright/browser untuk alur SPPG -> Sekolah, lalu dilanjutkan dengan cek endpoint API dan query service backend. Data inti `distributionId`, `sppgId`, `schoolId`, tanggal, porsi, SPPG, dan sekolah berasal dari record database yang sama. Namun status yang tampil antar role tidak konsisten karena ada dua field status dengan makna berbeda:

- `distributions.status`: status logistik pengiriman (`in_progress`, `delivered`, `failed`).
- `validations.status`: status respons sekolah (`pending`, `verified`, `conflict`, `issue_reported`).

Halaman Sekolah memakai `validations.status`, sementara halaman distribusi/riwayat SPPG dan beberapa serializer dashboard memakai `distributions.status`. Akibatnya distribusi yang sudah `verified` atau `issue_reported` oleh sekolah masih tampil sebagai `delivered` di SPPG/Admin.

## Role Yang Diuji

- SPPG: `sppg@mbg.go.id`, `sppgId=1`, `SPPG Test Dapodik`
- Sekolah: `sekolah@mbg.go.id`, `schoolId=1`, `SD TEST DAPODIK CACHE 01`
- Admin: `admin@mbg.go.id`
- Gov: dicek relevansinya sebagai agregat/dashboard; tidak membuat mutasi.
- Public: tidak relevan untuk distribusi internal, hanya laporan publik terpisah.

## Skenario 1: Create Distribusi dan Confirm

### Action SPPG

Lewat browser MCP, SPPG membuka `/distribusi`, tab `Tambah Distribusi Baru`, lalu membuat distribusi:

- `distributionId`: 126
- `sppgId`: 1
- `schoolId`: 1
- `SPPG`: SPPG Test Dapodik
- `Sekolah`: SD TEST DAPODIK CACHE 01
- `tanggal`: 2026-05-27
- `porsi`: 321
- `hargaPerPorsi`: 13000

Endpoint:

- `POST /api/distributions`
- request:

```json
{"sppgId":1,"schoolId":1,"portions":321,"pricePerPortion":13000,"distributionDate":"2026-05-27"}
```

- response penting:

```json
{
  "id": 126,
  "sppgId": 1,
  "schoolId": 1,
  "portions": 321,
  "status": "in_progress",
  "validation": {
    "id": 83,
    "distributionId": 126,
    "schoolId": 1,
    "status": "pending"
  }
}
```

SPPG lalu menekan `Tandai Terkirim`.

Endpoint:

- `PUT /api/distributions/126`
- request:

```json
{"status":"delivered"}
```

- response penting:

```json
{
  "id": 126,
  "status": "delivered",
  "validation": {
    "id": 83,
    "status": "pending"
  }
}
```

### Cek Sekolah

Sekolah membuka `/validasi`. Distribusi yang sama muncul di panel `Menunggu Konfirmasi`.

Endpoint:

- `GET /api/validations?limit=100`

Response memuat record yang sama:

```json
{
  "id": 83,
  "distributionId": 126,
  "schoolId": 1,
  "status": "pending",
  "distribution": {
    "id": 126,
    "sppgId": 1,
    "schoolId": 1,
    "portions": 321,
    "status": "delivered"
  }
}
```

Data inti sama: SPPG, sekolah, tanggal, porsi, dan `distributionId` cocok. Perbedaan: status sekolah membaca `validation.status=pending`, sedangkan distribution record sudah `status=delivered`.

### Action Sekolah Confirm

Sekolah menekan `Konfirmasi`, lalu `Konfirmasi Diterima`.

Endpoint:

- `PUT /api/validations/83`
- request:

```json
{"receivedPortions":321,"qualityOk":true,"status":"verified","notes":null}
```

- response penting:

```json
{
  "id": 83,
  "distributionId": 126,
  "status": "verified",
  "distribution": {
    "id": 126,
    "status": "delivered"
  }
}
```

Hasil: pending sekolah berkurang karena `validations.status` berubah ke `verified`. Namun SPPG/Admin yang menampilkan `distributions.status` tetap melihat `delivered`, bukan `verified`.

## Skenario 2: Report Issue

### Action SPPG

Distribusi kedua dibuat lewat browser/API audit:

- `distributionId`: 127
- `validationId`: 84
- `sppgId`: 1
- `schoolId`: 1
- `tanggal`: 2026-05-27
- `porsi`: 322
- `status awal`: `distribution.status=in_progress`, `validation.status=pending`

Setelah SPPG menekan `Tandai Terkirim`, response:

```json
{
  "id": 127,
  "status": "delivered",
  "validation": {
    "id": 84,
    "status": "pending"
  }
}
```

### Action Sekolah Laporkan Masalah

Endpoint:

- `POST /api/school-reports`
- request:

```json
{
  "schoolId": 1,
  "distributionId": 127,
  "validationId": 84,
  "category": "kekurangan_porsi",
  "message": "Audit sinkronisasi: porsi diterima tidak sesuai dan perlu tindak lanjut."
}
```

Response create report masih mengembalikan nested validation lama:

```json
{
  "id": 75,
  "distributionId": 127,
  "distribution": {
    "id": 127,
    "status": "delivered",
    "validation": {
      "id": 84,
      "status": "pending"
    }
  }
}
```

Namun setelah refetch:

- `GET /api/validations?limit=100` mengembalikan `validation.status=issue_reported`.
- `GET /api/distributions?date=2026-05-27&sppgId=1&limit=50` mengembalikan `distribution.status=delivered`, nested `validation.status=issue_reported`.
- `GET /api/school-reports?distributionId=127&limit=10` terlihat oleh SPPG dan Admin.

## Perbandingan Endpoint Antar Role

| Role | Endpoint utama | Sumber data | Status yang dipakai |
| --- | --- | --- | --- |
| Sekolah | `GET /api/validations?limit=100` | `validations` join `distributions` | `validations.status` |
| SPPG distribusi | `GET /api/distributions?...` | `distributions` include `validation` | frontend memakai `distributions.status` |
| SPPG laporan masalah | `GET /api/school-reports?...` | `school_reports` include `distribution.validation` | memakai `distribution.validation.status` |
| Admin distribusi | `GET /api/distributions?...` | `distributions` include `validation` | raw response punya dua status; UI raw distribusi cenderung memakai `distributions.status` |
| Gov | dashboard/analytics | agregat `distributions` dan `validations` | campuran, tergantung widget |

## Temuan Frontend

- `Frontend/src/pages/Distribusi.jsx` menormalisasi `status: item.status || 'in_progress'`, sehingga status tabel SPPG adalah status logistik, bukan status respons sekolah.
- `Frontend/src/pages/SppgHistory.jsx` dan `Frontend/src/pages/SchoolHistory.jsx` menampilkan `distribution.status` di daftar distribusi.
- `Frontend/src/pages/Konfirmasi.jsx` benar memakai `validations.status` untuk pending/history.
- `Frontend/src/pages/SppgIssues.jsx` benar memakai `distribution.validation.status` untuk laporan sekolah.
- Ada duplikasi mapper status di beberapa halaman (`Dashboard.jsx`, `Distribusi.jsx`, `Konfirmasi.jsx`, dll.).
- Tidak ditemukan fallback/mock untuk data distribusi/validasi pada halaman terkait; empty state menyatakan data dari backend kosong.
- Console browser menampilkan warning duplicate key sidebar untuk path `/distribusi`, tidak langsung terkait sinkronisasi data.

## Temuan Backend

- `Backend/src/modules/distributions/service.js` memakai `DistributionStatus` untuk status kirim dan sudah include `validation`.
- `Backend/src/modules/validations/service.js` update validation dalam transaction dan mencatat audit log/notification.
- `Backend/src/modules/reports/service.js` create school report dan update `validation.status` ke `issue_reported` dalam transaction jika status sebelumnya pending.
- `createSchoolReport` mengembalikan `created` report dengan nested `distribution.validation` dari include awal sebelum update, sehingga response create report menampilkan `pending` walau database sudah berubah ke `issue_reported`.
- Query list antar role mengambil database yang sama, tetapi UI membaca field status berbeda.

## Root Cause Sementara

Root cause utama bukan data hilang, melainkan ambiguity field `status`:

1. `distributions.status` dipakai sebagai status pengiriman.
2. `validations.status` dipakai sebagai status konfirmasi sekolah.
3. UI SPPG/Admin kadang menampilkan `distributions.status` sebagai status utama distribusi.
4. Response `POST /school-reports` belum me-refresh nested validation setelah update transaction.

## File Terindikasi Bermasalah

- `Frontend/src/pages/Distribusi.jsx`
- `Frontend/src/pages/SppgHistory.jsx`
- `Frontend/src/pages/SchoolHistory.jsx`
- `Frontend/src/pages/Dashboard.jsx`
- `Backend/src/modules/reports/service.js`
- `Backend/src/modules/dashboard/service.js`

## Rekomendasi Fix

1. Jadikan `validation.status` sebagai status respons sekolah yang ditampilkan lintas role.
2. Tetap pertahankan `distribution.status` sebagai status pengiriman/logistik, tetapi tampilkan dengan label terpisah seperti `Status Kirim`.
3. Tambahkan helper frontend status agar mapping `pending/verified/conflict/issue_reported` tidak duplikatif.
4. Ubah halaman SPPG distribusi/riwayat agar status utama yang dibandingkan dengan sekolah adalah `validation.status`.
5. Ubah `createSchoolReport` agar response setelah report mengembalikan nested validation terbaru.
6. Pastikan pending count memakai `validation.status === 'pending'`, bukan `distribution.status`.

## Status Audit

Data inti sinkron, tetapi status tampil antar role belum sinkron. Perbaikan diperlukan.

## Fix Yang Dilakukan

Perbaikan diterapkan setelah audit menemukan perbedaan status antar role:

- `Backend/src/modules/distributions/service.js`
  - Menambahkan field eksplisit `deliveryStatus` untuk status kirim/logistik.
  - Menambahkan field eksplisit `confirmationStatus` dari `validation.status`.
  - List/detail/create/update distribution tetap mempertahankan `status` lama untuk kompatibilitas, tetapi endpoint sekarang punya field status konfirmasi yang tidak ambigu.
- `Backend/src/modules/reports/service.js`
  - `POST /school-reports` sekarang me-refetch report setelah update validation, sehingga nested `distribution.validation.status` di response langsung berisi `issue_reported`.
- `Backend/src/modules/dashboard/service.js`
  - Serializer distribusi dashboard memakai `validation.status` sebagai status utama tampilan dan menambahkan `deliveryStatus`.
- `Frontend/src/utils/distributionStatus.js`
  - Helper status bersama untuk label status kirim dan status validasi.
- `Frontend/src/pages/Distribusi.jsx`
  - Tabel SPPG sekarang memisahkan `Status Konfirmasi` dan `Status Kirim`.
  - Pending notification count memakai `validation.status === pending`.
  - Aksi `Tandai Terkirim` tetap memakai `deliveryStatus`.
- `Frontend/src/pages/SppgHistory.jsx`
  - Riwayat SPPG menampilkan status konfirmasi sebagai status utama, dengan status kirim sebagai informasi tambahan.
- `Frontend/src/pages/SchoolHistory.jsx`
  - Riwayat sekolah menampilkan status konfirmasi sebagai status utama, dengan status kirim sebagai informasi tambahan.
- `Frontend/src/pages/Konfirmasi.jsx` dan `Frontend/src/pages/Dashboard.jsx`
  - Menggunakan helper status bersama agar label tidak makin terduplikasi.
- `Backend/src/modules/sppg/service.js`
  - Menambahkan `deliveryStatus` dan `confirmationStatus` pada serializer distribusi detail operasional SPPG.
- `Backend/src/modules/public/service.js` dan `Backend/src/modules/public/serializer.js`
  - Recent distribution public detail sekarang ikut mengambil `validation.status` dan mengirim `confirmationStatus`, tanpa menghapus `status` lama.
- `Backend/src/modules/exports/processor.js`
  - Export distribusi sekarang memiliki kolom eksplisit `delivery_status` dan `confirmation_status` selain `status`/`validation_status`.
- `Frontend/src/pages/PetaSPPG.jsx` dan `Frontend/src/pages/PublicPetaSPPG.jsx`
  - Tampilan distribusi terbaru memakai status konfirmasi sekolah jika tersedia.

## Retest Setelah Fix

Retest dilakukan setelah backend direstart dan frontend dibuild.

### Confirm Flow

Data retest:

- `distributionId`: 128
- `validationId`: 85
- `sppgId`: 1
- `schoolId`: 1
- `porsi`: 331

Hasil:

```json
{
  "validationResponseStatus": "verified",
  "sppgDistribution": {
    "id": 128,
    "status": "delivered",
    "deliveryStatus": "delivered",
    "confirmationStatus": "verified",
    "validationStatus": "verified"
  },
  "adminDistribution": {
    "id": 128,
    "status": "delivered",
    "deliveryStatus": "delivered",
    "confirmationStatus": "verified",
    "validationStatus": "verified"
  },
  "schoolValidationStatus": "verified"
}
```

Kesimpulan: status konfirmasi sama di Sekolah, SPPG, dan Admin. `deliveryStatus` tetap `delivered` sebagai status kirim.

### Issue Report Flow

Data retest:

- `distributionId`: 129
- `validationId`: 86
- `reportId`: 76
- `sppgId`: 1
- `schoolId`: 1
- `porsi`: 332

Hasil:

```json
{
  "reportNestedValidationStatus": "issue_reported",
  "sppgDistribution": {
    "id": 129,
    "status": "delivered",
    "deliveryStatus": "delivered",
    "confirmationStatus": "issue_reported",
    "validationStatus": "issue_reported"
  },
  "adminDistribution": {
    "id": 129,
    "status": "delivered",
    "deliveryStatus": "delivered",
    "confirmationStatus": "issue_reported",
    "validationStatus": "issue_reported"
  },
  "schoolValidationStatus": "issue_reported",
  "sppgReportCount": 1,
  "adminReportCount": 1
}
```

Kesimpulan: report issue membuat report record, status validasi berubah menjadi `issue_reported`, response create report tidak stale lagi, dan laporan terlihat oleh SPPG/Admin.

## Verifikasi

- `npm --prefix Frontend run build`: pass.
- `npm --prefix Frontend test`: pass, 26 test.
- `node --test Backend/test/school-validation-flow.e2e.test.js`: pass, 6 test.
- `npm --prefix Backend test`: pass, 43 test.

Catatan: satu percobaan awal full backend test sempat gagal pada foreign key notification di subtest conflict validation saat test berjalan paralel. File test yang sama kemudian pass saat dijalankan terpisah, dan full backend test berikutnya pass 43/43.

## Status Akhir

Clear untuk acceptance criteria sinkronisasi data distribusi antar role:

- Distribusi yang sama memiliki `confirmationStatus`/`validation.status` yang sama di Sekolah, SPPG, dan Admin.
- Confirm sekolah langsung terlihat sebagai `verified` di SPPG/Admin.
- Report issue sekolah langsung terlihat sebagai `issue_reported` di SPPG/Admin dan tidak lagi dihitung pending.
- `deliveryStatus` dipisahkan dari status konfirmasi, sehingga status pengiriman `delivered` tidak lagi menutupi respons sekolah.
- Endpoint public/SPPG/export yang relevan sudah memiliki field eksplisit agar tidak ambigu.
- Halaman lock/unlock dan override admin tetap memakai status kirim/logistik karena memang konteksnya koreksi/lock record distribusi, bukan status respons sekolah.

## Audit Tambahan: Normalisasi Wilayah Anggaran

Tanggal audit: 27 Mei 2026.

Pemicu:

- Halaman admin anggaran sempat menampilkan `JAWA BARAT` dan `Prov. Jawa Barat` sebagai dua provinsi.
- Halaman publik membaca agregat anggaran dari endpoint publik, sehingga perlu dipastikan tidak ikut memecah provinsi/kota/kecamatan yang sebenarnya sama.

Temuan:

- Penyebab utama adalah nilai wilayah mentah yang tidak seragam, terutama prefix `Prov.`, `Kab.`, `Kota`, dan `Kec.`.
- Seed demo lama masih memakai `Prov. Jawa Barat`, `Kab. Bogor`, dan `Kec. Demo`.
- Ada satu data sekolah aktif (`SMKN 3 BANDUNG`, id 219) yang tersimpan sebagai `Prov. Jawa Barat` / `Kota Bandung`, sementara data lain memakai `JAWA BARAT` / `KOTA BANDUNG`.
- Agregasi analytics/public sebelumnya bisa mengelompokkan berdasarkan string mentah dari database.

Perbaikan yang dilakukan:

- Menambahkan helper normalisasi wilayah di `Backend/src/utils/region.js`.
- Public filter, serializer, dan analytics budget/success/province aggregation sekarang menormalisasi nama provinsi/kota sebelum dedupe atau merge agregat.
- Public report baru menyimpan provinsi/kota dalam format normal.
- Seed demo diubah agar memakai `JAWA BARAT`, `KABUPATEN BOGOR`, dan `DEMO`.
- Data sekolah aktif yang sudah terlanjur berbeda format dinormalisasi ke `JAWA BARAT`, `KOTA BANDUNG`, `LENGKONG`.

Catatan kota/kecamatan:

- `KOTA BANDUNG` dan `BANDUNG` tidak otomatis digabung karena bisa berarti Kota Bandung vs Kabupaten Bandung. Prefix `KOTA`/`KABUPATEN` dipertahankan agar data administratif tidak salah merge.
- Pengecekan kecamatan harus memakai konteks parent lengkap `provinsi/kota/kecamatan`. Nama seperti `CIGUGUR` atau `PAPAR` bisa muncul di kota/provinsi berbeda, sehingga bukan duplicate jika parent berbeda.

Bukti testing:

- DB scan aktif setelah cleanup:
  - `active_sppg_province`: 0 duplicate group.
  - `active_sppg_city`: 0 duplicate group.
  - `active_school_province`: 0 duplicate group.
  - `active_school_city`: 0 duplicate group.
  - `active_school_district`: 0 duplicate group.
- DB scan komposit:
  - `active_school_province_city_district`: 0 duplicate group.
  - `dapodik_school_province_city_district`: 0 duplicate group dari 63.806 record.
  - `dapodik_district_parent_context`: 0 duplicate group dari 1.372 record.
- API `GET /api/public/budget`:
  - `charts.budgetByProvince`: hanya `JAWA BARAT`.
  - `charts.priceByProvince`: hanya `JAWA BARAT`.
  - `charts.budgetByCity`: hanya `JAWA BARAT / KOTA BANDUNG`.
- Playwright `http://localhost:5173/anggaran-publik`:
  - `Prov. Jawa Barat`: 0 kemunculan.
  - filter provinsi hanya memuat `JAWA BARAT`, bukan `Prov. Jawa Barat`.
- Playwright admin `http://localhost:5173/anggaran`:
  - `Prov. Jawa Barat`: 0 kemunculan.
  - tabel Harga Per Porsi per Provinsi menampilkan satu baris `JAWA BARAT`.
