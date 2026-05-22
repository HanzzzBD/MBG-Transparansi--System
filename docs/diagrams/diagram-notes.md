# Catatan Diagram UML

Referensi utama UML dibaca dari `docs/diagramsnet-uml-reference.md`. Path yang diminta user, `docs/diagrams/diagramsnet-uml-reference.md`, belum ada saat tugas dimulai, sehingga file referensi yang tersedia di `docs/` dipakai sebagai sumber utama. Semua output baru disimpan di `docs/diagrams/`.

## Diagram yang dibuat

Semua diagram minimal yang diminta relevan dengan project backend ini dan sudah dibuat sebagai file `.drawio` terpisah.

- Use case diagram: relevan karena project punya role `admin`, `pemerintah`, `sppg`, `sekolah`, dan akses publik.
- Activity login: relevan karena flow login jelas di `auth/router.js`, `auth/controller.js`, `auth/service.js`, rate limiter, dan middleware validasi.
- Activity main flow: relevan untuk alur distribusi, bukti, validasi, notifikasi, anomali, dan ekspor.
- Sequence login: relevan untuk interaksi request login.
- Sequence CRUD: relevan, memakai CRUD `schools` sebagai pola CRUD paling lengkap.
- Class diagram: relevan untuk struktur controller-service-Prisma dan domain utama.
- ERD: relevan karena schema Prisma tersedia lengkap.
- Component diagram: relevan untuk komponen Express, modules, Prisma, Redis, storage, Socket.IO, dan worker.
- Deployment diagram: relevan untuk runtime Node.js, PostgreSQL, Redis opsional, storage, dan importer.
- Package diagram: relevan karena backend modular per folder.
- State machine diagram: relevan karena ada enum status distribusi, validasi, export, file, dan issue.
- Communication diagram: relevan untuk interaksi object saat membuat distribusi.
- Object diagram: relevan sebagai snapshot instance domain distribusi.

## Diagram UML dari referensi yang tidak dibuat

- Timing diagram: tidak dibuat karena kode tidak memodelkan constraint waktu detail seperti timeline sinyal, durasi antar-state yang perlu dianalisis visual. Yang ada hanya cron dan timeout konfigurasi, sudah dicatat di state/deployment.
- Interaction overview diagram: tidak dibuat karena `activity-main-flow.drawio` sudah menjadi overview control flow utama, sementara detail interaksi dipecah ke sequence dan communication diagram.
- Information flow diagram: tidak dibuat karena aliran informasi sudah tercakup oleh component diagram, activity main flow, ERD, dan sequence diagram. Tidak ada kebutuhan view informasi tingkat tinggi terpisah.
- Profile diagram: tidak dibuat karena project tidak mendefinisikan extension UML/stereotype formal khusus organisasi.
- Composite structure diagram: tidak dibuat karena struktur internal classifier tidak lebih informatif daripada component/class diagram untuk codebase Express ini.
- Model diagram: tidak dibuat sebagai file terpisah karena package dan component diagram sudah mewakili view arsitektural/logis.

## Asumsi

- Frontend tidak ada di workspace ini, sehingga label `Klien Web / API Consumer` digambar sebagai aktor eksternal berdasarkan kontrak API backend.
- Deployment production digambar sebagai pola runtime dari kode dan konfigurasi, bukan konfigurasi infrastruktur final.
- Object diagram memakai contoh instance realistis berdasarkan schema, bukan data database aktual.
- Diagram sequence CRUD memakai modul `schools` sebagai representasi CRUD karena route, controller, service, audit log, dan soft delete-nya lengkap.
