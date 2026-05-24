import { createContext, useContext, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  Zap,
} from 'lucide-react'
import './DashboardLayout.css'

const ROLE_LABELS = {
  admin: 'Admin',
  pemerintah: 'Pemerintah',
  sppg: 'SPPG',
  sekolah: 'Sekolah',
}

const ROLE_CLASSES = {
  admin: 'dashboard-role-admin',
  pemerintah: 'dashboard-role-pemerintah',
  sppg: 'dashboard-role-sppg',
  sekolah: 'dashboard-role-sekolah',
}

const dashboardMenu = {
  label: 'Dashboard',
  icon: LayoutDashboard,
  path: '/dashboard',
}

const sppgMenus = [
  { label: 'Input Menu Harian', icon: UtensilsCrossed, path: '/dashboard/menu-harian' },
  { label: 'Input Porsi & Distribusi', icon: Package, path: '/distribusi' },
  { label: 'Status Distribusi', icon: Truck, path: '/distribusi' },
  { label: 'Lapor Kendala', icon: AlertTriangle, path: '/dashboard/kendala' },
  { label: 'Riwayat Distribusi', icon: History, path: '/dashboard/riwayat-distribusi' },
  { label: 'Profil SPPG', icon: Building2, path: '/dashboard/profil-sppg' },
]

const sekolahMenus = [
  { label: 'Konfirmasi Distribusi', icon: CheckSquare, path: '/konfirmasi', badgeKey: 'notif' },
  { label: 'Validasi Porsi & Kualitas', icon: ClipboardCheck, path: '/konfirmasi' },
  { label: 'Laporan Sekolah', icon: FileText, path: '/dashboard/laporan-sekolah' },
  { label: 'Riwayat Distribusi', icon: History, path: '/dashboard/riwayat-distribusi' },
  { label: 'Profil Sekolah', icon: School, path: '/dashboard/profil-sekolah' },
]

const pemerintahMenus = [
  { label: 'Peta SPPG', icon: Map, path: '/peta' },
  { label: 'Analitik Wilayah', icon: BarChart3, path: '/analytics' },
  { label: 'Transparansi Anggaran', icon: Wallet, path: '/anggaran' },
  { label: 'Laporan Masyarakat', icon: MessageSquare, path: '/laporan-masyarakat', badgeKey: 'notif' },
  { label: 'Anomaly Detection', icon: Zap, path: '/anomaly' },
  { label: 'Audit Log', icon: ClipboardList, path: '/audit-log' },
  { label: 'Export Data', icon: Download, path: '/export' },
]

const adminExtraMenus = [
  { label: 'Data SPPG & Sekolah', icon: Database, path: '/dashboard/master-data' },
  { label: 'Import Dapodik', icon: Database, path: '/dapodik' },
  { label: 'User & Role', icon: Users, path: '/users' },
  { label: 'Lock / Unlock Data', icon: Lock, path: '/lock-unlock' },
  { label: 'Override Data', icon: ShieldAlert, path: '/override' },
  { label: 'API Monitoring', icon: Activity, path: '/api-monitoring' },
  { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
]

const notifications = [
  'Distribusi baru perlu divalidasi',
  'Ada laporan masyarakat baru',
  'Sistem mendeteksi anomali data',
]

const DashboardLayoutContext = createContext(false)

function getRoleMenus(userRole) {
  if (userRole === 'admin') return [dashboardMenu, ...pemerintahMenus, ...adminExtraMenus]
  if (userRole === 'pemerintah') return [dashboardMenu, ...pemerintahMenus]
  if (userRole === 'sekolah') return [dashboardMenu, ...sekolahMenus]
  return [dashboardMenu, ...sppgMenus]
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
  return (
    <span className={`dashboard-role-badge ${ROLE_CLASSES[role] || ''}`}>
      {ROLE_LABELS[role] || role}
    </span>
  )
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
          <span className="dashboard-logo-box">M</span>
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
  currentPath,
  children,
  onLogout,
  notifCount = 0,
}) {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isNestedLayout = useContext(DashboardLayoutContext)
  const normalizedRole = ROLE_LABELS[userRole] ? userRole : 'sppg'
  const pathname = currentPath || location.pathname

  const menus = useMemo(() => getRoleMenus(normalizedRole), [normalizedRole])
  const activeMenu = useMemo(() => getActiveMenu(menus, pathname), [menus, pathname])

  const handleLogout = () => {
    setUserMenuOpen(false)
    setNotifOpen(false)
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
            notifCount={notifCount}
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
            notifCount={notifCount}
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

            <div className="dashboard-search-wrap">
              <Search aria-hidden="true" />
              <input
                className="dashboard-search-input"
                type="search"
                placeholder="Cari SPPG, sekolah, distribusi..."
              />
            </div>

            <div className="dashboard-topbar-right">
              <div className="dashboard-notif-wrap">
                <button
                  className="dashboard-notif-btn"
                  type="button"
                  aria-label="Buka notifikasi"
                  onClick={() => {
                    setNotifOpen((current) => !current)
                    setUserMenuOpen(false)
                  }}
                >
                  <Bell aria-hidden="true" />
                  {notifCount > 0 ? <span className="dashboard-notif-badge">{notifCount}</span> : null}
                </button>
                {notifOpen ? (
                  <div className="dashboard-dropdown dashboard-notif-dropdown">
                    {notifications.map((message) => (
                      <button
                        key={message}
                        className="dashboard-dropdown-item"
                        type="button"
                        onClick={() => setNotifOpen(false)}
                      >
                        {message}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="dashboard-user-menu-wrap">
                <button
                  className="dashboard-user-btn"
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((current) => !current)
                    setNotifOpen(false)
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
