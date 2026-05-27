import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { getSchoolDetail } from '../services/api.js'
import './SppgOperational.css'

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function SchoolProfile({ user }) {
  const schoolId = user?.schoolId || user?.school_id || ''
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async (signal) => {
    if (!schoolId) {
      setSchool(null)
      setLoading(false)
      setError('Akun sekolah belum terhubung dengan data sekolah.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data } = await getSchoolDetail(schoolId, { signal })
      setSchool(data || null)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setSchool(null)
        setError(fetchError.message || 'Profil sekolah gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchProfile(controller.signal))
    return () => controller.abort()
  }, [fetchProfile])

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Sekolah</p>
          <h1 className="sppg-op-title">Profil Sekolah</h1>
          <p className="sppg-op-desc">Profil diambil dari data sekolah yang terhubung ke akun login.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchProfile(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat profil...</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}
      {!loading && !school && !error ? <div className="sppg-op-empty">Profil sekolah belum tersedia dari backend.</div> : null}

      {school ? (
        <>
          <section className="sppg-op-card">
            <h2>{school.name}</h2>
            <div className="sppg-op-list">
              <article className="sppg-op-item">
                <strong>Wilayah</strong>
                <span>{school.province || '-'} / {school.city || '-'}</span>
              </article>
              <article className="sppg-op-item">
                <strong>Alamat</strong>
                <span>{school.address || '-'}</span>
              </article>
              <article className="sppg-op-item">
                <strong>SPPG Terhubung</strong>
                <span>{school.sppg?.name || '-'}</span>
              </article>
              <article className="sppg-op-item">
                <strong>Akun Login</strong>
                <span>{user?.name || '-'} | {user?.email || '-'}</span>
              </article>
            </div>
          </section>

          <section className="sppg-op-card">
            <h2>Ringkasan</h2>
            <div className="sppg-op-kpi-grid">
              <div className="sppg-op-kpi">
                <span>Total Siswa</span>
                <strong>{formatNumber(school.totalStudents ?? school.total_students)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>NPSN</span>
                <strong>{school.npsn || '-'}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Level</span>
                <strong>{school.educationLevel || school.education_level || '-'}</strong>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default SchoolProfile
