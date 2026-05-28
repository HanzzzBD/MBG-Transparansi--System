# Pre-Deployment Hardcoded Data Audit

Testing date: 2026-05-28

## Summary

Most core statistics visible in the tested pages came from API calls. P1 production-polish fixes removed visible TODO copy and put demo login shortcuts behind `VITE_SHOW_DEMO_LOGIN`. Remaining hardcoded items are mostly UI labels/options or non-production seed/helper scripts.

## Findings

| File | Line/section | Hardcoded value | Should be dynamic from | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `Frontend/src/pages/Login.jsx` | demo account panel | Demo Admin/SPPG/Pemerintah/Sekolah | QA/demo config only | Fixed | Demo shortcuts now require `VITE_SHOW_DEMO_LOGIN=true` in production; visible TODO text removed. |
| `Frontend/src/pages/Landing.jsx` | visible explanatory copy | "KPI publik diambil dari endpoint..." and "Marker diambil..." | Should be internal/dev note, not public UI | Low | Move developer notes to docs or hide behind dev flag. |
| `Frontend/src/pages/Landing.jsx` | `PROVINCES`, `REPORT_CATEGORIES`, `FEATURES` | Static province/category/features | Backend enums/config where possible | Low | Static options are acceptable, but keep categories synced with backend validation. |
| `Frontend/src/layouts/DashboardLayout.jsx` | menu arrays | Role menus and permission keys | Permission API plus local route map | Medium | Current use is normal, but continue checking against backend permission seeds. |
| `Frontend/src/pages/UserManagement.jsx` | `DEFAULT_ROLES`, permission group order | Role and permission groups | Backend `/roles`, `/permissions` | Low | Used as display fallback/order; ensure backend remains source for actual grant/deny. |
| `Frontend/src/pages/Settings` route in `App.jsx` | Minimal development placeholder | System config UI or hidden production route | Fixed | Settings route/menu are hidden in production unless `VITE_ENABLE_SETTINGS_PAGE=true`. |
| `Frontend/src/pages/PetaSPPG.jsx` and `PublicPetaSPPG.jsx` | Indonesia map bounds/center and status color config | Static geospatial constants/status labels | Backend for status values, map config optional | Low | Acceptable UI constants; status data itself is from backend. |
| `Frontend/src/pages/Anggaran.jsx` | BGN dataset/status labels | Static labels, dataset IDs, anomaly type IDs | Backend config/known enum | Low | Numeric BGN values now read from system configs; labels/options OK. |
| `Backend/prisma/seed.js` | default admin account | `admin@mbg.local` and default password fallback | Production env secret | High | Seed already blocks missing `SEED_ADMIN_PASSWORD` in production; verify production env never uses default. |
| `Backend/src/scripts/seedDemoUsers.js` | demo users/password `password` | Non-production demo seed only | Production seed must not run | High | Do not run demo seed in production; document deployment procedure. |
| `Backend/src/scripts/seedQaData.js` | QA users/data/password fallback | Non-production QA seed only | Low | Script exits in production; use only for local/staging QA. |
| `Backend/src/config/env.js` | default Dapodik semester/capacity | `20252`, `1` | Production env values | Medium | Ensure production `.env` sets intentional values. |
| `Backend/src/modules/exports/datasets.js` | default export dataset `distributions` | Explicit UI payload | Low after Anggaran PR | Anggaran now sends datasets; keep default documented. |
| `Backend/src/modules/foodPrices/service.js` | default costing constants | System configs if absent | Medium | Validate system-config seed contains production values; avoid silent fallback in production reporting. |

## Notable Non-Issues

| Area | Evidence | Conclusion |
| --- | --- | --- |
| Anggaran main KPI | Playwright `/anggaran` called `/analytics/budget-summary`, `/analytics/budget`, `/analytics/price-per-province`, and showed `Rp 62,8 Juta`. | Not dummy; fallback uses legacy API data. |
| Public landing KPI | Playwright `/` called `/api/public/statistics`; displayed `Data backend aktif`. | Not dummy. |
| Public map marker | Playwright `/peta-publik` called `/api/public/sppg`. | Not dummy. |
| Internal map marker status | Playwright `/peta` called `/api/sppg/map-markers`; AdminSppg list shows status. | Status comes from backend. |
| Export history | Playwright `/export` called `/api/exports`; failed old records are real backend data. | Not dummy. |
