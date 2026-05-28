# MBG Design System — Makan Bergizi Gratis
## Mission
Panduan UI berbasis token, siap implementasi, untuk web Makan Bergizi Gratis (MBG). Dioptimalkan untuk konsistensi, aksesibilitas, dan kecepatan pengembangan di seluruh antarmuka marketing site dan dashboard program.

---

## Brand
- **Product/brand:** Makan Bergizi Gratis (MBG)
- **Audience:** Masyarakat umum, orang tua, siswa, tenaga pendidik, mitra pemerintah
- **Surface:** Marketing site + portal informasi program
- **Tagline:** Gizi Merata, Indonesia Kuat

---

## Style Foundations

### Visual Style
Bersih, terpercaya, pemerintahan modern — menyampaikan kredibilitas resmi tanpa terasa kaku. Dibangun di atas biru navy yang dalam sebagai warna dominan, dipasangkan dengan putih bersih dan aksen biru cerah.

### Tipografi
```
font.family.primary     = "Plus Jakarta Sans"
font.family.secondary   = "DM Sans"
font.family.stack       = "Plus Jakarta Sans", "DM Sans", "Noto Sans", "Arial", sans-serif
font.size.base          = 16px
font.weight.base        = 400
font.lineHeight.base    = 1.6
```

**Skala Tipografi:**
```
font.size.xs   = 11px   /* label kecil, badge */
font.size.sm   = 13px   /* caption, footnote */
font.size.md   = 15px   /* body kecil */
font.size.lg   = 16px   /* body utama */
font.size.xl   = 18px   /* sub-judul */
font.size.2xl  = 22px   /* judul section kecil */
font.size.3xl  = 28px   /* judul section */
font.size.4xl  = 36px   /* hero sub-heading */
font.size.5xl  = 48px   /* hero heading */
font.size.6xl  = 60px   /* display besar */
```

**Bobot Font:**
```
font.weight.regular  = 400
font.weight.medium   = 500
font.weight.semibold = 600
font.weight.bold     = 700
font.weight.extrabold= 800
```

---

## Color Palette

### Warna Primer — Navy MBG
```
color.brand.navy.900  = #071E49   /* warna dominan utama */
color.brand.navy.800  = #0A2759
color.brand.navy.700  = #0D3370
color.brand.navy.600  = #114086
color.brand.navy.500  = #1A52A8
color.brand.navy.400  = #2D6BC4
color.brand.navy.300  = #5B8FD9
color.brand.navy.200  = #96BEE8
color.brand.navy.100  = #C8DCF4
color.brand.navy.50   = #EBF3FC
```

### Warna Sekunder — Putih & Netral
```
color.white             = #FFFFFF
color.neutral.50        = #F8FAFF
color.neutral.100       = #EFF3FB
color.neutral.200       = #D6E0F0
color.neutral.300       = #B0C2DA
color.neutral.400       = #849BB9
color.neutral.500       = #5C758E
color.neutral.600       = #3E5470
color.neutral.700       = #2B3E56
color.neutral.800       = #1A2B40
color.neutral.900       = #0D1A2B
```

### Warna Aksen
```
color.accent.sky        = #1E90FF   /* highlight interaktif */
color.accent.sky.light  = #E8F2FF
color.accent.green      = #16A34A   /* sukses, nutrisi */
color.accent.green.light= #DCFCE7
color.accent.amber      = #D97706   /* peringatan, info penting */
color.accent.amber.light= #FEF3C7
color.accent.red        = #DC2626   /* error */
color.accent.red.light  = #FEE2E2
```

### Token Semantik
```
color.text.primary      = #FFFFFF   /* teks di atas background navy */
color.text.secondary    = #96BEE8   /* teks muted di atas navy */
color.text.onLight      = #071E49   /* teks di atas background putih */
color.text.onLightMuted = #3E5470   /* teks sekunder di atas putih */
color.text.link         = #1E90FF

color.surface.base      = #071E49   /* background utama */
color.surface.card      = #FFFFFF
color.surface.section   = #EBF3FC   /* section alternating */
color.surface.overlay   = rgba(7,30,73,0.85)

color.border.subtle     = rgba(255,255,255,0.12)
color.border.default    = rgba(255,255,255,0.20)
color.border.strong     = #2D6BC4

color.state.hover       = rgba(255,255,255,0.06)
color.state.active      = rgba(255,255,255,0.12)
color.state.focus       = #1E90FF
color.state.disabled    = rgba(255,255,255,0.25)
```

---

## Spacing Scale
```
space.1  = 2px
space.2  = 4px
space.3  = 8px
space.4  = 12px
space.5  = 16px
space.6  = 20px
space.7  = 24px
space.8  = 32px
space.9  = 40px
space.10 = 48px
space.11 = 64px
space.12 = 80px
space.13 = 96px
space.14 = 128px
```

---

## Radius, Shadow & Motion

### Border Radius
```
radius.xs   = 4px
radius.sm   = 6px
radius.md   = 8px
radius.lg   = 12px
radius.xl   = 16px
radius.2xl  = 24px
radius.3xl  = 32px
radius.full = 9999px   /* pill, avatar */
```

### Shadow
```
shadow.sm   = 0px 1px 3px rgba(7,30,73,0.08), 0px 1px 2px rgba(7,30,73,0.04)
shadow.md   = 0px 4px 16px rgba(7,30,73,0.12), 0px 2px 6px rgba(7,30,73,0.06)
shadow.lg   = 0px 12px 40px rgba(7,30,73,0.16), 0px 4px 16px rgba(7,30,73,0.08)
shadow.xl   = 0px 24px 80px rgba(7,30,73,0.22), 0px 8px 24px rgba(7,30,73,0.10)
shadow.card = 0px 2px 12px rgba(7,30,73,0.08)
shadow.glow = 0px 0px 32px rgba(45,107,196,0.35)   /* efek glow aksen biru */
```

### Motion (Animasi Ringan & Smooth)
```
motion.easing.default   = cubic-bezier(0.22, 1, 0.36, 1)   /* smooth decelerate */
motion.easing.in        = cubic-bezier(0.4, 0, 1, 1)
motion.easing.out       = cubic-bezier(0, 0, 0.2, 1)
motion.easing.spring    = cubic-bezier(0.34, 1.56, 0.64, 1) /* slight overshoot */

motion.duration.instant = 100ms
motion.duration.fast    = 150ms
motion.duration.normal  = 250ms
motion.duration.slow    = 350ms
motion.duration.slower  = 500ms
motion.duration.page    = 600ms

/* Keyframes standar */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes floatUp {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
```

---

## CSS Variables — Implementasi
Taruh di `:root` global CSS Anda:

```css
:root {
  /* === FONT === */
  --font-primary: "Plus Jakarta Sans", "DM Sans", "Noto Sans", Arial, sans-serif;
  --font-size-base: 16px;
  --font-weight-base: 400;
  --line-height-base: 1.6;

  /* === WARNA BRAND === */
  --color-navy-900: #071E49;
  --color-navy-800: #0A2759;
  --color-navy-700: #0D3370;
  --color-navy-600: #114086;
  --color-navy-500: #1A52A8;
  --color-navy-400: #2D6BC4;
  --color-navy-300: #5B8FD9;
  --color-navy-200: #96BEE8;
  --color-navy-100: #C8DCF4;
  --color-navy-50:  #EBF3FC;
  --color-white:    #FFFFFF;

  /* === SURFACE === */
  --surface-base:    var(--color-navy-900);
  --surface-card:    var(--color-white);
  --surface-section: var(--color-navy-50);
  --surface-overlay: rgba(7,30,73,0.85);

  /* === TEKS === */
  --text-primary:       var(--color-white);
  --text-secondary:     var(--color-navy-200);
  --text-on-light:      var(--color-navy-900);
  --text-on-light-muted: #3E5470;
  --text-link:          #1E90FF;

  /* === BORDER === */
  --border-subtle:  rgba(255,255,255,0.12);
  --border-default: rgba(255,255,255,0.20);
  --border-strong:  var(--color-navy-400);

  /* === STATUS === */
  --color-success:      #16A34A;
  --color-success-bg:   #DCFCE7;
  --color-warning:      #D97706;
  --color-warning-bg:   #FEF3C7;
  --color-error:        #DC2626;
  --color-error-bg:     #FEE2E2;
  --color-info:         #1E90FF;
  --color-info-bg:      #E8F2FF;

  /* === SHADOW === */
  --shadow-sm:  0px 1px 3px rgba(7,30,73,0.08);
  --shadow-md:  0px 4px 16px rgba(7,30,73,0.12), 0px 2px 6px rgba(7,30,73,0.06);
  --shadow-lg:  0px 12px 40px rgba(7,30,73,0.16);
  --shadow-glow: 0px 0px 32px rgba(45,107,196,0.35);

  /* === RADIUS === */
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-full: 9999px;

  /* === MOTION === */
  --ease-default: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast:   150ms;
  --duration-normal: 250ms;
  --duration-slow:   350ms;
  --duration-page:   600ms;

  /* === SPACING === */
  --space-1: 2px;   --space-2: 4px;   --space-3: 8px;
  --space-4: 12px;  --space-5: 16px;  --space-6: 20px;
  --space-7: 24px;  --space-8: 32px;  --space-9: 40px;
  --space-10: 48px; --space-11: 64px; --space-12: 80px;
}
```

---

## Component Rules

### 1. Button

**Anatomi:** `[icon?] [label]` — teks sentence case, tidak boleh semua huruf besar.

**Variants:**

| Variant | Background | Text | Border | Use Case |
|---|---|---|---|---|
| `primary` | `--color-navy-400` (#2D6BC4) | `--color-white` | none | CTA utama |
| `secondary` | transparent | `--color-white` | `--border-default` | Aksi sekunder |
| `outline` | transparent | `--color-navy-400` | `--color-navy-400` | Di atas background putih |
| `ghost` | transparent | `--text-secondary` | none | Di dalam card/nav |
| `danger` | `--color-error` | `--color-white` | none | Aksi destruktif |

**States:**
```css
/* Primary button */
.btn-primary {
  background: var(--color-navy-400);
  color: var(--color-white);
  padding: 10px 24px;
  border-radius: var(--radius-full);
  font-family: var(--font-primary);
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-default),
    transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-default);
}

.btn-primary:hover {
  background: var(--color-navy-500);
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.btn-primary:active {
  transform: translateY(0px) scale(0.98);
  box-shadow: none;
}

.btn-primary:focus-visible {
  outline: 2px solid var(--text-link);
  outline-offset: 3px;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

**Ukuran:**
```
btn.sm:  padding 6px 16px,  font 13px, radius full
btn.md:  padding 10px 24px, font 15px, radius full  ← default
btn.lg:  padding 14px 32px, font 16px, radius full
btn.xl:  padding 18px 40px, font 18px, radius full
```

---

### 2. Card

**Variants:**

| Variant | Background | Border | Shadow |
|---|---|---|---|
| `default` | `--surface-card` (#FFF) | `--color-navy-100` | `--shadow-card` |
| `navy` | `--color-navy-800` | `--border-subtle` | `--shadow-md` |
| `glass` | `rgba(7,30,73,0.6)` | `--border-subtle` | `--shadow-md` |
| `highlight` | `--color-navy-50` | `--color-navy-200` | `--shadow-sm` |

**Animasi Card (on-scroll):**
```css
.card {
  animation: fadeInUp var(--duration-page) var(--ease-default) both;
}
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 80ms; }
.card:nth-child(3) { animation-delay: 160ms; }
.card:nth-child(4) { animation-delay: 240ms; }

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  transition: transform var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-default);
}
```

---

### 3. Navigasi (Navbar)

**Layout:** Logo kiri · Links tengah · CTA kanan.
**Background:** `rgba(7,30,73,0.95)` + `backdrop-filter: blur(20px) saturate(180%)`.
**Scroll behavior:** Tambah `box-shadow: var(--shadow-md)` saat scroll > 10px.

```css
.navbar {
  background: rgba(7, 30, 73, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--border-subtle);
  transition: box-shadow var(--duration-normal) var(--ease-default);
}

.navbar.scrolled {
  box-shadow: var(--shadow-md);
}

.nav-link {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  transition: color var(--duration-fast) var(--ease-default);
}

.nav-link:hover,
.nav-link.active {
  color: var(--text-primary);
}

/* Active indicator */
.nav-link.active::after {
  content: '';
  display: block;
  height: 2px;
  background: var(--color-navy-400);
  border-radius: var(--radius-full);
  margin-top: 2px;
  animation: scaleIn var(--duration-fast) var(--ease-spring);
}
```

---

### 4. Hero Section

```css
.hero {
  background: var(--color-navy-900);
  position: relative;
  overflow: hidden;
}

/* Gradient mesh latar */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 20% 50%, rgba(45,107,196,0.25) 0%, transparent 70%),
    radial-gradient(ellipse 40% 60% at 80% 20%, rgba(17,64,134,0.30) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 60% 80%, rgba(26,82,168,0.15) 0%, transparent 60%);
  pointer-events: none;
}

.hero-title {
  font-size: clamp(36px, 5vw, 60px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  animation: fadeInUp var(--duration-page) var(--ease-default) both;
}

.hero-subtitle {
  font-size: clamp(16px, 2vw, 20px);
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 1.6;
  animation: fadeInUp var(--duration-page) var(--ease-default) 100ms both;
}

.hero-cta {
  animation: fadeInUp var(--duration-page) var(--ease-default) 200ms both;
}
```

---

### 5. Section Alternating

```css
/* Section navy (dominan) */
.section-navy {
  background: var(--color-navy-900);
  color: var(--text-primary);
}

/* Section putih */
.section-white {
  background: var(--surface-card);
  color: var(--text-on-light);
}

/* Section light blue */
.section-light {
  background: var(--color-navy-50);
  color: var(--text-on-light);
}

/* Section dengan separator garis tipis */
.section + .section {
  border-top: 1px solid var(--border-subtle);
}
```

---

### 6. Input / Form

```css
.input {
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-primary);
  font-size: 15px;
  padding: 10px 16px;
  width: 100%;
  transition:
    border-color var(--duration-fast) var(--ease-default),
    background var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default);
}

.input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.input:hover {
  border-color: var(--border-strong);
  background: rgba(255,255,255,0.08);
}

.input:focus {
  outline: none;
  border-color: var(--color-info);
  background: rgba(255,255,255,0.10);
  box-shadow: 0 0 0 3px rgba(30,144,255,0.20);
}

.input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.input.error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220,38,38,0.15);
}
```

---

### 7. Badge / Tag

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.badge-primary { background: var(--color-navy-100); color: var(--color-navy-900); }
.badge-success { background: var(--color-success-bg); color: var(--color-success); }
.badge-warning { background: var(--color-warning-bg); color: var(--color-warning); }
.badge-error   { background: var(--color-error-bg);   color: var(--color-error); }
.badge-info    { background: var(--color-info-bg);    color: var(--color-info); }

/* Badge glow di atas background navy */
.badge-glow {
  background: rgba(45,107,196,0.25);
  color: var(--color-navy-200);
  border: 1px solid rgba(45,107,196,0.40);
}
```

---

### 8. Statistics / Counter

```css
.stat-card {
  text-align: center;
  padding: var(--space-8);
}

.stat-number {
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
  font-weight: 500;
}

/* Counter animation */
.stat-number[data-count] {
  animation: fadeInUp var(--duration-slow) var(--ease-default) both;
}
```

---

## Scroll Animation (Intersection Observer)

Implementasi di `main.js` atau file JS terpisah:

```javascript
// Animasi masuk saat scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('[data-animate]').forEach((el) => {
  observer.observe(el);
});
```

```css
/* Base state sebelum animasi */
[data-animate] {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity var(--duration-slow) var(--ease-default),
    transform var(--duration-slow) var(--ease-default);
}

[data-animate].is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Delay per elemen */
[data-animate-delay="1"] { transition-delay: 80ms; }
[data-animate-delay="2"] { transition-delay: 160ms; }
[data-animate-delay="3"] { transition-delay: 240ms; }
[data-animate-delay="4"] { transition-delay: 320ms; }
```

---

## Aksesibilitas (WCAG 2.2 AA)

- **Kontras minimum:** 4.5:1 untuk teks biasa, 3:1 untuk teks besar (≥18px bold).
- **Focus-visible wajib:** Semua elemen interaktif harus punya `outline` saat fokus.
- **Reduced motion:** Semua animasi harus dibungkus `@media (prefers-reduced-motion: no-preference)`.
- **Keyboard navigation:** Tab order harus logis; skip-link di atas halaman.

```css
/* Focus universal */
:focus-visible {
  outline: 2px solid var(--color-info);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

/* Reduced motion fallback */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Aturan Wajib (Must)

- **Harus** menggunakan CSS variables, bukan nilai hex langsung di komponen.
- **Harus** mendefinisikan state: `default`, `hover`, `focus-visible`, `active`, `disabled`.
- **Harus** teks dalam format sentence case — tidak semua kapital, tidak Title Case setiap kata.
- **Harus** menyediakan `focus-visible` yang terlihat di setiap elemen interaktif.
- **Harus** memiliki kontras minimal 4.5:1 untuk semua teks body.
- **Harus** membungkus animasi dalam `prefers-reduced-motion` guard.

## Aturan Terlarang (Don't)

- **Jangan** menggunakan hex warna langsung di dalam komponen (gunakan CSS variables).
- **Jangan** menghilangkan atau menyembunyikan `focus-visible` indicator.
- **Jangan** menggunakan teks warna abu-abu rendah kontras di atas background navy.
- **Jangan** animasi yang berat, jank, atau `transition-duration` > 600ms.
- **Jangan** membuat exception spacing/tipografi satu-off di luar design system.
- **Jangan** menggunakan font-size di bawah 11px.

---

## Panduan Import Font (Google Fonts)

Tambahkan di `<head>` HTML atau di `index.html` Vite:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

Atau via `@import` di CSS utama:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
```

---

## QA Checklist

- [ ] Font Plus Jakarta Sans ter-load di semua halaman
- [ ] Warna navy `#071E49` sebagai background dominan
- [ ] Semua button punya state hover, focus-visible, disabled
- [ ] Animasi scroll (Intersection Observer) berjalan smooth
- [ ] `prefers-reduced-motion` direspek
- [ ] Kontras 4.5:1 terverifikasi di semua teks
- [ ] Navbar berubah saat scroll (backdrop blur aktif)
- [ ] Card hover effect menggunakan `translateY + shadow` (bukan opacity saja)
- [ ] Tidak ada animasi dengan `transition-duration > 600ms`
- [ ] CSS variables digunakan konsisten — tidak ada hardcoded hex di komponen
- [ ] Mobile responsive: semua ukuran font menggunakan `clamp()`
- [ ] Semua gambar/ikon punya `alt` text