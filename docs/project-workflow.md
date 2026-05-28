# Project Workflow

## 1. Gambaran Besar Sistem

MBGTransparansiSystem adalah aplikasi monitoring distribusi Makan Bergizi Gratis. Frontend React/Vite berkomunikasi dengan backend Express/Prisma/PostgreSQL melalui REST API di `/api`. Sistem memuat data SPPG, sekolah, distribusi, validasi penerimaan, laporan kendala, laporan masyarakat, anggaran/costing, anomali, audit log, export, dan permission/grant.

## 2. Aktor/Role

| Role | Fungsi utama |
| --- | --- |
| Public/guest | Melihat landing, statistik publik, peta publik, dan mengirim laporan masyarakat. |
| admin | Mengelola master data, user, permission, audit, export, monitoring, anggaran, dan override/lock. |
| pemerintah/gov | Monitoring wilayah, analytics, anggaran, anomaly, audit, export. Umumnya read-only. |
| sppg | Mengelola operasional SPPG: menu, sekolah saluran, distribusi, production batch, kendala, profil. |
| sekolah | Konfirmasi distribusi, validasi porsi/kualitas, laporan sekolah, riwayat, profil. |
| umum | Ada di enum, tetapi belum terlihat sebagai workflow utama internal. |

## 3. Alur Public User

1. Pengguna membuka landing page `/`.
2. Frontend mengambil ringkasan dari `/api/public/statistics`.
3. Pengguna membuka peta publik `/peta-publik`.
4. Frontend mengambil marker aman dari `/api/public/sppg`.
5. Detail publik SPPG memakai `/api/public/sppg/:id`.
6. Pengguna mengirim laporan masyarakat melalui `/api/public-reports`.
7. Admin/pemerintah melihat laporan di `/laporan-masyarakat`.

Catatan: public map hanya boleh menerima data aman seperti id, nama SPPG, koordinat, status operasional, dan info ringkas.

## 4. Alur Admin

1. Admin login.
2. Dashboard memuat analytics, notifikasi, dan search global.
3. Admin memantau peta internal `/peta` dari `/api/sppg/map-markers`.
4. Admin melihat analytics dan anggaran.
5. Admin mengelola laporan masyarakat, anomaly, audit log, export.
6. Admin mengelola master SPPG/sekolah, Dapodik, user, grant/deny permission.
7. Admin mengelola lock/unlock dan override distribusi.
8. Admin melihat API monitoring.
9. Admin dapat mengubah status operasional SPPG.

## 5. Alur SPPG

1. SPPG login dan melihat dashboard sesuai scope SPPG.
2. SPPG melihat sekolah saluran miliknya.
3. SPPG dapat assign sekolah Dapodik ke channel SPPG jika permission tersedia.
4. SPPG membuat menu harian dan distribusi.
5. SPPG mengelola production batch/costing jika tersedia.
6. SPPG melaporkan kendala internal.
7. Jika kendala kritis dibuat, rekomendasi sistem yang sudah diterapkan adalah SPPG otomatis menjadi `problem`; kembali ke `active` perlu admin/resolve issue sesuai flow.
8. SPPG hanya boleh melihat data scope SPPG sendiri.

## 6. Alur Sekolah

1. Sekolah login.
2. Sekolah melihat distribusi yang terkait sekolahnya.
3. Sekolah melakukan konfirmasi/validasi penerimaan.
4. Jika porsi/kualitas bermasalah, sekolah membuat laporan sekolah.
5. Status validasi dan laporan masuk ke backend dan dapat dipantau pihak terkait.
6. Sekolah hanya boleh melihat data sekolahnya sendiri.

## 7. Alur Pemerintah/Gov

1. Pemerintah login.
2. Melihat dashboard monitoring, peta, analytics, anggaran, laporan, anomaly, audit log, export.
3. Akses user management, monitoring admin teknis, dan master mutation ditolak.
4. Role ini seharusnya tetap monitoring/read-only kecuali ada permission khusus.

## 8. Alur Dapodik ke Sekolah

1. Admin membuka `/dapodik`.
2. Admin import file/payload Dapodik ke staging `dapodik_schools`.
3. Admin melakukan promote/link ke `schools`.
4. SPPG dapat mencari staged school untuk assignment ke SPPG lewat endpoint scoped.
5. School yang sudah terhubung menjadi bagian dari alur distribusi.

## 9. Relasi SPPG dan Sekolah

SPPG memiliki banyak sekolah melalui relasi langsung dan/atau assignment channel. Distribusi harus memakai sekolah yang aktif dan terkait dengan SPPG. Guard backend sudah dites ulang: payload invalid memakai 400, scope/assignment forbidden memakai 403, dan business precondition seperti menu belum verified memakai 409.

## 10. Alur Distribusi MBG

1. SPPG membuat menu.
2. SPPG membuat distribusi ke sekolah terkait.
3. Distribusi bergerak dari draft/pending/in progress/sent/delivered/failed.
4. Admin dapat lock/unlock data.
5. Override hanya untuk koreksi admin dan masuk audit log.
6. Sekolah melakukan validasi penerimaan.

## 11. Alur Konfirmasi Penerimaan

1. Sekolah membuka `/validasi`.
2. Sekolah mengonfirmasi porsi dan kualitas.
3. Jika valid, status menjadi verified.
4. Jika mismatch, status conflict/issue_reported dan anomaly/laporan dapat dibuat.

## 12. Alur Laporan Masalah

Ada dua jalur:

1. Laporan sekolah terkait distribusi lewat `/school-reports`.
2. Kendala internal SPPG lewat `/issues`.

Issue kritis seperti kekurangan bahan/peralatan dapat memicu status SPPG `problem`. Pemulihan ke `active` harus terkendali.

## 13. Alur Laporan Masyarakat

Public mengisi form laporan di landing. Backend menyimpan sebagai public report. Admin/pemerintah melihat daftar, trend, top region, dan status tindak lanjut.

## 14. Alur Anggaran dan Costing

1. `/anggaran` mengambil ProductionBatch costing dari `/analytics/budget-summary`.
2. Jika ProductionBatch kosong, halaman memakai fallback realisasi distribusi legacy dari `/analytics/budget`.
3. BGN indicator config berasal dari system configs.
4. SP2KP/province threshold dari `/analytics/price-per-province`.
5. ProductionBatch memiliki rawMaterialCost, operationalCost, packagingCost, distributionCost, rentCost, totalCost, costPerPortion.
6. Saat data batch kosong, status costing BGN ditampilkan belum tersedia, bukan angka palsu.
7. Untuk QA non-production, `npm run seed:qa` membuat batch lengkap dengan `rentCost`, item bahan pangan, distribusi, validasi, dan anomaly bahan pangan.

## 15. Alur Deteksi Anomaly

Anomaly berasal dari `AnomalyLog`, termasuk `PRICE_ANOMALY`, `RAW_MATERIAL_PRICE_ANOMALY`, validation conflict, over capacity, dan timeout. Halaman `/anomaly` dan `/anggaran` membaca `/api/anomaly-logs`. Resolve harus memakai PATCH `/api/anomaly-logs/:id/resolve`.

## 16. Alur Audit Log

Mutasi penting seperti create/update/delete/restore, lock/unlock, login/logout, permission, status SPPG, dan issue kritis dicatat ke audit log. Admin/pemerintah melihatnya melalui `/audit-log`.

## 17. Alur Permission/Grant

Permission default disimpan pada role permission. Admin dapat memberi ALLOW/DENY override ke user. Backend middleware `requirePermission` menjadi guard utama. Frontend menu mengikuti permission efektif dari `/api/me/permissions`, tetapi backend tetap wajib menjadi sumber enforcement.

## 18. Data Flow

Frontend route -> service API helper -> backend router/controller/service -> Prisma model -> PostgreSQL. Untuk upload, frontend mengirim file ke `/api/files`, backend menyimpan file ke storage lokal `Backend/storage` dan metadata ke tabel `files`; URL `/storage/...` dirender dari origin backend. Untuk export, frontend membuat job `/api/exports`, backend processor menghasilkan file PDF/XLSX dan riwayat export.

## 19. Endpoint Penting

| Area | Endpoint |
| --- | --- |
| Public | `/api/public/statistics`, `/api/public/budget`, `/api/public/sppg`, `/api/public/sppg/:id`, `/api/public-reports` |
| Auth | `/api/auth/login`, `/api/auth/session`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| SPPG | `/api/sppg`, `/api/sppg/map-markers`, `/api/sppg/:id/status`, `/api/sppg/me/schools` |
| School | `/api/schools`, `/api/validations`, `/api/school-reports` |
| Distribution | `/api/distributions`, `/api/distributions/:id`, lock/unlock/override compat routes |
| Budget | `/api/analytics/budget-summary`, `/api/analytics/budget`, `/api/analytics/price-per-province` |
| Costing | `/api/production-batches`, `/api/production-batches/:id/cost-summary` |
| Anomaly | `/api/anomaly-logs`, `/api/anomaly-logs/:id/resolve` |
| Export | `/api/exports`, `/api/exports/:id/download`, `/api/exports/:id/retry` |
| Admin | `/api/users`, `/api/roles`, `/api/permissions`, `/api/audit-logs`, `/api/monitoring/*` |
| QA local | `/api/qa/reset-login-rate-limit` hanya di non-production |

## 20. Risiko Sistem

| Risk | Impact |
| --- | --- |
| Final security negative tests | Sudah ditambahkan untuk upload invalid, XSS input, dan search injection; pertahankan sebagai deployment gate. |
| Production infra belum diverifikasi penuh | CORS domain, storage, backup, logging, HTTPS, reverse proxy perlu checklist deployment. |
| Email delivery reset password belum dikonfigurasi produksi | Flow token reset sudah tersedia, tetapi production harus punya SMTP/email provider agar link reset benar-benar terkirim ke user. |
| Bundle frontend besar | Warning Vite sebelumnya sudah hilang lewat lazy route splitting; tetap pantau saat fitur bertambah. |

## 21. Rekomendasi Sebelum Deployment

1. Backend/frontend tests sudah hijau; pertahankan sebagai gate sebelum deploy.
2. `/api/sppg` sudah internal-auth only; public tetap memakai `/api/public/sppg`.
3. Jalankan `npm run seed:qa` hanya di local/staging non-production saat butuh data QA lengkap.
4. Pastikan `VITE_SHOW_DEMO_LOGIN=false` dan `VITE_ENABLE_SETTINGS_PAGE=false` untuk production sampai fitur settings real siap.
5. Pertahankan negative security tests untuk XSS, SQL injection search, dan upload sebagai gate.
6. Finalisasi domain/CORS/storage/backup/logging sebelum cutover production.
