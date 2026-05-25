# PR 1 Security / Role Guard

Tanggal: 2026-05-25

## File yang Diubah

- `Frontend/src/store/authStore.js`
- `Frontend/src/services/api.js`
- `Frontend/src/App.jsx`
- `Frontend/src/pages/Login.jsx`
- `Backend/package.json`
- `Backend/test/security-role-guard.test.js`

## Flow Auth Sebelum

- Frontend membaca access token dari `localStorage`, `sessionStorage`, dan persisted Zustand key `mbg-auth-storage`.
- Login menulis `mbg.accessToken` dan `mbg.user` ke browser storage.
- Reload halaman protected bergantung pada storage frontend.

## Flow Auth Sesudah

- Access token hanya disimpan di memory state Zustand selama tab aktif.
- Frontend tidak menulis access token ke `localStorage`, `sessionStorage`, IndexedDB, atau cookie non-HttpOnly.
- Saat app reload, `App.jsx` memanggil `POST /api/auth/refresh` dengan `credentials: include`.
- Jika refresh cookie valid, backend mengembalikan access token baru dan user; frontend menyimpannya ke memory.
- Jika refresh gagal, frontend membersihkan memory session dan protected route mengarah ke `/login`.
- Logout memanggil backend logout lebih dulu, lalu membersihkan memory session.
- Legacy token keys (`mbg.accessToken`, `accessToken`, `token`, `mbg-auth-storage`) ikut dibersihkan saat login/logout/refresh gagal.

## Endpoint Auth yang Dipakai

- `POST /api/auth/login`
  - Mengembalikan access token untuk memory frontend.
  - Mengirim refresh token sebagai HttpOnly cookie.
- `POST /api/auth/refresh`
  - Membaca refresh token dari HttpOnly cookie.
  - Mengembalikan access token baru dan user.
- `POST /api/auth/logout`
  - Merevoke refresh session dan clear refresh cookie.

## Backend Cookie

Backend sudah memakai konfigurasi cookie refresh berikut:

- `httpOnly: true`
- `sameSite: "lax"` di local/test, `"none"` di production
- `secure: true` di production
- `path: "/api/auth"`
- Refresh token di database disimpan sebagai hash SHA-256, bukan plaintext.

## Test IDOR yang Ditambahkan

File: `Backend/test/security-role-guard.test.js`

Coverage:

- No token ke protected distribution endpoint menghasilkan `401`.
- SPPG A tidak bisa read/update distribution milik SPPG B.
- Sekolah A tidak bisa read/update validation milik Sekolah B.
- Sekolah A tidak bisa melihat report Sekolah B lewat query `schoolId`.
- Sekolah A tidak bisa membuat school report untuk `schoolId` Sekolah B; backend tetap memakai school scope miliknya.
- Role SPPG ditolak dari endpoint admin/government.
- Role sekolah ditolak dari endpoint SPPG/admin/government.
- Wrong authenticated role ke admin-only lock endpoint menghasilkan `403`.
- Login auth regression memastikan refresh cookie HttpOnly, refresh token DB hashed, refresh berhasil, logout revoke session.

## Cara Menjalankan Test

```bash
npm --prefix Backend run test:security
```

Opsional semua backend test:

```bash
npm --prefix Backend test
```

Frontend:

```bash
npm --prefix Frontend run lint
npm --prefix Frontend run build
```

## Verifikasi Manual

- `GET http://localhost:4000/api/health` mengembalikan `200`.
- Login API demo role admin, pemerintah, sppg, sekolah sukses dan response punya `Set-Cookie`.
- Browser guest membuka `/dashboard` diarahkan ke `/login`.
- Browser login admin dari `/login` berhasil masuk `/dashboard`.
- Setelah login, `localStorage` dan `sessionStorage` tidak berisi:
  - `mbg.accessToken`
  - `accessToken`
  - `token`
  - `mbg-auth-storage`
- `document.cookie` kosong dari JavaScript, sehingga refresh cookie tidak bisa dibaca frontend.
- Refresh `/dashboard` tetap login saat refresh cookie masih valid.

## Risiko / Belum Selesai

- Beberapa halaman lama masih punya helper baca `mbg.user` sebagai fallback UI lokal, tetapi tidak ada penulisan token lagi dan protected route sekarang memakai memory auth.
- `apiBlobRequest` belum punya retry refresh otomatis seperti `apiRequest`; download tetap memakai access token memory yang aktif.
