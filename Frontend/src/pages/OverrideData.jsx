import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileWarning,
  Loader2,
  Search,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './OverrideData.css'

const PAGE_SIZE = 10
const HISTORY_LIMIT = 10

const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'in_progress' },
  { value: 'delivered', label: 'delivered' },
  { value: 'failed', label: 'failed' },
]

const FALLBACK_ROWS = [
  {
    id: 2001,
    sppgName: 'SPPG Bandung Selatan',
    schoolName: 'SDN Nusantara 01',
    province: 'Jawa Barat',
    city: 'Bandung',
    portions: 680,
    pricePerPortion: 12500,
    totalCost: 8500000,
    status: 'delivered',
    failureReason: '',
    distributionDate: '2026-05-18',
    lockedBy: 'Super Admin',
    lockedAt: '2026-05-18T09:15:00Z',
    hasOverride: true,
    isLocked: true,
  },
  {
    id: 2002,
    sppgName: 'SPPG Surabaya Utara',
    schoolName: 'SMPN 5 Surabaya',
    province: 'Jawa Timur',
    city: 'Surabaya',
    portions: 540,
    pricePerPortion: 11800,
    totalCost: 6372000,
    status: 'delivered',
    failureReason: '',
    distributionDate: '2026-05-18',
    lockedBy: 'Admin Nasional',
    lockedAt: '2026-05-18T08:40:00Z',
    hasOverride: false,
    isLocked: true,
  },
  {
    id: 2003,
    sppgName: 'SPPG Jakarta Timur',
    schoolName: 'SDN Rawamangun 03',
    province: 'DKI Jakarta',
    city: 'Jakarta Timur',
    portions: 720,
    pricePerPortion: 13200,
    totalCost: 9504000,
    status: 'failed',
    failureReason: 'Kendaraan distribusi rusak',
    distributionDate: '2026-05-17',
    lockedBy: 'Super Admin',
    lockedAt: '2026-05-17T14:25:00Z',
    hasOverride: false,
    isLocked: true,
  },
  {
    id: 2004,
    sppgName: 'SPPG Makassar Mariso',
    schoolName: 'SDN Mariso 02',
    province: 'Sulawesi Selatan',
    city: 'Makassar',
    portions: 430,
    pricePerPortion: 12250,
    totalCost: 5267500,
    status: 'delivered',
    failureReason: '',
    distributionDate: '2026-05-16',
    lockedBy: 'Admin Nasional',
    lockedAt: '2026-05-16T11:40:00Z',
    hasOverride: true,
    isLocked: true,
  },
  {
    id: 2005,
    sppgName: 'SPPG Jayapura Abepura',
    schoolName: 'SDN Abepura 01',
    province: 'Papua',
    city: 'Jayapura',
    portions: 410,
    pricePerPortion: 16800,
    totalCost: 6888000,
    status: 'delivered',
    failureReason: '',
    distributionDate: '2026-05-15',
    lockedBy: 'Super Admin',
    lockedAt: '2026-05-15T13:20:00Z',
    hasOverride: false,
    isLocked: true,
  },
]

const FALLBACK_HISTORY = Array.from({ length: 10 }, (_, index) => {
  const oldData = {
    portions: 650 + index * 10,
    pricePerPortion: 12000 + index * 100,
    status: index % 3 === 0 ? 'failed' : 'delivered',
    failureReason: index % 3 === 0 ? 'Kendala armada' : null,
  }
  const newData = {
    ...oldData,
    portions: oldData.portions + 20,
    pricePerPortion: oldData.pricePerPortion + 250,
    override: true,
    overrideReason: 'Koreksi resmi berdasarkan berita acara lapangan dan validasi admin.',
  }

  return {
    id: `fallback-history-${index + 1}`,
    timestamp: new Date(Date.UTC(2026, 4, 18, 9, 30 - index * 2, 0)).toISOString(),
    admin: index % 2 === 0 ? 'Super Admin' : 'Admin Nasional',
    distributionId: 2001 + index,
    changedFields: ['portions', 'pricePerPortion'],
    reason: newData.overrideReason,
    ipAddress: `192.168.10.${index + 20}`,
    userAgent: 'Mozilla/5.0 MBG Admin Dashboard',
    oldData,
    newData,
  }
})

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

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
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
  const pricePerPortion = Number(item.pricePerPortion ?? item.price_per_portion) || 0
  const portions = Number(item.portions) || 0

  return {
    id: item.id,
    sppgName: item.sppgName || item.sppg_name || sppg.name || '-',
    schoolName: item.schoolName || item.school_name || school.name || '-',
    province: item.province || school.province || sppg.province || '-',
    city: item.city || school.city || sppg.city || '-',
    portions,
    pricePerPortion,
    totalCost: Number(item.totalCost ?? item.total_cost) || portions * pricePerPortion,
    status: item.status || 'in_progress',
    failureReason: item.failureReason || item.failure_reason || '',
    distributionDate: item.distributionDate || item.distribution_date || item.createdAt || item.created_at,
    lockedBy: item.lockedByName || item.locked_by_name || item.lockedBy?.name || item.locked_by?.name || '-',
    lockedAt: item.lockedAt || item.locked_at || item.updatedAt || item.updated_at || item.createdAt || item.created_at,
    hasOverride: Boolean(item.hasOverride || item.has_override || item.override || item.metadata?.override),
    isLocked: Boolean(item.isLocked ?? item.is_locked),
    raw: item,
  }
}

function getChangedFields(oldData = {}, newData = {}) {
  return ['portions', 'pricePerPortion', 'price_per_portion', 'status', 'failureReason', 'failure_reason']
    .filter((key) => JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key]))
    .map((key) => {
      if (key === 'price_per_portion') return 'pricePerPortion'
      if (key === 'failure_reason') return 'failureReason'
      return key
    })
    .filter((value, index, items) => items.indexOf(value) === index)
}

function normalizeHistoryRow(item) {
  const user = item.user || {}
  const oldData = item.oldData || item.old_data || {}
  const newData = item.newData || item.new_data || {}
  const overrideReason = newData.overrideReason || newData.override_reason || item.reason || item.metadata?.reason

  return {
    id: item.id,
    timestamp: item.timestamp || item.createdAt || item.created_at || new Date().toISOString(),
    admin: item.admin || item.adminName || item.userName || user.name || user.email || 'Admin',
    distributionId: item.distributionId || item.distribution_id || item.recordId || item.record_id || newData.id || '-',
    changedFields: item.changedFields || getChangedFields(oldData, newData),
    reason: overrideReason || 'Override data distribusi.',
    ipAddress: item.ipAddress || item.ip_address || '-',
    userAgent: item.userAgent || item.user_agent || '-',
    oldData,
    newData,
  }
}

function isOverrideAuditRow(item) {
  const newData = item.newData || item.new_data || {}
  return Boolean(newData.override || newData.overrideReason || newData.override_reason || item.metadata?.override)
}

function applyLocalFilters(rows, filters) {
  return rows.filter((row) => {
    const keyword = filters.search.trim().toLowerCase()
    const distributionDate = new Date(row.distributionDate)
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
    const matchesSearch = !keyword || [row.id, row.sppgName, row.schoolName, row.province, row.city].some((value) => String(value).toLowerCase().includes(keyword))
    const matchesStatus = !filters.status || row.status === filters.status
    const matchesProvince = !filters.province || row.province === filters.province
    const matchesFrom = !dateFrom || distributionDate >= dateFrom
    const matchesTo = !dateTo || distributionDate <= dateTo
    return row.isLocked && matchesSearch && matchesStatus && matchesProvince && matchesFrom && matchesTo
  })
}

function makeInitialForm(row) {
  return {
    portions: row?.portions ? String(row.portions) : '',
    pricePerPortion: row?.pricePerPortion ? String(row.pricePerPortion) : '',
    status: row?.status || 'in_progress',
    failureReason: row?.status === 'failed' ? row?.failureReason || '' : '',
    reason: '',
    confirmAudit: false,
  }
}

function buildChanges(row, form) {
  if (!row) return {}
  const nextFailureReason = form.status === 'failed' ? form.failureReason.trim() : null
  const candidates = {
    portions: Number(form.portions),
    pricePerPortion: Number(form.pricePerPortion),
    status: form.status,
    failureReason: nextFailureReason,
  }
  const currentFailureReason = row.status === 'failed' ? row.failureReason || '' : null
  const changes = {}

  if (candidates.portions !== Number(row.portions)) changes.portions = candidates.portions
  if (candidates.pricePerPortion !== Number(row.pricePerPortion)) changes.pricePerPortion = candidates.pricePerPortion
  if (candidates.status !== row.status) changes.status = candidates.status
  if ((candidates.failureReason || null) !== (currentFailureReason || null)) changes.failureReason = candidates.failureReason

  return changes
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function OverrideData({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'umum'
  const displayName = userName || storedUser?.name || storedUser?.email || 'Admin MBG'
  const isAdmin = resolvedRole === 'admin'

  const [rows, setRows] = useState([])
  const [historyRows, setHistoryRows] = useState(FALLBACK_HISTORY)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    province: '',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [toast, setToast] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(makeInitialForm(null))
  const [formErrors, setFormErrors] = useState({})
  const [submitLoading, setSubmitLoading] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState('')

  const filteredFallbackRows = useMemo(() => applyLocalFilters(FALLBACK_ROWS, filters), [filters])
  const provinceOptions = useMemo(() => {
    const values = [...FALLBACK_ROWS, ...rows]
      .map((row) => row.province)
      .filter((value) => value && value !== '-')
    return [...new Set(values)].sort()
  }, [rows])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3400)
  }, [])

  const fetchLockedRows = useCallback(async (signal) => {
    if (!isAdmin) return
    setLoading(true)
    setError('')

    try {
      const result = await requestJson('/distributions', {
        params: {
          isLocked: true,
          search: filters.search,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          province: filters.province,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = applyLocalFilters(items.map(normalizeDistribution), filters)

      if (!normalized.length) {
        setRows(filteredFallbackRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(filteredFallbackRows.length)
        setError('Data distribusi terkunci API kosong. Fallback preview ditampilkan sementara.')
        return
      }

      setRows(normalized)
      setTotal(result.meta?.total || normalized.length)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setRows(filteredFallbackRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(filteredFallbackRows.length)
        setError('Data distribusi terkunci gagal dimuat dari API. Fallback preview ditampilkan.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filteredFallbackRows, filters, isAdmin, page])

  const fetchHistory = useCallback(async (signal) => {
    if (!isAdmin) return
    setHistoryError('')

    try {
      let items = []

      try {
        const result = await requestJson('/audit-logs', {
          params: {
            action: 'OVERRIDE',
            tableName: 'distributions',
            limit: HISTORY_LIMIT,
          },
          signal,
        })
        items = Array.isArray(result.data) ? result.data : result.data?.items || []
      } catch {
        // TODO: Backend existing belum punya AuditAction OVERRIDE, jadi override dicatat sebagai UPDATE + newData.override.
        const result = await requestJson('/admin/audit-logs', {
          params: {
            action: 'UPDATE',
            table_name: 'distributions',
            limit: 50,
          },
          signal,
        })
        items = Array.isArray(result.data) ? result.data : result.data?.items || []
        items = items.filter(isOverrideAuditRow).slice(0, HISTORY_LIMIT)
      }

      const normalized = items.map(normalizeHistoryRow)
      setHistoryRows(normalized.length ? normalized : FALLBACK_HISTORY)
      if (!normalized.length) setHistoryError('Riwayat override API kosong. Fallback preview ditampilkan sementara.')
    } catch {
      setHistoryRows(FALLBACK_HISTORY)
      setHistoryError('Riwayat override gagal dimuat dari API. Fallback preview ditampilkan.')
    }
  }, [isAdmin])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchLockedRows(controller.signal)
      fetchHistory(controller.signal)
    })
    return () => controller.abort()
  }, [fetchHistory, fetchLockedRows])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endEntry = Math.min(page * PAGE_SIZE, total)
  const changes = useMemo(() => buildChanges(selectedRow, form), [form, selectedRow])
  const changedFieldNames = Object.keys(changes)

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', status: '', dateFrom: '', dateTo: '', province: '' })
    setPage(1)
  }

  const fetchDetail = async (row) => {
    if (!String(row.id).match(/^\d+$/)) return row

    try {
      const result = await requestJson(`/distributions/${row.id}`)
      return normalizeDistribution(result.data)
    } catch {
      return row
    }
  }

  const openModal = async (row) => {
    const detail = await fetchDetail(row)
    setSelectedRow(detail)
    setForm(makeInitialForm(detail))
    setFormErrors({})
    setStep(1)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitLoading) return
    setModalOpen(false)
    setSelectedRow(null)
    setForm(makeInitialForm(null))
    setFormErrors({})
    setStep(1)
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value }
      if (name === 'status' && value !== 'failed') next.failureReason = ''
      return next
    })
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const validateCorrection = () => {
    const errors = {}
    if (!selectedRow) errors.general = 'Distribusi belum dipilih.'
    if (!Number(form.portions) || Number(form.portions) <= 0) errors.portions = 'Jumlah porsi wajib lebih dari 0.'
    if (!Number(form.pricePerPortion) || Number(form.pricePerPortion) <= 0) errors.pricePerPortion = 'Harga per porsi wajib lebih dari 0.'
    if (form.status === 'failed' && form.failureReason.trim().length < 3) errors.failureReason = 'Failure reason wajib diisi jika status failed.'
    if (form.reason.trim().length < 20) errors.reason = 'Alasan override minimal 20 karakter.'
    if (!form.confirmAudit) errors.confirmAudit = 'Konfirmasi audit wajib dicentang.'
    if (changedFieldNames.length === 0) errors.general = 'Minimal ada 1 field yang berubah.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goToFinalStep = () => {
    if (validateCorrection()) setStep(3)
  }

  const callOverrideEndpoint = async (row, payload) => {
    try {
      return await requestJson(`/distributions/${row.id}/override`, {
        method: 'PATCH',
        body: payload,
      })
    } catch {
      // TODO: Backend existing memakai /admin + PUT dan override dicatat sebagai UPDATE dengan marker override.
      return requestJson(`/admin/distributions/${row.id}/override`, {
        method: 'PUT',
        body: {
          ...payload.changes,
          overrideReason: payload.reason,
        },
      })
    }
  }

  const handleOverrideSubmit = async () => {
    if (!validateCorrection() || !selectedRow) return
    setSubmitLoading(true)

    const payload = {
      changes,
      reason: form.reason.trim(),
      confirmAudit: true,
    }

    try {
      const result = await callOverrideEndpoint(selectedRow, payload)
      const normalized = normalizeDistribution(result.data)
      const updatedRow = {
        ...selectedRow,
        ...normalized,
        ...changes,
        failureReason: changes.failureReason === null ? '' : changes.failureReason ?? selectedRow.failureReason,
        hasOverride: true,
        isLocked: true,
      }
      setRows((current) => current.map((row) => (row.id === selectedRow.id ? updatedRow : row)))
      setHistoryRows((current) => [
        normalizeHistoryRow({
          id: `local-${Date.now()}`,
          createdAt: new Date().toISOString(),
          userName: displayName,
          recordId: selectedRow.id,
          oldData: selectedRow,
          newData: {
            ...updatedRow,
            override: true,
            overrideReason: form.reason.trim(),
          },
        }),
        ...current,
      ].slice(0, HISTORY_LIMIT))
      showToast('Override berhasil diterapkan dan dicatat di audit log.', 'success')
      closeModal()
      fetchHistory(new AbortController().signal)
    } catch (submitError) {
      if (import.meta.env.DEV) {
        const updatedRow = {
          ...selectedRow,
          ...changes,
          failureReason: changes.failureReason === null ? '' : changes.failureReason ?? selectedRow.failureReason,
          totalCost: (changes.portions ?? selectedRow.portions) * (changes.pricePerPortion ?? selectedRow.pricePerPortion),
          hasOverride: true,
          isLocked: true,
        }
        setRows((current) => current.map((row) => (row.id === selectedRow.id ? updatedRow : row)))
        setHistoryRows((current) => [
          normalizeHistoryRow({
            id: `fallback-submit-${Date.now()}`,
            createdAt: new Date().toISOString(),
            userName: displayName,
            recordId: selectedRow.id,
            oldData: selectedRow,
            newData: {
              ...updatedRow,
              override: true,
              overrideReason: form.reason.trim(),
            },
          }),
          ...current,
        ].slice(0, HISTORY_LIMIT))
        showToast('Endpoint override belum lengkap/login belum aktif. Fallback development memperbarui state lokal.', 'warning')
        closeModal()
      } else {
        showToast(submitError.message || 'Override gagal diterapkan.', 'danger')
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
      <div className="override-access-denied">
        <AlertTriangle aria-hidden="true" />
        <h1>Anda tidak memiliki akses ke halaman ini</h1>
      </div>
    )
  }

  return (
    <DashboardLayout userRole="admin" userName={displayName} currentPath={location.pathname} onLogout={handleLogout} notifCount={historyRows.length}>
      <div className="override-page">
        <header className="override-header">
          <div>
            <p className="override-subtitle">Admin Only</p>
            <h1 className="override-title">Override Data</h1>
            <p>Force update data terkunci dengan otorisasi admin</p>
          </div>
        </header>

        {toast ? <div className={`override-toast override-toast-${toast.type}`}>{toast.message}</div> : null}

        <section className="override-warning-banner">
          <AlertTriangle aria-hidden="true" />
          <span>
            Fitur ini hanya untuk koreksi data yang terbukti salah akibat error sistem. Semua aksi override dicatat di audit log dan memerlukan alasan yang valid. Gunakan dengan sangat hati-hati.
          </span>
        </section>

        <section className="override-filter-card">
          <div className="override-filter-grid">
            <label className="override-filter-field override-filter-field-wide">
              <span className="override-label">Search</span>
              <span className="override-search-wrap">
                <Search aria-hidden="true" />
                <input
                  className="override-search override-input"
                  name="search"
                  type="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Cari data terkunci yang perlu dikoreksi..."
                />
              </span>
            </label>
            <label className="override-filter-field">
              <span className="override-label">Status</span>
              <select className="override-select" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Semua Status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="override-filter-field">
              <span className="override-label">Date From</span>
              <input className="override-input" name="dateFrom" type="date" value={filters.dateFrom} onChange={handleFilterChange} />
            </label>
            <label className="override-filter-field">
              <span className="override-label">Date To</span>
              <input className="override-input" name="dateTo" type="date" value={filters.dateTo} onChange={handleFilterChange} />
            </label>
            <label className="override-filter-field">
              <span className="override-label">Provinsi</span>
              <select className="override-select" name="province" value={filters.province} onChange={handleFilterChange}>
                <option value="">Semua Provinsi</option>
                {provinceOptions.map((province) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </label>
            <button className="override-btn override-btn-secondary" type="button" onClick={() => {
              resetFilters()
            }}>
              Reset
            </button>
          </div>
        </section>

        {error ? (
          <div className="override-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="override-table-card">
          {loading ? (
            <div className="override-loading">
              <Loader2 aria-hidden="true" />
              Memuat data terkunci...
            </div>
          ) : null}
          <div className="override-table-wrap">
            <table className="override-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SPPG</th>
                  <th>Sekolah</th>
                  <th>Nilai Saat Ini</th>
                  <th>Dikunci Oleh</th>
                  <th>Dikunci Pada</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>#{row.id}</strong>
                      {row.hasOverride ? <span className="override-changed-badge">Sudah diubah</span> : null}
                    </td>
                    <td>
                      <strong>{row.sppgName}</strong>
                      <span>{row.city}, {row.province}</span>
                    </td>
                    <td>{row.schoolName}</td>
                    <td>
                      <div className="override-current-values">
                        <span>Porsi: {formatNumber(row.portions)}</span>
                        <span>Harga/Porsi: {formatRupiah(row.pricePerPortion)}</span>
                        <span>Status: {row.status}</span>
                        <span>Total Cost: {formatRupiah(row.totalCost)}</span>
                      </div>
                    </td>
                    <td>{row.lockedBy || '-'}</td>
                    <td>{formatDateTime(row.lockedAt)}</td>
                    <td>
                      <button className="override-action-btn" type="button" onClick={() => openModal(row)}>
                        <ShieldAlert aria-hidden="true" />
                        Override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="override-table-footer">
            <span>Menampilkan {startEntry}-{endEntry} dari {formatNumber(total)} data</span>
            <div>
              <button className="override-btn override-btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <button className="override-btn override-btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          </footer>
        </section>

        <section className="override-history-card">
          <header className="override-history-header">
            <div>
              <p className="override-subtitle">Audit Trail</p>
              <h2>Riwayat Override Terbaru</h2>
            </div>
            <ClipboardList aria-hidden="true" />
          </header>

          {historyError ? (
            <div className="override-error">
              <AlertTriangle aria-hidden="true" />
              <span>{historyError}</span>
            </div>
          ) : null}

          <div className="override-history-table-wrap">
            <table className="override-history-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Distribusi</th>
                  <th>Field Diubah</th>
                  <th>Alasan</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  const expanded = expandedHistoryId === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>{formatDateTime(row.timestamp)}</td>
                        <td>{row.admin}</td>
                        <td>#{row.distributionId}</td>
                        <td>{row.changedFields.length ? row.changedFields.join(', ') : '-'}</td>
                        <td>{row.reason}</td>
                        <td>
                          <button className="override-btn override-btn-secondary" type="button" aria-expanded={expanded} onClick={() => setExpandedHistoryId(expanded ? '' : row.id)}>
                            <Eye aria-hidden="true" />
                            Detail
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="override-expand-row">
                          <td colSpan="6">
                            <div className="override-history-detail">
                              <div>
                                <strong>Old Data</strong>
                                <pre className="override-code-block">{prettyJson(row.oldData)}</pre>
                              </div>
                              <div>
                                <strong>New Data</strong>
                                <pre className="override-code-block">{prettyJson(row.newData)}</pre>
                              </div>
                              <div>
                                <strong>Request</strong>
                                <pre className="override-code-block">{prettyJson({ ipAddress: row.ipAddress, userAgent: row.userAgent })}</pre>
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
        </section>

        {modalOpen && selectedRow ? (
          <div className="override-modal-backdrop" role="presentation">
            <div className="override-modal" role="dialog" aria-modal="true" aria-labelledby="override-modal-title">
              <header className="override-modal-header">
                <div>
                  <p className="override-subtitle">Override Distribusi</p>
                  <h2 id="override-modal-title" className="override-modal-title">Distribusi #{selectedRow.id}</h2>
                </div>
                <button className="override-modal-close" type="button" aria-label="Tutup modal override" onClick={closeModal}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="override-stepper" aria-label="Proses override">
                {[1, 2, 3].map((stepNumber) => (
                  <span key={stepNumber} className={`override-step ${step === stepNumber ? 'override-step-active' : ''} ${step > stepNumber ? 'override-step-done' : ''}`}>
                    {step > stepNumber ? <CheckCircle2 aria-hidden="true" /> : stepNumber}
                    {stepNumber === 1 ? 'Verifikasi' : stepNumber === 2 ? 'Input Koreksi' : 'Final'}
                  </span>
                ))}
              </div>

              <div className="override-modal-body">
                {step === 1 ? (
                  <>
                    <div className="override-info-grid">
                      {[
                        ['ID Distribusi', `#${selectedRow.id}`],
                        ['SPPG', selectedRow.sppgName],
                        ['Sekolah', selectedRow.schoolName],
                        ['Wilayah', `${selectedRow.city}, ${selectedRow.province}`],
                        ['Tanggal Distribusi', formatDate(selectedRow.distributionDate)],
                        ['Porsi', formatNumber(selectedRow.portions)],
                        ['Harga/Porsi', formatRupiah(selectedRow.pricePerPortion)],
                        ['Total Biaya', formatRupiah(selectedRow.totalCost)],
                        ['Status', selectedRow.status],
                        ['Locked By', selectedRow.lockedBy],
                        ['Locked At', formatDateTime(selectedRow.lockedAt)],
                      ].map(([label, value]) => (
                        <div key={label} className="override-info-item">
                          <span className="override-info-label">{label}</span>
                          <strong className="override-info-value">{value || '-'}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="override-summary-box">
                      <FileWarning aria-hidden="true" />
                      <span>Apakah Anda yakin ini data yang perlu dikoreksi?</span>
                    </div>
                    <div className="override-modal-actions">
                      <button className="override-btn override-btn-secondary" type="button" onClick={closeModal}>Batal</button>
                      <button className="override-btn override-btn-primary" type="button" onClick={() => setStep(2)}>
                        Ya, Lanjutkan
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    {formErrors.general ? <div className="override-field-error">{formErrors.general}</div> : null}
                    <div className="override-form">
                      <label className="override-field">
                        <span className="override-label">Jumlah Porsi</span>
                        <div className="override-change-row">
                          <span className="override-old-value">{formatNumber(selectedRow.portions)}</span>
                          <ArrowRight className="override-arrow" aria-hidden="true" />
                          <input className="override-input override-new-value" name="portions" type="number" min="1" value={form.portions} onChange={handleFormChange} />
                        </div>
                        {formErrors.portions ? <small className="override-field-error">{formErrors.portions}</small> : null}
                      </label>

                      <label className="override-field">
                        <span className="override-label">Harga/Porsi</span>
                        <div className="override-change-row">
                          <span className="override-old-value">{formatRupiah(selectedRow.pricePerPortion)}</span>
                          <ArrowRight className="override-arrow" aria-hidden="true" />
                          <input className="override-input override-new-value" name="pricePerPortion" type="number" min="1" value={form.pricePerPortion} onChange={handleFormChange} />
                        </div>
                        {formErrors.pricePerPortion ? <small className="override-field-error">{formErrors.pricePerPortion}</small> : null}
                      </label>

                      <label className="override-field">
                        <span className="override-label">Status</span>
                        <select className="override-select" name="status" value={form.status} onChange={handleFormChange}>
                          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>

                      {form.status === 'failed' ? (
                        <label className="override-field">
                          <span className="override-label">Failure Reason</span>
                          <textarea className="override-textarea" name="failureReason" value={form.failureReason} onChange={handleFormChange} rows={3} />
                          {formErrors.failureReason ? <small className="override-field-error">{formErrors.failureReason}</small> : null}
                        </label>
                      ) : null}

                      <label className="override-field override-field-wide">
                        <span className="override-label">Alasan Override</span>
                        <textarea
                          className="override-textarea"
                          name="reason"
                          value={form.reason}
                          onChange={handleFormChange}
                          rows={4}
                          placeholder="Jelaskan alasan koreksi data secara rinci..."
                        />
                        {formErrors.reason ? <small className="override-field-error">{formErrors.reason}</small> : null}
                      </label>

                      <label className="override-checkbox-row override-field-wide">
                        <input name="confirmAudit" type="checkbox" checked={form.confirmAudit} onChange={handleFormChange} />
                        <span>Saya memahami bahwa aksi ini akan dicatat di audit log</span>
                      </label>
                      {formErrors.confirmAudit ? <small className="override-field-error override-field-wide">{formErrors.confirmAudit}</small> : null}
                    </div>

                    <div className="override-modal-actions">
                      <button className="override-btn override-btn-secondary" type="button" onClick={() => setStep(1)}>Kembali</button>
                      <button className="override-btn override-btn-danger" type="button" onClick={goToFinalStep}>
                        <ShieldAlert aria-hidden="true" />
                        Konfirmasi Override
                      </button>
                    </div>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <div className="override-summary-box">
                      <Zap aria-hidden="true" />
                      <span>Periksa sekali lagi. Setelah diterapkan, aksi ini akan masuk audit log.</span>
                    </div>
                    <div className="override-summary-box override-summary-list">
                      {changedFieldNames.map((field) => (
                        <div key={field} className="override-summary-row">
                          <span>{field}</span>
                          <strong>{String(field === 'pricePerPortion' ? formatRupiah(selectedRow[field]) : selectedRow[field] ?? '-')}</strong>
                          <ArrowRight aria-hidden="true" />
                          <strong>{String(field === 'pricePerPortion' ? formatRupiah(changes[field]) : changes[field] ?? '-')}</strong>
                        </div>
                      ))}
                      <div className="override-summary-row">
                        <span>Alasan</span>
                        <strong>{form.reason}</strong>
                      </div>
                    </div>
                    <div className="override-modal-actions">
                      <button className="override-btn override-btn-secondary" type="button" onClick={() => setStep(2)}>Batalkan</button>
                      <button className="override-btn override-btn-danger" type="button" disabled={submitLoading} onClick={handleOverrideSubmit}>
                        {submitLoading ? <Loader2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
                        Terapkan Override
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default OverrideData
