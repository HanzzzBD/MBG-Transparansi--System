Buatkan Design System lengkap untuk MBG Transparency System dengan struktur file:

1. src/components/ui/index.jsx
2. src/components/ui/ui.css

Jangan satukan styling panjang di JSX. Semua styling utama wajib ditaruh di ui.css sebagai class reusable. File index.jsx hanya berisi logic React, struktur komponen, props, dan className yang mengarah ke class CSS eksternal.

DESIGN SYSTEM SPEC:

Color Palette wajib dibuat sebagai CSS variables di ui.css:
:root {
  --color-sky: #b5e0ea;
  --color-primary: #0071e4;
  --color-navy: #0f4c81;
  --color-white: #ffffff;
  --color-light-gray: #f4f8fb;
  --color-text-dark: #111928;
  --color-text-muted: #6b7280;
  --color-success: #057a55;
  --color-warning: #92400e;
  --color-danger: #9b1c1c;
}

Typography:
- H1: 36px Bold #0f4c81
- H2: 28px SemiBold #0071e4
- H3: 22px SemiBold #0f4c81
- Body: 16px Regular #111928
- Caption: 13px Regular #6b7280
- KPI Value: 40px Bold #0071e4

Buat typography class di ui.css:
- .ui-h1
- .ui-h2
- .ui-h3
- .ui-body
- .ui-caption
- .ui-kpi-value

Komponen yang harus dibuat di index.jsx dan export sebagai named exports:

1. KPICard
Props:
- title
- value
- icon
- change
- color
- iconBg

2. StatusBadge
Props:
- status: active | inactive | problem | verified | conflict | pending | delivered | failed
- size

3. PrimaryButton
Props:
- children
- onClick
- disabled
- loading
- type
- className

4. SecondaryButton
Props:
- children
- onClick
- disabled
- type
- className

5. DataTable
Props:
- columns [{ key, label, render? }]
- data []
- loading
- emptyText

6. Card
Props:
- children
- className
- title
- action

7. AlertPanel
Props:
- type: info | warning | danger | success
- message
- title

8. Modal
Props:
- isOpen
- onClose
- title
- children
- size

9. LoadingSpinner
Props:
- size

10. FilterBar
Props:
- onProvinceChange
- onCityChange
- onDateChange
- onStatusChange
Semua optional.

11. SearchInput
Props:
- placeholder
- value
- onChange

12. SidebarItem
Props:
- icon
- label
- isActive
- onClick
- badge

13. TopBar
Props:
- title
- breadcrumb
- userName
- userRole
- notifCount
- onSearch

14. RoleBadge
Props:
- role: admin | pemerintah | sppg | sekolah | umum

ATURAN STYLING:

- Semua CSS utama masuk ke src/components/ui/ui.css
- index.jsx wajib import "./ui.css"
- Jangan gunakan inline style kecuali benar-benar dinamis, misalnya warna icon dari props color
- Jangan membuat style panjang di className JSX
- Hindari Tailwind panjang di JSX
- Boleh tetap memakai Tailwind utility sederhana untuk layout kecil jika memang perlu, tapi styling komponen utama harus pakai class dari ui.css
- Semua warna harus memakai CSS variables
- Jangan hardcode warna langsung di JSX
- Semua komponen harus responsive
- Semua komponen harus punya hover state
- Semua komponen interaktif harus punya focus state
- Semua komponen harus accessible dasar: button type jelas, aria-label jika perlu, modal pakai role dialog

STRUKTUR CLASS CSS YANG WAJIB ADA DI ui.css:

Base:
- .ui-card
- .ui-card-header
- .ui-card-title
- .ui-card-action
- .ui-btn
- .ui-btn-primary
- .ui-btn-secondary
- .ui-spinner
- .ui-input
- .ui-select
- .ui-textarea

KPI:
- .ui-kpi-card
- .ui-kpi-icon
- .ui-kpi-content
- .ui-kpi-title
- .ui-kpi-change

Badge:
- .ui-badge
- .ui-badge-sm
- .ui-badge-md
- .ui-badge-active
- .ui-badge-inactive
- .ui-badge-problem
- .ui-badge-verified
- .ui-badge-conflict
- .ui-badge-pending
- .ui-badge-delivered
- .ui-badge-failed

Table:
- .ui-table-wrap
- .ui-table
- .ui-table-empty
- .ui-table-loading

Alert:
- .ui-alert
- .ui-alert-info
- .ui-alert-warning
- .ui-alert-danger
- .ui-alert-success
- .ui-alert-title
- .ui-alert-message

Modal:
- .ui-modal-backdrop
- .ui-modal
- .ui-modal-sm
- .ui-modal-md
- .ui-modal-lg
- .ui-modal-header
- .ui-modal-title
- .ui-modal-close
- .ui-modal-body

Filter/Search:
- .ui-filter-bar
- .ui-search
- .ui-search-input

Sidebar/Topbar:
- .ui-sidebar-item
- .ui-sidebar-item-active
- .ui-sidebar-icon
- .ui-sidebar-label
- .ui-sidebar-badge
- .ui-topbar
- .ui-topbar-left
- .ui-topbar-title
- .ui-topbar-breadcrumb
- .ui-topbar-right
- .ui-topbar-user
- .ui-topbar-notif

Role:
- .ui-role-badge
- .ui-role-admin
- .ui-role-pemerintah
- .ui-role-sppg
- .ui-role-sekolah
- .ui-role-umum

RESPONSIVE:
Tambahkan media query di ui.css:
- Mobile <= 640px
- Tablet <= 768px

Pastikan:
- Table bisa horizontal scroll
- TopBar rapi di mobile
- FilterBar jadi 1 kolom di mobile
- KPI card tetap rapi
- Modal width aman di mobile

OUTPUT:
1. Tulis isi lengkap src/components/ui/index.jsx
2. Tulis isi lengkap src/components/ui/ui.css
3. Pastikan semua komponen named export
4. Pastikan tidak ada default export
5. Pastikan index.jsx meng-import "./ui.css"
6. Pastikan komponen bisa langsung dipakai oleh Landing.jsx atau Dashboard