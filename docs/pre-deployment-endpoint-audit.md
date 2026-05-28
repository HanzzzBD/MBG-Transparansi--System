# Pre-Deployment Endpoint Audit

Testing date: 2026-05-28 19:15 +07:00
Frontend: http://localhost:5173
Backend: http://localhost:4000/api
Method: route source review plus direct API requests using demo role tokens. Secret values are not included.

## Summary

| Area | Result |
| --- | --- |
| Public endpoints | Mostly OK; public statistics, budget, and public SPPG return 200 without auth. |
| Auth endpoints | OK for API direct login and P1 Playwright role smoke. |
| Admin/government endpoints | Mostly enforce 401/403 correctly. |
| SPPG/school scoped endpoints | P0 mismatches fixed; ownership and workflow tests pass. |
| Missing route mismatch | Dashboard role summary endpoints were incorrectly probed as `/dashboard/admin`, etc.; actual backend routes are `/dashboard/admin-summary`, `/dashboard/gov-summary`, `/dashboard/sppg-summary`, `/dashboard/school-summary`. |
| Public leakage risk | Public SPPG endpoint intentionally exposes id, name, coordinates, status, and safe summary only in current serializer. |

## Tested Endpoint Matrix

| Method | Endpoint | Used by frontend file/page | Auth required | Role required | Expected result | Actual status | Response shape valid? | Issue | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | deployment/monitoring | No | Public | Health JSON | 200 | Yes | None | - |
| GET | `/api/public/statistics` | Landing, PublicStatistik | No | Public | Public aggregate stats | 200 | Yes | None | - |
| GET | `/api/public/budget` | PublicStatistik | No | Public | Public aggregate budget | 200 | Yes | None | - |
| GET | `/api/public/sppg` | Landing, PublicPetaSPPG | No | Public | Safe marker/list data | 200 | Yes | None | - |
| GET | `/api/public/sppg/:id` | public SPPG detail flow | No | Public | Safe detail | Not fully clicked in this pass | Unknown | Needs deeper detail test | Medium |
| POST | `/api/public-reports` | Landing report form | No, captcha optional by config | Public | Create public report | Not mutated in this pass | Unknown | Needs invalid/valid form E2E with captcha config clarified | Medium |
| POST | `/api/auth/login` | Login | No | Public | Login and refresh cookie | 200 direct API and Playwright role smoke | Yes | None for P1 smoke | - |
| POST | `/api/auth/forgot-password` | ForgotPassword | No, rate limited | Public | Generic reset instruction response | 200 in backend tests | Yes | Production needs email provider; non-production returns reset token/link for QA only. | Low |
| POST | `/api/auth/reset-password` | ForgotPassword reset mode | No | Public with valid token | Update password, revoke sessions | 200 valid token, 400 invalid token in backend tests | Yes | None | - |
| POST | `/api/auth/session` | App boot | No | Public | Anonymous or refreshed session | 200 | Yes | None | - |
| POST | `/api/auth/refresh` | API client refresh | Cookie | Authenticated session | New access token | Covered by tests | Yes | None | - |
| POST | `/api/auth/logout` | Dashboard logout | Cookie | Authenticated session | Revoke refresh token | Covered by tests | Yes | None | - |
| GET | `/api/auth/me` | current user | Yes | Any authenticated | User profile | 401 no token, 200 with role token | Yes | None | - |
| GET | `/api/me/permissions` | App/DashboardLayout | Yes | Any authenticated | Effective permissions | 200 in Playwright | Yes | None | - |
| GET | `/api/analytics/summary` | Dashboard/Analytics | No in current router | Public-ish | Aggregate analytics | 200 for unauthenticated and all roles | Yes | Verify if public access is intended | Medium |
| GET | `/api/analytics/budget` | Anggaran fallback | Yes | admin, pemerintah | Legacy budget realization | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| GET | `/api/analytics/budget-summary` | Anggaran primary | Yes | admin, pemerintah | ProductionBatch costing summary | 401 none, 200 admin/gov, 403 sppg/school | Yes | QA seed now provides one non-production ProductionBatch | - |
| GET | `/api/analytics/price-per-province` | Anggaran | Yes | admin, pemerintah | SP2KP/province rows | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| GET | `/api/analytics/price-anomalies` | Anggaran legacy anomaly | Yes | admin, pemerintah | PRICE_ANOMALY rows | 200 in Playwright | Yes | Kept as legacy table | - |
| GET | `/api/sppg` | AdminSppg, internal SPPG lookup | Yes | Internal authenticated roles | SPPG list | 401 without token; 200 for authenticated admin smoke | Yes | Public must use `/api/public/sppg`. | - |
| GET | `/api/sppg/map-markers` | PetaSPPG | Yes | admin, pemerintah, sppg, sekolah | Marker data with status | 401 none, 200 all roles | Yes | School can access all map markers; confirm policy. | Medium |
| PATCH | `/api/sppg/:id/status` | AdminSppg status update | Yes | admin plus permission | Update operational status | Covered by tests/schema | Yes | Needs manual UI mutation retest after rate limit clears | Medium |
| POST | `/api/sppg` | AdminSppg create | Yes | admin | Create SPPG | Covered by backend tests | Yes | None | - |
| PUT/PATCH | `/api/sppg/:id` | AdminSppg edit | Yes | admin | Update SPPG | Covered by backend tests | Yes | None | - |
| GET | `/api/schools` | AdminSchools | Yes | admin, pemerintah | School list | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| POST/PUT/DELETE | `/api/schools` | AdminSchools CRUD | Yes | admin | Mutate school | Covered by tests partially | Yes | Needs full UI CRUD pass | Medium |
| GET | `/api/dapodik/staged-schools` | DapodikImport | Yes | admin | Staged Dapodik list | 401 none, 200 admin, 403 other roles | Yes | None | - |
| GET | `/api/sppg/me/schools` | SppgSchools | Yes | sppg | Scoped assigned schools | Tests pass | Yes | None | - |
| POST | `/api/sppg/me/schools/assign` | SppgSchools | Yes | sppg | Assign staged school | Tests pass | Yes | None | - |
| GET | `/api/distributions` | Distribusi, Riwayat, Lock/Unlock, Override | Yes | scoped roles | Distribution list | 401 none, 200 admin/gov/sppg/school | Yes | Scope appears enforced in tests | - |
| POST | `/api/distributions` | Distribusi | Yes | sppg/admin depending flow | Create distribution | 403 for unassigned school when payload is otherwise valid; 201 for active assignment | Shape OK | P0 fixed. 400 remains for invalid payload such as missing menuId in SPPG create flow. | - |
| PUT | `/api/distributions/:id` | Distribusi mark sent/update | Yes | scoped/permissioned | Update distribution | 200 for supervisor with `distribution.mark_sent` and verified menu; 403 for denied permission | Shape OK | P0 fixed. 409 remains for valid requests blocked by business precondition such as unverified/missing menu. | - |
| GET | `/api/validations` | Konfirmasi/Validasi | Yes | school/sppg/admin/gov scoped | Validation list | Tests mostly pass | Yes | None | - |
| PUT/PATCH | `/api/validations/:id` | Konfirmasi | Yes | school scoped | Confirm delivery | Tests pass | Yes | None | - |
| GET | `/api/production-batches` | ProductionBatches, Anggaran, Analytics | Yes | admin, pemerintah, sppg | Batch list | 401 none, 200 admin/gov/sppg, 403 school | Yes | QA seed creates one batch with rentCost/items | - |
| POST | `/api/production-batches` | ProductionBatches | Yes | admin/sppg | Create batch | Not mutated in this pass | Unknown | Needs full CRUD E2E | Medium |
| GET | `/api/production-batches/:id/cost-summary` | ProductionBatches detail | Yes | admin/gov/sppg scoped | Cost summary | Ready for QA seed batch | Yes expected | QA seed provides `productionBatchId` | - |
| GET | `/api/food-prices/latest` | SPPG menu/costing helper | Yes | admin/pemerintah in current test | Latest food prices | 401 none, 200 admin/gov, 403 sppg/school | Yes | Earlier expectation said SPPG may need food price read; current endpoint denies sppg. | Medium |
| GET | `/api/price-thresholds` | Admin/Gov threshold | Yes | admin, pemerintah | Threshold list | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| GET | `/api/price-thresholds/my-region` | SPPG menu/costing | Yes | sppg | Own threshold | 200 sppg, 403 admin/gov/school | Yes | None | - |
| GET | `/api/anomaly-logs` | Anomaly, Anggaran | Yes | admin, pemerintah | Anomaly list | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| PATCH | `/api/anomaly-logs/:id/resolve` | Anomaly/Anggaran helper | Yes | admin | Resolve anomaly | Seeded unresolved row available; click retest still optional | Yes expected | QA seed creates unresolved `RAW_MATERIAL_PRICE_ANOMALY`; do not auto-resolve during smoke. | Low |
| POST | `/api/qa/reset-login-rate-limit` | Local QA helper | No in non-production | Local/test only | Reset login limiter keys | Available only outside production | Yes | Must remain unavailable in production | - |
| GET | `/api/audit-logs` | AuditLog | Yes | admin, pemerintah plus permission | Audit list | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| GET | `/api/exports` | ExportData | Yes | admin, pemerintah | Export history | 401 none, 200 admin/gov, 403 sppg/school | Yes | None | - |
| POST | `/api/exports` | ExportData, Anggaran export buttons | Yes | admin, pemerintah | Create export job | Tests pass for valid, reject invalid date | Yes | Existing failed history remains by design | - |
| GET | `/api/public-reports` | LaporanMasyarakat | Yes | admin, pemerintah | Public report list | 401 none, 200 admin/gov, 403 sppg/school | Yes | SPPG/school cannot view public reports via this endpoint, despite earlier workflow mentioning relevant reports. Confirm product scope. | Medium |
| GET/POST | `/api/school-reports` | SchoolReports, SppgHistory, SppgIssues | Yes | scoped roles | School issue reports | 401 none, 200 all authenticated roles for list | Yes | Scope needs manual cross-role spot check; tests cover some cases | - |
| GET | `/api/users` | UserManagement | Yes | admin plus permission | User list | 401 none, 200 admin, 403 other roles | Yes | None | - |
| GET | `/api/roles` | UserManagement | Yes | admin | Role list | 401 none, 200 admin, 403 others | Yes | None | - |
| GET | `/api/permissions` | UserManagement permission panel | Yes | admin | Permission catalog | 401 none, 200 admin, 403 others | Yes | None | - |
| GET | `/api/monitoring/summary` | ApiMonitoring | Yes | admin | Monitoring summary | 401 none, 200 admin, 403 others | Yes | None | - |

## Endpoint Findings

| ID | Severity | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| EP-001 | Fixed | `/api/sppg` now requires authentication. | Backend test verifies `/api/sppg?limit=1` returns 401 without token and `/api/public/sppg?limit=1` remains 200. | Keep public map/detail on `/api/public/sppg` and `/api/public/sppg/:id`. |
| EP-002 | Fixed | Distribution send workflow test now uses a verified menu fixture. | `real-flow-permission-guards.test.js` passes; supervisor gets 200, denied operator gets 403. | Service precondition retained: sending without verified menu remains 409. |
| EP-003 | Fixed | Inactive/unassigned school distribution test now sends a valid payload before checking scope. | `sppg-operational-flow.test.js` passes; unassigned school returns 403 `SCHOOL_NOT_ASSIGNED_TO_SPPG`, active assignment returns 201. | Status-code policy documented in QA report. |
| EP-004 | Fixed | Browser login QA hit IP rate limit. | Non-production `/api/qa/reset-login-rate-limit` added and Playwright role smoke passed. | Keep helper disabled in production. |
| EP-005 | Fixed | ProductionBatch cost summary needed QA data. | `npm run seed:qa` creates ProductionBatch with rentCost/items and unresolved RAW_MATERIAL_PRICE_ANOMALY. | Run only outside production. |
| EP-006 | Medium | `/api/analytics/summary` is unauthenticated. | Direct request without token returned 200. | Confirm if this aggregate endpoint is intended public; otherwise protect with auth. |

## Route Inventory From Backend Review

This inventory is based on `Backend/src/routes/index.js` and module routers. Some routers use multi-line route declarations, so this is an operational inventory rather than an OpenAPI contract.

| Module | Mounted path | Routes/features observed | QA status |
| --- | --- | --- | --- |
| Root | `/api`, `/api/health` | API metadata and health check | Tested |
| auth | `/api/auth` | register, login, forgot-password, reset-password, session, refresh, logout, me | Tested by backend suite and Playwright role smoke |
| dashboard | `/api/dashboard` | admin-summary, gov-summary, sppg-summary, school-summary | Route reviewed; wrong guessed paths documented |
| analytics | `/api/analytics` | summary, by-province, budget, budget-summary, price-per-province, price-anomalies, public report analytics | Partially tested |
| public | `/api/public` | statistics, budget, sppg list, sppg detail | Partially tested |
| reports | root-mounted compat | public-reports, public report detail/status/follow-up, school-reports | Partially tested |
| sppg | `/api/sppg` | list, deleted, detail, operational detail, map markers, school channel, Dapodik school search, assign/unassign, profile, create/update/status/restore/delete | Partially tested |
| schools | `/api/schools` | list, detail, self profile update, deleted, create/update/restore/delete | Partially tested |
| dapodik | `/api/dapodik` | staged schools, detail, import, promote/link, search helpers | Partially tested |
| distributions | `/api/distributions` | list, detail, lock summary, create, update, mark sent, lock/unlock/override helpers | Tested with failures |
| validations | `/api/validations` | list, detail, update/confirm, patch | Tested by backend suite |
| productionBatches | `/api/production-batches`, `/api/production-batch-items` | list, detail, create/update/delete batch, create/list/update/delete items, cost summary, anomalies | Partially tested; QA seed data now available |
| qa | `/api/qa` | reset-login-rate-limit helper | Non-production helper only |
| foodPrices | `/api/food-prices` | list, latest, generate/import threshold related data | Partially tested |
| priceThresholds | `/api/price-thresholds` | list, my-region, generate from food prices | Partially tested |
| auditLogs | `/api/audit-logs` | list, summary, detail | Tested |
| exports | `/api/exports` | create, list, detail, retry, download | Tested by UI and backend tests |
| files | `/api/files` | upload | Negative and positive proof-upload tests pass; admin/SPPG/sekolah can upload images, invalid MIME/spoofed/oversized files return controlled 400 |
| proofs | root-mounted proof routes | create proof, detail/read proof | School proof attachment to own distribution tested; ownership remains enforced |
| menus | `/api/menus` | list, create, update, validate price, delete | Route reviewed; not fully tested |
| issues | `/api/issues` | list, create, update status | Partially tested via issue/status work |
| notifications | `/api/notifications` | list, read all, read one | Tested via layout |
| monitoring | `/api/monitoring` | summary, apis, errors, sync-sources, test API, sync source | Tested |
| users | `/api/users` | list, create, detail permissions, grant/deny/revoke/reset, status, update, restore, delete | Partially tested; permission tests pass |
| admin | `/api/admin` | legacy/admin roles, users, audit/anomaly logs, thresholds, configs, lock/unlock style routes | Partially tested |
| permissions | root-mounted | `/me/permissions`, `/permissions`, user permission management helpers | Tested |
| search | `/api/search` | global search | Tested by backend/frontend tests |
| compat | root-mounted | compatibility aliases for roles, users, anomaly resolve, dashboards/reports | Route reviewed; not exhaustively tested |
