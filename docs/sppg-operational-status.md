# SPPG Operational Status

## Tujuan Fitur

Status operasional SPPG dipakai sebagai sumber tunggal untuk list SPPG, detail SPPG, peta geospatial internal, dan peta publik. Marker peta tidak memakai hardcode dari nama/lokasi; warna dan filter membaca field `status` dari backend.

## Status Tersedia

| Value API | Label UI | Warna Marker |
| --- | --- | --- |
| `active` | Aktif | Hijau |
| `inactive` | Tidak Aktif | Abu-abu |
| `problem` | Bermasalah | Merah/oranye |

Default SPPG baru adalah `active`. Data lama yang kosong/null difallback sebagai `active` di serializer/backend.

## Role dan Permission

- `sppg.status.read`
  - Role default: `admin`, `pemerintah`, `sppg`, `sekolah`.
  - Dipakai untuk endpoint marker dan detail internal yang menampilkan status operasional.
- `sppg.status.update`
  - Role default: `admin`.
  - Dipakai untuk update status operasional SPPG.
- Public map tidak memakai permission login, tetapi hanya menerima data public-safe.

## Endpoint yang Mengirim Status

- `GET /api/sppg`
  - List SPPG berisi field `status`.
- `GET /api/sppg/:id`
  - Detail master SPPG berisi field `status`.
- `GET /api/sppg/:id/detail`
  - Detail operasional SPPG berisi `status` dan `isActive`.
- `GET /api/sppg/map-markers`
  - Marker internal berisi `id`, `name`, koordinat, wilayah, `status`, success rate, dan porsi hari ini.
- `GET /api/public/sppg`
  - Marker publik berisi data ringkas public-safe.
- `GET /api/public/sppg/:id`
  - Detail publik berisi status ringkas dan informasi aman untuk publik.

## Endpoint Update Status

- `PATCH /api/sppg/:id/status`
  - Body: `{ "status": "active" | "inactive" | "problem" }`
  - Wajib role `admin` dan permission `sppg.status.update`.
  - Membuat audit log `UPDATE` pada tabel `sppg`.
- `PUT /api/sppg/:id`
  - Tetap mendukung update penuh SPPG termasuk field `status`.
  - Wajib role `admin` dan permission `sppg.status.update`.

Jika status di luar `active`, `inactive`, atau `problem` dikirim, request ditolak oleh validasi.

## Otomatis dari Laporan Kendala

Laporan kendala SPPG dapat mengubah status operasional secara otomatis untuk kasus yang berpotensi menghentikan produksi atau distribusi.

- Saat issue baru dibuat melalui `POST /api/issues`, backend mengecek kategori kendala.
- Kategori kritis:
  - `kekurangan_bahan`,
  - `peralatan`,
  - `logistik`.
- Jika kategori issue termasuk kritis, backend otomatis mengubah `sppg.status` menjadi `problem`.
- Perubahan otomatis ini dibuat dalam transaksi yang sama dengan pembuatan issue.
- Audit log dibuat untuk:
  - insert issue di tabel `issues`,
  - update status SPPG di tabel `sppg`.
- Kategori `keterlambatan` dan `lainnya` tidak otomatis mengubah status SPPG.

Pemulihan status:

- Issue kritis yang diubah ke `resolved` melalui `PUT /api/issues/:id/status` dapat mengembalikan SPPG ke `active`.
- SPPG hanya dikembalikan ke `active` jika tidak ada issue kritis lain yang masih `open` atau `in_progress`.
- Admin tetap bisa mengubah status secara manual melalui `PATCH /api/sppg/:id/status`.
- Public atau role non-admin tidak bisa mengubah status operasional.

## Cara Peta Membaca Status

- Peta internal `/peta` mengambil marker dari `GET /api/sppg/map-markers`.
- Frontend menormalisasi koordinat dan mengabaikan marker tanpa koordinat valid supaya peta tidak crash.
- Warna marker ditentukan dari `status` backend:
  - `active` hijau,
  - `inactive` abu-abu,
  - `problem` merah/oranye.
- Filter status di peta memakai value yang sama dengan API.
- Detail marker memuat ulang data dari `GET /api/sppg/:id/detail`, sehingga panel detail dan marker memakai status yang sinkron.

## Catatan Public Map

- Peta publik `/peta-publik` membaca `GET /api/public/sppg`.
- Data publik hanya mengekspos ringkasan aman:
  - id,
  - nama SPPG,
  - provinsi/kota/distrik jika tersedia,
  - koordinat,
  - status operasional,
  - kapasitas,
  - ringkasan distribusi/menu yang memang public-safe.
- Detail sensitif seperti PIC internal, nomor telepon, audit log, dan data operasional internal tidak dikirim di marker publik.
