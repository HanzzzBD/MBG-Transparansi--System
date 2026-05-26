import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, RefreshCcw } from 'lucide-react'
import { getSppgDetail } from '../services/api.js'
import './SppgOperational.css'

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function SppgProfile({ user }) {
  const sppgId = user?.sppgId || user?.sppg_id || ''
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async (signal) => {
    if (!sppgId) {
      setProfile(null)
      setLoading(false)
      setError('Akun SPPG belum terhubung dengan data SPPG.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data } = await getSppgDetail(sppgId, { signal })
      setProfile(data || null)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setProfile(null)
        setError(fetchError.message || 'Profil SPPG gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sppgId])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchProfile(controller.signal))
    return () => controller.abort()
  }, [fetchProfile])

  const stats = profile?.stats || {}

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Operasional SPPG</p>
          <h1 className="sppg-op-title">Profil SPPG</h1>
          <p className="sppg-op-desc">Profil ini menampilkan data SPPG milik akun yang sedang login dan ringkasan operasional dari backend.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchProfile(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat profil...</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}
      {!loading && !profile && !error ? <div className="sppg-op-empty">Profil SPPG belum tersedia dari backend.</div> : null}

      {profile ? (
        <>
          <section className="sppg-op-card">
            <h2>{profile.name}</h2>
            <span className="sppg-op-badge">{profile.status || 'status tidak tersedia'}</span>
            <div className="sppg-op-list">
              <article className="sppg-op-item">
                <strong>Wilayah</strong>
                <span>{profile.province || '-'} / {profile.city || '-'}</span>
              </article>
              <article className="sppg-op-item">
                <strong>Alamat</strong>
                <span>{profile.address || '-'}</span>
              </article>
              <article className="sppg-op-item">
                <strong>Akun Login</strong>
                <span>{user?.name || '-'} | {user?.email || '-'}</span>
              </article>
            </div>
          </section>

          <section className="sppg-op-card">
            <div className="sppg-op-section-head">
              <div>
                <h2>Ringkasan</h2>
              </div>
              <Link className="sppg-op-btn sppg-op-btn-secondary" to="/sekolah-saluran">
                Kelola Sekolah Saluran
              </Link>
            </div>
            <div className="sppg-op-kpi-grid">
              <div className="sppg-op-kpi">
                <span>Kapasitas</span>
                <strong>{formatNumber(profile.capacity)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Sekolah</span>
                <strong>{formatNumber(stats.totalSchools)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Siswa</span>
                <strong>{formatNumber(stats.totalStudents)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Distribusi</span>
                <strong>{formatNumber(stats.totalDistributions)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Kendala Aktif</span>
                <strong>{formatNumber(stats.totalIssues)}</strong>
              </div>
              <div className="sppg-op-kpi">
                <span>Pekerja</span>
                <strong>{formatNumber(profile.workers)}</strong>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default SppgProfile
