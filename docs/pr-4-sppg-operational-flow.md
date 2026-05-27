# PR 4 - SPPG Operational Flow

## Masalah Awal

- `Frontend/src/pages/Distribusi.jsx` masih menampilkan fallback rows yang terlihat seperti data sekolah/distribusi nyata.
- Role SPPG belum punya endpoint khusus untuk membaca sekolah tujuan miliknya.
- Role SPPG belum punya endpoint read-only untuk threshold harga wilayahnya.
- Route SDD `/input-menu`, `/laporan-kendala`, `/riwayat`, dan `/profil` belum tersedia sebagai route valid.

## File Yang Diubah

- `Backend/src/modules/sppg/router.js`
- `Backend/src/modules/sppg/controller.js`
- `Backend/src/modules/sppg/service.js`
- `Backend/src/modules/sppg/validation.js`
- `Backend/src/modules/priceThresholds/router.js`
- `Backend/src/modules/priceThresholds/controller.js`
- `Backend/src/modules/priceThresholds/service.js`
- `Backend/src/modules/priceThresholds/validation.js`
- `Backend/test/sppg-operational-flow.test.js`
- `Frontend/src/App.jsx`
- `Frontend/src/layouts/DashboardLayout.jsx`
- `Frontend/src/pages/Distribusi.jsx`
- `Frontend/src/pages/Distribusi.css`
- `Frontend/src/pages/SppgMenu.jsx`
- `Frontend/src/pages/SppgIssues.jsx`
- `Frontend/src/pages/SppgHistory.jsx`
- `Frontend/src/pages/SppgProfile.jsx`
- `Frontend/src/pages/SppgOperational.css`
- `Frontend/src/services/api.js`
- `Frontend/test/sppg-operational-flow.test.js`

## Fallback Yang Dihapus

- `FALLBACK_SCHOOLS`
- `FALLBACK_DISTRIBUTIONS`
- `FALLBACK_CAPACITY`
- `FALLBACK_PRICE_THRESHOLD`
- Branch `import.meta.env.DEV` yang membuat distribusi/upload sukses secara lokal saat API gagal
- Skip API untuk ID `fallback-*`

Jika backend kosong, halaman menampilkan empty state seperti `Belum ada data distribusi dari backend`. Jika API gagal, halaman menampilkan error state dan tidak menyisipkan data palsu.

## Endpoint Baru / Permission Baru

### `GET /api/sppg/me/schools`

- Auth: wajib login.
- Role: `sppg`.
- Scope: hanya sekolah dengan `sppgId` milik user login.
- Response aman:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Nama Sekolah",
      "province": "Jawa Barat",
      "city": "Bandung",
      "district": null,
      "address": null,
      "npsn": "123",
      "totalStudents": 250,
      "total_students": 250
    }
  ],
  "meta": {}
}
```

### `GET /api/price-thresholds/my-region`

- Auth: wajib login.
- Role: `sppg`.
- Scope: threshold berdasarkan provinsi SPPG milik user login.
- Read-only. SPPG tetap tidak bisa menjalankan mutation threshold seperti `POST /api/price-thresholds/generate-from-food-prices`.
- Response tidak mengekspos `updatedByUser`, email updater, atau metadata internal user.
- Jika threshold belum tersedia, response `data: null` dan `meta.reason: "THRESHOLD_NOT_AVAILABLE"`.

## Route SPPG Yang Ditambahkan

- `/input-menu`: form dan riwayat menu harian memakai `GET /api/menus` dan `POST /api/menus`.
- `/laporan-kendala`: form dan riwayat kendala memakai `GET /api/issues` dan `POST /api/issues`.
- `/riwayat`: ringkasan riwayat distribusi/menu/kendala memakai endpoint backend.
- `/profil`: profil SPPG milik akun login memakai `GET /api/sppg/:id`.

Legacy sidebar path SPPG juga diarahkan eksplisit:

- `/dashboard/menu-harian` -> `/input-menu`
- `/dashboard/kendala` -> `/laporan-kendala`
- `/dashboard/riwayat-distribusi` -> `/riwayat`
- `/dashboard/profil-sppg` -> `/profil`

## Cara Test Manual

1. Login sebagai role `sppg`.
2. Buka `/distribusi`.
3. Pastikan saat API distribusi kosong, tidak muncul sekolah/distribusi contoh.
4. Buka tab tambah distribusi, pastikan daftar sekolah berasal dari sekolah yang terhubung ke SPPG login.
5. Buka `/input-menu`, submit menu harian, lalu lihat menu masuk ke riwayat.
6. Buka `/laporan-kendala`, submit kendala, lalu lihat kendala masuk ke riwayat.
7. Buka `/riwayat` dan `/profil`, pastikan route tidak 404.
8. Login role non-SPPG dan akses `/input-menu`, `/laporan-kendala`, `/riwayat`, `/profil`; harus ditolak oleh protected route.
9. Direct API:
   - Tanpa token ke `/api/sppg/me/schools` harus 401.
   - Role sekolah/admin ke `/api/sppg/me/schools` harus 403.
   - Role SPPG ke `POST /api/price-thresholds/generate-from-food-prices` harus 403.

## Test Otomatis

- Backend: `cmd /c npm test -- test/sppg-operational-flow.test.js`
- Frontend: `cmd /c npm test -- test/sppg-operational-flow.test.js`

Coverage test:

- No token pada endpoint operasional SPPG -> 401.
- SPPG hanya melihat sekolah tujuan miliknya.
- Search sekolah milik SPPG lain tidak bocor.
- Non-SPPG ditolak dari endpoint sekolah tujuan.
- SPPG bisa membaca threshold wilayahnya.
- SPPG tidak bisa mutate threshold.
- Fallback rows di `Distribusi.jsx` sudah hilang.
- Route SDD SPPG sudah terdaftar dan SPPG-scoped.

## Gap / Risiko Tersisa

- `GET /api/menus` masih endpoint list publik lama; halaman SPPG selalu memanggilnya dengan `sppgId` user login, tetapi hardening backend untuk list menu scoped/authenticated bisa menjadi PR lanjutan.
- `/profil` memakai endpoint internal lama `GET /api/sppg/:id`; halaman hanya memanggil ID dari auth user, tetapi ownership guard khusus endpoint detail SPPG bisa diperketat di PR security berikutnya jika diperlukan.
