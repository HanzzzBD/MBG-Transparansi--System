import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCcw,
  Send,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './LaporanMasyarakat.css'

const PAGE_SIZE = 10

const CATEGORY_OPTIONS = [
  { value: 'kualitas_makanan', label: 'Kualitas Makanan', className: 'laporan-cat-kualitas', color: '#f97316' },
  { value: 'keterlambatan', label: 'Keterlambatan', className: 'laporan-cat-keterlambatan', color: '#9b1c1c' },
  { value: 'kekurangan_porsi', label: 'Kekurangan Porsi', className: 'laporan-cat-porsi', color: '#fbbf24' },
  { value: 'lainnya', label: 'Lainnya', className: 'laporan-cat-lainnya', color: '#6b7280' },
]

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((result, item) => {
  result[item.value] = item.label
  return result
}, {})

const CATEGORY_CLASSES = CATEGORY_OPTIONS.reduce((result, item) => {
  result[item.value] = item.className
  return result
}, {})

const STATUS_LABELS = {
  baru: 'Baru',
  ditinjau: 'Ditinjau',
  ditindak: 'Ditindak',
  ditutup: 'Ditutup',
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

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function truncateText(value, length = 96) {
  const text = String(value || '')
  if (text.length <= length) return text
  return `${text.slice(0, length - 3)}...`
}

function normalizeReport(item) {
  return {
    id: item.id,
    reporterName: item.reporterName ?? item.reporter_name ?? '',
    contact: item.contact || item.phone || item.email || '',
    category: item.category || 'lainnya',
    province: item.province || '-',
    city: item.city || '-',
    message: item.message || '-',
    status: item.status || item.followUpStatus || item.follow_up_status || 'baru',
    followUpNote: item.followUpNote || item.follow_up_note || '',
    updatedBy: item.updatedBy || item.updated_by || item.updatedByUser?.name || '',
    updatedAt: item.updatedAt || item.updated_at || '',
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    raw: item,
  }
}

function normalizeSummary(data) {
  const byCategory = data?.byCategory || data?.by_category || null
  return {
    totalReports: Number(data?.totalReports ?? data?.total_reports ?? 0),
    thisMonth: Number(data?.thisMonth ?? data?.this_month ?? 0),
    needFollowUp: Number(data?.needFollowUp ?? data?.need_follow_up ?? 0),
    byCategory: byCategory || CATEGORY_OPTIONS.reduce((result, item) => {
      result[item.value] = 0
      return result
    }, {}),
  }
}

function normalizeTrendRows(items) {
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    date: item.date || item.label || item.day || '-',
    kualitas_makanan: Number(item.kualitas_makanan ?? item.kualitasMakanan ?? 0),
    keterlambatan: Number(item.keterlambatan ?? 0),
    kekurangan_porsi: Number(item.kekurangan_porsi ?? item.kekuranganPorsi ?? 0),
    lainnya: Number(item.lainnya ?? 0),
  }))
}

function normalizeTopRegions(items) {
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    city: item.city || item.kota || '-',
    province: item.province || item.provinsi || '-',
    totalReports: Number(item.totalReports ?? item.total_reports ?? item.total ?? 0),
  }))
}

function applyStatusToggle(row, statusToggle) {
  if (statusToggle === 'all') return true
  if (statusToggle === 'open') return ['baru', 'ditinjau'].includes(row.status)
  if (statusToggle === 'done') return ['ditindak', 'ditutup'].includes(row.status)
  return true
}

function applyLocalFilters(rows, filters) {
  const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
  return rows.filter((row) => {
    const createdAt = new Date(row.createdAt)
    const matchesCategory = !filters.category || row.category === filters.category
    const matchesProvince = !filters.province || row.province === filters.province
    const matchesStatus = applyStatusToggle(row, filters.statusToggle)
    const matchesFrom = !dateFrom || createdAt >= dateFrom
    const matchesTo = !dateTo || createdAt <= dateTo
    return matchesCategory && matchesProvince && matchesStatus && matchesFrom && matchesTo
  })
}

function getAllowedNextStatuses(status) {
  if (status === 'baru') return ['ditinjau', 'ditindak', 'ditutup']
  if (status === 'ditinjau') return ['ditindak', 'ditutup']
  if (status === 'ditindak') return ['ditutup']
  return []
}

function LaporanMasyarakat({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'pemerintah'
  const displayName = userName || storedUser?.name || storedUser?.email || 'Pengguna MBG'
  const canAccess = ['admin', 'pemerintah'].includes(resolvedRole)

  const [reports, setReports] = useState([])
  const [summary, setSummary] = useState(normalizeSummary(null))
  const [trendRows, setTrendRows] = useState([])
  const [topRegions, setTopRegions] = useState([])
  const [filters, setFilters] = useState({
    category: '',
    province: '',
    dateFrom: '',
    dateTo: '',
    statusToggle: 'open',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [targetStatus, setTargetStatus] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchReports = useCallback(async (signal) => {
    if (!canAccess) return
    setLoading(true)
    setError('')

    try {
      const statusParam = filters.statusToggle === 'open'
        ? 'baru,ditinjau'
        : filters.statusToggle === 'done'
          ? 'ditindak,ditutup'
          : undefined
      const result = await requestJson('/public-reports', {
        params: {
          category: filters.category,
          province: filters.province,
          status: statusParam,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = applyLocalFilters(items.map(normalizeReport), filters)

      if (!normalized.length) {
        setReports([])
        setTotal(0)
        return
      }

      setReports(normalized)
      setTotal(result.meta?.total || normalized.length)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setReports([])
        setTotal(0)
        setError(fetchError.message || 'Laporan masyarakat gagal dimuat dari API.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [canAccess, filters, page])

  const fetchSummary = useCallback(async (signal) => {
    if (!canAccess) return
    try {
      let result
      try {
        result = await requestJson('/public-reports/summary', { signal })
      } catch {
        result = await requestJson('/analytics/public-reports-summary', { signal })
      }
      setSummary(normalizeSummary(result.data))
    } catch {
      setSummary(normalizeSummary(null))
    }
  }, [canAccess])

  const fetchCharts = useCallback(async (signal) => {
    if (!canAccess) return
    const [trendResult, topResult] = await Promise.allSettled([
      requestJson('/analytics/public-reports-trend', { signal }),
      requestJson('/analytics/public-reports-top-regions', { signal }),
    ])

    if (trendResult.status === 'fulfilled') {
      const normalized = normalizeTrendRows(Array.isArray(trendResult.value.data) ? trendResult.value.data : trendResult.value.data?.items)
      setTrendRows(normalized)
    } else {
      setTrendRows([])
    }

    if (topResult.status === 'fulfilled') {
      const normalized = normalizeTopRegions(Array.isArray(topResult.value.data) ? topResult.value.data : topResult.value.data?.items)
      setTopRegions(normalized)
    } else {
      setTopRegions([])
    }
  }, [canAccess])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchReports(controller.signal)
      fetchSummary(controller.signal)
      fetchCharts(controller.signal)
    })
    return () => controller.abort()
  }, [fetchCharts, fetchReports, fetchSummary])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endEntry = Math.min(page * PAGE_SIZE, total)

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ category: '', province: '', dateFrom: '', dateTo: '', statusToggle: 'open' })
    setPage(1)
  }

  const handleCategoryCardClick = (category) => {
    setFilters((current) => ({ ...current, category: current.category === category ? '' : category }))
    setPage(1)
  }

  const fetchDetail = async (report) => {
    if (!String(report.id).match(/^\d+$/)) return report
    try {
      const result = await requestJson(`/public-reports/${report.id}`)
      return normalizeReport(result.data)
    } catch {
      return report
    }
  }

  const openDetail = async (report) => {
    const detail = await fetchDetail(report)
    setSelectedReport(detail)
    setTargetStatus('')
    setFollowUpNote('')
    setFieldError('')
  }

  const closeDetail = () => {
    setSelectedReport(null)
    setTargetStatus('')
    setFollowUpNote('')
    setFieldError('')
  }

  const patchStatus = async (report, status, note) => {
    return requestJson(`/public-reports/${report.id}/status`, {
      method: 'PATCH',
      body: {
        status,
        followUpNote: note,
      },
    })
  }

  const submitStatusUpdate = async (status = targetStatus, report = selectedReport) => {
    if (!report) return
    if (!status) {
      setFieldError('Pilih status tindak lanjut.')
      return
    }
    if (followUpNote.trim().length < 10) {
      setFieldError('Catatan tindak lanjut minimal 10 karakter.')
      return
    }
    setSubmitLoading(true)
    setFieldError('')

    try {
      const result = await patchStatus(report, status, followUpNote.trim())
      const updated = normalizeReport(result.data)
      setReports((current) => current.map((item) => (item.id === report.id ? updated : item)))
      setSelectedReport(updated)
      showToast('Status laporan berhasil diperbarui.', 'success')
      closeDetail()
      fetchSummary(new AbortController().signal)
    } catch (statusError) {
      showToast(statusError.message || 'Status laporan gagal diperbarui.', 'danger')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleQuickDitindak = (report) => {
    setSelectedReport(report)
    setTargetStatus('ditindak')
    setFollowUpNote('')
    setFieldError('Isi catatan tindak lanjut sebelum menandai ditindak.')
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

  if (!canAccess) {
    return (
      <div className="laporan-access-denied">
        <AlertTriangle aria-hidden="true" />
        <h1>Anda tidak memiliki akses ke halaman ini</h1>
      </div>
    )
  }

  return (
    <DashboardLayout userRole={resolvedRole === 'admin' ? 'admin' : 'pemerintah'} userName={displayName} currentPath={location.pathname} onLogout={handleLogout} notifCount={summary.needFollowUp}>
      <div className="laporan-page">
        <header className="laporan-header">
          <div>
            <p className="laporan-subtitle">Pemerintah & Admin</p>
            <h1 className="laporan-title">Laporan Masyarakat</h1>
            <p>Semua laporan yang masuk dari publik melalui form laporan</p>
          </div>
          <div className="laporan-summary-chips" aria-label="Ringkasan laporan masyarakat">
            <span className="laporan-chip"><ClipboardList aria-hidden="true" /> Total Laporan <strong>{formatNumber(summary.totalReports)}</strong></span>
            <span className="laporan-chip"><BarChart3 aria-hidden="true" /> Bulan Ini <strong>{formatNumber(summary.thisMonth)}</strong></span>
            <span className="laporan-chip"><AlertTriangle aria-hidden="true" /> Perlu Tindak Lanjut <strong>{formatNumber(summary.needFollowUp)}</strong></span>
          </div>
        </header>

        {toast ? <div className={`laporan-toast laporan-toast-${toast.type}`}>{toast.message}</div> : null}

        <section className="laporan-filter-card">
          <div className="laporan-filter-grid">
            <label className="laporan-filter-field">
              <span className="laporan-label">Kategori</span>
              <select className="laporan-select" name="category" value={filters.category} onChange={handleFilterChange}>
                <option value="">Semua</option>
                {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="laporan-filter-field">
              <span className="laporan-label">Provinsi</span>
              <select className="laporan-select" name="province" value={filters.province} onChange={handleFilterChange}>
                <option value="">Semua Provinsi</option>
                {PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
              </select>
            </label>
            <label className="laporan-filter-field">
              <span className="laporan-label">Date From</span>
              <input className="laporan-input" type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} />
            </label>
            <label className="laporan-filter-field">
              <span className="laporan-label">Date To</span>
              <input className="laporan-input" type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} />
            </label>
            <div className="laporan-filter-field">
              <span className="laporan-label">Status</span>
              <div className="laporan-toggle-group">
                {[
                  ['open', 'Belum Ditindak'],
                  ['done', 'Sudah Ditindak'],
                  ['all', 'Semua'],
                ].map(([value, label]) => (
                  <button key={value} className={`laporan-toggle-btn ${filters.statusToggle === value ? 'laporan-toggle-active' : ''}`} type="button" onClick={() => {
                    setFilters((current) => ({ ...current, statusToggle: value }))
                    setPage(1)
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button className="laporan-reset-btn" type="button" onClick={resetFilters}>
              <RefreshCcw aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        </section>

        <section className="laporan-category-grid" aria-label="Kategori laporan">
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category.value}
              className={`laporan-category-card ${filters.category === category.value ? 'laporan-category-active' : ''}`}
              type="button"
              onClick={() => handleCategoryCardClick(category.value)}
            >
              <span className={`laporan-category-icon ${category.className}`} />
              <span className="laporan-category-title">{category.label}</span>
              <strong className="laporan-category-value">{formatNumber(summary.byCategory?.[category.value] ?? 0)}</strong>
            </button>
          ))}
        </section>

        {error ? (
          <div className="laporan-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="laporan-table-card">
          {loading ? (
            <div className="laporan-loading">
              <Loader2 aria-hidden="true" />
              Memuat laporan masyarakat...
            </div>
          ) : null}
          <div className="laporan-table-wrap">
            <table className="laporan-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pelapor</th>
                  <th>Kategori</th>
                  <th>Provinsi</th>
                  <th>Kota</th>
                  <th>Pesan</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {!loading && reports.length === 0 ? (
                  <tr>
                    <td colSpan="9">Belum ada laporan masyarakat untuk filter ini.</td>
                  </tr>
                ) : null}
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td><strong>#{report.id}</strong></td>
                    <td>
                      {report.reporterName ? <strong>{report.reporterName}</strong> : <em className="laporan-reporter-anon">Anonim</em>}
                    </td>
                    <td>
                      <span className={`laporan-category-badge ${CATEGORY_CLASSES[report.category] || 'laporan-cat-lainnya'}`}>
                        {CATEGORY_LABELS[report.category] || 'Lainnya'}
                      </span>
                    </td>
                    <td>{report.province || '-'}</td>
                    <td>{report.city || '-'}</td>
                    <td>{truncateText(report.message)}</td>
                    <td>{formatDateTime(report.createdAt)}</td>
                    <td>
                      <span className={`laporan-status-badge laporan-status-${report.status}`}>
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </td>
                    <td>
                      <div className="laporan-action-row">
                        <button className="laporan-btn laporan-btn-secondary" type="button" onClick={() => openDetail(report)}>
                          <Eye aria-hidden="true" />
                          Detail
                        </button>
                        {!['ditindak', 'ditutup'].includes(report.status) ? (
                          <button className="laporan-btn laporan-btn-success" type="button" onClick={() => handleQuickDitindak(report)}>
                            <CheckCircle2 aria-hidden="true" />
                            Tandai Ditindak
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="laporan-pagination">
            <span className="laporan-page-info">Menampilkan {startEntry}-{endEntry} dari {formatNumber(total)} laporan</span>
            <div>
              <button className="laporan-page-btn" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <button className="laporan-page-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          </footer>
        </section>

        <section className="laporan-chart-grid">
          <article className="laporan-chart-card">
            <h2 className="laporan-chart-title">Tren Laporan Masuk 30 Hari</h2>
            {trendRows.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trendRows}>
                  <CartesianGrid stroke="#f4f8fb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="kualitas_makanan" name="Kualitas Makanan" stroke="#f97316" fill="#f97316" fillOpacity={0.14} />
                  <Area type="monotone" dataKey="keterlambatan" name="Keterlambatan" stroke="#9b1c1c" fill="#9b1c1c" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="kekurangan_porsi" name="Kekurangan Porsi" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.18} />
                  <Area type="monotone" dataKey="lainnya" name="Lainnya" stroke="#6b7280" fill="#6b7280" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="laporan-loading">Belum ada data tren laporan dari backend.</div>
            )}
          </article>

          <article className="laporan-chart-card">
            <h2 className="laporan-chart-title">Wilayah dengan Laporan Terbanyak</h2>
            {topRegions.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topRegions} layout="vertical" margin={{ left: 18, right: 16 }}>
                  <CartesianGrid stroke="#f4f8fb" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="city" width={92} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value, name, item) => [`${formatNumber(value)} laporan`, `${item.payload.city}, ${item.payload.province}`]} />
                  <Bar dataKey="totalReports" name="Jumlah Laporan" fill="#0f4c81" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="laporan-loading">Belum ada data wilayah dari backend.</div>
            )}
          </article>
        </section>

        {selectedReport ? (
          <div className="laporan-modal-backdrop" role="presentation">
            <div className="laporan-modal" role="dialog" aria-modal="true" aria-labelledby="laporan-modal-title">
              <header className="laporan-modal-header">
                <div>
                  <p className="laporan-subtitle">Detail Laporan</p>
                  <h2 id="laporan-modal-title" className="laporan-modal-title">Laporan #{selectedReport.id}</h2>
                </div>
                <button className="laporan-modal-close" type="button" aria-label="Tutup detail laporan" onClick={closeDetail}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="laporan-modal-body">
                <div className="laporan-detail-grid">
                  {[
                    ['Pelapor', selectedReport.reporterName || 'Anonim'],
                    ['Kontak', selectedReport.contact || '-'],
                    ['Kategori', CATEGORY_LABELS[selectedReport.category] || 'Lainnya'],
                    ['Status', STATUS_LABELS[selectedReport.status] || selectedReport.status],
                    ['Provinsi', selectedReport.province],
                    ['Kota', selectedReport.city],
                    ['Tanggal Kirim', formatDateTime(selectedReport.createdAt)],
                    ['Updated By', selectedReport.updatedBy || '-'],
                    ['Updated At', formatDateTime(selectedReport.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="laporan-detail-item">
                      <span className="laporan-detail-label">{label}</span>
                      <strong className="laporan-detail-value">{value || '-'}</strong>
                    </div>
                  ))}
                </div>

                <div className="laporan-message-box">
                  <MessageSquare aria-hidden="true" />
                  <div>
                    <span>Pesan Lengkap</span>
                    <p>{selectedReport.message}</p>
                  </div>
                </div>

                <div className="laporan-followup-box">
                  <MapPin aria-hidden="true" />
                  <div>
                    <span>Follow Up Terakhir</span>
                    <p>{selectedReport.followUpNote || 'Belum ada catatan tindak lanjut.'}</p>
                  </div>
                </div>

                {selectedReport.status !== 'ditutup' ? (
                  <div className="laporan-followup-form">
                    <label className="laporan-filter-field">
                      <span className="laporan-label">Status Tindak Lanjut</span>
                      <select className="laporan-select" value={targetStatus} onChange={(event) => {
                        setTargetStatus(event.target.value)
                        if (fieldError) setFieldError('')
                      }}>
                        <option value="">Pilih status</option>
                        {getAllowedNextStatuses(selectedReport.status).map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="laporan-filter-field">
                      <span className="laporan-label">Catatan tindak lanjut</span>
                      <textarea
                        className="laporan-textarea"
                        value={followUpNote}
                        onChange={(event) => {
                          setFollowUpNote(event.target.value)
                          if (fieldError) setFieldError('')
                        }}
                        placeholder="Catatan tindak lanjut"
                        rows={4}
                      />
                    </label>
                    {fieldError ? <small className="laporan-field-error">{fieldError}</small> : null}
                    <div className="laporan-action-row">
                      {getAllowedNextStatuses(selectedReport.status).map((status) => (
                        <button key={status} className="laporan-btn laporan-btn-primary" type="button" onClick={() => setTargetStatus(status)}>
                          Tandai {STATUS_LABELS[status]}
                        </button>
                      ))}
                      <button className="laporan-btn laporan-btn-success" type="button" disabled={submitLoading} onClick={() => submitStatusUpdate()}>
                        {submitLoading ? <Loader2 aria-hidden="true" /> : <Send aria-hidden="true" />}
                        Submit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="laporan-followup-box">
                    <CheckCircle2 aria-hidden="true" />
                    <div>
                      <span>Laporan Ditutup</span>
                      <p>Tidak ada aksi lanjutan yang tersedia.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default LaporanMasyarakat
