# Local Web Audit Hardcoded Data

Fokus file ini adalah data fallback/dummy/hardcoded yang masih ada di frontend. Beberapa fallback hanya muncul saat API gagal/kosong, tetapi tetap perlu dipangkas atau diganti empty state ketika backend sudah lengkap.

| Halaman | File / line | Data hardcoded/fallback | Runtime | Rekomendasi endpoint/backend |
|---|---|---|---|---|
| Landing | `Frontend/src/pages/Landing.jsx:41`, `:48-58` | `FALLBACK_SUMMARY` dan `FALLBACK_MARKERS` termasuk koordinat kota/provinsi dummy. | KPI dan marker runtime 200 dari backend. Fallback tidak muncul saat API OK. | Pertahankan hanya sebagai skeleton/empty state atau hapus setelah endpoint stabil. |
| Landing | `Frontend/src/pages/Landing.jsx:387`, Backend `src/routes/index.js:56-61`, `src/modules/productionBatches/router.js:18` | Form laporan publik mengirim ke backend. Endpoint sebelumnya 401 karena auth production batch bocor. | Fixed 2026-05-22: invalid guest payload sekarang 400 `VALIDATION_ERROR`, bukan 401. | Follow-up: uji CAPTCHA valid/invalid end-to-end dengan provider/secret valid. |
| Login | `Frontend/src/pages/Login.jsx:18-36`, `:332`; `Backend/src/scripts/seedDemoUsers.js` | Demo account list dan TODO seed user di frontend; relasi demo diperbaiki di backend seed. | Fixed 2026-05-22: semua login 200, SPPG memiliki `sppgId=1`, sekolah memiliki `schoolId=1`. | Follow-up terpisah: hapus TODO frontend bila seed dianggap stabil. |
| Dashboard | `Frontend/src/pages/Dashboard.jsx` | Fixed 2026-05-23: `NATIONAL_FALLBACK`, `SPPG_FALLBACK`, `SCHOOL_FALLBACK`, angka `94.7`, provinsi hardcoded, anomaly fallback dihapus untuk halaman prioritas. | Halaman memakai data API; API kosong menjadi empty state/angka 0, API gagal menjadi error state. | Follow-up: tambah endpoint summary scoped khusus SPPG/Sekolah agar KPI tidak perlu terlalu banyak derived aggregation. |
| Peta SPPG | `Frontend/src/pages/PetaSPPG.jsx:108`, `:141`, `:674-685` | `FALLBACK_SPPG`, `FALLBACK_MENU`, fallback distribution detail. | Marker list 200 dari `/api/sppg`; side panel sebagian fallback. | Tambah endpoint detail SPPG lengkap: menu hari ini, distribusi terakhir, KPI dapur. |
| Distribusi | `Frontend/src/pages/Distribusi.jsx:44-75`, `:283-292` | Fallback schools, fallback distributions, capacity/threshold default. | Admin mendapat data backend 200. Scope SPPG demo fixed 2026-05-22; source masih menyatakan `/schools` dan threshold belum tersedia untuk role SPPG. | Tambah endpoint sekolah tujuan untuk SPPG dan threshold wilayah read-only. |
| Production Batches | `Frontend/src/pages/ProductionBatches.jsx:13-24`, `:305` | `FALLBACK_BATCHES`, preview fallback saat API kosong/gagal. | List batch 200 saat admin. | Gunakan backend sebagai single source; tampilkan empty state bila tidak ada batch. |
| Konfirmasi | `Frontend/src/pages/Konfirmasi.jsx:36`, `:78`, `:419`, `:463`; `Backend/src/scripts/seedDemoUsers.js` | Fallback pending/history; submit validasi/laporan bisa fallback lokal saat API gagal. | Fixed 2026-05-22: demo sekolah memiliki `schoolId=1`, `GET /api/validations?limit=5` 200. | Pastikan submit validasi dan school report update backend pada PR terpisah. |
| Analytics | `Frontend/src/pages/Analytics.jsx` | Fixed 2026-05-23: summary/cost/province fallback dihapus. | `/api/analytics/by-province` fixed 2026-05-22; province compare endpoint 200. API kosong tampil empty state. | Tambah endpoint cost trend eksplisit bila perlu, tetapi jangan gunakan data dummy. |
| Anggaran | `Frontend/src/pages/Anggaran.jsx` | Fixed 2026-05-23: province prices, spending, anomalies, thresholds fallback dihapus. | `budget-summary`, `price-per-province`, `price-anomalies`, dan legacy `/analytics/budget` 200 setelah hotfix 2026-05-22. API kosong tampil empty state. | Pastikan threshold wilayah selalu tersedia dari backend/config seed. |
| Anomaly | `Frontend/src/pages/AnomalyDetection.jsx:6-19`, `:95-102` | `FALLBACK_ANOMALIES`. | `/api/anomaly-logs` 200. | Ganti fallback dengan empty state saat API kosong. |
| Audit Log | `Frontend/src/pages/AuditLog.jsx` | Fixed 2026-05-23: fallback rows berisi nama dummy dan summary lokal dihapus. | `/api/audit-logs` 200, `/api/audit-logs/summary` fixed 2026-05-22. API kosong tampil empty state. | Detail fallback lokal tetap hanya mempertahankan row yang sudah didapat bila endpoint detail gagal. |
| Export | `Frontend/src/pages/ExportData.jsx` | Fixed 2026-05-23: fallback history, fallback preview export, dan fallback download/retry state dihapus. | `/api/exports` 200, config endpoint fixed 2026-05-22. Retry endpoint belum ada dan kini tampil error, tidak memalsukan sukses. | Tambah `POST /api/exports/:id/retry` pada PR terpisah. |
| Laporan Masyarakat | `Frontend/src/pages/LaporanMasyarakat.jsx` | Fixed 2026-05-23: fallback reports, category counts, trend, top regions, dan status update lokal dihapus. | List reports 200, summary/trend/top region fixed 2026-05-22. API kosong tampil empty state. | Formalisasi kolom/status follow-up lanjutan bila diperlukan. |
| User Management | `Frontend/src/pages/UserManagement.jsx:36-56`, `:216-235` | Fallback users termasuk `Ahmad Suryanto`, `Siti Nurhaliza`. | `/api/users`, `/api/sppg`, `/api/schools` 200 saat admin. | Hapus fallback dummy setelah API create/edit/delete stabil. |
| Lock/Unlock | `Frontend/src/pages/LockUnlock.jsx:61-99`, `:264-301` | Fallback distributions/logs/summary. | List/logs 200, `lock-summary` fixed 2026-05-22. | Kurangi fallback summary menjadi empty/error state setelah endpoint stabil. |
| Override | `Frontend/src/pages/OverrideData.jsx:29-133`, `:414`, `:525-589` | Fallback rows/history/submit marker. | List/audit 200, override history bergantung audit UPDATE marker. | Formalize audit action `OVERRIDE` atau mapping backend/frontend. |
| API Monitoring | `Frontend/src/pages/ApiMonitoring.jsx:6-60` | Fallback summary status. | `/api/monitoring/summary` 200. | Tambah detail monitoring sync SP2KP/queue/job bila diperlukan. |

String dummy yang terkonfirmasi di source: `fallback`, `TODO`, `94.7`, `Ahmad Suryanto`, `Siti Nurhaliza`, `DKI Jakarta`, dan beberapa data sekolah/SPPG dummy.

## Hotfix Verification 2026-05-23 - Priority Fallback Cleanup

| Check | Result |
|---|---|
| Halaman prioritas | Dashboard, Analytics, Anggaran, AuditLog, Export, LaporanMasyarakat sudah tidak memiliki match untuk `FALLBACK`, `fallback`, `dummy`, `preview`, `simulat`, `Ahmad Suryanto`, `Siti Nurhaliza`, `Laporan_Distribusi`, `94.7`, `2.847`, `18.432`, atau `API parsial`. |
| Data kosong | Halaman prioritas memakai empty state/angka 0 ketika API sukses tetapi tidak mengembalikan data. |
| API gagal | Halaman prioritas menampilkan error state, bukan dummy data. |
| Export retry | Karena `POST /api/exports/:id/retry` belum stabil/tersedia, UI sekarang menampilkan error dan tidak lagi memalsukan status processing/done. |
| Lint/build frontend | `npm.cmd --prefix Frontend run lint` berhasil. `npm.cmd --prefix Frontend run build` berhasil setelah `Frontend/dist` lama dibersihkan dengan permission eskalasi. Kegagalan sebelumnya adalah `EPERM unlink` pada artefak build lama, bukan error kompilasi. |
