import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { getDistributions, getValidations } from '../services/api.js'
import './SppgOperational.css'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function normalizeDistribution(item) {
  return {
    id: item.id,
    sppgName: item.sppg?.name || '-',
    distributionDate: item.distributionDate || item.distribution_date,
    portions: Number(item.portions || 0),
    status: item.status,
  }
}

function normalizeValidation(item) {
  return {
    id: item.id,
    sppgName: item.distribution?.sppg?.name || item.school?.sppg?.name || '-',
    distributionDate: item.distribution?.distributionDate || item.distribution?.distribution_date || item.createdAt,
    receivedPortions: Number(item.receivedPortions ?? item.received_portions ?? 0),
    status: item.status,
    notes: item.notes || '-',
  }
}

function SchoolHistory() {
  const [distributions, setDistributions] = useState([])
  const [validations, setValidations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHistory = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const [distributionResult, validationResult] = await Promise.allSettled([
        getDistributions({ limit: 20 }, { signal }),
        getValidations({ limit: 20 }, { signal }),
      ])

      if (distributionResult.status === 'fulfilled') {
        setDistributions(Array.isArray(distributionResult.value.data) ? distributionResult.value.data.map(normalizeDistribution) : [])
      } else {
        setDistributions([])
      }

      if (validationResult.status === 'fulfilled') {
        setValidations(Array.isArray(validationResult.value.data) ? validationResult.value.data.map(normalizeValidation) : [])
      } else {
        setValidations([])
      }

      const failed = [distributionResult, validationResult].find((result) => result.status === 'rejected')
      if (failed) setError(failed.reason?.message || 'Sebagian riwayat sekolah gagal dimuat.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchHistory(controller.signal))
    return () => controller.abort()
  }, [fetchHistory])

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Sekolah</p>
          <h1 className="sppg-op-title">Riwayat Sekolah</h1>
          <p className="sppg-op-desc">Riwayat distribusi dan validasi diambil dari endpoint backend yang sudah di-scope ke sekolah login.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchHistory(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat riwayat...</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <div className="sppg-op-grid">
        <section className="sppg-op-card">
          <h2>Distribusi</h2>
          {!loading && distributions.length === 0 ? <div className="sppg-op-empty">Belum ada distribusi sekolah dari backend.</div> : null}
          <div className="sppg-op-list">
            {distributions.map((distribution) => (
              <article className="sppg-op-item" key={distribution.id}>
                <strong>{distribution.sppgName}</strong>
                <span>{formatDate(distribution.distributionDate)} | {distribution.portions.toLocaleString('id-ID')} porsi</span>
                <small>{distribution.status}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="sppg-op-card">
          <h2>Validasi</h2>
          {!loading && validations.length === 0 ? <div className="sppg-op-empty">Belum ada validasi sekolah dari backend.</div> : null}
          <div className="sppg-op-list">
            {validations.map((validation) => (
              <article className="sppg-op-item" key={validation.id}>
                <strong>{validation.sppgName}</strong>
                <span>{formatDate(validation.distributionDate)} | diterima {validation.receivedPortions.toLocaleString('id-ID')} porsi</span>
                <small>{validation.status} | {validation.notes}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SchoolHistory
