# Remaining Gap After Re-Audit

- Tanggal re-audit: 2026-05-26, Asia/Jakarta.
- Branch/commit: `main` / `af846d8`.
- Frontend: `http://localhost:5173`.
- Backend: `http://localhost:4000/api`.

## 1. Yang Sudah Selesai

- PR 1.1 security session: access token memory-only, legacy local/session storage dibersihkan, refresh cookie HttpOnly, `/auth/session` restore, `apiRequest` dan `apiBlobRequest` refresh-on-401, IDOR regression tests PASS.
- PR 2 public completeness: Landing fallback KPI/marker dummy dihapus, `/statistik` publik ada, public budget tersedia lewat `/anggaran-publik`/section statistik dan `/api/public/budget`, sensitive fields diuji tidak bocor.
- PR 3 dashboard polish: global search sudah ke `/api/search`, role scoped, debounce/loading/empty/error state ada; notification dropdown memakai `/api/notifications`; React Router future warnings dibersihkan.
- PR 4 SPPG flow: fallback Distribusi dihapus, endpoint `/api/sppg/me/schools` dan `/api/price-thresholds/my-region` tersedia dan scoped, route `/input-menu`, `/laporan-kendala`, `/riwayat`, `/profil` ada.
- PR 5 school validation: fallback Konfirmasi dihapus, route `/validasi`, `/laporan-sekolah`, `/riwayat`, `/profil` ada, `/konfirmasi` redirect ke `/validasi`, verified/conflict flow dan ownership diuji.
- PR 6 admin/export: UI master SPPG dan Schools ada, soft delete/restore tersedia, export PDF/XLSX role pemerintah/admin PASS, SPPG/sekolah 403, audit log delete route tidak tersedia.

## 2. Yang Masih Belum Selesai

- P2: Browser E2E school validation verified/conflict dengan klik UI dan data isolated belum ditemukan; yang ada adalah backend isolated E2E dan frontend source tests.
- P2: Audit log old_data/new_data belum diuji lengkap untuk semua entity/action yang diminta. Test PR6 membuktikan SPPG create/update/delete/restore dan distribution lock/unlock, tetapi belum eksplisit untuk Schools restore lifecycle, user restore, dan override old/new.
- P2: Restore user backend route ada, tetapi UI restore user belum terverifikasi dalam re-audit ini.
- P3: Dashboard browser masih mencetak Recharts warning width/height `-1`; React Router warning sudah hilang.
- P3: Build frontend sukses tetapi Vite memberi chunk-size warning untuk bundle utama lebih dari 1000 kB.

## 3. Yang Blocked

- Public report submit dengan CAPTCHA valid masih BLOCKED tanpa token Cloudflare Turnstile/reCAPTCHA provider asli. Invalid/honeypot/rate-limit path sudah ada, tetapi full valid submit tidak boleh dipalsukan.
- Guest redirect `/dashboard` tidak diuji ulang di browser bersih karena session/cookie lokal Playwright masih valid. Kode dan test auth session sudah membuktikan route guard, tetapi smoke browser perlu fresh context/cookie clear.

## 4. Prioritas Fix Berikutnya

- P0: Tidak ada P0 tersisa dari re-audit ini. Temuan lama P0/P1 terkait token localStorage dan data palsu sudah DONE.
- P1: Lengkapi verifikasi restore user jika SDD tetap mewajibkan restore user dari UI admin.
- P2: Tambahkan Playwright E2E isolated untuk school validation verified/conflict, plus audit tests untuk Schools/user restore/override old_data-new_data.
- P2: Sediakan mode test CAPTCHA atau dokumentasi cara memakai provider test key agar public report valid-submit bisa diuji tanpa mematikan security.
- P3: Polish dashboard chart container untuk menghilangkan Recharts warning dan pertimbangkan code splitting tambahan untuk warning bundle size.

## 5. Rekomendasi PR Lanjutan

- PR 7: Audit Coverage Completion - tambah test old_data/new_data untuk Schools create/update/soft delete/restore, user restore jika dipakai, override, dan pastikan restore admin-only masuk audit.
- PR 8: Browser E2E Operational Flows - Playwright isolated login/session untuk SPPG dan sekolah, termasuk `/input-menu`, `/laporan-kendala`, `/validasi` verified/conflict, upload proof dengan fixture file.
- PR 9: QA Polish - bersihkan Recharts warnings, tambahkan fresh-context protected-route smoke, dan pecah bundle besar dengan lazy loading tambahan.

# Playwright Endpoint Audit Update

- Tanggal audit browser: 2026-05-26, Asia/Jakarta.
- Laporan detail: `docs/playwright-endpoint-feature-audit.md`.
- Endpoint OK: 48 unique endpoint/pattern.
- Endpoint WARNING: 5 unique endpoint/pattern.
- Endpoint ERROR: 0.
- Endpoint BLOCKED: 3.
- Fitur OK: 36.
- Fitur WARNING: 7.
- Fitur ERROR/BLOCKED: 3.

## Endpoint OK

- Public endpoints `/api/public/statistics`, `/api/public/sppg`, `/api/public/budget`.
- Auth/session endpoints `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`.
- Dashboard endpoints untuk admin, pemerintah, SPPG, sekolah.
- Admin endpoints `/api/users`, `/api/roles`, `/api/sppg`, `/api/schools`, `/api/audit-logs`, `/api/monitoring/*`, `/api/distributions/lock-summary`.
- Pemerintah endpoints `/api/analytics/*`, `/api/anomaly-logs`, `/api/public-reports*`, `/api/exports`.
- SPPG endpoints `/api/distributions`, `/api/sppg/me/schools`, `/api/price-thresholds/my-region`, `/api/menus`, `/api/issues`.
- Sekolah endpoints `/api/validations`, `/api/school-reports`, `/api/schools/1`.

## Endpoint WARNING

- `/api/auth/session` 200 tetapi terpanggil sangat sering saat route navigation.
- `/api/notifications?limit=6` 200 tetapi terpanggil di hampir semua protected route.
- `/api/audit-logs/summary` dan `/api/audit-logs?page=1&limit=10` punya aborted duplicate saat navigasi cepat.
- `/api/system-configs/export_max_rows` dan `/api/exports?page=1&limit=10` punya aborted duplicate sebelum 200.

## Endpoint ERROR

- Tidak ditemukan endpoint 5xx, CORS error, role leak, atau public route yang butuh login pada audit browser ini.

## Fitur WARNING/BLOCKED

- `/distribusi` dan `/riwayat` menampilkan teks `signal is aborted without reason` walau endpoint 200.
- `/dashboard` dan `/anggaran` masih memunculkan Recharts width/height `-1` warning.
- Click tombol `Masuk` tidak mengirim request pada manual SPPG/sekolah check, tetapi submit via Enter berhasil.
- Logout pemerintah dari `/export` tidak redirect ke `/login` pada run ini.
- Public report valid-submit BLOCKED karena CAPTCHA provider token asli.
- Upload proof dan export create/download via browser BLOCKED karena butuh fixture/aksi mutasi yang belum disiapkan untuk audit-only pass.

## Prioritas Fix Berikutnya

- P2: Sembunyikan AbortError/abort signal dari UI user-facing.
- P2: Perbaiki reliability tombol login dan logout redirect.
- P2: Tambahkan Playwright E2E isolated untuk upload proof, validation verified/conflict, dan export create/download.
- P3: Bersihkan Recharts chart container warning.
- P3: Kurangi duplicate fetch/aborted request pada route navigation, session check, dan notifications.
