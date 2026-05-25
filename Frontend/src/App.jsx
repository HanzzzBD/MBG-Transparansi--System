import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Anggaran from './pages/Anggaran.jsx'
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
import ProductionBatches from './pages/ProductionBatches.jsx'
import UserManagement from './pages/UserManagement.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import useAuthStore from './store/authStore.js'

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
  '/production-batches': ['sppg', 'admin'],
  '/konfirmasi': ['sekolah', 'admin'],
  '/analytics': ['pemerintah', 'admin'],
  '/anggaran': ['pemerintah', 'admin'],
  '/anomaly': ['pemerintah', 'admin'],
  '/audit-log': ['pemerintah', 'admin'],
  '/export': ['pemerintah', 'admin'],
  '/laporan-masyarakat': ['pemerintah', 'admin'],
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
  ['/dashboard/konfirmasi-distribusi', '/konfirmasi'],
  ['/dashboard/validasi', '/konfirmasi'],
  ['/dashboard/analitik-wilayah', '/analytics'],
  ['/dashboard/anggaran', '/anggaran'],
  ['/dashboard/anomaly', '/anomaly'],
  ['/dashboard/audit-log', '/audit-log'],
  ['/dashboard/export', '/export'],
  ['/dashboard/laporan-masyarakat', '/laporan-masyarakat'],
  ['/dashboard/users', '/users'],
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
  ['/validations', '/konfirmasi'],
]

function readStorage(key) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
}

function getStoredToken() {
  return readStorage('mbg.accessToken') || readStorage('accessToken') || readStorage('token') || null
}

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
  const { user, token, isAuthenticated, logout } = useAuthStore()
  const role = normalizeRole(user?.role)
  const authenticated = Boolean(isAuthenticated && user)

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!allowedRoles?.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const routeProps = {
    userRole: role,
    userName: getUserName(user),
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
  const { user, isAuthenticated, login } = useAuthStore()

  if (isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLoginSuccess = (userData, accessToken) => {
    login(userData, accessToken || getStoredToken())
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return <Login onLoginSuccess={handleLoginSuccess} />
}

function FallbackRoute() {
  const { user, isAuthenticated } = useAuthStore()
  return <Navigate to={isAuthenticated && user ? '/dashboard' : '/'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/peta-publik" element={<PublicPetaSPPG />} />

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
        path="/production-batches"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/production-batches']}>
            {(props) => <ProductionBatches {...props} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/konfirmasi"
        element={
          <ProtectedRoute allowedRoles={routeAccess['/konfirmasi']}>
            {(props) => <Konfirmasi {...props} />}
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
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
