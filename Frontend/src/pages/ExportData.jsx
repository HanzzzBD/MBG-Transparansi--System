import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  createExport,
  downloadExport,
  getExportDetail,
  getExports,
  isAbortError,
  retryExport,
  apiRequest as requestJson,
} from '../services/api'
import './ExportData.css'

const PAGE_SIZE = 10
const RETENTION_DAYS = 7
const EXPORT_POLL_MS = 2500
const ACCESS_ROLES = ['admin', 'pemerintah']

const DATASETS = [
  { id: 'distributions', label: 'Data Distribusi' },
  { id: 'validations', label: 'Validasi Sekolah' },
  { id: 'public_reports', label: 'Laporan Masyarakat' },
  { id: 'budget_by_region', label: 'Anggaran per Wilayah' },
  { id: 'audit_logs', label: 'Audit Log', adminOnly: true },
  { id: 'anomalies', label: 'Anomali Terdeteksi' },
  { id: 'production_batches', label: 'Production Batch & Costing', summaryForGovernment: true },
  { id: 'food_prices', label: 'Food Prices SP2KP', summaryForGovernment: true },
]

const DISTRIBUTION_STATUSES = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

const STATUS_LABELS = {
  pending: 'Diproses',
  processing: 'Diproses',
  completed: 'Selesai',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : ''
}

function getConfiguredValue(result) {
  const value =
    result?.data?.value ??
    result?.data?.config?.value ??
    result?.config?.value ??
    result?.value

  return Number(value) || 0
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

function getDaysUntil(value) {
  if (!value) return 7
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

function getStatus(record) {
  if (record.errorMsg && record.errorMsg.toLowerCase().includes('expired')) return 'expired'
  if (record.status === 'done') return 'completed'
  if (record.status === 'completed' && getDaysUntil(record.expiresAt) <= 0) return 'expired'
  if (record.status === 'pending') return 'processing'
  return record.status || 'processing'
}

function isValidDateInput(value) {
  if (!value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function getFriendlyExportMessage(message, fallback = 'Export gagal diproses backend.') {
  const raw = typeof message === 'string' ? message.trim() : ''
  if (!raw) return fallback

  const lower = raw.toLowerCase()
  if (lower.includes('invalid export date filter') || lower.includes('invalid date') || lower.includes('tanggal export')) {
    return 'Filter tanggal export tidak valid.'
  }
  if (lower.includes('tanggal awal export')) {
    return 'Tanggal awal export tidak boleh lebih besar dari tanggal akhir.'
  }
  if (
    raw.includes('\n') ||
    lower.includes('prisma') ||
    lower.includes('stack') ||
    lower.includes(' at ') ||
    lower.includes('validationerror') ||
    lower.includes('typeerror')
  ) {
    return fallback
  }

  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw
}

function getFriendlyExportError(error, fallback = 'Export gagal diproses backend.') {
  return getFriendlyExportMessage(error?.message || error, fallback)
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
    rows: Number(row.rows || row.rowCount || row.row_count || filterParams.rowCount || filterParams.row_count || 0),
    sizeBytes: Number(row.sizeBytes || row.size_bytes || row.fileSize || row.file_size || file.sizeBytes || file.size_bytes || 0),
    status,
    progress: Number(row.progressPercent ?? row.progress_percent ?? row.progress ?? (getStatus({ status, expiresAt: row.expiresAt || row.expires_at }) === 'completed' ? 100 : 0)),
    expiresAt: row.expiresAt || row.expires_at || file.expiresAt || file.expires_at || addDays(createdAt, RETENTION_DAYS),
    fileUrl: row.fileUrl || row.file_url || file.fileUrl || file.file_url || '',
    errorMsg: row.errorMsg || row.error_msg || '',
    displayErrorMsg: getFriendlyExportMessage(row.errorMsg || row.error_msg || '', ''),
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

function ExportData({ userRole, userName, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pollIntervalsRef = useRef({})
  const resolvedRole = normalizeRole(userRole)
  const displayName = userName || 'Pengguna MBG'
  const canAccess = ACCESS_ROLES.includes(resolvedRole)
  const isAdmin = resolvedRole === 'admin'

  const [format, setFormat] = useState('pdf')
  const [checkedData, setCheckedData] = useState(['distributions', 'budget_by_region'])
  const [filters, setFilters] = useState({
    province: '',
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
  const [maxRows, setMaxRows] = useState(0)
  const [retryingId, setRetryingId] = useState('')
  const [downloadingId, setDownloadingId] = useState('')

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

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
    } catch (configError) {
      if (!isAbortError(configError)) {
        setError(getFriendlyExportError(configError, 'Konfigurasi export_max_rows gagal dimuat dari API.'))
      }
    }
  }, [])

  const fetchHistory = useCallback(async (signal) => {
    try {
      const result = await getExports({ page: 1, limit: PAGE_SIZE }, { signal })
      const rows = normalizeHistoryResponse(result)
      if (rows.length) {
        setHistory(rows)
        return
      }

      setHistory([])
    } catch (historyError) {
      if (!isAbortError(historyError)) {
        setHistory([])
        setError(getFriendlyExportError(historyError, 'Riwayat export gagal dimuat dari API.'))
      }
    }
  }, [])

  const pollExportStatus = useCallback(
    (exportId) => {
      const key = String(exportId)
      if (!exportId || key.startsWith('local')) return

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
          const result = await getExportDetail(key)
          const updated = normalizeExport(result.data || result.export || result)
          updateHistoryRecord(updated)

          const status = getStatus(updated)
          if (status === 'completed' || status === 'failed' || status === 'expired') {
            stopPolling(key)
            showToast(status === 'completed' ? 'Export selesai. File siap diunduh.' : 'Export gagal diproses.', status === 'completed' ? 'success' : 'danger')
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
        if (!isAbortError(fetchError)) {
          setError(getFriendlyExportError(fetchError, 'Data export gagal dimuat dari API.'))
          setHistory([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
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
    if (!isValidDateInput(filters.dateFrom) || !isValidDateInput(filters.dateTo)) {
      return 'Filter tanggal export tidak valid.'
    }
    if (filters.dateFrom > filters.dateTo) return 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.'
    if (!maxRows) return 'Konfigurasi export_max_rows belum tersedia.'
    if (!filters.distributionStatuses.length && checkedData.includes('distributions')) {
      return 'Pilih minimal 1 status distribusi.'
    }
    if (!isAdmin && checkedData.some(isAdminOnlyDataset)) return 'Dataset admin-only tidak boleh dipilih role pemerintah.'
    return ''
  }

  const buildExportPayload = () => {
    const backendProvince = filters.province.trim() || undefined
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
        provinces: backendProvince ? [backendProvince] : [],
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        distributionStatuses: filters.distributionStatuses,
        anomalyStatus: filters.anomalyStatus,
        datasetModes,
        page: 'export-data',
        exportScope: 'selected_datasets',
        province: backendProvince,
        start_date: filters.dateFrom,
        end_date: filters.dateTo,
        status: backendStatus,
      },
    }
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
      const result = await createExport(buildExportPayload())
      const created = normalizeExport(result.data || result.export || result)
      const createdStatus = getStatus(created)
      const createdRecord = {
        ...created,
        status: createdStatus === 'completed' ? 'completed' : 'processing',
        progress: createdStatus === 'completed' ? 100 : Math.max(18, created.progress || 18),
        rows: created.rows,
        sizeBytes: created.sizeBytes,
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
      showToast(getFriendlyExportError(generateError, 'Export gagal dibuat dari API.'), 'danger')
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleDownload = async (record) => {
    setDownloadingId(record.id)
    try {
      const blob = await downloadExport(record.id)
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
      showToast(getFriendlyExportError(downloadError, 'Download gagal.'), 'danger')
    } finally {
      setDownloadingId('')
    }
  }

  const handleRetry = async (record) => {
    setRetryingId(record.id)
    try {
      const result = await retryExport(record.id)
      const updated = normalizeExport(result.data || result.export || result)
      updateHistoryRecord({ ...updated, status: 'processing', progress: 28 })
      pollExportStatus(updated.id)
      showToast('Export dikirim ulang ke queue.', 'success')
    } catch (retryError) {
      showToast(getFriendlyExportError(retryError, 'Retry export gagal diproses backend.'), 'danger')
    } finally {
      setRetryingId('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
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
                    <input
                      className="export-input"
                      type="search"
                      value={filters.province}
                      placeholder="Semua provinsi"
                      onChange={(event) => setFilters((current) => ({ ...current, province: event.target.value }))}
                    />
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

              <div className="export-estimate">
                <strong>Row count dan ukuran file dihitung backend setelah export diproses.</strong>
                <span>Limit konfigurasi: {formatNumber(maxRows)} baris. File export berlaku 7 hari setelah selesai dibuat.</span>
                {validationMessage ? <small className="export-form-warning">{validationMessage}</small> : null}
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
              {!loading && history.length === 0 ? (
                <div className="export-loading">Belum ada riwayat export dari backend.</div>
              ) : null}
              {history.map((record) => {
                const status = getStatus(record)
                const isDone = status === 'completed'
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
                          aria-valuenow={record.progress || 0}
                        >
                          <span className="export-progress-fill" style={{ width: `${record.progress || 0}%` }} />
                        </div>
                      ) : null}

                      <p className="export-expire-text">
                        {status === 'expired'
                          ? 'File sudah kedaluwarsa'
                          : `Kedaluwarsa dalam ${Math.max(0, expiresIn)} hari`}
                      </p>

                      {record.displayErrorMsg ? <p className="export-expire-text">{record.displayErrorMsg}</p> : null}
                    </div>

                    <div className="export-history-actions">
                      {isDone ? (
                        <button className="export-action-btn export-download-btn" type="button" disabled={downloadingId === record.id || status === 'expired'} onClick={() => handleDownload(record)}>
                          <Download aria-hidden="true" />
                          {downloadingId === record.id ? 'Mengunduh' : 'Unduh'}
                        </button>
                      ) : null}
                      {isFailed || status === 'expired' ? (
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
