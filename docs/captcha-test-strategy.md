# CAPTCHA Test Strategy

## Provider

- Provider lokal project: Cloudflare Turnstile (`CAPTCHA_PROVIDER=turnstile`).
- Backend tetap memverifikasi token lewat `/siteverify`; tidak ada dummy-token bypass di kode production.
- Referensi resmi: Cloudflare Turnstile testing docs, diperiksa 2026-05-26: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

## Local/Test Env

Gunakan pasangan test key resmi Cloudflare hanya untuk local/test:

```env
# Frontend/.env.test atau Frontend/.env.local
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA

# Backend/.env.test atau shell test lokal
NODE_ENV=test
CAPTCHA_PROVIDER=turnstile
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Catatan keamanan:

- Jangan pakai key test di production.
- Jangan menerima token bebas seperti `dummy`/`test-token` di backend.
- Production secret key akan menolak token dummy, dan test secret key hanya untuk automated/local testing.

## Cara Menjalankan Valid Submit

1. Jalankan backend dengan `NODE_ENV=test` atau env local yang memakai `TURNSTILE_SECRET_KEY` test.
2. Jalankan frontend dengan `VITE_TURNSTILE_SITE_KEY` test.
3. Buka form laporan masyarakat publik dan submit dari browser/E2E.
4. Pastikan request `POST /api/public-reports` terkirim dan response berhasil.

## Batasan

- E2E valid submit tetap butuh widget menghasilkan token dari sitekey test resmi.
- Jika test dijalankan dengan production/real key tanpa allowlist localhost, flow valid submit tetap dianggap BLOCKED.
