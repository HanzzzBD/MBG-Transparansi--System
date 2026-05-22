import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

function readStorage(key) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

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

function readLegacySession() {
  const user = normalizeUser(parseJson(readStorage('mbg.user') || readStorage('user')))
  const token = readStorage('mbg.accessToken') || readStorage('accessToken') || readStorage('token') || null
  return {
    user,
    token,
    // TODO: Jika backend sepenuhnya memakai cookie httpOnly, token boleh null dan auth cukup berdasarkan user.
    isAuthenticated: Boolean(user),
  }
}

function clearLegacySession() {
  if (typeof window === 'undefined') return
  ;['mbg.accessToken', 'mbg.user', 'accessToken', 'token', 'user'].forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })
}

const legacySession = readLegacySession()

const useAuthStore = create(
  persist(
    (set) => ({
      user: legacySession.user,
      token: legacySession.token,
      isAuthenticated: legacySession.isAuthenticated,

      login: (userData, token = null) => {
        const user = normalizeUser(userData)
        set({
          user,
          token: token || null,
          isAuthenticated: Boolean(user),
        })
      },

      logout: () => {
        clearLegacySession()
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      setUser: (userData) => {
        const user = normalizeUser(userData)
        set((state) => ({
          user,
          isAuthenticated: Boolean(user || state.token),
        }))
      },

      setToken: (token) => {
        set((state) => ({
          token: token || null,
          isAuthenticated: Boolean(state.user || token),
        }))
      },
    }),
    {
      name: 'mbg-auth-storage',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

export default useAuthStore
