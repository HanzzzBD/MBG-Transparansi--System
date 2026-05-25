import { create } from 'zustand'

function normalizeUser(userData) {
  if (!userData) return null
  return {
    id: userData.id || userData.userId || userData.user_id || null,
    name: userData.name || userData.fullName || userData.email || 'Pengguna MBG',
    email: userData.email || '',
    role: String(userData.role || 'umum').toLowerCase(),
    ...userData,
  }
}

function clearLegacySession() {
  if (typeof window === 'undefined') return
  ;['mbg.accessToken', 'mbg.user', 'accessToken', 'token', 'user', 'mbg-auth-storage'].forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })
}

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isRefreshingSession: false,
  isSessionChecked: false,

  login: (userData, token = null) => {
    const user = normalizeUser(userData)
    clearLegacySession()
    set({
      user,
      token: token || null,
      isAuthenticated: Boolean(user && token),
      isRefreshingSession: false,
      isSessionChecked: true,
    })
  },

  logout: () => {
    clearLegacySession()
    set({
      user: null,
      token: null,
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

  startSessionCheck: () => {
    set({
      isRefreshingSession: true,
    })
  },

  finishSessionCheck: () => {
    set({
      isRefreshingSession: false,
      isSessionChecked: true,
    })
  },
}))

export default useAuthStore
