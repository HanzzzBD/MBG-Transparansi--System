import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Clock3, Database, Loader2, RefreshCcw, Server, Users } from 'lucide-react'
import { getMonitoringSummary } from '../services/api'
import './ApiMonitoring.css'

const FALLBACK_SUMMARY = {
  service: 'MBG Transparency System Backend',
  status: 'fallback',
  timestamp: new Date().toISOString(),
  uptime: 0,
  totals: {
    usersTotal: 4,
    usersActive: 4,
    sppgTotal: 0,
    schoolsTotal: 0,
    distributionsTotal: 0,
    pendingExports: 0,
    failedExports: 0,
    unresolvedAnomalies: 0,
  },
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function formatUptime(seconds) {
  const value = Number(seconds) || 0
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  return `${hours}j ${minutes}m`
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ApiMonitoring({ userRole = 'admin' }) {
  const [summary, setSummary] = useState(FALLBACK_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const totals = summary.totals || FALLBACK_SUMMARY.totals

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await getMonitoringSummary()
      setSummary(payload.data || FALLBACK_SUMMARY)
    } catch (fetchError) {
      setSummary(FALLBACK_SUMMARY)
      setError(fetchError.message || 'Monitoring summary gagal dimuat dari backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(fetchSummary)
  }, [fetchSummary])

  const healthTone = useMemo(() => {
    if (error) return 'danger'
    if (totals.failedExports || totals.unresolvedAnomalies) return 'warning'
    return 'success'
  }, [error, totals.failedExports, totals.unresolvedAnomalies])

  return (
    <main className="monitor-page">
      <header className="monitor-header">
        <div>
          <p className="monitor-subtitle">API Monitoring</p>
          <h1 className="monitor-title">Monitoring Backend MBG</h1>
          <p className="monitor-desc">Health check, queue export, data totals, dan indikator anomali untuk role {userRole}.</p>
        </div>
        <button className="monitor-btn" type="button" onClick={fetchSummary}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {error ? (
        <div className="monitor-error">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="monitor-loading">
          <Loader2 aria-hidden="true" />
          Memuat monitoring summary...
        </div>
      ) : null}

      <section className={`monitor-health monitor-health-${healthTone}`}>
        <Server aria-hidden="true" />
        <div>
          <span>Status Service</span>
          <strong>{summary.status || 'ok'}</strong>
          <small>{summary.service}</small>
        </div>
        <div>
          <span>Last Update</span>
          <strong>{formatDate(summary.timestamp)}</strong>
          <small>Uptime {formatUptime(summary.uptime)}</small>
        </div>
      </section>

      <section className="monitor-grid">
        <Metric icon={Users} label="Total Users" value={formatNumber(totals.usersTotal)} />
        <Metric icon={Activity} label="Users Aktif" value={formatNumber(totals.usersActive)} />
        <Metric icon={Database} label="Total SPPG" value={formatNumber(totals.sppgTotal)} />
        <Metric icon={Database} label="Total Sekolah" value={formatNumber(totals.schoolsTotal)} />
        <Metric icon={Clock3} label="Distribusi" value={formatNumber(totals.distributionsTotal)} />
        <Metric icon={Clock3} label="Export Pending" value={formatNumber(totals.pendingExports)} />
        <Metric icon={AlertTriangle} label="Export Gagal" value={formatNumber(totals.failedExports)} tone="danger" />
        <Metric icon={AlertTriangle} label="Anomali Aktif" value={formatNumber(totals.unresolvedAnomalies)} tone="warning" />
      </section>
    </main>
  )
}

function Metric({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <article className={`monitor-card monitor-card-${tone}`}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export default ApiMonitoring
