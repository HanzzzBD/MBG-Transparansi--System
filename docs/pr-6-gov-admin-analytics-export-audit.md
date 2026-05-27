# PR 6 - Gov/Admin Analytics, Export, Audit

## Route Admin Baru

- `/admin/sppg`: master CRUD SPPG untuk admin.
- `/admin/schools`: master CRUD schools untuk admin.
- `/dashboard/master-data` dan `/admin/master-data` diarahkan ke `/admin/sppg`.

Kedua halaman memiliki list, search/filter, create, edit, detail, soft delete, restore, loading, empty, dan error state. Pemilihan SPPG pada form school memakai async searchable select dengan limit pagination kecil, bukan dropdown seluruh dataset.

## Endpoint Restore Baru

- `GET /api/sppg/deleted` admin only.
- `PATCH /api/sppg/:id/restore` admin only.
- `GET /api/schools/deleted` admin only.
- `PATCH /api/schools/:id/restore` admin only.
- `PATCH /api/users/:id/restore` admin only.

Restore memakai `UPDATE` audit action dengan `newData.auditAction = "RESTORE"` agar tidak perlu migration enum `AuditAction`.

## Soft Delete / Restore

- Delete SPPG dan schools tetap soft delete dengan `deletedAt`.
- Restore SPPG dan schools mengembalikan `deletedAt = null`.
- Restore user mengembalikan `deletedAt = null` dan `isActive = true`.
- Tidak ada hard delete baru untuk flow aplikasi.

## Export Test

Test integrasi `Backend/test/pr6-gov-admin-analytics-export-audit.test.js` mencakup:

- Admin/pemerintah membuat export PDF dan XLSX.
- Job export dipoll sampai `done`.
- Download PDF divalidasi magic bytes `%PDF`.
- Download XLSX divalidasi magic bytes ZIP `PK`.
- Role `sppg` dan `sekolah` mendapat `403`.

## Audit Log Old/New Data

Test mencakup:

- Create SPPG: `oldData = null`, `newData` berisi record baru.
- Update SPPG: `oldData` sebelum update, `newData` sesudah update.
- Soft delete SPPG: `oldData.deletedAt = null`, `newData.deletedAt` terisi.
- Restore SPPG: `oldData.deletedAt` terisi, `newData.deletedAt = null`, `auditAction = RESTORE`.
- Lock distribution: `oldData.isLocked = false`, `newData.isLocked = true`.
- Unlock distribution: `oldData.isLocked = true`, `newData.isLocked = false`.
- `userId`, `tableName`, `recordId`, dan `action` dicek pada log penting.
- Tidak ada endpoint delete audit log; `DELETE /api/audit-logs` menghasilkan `404`.

## Permission Matrix

| Area | Admin | Pemerintah | SPPG | Sekolah | Public |
| --- | --- | --- | --- | --- | --- |
| Master SPPG list active | Yes | Yes | Scoped/read existing detail | No write | Public active list tetap tersedia |
| Master SPPG create/update/delete/restore | Yes | No | No | No | No |
| Master SPPG deleted list | Yes | No | No | No | No |
| Master Schools list | Yes | Yes | No | Own detail only | No |
| Master Schools create/update/delete/restore | Yes | No | No | No | No |
| Master Schools deleted list | Yes | No | No | No | No |
| Users restore | Yes | No | No | No | No |
| Export | Yes | Yes | No | No | No |
| Audit log read | Yes | Yes | No | No | No |
| Audit log delete | No endpoint | No endpoint | No endpoint | No endpoint | No endpoint |

## Catatan UI Gov/Admin

Halaman analytics, anomaly, budget, export, dan audit log tetap memakai endpoint existing. Audit log sudah memiliki filter search, action, category, severity, dan date range. Field PIC SPPG hanya ditampilkan di halaman admin master SPPG.
