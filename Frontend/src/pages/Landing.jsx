import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  FileWarning,
  Loader2,
  LockKeyhole,
  LogIn,
  MapPinned,
  Menu,
  PackageCheck,
  Send,
  ShieldCheck,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react'
import { apiRequest } from '../services/api.js'
import useAuthStore from '../store/authStore.js'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_KEY || import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''
const CAPTCHA_PROVIDER = TURNSTILE_SITE_KEY ? 'turnstile' : RECAPTCHA_SITE_KEY ? 'recaptcha' : null
const CAPTCHA_SITE_KEY = TURNSTILE_SITE_KEY || RECAPTCHA_SITE_KEY
const INITIAL_CAPTCHA_MESSAGE = CAPTCHA_PROVIDER
  ? CAPTCHA_PROVIDER === 'turnstile'
    ? 'Memuat Cloudflare Turnstile...'
    : 'Memuat Google reCAPTCHA...'
  : 'CAPTCHA belum dikonfigurasi. Set VITE_TURNSTILE_SITE_KEY atau VITE_RECAPTCHA_KEY.'

const INDONESIA_BOUNDS = {
  minLng: 94,
  maxLng: 142,
  minLat: -12,
  maxLat: 8,
}

const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'Jawa Timur',
  'Bali',
  'Kalimantan Barat',
  'Kalimantan Timur',
  'Sulawesi Selatan',
  'Nusa Tenggara Timur',
  'Papua',
]

const REPORT_CATEGORIES = [
  { value: 'kualitas_makanan', label: 'Kualitas Makanan' },
  { value: 'keterlambatan', label: 'Keterlambatan' },
  { value: 'kekurangan_porsi', label: 'Kekurangan Porsi' },
  { value: 'lainnya', label: 'Lainnya' },
]

const INTERNAL_MAP_ROLES = new Set(['admin', 'pemerintah', 'gov', 'sppg', 'sekolah'])

const FEATURES = [
  {
    title: 'Peta Distribusi',
    description: 'Lihat lokasi dan status semua SPPG di seluruh Indonesia',
    icon: MapPinned,
  },
  {
    title: 'Dashboard Realtime',
    description: 'KPI dan tren distribusi diperbarui secara otomatis',
    icon: BarChart3,
  },
  {
    title: 'Bukti Distribusi',
    description: 'Setiap distribusi didokumentasikan dengan foto',
    icon: Camera,
  },
  {
    title: 'Transparansi Anggaran',
    description: 'Harga per porsi per wilayah dapat dipantau publik',
    icon: WalletCards,
  },
  {
    title: 'Deteksi Anomali',
    description: 'Sistem otomatis mendeteksi data yang tidak wajar',
    icon: FileWarning,
  },
  {
    title: 'Laporan Masyarakat',
    description: 'Siapapun bisa melaporkan masalah yang ditemukan',
    icon: Send,
  },
]

const initialReportForm = {
  reporterName: '',
  province: '',
  city: '',
  category: '',
  message: '',
  captchaToken: '',
  hpField: '',
}

async function requestJson(path, options = {}) {
  const payload = await apiRequest(path, options)
  return payload.data ?? payload
}

function loadExternalScript(id, src) {
  const existingScript = document.getElementById(id)
  if (existingScript) return Promise.resolve(existingScript)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve(script)
    script.onerror = () => reject(new Error('Widget CAPTCHA gagal dimuat.'))
    document.head.appendChild(script)
  })
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value))}%`
}

function extractMarkers(items) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => ({
      id: item.id || `${item.name}-${item.lat}-${item.lng}`,
      name: item.name || 'SPPG',
      province: item.province || '',
      city: item.city || '',
      lat: Number(item.lat),
      lng: Number(item.lng),
      status: item.status || 'active',
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
}

function normalizePublicSppgDetail(item) {
  if (!item) return null

  return {
    id: item.id,
    name: item.name || 'SPPG',
    province: item.province || '-',
    city: item.city || '-',
    district: item.district || '',
    status: item.status || 'inactive',
    capacity: Number(item.capacity) || 0,
    todayPortions: Number(item.todayPortions ?? item.today_portions) || 0,
    successRate: Number(item.successRate ?? item.success_rate) || 0,
    todayMenu: item.todayMenu || item.today_menu || null,
    recentDistributions: Array.isArray(item.recentDistributions || item.recent_distributions)
      ? (item.recentDistributions || item.recent_distributions).map((row) => ({
          schoolName: row.schoolName || row.school_name || '-',
          portions: Number(row.portions) || 0,
          status: row.status || '-',
          date: row.date || row.distributionDate || row.distribution_date || '',
        }))
      : [],
  }
}

function projectMarkerPosition(lat, lng) {
  const left = ((lng - INDONESIA_BOUNDS.minLng) / (INDONESIA_BOUNDS.maxLng - INDONESIA_BOUNDS.minLng)) * 100
  const top = ((INDONESIA_BOUNDS.maxLat - lat) / (INDONESIA_BOUNDS.maxLat - INDONESIA_BOUNDS.minLat)) * 100

  return {
    left: `${Math.min(96, Math.max(4, left))}%`,
    top: `${Math.min(94, Math.max(6, top))}%`,
  }
}

function getMarkerColor(status) {
  if (status === 'problem') return '#9b1c1c'
  if (status === 'inactive' || status === 'pending') return '#92400e'
  return '#057a55'
}

function Landing() {
  const { user, isAuthenticated } = useAuthStore()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [summary, setSummary] = useState({ data: null, loading: true, error: '' })
  const [mapData, setMapData] = useState({ markers: [], loading: true, error: '', empty: false })
  const [sppgDetail, setSppgDetail] = useState({ data: null, loading: false, error: '' })
  const [reportForm, setReportForm] = useState(initialReportForm)
  const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
  const [captchaMessage, setCaptchaMessage] = useState(INITIAL_CAPTCHA_MESSAGE)
  const turnstileRef = useRef(null)
  const turnstileWidgetIdRef = useRef(null)

  const loadSummary = useCallback((signal) => {
    setSummary((current) => ({ ...current, loading: true, error: '' }))

    return requestJson('/public/statistics', { signal })
      .then((data) => {
        setSummary({ data: data?.kpis || null, loading: false, error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setSummary({
            data: null,
            loading: false,
            error: 'Data statistik gagal dimuat dari API.',
          })
        }
      })
  }, [])

  const loadMapData = useCallback((signal) => {
    setMapData((current) => ({ ...current, loading: true, error: '', empty: false }))

    return requestJson('/public/sppg?limit=10', { signal })
      .then((data) => {
        const markers = extractMarkers(data)
        setMapData({
          markers,
          loading: false,
          error: '',
          empty: markers.length === 0,
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMapData({
            markers: [],
            loading: false,
            error: 'Data peta SPPG gagal dimuat dari API.',
            empty: false,
          })
        }
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => loadSummary(controller.signal))
    return () => controller.abort()
  }, [loadSummary])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => loadMapData(controller.signal))
    return () => controller.abort()
  }, [loadMapData])

  useEffect(() => {
    if (!CAPTCHA_PROVIDER) {
      return undefined
    }

    let isMounted = true

    if (CAPTCHA_PROVIDER === 'turnstile') {
      loadExternalScript('mbg-turnstile', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
        .then(() => {
          if (!isMounted || !turnstileRef.current || !window.turnstile?.render || turnstileWidgetIdRef.current) return

          turnstileWidgetIdRef.current = window.turnstile.render(turnstileRef.current, {
            sitekey: CAPTCHA_SITE_KEY,
            callback: (token) => {
              setReportForm((current) => ({ ...current, captchaToken: token }))
              setCaptchaMessage('CAPTCHA terverifikasi.')
            },
            'expired-callback': () => {
              setReportForm((current) => ({ ...current, captchaToken: '' }))
              setCaptchaMessage('CAPTCHA kedaluwarsa. Verifikasi ulang sebelum mengirim.')
            },
            'error-callback': () => {
              setReportForm((current) => ({ ...current, captchaToken: '' }))
              setCaptchaMessage('CAPTCHA gagal diverifikasi. Coba muat ulang halaman.')
            },
          })
        })
        .catch((error) => {
          if (isMounted) setCaptchaMessage(error.message)
        })

      return () => {
        isMounted = false
        if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(turnstileWidgetIdRef.current)
          turnstileWidgetIdRef.current = null
        }
      }
    }

    loadExternalScript('mbg-recaptcha', `https://www.google.com/recaptcha/api.js?render=${CAPTCHA_SITE_KEY}`)
      .then(() => {
        if (!isMounted) return
        window.grecaptcha?.ready(() => {
          if (isMounted) setCaptchaMessage('reCAPTCHA siap. Token akan dibuat saat laporan dikirim.')
        })
      })
      .catch((error) => {
        if (isMounted) setCaptchaMessage(error.message)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const effectiveSummary = summary.data || {}
  const role = String(user?.role || '').toLowerCase()
  const fullMapPath = isAuthenticated && INTERNAL_MAP_ROLES.has(role) ? '/peta' : '/peta-publik'

  const kpis = [
    {
      title: 'Total SPPG Aktif',
      value: formatNumber(effectiveSummary.totalActiveSppg),
      icon: Utensils,
      color: '#0071e4',
    },
    {
      title: 'Distribusi Hari Ini',
      value: formatNumber(effectiveSummary.distributionsToday),
      icon: PackageCheck,
      color: '#057a55',
    },
    {
      title: 'Success Rate',
      value: formatPercent(effectiveSummary.successRate),
      icon: CheckCircle2,
      color: '#057a55',
    },
    {
      title: 'SPPG Bermasalah',
      value: formatNumber(effectiveSummary.problematicSppg),
      icon: AlertTriangle,
      color: '#9b1c1c',
    },
  ]

  const closeDrawer = () => setIsDrawerOpen(false)

  const handleMarkerClick = async (marker) => {
    if (!marker?.id) {
      setSppgDetail({
        data: null,
        loading: false,
        error: 'Detail SPPG tidak tersedia',
      })
      return
    }

    setSppgDetail({ data: null, loading: true, error: '' })

    try {
      const data = await requestJson(`/public/sppg/${marker.id}`)
      setSppgDetail({ data: normalizePublicSppgDetail(data), loading: false, error: '' })
    } catch {
      setSppgDetail({
        data: null,
        loading: false,
        error: 'Detail SPPG tidak tersedia',
      })
    }
  }

  const handleReportChange = (event) => {
    const { name, value } = event.target
    setReportForm((current) => ({ ...current, [name]: value }))
    if (submitState.error) setSubmitState((current) => ({ ...current, error: '' }))
  }

  const requestRecaptchaToken = async () => {
    if (CAPTCHA_PROVIDER !== 'recaptcha') return reportForm.captchaToken
    if (!window.grecaptcha?.execute) return ''

    const token = await window.grecaptcha.execute(CAPTCHA_SITE_KEY, { action: 'public_report' })
    setReportForm((current) => ({ ...current, captchaToken: token }))
    return token
  }

  const handleReportSubmit = async (event) => {
    event.preventDefault()
    setSubmitState({ loading: false, error: '', success: '' })

    if (reportForm.hpField.trim()) return

    if (!reportForm.province || !reportForm.city.trim()) {
      setSubmitState({ loading: false, error: 'Provinsi dan kota wajib diisi.', success: '' })
      return
    }

    if (!reportForm.category) {
      setSubmitState({ loading: false, error: 'Kategori laporan wajib dipilih.', success: '' })
      return
    }

    if (reportForm.message.trim().length < 20) {
      setSubmitState({ loading: false, error: 'Pesan minimal 20 karakter agar dapat ditindaklanjuti.', success: '' })
      return
    }

    setSubmitState({ loading: true, error: '', success: '' })

    try {
      const captchaToken = reportForm.captchaToken || (await requestRecaptchaToken())

      if (!captchaToken) {
        setSubmitState({
          loading: false,
          error: 'CAPTCHA belum dikonfigurasi atau belum diverifikasi.',
          success: '',
        })
        return
      }

      await requestJson('/public-reports', {
        method: 'POST',
        body: {
          reporterName: reportForm.reporterName.trim() || 'Anonim',
          province: reportForm.province,
          city: reportForm.city.trim(),
          category: reportForm.category,
          message: reportForm.message.trim(),
          captchaToken,
          hpField: reportForm.hpField,
        },
      })

      setReportForm({ ...initialReportForm, captchaToken: CAPTCHA_PROVIDER === 'recaptcha' ? '' : reportForm.captchaToken })
      setSubmitState({
        loading: false,
        error: '',
        success: 'Laporan berhasil dikirim. Terima kasih sudah ikut memantau Program MBG.',
      })

      if (CAPTCHA_PROVIDER === 'turnstile' && turnstileWidgetIdRef.current && window.turnstile?.reset) {
        window.turnstile.reset(turnstileWidgetIdRef.current)
        setReportForm(initialReportForm)
      }
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || 'Laporan gagal dikirim. Coba lagi beberapa saat lagi.',
        success: '',
      })
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-[#111928]">
      <header className="sticky top-0 z-50 border-b border-[#b5e0ea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 w-[min(1120px,calc(100%-32px))] items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3" aria-label="MBG Transparency System">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#0071e4] text-sm font-black tracking-normal text-white">
              MBG
            </span>
            <span className="grid gap-0.5">
              <span className="text-lg font-black leading-tight text-[#0f4c81]">MBG</span>
              <span className="text-xs font-bold text-[#6b7280]">Transparency System</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-bold text-[#6b7280] lg:flex" aria-label="Navigasi utama">
            <Link className="transition hover:text-[#0071e4]" to="/">
              Beranda
            </Link>
            <Link className="transition hover:text-[#0071e4]" to={fullMapPath}>
              Peta SPPG
            </Link>
            <Link className="transition hover:text-[#0071e4]" to="/statistik">
              Statistik
            </Link>
            <a className="transition hover:text-[#0071e4]" href="#laporan">
              Laporan
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden h-11 items-center gap-2 rounded-lg bg-[#0071e4] px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg lg:inline-flex"
            >
              <LogIn size={17} aria-hidden="true" />
              Login
            </Link>
            <button
              className="grid h-11 w-11 place-items-center rounded-lg border border-[#b5e0ea] bg-white text-[#0f4c81] lg:hidden"
              type="button"
              aria-label="Buka menu"
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-[60] bg-[#111928]/40" role="presentation" onClick={closeDrawer}>
          <aside
            className="h-full w-[min(320px,86vw)] border-r border-[#b5e0ea] bg-white p-5 shadow-2xl"
            aria-label="Menu mobile"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-7 flex items-center justify-between gap-3">
              <Link to="/" className="flex items-center gap-3" onClick={closeDrawer}>
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0071e4] text-sm font-black text-white">
                  MBG
                </span>
                <span>
                  <span className="block text-base font-black text-[#0f4c81]">MBG</span>
                  <span className="block text-xs font-bold text-[#6b7280]">Transparency System</span>
                </span>
              </Link>
              <button
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#b5e0ea] text-[#0f4c81]"
                type="button"
                aria-label="Tutup menu"
                onClick={closeDrawer}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav className="grid gap-2 text-sm font-extrabold text-[#111928]">
              <Link className="rounded-lg px-3 py-3 hover:bg-[#f4f8fb] hover:text-[#0071e4]" to="/" onClick={closeDrawer}>
                Beranda
              </Link>
              <Link className="rounded-lg px-3 py-3 hover:bg-[#f4f8fb] hover:text-[#0071e4]" to={fullMapPath} onClick={closeDrawer}>
                Peta SPPG
              </Link>
              <Link className="rounded-lg px-3 py-3 hover:bg-[#f4f8fb] hover:text-[#0071e4]" to="/statistik" onClick={closeDrawer}>
                Statistik
              </Link>
              <a className="rounded-lg px-3 py-3 hover:bg-[#f4f8fb] hover:text-[#0071e4]" href="#laporan" onClick={closeDrawer}>
                Laporan
              </a>
              <Link className="mt-3 rounded-lg bg-[#0071e4] px-3 py-3 text-center text-white" to="/login" onClick={closeDrawer}>
                Login
              </Link>
            </nav>
          </aside>
        </div>
      ) : null}

      <main>
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#0f4c81] to-[#0071e4] text-white">
          <div className="landing-geometric-pattern absolute inset-0 opacity-[0.13]" aria-hidden="true" />
          <div className="absolute left-[-120px] top-[-140px] h-80 w-80 rounded-full bg-[#b5e0ea]/30 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-[-140px] right-[-120px] h-96 w-96 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid min-h-[610px] w-[min(1120px,calc(100%-32px))] items-center py-24">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-2 text-[13px] font-extrabold text-[#e9f7fb]">
                <ShieldCheck size={16} aria-hidden="true" />
                Platform monitoring publik Program MBG
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.05] tracking-normal text-white sm:text-5xl lg:text-7xl">
                Transparansi Distribusi Makan Bergizi Gratis
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#e6f4f8] sm:text-lg">
                Pantau distribusi makanan bergizi ke seluruh sekolah Indonesia secara real-time, terbuka untuk publik.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/dashboard"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0071e4] px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  Lihat Dashboard
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link
                  to={fullMapPath}
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-white/55 bg-white/10 px-6 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
                >
                  Peta SPPG
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f4f8fb] py-20" id="statistik">
          <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Mini Dashboard</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight text-[#0f4c81] sm:text-4xl">
                Ringkasan distribusi nasional
              </h2>
              <p className="mt-3 text-base leading-7 text-[#6b7280]">
                KPI publik diambil dari endpoint backend GET /api/public/statistics.
              </p>
            </div>

            {summary.error ? (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#b5e0ea] bg-white px-4 py-3 text-sm font-semibold text-[#92400e] sm:flex-row sm:items-center sm:justify-between">
                <span>{summary.error}</span>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0f4c81] px-4 text-xs font-extrabold text-white"
                  type="button"
                  onClick={() => loadSummary()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}
            {!summary.loading && !summary.error && !summary.data ? (
              <div className="mb-5 rounded-lg border border-[#b5e0ea] bg-white px-4 py-3 text-sm font-semibold text-[#6b7280]">
                Data ringkasan publik belum tersedia.
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {summary.loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-40 animate-pulse rounded-xl border border-[#b5e0ea] bg-white shadow-lg" />
                  ))
                : kpis.map((kpi) => {
                    const Icon = kpi.icon

                    return (
                      <article key={kpi.title} className="rounded-xl border border-[#b5e0ea] bg-white p-6 shadow-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-extrabold text-[#6b7280]">{kpi.title}</p>
                            <p className="mt-3 text-[40px] font-black leading-none" style={{ color: kpi.color }}>
                              {kpi.value}
                            </p>
                            <p className="mt-3 text-xs font-bold text-[#057a55]">
                              {summary.data ? 'Data backend aktif' : 'Data belum tersedia'}
                            </p>
                          </div>
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#f4f8fb]" style={{ color: kpi.color }}>
                            <Icon size={25} aria-hidden="true" />
                          </span>
                        </div>
                      </article>
                    )
                  })}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Peta SPPG</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight text-[#0f4c81] sm:text-4xl">
                Pratinjau sebaran dapur SPPG di Indonesia
              </h2>
              <p className="mt-3 text-base leading-7 text-[#6b7280]">
                Marker diambil dari GET /api/public/sppg?limit=10 dan titik tanpa koordinat dilewati.
              </p>
            </div>

            {mapData.error || mapData.empty ? (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#b5e0ea] bg-[#f4f8fb] px-4 py-3 text-sm font-semibold text-[#92400e] sm:flex-row sm:items-center sm:justify-between">
                <span>{mapData.error || 'Data SPPG dari API belum memiliki koordinat publik.'}</span>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0f4c81] px-4 text-xs font-extrabold text-white"
                  type="button"
                  onClick={() => loadMapData()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}

            <div className="relative h-[350px] overflow-hidden rounded-2xl border border-[#b5e0ea] bg-[#d9eef4] shadow-lg">
              <iframe
                title="Preview OpenStreetMap Indonesia"
                className="absolute inset-0 h-full w-full border-0 opacity-95 pointer-events-none"
                loading="lazy"
                src="https://www.openstreetmap.org/export/embed.html?bbox=94%2C-12%2C142%2C8&layer=mapnik"
              />
              <div className="absolute inset-x-0 bottom-0 z-10 h-1/2 bg-gradient-to-t from-[#0f4c81]/85 to-transparent" aria-hidden="true" />
              {mapData.loading ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-white/55 text-sm font-extrabold text-[#0f4c81]">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-lg">
                    <Loader2 className="landing-spin" size={18} aria-hidden="true" />
                    Memuat peta SPPG...
                  </span>
                </div>
              ) : mapData.markers.length ? (
                mapData.markers.map((marker) => {
                  const color = getMarkerColor(marker.status)
                  const position = projectMarkerPosition(marker.lat, marker.lng)
                  const title = [marker.name, marker.city, marker.province].filter(Boolean).join(' - ')

                  return (
                    <button
                      key={marker.id}
                      className="absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white"
                      type="button"
                      style={{
                        ...position,
                        backgroundColor: color,
                        boxShadow: `0 0 0 7px ${color}33, 0 12px 18px rgba(15, 76, 129, 0.24)`,
                      }}
                      title={title}
                      aria-label={`Lihat detail ${title}`}
                      onClick={() => handleMarkerClick(marker)}
                    />
                  )
                })
              ) : (
                <div className="absolute inset-0 z-20 grid place-items-center bg-white/55 px-5 text-center text-sm font-extrabold text-[#0f4c81]">
                  Belum ada marker SPPG publik dari backend.
                </div>
              )}
              {(sppgDetail.loading || sppgDetail.error || sppgDetail.data) ? (
                <aside className="absolute left-5 top-5 z-30 max-h-[calc(100%-40px)] w-[min(360px,calc(100%-40px))] overflow-auto rounded-xl border border-[#b5e0ea] bg-white/95 p-4 text-[#111928] shadow-xl">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Detail SPPG</p>
                      <h3 className="text-lg font-black text-[#0f4c81]">
                        {sppgDetail.data?.name || (sppgDetail.loading ? 'Memuat detail...' : 'Detail tidak tersedia')}
                      </h3>
                    </div>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#b5e0ea] text-[#0f4c81]"
                      type="button"
                      aria-label="Tutup detail SPPG"
                      onClick={() => setSppgDetail({ data: null, loading: false, error: '' })}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>

                  {sppgDetail.loading ? (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-[#0f4c81]">
                      <Loader2 className="landing-spin" size={16} aria-hidden="true" />
                      Memuat data public-safe...
                    </div>
                  ) : null}

                  {sppgDetail.error ? (
                    <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-sm font-semibold text-[#92400e]">{sppgDetail.error}</p>
                  ) : null}

                  {sppgDetail.data ? (
                    <div className="grid gap-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="rounded-lg bg-[#f4f8fb] p-3">
                          <small className="block font-bold text-[#6b7280]">Lokasi</small>
                          <strong>{[sppgDetail.data.district, sppgDetail.data.city, sppgDetail.data.province].filter(Boolean).join(', ')}</strong>
                        </span>
                        <span className="rounded-lg bg-[#f4f8fb] p-3">
                          <small className="block font-bold text-[#6b7280]">Status</small>
                          <strong>{sppgDetail.data.status}</strong>
                        </span>
                        <span className="rounded-lg bg-[#f4f8fb] p-3">
                          <small className="block font-bold text-[#6b7280]">Kapasitas</small>
                          <strong>{formatNumber(sppgDetail.data.capacity)} porsi</strong>
                        </span>
                        <span className="rounded-lg bg-[#f4f8fb] p-3">
                          <small className="block font-bold text-[#6b7280]">Hari Ini</small>
                          <strong>{formatNumber(sppgDetail.data.todayPortions)} porsi</strong>
                        </span>
                      </div>

                      <div className="rounded-lg border border-[#b5e0ea] p-3">
                        <small className="block font-bold text-[#6b7280]">Success Rate</small>
                        <strong className="text-xl text-[#057a55]">{formatPercent(sppgDetail.data.successRate)}</strong>
                      </div>

                      <div className="rounded-lg border border-[#b5e0ea] p-3">
                        <small className="block font-bold text-[#6b7280]">Menu Hari Ini</small>
                        <strong>{sppgDetail.data.todayMenu?.name || 'Belum ada menu dari backend'}</strong>
                        {sppgDetail.data.todayMenu?.nutrition ? (
                          <p className="mt-2 text-xs font-semibold text-[#6b7280]">
                            {formatNumber(sppgDetail.data.todayMenu.nutrition.calories)} kkal · Protein {formatNumber(sppgDetail.data.todayMenu.nutrition.protein)}g · Karbo {formatNumber(sppgDetail.data.todayMenu.nutrition.carbohydrate)}g · Lemak {formatNumber(sppgDetail.data.todayMenu.nutrition.fat)}g
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-lg border border-[#b5e0ea] p-3">
                        <small className="block font-bold text-[#6b7280]">Distribusi Terbaru</small>
                        {sppgDetail.data.recentDistributions.length ? (
                          <div className="mt-2 grid gap-2">
                            {sppgDetail.data.recentDistributions.slice(0, 3).map((row, index) => (
                              <div key={`${row.schoolName}-${row.date}-${index}`} className="flex justify-between gap-3 border-t border-[#e5eef2] pt-2">
                                <span>{row.schoolName}</span>
                                <strong>{formatNumber(row.portions)} porsi</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-[#6b7280]">Belum ada distribusi terbaru dari backend.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </aside>
              ) : null}
              <Link
                className="absolute bottom-5 right-5 z-30 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#b5e0ea] px-5 text-sm font-extrabold text-[#0f4c81] shadow-lg transition hover:-translate-y-0.5 max-sm:left-5"
                to={fullMapPath}
              >
                Lihat Peta Lengkap
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#f4f8fb] py-20">
          <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Fitur Utama</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight text-[#0f4c81] sm:text-4xl">
                Dirancang untuk transparansi dari SPPG ke sekolah
              </h2>
              <p className="mt-3 text-base leading-7 text-[#6b7280]">
                Mengacu pada SDD: dashboard nasional, peta SPPG, bukti distribusi, anggaran, anomali, dan laporan publik.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon

                return (
                  <article
                    key={feature.title}
                    className="min-h-52 rounded-xl border border-[#b5e0ea] bg-white p-6 shadow-sm transition hover:-translate-y-1.5 hover:border-[#0071e4] hover:shadow-lg"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#f4f8fb] text-[#0071e4]">
                      <Icon size={25} aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-[22px] font-bold text-[#0f4c81]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#6b7280]">{feature.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="landing-dot-pattern bg-white py-20" id="laporan">
          <div className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Laporan Masyarakat</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight text-[#0f4c81] sm:text-4xl">
                Temukan Masalah? Laporkan Sekarang
              </h2>
              <p className="mt-4 text-base leading-8 text-[#6b7280]">
                Form publik mengikuti SDD: pesan minimal 20 karakter, honeypot anti-bot, dan CAPTCHA wajib sebelum
                POST /api/public-reports.
              </p>
              <div className="mt-6 rounded-xl border border-[#b5e0ea] bg-[#f4f8fb] p-4 text-sm leading-6 text-[#0f4c81]">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#0071e4]" aria-hidden="true" />
                  <p>
                    {captchaMessage ||
                      'CAPTCHA sedang disiapkan. Laporan tidak akan dikirim sampai token CAPTCHA tersedia.'}
                  </p>
                </div>
              </div>
            </div>

            <form className="rounded-xl border border-[#b5e0ea] bg-white/95 p-6 shadow-lg sm:p-7" onSubmit={handleReportSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-extrabold text-[#111928]">Nama</span>
                  <input
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#111928] outline-none transition focus:border-[#0071e4] focus:ring-4 focus:ring-[#0071e4]/15"
                    name="reporterName"
                    placeholder="Anonim"
                    value={reportForm.reporterName}
                    onChange={handleReportChange}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-extrabold text-[#111928]">Provinsi</span>
                  <select
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#111928] outline-none transition focus:border-[#0071e4] focus:ring-4 focus:ring-[#0071e4]/15"
                    name="province"
                    value={reportForm.province}
                    onChange={handleReportChange}
                    required
                  >
                    <option value="">Pilih provinsi</option>
                    {PROVINCES.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-extrabold text-[#111928]">Kota</span>
                  <input
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#111928] outline-none transition focus:border-[#0071e4] focus:ring-4 focus:ring-[#0071e4]/15"
                    name="city"
                    placeholder="Contoh: Bandung"
                    value={reportForm.city}
                    onChange={handleReportChange}
                    required
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-extrabold text-[#111928]">Kategori</span>
                  <select
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#111928] outline-none transition focus:border-[#0071e4] focus:ring-4 focus:ring-[#0071e4]/15"
                    name="category"
                    value={reportForm.category}
                    onChange={handleReportChange}
                    required
                  >
                    <option value="">Pilih kategori</option>
                    {REPORT_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-extrabold text-[#111928]">Pesan</span>
                  <textarea
                    className="min-h-36 resize-y rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm leading-7 text-[#111928] outline-none transition focus:border-[#0071e4] focus:ring-4 focus:ring-[#0071e4]/15"
                    name="message"
                    minLength={20}
                    placeholder="Ceritakan masalah yang ditemukan, termasuk lokasi dan waktu kejadian."
                    value={reportForm.message}
                    onChange={handleReportChange}
                    required
                  />
                </label>

                <label className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0" aria-hidden="true">
                  Website
                  <input name="hpField" tabIndex={-1} autoComplete="off" value={reportForm.hpField} onChange={handleReportChange} />
                </label>

                <input name="captchaToken" type="hidden" value={reportForm.captchaToken} readOnly />

                <div className="sm:col-span-2">
                  {CAPTCHA_PROVIDER === 'turnstile' ? (
                    <div ref={turnstileRef} className="min-h-[65px]" />
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#b5e0ea] bg-[#f4f8fb] p-4 text-sm font-semibold text-[#92400e]">
                      {CAPTCHA_PROVIDER === 'recaptcha'
                        ? 'reCAPTCHA v3 aktif saat site key tersedia. Token dibuat ketika tombol kirim ditekan.'
                        : 'CAPTCHA belum dikonfigurasi atau belum diverifikasi. TODO: set VITE_TURNSTILE_SITE_KEY atau VITE_RECAPTCHA_KEY dan pastikan backend memiliki secret yang sesuai.'}
                    </div>
                  )}
                </div>
              </div>

              {submitState.error ? (
                <div className="mt-5 rounded-lg border border-[#9b1c1c]/25 bg-[#9b1c1c]/5 px-4 py-3 text-sm font-bold text-[#9b1c1c]">
                  {submitState.error}
                </div>
              ) : null}

              {submitState.success ? (
                <div className="mt-5 rounded-lg border border-[#057a55]/25 bg-[#057a55]/5 px-4 py-3 text-sm font-bold text-[#057a55]">
                  {submitState.success}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0071e4] px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
                  type="submit"
                  disabled={submitState.loading}
                >
                  {submitState.loading ? <Loader2 className="landing-spin" size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                  {submitState.loading ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="bg-[#0f4c81] text-white">
          <div className="mx-auto flex w-[min(1120px,calc(100%-32px))] flex-col gap-7 py-16 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">Bergabung Memantau Program MBG</h2>
              <p className="mt-3 text-base leading-7 text-[#d9eef4]">Login untuk akses dashboard lengkap sesuai peran Anda</p>
            </div>
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#b5e0ea] px-6 text-sm font-extrabold text-[#0f4c81] transition hover:-translate-y-0.5 sm:w-fit"
              to="/login"
            >
              Masuk Dashboard
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#0f4c81] text-white">
        <div className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-9 border-t border-[#b5e0ea]/25 py-11 md:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0071e4] text-sm font-black text-white">
                MBG
              </span>
              <span>
                <span className="block text-base font-black text-white">MBG</span>
                <span className="block text-xs font-bold text-[#d9eef4]">Transparency System</span>
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-7 text-[#d9eef4]">
              Platform monitoring distribusi Program Makan Bergizi Gratis dari SPPG ke sekolah dengan data publik,
              audit, dan kanal laporan masyarakat.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black text-white">Navigasi</h3>
            <div className="grid gap-2 text-sm text-[#d9eef4]">
              <Link className="hover:text-[#b5e0ea]" to="/">
                Beranda
              </Link>
              <Link className="hover:text-[#b5e0ea]" to={fullMapPath}>
                Peta
              </Link>
              <Link className="hover:text-[#b5e0ea]" to="/statistik">
                Statistik
              </Link>
              <a className="hover:text-[#b5e0ea]" href="#laporan">
                Laporan
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black text-white">Informasi</h3>
            <div className="grid gap-2 text-sm text-[#d9eef4]">
              <a className="hover:text-[#b5e0ea]" href="mailto:kontak@mbg.go.id">
                Kontak
              </a>
              <Link className="hover:text-[#b5e0ea]" to="/privacy">
                Kebijakan Privasi
              </Link>
            </div>
          </div>
        </div>
        <div className="mx-auto w-[min(1120px,calc(100%-32px))] border-t border-[#b5e0ea]/25 py-5 text-sm text-[#d9eef4]">
          Copyright 2024 MBG Transparency System.
        </div>
      </footer>
    </div>
  )
}

export default Landing
