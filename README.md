# MBG Transparency System

Platform monitoring distribusi Makan Bergizi Gratis dari SPPG ke sekolah. Project ini berisi backend API dan frontend dashboard untuk transparansi distribusi, validasi sekolah, laporan masyarakat, anomaly detection, production batch costing, audit log, dan export data.

## Struktur

- `Backend/` Express, Prisma, PostgreSQL, auth, RBAC, import data, analytics, dan endpoint API.
- `Frontend/` Vite, React 18, Tailwind CSS, React Router, Recharts, Leaflet, dan dashboard role-based.

## Backend

```bash
cd Backend
npm install
npm run prisma:migrate
npm run seed:demo-users
npm start
```

Backend default berjalan di `http://localhost:4000/api`.

## Frontend

```bash
cd Frontend
npm install
npm run dev
```

Buat `.env` di folder `Frontend`:

```env
VITE_API_URL=http://localhost:4000/api
```

Build production:

```bash
cd Frontend
npm run build
```

## Kredensial Demo

Gunakan hanya untuk development/seed lokal:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@mbg.go.id` | `password` |
| Pemerintah | `gov@mbg.go.id` | `password` |
| SPPG | `sppg@mbg.go.id` | `password` |
| Sekolah | `sekolah@mbg.go.id` | `password` |

## Route Frontend

Public:

- `/`
- `/login`

Authenticated:

- `/dashboard`
- `/peta`

SPPG/Admin:

- `/distribusi`
- `/production-batches`

Sekolah/Admin:

- `/konfirmasi`

Pemerintah/Admin:

- `/analytics`
- `/anggaran`
- `/anomaly`
- `/audit-log`
- `/export`
- `/laporan-masyarakat`

Admin:

- `/users`
- `/lock-unlock`
- `/override`
- `/api-monitoring`

## Catatan

- Frontend API helper terpusat ada di `Frontend/src/services/api.js`.
- Auth frontend memakai Zustand persist key `mbg-auth-storage`.
- Dummy data di frontend hanya fallback saat API gagal/kosong agar halaman tidak blank.
- Jangan memakai kredensial demo untuk production.
