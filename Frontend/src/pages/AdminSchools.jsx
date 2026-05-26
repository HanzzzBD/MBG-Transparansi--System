import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Edit3, Eye, Loader2, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import {
  createSchool,
  deleteSchool,
  getDeletedSchools,
  getSchools,
  getSppg,
  restoreSchool,
  updateSchool,
} from '../services/api.js'
import './MasterData.css'

const PAGE_SIZE = 10
const RELATION_LIMIT = 8
const emptyForm = {
  name: '',
  province: '',
  city: '',
  address: '',
  sppgId: '',
  totalStudents: '',
}

function normalizeSchool(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || '',
    city: item.city || '',
    address: item.address || '',
    sppgId: item.sppgId ?? item.sppg_id ?? item.sppg?.id ?? '',
    sppgName: item.sppg?.name || item.sppgName || '',
    totalStudents: item.totalStudents ?? item.total_students ?? 0,
    deletedAt: item.deletedAt ?? item.deleted_at ?? null,
  }
}

function normalizeSppg(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || '',
    city: item.city || '',
  }
}

function sppgLabel(item) {
  return [item.name, item.city, item.province].filter(Boolean).join(' - ')
}

function makePayload(form) {
  return {
    name: form.name.trim(),
    province: form.province.trim(),
    city: form.city.trim(),
    address: form.address.trim() || null,
    sppgId: Number(form.sppgId),
    totalStudents: Number(form.totalStudents || 0),
  }
}

export default function AdminSchools({ userRole }) {
  const isAdmin = userRole === 'admin'
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', province: '', city: '', sppgId: '', deleted: false })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [sppgSearch, setSppgSearch] = useState('')
  const [sppgOptions, setSppgOptions] = useState([])
  const [sppgLoading, setSppgLoading] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const fetchRows = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const params = { ...filters, deleted: undefined, page, limit: PAGE_SIZE }
      const result = filters.deleted ? await getDeletedSchools(params, { signal }) : await getSchools(params, { signal })
      const items = Array.isArray(result.data) ? result.data.map(normalizeSchool) : []
      setRows(items)
      setTotal(result.meta?.total || items.length)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setRows([])
        setTotal(0)
        setError(fetchError.message || 'Data sekolah gagal dimuat.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchRows(controller.signal))
    return () => controller.abort()
  }, [fetchRows])

  useEffect(() => {
    if (!modal || sppgSearch.trim().length < 2 || form.sppgId) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSppgLoading(true)
      try {
        const result = await getSppg({ search: sppgSearch.trim(), limit: RELATION_LIMIT, fields: 'province,city,status' }, { signal: controller.signal })
        setSppgOptions(Array.isArray(result.data) ? result.data.map(normalizeSppg) : [])
      } catch (searchError) {
        if (searchError.name !== 'AbortError') setSppgOptions([])
      } finally {
        if (!controller.signal.aborted) setSppgLoading(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [form.sppgId, modal, sppgSearch])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target
    setFilters((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setPage(1)
  }

  const openCreate = () => {
    setSelected(null)
    setForm(emptyForm)
    setSppgSearch('')
    setSppgOptions([])
    setModal('form')
  }

  const openEdit = (row) => {
    const item = normalizeSchool(row)
    setSelected(item)
    setForm({
      name: item.name,
      province: item.province,
      city: item.city,
      address: item.address,
      sppgId: item.sppgId,
      totalStudents: item.totalStudents,
    })
    setSppgSearch(item.sppgName || `SPPG #${item.sppgId}`)
    setSppgOptions(item.sppgId ? [{ id: item.sppgId, name: item.sppgName || `SPPG #${item.sppgId}`, province: '', city: '' }] : [])
    setModal('form')
  }

  const submitForm = async (event) => {
    event.preventDefault()
    if (!form.sppgId) {
      showToast('Pilih SPPG dari hasil pencarian.', 'danger')
      return
    }
    setSaving(true)
    try {
      const payload = makePayload(form)
      if (selected) {
        await updateSchool(selected.id, payload)
        showToast('Sekolah berhasil diperbarui.')
      } else {
        await createSchool(payload)
        showToast('Sekolah berhasil dibuat.')
      }
      setModal(null)
      await fetchRows(new AbortController().signal)
    } catch (submitError) {
      showToast(submitError.message || 'Gagal menyimpan sekolah.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Soft delete ${row.name}?`)) return
    await deleteSchool(row.id)
    showToast('Sekolah dipindahkan ke data terhapus.')
    fetchRows(new AbortController().signal)
  }

  const handleRestore = async (row) => {
    await restoreSchool(row.id)
    showToast('Sekolah berhasil direstore.')
    fetchRows(new AbortController().signal)
  }

  const selectSppg = (item) => {
    setForm((current) => ({ ...current, sppgId: item.id }))
    setSppgSearch(sppgLabel(item))
    setSppgOptions([item])
  }

  return (
    <div className="master-page">
      <header className="master-header">
        <div>
          <p className="master-kicker">Master Data</p>
          <h1 className="master-title">Schools</h1>
          <p className="master-subtitle">Kelola sekolah penerima dan relasi SPPG.</p>
        </div>
        {isAdmin ? (
          <button className="master-btn master-btn-primary" type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Tambah Sekolah
          </button>
        ) : null}
      </header>

      {toast ? <div className={`master-toast master-toast-${toast.type}`}>{toast.message}</div> : null}

      <section className="master-panel">
        <div className="master-filter">
          <label className="master-field"><span>Search</span><input className="master-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nama sekolah" /></label>
          <label className="master-field"><span>Province</span><input className="master-input" name="province" value={filters.province} onChange={handleFilterChange} /></label>
          <label className="master-field"><span>City</span><input className="master-input" name="city" value={filters.city} onChange={handleFilterChange} /></label>
          <label className="master-field"><span>SPPG ID</span><input className="master-input" name="sppgId" type="number" value={filters.sppgId} onChange={handleFilterChange} /></label>
          <label className="master-field">
            <span>Deleted</span>
            <select className="master-select" name="deleted" value={filters.deleted ? 'yes' : ''} onChange={(event) => handleFilterChange({ target: { name: 'deleted', type: 'checkbox', checked: event.target.value === 'yes' } })}>
              <option value="">Aktif</option>
              <option value="yes">Terhapus</option>
            </select>
          </label>
          <button className="master-btn" type="button" onClick={() => fetchRows(new AbortController().signal)}><Search aria-hidden="true" />Cari</button>
        </div>

        {error ? <div className="master-state"><AlertTriangle aria-hidden="true" />{error}</div> : null}
        {loading ? <div className="master-state"><Loader2 className="master-spin" aria-hidden="true" />Memuat sekolah...</div> : null}

        {!loading && !error ? (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Sekolah</th>
                  <th>Lokasi</th>
                  <th>SPPG</th>
                  <th>Siswa</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="5">Belum ada data sekolah untuk filter ini.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong><span className="master-muted">#{row.id}</span></td>
                    <td><strong>{row.city || '-'}</strong><span className="master-muted">{row.province || '-'} {row.address ? `- ${row.address}` : ''}</span></td>
                    <td><strong>{row.sppgName || '-'}</strong><span className="master-muted">SPPG #{row.sppgId || '-'}</span></td>
                    <td>{Number(row.totalStudents || 0).toLocaleString('id-ID')}</td>
                    <td>
                      <div className="master-row-actions">
                        <button className="master-icon-btn" type="button" title="Detail" onClick={() => { setSelected(row); setModal('detail') }}><Eye aria-hidden="true" /></button>
                        {isAdmin && !filters.deleted ? <button className="master-icon-btn" type="button" title="Edit" onClick={() => openEdit(row)}><Edit3 aria-hidden="true" /></button> : null}
                        {isAdmin && !filters.deleted ? <button className="master-icon-btn master-btn-danger" type="button" title="Soft delete" onClick={() => handleDelete(row)}><Trash2 aria-hidden="true" /></button> : null}
                        {isAdmin && filters.deleted ? <button className="master-icon-btn" type="button" title="Restore" onClick={() => handleRestore(row)}><RotateCcw aria-hidden="true" /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <footer className="master-pagination">
          <span className="master-muted">Total {total.toLocaleString('id-ID')} data</span>
          <div className="master-actions">
            <button className="master-btn" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Prev</button>
            <span className="master-muted">Page {page} / {totalPages}</span>
            <button className="master-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </footer>
      </section>

      {modal === 'form' ? (
        <div className="master-modal-backdrop">
          <form className="master-modal" onSubmit={submitForm}>
            <div className="master-modal-header">
              <h2 className="master-title">{selected ? 'Edit Sekolah' : 'Tambah Sekolah'}</h2>
              <button className="master-icon-btn" type="button" onClick={() => setModal(null)}><X aria-hidden="true" /></button>
            </div>
            <div className="master-form">
              {['name', 'province', 'city'].map((field) => (
                <label className="master-field" key={field}>
                  <span>{field}</span>
                  <input className="master-input" required name={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                </label>
              ))}
              <label className="master-field master-field-wide">
                <span>address</span>
                <textarea className="master-textarea" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </label>
              <label className="master-field">
                <span>total_students</span>
                <input className="master-input" required type="number" value={form.totalStudents} onChange={(event) => setForm({ ...form, totalStudents: event.target.value })} />
              </label>
              <label className="master-field master-field-wide">
                <span>SPPG</span>
                <input
                  className="master-input"
                  value={sppgSearch}
                  onChange={(event) => {
                    setSppgSearch(event.target.value)
                    setForm((current) => ({ ...current, sppgId: '' }))
                  }}
                  placeholder="Ketik minimal 2 karakter"
                />
                <div className="master-options">
                  {sppgLoading ? <span className="master-muted">Mencari SPPG...</span> : null}
                  {!form.sppgId && sppgOptions.map((item) => (
                    <button className="master-option" type="button" key={item.id} onClick={() => selectSppg(item)}>
                      <strong>{item.name}</strong>
                      <span className="master-muted">{item.city}, {item.province}</span>
                    </button>
                  ))}
                  {form.sppgId ? <span className="master-muted">Terpilih: {sppgSearch}</span> : null}
                </div>
              </label>
            </div>
            <div className="master-modal-footer">
              <button className="master-btn" type="button" onClick={() => setModal(null)}>Batal</button>
              <button className="master-btn master-btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modal === 'detail' && selected ? (
        <div className="master-modal-backdrop">
          <div className="master-modal">
            <div className="master-modal-header">
              <h2 className="master-title">{selected.name}</h2>
              <button className="master-icon-btn" type="button" onClick={() => setModal(null)}><X aria-hidden="true" /></button>
            </div>
            <div className="master-detail-grid">
              {Object.entries(selected).map(([key, value]) => (
                <div className="master-detail-item" key={key}>
                  <span className="master-label">{key}</span>
                  <strong>{value === null || value === '' ? '-' : String(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
