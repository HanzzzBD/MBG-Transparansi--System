import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { getDistributions, getIssues, getMenus, getSchoolReports, isAbortError } from '../services/api.js'
import './SppgOperational.css'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatRupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(value) || 0)}`
}

function normalizeDistribution(item) {
  const portions = Number(item.portions || 0)
  const price = Number(item.pricePerPortion ?? item.price_per_portion ?? 0)
  return {
    id: item.id,
    schoolName: item.school?.name || item.schoolName || '-',
    distributionDate: item.distributionDate || item.distribution_date,
    portions,
    status: item.status,
    totalCost: Number(item.totalCost ?? item.total_cost ?? portions * price),
  }
}

function normalizeMenu(item) {
  return {
    id: item.id,
    menuDate: item.menuDate || item.menu_date,
    menuName: item.menuName || item.menu_name || '-',
  }
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
    message: item.message || '-',
    schoolName: item.school?.name || distribution.school?.name || '-',
    distributionId: item.distributionId || item.distribution_id || distribution.id,
    createdAt: item.createdAt || item.created_at,
  }
}

function SppgHistory({ user }) {
  const sppgId = user?.sppgId || user?.sppg_id || ''
  const [distributions, setDistributions] = useState([])
  const [menus, setMenus] = useState([])
  const [issues, setIssues] = useState([])
  const [schoolReports, setSchoolReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHistory = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const [distributionResult, menuResult, issueResult, schoolReportResult] = await Promise.allSettled([
        getDistributions({ limit: 20 }, { signal }),
        sppgId ? getMenus({ sppgId, limit: 20 }, { signal }) : Promise.resolve({ data: [] }),
        getIssues({ limit: 20 }, { signal }),
        getSchoolReports({ limit: 20 }, { signal }),
      ])

      if (signal?.aborted) return

      if (distributionResult.status === 'fulfilled') {
        setDistributions(Array.isArray(distributionResult.value.data) ? distributionResult.value.data.map(normalizeDistribution) : [])
      } else if (!isAbortError(distributionResult.reason)) {
        setDistributions([])
      }

      if (menuResult.status === 'fulfilled') {
        setMenus(Array.isArray(menuResult.value.data) ? menuResult.value.data.map(normalizeMenu) : [])
      } else if (!isAbortError(menuResult.reason)) {
        setMenus([])
      }

      if (issueResult.status === 'fulfilled') {
        setIssues(Array.isArray(issueResult.value.data) ? issueResult.value.data.map(normalizeIssue) : [])
      } else if (!isAbortError(issueResult.reason)) {
        setIssues([])
      }

      if (schoolReportResult.status === 'fulfilled') {
        setSchoolReports(Array.isArray(schoolReportResult.value.data) ? schoolReportResult.value.data.map(normalizeSchoolReport) : [])
      } else if (!isAbortError(schoolReportResult.reason)) {
        setSchoolReports([])
      }

      const failed = [distributionResult, menuResult, issueResult, schoolReportResult].find((result) => (
        result.status === 'rejected' && !isAbortError(result.reason)
      ))
      if (failed) {
        setError(failed.reason?.message || 'Sebagian riwayat gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sppgId])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchHistory(controller.signal))
    return () => controller.abort()
  }, [fetchHistory])

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Operasional SPPG</p>
          <h1 className="sppg-op-title">Riwayat SPPG</h1>
          <p className="sppg-op-desc">Riwayat distribusi, menu, dan kendala diambil langsung dari endpoint backend yang sudah di-scope untuk akun SPPG.</p>
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
          {!loading && distributions.length === 0 ? <div className="sppg-op-empty">Belum ada data distribusi dari backend.</div> : null}
          <div className="sppg-op-list">
            {distributions.map((distribution) => (
              <article className="sppg-op-item" key={distribution.id}>
                <strong>{distribution.schoolName}</strong>
                <span>{formatDate(distribution.distributionDate)} | {distribution.portions.toLocaleString('id-ID')} porsi</span>
                <small>{distribution.status} | {formatRupiah(distribution.totalCost)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="sppg-op-card">
          <h2>Menu Harian</h2>
          {!loading && menus.length === 0 ? <div className="sppg-op-empty">Belum ada data menu dari backend.</div> : null}
          <div className="sppg-op-list">
            {menus.map((menu) => (
              <article className="sppg-op-item" key={menu.id}>
                <strong>{menu.menuName}</strong>
                <span>{formatDate(menu.menuDate)}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="sppg-op-card">
          <h2>Kendala</h2>
          {!loading && issues.length === 0 ? <div className="sppg-op-empty">Belum ada data kendala dari backend.</div> : null}
          <div className="sppg-op-list">
            {issues.map((issue) => (
              <article className="sppg-op-item" key={issue.id}>
                <strong>{issue.description}</strong>
                <span>{formatDate(issue.createdAt)} | {issue.category}</span>
                <small>{issue.status}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="sppg-op-card">
          <h2>Laporan Sekolah</h2>
          {!loading && schoolReports.length === 0 ? <div className="sppg-op-empty">Belum ada laporan masalah dari sekolah.</div> : null}
          <div className="sppg-op-list">
            {schoolReports.map((report) => (
              <article className="sppg-op-item" key={report.id}>
                <strong>{report.schoolName}</strong>
                <span>{formatDate(report.createdAt)} | Distribusi #{report.distributionId || '-'}</span>
                <small>{report.category} | {report.status}</small>
                <p>{report.message}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SppgHistory
