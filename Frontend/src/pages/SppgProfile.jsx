import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit3, Loader2, RefreshCcw, Save, X } from 'lucide-react'
import { getSppgDetail, updateMySppgProfile } from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './SppgOperational.css'

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function SppgProfile({ user }) {
  const sppgId = user?.sppgId || user?.sppg_id || ''
  const can = useAuthStore((state) => state.can)
  const canUpdateAccount = can('account.update')
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({
    name: '',
    address: '',
    workers: '',
    picName: '',
    picPhone: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const syncForm = useCallback((value) => {
    setForm({
      name: value?.name || '',
      address: value?.address || '',
      workers: value?.workers ?? '',
      picName: value?.picName || value?.pic_name || '',
      picPhone: value?.picPhone || value?.pic_phone || '',
    })
  }, [])

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
      syncForm(data || null)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setProfile(null)
        setError(fetchError.message || 'Profil SPPG gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sppgId, syncForm])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchProfile(controller.signal))
    return () => controller.abort()
  }, [fetchProfile])

  const stats = profile?.stats || {}

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCancelEdit = () => {
    syncForm(profile)
    setEditing(false)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canUpdateAccount) {
      setError('Anda tidak memiliki akses untuk mengubah profil.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const { data } = await updateMySppgProfile({
        name: form.name,
        address: form.address || null,
        workers: form.workers === '' ? null : Number(form.workers),
        picName: form.picName || null,
        picPhone: form.picPhone || null,
      })
      setProfile((current) => ({
        ...(current || {}),
        ...(data || {}),
        stats: current?.stats || {},
      }))
      syncForm(data || null)
      setEditing(false)
      setMessage('Profil SPPG berhasil diperbarui.')
    } catch (saveError) {
      setError(saveError.message || 'Profil SPPG gagal diperbarui.')
    } finally {
      setSaving(false)
    }
  }

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

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat profil...</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}
      {!loading && !profile && !error ? <div className="sppg-op-empty">Profil SPPG belum tersedia dari backend.</div> : null}

      {profile ? (
        <>
          <section className="sppg-op-card">
            <div className="sppg-op-section-head">
              <div>
                <h2>{profile.name}</h2>
                <span className="sppg-op-badge">{profile.status || 'status tidak tersedia'}</span>
              </div>
              {canUpdateAccount && !editing ? (
                <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => setEditing(true)}>
                  <Edit3 aria-hidden="true" />
                  Edit Profil
                </button>
              ) : null}
            </div>

            {editing ? (
              <form className="sppg-op-form" onSubmit={handleSubmit}>
                <label className="sppg-op-field">
                  <span>Nama SPPG</span>
                  <input className="sppg-op-input" name="name" value={form.name} onChange={handleChange} required maxLength={255} />
                </label>
                <label className="sppg-op-field">
                  <span>Alamat</span>
                  <textarea className="sppg-op-textarea" name="address" value={form.address} onChange={handleChange} maxLength={500} />
                </label>
                <div className="sppg-op-inline-grid">
                  <label className="sppg-op-field">
                    <span>Jumlah Pekerja</span>
                    <input className="sppg-op-input" type="number" min="0" name="workers" value={form.workers} onChange={handleChange} />
                  </label>
                  <label className="sppg-op-field">
                    <span>Nama PIC</span>
                    <input className="sppg-op-input" name="picName" value={form.picName} onChange={handleChange} maxLength={255} />
                  </label>
                  <label className="sppg-op-field">
                    <span>Telepon PIC</span>
                    <input className="sppg-op-input" name="picPhone" value={form.picPhone} onChange={handleChange} maxLength={50} />
                  </label>
                </div>
                <div className="sppg-op-actions">
                  <button className="sppg-op-btn" type="submit" disabled={saving}>
                    {saving ? <Loader2 aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Simpan Profil
                  </button>
                  <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={handleCancelEdit} disabled={saving}>
                    <X aria-hidden="true" />
                    Batal
                  </button>
                </div>
              </form>
            ) : (
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
                  <strong>PIC</strong>
                  <span>{profile.picName || profile.pic?.name || '-'} | {profile.picPhone || profile.pic?.phone || '-'}</span>
                </article>
                <article className="sppg-op-item">
                  <strong>Akun Login</strong>
                  <span>{user?.name || '-'} | {user?.email || '-'}</span>
                </article>
              </div>
            )}
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
