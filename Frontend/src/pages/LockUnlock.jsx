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
import { apiRequest as requestJson } from '../services/api'
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

const FALLBACK_DISTRIBUTIONS = [
  ['DST-1001', 'SPPG Bandung Selatan', 'SDN Nusantara 01', 'Bandung', 'Jawa Barat', 450, '2026-05-18', true, 'Super Admin', '2026-05-18T09:15:00Z'],
  ['DST-1002', 'SPPG Bandung Selatan', 'SMP Negeri 4 Cibinong', 'Bogor', 'Jawa Barat', 620, '2026-05-18', false, null, null],
  ['DST-1003', 'SPPG Surabaya Utara', 'SDN Kenjeran 02', 'Surabaya', 'Jawa Timur', 510, '2026-05-18', true, 'Admin Nasional', '2026-05-18T08:30:00Z'],
  ['DST-1004', 'SPPG Semarang Barat', 'SDN Pamularsih 01', 'Semarang', 'Jawa Tengah', 380, '2026-05-17', false, null, null],
  ['DST-1005', 'SPPG Jakarta Timur', 'SDN Rawamangun 03', 'Jakarta Timur', 'DKI Jakarta', 720, '2026-05-17', true, 'Super Admin', '2026-05-17T15:02:00Z'],
  ['DST-1006', 'SPPG Medan Kota', 'SMP Negeri 7 Medan', 'Medan', 'Sumatera Utara', 540, '2026-05-17', false, null, null],
  ['DST-1007', 'SPPG Makassar Mariso', 'SDN Mariso 02', 'Makassar', 'Sulawesi Selatan', 430, '2026-05-16', true, 'Admin Nasional', '2026-05-16T11:40:00Z'],
  ['DST-1008', 'SPPG Denpasar Timur', 'SDN Dangin Puri', 'Denpasar', 'Bali', 350, '2026-05-16', false, null, null],
  ['DST-1009', 'SPPG Jayapura Abepura', 'SDN Abepura 01', 'Jayapura', 'Papua', 410, '2026-05-15', true, 'Super Admin', '2026-05-15T13:20:00Z'],
  ['DST-1010', 'SPPG Banjarmasin Barat', 'SMP Negeri 2 Banjarmasin', 'Banjarmasin', 'Kalimantan Selatan', 590, '2026-05-15', false, null, null],
  ['DST-1011', 'SPPG Kupang Oebobo', 'SDN Oebobo 04', 'Kupang', 'Nusa Tenggara Timur', 320, '2026-05-14', true, 'Admin Nasional', '2026-05-14T10:12:00Z'],
  ['DST-1012', 'SPPG Palu Mantikulore', 'SDN Palu Timur', 'Palu', 'Sulawesi Tengah', 460, '2026-05-14', false, null, null],
  ['DST-1013', 'SPPG Pontianak Sungai Raya', 'SDN Sungai Raya 02', 'Pontianak', 'Kalimantan Barat', 570, '2026-05-13', true, 'Super Admin', '2026-05-13T16:45:00Z'],
  ['DST-1014', 'SPPG Mataram Ampenan', 'SDN Ampenan 03', 'Mataram', 'Nusa Tenggara Barat', 390, '2026-05-13', false, null, null],
  ['DST-1015', 'SPPG Manado Wenang', 'SMP Negeri 1 Manado', 'Manado', 'Sulawesi Utara', 500, '2026-05-12', true, 'Admin Nasional', '2026-05-12T07:50:00Z'],
].map((item, index) => ({
  id: item[0],
  sppgName: item[1],
  schoolName: item[2],
  district: item[3],
  province: item[4],
  portions: item[5],
  distributionDate: item[6],
  status: index % 4 === 0 ? 'delivered' : 'in_progress',
  isLocked: item[7],
  lockedBy: item[8],
  lockedAt: item[9],
  unlockedUntil: !item[7] && index % 5 === 0 ? new Date(Date.now() + 45 * 60 * 1000).toISOString() : null,
}))

const FALLBACK_LOGS = [
  ['2026-05-18T09:15:00Z', 'Super Admin', 'LOCK', 'DST-1001', 'Distribusi sudah selesai divalidasi sekolah.'],
  ['2026-05-18T08:30:00Z', 'Admin Nasional', 'LOCK', 'DST-1003', 'Data final untuk laporan harian.'],
  ['2026-05-17T15:20:00Z', 'Super Admin', 'UNLOCK', 'DST-0998', 'Koreksi porsi diterima dari sekolah.'],
  ['2026-05-17T12:10:00Z', 'Admin Nasional', 'LOCK', 'DST-0994', 'Menutup data setelah audit validasi.'],
  ['2026-05-16T10:30:00Z', 'Super Admin', 'UNLOCK', 'DST-0988', 'Koreksi foto bukti distribusi.'],
].map((item, index) => ({
  id: `fallback-log-${index + 1}`,
  timestamp: item[0],
  admin: item[1],
  action: item[2],
  distributionId: item[3],
  reason: item[4],
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
    lockedBy: item.lockedByName || item.locked_by_name || item.lockedBy?.name || item.locked_by?.name || (isLocked ? '-' : null),
    lockedAt: item.lockedAt || item.locked_at || (isLocked ? item.updatedAt || item.updated_at || item.createdAt || item.created_at : null),
    unlockedUntil: item.unlockedUntil || item.unlocked_until || null,
  }
}

function normalizeLog(item) {
  const user = item.user || {}
  const newData = item.newData || item.new_data || {}
  const metadata = item.metadata || {}
  const action = String(item.action || 'LOCK').toUpperCase()
  const recordId = item.recordId || item.record_id || newData.id || item.distributionId || item.distribution_id

  return {
    id: item.id || `${action}-${recordId}-${item.createdAt || item.created_at || Date.now()}`,
    timestamp: item.timestamp || item.createdAt || item.created_at || new Date().toISOString(),
    admin: item.admin || item.adminName || item.userName || user.name || user.email || 'Admin',
    action,
    distributionId: item.distributionId || item.distribution_id || recordId || '-',
    reason: item.reason || metadata.reason || item.description || 'Aksi lock/unlock distribusi tercatat di audit log.',
  }
}

function applyLocalFilters(rows, filters) {
  return rows.filter((row) => {
    const keyword = filters.search.trim().toLowerCase()
    const distributionDate = new Date(row.distributionDate)
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
    const matchesSearch = !keyword || [row.id, row.sppgName, row.schoolName, row.district].some((value) => String(value).toLowerCase().includes(keyword))
    const matchesStatus = filters.lockStatus === 'all' || (filters.lockStatus === 'locked' ? row.isLocked : !row.isLocked)
    const matchesProvince = !filters.province || row.province === filters.province
    const matchesFrom = !dateFrom || distributionDate >= dateFrom
    const matchesTo = !dateTo || distributionDate <= dateTo

    return matchesSearch && matchesStatus && matchesProvince && matchesFrom && matchesTo
  })
}

function buildSummary(rows) {
  const now = new Date()
  return {
    lockedCount: rows.filter((row) => row.isLocked).length,
    editableCount: rows.filter((row) => !row.isLocked).length,
    autoLockPendingCount: rows.filter((row) => !row.isLocked && row.unlockedUntil && new Date(row.unlockedUntil) > now).length,
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
  const [summary, setSummary] = useState({ lockedCount: 23, editableCount: 156, autoLockPendingCount: 8 })
  const [logs, setLogs] = useState(FALLBACK_LOGS)
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

  const filteredFallbackRows = useMemo(() => applyLocalFilters(FALLBACK_DISTRIBUTIONS, filters), [filters])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchSummary = useCallback(async (signal, fallbackRows = []) => {
    try {
      const result = await requestJson('/distributions/lock-summary', { signal })
      setSummary({
        lockedCount: Number(result.data.lockedCount ?? result.data.locked_count ?? 0),
        editableCount: Number(result.data.editableCount ?? result.data.editable_count ?? 0),
        autoLockPendingCount: Number(result.data.autoLockPendingCount ?? result.data.auto_lock_pending_count ?? 0),
      })
    } catch {
      setSummary(buildSummary(fallbackRows.length ? fallbackRows : FALLBACK_DISTRIBUTIONS))
    }
  }, [])

  const fetchLogs = useCallback(async (signal) => {
    try {
      let normalized = []

      try {
        const result = await requestJson('/audit-logs', {
          params: { action: 'LOCK,UNLOCK', limit: 5 },
          signal,
        })
        const items = Array.isArray(result.data) ? result.data : result.data?.items || []
        normalized = items.map(normalizeLog)
      } catch {
        const [lockResult, unlockResult] = await Promise.allSettled([
          requestJson('/admin/audit-logs', { params: { action: 'LOCK', table_name: 'distributions', limit: 5 }, signal }),
          requestJson('/admin/audit-logs', { params: { action: 'UNLOCK', table_name: 'distributions', limit: 5 }, signal }),
        ])
        const lockItems = lockResult.status === 'fulfilled' && Array.isArray(lockResult.value.data) ? lockResult.value.data : []
        const unlockItems = unlockResult.status === 'fulfilled' && Array.isArray(unlockResult.value.data) ? unlockResult.value.data : []
        normalized = [...lockItems, ...unlockItems]
          .map(normalizeLog)
          .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
          .slice(0, 5)
      }

      setLogs(normalized.length ? normalized : FALLBACK_LOGS)
    } catch {
      setLogs(FALLBACK_LOGS)
    }
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
      const result = await requestJson('/distributions', { params, signal })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      let normalized = items.map(normalizeDistribution)

      if (!normalized.length) {
        normalized = filteredFallbackRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        setRows(normalized)
        setTotal(filteredFallbackRows.length)
        setError('Data distribusi API kosong. Fallback preview ditampilkan sementara.')
        await fetchSummary(signal, filteredFallbackRows)
        return
      }

      normalized = applyLocalFilters(normalized, filters)
      setRows(normalized)
      setTotal(result.meta?.total || normalized.length)
      await fetchSummary(signal, normalized)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        const fallback = filteredFallbackRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        setRows(fallback)
        setTotal(filteredFallbackRows.length)
        setError('Data lock/unlock gagal dimuat dari API. Fallback preview ditampilkan.')
        await fetchSummary(signal, filteredFallbackRows)
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [fetchSummary, filteredFallbackRows, filters, isAdmin, page])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchDistributions(controller.signal)
      fetchLogs(controller.signal)
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

  const upsertLocalRow = (nextRow) => {
    setRows((current) => current.map((row) => (row.id === nextRow.id ? nextRow : row)))
  }

  const prependLog = (action, row) => {
    const nextLog = {
      id: `${action}-${row.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      admin: displayName,
      action: action.toUpperCase(),
      distributionId: row.id,
      reason: reason.trim(),
    }
    setLogs((current) => [nextLog, ...current].slice(0, 5))
  }

  const callLockEndpoint = async (row) => {
    const payload = { reason: reason.trim() }
    try {
      return await requestJson(`/distributions/${row.id}/lock`, { method: 'PATCH', body: payload })
    } catch {
      return requestJson(`/admin/distributions/${row.id}/lock`, { method: 'POST', body: payload })
    }
  }

  const callUnlockEndpoint = async (row) => {
    const payload = {
      reason: reason.trim(),
      autoRelockAfterOneHour,
    }
    try {
      return await requestJson(`/distributions/${row.id}/unlock`, { method: 'PATCH', body: payload })
    } catch {
      return requestJson(`/admin/distributions/${row.id}/unlock`, { method: 'POST', body: payload })
    }
  }

  const handleSubmit = async () => {
    if (!validateReason() || !selectedRow) return
    setSubmitLoading(true)

    try {
      const result = modalAction === 'lock' ? await callLockEndpoint(selectedRow) : await callUnlockEndpoint(selectedRow)
      const now = new Date().toISOString()
      const updatedFromApi = result?.data ? normalizeDistribution(result.data) : null
      const updatedRow = modalAction === 'lock'
        ? {
            ...selectedRow,
            ...(updatedFromApi || {}),
            isLocked: true,
            lockedBy: displayName,
            lockedAt: now,
            unlockedUntil: null,
          }
        : {
            ...selectedRow,
            ...(updatedFromApi || {}),
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            unlockedUntil: autoRelockAfterOneHour ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : updatedFromApi?.unlockedUntil || null,
          }

      upsertLocalRow(updatedRow)
      prependLog(modalAction, selectedRow)
      setSummary((current) => {
        const currentRows = rows.map((row) => (row.id === updatedRow.id ? updatedRow : row))
        return rows.length ? buildSummary(currentRows) : current
      })
      showToast(modalAction === 'lock' ? 'Data distribusi berhasil dikunci.' : 'Kunci data distribusi berhasil dibuka.', 'success')
      closeModal()
      fetchLogs(new AbortController().signal)
    } catch (submitError) {
      if (import.meta.env.DEV) {
        const localRow = modalAction === 'lock'
          ? { ...selectedRow, isLocked: true, lockedBy: displayName, lockedAt: new Date().toISOString(), unlockedUntil: null }
          : {
              ...selectedRow,
              isLocked: false,
              lockedBy: null,
              lockedAt: null,
              unlockedUntil: autoRelockAfterOneHour ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
            }
        upsertLocalRow(localRow)
        prependLog(modalAction, selectedRow)
        setSummary(buildSummary(rows.map((row) => (row.id === localRow.id ? localRow : row))))
        showToast('Endpoint lock/unlock belum lengkap. Fallback development memperbarui state lokal.', 'warning')
        closeModal()
      } else {
        showToast(submitError.message || 'Aksi lock/unlock gagal.', 'danger')
      }
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
                      <small>Frontend mengirim flag ini, eksekusi jadwal tetap ditangani backend.</small>
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
