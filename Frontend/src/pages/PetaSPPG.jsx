import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Loader2,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Utensils,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getSppgMapMarkers, getSppgOperationalDetail } from '../services/api'
import { matchesSearchTokens, rankBySearch } from '../utils/search.js'
import './PetaSPPG.css'

const INDONESIA_CENTER = [-2.5, 118]
const INDONESIA_VIEW_BOUNDS = [
  [-11.2, 94],
  [6.4, 141.2],
]
const INDONESIA_MAX_BOUNDS = [
  [-13.8, 90],
  [8.5, 145.5],
]
const INDONESIA_BOUNDS = {
  minLat: -11.2,
  maxLat: 6.4,
  minLng: 94,
  maxLng: 141.2,
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'problem', label: 'Bermasalah' },
  { value: 'inactive', label: 'Tidak Aktif' },
]

const STATUS_LABELS = {
  active: 'Aktif',
  problem: 'Bermasalah',
  inactive: 'Tidak Aktif',
}

const MARKER_COLORS = {
  active: '#057a55',
  problem: '#92400e',
  inactive: '#9b1c1c',
}

const TABS = [
  { value: 'info', label: 'Info' },
  { value: 'distribusi', label: 'Distribusi' },
  { value: 'menu', label: 'Menu Hari Ini' },
]

async function fetchSppgMapRows({ signal }) {
  const result = await getSppgMapMarkers(undefined, { signal })
  return Array.isArray(result.data) ? result.data : []
}

function normalizeRegionKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^provinsi\s+/, '')
    .replace(/^daerah istimewa yogyakarta$/, 'di yogyakarta')
    .replace(/^kep\.\s*/, 'kepulauan ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return Number.NaN
  return Number(value)
}

function isInsideIndonesia(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= INDONESIA_BOUNDS.minLat &&
    lat <= INDONESIA_BOUNDS.maxLat &&
    lng >= INDONESIA_BOUNDS.minLng &&
    lng <= INDONESIA_BOUNDS.maxLng
  )
}

function normalizeCoordinatePair(rawLat, rawLng) {
  const lat = parseCoordinate(rawLat)
  const lng = parseCoordinate(rawLng)

  if (isInsideIndonesia(lat, lng)) {
    return { lat, lng, coordinateValid: true }
  }

  // Beberapa import data sering tertukar: longitude masuk ke lat dan sebaliknya.
  if (isInsideIndonesia(lng, lat)) {
    return { lat: lng, lng: lat, coordinateValid: true }
  }

  return { lat, lng, coordinateValid: false }
}

function normalizeSppg(item) {
  const info = item.info || item
  const kpiSummary = item.kpiSummary || item.stats || {}
  const coordinate = normalizeCoordinatePair(info.lat ?? item.lat, info.lng ?? item.lng)

  return {
    id: item.id,
    name: item.name || info.name || 'SPPG',
    province: item.province || info.province || '-',
    city: item.city || info.city || '-',
    address: item.address || info.address || '-',
    status: item.status || 'inactive',
    isActive: Boolean(item.isActive ?? item.status === 'active'),
    capacity: Number(item.capacity) || Number(info.capacity) || 0,
    lat: coordinate.lat,
    lng: coordinate.lng,
    coordinateValid: coordinate.coordinateValid,
    porsiHariIni: Number(item.porsiHariIni ?? kpiSummary.porsiHariIni) || 0,
    successRate: Number(item.successRate ?? kpiSummary.successRate) || 0,
    picName: item.picName || item.pic_name || item.pic?.name || '-',
    picPhone: item.picPhone || item.pic_phone || item.pic?.phone || '-',
    kpiSummary,
    latestMenu: item.menuHariIni || item.latestMenu || null,
    productionBatchHariIni: item.productionBatchHariIni || null,
    distribusiTerakhir: Array.isArray(item.distribusiTerakhir) ? item.distribusiTerakhir : [],
    anomalyAktif: Array.isArray(item.anomalyAktif) ? item.anomalyAktif : [],
  }
}

function normalizeSppgList(items) {
  if (!Array.isArray(items)) return []

  return items
    .map(normalizeSppg)
    .filter((item) => item.coordinateValid)
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || 'Tidak Diketahui'
}

function getMarkerStatusClass(status) {
  if (status === 'problem') return 'problem'
  if (status === 'inactive') return 'inactive'
  return 'active'
}

function buildDistributionChart(distributions) {
  const safeRows = Array.isArray(distributions) && distributions.length ? distributions : []
  const today = new Date()

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const total = safeRows
      .filter((item) => item.distributionDate?.slice(0, 10) === key)
      .reduce((sum, item) => sum + (Number(item.portions) || 0), 0)

    return {
      label: index === 6 ? 'Hari ini' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date),
      portions: total,
    }
  })
}

function getNutritionRows(menu) {
  if (!menu) return []

  return [
    { label: 'Kalori', value: Number(menu.calories) || 0, unit: 'kkal', target: 700 },
    { label: 'Protein', value: Number(menu.proteinG) || 0, unit: 'g', target: 30 },
    { label: 'Karbo', value: Number(menu.carbsG) || 0, unit: 'g', target: 90 },
    { label: 'Lemak', value: Number(menu.fatG) || 0, unit: 'g', target: 25 },
  ]
}

function MapAutoFit({ markers }) {
  const map = useMap()

  useEffect(() => {
    const indonesiaBounds = L.latLngBounds(INDONESIA_VIEW_BOUNDS)
    const keepIndonesiaInFrame = () => {
      map.fitBounds(indonesiaBounds, {
        padding: [18, 18],
        maxZoom: 5,
        animate: false,
      })
    }

    map.setMaxBounds(L.latLngBounds(INDONESIA_MAX_BOUNDS))

    if (!markers.length) {
      keepIndonesiaInFrame()
      return
    }

    if (markers.length > 5000) {
      keepIndonesiaInFrame()
      return
    }

    const bounds = L.latLngBounds([])
    markers.forEach((item) => bounds.extend([item.lat, item.lng]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 8, animate: false })
  }, [map, markers])

  return null
}

function buildPopupContent(sppg, onOpenDetail, map) {
  const container = document.createElement('div')
  container.className = 'peta-popup'

  const title = document.createElement('h2')
  title.className = 'peta-popup-title'
  title.textContent = sppg.name

  const location = document.createElement('p')
  location.className = 'peta-popup-meta'
  location.textContent = `${sppg.city}, ${sppg.province}`

  const statusText = document.createElement('p')
  statusText.className = 'peta-popup-meta'
  statusText.textContent = `Status: ${getStatusLabel(sppg.status)}`

  const portionToday = document.createElement('p')
  portionToday.className = 'peta-popup-meta'
  portionToday.textContent = `Porsi hari ini: ${formatNumber(sppg.porsiHariIni)}`

  const button = document.createElement('button')
  button.className = 'peta-popup-btn'
  button.type = 'button'
  button.textContent = 'Lihat Detail'
  L.DomEvent.on(button, 'click', (event) => {
    L.DomEvent.stop(event)
    if (map) map.closePopup()
    onOpenDetail(sppg)
  })

  container.append(title, location, statusText, portionToday, button)
  return container
}

function CanvasMarkerLayer({ markers, onOpenDetail }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const markersRef = useRef(markers)
  const clickTargetsRef = useRef([])
  const rafRef = useRef(0)
  const onOpenDetailRef = useRef(onOpenDetail)

  const redraw = useCallback(() => {
    if (rafRef.current) return

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      const canvas = canvasRef.current
      if (!canvas) return

      const container = map.getContainer()
      const containerRect = container.getBoundingClientRect()
      const size = {
        x: Math.max(1, Math.round(containerRect.width)),
        y: Math.max(1, Math.round(containerRect.height)),
      }
      const dpr = Math.max(window.devicePixelRatio || 1, 1)
      const width = Math.max(1, Math.round(size.x * dpr))
      const height = Math.max(1, Math.round(size.y * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        canvas.style.width = `${size.x}px`
        canvas.style.height = `${size.y}px`
      }

      const context = canvas.getContext('2d')
      if (!context) return

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, size.x, size.y)
      context.lineWidth = 2

      const bounds = map.getBounds().pad(0.08)
      const zoom = map.getZoom()
      const radius = zoom >= 10 ? 6 : zoom >= 7 ? 5 : 4
      const targets = []

      markersRef.current.forEach((sppg) => {
        const latLng = L.latLng(sppg.lat, sppg.lng)
        if (!bounds.contains(latLng)) return

        const point = map.latLngToContainerPoint(latLng)
        if (point.x < -20 || point.y < -20 || point.x > size.x + 20 || point.y > size.y + 20) return

        const statusClass = getMarkerStatusClass(sppg.status)
        context.beginPath()
        context.fillStyle = MARKER_COLORS[statusClass] || MARKER_COLORS.inactive
        context.strokeStyle = '#ffffff'
        context.arc(point.x, point.y, radius, 0, Math.PI * 2)
        context.fill()
        context.stroke()

        targets.push({
          x: point.x,
          y: point.y,
          radius: Math.max(10, radius + 5),
          sppg,
        })
      })

      clickTargetsRef.current = targets
    })
  }, [map])

  const handleMapClick = useCallback(
    (event) => {
      const point = map.mouseEventToContainerPoint(event.originalEvent)
      let selected = null
      let selectedDistance = Number.POSITIVE_INFINITY

      clickTargetsRef.current.forEach((target) => {
        const dx = target.x - point.x
        const dy = target.y - point.y
        const distance = dx * dx + dy * dy
        const hitRadius = target.radius * target.radius

        if (distance <= hitRadius && distance < selectedDistance) {
          selected = target.sppg
          selectedDistance = distance
        }
      })

      if (!selected) return

      L.popup({ closeButton: true, minWidth: 220 })
        .setLatLng([selected.lat, selected.lng])
        .setContent(buildPopupContent(selected, onOpenDetailRef.current, map))
        .openOn(map)
    },
    [map],
  )

  useEffect(() => {
    onOpenDetailRef.current = onOpenDetail
  }, [onOpenDetail])

  useEffect(() => {
    markersRef.current = markers
    redraw()
  }, [markers, redraw])

  useEffect(() => {
    const canvas = L.DomUtil.create('canvas', 'peta-canvas-layer')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.pointerEvents = 'none'
    canvasRef.current = canvas
    const container = map.getContainer()
    container.appendChild(canvas)

    map.on('move zoom moveend zoomend resize viewreset', redraw)
    map.on('click', handleMapClick)

    const syncSize = () => {
      map.invalidateSize({ animate: false, pan: false })
      redraw()
    }

    const resizeObserver = new ResizeObserver(syncSize)
    resizeObserver.observe(container)
    window.requestAnimationFrame(syncSize)
    window.setTimeout(syncSize, 80)
    window.setTimeout(syncSize, 240)

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      map.off('move zoom moveend zoomend resize viewreset', redraw)
      map.off('click', handleMapClick)
      resizeObserver.disconnect()
      canvas.remove()
      canvasRef.current = null
    }
  }, [handleMapClick, map, redraw])

  return null
}

function StatusBadge({ status }) {
  return <span className={`peta-status-badge peta-status-${getMarkerStatusClass(status)}`}>{getStatusLabel(status)}</span>
}

function PetaSPPG() {
  const [sppgList, setSppgList] = useState([])
  const [filteredSppg, setFilteredSppg] = useState([])
  const [selectedSppg, setSelectedSppg] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [province, setProvince] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailData, setDetailData] = useState(null)
  const [detailDistributions, setDetailDistributions] = useState([])
  const [menuToday, setMenuToday] = useState(null)

  const fetchSppg = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const data = await fetchSppgMapRows({ signal })
        const normalized = normalizeSppgList(data)

        setSppgList(normalized)
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setSppgList([])
          setError(fetchError.message || 'Data marker SPPG gagal dimuat dari backend.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchSppg(controller.signal))

    return () => controller.abort()
  }, [fetchSppg])

  useEffect(() => {
    let isCurrent = true
    const filtered = sppgList.filter((item) => {
      const matchesProvince = province ? normalizeRegionKey(item.province) === normalizeRegionKey(province) : true
      const matchesStatus = status ? item.status === status : true
      const matchesSearch = matchesSearchTokens([item.name, item.city, item.province, item.address], search)

      return matchesProvince && matchesStatus && matchesSearch
    })
    const ranked = search.trim()
      ? rankBySearch(filtered, search, [
        { field: 'name', weight: 6 },
        { field: 'city', weight: 3 },
        { field: 'province', weight: 2 },
        { field: 'address', weight: 1 },
      ])
      : filtered

    Promise.resolve().then(() => {
      if (isCurrent) setFilteredSppg(ranked)
    })

    return () => {
      isCurrent = false
    }
  }, [province, search, sppgList, status])

  useEffect(() => {
    if (!selectedSppg) return undefined

    const controller = new AbortController()

    async function fetchDetail() {
      setDetailLoading(true)
      setDetailError('')

      try {
        const detailResult = await getSppgOperationalDetail(selectedSppg.id, { signal: controller.signal })
        const normalized = normalizeSppg(detailResult.data)

        setDetailData(normalized)
        setDetailDistributions(normalized.distribusiTerakhir)
        setMenuToday(normalized.latestMenu)
      } catch (detailFetchError) {
        if (detailFetchError.name !== 'AbortError') {
          setDetailData(null)
          setDetailDistributions([])
          setMenuToday(null)
          setDetailError(detailFetchError.message || 'Detail SPPG gagal dimuat dari backend.')
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false)
      }
    }

    Promise.resolve().then(fetchDetail)

    return () => controller.abort()
  }, [selectedSppg])

  const activeSppg = detailData || selectedSppg
  const chartData = useMemo(() => buildDistributionChart(detailDistributions), [detailDistributions])
  const normalizedMenu = menuToday || activeSppg?.latestMenu || null
  const nutritionRows = useMemo(() => getNutritionRows(normalizedMenu), [normalizedMenu])
  const provinceOptions = useMemo(
    () =>
      Array.from(new Set(sppgList.map((item) => item.province).filter((value) => value && value !== '-'))).sort((first, second) =>
        first.localeCompare(second, 'id-ID'),
      ),
    [sppgList],
  )

  const openDetail = (sppg) => {
    setSelectedSppg(sppg)
    setDetailData(null)
    setDetailDistributions([])
    setMenuToday(null)
    setDetailError('')
    setActiveTab('info')
    setDetailOpen(true)
  }

  const closeDetail = () => {
    setDetailOpen(false)
  }

  const resetFilters = () => {
    setProvince('')
    setStatus('')
    setSearch('')
  }

  return (
    <div className={`peta-page ${detailOpen ? 'peta-page-detail-open' : ''}`}>
      <header className="peta-header">
        <div>
          <Link className="peta-back-link" to="/">
            <ChevronLeft aria-hidden="true" />
            Beranda
          </Link>
          <h1>Peta SPPG Interaktif</h1>
          <p>Monitoring lokasi, status operasional, kapasitas, distribusi, dan menu harian SPPG Program MBG.</p>
        </div>
      </header>

      <section className="peta-filter-bar" aria-label="Filter peta SPPG">
        <label className="peta-filter-group">
          <span className="peta-filter-label">Provinsi</span>
          <select className="peta-select" value={province} onChange={(event) => setProvince(event.target.value)} aria-label="Filter provinsi">
            <option value="">Semua Provinsi</option>
            {provinceOptions.map((provinceName) => (
              <option key={provinceName} value={provinceName}>
                {provinceName}
              </option>
            ))}
          </select>
        </label>

        <label className="peta-filter-group">
          <span className="peta-filter-label">Status</span>
          <select className="peta-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="peta-filter-group peta-filter-search">
          <span className="peta-filter-label">Cari SPPG</span>
          <span className="peta-search-wrap">
            <Search aria-hidden="true" />
            <input
              className="peta-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama SPPG, kota, alamat..."
              aria-label="Cari nama SPPG"
            />
          </span>
        </label>

        <div className="peta-counter">Menampilkan {filteredSppg.length} SPPG</div>

        <button className="peta-reset-btn" type="button" onClick={resetFilters}>
          <RefreshCcw aria-hidden="true" />
          Reset
        </button>
      </section>

      {error ? (
        <div className="peta-error">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="peta-map-wrap">
        <MapContainer
          className="peta-map"
          center={INDONESIA_CENTER}
          zoom={5}
          minZoom={5}
          maxZoom={18}
          maxBounds={INDONESIA_MAX_BOUNDS}
          maxBoundsViscosity={1}
          worldCopyJump={false}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap
          />
          <MapAutoFit markers={filteredSppg} />
          <CanvasMarkerLayer markers={filteredSppg} onOpenDetail={openDetail} />
        </MapContainer>

        <div className="peta-legend" aria-label="Legenda status SPPG">
          <div className="peta-legend-item">
            <span className="peta-legend-dot peta-legend-active" />
            Aktif
          </div>
          <div className="peta-legend-item">
            <span className="peta-legend-dot peta-legend-problem" />
            Bermasalah
          </div>
          <div className="peta-legend-item">
            <span className="peta-legend-dot peta-legend-inactive" />
            Tidak Aktif
          </div>
        </div>

        {loading ? (
          <div className="peta-loading-overlay">
            <Loader2 aria-hidden="true" />
            <span>Memuat lokasi SPPG...</span>
          </div>
        ) : null}

        {!loading && !filteredSppg.length ? (
          <div className="peta-empty">
            <MapPin aria-hidden="true" />
            <span>Tidak ada SPPG yang cocok dengan filter.</span>
          </div>
        ) : null}
      </section>

      {detailOpen ? <button className="peta-panel-backdrop" type="button" aria-label="Tutup panel detail" onClick={closeDetail} /> : null}

      <aside className={`peta-side-panel peta-bottom-sheet ${detailOpen ? 'peta-side-panel-open' : ''}`} aria-label="Detail SPPG">
        {activeSppg ? (
          <>
            <header className="peta-side-header">
              <div>
                <p>Detail Operasional</p>
                <h2 className="peta-side-title">{activeSppg.name}</h2>
                <StatusBadge status={activeSppg.status} />
              </div>
              <button className="peta-side-close" type="button" aria-label="Tutup detail SPPG" onClick={closeDetail}>
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="peta-tabs" role="tablist" aria-label="Tab detail SPPG">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={`peta-tab ${activeTab === tab.value ? 'peta-tab-active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  role="tab"
                  aria-selected={activeTab === tab.value}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="peta-side-body">
              {detailLoading ? (
                <div className="peta-detail-loading">
                  <Loader2 aria-hidden="true" />
                  Memuat detail...
                </div>
              ) : null}

              {detailError ? (
                <div className="peta-error peta-detail-error">
                  <AlertTriangle aria-hidden="true" />
                  <span>{detailError}</span>
                </div>
              ) : null}

              {activeTab === 'info' ? (
                <div className="peta-info-grid">
                  <InfoItem icon={MapPin} label="Provinsi" value={activeSppg.province} />
                  <InfoItem icon={Building2} label="Kota" value={activeSppg.city} />
                  <InfoItem icon={ClipboardList} label="Alamat" value={activeSppg.address} wide />
                  <InfoItem icon={Utensils} label="Kapasitas" value={`${formatNumber(activeSppg.capacity)} porsi/hari`} />
                  <InfoItem icon={CheckCircle2} label="Porsi Hari Ini" value={`${formatNumber(activeSppg.porsiHariIni || activeSppg.kpiSummary?.porsiHariIni || 0)} porsi`} />
                  <InfoItem icon={BarChart3} label="Success Rate" value={formatPercent(activeSppg.successRate || 0)} />
                  <InfoItem icon={Phone} label="PIC" value={`${activeSppg.picName || '-'} - ${activeSppg.picPhone || '-'}`} wide />
                  <InfoItem icon={AlertTriangle} label="Status" value={getStatusLabel(activeSppg.status)} />
                  <InfoItem icon={Building2} label="Sekolah Terlayani" value={formatNumber(activeSppg.kpiSummary?.totalSchools)} />
                  <InfoItem icon={AlertTriangle} label="Anomali Aktif" value={formatNumber(activeSppg.kpiSummary?.activeAnomalyCount)} />
                </div>
              ) : null}

              {activeTab === 'distribusi' ? (
                <div className="peta-distribution-tab">
                  <div className="peta-mini-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid stroke="#f4f8fb" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="portions" name="Porsi" fill="#0071e4" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <table className="peta-mini-table">
                    <thead>
                      <tr>
                        <th>Sekolah</th>
                        <th>Porsi</th>
                        <th>Status</th>
                        <th>Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailDistributions.length ? (
                        detailDistributions.slice(0, 7).map((item) => (
                          <tr key={item.id}>
                            <td>{item.school?.name || '-'}</td>
                            <td>{formatNumber(item.portions)}</td>
                            <td>{item.status || '-'}</td>
                            <td>{formatDate(item.distributionDate)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>Belum ada data distribusi terakhir.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === 'menu' ? (
                <div className="peta-menu-card">
                  {activeSppg.productionBatchHariIni ? (
                    <div className="peta-batch-summary">
                      <span>Batch Produksi Hari Ini</span>
                      <strong>{formatNumber(activeSppg.productionBatchHariIni.totalPortions)} porsi</strong>
                      <small>Biaya per porsi {formatCurrency(activeSppg.productionBatchHariIni.costPerPortion)}</small>
                    </div>
                  ) : null}

                  {normalizedMenu ? (
                    <>
                      <div className="peta-menu-title">
                        <Utensils aria-hidden="true" />
                        <div>
                          <span>Menu Hari Ini</span>
                          <strong>{normalizedMenu.menuName || '-'}</strong>
                        </div>
                      </div>
                      <div className="peta-nutrition-list">
                        {nutritionRows.map((row) => {
                          const percentage = row.target ? Math.min(100, Math.round((row.value / row.target) * 100)) : 0

                          return (
                            <div key={row.label} className="peta-nutrition-item">
                              <div>
                                <span>{row.label}</span>
                                <strong>
                                  {formatNumber(row.value)} {row.unit}
                                </strong>
                              </div>
                              <div className="peta-progress" aria-label={`${row.label} ${percentage}% dari target`}>
                                <span className="peta-progress-bar" style={{ '--progress-value': `${percentage}%` }} />
                              </div>
                              <small>Target {formatNumber(row.target)} {row.unit}</small>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="peta-detail-empty">Menu hari ini belum tersedia.</div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value, wide = false }) {
  return (
    <div className={`peta-info-item ${wide ? 'peta-info-wide' : ''}`}>
      <Icon aria-hidden="true" />
      <span className="peta-info-label">{label}</span>
      <strong className="peta-info-value">{value || '-'}</strong>
    </div>
  )
}

export default PetaSPPG
