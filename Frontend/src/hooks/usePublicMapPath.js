import useAuthStore from '../store/authStore.js'

const INTERNAL_MAP_ROLES = new Set(['admin', 'pemerintah', 'gov', 'sppg', 'sekolah'])

export default function usePublicMapPath() {
  const { user, isAuthenticated } = useAuthStore()
  const role = String(user?.role || '').toLowerCase()

  return isAuthenticated && INTERNAL_MAP_ROLES.has(role) ? '/peta' : '/peta-publik'
}
