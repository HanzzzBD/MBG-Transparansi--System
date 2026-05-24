import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './Anggaran.css'

const EMPTY_BUDGET_SUMMARY = {
  totalBudgetUsed: 0,
  avgPricePerPortion: 0,
  anomalyCount: 0,
  rawMaterialAnomalyCount: 0,
  avgRawMaterialCost: 0,
  savingVsTarget: 0,
}

function getStorageItem(key) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
}

function getStoredUser() {
  const rawUser = getStorageItem('mbg.user') || getStorageItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

function formatRupiah(value) {
  const number = Number(value) || 0
  if (Math.abs(number) >= 1000000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(number / 1000000000)} Miliar`
  }
  if (Math.abs(number) >= 1000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(number / 1000000)} Juta`
  }
  return `Rp ${new Intl.NumberFormat('id-ID').format(number)}`
}

function formatTanggal(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

function getPriceStatus(row) {
  if (Number(row.avgHarga) > Number(row.thresholdMax)) return 'over'
  if (Number(row.avgHarga) < Number(row.thresholdMin)) return 'under'
  return 'normal'
}

function getStatusLabel(status) {
  if (status === 'over') return 'Di Atas Batas'
  if (status === 'under') return 'Di Bawah Minimum'
  return 'Normal'
}

function sortRows(rows, sortKey, sortDirection) {
  const direction = sortDirection === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const aValue = sortKey === 'status' ? getStatusLabel(getPriceStatus(a)) : a[sortKey]
    const bValue = sortKey === 'status' ? getStatusLabel(getPriceStatus(b)) : b[sortKey]

    if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction
    return String(aValue || '').localeCompare(String(bValue || ''), 'id') * direction
  })
}

function normalizeThresholds(items) {
  if (!Array.isArray(items)) return {}
  return items.reduce((map, item) => {
    map[String(item.province || '').toLowerCase()] = {
      thresholdMin: Number(item.thresholdMin ?? item.minPrice ?? item.min_price) || 0,
      thresholdMax: Number(item.thresholdMax ?? item.maxPrice ?? item.max_price) || 0,
    }
    return map
  }, {})
}

function normalizeProvincePrices(budgetByProvince, thresholds) {
  if (!Array.isArray(budgetByProvince) || !budgetByProvince.length) return []

  return budgetByProvince.map((row) => {
    const threshold = thresholds[String(row.province || '').toLowerCase()] || {}
    return {
      province: row.province || '-',
      minHarga: Number(row.minHarga ?? row.min_price_per_portion) || 0,
      maxHarga: Number(row.maxHarga ?? row.max_price_per_portion) || 0,
      avgHarga: Number(row.avgHarga ?? row.avg_price_per_portion ?? row.avgReferencePrice) || 0,
      thresholdMin: Number(row.thresholdMin ?? row.minPrice ?? threshold.thresholdMin) || 0,
      thresholdMax: Number(row.thresholdMax ?? row.maxPrice ?? threshold.thresholdMax) || 0,
      source: row.source || null,
      generatedAt: row.generatedAt || row.generated_at || null,
    }
  })
}

function normalizeSpending(byProvince) {
  if (!Array.isArray(byProvince) || !byProvince.length) return []
  return byProvince.slice(0, 10).map((row) => ({
    province: row.province || '-',
    totalSpending: Number(row.total_budget ?? row.totalBudget ?? row.totalBudgetUsed ?? 0),
  }))
}

function normalizeAnomaly(item, thresholdSource = {}) {
  const distribution = item.distribution || {}
  const sppg = distribution.sppg || {}
  const school = distribution.school || {}
  const price = Number(distribution.pricePerPortion ?? distribution.price_per_portion ?? 0)
  const province = sppg.province || item.province || '-'
  const threshold = thresholdSource[province.toLowerCase()] || { thresholdMin: 0, thresholdMax: 0 }

  return {
    id: item.id,
    sppg: sppg.name || item.sppg_name || '-',
    school: school.name || item.school_name || '-',
    province,
    pricePerPortion: price,
    thresholdMin: threshold.thresholdMin,
    thresholdMax: threshold.thresholdMax,
    date: item.createdAt || item.created_at,
    isResolved: Boolean(item.isResolved ?? item.is_resolved),
  }
}

function buildThresholdMapFromProvincePrices(rows) {
  return rows.reduce((map, row) => {
    map[String(row.province || '').toLowerCase()] = {
      thresholdMin: Number(row.thresholdMin) || 0,
      thresholdMax: Number(row.thresholdMax) || 0,
    }
    return map
  }, {})
}

function getAnomalyFilteredRows(rows, anomalyFilter) {
  if (anomalyFilter === 'resolved') return rows.filter((row) => row.isResolved)
  if (anomalyFilter === 'unresolved') return rows.filter((row) => !row.isResolved)
  return rows
}

function SortIcon({ active, direction }) {
  if (!active) return null
  return direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />
}

function Anggaran({ userRole, userName, onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || storedUser?.role || 'pemerintah'
  const displayName = userName || storedUser?.name || storedUser?.email || 'Pengguna MBG'
  const [budgetSummary, setBudgetSummary] = useState(EMPTY_BUDGET_SUMMARY)
  const [provincePrices, setProvincePrices] = useState([])
  const [spendingData, setSpendingData] = useState([])
  const [anomalyRows, setAnomalyRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('avgHarga')
  const [sortDirection, setSortDirection] = useState('desc')
  const [anomalyFilter, setAnomalyFilter] = useState('unresolved')
  const [anomalyExpanded, setAnomalyExpanded] = useState(true)
  const [exportLoading, setExportLoading] = useState('')
  const [toast, setToast] = useState(null)

  const todayLabel = useMemo(() => formatTanggal(new Date()), [])
  const isAdmin = resolvedRole === 'admin'

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3400)
  }, [])

  const fetchBudgetData = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const [summaryResult, provinceResult, anomalyResult, legacyBudgetResult] = await Promise.allSettled([
          requestJson('/analytics/budget-summary', { signal }),
          requestJson('/analytics/price-per-province', { signal }),
          requestJson('/analytics/price-anomalies', { signal, params: { limit: 50 } }),
          requestJson('/analytics/budget', { signal }),
        ])

        const summaryData = summaryResult.status === 'fulfilled' ? summaryResult.value.data : {}
        const provinceApiRows = provinceResult.status === 'fulfilled' ? provinceResult.value.data : []
        const legacyBudget = legacyBudgetResult.status === 'fulfilled' ? legacyBudgetResult.value.data : {}
        const provinceRows = normalizeProvincePrices(
          Array.isArray(provinceApiRows) && provinceApiRows.length ? provinceApiRows : legacyBudget.byProvince,
          normalizeThresholds(provinceApiRows),
        )
        const thresholds = buildThresholdMapFromProvincePrices(provinceRows)
        const anomalyApiRows =
          anomalyResult.status === 'fulfilled' && Array.isArray(anomalyResult.value.data)
            ? anomalyResult.value.data
            : anomalyResult.status === 'fulfilled' && Array.isArray(anomalyResult.value.data?.items)
              ? anomalyResult.value.data.items
              : []
        const anomalies = anomalyApiRows.map((item) => normalizeAnomaly(item, thresholds))

        const totalBudget = Number(summaryData.total_budget_used ?? legacyBudget.summary?.total_budget) || 0
        const totalPortions = Number(summaryData.total_portions ?? legacyBudget.summary?.total_portions) || 0
        const avgPrice = Number(summaryData.avg_price_per_portion ?? legacyBudget.summary?.avg_price_per_portion) || (totalPortions ? totalBudget / totalPortions : 0)

        setBudgetSummary({
          totalBudgetUsed: totalBudget,
          avgPricePerPortion: avgPrice,
          anomalyCount: Number(summaryData.price_anomaly_count) || anomalies.filter((row) => !row.isResolved).length,
          rawMaterialAnomalyCount: Number(summaryData.raw_material_anomaly_count) || 0,
          avgRawMaterialCost: Number(summaryData.avg_raw_material_cost) || 0,
          savingVsTarget: Number(summaryData.savings_vs_target) || 0,
        })
        setProvincePrices(provinceRows)
        setSpendingData(normalizeSpending(provinceRows))
        setAnomalyRows(anomalies)

        if ([summaryResult, provinceResult, anomalyResult].some((result) => result.status === 'rejected')) {
          setError('Sebagian data anggaran gagal dimuat dari API.')
        }
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setBudgetSummary(EMPTY_BUDGET_SUMMARY)
          setProvincePrices([])
          setSpendingData([])
          setAnomalyRows([])
          setError('Data anggaran gagal dimuat dari API.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchBudgetData(controller.signal))

    return () => controller.abort()
  }, [fetchBudgetData])

  const sortedProvincePrices = useMemo(
    () => sortRows(provincePrices, sortKey, sortDirection),
    [provincePrices, sortDirection, sortKey],
  )
  const filteredAnomalyRows = useMemo(
    () => getAnomalyFilteredRows(anomalyRows, anomalyFilter),
    [anomalyFilter, anomalyRows],
  )

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const handleResolve = async (row) => {
    if (!isAdmin || row.isResolved) return

    try {
      if (!String(row.id).startsWith('anomaly-')) {
        await requestJson(`/anomaly-logs/${row.id}/resolve`, {
          method: 'PUT',
          body: {
            isResolved: true,
            reason: 'Ditandai selesai dari halaman Transparansi Anggaran',
          },
        })
      }
      setAnomalyRows((current) => current.map((item) => (item.id === row.id ? { ...item, isResolved: true } : item)))
      showToast('Anomali berhasil ditandai selesai oleh admin.', 'success')
    } catch (resolveError) {
      showToast(resolveError.message || 'Resolve anomali gagal.', 'danger')
    }
  }

  const handleExport = async (type) => {
    setExportLoading(type)
    showToast('Menggenerate laporan...', 'warning')

    try {
      await requestJson('/exports', {
        method: 'POST',
        body: {
          type,
          filterParams: {
            page: 'anggaran',
            anomalyStatus: anomalyFilter,
            sortKey,
            sortDirection,
          },
        },
      })
      showToast('Laporan sedang diproses. Silakan cek menu Export Data.', 'success')
    } catch (exportError) {
      showToast(exportError.message || 'Export gagal diproses.', 'danger')
    } finally {
      setExportLoading('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    window.localStorage.removeItem('mbg.accessToken')
    window.localStorage.removeItem('mbg.user')
    window.sessionStorage.removeItem('mbg.accessToken')
    window.sessionStorage.removeItem('mbg.user')
    navigate('/login')
  }

  const kpis = [
    { title: 'Total Anggaran Digunakan', value: formatRupiah(budgetSummary.totalBudgetUsed), color: '#0f4c81', icon: Wallet },
    { title: 'Avg Cost Per Portion', value: formatRupiah(budgetSummary.avgPricePerPortion), color: '#0071e4', icon: BarChart3 },
    { title: 'Avg Raw Material Cost', value: formatRupiah(budgetSummary.avgRawMaterialCost), color: '#057a55', icon: ShieldCheck },
    { title: 'Price Anomaly', value: new Intl.NumberFormat('id-ID').format(budgetSummary.anomalyCount), color: '#9b1c1c', icon: Zap },
    { title: 'Raw Material Anomaly', value: new Intl.NumberFormat('id-ID').format(budgetSummary.rawMaterialAnomalyCount), color: '#92400e', icon: AlertTriangle },
  ]

  return (
    <DashboardLayout
      userRole={isAdmin ? 'admin' : 'pemerintah'}
      userName={displayName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={anomalyRows.filter((row) => !row.isResolved).length}
    >
      <div className="anggaran-page">
        <header className="anggaran-header">
          <div>
            <p className="anggaran-subtitle">Pemerintah & Admin</p>
            <h1 className="anggaran-title">Transparansi Anggaran MBG</h1>
            <p>Data penggunaan anggaran program Makan Bergizi Gratis seluruh Indonesia</p>
          </div>
          <span className="anggaran-date-badge">Data diperbarui: {todayLabel}</span>
        </header>

        {toast ? <div className={`anggaran-toast anggaran-toast-${toast.type}`}>{toast.message}</div> : null}

        {loading ? (
          <div className="anggaran-loading">
            <Loader2 aria-hidden="true" />
            Memuat data anggaran...
          </div>
        ) : null}

        {error ? (
          <div className="anggaran-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="anggaran-section">
          <div className="anggaran-kpi-grid">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <article key={kpi.title} className="anggaran-card" style={{ '--kpi-color': kpi.color }}>
                  <span><Icon aria-hidden="true" /></span>
                  <div>
                    <p>{kpi.title}</p>
                    <strong>{kpi.value}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="anggaran-section anggaran-section-alt">
          <div className="anggaran-section-header">
            <div className="anggaran-info-wrap">
              <h2 className="anggaran-section-title">Harga Per Porsi per Provinsi</h2>
              <button className="anggaran-info-tooltip" type="button" aria-label="Rata-rata dari semua distribusi bulan ini">
                <Info aria-hidden="true" />
                <span>Rata-rata dari semua distribusi bulan ini</span>
              </button>
            </div>
          </div>

          <div className="anggaran-table-wrap">
            <table className="anggaran-table">
              <thead>
                <tr>
                  {[
                    ['province', 'Provinsi'],
                    ['minHarga', 'Min Harga'],
                    ['maxHarga', 'Max Harga'],
                    ['avgHarga', 'Avg Harga'],
                    ['thresholdMax', 'Threshold'],
                    ['status', 'Status'],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button className="anggaran-sort-btn" type="button" onClick={() => handleSort(key)}>
                        {label}
                        <SortIcon active={sortKey === key} direction={sortDirection} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProvincePrices.map((row) => {
                  const status = getPriceStatus(row)
                  return (
                    <tr key={row.province} className={status === 'over' ? 'anggaran-row-over' : status === 'under' ? 'anggaran-row-under' : ''}>
                      <td>{row.province}</td>
                      <td>{formatRupiah(row.minHarga)}</td>
                      <td>
                        {formatRupiah(row.maxHarga)}
                        {row.maxHarga > row.thresholdMax && status === 'normal' ? <small>Max melewati batas</small> : null}
                      </td>
                      <td>{formatRupiah(row.avgHarga)}</td>
                      <td>
                        {formatRupiah(row.thresholdMin)} - {formatRupiah(row.thresholdMax)}
                        {row.source ? <small>{row.source}{row.generatedAt ? ` - ${formatTanggal(row.generatedAt)}` : ''}</small> : null}
                      </td>
                      <td><span className={`anggaran-status-${status}`}>{getStatusLabel(status)}</span></td>
                    </tr>
                  )
                })}
                {!sortedProvincePrices.length ? (
                  <tr>
                    <td colSpan="6">Belum ada data harga provinsi dari backend.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="anggaran-section">
          <div className="anggaran-section-header">
            <h2 className="anggaran-section-title">Distribusi Total Pengeluaran per Provinsi</h2>
          </div>
          <article className="anggaran-chart-card">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendingData} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid stroke="#f4f8fb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `${Number(value) / 1000000000}M`} />
                <YAxis type="category" dataKey="province" width={128} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Bar dataKey="totalSpending" name="Total Pengeluaran" fill="#0f4c81" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {!spendingData.length ? <p>Belum ada data pengeluaran per provinsi dari backend.</p> : null}
          </article>
        </section>

        <section className="anggaran-section anggaran-section-alt">
          <div className="anggaran-anomaly-header">
            <h2 className="anggaran-section-title">{filteredAnomalyRows.length} Distribusi Terdeteksi Harga Anomali</h2>
            <button className="anggaran-collapse-btn" type="button" aria-expanded={anomalyExpanded} onClick={() => setAnomalyExpanded((current) => !current)}>
              {anomalyExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              {anomalyExpanded ? 'Tutup' : 'Buka'}
            </button>
          </div>

          {anomalyExpanded ? (
            <>
              <div className="anggaran-filter-row">
                {[
                  ['unresolved', 'Belum Resolve'],
                  ['resolved', 'Sudah Resolve'],
                  ['all', 'Semua'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`anggaran-filter-btn ${anomalyFilter === value ? 'anggaran-filter-btn-active' : ''}`}
                    type="button"
                    onClick={() => setAnomalyFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="anggaran-table-wrap">
                <table className="anggaran-table">
                  <thead>
                    <tr>
                      <th>SPPG</th>
                      <th>Sekolah</th>
                      <th>Provinsi</th>
                      <th>Harga/Porsi</th>
                      <th>Threshold</th>
                      <th>Selisih</th>
                      <th>Tanggal</th>
                      <th>Status Resolve</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalyRows.map((row) => {
                      const diff = row.pricePerPortion > row.thresholdMax
                        ? row.pricePerPortion - row.thresholdMax
                        : row.thresholdMin - row.pricePerPortion
                      return (
                        <tr key={row.id}>
                          <td>{row.sppg}</td>
                          <td>{row.school}</td>
                          <td>{row.province}</td>
                          <td>{row.pricePerPortion ? formatRupiah(row.pricePerPortion) : '-'}</td>
                          <td>{formatRupiah(row.thresholdMin)} - {formatRupiah(row.thresholdMax)}</td>
                          <td>{row.pricePerPortion ? formatRupiah(Math.max(0, diff)) : '-'}</td>
                          <td>{formatTanggal(row.date || new Date())}</td>
                          <td>
                            <span className={row.isResolved ? 'anggaran-status-normal' : 'anggaran-status-over'}>
                              {row.isResolved ? 'Sudah Resolve' : 'Belum Resolve'}
                            </span>
                          </td>
                          <td>
                            {isAdmin && !row.isResolved ? (
                              <button className="anggaran-resolve-btn" type="button" onClick={() => handleResolve(row)}>
                                <CheckCircle2 aria-hidden="true" />
                                Resolve
                              </button>
                            ) : (
                              <button className="anggaran-detail-btn" type="button" title={row.isResolved ? 'Ditandai selesai oleh admin' : 'Lihat detail'}>
                                <Eye aria-hidden="true" />
                                Detail
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {!filteredAnomalyRows.length ? (
                      <tr>
                        <td colSpan="9">Belum ada anomali harga untuk filter ini.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>

        <section className="anggaran-section">
          <div className="anggaran-export-row">
            <button className="anggaran-btn anggaran-btn-primary" type="button" disabled={Boolean(exportLoading)} onClick={() => handleExport('pdf')}>
              {exportLoading === 'pdf' ? <Loader2 aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Export PDF
            </button>
            <button className="anggaran-btn anggaran-btn-secondary" type="button" disabled={Boolean(exportLoading)} onClick={() => handleExport('excel')}>
              {exportLoading === 'excel' ? <Loader2 aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
              Export Excel
            </button>
            <Download aria-hidden="true" className="anggaran-export-icon" />
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Anggaran
