import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Edit3, Eye, Loader2, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import {
  createSppg,
  deleteSppg,
  getDeletedSppg,
  getSppg,
  restoreSppg,
  updateSppg,
} from '../services/api.js'
import './MasterData.css'

const PAGE_SIZE = 10
const emptyForm = {
  name: '',
  province: '',
  city: '',
  address: '',
  lat: '',
  lng: '',
  capacity: '',
  workers: '',
  status: 'active',
  picName: '',
  picPhone: '',
}

function normalizeSppg(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || '',
    city: item.city || '',
    address: item.address || '',
    lat: item.lat ?? '',
    lng: item.lng ?? '',
    capacity: item.capacity ?? 0,
    workers: item.workers ?? '',
    status: item.status || 'active',
    picName: item.picName ?? item.pic_name ?? '',
    picPhone: item.picPhone ?? item.pic_phone ?? '',
    deletedAt: item.deletedAt ?? item.deleted_at ?? null,
  }
}

function makePayload(form) {
  return {
    name: form.name.trim(),
    province: form.province.trim(),
    city: form.city.trim(),
    address: form.address.trim() || null,
    lat: form.lat === '' ? null : Number(form.lat),
    lng: form.lng === '' ? null : Number(form.lng),
    capacity: Number(form.capacity),
    workers: form.workers === '' ? null : Number(form.workers),
    status: form.status,
    picName: form.picName.trim() || null,
    picPhone: form.picPhone.trim() || null,
  }
}

export default function AdminSppg({ userRole }) {
  const isAdmin = userRole === 'admin'
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', province: '', city: '', status: '', deleted: false })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const fetchRows = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const params = { ...filters, deleted: undefined, page, limit: PAGE_SIZE }
      const result = filters.deleted ? await getDeletedSppg(params, { signal }) : await getSppg(params, { signal })
      const items = Array.isArray(result.data) ? result.data.map(normalizeSppg) : []
      setRows(items)
      setTotal(result.meta?.total || items.length)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setRows([])
        setTotal(0)
        setError(fetchError.message || 'Data SPPG gagal dimuat.')
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target
    setFilters((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setPage(1)
  }

  const openCreate = () => {
    setSelected(null)
    setForm(emptyForm)
    setModal('form')
  }

  const openEdit = (row) => {
    const item = normalizeSppg(row)
    setSelected(item)
    setForm({
      name: item.name,
      province: item.province,
      city: item.city,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      capacity: item.capacity,
      workers: item.workers,
      status: item.status,
      picName: item.picName,
      picPhone: item.picPhone,
    })
    setModal('form')
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = makePayload(form)
      if (selected) {
        await updateSppg(selected.id, payload)
        showToast('SPPG berhasil diperbarui.')
      } else {
        await createSppg(payload)
        showToast('SPPG berhasil dibuat.')
      }
      setModal(null)
      await fetchRows(new AbortController().signal)
    } catch (submitError) {
      showToast(submitError.message || 'Gagal menyimpan SPPG.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Soft delete ${row.name}?`)) return
    await deleteSppg(row.id)
    showToast('SPPG dipindahkan ke data terhapus.')
    fetchRows(new AbortController().signal)
  }

  const handleRestore = async (row) => {
    await restoreSppg(row.id)
    showToast('SPPG berhasil direstore.')
    fetchRows(new AbortController().signal)
  }

  return (
    <div className="master-page">
      <header className="master-header">
        <div>
          <p className="master-kicker">Master Data</p>
          <h1 className="master-title">SPPG</h1>
          <p className="master-subtitle">Kelola data Satuan Pelayanan Pemenuhan Gizi.</p>
        </div>
        {isAdmin ? (
          <button className="master-btn master-btn-primary" type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Tambah SPPG
          </button>
        ) : null}
      </header>

      {toast ? <div className={`master-toast master-toast-${toast.type}`}>{toast.message}</div> : null}

      <section className="master-panel">
        <div className="master-filter">
          <label className="master-field">
            <span>Search</span>
            <input className="master-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nama, provinsi, kota" />
          </label>
          <label className="master-field">
            <span>Province</span>
            <input className="master-input" name="province" value={filters.province} onChange={handleFilterChange} />
          </label>
          <label className="master-field">
            <span>City</span>
            <input className="master-input" name="city" value={filters.city} onChange={handleFilterChange} />
          </label>
          <label className="master-field">
            <span>Status</span>
            <select className="master-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="problem">Problem</option>
            </select>
          </label>
          <label className="master-field">
            <span>Deleted</span>
            <select className="master-select" name="deleted" value={filters.deleted ? 'yes' : ''} onChange={(event) => handleFilterChange({ target: { name: 'deleted', type: 'checkbox', checked: event.target.value === 'yes' } })}>
              <option value="">Aktif</option>
              <option value="yes">Terhapus</option>
            </select>
          </label>
          <button className="master-btn" type="button" onClick={() => fetchRows(new AbortController().signal)}>
            <Search aria-hidden="true" />
            Cari
          </button>
        </div>

        {error ? <div className="master-state"><AlertTriangle aria-hidden="true" />{error}</div> : null}
        {loading ? <div className="master-state"><Loader2 className="master-spin" aria-hidden="true" />Memuat SPPG...</div> : null}

        {!loading && !error ? (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>SPPG</th>
                  <th>Lokasi</th>
                  <th>Kapasitas</th>
                  <th>PIC</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="6">Belum ada data SPPG untuk filter ini.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong><span className="master-muted">#{row.id}</span></td>
                    <td><strong>{row.city || '-'}</strong><span className="master-muted">{row.province || '-'} {row.address ? `- ${row.address}` : ''}</span></td>
                    <td><strong>{Number(row.capacity || 0).toLocaleString('id-ID')}</strong><span className="master-muted">{row.workers || 0} pekerja</span></td>
                    <td><strong>{row.picName || '-'}</strong><span className="master-muted">{row.picPhone || '-'}</span></td>
                    <td><span className={`master-status master-status-${row.status}`}>{row.status}</span></td>
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
              <h2 className="master-title">{selected ? 'Edit SPPG' : 'Tambah SPPG'}</h2>
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
                <textarea className="master-textarea" name="address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </label>
              {['lat', 'lng', 'capacity', 'workers'].map((field) => (
                <label className="master-field" key={field}>
                  <span>{field}</span>
                  <input className="master-input" required={field === 'capacity'} type="number" name={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                </label>
              ))}
              <label className="master-field">
                <span>status</span>
                <select className="master-select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="problem">problem</option>
                </select>
              </label>
              <label className="master-field"><span>pic_name</span><input className="master-input" value={form.picName} onChange={(event) => setForm({ ...form, picName: event.target.value })} /></label>
              <label className="master-field"><span>pic_phone</span><input className="master-input" value={form.picPhone} onChange={(event) => setForm({ ...form, picPhone: event.target.value })} /></label>
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
