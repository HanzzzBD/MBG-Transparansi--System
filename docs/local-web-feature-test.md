# Local Web Feature Test Report

# Re-Audit Update

- Tanggal re-audit: 2026-05-26, Asia/Jakarta.
- Branch/commit: `main` / `af846d8` dengan worktree berisi perubahan PR 1.1 sampai PR 6 yang belum semuanya committed.
- Frontend URL terverifikasi dari config: `http://localhost:5173` (`Frontend/.env`, Vite default).
- Backend URL terverifikasi dari config: `http://localhost:4000/api` (`Backend/.env` `PORT=4000`, `Frontend/.env` `VITE_API_URL`).
- Sumber kebenaran: dokumen lama ini, codebase saat ini, test frontend/backend, endpoint lokal, dan browser smoke via Playwright.
- Ringkasan terbaru: mayoritas gap lama sudah selesai. Security session sudah memory-only, public statistik/budget sudah ada, fallback dummy Landing/Distribusi/Konfirmasi sudah dihapus, route SDD SPPG/sekolah sudah tersedia, search/notifikasi sudah real backend, dan master CRUD admin sudah ada. Sisa utama adalah coverage audit yang belum lengkap untuk semua entity/action, public report submit dengan CAPTCHA asli masih blocked, dan warning Recharts pada browser dashboard.
- Update relasi SPPG-Sekolah: flow baru memakai `sppg_school_assignments`; SPPG mencari sekolah dari `dapodik_schools` di `/sekolah-saluran`, melakukan assign/unassign tanpa dropdown ribuan data, dan distribusi SPPG hanya bisa dibuat ke sekolah saluran aktif.
- Total status item re-audit: DONE/PASS 40, PARTIAL 5, FAIL 0, BLOCKED 2.
- Catatan dokumen: section lama di bawah tetap dipertahankan sebagai baseline 2026-05-25. Tabel re-audit ini menjadi status terkini untuk setiap temuan/gap utama lama.

| Item | Area | Old Status | Current Status | Evidence | Notes |
|---|---|---|---|---|---|
| Access token tidak disimpan di localStorage/sessionStorage | PR 1.1 Security | FAIL | DONE | `Frontend/src/store/authStore.js` hanya Zustand memory state; `Frontend/test/auth-session.test.js` PASS `does not persist access token or user to browser storage after login` | Legacy keys dibersihkan saat login/logout/session check. |
| Tidak ada `mbg-auth-storage` token persist | PR 1.1 Security | FAIL | DONE | `Frontend/src/store/authStore.js` `clearLegacySession`; `rg` hanya menemukan cleanup/test | Tidak ada Zustand persist auth. |
| `mbg.user` bukan sumber role/permission | PR 1.1 Security | FAIL | DONE | `Frontend/test/auth-session.test.js` PASS `does not read localStorage/sessionStorage as role or permission source` | Role berasal dari memory auth hasil backend session/login. |
| `mbg.user` tidak membuat user dianggap login saat memory auth kosong | PR 1.1 Security | FAIL | DONE | `Frontend/test/auth-session.test.js` PASS `does not authenticate from stale mbg.user when memory auth is empty` | `isAuthenticated` butuh `user` dan `token` memory. |
| Protected route memakai memory auth + refresh backend | PR 1.1 Security | PARTIAL | DONE | `Frontend/src/App.jsx` `restoreSession()` memanggil `/auth/session`; `ProtectedRoute` butuh `isAuthenticated && user && token` | Reload dapat memulihkan session dari refresh cookie. |
| Refresh token HttpOnly cookie | PR 1.1 Security | PASS/PARTIAL | DONE | `Backend/src/utils/auth.js` `httpOnly: true`; `Backend/test/security-role-guard.test.js` PASS refresh cookie/hash test | Refresh token DB di-hash SHA-256. |
| Logout membersihkan memory auth dan legacy storage | PR 1.1 Security | PARTIAL | DONE | `Frontend/src/store/authStore.js` `logout()`; `Frontend/src/App.jsx` `handleLogout()` memanggil `/auth/logout` lalu `logout()` | Backend juga clear refresh cookie. |
| `apiRequest` auto refresh saat 401 | PR 1.1 Security | PARTIAL | DONE | `Frontend/src/services/api.js` `apiRequest()` retry sekali setelah `refreshAccessToken()` | Menghindari loop dengan `skipRefresh`. |
| `apiBlobRequest` auto refresh saat 401 lalu retry download sekali | PR 1.1 Security | MISSING | DONE | `Frontend/src/services/api.js` `apiBlobRequest()`; `Frontend/test/auth-session.test.js` PASS 4 blob refresh tests | Download export tetap pakai token memory aktif. |
| Regression IDOR distributions/validations/school reports | PR 1.1 Security | MISSING | DONE | `Backend/test/security-role-guard.test.js` PASS distribution, validation, school-report ownership tests | Backend test suite 33/33 PASS. |
| Landing `FALLBACK_SUMMARY` dihapus | PR 2 Public | FAIL | DONE | `rg` tidak menemukan `FALLBACK_SUMMARY`; `Frontend/test/public-feature.test.js` PASS | KPI failure sekarang error/empty, bukan angka palsu. |
| Landing `FALLBACK_MARKERS` dihapus | PR 2 Public | FAIL | DONE | `rg` tidak menemukan `FALLBACK_MARKERS`; `Frontend/test/public-feature.test.js` PASS | Marker kosong menampilkan empty state backend. |
| Angka dummy `2847`, `18432`, `94.7`, `23` hilang | PR 2 Public | FAIL | DONE | `Frontend/test/public-feature.test.js` PASS regex anti dummy | Tidak ditemukan di `Landing.jsx`. |
| API landing gagal menampilkan error/empty, bukan fake data | PR 2 Public | FAIL | DONE | `Frontend/src/pages/Landing.jsx` state `summary.error`, `mapData.error`, `mapData.empty`; test public feature PASS | Masih ada `PROVINCES` hardcoded untuk form, tetapi bukan KPI/marker real-looking. |
| Route `/statistik` publik tersedia | PR 2 Public | FAIL | PASS | `Frontend/src/App.jsx` route `/statistik`; Playwright `http://localhost:5173/statistik` 200 | Tidak redirect ke `/`. |
| Public statistik tanpa login | PR 2 Public | FAIL | PASS | `Backend/src/modules/public/router.js` `/statistics`; `Backend/test/public-feature.test.js` PASS | Endpoint `GET /api/public/statistics` local smoke 200. |
| Public budget/transparansi anggaran tersedia | PR 2 Public | FAIL | PASS | `Frontend/src/App.jsx` `/anggaran-publik`; `Frontend/src/pages/PublicStatistik.jsx`; `Backend/src/modules/public/router.js` `/budget` | Endpoint `GET /api/public/budget` local smoke 200. |
| Public budget tidak mengekspos sensitive fields | PR 2 Public | MISSING | PASS | `Backend/test/public-feature.test.js` PASS sensitive-key scan | Test memeriksa `phone`, `email`, token, audit/internal keys. |
| Navbar Statistik dan Anggaran tidak broken | PR 2 Public | PARTIAL | PASS | `Landing.jsx` link `/statistik`; `PublicStatistik.jsx` section `#anggaran-publik`; Playwright `/statistik` 200 | Public budget disatukan di halaman statistik publik. |
| Global search topbar punya handler | PR 3 Dashboard | FAIL | PASS | `Frontend/src/layouts/DashboardLayout.jsx` state/search dropdown; `Frontend/test/dashboard-polish.test.js` PASS | Ada clear, loading, empty, error states. |
| Search terhubung ke backend dan role scoped | PR 3 Dashboard | FAIL | PASS | `Frontend/src/services/api.js` `getGlobalSearch`; `Backend/src/modules/search`; `Backend/test/dashboard-polish.test.js` PASS role leak tests | Endpoint `/api/search` 401/403/200 sesuai role. |
| Notification dropdown real backend | PR 3 Dashboard | FAIL | PASS | `Frontend/src/layouts/DashboardLayout.jsx` fetch notifications; `Backend/src/modules/notifications`; `Backend/test/dashboard-polish.test.js` PASS | Static fake notification copy hilang. |
| Notification empty state jujur | PR 3 Dashboard | FAIL | PASS | `DashboardLayout.jsx` renders empty state when `notificationState.items.length === 0` | Tidak ada pesan statis terlihat sebagai event real. |
| React Router future warnings | PR 3 Dashboard | LOW | PASS | `Frontend/src/App.jsx` `BrowserRouter future={{ v7_relativeSplatPath, v7_startTransition }}`; frontend test PASS | Playwright `/statistik` 0 warnings. Dashboard masih punya warning Recharts, bukan React Router. |
| Distribusi fallback dummy dihapus | PR 4 SPPG | FAIL | DONE | `Frontend/src/pages/Distribusi.jsx`; `Frontend/test/sppg-operational-flow.test.js` PASS anti fallback | Empty/error state menggantikan fallback rows. |
| Endpoint sekolah tujuan role SPPG tersedia dan scoped | PR 4 SPPG | MISSING | PASS | `Backend/src/modules/sppg/router.js` `/me/schools`; `Backend/test/sppg-operational-flow.test.js` PASS own school/search leak tests | Non-SPPG 403. |
| SPPG memilih sekolah saluran dari Dapodik | PR 4 SPPG | MISSING | PASS | `Backend/src/modules/sppg/router.js` `/me/dapodik-schools`, `/me/schools/assign`; `Frontend/src/pages/SppgSchools.jsx`; backend test PASS | Search async paginated, bukan dropdown ribuan sekolah. |
| Distribusi dibatasi ke sekolah saluran aktif | PR 4 SPPG | PARTIAL | PASS | `Backend/src/modules/distributions/service.js` `ensureActiveSchoolAssignment`; backend test PASS `SCHOOL_NOT_ASSIGNED_TO_SPPG` | Admin route tetap tidak membuka akses SPPG lain lewat self-service. |
| SPPG read-only threshold wilayahnya | PR 4 SPPG | MISSING | PASS | `Backend/src/modules/priceThresholds/router.js` `/my-region` authorize `sppg`; backend test PASS | Mutasi threshold SPPG 403. |
| Route SDD SPPG `/input-menu`, `/laporan-kendala`, `/riwayat`, `/profil` | PR 4 SPPG | FAIL | PASS | `Frontend/src/App.jsx`; `Frontend/test/sppg-operational-flow.test.js` PASS | Legacy dashboard routes redirect eksplisit. |
| Input menu harian | PR 4 SPPG | PARTIAL | PASS | `Frontend/src/pages/SppgMenu.jsx`; API helpers `createMenu`, `getMenus`; backend `/menus` existed | Frontend route `/input-menu` sekarang ada. |
| Lapor kendala operasional | PR 4 SPPG | PARTIAL | PASS | `Frontend/src/pages/SppgIssues.jsx`; API helpers `getIssues`, `createIssue` | Route `/laporan-kendala` role SPPG. |
| Upload bukti foto/update distribusi | PR 4 SPPG | PARTIAL | PASS | `Frontend/src/pages/Distribusi.jsx` `uploadFile()` `/files/upload`, `updateDistribution()`; `Backend/src/modules/files`, distributions service | File upload tetap guarded SPPG/admin. |
| Konfirmasi fallback pending/history dihapus | PR 5 School | FAIL | DONE | `Frontend/src/pages/Konfirmasi.jsx`; `Frontend/test/school-validation-flow.test.js` PASS anti fallback | Empty state: `Belum ada distribusi...`, `Belum ada riwayat...`. |
| Route sekolah `/validasi`, `/laporan-sekolah`, `/riwayat`, `/profil` | PR 5 School | FAIL | PASS | `Frontend/src/App.jsx`; `Frontend/test/school-validation-flow.test.js` PASS | `/konfirmasi` redirect ke `/validasi`. |
| Sekolah hanya melihat/validasi miliknya | PR 5 School | PARTIAL | PASS | `Backend/src/modules/validations/service.js`; `Backend/test/school-validation-flow.e2e.test.js` PASS | Other school read/update 403. |
| Flow verified dan conflict berjalan | PR 5 School | PARTIAL | PASS | `Backend/test/school-validation-flow.e2e.test.js` PASS verified/conflict | Conflict membuat `VALIDATION_CONFLICT`. |
| Browser E2E verified/conflict isolated | PR 5 School | MISSING | PARTIAL | Backend isolated E2E ada: `Backend/test/school-validation-flow.e2e.test.js`; frontend source tests ada | Belum ada browser Playwright E2E flow klik UI dengan data isolated. |
| UI master CRUD SPPG admin | PR 6 Admin | PARTIAL | PASS | `Frontend/src/pages/AdminSppg.jsx`; `Frontend/src/App.jsx` `/admin/sppg`; backend router create/update/delete/restore | UI create/edit/soft delete/restore tersedia. |
| UI master CRUD Schools admin | PR 6 Admin | PARTIAL | PASS | `Frontend/src/pages/AdminSchools.jsx`; `Frontend/src/App.jsx` `/admin/schools`; backend router create/update/delete/restore | UI create/edit/soft delete/restore tersedia. |
| School pilih SPPG pakai searchable async select/pagination | PR 6 Admin | MISSING | PASS | `AdminSchools.jsx` debounced `getSppg({ search, limit: RELATION_LIMIT })` | Bukan dropdown ribuan data. |
| Restore SPPG/Schools/User admin only | PR 6 Admin | MISSING | PARTIAL | SPPG/Schools restore UI/API ada; `Backend/src/modules/users/router.js` has `/users/:id/restore` | User restore backend ada, tetapi UI restore user tidak diverifikasi di `UserManagement.jsx` pada re-audit ini. |
| Restore masuk audit log | PR 6 Audit | MISSING | PARTIAL | `sppg/service.js`, `schools/service.js` write audit `auditAction: RESTORE`; PR6 test covers SPPG restore | School/user restore audit service ada, tetapi automated test hanya membuktikan SPPG restore. |
| E2E export PDF/XLSX | PR 6 Export | MISSING | PASS | `Backend/test/pr6-gov-admin-analytics-export-audit.test.js` PASS PDF `%PDF` dan XLSX `PK` download | Admin/pemerintah allowed; SPPG/sekolah 403. |
| Audit log old_data/new_data create/update/delete/restore/lock/unlock | PR 6 Audit | PARTIAL | PARTIAL | PR6 test covers SPPG create/update/delete/restore and distribution lock/unlock; service covers schools too | Belum ada test eksplisit untuk school create/update/delete/restore, user restore, dan override old/new pada PR6 test. |
| Audit log tidak bisa dihapus | PR 6 Audit | PASS | PASS | `Backend/src/modules/auditLogs/router.js` no DELETE; PR6 test `DELETE /api/audit-logs` 404 | Delete route tidak tersedia. |
| Public report submit dengan CAPTCHA valid | Old Missing Feature | BLOCKED | BLOCKED | `Landing.jsx` Turnstile/reCAPTCHA integration; old audit notes CAPTCHA provider needed | Tidak diuji karena butuh token provider valid; invalid/honeypot flow sudah ada. |
| Browser local web smoke public/backend | Test | BLOCKED/PARTIAL | PASS | `GET /api/health` 200; `GET /api/public/statistics` 200; `GET /api/public/budget` 200; Playwright `/statistik` 200 | Local frontend/backend aktif dan public route utama tampil. |
| Guest protected-route browser fresh context | Test | BLOCKED/PARTIAL | BLOCKED | Playwright `/dashboard` memakai refresh cookie yang masih valid di browser session | Kode/test route guard PASS, tetapi browser smoke guest redirect perlu fresh context/cookie clear. |
| Dashboard browser console warnings | PR 3/UX | LOW | PARTIAL | Playwright `/dashboard`: 0 errors, 6 warnings from Recharts width/height -1 | React Router warning hilang; Recharts layout warning masih perlu polish. |

## Re-Audit Test Commands

| Command/check | Result | Notes |
|---|---|---|
| `cmd /c npm --prefix Frontend test` | PASS | 19 tests, 7 suites, 0 fail. |
| `cmd /c npm --prefix Frontend run build` | PASS with warning | Build sukses; Vite chunk warning `index` > 1000 kB. |
| `cmd /c npm --prefix Backend test` | PASS with warning | 33 tests, 6 suites, 0 fail; pg deprecation warning muncul pada beberapa tests. |
| `Invoke-WebRequest http://localhost:4000/api/health` | PASS 200 | Backend local aktif. |
| `Invoke-WebRequest http://localhost:4000/api/public/statistics` | PASS 200 | Public statistics endpoint tanpa login. |
| `Invoke-WebRequest http://localhost:4000/api/public/budget` | PASS 200 | Public budget endpoint tanpa login. |
| Playwright `http://localhost:5173/statistik` | PASS 200 | Route publik tampil, 0 console errors/warnings pada snapshot itu. |
| Playwright `http://localhost:5173/dashboard` | PARTIAL | Dashboard tampil dengan refresh cookie yang masih valid; 0 errors, 6 Recharts warnings. |

## 1. Ringkasan

- Tanggal test: 2026-05-25, Asia/Jakarta.
- Sumber kebenaran: `C:\Users\Lenovo\Downloads\MBG_SDD_v1_5_Vite (1).pdf`, 44 halaman, tertulis SDD Version 1.2.
- Frontend URL aktif: `http://localhost:5173`.
- Backend URL aktif: `http://localhost:4000/api`.
- Konfigurasi frontend: `Frontend/.env` memakai `VITE_API_URL=http://localhost:4000/api`.
- Konfigurasi backend: `Backend/.env` memakai PostgreSQL lokal database `mbg_transparency`, port `4000`; secret value tidak dicatat di laporan.
- Stack: Vite + React 18 + React Router + Zustand + Recharts + Leaflet; Express 5 + Prisma 7 + PostgreSQL + JWT + bcrypt + Helmet + CORS + express-rate-limit + Multer.
- Akun test dari README/seed: `admin@mbg.go.id`, `gov@mbg.go.id`, `sppg@mbg.go.id`, `sekolah@mbg.go.id`.
- Kesimpulan umum: sekitar 78% requirement SDD sudah terpenuhi atau partial. Backend RBAC, public SPPG safe detail, dashboard summary, monitoring, audit, export, costing, lock/override, dan public report analytics sudah banyak real. Gap terbesar masih di frontend fallback dummy pada Landing/Distribusi/Konfirmasi, beberapa route SDD belum ada, statistik publik belum punya route, global search/topbar notification belum backend-driven, dan akses token masih dipersist di localStorage.

## 2. Checklist SDD

| Area | Requirement SDD | Status | Evidence | Catatan |
|---|---|---|---|---|
| Stack | Vite + React frontend, Express/Prisma/PostgreSQL backend | PASS | `Frontend/package.json`, `Backend/package.json`, `Backend/prisma/schema.prisma` | Sesuai arah SDD. |
| RBAC role | `umum`, `sppg`, `sekolah`, `pemerintah`, `admin` | PASS | `Backend/prisma/schema.prisma` enum `UserRole`; API login semua role 200 sebelum rate limit aktif | Role ada dan dipakai middleware. |
| Landing navbar | Logo, Beranda, Peta SPPG, Statistik, Laporan, Login | PARTIAL | Playwright snapshot `.playwright-mcp/page-2026-05-25T08-11-38-631Z.yml` | Link `Statistik` menuju `/statistik`, tapi route tidak ada dan redirect ke `/`. |
| Landing mini dashboard | 4 KPI public dari API real | PARTIAL | `GET /api/analytics/summary` 200; `Frontend/src/pages/Landing.jsx:42-47`, `:335` | API real ada, tetapi fallback KPI dummy masih bisa tampil saat API gagal. |
| Landing map preview | Marker publik, CTA `Lihat Peta Lengkap` | PARTIAL | Screenshot `landing-desktop-phase-audit.png`; click CTA ke `/peta-publik` PASS | Marker API ada, tetapi `FALLBACK_MARKERS` masih ada. |
| Landing mobile | Hamburger/drawer | PASS | Screenshot `landing-mobile-menu-phase-audit.png` | Drawer mobile terbuka. |
| Public access | Public tanpa login | PASS | `/` dan `/peta-publik` Playwright tanpa login | Tidak kena login wall. |
| Public map | Marker dari API, filter/search/status | PASS | `/api/public/sppg?limit=3` 200; screenshot `public-map-desktop-phase-audit.png` | Filter provinsi/status/search muncul dan data marker dari endpoint publik. |
| Public SPPG detail | Hanya field aman | PASS | `GET /api/public/sppg/:id` 200; serializer `Backend/src/modules/public/serializer.js` | Tidak mengekspos phone/email/PIC/internal cost/token/audit. |
| Auth login/logout | Login semua role, logout ada | PASS | API login 4 role 200; `Backend/src/modules/auth/service.js`, `DashboardLayout.jsx` logout | Login rate limit aktif setelah banyak attempt otomatis. |
| Protected route frontend | Guest ditolak | PASS | Navigasi `/dashboard` guest redirect ke `/login`; screenshot `protected-redirect-login-phase-audit.png` | Frontend route guard bekerja. |
| Backend role guard | Direct API forbidden salah role | PASS | `/api/users` SPPG 403, `/api/exports` SPPG 403, `/api/monitoring/summary` pemerintah 403 pada smoke awal | RBAC bukan hanya hide UI. |
| Dashboard layout | Sidebar, topbar, breadcrumb, search, notif, avatar, logout | PARTIAL | `Frontend/src/layouts/DashboardLayout.jsx:242-362` | Elemen ada; search belum ada handler, notification list masih statis. |
| Dashboard KPI/chart | Backend source utama | PASS | `/api/dashboard/*-summary` semua role 200 | Tidak ditemukan dummy pada `Dashboard.jsx`. |
| SPPG operation | Input distribusi, status, proof upload, own data | PARTIAL | `/api/distributions` SPPG 200; `/api/files/upload` role SPPG/admin; `Distribusi.jsx` | Backend ada, tetapi frontend masih fallback schools/distributions/threshold. |
| SPPG menu harian | Input menu/gizi, unique per tanggal | PARTIAL | `/api/menus` POST validation 400 untuk body kosong; Prisma unique `(sppgId, menuDate)` | Backend ada; route SDD `/input-menu` tidak ada, menu tidak menjadi halaman terpisah. |
| Sekolah validation | Konfirmasi, validasi porsi/kualitas, own data | PARTIAL | `/api/validations` sekolah 200; `validations/service.js` ownership check | Backend ada; `Konfirmasi.jsx` masih inject fallback pending/history. |
| Pemerintah analytics | Dashboard detail, wilayah, budget, anomaly, reports, export, audit | PASS | `/api/analytics/budget`, `/api/analytics/anomaly`, `/api/public-reports`, `/api/exports`, `/api/audit-logs` 200 | Gov routes dan endpoints utama tersedia. |
| Admin | Users, audit, lock/override, monitoring | PASS | `/api/users`, `/api/monitoring/summary`, `/api/distributions/lock-summary` 200 | CRUD SPPG/school backend ada; UI master SPPG/school belum menjadi halaman khusus. |
| CRUD SPPG & schools | Admin full CRUD master | PARTIAL | `Backend/src/modules/sppg/router.js`, `schools/router.js` | Backend CRUD ada. Route UI khusus master SPPG/school tidak terlihat di `App.jsx`. |
| Distribusi auto validation | Validasi pending dibuat saat distribusi dibuat | PASS | `Backend/src/modules/distributions/service.js:510` | Service membuat row validation pending. |
| Conflict validation | Porsi beda menjadi conflict/anomaly | PASS | `Backend/src/modules/validations/service.js:225-231` | `VALIDATION_CONFLICT` dibuat saat porsi berbeda. |
| Auto-lock delivered/verified/timeout | Lock service + cron | PASS | `distributions/service.js`, `notifications/runtime.js` | Delivered dan cron auto-lock terlihat. |
| Public reports | Form tanpa login, kategori, 20 char, honeypot, CAPTCHA, rate limit | PARTIAL | `POST /api/public-reports` invalid 400; honeypot 200; `reports/validation.js` | Real create dengan CAPTCHA valid tidak diuji karena butuh provider token asli. |
| School reports | Sekolah create/list, gov/admin list | PASS | `/api/school-reports?limit=3` sekolah 200; `reports/service.js` ownership | Scope sekolah diterapkan. |
| Anggaran & costing | Harga porsi, cumulative cost, anomaly price, no fake | PASS | `/api/analytics/budget`, `/api/food-prices`, `/api/price-thresholds`, `/api/production-batches` 200 | Backend real; frontend Anggaran tidak terdeteksi fallback dummy pada audit target sebelumnya. |
| Anomaly detection | OVER_CAPACITY, PRICE_ANOMALY, VALIDATION_CONFLICT, PENDING_TIMEOUT | PASS | `Backend/prisma/schema.prisma` enum; `utils/anomaly.js`; `notifications/runtime.js` | Tambahan `RAW_MATERIAL_PRICE_ANOMALY` juga ada. |
| Audit log | Login/logout, CRUD, lock/unlock, old/new data | PASS | `/api/audit-logs` 200; `utils/auditLog.js`; service createAuditLog calls | Endpoint delete audit log tidak ditemukan. |
| Lock/unlock | Admin only, reason, audit | PASS | `/api/distributions/:id/lock` SPPG 403; validation reason min length | Backend guarded. |
| Export | Admin/pemerintah only, PDF/Excel, history/retry/download | PASS | `/api/exports` admin 200; SPPG 403; validation empty POST 400 | Flow real tersimpan, status backend source utama. |
| File upload | MIME/size metadata file | PASS | `files/upload.js`, `files/router.js` | JPEG/PNG/WEBP, max 5MB, role SPPG/admin. |
| Security | Rate limit, bcrypt 12, CORS whitelist, hashed refresh token | PARTIAL | `rateLimiter.js`, `utils/auth.js`, `config/cors.js` | Access token masih dipersist localStorage di frontend, tidak sesuai SDD memory-only. |

## 3. Role Permission Matrix Result

| Fitur | Umum | SPPG | Sekolah | Pemerintah | Admin | Catatan |
|---|---|---|---|---|---|---|
| Landing public | PASS | PASS | PASS | PASS | PASS | Route `/` public. |
| Peta public/full | PASS `/peta-publik` | PASS `/peta` | PASS `/peta` | PASS `/peta` | PASS `/peta` | Public dan internal dipisah. |
| Detail SPPG menu/gizi | PASS safe detail | PASS internal detail | PASS internal detail | PASS internal detail | PASS internal detail | Public serializer aman. |
| Transparansi anggaran | PARTIAL public route khusus tidak ada | FAIL | FAIL | PASS | PASS | SDD memberi akses umum, tetapi frontend anggaran protected pemerintah/admin. |
| Statistik performa | PARTIAL `/statistik` missing | PASS dashboard scoped | PASS dashboard scoped | PASS analytics | PASS analytics | Navbar statistik broken. |
| Kirim laporan publik | PARTIAL | N/A | N/A | N/A | N/A | Form public ada, CAPTCHA valid tidak diuji. |
| Input menu/porsi | FAIL | PARTIAL | FAIL | FAIL | PASS | Backend ada; route SDD `/input-menu` tidak ada. |
| Update distribusi | FAIL | PARTIAL | FAIL | FAIL | PASS | Backend SPPG/admin, frontend fallback. |
| Upload bukti foto | FAIL | PARTIAL | PARTIAL | FAIL | PASS | File API SPPG/admin; sekolah upload bukti penerimaan di UI but API proof upload role SPPG/admin. |
| Lapor kendala operasional | FAIL | PASS | FAIL | READ | PASS | `/api/issues` SPPG/admin create; gov/admin read. |
| Konfirmasi/validasi sekolah | FAIL | FAIL | PARTIAL | FAIL | PASS | Backend school/admin; frontend fallback. |
| Laporan sekolah | FAIL | FAIL | PASS | PASS read | PASS | Endpoint guarded. |
| Laporan masyarakat full | FAIL | FAIL | FAIL | PASS | PASS | Protected API. |
| Analytics/compare | FAIL | FAIL | FAIL | PASS | PASS | Backend guarded. |
| Export | FAIL | FAIL | FAIL | PASS | PASS | Backend guarded. |
| Audit log | FAIL | FAIL | FAIL | PASS | PASS | SPPG direct API 403. |
| Manage users | FAIL | FAIL | FAIL | FAIL | PASS | `/api/users` admin only. |
| Lock/unlock/override | FAIL | FAIL | FAIL | FAIL | PASS | Direct SPPG lock 403. |
| API monitoring | FAIL | FAIL | FAIL | FAIL | PASS | Pemerintah 403. |

## 4. Endpoint Test Result

| Method | Endpoint | Role | Expected | Actual | Status |
|---|---|---|---:|---:|---|
| POST | `/api/auth/login` | admin | 200 | 200 | PASS |
| POST | `/api/auth/login` | pemerintah | 200 | 200 | PASS |
| POST | `/api/auth/login` | sppg | 200 | 200 | PASS |
| POST | `/api/auth/login` | sekolah | 200 | 200 | PASS |
| GET | `/api/health` | umum | 200 | 200 | PASS |
| GET | `/api/analytics/summary` | umum | 200 | 200 | PASS |
| GET | `/api/public/sppg?limit=3` | umum | 200 | 200 | PASS |
| GET | `/api/public/sppg/:id` | umum | 200 | 200 | PASS |
| GET | `/api/public/sppg/999999999` | umum | 404 | 404 | PASS |
| POST | `/api/public-reports` missing CAPTCHA/short message | umum | 400 | 400 | PASS |
| POST | `/api/public-reports` honeypot filled | umum | 200 | 200 | PASS |
| GET | `/api/dashboard/admin-summary` | admin | 200 | 200 | PASS |
| GET | `/api/dashboard/gov-summary` | pemerintah | 200 | 200 | PASS |
| GET | `/api/dashboard/sppg-summary` | sppg | 200 | 200 | PASS |
| GET | `/api/dashboard/school-summary` | sekolah | 200 | 200 | PASS |
| GET | `/api/sppg/map-markers` | admin | 200 | 200 | PASS |
| GET | `/api/sppg/:id/detail` | admin | 200 | 200 | PASS |
| GET | `/api/distributions?limit=3` | admin | 200 | 200 | PASS |
| GET | `/api/distributions?limit=3` | sppg | 200 | 200 | PASS |
| GET | `/api/distributions?limit=3` | sekolah | 200 | 200 | PASS |
| GET | `/api/validations?limit=3` | sekolah | 200 | 200 | PASS |
| GET | `/api/school-reports?limit=3` | sekolah | 200 | 200 | PASS |
| GET | `/api/public-reports?page=1&limit=3` | admin | 200 | 200 | PASS |
| GET | `/api/analytics/budget` | pemerintah | 200 | 200 | PASS |
| GET | `/api/analytics/anomaly` | pemerintah | 200 | 200 | PASS |
| GET | `/api/food-prices?limit=3` | pemerintah | 200 | 200 | PASS |
| GET | `/api/price-thresholds?limit=3` | pemerintah | 200 | 200 | PASS |
| GET | `/api/audit-logs?page=1&limit=3` | admin | 200 | 200 | PASS |
| GET | `/api/exports?page=1&limit=3` | admin | 200 | 200 | PASS |
| GET | `/api/monitoring/summary` | admin | 200 | 200 | PASS |
| GET | `/api/users?page=1&limit=3` | admin | 200 | 200 | PASS |
| GET | `/api/production-batches?limit=3` | sppg | 200 | 200 | PASS |
| GET | `/api/users` | no token | 401 | 401 | PASS |
| GET | `/api/users` | sppg | 403 | 403 | PASS |
| GET | `/api/exports` | sppg | 403 | 403 | PASS |
| GET | `/api/audit-logs` | sppg | 403 | 403 | PASS |
| GET | `/api/monitoring/summary` | pemerintah | 403 | 403 | PASS |
| PATCH | `/api/distributions/1/lock` | sppg | 403 | 403 | PASS |
| POST | `/api/distributions` empty body | sppg | 400 | 400 | PASS |
| POST | `/api/menus` empty body | sppg | 400 | 400 | PASS |
| POST | `/api/exports` empty body | admin | 400 | 400 | PASS |
| GET | `/api/sppg/999999999/detail` | admin | 404 | 404 | PASS |
| GET | `/api/exports/999999999` | admin | 404 | 404 | PASS |
| GET | `/api/distributions?search=' OR 1=1 --` | admin | not 500 | 200 | PASS |

Catatan: setelah beberapa kali automated login, `POST /api/auth/login` mengembalikan 429. Ini membuktikan login rate limit aktif, tetapi membatasi pengujian login UI lanjutan sampai window rate limit selesai.

## 5. UI Route Test Result

| Route | Role | Expected | Actual | Status |
|---|---|---|---|---|
| `/` | umum | Landing public tampil | Tampil, console 0 error 2 warning React Router future flag | PASS |
| `/peta-publik` | umum | Public map tampil tanpa login | Tampil dengan summary, filter, map, side detail empty state | PASS |
| klik `Lihat Peta Lengkap` | umum | Arah ke `/peta-publik` | URL menjadi `/peta-publik` | PASS |
| mobile `/` 390x844 | umum | Hamburger/drawer bekerja | Drawer menu mobile terbuka | PASS |
| `/dashboard` | umum | Redirect `/login` | URL menjadi `/login` | PASS |
| `/statistik` | umum | Statistik publik atau section statistik | Redirect ke `/` karena route tidak ada | FAIL |
| `/login` | umum | Login form tampil | Tampil setelah protected redirect | PASS |
| Authenticated dashboard routes | admin/gov/sppg/sekolah | Render sesuai role | API login dan backend role tested; UI login ulang blocked oleh rate limit setelah automated tests | BLOCKED |

Evidence screenshot:
- `landing-desktop-phase-audit.png`
- `public-map-desktop-phase-audit.png`
- `landing-mobile-menu-phase-audit.png`
- `protected-redirect-login-phase-audit.png`

## 6. Data Real vs Hardcode Findings

| File | Baris/Komponen | Data hardcode | Dampak | Rekomendasi |
|---|---|---|---|---|
| `Frontend/src/pages/Landing.jsx` | 42-47, 335 | `FALLBACK_SUMMARY` berisi `2847`, `18432`, `94.7`, `23` | Public KPI dapat menampilkan angka palsu saat API gagal | Ganti dengan loading/empty/error state; jangan tampilkan data real-looking fallback. |
| `Frontend/src/pages/Landing.jsx` | 49-60, 336 | `FALLBACK_MARKERS` berisi marker kota/provinsi dummy | Public map preview dapat menampilkan titik palsu | Jika API kosong/gagal, tampilkan empty/error state. |
| `Frontend/src/pages/Landing.jsx` | 62-77 | `PROVINCES` hardcoded untuk form laporan | Bukan data statistik palsu, tetapi wilayah tidak backend-driven | Pakai endpoint region/filter options jika tersedia. |
| `Frontend/src/pages/Distribusi.jsx` | 20-21, 44-76, 244-292 | capacity/threshold/school/distribution fallback | Operator SPPG bisa melihat data distribusi/sekolah palsu saat API gagal/kosong | Hapus fallback rows; buat endpoint sekolah tujuan dan threshold read-only untuk SPPG. |
| `Frontend/src/pages/Konfirmasi.jsx` | 36-91, 250-257 | fallback pending/history validation | Sekolah bisa melihat validasi palsu saat API kosong/gagal | Gunakan empty/error state. |
| `Frontend/src/layouts/DashboardLayout.jsx` | 94-98, 326-336 | static notification text | Notifikasi terlihat seperti real event padahal bukan dari backend | Ambil dari `/api/notifications` atau tampilkan empty state. |
| `Frontend/src/layouts/DashboardLayout.jsx` | 302-309 | global search input tanpa handler | Search terlihat aktif tapi tidak mencari data | Hubungkan ke route/search backend atau disable dengan jelas. |

## 7. Security Findings

| Severity | Issue | Cara reproduce | Dampak | Fix recommendation |
|---|---|---|---|---|
| High | Access token dipersist di localStorage, tidak sesuai SDD memory-only | Lihat `Frontend/src/store/authStore.js`, persist `token` ke `mbg-auth-storage`; `api.js` juga membaca localStorage | Token mudah dicuri jika XSS terjadi | Simpan access token di memory saja, gunakan refresh cookie HttpOnly untuk refresh, dan hapus legacy localStorage token. |
| High | Public Landing bisa menampilkan KPI/marker palsu saat API gagal | Matikan API atau ubah endpoint; `Landing.jsx` akan memakai `FALLBACK_SUMMARY/FALLBACK_MARKERS` | Publik bisa menerima informasi transparansi yang tidak benar | Replace fallback dengan error/empty state. |
| Medium | SPPG/Sekolah operational pages masih inject fallback rows | API distributions/validations kosong/gagal; lihat `Distribusi.jsx` dan `Konfirmasi.jsx` | Operator bisa salah input/validasi berdasarkan data palsu | Hapus fallback data real-looking. |
| Medium | `/statistik` navbar route tidak ada | Buka `http://localhost:5173/statistik` | Link publik broken dan tidak memenuhi SDD statistik publik | Tambah route statistik publik atau arahkan link ke section yang valid. |
| Medium | UI master CRUD SPPG/Sekolah belum jelas | Cek `Frontend/src/App.jsx`; admin route tidak punya halaman master SPPG/schools khusus | Admin requirement SDD partial walau backend CRUD ada | Tambah halaman admin master SPPG dan schools atau integrasikan ke Dapodik/Admin. |
| Low | Notification dropdown static | Buka dashboard notification | User bisa mengira ada event real | Fetch notifikasi dari backend. |
| Low | React Router future warnings di console | Playwright landing console log | Tidak fatal, tapi noise QA | Opt-in future flags atau upgrade plan. |

Security checks yang PASS:
- bcrypt cost factor 12: `Backend/src/utils/auth.js:10`.
- Refresh token di-hash SHA-256 sebelum DB: `Backend/src/utils/auth.js:43`.
- Refresh cookie HttpOnly: `Backend/src/utils/auth.js`.
- CORS whitelist dari `CLIENT_URL`, bukan wildcard: `Backend/src/config/cors.js`.
- Rate limit login/public report/export/file upload ada: `Backend/src/middlewares/rateLimiter.js`.
- XSS input sanitizer middleware ada: `Backend/src/middlewares/security.js`.
- SQL injection smoke search tidak 500.
- Public SPPG detail tidak mengekspos field sensitif.

## 8. Missing Features

| Fitur SDD | Bagian PDF | Kondisi sekarang | Prioritas |
|---|---|---|---|
| Statistik publik route | Page 3, 6, 21, 23-24 | Navbar punya `/statistik`, route tidak ada | P1 |
| Public transparansi anggaran | Page 3, 6 | `/anggaran` hanya pemerintah/admin; public budget page belum ada | P1 |
| Route SPPG `/input-menu`, `/laporan-kendala`, `/riwayat`, `/profil` | Page 42 | App memakai `/distribusi` dan `/production-batches`; route SDD belum tersedia | P2 |
| Route sekolah `/validasi`, `/laporan-sekolah`, `/riwayat`, `/profil` | Page 42 | App memakai `/konfirmasi`; route SDD belum lengkap | P2 |
| UI master CRUD SPPG/Sekolah admin | Page 9, 43 | Backend ada, UI khusus belum jelas | P1 |
| Restore soft delete | Page 17-18 | Soft delete ada; endpoint/UI restore tidak ditemukan | P2 |
| Frontend notification real-time | Page 27 | Backend notifications ada; layout dropdown static | P2 |
| Access token memory-only | Page 19 | Frontend persist localStorage | P1 security |
| Full public report submit E2E with valid CAPTCHA | Page 31 | Blocked tanpa token CAPTCHA provider valid | P2 |

## 9. Bugs Found

| Severity | Bug | Step reproduce | Expected | Actual | Screenshot/log |
|---|---|---|---|---|---|
| High | Landing fallback public KPI/marker bisa menampilkan angka palsu | Simulasikan API summary/map gagal | Error/empty state | Fallback `2847`, `18432`, `94.7`, marker dummy | `Landing.jsx:42-60`, `:335-336` |
| High | Distribusi inject fallback sekolah/distribusi | API `/distributions` kosong/gagal untuk SPPG | Empty/error state | Fallback schools/distributions tampil | `Distribusi.jsx:44-76`, `:244-292` |
| High | Konfirmasi inject fallback validation | API `/validations` kosong/gagal untuk sekolah | Empty/error state | Pending/history dummy tampil | `Konfirmasi.jsx:36-91`, `:250-257` |
| Medium | Navbar Statistik broken | Buka `/statistik` atau klik Statistik | Statistik publik tampil | Redirect ke `/` | Playwright snapshot `.playwright-mcp/page-2026-05-25T08-12-55-418Z.yml` |
| Medium | Global search belum berfungsi | Ketik topbar search | Search route/data | Input tanpa handler | `DashboardLayout.jsx:302-309` |
| Low | Static notification dropdown | Klik bell | Data backend/empty | Tiga pesan statis | `DashboardLayout.jsx:94-98` |

## 10. Recommended Next PR Breakdown

- PR 1: Security/role guard
  - Pindahkan access token dari localStorage ke memory.
  - Pakai refresh cookie HttpOnly untuk refresh session.
  - Tambah regression test IDOR untuk distribution/validation/school reports.

- PR 2: Public feature completeness
  - Hapus Landing fallback KPI/marker.
  - Tambah route `/statistik` publik atau ubah link ke section.
  - Tambah public budget/statistik page sesuai SDD.

- PR 3: Dashboard real data polish
  - Hubungkan global search ke backend.
  - Ambil notification dropdown dari `/api/notifications`.
  - Bersihkan React Router future warnings bila ingin console QA bersih.

- PR 4: SPPG operational flow
  - Hapus fallback rows di `Distribusi.jsx`.
  - Tambah endpoint sekolah tujuan untuk role SPPG.
  - Tambah endpoint threshold read-only yang boleh dibaca SPPG.
  - Buat route SDD `/input-menu`, `/laporan-kendala`, `/riwayat`, `/profil` atau redirect eksplisit.

- PR 5: School validation flow
  - Hapus fallback rows di `Konfirmasi.jsx`.
  - Pecah route sesuai SDD: `/validasi`, `/laporan-sekolah`, `/riwayat`, `/profil`.
  - Tambah browser E2E validasi verified/conflict dengan data test isolated.

- PR 6: Gov/Admin analytics/export/audit
  - Tambah UI master CRUD SPPG dan Schools.
  - Tambah restore soft delete jika tetap mengikuti SDD.
  - Tambah E2E export download PDF/XLSX dan audit log old/new data untuk operasi create/update/delete/lock/unlock.
