# PROMPT: Public Safe SPPG Detail — Public Map Integration

## Role

Kamu adalah senior full-stack engineer yang bekerja pada sistem informasi
distribusi pangan nasional (MBG/SPPG). Kamu memahami prinsip keamanan data,
separation of concerns antara public dan internal API, serta clean architecture
pada aplikasi web modern.

---

## Objective

Implementasikan fitur **Public Safe SPPG Detail** pada halaman public map /
landing map preview.

Tujuan utama:
- Publik (siapapun yang tidak login) dapat melihat transparansi dasar SPPG
- Data sensitif/internal **tidak boleh bocor** ke public endpoint maupun frontend publik
- Semua fitur untuk publik tersedia langsung di landing page **tanpa memerlukan login**

> **Penting:** "Umum" bukan role login. Umum = siapapun yang mengakses
> tanpa autentikasi. Tidak ada role "Umum" di sistem auth.

---

## Context

### User Access Map

| Kondisi | Destination |
|---|---|
| Tidak login (publik/guest) | Public map `/peta-publik` — no auth required |
| Login sebagai admin / SPPG / sekolah / gov | Internal map `/peta` — auth required |

### Data Sensitif — TIDAK BOLEH Diekspos

Jangan pernah kirim field berikut ke public endpoint maupun frontend publik:

- `phone` / `email` PIC internal
- `userId`, `userAccount`
- Audit log, override history
- Anomaly log internal
- Raw material cost, operational cost, exact budget detail
- Internal notes, internal report
- Lock / unlock state
- Token atau path private file
- School validation detail

Gunakan **serializer / DTO terpisah khusus public** — jangan reuse internal serializer.

---

## ⛔ LARANGAN KERAS — BACA SEBELUM MULAI

> Prompt ini pernah menyebabkan Codex **mengubah halaman `/peta` (internal map)**
> dan **mengubah detail SPPG internal menjadi versi public-safe**.
> Itu **salah besar**. Baca larangan berikut sebelum menyentuh satu baris kode pun.

### Yang TIDAK BOLEH disentuh sama sekali:

```
❌ Jangan modifikasi file apapun yang berhubungan dengan:
   - Halaman /peta (internal map)
   - Komponen detail SPPG yang dipakai di /peta
   - Endpoint /api/sppg/:id (internal)
   - Endpoint /api/admin/sppg/* (internal)
   - Serializer / DTO internal yang sudah ada
   - Auth middleware internal
   - Role guard internal
```

### Mengapa:

- `/peta` adalah halaman internal untuk admin/SPPG/sekolah/gov
- Detail SPPG di `/peta` **harus tetap menampilkan data lengkap dan komplit**
- Membatasi data di internal map = **breaking change yang merusak fitur existing**
- Tugas ini **hanya menambah** `/peta-publik` baru, bukan mengubah `/peta`

### Aturan isolasi:

Semua kode baru harus **terisolasi penuh** dari kode internal:

| Yang baru (boleh dibuat) | Yang lama (jangan disentuh) |
|---|---|
| `GET /api/public/sppg/:id` | `GET /api/sppg/:id` |
| `PublicSppgSerializer` / `PublicSppgDTO` | `SppgSerializer` / `SppgDTO` internal |
| Halaman `/peta-publik` | Halaman `/peta` |
| Komponen `PublicSppgDetail` | Komponen `SppgDetail` internal |

---

---

## Task 0 — Revert Internal Map (Jika Sudah Terlanjur Rusak)

> Lakukan task ini **pertama** jika halaman `/peta` atau detail SPPG internal
> sudah terlanjur berubah akibat prompt sebelumnya.

Kembalikan ke kondisi semula:

1. Cek apakah komponen detail SPPG di `/peta` sudah berubah
2. Jika berubah, **revert** ke versi sebelumnya — pastikan semua field data
   SPPG komplit kembali ditampilkan (termasuk data operasional, biaya, anomaly,
   audit, dsb. sesuai role)
3. Cek apakah endpoint internal `/api/sppg/:id` sudah berubah
4. Jika berubah, **revert** serializer/DTO-nya ke kondisi semula
5. Verifikasi: buka `/peta`, klik marker SPPG — pastikan detail komplit muncul kembali

Baru setelah `/peta` kembali normal, lanjut ke Task 1 dst.

---

 — Routing Logic: Tombol "Lihat Peta Lengkap"

**Lokasi:** Landing page (sebelum login)

Implementasikan routing logic berikut saat tombol diklik:

```
if (tidak login) {
  redirect → /peta-publik
}

if (sudah login && role IN [admin, sppg, sekolah, gov]) {
  redirect → /peta
}
```

Ketentuan:
- Jika route `/peta-publik` belum ada, **buat baru**
- Public map tidak boleh memunculkan login wall atau redirect ke halaman login
- User yang sudah login sebagai internal dan menekan tombol yang sama
  langsung diarahkan ke `/peta`

---

### Task 2 — Landing Page: Fitur Publik Tanpa Login

Pastikan semua fitur berikut tersedia di landing page **tanpa autentikasi**:

- Preview peta SPPG (ringkas / teaser)
- Tombol **"Lihat Peta Lengkap"** → menuju `/peta-publik`
- Statistik publik opsional: total SPPG aktif, total porsi hari ini
- Tidak ada satu pun elemen landing page yang membutuhkan login untuk dilihat

---

### Task 3 — Backend: Public SPPG Detail Endpoint

Buat endpoint baru:

```
GET /api/public/sppg/:id
```

**Spesifikasi endpoint:**

| Properti | Nilai |
|---|---|
| Auth | Tidak diperlukan |
| Method | GET, read-only |
| Rate limit | Aktifkan rate limit aman (contoh: 60 req/menit per IP) |
| Serializer | DTO khusus public, bukan reuse internal |

**Response schema (public-safe):**

```json
{
  "id": "string",
  "name": "SPPG Kecamatan Banjar",
  "province": "Jawa Barat",
  "city": "Banjar",
  "district": "Banjar",
  "status": "active",
  "capacity": 1500,
  "todayPortions": 1280,
  "successRate": 96.2,
  "todayMenu": {
    "name": "Nasi Ayam Teriyaki + Sayur Bayam",
    "nutrition": {
      "calories": 650,
      "protein": 28,
      "carbohydrate": 75,
      "fat": 18
    }
  },
  "recentDistributions": [
    {
      "schoolName": "SDN 1 Banjar",
      "portions": 320,
      "status": "delivered",
      "date": "2026-05-22"
    }
  ]
}
```

**Field yang wajib tidak ada di response ini:**
`phone`, `email`, `userId`, `auditLog`, `anomalyLog`, `rawMaterialCost`,
`operationalCost`, `budget`, `internalNotes`, `lockState`, `overrideHistory`,
`privateFilePath`, `schoolValidationDetail`

---

### Task 4 — Frontend: Halaman Public Map (`/peta-publik`)

Buat atau update halaman `/peta-publik`:

- Tidak memerlukan autentikasi
- Dapat diakses langsung dari landing page melalui tombol "Lihat Peta Lengkap"
- Menampilkan peta interaktif dengan marker seluruh SPPG

**Behavior saat marker SPPG diklik:**

1. Fetch: `GET /api/public/sppg/:id`
2. Tampilkan panel / popup detail dengan field berikut:

```
✅ Tampilkan:
- Nama SPPG
- Lokasi umum (provinsi, kota, kecamatan)
- Status aktif / nonaktif
- Kapasitas
- Total porsi hari ini
- Success rate
- Menu hari ini + informasi nutrisi
- Distribusi terbaru (terbatas, max 5 entri terbaru)

❌ Jangan tampilkan:
- Biaya / anggaran internal
- Anomaly log
- Audit trail
- Raw costing
- Data admin apapun
```

---

### Task 5 — Internal Map (`/peta`) — JANGAN DISENTUH

> ⛔ Jangan modifikasi satu baris pun pada halaman `/peta` dan semua
> komponen serta endpoint yang digunakan oleh halaman tersebut.

- `/peta` tetap menampilkan **detail SPPG lengkap dan komplit** seperti sebelumnya
- Endpoint internal, serializer internal, dan komponen internal **tidak boleh diubah**
- Jika ingin memverifikasi: buka `/peta` sebelum dan sesudah — **harus identik**

Jika ada file internal yang terdampak oleh perubahan ini, **batalkan perubahan tersebut**
dan cari cara lain yang tidak menyentuh kode internal.

---

### Task 6 — Fallback & Empty State

Jika `GET /api/public/sppg/:id` gagal atau data tidak tersedia:

- Tampilkan pesan: **"Detail SPPG tidak tersedia"**
- Jangan fallback ke data hardcoded apapun
- Frontend tidak boleh menyimpan atau merender detail SPPG secara statis

---

### Task 7 — Documentation

Update file: `docs/local-web-audit.md`

Tambahkan section baru:

```markdown
## Public SPPG Detail

### Konsep Akses
- "Umum" bukan role login — siapapun yang tidak login diperlakukan sebagai publik
- Semua fitur publik tersedia langsung di landing page tanpa autentikasi

### Routing Logic
- Tidak login → /peta-publik (no auth required)
- Login sebagai admin / SPPG / sekolah / gov → /peta (auth required)

### Public Endpoint
GET /api/public/sppg/:id

### Field yang Diekspos
- id, name, province, city, district
- status, capacity, todayPortions, successRate
- todayMenu (name + nutrition: calories, protein, carbohydrate, fat)
- recentDistributions (schoolName, portions, status, date) — max 5 entri

### Field yang Disembunyikan
- phone/email PIC, userId, audit log, anomaly log
- raw material cost, operational cost, internal notes
- lock state, override history, private file token/path
- school validation detail, exact budget

### Alasan Keamanan
Data sensitif operasional tidak relevan untuk transparansi publik
dan berpotensi disalahgunakan jika diakses tanpa autentikasi.
```

---

## Acceptance Criteria

Implementasi dianggap **selesai** jika semua kondisi berikut terpenuhi:

- [ ] Tombol "Lihat Peta Lengkap" tersedia di landing page tanpa login
- [ ] Klik tombol saat **tidak login** → redirect ke `/peta-publik` langsung
- [ ] Klik tombol saat **sudah login** (internal role) → redirect ke `/peta`
- [ ] `/peta-publik` dapat dibuka tanpa login, **tidak ada login wall**
- [ ] Klik marker SPPG di public map → tampil panel detail public-safe
- [ ] Response `GET /api/public/sppg/:id` tidak mengandung field sensitif apapun
- [ ] Fallback **"Detail SPPG tidak tersedia"** muncul saat endpoint gagal
- [ ] Semua fitur landing page untuk publik dapat dilihat tanpa login
- [ ] Internal map `/peta` tetap protected dan tidak berubah behavior-nya
- [ ] `docs/local-web-audit.md` sudah diupdate dengan section baru
- [ ] Frontend tidak menggunakan hardcoded detail SPPG di manapun
- [ ] Rate limit aktif pada public endpoint

---

## Constraints

- ⛔ **Jangan sentuh `/peta`** — halaman internal map tidak boleh berubah sama sekali
- ⛔ **Jangan sentuh endpoint internal** `/api/sppg/:id` atau `/api/admin/sppg/*`
- ⛔ **Jangan sentuh serializer/DTO internal** yang sudah ada
- ⛔ **Jangan kurangi data** yang ditampilkan di internal map — detail SPPG internal harus tetap komplit
- Buat semua kode baru secara **terisolasi** dari kode internal yang ada
- Jangan reuse internal serializer/DTO untuk public endpoint
- Jangan expose field sensitif meskipun tidak diminta secara eksplisit
- Public map harus tetap **ringan** — jangan load data berat saat pertama buka
- Gunakan lazy load / fetch on demand saat marker diklik
