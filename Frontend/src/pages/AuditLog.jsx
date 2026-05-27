import { Fragment, useCallback, useEffect, useState } from 'react'
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
import { createExport, getAuditLogDetail, getAuditLogs, getAuditLogsSummary, isAbortError } from '../services/api'
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

function prettyJson(data) {
  return JSON.stringify(sanitizeAuditData(data || {}), null, 2)
}

function AuditLog({ userRole, userName, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || 'pemerintah'
  const displayName = userName || 'Pengguna MBG'
  const isAdmin = resolvedRole === 'admin'

  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({
    totalToday: 0,
    highSeverity: 0,
    activeUsers: 0,
    severityCount: {},
    categoryCount: {},
  })
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
      const result = await getAuditLogs(params, { signal })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = items.map(normalizeAuditRow)

      if (!normalized.length) {
        setRows([])
        setTotal(0)
      } else {
        setRows(normalized)
        setTotal(result.meta?.total || normalized.length)
      }
    } catch (fetchError) {
      if (!isAbortError(fetchError)) {
        setRows([])
        setTotal(0)
        setError(fetchError.message || 'Audit log gagal dimuat dari API.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filters, page])

  const fetchSummary = useCallback(async (signal) => {
    try {
      const result = await getAuditLogsSummary({}, { signal })
      setSummary({
        totalToday: Number(result.data.totalToday ?? result.data.total_today ?? 0),
        highSeverity: Number(result.data.highSeverity ?? result.data.high_severity ?? 0),
        activeUsers: Number(result.data.activeUsers ?? result.data.active_users ?? 0),
        severityCount: result.data.severityCount ?? result.data.severity_count ?? {},
        categoryCount: result.data.categoryCount ?? result.data.category_count ?? {},
      })
    } catch (summaryError) {
      if (!isAbortError(summaryError)) {
        setSummary({ totalToday: 0, highSeverity: 0, activeUsers: 0, severityCount: {}, categoryCount: {} })
      }
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
      await createExport({
        type: 'excel',
        filterParams: {
          datasets: ['audit_logs'],
          search: filters.search,
          auditAction: filters.action,
          category: filters.category,
          severity: filters.severity,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          page: 'audit-log',
        },
      })
      showToast('Export log siap diproses. Cek menu Export Data.', 'success')
    } catch (exportError) {
      showToast(exportError.message || 'Export log gagal.', 'danger')
    } finally {
      setExportLoading(false)
    }
  }

  const handleOpenDetail = async (row) => {
    setSelectedLog(row)

    try {
      const result = await getAuditLogDetail(row.id)
      setSelectedLog(normalizeAuditRow(result.data))
    } catch {
      setSelectedLog(row)
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
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
          <article className="audit-summary-item">
            <AlertTriangle aria-hidden="true" />
            <span>Severity Count</span>
            <strong>
              H {Number(summary.severityCount.HIGH || 0).toLocaleString('id-ID')} / M {Number(summary.severityCount.MEDIUM || 0).toLocaleString('id-ID')}
            </strong>
          </article>
          <article className="audit-summary-item">
            <ShieldCheck aria-hidden="true" />
            <span>Category Count</span>
            <strong>
              D {Number(summary.categoryCount.Data || 0).toLocaleString('id-ID')} / S {Number(summary.categoryCount.Security || 0).toLocaleString('id-ID')}
            </strong>
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
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan="8">Belum ada audit log untuk filter ini.</td>
                  </tr>
                ) : null}
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
