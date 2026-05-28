import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import {
  assignMySppgSchools,
  getAssignedSppgSchools,
  getMyDapodikSchools,
  isAbortError,
  unassignMySppgSchool,
} from '../services/api.js'
import useAuthStore from '../store/authStore.js'
import './SppgOperational.css'

const PAGE_SIZE = 10

function formatLocation(item) {
  return [item.district, item.city, item.province].filter(Boolean).join(', ') || '-'
}

function getItems(result) {
  return Array.isArray(result?.data) ? result.data : []
}

function getTotal(result, fallback = 0) {
  return Number(result?.meta?.total || fallback)
}

function SppgSchools() {
  const can = useAuthStore((state) => state.can)
  const canManageSchoolChannel = can('sppg.school_channel.manage')
  const [filters, setFilters] = useState({
    search: '',
    province: '',
    city: '',
    district: '',
    educationLevel: '',
  })
  const [dapodikPage, setDapodikPage] = useState(1)
  const [assignedPage, setAssignedPage] = useState(1)
  const [dapodikSchools, setDapodikSchools] = useState([])
  const [assignedSchools, setAssignedSchools] = useState([])
  const [dapodikTotal, setDapodikTotal] = useState(0)
  const [assignedTotal, setAssignedTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState({ dapodik: true, assigned: true })
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  const showNotice = useCallback((message, type = 'success') => {
    setNotice({ message, type })
    window.setTimeout(() => setNotice(null), 3200)
  }, [])

  const fetchAssigned = useCallback(async (signal) => {
    setLoading((current) => ({ ...current, assigned: true }))

    try {
      const result = await getAssignedSppgSchools({
        page: assignedPage,
        limit: PAGE_SIZE,
        status: 'active',
      }, { signal })
      const items = getItems(result)
      setAssignedSchools(items)
      setAssignedTotal(getTotal(result, items.length))
    } catch (fetchError) {
      if (!isAbortError(fetchError)) {
        setAssignedSchools([])
        setAssignedTotal(0)
        setError(fetchError.message || 'Daftar sekolah saluran gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading((current) => ({ ...current, assigned: false }))
    }
  }, [assignedPage])

  const fetchDapodik = useCallback(async (signal) => {
    setLoading((current) => ({ ...current, dapodik: true }))
    setError('')

    try {
      const result = await getMyDapodikSchools({
        ...filters,
        page: dapodikPage,
        limit: PAGE_SIZE,
      }, { signal })
      const items = getItems(result)
      setDapodikSchools(items)
      setDapodikTotal(getTotal(result, items.length))
      setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id && !item.alreadyAssigned)))
    } catch (fetchError) {
      if (!isAbortError(fetchError)) {
        setDapodikSchools([])
        setDapodikTotal(0)
        setError(fetchError.message || 'Pencarian sekolah Dapodik gagal dimuat.')
      }
    } finally {
      if (!signal?.aborted) setLoading((current) => ({ ...current, dapodik: false }))
    }
  }, [dapodikPage, filters])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      fetchDapodik(controller.signal)
      fetchAssigned(controller.signal)
    })
    return () => controller.abort()
  }, [fetchAssigned, fetchDapodik])

  const dapodikTotalPages = Math.max(1, Math.ceil(dapodikTotal / PAGE_SIZE))
  const assignedTotalPages = Math.max(1, Math.ceil(assignedTotal / PAGE_SIZE))
  const assignableIds = useMemo(
    () => dapodikSchools.filter((item) => !item.alreadyAssigned).map((item) => item.id),
    [dapodikSchools],
  )
  const allPageSelected = assignableIds.length > 0 && assignableIds.every((id) => selectedIds.includes(id))

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setDapodikPage(1)
  }

  const toggleSelection = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      if (allPageSelected) {
        return current.filter((id) => !assignableIds.includes(id))
      }
      return [...new Set([...current, ...assignableIds])]
    })
  }

  const refreshAll = useCallback(() => {
    const controller = new AbortController()
    fetchDapodik(controller.signal)
    fetchAssigned(controller.signal)
  }, [fetchAssigned, fetchDapodik])

  const handleAssign = async (ids) => {
    if (!ids.length) return
    if (!canManageSchoolChannel) {
      showNotice('Anda tidak memiliki akses untuk mengelola sekolah saluran.', 'danger')
      return
    }
    setActionLoading(`assign-${ids.join('-')}`)

    try {
      const result = await assignMySppgSchools({ dapodikSchoolIds: ids })
      const assigned = result.meta?.assigned || 0
      const skipped = result.meta?.skipped || 0
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      showNotice(`${assigned} sekolah ditambahkan, ${skipped} dilewati.`, assigned ? 'success' : 'warning')
      refreshAll()
    } catch (assignError) {
      showNotice(assignError.message || 'Sekolah gagal ditambahkan.', 'danger')
    } finally {
      setActionLoading('')
    }
  }

  const handleUnassign = async (assignmentId) => {
    if (!canManageSchoolChannel) {
      showNotice('Anda tidak memiliki akses untuk mengelola sekolah saluran.', 'danger')
      return
    }
    setActionLoading(`unassign-${assignmentId}`)

    try {
      await unassignMySppgSchool(assignmentId, { reason: 'Dinonaktifkan dari halaman Sekolah Saluran' })
      showNotice('Relasi sekolah berhasil dinonaktifkan.')
      refreshAll()
    } catch (unassignError) {
      showNotice(unassignError.message || 'Relasi sekolah gagal dinonaktifkan.', 'danger')
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="sppg-op-page">
      <header className="sppg-op-header">
        <div>
          <p className="sppg-op-eyebrow">Relasi Operasional</p>
          <h1 className="sppg-op-title">Sekolah Saluran</h1>
          <p className="sppg-op-desc">Cari sekolah dari referensi Dapodik, lalu tambahkan sebagai sekolah penerima aktif untuk SPPG ini.</p>
        </div>
        <button className="sppg-op-btn sppg-op-btn-secondary" type="button" onClick={refreshAll}>
          <RefreshCcw aria-hidden="true" />
          Muat Ulang
        </button>
      </header>

      {notice ? <div className={`sppg-op-toast sppg-op-toast-${notice.type}`}>{notice.message}</div> : null}
      {error ? <div className="sppg-op-state sppg-op-error">{error}</div> : null}

      <section className="sppg-op-card">
        <div className="sppg-op-section-head">
          <div>
            <h2>Cari Sekolah Dapodik</h2>
            <p>{dapodikTotal.toLocaleString('id-ID')} sekolah sesuai filter</p>
          </div>
          {canManageSchoolChannel ? (
            <button className="sppg-op-btn" type="button" disabled={!selectedIds.length || Boolean(actionLoading)} onClick={() => handleAssign(selectedIds)}>
            {actionLoading.startsWith('assign-') && selectedIds.length ? <Loader2 aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Tambahkan Terpilih
            </button>
          ) : null}
        </div>

        <div className="sppg-op-filter-grid">
          <label className="sppg-op-field sppg-op-field-wide">
            <span>Nama atau NPSN</span>
            <span className="sppg-op-search-wrap">
              <Search aria-hidden="true" />
              <input className="sppg-op-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Ketik minimal nama, NPSN, atau wilayah" type="search" />
            </span>
          </label>
          <label className="sppg-op-field">
            <span>Provinsi</span>
            <input className="sppg-op-input" name="province" value={filters.province} onChange={handleFilterChange} />
          </label>
          <label className="sppg-op-field">
            <span>Kota/Kabupaten</span>
            <input className="sppg-op-input" name="city" value={filters.city} onChange={handleFilterChange} />
          </label>
          <label className="sppg-op-field">
            <span>Kecamatan</span>
            <input className="sppg-op-input" name="district" value={filters.district} onChange={handleFilterChange} />
          </label>
          <label className="sppg-op-field">
            <span>Jenjang</span>
            <input className="sppg-op-input" name="educationLevel" value={filters.educationLevel} onChange={handleFilterChange} placeholder="SD, SMP, SMA" />
          </label>
        </div>

        {loading.dapodik ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat referensi Dapodik...</div> : null}
        {!loading.dapodik && dapodikSchools.length === 0 ? <div className="sppg-op-empty">Tidak ada sekolah Dapodik sesuai filter.</div> : null}
        {!loading.dapodik && dapodikSchools.length ? (
          <div className="sppg-op-table-wrap">
            <table className="sppg-op-table">
              <thead>
                <tr>
                  <th>
                    <button className="sppg-op-check-btn" type="button" onClick={togglePageSelection} disabled={!assignableIds.length} aria-label="Pilih semua sekolah yang belum terhubung">
                      {allPageSelected ? <Check aria-hidden="true" /> : null}
                    </button>
                  </th>
                  <th>Sekolah</th>
                  <th>Wilayah</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {dapodikSchools.map((school) => (
                  <tr key={school.id}>
                    <td>
                      <button className="sppg-op-check-btn" type="button" onClick={() => toggleSelection(school.id)} disabled={school.alreadyAssigned} aria-label={`Pilih ${school.name}`}>
                        {selectedIds.includes(school.id) ? <Check aria-hidden="true" /> : null}
                      </button>
                    </td>
                    <td>
                      <strong>{school.name}</strong>
                      <small>NPSN {school.npsn || '-'} | {school.educationLevel || '-'}</small>
                    </td>
                    <td>{formatLocation(school)}</td>
                    <td>
                      {school.assignedToCurrentSppg ? <span className="sppg-op-badge sppg-op-badge-success">Sudah dipilih</span> : null}
                      {!school.assignedToCurrentSppg && school.alreadyAssigned ? <span className="sppg-op-badge sppg-op-badge-warning">Dipakai {school.assignedSppgName || 'SPPG lain'}</span> : null}
                      {!school.alreadyAssigned ? <span className="sppg-op-badge">Belum dipilih</span> : null}
                    </td>
                    <td>
                      {canManageSchoolChannel ? (
                        <button className="sppg-op-btn" type="button" disabled={school.alreadyAssigned || Boolean(actionLoading)} onClick={() => handleAssign([school.id])}>
                          {actionLoading === `assign-${school.id}` ? <Loader2 aria-hidden="true" /> : <Plus aria-hidden="true" />}
                          Tambahkan
                        </button>
                      ) : (
                        <span className="sppg-op-muted-line">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <footer className="sppg-op-pagination">
          <span>Halaman {dapodikPage} dari {dapodikTotalPages}</span>
          <div>
            <button className="sppg-op-btn sppg-op-btn-secondary" type="button" disabled={dapodikPage <= 1} onClick={() => setDapodikPage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
            <button className="sppg-op-btn sppg-op-btn-secondary" type="button" disabled={dapodikPage >= dapodikTotalPages} onClick={() => setDapodikPage((page) => page + 1)}>Berikutnya</button>
          </div>
        </footer>
      </section>

      <section className="sppg-op-card">
        <div className="sppg-op-section-head">
          <div>
            <h2>Sekolah Saluran Aktif</h2>
            <p>{assignedTotal.toLocaleString('id-ID')} sekolah terhubung ke SPPG ini</p>
          </div>
        </div>

        {loading.assigned ? <div className="sppg-op-state"><Loader2 aria-hidden="true" /> Memuat sekolah saluran...</div> : null}
        {!loading.assigned && assignedSchools.length === 0 ? <div className="sppg-op-empty">Belum ada sekolah saluran aktif.</div> : null}
        {!loading.assigned && assignedSchools.length ? (
          <div className="sppg-op-list sppg-op-assigned-list">
            {assignedSchools.map((school) => (
              <article className="sppg-op-item sppg-op-assigned-item" key={school.assignmentId}>
                <div>
                  <strong>{school.name}</strong>
                  <span>{formatLocation(school)} | NPSN {school.npsn || '-'}</span>
                </div>
                {canManageSchoolChannel ? (
                  <button className="sppg-op-btn sppg-op-btn-danger" type="button" disabled={Boolean(actionLoading)} onClick={() => handleUnassign(school.assignmentId)}>
                    {actionLoading === `unassign-${school.assignmentId}` ? <Loader2 aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                    Nonaktifkan
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        <footer className="sppg-op-pagination">
          <span>Halaman {assignedPage} dari {assignedTotalPages}</span>
          <div>
            <button className="sppg-op-btn sppg-op-btn-secondary" type="button" disabled={assignedPage <= 1} onClick={() => setAssignedPage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
            <button className="sppg-op-btn sppg-op-btn-secondary" type="button" disabled={assignedPage >= assignedTotalPages} onClick={() => setAssignedPage((page) => page + 1)}>Berikutnya</button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default SppgSchools
