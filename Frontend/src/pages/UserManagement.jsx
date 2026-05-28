import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  AlertTriangle,
  Ban,
  Check,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import {
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  denyUserPermission,
  getPermissions,
  getRoles,
  getSchools,
  getSppg,
  getUserPermissions,
  getUsers,
  grantUserPermission,
  resetUserPermission,
  updateUser as updateUserRequest,
  updateUserStatus,
} from '../services/api'
import './UserManagement.css'

const PAGE_SIZE = 10
const RELATION_SEARCH_LIMIT = 10
const DEFAULT_ROLES = ['admin', 'pemerintah', 'sppg', 'sekolah', 'umum']
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
const PERMISSION_GROUP_LABELS = {
  admin: 'Admin',
  daily_menu: 'Daily Menu',
  production: 'Production',
  distribution: 'Distribution',
  issue: 'Issue',
  audit: 'Audit',
  user: 'User',
  permission: 'Permission',
}
const PERMISSION_GROUP_ORDER = ['admin', 'daily_menu', 'production', 'distribution', 'issue', 'audit', 'user', 'permission']
const SENSITIVE_PERMISSIONS = new Set([
  'permission.grant',
  'permission.revoke',
  'permission.manage_role_default',
  'admin.settings.manage',
  'admin.users.manage',
  'admin.override.manage',
  'user.lock',
  'user.unlock',
])

const ROLE_GRANTABLE_PERMISSION_KEYS = {
  pemerintah: new Set([
    'admin.dashboard.view',
    'admin.map.view',
    'admin.analytics.view',
    'admin.budget.view',
    'admin.public_reports.view',
    'admin.anomaly.view',
    'admin.audit_log.view',
    'admin.export.view',
    'audit.view',
    'audit.export',
    'distribution.view',
    'production.view',
    'issue.view',
    'account.view',
    'account.update',
  ]),
  sppg: new Set([
    'daily_menu.view',
    'daily_menu.create',
    'daily_menu.update',
    'daily_menu.price.validate',
    'daily_menu.price.override',
    'production.view',
    'production.create',
    'production.update',
    'production.delete',
    'distribution.view',
    'distribution.create',
    'distribution.mark_sent',
    'sppg.school_channel.view',
    'sppg.school_channel.manage',
    'issue.view',
    'account.view',
    'account.update',
  ]),
  sekolah: new Set([
    'distribution.view',
    'distribution.confirm',
    'distribution.report_issue',
    'issue.view',
    'account.view',
    'account.update',
  ]),
  umum: new Set([
    'account.view',
    'account.update',
  ]),
}

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

function normalizeRole(role) {
  const normalized = String(role || 'umum').toLowerCase()
  return normalized === 'gov' ? 'pemerintah' : normalized
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
    role: normalizeRole(item.role),
    isActive: Boolean(item.isActive ?? item.is_active),
    lastLogin: item.lastLogin || item.last_login || item.lastLoginAt || null,
    sppgId: item.sppgId ?? item.sppg_id ?? item.sppg?.id ?? '',
    schoolId: item.schoolId ?? item.school_id ?? item.school?.id ?? '',
    sppgName: item.sppgName || item.sppg?.name || '',
    schoolName: item.schoolName || item.school?.name || '',
  }
}

function normalizeRoleOptions(roles) {
  return [...new Set((roles.length ? roles : DEFAULT_ROLES).map(normalizeRole))]
    .filter((role) => DEFAULT_ROLES.includes(role))
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
    npsn: item.npsn || '',
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
  }
}

function unwrapItems(result) {
  const payload = result?.data ?? result
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function formatSppgOption(item) {
  return [item.name, item.city, item.province].filter(Boolean).join(' - ') || '-'
}

function formatSchoolOption(item) {
  const location = [item.district, item.city, item.province].filter(Boolean).join(', ')
  const npsn = item.npsn ? `NPSN ${item.npsn}` : ''
  return [item.name, npsn, location].filter(Boolean).join(' - ') || '-'
}

function makeUserPayload(form, mode) {
  const payload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    isActive: Boolean(form.isActive),
  }

  if (form.role === 'sppg' && form.sppgId) {
    payload.sppgId = Number(form.sppgId)
  }

  if (form.role === 'sekolah' && form.schoolId) {
    payload.schoolId = Number(form.schoolId)
  }

  if (mode === 'create' || form.password) {
    payload.password = form.password
  }

  return payload
}

function makeUserUpdatePayload(payload) {
  return {
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.password ? { password: payload.password } : {}),
    role: payload.role,
    isActive: payload.isActive,
    ...(payload.role === 'sppg' && payload.sppgId ? { sppgId: payload.sppgId } : {}),
    ...(payload.role === 'sekolah' && payload.schoolId ? { schoolId: payload.schoolId } : {}),
  }
}

function getBackendErrorMessage(error) {
  const details = error?.data?.details
  const fieldErrors = details?.fieldErrors || {}
  const messages = Object.values(fieldErrors).flat().filter(Boolean)
  return messages[0] || details?.formErrors?.[0] || error?.message || 'Validasi belum berhasil.'
}

function normalizePermission(item) {
  return {
    id: item.id,
    key: item.key,
    name: item.name || item.key,
    description: item.description || '',
    group: item.group || 'other',
  }
}

function normalizePermissionOverrideRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => row.permissionKey || row.permission?.key).filter(Boolean)
}

function getPermissionSummaryKeys(summary) {
  return new Set([
    ...(summary?.rolePermissions || []),
    ...(summary?.effectivePermissions || []),
    ...normalizePermissionOverrideRows(summary?.userAllowPermissions),
    ...normalizePermissionOverrideRows(summary?.userDenyPermissions),
  ])
}

function canGrantPermissionToRole(permission, role, summary) {
  const normalizedRole = normalizeRole(role)
  if (normalizedRole === 'admin') return true

  const grantableKeys = ROLE_GRANTABLE_PERMISSION_KEYS[normalizedRole] || new Set()
  const summaryKeys = getPermissionSummaryKeys(summary)
  return grantableKeys.has(permission.key) || summaryKeys.has(permission.key)
}

function getPermissionGroupLabel(group) {
  return PERMISSION_GROUP_LABELS[group] || group || 'Other'
}

function sortPermissionGroups(groups) {
  return [...new Set(groups)].sort((first, second) => {
    const firstIndex = PERMISSION_GROUP_ORDER.indexOf(first)
    const secondIndex = PERMISSION_GROUP_ORDER.indexOf(second)
    if (firstIndex !== -1 || secondIndex !== -1) {
      return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex)
    }
    return getPermissionGroupLabel(first).localeCompare(getPermissionGroupLabel(second))
  })
}

function UserManagement({ userRole, userName, onLogout, user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || 'umum'
  const currentUserId = user?.id || user?.userId || user?.user_id
  const displayName = userName || user?.name || user?.email || 'Admin MBG'
  const isAdmin = resolvedRole === 'admin'

  const [users, setUsers] = useState([])
  const [roleOptions, setRoleOptions] = useState(DEFAULT_ROLES)
  const [relationSearch, setRelationSearch] = useState({ sppg: '', school: '' })
  const [relationOptions, setRelationOptions] = useState({ sppg: [], school: [] })
  const [relationLoading, setRelationLoading] = useState({ sppg: false, school: false })
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
  const [permissionModalUser, setPermissionModalUser] = useState(null)
  const [permissionCatalog, setPermissionCatalog] = useState([])
  const [permissionSummary, setPermissionSummary] = useState(null)
  const [permissionLoading, setPermissionLoading] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionGroup, setPermissionGroup] = useState('')
  const [permissionActionLoading, setPermissionActionLoading] = useState('')

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
      const result = await getUsers(params, { signal })
      const items = Array.isArray(result.data) ? result.data : result.data?.items || []
      const normalized = items.map(normalizeUser)

      setUsers(normalized)
      setTotal(result.meta?.total || normalized.length)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setUsers([])
        setTotal(0)
        setError(fetchError.message || 'Data user belum berhasil dimuat.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filters, isAdmin, page])

  const fetchRoles = useCallback(async (signal) => {
    if (!isAdmin) return

    try {
      const result = await getRoles({ signal })
      const values = Array.isArray(result.data)
        ? result.data.map((item) => item.value || item.role).filter(Boolean)
        : []
      if (!signal?.aborted) {
        setRoleOptions(normalizeRoleOptions(values))
      }
    } catch (rolesError) {
      if (!signal?.aborted) {
        showToast(rolesError.message || 'Data role belum berhasil dimuat.', 'warning')
      }
    }
  }, [isAdmin, showToast])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchUsers(controller.signal)
      fetchRoles(controller.signal)
    })
    return () => controller.abort()
  }, [fetchRoles, fetchUsers])

  useEffect(() => {
    if (!modalMode || !['sppg', 'sekolah'].includes(form.role)) return undefined

    const type = form.role === 'sppg' ? 'sppg' : 'school'
    const selectedRelationId = type === 'sppg' ? form.sppgId : form.schoolId
    if (selectedRelationId) return undefined

    const query = relationSearch[type].trim()
    if (query.length < 2) {
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setRelationLoading((current) => ({ ...current, [type]: true }))

      try {
        const result = type === 'sppg'
          ? await getSppg(
            {
              search: query,
              limit: RELATION_SEARCH_LIMIT,
              fields: 'province,city,status',
            },
            { signal: controller.signal },
          )
          : await getSchools(
            {
              search: query,
              limit: RELATION_SEARCH_LIMIT,
            },
            { signal: controller.signal },
          )

        const items = unwrapItems(result).map(type === 'sppg' ? normalizeSppg : normalizeSchool)
        setRelationOptions((current) => ({ ...current, [type]: items }))
      } catch (searchError) {
        if (searchError.name !== 'AbortError') {
          setRelationOptions((current) => ({ ...current, [type]: [] }))
          showToast(searchError.message || 'Data relasi gagal dimuat.', 'danger')
        }
      } finally {
        if (!controller.signal.aborted) {
          setRelationLoading((current) => ({ ...current, [type]: false }))
        }
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [form.role, form.schoolId, form.sppgId, modalMode, relationSearch, showToast])

  const activeUsers = users.filter((user) => user.isActive).length
  const roleDistribution = roleOptions.map((role) => ({
    role,
    name: ROLE_LABELS[role],
    value: users.filter((user) => user.role === role).length,
  })).filter((item) => item.value > 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const permissionTargetRole = normalizeRole(permissionSummary?.user?.role || permissionModalUser?.role)
  const roleScopedPermissionCatalog = permissionCatalog.filter((permission) => (
    canGrantPermissionToRole(permission, permissionTargetRole, permissionSummary)
  ))
  const permissionGroupOptions = sortPermissionGroups(roleScopedPermissionCatalog.map((permission) => permission.group))
  const rolePermissionKeys = new Set(permissionSummary?.rolePermissions || [])
  const allowPermissionKeys = new Set(normalizePermissionOverrideRows(permissionSummary?.userAllowPermissions))
  const denyPermissionKeys = new Set(normalizePermissionOverrideRows(permissionSummary?.userDenyPermissions))
  const effectivePermissionKeys = new Set(permissionSummary?.effectivePermissions || [])
  const permissionQuery = permissionSearch.trim().toLowerCase()
  const filteredPermissions = roleScopedPermissionCatalog.filter((permission) => {
    const matchesGroup = !permissionGroup || permission.group === permissionGroup
    const searchable = `${permission.key} ${permission.name} ${permission.description}`.toLowerCase()
    const matchesSearch = !permissionQuery || searchable.includes(permissionQuery)
    return matchesGroup && matchesSearch
  })

  const openCreateModal = () => {
    setSelectedUser(null)
    setForm(emptyForm)
    setRelationSearch({ sppg: '', school: '' })
    setRelationOptions({ sppg: [], school: [] })
    setFormErrors({})
    setModalMode('create')
  }

  const openEditModal = (user) => {
    const normalized = normalizeUser(user)
    setSelectedUser(normalized)
    setForm({
      name: normalized.name,
      email: normalized.email,
      password: '',
      confirmPassword: '',
      role: normalized.role,
      isActive: normalized.isActive,
      sppgId: normalized.sppgId || '',
      schoolId: normalized.schoolId || '',
    })
    setRelationSearch({
      sppg: normalized.sppgName || '',
      school: normalized.schoolName || '',
    })
    setRelationOptions({
      sppg: normalized.sppgId
        ? [{ id: normalized.sppgId, name: normalized.sppgName || `SPPG #${normalized.sppgId}`, city: '', province: '' }]
        : [],
      school: normalized.schoolId
        ? [{ id: normalized.schoolId, name: normalized.schoolName || `Sekolah #${normalized.schoolId}`, city: '', province: '', district: '', npsn: '' }]
        : [],
    })
    setFormErrors({})
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode('')
    setSelectedUser(null)
    setForm(emptyForm)
    setRelationSearch({ sppg: '', school: '' })
    setRelationOptions({ sppg: [], school: [] })
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
      if (name === 'role') {
        next.sppgId = ''
        next.schoolId = ''
      }
      return next
    })
    if (name === 'role') {
      setRelationSearch({ sppg: '', school: '' })
      setRelationOptions({ sppg: [], school: [] })
    }
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const handleRelationSearchChange = (type, value) => {
    const idField = type === 'sppg' ? 'sppgId' : 'schoolId'
    setRelationSearch((current) => ({ ...current, [type]: value }))
    setForm((current) => ({ ...current, [idField]: '' }))
    if (value.trim().length < 2) {
      setRelationOptions((current) => ({ ...current, [type]: [] }))
      setRelationLoading((current) => ({ ...current, [type]: false }))
    }
    if (formErrors[idField]) setFormErrors((current) => ({ ...current, [idField]: '' }))
  }

  const selectRelation = (type, item) => {
    const idField = type === 'sppg' ? 'sppgId' : 'schoolId'
    const label = type === 'sppg' ? formatSppgOption(item) : formatSchoolOption(item)
    setForm((current) => ({ ...current, [idField]: item.id }))
    setRelationSearch((current) => ({ ...current, [type]: label }))
    setRelationOptions((current) => ({ ...current, [type]: [item] }))
    if (formErrors[idField]) setFormErrors((current) => ({ ...current, [idField]: '' }))
  }

  const clearRelation = (type) => {
    const idField = type === 'sppg' ? 'sppgId' : 'schoolId'
    setForm((current) => ({ ...current, [idField]: '' }))
    setRelationSearch((current) => ({ ...current, [type]: '' }))
    setRelationOptions((current) => ({ ...current, [type]: [] }))
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
        result = await createUserRequest(payload)
      } else {
        result = await updateUserRequest(selectedUser.id, makeUserUpdatePayload(payload))
      }
      upsertLocalUser(result.data)
      showToast(modalMode === 'create' ? 'User berhasil dibuat.' : 'User berhasil diperbarui.', 'success')
      closeModal()
      fetchUsers(new AbortController().signal)
    } catch (submitError) {
      const message = getBackendErrorMessage(submitError)
      setFormErrors((current) => ({ ...current, general: message }))
      showToast(message || 'Gagal menyimpan user.', 'danger')
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
        await deleteUserRequest(target.id)
      } else {
        await updateUserStatus(target.id, { isActive: nextActive })
      }
      setUsers((current) => {
        if (confirm.type === 'delete') {
          return current.filter((user) => user.id !== target.id)
        }

        return current.map((user) => (user.id === target.id ? { ...user, isActive: nextActive } : user))
      })
      if (confirm.type === 'delete') {
        setTotal((current) => Math.max(0, current - 1))
      }
      showToast(confirm.type === 'delete' ? 'User berhasil dinonaktifkan.' : nextActive ? 'User berhasil diaktifkan.' : 'User berhasil dinonaktifkan.', 'success')
      setConfirm(null)
    } catch (actionError) {
      showToast(actionError.message || 'Aksi user gagal.', 'danger')
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

  const fetchPermissionSummary = useCallback(async (targetUserId, signal) => {
    const result = await getUserPermissions(targetUserId, { signal })
    setPermissionSummary(result.data)
    return result.data
  }, [])

  const openPermissionModal = useCallback(async (targetUser) => {
    setPermissionModalUser(targetUser)
    setPermissionSummary(null)
    setPermissionError('')
    setPermissionSearch('')
    setPermissionGroup('')
    setPermissionLoading(true)

    try {
      const [catalogResult] = await Promise.all([
        getPermissions(),
        fetchPermissionSummary(targetUser.id),
      ])
      const catalogItems = Array.isArray(catalogResult.data?.permissions)
        ? catalogResult.data.permissions
        : []
      setPermissionCatalog(catalogItems.map(normalizePermission))
    } catch (permissionFetchError) {
      setPermissionError(permissionFetchError.message || 'Data permission gagal dimuat.')
    } finally {
      setPermissionLoading(false)
    }
  }, [fetchPermissionSummary])

  const closePermissionModal = () => {
    setPermissionModalUser(null)
    setPermissionSummary(null)
    setPermissionError('')
    setPermissionSearch('')
    setPermissionGroup('')
    setPermissionActionLoading('')
  }

  const handlePermissionMutation = async (permissionKey, action) => {
    if (!permissionModalUser) return
    if (action === 'grant' && SENSITIVE_PERMISSIONS.has(permissionKey)) {
      const confirmed = window.confirm(`Permission sensitif "${permissionKey}" akan diberikan ke ${permissionModalUser.name}. Lanjutkan?`)
      if (!confirmed) return
    }

    setPermissionActionLoading(`${action}:${permissionKey}`)
    setPermissionError('')

    try {
      const payload = { permissionKey }
      if (action === 'grant') {
        await grantUserPermission(permissionModalUser.id, payload)
        showToast('Permission berhasil diberikan.', 'success')
      } else if (action === 'deny') {
        await denyUserPermission(permissionModalUser.id, payload)
        showToast('Permission berhasil ditolak untuk user ini.', 'success')
      } else {
        await resetUserPermission(permissionModalUser.id, permissionKey)
        showToast('Override permission berhasil direset.', 'success')
      }

      await fetchPermissionSummary(permissionModalUser.id)
    } catch (permissionMutationError) {
      const message = getBackendErrorMessage(permissionMutationError)
      setPermissionError(message)
      showToast(message || 'Aksi permission gagal.', 'danger')
    } finally {
      setPermissionActionLoading('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
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
                {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
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
                        <button className="user-icon-btn user-icon-access" type="button" aria-label={`Kelola akses ${user.name}`} title="Kelola Akses" onClick={() => openPermissionModal(user)}>
                          <ShieldCheck aria-hidden="true" />
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
            <p className="user-summary-title">Total User Filter</p>
            <strong className="user-summary-value">{total.toLocaleString('id-ID')}</strong>
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
                  {formErrors.general ? <div className="user-field-error user-field-error-general">{formErrors.general}</div> : null}
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
                        {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
                      </select>
                      {formErrors.role ? <small className="user-field-error">{formErrors.role}</small> : null}
                    </label>
                    {form.role === 'sppg' ? (
                      <RelationAutocomplete
                        label="SPPG Terkait"
                        type="sppg"
                        valueId={form.sppgId}
                        searchValue={relationSearch.sppg}
                        options={relationOptions.sppg}
                        loading={relationLoading.sppg}
                        error={formErrors.sppgId}
                        onSearchChange={handleRelationSearchChange}
                        onSelect={selectRelation}
                        onClear={clearRelation}
                      />
                    ) : null}
                    {form.role === 'sekolah' ? (
                      <RelationAutocomplete
                        label="Sekolah Terkait"
                        type="school"
                        valueId={form.schoolId}
                        searchValue={relationSearch.school}
                        options={relationOptions.school}
                        loading={relationLoading.school}
                        error={formErrors.schoolId}
                        onSearchChange={handleRelationSearchChange}
                        onSelect={selectRelation}
                        onClear={clearRelation}
                      />
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

        {permissionModalUser ? (
          <PermissionManagementModal
            user={permissionModalUser}
            summary={permissionSummary}
            permissions={filteredPermissions}
            groupOptions={permissionGroupOptions}
            rolePermissionKeys={rolePermissionKeys}
            allowPermissionKeys={allowPermissionKeys}
            denyPermissionKeys={denyPermissionKeys}
            effectivePermissionKeys={effectivePermissionKeys}
            searchValue={permissionSearch}
            groupValue={permissionGroup}
            loading={permissionLoading}
            error={permissionError}
            actionLoading={permissionActionLoading}
            onSearchChange={setPermissionSearch}
            onGroupChange={setPermissionGroup}
            onAction={handlePermissionMutation}
            onClose={closePermissionModal}
          />
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

function PermissionManagementModal({
  user,
  summary,
  permissions,
  groupOptions,
  rolePermissionKeys,
  allowPermissionKeys,
  denyPermissionKeys,
  effectivePermissionKeys,
  searchValue,
  groupValue,
  loading,
  error,
  actionLoading,
  onSearchChange,
  onGroupChange,
  onAction,
  onClose,
}) {
  const targetRole = normalizeRole(summary?.user?.role || user.role)
  const roleLabel = ROLE_LABELS[targetRole] || targetRole

  return (
    <div className="user-modal-backdrop" role="presentation">
      <div className="user-modal user-permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-modal-title">
        <header className="user-modal-header">
          <div>
            <p className="user-subtitle">Permission Management</p>
            <h2 id="permission-modal-title" className="user-modal-title">Kelola Akses</h2>
            <p className="user-permission-user">
              {user.name} · {user.email} · <strong>{roleLabel}</strong>
            </p>
          </div>
          <button className="user-modal-close" type="button" aria-label="Tutup kelola akses" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="user-modal-body">
          {loading ? (
            <div className="user-loading">
              <Loader2 aria-hidden="true" />
              Memuat permission user...
            </div>
          ) : null}
          {error ? (
            <div className="user-error">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {!loading && summary ? (
            <div className="user-permission-content">
              <div className="user-permission-overview">
                <PermissionKeyPanel title="Role Permissions" keys={summary.rolePermissions} tone="role" />
                <PermissionKeyPanel title="User ALLOW" keys={normalizePermissionOverrideRows(summary.userAllowPermissions)} tone="allow" />
                <PermissionKeyPanel title="User DENY" keys={normalizePermissionOverrideRows(summary.userDenyPermissions)} tone="deny" />
                <PermissionKeyPanel title="Effective" keys={summary.effectivePermissions} tone="effective" />
              </div>

              <div className="user-permission-toolbar">
                <label className="user-filter-field user-filter-field-wide">
                  <span className="user-label">Search Permission</span>
                  <span className="user-search-wrap">
                    <Search aria-hidden="true" />
                    <input
                      className="user-input"
                      type="search"
                      value={searchValue}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder="Cari key, nama, atau deskripsi..."
                    />
                  </span>
                </label>
                <label className="user-filter-field">
                  <span className="user-label">Group</span>
                  <select className="user-select" value={groupValue} onChange={(event) => onGroupChange(event.target.value)}>
                    <option value="">Semua group</option>
                    {groupOptions.map((group) => (
                      <option key={group} value={group}>{getPermissionGroupLabel(group)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="user-permission-list" role="list">
                {permissions.length ? permissions.map((permission) => {
                  const isRolePermission = rolePermissionKeys.has(permission.key)
                  const isAllowed = allowPermissionKeys.has(permission.key)
                  const isDenied = denyPermissionKeys.has(permission.key)
                  const isEffective = effectivePermissionKeys.has(permission.key)
                  const isSensitive = SENSITIVE_PERMISSIONS.has(permission.key)
                  const grantLoading = actionLoading === `grant:${permission.key}`
                  const denyLoading = actionLoading === `deny:${permission.key}`
                  const resetLoading = actionLoading === `reset:${permission.key}`
                  const hasOverride = isAllowed || isDenied

                  return (
                    <article className="user-permission-item" key={permission.key} role="listitem">
                      <div className="user-permission-main">
                        <div className="user-permission-title-row">
                          <KeyRound aria-hidden="true" />
                          <div>
                            <h3>{permission.name}</h3>
                            <code>{permission.key}</code>
                          </div>
                        </div>
                        <p>{permission.description || 'Tidak ada deskripsi.'}</p>
                        <div className="user-permission-tags">
                          <span>{getPermissionGroupLabel(permission.group)}</span>
                          {isRolePermission ? <span className="user-permission-tag-role">Role Default</span> : null}
                          {isAllowed ? <span className="user-permission-tag-allow">ALLOW</span> : null}
                          {isDenied ? <span className="user-permission-tag-deny">DENY</span> : null}
                          {isEffective ? <span className="user-permission-tag-effective">Effective</span> : null}
                          {isSensitive ? <span className="user-permission-tag-sensitive">Sensitif</span> : null}
                        </div>
                      </div>
                      <div className="user-permission-actions">
                        <button
                          className="user-btn user-btn-primary"
                          type="button"
                          disabled={isAllowed || (isEffective && !isDenied) || Boolean(actionLoading)}
                          onClick={() => onAction(permission.key, 'grant')}
                        >
                          {grantLoading ? <Loader2 aria-hidden="true" /> : <Check aria-hidden="true" />}
                          Grant
                        </button>
                        <button
                          className="user-btn user-btn-danger"
                          type="button"
                          disabled={isDenied || Boolean(actionLoading)}
                          onClick={() => onAction(permission.key, 'deny')}
                        >
                          {denyLoading ? <Loader2 aria-hidden="true" /> : <Ban aria-hidden="true" />}
                          Deny
                        </button>
                        <button
                          className="user-btn user-btn-secondary"
                          type="button"
                          disabled={!hasOverride || Boolean(actionLoading)}
                          onClick={() => onAction(permission.key, 'reset')}
                        >
                          {resetLoading ? <Loader2 aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                          Reset
                        </button>
                      </div>
                    </article>
                  )
                }) : (
                  <div className="user-permission-empty">
                    <KeyRound aria-hidden="true" />
                    <strong>Tidak ada permission ditemukan</strong>
                    <span>Ubah kata kunci pencarian atau filter group.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PermissionKeyPanel({ title, keys = [], tone }) {
  return (
    <section className={`user-permission-panel user-permission-panel-${tone}`}>
      <h3>{title}</h3>
      {keys.length ? (
        <div className="user-permission-chip-list">
          {keys.map((key) => <code key={key}>{key}</code>)}
        </div>
      ) : (
        <p>Belum ada data.</p>
      )}
    </section>
  )
}

function RelationAutocomplete({
  label,
  type,
  valueId,
  searchValue,
  options,
  loading,
  error,
  onSearchChange,
  onSelect,
  onClear,
}) {
  const queryReady = searchValue.trim().length >= 2
  const showResults = !valueId && (queryReady || loading)
  const formatOption = type === 'sppg' ? formatSppgOption : formatSchoolOption
  const placeholder = type === 'sppg' ? 'Cari nama, kota, provinsi' : 'Cari nama, NPSN, kota'

  return (
    <div className="user-field user-autocomplete-field">
      <span className="user-label">{label}</span>
      <div className="user-autocomplete-control">
        <Search aria-hidden="true" />
        <input
          className="user-input"
          value={searchValue}
          onChange={(event) => onSearchChange(type, event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {valueId ? (
          <button className="user-autocomplete-clear" type="button" aria-label={`Hapus ${label}`} onClick={() => onClear(type)}>
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {valueId ? <span className="user-selected-relation">ID {valueId}</span> : null}
      {showResults ? (
        <div className="user-autocomplete-results" role="listbox">
          {loading ? (
            <div className="user-autocomplete-state">
              <Loader2 aria-hidden="true" />
              Memuat data...
            </div>
          ) : options.length ? (
            options.map((item) => (
              <button
                key={item.id}
                className={`user-autocomplete-option ${String(valueId) === String(item.id) ? 'user-autocomplete-option-selected' : ''}`}
                type="button"
                role="option"
                aria-selected={String(valueId) === String(item.id)}
                onClick={() => onSelect(type, item)}
              >
                <strong>{item.name}</strong>
                <span>{formatOption(item)}</span>
              </button>
            ))
          ) : (
            <div className="user-autocomplete-state">Tidak ada hasil</div>
          )}
        </div>
      ) : null}
      {error ? <small className="user-field-error">{error}</small> : null}
    </div>
  )
}

export default UserManagement
