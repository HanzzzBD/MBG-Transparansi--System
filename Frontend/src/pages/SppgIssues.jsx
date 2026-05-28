import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw, Send } from 'lucide-react'
import { createIssue, getIssues, getSchoolReports } from '../services/api.js'
import './SppgOperational.css'

const ISSUE_CATEGORIES = [
  { value: 'logistik', label: 'Logistik' },
  { value: 'keterlambatan', label: 'Keterlambatan' },
  { value: 'kekurangan_bahan', label: 'Kekurangan Bahan' },
  { value: 'peralatan', label: 'Peralatan' },
  { value: 'lainnya', label: 'Lainnya' },
]
const CRITICAL_ISSUE_CATEGORIES = new Set(['logistik', 'kekurangan_bahan', 'peralatan'])

const initialForm = {
  category: 'logistik',
  description: '',
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

function normalizeIssue(item) {
  return {
    id: item.id,
    category: item.category,
    status: item.status,
    description: item.description || '-',
    createdAt: item.createdAt || item.created_at,
  }
}

function normalizeSchoolReport(item) {
  const distribution = item.distribution || {}
  const validation = distribution.validation || {}
  return {
    id: item.id,
    category: item.category,
    status: validation.status || 'issue_reported',
    description: item.message || '-',
    schoolName: item.school?.name || distribution.school?.name || '-',
    distributionId: item.distributionId || item.distribution_id || distribution.id,
    createdAt: item.createdAt || item.created_at,
  }
}

function SppgIssues() {
  const [issues, setIssues] = useState([])
  const [schoolReports, setSchoolReports] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const fetchIssues = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const [issueResult, schoolReportResult] = await Promise.allSettled([
        getIssues({ limit: 20 }, { signal }),
        getSchoolReports({ limit: 20 }, { signal }),
      ])
      if (signal?.aborted) return

      if (issueResult.status === 'fulfilled') {
        setIssues(Array.isArray(issueResult.value.data) ? issueResult.value.data.map(normalizeIssue) : [])
      } else {
        setIssues([])
      }

      if (schoolReportResult.status === 'fulfilled') {
        setSchoolReports(Array.isArray(schoolReportResult.value.data) ? schoolReportResult.value.data.map(normalizeSchoolReport) : [])
      } else {
        setSchoolReports([])
      }

      const failed = [issueResult, schoolReportResult].find((result) => result.status === 'rejected')
      if (failed) {
        setError(failed.reason?.message || 'Sebagian laporan kendala gagal dimuat.')
      }
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setIssues([])
        setSchoolReports([])
        setError(fetchError.message || 'Laporan kendala gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchIssues(controller.signal))
    return () => controller.abort()
  }, [fetchIssues])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setError('')

    try {
      const { data } = await createIssue({
        category: form.category,
        description: form.description,
      })
      setIssues((current) => [normalizeIssue(data), ...current])
      setForm(initialForm)
      setMessage(
        CRITICAL_ISSUE_CATEGORIES.has(data?.category)
          ? 'Laporan kendala berhasil dikirim. Status SPPG otomatis ditandai Bermasalah.'
          : 'Laporan kendala berhasil dikirim.',
      )
    } catch (submitError) {
      setError(submitError.message || 'Laporan kendala gagal dikirim.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Operasional SPPG</p>
          <h1 className="sppg-op-title">Laporan Kendala</h1>
          <p className="sppg-op-desc">Catat kendala operasional agar dapat dipantau dan ditindaklanjuti sesuai hak akses.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchIssues(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <div className="sppg-op-grid">
        <section className="sppg-op-card">
          <h2>Form Kendala</h2>
          <form className="sppg-op-form" onSubmit={handleSubmit}>
            <label className="sppg-op-field">
              <span>Kategori</span>
              <select className="sppg-op-select" name="category" value={form.category} onChange={handleChange}>
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sppg-op-field">
              <span>Deskripsi Kendala</span>
              <textarea className="sppg-op-textarea" name="description" value={form.description} onChange={handleChange} required maxLength={2000} />
            </label>
            <div className="sppg-op-actions">
              <button className="sppg-op-btn" type="submit" disabled={submitting || !form.description.trim()}>
                {submitting ? <Loader2 aria-hidden="true" /> : <Send aria-hidden="true" />}
                Kirim Kendala
              </button>
            </div>
          </form>
        </section>

        <section className="sppg-op-card">
          <h2>Riwayat Kendala</h2>
          {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat kendala...</div> : null}
          {!loading && issues.length === 0 ? <div className="sppg-op-empty">Belum ada data kendala.</div> : null}
          <div className="sppg-op-list">
            {issues.map((issue) => (
              <article className="sppg-op-item" key={issue.id}>
                <strong>{issue.description}</strong>
                <span>{formatDateTime(issue.createdAt)}</span>
                <small>
                  {issue.category} | {issue.status}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="sppg-op-card">
          <h2>Laporan Masalah Sekolah</h2>
          {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat laporan sekolah...</div> : null}
          {!loading && schoolReports.length === 0 ? <div className="sppg-op-empty">Belum ada laporan masalah dari sekolah.</div> : null}
          <div className="sppg-op-list">
            {schoolReports.map((report) => (
              <article className="sppg-op-item" key={report.id}>
                <strong>{report.schoolName}</strong>
                <span>{formatDateTime(report.createdAt)} | Distribusi #{report.distributionId || '-'}</span>
                <small>
                  {report.category} | {report.status}
                </small>
                <p>{report.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SppgIssues
