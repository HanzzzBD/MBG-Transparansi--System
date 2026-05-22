import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert, Zap } from 'lucide-react'
import { getAnomalies, resolveAnomaly } from '../services/api'
import './AnomalyDetection.css'

const FALLBACK_ANOMALIES = [
  {
    id: 'fallback-1',
    anomalyType: 'PRICE_ANOMALY',
    description: 'Harga porsi Rp 18.500 berada di luar threshold wilayah Papua.',
    isResolved: false,
    createdAt: new Date().toISOString(),
    distribution: {
      sppg: { name: 'SPPG Jayapura Abepura', province: 'Papua' },
      school: { name: 'SDN Abepura 01' },
    },
  },
  {
    id: 'fallback-2',
    anomalyType: 'RAW_MATERIAL_PRICE_ANOMALY',
    description: 'Harga bahan baku ayam 30% di atas referensi SP2KP.',
    isResolved: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    productionBatch: {
      sppg: { name: 'SPPG Bandung Selatan', province: 'Jawa Barat' },
    },
  },
]

const TYPE_LABELS = {
  OVER_CAPACITY: 'Melebihi Kapasitas',
  PRICE_ANOMALY: 'Anomali Harga Porsi',
  RAW_MATERIAL_PRICE_ANOMALY: 'Anomali Harga Bahan Baku',
  VALIDATION_CONFLICT: 'Konflik Validasi',
  PENDING_TIMEOUT: 'Pending Timeout',
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

function normalizeAnomaly(item) {
  return {
    ...item,
    anomalyType: item.anomalyType || item.anomaly_type,
    createdAt: item.createdAt || item.created_at,
    isResolved: Boolean(item.isResolved ?? item.is_resolved),
  }
}

function getSppgName(row) {
  return row.distribution?.sppg?.name || row.productionBatch?.sppg?.name || '-'
}

function getProvince(row) {
  return row.distribution?.sppg?.province || row.productionBatch?.sppg?.province || '-'
}

function AnomalyDetection({ userRole = 'pemerintah' }) {
  const [rows, setRows] = useState([])
  const [statusFilter, setStatusFilter] = useState('unresolved')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvingId, setResolvingId] = useState('')
  const [toast, setToast] = useState(null)

  const isAdmin = userRole === 'admin'

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchAnomalies = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await getAnomalies({
        status: statusFilter,
        limit: 50,
      })
      const normalized = Array.isArray(payload.data) ? payload.data.map(normalizeAnomaly) : []

      if (!normalized.length) {
        setRows(FALLBACK_ANOMALIES)
        setError('Data anomali API kosong. Fallback preview ditampilkan sementara.')
        return
      }

      setRows(normalized)
    } catch (fetchError) {
      setRows(FALLBACK_ANOMALIES)
      setError(fetchError.message || 'Anomaly log gagal dimuat dari backend.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    Promise.resolve().then(fetchAnomalies)
  }, [fetchAnomalies])

  const summary = useMemo(() => {
    return rows.reduce(
      (result, row) => {
        if (row.isResolved) result.resolved += 1
        else result.unresolved += 1
        if (row.anomalyType === 'PRICE_ANOMALY') result.price += 1
        if (row.anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY') result.rawMaterial += 1
        return result
      },
      { unresolved: 0, resolved: 0, price: 0, rawMaterial: 0 },
    )
  }, [rows])

  const handleResolve = async (row) => {
    if (!isAdmin || String(row.id).startsWith('fallback')) return

    setResolvingId(row.id)
    try {
      await resolveAnomaly(row.id)
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, isResolved: true } : item)))
      showToast('success', 'Anomali berhasil ditandai resolved.')
    } catch (resolveError) {
      showToast('danger', resolveError.message || 'Gagal resolve anomali.')
    } finally {
      setResolvingId('')
    }
  }

  return (
    <main className="anomaly-page">
      <header className="anomaly-header">
        <div>
          <p className="anomaly-subtitle">Anomaly Detection</p>
          <h1 className="anomaly-title">Monitoring Anomali MBG</h1>
          <p className="anomaly-desc">
            Pantau PRICE_ANOMALY, RAW_MATERIAL_PRICE_ANOMALY, dan konflik validasi dari data backend.
          </p>
        </div>
        <button className="anomaly-btn anomaly-btn-secondary" type="button" onClick={fetchAnomalies}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {toast ? <div className={`anomaly-toast anomaly-toast-${toast.type}`}>{toast.message}</div> : null}

      {error ? (
        <div className="anomaly-error">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="anomaly-summary-grid">
        <SummaryCard icon={Zap} label="Belum Resolved" value={summary.unresolved} tone="danger" />
        <SummaryCard icon={CheckCircle2} label="Resolved" value={summary.resolved} tone="success" />
        <SummaryCard icon={AlertTriangle} label="Harga Porsi" value={summary.price} tone="warning" />
        <SummaryCard icon={ShieldAlert} label="Bahan Baku" value={summary.rawMaterial} tone="navy" />
      </section>

      <section className="anomaly-card">
        <div className="anomaly-filter-row">
          <label className="anomaly-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="unresolved">Belum Resolved</option>
              <option value="resolved">Sudah Resolved</option>
              <option value="">Semua</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="anomaly-loading">
            <Loader2 aria-hidden="true" />
            Memuat anomaly logs...
          </div>
        ) : null}

        <div className="anomaly-table-wrap">
          <table className="anomaly-table">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>SPPG</th>
                <th>Provinsi</th>
                <th>Deskripsi</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={`anomaly-type anomaly-type-${row.anomalyType}`}>{TYPE_LABELS[row.anomalyType] || row.anomalyType}</span>
                  </td>
                  <td>{getSppgName(row)}</td>
                  <td>{getProvince(row)}</td>
                  <td>{row.description}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <span className={`anomaly-status ${row.isResolved ? 'anomaly-status-resolved' : 'anomaly-status-open'}`}>
                      {row.isResolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                  <td>
                    {isAdmin && !row.isResolved && !String(row.id).startsWith('fallback') ? (
                      <button
                        className="anomaly-btn anomaly-btn-primary"
                        type="button"
                        disabled={resolvingId === row.id}
                        onClick={() => handleResolve(row)}
                      >
                        {resolvingId === row.id ? <Loader2 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                        Resolve
                      </button>
                    ) : (
                      <span className="anomaly-muted">View</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`anomaly-summary anomaly-summary-${tone}`}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value.toLocaleString('id-ID')}</strong>
    </article>
  )
}

export default AnomalyDetection
