# SPPG School Assignment Flow

## Alasan Perubahan

Flow lama mewajibkan admin melakukan promote data `dapodik_schools` ke `schools` sebelum SPPG dapat memakai sekolah tersebut untuk distribusi. Flow baru menjadikan `dapodik_schools` tetap sebagai referensi/staging, sementara SPPG memilih sendiri sekolah saluran dari Dapodik melalui relasi operasional.

## Flow Lama

- Admin import data Dapodik ke `dapodik_schools`.
- Admin promote satu sekolah ke tabel operasional `schools`.
- Relasi SPPG lama dibaca dari `schools.sppg_id`.
- Distribusi SPPG bergantung pada daftar `schools` yang sudah dipromote.

## Flow Baru

- `dapodik_schools` tetap tidak diubah oleh SPPG.
- SPPG membuka `/sekolah-saluran`.
- SPPG mencari sekolah Dapodik dengan pagination server-side.
- SPPG memilih satu atau beberapa sekolah.
- Backend membuat atau memakai row `schools` operasional dari data Dapodik.
- Backend membuat assignment aktif di `sppg_school_assignments`.
- `GET /api/sppg/me/schools` hanya mengembalikan assignment aktif milik SPPG login.
- `POST /api/distributions` untuk role SPPG ditolak jika `schoolId` belum menjadi assignment aktif SPPG tersebut.

## ERD Ringkas

```text
dapodik_schools 1 -- 0..1 school_dapodik_links 1 -- 1 schools
schools 1 -- N sppg_school_assignments N -- 1 sppg
users 1 -- N sppg_school_assignments (assigned_by)
```

`schools.sppg_id` masih dipertahankan untuk kompatibilitas kode lama dan dibackfill ke assignment aktif. Field ini dianggap legacy/deprecated untuk flow baru.

## Endpoint Baru

| Method | Endpoint | Role | Fungsi |
|---|---|---|---|
| GET | `/api/sppg/me/dapodik-schools` | SPPG | Search sekolah Dapodik dengan filter dan pagination |
| POST | `/api/sppg/me/schools/assign` | SPPG | Assign satu atau batch sekolah Dapodik ke SPPG login |
| GET | `/api/sppg/me/schools` | SPPG | List sekolah saluran dari assignment aktif |
| PATCH | `/api/sppg/me/schools/:assignmentId/unassign` | SPPG | Nonaktifkan assignment aktif milik SPPG login |
| GET | `/api/sppg/:id/schools` | Admin | List assignment SPPG tertentu |
| POST | `/api/sppg/:id/schools/assign` | Admin | Assign sekolah ke SPPG tertentu |
| PATCH | `/api/sppg/:id/schools/:assignmentId/unassign` | Admin | Unassign sekolah dari SPPG tertentu |

## RBAC

- Public: 401 untuk endpoint assignment.
- Sekolah: 403 untuk assign/unassign.
- Pemerintah: 403 untuk assign/unassign.
- SPPG: hanya bisa assign/unassign SPPG miliknya melalui `/me`.
- Admin: dapat mengelola assignment SPPG tertentu lewat endpoint admin.
- Search Dapodik tidak mengirim `raw_data` besar.
- Sekolah yang sudah aktif di SPPG lain ditandai dan tidak bisa diambil oleh SPPG login.

## Migration Strategy

- Migration `20260526160000_sppg_school_assignments` membuat tabel `sppg_school_assignments`.
- Backfill membuat assignment aktif dari `schools.sppg_id` untuk sekolah existing yang belum punya assignment aktif.
- Partial unique index menjaga satu sekolah hanya punya satu assignment aktif.
- Partial unique index juga mencegah duplicate active assignment untuk pasangan `sppg_id + school_id`.
- Tidak ada drop `schools.sppg_id` pada migration ini.

## Contoh Request

```http
GET /api/sppg/me/dapodik-schools?search=SMAN&page=1&limit=10
```

```json
{
  "data": [
    {
      "id": 1,
      "npsn": "12345678",
      "name": "SMAN 1 Contoh",
      "province": "Jawa Barat",
      "city": "Bandung",
      "district": "Coblong",
      "educationLevel": "SMA",
      "statusSekolah": "Negeri",
      "alreadyAssigned": false,
      "assignedToCurrentSppg": false,
      "assignedSppgName": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

```http
POST /api/sppg/me/schools/assign
```

```json
{
  "dapodikSchoolIds": [1, 2],
  "notes": "Sekolah penerima area Bandung"
}
```

## Efek Ke Distribusi

Role SPPG hanya bisa membuat atau memindahkan distribusi ke sekolah yang punya assignment aktif untuk SPPG tersebut. Jika tidak assigned, backend mengembalikan `403 SCHOOL_NOT_ASSIGNED_TO_SPPG` dengan pesan jelas.

## Efek Ke Validasi Sekolah

Validasi sekolah tetap berbasis `school_id` operasional pada distribusi. Assignment digunakan untuk membatasi pembuatan distribusi oleh SPPG, bukan untuk menghapus histori distribusi lama.

## Risiko dan Fallback

- Jika ada data sekolah lama tanpa assignment, migration backfill dari `schools.sppg_id` menjaga kompatibilitas.
- Jika ada data Dapodik ganda atau kotor, service mencari operational school dari `school_dapodik_links`, lalu `npsn`, lalu `dapodik_school_id`.
- `schools.sppg_id` belum dihapus agar modul lama tetap aman sampai audit lanjutan.

## Verifikasi

- `npm.cmd --prefix Backend run prisma:generate`: PASS.
- `npm.cmd exec prisma migrate deploy` dari `Backend/`: PASS.
- `npm.cmd --prefix Backend test -- test/sppg-operational-flow.test.js`: PASS, 13 tests.
- `npm.cmd --prefix Frontend run lint`: PASS.
- `npm.cmd --prefix Frontend run build`: PASS dengan warning chunk-size Vite existing.
