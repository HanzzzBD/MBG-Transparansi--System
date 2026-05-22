import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileText,
  Loader2,
  Package,
  RefreshCcw,
  School,
  Truck,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestApi } from '../services/api'
import './Dashboard.css'

const ROLE_LABELS = {
  admin: 'Admin',
  pemerintah: 'Pemerintah',
  sppg: 'SPPG',
  sekolah: 'Sekolah',
}

const STATUS_LABELS = {
  in_progress: 'Sedang Berjalan',
  delivered: 'Terkirim',
  failed: 'Gagal',
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  conflict: 'Konflik',
  resolved: 'Resolved',
  open: 'Open',
}

const ANOMALY_LABELS = {
  OVER_CAPACITY: 'Melebihi Kapasitas',
  PRICE_ANOMALY: 'Anomali Harga',
  VALIDATION_CONFLICT: 'Konflik Validasi',
  PENDING_TIMEOUT: 'Pending Timeout',
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

const NATIONAL_FALLBACK = {
  summary: {
    totalActiveSppg: 2847,
    distributionsToday: 18432,
    successRate: 94.7,
    problematicSppg: 7,
  },
  budget: {
    summary: {
      total_budget: 2400000000,
    },
  },
  publicReportsMeta: {
    total: 43,
  },
  distributionTrend: [
    { label: 'Sen', verified: 14820, conflict: 210, pending: 920 },
    { label: 'Sel', verified: 15340, conflict: 188, pending: 760 },
    { label: 'Rab', verified: 16120, conflict: 176, pending: 680 },
    { label: 'Kam', verified: 16980, conflict: 198, pending: 640 },
    { label: 'Jum', verified: 17440, conflict: 164, pending: 590 },
    { label: 'Sab', verified: 12880, conflict: 120, pending: 410 },
    { label: 'Min', verified: 8420, conflict: 88, pending: 310 },
  ],
  successRateTrend: [
    { label: 'H-6', successRate: 92.8 },
    { label: 'H-5', successRate: 93.2 },
    { label: 'H-4', successRate: 93.6 },
    { label: 'H-3', successRate: 94.1 },
    { label: 'H-2', successRate: 94.3 },
    { label: 'H-1', successRate: 94.4 },
    { label: 'Hari ini', successRate: 94.7 },
  ],
  provinceRanking: [
    { province: 'Jawa Barat', totalDistributions: 3220 },
    { province: 'Jawa Timur', totalDistributions: 2940 },
    { province: 'Jawa Tengah', totalDistributions: 2680 },
    { province: 'Sumatera Utara', totalDistributions: 1420 },
    { province: 'Banten', totalDistributions: 1210 },
    { province: 'Sulawesi Selatan', totalDistributions: 1060 },
    { province: 'DKI Jakarta', totalDistributions: 980 },
    { province: 'Lampung', totalDistributions: 740 },
    { province: 'Bali', totalDistributions: 520 },
    { province: 'Papua', totalDistributions: 410 },
  ],
  anomalyItems: [
    {
      id: 'fallback-anomaly-1',
      sppg_name: 'SPPG Bandung Timur',
      school_name: 'SDN Melati 01',
      anomaly_type: 'OVER_CAPACITY',
      created_at: new Date().toISOString(),
      distribution_status: 'in_progress',
    },
    {
      id: 'fallback-anomaly-2',
      sppg_name: 'SPPG Semarang Barat',
      school_name: 'SMP Negeri 12',
      anomaly_type: 'PRICE_ANOMALY',
      created_at: new Date().toISOString(),
      distribution_status: 'pending',
    },
    {
      id: 'fallback-anomaly-3',
      sppg_name: 'SPPG Makassar Utara',
      school_name: 'SD Inpres Paotere',
      anomaly_type: 'PENDING_TIMEOUT',
      created_at: new Date().toISOString(),
      distribution_status: 'delivered',
    },
  ],
  anomalyMeta: {
    total: 7,
  },
}

const SPPG_FALLBACK = {
  // TODO: Ganti fallback ini dengan endpoint agregasi SPPG khusus saat backend menyediakan summary per dapur.
  distributionsToday: [
    {
      id: 'sppg-row-1',
      school: { name: 'SDN Nusantara 01' },
      portions: 420,
      pricePerPortion: 15000,
      status: 'delivered',
      distributionDate: new Date().toISOString(),
      validation: { status: 'verified' },
    },
    {
      id: 'sppg-row-2',
      school: { name: 'SMP Negeri 5' },
      portions: 350,
      pricePerPortion: 15000,
      status: 'delivered',
      distributionDate: new Date().toISOString(),
      validation: { status: 'pending' },
    },
    {
      id: 'sppg-row-3',
      school: { name: 'SDN Merdeka 03' },
      portions: 280,
      pricePerPortion: 15000,
      status: 'in_progress',
      distributionDate: new Date().toISOString(),
      validation: { status: 'pending' },
    },
    {
      id: 'sppg-row-4',
      school: { name: 'MI Al Amanah' },
      portions: 200,
      pricePerPortion: 15000,
      status: 'failed',
      distributionDate: new Date().toISOString(),
      validation: { status: 'pending' },
    },
  ],
  portionsTrend: [
    { label: 'Sen', portions: 1100 },
    { label: 'Sel', portions: 1250 },
    { label: 'Rab', portions: 980 },
    { label: 'Kam', portions: 1300 },
    { label: 'Jum', portions: 1200 },
    { label: 'Sab', portions: 800 },
    { label: 'Min', portions: 0 },
  ],
}

const SCHOOL_FALLBACK = {
  // TODO: Ganti fallback ini dengan endpoint agregasi sekolah khusus saat backend menyediakan summary per sekolah.
  distributionsToday: [
    {
      id: 'school-distribution-1',
      sppg: { name: 'SPPG Kecamatan Cempaka' },
      portions: 450,
      distributionDate: new Date().toISOString(),
      status: 'delivered',
      validation: { status: 'pending', receivedPortions: 0 },
    },
  ],
  pendingValidations: [
    {
      id: 'validation-1',
      distribution: {
        sppg: { name: 'SPPG Kecamatan Cempaka' },
        portions: 450,
        distributionDate: new Date().toISOString(),
      },
      status: 'pending',
      receivedPortions: 0,
    },
  ],
  schoolReportsMeta: {
    total: 2,
  },
  acceptanceTrend: [
    { label: 'H-6', received: 430 },
    { label: 'H-5', received: 445 },
    { label: 'H-4', received: 450 },
    { label: 'H-3', received: 448 },
    { label: 'H-2', received: 452 },
    { label: 'H-1', received: 450 },
    { label: 'Hari ini', received: 450 },
  ],
}

function getDefaultDateRange() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 6)

  return {
    dateFrom: toInputDate(start),
    dateTo: toInputDate(today),
  }
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10)
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(safeNumber(value))
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(safeNumber(value))}%`
}

function formatCurrency(value) {
  const numericValue = safeNumber(value)
  if (numericValue >= 1000000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(numericValue / 1000000000)}M`
  }

  if (numericValue >= 1000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(numericValue / 1000000)}Jt`
  }

  return `Rp ${new Intl.NumberFormat('id-ID').format(numericValue)}`
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

function formatTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatChartDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function getStorageItem(key) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
}

function getStoredUser() {
  const rawUser = getStorageItem('mbg.user') || getStorageItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

function normalizeRole(role) {
  return ROLE_LABELS[role] ? role : 'pemerintah'
}

async function settleRequests(requestMap) {
  const entries = Object.entries(requestMap)
  const results = await Promise.allSettled(entries.map(([, request]) => request))

  return entries.reduce((accumulator, [key], index) => {
    const result = results[index]
    accumulator[key] =
      result.status === 'fulfilled'
        ? { ok: true, value: result.value }
        : { ok: false, reason: result.reason?.message || 'Request gagal.' }
    return accumulator
  }, {})
}

function getAnalyticsParams(filters) {
  return {
    province: filters.province,
    city: filters.city,
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
  }
}

function getLabelByDate(dateValue, fallbackLabel) {
  return dateValue ? formatChartDate(dateValue) : fallbackLabel
}

function buildDistributionTrend(distributionRows = [], successRows = []) {
  if (!Array.isArray(distributionRows) || distributionRows.length === 0) {
    return NATIONAL_FALLBACK.distributionTrend
  }

  const successByBucket = new Map(
    successRows.map((row) => [String(row.bucket || row.date || row.label), row]),
  )

  return distributionRows.slice(-7).map((row, index) => {
    const bucket = String(row.bucket || row.date || row.label || index)
    const successRow = successByBucket.get(bucket) || {}
    const total = safeNumber(row.total_distributions)
    const verified = safeNumber(successRow.verified_count, safeNumber(row.delivered_count))
    const conflict = safeNumber(successRow.conflict_count, safeNumber(row.failed_count))

    return {
      label: getLabelByDate(row.bucket, row.label || `H-${6 - index}`),
      verified,
      conflict,
      pending: Math.max(total - verified - conflict, 0),
    }
  })
}

function buildSuccessTrend(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return NATIONAL_FALLBACK.successRateTrend

  return rows.slice(-30).map((row, index) => ({
    label: getLabelByDate(row.bucket, row.label || `H-${29 - index}`),
    successRate: safeNumber(row.success_rate ?? row.successRate),
  }))
}

function buildProvinceRanking(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return NATIONAL_FALLBACK.provinceRanking

  return rows.slice(0, 10).map((row) => ({
    province: row.province || '-',
    totalDistributions: safeNumber(row.total_distributions ?? row.totalDistributions),
  }))
}

function getDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return toInputDate(date)
}

function buildLastDaysSeries(days, mapper) {
  const today = new Date()

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))
    const key = toInputDate(date)

    return {
      key,
      label: index === days - 1 ? 'Hari ini' : formatChartDate(key),
      ...mapper(key),
    }
  })
}

function buildPortionsTrend(distributions = []) {
  if (!Array.isArray(distributions) || distributions.length === 0) return SPPG_FALLBACK.portionsTrend

  const portionsByDate = distributions.reduce((accumulator, item) => {
    const dateKey = getDateKey(item.distributionDate)
    if (!dateKey) return accumulator

    accumulator[dateKey] = (accumulator[dateKey] || 0) + safeNumber(item.portions)
    return accumulator
  }, {})

  return buildLastDaysSeries(7, (key) => ({ portions: portionsByDate[key] || 0 }))
}

function buildSchoolAcceptanceTrend(validations = []) {
  if (!Array.isArray(validations) || validations.length === 0) return SCHOOL_FALLBACK.acceptanceTrend

  const receivedByDate = validations.reduce((accumulator, item) => {
    const dateKey = getDateKey(item.validatedAt || item.distribution?.distributionDate || item.createdAt)
    if (!dateKey) return accumulator

    accumulator[dateKey] = (accumulator[dateKey] || 0) + safeNumber(item.receivedPortions)
    return accumulator
  }, {})

  return buildLastDaysSeries(30, (key) => ({ received: receivedByDate[key] || 0 }))
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '-'
}

function getAnomalyLabel(type) {
  return ANOMALY_LABELS[type] || type || '-'
}

function getAnomalyClass(type) {
  if (type === 'OVER_CAPACITY') return 'dashboard-badge-over-capacity'
  if (type === 'PRICE_ANOMALY') return 'dashboard-badge-price'
  if (type === 'VALIDATION_CONFLICT') return 'dashboard-badge-validation'
  if (type === 'PENDING_TIMEOUT') return 'dashboard-badge-timeout'
  return ''
}

function makeInitialData(role) {
  if (role === 'sppg') {
    return {
      distributionsToday: SPPG_FALLBACK.distributionsToday,
      distributionsRecent: SPPG_FALLBACK.distributionsToday,
      portionsTrend: SPPG_FALLBACK.portionsTrend,
      usingFallback: true,
    }
  }

  if (role === 'sekolah') {
    return {
      distributionsToday: SCHOOL_FALLBACK.distributionsToday,
      pendingValidations: SCHOOL_FALLBACK.pendingValidations,
      validationsRecent: SCHOOL_FALLBACK.pendingValidations,
      schoolReportsMeta: SCHOOL_FALLBACK.schoolReportsMeta,
      acceptanceTrend: SCHOOL_FALLBACK.acceptanceTrend,
      usingFallback: true,
    }
  }

  return {
    ...NATIONAL_FALLBACK,
    usingFallback: true,
  }
}

function buildNationalData(results) {
  const summary = results.summary?.ok ? results.summary.value.data : NATIONAL_FALLBACK.summary
  const distributionRows = results.distributionTrend?.ok ? results.distributionTrend.value.data : []
  const successPayload = results.successRate?.ok ? results.successRate.value.data : {}
  const successRows = Array.isArray(successPayload.timeSeries) ? successPayload.timeSeries : []
  const budget = results.budget?.ok ? results.budget.value.data : NATIONAL_FALLBACK.budget
  const provinceRows = results.byProvince?.ok ? results.byProvince.value.data : []
  const anomalyPayload = results.anomaly?.ok ? results.anomaly.value.data : {}

  return {
    summary,
    budget,
    publicReports: results.publicReports?.ok ? results.publicReports.value.data : [],
    publicReportsMeta: results.publicReports?.ok ? results.publicReports.value.meta : NATIONAL_FALLBACK.publicReportsMeta,
    distributionTrend: buildDistributionTrend(distributionRows, successRows),
    successRateTrend: buildSuccessTrend(successRows),
    provinceRanking: buildProvinceRanking(provinceRows),
    anomalyItems:
      Array.isArray(anomalyPayload.items) && anomalyPayload.items.length
        ? anomalyPayload.items
        : NATIONAL_FALLBACK.anomalyItems,
    anomalyMeta: results.anomaly?.ok ? results.anomaly.value.meta : NATIONAL_FALLBACK.anomalyMeta,
    usingFallback: Object.values(results).some((result) => !result.ok),
  }
}

function buildSppgData(results) {
  const distributionsToday =
    results.distributionsToday?.ok && Array.isArray(results.distributionsToday.value.data)
      ? results.distributionsToday.value.data
      : SPPG_FALLBACK.distributionsToday
  const distributionsRecent =
    results.distributionsRecent?.ok && Array.isArray(results.distributionsRecent.value.data)
      ? results.distributionsRecent.value.data
      : distributionsToday

  return {
    distributionsToday,
    distributionsRecent,
    portionsTrend: buildPortionsTrend(distributionsRecent),
    usingFallback: Object.values(results).some((result) => !result.ok),
  }
}

function buildSchoolData(results) {
  const distributionsToday =
    results.distributionsToday?.ok && Array.isArray(results.distributionsToday.value.data)
      ? results.distributionsToday.value.data
      : SCHOOL_FALLBACK.distributionsToday
  const pendingValidations =
    results.pendingValidations?.ok && Array.isArray(results.pendingValidations.value.data)
      ? results.pendingValidations.value.data
      : SCHOOL_FALLBACK.pendingValidations
  const validationsRecent =
    results.validationsRecent?.ok && Array.isArray(results.validationsRecent.value.data)
      ? results.validationsRecent.value.data
      : pendingValidations

  return {
    distributionsToday,
    pendingValidations,
    validationsRecent,
    schoolReports: results.schoolReports?.ok ? results.schoolReports.value.data : [],
    schoolReportsMeta: results.schoolReports?.ok ? results.schoolReports.value.meta : SCHOOL_FALLBACK.schoolReportsMeta,
    acceptanceTrend: buildSchoolAcceptanceTrend(validationsRecent),
    usingFallback: Object.values(results).some((result) => !result.ok),
  }
}

function getRoleTitle(role) {
  if (role === 'sppg') return 'Dashboard Operasional SPPG'
  if (role === 'sekolah') return 'Dashboard Validasi Sekolah'
  if (role === 'admin') return 'Dashboard Nasional dan Sistem'
  return 'Dashboard Nasional Pemerintah'
}

function getRoleSubtitle(role) {
  if (role === 'sppg') return 'Pantau produksi porsi, pengiriman hari ini, dan validasi dari sekolah.'
  if (role === 'sekolah') return 'Konfirmasi penerimaan, kualitas makanan, dan laporan distribusi sekolah.'
  if (role === 'admin') return 'Ringkasan nasional, anomali aktif, anggaran, dan indikator kesehatan sistem.'
  return 'Monitor capaian distribusi nasional, tren wilayah, laporan publik, dan anomali.'
}

function getNationalKpis(data) {
  const anomalyTotal = data.anomalyMeta?.total ?? data.summary?.problematicSppg ?? NATIONAL_FALLBACK.anomalyMeta.total
  const publicReportTotal =
    data.publicReportsMeta?.total ?? data.publicReports?.length ?? NATIONAL_FALLBACK.publicReportsMeta.total

  return [
    {
      title: 'Total SPPG Aktif',
      value: formatNumber(data.summary?.totalActiveSppg),
      change: 'Naik +12 kemarin',
      color: '#0071e4',
      icon: Building2,
    },
    {
      title: 'Distribusi Nasional Hari Ini',
      value: formatNumber(data.summary?.distributionsToday),
      change: 'Naik +5.2%',
      color: '#057a55',
      icon: Truck,
    },
    {
      title: 'Success Rate',
      value: formatPercent(data.summary?.successRate),
      change: 'Naik +0.3%',
      color: '#057a55',
      icon: CheckCircle2,
    },
    {
      title: 'Anomali Terdeteksi',
      value: formatNumber(anomalyTotal),
      change: 'Turun -2',
      color: '#9b1c1c',
      icon: Zap,
      pulse: safeNumber(anomalyTotal) > 0,
    },
    {
      title: 'Total Anggaran Digunakan',
      value: formatCurrency(data.budget?.summary?.total_budget ?? data.budget?.summary?.totalBudget),
      change: 'Akumulasi periode filter',
      color: '#0f4c81',
      icon: Wallet,
    },
    {
      title: 'Laporan Masyarakat Masuk',
      value: formatNumber(publicReportTotal),
      change: 'Perlu tindak lanjut',
      color: '#92400e',
      icon: FileText,
    },
  ]
}

function getSppgKpis(data) {
  const rows = data.distributionsToday || []
  const totalPortions = rows.reduce((total, item) => total + safeNumber(item.portions), 0)
  const deliveredCount = rows.filter((item) => item.status === 'delivered').length
  const pendingCount = rows.filter((item) => item.validation?.status === 'pending').length
  const failedCount = rows.filter((item) => item.status === 'failed').length

  return [
    {
      title: 'Total Porsi Diproduksi Hari Ini',
      value: formatNumber(totalPortions || 1250),
      change: 'Produksi aktif',
      color: '#0071e4',
      icon: UtensilsCrossed,
    },
    {
      title: 'Distribusi Dikirim',
      value: formatNumber(deliveredCount || 8),
      change: 'Status delivered',
      color: '#057a55',
      icon: Truck,
    },
    {
      title: 'Menunggu Validasi',
      value: formatNumber(pendingCount || 3),
      change: 'Butuh konfirmasi sekolah',
      color: '#92400e',
      icon: Clock3,
      pulse: safeNumber(pendingCount || 3) > 0,
    },
    {
      title: 'Distribusi Gagal',
      value: formatNumber(failedCount || 1),
      change: 'Perlu ditindaklanjuti',
      color: '#9b1c1c',
      icon: AlertTriangle,
    },
  ]
}

function getSchoolKpis(data) {
  const todayRows = data.distributionsToday || []
  const pendingRows = data.pendingValidations || []
  const receivedToday = todayRows.reduce((total, item) => {
    return total + safeNumber(item.validation?.receivedPortions ?? item.receivedPortions ?? item.portions)
  }, 0)
  const reportTotal = data.schoolReportsMeta?.total ?? data.schoolReports?.length ?? 2

  return [
    {
      title: 'Distribusi Hari Ini',
      value: formatNumber(todayRows.length || 1),
      change: 'Masuk hari ini',
      color: '#0071e4',
      icon: Package,
    },
    {
      title: 'Menunggu Konfirmasi',
      value: formatNumber(pendingRows.length || 1),
      change: 'Butuh validasi',
      color: '#92400e',
      icon: ClipboardCheck,
      pulse: safeNumber(pendingRows.length || 1) > 0,
    },
    {
      title: 'Total Siswa Menerima Hari Ini',
      value: formatNumber(receivedToday || 450),
      change: 'Porsi diterima',
      color: '#057a55',
      icon: School,
    },
    {
      title: 'Laporan Terkirim Bulan Ini',
      value: formatNumber(reportTotal),
      change: 'Rekap sekolah',
      color: '#6b7280',
      icon: FileText,
    },
  ]
}

function getAlerts(role, data) {
  if (role === 'sppg') {
    const pending = (data.distributionsToday || []).filter((item) => item.validation?.status === 'pending').length || 3
    return [
      {
        type: 'warning',
        title: 'Validasi tertunda',
        message: `${pending} distribusi menunggu konfirmasi sekolah lebih dari 12 jam`,
      },
    ]
  }

  if (role === 'sekolah') {
    const pending = (data.pendingValidations || []).length || 1
    return [
      {
        type: 'info',
        title: 'Konfirmasi diperlukan',
        message: `${pending} distribusi baru menunggu konfirmasi Anda`,
      },
    ]
  }

  const anomalyTotal = data.anomalyMeta?.total ?? data.summary?.problematicSppg ?? 7
  return [
    {
      type: 'danger',
      title: 'Anomali aktif',
      message: `${anomalyTotal} anomali belum resolved, 2 high priority`,
    },
  ]
}

function KpiCard({ item, index }) {
  const Icon = item.icon

  return (
    <article
      className={`dashboard-kpi-card dashboard-fade-card ${item.pulse ? 'dashboard-kpi-pulse' : ''}`}
      style={{ '--kpi-color': item.color, '--fade-delay': `${index * 100}ms` }}
    >
      <div className="dashboard-kpi-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="dashboard-kpi-content">
        <p className="dashboard-kpi-title">{item.title}</p>
        <strong>{item.value}</strong>
        <span>{item.change}</span>
      </div>
    </article>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="dashboard-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey} style={{ '--tooltip-color': item.color }}>
          {item.name}: {formatNumber(item.value)}
        </span>
      ))}
    </div>
  )
}

function ChartCard({ title, children, className = '' }) {
  return (
    <article className={`dashboard-chart-card dashboard-fade-card ${className}`}>
      <h3 className="dashboard-chart-title">{title}</h3>
      <div className="dashboard-chart-body">{children}</div>
    </article>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`dashboard-status-badge dashboard-status-${status || 'pending'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

function AnomalyBadge({ type }) {
  return <span className={`dashboard-badge-anomaly ${getAnomalyClass(type)}`}>{getAnomalyLabel(type)}</span>
}

function DataTable({ columns, rows, emptyText }) {
  return (
    <div className="dashboard-table-scroll">
      <table className="dashboard-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="dashboard-table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function AlertStack({ alerts }) {
  return (
    <div className="dashboard-alert-stack">
      {alerts.map((alert) => (
        <div key={`${alert.type}-${alert.title}`} className={`dashboard-alert dashboard-alert-${alert.type}`}>
          <AlertCircle aria-hidden="true" />
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterBar({
  selectedProvince,
  selectedCity,
  dateFrom,
  dateTo,
  onProvinceChange,
  onCityChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}) {
  return (
    <div className="dashboard-filter-bar">
      <label className="dashboard-filter-field">
        <span>Provinsi</span>
        <select value={selectedProvince} onChange={(event) => onProvinceChange(event.target.value)}>
          <option value="">Semua provinsi</option>
          {PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </label>

      <label className="dashboard-filter-field">
        <span>Kota</span>
        {/* TODO: Integrasikan opsi kota per provinsi jika endpoint wilayah backend sudah tersedia. */}
        <select value={selectedCity} onChange={(event) => onCityChange(event.target.value)} disabled={!selectedProvince}>
          <option value="">
            {selectedProvince ? 'Semua kota' : 'Pilih provinsi dulu'}
          </option>
        </select>
      </label>

      <label className="dashboard-filter-field">
        <span>Dari tanggal</span>
        <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
      </label>

      <label className="dashboard-filter-field">
        <span>Sampai tanggal</span>
        <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
      </label>

      <div className="dashboard-filter-actions">
        <button className="dashboard-reset-btn" type="button" onClick={onReset}>
          <RefreshCcw aria-hidden="true" />
          Reset Filter
        </button>
      </div>
    </div>
  )
}

function renderSppgCharts(data) {
  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Porsi Diproduksi 7 Hari Terakhir" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.portionsTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="portions" name="Porsi" fill="#0071e4" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderSchoolCharts(data) {
  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Tren Penerimaan 30 Hari" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.acceptanceTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="received" name="Porsi diterima" stroke="#0071e4" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderNationalCharts(data) {
  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Distribusi Harian 7 Hari" className="dashboard-chart-main">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.distributionTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="verified" name="Verified" stackId="distribution" fill="#057a55" radius={[5, 5, 0, 0]} />
            <Bar dataKey="conflict" name="Conflict" stackId="distribution" fill="#9b1c1c" />
            <Bar dataKey="pending" name="Pending" stackId="distribution" fill="#92400e" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tren Success Rate 30 Hari" className="dashboard-chart-side">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.successRateTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="successRate"
              name="Success Rate"
              stroke="#0071e4"
              fill="#b5e0ea"
              fillOpacity={0.3}
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="TOP 10 Provinsi by Distribusi" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.provinceRanking} layout="vertical" margin={{ left: 20, right: 24 }}>
            <CartesianGrid stroke="#f4f8fb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="province"
              width={128}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="totalDistributions" name="Distribusi" fill="#0f4c81" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderSppgTable(data) {
  const rows = (data.distributionsToday || []).slice(0, 5)
  const columns = [
    {
      key: 'school',
      label: 'Sekolah',
      render: (row) => row.school?.name || '-',
    },
    {
      key: 'portions',
      label: 'Porsi',
      render: (row) => formatNumber(row.portions),
    },
    {
      key: 'pricePerPortion',
      label: 'Harga/Porsi',
      render: (row) => formatCurrency(row.pricePerPortion),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'time',
      label: 'Jam',
      render: (row) => formatTime(row.distributionDate || row.createdAt),
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <Link className="dashboard-action-btn" to={`/dashboard/distribusi/status?id=${row.id}`}>
          Update Status
        </Link>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Belum ada distribusi aktif hari ini." />
}

function renderSchoolTable(data) {
  const rows = (data.pendingValidations || []).slice(0, 5)
  const columns = [
    {
      key: 'sppg',
      label: 'SPPG Pengirim',
      render: (row) => row.distribution?.sppg?.name || row.school?.sppg?.name || '-',
    },
    {
      key: 'portions',
      label: 'Porsi',
      render: (row) => formatNumber(row.distribution?.portions || row.receivedPortions),
    },
    {
      key: 'date',
      label: 'Tanggal',
      render: (row) => formatDate(row.distribution?.distributionDate || row.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <div className="dashboard-table-actions">
          <Link className="dashboard-action-btn" to={`/dashboard/konfirmasi-distribusi?id=${row.id}`}>
            Konfirmasi
          </Link>
          <Link className="dashboard-action-btn dashboard-action-secondary" to="/dashboard/laporan-sekolah">
            Laporkan
          </Link>
        </div>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Tidak ada konfirmasi pending." />
}

function renderNationalTable(data) {
  const rows = (data.anomalyItems || []).slice(0, 5)
  const columns = [
    {
      key: 'sppg',
      label: 'SPPG',
      render: (row) => row.sppg_name || row.distribution?.sppg?.name || '-',
    },
    {
      key: 'school',
      label: 'Sekolah',
      render: (row) => row.school_name || row.distribution?.school?.name || '-',
    },
    {
      key: 'anomalyType',
      label: 'Tipe Anomali',
      render: (row) => <AnomalyBadge type={row.anomaly_type || row.anomalyType} />,
    },
    {
      key: 'date',
      label: 'Tanggal',
      render: (row) => formatDate(row.created_at || row.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.isResolved ? 'resolved' : row.distribution_status || 'open'} />,
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <Link className="dashboard-action-btn" to={`/dashboard/anomaly?id=${row.id}`}>
          Detail
        </Link>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Tidak ada anomali aktif." />
}

function Dashboard({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const normalizedRole = normalizeRole(userRole || storedUser?.role)
  const displayName = userName || storedUser?.name || storedUser?.email || 'Pengguna MBG'
  const defaultRange = useMemo(() => getDefaultDateRange(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboardData, setDashboardData] = useState(() => makeInitialData(normalizedRole))
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom)
  const [dateTo, setDateTo] = useState(defaultRange.dateTo)
  const [filters, setFilters] = useState({
    province: '',
    city: '',
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
  })

  const isNationalRole = normalizedRole === 'pemerintah' || normalizedRole === 'admin'

  const handleProvinceChange = (province) => {
    setSelectedProvince(province)
    setSelectedCity('')
    setFilters((current) => ({ ...current, province, city: '' }))
  }

  const handleCityChange = (city) => {
    setSelectedCity(city)
    setFilters((current) => ({ ...current, city }))
  }

  const handleDateFromChange = (value) => {
    setDateFrom(value)
    setFilters((current) => ({ ...current, dateFrom: value }))
  }

  const handleDateToChange = (value) => {
    setDateTo(value)
    setFilters((current) => ({ ...current, dateTo: value }))
  }

  const handleResetFilter = () => {
    setSelectedProvince('')
    setSelectedCity('')
    setDateFrom(defaultRange.dateFrom)
    setDateTo(defaultRange.dateTo)
    setFilters({
      province: '',
      city: '',
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
    })
  }

  const fetchDashboard = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        if (isNationalRole) {
          const analyticsParams = getAnalyticsParams(filters)
          const results = await settleRequests({
            summary: requestApi('/analytics/summary', { params: analyticsParams, signal }),
            distributionTrend: requestApi('/analytics/distributions', {
              params: { ...analyticsParams, granularity: 'daily' },
              signal,
            }),
            successRate: requestApi('/analytics/success-rate', {
              params: { ...analyticsParams, granularity: 'daily' },
              signal,
            }),
            budget: requestApi('/analytics/budget', { params: analyticsParams, signal }),
            byProvince: requestApi('/analytics/by-province', {
              params: { ...analyticsParams, limit: 10 },
              signal,
            }),
            anomaly: requestApi('/analytics/anomaly', {
              params: { ...analyticsParams, page: 1, limit: 5 },
              signal,
            }),
            publicReports: requestApi('/public-reports', {
              params: {
                province: filters.province,
                city: filters.city,
                page: 1,
                limit: 5,
              },
              signal,
            }),
          })

          setDashboardData(buildNationalData(results))
          if (Object.values(results).some((result) => !result.ok)) {
            setError('Sebagian data nasional gagal dimuat dari API. Fallback preview ditampilkan untuk bagian yang belum tersedia.')
          }
          return
        }

        if (normalizedRole === 'sppg') {
          const results = await settleRequests({
            distributionsToday: requestApi('/distributions', {
              params: { date: toInputDate(new Date()), limit: 50 },
              signal,
            }),
            distributionsRecent: requestApi('/distributions', {
              params: { limit: 80 },
              signal,
            }),
          })

          setDashboardData(buildSppgData(results))
          if (Object.values(results).some((result) => !result.ok)) {
            setError('Data operasional SPPG belum lengkap dari API. Fallback preview ditampilkan sementara.')
          }
          return
        }

        const results = await settleRequests({
          distributionsToday: requestApi('/distributions', {
            params: { date: toInputDate(new Date()), limit: 30 },
            signal,
          }),
          pendingValidations: requestApi('/validations', {
            params: { status: 'pending', limit: 20 },
            signal,
          }),
          validationsRecent: requestApi('/validations', {
            params: { limit: 80 },
            signal,
          }),
          schoolReports: requestApi('/school-reports', {
            params: { limit: 20 },
            signal,
          }),
        })

        setDashboardData(buildSchoolData(results))
        if (Object.values(results).some((result) => !result.ok)) {
          setError('Data validasi sekolah belum lengkap dari API. Fallback preview ditampilkan sementara.')
        }
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setDashboardData(makeInitialData(normalizedRole))
          setError(fetchError.message || 'Dashboard gagal memuat data dari backend.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [filters, isNationalRole, normalizedRole],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchDashboard(controller.signal))

    return () => controller.abort()
  }, [fetchDashboard])

  const kpis = useMemo(() => {
    if (normalizedRole === 'sppg') return getSppgKpis(dashboardData)
    if (normalizedRole === 'sekolah') return getSchoolKpis(dashboardData)
    return getNationalKpis(dashboardData)
  }, [dashboardData, normalizedRole])

  const alerts = useMemo(() => getAlerts(normalizedRole, dashboardData), [dashboardData, normalizedRole])

  const notifCount = useMemo(() => {
    if (normalizedRole === 'sppg') {
      return (dashboardData.distributionsToday || []).filter((item) => item.validation?.status === 'pending').length || 3
    }

    if (normalizedRole === 'sekolah') {
      return (dashboardData.pendingValidations || []).length || 1
    }

    return dashboardData.anomalyMeta?.total || dashboardData.summary?.problematicSppg || 0
  }, [dashboardData, normalizedRole])

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }

    window.localStorage.removeItem('mbg.accessToken')
    window.localStorage.removeItem('mbg.user')
    window.sessionStorage.removeItem('mbg.accessToken')
    window.sessionStorage.removeItem('mbg.user')
    navigate('/login')
  }

  return (
    <DashboardLayout
      userRole={normalizedRole}
      userName={displayName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={notifCount}
    >
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-subtitle">{ROLE_LABELS[normalizedRole]} - MBG Transparency System</p>
            <h1 className="dashboard-title">{getRoleTitle(normalizedRole)}</h1>
            <p className="dashboard-header-desc">{getRoleSubtitle(normalizedRole)}</p>
          </div>
          <div className="dashboard-header-meta">
            <Database aria-hidden="true" />
            <span>{dashboardData.usingFallback ? 'API parsial + fallback' : 'Data backend aktif'}</span>
          </div>
        </header>

        {isNationalRole ? (
          <FilterBar
            selectedProvince={selectedProvince}
            selectedCity={selectedCity}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onProvinceChange={handleProvinceChange}
            onCityChange={handleCityChange}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onReset={handleResetFilter}
          />
        ) : null}

        {loading ? (
          <div className="dashboard-loading">
            <Loader2 aria-hidden="true" />
            <span>Memuat data dashboard dari backend...</span>
          </div>
        ) : null}

        {error ? (
          <div className="dashboard-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Ringkasan KPI</h2>
          </div>
          <div className={`dashboard-kpi-grid ${isNationalRole ? 'dashboard-kpi-grid-6' : 'dashboard-kpi-grid-4'}`}>
            {kpis.map((item, index) => (
              <KpiCard key={item.title} item={item} index={index} />
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Analitik</h2>
          </div>
          {normalizedRole === 'sppg' ? renderSppgCharts(dashboardData) : null}
          {normalizedRole === 'sekolah' ? renderSchoolCharts(dashboardData) : null}
          {isNationalRole ? renderNationalCharts(dashboardData) : null}
        </section>

        {normalizedRole === 'sekolah' ? (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2 className="dashboard-section-title">Distribusi 30 Hari Terakhir</h2>
            </div>
            <div className="dashboard-table-card dashboard-fade-card">
              <DataTable
                columns={[
                  {
                    key: 'sppg',
                    label: 'SPPG',
                    render: (row) => row.distribution?.sppg?.name || row.school?.sppg?.name || '-',
                  },
                  {
                    key: 'received',
                    label: 'Porsi Diterima',
                    render: (row) => formatNumber(row.receivedPortions),
                  },
                  {
                    key: 'date',
                    label: 'Tanggal',
                    render: (row) => formatDate(row.distribution?.distributionDate || row.createdAt),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
                rows={(dashboardData.validationsRecent || SCHOOL_FALLBACK.pendingValidations).slice(0, 5)}
                emptyText="Riwayat validasi belum tersedia."
              />
            </div>
          </section>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              {normalizedRole === 'sppg'
                ? 'Distribusi Aktif Hari Ini'
                : normalizedRole === 'sekolah'
                  ? 'Konfirmasi Pending'
                  : 'Anomali Aktif'}
            </h2>
          </div>
          <div className="dashboard-table-card dashboard-fade-card">
            {normalizedRole === 'sppg' ? renderSppgTable(dashboardData) : null}
            {normalizedRole === 'sekolah' ? renderSchoolTable(dashboardData) : null}
            {isNationalRole ? renderNationalTable(dashboardData) : null}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Alert Operasional</h2>
          </div>
          <AlertStack alerts={alerts} />
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
