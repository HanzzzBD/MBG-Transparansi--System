# PR 5 - School Validation Flow

## Masalah Awal

- `Frontend/src/pages/Konfirmasi.jsx` masih memakai fallback pending/history validation yang terlihat seperti data nyata.
- Route sekolah sesuai SDD belum tersedia sebagai route utama:
  - `/validasi`
  - `/laporan-sekolah`
  - `/riwayat`
  - `/profil`
- Backend sudah punya validation flow, tetapi anomaly `VALIDATION_CONFLICT` belum dibuat saat sekolah mengirim status `conflict`.

## File Yang Diubah

- `Backend/src/modules/validations/service.js`
- `Backend/test/school-validation-flow.e2e.test.js`
- `Frontend/src/App.jsx`
- `Frontend/src/layouts/DashboardLayout.jsx`
- `Frontend/src/pages/Konfirmasi.jsx`
- `Frontend/src/pages/Konfirmasi.css`
- `Frontend/src/pages/SchoolReports.jsx`
- `Frontend/src/pages/SchoolHistory.jsx`
- `Frontend/src/pages/SchoolProfile.jsx`
- `Frontend/src/services/api.js`
- `Frontend/test/school-validation-flow.test.js`
- `Frontend/test/sppg-operational-flow.test.js`

## Fallback Yang Dihapus

- Pending validation dummy di `Konfirmasi.jsx`.
- History validation dummy di `Konfirmasi.jsx`.
- Branch `import.meta.env.DEV` yang menyimpan validasi/laporan secara lokal saat API gagal.
- Data SPPG/sekolah palsu seperti `SPPG Kecamatan Cempaka`, `SPPG Bogor Timur`, dan row `pending-*`.

Jika API kosong:

- Pending validation menampilkan `Belum ada distribusi yang perlu dikonfirmasi`.
- Riwayat validasi menampilkan `Belum ada riwayat validasi dari backend`.

Jika API gagal:

- UI menampilkan error dari backend/client.
- Tidak ada dummy row yang disisipkan.

## Route Sekolah Baru

- `/validasi`: memakai `Konfirmasi.jsx` untuk daftar validasi pending dan form validasi porsi/kualitas.
- `/laporan-sekolah`: halaman baru untuk kirim dan melihat riwayat laporan sekolah.
- `/riwayat`: route shared. Role `sekolah` melihat `SchoolHistory`; role `sppg` tetap melihat `SppgHistory`.
- `/profil`: route shared. Role `sekolah` melihat `SchoolProfile`; role `sppg` tetap melihat `SppgProfile`.

Redirect eksplisit:

- `/konfirmasi` -> `/validasi`
- `/validations` -> `/validasi`
- `/dashboard/validasi` -> `/validasi`
- `/dashboard/konfirmasi-distribusi` -> `/validasi`
- `/dashboard/laporan-sekolah` -> `/laporan-sekolah`
- `/dashboard/profil-sekolah` -> `/profil`

## Flow Verified / Conflict

Frontend menghitung status sebelum submit:

- `verified` jika `receivedPortions` sama dengan porsi distribusi dan `qualityOk` bernilai `true`.
- `conflict` jika porsi berbeda atau `qualityOk` bernilai `false`.

Submit validasi memakai:

- `PUT /api/validations/:id`

Payload:

```json
{
  "receivedPortions": 300,
  "qualityOk": true,
  "status": "verified",
  "notes": "Catatan opsional"
}
```

Backend tetap melakukan role/ownership guard:

- Sekolah hanya bisa membaca/mengubah validasi milik sekolahnya sendiri.
- SPPG ditolak dari endpoint update validasi.
- Tanpa token ditolak 401.

Backend sekarang membuat anomaly `VALIDATION_CONFLICT` jika status final `conflict`, porsi berbeda, atau kualitas tidak OK.

## School Report Flow

Route `/laporan-sekolah` memakai:

- `GET /api/school-reports`
- `POST /api/school-reports`

Kategori sesuai SDD:

- `kualitas_makanan`
- `keterlambatan`
- `kekurangan_porsi`
- `lainnya`

Role `sekolah` tidak perlu mengirim `schoolId`; backend mengambil school scope dari token login.

## Test Yang Ditambahkan

### Backend Isolated E2E

File:

- `Backend/test/school-validation-flow.e2e.test.js`

Coverage:

- Data test isolated dengan prefix `E2E_SCHOOL_VALIDATION_`.
- Tanpa token -> 401.
- Role SPPG update validasi -> 403.
- Sekolah hanya melihat validasi pending miliknya.
- Validasi porsi sesuai -> `verified`.
- Validasi porsi berbeda -> `conflict`.
- Anomaly `VALIDATION_CONFLICT` tercatat.
- Sekolah lain tidak bisa membaca/mengubah validasi tersebut.
- Data test dibersihkan setelah test.

Catatan: project belum memiliki Playwright/browser E2E runner di dependency lokal, jadi test otomatis yang ditambahkan adalah isolated HTTP E2E terhadap backend. Browser manual flow tetap perlu dijalankan lewat dev server jika ingin bukti end-to-end UI sesungguhnya.

### Frontend Static Regression

File:

- `Frontend/test/school-validation-flow.test.js`

Coverage:

- `Konfirmasi.jsx` tidak lagi memiliki fallback dummy.
- Route SDD sekolah terdaftar.
- `/riwayat` dan `/profil` role-aware.
- API helper real untuk validations, school reports, dan school profile tersedia.

## Cara Menjalankan Test

Backend PR5:

```bash
cmd /c npm test -- test/school-validation-flow.e2e.test.js
```

Frontend PR5:

```bash
cmd /c npm test -- test/school-validation-flow.test.js
```

Full regression:

```bash
cmd /c npm test
cmd /c npm run lint
cmd /c npm run build
```

## Risiko / Gap Tersisa

- Browser E2E otomatis belum bisa dijalankan karena Playwright tidak tersedia di dependency project. Isolated backend E2E sudah mencakup business flow verified/conflict dan IDOR.
- Upload foto validasi masih memakai attachment proof distribusi karena backend belum punya attachment khusus `validationId`.
