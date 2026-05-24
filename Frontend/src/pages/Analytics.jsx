import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, Loader2, RefreshCcw, TrendingUp, Wallet, Zap } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiRequest, getAnomalies, getDashboardSummary, getProductionBatches } from '../services/api'
import './Analytics.css'

const EMPTY_SUMMARY = {
  totalActiveSppg: 0,
  distributionsToday: 0,
  successRate: 0,
  problematicSppg: 0,
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(safeNumber(value))
}

function formatRupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(safeNumber(value))}`
}

function normalizeBatchTrend(items) {
  if (!Array.isArray(items) || !items.length) return []

  return items.slice(0, 12).reverse().map((item) => ({
    label: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(
      new Date(item.productionDate || item.production_date || item.createdAt),
    ),
    costPerPortion: safeNumber(item.costPerPortion ?? item.cost_per_portion),
    rawMaterialCost: safeNumber(item.rawMaterialCost ?? item.raw_material_cost),
    operationalCost: safeNumber(item.operationalCost ?? item.operational_cost),
  }))
}

function normalizeProvinceRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return []
  return rows.slice(0, 10).map((row) => ({
    province: row.province || '-',
    totalDistributions: safeNumber(row.total_distributions ?? row.totalDistributions ?? row.total),
  }))
}

function MetricCard({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <article className={`analytics-metric analytics-metric-${tone}`}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Analytics({ userRole = 'pemerintah' }) {
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [costTrend, setCostTrend] = useState([])
  const [provinceRows, setProvinceRows] = useState([])
  const [anomalyCount, setAnomalyCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError('')

    const [summaryResult, batchResult, provinceResult, anomalyResult] = await Promise.allSettled([
      getDashboardSummary(),
      getProductionBatches({ limit: 30 }),
      apiRequest('/analytics/by-province', { params: { limit: 10 } }),
      getAnomalies({ status: 'unresolved', limit: 100 }),
    ])

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value.data || EMPTY_SUMMARY)
    } else {
      setSummary(EMPTY_SUMMARY)
    }

    if (batchResult.status === 'fulfilled') {
      setCostTrend(normalizeBatchTrend(batchResult.value.data))
    }

    if (provinceResult.status === 'fulfilled') {
      setProvinceRows(normalizeProvinceRows(provinceResult.value.data))
    }

    if (anomalyResult.status === 'fulfilled') {
      const rows = Array.isArray(anomalyResult.value.data) ? anomalyResult.value.data : []
      setAnomalyCount(anomalyResult.value.meta?.total ?? rows.length)
    }

    if ([summaryResult, batchResult, provinceResult, anomalyResult].some((result) => result.status === 'rejected')) {
      setError('Sebagian data analytics gagal dimuat dari API.')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    Promise.resolve().then(fetchAnalytics)
  }, [fetchAnalytics])

  const avgCost = useMemo(() => {
    if (!costTrend.length) return 0
    return costTrend.reduce((sum, item) => sum + safeNumber(item.costPerPortion), 0) / costTrend.length
  }, [costTrend])

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="analytics-subtitle">Analytics Wilayah</p>
          <h1 className="analytics-title">Analitik MBG Nasional</h1>
          <p className="analytics-desc">
            Ringkasan distribusi, costing production batch, dan anomali untuk role {userRole}.
          </p>
        </div>
        <button className="analytics-btn" type="button" onClick={fetchAnalytics}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {error ? (
        <div className="analytics-error">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="analytics-loading">
          <Loader2 aria-hidden="true" />
          Memuat data analytics...
        </div>
      ) : null}

      <section className="analytics-metric-grid">
        <MetricCard icon={BarChart3} label="Distribusi Hari Ini" value={formatNumber(summary.distributionsToday)} />
        <MetricCard icon={TrendingUp} label="Success Rate" value={`${formatNumber(summary.successRate)}%`} tone="success" />
        <MetricCard icon={Wallet} label="Avg Cost/Porsi" value={formatRupiah(avgCost)} tone="navy" />
        <MetricCard icon={Zap} label="Anomali Aktif" value={formatNumber(anomalyCount || summary.problematicSppg)} tone="danger" />
      </section>

      <section className="analytics-chart-grid">
        <article className="analytics-chart-card">
          <h2>Tren Cost Per Portion</h2>
          {!costTrend.length && !loading ? <p className="analytics-desc">Belum ada data costing dari backend.</p> : null}
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={costTrend}>
              <CartesianGrid stroke="#f4f8fb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatRupiah(value)} />
              <Line type="monotone" dataKey="costPerPortion" name="Cost/Porsi" stroke="#0071e4" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="operationalCost" name="Operasional" stroke="#92400e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="analytics-chart-card">
          <h2>Distribusi per Provinsi</h2>
          {!provinceRows.length && !loading ? <p className="analytics-desc">Belum ada data provinsi dari backend.</p> : null}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={provinceRows} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid stroke="#f4f8fb" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="province" width={120} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="totalDistributions" name="Distribusi" fill="#0f4c81" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>
    </main>
  )
}

export default Analytics
