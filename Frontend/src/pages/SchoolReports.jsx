import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw, Send } from 'lucide-react'
import { createSchoolReport, getSchoolReports } from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './SppgOperational.css'

const REPORT_CATEGORIES = [
  { value: 'kualitas_makanan', label: 'Kualitas Makanan' },
  { value: 'keterlambatan', label: 'Keterlambatan' },
  { value: 'kekurangan_porsi', label: 'Kekurangan Porsi' },
  { value: 'lainnya', label: 'Lainnya' },
]

const initialForm = {
  category: 'kualitas_makanan',
  message: '',
}

function formatDateTime(value) {
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

function normalizeReport(item) {
  return {
    id: item.id,
    category: item.category,
    message: item.message || '-',
    createdAt: item.createdAt || item.created_at,
  }
}

function SchoolReports() {
  const can = useAuthStore((state) => state.can)
  const [reports, setReports] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canReportIssue = can('distribution.report_issue')

  const fetchReports = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const { data } = await getSchoolReports({ limit: 20 }, { signal })
      setReports(Array.isArray(data) ? data.map(normalizeReport) : [])
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setReports([])
        setError(fetchError.message || 'Laporan sekolah gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchReports(controller.signal))
    return () => controller.abort()
  }, [fetchReports])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canReportIssue) {
      setError('Anda tidak memiliki akses untuk membuat laporan masalah.')
      return
    }
    if (form.message.trim().length < 20) {
      setError('Pesan laporan minimal 20 karakter.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const { data } = await createSchoolReport({
        category: form.category,
        message: form.message.trim(),
      })
      setReports((current) => [normalizeReport(data), ...current])
      setForm(initialForm)
      setMessage('Laporan sekolah berhasil dikirim.')
    } catch (submitError) {
      setError(submitError.message || 'Laporan sekolah gagal dikirim.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Sekolah</p>
          <h1 className="sppg-op-title">Laporan Sekolah</h1>
          <p className="sppg-op-desc">Laporkan kendala yang terjadi di sekolah agar dapat ditindaklanjuti oleh pihak terkait.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchReports(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <div className="sppg-op-grid">
        {canReportIssue ? (
        <section className="sppg-op-card">
          <h2>Form Laporan</h2>
          <form className="sppg-op-form" onSubmit={handleSubmit}>
            <label className="sppg-op-field">
              <span>Kategori</span>
              <select className="sppg-op-select" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {REPORT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="sppg-op-field">
              <span>Pesan</span>
              <textarea
                className="sppg-op-textarea"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                maxLength={4000}
                required
              />
            </label>
            <button className="sppg-op-btn" type="submit" disabled={submitting || form.message.trim().length < 20}>
              {submitting ? <Loader2 aria-hidden="true" /> : <Send aria-hidden="true" />}
              Kirim Laporan
            </button>
          </form>
        </section>
        ) : (
          <section className="sppg-op-card">
            <h2>Form Laporan</h2>
            <div className="sppg-op-state">Anda tidak memiliki akses untuk membuat laporan masalah.</div>
          </section>
        )}

        <section className="sppg-op-card">
          <h2>Riwayat Laporan</h2>
          {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat laporan...</div> : null}
          {!loading && reports.length === 0 ? <div className="sppg-op-empty">Belum ada laporan sekolah.</div> : null}
          <div className="sppg-op-list">
            {reports.map((report) => (
              <article className="sppg-op-item" key={report.id}>
                <strong>{report.category}</strong>
                <span>{formatDateTime(report.createdAt)}</span>
                <small>{report.message}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SchoolReports
