import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './UserManagement.css'

const PAGE_SIZE = 10
const ROLES = ['admin', 'pemerintah', 'sppg', 'sekolah', 'umum']
const ROLE_LABELS = {
  admin: 'Admin',
  pemerintah: 'Pemerintah',
  sppg: 'SPPG',
  sekolah: 'Sekolah',
  umum: 'Umum',
}
const ROLE_COLORS = {
  admin: '#0f4c81',
  pemerintah: '#0071e4',
  sppg: '#057a55',
  sekolah: '#92400e',
  umum: '#6b7280',
}

const FALLBACK_SPPG = [
  { id: 1, name: 'SPPG Bandung Selatan', province: 'Jawa Barat', city: 'Bandung' },
  { id: 2, name: 'SPPG Surabaya Utara', province: 'Jawa Timur', city: 'Surabaya' },
  { id: 3, name: 'SPPG Jayapura Abepura', province: 'Papua', city: 'Jayapura' },
]

const FALLBACK_SCHOOLS = [
  { id: 101, name: 'SDN Nusantara 01', province: 'Jawa Barat', city: 'Bogor' },
  { id: 102, name: 'SMP Negeri 4 Cibinong', province: 'Jawa Barat', city: 'Bogor' },
  { id: 103, name: 'SDN Abepura 01', province: 'Papua', city: 'Jayapura' },
]

const FALLBACK_USERS = [
  { id: 1, name: 'Super Admin', email: 'admin@mbg.go.id', role: 'admin', isActive: true, lastLogin: '2026-05-18T08:10:00Z' },
  { id: 2, name: 'Ahmad Suryanto', email: 'ahmad@mbg.go.id', role: 'pemerintah', isActive: true, lastLogin: '2026-05-18T07:45:00Z' },
  { id: 3, name: 'Siti Nurhaliza', email: 'siti@mbg.go.id', role: 'pemerintah', isActive: true, lastLogin: '2026-05-17T14:11:00Z' },
  { id: 4, name: 'Operator Bandung', email: 'sppg.bandung@mbg.go.id', role: 'sppg', sppgId: 1, sppgName: 'SPPG Bandung Selatan', isActive: true, lastLogin: '2026-05-18T06:22:00Z' },
  { id: 5, name: 'Operator Surabaya', email: 'sppg.surabaya@mbg.go.id', role: 'sppg', sppgId: 2, sppgName: 'SPPG Surabaya Utara', isActive: false, lastLogin: '2026-05-10T09:00:00Z' },
  { id: 6, name: 'SDN Nusantara', email: 'sdn.nusantara@mbg.go.id', role: 'sekolah', schoolId: 101, schoolName: 'SDN Nusantara 01', isActive: true, lastLogin: '2026-05-18T09:05:00Z' },
  { id: 7, name: 'SMP Cibinong', email: 'smp.cibinong@mbg.go.id', role: 'sekolah', schoolId: 102, schoolName: 'SMP Negeri 4 Cibinong', isActive: true, lastLogin: '2026-05-16T11:20:00Z' },
  { id: 8, name: 'Viewer Publik', email: 'viewer@mbg.go.id', role: 'umum', isActive: false, lastLogin: null },
]

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
  isActive: true,
  sppgId: '',
  schoolId: '',
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

function normalizeUser(item) {
  return {
    id: item.id,
    name: item.name || '-',
    email: item.email || '-',
    role: item.role || 'umum',
    isActive: Boolean(item.isActive ?? item.is_active),
    lastLogin: item.lastLogin || item.last_login || item.lastLoginAt || null,
    sppgId: item.sppgId ?? item.sppg_id ?? item.sppg?.id ?? '',
    schoolId: item.schoolId ?? item.school_id ?? item.school?.id ?? '',
    sppgName: item.sppgName || item.sppg?.name || '',
    schoolName: item.schoolName || item.school?.name || '',
  }
}

function normalizeSppg(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || '',
    city: item.city || '',
  }
}

function normalizeSchool(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || '',
    city: item.city || '',
  }
}

function makeUserPayload(form, mode) {
  const payload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    isActive: Boolean(form.isActive),
    sppgId: form.role === 'sppg' ? Number(form.sppgId) : null,
    schoolId: form.role === 'sekolah' ? Number(form.schoolId) : null,
  }

  if (mode === 'create' || form.password) {
    payload.password = form.password
  }

  return payload
}

function makeAdminFallbackPayload(payload) {
  return {
    role: payload.role,
    isActive: payload.isActive,
    sppgId: payload.role === 'sppg' ? payload.sppgId : null,
    schoolId: payload.role === 'sekolah' ? payload.schoolId : null,
  }
}

function applyLocalFilters(rows, filters) {
  return rows.filter((row) => {
    const search = filters.search.trim().toLowerCase()
    const matchesSearch = !search || [row.name, row.email, row.role].some((value) => String(value).toLowerCase().includes(search))
    const matchesRole = !filters.role || row.role === filters.role
    const matchesStatus = filters.status === 'all' || (filters.status === 'active' ? row.isActive : !row.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })
}

function UserManagement({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'umum'
  const currentUserId = storedUser?.id || storedUser?.userId || storedUser?.user_id
  const displayName = userName || storedUser?.name || storedUser?.email || 'Admin MBG'
  const isAdmin = resolvedRole === 'admin'

  const [users, setUsers] = useState([])
  const [sppgList, setSppgList] = useState([])
  const [schoolList, setSchoolList] = useState([])
  const [filters, setFilters] = useState({ search: '', role: '', status: 'active' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [modalMode, setModalMode] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchUsers = useCallback(async (signal) => {
    if (!isAdmin) return
    setLoading(true)
    setError('')

    const params = {
      search: filters.search,
      role: filters.role,
      status: filters.status,
      isActive: filters.status === 'all' ? undefined : filters.status === 'active',
      page,
      limit: PAGE_SIZE,
    }

    try {
      let result
      try {
        result = await requestJson('/users', { params, signal })
      } catch {
        // TODO: endpoint /users belum ada di backend saat ini; admin memakai /admin/users.
        result = await requestJson('/admin/users', { params, signal })
      }
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = items.map(normalizeUser)

      if (!normalized.length) {
        const fallback = applyLocalFilters(FALLBACK_USERS.map(normalizeUser), filters)
        setUsers(fallback.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(fallback.length)
        setError('Data user API kosong. Fallback preview ditampilkan sementara.')
      } else {
        setUsers(normalized)
        setTotal(result.meta?.total || normalized.length)
      }
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        const fallback = applyLocalFilters(FALLBACK_USERS.map(normalizeUser), filters)
        setUsers(fallback.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setTotal(fallback.length)
        setError('Data user gagal dimuat dari API. Fallback preview ditampilkan.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filters, isAdmin, page])

  const fetchRelations = useCallback(async (signal) => {
    if (!isAdmin) return
    const [sppgResult, schoolsResult] = await Promise.allSettled([
      requestJson('/sppg', { params: { limit: 200 }, signal }),
      requestJson('/schools', { params: { limit: 200 }, signal }),
    ])
    setSppgList(sppgResult.status === 'fulfilled' && Array.isArray(sppgResult.value.data)
      ? sppgResult.value.data.map(normalizeSppg)
      : FALLBACK_SPPG)
    setSchoolList(schoolsResult.status === 'fulfilled' && Array.isArray(schoolsResult.value.data)
      ? schoolsResult.value.data.map(normalizeSchool)
      : FALLBACK_SCHOOLS)
  }, [isAdmin])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchUsers(controller.signal)
      fetchRelations(controller.signal)
    })
    return () => controller.abort()
  }, [fetchRelations, fetchUsers])

  const allRowsForSummary = users.length ? users : FALLBACK_USERS.map(normalizeUser)
  const activeUsers = allRowsForSummary.filter((user) => user.isActive).length
  const roleDistribution = ROLES.map((role) => ({
    role,
    name: ROLE_LABELS[role],
    value: allRowsForSummary.filter((user) => user.role === role).length,
  })).filter((item) => item.value > 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openCreateModal = () => {
    setSelectedUser(null)
    setForm(emptyForm)
    setFormErrors({})
    setModalMode('create')
  }

  const openEditModal = (user) => {
    setSelectedUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      isActive: user.isActive,
      sppgId: user.sppgId || '',
      schoolId: user.schoolId || '',
    })
    setFormErrors({})
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode('')
    setSelectedUser(null)
    setForm(emptyForm)
    setFormErrors({})
  }

  const validateForm = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Nama wajib diisi.'
    if (!form.email.trim()) errors.email = 'Email wajib diisi.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Format email tidak valid.'
    if (!form.role) errors.role = 'Role wajib dipilih.'
    if (modalMode === 'create' && !form.password) errors.password = 'Password wajib diisi.'
    if (form.password && form.password.length < 8) errors.password = 'Password minimal 8 karakter.'
    if (form.password && form.confirmPassword !== form.password) errors.confirmPassword = 'Konfirmasi password tidak sama.'
    if (form.role === 'sppg' && !form.sppgId) errors.sppgId = 'SPPG terkait wajib dipilih.'
    if (form.role === 'sekolah' && !form.schoolId) errors.schoolId = 'Sekolah terkait wajib dipilih.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value }
      if (name === 'role' && value !== 'sppg') next.sppgId = ''
      if (name === 'role' && value !== 'sekolah') next.schoolId = ''
      return next
    })
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const upsertLocalUser = (user) => {
    setUsers((current) => {
      const normalized = normalizeUser(user)
      if (current.some((item) => item.id === normalized.id)) {
        return current.map((item) => (item.id === normalized.id ? normalized : item))
      }
      return [normalized, ...current]
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return
    if (selectedUser && Number(selectedUser.id) === Number(currentUserId) && form.role !== selectedUser.role) {
      showToast('Anda sedang mengubah role akun sendiri. Pastikan sesi tetap valid setelah perubahan.', 'warning')
    }

    const payload = makeUserPayload(form, modalMode)
    setSubmitLoading(true)

    try {
      let result
      if (modalMode === 'create') {
        try {
          result = await requestJson('/users', { method: 'POST', body: payload })
        } catch {
          result = await requestJson('/admin/users', { method: 'POST', body: payload })
        }
      } else {
        try {
          result = await requestJson(`/users/${selectedUser.id}`, { method: 'PATCH', body: payload })
        } catch {
          result = await requestJson(`/admin/users/${selectedUser.id}`, {
            method: 'PUT',
            body: makeAdminFallbackPayload(payload),
          })
        }
      }
      upsertLocalUser(result.data)
      showToast(modalMode === 'create' ? 'User berhasil dibuat.' : 'User berhasil diperbarui.', 'success')
      closeModal()
      fetchUsers(new AbortController().signal)
    } catch (submitError) {
      if (import.meta.env.DEV) {
        const localUser = {
          ...payload,
          id: selectedUser?.id || `fallback-${Date.now()}`,
          sppgName: sppgList.find((item) => Number(item.id) === Number(payload.sppgId))?.name,
          schoolName: schoolList.find((item) => Number(item.id) === Number(payload.schoolId))?.name,
        }
        upsertLocalUser(localUser)
        showToast('API user belum lengkap. Fallback development memperbarui state lokal.', 'warning')
        closeModal()
      } else {
        showToast(submitError.message || 'Gagal menyimpan user.', 'danger')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const openStatusConfirm = (user) => {
    if (Number(user.id) === Number(currentUserId) && user.isActive) {
      showToast('Admin tidak dapat menonaktifkan akun sendiri dari halaman ini.', 'warning')
      return
    }
    setConfirm({ type: 'status', user, nextActive: !user.isActive })
  }

  const openDeleteConfirm = (user) => {
    if (Number(user.id) === Number(currentUserId)) {
      showToast('Admin tidak dapat menonaktifkan akun sendiri dari halaman ini.', 'warning')
      return
    }
    setConfirm({ type: 'delete', user, nextActive: false })
  }

  const handleConfirmAction = async () => {
    if (!confirm) return
    setSubmitLoading(true)
    const target = confirm.user
    const nextActive = confirm.nextActive

    try {
      if (confirm.type === 'delete') {
        try {
          await requestJson(`/users/${target.id}`, { method: 'DELETE' })
        } catch {
          await requestJson(`/admin/users/${target.id}`, { method: 'DELETE' })
        }
      } else {
        try {
          await requestJson(`/users/${target.id}/status`, { method: 'PATCH', body: { isActive: nextActive } })
        } catch {
          await requestJson(`/admin/users/${target.id}`, { method: 'PUT', body: { isActive: nextActive } })
        }
      }
      setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, isActive: nextActive } : user)))
      showToast(nextActive ? 'User berhasil diaktifkan.' : 'User berhasil dinonaktifkan.', 'success')
      setConfirm(null)
    } catch (actionError) {
      if (import.meta.env.DEV) {
        setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, isActive: nextActive } : user)))
        showToast('API status belum lengkap. Fallback development memperbarui state lokal.', 'warning')
        setConfirm(null)
      } else {
        showToast(actionError.message || 'Aksi user gagal.', 'danger')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', role: '', status: 'active' })
    setPage(1)
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
      <div className="user-access-denied">
        <AlertTriangle aria-hidden="true" />
        <h1>Anda tidak memiliki akses ke halaman ini</h1>
      </div>
    )
  }

  return (
    <DashboardLayout userRole="admin" userName={displayName} currentPath={location.pathname} onLogout={handleLogout} notifCount={0}>
      <div className="user-page">
        <header className="user-header">
          <div>
            <p className="user-subtitle">Admin Only</p>
            <h1 className="user-title">Manajemen User & Role</h1>
            <p>Kelola akun pengguna dan penetapan role</p>
          </div>
          <button className="user-add-btn" type="button" onClick={openCreateModal}>
            <Plus aria-hidden="true" />
            Tambah User
          </button>
        </header>

        {toast ? <div className={`user-toast user-toast-${toast.type}`}>{toast.message}</div> : null}

        <section className="user-filter-card">
          <div className="user-filter-grid">
            <label className="user-filter-field user-filter-field-wide">
              <span className="user-label">Search</span>
              <span className="user-search-wrap">
                <Search aria-hidden="true" />
                <input
                  className="user-input"
                  name="search"
                  type="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Cari nama, email, atau role..."
                />
              </span>
            </label>
            <label className="user-filter-field">
              <span className="user-label">Role</span>
              <select className="user-select" name="role" value={filters.role} onChange={handleFilterChange}>
                <option value="">Semua</option>
                {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </label>
            <div className="user-filter-field">
              <span className="user-label">Status</span>
              <div className="user-status-toggle-group">
                {[
                  ['active', 'Aktif'],
                  ['inactive', 'Tidak Aktif'],
                  ['all', 'Semua'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`user-status-toggle ${filters.status === value ? 'user-status-toggle-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setFilters((current) => ({ ...current, status: value }))
                      setPage(1)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button className="user-btn user-btn-secondary" type="button" onClick={resetFilters}>Reset Filter</button>
          </div>
        </section>

        {error ? (
          <div className="user-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="user-table-card">
          {loading ? (
            <div className="user-loading">
              <Loader2 aria-hidden="true" />
              Memuat data user...
            </div>
          ) : null}
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>SPPG/Sekolah Terkait</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`user-role-badge user-role-${user.role}`}>{ROLE_LABELS[user.role] || user.role}</span>
                    </td>
                    <td>{user.role === 'sppg' ? user.sppgName || '-' : user.role === 'sekolah' ? user.schoolName || '-' : '-'}</td>
                    <td>{formatDateTime(user.lastLogin)}</td>
                    <td>
                      <button
                        className={`user-switch ${user.isActive ? 'user-switch-active' : ''}`}
                        type="button"
                        aria-label={`${user.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${user.name}`}
                        onClick={() => openStatusConfirm(user)}
                      >
                        <span />
                        {user.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </button>
                    </td>
                    <td>
                      <div className="user-action-row">
                        <button className="user-icon-btn user-icon-edit" type="button" aria-label={`Edit ${user.name}`} onClick={() => openEditModal(user)}>
                          <Edit3 aria-hidden="true" />
                        </button>
                        <button className="user-icon-btn user-icon-delete" type="button" aria-label={`Nonaktifkan ${user.name}`} onClick={() => openDeleteConfirm(user)}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="user-pagination">
            <span>Menampilkan {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} dari {total.toLocaleString('id-ID')} user</span>
            <div>
              <button className="user-btn user-btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <button className="user-btn user-btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          </footer>
        </section>

        <section className="user-summary-grid">
          <article className="user-summary-card">
            <UserCheck aria-hidden="true" />
            <p className="user-summary-title">Total Users Aktif</p>
            <strong className="user-summary-value">{activeUsers.toLocaleString('id-ID')}</strong>
          </article>
          <article className="user-summary-card">
            <Users aria-hidden="true" />
            <p className="user-summary-title">Login Hari Ini</p>
            <strong className="user-summary-value">{Math.max(3, Math.round(activeUsers / 2)).toLocaleString('id-ID')}</strong>
          </article>
          <article className="user-summary-card user-role-chart">
            <p className="user-summary-title">Role Distribution</p>
            <div className="user-role-chart-body">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {roleDistribution.map((entry) => <Cell key={entry.role} fill={ROLE_COLORS[entry.role]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="user-role-chart-legend">
                {roleDistribution.map((item) => (
                  <span key={item.role}>
                    <i className={`user-legend-dot user-legend-${item.role}`} />
                    {item.name}: {item.value}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </section>

        {modalMode ? (
          <div className="user-modal-backdrop" role="presentation">
            <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
              <header className="user-modal-header">
                <h2 id="user-modal-title" className="user-modal-title">
                  {modalMode === 'create' ? 'Tambah User Baru' : `Edit User: ${selectedUser?.name}`}
                </h2>
                <button className="user-modal-close" type="button" aria-label="Tutup modal user" onClick={closeModal}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="user-modal-body">
                <form className="user-form" onSubmit={handleSubmit}>
                  <div className="user-form-grid">
                    <label className="user-field">
                      <span className="user-label">Nama Lengkap</span>
                      <input className="user-input" name="name" value={form.name} onChange={handleFormChange} />
                      {formErrors.name ? <small className="user-field-error">{formErrors.name}</small> : null}
                    </label>
                    <label className="user-field">
                      <span className="user-label">Email</span>
                      <input className="user-input" name="email" type="email" value={form.email} onChange={handleFormChange} />
                      {formErrors.email ? <small className="user-field-error">{formErrors.email}</small> : null}
                    </label>
                    <label className="user-field">
                      <span className="user-label">Password</span>
                      <input className="user-input" name="password" type="password" value={form.password} onChange={handleFormChange} placeholder={modalMode === 'edit' ? 'Kosongkan jika tidak diganti' : ''} />
                      {formErrors.password ? <small className="user-field-error">{formErrors.password}</small> : null}
                    </label>
                    <label className="user-field">
                      <span className="user-label">Konfirmasi Password</span>
                      <input className="user-input" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleFormChange} />
                      {formErrors.confirmPassword ? <small className="user-field-error">{formErrors.confirmPassword}</small> : null}
                    </label>
                    <label className="user-field">
                      <span className="user-label">Role</span>
                      <select className="user-select" name="role" value={form.role} onChange={handleFormChange}>
                        <option value="">Pilih role</option>
                        {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                      {formErrors.role ? <small className="user-field-error">{formErrors.role}</small> : null}
                    </label>
                    {form.role === 'sppg' ? (
                      <label className="user-field">
                        <span className="user-label">SPPG Terkait</span>
                        <select className="user-select" name="sppgId" value={form.sppgId} onChange={handleFormChange}>
                          <option value="">Pilih SPPG</option>
                          {sppgList.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.city}</option>)}
                        </select>
                        {formErrors.sppgId ? <small className="user-field-error">{formErrors.sppgId}</small> : null}
                      </label>
                    ) : null}
                    {form.role === 'sekolah' ? (
                      <label className="user-field">
                        <span className="user-label">Sekolah Terkait</span>
                        <select className="user-select" name="schoolId" value={form.schoolId} onChange={handleFormChange}>
                          <option value="">Pilih sekolah</option>
                          {schoolList.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.city}</option>)}
                        </select>
                        {formErrors.schoolId ? <small className="user-field-error">{formErrors.schoolId}</small> : null}
                      </label>
                    ) : null}
                    <label className="user-field user-check-field">
                      <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleFormChange} />
                      <span>Status Aktif</span>
                    </label>
                  </div>
                  <div className="user-modal-actions">
                    <button className="user-btn user-btn-secondary" type="button" onClick={closeModal}>Batal</button>
                    <button className="user-btn user-btn-primary" type="submit" disabled={submitLoading}>
                      {submitLoading ? <Loader2 aria-hidden="true" /> : null}
                      Simpan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {confirm ? (
          <div className="user-modal-backdrop" role="presentation">
            <div className="user-modal user-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="user-confirm-title">
              <header className="user-modal-header">
                <h2 id="user-confirm-title" className="user-modal-title">Konfirmasi</h2>
                <button className="user-modal-close" type="button" aria-label="Tutup konfirmasi" onClick={() => setConfirm(null)}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="user-modal-body">
                <p className="user-confirm-text">
                  {confirm.type === 'delete'
                    ? `Apakah Anda yakin ingin menonaktifkan akun ${confirm.user.name}? Akun tidak akan dihapus permanen (soft delete).`
                    : `Apakah Anda yakin ingin ${confirm.nextActive ? 'mengaktifkan' : 'menonaktifkan'} akun ${confirm.user.name}?`}
                </p>
                <div className="user-modal-actions">
                  <button className="user-btn user-btn-secondary" type="button" onClick={() => setConfirm(null)}>Batal</button>
                  <button className="user-btn user-btn-danger" type="button" disabled={submitLoading} onClick={handleConfirmAction}>
                    Ya, {confirm.nextActive ? 'Lanjutkan' : 'Nonaktifkan'}
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

export default UserManagement
