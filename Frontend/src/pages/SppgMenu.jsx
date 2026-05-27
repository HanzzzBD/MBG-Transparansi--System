import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCcw, Save } from 'lucide-react'
import { createMenu, getMenus } from '../services/api.js'
import './SppgOperational.css'

const TODAY = new Date().toISOString().slice(0, 10)

const initialForm = {
  menuDate: TODAY,
  menuName: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function normalizeMenu(item) {
  return {
    id: item.id,
    menuDate: item.menuDate || item.menu_date,
    menuName: item.menuName || item.menu_name || '-',
    calories: item.calories,
    proteinG: item.proteinG ?? item.protein_g,
    carbsG: item.carbsG ?? item.carbs_g,
    fatG: item.fatG ?? item.fat_g,
  }
}

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function SppgMenu({ user }) {
  const sppgId = user?.sppgId || user?.sppg_id || ''
  const [menus, setMenus] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const fetchMenus = useCallback(async (signal) => {
    if (!sppgId) {
      setMenus([])
      setLoading(false)
      setError('Akun SPPG belum terhubung dengan data SPPG.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data } = await getMenus({ sppgId, limit: 20 }, { signal })
      setMenus(Array.isArray(data) ? data.map(normalizeMenu) : [])
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setMenus([])
        setError(fetchError.message || 'Menu harian gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sppgId])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchMenus(controller.signal))
    return () => controller.abort()
  }, [fetchMenus])

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
      const { data } = await createMenu({
        menuDate: form.menuDate,
        menuName: form.menuName,
        calories: optionalNumber(form.calories),
        proteinG: optionalNumber(form.proteinG),
        carbsG: optionalNumber(form.carbsG),
        fatG: optionalNumber(form.fatG),
      })
      setMenus((current) => [normalizeMenu(data), ...current.filter((item) => item.id !== data.id)])
      setForm(initialForm)
      setMessage('Menu harian berhasil disimpan.')
    } catch (submitError) {
      setError(submitError.message || 'Menu harian gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Operasional SPPG</p>
          <h1 className="sppg-op-title">Input Menu Harian</h1>
          <p className="sppg-op-desc">Menu dan komposisi gizi dikirim ke backend agar detail SPPG dan produksi harian memakai data yang sama.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchMenus(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <div className="sppg-op-grid">
        <section className="sppg-op-card">
          <h2>Form Menu</h2>
          <form className="sppg-op-form" onSubmit={handleSubmit}>
            <label className="sppg-op-field">
              <span>Tanggal</span>
              <input className="sppg-op-input" type="date" name="menuDate" value={form.menuDate} onChange={handleChange} required />
            </label>
            <label className="sppg-op-field">
              <span>Nama Menu</span>
              <input className="sppg-op-input" name="menuName" value={form.menuName} onChange={handleChange} required maxLength={255} />
            </label>
            <div className="sppg-op-inline-grid">
              <label className="sppg-op-field">
                <span>Kalori</span>
                <input className="sppg-op-input" type="number" min="1" name="calories" value={form.calories} onChange={handleChange} />
              </label>
              <label className="sppg-op-field">
                <span>Protein (g)</span>
                <input className="sppg-op-input" type="number" min="0" name="proteinG" value={form.proteinG} onChange={handleChange} />
              </label>
              <label className="sppg-op-field">
                <span>Karbohidrat (g)</span>
                <input className="sppg-op-input" type="number" min="0" name="carbsG" value={form.carbsG} onChange={handleChange} />
              </label>
              <label className="sppg-op-field">
                <span>Lemak (g)</span>
                <input className="sppg-op-input" type="number" min="0" name="fatG" value={form.fatG} onChange={handleChange} />
              </label>
            </div>
            <div className="sppg-op-actions">
              <button className="sppg-op-btn" type="submit" disabled={submitting || !sppgId}>
                {submitting ? <Loader2 aria-hidden="true" /> : <Save aria-hidden="true" />}
                Simpan Menu
              </button>
            </div>
          </form>
        </section>

        <section className="sppg-op-card">
          <h2>Riwayat Menu</h2>
          {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat menu...</div> : null}
          {!loading && menus.length === 0 ? <div className="sppg-op-empty">Belum ada data menu dari backend.</div> : null}
          <div className="sppg-op-list">
            {menus.map((menu) => (
              <article className="sppg-op-item" key={menu.id}>
                <strong>{menu.menuName}</strong>
                <span>{formatDate(menu.menuDate)}</span>
                <small>
                  Kalori {menu.calories ?? '-'} | Protein {menu.proteinG ?? '-'}g | Karbo {menu.carbsG ?? '-'}g | Lemak {menu.fatG ?? '-'}g
                </small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SppgMenu
