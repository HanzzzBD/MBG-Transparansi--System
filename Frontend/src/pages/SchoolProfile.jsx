import { useCallback, useEffect, useState } from 'react'
import { Edit3, Loader2, RefreshCcw, Save, X } from 'lucide-react'
import { getSchoolDetail, updateMySchoolProfile } from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './SppgOperational.css'

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
}

function SchoolProfile({ user }) {
  const schoolId = user?.schoolId || user?.school_id || ''
  const can = useAuthStore((state) => state.can)
  const canUpdateAccount = can('account.update')
  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({
    address: '',
    totalStudents: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const syncForm = useCallback((value) => {
    setForm({
      address: value?.address || '',
      totalStudents: value?.totalStudents ?? value?.total_students ?? '',
    })
  }, [])

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
      syncForm(data || null)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setSchool(null)
        setError(fetchError.message || 'Profil sekolah gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [schoolId, syncForm])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchProfile(controller.signal))
    return () => controller.abort()
  }, [fetchProfile])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCancelEdit = () => {
    syncForm(school)
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
      const { data } = await updateMySchoolProfile({
        address: form.address || null,
        totalStudents: form.totalStudents === '' ? 0 : Number(form.totalStudents),
      })
      setSchool(data || null)
      syncForm(data || null)
      setEditing(false)
      setMessage('Profil sekolah berhasil diperbarui.')
    } catch (saveError) {
      setError(saveError.message || 'Profil sekolah gagal diperbarui.')
    } finally {
      setSaving(false)
    }
  }

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

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat profil...</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}
      {!loading && !school && !error ? <div className="sppg-op-empty">Profil sekolah belum tersedia.</div> : null}

      {school ? (
        <>
          <section className="sppg-op-card">
            <div className="sppg-op-section-head">
              <div>
                <h2>{school.name}</h2>
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
                  <span>Alamat</span>
                  <textarea className="sppg-op-textarea" name="address" value={form.address} onChange={handleChange} maxLength={500} />
                </label>
                <label className="sppg-op-field">
                  <span>Total Siswa</span>
                  <input className="sppg-op-input" type="number" min="0" name="totalStudents" value={form.totalStudents} onChange={handleChange} />
                </label>
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
            )}
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
