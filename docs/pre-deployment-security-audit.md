# Pre-Deployment Security Audit

Testing date: 2026-05-28

## Authentication

| Check | Evidence | Status | Notes |
| --- | --- | --- | --- |
| API without token rejected | `/api/auth/me`, `/api/distributions`, `/api/exports`, `/api/users`, `/api/sppg` returned 401 without token. | Pass | Protected endpoints generally enforce auth. |
| Public endpoints accessible | `/api/public/statistics`, `/api/public/budget`, `/api/public/sppg` returned 200 without auth. | Pass | Intended public surface. |
| Login works via API/UI | QA seed users logged in successfully through Playwright for admin, SPPG, sekolah, and pemerintah. | Pass | Non-production seed accounts use `qa.*@mbg.local`. |
| Refresh token security | Backend tests verify HttpOnly cookie and hashed refresh token storage. | Pass | Covered by `security-role-guard.test.js`. |
| Logout revocation | Backend tests cover logout revoking session. | Pass | Not manually repeated in browser this pass. |
| Wrong password/rate limiting | Login IP limiter is 10 attempts per 20 minutes; auth tests pass. | Pass | Per-email limiter remains 5 attempts per 15 minutes; QA reset helper is non-production only. |
| Forgot password enumeration | Reset request returns generic success whether email exists or not. | Pass | Token is stored hashed, expires after 30 minutes, and non-production is the only mode that returns reset token/link in response. |
| Reset password session revocation | Resetting password revokes active sessions for the user. | Pass | Covered by backend password-reset service/test path. |
| Locked user login | Not manually tested in this pass. | Not tested | Needs dedicated lock/unlock account scenario. |

## Authorization

| Check | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Admin-only user management | `/api/users`, `/api/roles`, `/api/permissions` return 200 admin and 403 other roles. | Pass | Good backend enforcement. |
| Gov monitoring access | Gov token can access analytics/audit/export, cannot access users/monitoring admin endpoints. | Pass | Matches monitoring role. |
| SPPG scope | Tests cover SPPG not reading another SPPG distribution/search and valid distribution workflow. | Pass | P0 distribution workflow failures fixed. |
| School scope | Tests cover school validation isolation. | Pass | School validation E2E passed. |
| Public sensitive data | Public SPPG serializer only exposes safe status/basic marker fields. | Pass | Public endpoint should remain separate from `/api/sppg`. |
| Internal SPPG list unauthenticated | `/api/sppg?limit=1` now returns 401 without token. | Pass | Public users should use `/api/public/sppg`. |
| QA helper exposure | `/api/qa/reset-login-rate-limit` is mounted only for non-production behavior and returns disabled if `NODE_ENV=production`. | Pass | Helper resets login rate-limit keys and login attempt rows for local QA only. |

## Input Security

| Check | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Export invalid date validation | Backend tests pass for invalid date and reversed range. | Pass | No job should be created. |
| SPPG operational status enum | Tests pass for active/inactive/problem and reject unsupported values. | Pass | Good. |
| File upload validation | Invalid MIME, spoofed image content, and oversized upload requests return controlled 400 and create no file rows. | Pass | Backend now validates image signatures before storing metadata. |
| Distribution proof upload | School user can upload a local proof photo and attach it to its own distribution. | Pass | `/api/files/upload` and `/api/proofs` now allow `sekolah` with ownership checks. |
| XSS text input | Controlled issue payload with script/img markup is sanitized and returned as plain text without executable markup. | Pass | Frontend test also rejects `dangerouslySetInnerHTML` usage. |
| SQL injection search | Search injection payloads return 200 without stack/Prisma leakage and remain role-scoped. | Pass | Covered by backend negative security test. |

## Security Findings

| ID | Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Fixed | Authorization | `/api/sppg` is protected. | Backend test verifies no-token request returns 401 and public endpoint remains 200. | Keep internal list authenticated; keep public map on `/api/public/sppg`. |
| SEC-002 | Fixed | QA/Auth | Login IP limiter was too tight for QA role switching. | Updated IP limiter to 10 attempts per 20 minutes and added non-production reset helper; tests pass. | Keep helper disabled in production. |
| SEC-003 | Fixed | Production readiness | Demo shortcuts and visible developer copy must not ship by default. | Demo buttons are gated by `VITE_SHOW_DEMO_LOGIN`; visible developer copy removed. | Keep flag false in production. |
| SEC-004 | Fixed | Auth recovery | Forgot password had no real shipping behavior. | Implemented `PasswordResetToken`, generic request response, hashed tokens, 30-minute expiry, session revocation, and token reset UI. | Configure SMTP/email provider before public production self-service use. |
| SEC-005 | Fixed | Negative security | XSS/SQL/file upload negative tests were missing. | `Backend/test/negative-security.test.js` covers local-only storage, invalid MIME, spoofed image content, oversized upload, school proof upload, sanitized XSS input, and scoped search injection; `Frontend/test/negative-security.test.js` guards against unsafe HTML rendering and storage URL resolution. | Keep these tests in deployment gate. |
