# MBG Transparency System

Frontend React untuk platform monitoring distribusi Program Makan Bergizi Gratis dari SPPG ke sekolah. Sistem mencakup dashboard role-based, peta SPPG, distribusi, production batch costing, validasi sekolah, transparansi anggaran, laporan masyarakat, anomaly detection, audit log, export data, dan admin tools.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Default Vite berjalan di `http://localhost:5173`.

## Build

```bash
npm run build
```

## Environment

Buat file `.env` di folder `Frontend`:

```env
VITE_API_URL=http://localhost:4000/api
```

Jika tidak diset, frontend memakai fallback `"/api"`.

## Backend Setup Singkat

Jalankan dari folder `Backend`:

```bash
npm install
npm run prisma:migrate
npm run seed:demo-users
npm start
```

Seed demo users memakai bcrypt dan upsert berdasarkan email.

## Kredensial Demo

Gunakan hanya untuk development/seed lokal:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@mbg.go.id` | `password` |
| Pemerintah | `gov@mbg.go.id` | `password` |
| SPPG | `sppg@mbg.go.id` | `password` |
| Sekolah | `sekolah@mbg.go.id` | `password` |

Sesuaikan kredensial dengan seed/database backend pada environment non-development.

## Route dan Role Akses

Public:

- `/` Landing Page
- `/login` Login

Semua role authenticated:

- `/dashboard`
- `/peta`

SPPG dan Admin:

- `/distribusi`
- `/production-batches`

Sekolah dan Admin:

- `/konfirmasi`

Pemerintah dan Admin:

- `/analytics`
- `/anggaran`
- `/anomaly`
- `/audit-log`
- `/export`
- `/laporan-masyarakat`

Admin only:

- `/users`
- `/lock-unlock`
- `/override`
- `/api-monitoring`

## Integrasi API

Semua halaman dashboard memakai helper terpusat:

- `src/services/api.js`
- Base URL: `VITE_API_URL || "/api"`
- Bearer token otomatis dari `src/store/authStore.js`
- `credentials: "include"` untuk kompatibilitas cookie httpOnly
- Dummy data hanya menjadi fallback saat API gagal/kosong agar halaman tidak blank.

## Catatan

- Auth frontend memakai Zustand persist key `mbg-auth-storage`.
- Jangan menyimpan password user di frontend.
- CAPTCHA landing page membutuhkan konfigurasi site key frontend dan secret backend sebelum submit laporan publik production.
