# Pre-Deployment Data Sync Audit

Testing date: 2026-05-28

## Local Data Snapshot

| Model | Count |
| --- | ---: |
| users | 19 |
| sppg | 26491 |
| schools | 5 |
| distributions | 4 |
| validations | 4 |
| issues | 1 |
| school_reports | 4 |
| public_reports | 2 |
| audit_logs | 26979 |
| anomaly_logs | 1 |
| production_batches | 1+ after `npm run seed:qa` |
| food_prices | 2014 |
| price_thresholds | 4 |
| exports | 12 |
| permissions | 61 |
| role_permissions | 97 |

## Sync Checks

| Data area | Cross-role/API checked | Result | Status | Notes |
| --- | --- | --- | --- | --- |
| SPPG master/status | `/api/sppg`, `/api/sppg/map-markers`, AdminSppg, public map | Status field exists and UI shows Aktif/Tidak Aktif/Bermasalah; public map receives safe status. | Pass | `/api/sppg` is protected; public map uses `/api/public/sppg`. |
| Public map vs internal map | `/api/public/sppg`, `/api/sppg/map-markers` | Both source data from backend; public endpoint limits sensitive fields. | Pass | Manual marker color mutation not performed in this pass. |
| Anggaran total realization | `/analytics/budget-summary`, `/analytics/budget` | Anggaran shows legacy total `Rp 62,8 Juta` when batch costing is unavailable, and QA seed now provides batch costing data for non-production retest. | Pass | Correct PR 1 behavior plus P1 QA seed coverage. |
| ProductionBatch costing to Anggaran | `/production-batches`, `/analytics/budget-summary` | Non-production QA seed creates batch with `rentCost`, raw-material items, total/cost per portion. | Pass for QA seed | Run `npm run seed:qa` outside production before final staging smoke. |
| FoodPrice/PriceThreshold to Anggaran | `/analytics/price-per-province`, system configs | Anggaran shows SP2KP timestamp and BGN reference config. | Pass | Full anomaly threshold mutation not tested. |
| Anomaly to Anggaran/Anomaly page | `/api/anomaly-logs`, `/analytics/price-anomalies` | Both pages call anomaly endpoints; QA seed creates unresolved RAW_MATERIAL_PRICE_ANOMALY row. | Pass for QA seed | Resolve-button click can be tested without creating fake UI data. |
| Export from Anggaran/Export | `/api/exports` | Export page supports datasets; backend validates date filters. | Pass with caveat | Anggaran button request payload was previously fixed; network payload should be rechecked manually for click action. |
| Distributions and validations | `/api/distributions`, `/api/validations` | Lists and tests enforce role scope; QA seed creates delivered distribution + verified validation sample. | Pass | Backend tests now 91/91. |
| School reports | `/api/school-reports` | School/SPPG/admin/gov can list scoped data; tests cover isolation. | Pass | Public report to SPPG routing needs product confirmation. |
| Audit log | `/api/audit-logs` | Admin/gov visible; audit count large and UI displays rows. | Pass | No export log click performed. |
| Permissions | `/api/permissions`, `/api/users/:id/permissions` | Tests pass; UI visible for admin. | Pass | Need manual grant/deny UI interaction beyond code/test evidence. |

## Findings

| ID | Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| DS-001 | Fixed | ProductionBatch and budget costing QA data is available. | `npm run seed:qa` creates one batch including rentCost, items, and unresolved raw-material anomaly. | Keep seed disabled in production. |
| DS-002 | Fixed | Distribution workflow tests now pass, so SPPG action and downstream validation can be signed off for P0/P1 scope. | Backend `npm test`: 91/91 pass. | Keep verified-menu precondition documented. |
| DS-003 | Medium | Public reports are visible to admin/gov but not SPPG/school through `/api/public-reports`; product workflow says reports should enter admin/SPPG if relevant. | Direct API returned 403 for SPPG/school. | Clarify whether public reports should be assignable/scoped to SPPG. |
