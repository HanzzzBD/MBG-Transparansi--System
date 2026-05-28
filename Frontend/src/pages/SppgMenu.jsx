import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ImageIcon, Loader2, RefreshCcw, Save, ShieldCheck, XCircle } from 'lucide-react'
import { createMenu, getMenus, uploadFile, validateMenuPrice } from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './SppgOperational.css'

const TODAY = new Date().toISOString().slice(0, 10)
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png']

const initialForm = {
  menuDate: TODAY,
  menuName: '',
  itemsText: '',
  photoFile: null,
  manualPricePerPortion: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
}

const PRICE_STATUS_LABELS = {
  PENDING_REVIEW: 'Menunggu Review',
  VERIFIED: 'Harga Sesuai',
  MISMATCH: 'Tidak Sesuai',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-'
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(value) || 0)}`
}

function normalizeItems(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return []
}

function normalizeMenu(item) {
  const photoFile = item.photoFile || item.photo_file || null

  return {
    id: item.id,
    menuDate: item.menuDate || item.menu_date,
    menuName: item.menuName || item.menu_name || '-',
    items: normalizeItems(item.items),
    photoUrl: photoFile?.fileUrl || photoFile?.file_url || '',
    manualPricePerPortion: item.manualPricePerPortion ?? item.manual_price_per_portion ?? null,
    priceValidationStatus: item.priceValidationStatus || item.price_validation_status || 'PENDING_REVIEW',
    priceValidationNotes: item.priceValidationNotes || item.price_validation_notes || '',
    priceValidatorName: item.priceValidator?.name || item.price_validator?.name || '',
    calories: item.calories,
    proteinG: item.proteinG ?? item.protein_g,
    carbsG: item.carbsG ?? item.carbs_g,
    fatG: item.fatG ?? item.fat_g,
  }
}

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function parseItems(value) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getPriceStatusClass(status) {
  if (status === 'VERIFIED') return 'sppg-op-badge-success'
  if (status === 'MISMATCH') return 'sppg-op-badge-danger'
  return 'sppg-op-badge-warning'
}

function SppgMenu({ user }) {
  const sppgId = user?.sppgId || user?.sppg_id || ''
  const can = useAuthStore((state) => state.can)
  const canCreateMenu = can('daily_menu.create')
  const canValidatePrice = can('daily_menu.price.validate')
  const [menus, setMenus] = useState([])
  const [form, setForm] = useState(initialForm)
  const [validationDrafts, setValidationDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [validatingId, setValidatingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const menuItems = useMemo(() => parseItems(form.itemsText), [form.itemsText])

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
      const { data } = await getMenus({ sppgId, limit: 50 }, { signal })
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
    const { name, value, files } = event.target
    if (name === 'photoFile') {
      setForm((current) => ({ ...current, photoFile: files?.[0] || null }))
      return
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  const validatePhoto = (file) => {
    if (!file) return ''
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Format foto hanya JPG atau PNG.'
    if (file.size > MAX_FILE_SIZE) return 'Ukuran foto maksimal 5MB.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canCreateMenu) {
      setError('Anda tidak memiliki akses untuk membuat menu harian.')
      return
    }
    if (menuItems.length === 0) {
      setError('Daftar item makanan wajib diisi minimal satu item.')
      return
    }

    const photoError = validatePhoto(form.photoFile)
    if (photoError) {
      setError(photoError)
      return
    }

    setSubmitting(true)
    setMessage('')
    setError('')

    try {
      let photoFileId = null
      if (form.photoFile) {
        const uploaded = await uploadFile(form.photoFile)
        const uploadedId = uploaded?.data?.id ?? uploaded?.id
        photoFileId = uploadedId ? Number(uploadedId) : null
      }

      const { data } = await createMenu({
        menuDate: form.menuDate,
        menuName: form.menuName,
        items: menuItems,
        photoFileId,
        manualPricePerPortion: optionalNumber(form.manualPricePerPortion),
        calories: optionalNumber(form.calories),
        proteinG: optionalNumber(form.proteinG),
        carbsG: optionalNumber(form.carbsG),
        fatG: optionalNumber(form.fatG),
      })
      setMenus((current) => [normalizeMenu(data), ...current.filter((item) => item.id !== data.id)])
      setForm(initialForm)
      setMessage('Menu harian berhasil disimpan dan menunggu review harga.')
    } catch (submitError) {
      setError(submitError.message || 'Menu harian gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateValidationDraft = (menuId, field, value) => {
    setValidationDrafts((current) => ({
      ...current,
      [menuId]: {
        status: 'VERIFIED',
        notes: '',
        ...(current[menuId] || {}),
        [field]: value,
      },
    }))
  }

  const handleValidatePrice = async (menu) => {
    const draft = validationDrafts[menu.id] || { status: 'VERIFIED', notes: '' }
    if (draft.status === 'MISMATCH' && !draft.notes.trim()) {
      setError('Catatan wajib diisi jika harga menu tidak sesuai.')
      return
    }

    setValidatingId(menu.id)
    setError('')
    setMessage('')

    try {
      const { data } = await validateMenuPrice(menu.id, {
        status: draft.status,
        notes: draft.notes || null,
      })
      setMenus((current) => current.map((item) => (item.id === menu.id ? normalizeMenu(data) : item)))
      setMessage('Validasi harga menu berhasil disimpan.')
    } catch (validateError) {
      setError(validateError.message || 'Validasi harga menu gagal disimpan.')
    } finally {
      setValidatingId(null)
    }
  }

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Operasional SPPG</p>
          <h1 className="sppg-op-title">Input Menu Harian</h1>
          <p className="sppg-op-desc">Operator menyimpan menu dan harga manual. Supervisor memvalidasi harga sebelum distribusi bisa ditandai terkirim.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={() => fetchMenus(new AbortController().signal)}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {message ? <div className="sppg-op-state">{message}</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <div className="sppg-op-grid">
        {canCreateMenu ? (
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
              <label className="sppg-op-field">
                <span>Daftar Item Makanan</span>
                <textarea className="sppg-op-textarea" name="itemsText" value={form.itemsText} onChange={handleChange} required placeholder={'Nasi\nAyam bumbu kuning\nSayur bayam\nBuah'} />
              </label>
              <label className="sppg-op-field">
                <span>Foto Menu</span>
                <input className="sppg-op-input sppg-op-file-input" type="file" name="photoFile" accept="image/jpeg,image/png" onChange={handleChange} />
              </label>
              <label className="sppg-op-field">
                <span>Harga Per Porsi Manual</span>
                <input className="sppg-op-input" type="number" min="1" name="manualPricePerPortion" value={form.manualPricePerPortion} onChange={handleChange} required placeholder="Rp" />
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
        ) : null}

        <section className="sppg-op-card">
          <h2>Riwayat Menu</h2>
          {loading ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat menu...</div> : null}
          {!loading && menus.length === 0 ? <div className="sppg-op-empty">Belum ada data menu dari backend.</div> : null}
          <div className="sppg-op-list">
            {menus.map((menu) => {
              const draft = validationDrafts[menu.id] || { status: 'VERIFIED', notes: '' }

              return (
                <article className="sppg-op-item" key={menu.id}>
                  <div className="sppg-op-item-head">
                    <div>
                      <strong>{menu.menuName}</strong>
                      <span>{formatDate(menu.menuDate)} | {formatRupiah(menu.manualPricePerPortion)}/porsi</span>
                    </div>
                    <span className={`sppg-op-badge ${getPriceStatusClass(menu.priceValidationStatus)}`}>
                      {PRICE_STATUS_LABELS[menu.priceValidationStatus] || menu.priceValidationStatus}
                    </span>
                  </div>
                  {menu.photoUrl ? (
                    <a className="sppg-op-photo-link" href={menu.photoUrl} target="_blank" rel="noreferrer">
                      <ImageIcon aria-hidden="true" />
                      Lihat foto menu
                    </a>
                  ) : null}
                  <small>Item: {menu.items.length ? menu.items.join(', ') : '-'}</small>
                  <small>
                    Kalori {menu.calories ?? '-'} | Protein {menu.proteinG ?? '-'}g | Karbo {menu.carbsG ?? '-'}g | Lemak {menu.fatG ?? '-'}g
                  </small>
                  {menu.priceValidationNotes ? <small>Catatan: {menu.priceValidationNotes}</small> : null}
                  {menu.priceValidatorName ? <small>Validator: {menu.priceValidatorName}</small> : null}

                  {canValidatePrice ? (
                    <div className="sppg-op-validation-box">
                      <div className="sppg-op-inline-grid">
                        <label className="sppg-op-field">
                          <span>Status Validasi Harga</span>
                          <select className="sppg-op-select" value={draft.status} onChange={(event) => updateValidationDraft(menu.id, 'status', event.target.value)}>
                            <option value="VERIFIED">VERIFIED</option>
                            <option value="MISMATCH">MISMATCH</option>
                          </select>
                        </label>
                        <label className="sppg-op-field">
                          <span>Catatan</span>
                          <input className="sppg-op-input" value={draft.notes} onChange={(event) => updateValidationDraft(menu.id, 'notes', event.target.value)} placeholder={draft.status === 'MISMATCH' ? 'Wajib diisi' : 'Opsional'} />
                        </label>
                      </div>
                      <button className="sppg-op-btn" type="button" disabled={validatingId === menu.id} onClick={() => handleValidatePrice(menu)}>
                        {validatingId === menu.id ? <Loader2 aria-hidden="true" /> : draft.status === 'VERIFIED' ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                        Simpan Validasi
                      </button>
                    </div>
                  ) : (
                    <span className="sppg-op-muted-line">
                      <ShieldCheck aria-hidden="true" />
                      Validasi harga menunggu supervisor.
                    </span>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SppgMenu
