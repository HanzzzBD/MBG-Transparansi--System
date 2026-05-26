# PR 2 - Public Feature Completeness

## Masalah Awal

- Landing page masih berisiko menampilkan KPI/marker fallback yang terlihat seperti data real.
- Link navbar `Statistik` menuju `/statistik`, tetapi route publik belum tersedia.
- Publik belum punya halaman statistik/transparansi anggaran yang mengambil data aman dari backend.

## Route Publik

| Route | Status | Catatan |
| --- | --- | --- |
| `/` | Tetap publik | Landing memakai data dari endpoint publik dan state loading/empty/error. |
| `/peta-publik` | Tetap publik | Tidak diubah pada PR ini. |
| `/statistik` | Ditambahkan | Halaman statistik publik tanpa `ProtectedRoute`. |
| `/anggaran-publik` | Ditambahkan | Route publik ke halaman statistik dengan section transparansi anggaran. |

## Endpoint Yang Dipakai

| Endpoint | Auth | Rate Limit | Data |
| --- | --- | --- | --- |
| `GET /api/public/statistics` | Tidak perlu login | `publicSppgLimiter` | KPI publik, tren distribusi, success rate, agregasi wilayah, filter publik. |
| `GET /api/public/budget` | Tidak perlu login | `publicSppgLimiter` | Total anggaran agregat, total porsi, rata-rata harga per porsi, agregasi provinsi/kota. |
| `GET /api/public/sppg` | Tidak perlu login | Sudah public | Marker/preview SPPG publik untuk landing. |
| `POST /api/auth/session` | Tidak perlu login | Tidak dipakai sebagai data publik | Session check aman agar guest public route tidak menghasilkan 401 di console. |

## Data Yang Ditampilkan

- Total SPPG aktif.
- Distribusi hari ini.
- Success rate publik.
- SPPG bermasalah.
- Tren distribusi.
- Distribusi berdasarkan provinsi.
- Total anggaran agregat.
- Total porsi agregat.
- Harga rata-rata per porsi.
- Anggaran dan harga per porsi per wilayah.
- Filter publik: provinsi, kota, periode, dan granularitas.

## Data Yang Sengaja Tidak Ditampilkan

- Data internal user, role guard, token/session.
- Audit log.
- Detail pelapor.
- Nomor PIC atau kontak privat.
- Metadata lock/override.
- Catatan internal.
- Raw material cost dan operational cost granular internal.
- Endpoint internal `/api/sppg/*`, `/api/admin/sppg/*`, dan route internal `/peta`.

## Bukti Fallback Dummy Dihapus

- `Frontend/src/pages/Landing.jsx` tidak lagi punya `FALLBACK_SUMMARY`, `FALLBACK_MARKERS`, `markerSource`, atau fallback angka/marker.
- Landing menampilkan loading state saat request berjalan.
- Landing menampilkan empty state jika backend mengembalikan data kosong.
- Landing menampilkan error state dan tombol retry jika API gagal.
- Iframe peta landing tidak lagi memakai parameter marker statis.
- Audit command:

```powershell
rg -n "FALLBACK|fallback|dummy|2847|18432|94\.7|markerSource|Menampilkan fallback|marker=-" Frontend\src\pages\Landing.jsx Frontend\src\pages\PublicStatistik.jsx
```

Hasil: tidak ada match.

## File Yang Diubah

- `Backend/src/modules/public/controller.js`
- `Backend/src/modules/public/router.js`
- `Backend/src/modules/public/service.js`
- `Backend/src/modules/public/validation.js`
- `Backend/src/modules/auth/controller.js`
- `Backend/src/modules/auth/router.js`
- `Backend/test/public-feature.test.js`
- `Backend/test/security-role-guard.test.js`
- `Frontend/src/App.jsx`
- `Frontend/src/pages/Landing.jsx`
- `Frontend/src/pages/PublicStatistik.jsx`
- `Frontend/src/services/api.js`
- `Frontend/test/public-feature.test.js`
- `docs/pr-2-public-feature-completeness.md`

## Test Dan Verifikasi

| Check | Hasil |
| --- | --- |
| `npm.cmd --prefix Backend test` | PASS, 12 tests. |
| `npm.cmd --prefix Frontend test` | PASS, 10 tests. |
| `npm.cmd --prefix Frontend run lint` | PASS. |
| `npm.cmd --prefix Frontend run build` | PASS. |
| `GET http://localhost:4000/api/public/statistics` | 200, response berisi `kpis`, `charts`, `recentData`, `alerts`, `filters`, `meta`. |
| `GET http://localhost:4000/api/public/budget` | 200, response berisi `kpis`, `charts`, `recentData`, `alerts`, `filters`, `meta`. |
| `POST http://localhost:4000/api/auth/session` tanpa cookie | 200, `authenticated:false`. |
| Browser `http://localhost:5173/statistik?verify=clean` | Render publik, tidak redirect login, console error/warning 0. |
| Browser `http://localhost:5173/anggaran-publik?verify=clean` | Render publik, tidak redirect login, console error/warning 0. |
| Browser `http://localhost:5173/` | Navbar `Statistik` menuju `/statistik`, tombol `Lihat Peta Lengkap` menuju `/peta-publik` untuk guest. |

## Risiko Tersisa

- Grafik publik mengikuti data yang tersedia di database. Jika database kosong, UI akan menampilkan empty state, bukan angka pengganti.
- `POST /api/auth/session` ditambahkan untuk session-check non-intrusif; endpoint refresh asli tetap mengembalikan 401 saat refresh token tidak valid dan tetap dipakai untuk retry request protected/blob.
