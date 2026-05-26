# Playwright Fix PR Report
# Playwright Fix PR Report

## Summary

- Total issue fixed: 10 fixed/improved by code, test, or fixture.
- Total issue remaining: 3 verification gaps.
- Follow-up implementation: SPPG school assignment flow added after cleanup, documented in `docs/sppg-school-assignment-flow.md`.
- Test command:
  - `npm.cmd --prefix Frontend test` PASS, 24 tests.
  - `npm.cmd --prefix Frontend run lint` PASS.
  - `npm.cmd --prefix Frontend run build` PASS with existing Vite chunk-size warning.
  - `npm.cmd --prefix Backend test` PASS, 33 tests.
- Build result: PASS.
- Browser smoke: not rerun because MCP Playwright profile was locked by another local instance.

## Fixed Issues

| Issue | Old Status | New Status | Evidence |
|---|---|---|---|
| Abort text visible on `/distribusi` | WARNING | Fixed by code/test guard | `isAbortError` used in `Distribusi.jsx`; frontend test PASS |
| Abort text visible on SPPG `/riwayat` | WARNING | Fixed by code/test guard | rejected abort results ignored in `SppgHistory.jsx`; frontend test PASS |
| Abort text visible on Sekolah `/riwayat` | WARNING | Fixed by code/test guard | rejected abort results ignored in `SchoolHistory.jsx`; frontend test PASS |
| Recharts width/height `-1` on `/dashboard` | WARNING | Fixed by code/test guard | dashboard charts use `height={320}` and stable CSS |
| Recharts width/height `-1` on `/anggaran` | WARNING | Fixed by code/test guard | budget chart uses `height={320}` and stable CSS |
| Repeated `/api/auth/session` on app boot/route churn | WARNING | Improved | singleton `sessionCheckPromise` in `App.jsx` |
| Repeated `/api/notifications?limit=6` per route mount | WARNING | Improved | 60s user+role cache and in-flight reuse in `DashboardLayout.jsx` |
| Aborted audit/export requests leak into UI state | WARNING | Improved | abort errors silent in `AuditLog.jsx` and `ExportData.jsx` |
| Login button click testability | WARNING | Guarded | login form keeps `onSubmit`; submit button is `type="submit"` |
| Upload proof browser fixture missing | BLOCKED | Ready for E2E | `Frontend/test/fixtures/proof-valid.png` and invalid txt fixture |

## Remaining Issues

| Issue | Status | Reason | Next Step |
|---|---|---|---|
| Manual Playwright smoke | BLOCKED | MCP browser profile locked by another local instance | Rerun smoke with isolated/free Playwright profile |
| Public report valid submit | READY, not rerun | Requires Turnstile test env active in both frontend and backend | Use `docs/captcha-test-strategy.md` and rerun browser E2E |
| Vite chunk-size warning | REMAINING | Existing bundle warning, outside endpoint/UX cleanup scope | Add further route/component code splitting in separate PR |

## Endpoint Verification

| Method | Endpoint | Before | After | Notes |
|---|---|---|---|---|
| GET | `/api/distributions` | 200 with abort UI warning | 200, abort hidden by code guard | Route-change abort is not user-facing |
| GET | `/api/menus` | 200 with abort UI warning | 200, abort hidden by code guard | SPPG history keeps last/empty state |
| GET | `/api/issues` | 200 with abort UI warning | 200, abort hidden by code guard | SPPG history keeps last/empty state |
| GET | `/api/validations` | 200 with abort UI warning | 200, abort hidden by code guard | School history keeps last/empty state |
| GET | `/api/audit-logs/summary` | aborted duplicate warning | improved | UI ignores abort; browser may still cancel route-leave request |
| GET | `/api/audit-logs?page=1&limit=10` | aborted duplicate warning | improved | UI ignores abort |
| GET | `/api/system-configs/export_max_rows` | aborted then 200 | improved | UI ignores abort |
| GET | `/api/exports?page=1&limit=10` | aborted then 200 | improved | UI ignores abort |
| POST | `/api/auth/session` | over-fetch warning | improved | singleton session request |
| GET | `/api/notifications?limit=6` | route-change spam warning | improved | cache TTL and in-flight reuse |

## Feature Verification

| Feature | Before | After | Notes |
|---|---|---|---|
| SPPG `/distribusi` | WARNING | Fixed by code/test guard | Browser re-smoke pending |
| SPPG `/riwayat` | WARNING | Fixed by code/test guard | Browser re-smoke pending |
| Sekolah `/riwayat` | WARNING | Fixed by code/test guard | Browser re-smoke pending |
| Dashboard chart | WARNING | Fixed by code/test guard | Browser console re-smoke pending |
| Anggaran chart | WARNING | Fixed by code/test guard | Browser console re-smoke pending |
| Login via click button | WARNING | Guarded | Form semantics are correct; browser click re-smoke pending |
| Logout from `/export` | WARNING | Guarded | Auth clear and replace redirect preserved |
| Public report valid submit | BLOCKED | Documented strategy | Use official Turnstile test keys |
| Upload proof | BLOCKED | Fixture ready | Browser E2E can use safe fixture |
| Export create/download | BLOCKED in browser audit | Backend PASS | Backend test covers PDF/XLSX create/download and role 403 |
| SPPG school assignment | Missing operational assignment flow | Backend/frontend implemented | `/sekolah-saluran`, `/api/sppg/me/dapodik-schools`, `/api/sppg/me/schools/assign`, distribution assignment guard |

## Search Behavior Update

- Search now uses mandatory token matching: every query token must match one searchable field in the same record. Field matching remains OR per token, but tokens are ANDed.
- Candidate fallback to unfiltered/base data was removed so an impossible query returns an empty array instead of broad or popular records.
- Relevance ranking prioritizes exact/normalized name or code matches, then name prefix/full-query matches, then all-token name matches, then lower-weight region/address matches.
- Keyword normalization lowercases text, trims/collapses spaces, ignores punctuation separators, and supports common school aliases: `SMKN` -> `SMK NEGERI`, `SMPN` -> `SMP NEGERI`, `SMAN` -> `SMA NEGERI`, `SDN` -> `SD NEGERI`.
- Verified behavior: `SMKN 4 Bandung` does not include `SMKN 7 Baleendah` or `SMKN 2 Baleendah` only because of shared `SMKN`/Bandung tokens; `cijagra xxx` returns empty when no single record contains both tokens.
