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
import { apiRequest as requestApi } from '../services/api'
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
const SPPG_MAP_FIELDS = 'id,name,province,city,address,lat,lng,status,capacity'
const SPPG_PAGE_LIMIT = 100
const INDONESIA_BOUNDS = {
  minLat: -11.2,
  maxLat: 6.4,
  minLng: 94,
  maxLng: 141.2,
}
const TODAY = new Date().toISOString().slice(0, 10)

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

const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Bengkulu',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Lampung',
  'Banten',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Gorontalo',
  'Sulawesi Tengah',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
]

const FALLBACK_SPPG = [
  { id: 'fb-1', name: 'SPPG Banda Aceh Barat', province: 'Aceh', city: 'Banda Aceh', address: 'Jl. Teuku Umar No. 12', status: 'active', capacity: 1600, lat: 5.55, lng: 95.32, porsiHariIni: 1420, successRate: 96.2, picName: 'Cut Rania', picPhone: '0812-1000-0001' },
  { id: 'fb-2', name: 'SPPG Medan Kota', province: 'Sumatera Utara', city: 'Medan', address: 'Jl. Gatot Subroto No. 41', status: 'active', capacity: 1800, lat: 3.59, lng: 98.67, porsiHariIni: 1680, successRate: 95.4, picName: 'Budi Santoso', picPhone: '0812-1000-0002' },
  { id: 'fb-3', name: 'SPPG Padang Timur', province: 'Sumatera Barat', city: 'Padang', address: 'Jl. Khatib Sulaiman No. 9', status: 'active', capacity: 1400, lat: -0.95, lng: 100.35, porsiHariIni: 1260, successRate: 94.8, picName: 'Rizki Putra', picPhone: '0812-1000-0003' },
  { id: 'fb-4', name: 'SPPG Pekanbaru Sentral', province: 'Riau', city: 'Pekanbaru', address: 'Jl. Sudirman No. 88', status: 'active', capacity: 1550, lat: 0.51, lng: 101.45, porsiHariIni: 1490, successRate: 97.1, picName: 'Dewi Anggraini', picPhone: '0812-1000-0004' },
  { id: 'fb-5', name: 'SPPG Palembang Ilir', province: 'Sumatera Selatan', city: 'Palembang', address: 'Jl. Demang Lebar Daun No. 22', status: 'active', capacity: 1700, lat: -2.99, lng: 104.76, porsiHariIni: 1510, successRate: 93.9, picName: 'Agus Wijaya', picPhone: '0812-1000-0005' },
  { id: 'fb-6', name: 'SPPG Bandar Lampung', province: 'Lampung', city: 'Bandar Lampung', address: 'Jl. Pangeran Antasari No. 17', status: 'active', capacity: 1350, lat: -5.43, lng: 105.26, porsiHariIni: 1215, successRate: 95.8, picName: 'Maya Lestari', picPhone: '0812-1000-0006' },
  { id: 'fb-7', name: 'SPPG Jakarta Timur', province: 'DKI Jakarta', city: 'Jakarta Timur', address: 'Jl. Pemuda No. 2', status: 'active', capacity: 2200, lat: -6.2, lng: 106.9, porsiHariIni: 2080, successRate: 97.6, picName: 'Hendra Pratama', picPhone: '0812-1000-0007' },
  { id: 'fb-8', name: 'SPPG Bandung Selatan', province: 'Jawa Barat', city: 'Bandung', address: 'Jl. Buah Batu No. 53', status: 'active', capacity: 2000, lat: -6.95, lng: 107.61, porsiHariIni: 1880, successRate: 96.7, picName: 'Siti Maryam', picPhone: '0812-1000-0008' },
  { id: 'fb-9', name: 'SPPG Semarang Barat', province: 'Jawa Tengah', city: 'Semarang', address: 'Jl. Pamularsih No. 29', status: 'active', capacity: 1750, lat: -6.97, lng: 110.42, porsiHariIni: 1660, successRate: 95.1, picName: 'Dian Purnomo', picPhone: '0812-1000-0009' },
  { id: 'fb-10', name: 'SPPG Surabaya Utara', province: 'Jawa Timur', city: 'Surabaya', address: 'Jl. Kenjeran No. 10', status: 'active', capacity: 2100, lat: -7.25, lng: 112.75, porsiHariIni: 1970, successRate: 96.4, picName: 'Wahyu Nugroho', picPhone: '0812-1000-0010' },
  { id: 'fb-11', name: 'SPPG Serang Kota', province: 'Banten', city: 'Serang', address: 'Jl. Ahmad Yani No. 7', status: 'problem', capacity: 1300, lat: -6.12, lng: 106.15, porsiHariIni: 920, successRate: 82.5, picName: 'Novi Hartati', picPhone: '0812-1000-0011' },
  { id: 'fb-12', name: 'SPPG Yogyakarta Sleman', province: 'DI Yogyakarta', city: 'Sleman', address: 'Jl. Kaliurang Km 8', status: 'problem', capacity: 1450, lat: -7.74, lng: 110.37, porsiHariIni: 1110, successRate: 86.1, picName: 'Fajar Ramadhan', picPhone: '0812-1000-0012' },
  { id: 'fb-13', name: 'SPPG Denpasar Timur', province: 'Bali', city: 'Denpasar', address: 'Jl. Hayam Wuruk No. 31', status: 'problem', capacity: 1250, lat: -8.65, lng: 115.21, porsiHariIni: 980, successRate: 84.9, picName: 'Made Wirawan', picPhone: '0812-1000-0013' },
  { id: 'fb-14', name: 'SPPG Pontianak Sungai Raya', province: 'Kalimantan Barat', city: 'Pontianak', address: 'Jl. Ahmad Yani No. 50', status: 'problem', capacity: 1500, lat: -0.03, lng: 109.34, porsiHariIni: 1040, successRate: 81.8, picName: 'Rahmawati', picPhone: '0812-1000-0014' },
  { id: 'fb-15', name: 'SPPG Makassar Mariso', province: 'Sulawesi Selatan', city: 'Makassar', address: 'Jl. Rajawali No. 16', status: 'problem', capacity: 1650, lat: -5.15, lng: 119.43, porsiHariIni: 1235, successRate: 88.2, picName: 'Andi Arman', picPhone: '0812-1000-0015' },
  { id: 'fb-16', name: 'SPPG Mataram Ampenan', province: 'Nusa Tenggara Barat', city: 'Mataram', address: 'Jl. Pejanggik No. 3', status: 'inactive', capacity: 1100, lat: -8.58, lng: 116.12, porsiHariIni: 0, successRate: 0, picName: 'Lalu Hidayat', picPhone: '0812-1000-0016' },
  { id: 'fb-17', name: 'SPPG Palangkaraya Kota', province: 'Kalimantan Tengah', city: 'Palangkaraya', address: 'Jl. Tjilik Riwut No. 44', status: 'inactive', capacity: 1200, lat: -2.21, lng: 113.92, porsiHariIni: 0, successRate: 0, picName: 'Yuliana', picPhone: '0812-1000-0017' },
  { id: 'fb-18', name: 'SPPG Manado Wenang', province: 'Sulawesi Utara', city: 'Manado', address: 'Jl. Sam Ratulangi No. 28', status: 'inactive', capacity: 1150, lat: 1.47, lng: 124.84, porsiHariIni: 0, successRate: 0, picName: 'Rivo Tumbelaka', picPhone: '0812-1000-0018' },
  { id: 'fb-19', name: 'SPPG Batam Centre', province: 'Kepulauan Riau', city: 'Batam', address: 'Jl. Engku Putri No. 5', status: 'active', capacity: 1500, lat: 1.13, lng: 104.05, porsiHariIni: 1395, successRate: 94.2, picName: 'Lina Kurnia', picPhone: '0812-1000-0019' },
  { id: 'fb-20', name: 'SPPG Bengkulu Tengah', province: 'Bengkulu', city: 'Bengkulu', address: 'Jl. Pembangunan No. 19', status: 'active', capacity: 1180, lat: -3.8, lng: 102.27, porsiHariIni: 1070, successRate: 93.4, picName: 'Teguh Saputra', picPhone: '0812-1000-0020' },
  { id: 'fb-21', name: 'SPPG Pangkalpinang', province: 'Kepulauan Bangka Belitung', city: 'Pangkalpinang', address: 'Jl. Soekarno Hatta No. 11', status: 'active', capacity: 1000, lat: -2.13, lng: 106.11, porsiHariIni: 940, successRate: 95.7, picName: 'Mira Amelia', picPhone: '0812-1000-0021' },
  { id: 'fb-22', name: 'SPPG Kupang Oebobo', province: 'Nusa Tenggara Timur', city: 'Kupang', address: 'Jl. El Tari No. 24', status: 'problem', capacity: 1300, lat: -10.17, lng: 123.6, porsiHariIni: 860, successRate: 79.4, picName: 'Yosef Lado', picPhone: '0812-1000-0022' },
  { id: 'fb-23', name: 'SPPG Banjarmasin Barat', province: 'Kalimantan Selatan', city: 'Banjarmasin', address: 'Jl. Lambung Mangkurat No. 8', status: 'active', capacity: 1550, lat: -3.32, lng: 114.59, porsiHariIni: 1460, successRate: 96.1, picName: 'Nur Hasanah', picPhone: '0812-1000-0023' },
  { id: 'fb-24', name: 'SPPG Balikpapan Selatan', province: 'Kalimantan Timur', city: 'Balikpapan', address: 'Jl. MT Haryono No. 71', status: 'active', capacity: 1650, lat: -1.24, lng: 116.85, porsiHariIni: 1540, successRate: 94.6, picName: 'Rangga Akbar', picPhone: '0812-1000-0024' },
  { id: 'fb-25', name: 'SPPG Tarakan Tengah', province: 'Kalimantan Utara', city: 'Tarakan', address: 'Jl. Mulawarman No. 23', status: 'active', capacity: 980, lat: 3.31, lng: 117.59, porsiHariIni: 895, successRate: 92.8, picName: 'Dimas Prasetya', picPhone: '0812-1000-0025' },
  { id: 'fb-26', name: 'SPPG Gorontalo Kota', province: 'Gorontalo', city: 'Gorontalo', address: 'Jl. HB Jassin No. 13', status: 'problem', capacity: 1040, lat: 0.54, lng: 123.06, porsiHariIni: 760, successRate: 83.7, picName: 'Nurul Aini', picPhone: '0812-1000-0026' },
  { id: 'fb-27', name: 'SPPG Palu Mantikulore', province: 'Sulawesi Tengah', city: 'Palu', address: 'Jl. Soekarno Hatta No. 39', status: 'active', capacity: 1250, lat: -0.9, lng: 119.87, porsiHariIni: 1165, successRate: 95.2, picName: 'Ilham Fauzi', picPhone: '0812-1000-0027' },
  { id: 'fb-28', name: 'SPPG Mamuju Kota', province: 'Sulawesi Barat', city: 'Mamuju', address: 'Jl. Yos Sudarso No. 6', status: 'active', capacity: 970, lat: -2.67, lng: 118.89, porsiHariIni: 910, successRate: 93.6, picName: 'Nadia Safitri', picPhone: '0812-1000-0028' },
  { id: 'fb-29', name: 'SPPG Kendari Mandonga', province: 'Sulawesi Tenggara', city: 'Kendari', address: 'Jl. Sao Sao No. 20', status: 'active', capacity: 1180, lat: -3.99, lng: 122.51, porsiHariIni: 1095, successRate: 94.1, picName: 'Rudiansyah', picPhone: '0812-1000-0029' },
  { id: 'fb-30', name: 'SPPG Jayapura Abepura', province: 'Papua', city: 'Jayapura', address: 'Jl. Raya Abepura No. 48', status: 'active', capacity: 1350, lat: -2.53, lng: 140.72, porsiHariIni: 1265, successRate: 92.9, picName: 'Martha Wenda', picPhone: '0812-1000-0030' },
]

const FALLBACK_MENU = {
  menuName: 'Nasi Ayam Teriyaki + Sayur Bayam',
  calories: 650,
  proteinG: 28,
  carbsG: 75,
  fatG: 18,
}

const TABS = [
  { value: 'info', label: 'Info' },
  { value: 'distribusi', label: 'Distribusi' },
  { value: 'menu', label: 'Menu Hari Ini' },
]

async function fetchSppgMapRows({ signal }) {
  const firstResult = await requestApi('/sppg', {
    signal,
    params: {
      all: true,
      page: 1,
      limit: SPPG_PAGE_LIMIT,
      fields: SPPG_MAP_FIELDS,
    },
  })

  const firstRows = Array.isArray(firstResult.data) ? firstResult.data : []

  if (firstResult.meta?.all || !firstResult.meta?.totalPages || firstResult.meta.totalPages <= 1) {
    return firstRows
  }

  const pages = Array.from({ length: firstResult.meta.totalPages - 1 }, (_, index) => index + 2)
  const rows = [...firstRows]
  const chunkSize = 8

  for (let index = 0; index < pages.length; index += chunkSize) {
    const chunk = pages.slice(index, index + chunkSize)
    const results = await Promise.all(
      chunk.map((page) =>
        requestApi('/sppg', {
          signal,
          params: {
            page,
            limit: SPPG_PAGE_LIMIT,
            fields: SPPG_MAP_FIELDS,
          },
        }),
      ),
    )

    results.forEach((result) => {
      if (Array.isArray(result.data)) rows.push(...result.data)
    })
  }

  return rows
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
  const coordinate = normalizeCoordinatePair(item.lat, item.lng)

  return {
    id: item.id,
    name: item.name || 'SPPG',
    province: item.province || '-',
    city: item.city || '-',
    address: item.address || '-',
    status: item.status || 'inactive',
    capacity: Number(item.capacity) || 0,
    lat: coordinate.lat,
    lng: coordinate.lng,
    coordinateValid: coordinate.coordinateValid,
    porsiHariIni: Number(item.porsiHariIni) || 0,
    successRate: Number(item.successRate) || 0,
    picName: item.picName || item.pic_name || '-',
    picPhone: item.picPhone || item.pic_phone || '-',
    stats: item.stats,
    latestMenu: item.latestMenu,
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

function getFallbackDistributions(sppg) {
  const schools = ['SDN Merdeka 01', 'SMP Negeri 4', 'SDN Nusantara 02', 'MI Al Ikhlas', 'SDN Harapan Jaya', 'SMP Pertiwi', 'SDN Cendana']
  const statuses = ['delivered', 'delivered', 'in_progress', 'delivered', 'failed', 'delivered', 'delivered']
  const today = new Date()

  return schools.map((schoolName, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)

    return {
      id: `${sppg?.id || 'fallback'}-distribution-${index}`,
      school: { name: schoolName },
      portions: Math.max(120, Math.round(((sppg?.capacity || 1400) / 7) + index * 18)),
      status: statuses[index],
      distributionDate: date.toISOString(),
    }
  })
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
  return [
    { label: 'Kalori', value: Number(menu?.calories) || 650, unit: 'kkal', target: 700 },
    { label: 'Protein', value: Number(menu?.proteinG) || 28, unit: 'g', target: 30 },
    { label: 'Karbo', value: Number(menu?.carbsG) || 75, unit: 'g', target: 90 },
    { label: 'Lemak', value: Number(menu?.fatG) || 18, unit: 'g', target: 25 },
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

  const capacity = document.createElement('p')
  capacity.className = 'peta-popup-meta'
  capacity.textContent = `Kapasitas: ${formatNumber(sppg.capacity)} porsi/hari`

  const button = document.createElement('button')
  button.className = 'peta-popup-btn'
  button.type = 'button'
  button.textContent = 'Lihat Detail'
  L.DomEvent.on(button, 'click', (event) => {
    L.DomEvent.stop(event)
    if (map) map.closePopup()
    onOpenDetail(sppg)
  })

  container.append(title, location, statusText, capacity, button)
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

        if (!normalized.length) {
          setSppgList(FALLBACK_SPPG)
          setError('Data SPPG dari API kosong atau belum memiliki koordinat. Fallback preview ditampilkan.')
          return
        }

        setSppgList(normalized)
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setSppgList(FALLBACK_SPPG)
          setError('Data SPPG gagal dimuat dari API. Fallback preview ditampilkan.')
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
    const keyword = search.trim().toLowerCase()
    const filtered = sppgList.filter((item) => {
      const matchesProvince = province ? normalizeRegionKey(item.province) === normalizeRegionKey(province) : true
      const matchesStatus = status ? item.status === status : true
      const matchesSearch = keyword
        ? [item.name, item.city, item.province, item.address].some((value) => String(value || '').toLowerCase().includes(keyword))
        : true

      return matchesProvince && matchesStatus && matchesSearch
    })

    Promise.resolve().then(() => {
      if (isCurrent) setFilteredSppg(filtered)
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
        const [detailResult, distributionResult, menuResult] = await Promise.allSettled([
          requestApi(`/sppg/${selectedSppg.id}`, { signal: controller.signal }),
          requestApi('/distributions', {
            signal: controller.signal,
            params: { sppgId: selectedSppg.id, limit: 7 },
          }),
          requestApi('/menus', {
            signal: controller.signal,
            params: { sppgId: selectedSppg.id, date: TODAY, limit: 1 },
          }),
        ])

        if (detailResult.status === 'fulfilled') {
          setDetailData(normalizeSppg(detailResult.value.data))
        } else {
          setDetailData(null)
        }

        if (distributionResult.status === 'fulfilled' && Array.isArray(distributionResult.value.data)) {
          setDetailDistributions(distributionResult.value.data.length ? distributionResult.value.data : getFallbackDistributions(selectedSppg))
        } else {
          // TODO: Endpoint /distributions?sppgId membutuhkan auth. Gunakan data backend ketika user dashboard sudah login.
          setDetailDistributions(getFallbackDistributions(selectedSppg))
        }

        if (menuResult.status === 'fulfilled' && Array.isArray(menuResult.value.data) && menuResult.value.data[0]) {
          setMenuToday(menuResult.value.data[0])
        } else {
          setMenuToday(FALLBACK_MENU)
        }

        if (detailResult.status === 'rejected') {
          setDetailError('Detail SPPG belum lengkap dari API. Sebagian data panel memakai fallback.')
        }
      } catch (detailFetchError) {
        if (detailFetchError.name !== 'AbortError') {
          setDetailData(null)
          setDetailDistributions(getFallbackDistributions(selectedSppg))
          setMenuToday(FALLBACK_MENU)
          setDetailError('Detail SPPG gagal dimuat. Fallback panel ditampilkan.')
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
  const normalizedMenu = menuToday || activeSppg?.latestMenu || FALLBACK_MENU
  const nutritionRows = useMemo(() => getNutritionRows(normalizedMenu), [normalizedMenu])

  const openDetail = (sppg) => {
    setSelectedSppg(sppg)
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
            {PROVINCES.map((provinceName) => (
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
                  <InfoItem icon={CheckCircle2} label="Porsi Hari Ini" value={`${formatNumber(activeSppg.porsiHariIni || activeSppg.stats?.totalStudents || 0)} porsi`} />
                  <InfoItem icon={BarChart3} label="Success Rate" value={formatPercent(activeSppg.successRate || 0)} />
                  <InfoItem icon={Phone} label="PIC" value={`${activeSppg.picName || '-'} - ${activeSppg.picPhone || '-'}`} wide />
                  <InfoItem icon={AlertTriangle} label="Status" value={getStatusLabel(activeSppg.status)} />
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
                      {detailDistributions.slice(0, 7).map((item) => (
                        <tr key={item.id}>
                          <td>{item.school?.name || '-'}</td>
                          <td>{formatNumber(item.portions)}</td>
                          <td>{item.status || '-'}</td>
                          <td>{formatDate(item.distributionDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === 'menu' ? (
                <div className="peta-menu-card">
                  <div className="peta-menu-title">
                    <Utensils aria-hidden="true" />
                    <div>
                      <span>Menu Hari Ini</span>
                      <strong>{normalizedMenu.menuName || FALLBACK_MENU.menuName}</strong>
                    </div>
                  </div>
                  <div className="peta-nutrition-list">
                    {nutritionRows.map((row) => {
                      const percentage = Math.min(100, Math.round((row.value / row.target) * 100))

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
