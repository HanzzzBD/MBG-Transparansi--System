# Pre-Deployment UI/UX Audit

Testing date: 2026-05-28
Browser: Playwright Chromium through MCP
Viewports checked: desktop 1365x900 and mobile 390x844 for public pages.

## Playwright Smoke Results

| Page | Desktop result | API calls | Console/network issues | Status |
| --- | --- | --- | --- | --- |
| `/` | Landing loads; public KPI displayed from backend. | `/auth/session`, `/public/statistics`, `/public/sppg` | None | Pass |
| `/peta-publik` | Public map page loads marker list/filter UI. | `/auth/session`, `/public/sppg` | None | Pass |
| `/statistik` | Public statistics/budget loads. | `/public/statistics`, `/public/budget` | None | Pass |
| `/login` | Login form loads; demo buttons are env-flagged and TODO copy removed. | `/auth/session` | None in role smoke. | Pass |
| `/dashboard` admin | Dashboard loads with backend-active state. | session, permissions, notifications, analytics | None | Pass |
| `/peta` admin | Internal map loads and calls marker API. | `/sppg/map-markers` | None | Pass |
| `/analytics` admin | Analytics loads; shows empty costing message when no ProductionBatch. | analytics, production-batches, anomaly logs | None | Pass |
| `/anggaran` admin | Budget loads; total used `Rp 62,8 Juta`, BGN indicators visible, timestamp from sources. | budget summary, legacy budget, configs, anomalies, production batches | None | Pass |
| `/anomaly` admin | Empty anomaly state visible for unresolved filter. | `/anomaly-logs?status=unresolved` | None | Pass |
| `/audit-log` admin | Audit rows and filters visible. | `/audit-logs/summary`, `/audit-logs` | None | Pass |
| `/export` admin | Export form/history visible. | `/system-configs/export_max_rows`, `/exports` | Abort logged when rapidly navigating away; not a 500. | Warning |
| `/laporan-masyarakat` admin | Public report dashboard loads. | public reports and analytics | None | Pass |
| `/admin/sppg` admin | Master SPPG loads with status filter. | `/sppg` | None | Pass |
| `/admin/schools` admin | School list loads. | `/schools` | None | Pass |
| `/dapodik` admin | Staged Dapodik page loads large dataset. | `/dapodik/staged-schools` | None | Pass |
| `/users` admin | User/role table loads. | `/roles`, `/users` | None | Pass |
| `/lock-unlock` admin | Lock/unlock page loads. | distributions and audit logs | None | Pass |
| `/override` admin | Override page loads. | locked distributions, audit logs | None | Pass |
| `/settings` admin | Hidden from production unless `VITE_ENABLE_SETTINGS_PAGE=true`; dev placeholder retained. | session/permissions/notifications | None | Pass by hide |
| `/api-monitoring` admin | Monitoring page loads. | monitoring endpoints | None | Pass |
| `/production-batches` admin | Page and form load; rentCost field visible; QA seed provides sample batch. | `/production-batches` | None | Pass |
| unknown route | Explicit 404 page appears. | frontend route only | None | Pass |

## Responsive Checks

| Viewport | Pages checked | Result | Notes |
| --- | --- | --- | --- |
| Mobile 390x844 | `/`, `/peta-publik`, `/login` | No horizontal overflow detected by DOM check. | Deeper internal mobile dashboard remains a follow-up responsive pass. |
| Desktop 1365x900 | Admin and public routes above | Layout usable in smoke pass. | Tables are dense but readable on desktop. |

## UX Findings

| ID | Severity | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| UX-001 | Fixed | Settings route is hidden from production unless explicitly enabled. | `VITE_ENABLE_SETTINGS_PAGE`; production build. | Implement full config panel later if needed. |
| UX-002 | Fixed | Demo/TODO copy is no longer visible by default in production. | `VITE_SHOW_DEMO_LOGIN`; source/build review. | Keep flag false in production. |
| UX-003 | Fixed | QA role switching has non-production reset helper and QA seed users. | Playwright role smoke passed. | Keep helper disabled in production. |
| UX-004 | Low | Export page records aborted requests when navigating quickly. | Playwright failed request `net::ERR_ABORTED`. | Mostly harmless; keep aborts out of user-facing errors. |
| UX-005 | Fixed | Unknown route shows explicit `Halaman Tidak Ditemukan`. | Playwright `/unknown-route-predeploy-smoke`. | Keep explicit 404 route. |
| UX-006 | Fixed | Previous Vite build warning showed the initial JS chunk above 1000 kB. | Route-level lazy imports split page, chart, and map chunks; production build now succeeds without the chunk-size warning. | Keep route-level code splitting and monitor future large dependencies. |
| UX-007 | Fixed | Public map could look like only a few DKI Jakarta markers even when hundreds of records were displayed because dense/overlapping canvas points visually stacked; marker click also opened a popup that blocked the map. | `PublicPetaSPPG.jsx` now groups dense screen buckets with count badges and marker click opens the public-safe detail panel directly. Frontend tests/build passed. | Backend coordinates remain unchanged; if many SPPG share exact coordinates, improve source geocoding later. |
