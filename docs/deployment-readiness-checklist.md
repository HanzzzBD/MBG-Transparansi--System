# Deployment Readiness Checklist

Testing date: 2026-05-28

Final status: READY WITH WARNING

Reason: P0 blockers, requested P1 polish, forgot-password implementation, negative security tests, local storage upload flow, and frontend bundle review are fixed. Backend/frontend tests pass, production build succeeds without the previous chunk-size warning, migration deploy has no pending migrations, non-production QA seed is available, and Playwright smoke passed for public/admin/SPPG/sekolah/pemerintah. Remaining warnings are deployment-infra acceptance items.

## Checklist

| Item | Status | Evidence/Notes |
| --- | --- | --- |
| Frontend build succeeds | PASS | `npm run build` in `Frontend` succeeded. |
| Frontend build warnings reviewed | PASS | Route-level lazy loading removed the previous Vite >1000 kB chunk warning; main JS is about 220 kB and chart/map chunks are split. |
| Backend starts | PASS | Local backend on `http://localhost:4000`; `/api/health` 200. |
| Frontend starts | PASS | Local frontend on `http://localhost:5173`; page 200. |
| Migration deploy safe | PASS | `npx prisma migrate deploy`: no pending migrations. |
| Backend tests pass | PASS | `npm test`: 91 pass, 0 fail. |
| Frontend tests pass | PASS | `npm test`: 30 pass, 0 fail. |
| Database configured | PASS | Backend `.env.example` includes `DATABASE_URL`; local DB `mbg_transparency`. |
| JWT/session config present | PASS | `.env.example` includes JWT access/refresh secrets. |
| CORS config present | PASS | `.env.example` includes `CLIENT_URL`; backend uses CORS options. |
| Storage/upload config present | PASS | Storage is local-only via `STORAGE_PROVIDER=local`; invalid MIME, spoofed image content, oversized upload, and school proof upload tests pass. |
| Frontend API base URL present | PASS | `Frontend/.env.example` includes `VITE_API_URL`. |
| Production env ready | WARNING | Not verified against real `.env.production`; do not expose secret values. |
| Seed production safe | PASS | Main seed blocks default admin password in production; QA seed exits when `NODE_ENV=production`. |
| CORS production ready | WARNING | Needs deployment domain verification. |
| API base URL production ready | WARNING | Needs final domain/env confirmation. |
| Storage link/upload ready | PASS WITH WARNING | Local upload/proof flow passes; production server still needs writable `Backend/storage` permissions and static `/storage` serving behind reverse proxy. |
| Database backup strategy | NOT VERIFIED | No backup plan found in this pass. |
| Error logging | WARNING | Backend has morgan/error handler; production external logging not verified. |
| Rate limit public endpoint | PASS | Public limiter exists; login IP limiter is 10 attempts / 20 minutes; QA reset helper is non-production only. |
| HTTPS/domain readiness | NOT VERIFIED | Needs infrastructure check. |
| Reverse proxy notes | NOT VERIFIED | No nginx/apache notes verified. |
| File permission | NOT VERIFIED | Needs server environment check. |
| Queue/scheduler | WARNING | BullMQ/node-cron dependencies exist; export queue visible. Redis production readiness not verified. |
| Cron job | WARNING | Runtime notification cron exists; production schedule not verified. |
| Monitoring endpoint | PASS | `/api/health`, `/api/monitoring/*` for admin. |
| Health check endpoint | PASS | `/api/health` returns 200. |
| Default admin account safe | WARNING | Production must set `SEED_ADMIN_PASSWORD`; verify before deploy. |
| No secrets in repo | WARNING | `.env` files exist locally; not exposing values here. Verify gitignore and history before deploy. |
| No dangerous console.log/debug | WARNING | Server/script console logs are present; no browser debug or visible developer TODO found in P1 smoke. |
| No dummy data production | PASS | Demo login UI is env-flagged off by default in production; QA seed is non-production only. |
| No endpoint debug open | PASS | Internal `/api/sppg` requires auth; public SPPG data uses `/api/public/sppg`. |
| Forgot password shipping behavior | PASS WITH WARNING | Implemented token reset flow; production needs SMTP/email delivery before public self-service reset links can be sent. |

## Blocking Issues

| ID | Severity | Blocker |
| --- | --- | --- |
| BLOCK-001 | Fixed | Backend test suite passes: 91/91. |
| BLOCK-002 | Fixed | Frontend test suite passes: 30/30. |
| BLOCK-003 | Fixed | `/api/sppg` now requires auth; public uses `/api/public/sppg`. |
| BLOCK-004 | Fixed | Distribution workflow backend assertions pass. |

## Must Fix Before Deployment

1. Configure production email delivery for forgot-password reset links.
2. Verify production domain/CORS/local storage directory permissions/backup/error logging.

## Can Fix After Deployment Only If Explicitly Accepted

| Item | Risk |
| --- | --- |
| Vite chunk size/code splitting | Fixed; keep monitoring as pages grow. |
| Settings page | Hidden in production unless `VITE_ENABLE_SETTINGS_PAGE=true`; implement real config panel later if needed. |
| Dedicated 404 page | Fixed; explicit 404 route added. |
| Public copy mentioning backend endpoints | Low polish/security-by-obscurity concern. |
