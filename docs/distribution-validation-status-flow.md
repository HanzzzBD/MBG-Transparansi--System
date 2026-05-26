# Distribution Validation Status Flow

Tanggal update: 26 Mei 2026

## Ringkasan

Flow "Konfirmasi & Validasi Distribusi" sekarang membedakan sekolah yang belum merespons dengan sekolah yang sudah merespons tetapi melaporkan kendala.

## Arti Status

| Status | Arti | Dampak UI |
|---|---|---|
| `pending` | Sekolah belum memberi respons apa pun. | Masuk daftar "Menunggu Konfirmasi". |
| `verified` | Sekolah mengonfirmasi porsi/kualitas sesuai. | Masuk riwayat validasi. |
| `conflict` | Sekolah mengonfirmasi tetapi ada selisih porsi/kualitas. | Masuk riwayat validasi dan anomaly flow. |
| `issue_reported` | Sekolah mengirim "Laporkan Masalah". | Tidak lagi dihitung pending, masuk riwayat sekolah, dan terlihat oleh SPPG pengirim. |

## Endpoint yang Diperbaiki

| Endpoint | Perubahan |
|---|---|
| `POST /api/school-reports` | Menerima `distributionId` dan `validationId`; membuat laporan sekolah; mengisi `schoolId`, `sppgId`, `distributionId`; mengubah validasi `pending` menjadi `issue_reported` dalam transaction. |
| `GET /api/school-reports` | Role `sppg` dapat membaca laporan yang scoped ke SPPG miliknya. Mendukung filter `distributionId` dan `sppgId` untuk admin/pemerintah. |
| `GET /api/validations?status=pending` | Item yang sudah dilaporkan tidak muncul lagi karena statusnya menjadi `issue_reported`. |
| Dashboard/analytics | `issue_reported` dihitung sebagai sudah direspons, bukan pending. |

## Relasi Data

`school_reports` sekarang menyimpan:

| Field | Sumber |
|---|---|
| `distribution_id` | Distribusi yang dilaporkan sekolah. |
| `school_id` | Sekolah pelapor, diambil dari scope role sekolah atau distribusi. |
| `sppg_id` | SPPG pengirim distribusi, diambil dari distribusi. |
| `reported_by` | User sekolah/admin yang mengirim laporan. |

Jika submit laporan gagal, status validasi tidak berubah karena create report dan update status dijalankan dalam satu transaction.

## Audit Log

Aksi berikut dicatat:

| Aksi | Table |
|---|---|
| Sekolah mengirim laporan masalah | `school_reports` `INSERT` |
| Status validasi berubah ke `issue_reported` | `validations` `UPDATE` |
| Sekolah mengonfirmasi validasi biasa | `validations` `UPDATE` |

## Frontend

Halaman `Konfirmasi & Validasi Distribusi` sekarang:

- mengirim `distributionId` dan `validationId` saat "Laporkan Masalah";
- menampilkan toast sukses;
- memindahkan item dari pending ke riwayat dengan badge `ISSUE REPORTED`;
- refetch data validasi setelah submit.

Sisi SPPG sekarang membaca laporan sekolah melalui `/api/school-reports` pada halaman kendala/riwayat SPPG.

## Hasil Testing

Command yang dijalankan:

```bash
npm.cmd --prefix Backend test -- test/school-validation-flow.e2e.test.js
```

Hasil:

- distribusi pending tetap muncul untuk sekolah terkait;
- konfirmasi sesuai mengubah status menjadi `verified`;
- laporan masalah mengubah status menjadi `issue_reported`;
- laporan masalah tidak muncul lagi pada query pending;
- SPPG pengirim dapat melihat laporan dari sekolah;
- audit log tercatat untuk `school_reports` dan `validations`.
