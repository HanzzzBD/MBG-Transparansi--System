import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShieldAlert,
  School,
  Truck,
  UserCircle,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import newLogo from '../assets/NewLogo.png'
import {
  getGlobalSearch,
  getNotifications,
  isAbortError,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './DashboardLayout.css'

const ROLE_LABELS = {
  admin: 'Admin',
  pemerintah: 'Pemerintah',
  gov: 'Pemerintah',
  sppg: 'SPPG',
  sekolah: 'Sekolah',
}

const ROLE_CLASSES = {
  admin: 'dashboard-role-admin',
  pemerintah: 'dashboard-role-pemerintah',
  gov: 'dashboard-role-pemerintah',
  sppg: 'dashboard-role-sppg',
  sekolah: 'dashboard-role-sekolah',
}

const dashboardMenu = {
  label: 'Dashboard',
  icon: LayoutDashboard,
  path: '/dashboard',
  permissionByRole: {
    admin: 'admin.dashboard.view',
    pemerintah: 'admin.dashboard.view',
  },
}

const sppgMenus = [
  { label: 'Input Menu Harian', icon: UtensilsCrossed, path: '/input-menu', permission: 'daily_menu.create' },
  { label: 'Sekolah Saluran', icon: School, path: '/sekolah-saluran', permission: 'sppg.school_channel.view' },
  { label: 'Input Porsi & Distribusi', icon: Package, path: '/distribusi', permission: 'distribution.create' },
  { label: 'Production Batch', icon: UtensilsCrossed, path: '/production-batches', permission: 'production.view' },
  { label: 'Status Distribusi', icon: Truck, path: '/distribusi', permission: 'distribution.view' },
  { label: 'Lapor Kendala', icon: AlertTriangle, path: '/laporan-kendala', permission: 'issue.view' },
  { label: 'Riwayat Distribusi', icon: History, path: '/riwayat', permission: 'distribution.view' },
  { label: 'Profil SPPG', icon: Building2, path: '/profil', permission: 'account.view' },
]

const sekolahMenus = [
  { label: 'Konfirmasi Distribusi', icon: CheckSquare, path: '/validasi', badgeKey: 'notif', permission: 'distribution.view' },
  { label: 'Validasi Porsi & Kualitas', icon: ClipboardCheck, path: '/validasi', permission: 'distribution.view' },
  { label: 'Laporan Sekolah', icon: FileText, path: '/laporan-sekolah', permission: 'issue.view' },
  { label: 'Riwayat Distribusi', icon: History, path: '/riwayat', permission: 'distribution.view' },
  { label: 'Profil Sekolah', icon: School, path: '/profil', permission: 'account.view' },
]

const pemerintahMenus = [
  { label: 'Peta SPPG', icon: Map, path: '/peta', permission: 'admin.map.view' },
  { label: 'Analitik Wilayah', icon: BarChart3, path: '/analytics', permission: 'admin.analytics.view' },
  { label: 'Transparansi Anggaran', icon: Wallet, path: '/anggaran', permission: 'admin.budget.view' },
  { label: 'Laporan Masyarakat', icon: MessageSquare, path: '/laporan-masyarakat', badgeKey: 'notif', permission: 'admin.public_reports.view' },
  { label: 'Anomaly Detection', icon: Zap, path: '/anomaly', permission: 'admin.anomaly.view' },
  { label: 'Audit Log', icon: ClipboardList, path: '/audit-log', permission: 'admin.audit_log.view' },
  { label: 'Export Data', icon: Download, path: '/export', permission: 'admin.export.view' },
]

const adminExtraMenus = [
  { label: 'Master SPPG', icon: Building2, path: '/admin/sppg', permissions: ['admin.sppg.manage', 'admin.master_sppg.manage'] },
  { label: 'Master Sekolah', icon: School, path: '/admin/schools', permissions: ['admin.school.manage', 'admin.master_school.manage'] },
  { label: 'Import Dapodik', icon: Database, path: '/dapodik', permission: 'admin.dapodik.manage' },
  { label: 'User & Role', icon: Users, path: '/users', permission: 'admin.users.manage' },
  { label: 'Lock / Unlock Data', icon: Lock, path: '/lock-unlock', permission: 'admin.lock_unlock.manage' },
  { label: 'Override Data', icon: ShieldAlert, path: '/override', permission: 'admin.override.manage' },
  { label: 'API Monitoring', icon: Activity, path: '/api-monitoring', permission: 'admin.api_monitoring.view' },
  { label: 'Settings', icon: Settings, path: '/settings', permission: 'admin.settings.manage' },
]

const SEARCH_GROUPS = [
  { key: 'sppg', label: 'SPPG', icon: Building2 },
  { key: 'schools', label: 'Sekolah', icon: School },
  { key: 'distributions', label: 'Distribusi', icon: Truck },
  { key: 'reports', label: 'Laporan', icon: MessageSquare },
]

const NOTIFICATION_TYPE_LABELS = {
  distribution: 'Distribusi',
  validation: 'Validasi',
  anomaly: 'Anomali',
  system: 'Sistem',
}

const NOTIFICATION_CACHE_TTL_MS = 60_000
const DashboardLayoutContext = createContext(false)

const notificationCache = {
  cacheKey: '',
  timestamp: 0,
  state: null,
}
let notificationRequest = null

function emptySearchResults() {
  return {
    sppg: [],
    schools: [],
    distributions: [],
    reports: [],
  }
}

function hasSearchResults(results) {
  return SEARCH_GROUPS.some((group) => Array.isArray(results[group.key]) && results[group.key].length > 0)
}

function formatDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getNotificationUrl(notification) {
  const payload = notification?.payload || {}

  if (payload.distributionId) return `/distribusi?distributionId=${payload.distributionId}`
  if (payload.validationId) return `/validasi?validationId=${payload.validationId}`
  if (payload.publicReportId || payload.reportId) return `/laporan-masyarakat?reportId=${payload.publicReportId || payload.reportId}`
  if (payload.schoolReportId) return `/laporan-sekolah?reportId=${payload.schoolReportId}`
  if (payload.issueId) return `/laporan-kendala?issueId=${payload.issueId}`
  if (payload.anomalyId) return `/anomaly?anomalyId=${payload.anomalyId}`

  return '/dashboard'
}

function normalizeNotification(notification) {
  return {
    ...notification,
    isRead: Boolean(notification?.isRead ?? notification?.is_read),
    createdAt: notification?.createdAt || notification?.created_at || null,
  }
}

function getRoleMenus(userRole) {
  if (userRole === 'admin') return [dashboardMenu, ...pemerintahMenus, ...adminExtraMenus]
  if (userRole === 'pemerintah') return [dashboardMenu, ...pemerintahMenus]
  if (userRole === 'sekolah') return [dashboardMenu, ...sekolahMenus]
  return [dashboardMenu, ...sppgMenus]
}

function normalizePermissionRequirement(requirement) {
  if (!requirement) return []
  return Array.isArray(requirement) ? requirement.filter(Boolean) : [requirement]
}

function canAccessMenu(item, role, can, permissionsLoaded) {
  if (!permissionsLoaded) return true

  const roleRequirement = item.permissionByRole?.[role]
  const requiredPermissions = normalizePermissionRequirement(roleRequirement || item.permissions || item.permission)
  if (!requiredPermissions.length) return true

  return requiredPermissions.some((permissionKey) => can(permissionKey))
}

function isMenuActive(pathname, itemPath) {
  if (itemPath === '/dashboard') return pathname === '/dashboard'
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

function getActiveMenu(menus, pathname) {
  return [...menus]
    .sort((first, second) => second.path.length - first.path.length)
    .find((menu) => isMenuActive(pathname, menu.path)) || dashboardMenu
}

function getInitial(userName) {
  return (userName || 'U').trim().charAt(0).toUpperCase() || 'U'
}

function RoleBadge({ role }) {
  return <span className={`dashboard-role-badge ${ROLE_CLASSES[role] || ''}`}>{ROLE_LABELS[role] || role}</span>
}

function MenuItem({ item, active, collapsed, notifCount, onClick }) {
  const Icon = item.icon
  const badgeValue = item.badgeKey === 'notif' && notifCount > 0 ? notifCount : null

  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={`dashboard-menu-item ${active ? 'dashboard-menu-item-active' : ''}`}
      onClick={onClick}
    >
      <span className="dashboard-menu-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="dashboard-menu-label">{item.label}</span>
      {badgeValue ? <span className="dashboard-menu-badge">{badgeValue}</span> : null}
    </Link>
  )
}

function SidebarContent({
  menus,
  currentPath,
  sidebarCollapsed,
  userName,
  userRole,
  notifCount,
  onLogout,
  onMenuClick,
}) {
  return (
    <>
      <div className="dashboard-logo-area">
        <Link to="/dashboard" className="dashboard-logo-link" onClick={onMenuClick}>
          <img className="dashboard-logo-image" src={newLogo} alt="Logo MBG" />
          <span className="dashboard-logo-text">
            <span className="dashboard-logo-title">MBG</span>
            <span className="dashboard-logo-subtitle">Transparency System</span>
          </span>
        </Link>
      </div>

      <nav className="dashboard-menu" aria-label="Menu dashboard">
        {menus.map((item) => (
          <MenuItem
            key={item.path}
            item={item}
            active={isMenuActive(currentPath, item.path)}
            collapsed={sidebarCollapsed}
            notifCount={notifCount}
            onClick={onMenuClick}
          />
        ))}
      </nav>

      <div className="dashboard-sidebar-bottom">
        <div className="dashboard-user-mini">
          <span className="dashboard-avatar">{getInitial(userName)}</span>
          <span className="dashboard-user-info">
            <span className="dashboard-user-name">{userName || 'Pengguna MBG'}</span>
            <RoleBadge role={userRole} />
          </span>
        </div>
        <button className="dashboard-logout-btn" type="button" onClick={onLogout} title="Logout">
          <LogOut aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </>
  )
}

function DashboardLayout({
  userRole = 'sppg',
  userName = 'Pengguna MBG',
  userId = '',
  currentPath,
  children,
  onLogout,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchState, setSearchState] = useState({
    results: emptySearchResults(),
    loading: false,
    error: '',
    hasSearched: false,
  })
  const [notificationState, setNotificationState] = useState({
    items: [],
    unreadCount: 0,
    loading: false,
    error: '',
    loaded: false,
  })
  const searchWrapRef = useRef(null)
  const notifWrapRef = useRef(null)
  const userMenuRef = useRef(null)
  const isNestedLayout = useContext(DashboardLayoutContext)
  const can = useAuthStore((state) => state.can)
  const permissionsLoaded = useAuthStore((state) => state.permissionsLoaded)
  const normalizedRole = ROLE_LABELS[userRole] ? userRole : 'sppg'
  const pathname = currentPath || location.pathname
  const trimmedSearchQuery = searchQuery.trim()
  const notificationCacheKey = `${normalizedRole}:${userId || userName || 'anonymous'}`

  const menus = useMemo(
    () => getRoleMenus(normalizedRole).filter((item) => canAccessMenu(item, normalizedRole, can, permissionsLoaded)),
    [can, normalizedRole, permissionsLoaded],
  )
  const activeMenu = useMemo(() => getActiveMenu(menus, pathname), [menus, pathname])
  const displayNotifCount = notificationState.unreadCount

  const loadNotifications = useCallback(async (signal, { force = false } = {}) => {
    const now = Date.now()
    const hasFreshCache =
      notificationCache.cacheKey === notificationCacheKey &&
      notificationCache.state &&
      now - notificationCache.timestamp < NOTIFICATION_CACHE_TTL_MS

    if (!force && hasFreshCache) {
      setNotificationState(notificationCache.state)
      return
    }

    setNotificationState((current) => ({
      ...current,
      loading: true,
      error: '',
    }))

    try {
      if (!notificationRequest || notificationRequest.cacheKey !== notificationCacheKey) {
        notificationRequest = {
          cacheKey: notificationCacheKey,
          promise: getNotifications({ limit: 6 }).finally(() => {
            notificationRequest = null
          }),
        }
      }

      const payload = await notificationRequest.promise
      if (signal?.aborted) return

      const items = Array.isArray(payload?.data) ? payload.data.map(normalizeNotification) : []
      const nextState = {
        items,
        unreadCount: Number(payload?.meta?.unreadCount || 0),
        loading: false,
        error: '',
        loaded: true,
      }
      notificationCache.cacheKey = notificationCacheKey
      notificationCache.timestamp = Date.now()
      notificationCache.state = nextState
      setNotificationState(nextState)
    } catch (error) {
      if (!isAbortError(error)) {
        setNotificationState((current) => ({
          ...current,
          loading: false,
          error: error.message || 'Notifikasi gagal dimuat.',
          loaded: true,
        }))
      }
    }
  }, [notificationCacheKey])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => loadNotifications(controller.signal))
    return () => controller.abort()
  }, [loadNotifications])

  useEffect(() => {
    if (trimmedSearchQuery.length < 2) return undefined

    const controller = new AbortController()
    const timerId = window.setTimeout(async () => {
      setSearchState((current) => ({
        ...current,
        loading: true,
        error: '',
        hasSearched: true,
      }))

      try {
        const payload = await getGlobalSearch({ q: trimmedSearchQuery, limit: 5 }, { signal: controller.signal })
        setSearchState({
          results: {
            ...emptySearchResults(),
            ...(payload?.data || {}),
          },
          loading: false,
          error: '',
          hasSearched: true,
        })
        setSearchOpen(true)
      } catch (error) {
        if (!isAbortError(error)) {
          setSearchState({
            results: emptySearchResults(),
            loading: false,
            error: error.message || 'Pencarian gagal dimuat.',
            hasSearched: true,
          })
          setSearchOpen(true)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timerId)
      controller.abort()
    }
  }, [trimmedSearchQuery])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
      if (notifWrapRef.current && !notifWrapRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const handleSearchChange = (event) => {
    const nextValue = event.target.value
    setSearchQuery(nextValue)

    if (nextValue.trim().length < 2) {
      setSearchState({
        results: emptySearchResults(),
        loading: false,
        error: '',
        hasSearched: false,
      })
      setSearchOpen(false)
      return
    }

    setSearchOpen(true)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchOpen(false)
    setSearchState({
      results: emptySearchResults(),
      loading: false,
      error: '',
      hasSearched: false,
    })
  }

  const handleSearchResultClick = (result) => {
    clearSearch()
    if (result.url) navigate(result.url)
  }

  const handleNotificationClick = async (notification) => {
    const destination = getNotificationUrl(notification)
    setNotifOpen(false)

    if (!notification.isRead) {
      setNotificationState((current) => ({
        ...current,
        unreadCount: Math.max(current.unreadCount - 1, 0),
        items: current.items.map((item) =>
          item.id === notification.id ? { ...item, isRead: true, is_read: true } : item,
        ),
      }))

      try {
        await markNotificationAsRead(notification.id)
      } catch {
        Promise.resolve().then(() => loadNotifications(undefined, { force: true }))
      }
    }

    navigate(destination)
  }

  const handleMarkAllNotificationsRead = async () => {
    setNotificationState((current) => ({
      ...current,
      unreadCount: 0,
      items: current.items.map((item) => ({ ...item, isRead: true, is_read: true })),
    }))

    try {
      await markAllNotificationsAsRead()
    } catch {
      Promise.resolve().then(() => loadNotifications(undefined, { force: true }))
    }
  }

  const handleLogout = () => {
    notificationCache.cacheKey = ''
    notificationCache.timestamp = 0
    notificationCache.state = null
    notificationRequest = null
    setUserMenuOpen(false)
    setNotifOpen(false)
    setSearchOpen(false)
    setMobileMenuOpen(false)
    onLogout?.()
  }

  const handleMobileMenuClick = () => {
    setMobileMenuOpen(false)
  }

  if (isNestedLayout) {
    return children
  }

  return (
    <DashboardLayoutContext.Provider value>
      <div className="dashboard-shell">
        <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'dashboard-sidebar-collapsed' : ''}`}>
          <SidebarContent
            menus={menus}
            currentPath={pathname}
            sidebarCollapsed={sidebarCollapsed}
            userName={userName}
            userRole={normalizedRole}
            notifCount={displayNotifCount}
            onLogout={handleLogout}
          />
        </aside>

        {mobileMenuOpen ? (
          <button
            className="dashboard-backdrop"
            type="button"
            aria-label="Tutup menu dashboard"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <aside className={`dashboard-sidebar-mobile ${mobileMenuOpen ? 'dashboard-sidebar-open' : ''}`}>
          <SidebarContent
            menus={menus}
            currentPath={pathname}
            sidebarCollapsed={false}
            userName={userName}
            userRole={normalizedRole}
            notifCount={displayNotifCount}
            onLogout={handleLogout}
            onMenuClick={handleMobileMenuClick}
          />
        </aside>

        <div className={`dashboard-main ${sidebarCollapsed ? 'dashboard-main-collapsed' : ''}`}>
          <header className="dashboard-topbar">
            <div className="dashboard-topbar-left">
              <button
                className="dashboard-toggle-btn dashboard-toggle-desktop"
                type="button"
                aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                <Menu aria-hidden="true" />
              </button>
              <button
                className="dashboard-toggle-btn dashboard-toggle-mobile"
                type="button"
                aria-label="Buka menu dashboard"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu aria-hidden="true" />
              </button>
              <div className="dashboard-breadcrumb">
                <span>Dashboard</span>
                <span>/</span>
                <strong>{activeMenu.label}</strong>
              </div>
            </div>

            <div className="dashboard-search-wrap" ref={searchWrapRef}>
              <Search className="dashboard-search-icon" aria-hidden="true" />
              <input
                className="dashboard-search-input"
                type="search"
                value={searchQuery}
                placeholder="Cari SPPG, sekolah, distribusi..."
                aria-label="Cari data dashboard"
                aria-expanded={searchOpen}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (trimmedSearchQuery.length >= 2) setSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                }}
              />
              {searchQuery ? (
                <button className="dashboard-search-clear" type="button" aria-label="Bersihkan pencarian" onClick={clearSearch}>
                  <X aria-hidden="true" />
                </button>
              ) : null}
              {searchOpen ? (
                <div className="dashboard-dropdown dashboard-search-dropdown" role="listbox" aria-label="Hasil pencarian global">
                  {searchState.loading ? (
                    <div className="dashboard-dropdown-state">
                      <Loader2 className="dashboard-spin" aria-hidden="true" />
                      <span>Mencari data...</span>
                    </div>
                  ) : null}

                  {!searchState.loading && searchState.error ? (
                    <div className="dashboard-dropdown-state dashboard-dropdown-state-error">
                      <span>{searchState.error}</span>
                    </div>
                  ) : null}

                  {!searchState.loading && !searchState.error && searchState.hasSearched && !hasSearchResults(searchState.results) ? (
                    <div className="dashboard-dropdown-state">Tidak ada hasil untuk "{trimmedSearchQuery}".</div>
                  ) : null}

                  {!searchState.loading && !searchState.error
                    ? SEARCH_GROUPS.map((group) => {
                        const items = searchState.results[group.key] || []
                        const Icon = group.icon

                        if (items.length === 0) return null

                        return (
                          <section className="dashboard-search-group" key={group.key}>
                            <div className="dashboard-search-group-title">
                              <Icon aria-hidden="true" />
                              <span>{group.label}</span>
                            </div>
                            {items.map((item) => (
                              <button
                                className="dashboard-search-result"
                                key={`${group.key}-${item.id}`}
                                type="button"
                                role="option"
                                onClick={() => handleSearchResultClick(item)}
                              >
                                <span className="dashboard-search-result-title">{item.title}</span>
                                {item.subtitle ? <span className="dashboard-search-result-subtitle">{item.subtitle}</span> : null}
                              </button>
                            ))}
                          </section>
                        )
                      })
                    : null}
                </div>
              ) : null}
            </div>

            <div className="dashboard-topbar-right">
              <div className="dashboard-notif-wrap" ref={notifWrapRef}>
                <button
                  className="dashboard-notif-btn"
                  type="button"
                  aria-label="Buka notifikasi"
                  onClick={() => {
                    setNotifOpen((current) => {
                      const nextOpen = !current
                      if (nextOpen) {
                        Promise.resolve().then(() => loadNotifications(undefined, { force: true }))
                      }
                      return nextOpen
                    })
                    setUserMenuOpen(false)
                    setSearchOpen(false)
                  }}
                >
                  <Bell aria-hidden="true" />
                  {displayNotifCount > 0 ? <span className="dashboard-notif-badge">{displayNotifCount}</span> : null}
                </button>
                {notifOpen ? (
                  <div className="dashboard-dropdown dashboard-notif-dropdown">
                    <div className="dashboard-dropdown-header">
                      <strong>Notifikasi</strong>
                      {displayNotifCount > 0 ? (
                        <button type="button" onClick={handleMarkAllNotificationsRead}>
                          Tandai dibaca
                        </button>
                      ) : null}
                    </div>

                    {notificationState.loading ? (
                      <div className="dashboard-dropdown-state">
                        <Loader2 className="dashboard-spin" aria-hidden="true" />
                        <span>Memuat notifikasi...</span>
                      </div>
                    ) : null}

                    {!notificationState.loading && notificationState.error ? (
                      <div className="dashboard-dropdown-state dashboard-dropdown-state-error">
                        <span>{notificationState.error}</span>
                        <button type="button" onClick={() => loadNotifications(undefined, { force: true })}>
                          Coba lagi
                        </button>
                      </div>
                    ) : null}

                    {!notificationState.loading && !notificationState.error && notificationState.items.length === 0 ? (
                      <div className="dashboard-dropdown-state">Belum ada notifikasi.</div>
                    ) : null}

                    {!notificationState.loading && !notificationState.error
                      ? notificationState.items.map((notification) => (
                          <button
                            key={notification.id}
                            className={`dashboard-dropdown-item dashboard-notif-item ${notification.isRead ? '' : 'dashboard-notif-item-unread'}`}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <span className="dashboard-notif-dot" aria-hidden="true" />
                            <span className="dashboard-notif-text">
                              <span className="dashboard-notif-title">{notification.title}</span>
                              <span className="dashboard-notif-message">{notification.message}</span>
                              <span className="dashboard-notif-meta">
                                {NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}
                                {notification.createdAt ? ` - ${formatDateTime(notification.createdAt)}` : ''}
                              </span>
                            </span>
                          </button>
                        ))
                      : null}
                  </div>
                ) : null}
              </div>

              <div className="dashboard-user-menu-wrap" ref={userMenuRef}>
                <button
                  className="dashboard-user-btn"
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((current) => !current)
                    setNotifOpen(false)
                    setSearchOpen(false)
                  }}
                >
                  <span className="dashboard-avatar">{getInitial(userName)}</span>
                  <span className="dashboard-user-name">{userName || 'Pengguna MBG'}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {userMenuOpen ? (
                  <div className="dashboard-dropdown dashboard-user-dropdown">
                    <Link className="dashboard-dropdown-item" to="/dashboard/profil" onClick={() => setUserMenuOpen(false)}>
                      <UserCircle aria-hidden="true" />
                      Profil
                    </Link>
                    <button className="dashboard-dropdown-item" type="button" onClick={handleLogout}>
                      <LogOut aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="dashboard-content">{children}</main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  )
}

export default DashboardLayout
