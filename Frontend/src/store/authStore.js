import { create } from 'zustand'

function normalizeUser(userData) {
  if (!userData) return null
  const role = String(userData.role || 'umum').toLowerCase()
  return {
    id: userData.id || userData.userId || userData.user_id || null,
    name: userData.name || userData.fullName || userData.email || 'Pengguna MBG',
    email: userData.email || '',
    ...userData,
    role: role === 'gov' ? 'pemerintah' : role,
  }
}

function clearLegacySession() {
  if (typeof window === 'undefined') return
  ;['mbg.accessToken', 'mbg.user', 'accessToken', 'token', 'user', 'mbg-auth-storage'].forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })
}

const normalizePermissions = (permissions) => (
  Array.isArray(permissions)
    ? permissions.map((permission) => String(permission)).filter(Boolean)
    : []
)

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  permissions: [],
  permissionsLoaded: false,
  permissionsLoading: false,
  isAuthenticated: false,
  isRefreshingSession: false,
  isSessionChecked: false,

  login: (userData, token = null) => {
    const user = normalizeUser(userData)
    const effectivePermissions = normalizePermissions(
      userData?.effectivePermissions || userData?.permissions,
    )
    clearLegacySession()
    set((state) => ({
      user,
      token: token || null,
      permissions: effectivePermissions.length ? effectivePermissions : state.permissions,
      permissionsLoaded: effectivePermissions.length ? true : state.permissionsLoaded,
      permissionsLoading: false,
      isAuthenticated: Boolean(user && token),
      isRefreshingSession: false,
      isSessionChecked: true,
    }))
  },

  logout: () => {
    clearLegacySession()
    set({
      user: null,
      token: null,
      permissions: [],
      permissionsLoaded: false,
      permissionsLoading: false,
      isAuthenticated: false,
      isRefreshingSession: false,
      isSessionChecked: true,
    })
  },

  setUser: (userData) => {
    const user = normalizeUser(userData)
    set((state) => ({
      user,
      isAuthenticated: Boolean(user && state.token),
    }))
  },

  setToken: (token) => {
    set((state) => ({
      token: token || null,
      isAuthenticated: Boolean(state.user && token),
    }))
  },

  setPermissions: (permissions) => {
    const effectivePermissions = normalizePermissions(permissions)
    set((state) => ({
      permissions: effectivePermissions,
      permissionsLoaded: true,
      permissionsLoading: false,
      user: state.user
        ? {
            ...state.user,
            effectivePermissions,
            permissions: effectivePermissions,
          }
        : state.user,
    }))
  },

  setPermissionsLoading: (permissionsLoading) => {
    set({ permissionsLoading })
  },

  hasPermission: (permissionKey) => {
    if (!permissionKey) return true
    return get().permissions.includes(permissionKey)
  },

  can: (permissionKey) => get().hasPermission(permissionKey),

  startSessionCheck: () => {
    clearLegacySession()
    set({
      isRefreshingSession: true,
      permissionsLoading: true,
    })
  },

  finishSessionCheck: () => {
    set({
      isRefreshingSession: false,
      isSessionChecked: true,
      permissionsLoading: false,
    })
  },
}))

export default useAuthStore
