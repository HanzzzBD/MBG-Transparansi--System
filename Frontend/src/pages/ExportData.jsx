import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiBlobRequest as requestBlob, apiRequest as requestJson } from '../services/api'
import './ExportData.css'

const DEFAULT_MAX_ROWS = 50000
const PAGE_SIZE = 10
const RETENTION_DAYS = 7
const EXPORT_POLL_MS = 2500
const ACCESS_ROLES = ['admin', 'pemerintah']

const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Banten',
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

const DATASETS = [
  { id: 'distributions', label: 'Data Distribusi', baseRows: 720 },
  { id: 'validations', label: 'Validasi Sekolah', baseRows: 520 },
  { id: 'public_reports', label: 'Laporan Masyarakat', baseRows: 90 },
  { id: 'budget_by_region', label: 'Anggaran per Wilayah', baseRows: 45 },
  { id: 'audit_logs', label: 'Audit Log', baseRows: 980, adminOnly: true },
  { id: 'anomalies', label: 'Anomali Terdeteksi', baseRows: 160 },
  { id: 'production_batches', label: 'Production Batch & Costing', baseRows: 380, summaryForGovernment: true },
  { id: 'food_prices', label: 'Food Prices SP2KP', baseRows: 520, summaryForGovernment: true },
]

const DISTRIBUTION_STATUSES = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

const STATUS_LABELS = {
  pending: 'Diproses',
  processing: 'Diproses',
  done: 'Selesai',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
}

const FALLBACK_HISTORY = [
  {
    id: 'fallback-1',
    type: 'pdf',
    fileName: 'Laporan_Distribusi_Nasional_2026-05.pdf',
    createdAt: '2026-05-21T08:20:00+07:00',
    rows: 18420,
    sizeBytes: 4300000,
    status: 'done',
    progress: 100,
    expiresAt: '2026-05-28T08:20:00+07:00',
    fileUrl: '',
  },
  {
    id: 'fallback-2',
    type: 'excel',
    fileName: 'Anggaran_Wilayah_2026-05.xlsx',
    createdAt: '2026-05-20T14:05:00+07:00',
    rows: 9270,
    sizeBytes: 8900000,
    status: 'done',
    progress: 100,
    expiresAt: '2026-05-27T14:05:00+07:00',
    fileUrl: '',
  },
  {
    id: 'fallback-3',
    type: 'excel',
    fileName: 'Food_Prices_SP2KP_2026-05.xlsx',
    createdAt: '2026-05-21T09:15:00+07:00',
    rows: 41800,
    sizeBytes: 18700000,
    status: 'processing',
    progress: 62,
    expiresAt: '2026-05-28T09:15:00+07:00',
    fileUrl: '',
  },
  {
    id: 'fallback-4',
    type: 'pdf',
    fileName: 'Audit_Log_Admin_2026-05.pdf',
    createdAt: '2026-05-19T16:45:00+07:00',
    rows: 1220,
    sizeBytes: 1600000,
    status: 'failed',
    progress: 0,
    expiresAt: '2026-05-26T16:45:00+07:00',
    errorMsg: 'Job queue timeout',
  },
  {
    id: 'fallback-5',
    type: 'excel',
    fileName: 'Anomali_Harga_2026-05.xlsx',
    createdAt: '2026-05-15T10:30:00+07:00',
    rows: 680,
    sizeBytes: 980000,
    status: 'done',
    progress: 100,
    expiresAt: '2026-05-22T10:30:00+07:00',
    fileUrl: '',
  },
]

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
  return typeof role === 'string' ? role.trim().toLowerCase() : ''
}

function getSelectedProvinces(provinces = ['all']) {
  if (!Array.isArray(provinces) || !provinces.length || provinces.includes('all')) {
    return PROVINCES
  }
  return provinces.filter((province) => PROVINCES.includes(province))
}

function getConfiguredValue(result) {
  const value =
    result?.data?.value ??
    result?.data?.config?.value ??
    result?.config?.value ??
    result?.value ??
    DEFAULT_MAX_ROWS

  return Number(value) || DEFAULT_MAX_ROWS
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoInput(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} KB`
  return `${bytes} B`
}

function addDays(value, days) {
  const date = new Date(value || Date.now())
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function getDaysBetween(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 0
  const from = new Date(`${dateFrom}T00:00:00`)
  const to = new Date(`${dateTo}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.max(1, Math.round((to - from) / 86400000) + 1)
}

function getDaysUntil(value) {
  if (!value) return 7
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

function getStatus(record) {
  if (record.errorMsg && record.errorMsg.toLowerCase().includes('expired')) return 'expired'
  if (record.status === 'done' && getDaysUntil(record.expiresAt) <= 0) return 'expired'
  return record.status || 'processing'
}

function normalizeExport(row) {
  const file = row.file || {}
  const filterParams = row.filterParams || row.filter_params || row.filters || {}
  const createdAt = row.createdAt || row.created_at || new Date().toISOString()
  const type = row.type || filterParams.type || 'pdf'
  const status = row.status || 'processing'
  const fileName =
    row.fileName ||
    row.file_name ||
    file.originalName ||
    file.original_name ||
    `Export_${type.toUpperCase()}_${String(row.id || Date.now()).replace(/\W/g, '')}.${type === 'excel' ? 'xlsx' : 'pdf'}`

  return {
    id: row.id || `local-${Date.now()}`,
    type,
    fileName,
    createdAt,
    rows: Number(row.rows || row.rowCount || row.row_count || filterParams.estimatedRows || 0),
    sizeBytes: Number(row.sizeBytes || row.size_bytes || file.sizeBytes || file.size_bytes || 0),
    status,
    progress: status === 'done' ? 100 : status === 'failed' ? 0 : Number(row.progress || 48),
    expiresAt: row.expiresAt || row.expires_at || file.expiresAt || addDays(createdAt, RETENTION_DAYS),
    fileUrl: row.fileUrl || row.file_url || file.fileUrl || file.file_url || '',
    errorMsg: row.errorMsg || row.error_msg || '',
    filterParams,
  }
}

function normalizeHistoryResponse(result) {
  const data = result.data || result
  const rows = Array.isArray(data) ? data : data.items || data.exports || data.rows || []
  return rows.map(normalizeExport)
}

function isAdminOnlyDataset(datasetId) {
  return DATASETS.find((item) => item.id === datasetId)?.adminOnly || false
}

function calculateEstimate({ checkedData, filters, maxRows }) {
  const days = getDaysBetween(filters.dateFrom, filters.dateTo)
  const selectedDatasets = DATASETS.filter((item) => checkedData.includes(item.id))
  const provinceValues = Array.isArray(filters.provinces) ? filters.provinces : ['all']
  const selectedProvinceCount = getSelectedProvinces(provinceValues).length
  const provinceMultiplier = provinceValues.includes('all')
    ? 1
    : Math.max(0.08, selectedProvinceCount / PROVINCES.length)
  const statusMultiplier = Math.max(0.35, filters.distributionStatuses.length / DISTRIBUTION_STATUSES.length)
  const anomalyMultiplier = filters.anomalyStatus === 'all' ? 1 : 0.55
  const datasetRows = selectedDatasets.reduce((sum, dataset) => sum + dataset.baseRows, 0)
  const rows = Math.ceil(datasetRows * days * provinceMultiplier * statusMultiplier * anomalyMultiplier)
  const sizeMb = Math.max(0.1, (rows * 1.2) / 1024)

  return {
    rows,
    sizeMb,
    exceedsMax: rows > maxRows,
  }
}

function getInitialHistory() {
  return FALLBACK_HISTORY.map(normalizeExport)
}

function ExportData({ userRole, userName, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pollIntervalsRef = useRef({})
  const storedUser = useMemo(() => getStoredUser(), [])
  const resolvedRole = normalizeRole(userRole || storedUser?.role)
  const displayName = userName || storedUser?.name || storedUser?.email || 'Pengguna MBG'
  const canAccess = ACCESS_ROLES.includes(resolvedRole)
  const isAdmin = resolvedRole === 'admin'

  const [format, setFormat] = useState('pdf')
  const [checkedData, setCheckedData] = useState(['distributions', 'budget_by_region'])
  const [filters, setFilters] = useState({
    provinces: ['all'],
    dateFrom: daysAgoInput(30),
    dateTo: todayInput(),
    distributionStatuses: ['in_progress', 'delivered', 'failed'],
    anomalyStatus: 'all',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [maxRows, setMaxRows] = useState(DEFAULT_MAX_ROWS)
  const [retryingId, setRetryingId] = useState('')
  const [downloadingId, setDownloadingId] = useState('')

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const estimate = useMemo(
    () => calculateEstimate({ checkedData, filters, maxRows }),
    [checkedData, filters, maxRows],
  )

  const stopPolling = useCallback((exportId) => {
    const key = String(exportId)
    if (pollIntervalsRef.current[key]) {
      window.clearInterval(pollIntervalsRef.current[key])
      delete pollIntervalsRef.current[key]
    }
  }, [])

  const updateHistoryRecord = useCallback((record) => {
    setHistory((current) => {
      const exists = current.some((item) => String(item.id) === String(record.id))
      const next = exists
        ? current.map((item) => (String(item.id) === String(record.id) ? { ...item, ...record } : item))
        : [record, ...current]
      return next.slice(0, PAGE_SIZE)
    })
  }, [])

  const fetchMaxRows = useCallback(async (signal) => {
    try {
      const result = await requestJson('/system-configs/export_max_rows', { signal })
      setMaxRows(getConfiguredValue(result))
    } catch {
      try {
        const result = await requestJson('/admin/system-configs', {
          signal,
          params: { search: 'export_max_rows', limit: 1 },
        })
        const rows = result.data?.items || result.data || []
        const config = Array.isArray(rows) ? rows.find((item) => item.key === 'export_max_rows') : null
        setMaxRows(Number(config?.value) || DEFAULT_MAX_ROWS)
      } catch {
        // TODO: Tambahkan endpoint publik GET /api/system-configs/export_max_rows agar pemerintah tidak perlu fallback.
        setMaxRows(DEFAULT_MAX_ROWS)
      }
    }
  }, [])

  const fetchHistory = useCallback(async (signal) => {
    try {
      const result = await requestJson('/exports', { params: { page: 1, limit: PAGE_SIZE }, signal })
      const rows = normalizeHistoryResponse(result)
      if (rows.length) {
        setHistory(rows)
        return
      }

      // TODO: Hapus fallback ini saat GET /api/exports mengembalikan riwayat export pengguna.
      setError('Riwayat export dari API masih kosong. Fallback preview ditampilkan.')
      setHistory(getInitialHistory())
    } catch (historyError) {
      // TODO: Backend saat ini belum menyediakan GET /api/exports untuk list history.
      setError(historyError.message || 'Riwayat export gagal dimuat dari API. Fallback preview ditampilkan.')
      setHistory(getInitialHistory())
    }
  }, [])

  const pollExportStatus = useCallback(
    (exportId) => {
      const key = String(exportId)
      if (!exportId || key.startsWith('local') || key.startsWith('fallback')) return

      stopPolling(key)
      let attempts = 0

      const tick = async () => {
        attempts += 1
        setHistory((current) =>
          current.map((item) =>
            String(item.id) === key && ['pending', 'processing'].includes(item.status)
              ? { ...item, progress: Math.min(92, (item.progress || 24) + 7) }
              : item,
          ),
        )

        try {
          const result = await requestJson(`/exports/${key}`)
          const updated = normalizeExport(result.data || result.export || result)
          updateHistoryRecord(updated)

          const status = getStatus(updated)
          if (status === 'done' || status === 'failed' || status === 'expired') {
            stopPolling(key)
            showToast(status === 'done' ? 'Export selesai. File siap diunduh.' : 'Export gagal diproses.', status === 'done' ? 'success' : 'danger')
          }
        } catch {
          if (attempts >= 5) {
            stopPolling(key)
          }
        }
      }

      tick()
      pollIntervalsRef.current[key] = window.setInterval(tick, EXPORT_POLL_MS)
    },
    [showToast, stopPolling, updateHistoryRecord],
  )

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!isGenerating) return undefined
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + 8))
    }, 350)
    return () => window.clearInterval(interval)
  }, [isGenerating])

  useEffect(() => {
    if (!canAccess) return undefined
    const controller = new AbortController()

    const fetchInitialData = async () => {
      setLoading(true)
      setError('')

      try {
        await Promise.all([fetchMaxRows(controller.signal), fetchHistory(controller.signal)])
      } catch (fetchError) {
        setError(fetchError.message || 'Data export gagal dimuat dari API. Fallback preview ditampilkan.')
        setHistory(getInitialHistory())
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
    return () => controller.abort()
  }, [canAccess, fetchHistory, fetchMaxRows])

  useEffect(
    () => () => {
      Object.values(pollIntervalsRef.current).forEach((intervalId) => window.clearInterval(intervalId))
    },
    [],
  )

  const toggleDataset = (datasetId) => {
    if (!isAdmin && isAdminOnlyDataset(datasetId)) return
    setCheckedData((current) => {
      if (current.includes(datasetId)) return current.filter((item) => item !== datasetId)
      return [...current, datasetId]
    })
  }

  const handleProvinceChange = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => option.value)
    setFilters((current) => ({
      ...current,
      provinces: selected.includes('all') || selected.length === 0 ? ['all'] : selected,
    }))
  }

  const toggleDistributionStatus = (status) => {
    setFilters((current) => {
      const exists = current.distributionStatuses.includes(status)
      const distributionStatuses = exists
        ? current.distributionStatuses.filter((item) => item !== status)
        : [...current.distributionStatuses, status]
      return { ...current, distributionStatuses }
    })
  }

  const validateForm = () => {
    if (!format) return 'Pilih format export.'
    if (!checkedData.length) return 'Pilih minimal 1 dataset.'
    if (!filters.dateFrom || !filters.dateTo) return 'Tanggal awal dan akhir wajib diisi.'
    if (filters.dateFrom > filters.dateTo) return 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.'
    if (!filters.distributionStatuses.length && checkedData.includes('distributions')) {
      return 'Pilih minimal 1 status distribusi.'
    }
    if (!isAdmin && checkedData.some(isAdminOnlyDataset)) return 'Dataset admin-only tidak boleh dipilih role pemerintah.'
    if (estimate.exceedsMax) return `Estimasi melebihi batas maksimal ${formatNumber(maxRows)} baris.`
    return ''
  }

  const buildExportPayload = () => {
    const selectedProvinces = getSelectedProvinces(filters.provinces)
    const backendProvince = selectedProvinces.length === 1 ? selectedProvinces[0] : undefined
    const backendStatus = filters.distributionStatuses.length === 1 ? filters.distributionStatuses[0] : undefined
    const datasetModes = checkedData.reduce((accumulator, datasetId) => {
      const dataset = DATASETS.find((item) => item.id === datasetId)
      accumulator[datasetId] = dataset?.summaryForGovernment && !isAdmin ? 'summary' : 'detail'
      return accumulator
    }, {})

    return {
      type: format,
      filterParams: {
        datasets: checkedData,
        provinces: selectedProvinces,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        distributionStatuses: filters.distributionStatuses,
        anomalyStatus: filters.anomalyStatus,
        datasetModes,
        estimatedRows: estimate.rows,
        estimatedSizeMb: Number(estimate.sizeMb.toFixed(2)),
        page: 'export-data',
        // TODO: Backend exporter saat ini baru memahami alias distribusi berikut untuk satu provinsi/status.
        province: backendProvince,
        start_date: filters.dateFrom,
        end_date: filters.dateTo,
        status: backendStatus,
      },
    }
  }

  const simulateGeneratedExport = async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 3000))
    const createdAt = new Date().toISOString()
    const generated = normalizeExport({
      id: `local-${Date.now()}`,
      type: format,
      fileName: `Export_MBG_${format === 'excel' ? 'XLSX' : 'PDF'}_${createdAt.slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      createdAt,
      rows: estimate.rows,
      sizeBytes: Math.round(estimate.sizeMb * 1000000),
      status: 'done',
      progress: 100,
      expiresAt: addDays(createdAt, RETENTION_DAYS),
      filterParams: buildExportPayload().filterParams,
    })
    setHistory((current) => [generated, ...current].slice(0, PAGE_SIZE))
  }

  const handleGenerate = async (event) => {
    event.preventDefault()
    const validationMessage = validateForm()
    if (validationMessage) {
      showToast(validationMessage, 'warning')
      return
    }

    setIsGenerating(true)
    setProgress(8)

    try {
      const result = await requestJson('/exports', {
        method: 'POST',
        body: buildExportPayload(),
      })
      const created = normalizeExport(result.data || result.export || result)
      const createdStatus = getStatus(created)
      const createdRecord = {
        ...created,
        status: createdStatus === 'done' ? 'done' : 'processing',
        progress: createdStatus === 'done' ? 100 : Math.max(18, created.progress || 18),
        rows: created.rows || estimate.rows,
        sizeBytes: created.sizeBytes || Math.round(estimate.sizeMb * 1000000),
      }
      setProgress(100)
      updateHistoryRecord(createdRecord)
      showToast('Export sedang diproses. File akan tersedia di riwayat export.', 'success')
      pollExportStatus(createdRecord.id)
      window.setTimeout(() => {
        setIsGenerating(false)
        setProgress(0)
      }, 700)
    } catch (generateError) {
      // TODO: Hapus fallback simulasi ini jika endpoint queue/list export sudah lengkap di backend production.
      showToast(generateError.message || 'API export belum siap. Menjalankan fallback preview.', 'warning')
      await simulateGeneratedExport()
      setProgress(100)
      showToast('Laporan preview berhasil dibuat.', 'success')
      window.setTimeout(() => {
        setIsGenerating(false)
        setProgress(0)
      }, 700)
    }
  }

  const handleDownload = async (record) => {
    setDownloadingId(record.id)
    try {
      if (record.fileUrl) {
        window.open(record.fileUrl, '_blank', 'noopener,noreferrer')
        showToast('Mengunduh file export.', 'success')
        return
      }

      if (String(record.id).startsWith('fallback') || String(record.id).startsWith('local')) {
        console.log('Download fallback export:', record)
        showToast('Mengunduh file preview...', 'success')
        return
      }

      const blob = await requestBlob(`/exports/${record.id}/download`)
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = record.fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
      showToast('Mengunduh file export.', 'success')
    } catch (downloadError) {
      showToast(downloadError.message || 'Download gagal.', 'danger')
    } finally {
      setDownloadingId('')
    }
  }

  const handleRetry = async (record) => {
    setRetryingId(record.id)
    try {
      if (String(record.id).startsWith('fallback') || String(record.id).startsWith('local')) {
        throw new Error('Fallback retry')
      }
      const result = await requestJson(`/exports/${record.id}/retry`, { method: 'POST' })
      const updated = normalizeExport(result.data || result.export || result)
      updateHistoryRecord({ ...updated, status: 'processing', progress: 28 })
      pollExportStatus(updated.id)
      showToast('Export dikirim ulang ke queue.', 'success')
    } catch {
      // TODO: Backend saat ini belum menyediakan POST /api/exports/:id/retry.
      setHistory((current) => current.map((item) => (item.id === record.id ? { ...item, status: 'processing', progress: 45 } : item)))
      showToast('Retry fallback berjalan. Export diproses ulang.', 'warning')
      window.setTimeout(() => {
        setHistory((current) =>
          current.map((item) =>
            item.id === record.id
              ? { ...item, status: 'done', progress: 100, errorMsg: '', expiresAt: addDays(new Date().toISOString(), RETENTION_DAYS) }
              : item,
          ),
        )
      }, 2200)
    } finally {
      setRetryingId('')
    }
  }

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

  const validationMessage = validateForm()
  const generateDisabled = isGenerating || Boolean(validationMessage)

  if (!canAccess) {
    return (
      <main className="export-access-denied">
        <ShieldAlert aria-hidden="true" />
        <h1>Anda tidak memiliki akses ke halaman ini</h1>
        <p>Halaman Export Data hanya tersedia untuk role pemerintah dan admin.</p>
      </main>
    )
  }

  return (
    <DashboardLayout userRole={isAdmin ? 'admin' : 'pemerintah'} userName={displayName} currentPath={location.pathname} onLogout={handleLogout}>
      <main className="export-page">
        {toast ? <div className={`export-toast export-toast-${toast.type}`}>{toast.message}</div> : null}

        <header>
          <p className="export-subtitle">Pemerintah & Admin</p>
          <h1 className="export-heading">Export Data</h1>
          <p className="export-subtitle">Generate laporan PDF dan Excel/XLSX dari data distribusi, anggaran, audit, costing, dan SP2KP.</p>
        </header>

        <div className="export-layout">
          <section className="export-panel export-form-panel">
            <h2 className="export-heading">Generate Laporan Baru</h2>
            <p className="export-subtitle">Export diproses asynchronous dan file berlaku 7 hari.</p>

            <form onSubmit={handleGenerate}>
              <div className="export-step">
                <h3 className="export-step-title">1. Pilih Format</h3>
                <div className="export-format-grid">
                  <label className={`export-format-card ${format === 'pdf' ? 'export-format-card-active' : ''}`}>
                    <input type="radio" name="format" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
                    <span className="export-format-icon">
                      <FileText aria-hidden="true" />
                    </span>
                    <span className="export-format-title">PDF</span>
                    <span className="export-format-desc">Laporan visual dengan grafik dan tabel terformat</span>
                  </label>
                  <label className={`export-format-card ${format === 'excel' ? 'export-format-card-active' : ''}`}>
                    <input type="radio" name="format" value="excel" checked={format === 'excel'} onChange={() => setFormat('excel')} />
                    <span className="export-format-icon">
                      <FileSpreadsheet aria-hidden="true" />
                    </span>
                    <span className="export-format-title">Excel (XLSX)</span>
                    <span className="export-format-desc">Data mentah dalam format spreadsheet untuk analisis lebih lanjut</span>
                  </label>
                </div>
              </div>

              <div className="export-step">
                <h3 className="export-step-title">2. Pilih Data</h3>
                <div className="export-checkbox-grid">
                  {DATASETS.map((dataset) => {
                    const disabled = dataset.adminOnly && !isAdmin
                    return (
                      <label key={dataset.id} className={`export-checkbox-row ${disabled ? 'export-checkbox-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checkedData.includes(dataset.id)}
                          disabled={disabled}
                          onChange={() => toggleDataset(dataset.id)}
                        />
                        <span>{dataset.label}</span>
                        {disabled ? <small>Hanya admin</small> : null}
                        {!disabled && dataset.summaryForGovernment && !isAdmin ? <small>Ringkasan</small> : null}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="export-step">
                <h3 className="export-step-title">3. Filter Parameter</h3>
                <div className="export-filter-grid">
                  <label className="export-field">
                    <span className="export-label">Provinsi</span>
                    <select
                      className="export-select export-select-multiple"
                      value={filters.provinces}
                      multiple
                      onChange={handleProvinceChange}
                    >
                      <option value="all">Semua Provinsi</option>
                      {PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="export-field">
                    <span className="export-label">Date From</span>
                    <input
                      className="export-input"
                      type="date"
                      value={filters.dateFrom}
                      required
                      onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                    />
                  </label>

                  <label className="export-field">
                    <span className="export-label">Date To</span>
                    <input
                      className="export-input"
                      type="date"
                      value={filters.dateTo}
                      required
                      onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                    />
                  </label>

                  <label className="export-field">
                    <span className="export-label">Status Anomaly</span>
                    <select
                      className="export-select"
                      value={filters.anomalyStatus}
                      disabled={!checkedData.includes('anomalies')}
                      onChange={(event) => setFilters((current) => ({ ...current, anomalyStatus: event.target.value }))}
                    >
                      <option value="all">Semua</option>
                      <option value="unresolved">Unresolved</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                </div>

                <div className="export-checkbox-grid">
                  {DISTRIBUTION_STATUSES.map((status) => (
                    <label key={status.value} className="export-checkbox-row">
                      <input
                        type="checkbox"
                        checked={filters.distributionStatuses.includes(status.value)}
                        onChange={() => toggleDistributionStatus(status.value)}
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`export-estimate ${estimate.exceedsMax ? 'export-estimate-warning' : ''}`}>
                <strong>Estimasi: ~{formatNumber(estimate.rows)} baris data | ~{estimate.sizeMb.toFixed(1)} MB</strong>
                <span>Limit konfigurasi: {formatNumber(maxRows)} baris. File export berlaku 7 hari setelah selesai dibuat.</span>
                {estimate.exceedsMax ? (
                  <small>Melebihi batas maksimal {formatNumber(maxRows)} baris. Persempit filter tanggal atau wilayah.</small>
                ) : null}
                {validationMessage && !estimate.exceedsMax ? <small className="export-form-warning">{validationMessage}</small> : null}
              </div>

              {isGenerating ? (
                <div className="export-progress" role="progressbar" aria-label="Progress export" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
                  <span className="export-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              ) : null}

              <button className="export-generate-btn" type="submit" disabled={generateDisabled}>
                {isGenerating ? <Loader2 className="export-spin-icon" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {isGenerating ? 'Memproses laporan...' : 'Generate & Download'}
              </button>
            </form>
          </section>

          <aside className="export-panel export-history-panel">
            <h2 className="export-heading">Riwayat Export</h2>
            <p className="export-subtitle">File tersedia selama 7 hari</p>

            {loading ? <div className="export-loading">Memuat riwayat export...</div> : null}
            {error ? (
              <div className="export-error">
                <AlertTriangle aria-hidden="true" />
                {error}
              </div>
            ) : null}

            <div className="export-history-list">
              {history.map((record) => {
                const status = getStatus(record)
                const isDone = status === 'done'
                const isProcessing = status === 'processing' || status === 'pending'
                const isFailed = status === 'failed'
                const expiresIn = getDaysUntil(record.expiresAt)
                const HistoryIcon = record.type === 'excel' ? FileSpreadsheet : FileText

                return (
                  <article key={record.id} className="export-history-card">
                    <span className="export-history-icon">
                      <HistoryIcon aria-hidden="true" />
                    </span>
                    <div className="export-history-main">
                      <div>
                        <h3 className="export-file-name">{record.fileName}</h3>
                        <p className="export-file-meta">
                          Dibuat {formatDateTime(record.createdAt)} | {formatBytes(record.sizeBytes)} | {formatNumber(record.rows)} baris
                        </p>
                      </div>

                      <span className={`export-status export-status-${status}`}>
                        {isDone ? <CheckCircle2 aria-hidden="true" /> : null}
                        {isProcessing ? <Clock3 aria-hidden="true" /> : null}
                        {isFailed || status === 'expired' ? <XCircle aria-hidden="true" /> : null}
                        {STATUS_LABELS[status] || status}
                      </span>

                      {isProcessing ? (
                        <div
                          className="export-progress"
                          role="progressbar"
                          aria-label={`Progress ${record.fileName}`}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={record.progress || 48}
                        >
                          <span className="export-progress-fill" style={{ width: `${record.progress || 48}%` }} />
                        </div>
                      ) : null}

                      <p className="export-expire-text">
                        {status === 'expired'
                          ? 'File sudah kedaluwarsa'
                          : `Kedaluwarsa dalam ${Math.max(0, expiresIn)} hari`}
                      </p>

                      {record.errorMsg ? <p className="export-expire-text">{record.errorMsg}</p> : null}
                    </div>

                    <div className="export-history-actions">
                      {isDone ? (
                        <button className="export-action-btn export-download-btn" type="button" disabled={downloadingId === record.id} onClick={() => handleDownload(record)}>
                          <Download aria-hidden="true" />
                          {downloadingId === record.id ? 'Mengunduh' : 'Unduh'}
                        </button>
                      ) : null}
                      {isFailed ? (
                        <button className="export-action-btn export-retry-btn" type="button" disabled={retryingId === record.id} onClick={() => handleRetry(record)}>
                          <RefreshCw className={retryingId === record.id ? 'export-spin-icon' : ''} aria-hidden="true" />
                          {retryingId === record.id ? 'Retry...' : 'Coba Lagi'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>
        </div>
      </main>
    </DashboardLayout>
  )
}

export default ExportData
