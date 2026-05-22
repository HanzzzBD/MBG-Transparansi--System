# Referensi diagrams.net dan UML

Tanggal eksplorasi: 2026-05-18

Dokumen ini merangkum hasil eksplorasi app.diagrams.net/draw.io dan dokumentasi UML di uml-diagrams.org. Cakupannya adalah seluruh kategori fitur utama yang ditemukan di aplikasi dan dokumentasi resmi, plus ringkasan praktis tipe diagram UML agar tim dapat memilih diagram yang tepat saat membuat dokumentasi sistem.

## 1. diagrams.net / draw.io

### 1.1 Gambaran umum

diagrams.net, yang juga dikenal sebagai draw.io, adalah editor diagram berbasis web untuk membuat flowchart, UML, ERD, BPMN, network diagram, database schema, circuit diagram, whiteboard, dan diagram teknis lain. Aplikasi web utamanya berada di:

- https://app.diagrams.net/

Catatan eksplorasi: halaman app membutuhkan JavaScript untuk UI penuh. Informasi fitur di bawah disusun dari halaman app, dokumentasi resmi draw.io, dan halaman produk draw.io.

### 1.2 Kegunaan utama

Fitur diagrams.net dapat dipakai untuk:

- Flowchart proses bisnis dan proses teknis.
- UML untuk analisis, desain, dan dokumentasi software.
- ERD dan database schema.
- BPMN dan proses operasional.
- Network, cloud, infrastructure, dan deployment diagram.
- Org chart, mind map, wireframe, whiteboard, dan diagram presentasi.
- Diagram kolaboratif di ekosistem Atlassian, Google Drive, OneDrive, dan storage cloud lain.

### 1.3 Area UI editor

Editor diagrams.net terdiri dari beberapa area utama:

- Menu utama: akses ke file, edit, view, arrange, insert, extras, help, export/import, page, layer, dan pengaturan lanjutan.
- Toolbar atas: shortcut untuk undo/redo, zoom, style, fill, line, connector, waypoint routing, insert shape/image/template/layout/table, fullscreen, format panel, dan collapse header.
- Panel kiri: shape libraries, search shape, scratchpad, dan tombol More Shapes.
- Canvas tengah: area menggambar dengan grid, zoom, pan, page view, dan multi-page tabs.
- Panel kanan: format panel yang kontekstual. Isinya berubah tergantung apakah yang dipilih shape, connector, text, atau tidak ada pilihan.
- Page tabs: halaman diagram jamak dalam satu file.

### 1.4 Shape libraries

Shape library adalah kumpulan shape yang dikelompokkan menurut jenis diagram. Tidak semua library aktif secara default karena jumlahnya banyak. Library dapat diaktifkan lewat More Shapes.

Kategori teknis penting:

- UML dan UML 2.5.
- ERD / Entity Relation.
- BPMN dan BPMN 2.0.
- AWS, Azure, Alibaba Cloud, IBM, SAP.
- Networking and cloud.
- Citrix.
- General, flowchart, basic, arrows, containers, mockups, electrical, rack, floorplan, org chart, dan library lain sesuai kebutuhan.

Praktik yang disarankan:

- Aktifkan hanya library yang relevan agar panel kiri tidak terlalu ramai.
- Gunakan search untuk mencari shape spesifik.
- Gunakan Scratchpad untuk menyimpan shape, grup shape, atau potongan diagram yang sering dipakai.
- Gunakan custom library untuk logo organisasi, ikon internal, template komponen, atau notasi khusus tim.

### 1.5 Canvas, page, dan navigasi

Fitur canvas:

- Grid untuk alignment.
- Pan dengan scrollbar, drag kanan/middle click, atau gesture touch.
- Zoom toolbar atau Ctrl/Cmd + scroll.
- Rulers dapat diaktifkan dari menu View.
- Page view dapat diaktifkan/dimatikan.
- Multi-page diagram untuk memecah diagram besar menjadi beberapa halaman dalam satu file.

Kapan multi-page dipakai:

- Satu file untuk seluruh dokumentasi modul.
- Page 1 sebagai overview.
- Page berikutnya untuk activity, sequence, class, ERD, deployment, dan notes.
- Diagram kompleks yang perlu dipisahkan tetapi tetap satu konteks.

### 1.6 Format panel

Format panel di kanan memiliki beberapa tab:

- Style: fill, stroke, opacity, shadow, sketch, rounded, line style, arrows, connector style, copy/paste style.
- Text: font, size, bold/italic, alignment, direction, spacing, word wrap, formatted text, hyperlink.
- Arrange: posisi, ukuran, rotate, flip, align, distribute, z-order, group/ungroup, edit data, edit link.
- Diagram/global options: muncul saat tidak ada object dipilih; mengatur canvas, page, grid, global style, dan properti dokumen.

### 1.7 Shape editing

Fitur shape:

- Insert shape dari sidebar, menu Insert, toolbar, atau template.
- Drag and drop dari library ke canvas.
- Resize, rotate, duplicate, replace, swap in place.
- Group dan ungroup.
- Lock/unlock element.
- Autosize shape agar label muat.
- Position label inside/outside.
- Add rows untuk ERD table, list, dan UML class.
- Crop image.
- Freehand drawing.
- Shadow, fill pattern, adaptive colors, custom color palette.
- Custom shape dengan text/XML shape definition.
- Custom connection points pada shape.
- Shape metadata via Edit Data.

### 1.8 Connector editing

Connector adalah garis hubungan antar-shape. diagrams.net mendukung:

- Floating connector: ujung connector menempel dinamis pada perimeter shape dan mencari jalur pendek.
- Fixed connector: ujung connector menempel pada connection point tertentu.
- Connector ke mana saja pada shape.
- Waypoints untuk mengatur rute connector.
- Routing style: straight, orthogonal, curved, simple, isometric, entity relation.
- Arrowhead di source/target, termasuk simbol teknis dan UML.
- No arrow, bidirectional arrow, reverse connector.
- Connector label di tengah, source end, dan target end.
- Pattern solid/dashed/dotted.
- Thickness, opacity, color, line jumps.
- Rounded/sharp/curved bends.
- Flow animation untuk memperlihatkan arah aliran.
- Join connector memakai waypoint shape.
- Copy/paste connector style dan set default connector style.

Praktik untuk UML:

- Gunakan arrowhead sesuai makna relasi, bukan hanya dekorasi.
- Pakai dashed arrow untuk dependency/realization.
- Pakai solid line untuk association.
- Pakai diamond putih/hitam untuk aggregation/composition bila library UML tersedia.
- Beri label connector hanya saat maknanya menambah informasi.

### 1.9 Layers

Layers membantu memisahkan kompleksitas diagram. Fitur layer:

- Add/remove/rename layer.
- Pindahkan shape/connector antar-layer.
- Show/hide layer.
- Lock layer agar tidak berubah.
- Select semua object pada layer.
- Urutan layer memengaruhi tampilan depan/belakang.

Batasan penting:

- Satu shape atau connector hanya berada di satu layer.
- Layer cocok untuk menampilkan level detail berbeda, misalnya baseline arsitektur, data flow, security boundary, dan deployment overlay.

### 1.10 Link, metadata, dan interaktivitas

Fitur lanjutan:

- Hyperlink pada shape/text.
- Custom links untuk navigasi antar-page atau toggle layer.
- Edit Data untuk metadata custom pada shape dan connector.
- Tooltip dari metadata.
- Global custom property.
- Search berdasarkan label, metadata, tag, dan shape.
- Public publish as link.
- Export as URL, yaitu diagram dikodekan di URL.
- Embed HTML/SVG untuk web page.

Contoh pemakaian:

- Shape "Backend API" diberi link ke endpoint docs.
- Shape "School" diberi metadata `table=schools`.
- Overview diagram memiliki link ke page sequence diagram.
- Security layer dapat ditampilkan/sembunyikan.

### 1.11 Import, export, dan format file

Format native:

- `.drawio` dan `.xml` menyimpan diagram penuh dan dapat dibuka ulang untuk diedit.

Import yang didukung:

- `.drawio` / `.xml`.
- `.gliffy`.
- `.json` dari Lucidchart.
- `.vsdx` dari Visio.
- `.png` dengan XML.
- `.jpeg`.
- `.svg`.
- `.csv` untuk membuat diagram otomatis dari data CSV.

Export yang didukung:

- `.drawio` / `.xml`.
- `.png`, `.jpg`/`.jpeg`, `.webp`, `.svg`.
- `.pdf`.
- `.html`.
- `.csv`.
- `.gliffy`.
- URL.

Catatan penting:

- PNG, SVG, dan PDF dapat menyertakan salinan data diagram sehingga file tersebut bisa dibuka kembali di draw.io untuk diedit.
- JPEG dan WebP umumnya hanya membawa hasil visual, bukan data diagram.
- Export HTML memakai draw.io viewer dan membutuhkan koneksi internet untuk render yang bergantung pada script hosted.
- Export URL menyimpan data diagram di link, bukan di file terpisah.
- Export advanced mendukung zoom, width/height, DPI, transparent background, border width, dan grid.

### 1.12 Storage dan integrasi

Lokasi penyimpanan yang didukung:

- Device/local file.
- Browser/local storage.
- Google Drive.
- Microsoft OneDrive.
- Dropbox.
- GitHub.
- GitLab.
- Atlassian Confluence.
- Atlassian Jira.

Catatan:

- Device/browser dapat dipakai offline.
- Cloud storage memerlukan autentikasi dan izin akses file.
- diagrams.net akan mengingat lokasi penyimpanan terakhir.
- Di Confluence/Jira, diagram bisa menempel pada halaman/issue dan mendukung workflow kolaboratif.
- Google Drive mendukung komentar dan revision history.
- OneDrive mendukung integrasi dengan Microsoft Word, Excel, dan PowerPoint melalui export/insert yang sesuai.

### 1.13 Kolaborasi, autosave, dan keamanan

Fitur kolaborasi:

- Real-time collaboration terutama di Cloud/Atlassian.
- Revision history di beberapa storage/integrasi.
- Autosave untuk mengurangi risiko kehilangan perubahan.
- Comments pada integrasi tertentu.

Keamanan:

- Model penyimpanan bergantung pada lokasi pilihan user.
- draw.io menekankan pendekatan data privacy: diagram disimpan di storage yang dipilih user, bukan sebagai file permanen di server draw.io.
- Untuk lingkungan enterprise, tersedia opsi Zero Egress dan pengaturan admin tertentu.
- AI Generate membutuhkan pengiriman prompt ke layanan AI pihak ketiga, sehingga harus dievaluasi bila dokumen berisi data sensitif.

### 1.14 Template, layout, dan generate

Fitur pembuatan cepat:

- Template manager untuk diagram siap pakai.
- Insert template ke diagram aktif.
- Insert layouts untuk struktur cepat.
- Automatic layouts untuk merapikan graph/diagram.
- CSV import untuk menghasilkan diagram dari data.
- SQL plugin untuk membuat ERD dari SQL.
- Smart Templates dan Generate tool untuk membuat diagram berbasis prompt.
- Generate tool dapat memilih generator yang sesuai untuk mockup, cloud infrastructure, Mermaid/code-based diagram, Gantt, sequence, dan jenis diagram lain.

Praktik aman:

- Jangan masukkan data rahasia ke prompt AI.
- Review hasil AI sebelum dipakai sebagai dokumentasi resmi.
- Gunakan template sebagai starting point, bukan final tanpa validasi.

### 1.15 Customization dan konfigurasi

Yang dapat dikustomisasi:

- Theme editor, termasuk light/dark mode dan sketch style.
- Language/interface menu.
- Fonts dan custom fonts pada integrasi tertentu.
- Color palettes.
- Default styles untuk shape dan connector.
- Global style.
- Built-in/custom libraries.
- CSS dan tampilan editor pada mode embed/admin tertentu.
- Default XML untuk blank diagram.
- URL parameters dan location hash properties.
- XML compression.
- Default connector length.
- Autosave delay.
- AI diagram generation settings.

### 1.16 Fitur whiteboard / sketch

Fitur yang relevan:

- Sketch editor theme.
- Freehand shapes.
- Whiteboard style untuk brainstorming.
- Minimize/move format panel di Sketch editor.
- Custom libraries di Sketch editor.
- Insert template di Sketch editor.
- Table dan cross-functional table.

### 1.17 Troubleshooting dan keterbatasan

Hal yang perlu dicatat:

- Import `.vsd`, `.vdx`, `.vss` punya batasan; format modern `.vsdx` lebih didukung.
- Desktop app tidak selalu mendukung import format lama tertentu.
- Hasil import dari Visio/Lucidchart/Gliffy bisa memiliki perbedaan tampilan.
- Export SVG dapat bermasalah pada font tertentu bila font tidak tersedia di lingkungan pembaca.
- Export PDF punya fallback lewat print to PDF bila export langsung gagal.
- Search external clipart library membutuhkan akses server draw.io dan bisa tidak tersedia di mode desktop/lockdown tertentu.

## 2. UML dari uml-diagrams.org

### 2.1 Apa itu UML

UML, Unified Modeling Language, adalah bahasa pemodelan visual standar untuk mendeskripsikan, menspesifikasikan, merancang, dan mendokumentasikan proses bisnis serta sistem berbasis software. UML adalah bahasa pemodelan, bukan proses pengembangan software.

Implikasi:

- UML tidak menentukan urutan kerja tim.
- UML tidak menggantikan requirement, code, test, atau dokumentasi tekstual.
- Diagram UML adalah view parsial dari model, sehingga tidak selalu memuat semua detail sistem.
- Satu diagram dapat mencampur elemen bila perlu, tetapi sebaiknya tetap menjaga tujuan diagram agar mudah dibaca.

Versi yang dirujuk uml-diagrams.org adalah UML 2.5. Situs tersebut mencatat bahwa UML 2.5 dirilis Juni 2015 dan dikelola oleh OMG.

### 2.2 Klasifikasi UML 2.5

UML 2.5 membagi diagram menjadi dua kelompok besar:

- Structure diagrams: menunjukkan struktur statis sistem, bagian-bagian sistem, dan relasinya.
- Behavior diagrams: menunjukkan perilaku dinamis sistem dari waktu ke waktu.

Interaction diagrams adalah subkelompok behavior diagrams.

### 2.3 Structure diagrams

| Diagram | Fungsi | Elemen utama |
| --- | --- | --- |
| Class diagram | Struktur class/interface, atribut, operasi, constraint, dan relasi. | Class, interface, property, operation, association, generalization, dependency. |
| Object diagram | Snapshot instance/object, slot, value, dan link pada waktu tertentu. | Instance specification, object, slot, link. |
| Package diagram | Pengelompokan model/package dan dependency antar-package. | Package, dependency, import, merge. |
| Model diagram | View arsitektural/logis/behavioral pada level model. | Model, package, dependency. |
| Composite structure diagram | Struktur internal classifier, part, port, connector, dan collaboration. | Structured classifier, part, port, connector, collaboration. |
| Component diagram | Komponen, interface yang disediakan/dibutuhkan, port, dan dependency. | Component, provided/required interface, port, connector, artifact, dependency. |
| Deployment diagram | Arsitektur runtime dan deployment artifact ke node/environment. | Artifact, node, device, execution environment, deployment, communication path. |
| Profile diagram | Extension mechanism UML untuk domain/platform tertentu. | Profile, stereotype, metaclass, extension, tagged value, constraint. |

### 2.4 Behavior diagrams

| Diagram | Fungsi | Elemen utama |
| --- | --- | --- |
| Use case diagram | Kebutuhan/fitur sistem dari sudut pandang actor eksternal. | Actor, use case, subject, association, include, extend. |
| Information flow diagram | Pertukaran informasi tingkat tinggi tanpa detail mekanisme/kontrol. | Information flow, information item. |
| Activity diagram | Alur kontrol/object flow, sequence, condition, parallelism, workflow. | Activity, action, control node, object node, activity edge, partition. |
| State machine diagram | Perilaku diskrit melalui state dan transition. | State, transition, pseudostate, trigger, guard, entry/do/exit. |

### 2.5 Interaction diagrams

| Diagram | Fungsi | Elemen utama |
| --- | --- | --- |
| Sequence diagram | Urutan pertukaran message antar-lifeline dari atas ke bawah. | Lifeline, execution specification, message, combined fragment, interaction use. |
| Communication diagram | Interaksi antar-object dalam layout bebas dengan numbering message. | Lifeline, message, sequence expression. |
| Timing diagram | Perubahan state/condition terhadap waktu. | Lifeline, timeline, state/condition, message, duration/time constraint. |
| Interaction overview diagram | Overview control flow yang node-nya interaction atau interaction use. | Initial/final, decision/merge, fork/join, interaction, interaction use. |

### 2.6 Notasi inti UML

Relasi umum:

- Association: garis solid antar-classifier/object. Dapat punya role name, navigability, multiplicity, dan association class.
- Aggregation: whole-part dengan diamond kosong di sisi whole.
- Composition: whole-part kuat dengan diamond terisi di sisi whole; lifecycle part biasanya bergantung pada whole.
- Generalization: inheritance, garis solid dengan triangle kosong menuju parent/superclass.
- Realization: implementasi interface/contract, biasanya dashed line dengan triangle kosong menuju interface.
- Dependency: hubungan client-supplier, garis putus-putus berpanah dari client ke supplier.
- Usage: dependency dengan stereotype `<<use>>`.
- Include: use case wajib menggunakan use case lain, stereotype `<<include>>`.
- Extend: use case tambahan/opsional memperluas base use case, stereotype `<<extend>>`.

Multiplicity:

- `1`: tepat satu.
- `0..1`: opsional.
- `*` atau `0..*`: banyak, bisa nol.
- `1..*`: minimal satu.
- `m..n`: rentang tertentu.

Visibility:

- `+`: public.
- `-`: private.
- `#`: protected.
- `~`: package.

Constraint dan guard:

- Constraint biasanya ditulis dalam `{...}`.
- Guard biasanya ditulis dalam `[...]`.
- Transition dapat memakai format `trigger [guard] / effect`.

Stereotype:

- Ditulis sebagai `<<stereotype>>`.
- Dipakai untuk memperjelas variasi semantic, misalnya `<<interface>>`, `<<use>>`, `<<include>>`, `<<extend>>`, `<<artifact>>`, atau stereotype domain sendiri.

Frame:

- Banyak diagram dapat dibungkus frame.
- Frame membantu memberi nama diagram dan tipe diagram, misalnya `sd Login`, `act Import Data`, atau `stm UserAccount`.

### 2.7 Use case diagram

Tujuan:

- Menangkap kebutuhan eksternal.
- Menunjukkan aktor dan fitur yang disediakan sistem.
- Membatasi scope sistem lewat subject/system boundary.

Elemen:

- Actor: pihak eksternal yang berinteraksi dengan sistem.
- Use case: fungsi bernilai bagi actor/stakeholder.
- Subject: sistem atau sub-sistem yang sedang dibahas.
- Association: actor berinteraksi dengan use case.
- Include: reuse perilaku wajib.
- Extend: perilaku tambahan dengan kondisi tertentu.

Kapan dipakai:

- Awal analisis requirement.
- Diskusi scope dengan stakeholder non-teknis.
- Menentukan fitur admin, sekolah, SPPG, publik, dan role lain.

Anti-pattern:

- Use case terlalu teknis seperti "Insert row to database".
- Actor internal class/module.
- Semua relasi dijadikan include/extend tanpa alasan.

### 2.8 Activity diagram

Tujuan:

- Menjelaskan workflow, business process, atau alur sistem.
- Menunjukkan decision, parallel flow, merge, fork/join, dan object flow.

Elemen:

- Action.
- Initial/final node.
- Decision/merge.
- Fork/join.
- Activity edge.
- Object flow.
- Partition/swimlane.
- Guard pada edge.

Kapan dipakai:

- Alur import data.
- Proses validasi laporan.
- Workflow distribusi makanan.
- Proses approval.

Praktik:

- Gunakan swimlane untuk role/unit kerja.
- Gunakan guard yang jelas, misalnya `[valid]` dan `[invalid]`.
- Jangan mencampur terlalu banyak detail teknis dalam diagram bisnis.

### 2.9 Sequence diagram

Tujuan:

- Menunjukkan urutan message antar-participant.
- Cocok untuk request-response, proses transaksi, dan integrasi antar-service.

Elemen:

- Lifeline.
- Message.
- Execution specification/activation.
- Return message.
- Combined fragment: `alt`, `opt`, `loop`, `par`, `break`, `ref`.
- Interaction use.
- Destruction occurrence.

Kapan dipakai:

- API request dari frontend ke backend.
- Login dan authorization.
- Import Dapodik.
- Generate laporan.
- Integrasi storage atau external API.

Praktik:

- Actor/client di kiri, dependency makin ke kanan.
- Gunakan `alt` untuk sukses/gagal.
- Gunakan `loop` untuk iterasi.
- Gunakan `ref` untuk memecah sequence besar.

### 2.10 Class dan object diagram

Class diagram:

- Menjelaskan class/interface, atribut, operasi, constraint, dan relasi.
- Cocok untuk domain model, desain implementasi, dan struktur entity.

Object diagram:

- Snapshot object/instance pada waktu tertentu.
- Cocok untuk menjelaskan contoh data, state rumit, atau hasil relasi runtime.

Elemen class diagram:

- Class: nama, attributes, operations.
- Interface.
- Association, aggregation, composition.
- Generalization, realization, dependency.
- Multiplicity, role name, navigability.
- Constraint.

Kapan dipakai:

- Domain MBG: School, SPPG, Distribution, Validation, Report, User.
- Relasi data sebelum/selama desain database.
- Menjelaskan class service/controller bila perlu.

Praktik:

- Untuk database, ERD lebih tepat daripada class diagram bila fokusnya tabel, PK/FK, dan cardinality database.
- Untuk domain logic, class diagram lebih tepat.

### 2.11 Package dan model diagram

Package diagram:

- Menunjukkan struktur package/module dan dependency antar-package.
- Cocok untuk modularisasi backend/frontend.

Model diagram:

- View arsitektur di level lebih abstrak, misalnya layered architecture.

Kapan dipakai:

- Memetakan `modules/schools`, `modules/dapodik`, `modules/reports`, dan shared utilities.
- Menjelaskan dependency antar-layer: routes, controller, service, prisma, database.

### 2.12 Component diagram

Tujuan:

- Menunjukkan komponen software dan interface antar-komponen.
- Cocok untuk arsitektur service atau module-level design.

Elemen:

- Component.
- Provided interface.
- Required interface.
- Port.
- Connector.
- Artifact.
- Dependency/usage.

Kapan dipakai:

- Frontend, Backend API, PostgreSQL/DB, storage, auth module.
- Menjelaskan boundary antarmodul.
- Menunjukkan kontrak API atau dependency eksternal.

### 2.13 Deployment diagram

Tujuan:

- Menjelaskan arsitektur runtime: artifact ditempatkan ke node/environment.
- Menunjukkan hardware, server, container, execution environment, dan communication path.

Elemen:

- Node.
- Device.
- Execution environment.
- Artifact.
- Deployment.
- Communication path.
- Deployment specification.

Kapan dipakai:

- Local dev setup.
- Production architecture.
- Backend, frontend build, database, reverse proxy, file storage.
- Perbedaan staging vs production.

Praktik:

- Di UML 2.x, artifact yang dideploy ke node, bukan component secara langsung.
- Component dapat dimanifestasikan oleh artifact.

### 2.14 Composite structure diagram

Tujuan:

- Menunjukkan struktur internal classifier.
- Menunjukkan part, port, dan connector di dalam classifier.
- Menjelaskan collaboration roles.

Kapan dipakai:

- Saat class/component perlu dijelaskan bagian internalnya.
- Desain komponen kompleks seperti Importer atau Notification Runtime.

Catatan:

- Ini bukan diagram pertama yang biasanya dibutuhkan.
- Pakai bila class/component diagram tidak cukup menjelaskan internal runtime collaboration.

### 2.15 State machine diagram

Tujuan:

- Menjelaskan lifecycle object atau proses yang memiliki state diskrit.

Elemen:

- State.
- Initial pseudostate.
- Final state.
- Transition.
- Trigger.
- Guard.
- Effect.
- Entry/do/exit behavior.
- Choice, junction, fork, join.
- Composite state, region, history.

Kapan dipakai:

- Status distribusi.
- Status validasi.
- Lifecycle laporan.
- Status import batch.
- User account lifecycle.

Praktik:

- Gunakan jika perilaku bergantung pada state.
- Jika hanya workflow linear, activity diagram lebih sederhana.

### 2.16 Communication diagram

Tujuan:

- Menunjukkan interaksi object dengan layout bebas.
- Urutan message ditunjukkan dengan sequence numbering, bukan posisi vertikal.

Kapan dipakai:

- Saat struktur hubungan object lebih penting daripada timeline.
- Alternatif lebih ringkas untuk sequence diagram sederhana.

Catatan:

- Untuk request-response API, sequence diagram biasanya lebih mudah dibaca.

### 2.17 Timing diagram

Tujuan:

- Menjelaskan perubahan state/condition sepanjang waktu.
- Cocok bila timing, delay, duration, atau SLA adalah fokus utama.

Kapan dipakai:

- Latency request.
- SLA distribusi.
- Jadwal sinkronisasi.
- Timeout/expiration token.

### 2.18 Interaction overview diagram

Tujuan:

- Overview control flow yang node-nya interaction atau interaction use.
- Menggabungkan gaya activity diagram dan interaction diagram.

Kapan dipakai:

- Proses besar dengan beberapa sequence terpisah.
- Membuat peta interaksi level tinggi lalu detailnya di page diagram lain.

### 2.19 Information flow diagram

Tujuan:

- Menjelaskan pertukaran informasi tingkat tinggi.
- Tidak menjelaskan mekanisme, urutan, atau kondisi kontrol secara detail.

Kapan dipakai:

- Tahap awal arsitektur informasi.
- Menjelaskan data apa yang bergerak antar-domain sebelum desain teknis final.

Catatan:

- Ekspresivitasnya terbatas. Untuk detail teknis, gunakan activity, sequence, data flow, atau component diagram.

### 2.20 Profile diagram

Tujuan:

- Mendefinisikan stereotype, tagged value, dan constraint khusus domain/platform.

Kapan dipakai:

- Membuat extension UML untuk domain khusus.
- Menstandarkan notasi internal organisasi.

Catatan:

- Jarang dibutuhkan untuk dokumentasi aplikasi biasa.
- Berguna bila tim ingin membuat vocabulary UML khusus MBG, misalnya stereotype `<<public endpoint>>`, `<<admin-only>>`, atau `<<audit logged>>`.

## 3. Rekomendasi penggunaan untuk project MBG Transparansi

### 3.1 Diagram prioritas

Untuk dokumentasi sistem ini, urutan diagram yang paling berguna:

1. Use case diagram: role admin, SPPG, sekolah, publik, dan fitur utama.
2. Activity diagram: alur import Dapodik, distribusi, validasi, laporan publik.
3. Sequence diagram: request penting seperti login, list school, promote staged school, validate distribution.
4. ERD: struktur database Prisma, tabel, PK/FK, dan relasi.
5. Component diagram: frontend, backend, modules, Prisma, database, external data source.
6. Deployment diagram: local/dev/prod deployment.
7. State machine diagram: lifecycle distribution/validation/report bila statusnya kompleks.

### 3.2 Struktur file diagram yang disarankan

Simpan file editable:

- `docs/diagrams/mbg-overview.drawio`
- `docs/diagrams/mbg-use-cases.drawio`
- `docs/diagrams/mbg-data-model.drawio`
- `docs/diagrams/mbg-backend-sequences.drawio`
- `docs/diagrams/mbg-deployment.drawio`

Export untuk dibaca cepat:

- `docs/diagrams/export/*.png`
- `docs/diagrams/export/*.svg`
- `docs/diagrams/export/*.pdf`

Aturan:

- Commit file `.drawio` sebagai source of truth.
- Export PNG/SVG hanya bila dibutuhkan di README/docs.
- Gunakan nama page yang jelas: `Overview`, `School List`, `Dapodik Import`, `Validation Flow`.

### 3.3 Konvensi style

Saran style:

- Gunakan warna berdasarkan layer/domain, bukan dekorasi.
- Konsistenkan connector:
  - Solid line: association/data relation.
  - Dashed arrow: dependency.
  - Triangle kosong: inheritance/realization.
  - Open arrow: control/message flow.
- Gunakan note untuk asumsi penting.
- Jangan penuhi satu diagram dengan semua detail; pecah ke multi-page.
- Tambahkan link antar-page dari overview ke detail.
- Gunakan layer untuk optional overlay seperti security, data flow, atau deployment environment.

### 3.4 Checklist membuat diagram di diagrams.net

Checklist awal:

- Pilih tipe diagram dan audience.
- Aktifkan library yang relevan, misalnya UML 2.5, ERD, BPMN, AWS/Azure.
- Pakai template bila tersedia.
- Buat halaman overview sebelum halaman detail.
- Pakai naming object yang konsisten dengan codebase.
- Tambahkan metadata untuk object penting bila perlu.
- Simpan sebagai `.drawio`.
- Export sebagai PNG/SVG/PDF bila perlu dibaca di luar editor.

Checklist review:

- Apakah diagram punya judul dan scope?
- Apakah setiap connector punya makna jelas?
- Apakah actor, component, class, dan table memakai nama yang konsisten?
- Apakah diagram terlalu penuh?
- Apakah ada detail yang lebih baik dipindah ke page lain?
- Apakah informasi sensitif aman untuk dicommit?

## 4. Referensi

diagrams.net / draw.io:

- https://app.diagrams.net/
- https://www.drawio.com/doc/getting-started-editor
- https://www.drawio.com/doc/faq/
- https://www.drawio.com/doc/faq/storage-location-select
- https://www.drawio.com/doc/faq/export-diagram
- https://www.drawio.com/doc/faq/shape-search
- https://www.drawio.com/doc/layers
- https://www.drawio.com/doc/faq/connectors.html
- https://www.drawio.com/doc/faq/connector-styles
- https://www.drawio.com/doc/faq/diagram-source-edit
- https://www.drawio.com/doc/faq/shape-metadata
- https://www.drawio.com/doc/faq/configure-diagram-editor
- https://drawio-app.com/product/
- https://drawio-app.com/blog/draw-io-training-exercise-10-export-and-import/
- https://drawio-app.com/blog/the-draw-io-glossary/
- https://drawio-app.com/blog/network-and-technical-diagram-shapes-in-draw-io/
- https://drawio-app.com/blog/the-generate-tool-in-draw-io/

UML:

- https://www.uml-diagrams.org/
- https://www.uml-diagrams.org/uml-25-diagrams.html
- https://www.uml-diagrams.org/use-case-diagrams.html
- https://www.uml-diagrams.org/activity-diagrams.html
- https://www.uml-diagrams.org/sequence-diagrams.html
- https://www.uml-diagrams.org/class-diagrams-overview.html
- https://www.uml-diagrams.org/package-diagrams-overview.html
- https://www.uml-diagrams.org/composite-structure-diagrams.html
- https://www.uml-diagrams.org/component-diagrams.html
- https://www.uml-diagrams.org/deployment-diagrams.html
- https://www.uml-diagrams.org/state-machine-diagrams.html
- https://www.uml-diagrams.org/communication-diagrams.html
- https://www.uml-diagrams.org/timing-diagrams.html
- https://www.uml-diagrams.org/interaction-overview-diagrams.html
- https://www.uml-diagrams.org/information-flow-diagrams.html
- https://www.uml-diagrams.org/profile-diagrams.html
- https://www.uml-diagrams.org/association.html
- https://www.uml-diagrams.org/dependency.html
