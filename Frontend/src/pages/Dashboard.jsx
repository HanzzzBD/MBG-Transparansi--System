import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileText,
  Loader2,
  Package,
  RefreshCcw,
  School,
  Truck,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { getDashboardRoleSummary, isAbortError } from '../services/api'
import './Dashboard.css'

const ROLE_LABELS = {
  admin: 'Admin',
  pemerintah: 'Pemerintah',
  sppg: 'SPPG',
  sekolah: 'Sekolah',
}

const STATUS_LABELS = {
  in_progress: 'Sedang Berjalan',
  delivered: 'Terkirim',
  failed: 'Gagal',
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  conflict: 'Konflik',
  issue_reported: 'Masalah Dilaporkan',
  resolved: 'Resolved',
  open: 'Open',
}

const ANOMALY_LABELS = {
  OVER_CAPACITY: 'Melebihi Kapasitas',
  PRICE_ANOMALY: 'Anomali Harga',
  VALIDATION_CONFLICT: 'Konflik Validasi',
  PENDING_TIMEOUT: 'Pending Timeout',
}

const EMPTY_DASHBOARD_DATA = {
  kpis: [],
  charts: {
    distributionTrend: [],
    successRateTrend: [],
    provinceRanking: [],
    portionsTrend: [],
    acceptanceTrend: [],
  },
  recentData: {
    anomalies: [],
    distributionsToday: [],
    pendingValidations: [],
    validationsRecent: [],
  },
  alerts: [],
  hasRequestError: false,
}

const KPI_ICON_MAP = {
  totalActiveSppg: Building2,
  distributionsToday: Truck,
  successRate: CheckCircle2,
  anomalyTotal: Zap,
  budgetTotal: Wallet,
  publicReportTotal: FileText,
  totalPortionsToday: UtensilsCrossed,
  deliveredDistributions: Truck,
  pendingValidations: Clock3,
  failedDistributions: AlertTriangle,
  pendingConfirmations: ClipboardCheck,
  receivedPortionsToday: School,
  schoolReportsThisMonth: FileText,
}

const KPI_COLOR_MAP = {
  totalActiveSppg: '#0071e4',
  distributionsToday: '#057a55',
  successRate: '#057a55',
  anomalyTotal: '#9b1c1c',
  budgetTotal: '#0f4c81',
  publicReportTotal: '#92400e',
  totalPortionsToday: '#0071e4',
  deliveredDistributions: '#057a55',
  pendingValidations: '#92400e',
  failedDistributions: '#9b1c1c',
  pendingConfirmations: '#92400e',
  receivedPortionsToday: '#057a55',
  schoolReportsThisMonth: '#6b7280',
}

function getDefaultDateRange() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 6)

  return {
    dateFrom: toInputDate(start),
    dateTo: toInputDate(today),
  }
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10)
}

function safeNumber(value, defaultValue = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : defaultValue
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(safeNumber(value))
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(safeNumber(value))}%`
}

function formatCurrency(value) {
  const numericValue = safeNumber(value)
  if (numericValue >= 1000000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(numericValue / 1000000000)}M`
  }

  if (numericValue >= 1000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(numericValue / 1000000)}Jt`
  }

  return `Rp ${new Intl.NumberFormat('id-ID').format(numericValue)}`
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeRole(role) {
  return ROLE_LABELS[role] ? role : 'pemerintah'
}

function getDashboardParams(filters) {
  return {
    province: filters.province,
    city: filters.city,
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
  }
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '-'
}

function getAnomalyLabel(type) {
  return ANOMALY_LABELS[type] || type || '-'
}

function getAnomalyClass(type) {
  if (type === 'OVER_CAPACITY') return 'dashboard-badge-over-capacity'
  if (type === 'PRICE_ANOMALY') return 'dashboard-badge-price'
  if (type === 'VALIDATION_CONFLICT') return 'dashboard-badge-validation'
  if (type === 'PENDING_TIMEOUT') return 'dashboard-badge-timeout'
  return ''
}

function makeInitialData() {
  return {
    ...EMPTY_DASHBOARD_DATA,
    charts: { ...EMPTY_DASHBOARD_DATA.charts },
    recentData: { ...EMPTY_DASHBOARD_DATA.recentData },
    alerts: [],
  }
}

function normalizeDashboardData(payload) {
  const data = payload?.data || payload || {}

  return {
    kpis: Array.isArray(data.kpis) ? data.kpis : [],
    charts: {
      ...EMPTY_DASHBOARD_DATA.charts,
      ...(data.charts || {}),
    },
    recentData: {
      ...EMPTY_DASHBOARD_DATA.recentData,
      ...(data.recentData || {}),
    },
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    hasRequestError: false,
  }
}

function getChartRows(data, key) {
  return Array.isArray(data.charts?.[key]) ? data.charts[key] : []
}

function getRecentRows(data, key) {
  return Array.isArray(data.recentData?.[key]) ? data.recentData[key] : []
}

function hasAnyDashboardData(data) {
  const chartHasRows = Object.values(data.charts || {}).some((value) => Array.isArray(value) && value.length > 0)
  const recentHasRows = Object.values(data.recentData || {}).some((value) => Array.isArray(value) && value.length > 0)
  const kpiHasValue = (data.kpis || []).some((item) => safeNumber(item.value) > 0)
  return chartHasRows || recentHasRows || kpiHasValue || (data.alerts || []).length > 0
}

function getRoleTitle(role) {
  if (role === 'sppg') return 'Dashboard Operasional SPPG'
  if (role === 'sekolah') return 'Dashboard Validasi Sekolah'
  if (role === 'admin') return 'Dashboard Nasional dan Sistem'
  return 'Dashboard Nasional Pemerintah'
}

function getRoleSubtitle(role) {
  if (role === 'sppg') return 'Pantau produksi porsi, pengiriman hari ini, dan validasi dari sekolah.'
  if (role === 'sekolah') return 'Konfirmasi penerimaan, kualitas makanan, dan laporan distribusi sekolah.'
  if (role === 'admin') return 'Ringkasan nasional, anomali aktif, anggaran, dan indikator kesehatan sistem.'
  return 'Monitor capaian distribusi nasional, tren wilayah, laporan publik, dan anomali.'
}

function formatKpiValue(item) {
  if (item.valueType === 'currency') return formatCurrency(item.value)
  if (item.valueType === 'percent') return formatPercent(item.value)
  return formatNumber(item.value)
}

function getDashboardKpis(data) {
  return (data.kpis || []).map((item) => ({
    ...item,
    value: formatKpiValue(item),
    change: item.description || '',
    color: KPI_COLOR_MAP[item.key] || '#0071e4',
    icon: KPI_ICON_MAP[item.key] || Package,
    pulse: ['anomalyTotal', 'pendingValidations', 'pendingConfirmations', 'failedDistributions'].includes(item.key)
      && safeNumber(item.value) > 0,
  }))
}

function getDashboardAlerts(data) {
  return Array.isArray(data.alerts) ? data.alerts : []
}

function getDashboardNotificationCount(data) {
  return getDashboardAlerts(data).reduce((total, alert) => total + safeNumber(alert.count), 0)
}

function KpiCard({ item, index }) {
  const Icon = item.icon

  return (
    <article
      className={`dashboard-kpi-card dashboard-fade-card ${item.pulse ? 'dashboard-kpi-pulse' : ''}`}
      style={{ '--kpi-color': item.color, '--fade-delay': `${index * 100}ms` }}
    >
      <div className="dashboard-kpi-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="dashboard-kpi-content">
        <p className="dashboard-kpi-title">{item.title}</p>
        <strong>{item.value}</strong>
        <span>{item.change}</span>
      </div>
    </article>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="dashboard-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey} style={{ '--tooltip-color': item.color }}>
          {item.name}: {formatNumber(item.value)}
        </span>
      ))}
    </div>
  )
}

function ChartCard({ title, children, className = '' }) {
  return (
    <article className={`dashboard-chart-card dashboard-fade-card ${className}`}>
      <h3 className="dashboard-chart-title">{title}</h3>
      <div className="dashboard-chart-body">{children}</div>
    </article>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`dashboard-status-badge dashboard-status-${status || 'pending'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

function AnomalyBadge({ type }) {
  return <span className={`dashboard-badge-anomaly ${getAnomalyClass(type)}`}>{getAnomalyLabel(type)}</span>
}

function DataTable({ columns, rows, emptyText }) {
  return (
    <div className="dashboard-table-scroll">
      <table className="dashboard-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="dashboard-table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ children }) {
  return <div className="dashboard-empty-state">{children}</div>
}

function AlertStack({ alerts }) {
  if (!alerts.length) {
    return <EmptyState>Tidak ada alert operasional.</EmptyState>
  }

  return (
    <div className="dashboard-alert-stack">
      {alerts.map((alert) => (
        <div key={`${alert.type}-${alert.title}`} className={`dashboard-alert dashboard-alert-${alert.type}`}>
          <AlertCircle aria-hidden="true" />
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterBar({
  selectedProvince,
  selectedCity,
  dateFrom,
  dateTo,
  onProvinceChange,
  onCityChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}) {
  return (
    <div className="dashboard-filter-bar">
      <label className="dashboard-filter-field">
        <span>Provinsi</span>
        <input
          type="search"
          value={selectedProvince}
          onChange={(event) => onProvinceChange(event.target.value)}
          placeholder="Semua provinsi"
        />
      </label>

      <label className="dashboard-filter-field">
        <span>Kota</span>
        <input
          type="search"
          value={selectedCity}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder="Semua kota"
        />
      </label>

      <label className="dashboard-filter-field">
        <span>Dari tanggal</span>
        <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
      </label>

      <label className="dashboard-filter-field">
        <span>Sampai tanggal</span>
        <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
      </label>

      <div className="dashboard-filter-actions">
        <button className="dashboard-reset-btn" type="button" onClick={onReset}>
          <RefreshCcw aria-hidden="true" />
          Reset Filter
        </button>
      </div>
    </div>
  )
}

function renderSppgCharts(data) {
  const portionsTrend = getChartRows(data, 'portionsTrend')

  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Porsi Diproduksi 7 Hari Terakhir" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={portionsTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="portions" name="Porsi" fill="#0071e4" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderSchoolCharts(data) {
  const acceptanceTrend = getChartRows(data, 'acceptanceTrend')

  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Tren Penerimaan 30 Hari" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={acceptanceTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="received" name="Porsi diterima" stroke="#0071e4" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderNationalCharts(data) {
  const distributionTrend = getChartRows(data, 'distributionTrend')
  const successRateTrend = getChartRows(data, 'successRateTrend')
  const provinceRanking = getChartRows(data, 'provinceRanking')

  return (
    <div className="dashboard-chart-grid">
      <ChartCard title="Distribusi Harian 7 Hari" className="dashboard-chart-main">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={distributionTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="verified" name="Verified" stackId="distribution" fill="#057a55" radius={[5, 5, 0, 0]} />
            <Bar dataKey="conflict" name="Conflict" stackId="distribution" fill="#9b1c1c" />
            <Bar dataKey="pending" name="Pending" stackId="distribution" fill="#92400e" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tren Success Rate 30 Hari" className="dashboard-chart-side">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={successRateTrend}>
            <CartesianGrid stroke="#f4f8fb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="successRate"
              name="Success Rate"
              stroke="#0071e4"
              fill="#b5e0ea"
              fillOpacity={0.3}
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="TOP 10 Provinsi by Distribusi" className="dashboard-chart-full">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={provinceRanking} layout="vertical" margin={{ left: 20, right: 24 }}>
            <CartesianGrid stroke="#f4f8fb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="province"
              width={128}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="totalDistributions" name="Distribusi" fill="#0f4c81" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function renderSppgTable(data) {
  const rows = getRecentRows(data, 'distributionsToday').slice(0, 5)
  const columns = [
    {
      key: 'school',
      label: 'Sekolah',
      render: (row) => row.school?.name || '-',
    },
    {
      key: 'portions',
      label: 'Porsi',
      render: (row) => formatNumber(row.portions),
    },
    {
      key: 'pricePerPortion',
      label: 'Harga/Porsi',
      render: (row) => formatCurrency(row.pricePerPortion),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'time',
      label: 'Jam',
      render: (row) => formatTime(row.distributionDate || row.createdAt),
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <Link className="dashboard-action-btn" to={`/dashboard/distribusi/status?id=${row.id}`}>
          Update Status
        </Link>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Belum ada distribusi aktif hari ini." />
}

function renderSchoolTable(data) {
  const rows = getRecentRows(data, 'pendingValidations').slice(0, 5)
  const columns = [
    {
      key: 'sppg',
      label: 'SPPG Pengirim',
      render: (row) => row.distribution?.sppg?.name || row.school?.sppg?.name || '-',
    },
    {
      key: 'portions',
      label: 'Porsi',
      render: (row) => formatNumber(row.distribution?.portions || row.receivedPortions),
    },
    {
      key: 'date',
      label: 'Tanggal',
      render: (row) => formatDate(row.distribution?.distributionDate || row.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <div className="dashboard-table-actions">
          <Link className="dashboard-action-btn" to={`/dashboard/konfirmasi-distribusi?id=${row.id}`}>
            Konfirmasi
          </Link>
          <Link className="dashboard-action-btn dashboard-action-secondary" to="/dashboard/laporan-sekolah">
            Laporkan
          </Link>
        </div>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Tidak ada konfirmasi pending." />
}

function renderNationalTable(data) {
  const rows = getRecentRows(data, 'anomalies').slice(0, 5)
  const columns = [
    {
      key: 'sppg',
      label: 'SPPG',
      render: (row) => row.sppg_name || row.distribution?.sppg?.name || '-',
    },
    {
      key: 'school',
      label: 'Sekolah',
      render: (row) => row.school_name || row.distribution?.school?.name || '-',
    },
    {
      key: 'anomalyType',
      label: 'Tipe Anomali',
      render: (row) => <AnomalyBadge type={row.anomaly_type || row.anomalyType} />,
    },
    {
      key: 'date',
      label: 'Tanggal',
      render: (row) => formatDate(row.created_at || row.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.isResolved ? 'resolved' : row.distribution_status || 'open'} />,
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <Link className="dashboard-action-btn" to={`/dashboard/anomaly?id=${row.id}`}>
          Detail
        </Link>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} emptyText="Tidak ada anomali aktif." />
}

function Dashboard({ userRole, userName, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const normalizedRole = normalizeRole(userRole)
  const displayName = userName || 'Pengguna MBG'
  const defaultRange = useMemo(() => getDefaultDateRange(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboardData, setDashboardData] = useState(() => makeInitialData(normalizedRole))
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom)
  const [dateTo, setDateTo] = useState(defaultRange.dateTo)
  const [filters, setFilters] = useState({
    province: '',
    city: '',
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
  })

  const isNationalRole = normalizedRole === 'pemerintah' || normalizedRole === 'admin'

  const handleProvinceChange = (province) => {
    setSelectedProvince(province)
    setSelectedCity('')
    setFilters((current) => ({ ...current, province, city: '' }))
  }

  const handleCityChange = (city) => {
    setSelectedCity(city)
    setFilters((current) => ({ ...current, city }))
  }

  const handleDateFromChange = (value) => {
    setDateFrom(value)
    setFilters((current) => ({ ...current, dateFrom: value }))
  }

  const handleDateToChange = (value) => {
    setDateTo(value)
    setFilters((current) => ({ ...current, dateTo: value }))
  }

  const handleResetFilter = () => {
    setSelectedProvince('')
    setSelectedCity('')
    setDateFrom(defaultRange.dateFrom)
    setDateTo(defaultRange.dateTo)
    setFilters({
      province: '',
      city: '',
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
    })
  }

  const fetchDashboard = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const params = isNationalRole ? getDashboardParams(filters) : undefined
        const response = await getDashboardRoleSummary(normalizedRole, params, { signal })
        setDashboardData(normalizeDashboardData(response))
      } catch (fetchError) {
        if (!isAbortError(fetchError)) {
          setDashboardData(makeInitialData())
          setError(fetchError.message || 'Dashboard gagal memuat data dari backend.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [filters, isNationalRole, normalizedRole],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchDashboard(controller.signal))

    return () => controller.abort()
  }, [fetchDashboard])

  const kpis = useMemo(() => getDashboardKpis(dashboardData), [dashboardData])

  const alerts = useMemo(() => getDashboardAlerts(dashboardData), [dashboardData])

  const notifCount = useMemo(() => getDashboardNotificationCount(dashboardData), [dashboardData])
  const isDashboardEmpty = !loading && !error && !hasAnyDashboardData(dashboardData)

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }

    navigate('/login')
  }

  return (
    <DashboardLayout
      userRole={normalizedRole}
      userName={displayName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={notifCount}
    >
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-subtitle">{ROLE_LABELS[normalizedRole]} - MBG Transparency System</p>
            <h1 className="dashboard-title">{getRoleTitle(normalizedRole)}</h1>
            <p className="dashboard-header-desc">{getRoleSubtitle(normalizedRole)}</p>
          </div>
          <div className="dashboard-header-meta">
            <Database aria-hidden="true" />
            <span>{dashboardData.hasRequestError ? 'Data backend parsial' : 'Data backend aktif'}</span>
          </div>
        </header>

        {isNationalRole ? (
          <FilterBar
            selectedProvince={selectedProvince}
            selectedCity={selectedCity}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onProvinceChange={handleProvinceChange}
            onCityChange={handleCityChange}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onReset={handleResetFilter}
          />
        ) : null}

        {loading ? (
          <div className="dashboard-loading">
            <Loader2 aria-hidden="true" />
            <span>Memuat data dashboard dari backend...</span>
          </div>
        ) : null}

        {error ? (
          <div className="dashboard-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {isDashboardEmpty ? (
          <EmptyState>Belum ada data dashboard untuk role dan filter ini.</EmptyState>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Ringkasan KPI</h2>
          </div>
          {kpis.length ? (
            <div className={`dashboard-kpi-grid ${isNationalRole ? 'dashboard-kpi-grid-6' : 'dashboard-kpi-grid-4'}`}>
              {kpis.map((item, index) => (
                <KpiCard key={item.title} item={item} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState>Ringkasan KPI belum tersedia.</EmptyState>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Analitik</h2>
          </div>
          {normalizedRole === 'sppg' ? renderSppgCharts(dashboardData) : null}
          {normalizedRole === 'sekolah' ? renderSchoolCharts(dashboardData) : null}
          {isNationalRole ? renderNationalCharts(dashboardData) : null}
        </section>

        {normalizedRole === 'sekolah' ? (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2 className="dashboard-section-title">Distribusi 30 Hari Terakhir</h2>
            </div>
            <div className="dashboard-table-card dashboard-fade-card">
              <DataTable
                columns={[
                  {
                    key: 'sppg',
                    label: 'SPPG',
                    render: (row) => row.distribution?.sppg?.name || row.school?.sppg?.name || '-',
                  },
                  {
                    key: 'received',
                    label: 'Porsi Diterima',
                    render: (row) => formatNumber(row.receivedPortions),
                  },
                  {
                    key: 'date',
                    label: 'Tanggal',
                    render: (row) => formatDate(row.distribution?.distributionDate || row.createdAt),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
                rows={getRecentRows(dashboardData, 'validationsRecent').slice(0, 5)}
                emptyText="Riwayat validasi belum tersedia."
              />
            </div>
          </section>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              {normalizedRole === 'sppg'
                ? 'Distribusi Aktif Hari Ini'
                : normalizedRole === 'sekolah'
                  ? 'Konfirmasi Pending'
                  : 'Anomali Aktif'}
            </h2>
          </div>
          <div className="dashboard-table-card dashboard-fade-card">
            {normalizedRole === 'sppg' ? renderSppgTable(dashboardData) : null}
            {normalizedRole === 'sekolah' ? renderSchoolTable(dashboardData) : null}
            {isNationalRole ? renderNationalTable(dashboardData) : null}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Alert Operasional</h2>
          </div>
          <AlertStack alerts={alerts} />
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
