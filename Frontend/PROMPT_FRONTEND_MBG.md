# Prompt: Buat Frontend Lengkap untuk MBG Transparansi System

## Konteks Sistem

Kamu adalah frontend developer yang bertugas membangun antarmuka lengkap untuk **Sistem Transparansi MBG (Makan Bergizi Gratis)**. Ini adalah sistem monitoring dan transparansi distribusi makanan bergizi gratis untuk sekolah-sekolah di Indonesia.

Backend sudah tersedia dengan REST API Node.js + Express + Prisma. Bangun frontend menggunakan **React + Vite + Tailwind CSS + React Router v6 + Axios + React Query + Recharts**.

---

## Peran Pengguna (Role)

Sistem memiliki 5 role dengan akses berbeda:

| Role | Deskripsi |
|------|-----------|
| `admin` | Super admin, akses penuh ke semua fitur |
| `pemerintah` | Pengawas pemerintah, dapat melihat data dan laporan |
| `sppg` | Satuan Pelaksana Program Gizi, membuat & memperbarui distribusi |
| `sekolah` | Operator sekolah, memvalidasi distribusi & membuat laporan sekolah |
| `umum` | Publik, hanya dapat submit laporan publik (tanpa login) |

---

## Struktur Halaman & Fitur yang Harus Dibangun

### 1. AUTH

**Halaman: `/login`**
- Form: email + password
- Tombol login
- Tampilkan error jika gagal (rate limit, kredensial salah)
- Setelah login, redirect ke dashboard sesuai role
- **API:** `POST /auth/login`

**Halaman: `/me` (Profile)**
- Tampilkan data user yang sedang login (nama, email, role, asosiasi sppg/sekolah)
- Tombol logout
- **API:** `GET /auth/me`, `POST /auth/logout`

---

### 2. DASHBOARD (per Role)

**Dashboard Admin** (`/dashboard`)
- Widget: total user, total SPPG, total sekolah, total distribusi
- Grafik distribusi mingguan (line chart)
- Daftar anomali terbaru (5 teratas)
- Daftar audit log terbaru (5 teratas)
- Shortcut ke: Kelola User, Kelola SPPG, Kelola Sekolah

**Dashboard Pemerintah** (`/dashboard`)
- Summary analytics: total porsi terdistribusi, total anggaran, success rate
- Grafik tren distribusi (line chart, filter: harian/mingguan/bulanan)
- Grafik success rate
- Top 5 provinsi berdasarkan distribusi (bar chart)
- Grafik budget

**Dashboard SPPG** (`/dashboard`)
- Daftar distribusi milik SPPG ini (today + upcoming)
- Status distribusi (in_progress / delivered / failed)
- Shortcut: Tambah Distribusi, Upload Bukti, Laporan Masalah

**Dashboard Sekolah** (`/dashboard`)
- Daftar distribusi yang belum divalidasi
- Riwayat validasi
- Shortcut: Buat Laporan Sekolah

---

### 3. DISTRIBUSI (`/distributions`)

**List Distribusi** — semua role
- Tabel dengan kolom: ID, SPPG, Sekolah, Tanggal, Porsi, Harga/Porsi, Status, Aksi
- Filter: tanggal, SPPG, sekolah, status (`in_progress`, `delivered`, `failed`)
- Pagination
- **API:** `GET /distributions?page=&limit=&date=&sppgId=&schoolId=&status=`

**Detail Distribusi** — semua role
- Info lengkap distribusi
- Tab Bukti (foto, catatan)
- Tab Validasi (status, catatan sekolah)
- Jika admin: tombol Lock/Unlock, Override status
- **API:** `GET /distributions/:id`, `GET /distributions/:id/proofs`

**Form Tambah Distribusi** — role: sppg, admin
- Field: sppgId (optional, diisi otomatis dari sesi), schoolId, portions, pricePerPortion, distributionDate, status, failureReason (jika failed)
- **API:** `POST /distributions`

**Form Edit Distribusi** — role: sppg, admin
- Sama seperti form tambah tapi partial update
- **API:** `PUT /distributions/:id`

**Upload Bukti Distribusi** — role: sppg, admin
- Pilih distribusiId, upload foto (image)
- Preview foto sebelum submit
- **API:** `POST /files/upload` → dapat URL → `POST /proofs` dengan distributionId + fileUrl

---

### 4. VALIDASI (`/validations`)

**List Validasi** — role: sekolah, pemerintah, admin
- Tabel: ID, Distribusi ID, Status validasi, Catatan, Tanggal
- Filter: schoolId (untuk pemerintah/admin)
- **API:** `GET /validations`

**Detail Validasi** — role: sekolah, pemerintah, admin
- Info validasi lengkap
- **API:** `GET /validations/:id`

**Form Update Validasi** — role: sekolah, admin
- Field: status (validated / rejected / pending), catatan
- **API:** `PUT /validations/:id`

---

### 5. MENU MAKANAN (`/menus`)

**List Menu** — publik (tanpa login)
- Grid/tabel menu dengan kolom: nama, deskripsi, kalori, harga, tanggal mulai, tanggal selesai, SPPG
- Filter: tanggal, sppgId
- **API:** `GET /menus`

**Form Tambah Menu** — role: sppg, admin
- Field: name, description, calorie, pricePerPortion, startDate, endDate, sppgId
- **API:** `POST /menus`

**Form Edit Menu** — role: sppg, admin
- Partial update
- **API:** `PUT /menus/:id`

**Hapus Menu** — role: admin
- Konfirmasi sebelum hapus
- **API:** `DELETE /menus/:id`

---

### 6. LAPORAN

**Laporan Publik** (`/report`) — **tanpa login**, akses umum
- Form pengaduan: nama (opsional), kategori (kualitas_makanan / keterlambatan / kekurangan_porsi / lainnya), pesan (min 20 karakter), provinsi, kota
- Sertakan CAPTCHA token (gunakan reCAPTCHA atau honeypot)
- Tampilkan konfirmasi sukses
- **API:** `POST /public-reports`

**Daftar Laporan Publik** (`/admin/reports/public`) — role: pemerintah, admin
- Tabel: nama pelapor, kategori, pesan (truncated), provinsi, kota, tanggal
- Filter: kategori, provinsi, kota
- **API:** `GET /public-reports`

**Form Laporan Sekolah** (`/school-reports/new`) — role: sekolah, admin
- Field: schoolId (auto dari sesi), kategori, pesan
- **API:** `POST /school-reports`

**Daftar Laporan Sekolah** (`/school-reports`) — role: sekolah, pemerintah, admin
- Tabel laporan dengan filter schoolId, kategori
- **API:** `GET /school-reports`

---

### 7. ANALYTICS (`/analytics`)

**Halaman Analytics** — role: pemerintah, admin

**Summary Card:**
- Total distribusi, total porsi, total anggaran, success rate
- **API:** `GET /analytics/summary?province=&city=&start_date=&end_date=`

**Grafik Tren Distribusi (Line Chart):**
- Filter granularity: daily / weekly / monthly
- Filter: provinsi, kota, rentang tanggal
- **API:** `GET /analytics/distributions?granularity=&...`

**Grafik Success Rate (Line/Area Chart):**
- Tren success rate dari waktu ke waktu
- **API:** `GET /analytics/success-rate`

**Grafik Budget (Bar Chart):**
- Total anggaran per periode
- **API:** `GET /analytics/budget`

**Tabel By Province:**
- Top 10 provinsi, sortable
- **API:** `GET /analytics/by-province`

**Anomali (Table):**
- List anomali terdeteksi otomatis (OVER_CAPACITY, PRICE_ANOMALY, VALIDATION_CONFLICT, PENDING_TIMEOUT)
- Pagination
- **API:** `GET /analytics/anomaly`

---

### 8. SPPG (Satuan Pelaksana Program Gizi) (`/sppg`)

**List SPPG** — publik (tanpa login)
- Tabel: nama, provinsi, kota, alamat, kapasitas harian, status aktif
- Filter: provinsi
- **API:** `GET /sppg`

**Detail SPPG** — publik
- Info lengkap SPPG + distribusi terkait
- **API:** `GET /sppg/:id`

**Form Tambah/Edit SPPG** — role: admin
- Field: name, province, city, address, dailyCapacity, isActive
- **API:** `POST /sppg`, `PUT /sppg/:id`

**Hapus SPPG** — role: admin
- **API:** `DELETE /sppg/:id`

---

### 9. SEKOLAH (`/schools`)

**List Sekolah** — role: pemerintah, admin
- Tabel: nama, NPSN, provinsi, kota, jenjang, total siswa, status aktif
- Filter: provinsi
- **API:** `GET /schools`

**Detail Sekolah** — role: pemerintah, admin, sekolah
- Info lengkap + distribusi terkini
- **API:** `GET /schools/:id`

**Form Tambah/Edit Sekolah** — role: admin
- Field: name, npsn, province, city, address, level (SD/SMP/SMA), totalStudents, isActive
- **API:** `POST /schools`, `PUT /schools/:id`

**Hapus Sekolah** — role: admin
- **API:** `DELETE /schools/:id`

---

### 10. ADMIN PANEL (`/admin`)

**Kelola User** (`/admin/users`)
- Tabel: nama, email, role, status aktif, tanggal dibuat
- Filter: role, isActive, search (nama/email)
- Tambah user baru: form dengan role, email, password, nama, sppgId/schoolId (conditional)
- Edit user, Nonaktifkan/Aktifkan, Hapus
- **API:** `GET /admin/users`, `POST /admin/users`, `PUT /admin/users/:id`, `DELETE /admin/users/:id`

**Audit Log** (`/admin/audit-logs`)
- Tabel: user, action (INSERT/UPDATE/DELETE/LOGIN/LOGOUT/LOCK/UNLOCK), entity, timestamp
- Filter: action, tanggal
- **API:** `GET /admin/audit-logs`

**Anomali Log** (`/admin/anomaly-logs`)
- Tabel: tipe anomali (OVER_CAPACITY/PRICE_ANOMALY/VALIDATION_CONFLICT/PENDING_TIMEOUT), detail, status resolved, timestamp
- Tombol "Resolve" per anomali
- **API:** `GET /admin/anomaly-logs`, `PUT /admin/anomaly-logs/:id/resolve`

**Manajemen Distribusi (Admin Override)** (`/admin/distributions`)
- Lock distribusi: `POST /admin/distributions/:id/lock`
- Unlock distribusi: `POST /admin/distributions/:id/unlock`
- Override status: `PUT /admin/distributions/:id/override` (field: status, overrideReason)

**Price Threshold** (`/admin/price-thresholds`)
- Tabel threshold harga per provinsi
- Form edit per provinsi
- **API:** `GET /admin/price-thresholds`, `PUT /admin/price-thresholds/:province`

**System Config** (`/admin/system-configs`)
- Tabel konfigurasi sistem (key-value)
- Form edit per key
- **API:** `GET /admin/system-configs`, `PUT /admin/system-configs/:key`

---

### 11. NOTIFIKASI (`/notifications`)

**Notification Bell (di navbar)**
- Jumlah notifikasi belum dibaca (badge)
- Dropdown preview 5 notifikasi terbaru

**Halaman Notifikasi**
- List semua notifikasi dengan status read/unread
- Tombol "Tandai semua dibaca"
- Tandai satu per satu
- **API:** `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`

---

### 12. EKSPOR DATA (`/exports`)

**Form Ekspor** — role: pemerintah, admin
- Pilih tipe ekspor (distribusi / sekolah / SPPG / dll)
- Pilih format (CSV / Excel)
- Filter: rentang tanggal, provinsi
- **API:** `POST /exports`

**Daftar Ekspor**
- Tabel: ID, tipe, status (pending/processing/done/failed), tanggal, aksi download
- Tombol download jika status done
- **API:** `GET /exports/:id`, `GET /exports/:id/download`

---

## Komponen Shared yang Harus Dibuat

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx          # Navigasi sidebar per role
│   │   ├── Navbar.jsx           # Top bar + notif bell + avatar
│   │   └── PageLayout.jsx       # Wrapper layout utama
│   ├── ui/
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Select.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx            # Reusable table dengan sorting
│   │   ├── Pagination.jsx
│   │   ├── Badge.jsx            # Status badge (warna sesuai status)
│   │   ├── Card.jsx
│   │   ├── Alert.jsx
│   │   ├── Skeleton.jsx         # Loading skeleton
│   │   └── EmptyState.jsx
│   ├── charts/
│   │   ├── LineChart.jsx
│   │   ├── BarChart.jsx
│   │   └── AreaChart.jsx
│   └── forms/
│       ├── FormField.jsx        # Label + Input + error message
│       └── ImageUpload.jsx      # Drag & drop foto dengan preview
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── distributions/
│   ├── validations/
│   ├── menus/
│   ├── reports/
│   ├── analytics/
│   ├── sppg/
│   ├── schools/
│   ├── admin/
│   ├── notifications/
│   └── exports/
├── hooks/
│   ├── useAuth.js               # Context + hook autentikasi
│   ├── useRole.js               # Cek role dan akses
│   └── useNotifications.js      # Fetch + polling notifikasi
├── services/
│   └── api.js                   # Axios instance dengan interceptor token
├── routes/
│   └── ProtectedRoute.jsx       # Guard route berdasarkan role
└── utils/
    ├── formatDate.js
    ├── formatCurrency.js
    └── statusColors.js
```

---

## Ketentuan Teknis

### Auth & Token
- Simpan access token di memory (bukan localStorage), refresh token di httpOnly cookie
- Axios interceptor untuk auto-refresh token saat 401
- Logout hapus semua state

### Role-Based Access
- `ProtectedRoute` menerima prop `allowedRoles={["admin", "pemerintah"]}`
- Sidebar menu hanya tampilkan menu yang sesuai role
- Sembunyikan tombol aksi yang tidak bisa diakses role tersebut

### Status Badge Colors
- `in_progress` → biru
- `delivered` → hijau
- `failed` → merah
- `pending` → kuning/orange

### Kategori Laporan (label Indonesia)
- `kualitas_makanan` → "Kualitas Makanan"
- `keterlambatan` → "Keterlambatan"
- `kekurangan_porsi` → "Kekurangan Porsi"
- `lainnya` → "Lainnya"

### Anomali Types (label)
- `OVER_CAPACITY` → "Melebihi Kapasitas"
- `PRICE_ANOMALY` → "Anomali Harga"
- `VALIDATION_CONFLICT` → "Konflik Validasi"
- `PENDING_TIMEOUT` → "Pending Timeout"

### Format Angka
- Harga dalam Rupiah: `Rp 15.000`
- Tanggal: `15 Mei 2026`
- Porsi: `1.200 porsi`

### UX Requirements
- Semua tabel ada loading skeleton saat fetch
- Error state dengan pesan ramah dan tombol "Coba Lagi"
- Empty state dengan ilustrasi dan pesan informatif
- Konfirmasi dialog sebelum delete/destructive action
- Toast notification untuk aksi berhasil/gagal
- Responsive: mobile-friendly (sidebar collapse di mobile)

---

## Base URL & Auth Header

```js
// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // untuk refresh token cookie
});

// Interceptor: tambahkan Authorization header
api.interceptors.request.use((config) => {
  const token = getAccessToken(); // dari memory/context
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: auto refresh token jika 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) return api(err.config);
      logout();
    }
    return Promise.reject(err);
  }
);
```

---

## Prioritas Pembangunan

1. **Setup project** (Vite + TailwindCSS + React Router + Axios + React Query)
2. **Auth** (Login, Me, Logout, ProtectedRoute)
3. **Layout** (Sidebar + Navbar + role-based menu)
4. **Dashboard** per role
5. **Distribusi** (CRUD + upload bukti)
6. **Validasi**
7. **SPPG & Sekolah**
8. **Laporan** (publik + sekolah)
9. **Analytics** (grafik + chart)
10. **Admin Panel** (user, audit log, anomali, config)
11. **Notifikasi**
12. **Ekspor**

---

## Catatan Penting

- Semua teks UI dalam **Bahasa Indonesia**
- API base path: `/api/` (contoh: `POST /api/auth/login`)
- Backend menggunakan RBAC — pastikan frontend tidak menampilkan fitur yang tidak diizinkan role tersebut
- Endpoint `GET /sppg`, `GET /menus`, `GET /analytics/summary` bisa diakses **tanpa login**
- `POST /public-reports` bisa diakses publik tanpa login (gunakan reCAPTCHA v3)
- File upload: gunakan `multipart/form-data` ke `POST /files/upload`, hasil URL-nya dipakai di `POST /proofs`
