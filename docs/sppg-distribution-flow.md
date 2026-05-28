# SPPG Menu dan Distribusi

## Model Akses

Sistem tetap memakai role `sppg`. Pembagian operator dan supervisor dilakukan lewat permission/grant, bukan role baru.

Default role `sppg` = operator:
- `daily_menu.view`
- `daily_menu.create`
- `daily_menu.update`
- `distribution.view`
- `distribution.create`
- `issue.view`

Tambahan grant untuk supervisor:
- `daily_menu.price.validate`
- `daily_menu.price.override`
- `distribution.mark_sent`

Seed `Backend/prisma/seed.js` menjaga default `sppg` sebagai operator. Permission supervisor harus diberikan sebagai `user_permissions` ALLOW per user.

## Alur Menu Harian

Endpoint:
- `GET /api/menus` memakai `daily_menu.view`
- `POST /api/menus` memakai `daily_menu.create`
- `PUT /api/menus/:id` memakai `daily_menu.update`
- `POST /api/menus/:id/price-validation` memakai `daily_menu.price.validate`

Field menu harian:
- `menuDate`
- `menuName`
- `items`
- `photoFileId`
- `manualPricePerPortion`
- `priceValidationStatus`
- `priceValidationNotes`
- `priceValidatedAt`
- `priceValidatedBy`

Menu baru selalu dibuat dengan `priceValidationStatus = PENDING_REVIEW`.

Supervisor dapat menyimpan validasi:
- `VERIFIED` jika harga sesuai
- `MISMATCH` jika harga tidak sesuai

Status `MISMATCH` wajib memakai `notes`.

## Alur Distribusi

Endpoint:
- `GET /api/distributions` memakai `distribution.view`
- `POST /api/distributions` memakai `distribution.create`
- `POST /api/distributions/:id/mark-sent` memakai `distribution.mark_sent`

Distribusi dibuat dari menu harian dengan field utama:
- `menuId`
- `schoolId`
- `portions`
- `pricePerPortion`
- `distributionDate`

Backend menghitung total dari `portions * pricePerPortion` lewat field virtual/response yang sudah ada.

Status awal distribusi dari input SPPG adalah `pending` jika payload tidak mengirim status.

Supervisor hanya dapat menandai terkirim jika:
- user memiliki `distribution.mark_sent`
- distribusi punya `menuId`
- `menu.priceValidationStatus = VERIFIED`

Saat terkirim:
- `status = sent`
- `sentAt` diisi
- distribusi dikunci
- audit log ditulis

## Laporan Masalah

Endpoint:
- `GET /api/school-reports` memakai `issue.view`
- `POST /api/school-reports` memakai `distribution.report_issue`

Role SPPG hanya melihat laporan sekolah yang terkait dengan `sppgId` miliknya melalui scope backend.

## Frontend

Halaman SPPG:
- `Frontend/src/pages/SppgMenu.jsx`
- `Frontend/src/pages/Distribusi.jsx`
- `Frontend/src/pages/SppgIssues.jsx`

Frontend memakai `can(permissionKey)` dari effective permissions `/api/me/permissions`.

UI hanya menyembunyikan atau men-disable tombol. Keamanan tetap berada di backend lewat `requirePermission`.

## Checklist Uji

1. Login SPPG operator.
2. Buat menu harian dengan item, foto, dan harga manual.
3. Pastikan status menu `PENDING_REVIEW`.
4. Login/beri grant supervisor ke user SPPG.
5. Validasi harga menu menjadi `VERIFIED`.
6. Buat distribusi dari menu tersebut.
7. Tandai distribusi terkirim.
8. Pastikan status distribusi menjadi `sent` dan `sentAt` terisi.
9. Login sekolah, laporkan masalah pada distribusi.
10. Login SPPG, pastikan laporan muncul di halaman laporan masalah SPPG.
