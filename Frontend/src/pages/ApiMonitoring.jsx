import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Clock3, Database, Loader2, Play, RefreshCcw, Server } from 'lucide-react'
import {
  getMonitoringApis,
  getMonitoringErrors,
  getMonitoringSummary,
  getMonitoringSyncSources,
  syncMonitoringSource,
  testMonitoringApi,
} from '../services/api'
import './ApiMonitoring.css'

const REFRESH_MS = 30000

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function formatUptime(seconds) {
  const value = Number(seconds) || 0
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  return days > 0 ? `${days}h ${hours}j` : `${hours}j ${minutes}m`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeItem(item) {
  return {
    id: item.id,
    name: item.name || item.id,
    status: item.status || 'unknown',
    latency: Number(item.latency || 0),
    uptime: Number(item.uptime || 0),
    lastSync: item.lastSync || item.last_sync || null,
    errorCount: Number(item.errorCount ?? item.error_count ?? 0),
    queueSize: Number(item.queueSize ?? item.queue_size ?? 0),
  }
}

function normalizeError(item) {
  return {
    id: item.id,
    source: item.source || '-',
    status: item.status || '-',
    severity: item.severity || 'LOW',
    message: item.message || '-',
    createdAt: item.createdAt || item.created_at || null,
  }
}

function ApiMonitoring({ userRole = 'admin' }) {
  const [summary, setSummary] = useState(null)
  const [apis, setApis] = useState([])
  const [syncSources, setSyncSources] = useState([])
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchMonitoring = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const [summaryResult, apiResult, errorResult, syncResult] = await Promise.all([
        getMonitoringSummary({ signal }),
        getMonitoringApis({ signal }),
        getMonitoringErrors({ signal }),
        getMonitoringSyncSources({ signal }),
      ])

      setSummary(summaryResult.data || null)
      setApis((apiResult.data || []).map(normalizeItem))
      setErrors((errorResult.data || []).map(normalizeError))
      setSyncSources((syncResult.data || []).map(normalizeItem))
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setSummary(null)
        setApis([])
        setErrors([])
        setSyncSources([])
        setError(fetchError.message || 'Monitoring belum berhasil dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchMonitoring(controller.signal))
    const interval = window.setInterval(() => fetchMonitoring(controller.signal), REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [fetchMonitoring])

  const healthTone = useMemo(() => {
    if (error) return 'danger'
    if (!summary) return 'warning'
    if (summary.status === 'warning' || Number(summary.error_count || 0) > 0) return 'warning'
    return 'success'
  }, [error, summary])

  const handleRefresh = () => {
    const controller = new AbortController()
    fetchMonitoring(controller.signal)
  }

  const handleTestApi = async (item) => {
    setActionLoading(`api:${item.id}`)
    try {
      const result = await testMonitoringApi(item.id)
      const updated = normalizeItem(result.data || result)
      setApis((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      showToast(`${item.name} berhasil dites.`, 'success')
    } catch (testError) {
      showToast(testError.message || `${item.name} gagal dites.`, 'danger')
    } finally {
      setActionLoading('')
    }
  }

  const handleSync = async (item) => {
    setActionLoading(`sync:${item.id}`)
    try {
      const result = await syncMonitoringSource(item.id)
      showToast(result.data?.message || `${item.name} sync sedang diproses.`, result.data?.status === 'disabled' ? 'warning' : 'success')
      const syncResult = await getMonitoringSyncSources()
      setSyncSources((syncResult.data || []).map(normalizeItem))
    } catch (syncError) {
      showToast(syncError.message || `${item.name} gagal sync.`, 'danger')
    } finally {
      setActionLoading('')
    }
  }

  const totals = summary?.totals || {}

  return (
    <main className="monitor-page">
      {toast ? <div className={`monitor-toast monitor-toast-${toast.type}`}>{toast.message}</div> : null}

      <header className="monitor-header">
        <div>
          <p className="monitor-subtitle">API Monitoring</p>
          <h1 className="monitor-title">Monitoring Sistem MBG</h1>
          <p className="monitor-desc">Health check, queue export, sinkronisasi data, dan error operasional untuk role {userRole}.</p>
        </div>
        <button className="monitor-btn" type="button" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="monitor-spin-icon" aria-hidden="true" /> : <RefreshCcw aria-hidden="true" />}
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
          Memuat monitoring sistem...
        </div>
      ) : null}

      <section className={`monitor-health monitor-health-${healthTone}`}>
        <Server aria-hidden="true" />
        <div>
          <span>Status Service</span>
          <strong>{summary?.status || 'unknown'}</strong>
          <small>{summary?.service || 'Layanan belum merespons'}</small>
        </div>
        <div>
          <span>Last Update</span>
          <strong>{formatDate(summary?.timestamp)}</strong>
          <small>Uptime {formatUptime(summary?.uptime)}</small>
        </div>
      </section>

      <section className="monitor-grid">
        <Metric icon={Activity} label="API Monitored" value={formatNumber(totals.apiTotal)} />
        <Metric icon={Database} label="Sync Sources" value={formatNumber(totals.syncSourceTotal)} />
        <Metric icon={AlertTriangle} label="Warning/Error" value={formatNumber(totals.errorCount)} tone={totals.errorCount ? 'danger' : 'primary'} />
        <Metric icon={Clock3} label="Queue Size" value={formatNumber(totals.queueSize)} tone={totals.queueSize ? 'warning' : 'primary'} />
      </section>

      <section className="monitor-section">
        <div className="monitor-section-header">
          <h2>API & Jobs</h2>
          <span>{apis.length} item</span>
        </div>
        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Uptime</th>
                <th>Queue</th>
                <th>Error</th>
                <th>Last Sync</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loading && apis.length === 0 ? (
                <tr>
                  <td colSpan="8">Belum ada data monitoring API.</td>
                </tr>
              ) : null}
              {apis.map((item) => (
                <MonitorRow
                  key={item.id}
                  item={item}
                  actionLabel="Test"
                  actionLoading={actionLoading === `api:${item.id}`}
                  onAction={() => handleTestApi(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-header">
          <h2>Sync Sources</h2>
          <span>{syncSources.length} sumber</span>
        </div>
        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Uptime</th>
                <th>Queue</th>
                <th>Error</th>
                <th>Last Sync</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loading && syncSources.length === 0 ? (
                <tr>
                  <td colSpan="8">Belum ada data sumber sinkronisasi.</td>
                </tr>
              ) : null}
              {syncSources.map((item) => (
                <MonitorRow
                  key={item.id}
                  item={item}
                  actionLabel="Sync"
                  actionLoading={actionLoading === `sync:${item.id}`}
                  onAction={() => handleSync(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-header">
          <h2>Recent Errors</h2>
          <span>{errors.length} item</span>
        </div>
        <div className="monitor-error-list">
          {!loading && errors.length === 0 ? <div className="monitor-empty">Tidak ada error operasional.</div> : null}
          {errors.slice(0, 12).map((item) => (
            <article key={item.id} className={`monitor-error-item monitor-error-${item.severity.toLowerCase()}`}>
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>{item.source}</strong>
                <span>{item.message}</span>
                <small>{item.status} | {formatDate(item.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function MonitorRow({ item, actionLabel, actionLoading, onAction }) {
  return (
    <tr>
      <td>
        <strong>{item.name}</strong>
        <span>{item.id}</span>
      </td>
      <td>
        <span className={`monitor-status monitor-status-${item.status}`}>{item.status}</span>
      </td>
      <td>{formatNumber(item.latency)} ms</td>
      <td>{formatUptime(item.uptime)}</td>
      <td>{formatNumber(item.queueSize)}</td>
      <td>{formatNumber(item.errorCount)}</td>
      <td>{formatDate(item.lastSync)}</td>
      <td>
        <button className="monitor-row-btn" type="button" disabled={actionLoading} onClick={onAction}>
          {actionLoading ? <Loader2 className="monitor-spin-icon" aria-hidden="true" /> : <Play aria-hidden="true" />}
          {actionLabel}
        </button>
      </td>
    </tr>
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
