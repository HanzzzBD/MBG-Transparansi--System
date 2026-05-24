# Local Web Audit Endpoints

Audit runtime dilakukan dari browser lokal `http://localhost:5173` ke backend `http://localhost:4000/api` pada 2026-05-22.

| Halaman | Endpoint | Method | Status | Dipakai untuk | Masalah |
|---|---|---|---|---|---|
| Health | `/api/health` | GET | 200 | Readiness backend | OK |
| Landing | `/api/analytics/summary` | GET | 200 | KPI publik | OK |
| Landing | `/api/sppg?fields=lat,lng,status&limit=10` | GET | 200 | Marker preview | OK |
| Landing | `/api/public-reports` | POST | Fixed: 400 validation for invalid guest payload | Submit laporan publik | Sebelumnya 401 `AUTH_TOKEN_MISSING`. Hotfix 2026-05-22 men-scope auth production batch sehingga guest POST mencapai validation. |
| Login | `/api/auth/login` | POST | 200 | Login demo admin/gov/sppg/sekolah | OK, response body token tidak dicatat. |
| Dashboard Nasional | `/api/analytics/summary?start_date=...` | GET | 200 | KPI dashboard | OK |
| Dashboard Nasional | `/api/analytics/distributions?start_date=...&granularity=daily` | GET | Fixed: 200 after raw SQL hotfix | Trend distribusi | No `P2010`; verified query kosong dan filter tanggal/provinsi. |
| Dashboard Nasional | `/api/analytics/success-rate?start_date=...&granularity=daily` | GET | Fixed: 200 after raw SQL hotfix | Trend success rate | No `P2010`; verified query kosong dan filter tanggal/provinsi. |
| Dashboard Nasional | `/api/analytics/budget?start_date=...` | GET | Fixed: 200 after raw SQL hotfix | Budget dashboard | No `P2010`; verified query kosong dan filter tanggal/provinsi. |
| Dashboard Nasional | `/api/analytics/by-province?start_date=...&limit=10` | GET | Fixed: 200 after raw SQL hotfix | Ranking provinsi | No `P2010`; verified query kosong dan filter tanggal/provinsi. |
| Dashboard Nasional | `/api/analytics/anomaly?start_date=...&page=1&limit=5` | GET | Fixed: 200 after raw SQL hotfix | Alert anomali | No `P2010`; verified query kosong dan filter tanggal/provinsi. |
| Dashboard Nasional | `/api/public-reports?page=1&limit=5` | GET | 200 | Laporan publik terbaru | OK untuk admin/pemerintah. |
| Dashboard SPPG | `/api/distributions?date=2026-05-22&limit=50` | GET | Fixed: 200 after seed | KPI/list SPPG | Demo `sppg@mbg.go.id` sekarang memiliki `sppgId=1`; no `SPPG_SCOPE_MISSING`. |
| Dashboard SPPG | `/api/distributions?limit=80` | GET | Fixed: 200 after seed | Riwayat SPPG | Demo `sppg@mbg.go.id` sekarang scoped ke SPPG valid. |
| Dashboard Sekolah | `/api/distributions?date=2026-05-22&limit=30` | GET | Fixed: scoped user has `schoolId` | Distribusi hari ini sekolah | Demo `sekolah@mbg.go.id` sekarang memiliki `schoolId=1`; no `SCHOOL_SCOPE_MISSING`. |
| Dashboard Sekolah | `/api/validations?status=pending&limit=20` | GET | Fixed: 200 after seed | Validasi pending | Demo sekolah sekarang scoped ke sekolah valid. |
| Dashboard Sekolah | `/api/validations?limit=80` | GET | Fixed: 200 after seed | Riwayat validasi | Demo sekolah sekarang scoped ke sekolah valid. |
| Dashboard Sekolah | `/api/school-reports?limit=20` | GET | Fixed: scoped user has `schoolId` | Laporan sekolah | Demo sekolah sekarang scoped ke sekolah valid; endpoint tetap protected. |
| Peta SPPG | `/api/sppg?all=true&page=1&limit=100&fields=...` | GET | 200 | Marker peta utama | OK; detail menu masih fallback bila endpoint menu tidak lengkap. |
| Distribusi | `/api/distributions?date=2026-05-22&limit=50` | GET | 200 | Tabel distribusi admin | OK saat admin. |
| Distribusi | `/api/schools?limit=100` | GET | 200 | Pilihan sekolah admin | OK untuk admin; source mencatat role SPPG belum punya endpoint sekolah tujuan. |
| Distribusi | `/api/admin/price-thresholds?limit=1` | GET | 200 | Threshold harga | OK untuk admin; role SPPG akan forbidden. |
| Distribusi | `/api/production-batches?date=2026-05-22&limit=20` | GET | 200 | Pilihan batch/costing | OK saat admin. |
| Production Batches | `/api/production-batches?date=2026-05-22&limit=25` | GET | 200 | List batch | OK saat admin. |
| Konfirmasi | `/api/validations?limit=100` | GET | Fixed: 200 after seed | Pending/history validasi sekolah | Demo sekolah sekarang memiliki `schoolId=1`. |
| Analytics | `/api/analytics/summary` | GET | 200 | KPI analytics | OK |
| Analytics | `/api/production-batches?limit=30` | GET | 200 | Cost trend dari batch | OK |
| Analytics | `/api/analytics/by-province?limit=10` | GET | Fixed: 200 after raw SQL hotfix | Compare provinsi | No `P2010`. |
| Analytics | `/api/anomaly-logs?status=unresolved&limit=100` | GET | 200 | Anomaly count | OK |
| Anggaran | `/api/analytics/budget-summary` | GET | 200 | KPI anggaran | OK |
| Anggaran | `/api/analytics/price-per-province` | GET | 200 | Harga per provinsi | OK |
| Anggaran | `/api/analytics/price-anomalies?limit=50` | GET | 200 | Anomali harga | OK |
| Anggaran | `/api/analytics/budget` | GET | Fixed: 200 after raw SQL hotfix | Legacy budget fallback | No `P2010`. |
| Anomaly | `/api/anomaly-logs?status=unresolved&limit=50` | GET | 200 | List anomaly | OK |
| Audit Log | `/api/audit-logs?page=1&limit=10` | GET | 200 | Tabel audit | OK via compat route. |
| Audit Log | `/api/audit-logs/summary` | GET | Fixed: 200 after summary hotfix | KPI audit summary | Returns `totalToday`, `highSeverity`, `activeUsers`, and action counts. |
| Export | `/api/system-configs/export_max_rows` | GET | Fixed: 200 after summary hotfix | Max row export | Returns backend `system_configs` record; default created by backend if missing. |
| Export | `/api/exports?page=1&limit=10` | GET | 200 | Riwayat export | OK via compat route. |
| Export | `/api/admin/system-configs?search=export_max_rows&limit=1` | GET | 200 admin / 403 pemerintah | Fallback config | Pemerintah tidak boleh akses admin endpoint. |
| Laporan Masyarakat | `/api/public-reports?status=baru,ditinjau&page=1&limit=10` | GET | 200 | Tabel laporan | OK |
| Laporan Masyarakat | `/api/public-reports/summary` | GET | Fixed: 200 after summary hotfix | Summary laporan | Route statis dipasang sebelum `/:id`; no validation 400. |
| Laporan Masyarakat | `/api/analytics/public-reports-summary` | GET | Fixed: 200 after summary hotfix | Summary analytics laporan | Backend aggregation from `public_reports`. |
| Laporan Masyarakat | `/api/analytics/public-reports-trend` | GET | Fixed: 200 after summary hotfix | Chart trend | Backend trend from `public_reports`. |
| Laporan Masyarakat | `/api/analytics/public-reports-top-regions` | GET | Fixed: 200 after summary hotfix | Top regions | Backend top regions from `public_reports`. |
| User Management | `/api/users?status=active&isActive=true&page=1&limit=10` | GET | 200 | List user | OK via compat route. |
| User Management | `/api/sppg?limit=200` | GET | 200 | Pilihan SPPG user | OK |
| User Management | `/api/schools?limit=200` | GET | 200 | Pilihan sekolah user | OK |
| Lock/Unlock | `/api/distributions?page=1&limit=10` | GET | 200 | List distribusi lock | OK |
| Lock/Unlock | `/api/audit-logs?action=LOCK,UNLOCK&limit=5` | GET | 200 | Log lock/unlock | OK |
| Lock/Unlock | `/api/distributions/lock-summary` | GET | Fixed: 200 after summary hotfix | Summary lock | Route statis dipasang sebelum `/:id`; no validation 400. |
| Override | `/api/distributions?isLocked=true&page=1&limit=10` | GET | 200 | Kandidat override | OK |
| Override | `/api/audit-logs?action=OVERRIDE&tableName=distributions&limit=10` | GET | 200 | History override | OK request, tetapi source mencatat backend mencatat override sebagai UPDATE marker. |
| API Monitoring | `/api/monitoring/summary` | GET | 200 | Health/totals backend | OK |

Catatan: beberapa `net::ERR_ABORTED` muncul saat audit karena navigasi cepat antar halaman. Temuan di atas fokus pada response final 2xx/4xx/5xx yang stabil.

## Hotfix Verification 2026-05-22

Manual verification after `Backend/src/modules/productionBatches/router.js` change:

| Check | Command summary | Result |
|---|---|---|
| Public report invalid guest payload | `POST /api/public-reports` without Authorization, with category/message but without `captchaToken` | 400 `VALIDATION_ERROR`, detail `captchaToken is required.` |
| Public report empty guest payload | `POST /api/public-reports` without Authorization, empty JSON body | 400 `VALIDATION_ERROR` |
| Protected production batch route | `GET /api/production-batches` without Authorization | 401 `AUTH_TOKEN_MISSING` |
| Backend health | `GET /api/health` | 200 |

## Hotfix Verification 2026-05-22 - Demo Scope

Manual verification after `Backend/src/scripts/seedDemoUsers.js` change and `npm.cmd run seed:demo-users`:

| Check | Result |
|---|---|
| `sppg@mbg.go.id` login | 200, response user role `sppg`, `sppgId=1`, `schoolId=null` |
| SPPG distributions endpoint | `GET /api/distributions?limit=5` with SPPG token -> 200, no `SPPG_SCOPE_MISSING` |
| `sekolah@mbg.go.id` login | 200, response user role `sekolah`, `schoolId=1`, `sppgId=null` |
| Sekolah validations endpoint | `GET /api/validations?limit=5` with sekolah token -> 200, no `SCHOOL_SCOPE_MISSING` |
| Protected scoped endpoints without token | `GET /api/distributions?limit=1` and `GET /api/validations?limit=1` -> 401 `AUTH_TOKEN_MISSING` |

## Hotfix Verification 2026-05-22 - Analytics Raw SQL

Manual verification after `Backend/src/modules/analytics/service.js` change:

| Check | Result |
|---|---|
| Root cause | `Prisma.join(conditions, Prisma.sql\` AND \`)` rendered `[object Object]` between SQL conditions; changed separator to string `" AND "`. |
| Admin login | 200, response user role `admin`, token present. |
| Empty analytics filters | `/api/analytics/distributions`, `/success-rate`, `/budget`, `/by-province`, `/anomaly` -> 200 JSON `status=success`. |
| Date/province analytics filters | Same five endpoints with `start_date=2026-05-01`, `end_date=2026-05-22`, `province=Jawa` -> 200 JSON `status=success`. |
| Pagination/limit filters | `/api/analytics/by-province?...&limit=10` and `/api/analytics/anomaly?...&page=1&limit=5` -> 200 with valid `meta`. |
| Protected analytics without token | `/api/analytics/distributions` without Authorization -> 401 `AUTH_TOKEN_MISSING`; `/api/analytics/summary` remains public 200. |

## Hotfix Verification 2026-05-22 - Summary Endpoints

Manual verification with local backend started from `node src/server.js`:

| Check | Result |
|---|---|
| Root cause | `/public-reports/summary` and `/distributions/lock-summary` were caught by dynamic `/:id`; audit summary, export config, and report analytics endpoints were missing. |
| Admin and pemerintah login | `admin@mbg.go.id` and `gov@mbg.go.id` -> 200, token present. |
| Audit summary | `GET /api/audit-logs/summary` with admin token -> 200 JSON `status=success`. |
| Export config | `GET /api/system-configs/export_max_rows` with pemerintah token -> 200 JSON `status=success`; `system_configs.export_max_rows` exists with value `50000`. |
| Public reports summary | `GET /api/public-reports/summary` with admin token -> 200 JSON `status=success`. |
| Public reports analytics | `/api/analytics/public-reports-summary`, `/public-reports-trend`, `/public-reports-top-regions` with admin token -> 200 JSON `status=success`. |
| Lock summary | `GET /api/distributions/lock-summary` with admin token -> 200 JSON `status=success`. |
| Dynamic detail routes | `GET /api/distributions/1` and `GET /api/public-reports/1` with admin token -> 200 JSON `status=success`. |
| Browser spot check | Login Demo Admin, open `/audit-log`: `/api/audit-logs/summary` -> 200. Open `/export`: `/api/system-configs/export_max_rows` -> 200 and no `/admin/system-configs` fallback request observed. Browser tool limit stopped further UI navigation; remaining report/lock pages verified by direct HTTP above. |

## Hotfix Verification 2026-05-23 - Priority Fallback Cleanup

| Check | Result |
|---|---|
| Stable backend endpoints | Dashboard analytics, analytics compare, budget, audit logs, export config/history, and public report summary/trend/top-region endpoints are treated as source of truth on the six priority pages. |
| Frontend failure behavior | If these stable endpoints fail, the UI now shows error state and clears rows/charts instead of injecting fallback data. |
| Frontend empty behavior | If these endpoints return an empty list, the UI shows an empty state such as `Belum ada data...`. |
| Retry export | `POST /api/exports/:id/retry` remains a backend follow-up; frontend no longer simulates retry success. |
