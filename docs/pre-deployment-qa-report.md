# Pre-Deployment QA Report

## 1. Executive Summary

| Metric | Result |
| --- | --- |
| Overall status | P0 + P1 POLISH + NEGATIVE SECURITY TESTS FIXED, FINAL INFRA REVIEW REMAINING |
| Ready for deployment | Functionally ready with infrastructure warnings pending |
| Total tested features | 44 feature areas by code/API/Playwright smoke |
| Passed | 32 |
| Failed | 4 |
| Blocked/Partial | 8 |
| Critical issues | 0 open P0 |
| High issues | 0 open P0 |
| Medium issues | 9 |
| Low issues | 3 |

Main conclusion: P0 deployment blockers, the requested P1 polish items, forgot-password implementation, final negative security tests, and frontend bundle warning review have been handled. Backend and frontend tests are green, production build succeeds without the previous Vite chunk-size warning, migration deploy has no pending migrations, QA seed data is available for non-production smoke, and Playwright smoke passed for public, admin, SPPG, sekolah, and pemerintah roles. Remaining items are deployment-infra acceptance items, not current functional blockers.

## 2. Tested Environment

| Item | Value |
| --- | --- |
| Testing date | 2026-05-28 19:15 +07:00 |
| Branch | `testmodif` |
| Commit | `fc05ca2e49d3a001472c9ebcc4a37843199c864a` |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:4000/api` |
| Database | PostgreSQL `mbg_transparency` on localhost, schema `public` |
| Browser | Playwright Chromium via MCP |
| Tools | MCP Playwright, PowerShell, Node test runner, Vite build, Prisma migrate deploy, direct API requests |
| Test accounts | `qa.admin@mbg.local`, `qa.gov@mbg.local`, `qa.sppg@mbg.local`, `qa.sekolah@mbg.local` from non-production QA seed |
| Secrets | Not exposed in this report |

Initial status:

| Check | Result |
| --- | --- |
| Frontend reachable | 200 |
| Backend health | 200 |
| Migration deploy | No pending migrations |
| Frontend build | Succeeded; previous chunk-size warning resolved by lazy route splitting |
| Backend tests | Passed after local storage/proof upload fix: 91/91 |
| Frontend tests | Passed after local storage URL guardrail: 30/30 |
| QA seed | `npm run seed:qa` succeeded; disabled in production |
| Playwright role smoke | Public, admin, SPPG, sekolah, pemerintah passed; no console errors captured |

## Fixed Issues

| ID | Severity | Area | Fix | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-P0-001 | Critical | Backend tests | Updated distribution workflow fixtures to create/use verified menus, preserving the service rule that send/create requires verified menu data. | `Backend npm test`: 80 pass / 0 fail. | Fixed |
| FIX-P0-002 | Critical | Frontend tests | Updated school validation frontend test to assert the intentional query-param routes `/validasi?mode=konfirmasi` and `/validasi?mode=validasi`. | `Frontend npm test`: 26 pass / 0 fail. | Fixed |
| FIX-P0-003 | High | API security | Protected internal `GET /api/sppg` with authentication/internal role guard while keeping `/api/public/sppg` open for public map/list. | Added backend test: no-token `/api/sppg?limit=1` returns 401; `/api/public/sppg?limit=1` remains 200. | Fixed |
| FIX-P0-004 | High | Distribution status-code workflow | Confirmed status-code policy: 400 for invalid payload, 403 for forbidden/scope such as unassigned school, 409 for valid requests blocked by business state/precondition such as missing/unverified menu during send. | Backend distribution tests pass; rejected unassigned school create returns 403 with `SCHOOL_NOT_ASSIGNED_TO_SPPG`; supervisor send returns 200 with verified menu. | Fixed |
| FIX-P0-005 | Medium | Playwright smoke | Re-ran admin smoke for login, `/admin/sppg`, `/peta`, and `/production-batches`. | All pages loaded; API responses 200; no console errors captured. | Fixed |
| FIX-P1-001 | Medium | Login production polish | Demo login buttons now depend on `VITE_SHOW_DEMO_LOGIN`; visible TODO copy was removed from login and landing copy. | Frontend tests green; production build succeeded. | Fixed |
| FIX-P1-002 | Medium | Settings | `/settings` menu and route are hidden in production unless `VITE_ENABLE_SETTINGS_PAGE=true`; development still keeps a minimal placeholder. | Production `npm run build` succeeded; settings no longer ships by default. | Fixed |
| FIX-P1-003 | Medium | 404 UX | Unknown routes now render explicit `Halaman Tidak Ditemukan` instead of redirecting to landing/dashboard. | Playwright public smoke `/unknown-route-predeploy-smoke` shows 404 heading. | Fixed |
| FIX-P1-004 | Medium | QA data | Added non-production `npm run seed:qa` with ProductionBatch + `rentCost` + items, unresolved `RAW_MATERIAL_PRICE_ANOMALY`, public report, distribution, and validation sample. | `npm run seed:qa` succeeded; created QA users and sample IDs. | Fixed |
| FIX-P1-005 | Medium | Login QA helper | Added non-production `POST /api/qa/reset-login-rate-limit`; production route is disabled and limiter behavior is unchanged. | Backend tests green; Playwright role smoke completed after QA seed. | Fixed |
| FIX-P1-006 | Medium | Forgot password | Implemented `/forgot-password` and `/reset-password` UI plus backend `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`. Tokens are stored hashed, expire in 30 minutes, generic responses prevent email enumeration, sessions are revoked after reset, and non-production returns a reset link for QA only. | `Backend npm test`: 83 pass / 0 fail; `Frontend npm test`: 26 pass / 0 fail; `Frontend npm run build` succeeded. | Fixed |
| FIX-P1-007 | High | Negative security tests | Added automated invalid upload, spoofed image signature, oversized upload, XSS input, and search injection/scope tests. Upload now validates image magic bytes before storing files. Frontend test guards against `dangerouslySetInnerHTML` and unsafe search rendering. | `Backend npm test`: 88 pass / 0 fail; `Frontend npm test`: 29 pass / 0 fail. | Fixed |
| FIX-P1-008 | Medium | Frontend bundle | Converted route pages to lazy imports and wrapped routes with Suspense, splitting map/chart/admin pages out of the initial bundle. | `Frontend npm run build` succeeds without previous >1000 kB chunk warning; main JS about 220 kB, chart/map chunks split separately. | Fixed |
| FIX-P1-009 | High | Local storage and proof upload | Storage is now local-only, `/api/files/upload` and `/api/proofs` allow school users for distribution proof uploads with ownership checks, and frontend local `/storage/...` URLs resolve against the backend API origin. | `Backend npm test`: 91 pass / 0 fail; `Frontend npm test`: 30 pass / 0 fail; build succeeded. | Fixed |

## 3. Role Testing Summary

| Role | Allowed pages | Forbidden pages | Actual result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Public/guest | `/`, `/peta-publik`, `/statistik`, `/anggaran-publik`, `/login` | Internal dashboard/admin/export/audit APIs | Public pages loaded; public APIs 200. Protected APIs return 401/403. | Pass | `/api/sppg` now returns 401 without auth; public SPPG remains on `/api/public/sppg`. |
| admin | Dashboard, peta, analytics, anggaran, anomaly, audit, export, reports, SPPG/school/user/Dapodik/monitoring/lock/override | None expected for admin | Admin QA smoke loaded `/dashboard`, `/admin/sppg`, `/peta`, `/production-batches`. | Pass | Settings is hidden from production unless explicitly enabled. |
| pemerintah/gov | Dashboard monitoring, peta, analytics, anggaran, laporan, anomaly, audit, export | Users, permissions, Dapodik mutation, API monitoring admin | QA browser smoke loaded dashboard, peta, analytics, anggaran. | Pass | Non-production QA seed provides `qa.gov@mbg.local`. |
| sppg | Menu, sekolah saluran, distribusi, production batch, kendala, riwayat, profil | Users, exports, audit, schools master, admin endpoints | API direct showed scoped endpoints mostly 200 and admin/gov endpoints 403. | Pass for P0 | Distribution workflow tests now pass with verified-menu fixture. |
| sekolah | Konfirmasi/validasi, laporan sekolah, riwayat, profil | SPPG mutation, users, exports, audit, production batch | API direct showed school allowed validations/distributions/school reports and blocked admin endpoints. | Pass for P0 | Frontend route test updated for query-param validation route. |
| umum | Not visible in main UI flow | Internal pages | Role exists in enum but no dedicated workflow tested. | Not tested | Need product decision whether `umum` is used. |

## 4. Feature Testing Summary

| Feature | Result | Evidence | Status |
| --- | --- | --- | --- |
| Login | API and Playwright role login succeeded for QA seed users. | Playwright admin/SPPG/sekolah/pemerintah smoke. | Pass |
| Logout/session/refresh | Covered by backend tests. | Security role guard tests pass. | Pass |
| Register | Admin-only route exists. | Code route review. | Not fully tested |
| Forgot password | Email request and token-based reset flow implemented. | Backend password reset tests; Playwright route smoke for `/forgot-password` and `/reset-password`; build/test green. | Pass |
| Dashboard | Admin dashboard loaded. | Playwright `/dashboard`. | Pass |
| Landing page | Loaded with backend KPI. | Playwright `/`. | Pass |
| Public map | Loaded marker data. | Playwright `/peta-publik`. | Pass |
| Internal map | Loaded marker data. | Playwright `/peta`. | Pass |
| Public SPPG detail | Endpoint exists. | Route review. | Not fully clicked |
| Internal SPPG detail | Endpoint/page support exists. | Route/API review. | Partial |
| Marker active/inactive/problem | Status supported in DB/UI/filter. | Schema, AdminSppg, Peta routes. | Pass with mutation gap |
| Analytics | Loaded. | Playwright `/analytics`. | Pass |
| Anggaran | Loaded unified summary and BGN indicators. | Playwright `/anggaran`, Rp 62,8 Juta. | Pass |
| Budget summary | Primary and fallback endpoints called. | Network evidence. | Pass |
| Cost per portion | Visible, but ProductionBatch data absent. | `/anggaran`, `/production-batches`. | Partial |
| Production batch | Page/form loads, rentCost visible; QA seed creates sample batch. | Playwright `/production-batches`; `npm run seed:qa`. | Pass |
| Cost summary | Endpoint exists and has QA batch data for non-production retest. | QA seed `productionBatchId`. | Pass for QA seed |
| Raw/operational/packaging/distribution/rent cost | Form fields present. | Playwright page text. | Partial |
| SP2KP/Price threshold | Endpoints return 200 for admin/gov and SPPG my-region. | API direct. | Pass |
| Price anomaly | Endpoints/pages load. | `/anomaly`, `/anggaran`. | Pass |
| RAW_MATERIAL_PRICE_ANOMALY | Supported in enum/page text and QA seed creates unresolved row. | `npm run seed:qa`. | Pass for QA seed |
| Laporan masyarakat | Admin page loads. | Playwright `/laporan-masyarakat`. | Pass |
| Laporan sekolah | API tests pass. | Backend school validation and permission tests. | Pass |
| Konfirmasi distribusi | Backend school validation tests pass. | `school-validation-flow.e2e.test.js`. | Pass |
| Laporkan masalah distribusi | Backend tests pass for school reports. | Test output. | Pass |
| Audit log | Admin page loads and rows visible. | Playwright `/audit-log`. | Pass |
| Export | Page loads; backend validation tests pass. | Playwright `/export`, tests. | Pass with warning |
| SPPG management | Page loads and status filter visible. | Playwright `/admin/sppg`. | Pass |
| School management | Page loads. | Playwright `/admin/schools`. | Pass |
| Dapodik management | Page loads large staging dataset. | Playwright `/dapodik`. | Pass |
| User management | Page loads. | Playwright `/users`. | Pass |
| Lock/unlock | Page loads. | Playwright `/lock-unlock`. | Pass |
| Override | Page loads. | Playwright `/override`. | Pass |
| API monitoring | Page loads. | Playwright `/api-monitoring`. | Pass |
| Settings | Hidden from production unless `VITE_ENABLE_SETTINGS_PAGE=true`; dev placeholder retained. | Source/build review. | Pass by hide |
| Grant/permission | API tests pass; UI exists. | Tests and `/users` page. | Pass with UI mutation gap |
| Upload file/foto | Local storage only; invalid MIME/spoofed/oversized uploads are rejected; school proof upload to own distribution works; frontend resolves `/storage/...` to backend origin. | `negative-security.test.js`, frontend negative security guardrail. | Pass |
| Search/filter/sort/pagination | Search tests pass, including injection payload scope guard. | UI and tests. | Pass for sampled search |
| Empty state | ProductionBatch/anomaly empty states visible. | Playwright. | Pass |
| Error state | Export friendly errors tested; login rate-limit shown. | Tests/Playwright. | Pass |
| Loading/skeleton | Not deeply inspected. | - | Partial |
| Responsive | Public pages no horizontal overflow mobile. | Playwright mobile DOM check. | Partial |
| Dark mode | Not found/tested. | - | Not applicable/unknown |
| Sidebar active state | Admin sidebar visible. | Playwright. | Pass |
| 404 page | Unknown route shows explicit 404 page. | Playwright `/unknown-route-predeploy-smoke`. | Pass |
| 403/unauthorized handling | Backend returns 401/403; frontend route blocking partially tested. | API direct. | Pass with UI gap |
| Token expired | Covered by refresh tests for API client. | Frontend/backend tests. | Pass |

## 5. Workflow Testing Summary

| Workflow | Result | Status | Notes |
| --- | --- | --- | --- |
| Public user | Landing, public map, public stats load from backend. | Pass with gap | Report submission not mutated in this pass. |
| Admin | Main admin pages load and API roles enforce sampled access. | Pass | Settings is hidden in production unless enabled; tests pass. |
| SPPG | Backend scoped endpoints pass for P0. | Pass | Distribution workflow tests green after verified-menu fixture. |
| Sekolah | Validation/report tests pass for P0. | Pass | Frontend route assertion green after query-param route update. |
| Pemerintah/gov | Direct API access aligns with monitoring role; browser QA smoke passed. | Pass | - |

## 6. Endpoint Testing Summary

See `docs/pre-deployment-endpoint-audit.md`.

Key endpoint result:

| Category | Result |
| --- | --- |
| Public read endpoints | OK |
| Auth protected endpoints | OK for P0 sampled/failing areas |
| Admin-only endpoints | OK |
| SPPG/school scope | OK for P0 sampled/failing areas |
| Endpoint errors | No 500 found in sampled endpoints |
| Concern | Resolved: `/api/sppg` unauthenticated now 401 |

## 7. Data Sync Summary

See `docs/pre-deployment-data-sync-audit.md`.

Main data gap fixed for non-production QA: `npm run seed:qa` creates ProductionBatch data with `rentCost`, raw-material items, an unresolved `RAW_MATERIAL_PRICE_ANOMALY`, public report, distribution, and validation sample.

## 8. Security Summary

See `docs/pre-deployment-security-audit.md`.

Main P0 security concern is resolved: unauthenticated `/api/sppg` access now returns 401. Final negative security tests for invalid upload, XSS input, and search injection are automated and passing.

## 9. UI/UX Summary

See `docs/pre-deployment-ui-ux-audit.md`.

Main P1 UI concerns are fixed: demo login is env-flagged, visible TODO copy was removed, Settings is hidden in production unless enabled, and unknown routes show an explicit 404 page.

## 10. Bugs Found

| ID | Severity | Area | Role | Steps to reproduce | Expected | Actual | Evidence | Suggested fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | Critical | Backend tests | All | Run `npm test` in `Backend`. | All tests pass. | Previously 77 pass, 2 fail; now 80 pass, 0 fail. | Test output. | Fixed verified-menu fixtures and route security test. | Fixed |
| BUG-002 | Critical | Frontend tests | School | Run `npm test` in `Frontend`. | All tests pass. | Previously 25 pass, 1 fail; now 26 pass, 0 fail. | `school-validation-flow.test.js`. | Updated assertion for query-param based validation route. | Fixed |
| BUG-003 | High | API auth | Public | Request `GET /api/sppg?page=1&limit=2` without token. | 401/403 or safe public shape only. | Now 401 `AUTH_TOKEN_MISSING`. | Direct API/test audit. | Protected internal route; public remains `/api/public/sppg`. | Fixed |
| BUG-004 | High | Distribution workflow | SPPG | Backend test supervisor mark sent. | 200 when permission and verified menu precondition are satisfied. | Now 200. | `real-flow-permission-guards.test.js`. | Added verified menu fixture; service rule unchanged. | Fixed |
| BUG-005 | High | Distribution validation | SPPG | Backend test create distribution to unassigned school with valid payload. | 403 `SCHOOL_NOT_ASSIGNED_TO_SPPG`. | Now 403. | `sppg-operational-flow.test.js`. | Added menuId to make payload valid before scope check. | Fixed |
| BUG-006 | Medium | Login QA | All roles | Repeated Playwright login role switching. | Login possible for role QA. | QA helper now available outside production and role smoke passed. | Playwright role smoke; `/api/qa/reset-login-rate-limit`. | Added non-production reset helper. | Fixed |
| BUG-007 | Medium | Settings | Admin | Open `/settings`. | Usable settings panel or hidden menu. | Hidden from production by `VITE_ENABLE_SETTINGS_PAGE=false` default. | Source/build review. | Hide until real backend config panel ships. | Fixed |
| BUG-008 | Medium | ProductionBatch QA | Admin/SPPG | Open `/production-batches`. | Can verify cost summary with data. | QA seed creates sample batch with rent/items/anomaly. | `npm run seed:qa`. | Added non-production QA seed. | Fixed |
| BUG-009 | Medium | Login UI | Public | Open `/login`. | Production-safe copy. | Demo buttons controlled by env; TODO copy removed. | Source/build review. | Hide by env flag. | Fixed |
| BUG-010 | Medium | 404 | Public | Open `/not-found-route`. | 404 page. | Explicit 404 page appears. | Playwright `/unknown-route-predeploy-smoke`. | Add 404 route. | Fixed |
| BUG-011 | Medium | Analytics auth | Public | Request `/api/analytics/summary` without token. | Auth required unless public by design. | 200. | Direct API audit. | Confirm product policy and protect if internal. | Open |
| BUG-012 | Low | Export navigation | Admin | Rapidly navigate through `/export`. | No visible user error. | `net::ERR_ABORTED` in request log only. | Playwright. | Already likely handled; monitor. | Open |
| BUG-013 | High | Upload security | Admin/SPPG | Upload HTML/SVG payload as `image/png`. | Reject before storing file metadata. | Now 400 `FILE_CONTENT_NOT_ALLOWED`; no file row created. | `Backend/test/negative-security.test.js`. | Added image signature validation. | Fixed |

## 11. Missing Features

| Feature | Expected behavior | Current behavior | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Settings panel | Admin can manage system configs or page hidden. | Hidden from production unless enabled. | Low | Implement real backend config panel in a later PR if needed. |
| Forgot password | Reset flow or disabled link. | Implemented with secure token model; production still needs email provider delivery to send reset links. | Low | Configure SMTP/email service before public self-service password reset is enabled in production. |
| Distinct 404 page | User sees clear not-found page. | Explicit 404 page added. | Fixed | Keep route in production. |
| Production QA seed | One batch, anomaly, public report, scoped role data. | Non-production QA seed added. | Fixed | Run `npm run seed:qa` only outside production. |
| Public report routing to SPPG | Relevant SPPG can see assigned public report if product expects it. | SPPG 403 on `/public-reports`. | Medium | Clarify workflow; add assignment/scoped endpoint if needed. |
| Full upload validation E2E | Valid/invalid file upload tested. | Invalid upload cases are covered by backend tests; valid browser upload remains a normal workflow smoke follow-up. | Low | Add Playwright valid upload fixture later if needed. |

## 12. Hardcoded/Dummy Data

See `docs/pre-deployment-hardcoded-data-audit.md`.

Highest-risk items:

| Item | Risk |
| --- | --- |
| Demo users/login buttons | Env-flagged off by default in production. |
| Seed default admin fallback | Safe only if production env enforces password. |
| Static visible developer copy on landing | Low polish issue, but not ideal for public production. |

## 13. Deployment Readiness

Final status: P0 + P1 POLISH + NEGATIVE SECURITY FIXED, FINAL INFRA REVIEW REMAINING

Blocking issues:

1. P0 blockers fixed.
2. Requested P1 polish fixed.
3. Remaining items need product/deployment acceptance: production email delivery for forgot-password and production domain/CORS/local storage permissions/backup/logging verification.

Must fix before deployment:

1. Configure production email delivery for forgot-password reset links.
2. Verify production domain/CORS/local storage permissions/backup/logging.

Can fix after deployment only with acceptance:

1. Public UI copy that mentions backend endpoints.

## 14. Recommended PR Breakdown

| PR title | Scope | Files likely affected | Risk | Priority |
| --- | --- | --- | --- | --- |
| Fix failing distribution workflow tests | Resolve 409 vs 200 and 400 vs 403 mismatches | `Backend/test/real-flow-permission-guards.test.js`, `Backend/test/sppg-operational-flow.test.js` | Medium | P0 - Done |
| Secure SPPG internal list route | Require auth or sanitize public shape | `Backend/src/modules/sppg/router.js`, `Backend/test/public-feature.test.js` | Medium | P0 - Done |
| Fix frontend school validation route test | Align route/menu assertion with current query-param based validasi routes | `Frontend/test/school-validation-flow.test.js` | Low | P0 - Done |
| Hide demo login UI in production | Env flag for demo shortcuts and remove visible developer copy | `Frontend/src/pages/Login.jsx`, env docs | Low | P1 - Done |
| Add QA seed for costing/anomaly | Non-prod seed: ProductionBatch with rentCost and unresolved anomaly | `Backend/src/scripts/seedQaData.js` | Medium | P1 - Done |
| Settings/forgot-password shipping decision | Settings hidden in production; forgot-password implemented with token reset flow | `Frontend/src/App.jsx`, `DashboardLayout.jsx`, `Login.jsx`, `ForgotPassword.jsx`, backend auth module | Low | P1 - Done |
| Complete negative security tests | XSS, SQL injection search, upload invalid file | `Backend/test/negative-security.test.js`, `Frontend/test/negative-security.test.js`, `Backend/src/modules/files/upload.js`, `Backend/src/modules/files/service.js` | Medium | P1 - Done |
| Resolve Vite chunk warning | Lazy route imports and split heavy route chunks | `Frontend/src/App.jsx` | Low | P1 - Done |
| Fix local upload proof flow | Local storage only, school proof upload authorization, backend-origin storage URLs | `Backend/src/config/storage.js`, `Backend/src/modules/files/router.js`, `Backend/src/modules/proofs/*`, `Frontend/src/services/api.js`, `Distribusi.jsx`, `SppgMenu.jsx` | Medium | P1 - Done |
