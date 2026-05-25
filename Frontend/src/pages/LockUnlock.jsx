import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileLock2,
  FileText,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
  TimerReset,
  Unlock,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import {
  getAuditLogs,
  getDistributionLockSummary,
  getDistributions,
  lockDistribution,
  unlockDistribution,
} from '../services/api'
import './LockUnlock.css'

const PAGE_SIZE = 10

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

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return Boolean(value)
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
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

function normalizeDistribution(item) {
  const sppg = item.sppg || {}
  const school = item.school || {}
  const isLocked = parseBoolean(item.isLocked ?? item.is_locked)

  return {
    id: item.id,
    sppgName: item.sppgName || item.sppg_name || sppg.name || '-',
    schoolName: item.schoolName || item.school_name || school.name || '-',
    district: item.district || item.city || school.district || school.city || sppg.city || '-',
    province: item.province || school.province || sppg.province || '-',
    portions: Number(item.portions) || 0,
    distributionDate: item.distributionDate || item.distribution_date || item.date || item.createdAt || item.created_at,
    status: item.status || '-',
    isLocked,
    lockedBy: item.lockedByName || item.locked_by_name || item.lockedBy?.name || item.locked_by?.name || (isLocked ? 'Admin' : null),
    lockedAt: item.lockedAt || item.locked_at || (isLocked ? item.updatedAt || item.updated_at || item.createdAt || item.created_at : null),
    unlockedUntil: item.unlockedUntil || item.unlocked_until || null,
  }
}

function normalizeLog(item) {
  const user = item.user || {}
  const newData = item.newData || item.new_data || {}
  const action = String(item.action || 'LOCK').toUpperCase()
  const recordId = item.recordId || item.record_id || newData.id || item.distributionId || item.distribution_id

  return {
    id: item.id || `${action}-${recordId}-${item.createdAt || item.created_at || Date.now()}`,
    timestamp: item.timestamp || item.createdAt || item.created_at || new Date().toISOString(),
    admin: item.admin || item.adminName || item.userName || item.user_name || user.name || user.email || 'Admin',
    action,
    distributionId: item.distributionId || item.distribution_id || recordId || '-',
    reason: item.reason || newData.reason || item.description || 'Aksi lock/unlock distribusi tercatat di audit log.',
  }
}

function getModalTitle(action, row) {
  if (!row) return ''
  return action === 'lock' ? `Kunci Data Distribusi #${row.id}?` : `Buka Kunci Data Distribusi #${row.id}?`
}

function LockUnlock({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'umum'
  const displayName = userName || storedUser?.name || storedUser?.email || 'Admin MBG'
  const isAdmin = resolvedRole === 'admin'

  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ lockedCount: 0, editableCount: 0, autoLockPendingCount: 0 })
  const [logs, setLogs] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    lockStatus: 'all',
    dateFrom: '',
    dateTo: '',
    province: '',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAction, setModalAction] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [autoRelockAfterOneHour, setAutoRelockAfterOneHour] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchSummary = useCallback(async (signal) => {
    const result = await getDistributionLockSummary({ signal })
    setSummary({
      lockedCount: Number(result.data.lockedCount ?? result.data.locked_count ?? 0),
      editableCount: Number(result.data.editableCount ?? result.data.editable_count ?? 0),
      autoLockPendingCount: Number(result.data.autoLockPendingCount ?? result.data.auto_lock_pending_count ?? 0),
    })
  }, [])

  const fetchLogs = useCallback(async (signal) => {
    const [lockResult, unlockResult] = await Promise.all([
      getAuditLogs({ action: 'LOCK', tableName: 'distributions', limit: 5 }, { signal }),
      getAuditLogs({ action: 'UNLOCK', tableName: 'distributions', limit: 5 }, { signal }),
    ])
    const lockItems = Array.isArray(lockResult.data) ? lockResult.data : []
    const unlockItems = Array.isArray(unlockResult.data) ? unlockResult.data : []
    const normalized = [...lockItems, ...unlockItems]
      .map(normalizeLog)
      .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
      .slice(0, 5)
    setLogs(normalized)
  }, [])

  const fetchDistributions = useCallback(async (signal) => {
    if (!isAdmin) return
    setLoading(true)
    setError('')

    const params = {
      search: filters.search,
      isLocked: filters.lockStatus === 'all' ? undefined : filters.lockStatus === 'locked',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      province: filters.province,
      page,
      limit: PAGE_SIZE,
    }

    try {
      const result = await getDistributions(params, { signal })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      setRows(items.map(normalizeDistribution))
      setTotal(result.meta?.total || items.length)
      await fetchSummary(signal)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setRows([])
        setTotal(0)
        setError(fetchError.message || 'Data lock/unlock gagal dimuat dari API.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [fetchSummary, filters, isAdmin, page])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchDistributions(controller.signal)
      fetchLogs(controller.signal).catch(() => setLogs([]))
    })
    return () => controller.abort()
  }, [fetchDistributions, fetchLogs])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endEntry = Math.min(page * PAGE_SIZE, total)

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', lockStatus: 'all', dateFrom: '', dateTo: '', province: '' })
    setPage(1)
  }

  const openModal = (action, row) => {
    setModalAction(action)
    setSelectedRow(row)
    setReason('')
    setReasonError('')
    setAutoRelockAfterOneHour(true)
  }

  const closeModal = () => {
    setModalAction('')
    setSelectedRow(null)
    setReason('')
    setReasonError('')
    setAutoRelockAfterOneHour(true)
  }

  const validateReason = () => {
    if (!selectedRow) {
      setReasonError('Distribusi belum dipilih.')
      return false
    }

    if (reason.trim().length < 10) {
      setReasonError('Alasan wajib diisi minimal 10 karakter.')
      return false
    }

    setReasonError('')
    return true
  }

  const handleSubmit = async () => {
    if (!validateReason() || !selectedRow) return
    setSubmitLoading(true)

    try {
      const payload = { reason: reason.trim() }
      const result = modalAction === 'lock'
        ? await lockDistribution(selectedRow.id, payload)
        : await unlockDistribution(selectedRow.id, { ...payload, autoRelockAfterOneHour })
      const updatedRow = normalizeDistribution(result.data)

      setRows((current) => current.map((row) => (row.id === updatedRow.id ? updatedRow : row)))
      showToast(modalAction === 'lock' ? 'Data distribusi berhasil dikunci.' : 'Kunci data distribusi berhasil dibuka.', 'success')
      closeModal()

      const controller = new AbortController()
      await Promise.all([
        fetchSummary(controller.signal),
        fetchLogs(controller.signal).catch(() => undefined),
      ])
    } catch (submitError) {
      showToast(submitError.message || 'Aksi lock/unlock gagal.', 'danger')
    } finally {
      setSubmitLoading(false)
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

  if (!isAdmin) {
    return (
      <div className="lock-access-denied">
        <AlertTriangle aria-hidden="true" />
        <h1>Anda tidak memiliki akses ke halaman ini</h1>
      </div>
    )
  }

  return (
    <DashboardLayout userRole="admin" userName={displayName} currentPath={location.pathname} onLogout={handleLogout} notifCount={summary.autoLockPendingCount}>
      <div className="lock-page">
        <header className="lock-header">
          <div>
            <p className="lock-subtitle">Admin Only</p>
            <h1 className="lock-title">Lock / Unlock Data</h1>
            <p>Kontrol editabilitas data distribusi untuk memastikan integritas</p>
          </div>
        </header>

        {toast ? <div className={`lock-toast lock-toast-${toast.type}`}>{toast.message}</div> : null}

        <section className="lock-summary-grid" aria-label="Ringkasan lock distribusi">
          <article className="lock-summary-card">
            <span className="lock-summary-icon lock-summary-icon-warning">
              <FileLock2 aria-hidden="true" />
            </span>
            <span className="lock-summary-label">Data Terkunci</span>
            <strong className="lock-summary-value">{formatNumber(summary.lockedCount)}</strong>
          </article>
          <article className="lock-summary-card">
            <span className="lock-summary-icon lock-summary-icon-success">
              <Unlock aria-hidden="true" />
            </span>
            <span className="lock-summary-label">Data Bisa Diedit</span>
            <strong className="lock-summary-value">{formatNumber(summary.editableCount)}</strong>
          </article>
          <article className="lock-summary-card">
            <span className="lock-summary-icon lock-summary-icon-primary">
              <TimerReset aria-hidden="true" />
            </span>
            <span className="lock-summary-label">Auto-Lock Pending</span>
            <strong className="lock-summary-value">{formatNumber(summary.autoLockPendingCount)}</strong>
          </article>
        </section>

        <section className="lock-filter-card">
          <div className="lock-filter-grid">
            <label className="lock-filter-field lock-filter-field-wide">
              <span className="lock-label">Search</span>
              <span className="lock-search-wrap">
                <Search aria-hidden="true" />
                <input
                  className="lock-input"
                  name="search"
                  type="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Cari SPPG, sekolah, atau ID distribusi..."
                />
              </span>
            </label>

            <label className="lock-filter-field">
              <span className="lock-label">Status</span>
              <select className="lock-select" name="lockStatus" value={filters.lockStatus} onChange={handleFilterChange}>
                <option value="all">Semua</option>
                <option value="locked">Terkunci</option>
                <option value="editable">Bisa Diedit</option>
              </select>
            </label>

            <label className="lock-filter-field">
              <span className="lock-label">Date From</span>
              <input className="lock-input" name="dateFrom" type="date" value={filters.dateFrom} onChange={handleFilterChange} />
            </label>

            <label className="lock-filter-field">
              <span className="lock-label">Date To</span>
              <input className="lock-input" name="dateTo" type="date" value={filters.dateTo} onChange={handleFilterChange} />
            </label>

            <label className="lock-filter-field">
              <span className="lock-label">Provinsi</span>
              <select className="lock-select" name="province" value={filters.province} onChange={handleFilterChange}>
                <option value="">Semua Provinsi</option>
                {PROVINCES.map((provinceName) => (
                  <option key={provinceName} value={provinceName}>
                    {provinceName}
                  </option>
                ))}
              </select>
            </label>

            <button className="lock-reset-btn" type="button" onClick={resetFilters}>
              <RefreshCcw aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        </section>

        {error ? (
          <div className="lock-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="lock-table-card">
          {loading ? (
            <div className="lock-loading">
              <Loader2 aria-hidden="true" />
              Memuat data distribusi...
            </div>
          ) : null}

          <div className="lock-table-wrap">
            <table className="lock-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SPPG</th>
                  <th>Sekolah</th>
                  <th>Distrik</th>
                  <th>Porsi</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Dikunci Oleh</th>
                  <th>Dikunci Pada</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan="10">Tidak ada data distribusi untuk filter ini.</td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <tr key={row.id} className={row.isLocked ? 'lock-row-locked' : ''}>
                    <td>
                      <strong>#{row.id}</strong>
                    </td>
                    <td>
                      <strong>{row.sppgName}</strong>
                      <span>{row.province}</span>
                    </td>
                    <td>{row.schoolName}</td>
                    <td>{row.district}</td>
                    <td>{formatNumber(row.portions)}</td>
                    <td>{formatDate(row.distributionDate)}</td>
                    <td>
                      <span className={`lock-status-badge ${row.isLocked ? 'lock-status-locked' : 'lock-status-editable'}`}>
                        {row.isLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
                        {row.isLocked ? 'Terkunci' : 'Bisa Diedit'}
                      </span>
                    </td>
                    <td>{row.lockedBy || '-'}</td>
                    <td>
                      {formatDateTime(row.lockedAt)}
                      {!row.isLocked && row.unlockedUntil ? <span>Auto-lock {formatDateTime(row.unlockedUntil)}</span> : null}
                    </td>
                    <td>
                      <div className="lock-action-row">
                        {row.isLocked ? (
                          <button className="lock-btn lock-btn-success" type="button" onClick={() => openModal('unlock', row)}>
                            <Unlock aria-hidden="true" />
                            Unlock
                          </button>
                        ) : (
                          <button className="lock-btn lock-btn-warning" type="button" onClick={() => openModal('lock', row)}>
                            <Lock aria-hidden="true" />
                            Lock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="lock-table-footer">
            <span>
              Menampilkan {startEntry}-{endEntry} dari {formatNumber(total)} data
            </span>
            <div>
              <button className="lock-btn lock-btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              <button className="lock-btn lock-btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </footer>
        </section>

        <section className="lock-log-card">
          <header className="lock-log-header">
            <div>
              <p className="lock-subtitle">Audit Trail</p>
              <h2>Log Lock/Unlock Terbaru</h2>
            </div>
            <ClipboardList aria-hidden="true" />
          </header>

          <div className="lock-log-table-wrap">
            <table className="lock-log-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Aksi</th>
                  <th>Distribusi</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5">Belum ada audit lock/unlock.</td>
                  </tr>
                ) : null}
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.timestamp)}</td>
                    <td>{log.admin}</td>
                    <td>
                      <span className={`lock-log-badge ${log.action === 'UNLOCK' ? 'lock-log-unlock' : 'lock-log-lock'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>#{log.distributionId}</td>
                    <td>{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {modalAction && selectedRow ? (
          <div className="lock-modal-backdrop" role="presentation">
            <div className="lock-modal" role="dialog" aria-modal="true" aria-labelledby="lock-modal-title">
              <header className="lock-modal-header">
                <div>
                  <p className="lock-subtitle">{modalAction === 'lock' ? 'Konfirmasi Lock' : 'Konfirmasi Unlock'}</p>
                  <h2 id="lock-modal-title" className="lock-modal-title">{getModalTitle(modalAction, selectedRow)}</h2>
                </div>
                <button className="lock-modal-close" type="button" aria-label="Tutup modal" onClick={closeModal}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="lock-modal-body">
                <div className="lock-info-box">
                  <div>
                    <FileText aria-hidden="true" />
                    <span>SPPG</span>
                    <strong>{selectedRow.sppgName}</strong>
                  </div>
                  <div>
                    <ShieldCheck aria-hidden="true" />
                    <span>Sekolah</span>
                    <strong>{selectedRow.schoolName}</strong>
                  </div>
                  <div>
                    <CalendarClock aria-hidden="true" />
                    <span>Tanggal</span>
                    <strong>{formatDate(selectedRow.distributionDate)}</strong>
                  </div>
                  <div>
                    <ClipboardList aria-hidden="true" />
                    <span>Porsi</span>
                    <strong>{formatNumber(selectedRow.portions)}</strong>
                  </div>
                </div>

                {modalAction === 'lock' ? (
                  <div className="lock-warning-box">
                    Data yang dikunci tidak dapat diedit oleh SPPG. Hanya admin yang bisa unlock.
                  </div>
                ) : (
                  <div className="lock-warning-box">
                    SPPG akan memiliki window 1 jam untuk melakukan koreksi setelah unlock.
                  </div>
                )}

                <label className="lock-filter-field">
                  <span className="lock-label">{modalAction === 'lock' ? 'Alasan penguncian' : 'Alasan pembukaan kunci'}</span>
                  <textarea
                    className="lock-textarea"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      if (reasonError) setReasonError('')
                    }}
                    placeholder="Tulis alasan minimal 10 karakter..."
                    rows={4}
                  />
                  {reasonError ? <small className="lock-field-error">{reasonError}</small> : null}
                </label>

                {modalAction === 'unlock' ? (
                  <label className="lock-toggle-row">
                    <span>
                      <strong>Auto-lock kembali setelah 1 jam</strong>
                      <small>Backend menyimpan batas waktu koreksi lewat field unlockedUntil.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={autoRelockAfterOneHour}
                      onChange={(event) => setAutoRelockAfterOneHour(event.target.checked)}
                      aria-label="Auto-lock kembali setelah 1 jam"
                    />
                    <span className={`lock-switch ${autoRelockAfterOneHour ? 'lock-switch-active' : ''}`}>
                      <i />
                    </span>
                  </label>
                ) : null}

                <div className="lock-modal-actions">
                  <button className="lock-btn lock-btn-secondary" type="button" onClick={closeModal}>
                    Batal
                  </button>
                  <button
                    className={`lock-btn ${modalAction === 'lock' ? 'lock-btn-warning' : 'lock-btn-success'}`}
                    type="button"
                    disabled={submitLoading}
                    onClick={handleSubmit}
                  >
                    {submitLoading ? <Loader2 aria-hidden="true" /> : modalAction === 'lock' ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
                    {modalAction === 'lock' ? 'Kunci Data' : 'Buka Kunci'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default LockUnlock
