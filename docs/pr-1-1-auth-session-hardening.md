# PR 1.1 Auth Session Hardening

Tanggal: 2026-05-26

## Masalah Awal

- Beberapa halaman lama masih membaca `mbg.user` dari `localStorage/sessionStorage` sebagai fallback user, role, atau display name.
- `apiBlobRequest` belum melakukan refresh session saat menerima `401`, sehingga download file bisa gagal saat access token memory sudah expired tetapi refresh cookie masih valid.

## File yang Diubah

- `Frontend/src/store/authStore.js`
- `Frontend/src/services/api.js`
- `Frontend/src/App.jsx` tidak diubah pada PR ini, tetapi flow reload dari PR 1 tetap dipakai.
- `Frontend/src/pages/Dashboard.jsx`
- `Frontend/src/pages/Anggaran.jsx`
- `Frontend/src/pages/AuditLog.jsx`
- `Frontend/src/pages/Distribusi.jsx`
- `Frontend/src/pages/ExportData.jsx`
- `Frontend/src/pages/Konfirmasi.jsx`
- `Frontend/src/pages/LaporanMasyarakat.jsx`
- `Frontend/src/pages/LockUnlock.jsx`
- `Frontend/src/pages/OverrideData.jsx`
- `Frontend/src/pages/UserManagement.jsx`
- `Frontend/package.json`
- `Frontend/test/auth-session.test.js`

## Key LocalStorage Legacy yang Dihapus

Cleanup auth sekarang menghapus key legacy berikut saat app init/session check, login, logout, atau refresh gagal:

- `mbg.accessToken`
- `mbg.user`
- `accessToken`
- `token`
- `user`
- `mbg-auth-storage`

Audit frontend memastikan halaman protected tidak lagi membaca `localStorage.getItem`, `sessionStorage.getItem`, `getStoredUser`, `mbg.user`, atau `mbg-auth-storage` sebagai sumber role/permission.

## Flow Session Setelah Reload

1. App memanggil `POST /api/auth/refresh` dengan cookie HttpOnly melalui `credentials: include`.
2. Jika refresh cookie valid, backend mengembalikan `accessToken` baru dan `user`.
3. Frontend menyimpan `accessToken` dan `user` hanya di memory auth state.
4. Protected route memakai memory auth state untuk role/menu/page props.
5. Jika refresh gagal, memory auth dikosongkan dan protected route redirect ke `/login`.
6. Tidak ada fallback yang menganggap user login hanya karena `mbg.user` masih ada di storage.

## Flow apiBlobRequest Setelah 401

1. Request blob memakai access token dari memory auth state.
2. Request selalu menyertakan `credentials: include`.
3. Jika response `401`, client memanggil `POST /api/auth/refresh` sekali.
4. Jika refresh berhasil, token memory diperbarui lalu request blob original diulang sekali.
5. Jika refresh gagal atau retry blob tetap `401`, auth state dibersihkan.
6. Tidak ada infinite retry loop.
7. Blob response tetap mengembalikan binary file; `content-type` dan `content-disposition` disimpan sebagai metadata non-enumerable di blob jika tersedia.

## Test yang Ditambahkan

File: `Frontend/test/auth-session.test.js`

Coverage:

- Login store tidak menyimpan access token atau user ke browser storage.
- Stale `mbg.user` tidak bisa membuat app dianggap login saat memory auth kosong.
- Audit source halaman/layout memastikan role/permission tidak diambil dari localStorage/sessionStorage.
- `apiBlobRequest` sukses download dengan token memory aktif.
- `apiBlobRequest` melakukan refresh sekali setelah `401`, update token memory, lalu retry download.
- `apiBlobRequest` membersihkan auth saat refresh gagal.
- `apiBlobRequest` tidak infinite loop saat retry blob tetap `401`.

## Cara Menjalankan Test

```bash
npm --prefix Frontend run test:auth
npm --prefix Frontend test
npm --prefix Frontend run lint
npm --prefix Frontend run build
```

## Cara Test Manual

1. Jalankan backend dan frontend lokal.
2. Clear cookie dan browser storage.
3. Isi manual `localStorage.mbg.user`, lalu buka `/dashboard`.
   - Expected: redirect ke `/login`, key legacy auth terhapus.
4. Login sebagai admin/pemerintah/SPPG/sekolah.
   - Expected: login sukses, localStorage/sessionStorage tidak berisi token atau `mbg.user`.
5. Refresh `/dashboard`.
   - Expected: tetap login jika refresh cookie valid.
6. Logout.
   - Expected: backend logout dipanggil, memory auth clear, key legacy auth tetap kosong, redirect ke `/login`.
7. Download/export file.
   - Expected: request blob memakai token memory; jika token expired, refresh dipanggil sekali dan download retry.

## Risiko Tersisa

- Verifikasi refresh-then-download dilakukan lewat regression test API client. Manual browser download bergantung pada ketersediaan export completed di environment lokal.
- Beberapa halaman masih punya fallback display name statis seperti `Pengguna MBG`, `Admin MBG`, atau `Petugas SPPG` jika dirender di luar `ProtectedRoute`, tetapi fallback ini bukan sumber permission dan tidak membaca localStorage.
