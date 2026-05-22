# Diagram Index

## Daftar diagram

| File | Tujuan | Sumber kode utama |
| --- | --- | --- |
| `use-case-diagram.drawio` | Memetakan aktor dan fitur backend MBG berdasarkan role dan route. | `Backend/src/routes/index.js`, semua `Backend/src/modules/*/router.js`, `Backend/prisma/schema.prisma` |
| `activity-login.drawio` | Menjelaskan alur login dari request sampai token dan cookie dikirim. | `Backend/src/modules/auth/router.js`, `controller.js`, `service.js`, `Backend/src/middlewares/rateLimiter.js`, `validateRequest.js` |
| `activity-main-flow.drawio` | Menjelaskan flow utama distribusi MBG, bukti, validasi, notifikasi, anomali, dan monitoring. | `Backend/src/modules/distributions/service.js`, `validations/service.js`, `proofs/service.js`, `notifications/runtime.js`, `admin/service.js` |
| `sequence-login.drawio` | Menunjukkan urutan interaksi login antar router, middleware, controller, service, database, bcrypt, dan JWT. | `Backend/src/modules/auth/*`, `Backend/src/utils/auth.js`, `Backend/src/utils/auditLog.js` |
| `sequence-crud.drawio` | Menunjukkan pola CRUD sekolah dari route sampai Prisma dan audit log. | `Backend/src/modules/schools/router.js`, `controller.js`, `service.js`, `Backend/src/utils/auditLog.js` |
| `class-diagram.drawio` | Menjelaskan struktur backend, service/controller utama, dan domain model utama. | `Backend/src/app.js`, `Backend/src/routes/index.js`, `Backend/src/modules/*`, `Backend/prisma/schema.prisma` |
| `erd.drawio` | Memetakan tabel Prisma, primary key, foreign key, dan relasi utama. | `Backend/prisma/schema.prisma` |
| `component-diagram.drawio` | Menjelaskan komponen runtime backend dan dependensi teknis. | `Backend/src/app.js`, `server.js`, `config/*`, `utils/socket.js`, `utils/storage.js`, `modules/exports/runtime.js` |
| `deployment-diagram.drawio` | Menjelaskan node runtime Node.js, PostgreSQL, Redis opsional, storage, worker, dan importer. | `Backend/package.json`, `Backend/src/server.js`, `Backend/src/config/env.js`, `Backend/src/config/storage.js`, `Backend/src/modules/exports/runtime.js` |
| `package-diagram.drawio` | Menjelaskan struktur package/folder backend dan dependency antar package. | `Backend/src`, `Backend/prisma`, `Backend/docs/dapodik-endpoints.md` |
| `state-machine-diagram.drawio` | Menjelaskan lifecycle status Distribution, Validation, Export, dan Issue. | `Backend/prisma/schema.prisma`, `distributions/service.js`, `validations/service.js`, `exports/service.js`, `exports/processor.js`, `issues/service.js` |
| `communication-diagram.drawio` | Menjelaskan komunikasi object saat membuat distribusi. | `Backend/src/modules/distributions/router.js`, `controller.js`, `service.js`, `Backend/src/utils/anomaly.js`, `notification.js` |
| `object-diagram.drawio` | Memberi snapshot instance domain distribusi delivered beserta user, validasi, bukti, notifikasi, audit, dan anomali. | `Backend/prisma/schema.prisma`, `Backend/src/modules/distributions/service.js`, `validations/service.js`, `proofs/service.js` |

## Diagram yang tidak dibuat

Detail alasan ada di `diagram-notes.md`.

- Timing diagram.
- Interaction overview diagram.
- Information flow diagram.
- Profile diagram.
- Composite structure diagram.
- Model diagram terpisah.

## Bagian yang masih asumsi

- Tidak ada frontend di workspace, sehingga klien digambar sebagai `Klien Web / API Consumer`.
- Deployment menggambarkan runtime yang tersirat dari kode dan env, bukan konfigurasi server final.
- Object diagram menggunakan contoh instance berbasis schema, bukan data produksi.
- Sequence CRUD memakai modul `schools` sebagai contoh CRUD representatif.
