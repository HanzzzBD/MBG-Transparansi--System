# Local Web Audit — MBG Transparency System

## Ringkasan
- Tanggal audit: 2026-05-22 21:47 WIB
- Frontend URL: `http://localhost:5173`
- Backend URL: `http://localhost:4000/api`
- Script yang dijalankan: backend `npm run dev`; frontend `npm run dev -- --host 127.0.0.1`
- Health check backend: `GET /api/health` 200.
- Akun diuji: `admin@mbg.go.id`, `gov@mbg.go.id`, `sppg@mbg.go.id`, `sekolah@mbg.go.id` dengan password `password`.
- Kesimpulan umum: aplikasi tidak blank dan mayoritas route render, tetapi masih banyak fallback/dummy. Hotfix 2026-05-22 sudah memperbaiki public report POST yang terkena auth, demo SPPG/Sekolah tanpa scope relasi, dan endpoint analytics trend/by-province/budget/anomaly yang sebelumnya 500.

## Fixed Issues

### Resolved Issues
| Issue | Status | File utama | Root cause | Fix singkat |
|---|---|---|---|---|
| Public report guest POST terkena 401 | Resolved | `Backend/src/modules/productionBatches/router.js`, `Backend/src/modules/reports/router.js` | `router.use(authenticate)` di production batch router terpasang tanpa prefix dan bocor ke route setelahnya, termasuk `/api/public-reports`. | Auth production batch dibatasi ke prefix `/production-batches` dan `/production-batch-items`; validation public report tetap aktif. |
| Demo SPPG/Sekolah tidak punya scope | Resolved | `Backend/src/scripts/seedDemoUsers.js` | Seed demo user selalu mengisi `sppgId`/`schoolId` null, sementara middleware scope membaca field tersebut dari user/JWT login. | Seed demo menghubungkan `sppg@mbg.go.id` ke `sppgId=1` dan `sekolah@mbg.go.id` ke `schoolId=1` memakai data SPPG/sekolah valid. |
| Analytics raw SQL `P2010` | Resolved | `Backend/src/modules/analytics/service.js` | `Prisma.join(conditions, Prisma.sql\` AND \`)` merender separator sebagai object sehingga SQL mengandung token invalid. | Separator query diganti string `" AND "`; value request tetap lewat parameterized Prisma SQL. |
| Summary/config endpoints 404/400 | Resolved | `Backend/src/modules/reports/router.js`, `Backend/src/modules/distributions/router.js`, `Backend/src/modules/compat/router.js`, `Backend/src/modules/analytics/router.js`, `Backend/prisma/seed.js` | Route static seperti `/summary` dan `/lock-summary` tertangkap route dinamis `/:id`; sebagian endpoint summary/config belum tersedia. | Route static diletakkan sebelum `/:id`; endpoint summary/config ditambahkan; `export_max_rows` disediakan lewat backend seed/config. |
| Frontend fallback dummy menutupi backend error | Resolved untuk halaman prioritas | `Frontend/src/pages/Dashboard.jsx`, `Analytics.jsx`, `Anggaran.jsx`, `AuditLog.jsx`, `ExportData.jsx`, `LaporanMasyarakat.jsx` | Setelah backend stabil, UI masih menyuntik data dummy saat API kosong/gagal. | Dummy fallback dihapus pada halaman prioritas; UI sekarang memakai loading, empty, dan error state. Retry export yang belum stabil tampil error, bukan simulasi sukses. |

### Endpoint Verification
Verifikasi dilakukan 2026-05-23 dengan backend lokal boot dari `node src/server.js` dan token admin untuk endpoint protected, kecuali public report.

| Method | Endpoint | Status | Catatan |
|---|---|---|---|
| POST | `/api/public-reports` | 200 | Guest tanpa Authorization berhasil mencapai public handler via honeypot anti-bot payload; bukan 401. Invalid guest payload tetap divalidasi. |
| GET | `/api/analytics/distributions` | 200 | Tidak ada `P2010`. |
| GET | `/api/analytics/success-rate` | 200 | Tidak ada `P2010`. |
| GET | `/api/analytics/budget` | 200 | Tidak ada `P2010`. |
| GET | `/api/analytics/by-province` | 200 | Tidak ada `P2010`. |
| GET | `/api/analytics/anomaly` | 200 | Tidak ada `P2010`. |
| GET | `/api/audit-logs/summary` | 200 | Summary audit log tersedia. |
| GET | `/api/system-configs/export_max_rows` | 200 | Config backend tersedia dari `system_configs`. |
| GET | `/api/public-reports/summary` | 200 | Tidak tertangkap `/:id`. |
| GET | `/api/analytics/public-reports-summary` | 200 | Aggregation laporan publik tersedia. |
| GET | `/api/analytics/public-reports-trend` | 200 | Trend laporan publik tersedia. |
| GET | `/api/analytics/public-reports-top-regions` | 200 | Top region laporan publik tersedia. |
| GET | `/api/distributions/lock-summary` | 200 | Tidak tertangkap `/:id`. |

### Demo Role Verification
| Role | Email | Login | Scope | API/dashboard verification |
|---|---|---|---|---|
| Admin | `admin@mbg.go.id` | 200 | `sppgId=null`, `schoolId=null` | Analytics, audit summary, config, report summary, lock summary endpoints 200. |
| Pemerintah | `gov@mbg.go.id` | 200 | `sppgId=null`, `schoolId=null` | `/api/analytics/summary` 200; role pemerintah bisa memakai dashboard nasional tanpa fallback total. |
| SPPG | `sppg@mbg.go.id` | 200 | `sppgId=1`, `schoolId=null` | `/api/distributions?limit=5` 200; tidak muncul `SPPG_SCOPE_MISSING`. |
| Sekolah | `sekolah@mbg.go.id` | 200 | `sppgId=null`, `schoolId=1` | `/api/validations?limit=5` 200; tidak muncul `SCHOOL_SCOPE_MISSING`. |
| Publik | Guest tanpa token | N/A | N/A | `POST /api/public-reports` public path 200 dengan honeypot anti-bot payload; endpoint tidak lagi dilindungi auth global. |

### Frontend Fallback Cleanup
| Halaman | Fallback dummy yang dihapus | State pengganti | Guard yang masih dipertahankan |
|---|---|---|---|
| Dashboard | KPI nasional dummy, chart distribusi/success, province ranking, anomaly/public report fallback, SPPG/Sekolah fallback rows. | Loading existing, angka 0/array kosong saat API kosong, error banner saat sebagian request gagal. | Derived KPI scoped masih memakai data API yang tersedia sampai endpoint summary scoped khusus dibuat. |
| Analytics | `FALLBACK_SUMMARY`, cost trend dummy, province rows dummy. | Empty text untuk chart costing/provinsi; error saat request gagal. | Tidak ada dummy fallback untuk endpoint stabil. |
| Anggaran | Province prices, spending, anomalies, thresholds, budget summary dummy. | Empty row/table/chart message; error toast untuk resolve/export gagal. | Threshold kosong menjadi 0 bila backend tidak mengirim data, bukan harga dummy. |
| AuditLog | Dummy rows `Ahmad Suryanto`/`Siti Nurhaliza` dan summary lokal. | Empty table row; summary 0 bila summary gagal; error state bila list gagal. | Detail modal tetap mempertahankan row yang sudah dimuat jika endpoint detail gagal. |
| Export | Fallback history, local preview export, fallback download, retry simulasi sukses. | Empty history; error toast bila generate/download/retry gagal. | Retry endpoint belum stabil; UI menampilkan error dan tidak mengubah status palsu. |
| LaporanMasyarakat | Fallback reports, category counts, trend 30 hari, top regions, update status lokal. | Empty table/chart/card counts 0; error state bila list/status update gagal. | Tidak ada dummy fallback untuk endpoint summary/trend/top-region yang sudah stabil. |

### Command Verification
| Area | Command | Result | Catatan |
|---|---|---|---|
| Backend dependency | `Test-Path Backend\node_modules` | Present | `npm install` tidak dijalankan karena dependency sudah lengkap. |
| Backend seed | `npm.cmd --prefix Backend run seed` | Success | Seed admin/config sukses; `export_max_rows=50000` tersedia. |
| Backend demo seed | `npm.cmd --prefix Backend run seed:demo-users` | Success | Demo admin/gov/SPPG/sekolah tersedia; `sppgId=1`, `schoolId=1`. |
| Backend test | `npm run test` | Skipped | Tidak ada script `test` di `Backend/package.json`. |
| Backend boot | `node src/server.js` dari folder `Backend` | Success | Health check `GET /api/health` 200. Ini target yang sama dengan script `npm run start`. Automasi `npm run start` dengan forced process cleanup tidak dipakai karena berisiko menghentikan proses Node lain di mesin lokal. |
| Frontend dependency | `Test-Path Frontend\node_modules` | Present | `npm install` tidak dijalankan karena dependency sudah lengkap. |
| Frontend lint | `npm.cmd --prefix Frontend run lint` | Success | ESLint selesai tanpa error. |
| Frontend build | `npm.cmd --prefix Frontend run build` | Success | Build sukses setelah `Frontend/dist` lama dibersihkan dengan permission eskalasi; sebelumnya gagal `EPERM unlink` karena artefak build lama tidak bisa dihapus dari sandbox. Warning chunk >1000 kB masih ada dan bukan regression hotfix. |

## Blocking Issues
| Severity | Lokasi | Masalah | Bukti | Rekomendasi |
|---|---|---|---|---|
| Critical - fixed 2026-05-22 | Backend `src/routes/index.js:56`, `src/modules/productionBatches/router.js:18`, `POST /api/public-reports` | Public report seharusnya publik, tetapi live endpoint mengembalikan 401 `AUTH_TOKEN_MISSING`. Root cause: `productionBatchRoutes` dipasang tanpa prefix dan punya `router.use(authenticate)`, sehingga middleware auth bocor ke router setelahnya termasuk reports. | Before fix: direct POST tanpa token ke `/api/public-reports` -> 401. After fix: auth di `productionBatches/router.js` di-scope ke `/production-batches` dan `/production-batch-items`; invalid guest POST -> 400 `VALIDATION_ERROR`. | Verified fixed. Protected route `GET /api/production-batches` tanpa token tetap 401 `AUTH_TOKEN_MISSING`. |
| High - fixed 2026-05-22 | Backend seed `src/scripts/seedDemoUsers.js` | Akun demo `sppg` dan `sekolah` login sukses tetapi `sppgId`/`schoolId` diset null. Root cause: seed demo user selalu meng-update `sppgId: null` dan `schoolId: null`, sementara auth response dan scope middleware sudah memakai field yang sama dari DB. | Before fix: `/api/distributions?...` -> 403 `SPPG_SCOPE_MISSING`; `/api/validations?...` -> 403 `SCHOOL_SCOPE_MISSING`. After fix + seed: `sppg@mbg.go.id` login memiliki `sppgId=1` dan `/api/distributions?limit=5` 200; `sekolah@mbg.go.id` login memiliki `schoolId=1` dan `/api/validations?limit=5` 200. | Verified fixed. Seed sekarang menghubungkan demo SPPG/Sekolah ke record SPPG/sekolah valid tanpa mengubah middleware scope. |
| High - fixed 2026-05-22 | Backend `src/modules/analytics/service.js` | Endpoint analytics raw SQL gagal `P2010`, Postgres syntax error near `"["`. Root cause: `Prisma.join(conditions, Prisma.sql\` AND \`)` merender separator sebagai `[object Object]` di SQL. | Before fix: `/api/analytics/distributions`, `/success-rate`, `/budget`, `/by-province`, `/anomaly` -> 500. After fix: semua endpoint tersebut 200 untuk query kosong dan filter `start_date/end_date/province`. | Verified fixed dengan mengganti separator join menjadi string `" AND "`; dynamic values tetap lewat parameterized Prisma SQL template. |

## Status Login & Role
| Role | Email | Login | Redirect | Catatan |
|---|---|---|---|---|
| Admin | `admin@mbg.go.id` | Berhasil, `POST /api/auth/login` 200 | `/dashboard` | Role diterima `admin`; auth persist setelah refresh. Endpoint analytics dashboard fixed 2026-05-22. |
| Pemerintah | `gov@mbg.go.id` | Berhasil, `POST /api/auth/login` 200 | `/dashboard` | Role diterima `pemerintah`; auth persist setelah refresh. |
| SPPG | `sppg@mbg.go.id` | Berhasil, `POST /api/auth/login` 200 | `/dashboard` | Fixed 2026-05-22: role diterima `sppg`, `sppgId=1`; `/api/distributions?limit=5` 200. |
| Sekolah | `sekolah@mbg.go.id` | Berhasil, `POST /api/auth/login` 200 | `/dashboard` | Fixed 2026-05-22: role diterima `sekolah`, `schoolId=1`; `/api/validations?limit=5` 200. |

Catatan rate limit: tidak ada 429 selama lima login valid yang diuji. Source membatasi login IP dan email 5 attempt per 15 menit di `Backend/src/middlewares/rateLimiter.js:105-118`, jadi audit berulang cepat mudah mentok.

## Status Route
| Route | Role yang boleh | Hasil | Masalah |
|---|---|---|---|
| `/` | Public | OK, tidak blank | KPI dan marker dari backend 200; submit laporan publik auth leak fixed 2026-05-22. |
| `/login` | Public | OK untuk guest; user login diarahkan ke `/dashboard` | Demo button hanya autofill. Ada teks TODO seed demo. |
| `/dashboard` | Semua authenticated | Render untuk semua role | Analytics raw SQL dan scope demo SPPG/Sekolah fixed 2026-05-22. Priority fallback cleanup fixed 2026-05-23: API kosong/gagal tidak lagi diganti dummy dashboard. |
| `/peta` | Semua authenticated | OK | Marker dari `/api/sppg?all=true...` 200. Detail panel masih memakai fallback menu/distribution sebagian. |
| `/distribusi` | SPPG | Frontend juga mengizinkan admin (`src/App.jsx:25`) | Admin bisa membuka route walau tidak ada di spec. Scope SPPG demo fixed 2026-05-22; endpoint sekolah/threshold role SPPG masih perlu follow-up. |
| `/production-batches` | SPPG | Frontend juga mengizinkan admin (`src/App.jsx:26`) | Role access lebih longgar dari spec. List batch 200 saat admin. |
| `/konfirmasi` | Sekolah | Frontend juga mengizinkan admin (`src/App.jsx:27`) | Scope sekolah demo fixed 2026-05-22; API validasi tidak lagi 403 `SCHOOL_SCOPE_MISSING`. |
| `/analytics` | Pemerintah/Admin | OK render | `/api/analytics/by-province` fixed 2026-05-22; fallback provinsi tidak lagi dipicu oleh P2010. |
| `/anggaran` | Pemerintah/Admin | OK render | `/api/analytics/budget` fixed 2026-05-22; fallback legacy tidak lagi dipicu oleh P2010. |
| `/anomaly` | Pemerintah/Admin | OK render | `/api/anomaly-logs` 200; fallback rows tetap ada bila API kosong/gagal. |
| `/audit-log` | Pemerintah/Admin | OK render | `/api/audit-logs/summary` fixed 2026-05-22; summary tidak lagi 404. |
| `/export` | Pemerintah/Admin | OK render | `/api/system-configs/export_max_rows` fixed 2026-05-22; pemerintah tidak perlu fallback ke endpoint admin. |
| `/laporan-masyarakat` | Pemerintah/Admin | OK render | Summary/trend/top region fixed 2026-05-22; endpoint target return 200. |
| `/users` | Admin | OK render | `/api/users` 200 via compat. Fallback user hardcoded masih ada bila API gagal. |
| `/lock-unlock` | Admin | OK render | `/api/distributions/lock-summary` fixed 2026-05-22; route statis tidak lagi tertangkap `/:id`. |
| `/override` | Admin | OK render | Data list/audit 200; history override masih fallback bila audit log tidak cocok marker override. |
| `/api-monitoring` | Admin | OK render | `/api/monitoring/summary` 200; tidak terlihat data SP2KP sync detail, hanya summary umum. |

## Data Dinamis vs Hardcoded
| Halaman | Data | Backend/Dummy | Endpoint | Catatan |
|---|---|---|---|---|
| Landing | KPI publik, marker SPPG | Backend aktif | `/api/analytics/summary`, `/api/public/sppg?limit=10` | Runtime 200. Fallback marker tetap ada di source. |
| Landing | Submit laporan masyarakat | Backend aktif | `POST /api/public-reports` | Auth leak fixed 2026-05-22; invalid guest payload sekarang mencapai validation. |
| Dashboard nasional | Summary/trend/chart | Backend aktif | `/api/analytics/summary`, `/api/analytics/distributions`, `/api/analytics/success-rate`, `/api/analytics/budget`, `/api/analytics/by-province`, `/api/analytics/anomaly` | Analytics P2010 fixed 2026-05-22; fallback dummy frontend removed 2026-05-23. |
| Dashboard SPPG/Sekolah | KPI role | Backend scope fixed | `/api/distributions`, `/api/validations`, `/api/school-reports` | Seed relasi demo fixed 2026-05-22; endpoint distributions/validations tidak lagi gagal scope untuk demo user. |
| Peta SPPG | Marker | Backend aktif | `/api/sppg?all=true...` | Detail menu/distribusi masih fallback sebagian. |
| Distribusi | List distribusi/batch | Backend saat admin | `/api/distributions`, `/api/production-batches` | Schools/threshold untuk role SPPG masih TODO/fallback. |
| Analytics | Province compare | Backend aktif | `/api/analytics/by-province` | Fixed 2026-05-22; endpoint 200 untuk query kosong dan filter tanggal/provinsi. |
| Audit Log | Summary | Backend aktif | `/api/audit-logs/summary` | Fixed 2026-05-22; return `totalToday`, `highSeverity`, `activeUsers`. |
| Export | Config max rows | Backend aktif | `/api/system-configs/export_max_rows` | Fixed 2026-05-22; config default `export_max_rows` dibuat di backend bila belum ada. |
| Laporan Masyarakat | Summary/trend/top regions | Backend aktif | `/api/public-reports/summary`, `/api/analytics/public-reports-*` | Fixed 2026-05-22; semua endpoint target 200. |

Detail hardcoded/fallback ada di `docs/local-web-audit-hardcoded-data.md`.

## Endpoint Audit
| Halaman | Method | Endpoint | Status | Catatan |
|---|---|---|---|---|
| Landing | GET | `/api/analytics/summary` | 200 | Dipakai untuk KPI publik. |
| Landing | GET | `/api/public/sppg?limit=10` | 200 | Dipakai untuk preview peta publik. |
| Landing | POST | `/api/public-reports` | Fixed: 400 validation for invalid guest payload | Sebelumnya 401; hotfix 2026-05-22 memastikan guest request mencapai validation tanpa melemahkan protected routes. |
| Dashboard | GET | `/api/analytics/distributions` | Fixed: 200 after raw SQL hotfix | Trend distribusi memakai backend; no P2010. |
| Dashboard | GET | `/api/analytics/success-rate` | Fixed: 200 after raw SQL hotfix | Trend success rate memakai backend; no P2010. |
| Dashboard | GET | `/api/analytics/budget` | Fixed: 200 after raw SQL hotfix | Budget memakai backend; no P2010. |
| Dashboard | GET | `/api/analytics/by-province` | Fixed: 200 after raw SQL hotfix | Ranking/compare memakai backend; no P2010. |
| Dashboard | GET | `/api/analytics/anomaly` | Fixed: 200 after raw SQL hotfix | Alert anomaly memakai backend; no P2010. |
| Peta | GET | `/api/sppg?all=true&page=1&limit=100...` | 200 | Marker halaman peta OK. |
| Konfirmasi | GET | `/api/validations?limit=100` | Fixed: 200 after seed | Demo sekolah sekarang memiliki `schoolId=1`; request validasi scoped tidak lagi 403. |
| Audit Log | GET | `/api/audit-logs/summary` | Fixed: 200 after summary hotfix | Summary audit log memakai backend. |
| Export | GET | `/api/system-configs/export_max_rows` | Fixed: 200 after summary hotfix | Config export max rows memakai backend. |
| Laporan Masyarakat | GET | `/api/public-reports/summary` | Fixed: 200 after summary hotfix | Summary laporan publik memakai backend. |
| Laporan Masyarakat | GET | `/api/analytics/public-reports-summary` | Fixed: 200 after summary hotfix | Summary analytics laporan publik memakai backend. |
| Laporan Masyarakat | GET | `/api/analytics/public-reports-trend` | Fixed: 200 after summary hotfix | Chart trend laporan publik memakai backend. |
| Laporan Masyarakat | GET | `/api/analytics/public-reports-top-regions` | Fixed: 200 after summary hotfix | Top region laporan publik memakai backend. |
| Lock/Unlock | GET | `/api/distributions/lock-summary` | Fixed: 200 after summary hotfix | Route statis dipasang sebelum `/:id`. |

Detail endpoint lengkap ada di `docs/local-web-audit-endpoints.md`.

## Missing Features
| Prioritas | Halaman | Fitur belum ada | Dampak | Rekomendasi |
|---|---|---|---|---|
| P0 - fixed 2026-05-22 | Landing | Public report submit tanpa auth | Sebelumnya publik tidak bisa membuat laporan karena 401. | Remaining follow-up: verifikasi CAPTCHA valid/invalid dengan provider/secret valid. |
| P0 - fixed 2026-05-22 | Demo auth | Relasi `sppgId`/`schoolId` untuk demo user | Sebelumnya role SPPG/Sekolah login tapi flow utama 403. Setelah seed hotfix, `sppgId`/`schoolId` valid dan endpoint scoped 200. | Remaining follow-up: uji dashboard browser untuk data empty/real state setelah analytics issue diperbaiki. |
| P1 - fixed 2026-05-23 | Dashboard/Analytics | Endpoint analytics trend/by-province/budget/anomaly stabil dan fallback frontend prioritas dibersihkan | Sebelumnya chart utama fallback dan console error 500. Setelah hotfix semua endpoint target 200 dan UI memakai empty/error state. | Remaining follow-up: tambah endpoint summary scoped khusus SPPG/Sekolah bila diperlukan. |
| P1 - fixed 2026-05-22 | Audit Log | Endpoint summary audit | Sebelumnya KPI audit log fallback. | Remaining follow-up: validasi browser full page setelah cleanup fallback frontend. |
| P1 - fixed 2026-05-22 | Laporan Masyarakat | Summary/trend/top-region reports | Sebelumnya dashboard laporan masyarakat dummy/fallback. | Remaining follow-up: formalisasi kolom follow-up/status lanjutan bila dibutuhkan. |
| P1 - partial fixed 2026-05-23 | Export | Public/user-readable system config dan retry export | Config `export_max_rows` fixed; fallback history/preview/simulasi retry sudah dihapus. Retry endpoint masih belum tersedia/stabil sehingga UI menampilkan error. | Tambah `POST /api/exports/:id/retry` pada PR terpisah. |

Detail missing features ada di `docs/local-web-audit-missing-features.md`.

## Bugs / Errors
| Severity | Lokasi | Error | Cara reproduksi | Saran fix |
|---|---|---|---|---|
| Critical - fixed 2026-05-22 | `POST /api/public-reports` | Sebelumnya 401 `AUTH_TOKEN_MISSING`; sekarang invalid guest payload mencapai validation dan mengembalikan 400 `VALIDATION_ERROR` | Guest submit/direct POST laporan publik | Fixed by scoping production batch auth middleware to production batch routes only. |
| High - fixed 2026-05-22 | Dashboard/Analytics | Sebelumnya 500 `P2010`, syntax error near `[`; sekarang endpoint target 200 | Login admin/gov, buka `/dashboard` atau `/analytics`; direct hit endpoint analytics | Fixed by using string separator in `Prisma.join` SQL where builders. |
| High - fixed 2026-05-22 | Demo SPPG/Sekolah | Sebelumnya 403 `SPPG_SCOPE_MISSING` / `SCHOOL_SCOPE_MISSING`; setelah seed hotfix endpoint scoped 200 | Login SPPG/Sekolah, akses `/api/distributions` dan `/api/validations` | Fixed by linking demo users to valid backend SPPG/school records in seed. |
| Medium - fixed 2026-05-22 | Audit Log | Sebelumnya 404 `/api/audit-logs/summary`; sekarang 200 | Buka `/audit-log` atau direct hit endpoint | Fixed by adding top-level compat summary endpoint. |
| Medium - fixed 2026-05-22 | Export | Sebelumnya 404 `/api/system-configs/export_max_rows`; sekarang 200 | Buka `/export` atau direct hit endpoint dengan role pemerintah/admin | Fixed by adding read-only export config endpoint backed by `system_configs`. |
| Medium - fixed 2026-05-22 | Laporan Masyarakat | Sebelumnya 400/404 summary analytics; sekarang endpoint target 200 | Buka `/laporan-masyarakat` atau direct hit endpoints | Fixed by adding public report summary/trend/top-region endpoints and placing `/public-reports/summary` before `/:id`. |
| Low | Console | Recharts width/height `-1` warning | Buka dashboard | Beri min-height/min-width pada container chart. |
| Low | Console | React duplicate key warning | Buka dashboard sekolah/konfirmasi | Pastikan key row chart/list unik. |

## Responsive Issues
| Viewport | Halaman | Masalah | Saran fix |
|---|---|---|---|
| 412x915 | Semua route utama | Tidak ditemukan horizontal overflow aktual. Off-canvas sidebar terdeteksi keluar viewport tapi itu expected state tertutup. | Tidak perlu fix untuk temuan ini; tetap uji manual saat modal dibuka. |
| 768x1024 | Semua route utama | Tidak ditemukan overflow aktual pada pass otomatis. | Uji ulang setelah data backend real lebih banyak. |
| Desktop | Semua route utama | Tidak ditemukan blank/overflow. | Perbaiki warning chart agar render stabil. |

## Rekomendasi PR Lanjutan
- PR A: Done 2026-05-22 hotfix - scoped production batch auth middleware so `POST /api/public-reports` is public again while production batch routes stay protected.
- PR B: Done 2026-05-22 hotfix - seed valid `sppgId` and `schoolId` for demo SPPG/Sekolah users.
- PR C: Done 2026-05-22 hotfix - fix analytics raw SQL `Prisma.join` separator causing `P2010`.
- PR D: Done 2026-05-23 hotfix - replace priority Dashboard/Analytics/Anggaran/AuditLog/Export/LaporanMasyarakat fallback dummy data with loading, empty, and error states.
- PR E: Done 2026-05-22 hotfix - add report aggregation endpoints for `/laporan-masyarakat`.
- PR F: Done 2026-05-22 hotfix - add audit log summary and lock summary endpoints.
- PR G: Partial done 2026-05-22 hotfix - add read-only `export_max_rows`; retry export remains separate.
- PR H: Align frontend route access with product spec for admin access to SPPG/Sekolah-only pages.

## Hotfix Verification 2026-05-23 - Priority Fallback Cleanup
Frontend cleanup after summary/config/analytics endpoints became stable:

| Check | Result |
|---|---|
| Scope | Only priority pages were changed: Dashboard, Analytics, Anggaran, AuditLog, Export, LaporanMasyarakat. |
| Removed fallback | Dummy dashboard KPIs/charts, analytics cost/province rows, budget/anomaly rows, audit log names, export history/preview generation, and public report reports/category/trend/top-region fallbacks were removed. |
| Retained outside scope | Fallbacks on non-priority pages such as Landing, Distribusi, Konfirmasi, Peta, User Management, Lock/Unlock, Override, Anomaly, and API Monitoring remain documented for later PRs. |
| Source check | `rg` over the six priority pages found no `FALLBACK`, `fallback`, `dummy`, `preview`, `simulat`, `Ahmad Suryanto`, `Siti Nurhaliza`, `Laporan_Distribusi`, `94.7`, `2.847`, `18.432`, or `API parsial`. |
| Lint/build check | `npm.cmd --prefix Frontend run lint` succeeded. `npm.cmd --prefix Frontend run build` succeeded after old `Frontend/dist` build output was removed with escalated permission. Earlier sandbox build failed with Windows `EPERM unlink` on the old dist assets. |

## Public SPPG Detail

### Konsep Akses
- "Umum" bukan role login; siapapun yang tidak login diperlakukan sebagai publik.
- Semua fitur publik tersedia langsung di landing page tanpa autentikasi.

### Routing Logic
- Tidak login -> `/peta-publik` (no auth required).
- Login sebagai admin / SPPG / sekolah / gov/pemerintah -> `/peta` (auth required).

### Public Endpoint
GET `/api/public/sppg/:id`

### Field yang Diekspos
- `id`, `name`, `province`, `city`, `district`.
- `status`, `capacity`, `todayPortions`, `successRate`.
- `todayMenu` (`name` + `nutrition`: `calories`, `protein`, `carbohydrate`, `fat`).
- `recentDistributions` (`schoolName`, `portions`, `status`, `date`) max 5 entri.

### Field yang Disembunyikan
- Phone/email PIC, `userId`, user account, audit log, anomaly log.
- Raw material cost, operational cost, internal notes, internal report.
- Lock state, override history, private file token/path.
- School validation detail dan exact budget.

### Alasan Keamanan
Data sensitif operasional tidak relevan untuk transparansi publik dan berpotensi disalahgunakan jika diakses tanpa autentikasi.

### Verifikasi Implementasi Lokal
- Landing memakai endpoint marker publik `GET /api/public/sppg?limit=10` dan tombol "Lihat Peta Lengkap" mengarah ke `/peta-publik` untuk guest.
- Route `/peta-publik` dibuat di frontend tanpa `ProtectedRoute`.
- Klik marker di `/peta-publik` melakukan lazy fetch ke `GET /api/public/sppg/:id`.
- Jika detail gagal dimuat, UI menampilkan pesan `Detail SPPG tidak tersedia`.
- Route internal `/peta` dan komponen `PetaSPPG` tidak diubah untuk fitur ini.

# Fixed In Phase 3

## Hardcoded yang Sudah Dihapus
- Dashboard, Export Data, Lock/Unlock, dan Peta SPPG tidak lagi memakai daftar provinsi hardcoded.
- Export Data tidak lagi menghitung estimasi row/file size dari angka frontend (`baseRows`, `estimatedRows`, dan estimasi MB dihapus dari payload/UI).
- Audit ulang 11 halaman target tidak menemukan lagi string `94.7`, `2.847`, `fake`, `dummy`, `PROVINCES`, `baseRows`, atau `estimatedRows`.

## Endpoint yang Sekarang Real
- Dashboard role summary: `/api/dashboard/admin-summary`, `/api/dashboard/gov-summary`, `/api/dashboard/sppg-summary`, `/api/dashboard/school-summary`.
- Public report analytics: `/api/public-reports/summary`, `/api/analytics/public-reports-summary`, `/api/analytics/public-reports-trend`, `/api/analytics/public-reports-top-regions`.
- Export: `/api/exports`, `/api/exports/:id`, `/api/exports/:id/retry`, `/api/exports/:id/download`.
- Monitoring: `/api/monitoring/summary`, `/api/monitoring/apis`, `/api/monitoring/errors`, `/api/monitoring/sync-sources`.
- Audit: `/api/audit-logs`, `/api/audit-logs/summary`.
- User/role association: `/api/users`, `/api/roles`, `/api/sppg`, `/api/schools`.
- Lock/override: `/api/distributions/:id/lock`, `/api/distributions/:id/unlock`, `/api/distributions/:id/override`.
- SPPG map: `/api/sppg/map-markers`, `/api/sppg/:id/detail`.

## Halaman yang Sudah Fully Dynamic
- Dashboard memakai summary backend sesuai role login.
- Analytics memakai backend summary/trend/top-region untuk laporan publik dan analytics utama.
- Anggaran memakai backend budget/price/anomaly data tanpa row dummy.
- Export Data memakai history, retry, download, progress/status, row count, dan file size dari backend.
- Audit Log memakai pagination, filter, severity/category summary dari backend.
- Laporan Masyarakat memakai list, summary cards, trend, top wilayah, dan status count dari backend.
- User Management memakai CRUD backend dan autocomplete relasi SPPG/sekolah bertahap dari server.
- Lock/Unlock dan Override memakai API backend sebagai source utama.
- API Monitoring memakai summary/API/error/sync source dari backend.
- Peta SPPG memakai marker backend dan lazy fetch detail dari `/api/sppg/:id/detail`.

## Fallback yang Masih Tersisa
- Loading/skeleton/spinner saat request berjalan.
- Empty state saat backend mengembalikan array kosong.
- Error/retry state saat API gagal sementara.
- Progress bar export masih boleh bergerak secara UI ketika status backend `processing`; status akhir tetap dari backend.
- Route-level Suspense fallback `Memuat halaman...` untuk page chunk lazy.

## Unresolved Issues
- Perlu verifikasi browser manual lanjutan untuk warning layout Recharts pada container yang sangat kecil.
- Role option di User Management tetap memakai label domain statis untuk rendering teks, sedangkan data user/role tetap dari backend.
- Filter provinsi Dashboard/Export/Lock sekarang input teks agar tidak memakai dummy list; endpoint wilayah terpusat bisa ditambahkan nanti jika dibutuhkan autocomplete wilayah.

## Verifikasi Phase 3 - 2026-05-25
- Frontend lint sukses: `npm.cmd --prefix Frontend run lint`.
- Frontend build sukses: `npm.cmd --prefix Frontend run build`.
- Backend boot sukses di port verifikasi `4011`; `/api/health` 200.
- Smoke endpoint kritikal read/detail 200: dashboard per role, SPPG map marker/detail, monitoring summary/apis/errors/sync-sources, exports list, audit logs list/summary, public reports list/summary, public reports analytics summary/trend/top regions, users list, distributions list, lock summary, production batches list.
- Tidak ditemukan 404/500 pada endpoint kritikal yang diverifikasi.

| Halaman | Dynamic % | Remaining Dummy | Status |
|---|---:|---|---|
| Dashboard | 100% | Tidak ada row/stat dummy; hanya empty/error/loading state | Done |
| Analytics | 100% | Tidak ada chart/stat dummy | Done |
| Anggaran | 100% | Tidak ada budget/anomaly dummy | Done |
| ExportData | 100% | Tidak ada fake history/row estimate; progress UI sementara saat processing | Done |
| AuditLog | 100% | Tidak ada fake audit log | Done |
| LaporanMasyarakat | 100% | Tidak ada fake report statistics | Done |
| UserManagement | 100% | Tidak ada fake user rows | Done |
| LockUnlock | 100% | Tidak ada local-only lock rows | Done |
| OverrideData | 100% | Tidak ada local-only override rows | Done |
| ApiMonitoring | 100% | Tidak ada fake uptime/sync records | Done |
| PetaSPPG | 100% | Tidak ada hardcoded marker/detail/menu/distribusi | Done |
