import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import { checkSessionRequest, getMePermissions, logoutRequest } from './services/api.js'
import useAuthStore from './store/authStore.js'

let sessionCheckPromise = null
const ENABLE_SETTINGS_PAGE =
  import.meta.env.VITE_ENABLE_SETTINGS_PAGE === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_SETTINGS_PAGE !== 'false')

const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const Anggaran = lazy(() => import('./pages/Anggaran.jsx'))
const AdminSchools = lazy(() => import('./pages/AdminSchools.jsx'))
const AdminSppg = lazy(() => import('./pages/AdminSppg.jsx'))
const AnomalyDetection = lazy(() => import('./pages/AnomalyDetection.jsx'))
const ApiMonitoring = lazy(() => import('./pages/ApiMonitoring.jsx'))
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Distribusi = lazy(() => import('./pages/Distribusi.jsx'))
const DapodikImport = lazy(() => import('./pages/DapodikImport.jsx'))
const ExportData = lazy(() => import('./pages/ExportData.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const Konfirmasi = lazy(() => import('./pages/Konfirmasi.jsx'))
const Landing = lazy(() => import('./pages/Landing.jsx'))
const LaporanMasyarakat = lazy(() => import('./pages/LaporanMasyarakat.jsx'))
const LockUnlock = lazy(() => import('./pages/LockUnlock.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const OverrideData = lazy(() => import('./pages/OverrideData.jsx'))
const PetaSPPG = lazy(() => import('./pages/PetaSPPG.jsx'))
const PublicPetaSPPG = lazy(() => import('./pages/PublicPetaSPPG.jsx'))
const PublicStatistik = lazy(() => import('./pages/PublicStatistik.jsx'))
const ProductionBatches = lazy(() => import('./pages/ProductionBatches.jsx'))
const SchoolHistory = lazy(() => import('./pages/SchoolHistory.jsx'))
const SchoolProfile = lazy(() => import('./pages/SchoolProfile.jsx'))
const SchoolReports = lazy(() => import('./pages/SchoolReports.jsx'))
const SppgHistory = lazy(() => import('./pages/SppgHistory.jsx'))
const SppgIssues = lazy(() => import('./pages/SppgIssues.jsx'))
const SppgMenu = lazy(() => import('./pages/SppgMenu.jsx'))
const SppgProfile = lazy(() => import('./pages/SppgProfile.jsx'))
const SppgSchools = lazy(() => import('./pages/SppgSchools.jsx'))
const UserManagement = lazy(() => import('./pages/UserManagement.jsx'))

const routeAccess = {
  '/dashboard': ['admin', 'pemerintah', 'sppg', 'sekolah'],
  '/peta': ['admin', 'pemerintah', 'sppg', 'sekolah'],
  '/distribusi': ['sppg', 'admin'],
  '/sekolah-saluran': ['sppg'],
  '/production-batches': ['sppg', 'admin'],
  '/input-menu': ['sppg'],
  '/laporan-kendala': ['sppg'],
  '/riwayat': ['sppg', 'sekolah'],
  '/profil': ['sppg', 'sekolah'],
  '/validasi': ['sekolah'],
  '/laporan-sekolah': ['sekolah'],
  '/konfirmasi': ['sekolah'],
  '/analytics': ['pemerintah', 'admin'],
  '/anggaran': ['pemerintah', 'admin'],
  '/anomaly': ['pemerintah', 'admin'],
  '/audit-log': ['pemerintah', 'admin'],
  '/export': ['pemerintah', 'admin'],
  '/laporan-masyarakat': ['pemerintah', 'admin'],
  '/admin/sppg': ['admin'],
  '/admin/schools': ['admin'],
  '/users': ['admin'],
  '/lock-unlock': ['admin'],
  '/override': ['admin'],
  '/api-monitoring': ['admin'],
  '/dapodik': ['admin'],
  '/settings': ['admin'],
}

const routePermissions = {
  '/dashboard': {
    admin: 'admin.dashboard.view',
    pemerintah: 'admin.dashboard.view',
  },
  '/peta': {
    admin: 'admin.map.view',
    pemerintah: 'admin.map.view',
  },
  '/analytics': {
    admin: 'admin.analytics.view',
    pemerintah: 'admin.analytics.view',
  },
  '/anggaran': {
    admin: 'admin.budget.view',
    pemerintah: 'admin.budget.view',
  },
  '/laporan-masyarakat': {
    admin: 'admin.public_reports.view',
    pemerintah: 'admin.public_reports.view',
  },
  '/anomaly': {
    admin: 'admin.anomaly.view',
    pemerintah: 'admin.anomaly.view',
  },
  '/audit-log': {
    admin: 'admin.audit_log.view',
    pemerintah: 'admin.audit_log.view',
  },
  '/export': {
    admin: 'admin.export.view',
    pemerintah: 'admin.export.view',
  },
  '/admin/sppg': {
    admin: ['admin.sppg.manage', 'admin.master_sppg.manage'],
  },
  '/admin/schools': {
    admin: ['admin.school.manage', 'admin.master_school.manage'],
  },
  '/sppg': {
    admin: ['admin.sppg.manage', 'admin.master_sppg.manage'],
  },
  '/sekolah': {
    admin: ['admin.school.manage', 'admin.master_school.manage'],
  },
  '/dapodik': {
    admin: 'admin.dapodik.manage',
  },
  '/users': {
    admin: 'admin.users.manage',
  },
  '/lock-unlock': {
    admin: 'admin.lock_unlock.manage',
  },
  '/override': {
    admin: 'admin.override.manage',
  },
  '/api-monitoring': {
    admin: 'admin.api_monitoring.view',
  },
  '/settings': {
    admin: 'admin.settings.manage',
  },
  '/distribusi': {
    admin: 'distribution.view',
    sppg: 'distribution.view',
  },
  '/sekolah-saluran': {
    sppg: 'sppg.school_channel.view',
  },
  '/production-batches': {
    admin: 'production.view',
    sppg: 'production.view',
  },
  '/input-menu': {
    sppg: 'daily_menu.create',
  },
  '/laporan-kendala': {
    sppg: 'issue.view',
  },
  '/riwayat': {
    sppg: 'distribution.view',
    sekolah: 'distribution.view',
  },
  '/validasi': {
    sekolah: 'distribution.view',
  },
  '/laporan-sekolah': {
    sekolah: 'issue.view',
  },
  '/profil': {
    sppg: 'account.view',
    sekolah: 'account.view',
  },
}

const legacyRouteRedirects = [
  ['/dashboard/peta-sppg', '/peta'],
  ['/dashboard/distribusi/input', '/distribusi'],
  ['/dashboard/distribusi/status', '/distribusi'],
  ['/dashboard/sekolah-saluran', '/sekolah-saluran'],
  ['/dashboard/menu-harian', '/input-menu'],
  ['/dashboard/kendala', '/laporan-kendala'],
  ['/dashboard/riwayat-distribusi', '/riwayat'],
  ['/dashboard/profil-sppg', '/profil'],
  ['/dashboard/profil-sekolah', '/profil'],
  ['/dashboard/profil', '/profil'],
  ['/dashboard/konfirmasi-distribusi', '/validasi'],
  ['/dashboard/validasi', '/validasi'],
  ['/dashboard/laporan-sekolah', '/laporan-sekolah'],
  ['/dashboard/analitik-wilayah', '/analytics'],
  ['/dashboard/anggaran', '/anggaran'],
  ['/dashboard/anomaly', '/anomaly'],
  ['/dashboard/audit-log', '/audit-log'],
  ['/dashboard/export', '/export'],
  ['/dashboard/laporan-masyarakat', '/laporan-masyarakat'],
  ['/dashboard/users', '/users'],
  ['/dashboard/master-data', '/admin/sppg'],
  ['/admin/master-data', '/admin/sppg'],
  ['/sppg', '/admin/sppg'],
  ['/sekolah', '/admin/schools'],
  ['/dashboard/lock-data', '/lock-unlock'],
  ['/dashboard/settings', '/settings'],
  ['/dashboard/override', '/override'],
  ['/dashboard/api-monitoring', '/api-monitoring'],
  ['/admin/audit-logs', '/audit-log'],
  ['/admin/users', '/users'],
  ['/admin/lock-data', '/lock-unlock'],
  ['/admin/override', '/override'],
  ['/admin/exports', '/export'],
  ['/admin/public-reports', '/laporan-masyarakat'],
  ['/exports', '/export'],
  ['/public-reports', '/laporan-masyarakat'],
  ['/distributions', '/distribusi'],
  ['/validations', '/validasi'],
  ['/konfirmasi', '/validasi'],
]

function getUserName(user) {
  return user?.name || user?.email || 'Pengguna MBG'
}

function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase()
  return normalized === 'gov' ? 'pemerintah' : normalized
}

function normalizePermissionRequirement(requirement) {
  if (!requirement) return []
  return Array.isArray(requirement) ? requirement.filter(Boolean) : [requirement]
}

function hasAnyPermission(permissions, requirement) {
  const requiredPermissions = normalizePermissionRequirement(requirement)
  if (!requiredPermissions.length) return true
  return requiredPermissions.some((permissionKey) => permissions.includes(permissionKey))
}

function getRouteRequiredPermissions(pathname, role) {
  const matchedPath = Object.keys(routePermissions)
    .sort((first, second) => second.length - first.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!matchedPath) return []
  return normalizePermissionRequirement(routePermissions[matchedPath]?.[role])
}

async function loadEffectivePermissions() {
  const { setPermissions, setPermissionsLoading } = useAuthStore.getState()
  setPermissionsLoading(true)

  try {
    const payload = await getMePermissions()
    const data = payload?.data || payload || {}
    setPermissions(data.effectivePermissions || data.permissions || [])
  } catch {
    setPermissions([])
  } finally {
    setPermissionsLoading(false)
  }
}

function RouteFallback() {
  return (
    <div style={{ padding: '24px', fontWeight: 700 }}>
      Memuat halaman...
    </div>
  )
}

function AccessDenied({ requiredPermissions = [] }) {
  return (
    <section className="app-access-denied" aria-labelledby="access-denied-title">
      <p className="app-access-denied-code">403</p>
      <h1 id="access-denied-title">Akses Ditolak</h1>
      <p>Anda tidak memiliki akses untuk membuka halaman ini.</p>
      {requiredPermissions.length ? (
        <small>Permission dibutuhkan: {requiredPermissions.join(', ')}</small>
      ) : null}
    </section>
  )
}

function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    user,
    token,
    permissions,
    permissionsLoaded,
    permissionsLoading,
    isAuthenticated,
    isRefreshingSession,
    isSessionChecked,
    logout,
  } = useAuthStore()
  const role = normalizeRole(user?.role)
  const authenticated = Boolean(isAuthenticated && user && token)

  if (!isSessionChecked || isRefreshingSession) {
    return <RouteFallback />
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!allowedRoles?.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  const requiredPermissions = getRouteRequiredPermissions(location.pathname, role)
  const needsPermissionCheck = requiredPermissions.length > 0

  if (needsPermissionCheck && (!permissionsLoaded || permissionsLoading)) {
    return <RouteFallback />
  }

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch {
      // Frontend session must still be cleared if revoke fails or the cookie is already gone.
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  const routeProps = {
    userRole: role,
    userName: getUserName(user),
    userId: user?.id || user?.userId || user?.email || '',
    currentPath: location.pathname,
    notifCount: user?.notifCount || user?.notificationCount || 0,
    token,
    user,
    onLogout: handleLogout,
  }

  const hasRoutePermission = hasAnyPermission(permissions, requiredPermissions)

  if (!hasRoutePermission) {
    return (
      <DashboardLayout
        userRole={routeProps.userRole}
        userName={routeProps.userName}
        userId={routeProps.userId}
        currentPath={routeProps.currentPath}
        notifCount={routeProps.notifCount}
        onLogout={routeProps.onLogout}
      >
        <AccessDenied requiredPermissions={requiredPermissions} />
      </DashboardLayout>
    )
  }

  const page = typeof children === 'function' ? children(routeProps) : children

  return (
    <DashboardLayout
      userRole={routeProps.userRole}
      userName={routeProps.userName}
      userId={routeProps.userId}
      currentPath={routeProps.currentPath}
      notifCount={routeProps.notifCount}
      onLogout={routeProps.onLogout}
    >
      <Suspense fallback={<RouteFallback />}>
        {page}
      </Suspense>
    </DashboardLayout>
  )
}

function LoginRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token, isAuthenticated, isSessionChecked, login } = useAuthStore()

  if (!isSessionChecked) {
    return <RouteFallback />
  }

  if (isAuthenticated && user && token) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLoginSuccess = async (userData, accessToken) => {
    login(userData, accessToken)
    await loadEffectivePermissions()
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return <Login onLoginSuccess={handleLoginSuccess} />
}

function RoleAwareHistory(props) {
  return props.userRole === 'sekolah' ? <SchoolHistory {...props} /> : <SppgHistory {...props} />
}

function RoleAwareProfile(props) {
  return props.userRole === 'sekolah' ? <SchoolProfile {...props} /> : <SppgProfile {...props} />
}

function AppRoutes() {
  const { finishSessionCheck, login, logout, startSessionCheck } = useAuthStore()

  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      if (useAuthStore.getState().isSessionChecked) return

      startSessionCheck()

      try {
        if (!sessionCheckPromise) {
          sessionCheckPromise = checkSessionRequest().finally(() => {
            sessionCheckPromise = null
          })
        }

        const payload = await sessionCheckPromise
        const data = payload?.data || payload || {}

        if (!isMounted) return

        if (data.authenticated && data.user && data.accessToken) {
          login(data.user, data.accessToken)
          await loadEffectivePermissions()
        } else {
          logout()
        }
      } catch {
        if (isMounted) {
          logout()
        }
      } finally {
        if (isMounted) {
          finishSessionCheck()
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [finishSessionCheck, login, logout, startSessionCheck])

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/forgot-password" element={<ForgotPassword mode="request" />} />
      <Route path="/reset-password" element={<ForgotPassword mode="reset" />} />
      <Route path="/peta-publik" element={<PublicPetaSPPG />} />
      <Route path="/statistik" element={<PublicStatistik />} />
      <Route path="/anggaran-publik" element={<PublicStatistik />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/dashboard']}>
            {(props) => <Dashboard {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/peta"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/peta']}>
            {(props) => <PetaSPPG {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/distribusi"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/distribusi']}>
            {(props) => <Distribusi {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/sekolah-saluran"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/sekolah-saluran']}>
            {(props) => <SppgSchools {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/production-batches"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/production-batches']}>
            {(props) => <ProductionBatches {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/input-menu"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/input-menu']}>
            {(props) => <SppgMenu {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/laporan-kendala"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/laporan-kendala']}>
            {(props) => <SppgIssues {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/riwayat"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/riwayat']}>
            {(props) => <RoleAwareHistory {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/profil"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/profil']}>
            {(props) => <RoleAwareProfile {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/validasi"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/validasi']}>
            {(props) => <Konfirmasi {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/laporan-sekolah"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/laporan-sekolah']}>
            {(props) => <SchoolReports {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/konfirmasi"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/konfirmasi']}>
            {() => <Navigate to="/validasi" replace />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/analytics']}>
            {(props) => <Analytics {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/anggaran"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/anggaran']}>
            {(props) => <Anggaran {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/anomaly"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/anomaly']}>
            {(props) => <AnomalyDetection {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/audit-log']}>
            {(props) => <AuditLog {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/export"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/export']}>
            {(props) => <ExportData {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/laporan-masyarakat"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/laporan-masyarakat']}>
            {(props) => <LaporanMasyarakat {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sppg"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/admin/sppg']}>
            {(props) => <AdminSppg {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/schools"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/admin/schools']}>
            {(props) => <AdminSchools {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/users']}>
            {(props) => <UserManagement {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/dapodik"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/dapodik']}>
            {(props) => <DapodikImport {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/lock-unlock"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/lock-unlock']}>
            {(props) => <LockUnlock {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/override"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/override']}>
            {(props) => <OverrideData {...props} />}
          </ProtectedRoute>
        }
      />
      {ENABLE_SETTINGS_PAGE ? (
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={routeAccess['/settings']}>
              {() => (
                <section className="app-settings-page">
                  <p className="app-settings-eyebrow">Admin</p>
                  <h1>Pengaturan Sistem</h1>
                  <p>Panel pengaturan sistem belum tersedia untuk lingkungan produksi.</p>
                </section>
              )}
            </ProtectedRoute>
          }
        />
      ) : null}

      <Route
        path="/api-monitoring"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/api-monitoring']}>
            {(props) => <ApiMonitoring {...props} />}
          </ProtectedRoute>
        }
      />

      {legacyRouteRedirects
        .filter(([, to]) => ENABLE_SETTINGS_PAGE || to !== '/settings')
        .map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
