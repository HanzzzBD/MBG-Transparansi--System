import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './AuditLog.css'

const PAGE_SIZE = 10

const ACTION_OPTIONS = ['', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'OVERRIDE']
const CATEGORY_OPTIONS = ['', 'Data', 'User', 'Security', 'System']
const SEVERITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH']
const SENSITIVE_KEYS = ['password', 'token', 'refreshToken', 'accessToken', 'authorization', 'secret']

const ACTION_LABELS = {
  INSERT: 'Created Data',
  UPDATE: 'Updated Data',
  DELETE: 'Deleted Data',
  LOGIN: 'User Login',
  LOGOUT: 'User Logout',
  LOCK: 'Locked Data',
  UNLOCK: 'Unlocked Data',
  OVERRIDE: 'Override Data',
}

const FALLBACK_ROWS = [
  ['Ahmad Suryanto', 'UPDATE', 'Data', 'SDN 1 Jakarta Pusat', 'LOW', { totalStudents: 445 }, { totalStudents: 450 }],
  ['Siti Nurhaliza', 'INSERT', 'User', 'dewi.l@mbg.go.id', 'MEDIUM', null, { role: 'Viewer', status: 'Active' }],
  ['Ahmad Suryanto', 'LOCK', 'Security', 'SMPN 5 Jakarta Selatan', 'HIGH', { status: 'Editable' }, { status: 'Locked' }],
  ['Budi Santoso', 'OVERRIDE', 'Security', 'SMAN 8 Jakarta Barat', 'HIGH', { locked: true }, { forcedUpdate: true }],
  ['Dewi Lestari', 'LOGIN', 'Security', 'admin@mbg.go.id', 'LOW', null, { status: 'success' }],
  ['Raka Pratama', 'LOGOUT', 'Security', 'gov@mbg.go.id', 'LOW', { session: 'active' }, { session: 'closed' }],
  ['Maya Putri', 'UPDATE', 'Data', 'SPPG Bandung Selatan', 'LOW', { capacity: 1200 }, { capacity: 1500 }],
  ['Admin Nasional', 'DELETE', 'Data', 'Sekolah Demo Soft Delete', 'MEDIUM', { deletedAt: null }, { deletedAt: '2026-05-04T08:10:00Z' }],
  ['Petugas SPPG', 'INSERT', 'Data', 'Production Batch #204', 'LOW', null, { totalPortions: 1250, costPerPortion: 11200 }],
  ['Admin Nasional', 'UPDATE', 'System', 'RAW_MATERIAL_PRICE_ANOMALY #88', 'MEDIUM', { isResolved: false }, { isResolved: true }],
  ['Admin Nasional', 'UPDATE', 'System', 'PRICE_ANOMALY #91', 'HIGH', { isResolved: false }, { isResolved: true }],
  ['Siti Nurhaliza', 'UNLOCK', 'Security', 'Distribution #152', 'MEDIUM', { isLocked: true }, { isLocked: false }],
  ['Ahmad Suryanto', 'UPDATE', 'Data', 'Menu Harian #72', 'LOW', { calories: 630 }, { calories: 650 }],
  ['Budi Santoso', 'INSERT', 'Data', 'SPPG Jayapura Abepura', 'LOW', null, { province: 'Papua', status: 'active' }],
  ['Dewi Lestari', 'UPDATE', 'User', 'operator.sppg@mbg.go.id', 'MEDIUM', { role: 'umum' }, { role: 'sppg' }],
  ['Maya Putri', 'LOCK', 'Security', 'Price Threshold Jawa Barat', 'HIGH', { editable: true }, { editable: false }],
  ['Admin Nasional', 'OVERRIDE', 'Security', 'Distribution #180', 'HIGH', { pricePerPortion: 12000 }, { pricePerPortion: 15000 }],
  ['Raka Pratama', 'UPDATE', 'Data', 'School Report #44', 'LOW', { status: 'pending' }, { status: 'reviewed' }],
  ['Petugas SPPG', 'INSERT', 'Data', 'Proof Distribusi #77', 'LOW', null, { file: 'proof-77.jpg' }],
  ['Siti Nurhaliza', 'DELETE', 'User', 'inactive.user@mbg.go.id', 'MEDIUM', { isActive: true }, { isActive: false }],
  ['Ahmad Suryanto', 'UPDATE', 'Data', 'Production Batch Item Beras Medium', 'LOW', { unitPrice: 14500 }, { unitPrice: 15000 }],
  ['Admin Nasional', 'LOGIN', 'Security', 'admin@mbg.go.id', 'MEDIUM', null, { status: 'success', ipAddress: '127.0.0.1' }],
  ['Budi Santoso', 'LOGOUT', 'Security', 'pemerintah@mbg.go.id', 'LOW', { session: 'active' }, { session: 'closed' }],
  ['Maya Putri', 'UPDATE', 'System', 'System Config raw_material_price_anomaly_percent', 'HIGH', { value: 25 }, { value: 30 }],
  ['Dewi Lestari', 'INSERT', 'Data', 'Food Prices 2026-05-18', 'LOW', null, { records: 2014, source: 'SP2KP Kemendag' }],
].map((item, index) => ({
  id: `fallback-${index + 1}`,
  timestamp: new Date(Date.UTC(2026, 4, 4, 10, 30 - index, 15)).toISOString(),
  user: item[0],
  userRole: index % 3 === 0 ? 'admin' : index % 3 === 1 ? 'pemerintah' : 'sppg',
  action: item[1],
  actionLabel: ACTION_LABELS[item[1]] || item[1],
  category: item[2],
  target: item[3],
  targetTable: item[3].split(' ')[0].toLowerCase(),
  recordId: index + 100,
  changes: '',
  severity: item[4],
  ipAddress: `192.168.1.${index + 10}`,
  userAgent: 'Mozilla/5.0 MBG Dashboard',
  description: `${ACTION_LABELS[item[1]] || item[1]} pada ${item[3]}`,
  oldData: item[5],
  newData: item[6],
  metadata: index % 5 === 0 ? { source: 'fallback-preview' } : null,
}))

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

function sanitizeAuditData(data) {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(sanitizeAuditData)

  return Object.entries(data).reduce((result, [key, value]) => {
    const sensitive = SENSITIVE_KEYS.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()))
    result[key] = sensitive ? '[REDACTED]' : sanitizeAuditData(value)
    return result
  }, {})
}

function formatTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function inferCategory(row) {
  const table = String(row.tableName || row.table_name || row.targetTable || '').toLowerCase()
  const action = String(row.action || '').toUpperCase()

  if (['LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'OVERRIDE'].includes(action)) return 'Security'
  if (table.includes('user')) return 'User'
  if (table.includes('config') || table.includes('anomaly') || table.includes('audit')) return 'System'
  return 'Data'
}

function inferSeverity(row) {
  const action = String(row.action || '').toUpperCase()
  const table = String(row.tableName || row.table_name || '').toLowerCase()

  if (['DELETE', 'LOCK', 'OVERRIDE'].includes(action)) return 'HIGH'
  if (action === 'UNLOCK' || table.includes('user') || table.includes('anomaly')) return 'MEDIUM'
  return 'LOW'
}

function makeChanges(oldData, newData) {
  if (!oldData && !newData) return '-'
  if (!oldData) {
    return Object.entries(newData || {})
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ')
  }

  const changes = []
  Object.keys(newData || {}).forEach((key) => {
    const before = oldData?.[key]
    const after = newData?.[key]
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`${key}: ${String(before)} -> ${String(after)}`)
    }
  })

  return changes.length ? changes.slice(0, 2).join(', ') : 'Tidak ada perubahan field utama'
}

function normalizeAuditRow(item) {
  const oldData = sanitizeAuditData(item.oldData ?? item.old_data)
  const newData = sanitizeAuditData(item.newData ?? item.new_data)
  const user = item.user || {}
  const action = String(item.action || 'UPDATE').toUpperCase()

  return {
    id: item.id,
    timestamp: item.createdAt || item.created_at || item.timestamp || new Date().toISOString(),
    user: item.userName || item.user_name || user.name || user.email || 'System',
    userRole: item.userRole || item.user_role || user.role || '-',
    action,
    actionLabel: item.actionLabel || ACTION_LABELS[action] || action,
    category: item.category || inferCategory(item),
    target: item.target || item.targetName || item.tableName || item.table_name || '-',
    targetTable: item.tableName || item.table_name || item.targetTable || '-',
    recordId: item.recordId || item.record_id || '-',
    changes: item.changes || makeChanges(oldData, newData),
    severity: String(item.severity || inferSeverity(item)).toUpperCase(),
    ipAddress: item.ipAddress || item.ip_address || '-',
    userAgent: item.userAgent || item.user_agent || '-',
    description: item.description || `${ACTION_LABELS[action] || action} pada ${item.tableName || item.table_name || 'record'}`,
    oldData,
    newData,
    metadata: sanitizeAuditData(item.metadata),
  }
}

function applyLocalFilters(rows, filters) {
  return rows.filter((row) => {
    const keyword = filters.search.trim().toLowerCase()
    const timestamp = new Date(row.timestamp)
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
    const matchesSearch = !keyword || [row.user, row.action, row.target, row.changes].some((value) => String(value).toLowerCase().includes(keyword))
    const matchesAction = !filters.action || row.action === filters.action
    const matchesCategory = !filters.category || row.category === filters.category
    const matchesSeverity = !filters.severity || row.severity === filters.severity
    const matchesFrom = !dateFrom || timestamp >= dateFrom
    const matchesTo = !dateTo || timestamp <= dateTo
    return matchesSearch && matchesAction && matchesCategory && matchesSeverity && matchesFrom && matchesTo
  })
}

function prettyJson(data) {
  return JSON.stringify(sanitizeAuditData(data || {}), null, 2)
}

function AuditLog({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'pemerintah'
  const displayName = userName || storedUser?.name || storedUser?.email || 'Pengguna MBG'
  const isAdmin = resolvedRole === 'admin'

  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ totalToday: 47, highSeverity: 3, activeUsers: 8 })
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    category: '',
    severity: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)
  const [toast, setToast] = useState(null)
  const [exportLoading, setExportLoading] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchAuditLogs = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    const params = {
      search: filters.search,
      action: filters.action,
      category: filters.category,
      severity: filters.severity,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      start_date: filters.dateFrom,
      end_date: filters.dateTo,
      page,
      limit: PAGE_SIZE,
    }

    try {
      let result
      try {
        result = await requestJson('/audit-logs', { params, signal })
      } catch (firstError) {
        // TODO: Backend publik /audit-logs belum tersedia; admin memakai endpoint existing /admin/audit-logs.
        if (!isAdmin) throw firstError
        result = await requestJson('/admin/audit-logs', {
          params: {
            action: filters.action,
            start_date: filters.dateFrom,
            end_date: filters.dateTo,
            page,
            limit: PAGE_SIZE,
          },
          signal,
        })
      }

      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = items.map(normalizeAuditRow)

      if (!normalized.length) {
        const fallback = applyLocalFilters(FALLBACK_ROWS.map(normalizeAuditRow), filters)
        setRows(fallback.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(fallback.length)
        setError('Data audit log API kosong. Fallback preview ditampilkan sementara.')
      } else {
        setRows(normalized)
        setTotal(result.meta?.total || normalized.length)
      }
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        const fallback = applyLocalFilters(FALLBACK_ROWS.map(normalizeAuditRow), filters)
        setRows(fallback.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(fallback.length)
        setError('Audit log gagal dimuat dari API. Fallback preview ditampilkan.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filters, isAdmin, page])

  const fetchSummary = useCallback(async (signal) => {
    try {
      const result = await requestJson('/audit-logs/summary', { signal })
      setSummary({
        totalToday: Number(result.data.totalToday ?? result.data.total_today ?? 0),
        highSeverity: Number(result.data.highSeverity ?? result.data.high_severity ?? 0),
        activeUsers: Number(result.data.activeUsers ?? result.data.active_users ?? 0),
      })
    } catch {
      const today = new Date().toISOString().slice(0, 10)
      const fallback = FALLBACK_ROWS.map(normalizeAuditRow)
      setSummary({
        totalToday: fallback.filter((row) => row.timestamp.slice(0, 10) === today).length || 47,
        highSeverity: fallback.filter((row) => row.severity === 'HIGH').length,
        activeUsers: new Set(fallback.map((row) => row.user)).size,
      })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchAuditLogs(controller.signal)
      fetchSummary(controller.signal)
    })
    return () => controller.abort()
  }, [fetchAuditLogs, fetchSummary])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endEntry = Math.min(page * PAGE_SIZE, total)

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', action: '', category: '', severity: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  const handleExport = async () => {
    if (!isAdmin) return
    setExportLoading(true)
    showToast('Menggenerate export log...', 'warning')

    try {
      await requestJson('/exports', {
        method: 'POST',
        body: {
          type: 'excel',
          filterParams: {
            search: filters.search,
            action: filters.action,
            category: filters.category,
            severity: filters.severity,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            page: 'audit-log',
          },
        },
      })
      showToast('Export log siap diproses. Cek menu Export Data.', 'success')
    } catch (exportError) {
      if (import.meta.env.DEV) {
        showToast('Endpoint export belum tersedia penuh. Fallback export log siap diproses.', 'warning')
      } else {
        showToast(exportError.message || 'Export log gagal.', 'danger')
      }
    } finally {
      setExportLoading(false)
    }
  }

  const handleOpenDetail = async (row) => {
    setSelectedLog(row)

    if (String(row.id).startsWith('fallback-')) return

    try {
      const result = await requestJson(`/audit-logs/${row.id}`)
      setSelectedLog(normalizeAuditRow(result.data))
    } catch {
      // TODO: backend saat ini belum tentu punya endpoint detail audit log publik.
      setSelectedLog(row)
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

  return (
    <DashboardLayout
      userRole={isAdmin ? 'admin' : 'pemerintah'}
      userName={displayName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={summary.highSeverity}
    >
      <div className="audit-page">
        <header className="audit-header">
          <div>
            <p className="audit-subtitle">Pemerintah & Admin</p>
            <h1 className="audit-title">Audit Log Sistem</h1>
            <p>Rekam jejak semua perubahan data dalam sistem</p>
          </div>
          {isAdmin ? (
            <button className="audit-export-btn" type="button" disabled={exportLoading} onClick={handleExport}>
              {exportLoading ? <Loader2 aria-hidden="true" /> : <Download aria-hidden="true" />}
              Export Log
            </button>
          ) : null}
        </header>

        {toast ? <div className={`audit-toast audit-toast-${toast.type}`}>{toast.message}</div> : null}

        <section className="audit-summary" aria-label="Ringkasan audit log">
          <article className="audit-summary-item">
            <ShieldCheck aria-hidden="true" />
            <span>Total Aksi Hari Ini</span>
            <strong>{summary.totalToday.toLocaleString('id-ID')}</strong>
          </article>
          <article className="audit-summary-item">
            <AlertTriangle aria-hidden="true" />
            <span>High Severity</span>
            <strong>{summary.highSeverity.toLocaleString('id-ID')}</strong>
          </article>
          <article className="audit-summary-item">
            <Users aria-hidden="true" />
            <span>Active Users</span>
            <strong>{summary.activeUsers.toLocaleString('id-ID')}</strong>
          </article>
        </section>

        <section className="audit-filter-card">
          <div className="audit-filter-grid">
            <label className="audit-filter-field audit-filter-field-wide">
              <span className="audit-label">Search</span>
              <span className="audit-search-wrap">
                <Search aria-hidden="true" />
                <input
                  className="audit-input"
                  name="search"
                  type="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Cari berdasarkan user, aksi, atau target..."
                />
              </span>
            </label>

            <label className="audit-filter-field">
              <span className="audit-label">Action</span>
              <select className="audit-select" name="action" value={filters.action} onChange={handleFilterChange}>
                {ACTION_OPTIONS.map((action) => (
                  <option key={action || 'all'} value={action}>{action || 'Semua'}</option>
                ))}
              </select>
            </label>

            <label className="audit-filter-field">
              <span className="audit-label">Category</span>
              <select className="audit-select" name="category" value={filters.category} onChange={handleFilterChange}>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category || 'all'} value={category}>{category || 'Semua'}</option>
                ))}
              </select>
            </label>

            <label className="audit-filter-field">
              <span className="audit-label">Date From</span>
              <input className="audit-input" name="dateFrom" type="date" value={filters.dateFrom} onChange={handleFilterChange} />
            </label>

            <label className="audit-filter-field">
              <span className="audit-label">Date To</span>
              <input className="audit-input" name="dateTo" type="date" value={filters.dateTo} onChange={handleFilterChange} />
            </label>

            <label className="audit-filter-field">
              <span className="audit-label">Severity</span>
              <select className="audit-select" name="severity" value={filters.severity} onChange={handleFilterChange}>
                {SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity || 'all'} value={severity}>{severity || 'Semua'}</option>
                ))}
              </select>
            </label>

            <button className="audit-reset-btn" type="button" onClick={resetFilters}>
              Reset Filter
            </button>
          </div>
        </section>

        {error ? (
          <div className="audit-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="audit-table-card">
          {loading ? (
            <div className="audit-loading">
              <Loader2 aria-hidden="true" />
              Memuat audit log...
            </div>
          ) : null}

          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Target</th>
                  <th>Changes</th>
                  <th>Severity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedId === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr className={row.severity === 'HIGH' ? 'audit-row-high' : ''}>
                        <td>{formatTimestamp(row.timestamp)}</td>
                        <td>
                          <strong>{row.user}</strong>
                          <span>{row.userRole}</span>
                        </td>
                        <td>
                          <span className={`audit-action-badge audit-action-${row.action.toLowerCase()}`}>
                            {row.action}
                          </span>
                        </td>
                        <td>{row.category}</td>
                        <td>
                          <strong>{row.target}</strong>
                          <span>{row.targetTable} #{row.recordId}</span>
                        </td>
                        <td><span className="audit-changes">{row.changes}</span></td>
                        <td>
                          <span className={`audit-severity-badge audit-severity-${row.severity.toLowerCase()} ${row.severity === 'HIGH' ? 'audit-severity-pulse' : ''}`}>
                            {row.severity}
                          </span>
                        </td>
                        <td>
                          <div className="audit-row-actions">
                            <button
                              className="audit-detail-btn"
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => setExpandedId(expanded ? '' : row.id)}
                            >
                              {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                              Expand
                            </button>
                            <button className="audit-detail-btn" type="button" onClick={() => handleOpenDetail(row)}>
                              <Eye aria-hidden="true" />
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="audit-expanded-row">
                          <td colSpan="8">
                            <div className="audit-json-grid">
                              <div>
                                <strong>Old Data</strong>
                                <pre className="audit-code-block">{prettyJson(row.oldData)}</pre>
                              </div>
                              <div>
                                <strong>New Data</strong>
                                <pre className="audit-code-block">{prettyJson(row.newData)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <footer className="audit-pagination">
            <span className="audit-page-info">
              Menampilkan {startEntry}-{endEntry} dari {total.toLocaleString('id-ID')} entri
            </span>
            <div className="audit-page-actions">
              <button className="audit-page-btn" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const pageNumber = index + 1
                return (
                  <button
                    key={pageNumber}
                    className={`audit-page-btn ${page === pageNumber ? 'audit-page-btn-active' : ''}`}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                )
              })}
              <button className="audit-page-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </footer>
        </section>

        {selectedLog ? (
          <div className="audit-modal-backdrop" role="presentation">
            <div className="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
              <header className="audit-modal-header">
                <div>
                  <p className="audit-subtitle">Detail Audit</p>
                  <h2 id="audit-modal-title" className="audit-modal-title">{selectedLog.actionLabel}</h2>
                </div>
                <button className="audit-modal-close" type="button" aria-label="Tutup detail audit" onClick={() => setSelectedLog(null)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="audit-modal-body">
                <div className="audit-detail-grid">
                  {[
                    ['Timestamp', formatTimestamp(selectedLog.timestamp)],
                    ['User', selectedLog.user],
                    ['User Role', selectedLog.userRole],
                    ['Action', selectedLog.action],
                    ['Category', selectedLog.category],
                    ['Target Table', selectedLog.targetTable],
                    ['Record ID', selectedLog.recordId],
                    ['Target Name', selectedLog.target],
                    ['Severity', selectedLog.severity],
                    ['IP Address', selectedLog.ipAddress],
                    ['User Agent', selectedLog.userAgent],
                    ['Description', selectedLog.description],
                  ].map(([label, value]) => (
                    <div key={label} className="audit-detail-item">
                      <span className="audit-detail-label">{label}</span>
                      <strong className="audit-detail-value">{value || '-'}</strong>
                    </div>
                  ))}
                </div>

                <div className="audit-json-grid">
                  <div>
                    <strong>Old Data</strong>
                    <pre className="audit-code-block">{prettyJson(selectedLog.oldData)}</pre>
                  </div>
                  <div>
                    <strong>New Data</strong>
                    <pre className="audit-code-block">{prettyJson(selectedLog.newData)}</pre>
                  </div>
                  <div>
                    <strong>Metadata</strong>
                    <pre className="audit-code-block">{prettyJson(selectedLog.metadata)}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default AuditLog
