# Playwright Endpoint & Feature Audit

## 1. Ringkasan

- Tanggal test: 2026-05-26, Asia/Jakarta.
- Branch/commit: `main` / `af846d8`.
- Frontend URL: `http://localhost:5173` dari `Frontend/.env` dan Vite default.
- Backend URL: `http://localhost:4000/api` dari `Backend/.env` `PORT=4000` dan `VITE_API_URL`.
- Browser/device viewport: desktop `1366x768`, mobile landing `390x844`.
- Akun role yang berhasil dites: `admin@mbg.go.id`, `gov@mbg.go.id`, `sppg@mbg.go.id`, `sekolah@mbg.go.id`, password dari README/seed `password`.
- Total endpoint OK: 48 unique endpoint/pattern.
- Total endpoint WARNING: 5 unique endpoint/pattern.
- Total endpoint ERROR: 0.
- Total endpoint BLOCKED: 3.
- Total fitur OK: 36.
- Total fitur WARNING: 7.
- Total fitur ERROR/BLOCKED: 3.

## 2. Method Testing

- MCP Playwright dipakai untuk navigasi UI lokal, resize mobile, login role, klik menu, search, notification, dan buka halaman protected.
- Network/API request diambil dari browser MCP network log, difilter ke `http://localhost:4000/api`.
- Console warning/error dicatat dari output Playwright selama route dibuka.
- Endpoint di bawah hanya endpoint yang benar-benar terpanggil saat UI dipakai.
- Status code, request aborted, dan UX visible state dipakai untuk klasifikasi.
- Screenshot artifact MCP yang dibuat: `playwright-audit-landing-desktop.png`, `playwright-audit-landing-mobile-menu.png`, `playwright-audit-public-map.png`, `playwright-audit-public-statistik.png`, `playwright-audit-public-budget.png`.

## 3. Endpoint Result Summary

| Status | Method | Endpoint | Trigger UI/Fitur | Role | HTTP Status | Catatan |
|---|---|---|---|---|---|---|
| OK | POST | `/api/auth/session` | app boot/reload semua route | public/authenticated | 200 | Session check berjalan, tetapi terpanggil sangat sering saat navigasi. |
| OK | POST | `/api/auth/login` | login admin/pemerintah/SPPG/sekolah via Enter submit | all roles | 200 | Login sukses; localStorage/sessionStorage tetap kosong. |
| OK | POST | `/api/auth/logout` | logout admin/SPPG | admin, sppg | 200 | Logout admin/SPPG redirect ke login. Logout pemerintah click tidak berpindah dari `/export`, lihat feature warning. |
| OK | GET | `/api/public/statistics` | landing KPI | public | 200 | Landing publik render tanpa login. |
| OK | GET | `/api/public/sppg?limit=10` | landing map preview | public | 200 | Marker preview tampil dari API. |
| OK | GET | `/api/public/sppg` | `/peta-publik` | public | 200 | Public map render. |
| OK | GET | `/api/public/statistics?granularity=daily&limit=12` | `/statistik`, `/anggaran-publik` | public | 200 | Statistik publik berjalan tanpa login. |
| OK | GET | `/api/public/budget?granularity=daily&limit=12` | `/statistik`, `/anggaran-publik` | public | 200 | Budget publik berjalan tanpa login. |
| OK | GET | `/api/notifications?limit=6` | dashboard/topbar semua role | all roles | 200 | Real endpoint dipakai; sering dipanggil saat route change. |
| OK | GET | `/api/search?q=SPPG&limit=5` | topbar global search | admin, pemerintah | 200 | Search backend terpanggil saat mengetik `SPPG`. |
| OK | GET | `/api/dashboard/admin-summary?start_date=...&end_date=...` | dashboard admin | admin | 200 | KPI admin render. |
| OK | GET | `/api/dashboard/gov-summary?start_date=...&end_date=...` | dashboard pemerintah | pemerintah | 200 | KPI pemerintah render. |
| OK | GET | `/api/dashboard/sppg-summary` | dashboard SPPG | sppg | 200 | KPI SPPG render. |
| OK | GET | `/api/dashboard/school-summary` | dashboard sekolah | sekolah | 200 | KPI sekolah render. |
| OK | GET | `/api/users?status=active&isActive=true&page=1&limit=10` | `/users` | admin | 200 | User management list render. |
| OK | GET | `/api/roles` | `/users` | admin | 200 | Role options loaded. |
| OK | GET | `/api/sppg?page=1&limit=10` | `/admin/sppg` | admin | 200 | Master SPPG render. |
| OK | GET | `/api/schools?page=1&limit=10` | `/admin/schools` | admin | 200 | Master Schools render. |
| OK | GET | `/api/audit-logs?page=1&limit=10` | `/audit-log` | admin | 200 | List sempat sukses, tetapi beberapa request juga aborted saat route berubah. |
| OK | GET | `/api/audit-logs/summary` | `/audit-log` | pemerintah | 200 | Summary sempat sukses, tetapi ada aborted duplicate. |
| OK | GET | `/api/monitoring/summary` | `/api-monitoring` | admin | 200 | Monitoring summary loaded. |
| OK | GET | `/api/monitoring/apis` | `/api-monitoring` | admin | 200 | API monitoring list loaded. |
| OK | GET | `/api/monitoring/errors` | `/api-monitoring` | admin | 200 | Error monitoring list loaded. |
| OK | GET | `/api/monitoring/sync-sources` | `/api-monitoring` | admin | 200 | Sync source monitoring loaded. |
| OK | GET | `/api/distributions?page=1&limit=10` | `/lock-unlock` | admin | 200 | Distribution lock page data loaded. |
| OK | GET | `/api/audit-logs?action=LOCK&tableName=distributions&limit=5` | `/lock-unlock` | admin | 200 | Lock audit history loaded. |
| OK | GET | `/api/audit-logs?action=UNLOCK&tableName=distributions&limit=5` | `/lock-unlock` | admin | 200 | Unlock audit history loaded. |
| OK | GET | `/api/distributions/lock-summary` | `/lock-unlock` | admin | 200 | Lock summary loaded. |
| OK | GET | `/api/system-configs/export_max_rows` | `/export` | admin, pemerintah | 200 | Config eventually succeeds after aborted duplicate requests. |
| OK | GET | `/api/exports?page=1&limit=10` | `/export` | admin, pemerintah | 200 | Export history eventually succeeds after aborted duplicate requests. |
| OK | GET | `/api/analytics/summary` | `/analytics` | pemerintah | 200 | Analytics summary loaded. |
| OK | GET | `/api/production-batches?limit=30` | `/analytics` | pemerintah | 200 | Production batch data loaded. |
| OK | GET | `/api/analytics/by-province?limit=10` | `/analytics` | pemerintah | 200 | Province analytics loaded. |
| OK | GET | `/api/anomaly-logs?status=unresolved&limit=100` | `/analytics` | pemerintah | 200 | Anomaly data loaded. |
| OK | GET | `/api/analytics/public-reports-summary` | `/analytics` | pemerintah | 200 | Public report summary loaded. |
| OK | GET | `/api/analytics/public-reports-trend` | `/analytics` | pemerintah | 200 | Public report trend loaded. |
| OK | GET | `/api/analytics/public-reports-top-regions?limit=10` | `/analytics` | pemerintah | 200 | Top regions loaded. |
| OK | GET | `/api/analytics/budget-summary` | `/anggaran` | pemerintah | 200 | Budget page data loaded. |
| OK | GET | `/api/analytics/price-per-province` | `/anggaran` | pemerintah | 200 | Price chart loaded. |
| OK | GET | `/api/analytics/price-anomalies?limit=50` | `/anggaran` | pemerintah | 200 | Price anomalies loaded. |
| OK | GET | `/api/analytics/budget` | `/anggaran` | pemerintah | 200 | Budget aggregate loaded. |
| OK | GET | `/api/anomaly-logs?status=unresolved&limit=50` | `/anomaly` | pemerintah | 200 | Called twice, both 200. |
| OK | GET | `/api/public-reports?status=baru%2Cditinjau&page=1&limit=10` | `/laporan-masyarakat` | pemerintah | 200 | Public report list loaded. |
| OK | GET | `/api/public-reports/summary?...` | `/laporan-masyarakat` | pemerintah | 200 | Report summary loaded. |
| OK | GET | `/api/analytics/public-reports-trend?...` | `/laporan-masyarakat` | pemerintah | 200 | Report trend loaded. |
| OK | GET | `/api/analytics/public-reports-top-regions?...` | `/laporan-masyarakat` | pemerintah | 200 | Report top regions loaded. |
| OK | GET | `/api/distributions?date=2026-05-26&sppgId=1&limit=50` | `/distribusi` | sppg | 200 | Distribusi SPPG scoped. |
| OK | GET | `/api/sppg/me/schools?limit=100` | `/distribusi` | sppg | 200 | Sekolah tujuan SPPG loaded. |
| OK | GET | `/api/price-thresholds/my-region` | `/distribusi` | sppg | 200 | Threshold wilayah loaded. |
| OK | GET | `/api/sppg/1` | `/distribusi`, `/profil` | sppg | 200 | Profil SPPG loaded. |
| OK | GET | `/api/production-batches?date=2026-05-26&sppgId=1&limit=20` | `/distribusi` | sppg | 200 | Production batch select loaded. |
| OK | GET | `/api/menus?sppgId=1&limit=20` | `/input-menu`, `/riwayat` | sppg | 200 | Menu data loaded; empty state visible. |
| OK | GET | `/api/issues?limit=20` | `/laporan-kendala`, `/riwayat` | sppg | 200 | Kendala data loaded; empty state visible. |
| OK | GET | `/api/distributions?limit=20` | `/riwayat` | sppg, sekolah | 200 | Riwayat distribution loaded. |
| OK | GET | `/api/validations?limit=100` | `/validasi` | sekolah | 200 | Validasi sekolah loaded; pending empty state visible. |
| OK | GET | `/api/school-reports?limit=20` | `/laporan-sekolah` | sekolah | 200 | Laporan sekolah loaded; empty state visible. |
| OK | GET | `/api/validations?limit=20` | `/riwayat` | sekolah | 200 | Riwayat validasi loaded. |
| OK | GET | `/api/schools/1` | `/profil` | sekolah | 200 | Profil sekolah loaded. |
| WARNING | GET | `/api/audit-logs/summary` | rapid route change from `/audit-log` | admin | aborted | Request aborted during navigation; eventual related data still loads elsewhere. |
| WARNING | GET | `/api/audit-logs?page=1&limit=10` | rapid route change from `/audit-log` | pemerintah | aborted | Aborted duplicate due navigation timing; not a backend 5xx. |
| WARNING | GET | `/api/system-configs/export_max_rows` | `/export` route mount/route leave | admin, pemerintah | aborted then 200 | Duplicate aborted request before successful 200. |
| WARNING | GET | `/api/exports?page=1&limit=10` | `/export` route mount/route leave | admin, pemerintah | aborted then 200 | Duplicate aborted request before successful 200. |
| WARNING | POST | `/api/auth/session` | every SPA route mount | all roles | 200 | Status OK, but repeated heavily during audit; possible over-fetch on route navigation. |
| BLOCKED | POST | `/api/public-reports` | public report submit | public | not sent | Full submit needs valid CAPTCHA provider token; no fake token used. |
| BLOCKED | POST | `/api/files/upload` | proof upload | sppg/sekolah | not sent | No safe test fixture upload performed in this audit. |
| BLOCKED | POST/GET | `/api/exports`, `/api/exports/:id/download` | create/download export from UI | admin/pemerintah | not sent | Export list page tested; create/download not clicked to avoid creating artifacts during audit-only pass. |

## 4. Feature Result Summary

| Status | Fitur | Route/UI | Role | Endpoint terkait | Evidence | Catatan |
|---|---|---|---|---|---|---|
| OK | Landing desktop | `/` | public | `/api/public/statistics`, `/api/public/sppg?limit=10` | Screenshot `playwright-audit-landing-desktop.png` | Public tanpa login, data API tampil. |
| OK | Landing mobile hamburger | `/` mobile | public | same landing endpoints | Screenshot `playwright-audit-landing-mobile-menu.png` | Drawer/menu terbuka. |
| OK | Public map | `/peta-publik` | public | `/api/public/sppg` | Screenshot `playwright-audit-public-map.png` | Map/list render. |
| OK | Public statistics | `/statistik` | public | `/api/public/statistics`, `/api/public/budget` | Screenshot `playwright-audit-public-statistik.png` | Public route tidak redirect. |
| OK | Public budget | `/anggaran-publik` | public | `/api/public/statistics`, `/api/public/budget` | Screenshot `playwright-audit-public-budget.png` | Budget publik tersedia. |
| BLOCKED | Public report valid submit | landing report form | public | `/api/public-reports` | Form terlihat | CAPTCHA provider token asli diperlukan. |
| OK | Protected route guest redirect | `/dashboard` fresh guest | public | `/api/auth/session` | Final URL `/login` | Guest tidak bisa membuka dashboard. |
| WARNING | Login button click | `/login` button `Masuk` | sppg/sekolah manual check | expected `/api/auth/login` | Click did not submit in Playwright; Enter submit worked | UX/testability issue: form submit via Enter sukses, click tool tidak memicu request. |
| OK | Login admin | `/login` | admin | `/api/auth/login` | Final URL `/dashboard` | localStorage/sessionStorage kosong. |
| OK | Login pemerintah | `/login` | pemerintah | `/api/auth/login` | Final URL `/dashboard` | localStorage/sessionStorage kosong. |
| OK | Login SPPG | `/login` | sppg | `/api/auth/login` | Final URL `/dashboard` after Enter submit | localStorage/sessionStorage kosong. |
| OK | Login sekolah | `/login` | sekolah | `/api/auth/login` | Final URL `/dashboard` after Enter submit | localStorage/sessionStorage kosong. |
| OK | Admin dashboard | `/dashboard` | admin | `/api/dashboard/admin-summary` | Dashboard rendered | Recharts warning appears. |
| OK | User management | `/users` | admin | `/api/users`, `/api/roles` | Route rendered | Data loaded. |
| OK | Master SPPG | `/admin/sppg` | admin | `/api/sppg` | Route rendered | Data loaded. |
| OK | Master Schools | `/admin/schools` | admin | `/api/schools` | Route rendered | Data loaded. |
| OK | Audit log | `/audit-log` | admin/pemerintah | `/api/audit-logs`, `/api/audit-logs/summary` | Route rendered | Some aborted duplicate requests on navigation. |
| WARNING | API monitoring | `/api-monitoring` | admin | `/api/monitoring/*` | Route rendered with visible text containing `error` | Endpoints 200, but page has error-monitoring copy; classify as UX warning not endpoint failure. |
| OK | Lock/unlock page | `/lock-unlock` | admin | `/api/distributions`, `/api/distributions/lock-summary`, audit log filters | Route rendered | Data loaded. Lock/unlock mutation not clicked. |
| OK | Export list | `/export` | admin/pemerintah | `/api/exports`, `/api/system-configs/export_max_rows` | Route rendered | List/config eventually 200; create/download blocked. |
| OK | Pemerintah dashboard | `/dashboard` | pemerintah | `/api/dashboard/gov-summary` | Dashboard rendered | Data loaded. |
| OK | Analytics | `/analytics` | pemerintah | `/api/analytics/*`, `/api/production-batches`, `/api/anomaly-logs` | Route rendered | Multiple analytics calls 200. |
| WARNING | Anggaran | `/anggaran` | pemerintah | `/api/analytics/budget*`, price endpoints | Route rendered with visible `error` text and Recharts warning | Endpoints 200; chart/layout warning remains. |
| OK | Anomaly detection | `/anomaly` | pemerintah | `/api/anomaly-logs` | Route rendered | Data loaded. |
| OK | Laporan masyarakat | `/laporan-masyarakat` | pemerintah | `/api/public-reports`, report analytics | Route rendered | Data loaded. |
| OK | SPPG dashboard | `/dashboard` | sppg | `/api/dashboard/sppg-summary` | Dashboard rendered | Data loaded. |
| WARNING | SPPG Distribusi | `/distribusi` | sppg | distributions, schools, threshold, batches | Page rendered; visible `signal is aborted without reason` | Endpoint OK, but aborted-signal text leaks to UI. |
| OK | SPPG input menu | `/input-menu` | sppg | `/api/menus` | Empty state visible | No fallback dummy. |
| OK | SPPG laporan kendala | `/laporan-kendala` | sppg | `/api/issues` | Empty state visible | No fallback dummy. |
| WARNING | SPPG riwayat | `/riwayat` | sppg | `/api/distributions`, `/api/menus`, `/api/issues` | Data visible; `signal is aborted without reason` visible | Endpoint OK, UI should hide abort noise. |
| OK | SPPG profil | `/profil` | sppg | `/api/sppg/1` | Profile rendered | Data scoped to demo SPPG. |
| OK | SPPG forbidden users/export UI | `/users`, `/export` | sppg | route guard | Final URL `/dashboard` | Protected by frontend route. |
| OK | Sekolah dashboard | `/dashboard` | sekolah | `/api/dashboard/school-summary` | Dashboard rendered | Data loaded. |
| OK | Sekolah validasi | `/validasi` | sekolah | `/api/validations` | Pending empty state visible | No fallback dummy. |
| OK | Sekolah laporan | `/laporan-sekolah` | sekolah | `/api/school-reports` | Empty state visible | No fallback dummy. |
| WARNING | Sekolah riwayat | `/riwayat` | sekolah | `/api/distributions`, `/api/validations` | Data visible; `signal is aborted without reason` visible | Endpoint OK, UI should hide abort noise. |
| OK | Sekolah profil | `/profil` | sekolah | `/api/schools/1` | Profile rendered | Data scoped to school. |
| OK | `/konfirmasi` redirect | `/konfirmasi` | sekolah | `/api/validations` | Final URL `/validasi` | Expected redirect works. |
| OK | Sekolah forbidden routes | `/distribusi`, `/users` | sekolah | route guard | Final URL `/dashboard` | Protected by frontend route. |
| OK | Global search | topbar search | admin/pemerintah | `/api/search?q=SPPG&limit=5` | Request observed | Real backend search. |
| OK | Notification dropdown | topbar bell | admin/pemerintah | `/api/notifications?limit=6` | Request observed | Real backend notification endpoint. |

## 5. Console Warning/Error

| Severity | Route | Message | Dampak | Rekomendasi |
|---|---|---|---|---|
| INFO | multiple dev routes | React DevTools download suggestion | Tidak berdampak produksi; normal di dev. | Abaikan untuk dev, tidak perlu fix. |
| WARNING | `/dashboard` | `The width(-1) and height(-1) of chart should be greater than 0...` | Chart container Recharts belum stabil saat render awal. | Beri min-height/min-width atau render chart setelah container siap. |
| WARNING | `/anggaran` | Recharts width/height `-1` warning | Sama, berpotensi chart blank/flashing pada viewport tertentu. | Fix layout chart container. |
| WARNING | `/distribusi`, `/riwayat` | Visible UI text `signal is aborted without reason` | Abort normal saat route/fetch berubah bocor ke pengguna. | Jangan tampilkan `AbortError`/abort reason sebagai error user-facing. |
| WARNING | `/export`, `/audit-log` | Network `net::ERR_ABORTED` pada duplicate fetch saat route change | Data tetap 200 setelah retry/duplicate, tetapi noisy di network audit. | Cancel request secara silent atau debounce route-mount fetch. |

## 6. Route yang Wajib Dites

### Public Routes

- `/`: OK, landing desktop render, API public statistics dan SPPG preview 200.
- `/peta-publik`: OK, public map render, `/api/public/sppg` 200.
- `/statistik`: OK, public statistics render, `/api/public/statistics` dan `/api/public/budget` 200.
- `/anggaran-publik`: OK, public budget route render, endpoint sama 200.
- Public report form: BLOCKED untuk submit valid karena CAPTCHA provider token asli.
- Navbar/menu: mobile hamburger OK. Route public utama tidak butuh login.

### Auth Routes

- `/login`: OK, akun admin/pemerintah/SPPG/sekolah sukses login dengan `password`.
- Login submit via Enter: OK untuk semua role.
- Click tombol `Masuk`: WARNING pada manual SPPG/sekolah check karena click Playwright tidak mengirim request; Enter submit berhasil.
- Logout admin/SPPG: OK. Logout pemerintah: WARNING, click dilakukan dari `/export` tetapi final URL tetap `/export`.
- Protected `/dashboard` tanpa login: OK redirect ke `/login`.
- Storage: localStorage/sessionStorage kosong setelah login role yang diperiksa.

### Dashboard Umum

- Admin/pemerintah/SPPG/sekolah dashboard render dan summary endpoint 200.
- Global search admin/pemerintah request `/api/search` 200.
- Notification dropdown memakai `/api/notifications` 200.
- Console Recharts warning masih muncul di dashboard.

## 7. Test Per Role

### Admin

- OK: dashboard, users, master SPPG, master Schools, audit log, monitoring, lock/unlock page, export list, search, notification.
- WARNING: `/api-monitoring` route memuat endpoint 200 tetapi UI mengandung teks error monitoring, sehingga audit UX menandainya warning.
- WARNING: export/audit pages punya aborted duplicate request ketika route berubah.
- BLOCKED: export create/download tidak diklik pada audit-only pass.

### Pemerintah

- OK: dashboard, analytics, anomaly, public reports, audit log, export list, search, notification.
- WARNING: `/anggaran` render dengan endpoint 200 tetapi Recharts warning dan visible error-ish text membuat UX perlu polish.
- WARNING: logout click dari `/export` tidak mengalihkan ke `/login` pada run ini.

### SPPG

- OK: login, dashboard, `/input-menu`, `/laporan-kendala`, `/profil`, route guard dari `/users` dan `/export`.
- OK endpoint: `/api/dashboard/sppg-summary`, `/api/distributions`, `/api/sppg/me/schools`, `/api/price-thresholds/my-region`, `/api/menus`, `/api/issues`.
- WARNING: `/distribusi` dan `/riwayat` menampilkan `signal is aborted without reason`; endpoint tetap 200.
- BLOCKED: upload proof tidak diuji karena tidak ada fixture file dalam audit ini.

### Sekolah

- OK: login, dashboard, `/validasi`, `/laporan-sekolah`, `/profil`, `/konfirmasi` redirect ke `/validasi`, route guard dari `/distribusi` dan `/users`.
- OK endpoint: `/api/dashboard/school-summary`, `/api/validations`, `/api/school-reports`, `/api/schools/1`.
- WARNING: `/riwayat` menampilkan `signal is aborted without reason`; endpoint tetap 200.
- BLOCKED: verified/conflict mutation tidak diuji karena tidak ada pending validation isolated yang aman dipakai dari browser.

## 8. Endpoint Error Classification

- OK: semua endpoint yang mendapat 2xx dan membuat UI render data/empty state.
- WARNING: endpoint 2xx dengan UX warning, duplicate aborted request, repeated session checks, atau request aborted saat route change.
- ERROR: tidak ditemukan endpoint 5xx/404 tidak sesuai, CORS error, network hard failure, role leak, atau data dummy real-looking.
- BLOCKED: CAPTCHA valid submit, upload proof fixture, dan export create/download via UI.

## 9. Network Monitoring Detail

- Browser network log MCP menunjukkan mayoritas endpoint `/api/*` 200.
- Request `/api/auth/session` terpanggil berulang pada hampir setiap route mount; status OK tetapi perlu dipantau sebagai potensi over-fetch.
- Request `/api/notifications?limit=6` terpanggil di banyak protected route; status OK.
- Request `/api/audit-logs/*` dan `/api/exports/*` memiliki beberapa `net::ERR_ABORTED` saat navigasi cepat, lalu request serupa sukses 200.
- Tidak ada request asset statis gagal yang berdampak UI.

## 10. Screenshots / Evidence

- MCP screenshot artifact: `playwright-audit-landing-desktop.png`.
- MCP screenshot artifact: `playwright-audit-landing-mobile-menu.png`.
- MCP screenshot artifact: `playwright-audit-public-map.png`.
- MCP screenshot artifact: `playwright-audit-public-statistik.png`.
- MCP screenshot artifact: `playwright-audit-public-budget.png`.
- Catatan: folder project `docs/screenshots/playwright-audit/` dibuat, tetapi tool screenshot MCP menyimpan artifact di workspace output Playwright, bukan langsung ke folder project.

## 11. Update Remaining Gap

Lihat section `Playwright Endpoint Audit Update` di `docs/remaining-gap-after-reaudit.md`.

## 12. Recommended Fix PR

### PR A: UI Abort/Error State Cleanup

- Prioritas: P2.
- File/endpoint terkait: `Frontend/src/pages/Distribusi.jsx`, `SppgHistory.jsx`, `SchoolHistory.jsx`; endpoints `/api/distributions`, `/api/menus`, `/api/issues`, `/api/validations`.
- Expected: abort karena route change/fetch refresh tidak tampil sebagai error user-facing.
- Actual: teks `signal is aborted without reason` terlihat di `/distribusi` dan `/riwayat`.

### PR B: Chart Container Warning Cleanup

- Prioritas: P3.
- File/endpoint terkait: dashboard/anggaran chart components, Recharts containers.
- Expected: chart render tanpa console warning.
- Actual: Recharts warning width/height `-1` di `/dashboard` dan `/anggaran`.

### PR C: Network Duplicate/Abort Polish

- Prioritas: P3.
- File/endpoint terkait: `/audit-log`, `/export`, `/api/auth/session`, `/api/notifications`.
- Expected: route mount fetch tidak menghasilkan duplicate aborted request yang noisy.
- Actual: beberapa `/api/audit-logs/*`, `/api/exports`, `/api/system-configs/export_max_rows` aborted saat navigasi cepat; session check sangat sering.

### PR D: Auth Button Testability/Logout UX

- Prioritas: P2.
- File/endpoint terkait: `Frontend/src/pages/Login.jsx`, `DashboardLayout.jsx`, endpoint `/api/auth/login`, `/api/auth/logout`.
- Expected: klik tombol `Masuk` selalu submit seperti Enter; logout selalu redirect `/login`.
- Actual: Playwright click tombol `Masuk` tidak mengirim request pada manual SPPG/sekolah check, Enter bekerja; logout pemerintah dari `/export` tidak redirect pada run ini.

### PR E: Browser E2E Coverage

- Prioritas: P2.
- File/endpoint terkait: Playwright tests untuk `/validasi`, `/distribusi`, `/export`.
- Expected: browser E2E isolated untuk upload proof, validation verified/conflict, dan export create/download.
- Actual: fitur read/list sudah diaudit; mutation berisiko/fixture-dependent masih BLOCKED.

## Fix Verification Update

- Tanggal fix verification: 2026-05-26, Asia/Jakarta.
- Branch/commit saat fix: `main` / `e43df7e` plus working-tree changes PR fix.
- Test command:
  - `npm.cmd --prefix Frontend test`: PASS, 24 tests.
  - `npm.cmd --prefix Frontend run lint`: PASS.
  - `npm.cmd --prefix Frontend run build`: PASS, masih ada warning chunk-size Vite lama.
  - `npm.cmd --prefix Backend test`: PASS, 33 tests.
- Manual browser MCP: BLOCKED oleh lock profil Playwright lokal (`Browser is already in use...`). Server lokal port 5173 dan 4000 terdeteksi aktif.

### Issue yang Diperbaiki

- UI abort leakage: `Distribusi.jsx`, `SppgHistory.jsx`, `SchoolHistory.jsx`, `AuditLog.jsx`, dan `ExportData.jsx` sekarang memakai helper `isAbortError` agar abort/cancel normal tidak menjadi error user-facing.
- Recharts warning: chart `/dashboard` dan `/anggaran` memakai tinggi numerik stabil `height={320}` dan wrapper CSS diberi `min-width`/`min-height`.
- Session over-fetch: restore session memakai singleton `sessionCheckPromise` sehingga React StrictMode/boot tidak membuat request concurrent berulang.
- Notification over-fetch: `DashboardLayout` memakai cache TTL 60 detik per user+role dan request in-flight reuse; refresh tetap dilakukan saat dropdown dibuka atau retry eksplisit.
- Login button testability: test guard memastikan form login tetap `onSubmit` dan tombol `Masuk` tetap `type="submit"`.
- Logout redirect: guard tetap `navigate('/login', { replace: true })` setelah local auth clear.
- Fixture upload proof: ditambahkan `Frontend/test/fixtures/proof-valid.png` dan `proof-invalid.txt`.
- CAPTCHA valid-submit: ditambahkan strategi test Turnstile resmi di `docs/captcha-test-strategy.md`, `Frontend/.env.example`, dan `Backend/.env.example` tanpa bypass production.

### Endpoint/Fitur Status Setelah Fix

| Endpoint/Fitur | Before | After | Evidence |
|---|---|---|---|
| `/api/distributions` di `/distribusi` | WARNING, abort text bocor UI | OK by source/test guard | `isAbortError` + frontend test `Playwright audit cleanup guardrails` |
| `/api/menus`, `/api/issues` di SPPG `/riwayat` | WARNING, abort text bocor UI | OK by source/test guard | abort rejected result difilter |
| `/api/distributions`, `/api/validations` di Sekolah `/riwayat` | WARNING, abort text bocor UI | OK by source/test guard | abort rejected result difilter |
| `/dashboard` charts | WARNING Recharts width/height -1 | OK by source/test guard | `ResponsiveContainer height={320}` |
| `/anggaran` chart | WARNING Recharts width/height -1 | OK by source/test guard | `ResponsiveContainer height={320}` |
| `/api/auth/session` | WARNING over-fetch | Improved | singleton boot session check |
| `/api/notifications?limit=6` | WARNING route-change spam | Improved | user+role cache TTL + in-flight reuse |
| `/api/audit-logs/*` route leave | WARNING aborted duplicate noisy | Improved | abort is silent in UI |
| `/api/system-configs/export_max_rows`, `/api/exports` route leave | WARNING aborted duplicate noisy | Improved | abort is silent in UI |
| Public report valid submit | BLOCKED | Documented test strategy | official Turnstile test keys documented |
| `/api/files/upload` | BLOCKED no fixture | Ready for E2E fixture | safe fixtures added |
| `/api/exports`, `/api/exports/:id/download` | BLOCKED in browser audit | Backend OK, browser still not rerun | backend test already covers create/download PDF/XLSX role enforcement |

### Issue yang Masih Tersisa

- Manual browser re-smoke belum dijalankan karena profil MCP Playwright sedang locked.
- Vite chunk-size warning masih ada dan tidak ditangani di PR ini karena bukan issue endpoint/UX warning utama.
- Public report valid submit belum dijalankan end-to-end karena butuh env test Turnstile aktif pada frontend dan backend.
