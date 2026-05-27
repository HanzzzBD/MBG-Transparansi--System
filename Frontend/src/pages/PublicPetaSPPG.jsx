import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Search,
  Utensils,
  X,
} from 'lucide-react'
import { apiRequest } from '../services/api'
import { matchesSearchTokens, rankBySearch } from '../utils/search.js'
import './PublicPetaSPPG.css'

const INDONESIA_CENTER = [-2.5, 118]
const INDONESIA_VIEW_BOUNDS = [
  [-11.2, 94],
  [6.4, 141.2],
]
const INDONESIA_MAX_BOUNDS = [
  [-13.8, 90],
  [8.5, 145.5],
]

const STATUS_LABELS = {
  active: 'Aktif',
  problem: 'Bermasalah',
  inactive: 'Tidak Aktif',
}

const STATUS_COLORS = {
  active: '#057a55',
  problem: '#a16207',
  inactive: '#9b1c1c',
}

async function requestJson(path, options = {}) {
  const payload = await apiRequest(path, options)
  return payload?.data ?? payload
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Number(value))}%`
}

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '-'
}

function normalizeMarker(item) {
  const lat = Number(item?.lat)
  const lng = Number(item?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return {
    id: String(item.id),
    name: item.name || 'SPPG',
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
    status: item.status || 'inactive',
    capacity: Number(item.capacity) || 0,
    lat,
    lng,
  }
}

function normalizeDetail(item) {
  if (!item) return null

  return {
    id: String(item.id),
    name: item.name || 'SPPG',
    province: item.province || '-',
    city: item.city || '-',
    district: item.district || '-',
    status: item.status || 'inactive',
    capacity: Number(item.capacity) || 0,
    todayPortions: Number(item.todayPortions ?? item.today_portions) || 0,
    successRate: Number(item.successRate ?? item.success_rate) || 0,
    todayMenu: item.todayMenu || item.today_menu || null,
    recentDistributions: Array.isArray(item.recentDistributions || item.recent_distributions)
      ? (item.recentDistributions || item.recent_distributions).slice(0, 5).map((row) => ({
          schoolName: row.schoolName || row.school_name || '-',
          portions: Number(row.portions) || 0,
          status: row.status || '-',
          date: row.date || row.distributionDate || row.distribution_date || '',
        }))
      : [],
  }
}

function MapFitter({ markers }) {
  const map = useMap()

  useEffect(() => {
    map.setMaxBounds(L.latLngBounds(INDONESIA_MAX_BOUNDS))

    if (!markers.length) {
      map.fitBounds(L.latLngBounds(INDONESIA_VIEW_BOUNDS), { padding: [24, 24] })
      return
    }

    if (markers.length > 5000) {
      map.fitBounds(L.latLngBounds(INDONESIA_VIEW_BOUNDS), { padding: [24, 24], maxZoom: 5, animate: false })
      return
    }

    const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng]))
    map.fitBounds(bounds.pad(0.12), { padding: [34, 34], maxZoom: 10 })
  }, [map, markers])

  return null
}

function buildPopupContent(marker, onOpenDetail, map) {
  const container = document.createElement('div')
  container.className = 'public-map-popup'

  const title = document.createElement('strong')
  title.textContent = marker.name

  const location = document.createElement('span')
  location.textContent = [marker.city, marker.province].filter(Boolean).join(', ') || '-'

  const statusText = document.createElement('span')
  statusText.textContent = `Status: ${getStatusLabel(marker.status)}`

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Lihat detail'
  L.DomEvent.on(button, 'click', (event) => {
    L.DomEvent.stop(event)
    map.closePopup()
    onOpenDetail(marker)
  })

  container.append(title, location, statusText, button)
  return container
}

function CanvasMarkerLayer({ markers, onOpenDetail, selectedId }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const markersRef = useRef(markers)
  const clickTargetsRef = useRef([])
  const rafRef = useRef(0)
  const onOpenDetailRef = useRef(onOpenDetail)
  const selectedIdRef = useRef(selectedId)

  const redraw = useCallback(() => {
    if (rafRef.current) return

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      const canvas = canvasRef.current
      if (!canvas) return

      const container = map.getContainer()
      const rect = container.getBoundingClientRect()
      const size = {
        x: Math.max(1, Math.round(rect.width)),
        y: Math.max(1, Math.round(rect.height)),
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

      markersRef.current.forEach((marker) => {
        const latLng = L.latLng(marker.lat, marker.lng)
        if (!bounds.contains(latLng)) return

        const point = map.latLngToContainerPoint(latLng)
        if (point.x < -20 || point.y < -20 || point.x > size.x + 20 || point.y > size.y + 20) return

        const color = STATUS_COLORS[marker.status] || STATUS_COLORS.inactive
        const isSelected = marker.id === selectedIdRef.current

        context.beginPath()
        context.fillStyle = color
        context.strokeStyle = '#ffffff'
        context.arc(point.x, point.y, isSelected ? radius + 2 : radius, 0, Math.PI * 2)
        context.fill()
        context.stroke()

        if (isSelected) {
          context.beginPath()
          context.strokeStyle = color
          context.lineWidth = 3
          context.arc(point.x, point.y, radius + 7, 0, Math.PI * 2)
          context.stroke()
          context.lineWidth = 2
        }

        targets.push({
          x: point.x,
          y: point.y,
          radius: Math.max(24, radius + 8),
          marker,
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
          selected = target.marker
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
    selectedIdRef.current = selectedId
    redraw()
  }, [redraw, selectedId])

  useEffect(() => {
    const canvas = L.DomUtil.create('canvas', 'public-map-canvas-layer')
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

function PublicPetaSPPG() {
  const [markers, setMarkers] = useState([])
  const [mapState, setMapState] = useState({ loading: true, error: '' })
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [status, setStatus] = useState('')
  const [detailState, setDetailState] = useState({
    open: false,
    selected: null,
    data: null,
    loading: false,
    error: '',
  })

  const loadMarkers = useCallback(async ({ signal } = {}) => {
    setMapState({ loading: true, error: '' })

    try {
      const data = await requestJson('/public/sppg', { signal })
      const normalizedMarkers = (Array.isArray(data) ? data : []).map(normalizeMarker).filter(Boolean)
      setMarkers(normalizedMarkers)
      setMapState({ loading: false, error: '' })
    } catch (error) {
      if (error.name === 'AbortError') return
      setMarkers([])
      setMapState({ loading: false, error: 'Data peta publik gagal dimuat.' })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadMarkers({ signal: controller.signal }), 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadMarkers])

  const provinces = useMemo(
    () => Array.from(new Set(markers.map((marker) => marker.province).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id')),
    [markers],
  )

  const filteredMarkers = useMemo(() => {
    const filtered = markers.filter((marker) => {
      const matchesProvince = !province || marker.province === province
      const matchesStatus = !status || marker.status === status
      const matchesSearch = matchesSearchTokens([marker.name, marker.city, marker.province, marker.district], search)

      return matchesProvince && matchesStatus && matchesSearch
    })

    return search.trim()
      ? rankBySearch(filtered, search, [
        { field: 'name', weight: 6 },
        { field: 'city', weight: 3 },
        { field: 'district', weight: 3 },
        { field: 'province', weight: 2 },
      ])
      : filtered
  }, [markers, province, search, status])

  const summary = useMemo(
    () => ({
      total: markers.length,
      active: markers.filter((marker) => marker.status === 'active').length,
      visible: filteredMarkers.length,
    }),
    [filteredMarkers.length, markers],
  )

  const loadDetail = useCallback(async (marker) => {
    setDetailState({
      open: true,
      selected: marker,
      data: null,
      loading: true,
      error: '',
    })

    try {
      const data = await requestJson(`/public/sppg/${marker.id}`)
      setDetailState({
        open: true,
        selected: marker,
        data: normalizeDetail(data),
        loading: false,
        error: '',
      })
    } catch {
      setDetailState({
        open: true,
        selected: marker,
        data: null,
        loading: false,
        error: 'Detail SPPG tidak tersedia',
      })
    }
  }, [])

  const resetFilters = () => {
    setSearch('')
    setProvince('')
    setStatus('')
  }

  const closeDetail = () => {
    setDetailState({
      open: false,
      selected: null,
      data: null,
      loading: false,
      error: '',
    })
  }

  const selectedId = detailState.selected?.id || detailState.data?.id

  return (
    <div className="public-map-page">
      <header className="public-map-header">
        <div>
          <Link className="public-map-back" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Beranda
          </Link>
          <h1>Peta Publik SPPG</h1>
          <p>Informasi dasar SPPG untuk transparansi publik tanpa login.</p>
        </div>

        <div className="public-map-summary" aria-label="Ringkasan peta publik">
          <span>
            <strong>{formatNumber(summary.total)}</strong>
            Total SPPG
          </span>
          <span>
            <strong>{formatNumber(summary.active)}</strong>
            Aktif
          </span>
          <span>
            <strong>{formatNumber(summary.visible)}</strong>
            Ditampilkan
          </span>
        </div>
      </header>

      <section className="public-map-toolbar" aria-label="Filter peta publik">
        <label className="public-map-field public-map-field-search">
          <span>Cari SPPG</span>
          <span className="public-map-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama, kota, provinsi"
            />
          </span>
        </label>

        <label className="public-map-field">
          <span>Provinsi</span>
          <select value={province} onChange={(event) => setProvince(event.target.value)}>
            <option value="">Semua</option>
            {provinces.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="public-map-field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button className="public-map-icon-btn" type="button" onClick={resetFilters} aria-label="Reset filter">
          <X size={18} aria-hidden="true" />
        </button>

        <button className="public-map-refresh" type="button" onClick={() => loadMarkers()}>
          <RefreshCcw size={17} aria-hidden="true" />
          Muat Ulang
        </button>
      </section>

      {mapState.error ? (
        <div className="public-map-alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          {mapState.error}
        </div>
      ) : null}

      <main className="public-map-shell">
        <section className="public-map-canvas" aria-label="Peta sebaran SPPG">
          <MapContainer
            center={INDONESIA_CENTER}
            zoom={5}
            minZoom={4}
            maxZoom={12}
            scrollWheelZoom
            className="public-map-leaflet"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFitter markers={filteredMarkers} />
            <CanvasMarkerLayer markers={filteredMarkers} onOpenDetail={loadDetail} selectedId={selectedId} />
          </MapContainer>

          {mapState.loading ? (
            <div className="public-map-loading">
              <Loader2 size={20} aria-hidden="true" />
              Memuat peta publik...
            </div>
          ) : null}

          {!mapState.loading && !filteredMarkers.length ? (
            <div className="public-map-empty">
              <MapPin size={24} aria-hidden="true" />
              Tidak ada marker SPPG yang cocok.
            </div>
          ) : null}
        </section>

        <aside className={`public-map-detail ${detailState.open ? 'public-map-detail-open' : ''}`} aria-label="Detail SPPG publik">
          <div className="public-map-detail-head">
            <div>
              <p>Detail Public-Safe</p>
              <h2>{detailState.selected?.name || detailState.data?.name || 'Pilih marker SPPG'}</h2>
            </div>
            {detailState.open ? (
              <button type="button" onClick={closeDetail} aria-label="Tutup detail">
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {!detailState.open ? (
            <div className="public-map-detail-placeholder">
              <MapPin size={28} aria-hidden="true" />
              Pilih marker pada peta untuk memuat detail SPPG dari endpoint publik.
            </div>
          ) : null}

          {detailState.loading ? (
            <div className="public-map-detail-status">
              <Loader2 size={18} aria-hidden="true" />
              Memuat detail...
            </div>
          ) : null}

          {detailState.error ? (
            <div className="public-map-detail-error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              {detailState.error}
            </div>
          ) : null}

          {detailState.data ? <PublicSppgDetail detail={detailState.data} /> : null}
        </aside>
      </main>
    </div>
  )
}

function PublicSppgDetail({ detail }) {
  const nutrition = detail.todayMenu?.nutrition

  return (
    <div className="public-map-detail-body">
      <div className="public-map-status-line">
        <span className={`public-map-status public-map-status-${detail.status}`}>{getStatusLabel(detail.status)}</span>
        <span>{[detail.district, detail.city, detail.province].filter((item) => item && item !== '-').join(', ') || '-'}</span>
      </div>

      <dl className="public-map-facts">
        <InfoItem icon={Building2} label="Kapasitas" value={`${formatNumber(detail.capacity)} porsi`} />
        <InfoItem icon={PackageCheck} label="Porsi Hari Ini" value={`${formatNumber(detail.todayPortions)} porsi`} />
        <InfoItem icon={BarChart3} label="Success Rate" value={formatPercent(detail.successRate)} />
        <InfoItem icon={CheckCircle2} label="Status" value={getStatusLabel(detail.status)} />
      </dl>

      <section className="public-map-section">
        <h3>
          <Utensils size={18} aria-hidden="true" />
          Menu Hari Ini
        </h3>
        <p className="public-map-menu-name">{detail.todayMenu?.name || 'Belum ada menu tersedia.'}</p>

        {nutrition ? (
          <div className="public-map-nutrition">
            <span>{formatNumber(nutrition.calories)} kkal</span>
            <span>Protein {formatNumber(nutrition.protein)}g</span>
            <span>Karbo {formatNumber(nutrition.carbohydrate)}g</span>
            <span>Lemak {formatNumber(nutrition.fat)}g</span>
          </div>
        ) : null}
      </section>

      <section className="public-map-section">
        <h3>
          <PackageCheck size={18} aria-hidden="true" />
          Distribusi Terbaru
        </h3>

        {detail.recentDistributions.length ? (
          <div className="public-map-distributions">
            {detail.recentDistributions.map((row, index) => (
              <article key={`${row.schoolName}-${row.date}-${index}`}>
                <div>
                  <strong>{row.schoolName}</strong>
                  <span>{formatDate(row.date)}</span>
                </div>
                <div>
                  <strong>{formatNumber(row.portions)} porsi</strong>
                  <span>{row.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="public-map-muted">Belum ada distribusi terbaru.</p>
        )}
      </section>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="public-map-info-item">
      <dt>
        <Icon size={17} aria-hidden="true" />
        {label}
      </dt>
      <dd>{value || '-'}</dd>
    </div>
  )
}

export default PublicPetaSPPG
