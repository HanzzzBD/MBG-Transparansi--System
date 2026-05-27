import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Anggaran from './pages/Anggaran.jsx'
import AdminSchools from './pages/AdminSchools.jsx'
import AdminSppg from './pages/AdminSppg.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Distribusi from './pages/Distribusi.jsx'
import DapodikImport from './pages/DapodikImport.jsx'
import Konfirmasi from './pages/Konfirmasi.jsx'
import Landing from './pages/Landing.jsx'
import LaporanMasyarakat from './pages/LaporanMasyarakat.jsx'
import LockUnlock from './pages/LockUnlock.jsx'
import Login from './pages/Login.jsx'
import OverrideData from './pages/OverrideData.jsx'
import PublicPetaSPPG from './pages/PublicPetaSPPG.jsx'
import PublicStatistik from './pages/PublicStatistik.jsx'
import ProductionBatches from './pages/ProductionBatches.jsx'
import SchoolHistory from './pages/SchoolHistory.jsx'
import SchoolProfile from './pages/SchoolProfile.jsx'
import SchoolReports from './pages/SchoolReports.jsx'
import SppgHistory from './pages/SppgHistory.jsx'
import SppgIssues from './pages/SppgIssues.jsx'
import SppgMenu from './pages/SppgMenu.jsx'
import SppgProfile from './pages/SppgProfile.jsx'
import SppgSchools from './pages/SppgSchools.jsx'
import UserManagement from './pages/UserManagement.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import { checkSessionRequest, logoutRequest } from './services/api.js'
import useAuthStore from './store/authStore.js'

let sessionCheckPromise = null

const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const AnomalyDetection = lazy(() => import('./pages/AnomalyDetection.jsx'))
const ApiMonitoring = lazy(() => import('./pages/ApiMonitoring.jsx'))
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'))
const ExportData = lazy(() => import('./pages/ExportData.jsx'))
const PetaSPPG = lazy(() => import('./pages/PetaSPPG.jsx'))

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
  ['/dashboard/lock-data', '/lock-unlock'],
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
  return String(role || '').toLowerCase()
}

function RouteFallback() {
  return (
    <div style={{ padding: '24px', fontWeight: 700 }}>
      Memuat halaman...
    </div>
  )
}

function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isRefreshingSession, isSessionChecked, logout } = useAuthStore()
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

  const handleLoginSuccess = (userData, accessToken) => {
    login(userData, accessToken)
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

function FallbackRoute() {
  const { user, token, isAuthenticated, isSessionChecked } = useAuthStore()

  if (!isSessionChecked) {
    return <RouteFallback />
  }

  return <Navigate to={isAuthenticated && user && token ? '/dashboard' : '/'} replace />
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
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginRoute />} />
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
      <Route
        path="/api-monitoring"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/api-monitoring']}>
            {(props) => <ApiMonitoring {...props} />}
          </ProtectedRoute>
        }
      />

      {legacyRouteRedirects.map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}

      <Route path="*" element={<FallbackRoute />} />
    </Routes>
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
