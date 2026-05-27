# PR 3 - Dashboard Real Data Polish

## Masalah Awal

- Input global search di topbar dashboard belum menjalankan pencarian.
- Dropdown notifikasi masih memakai teks statis.
- Console menampilkan React Router future flag warning.

## Endpoint Search

Endpoint baru:

```http
GET /api/search?q=...&limit=5
```

Response:

```json
{
  "status": "success",
  "data": {
    "sppg": [],
    "schools": [],
    "distributions": [],
    "reports": []
  },
  "meta": {
    "q": "kata kunci",
    "limit": 5,
    "total": 0
  }
}
```

Search hanya mengembalikan field ringkas untuk UI: `id`, `entity`, `title`, `subtitle`, `url`, dan `meta` aman. Endpoint tidak mengembalikan password, email user internal, token, audit log, atau field biaya granular internal.

## Permission Search Per Role

| Role | SPPG | Sekolah | Distribusi | Reports |
| --- | --- | --- | --- | --- |
| `admin` | Semua aktif | Semua aktif | Semua | Public report, school report, issue |
| `pemerintah` | Semua aktif | Semua aktif | Semua | Public report, school report, issue |
| `sppg` | SPPG miliknya | Sekolah di bawah SPPG miliknya | Distribusi SPPG miliknya | Issue/kendala SPPG miliknya |
| `sekolah` | SPPG yang melayani sekolahnya | Sekolah miliknya | Distribusi sekolahnya | School report sekolahnya |
| `umum` | Ditolak | Ditolak | Ditolak | Ditolak |

No token menghasilkan `401`, role `umum` menghasilkan `403`.

## Endpoint Notification

Endpoint yang dipakai:

```http
GET /api/notifications?limit=6
PUT /api/notifications/:id/read
PUT /api/notifications/read-all
```

`GET /api/notifications` sudah protected dan scoped ke `req.user.userId`. PR ini menambahkan serializer eksplisit untuk dropdown:

- `id`
- `type`
- `title`
- `message`
- `payload`
- `isRead` / `is_read`
- `readAt` / `read_at`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

Dropdown frontend sekarang menampilkan loading, error retry, empty state, unread badge, dan aksi tandai dibaca. Tidak ada notification statis yang terlihat seperti event real.

## Frontend

- `DashboardLayout.jsx` memakai debounce 350 ms sebelum request search.
- Search kosong atau kurang dari 2 karakter tidak mengirim request.
- Dropdown search menampilkan grup SPPG, Sekolah, Distribusi, dan Laporan.
- Klik hasil search menutup dropdown dan navigasi ke URL yang dikirim backend.
- Escape dan click outside menutup dropdown.
- Notification dropdown mengambil data dari `/api/notifications`.
- Static fake notification lama dihapus.

## React Router Warning

`BrowserRouter` sekarang memakai future flags:

```jsx
<BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
```

Browser check setelah login admin tidak lagi menampilkan React Router future flag warning. Masih ada warning non-fatal dari Recharts ResponsiveContainer di halaman dashboard; itu bukan warning routing dan tidak menghasilkan console error fatal.

## Test

Automated:

```powershell
npm.cmd --prefix Backend test -- test/dashboard-polish.test.js
npm.cmd --prefix Frontend test -- test/dashboard-polish.test.js
npm.cmd --prefix Frontend run lint
```

Hasil targeted: PASS.

Manual/API:

- `POST /api/auth/login` admin demo 200.
- `GET /api/search?q=SPPG&limit=3` dengan token admin 200, response berisi grup `sppg`, `schools`, `distributions`, `reports`.
- `GET /api/notifications?limit=3` dengan token admin 200, response berisi list notification dan `meta.unreadCount`.
- Browser login admin ke `/dashboard` berhasil.
- React Router future warning tidak muncul lagi.

Catatan: Playwright berhasil login admin dan membaca console, tetapi interaksi mengetik ke search input terhenti oleh limit tool Playwright. Coverage UI search tetap diverifikasi lewat source test frontend dan endpoint/permission test backend.

## File Yang Diubah

- `Backend/src/modules/search/controller.js`
- `Backend/src/modules/search/router.js`
- `Backend/src/modules/search/service.js`
- `Backend/src/modules/search/validation.js`
- `Backend/src/modules/notifications/service.js`
- `Backend/src/routes/index.js`
- `Backend/test/dashboard-polish.test.js`
- `Frontend/src/layouts/DashboardLayout.jsx`
- `Frontend/src/layouts/DashboardLayout.css`
- `Frontend/src/services/api.js`
- `Frontend/src/App.jsx`
- `Frontend/test/dashboard-polish.test.js`
- `docs/pr-3-dashboard-real-data-polish.md`
