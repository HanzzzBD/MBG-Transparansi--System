import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Utensils,
  WalletCards,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PublicNavbar from '../components/PublicNavbar.jsx'
import usePublicMapPath from '../hooks/usePublicMapPath.js'
import { apiRequest } from '../services/api.js'
import batiksamar from '../assets/Batiksamar.png'

async function requestJson(path, options = {}) {
  const payload = await apiRequest(path, options)
  return payload.data ?? payload
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value))}`
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value))}%`
}

function buildParams(filters) {
  return {
    province: filters.province || undefined,
    city: filters.city || undefined,
    start_date: filters.startDate || undefined,
    end_date: filters.endDate || undefined,
    granularity: filters.granularity,
    limit: 12,
  }
}

function EmptyState({ children }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-[#b5e0ea] bg-[#f4f8fb] px-4 text-center text-sm font-bold text-[#6b7280]">
      {children}
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="grid min-h-44 place-items-center rounded-lg border border-[#b5e0ea] bg-white text-sm font-extrabold text-[#0f4c81]">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="landing-spin" size={18} aria-hidden="true" />
        Memuat data publik...
      </span>
    </div>
  )
}

function StatCard({ title, value, helper, icon: Icon, tone = '#0071e4' }) {
  return (
    <article className="rounded-lg border border-[#b5e0ea] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-[#6b7280]">{title}</p>
          <p className="mt-3 text-3xl font-black leading-none" style={{ color: tone }}>
            {value}
          </p>
          {helper ? <p className="mt-3 text-xs font-bold text-[#6b7280]">{helper}</p> : null}
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f4f8fb]" style={{ color: tone }}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}

function PublicStatistik() {
  const fullMapPath = usePublicMapPath()
  const [filters, setFilters] = useState({
    province: '',
    city: '',
    startDate: '',
    endDate: '',
    granularity: 'daily',
  })
  const [dataState, setDataState] = useState({
    statistics: null,
    budget: null,
    loading: true,
    error: '',
  })

  const filterOptions = useMemo(() => {
    const source = dataState.statistics?.filters || dataState.budget?.filters || {}
    return {
      provinces: Array.isArray(source.provinces) ? source.provinces : [],
      cities: Array.isArray(source.cities) ? source.cities : [],
    }
  }, [dataState.budget, dataState.statistics])

  const cityOptions = useMemo(() => {
    if (!filters.province) return filterOptions.cities
    return filterOptions.cities.filter((item) => item.province === filters.province)
  }, [filterOptions.cities, filters.province])

  const fetchPublicData = useCallback(
    async (signal) => {
      setDataState((current) => ({ ...current, loading: true, error: '' }))
      try {
        const params = buildParams(filters)
        const [statistics, budget] = await Promise.all([
          requestJson('/public/statistics', { params, signal }),
          requestJson('/public/budget', { params, signal }),
        ])
        setDataState({ statistics, budget, loading: false, error: '' })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setDataState({ statistics: null, budget: null, loading: false, error: error.message || 'Gagal memuat data publik.' })
        }
      }
    },
    [filters],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchPublicData(controller.signal))
    return () => controller.abort()
  }, [fetchPublicData])

  const kpis = dataState.statistics?.kpis || {}
  const budgetKpis = dataState.budget?.kpis || {}
  const distributionTrend = dataState.statistics?.charts?.distributionTrend || []
  const regions = dataState.statistics?.charts?.distributionsByProvince || []
  const budgetByProvince = dataState.budget?.charts?.budgetByProvince || []
  const priceByProvince = dataState.budget?.charts?.priceByProvince || []
  const isEmpty = dataState.statistics?.meta?.isEmpty && dataState.budget?.meta?.isEmpty

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'province' ? { city: '' } : {}),
    }))
  }

  const resetFilters = () => {
    setFilters({ province: '', city: '', startDate: '', endDate: '', granularity: 'daily' })
  }

  return (
    <div className="min-h-screen bg-[#f4f8fb] text-[#111928]">
      <PublicNavbar />

      <main>
        <section className="bg-white bg-cover bg-center" style={{ backgroundImage: `url(${batiksamar})` }}>
          <div className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-8 py-12 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Statistik Publik</p>
              <h1 className="mt-2 text-4xl font-black leading-tight text-[#0f4c81] sm:text-5xl">
                Data agregat distribusi dan anggaran MBG
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#6b7280]">
                Pantau ringkasan distribusi, tren wilayah, dan anggaran publik berdasarkan data terbaru yang tersedia.
              </p>
            </div>
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0f4c81] px-5 text-sm font-extrabold text-white"
              to={fullMapPath}
            >
              Lihat Peta Publik
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="border-y border-[#b5e0ea] bg-[#f4f8fb]">
          <div className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-3 py-5 md:grid-cols-5">
            <select className="h-11 rounded-lg border border-[#b5e0ea] bg-white px-3 text-sm font-bold" name="province" value={filters.province} onChange={handleFilterChange}>
              <option value="">Semua provinsi</option>
              {filterOptions.provinces.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#b5e0ea] bg-white px-3 text-sm font-bold" name="city" value={filters.city} onChange={handleFilterChange}>
              <option value="">Semua kota</option>
              {cityOptions.map((item) => <option key={`${item.province}-${item.city}`} value={item.city}>{item.city}</option>)}
            </select>
            <input className="h-11 rounded-lg border border-[#b5e0ea] bg-white px-3 text-sm font-bold" name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
            <input className="h-11 rounded-lg border border-[#b5e0ea] bg-white px-3 text-sm font-bold" name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
            <div className="flex gap-2">
              <select className="h-11 min-w-0 flex-1 rounded-lg border border-[#b5e0ea] bg-white px-3 text-sm font-bold" name="granularity" value={filters.granularity} onChange={handleFilterChange}>
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
              </select>
              <button className="grid h-11 w-11 place-items-center rounded-lg border border-[#b5e0ea] bg-white text-[#0f4c81]" type="button" aria-label="Reset filter" onClick={resetFilters}>
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-10">
          {dataState.error ? (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-[#b5e0ea] bg-white px-4 py-3 text-sm font-semibold text-[#92400e] sm:flex-row sm:items-center sm:justify-between">
              <span>{dataState.error}</span>
              <button className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0f4c81] px-4 text-xs font-extrabold text-white" type="button" onClick={() => fetchPublicData()}>
                Coba lagi
              </button>
            </div>
          ) : null}

          {dataState.loading ? (
            <LoadingPanel />
          ) : (
            <>
              {isEmpty ? (
                <div className="mb-6 rounded-lg border border-[#b5e0ea] bg-white px-4 py-3 text-sm font-bold text-[#6b7280]">
                  Data publik untuk filter ini belum tersedia.
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="SPPG Aktif" value={formatNumber(kpis.totalActiveSppg)} helper="Agregat nasional" icon={Utensils} />
                <StatCard title="Distribusi Hari Ini" value={formatNumber(kpis.distributionsToday)} helper="Dari data distribusi" icon={PackageCheck} tone="#057a55" />
                <StatCard title="Success Rate" value={formatPercent(kpis.successRate)} helper="Validasi sekolah" icon={CheckCircle2} tone="#057a55" />
                <StatCard title="SPPG Bermasalah" value={formatNumber(kpis.problematicSppg)} helper="Status problem" icon={AlertTriangle} tone="#9b1c1c" />
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-lg border border-[#b5e0ea] bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-black text-[#0f4c81]">Tren Distribusi</h2>
                  <div className="mt-5 h-80 min-w-0" style={{ minWidth: 0 }}>
                    {distributionTrend.length ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={distributionTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value) => formatNumber(value)} />
                          <Area dataKey="totalDistributions" name="Distribusi" stroke="#0071e4" fill="#b5e0ea" />
                          <Area dataKey="totalPortions" name="Porsi" stroke="#057a55" fill="#d9f6e9" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState>Belum ada tren distribusi untuk filter ini.</EmptyState>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-[#b5e0ea] bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-black text-[#0f4c81]">Distribusi per Wilayah</h2>
                  <div className="mt-5 grid gap-3">
                    {regions.length ? regions.slice(0, 8).map((row) => (
                      <div key={row.province} className="rounded-lg border border-[#e5eef2] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{row.province}</strong>
                          <span className="text-sm font-black text-[#0071e4]">{formatNumber(row.totalPortions)} porsi</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#6b7280]">Success rate {formatPercent(row.successRate)}</p>
                      </div>
                    )) : <EmptyState>Belum ada agregasi wilayah untuk filter ini.</EmptyState>}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>

        <section className="bg-white py-10" id="anggaran-publik">
          <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#0071e4]">Transparansi Anggaran</p>
                <h2 className="mt-2 text-3xl font-black text-[#0f4c81]">Agregat biaya distribusi publik</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#f4f8fb] px-3 py-2 text-sm font-bold text-[#6b7280]">
                <WalletCards size={17} aria-hidden="true" />
                Tanpa data internal user atau audit log
              </span>
            </div>

            {dataState.loading ? (
              <LoadingPanel />
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard title="Total Anggaran Agregat" value={formatCurrency(budgetKpis.totalBudget)} helper="Akumulasi distribusi" icon={WalletCards} />
                  <StatCard title="Total Porsi" value={formatNumber(budgetKpis.totalPortions)} helper="Dari distribusi tercatat" icon={PackageCheck} tone="#057a55" />
                  <StatCard title="Harga Rata-rata/Porsi" value={formatCurrency(budgetKpis.avgPricePerPortion)} helper="Agregat aman" icon={BarChart3} tone="#0f4c81" />
                  <StatCard title="Total Distribusi" value={formatNumber(budgetKpis.totalDistributions)} helper="Jumlah pengiriman" icon={MapPinned} tone="#92400e" />
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <section className="rounded-lg border border-[#b5e0ea] bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black text-[#0f4c81]">Anggaran per Provinsi</h3>
                    <div className="mt-5 h-80 min-w-0" style={{ minWidth: 0 }}>
                      {budgetByProvince.length ? (
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={budgetByProvince.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="province" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Bar dataKey="totalBudget" name="Total anggaran" fill="#0071e4" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState>Belum ada agregat anggaran untuk filter ini.</EmptyState>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[#b5e0ea] bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black text-[#0f4c81]">Harga per Porsi per Wilayah</h3>
                    <div className="mt-5 grid gap-3">
                      {priceByProvince.length ? priceByProvince.slice(0, 8).map((row) => (
                        <div key={row.province} className="rounded-lg border border-[#e5eef2] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <strong>{row.province}</strong>
                            <span className="text-sm font-black text-[#057a55]">{formatCurrency(row.avgPricePerPortion)}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                            Min {formatCurrency(row.minPricePerPortion)} - Max {formatCurrency(row.maxPricePerPortion)}
                          </p>
                        </div>
                      )) : <EmptyState>Belum ada harga per porsi untuk filter ini.</EmptyState>}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default PublicStatistik
