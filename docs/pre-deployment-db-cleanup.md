# Pre-Deployment Database Cleanup

Date: 2026-05-28

## Backup

A database dump was created before cleanup:

`Backend/storage/backups/pre-cleanup-20260528-210140.dump`

## Preserve Rules

Preserved:

- Imported SPPG dataset
- Admin users that are not QA/test accounts
- Dapodik data
- Permissions and role permissions
- System configs
- Food price and price threshold reference data

Removed:

- QA/test users and non-admin users
- Local schools and school assignments
- Distributions and validations
- Production batches and items
- Menus
- Issues, school reports, public reports
- Anomaly logs
- Audit logs
- Export/file/proof history
- Login attempts and sessions
- SPPG rows with explicit QA/test naming

## Final Counts

| Model | Count |
| --- | ---: |
| users | 3 |
| adminUsers | 3 |
| nonAdminUsers | 0 |
| sppg | 26487 |
| schools | 0 |
| dapodikSchool | 63806 |
| distributions | 0 |
| validations | 0 |
| productionBatches | 0 |
| anomalyLogs | 0 |
| publicReports | 0 |
| auditLogs | 0 |
| exports | 0 |
| loginAttempts | 0 |
| sessions | 0 |
| permissions | 61 |
| rolePermissions | 97 |
| systemConfigs | 7 |
| foodPrices | 2014 |
| priceThresholds | 8 |

Backend health after cleanup: `200`.
