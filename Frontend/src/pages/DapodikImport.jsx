import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileJson,
  Link2,
  Loader2,
  RefreshCcw,
  Search,
  Upload,
  X,
} from 'lucide-react'
import {
  getDapodikStagedSchools,
  getSchools,
  getSppg,
  importDapodikSchools,
  linkDapodikSchool,
  promoteDapodikSchool,
} from '../services/api'
import './DapodikImport.css'

const PAGE_SIZE = 12
const DEFAULT_SEMESTER_ID = import.meta.env.VITE_DAPODIK_DEFAULT_SEMESTER_ID || '20252'

const EDUCATION_LEVELS = [
  { value: '', label: 'Semua jenjang' },
  { value: 'sd', label: 'SD' },
  { value: 'smp', label: 'SMP' },
  { value: 'sma', label: 'SMA' },
  { value: 'smk', label: 'SMK' },
  { value: 'slb', label: 'SLB' },
  { value: 'tk', label: 'TK' },
  { value: 'kb', label: 'KB' },
  { value: 'tpa', label: 'TPA' },
  { value: 'sps', label: 'SPS' },
  { value: 'pkbm', label: 'PKBM' },
  { value: 'skb', label: 'SKB' },
]

const LINK_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'unlinked', label: 'Belum masuk School' },
  { value: 'linked', label: 'Sudah terhubung' },
]

const initialImportForm = {
  semesterId: DEFAULT_SEMESTER_ID,
  kodeWilayah: '',
  educationLevel: '',
  file: null,
  paste: '',
}

const initialFilters = {
  search: '',
  linkStatus: 'unlinked',
  semesterId: '',
  province: '',
  city: '',
}

const initialPromoteForm = {
  sppgId: '',
  address: '',
  totalStudents: '',
}

const initialLinkForm = {
  schoolId: '',
  schoolSearch: '',
  syncFields: true,
  address: '',
  totalStudents: '',
}

function unwrapItems(result) {
  const payload = result?.data ?? result
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function unwrapMeta(result) {
  return result?.meta || result?.data?.meta || {}
}

function getErrorMessage(error) {
  return error?.data?.message || error?.message || 'Request gagal diproses.'
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeStagedSchool(item) {
  return {
    id: item.id,
    semesterId: item.semesterId || '',
    dapodikSchoolId: item.dapodikSchoolId || '',
    npsn: item.npsn || '',
    name: item.name || '-',
    educationLevel: item.educationLevel || item.bentukPendidikan || item.bp || '',
    schoolStatus: item.schoolStatus || '',
    studentCount: item.studentCount ?? '',
    region: item.region || {},
    fetchedAt: item.fetchedAt || '',
    lastSyncAt: item.lastSyncAt || '',
    importBatchId: item.importBatchId || '',
    linkedSchool: item.linkedSchool || null,
    raw: item.raw || null,
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

function normalizeSchool(item) {
  return {
    id: item.id,
    name: item.name || '-',
    npsn: item.npsn || '',
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
    sppgName: item.sppg?.name || '',
  }
}

function makeOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined
  return Number(value)
}

function makeImportPayload(form) {
  const base = {
    id_level_wilayah: 3,
    semester_id: form.semesterId.trim(),
    ...(form.kodeWilayah.trim() ? { kode_wilayah: form.kodeWilayah.trim() } : {}),
    ...(form.educationLevel ? { bentuk_pendidikan_id: form.educationLevel } : {}),
  }

  if (form.file) {
    const data = new FormData()
    Object.entries(base).forEach(([key, value]) => data.append(key, value))
    data.append('file', form.file)
    return data
  }

  const pasted = form.paste.trim()
  if (!pasted) {
    throw new Error('Pilih file JSON/CSV atau tempel payload Dapodik terlebih dahulu.')
  }

  if (pasted.startsWith('[') || pasted.startsWith('{')) {
    const parsed = JSON.parse(pasted)
    const items = Array.isArray(parsed) ? parsed : parsed.items || parsed.data

    if (!Array.isArray(items)) {
      throw new Error('JSON harus berupa array atau object dengan field items/data array.')
    }

    return {
      ...base,
      items,
    }
  }

  return {
    ...base,
    csv: pasted,
  }
}

function getTotalPages(meta) {
  return meta.totalPages || meta.total_pages || Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE))
}

function DapodikImport() {
  const [importForm, setImportForm] = useState(initialImportForm)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [modalMode, setModalMode] = useState('')
  const [promoteForm, setPromoteForm] = useState(initialPromoteForm)
  const [linkForm, setLinkForm] = useState(initialLinkForm)
  const [sppgOptions, setSppgOptions] = useState([])
  const [schoolOptions, setSchoolOptions] = useState([])
  const [resourceLoading, setResourceLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const loadRows = useCallback(async (signal) => {
    setLoading(true)
    setListError('')

    try {
      const result = await getDapodikStagedSchools({
        page,
        limit: PAGE_SIZE,
        search: filters.search,
        link_status: filters.linkStatus,
        semester_id: filters.semesterId,
        province: filters.province,
        city: filters.city,
      })

      if (signal?.aborted) return
      const items = unwrapItems(result).map(normalizeStagedSchool)
      setRows(items)
      setMeta(unwrapMeta(result))
      setSelected((current) => {
        if (!current) return items[0] || null
        return items.find((item) => item.id === current.id) || items[0] || null
      })
    } catch (error) {
      if (signal?.aborted) return
      setRows([])
      setMeta({})
      setSelected(null)
      setListError(getErrorMessage(error))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [filters.city, filters.linkStatus, filters.province, filters.search, filters.semesterId, page])

  const loadSppgOptions = useCallback(async () => {
    setResourceLoading(true)
    try {
      const result = await getSppg({
        page: 1,
        limit: 100,
        fields: 'province,city,status',
      })
      setSppgOptions(unwrapItems(result).map(normalizeSppg))
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setResourceLoading(false)
    }
  }, [showToast])

  const loadSchoolOptions = useCallback(async (search = '') => {
    setResourceLoading(true)
    try {
      const result = await getSchools({
        page: 1,
        limit: 30,
        search,
      })
      setSchoolOptions(unwrapItems(result).map(normalizeSchool))
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setResourceLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadRows(controller.signal), 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadRows])

  const stats = useMemo(() => {
    const linked = rows.filter((row) => row.linkedSchool).length
    return {
      pageRows: rows.length,
      linked,
      unlinked: rows.length - linked,
      total: meta.total || 0,
    }
  }, [meta.total, rows])

  const totalPages = getTotalPages(meta)

  const updateImportForm = (field, value) => {
    setImportForm((current) => ({ ...current, [field]: value }))
    if (importError) setImportError('')
  }

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }

  const handleImportSubmit = async (event) => {
    event.preventDefault()
    setImporting(true)
    setImportError('')
    setImportResult(null)

    try {
      const payload = makeImportPayload(importForm)
      const result = await importDapodikSchools(payload)
      setImportResult(result.data || result)
      showToast('Import Dapodik ke staging selesai.')
      setPage(1)
      await loadRows()
    } catch (error) {
      setImportError(getErrorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  const openPromote = async (row) => {
    setSelected(row)
    setPromoteForm({
      sppgId: '',
      address: '',
      totalStudents: row.studentCount === '' || row.studentCount === null ? '' : String(row.studentCount),
    })
    setModalMode('promote')
    if (!sppgOptions.length) await loadSppgOptions()
  }

  const openLink = async (row) => {
    setSelected(row)
    setLinkForm({
      schoolId: '',
      schoolSearch: row.npsn || row.name,
      syncFields: true,
      address: '',
      totalStudents: row.studentCount === '' || row.studentCount === null ? '' : String(row.studentCount),
    })
    setModalMode('link')
    await loadSchoolOptions(row.npsn || row.name)
  }

  const closeModal = () => {
    setModalMode('')
    setActionLoading(false)
  }

  const handlePromoteSubmit = async (event) => {
    event.preventDefault()
    if (!selected) return

    if (!promoteForm.sppgId) {
      showToast('SPPG tujuan wajib diisi.', 'error')
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        sppgId: Number(promoteForm.sppgId),
        ...(promoteForm.address.trim() ? { address: promoteForm.address.trim() } : {}),
        ...(makeOptionalNumber(promoteForm.totalStudents) !== undefined
          ? { totalStudents: makeOptionalNumber(promoteForm.totalStudents) }
          : {}),
      }
      const result = await promoteDapodikSchool(selected.id, payload)
      showToast(result.meta?.action === 'updated' ? 'School existing berhasil diperbarui.' : 'School baru berhasil dibuat.')
      closeModal()
      await loadRows()
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLinkSubmit = async (event) => {
    event.preventDefault()
    if (!selected) return

    if (!linkForm.schoolId) {
      showToast('School existing wajib dipilih.', 'error')
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        schoolId: Number(linkForm.schoolId),
        syncFields: Boolean(linkForm.syncFields),
        ...(linkForm.address.trim() ? { address: linkForm.address.trim() } : {}),
        ...(makeOptionalNumber(linkForm.totalStudents) !== undefined ? { totalStudents: makeOptionalNumber(linkForm.totalStudents) } : {}),
      }
      await linkDapodikSchool(selected.id, payload)
      showToast('Dapodik school berhasil dihubungkan ke school existing.')
      closeModal()
      await loadRows()
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="dapodik-page">
      {toast ? (
        <div className={`dapodik-toast dapodik-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}

      <header className="dapodik-header">
        <div>
          <p>Admin Data</p>
          <h1>Import Dapodik ke School</h1>
          <span>Kelola staging `dapodik_schools`, lalu promote atau link ke tabel `schools`.</span>
        </div>
        <button className="dapodik-refresh" type="button" onClick={() => loadRows()}>
          <RefreshCcw size={17} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <section className="dapodik-import-panel">
        <div className="dapodik-panel-title">
          <Upload size={20} aria-hidden="true" />
          <div>
            <h2>Import ke Staging</h2>
            <p>Upload JSON/CSV Dapodik atau tempel payload array/items untuk mengisi `dapodik_schools`.</p>
          </div>
        </div>

        <form className="dapodik-import-form" onSubmit={handleImportSubmit}>
          <label>
            <span>Semester ID</span>
            <input value={importForm.semesterId} onChange={(event) => updateImportForm('semesterId', event.target.value)} />
          </label>
          <label>
            <span>Kode Wilayah</span>
            <input
              value={importForm.kodeWilayah}
              onChange={(event) => updateImportForm('kodeWilayah', event.target.value)}
              placeholder="Opsional, 6 digit"
            />
          </label>
          <label>
            <span>Jenjang</span>
            <select value={importForm.educationLevel} onChange={(event) => updateImportForm('educationLevel', event.target.value)}>
              {EDUCATION_LEVELS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>File JSON/CSV</span>
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={(event) => updateImportForm('file', event.target.files?.[0] || null)}
            />
          </label>
          <label className="dapodik-paste">
            <span>Paste JSON/CSV</span>
            <textarea
              value={importForm.paste}
              onChange={(event) => updateImportForm('paste', event.target.value)}
              placeholder='Contoh JSON: [{"sekolah_id":"...","nama":"SD ...","npsn":"..."}]'
            />
          </label>

          {importError ? (
            <div className="dapodik-error" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              {importError}
            </div>
          ) : null}

          <button className="dapodik-primary" type="submit" disabled={importing}>
            {importing ? <Loader2 className="dapodik-spin" size={17} aria-hidden="true" /> : <FileJson size={17} aria-hidden="true" />}
            Import ke Dapodik Schools
          </button>
        </form>

        {importResult ? <ImportSummary result={importResult} /> : null}
      </section>

      <section className="dapodik-grid">
        <div className="dapodik-list-panel">
          <div className="dapodik-panel-title">
            <Database size={20} aria-hidden="true" />
            <div>
              <h2>Staging Dapodik Schools</h2>
              <p>{formatNumber(stats.total)} data staging sesuai filter.</p>
            </div>
          </div>

          <div className="dapodik-stats" aria-label="Ringkasan staging">
            <span>
              <strong>{formatNumber(stats.pageRows)}</strong>
              Baris halaman ini
            </span>
            <span>
              <strong>{formatNumber(stats.unlinked)}</strong>
              Belum link
            </span>
            <span>
              <strong>{formatNumber(stats.linked)}</strong>
              Sudah link
            </span>
          </div>

          <div className="dapodik-filters">
            <label className="dapodik-search-field">
              <span>Cari</span>
              <div>
                <Search size={17} aria-hidden="true" />
                <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Nama, NPSN, kota" />
              </div>
            </label>
            <label>
              <span>Status link</span>
              <select value={filters.linkStatus} onChange={(event) => updateFilter('linkStatus', event.target.value)}>
                {LINK_STATUS_OPTIONS.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Semester</span>
              <input value={filters.semesterId} onChange={(event) => updateFilter('semesterId', event.target.value)} placeholder="Semua" />
            </label>
            <label>
              <span>Provinsi</span>
              <input value={filters.province} onChange={(event) => updateFilter('province', event.target.value)} placeholder="Semua" />
            </label>
            <label>
              <span>Kota</span>
              <input value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} placeholder="Semua" />
            </label>
          </div>

          {listError ? (
            <div className="dapodik-error" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              {listError}
            </div>
          ) : null}

          <div className="dapodik-table-wrap">
            <table className="dapodik-table">
              <thead>
                <tr>
                  <th>Sekolah Dapodik</th>
                  <th>Wilayah</th>
                  <th>Peserta</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5">
                      <span className="dapodik-loading">
                        <Loader2 className="dapodik-spin" size={18} aria-hidden="true" />
                        Memuat staging...
                      </span>
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id} className={selected?.id === row.id ? 'dapodik-row-active' : ''} onClick={() => setSelected(row)}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>NPSN {row.npsn || '-'} / Dapodik {row.dapodikSchoolId || '-'}</small>
                      </td>
                      <td>
                        <span>{[row.region.district, row.region.city, row.region.province].filter(Boolean).join(', ') || '-'}</span>
                        <small>{row.educationLevel || '-'} / {row.schoolStatus || '-'}</small>
                      </td>
                      <td>{formatNumber(row.studentCount)}</td>
                      <td>
                        {row.linkedSchool ? (
                          <span className="dapodik-badge dapodik-badge-linked">Linked</span>
                        ) : (
                          <span className="dapodik-badge dapodik-badge-open">Unlinked</span>
                        )}
                      </td>
                      <td>
                        <div className="dapodik-actions" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={() => openPromote(row)}>
                            Promote
                          </button>
                          <button type="button" onClick={() => openLink(row)}>
                            Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">Tidak ada data staging sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dapodik-pagination">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Sebelumnya
            </button>
            <span>
              Halaman {formatNumber(page)} dari {formatNumber(totalPages)}
            </span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Berikutnya
            </button>
          </div>
        </div>

        <StagedDetail selected={selected} onPromote={openPromote} onLink={openLink} />
      </section>

      {modalMode === 'promote' ? (
        <ActionModal title="Promote ke Table School" onClose={closeModal}>
          <form className="dapodik-modal-form" onSubmit={handlePromoteSubmit}>
            <SelectedSchoolSummary row={selected} />
            <label>
              <span>ID SPPG Tujuan</span>
              <input
                type="number"
                min="1"
                value={promoteForm.sppgId}
                onChange={(event) => setPromoteForm((current) => ({ ...current, sppgId: event.target.value }))}
                placeholder="Contoh: 1"
              />
            </label>
            <label>
              <span>Pilih dari 100 SPPG pertama</span>
              <select value={promoteForm.sppgId} onChange={(event) => setPromoteForm((current) => ({ ...current, sppgId: event.target.value }))}>
                <option value="">Pilih SPPG</option>
                {sppgOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} - {item.name} ({[item.city, item.province].filter(Boolean).join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Alamat override</span>
              <input value={promoteForm.address} onChange={(event) => setPromoteForm((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label>
              <span>Total siswa override</span>
              <input
                type="number"
                min="0"
                value={promoteForm.totalStudents}
                onChange={(event) => setPromoteForm((current) => ({ ...current, totalStudents: event.target.value }))}
              />
            </label>
            <button className="dapodik-primary" type="submit" disabled={actionLoading || resourceLoading}>
              {actionLoading ? <Loader2 className="dapodik-spin" size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
              Promote
            </button>
          </form>
        </ActionModal>
      ) : null}

      {modalMode === 'link' ? (
        <ActionModal title="Link ke School Existing" onClose={closeModal}>
          <form className="dapodik-modal-form" onSubmit={handleLinkSubmit}>
            <SelectedSchoolSummary row={selected} />
            <label>
              <span>Cari school existing</span>
              <div className="dapodik-inline-search">
                <input
                  value={linkForm.schoolSearch}
                  onChange={(event) => setLinkForm((current) => ({ ...current, schoolSearch: event.target.value }))}
                  placeholder="Nama/NPSN school"
                />
                <button type="button" onClick={() => loadSchoolOptions(linkForm.schoolSearch)}>
                  <Search size={16} aria-hidden="true" />
                </button>
              </div>
            </label>
            <label>
              <span>School existing</span>
              <select value={linkForm.schoolId} onChange={(event) => setLinkForm((current) => ({ ...current, schoolId: event.target.value }))}>
                <option value="">Pilih school</option>
                {schoolOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} - {item.name} ({item.npsn || 'NPSN -'})
                  </option>
                ))}
              </select>
            </label>
            <label className="dapodik-check">
              <input
                type="checkbox"
                checked={linkForm.syncFields}
                onChange={(event) => setLinkForm((current) => ({ ...current, syncFields: event.target.checked }))}
              />
              <span>Sync nama, wilayah, NPSN, jenjang, status, dan total siswa dari Dapodik</span>
            </label>
            <label>
              <span>Alamat override</span>
              <input value={linkForm.address} onChange={(event) => setLinkForm((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label>
              <span>Total siswa override</span>
              <input
                type="number"
                min="0"
                value={linkForm.totalStudents}
                onChange={(event) => setLinkForm((current) => ({ ...current, totalStudents: event.target.value }))}
              />
            </label>
            <button className="dapodik-primary" type="submit" disabled={actionLoading || resourceLoading}>
              {actionLoading ? <Loader2 className="dapodik-spin" size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
              Link School
            </button>
          </form>
        </ActionModal>
      ) : null}
    </div>
  )
}

function ImportSummary({ result }) {
  const summaryRows = [
    ['Total rows', result.totalRows],
    ['Create', result.createCount],
    ['Update', result.updateCount],
    ['Unchanged', result.unchangedCount],
    ['Skipped', result.skippedCount],
  ]

  return (
    <div className="dapodik-import-summary">
      {summaryRows.map(([label, value]) => (
        <span key={label}>
          <strong>{formatNumber(value)}</strong>
          {label}
        </span>
      ))}
      <p>Batch: {result.importBatchId || '-'}</p>
    </div>
  )
}

function StagedDetail({ selected, onPromote, onLink }) {
  if (!selected) {
    return (
      <aside className="dapodik-detail">
        <div className="dapodik-empty-detail">
          <Database size={28} aria-hidden="true" />
          Pilih data staging untuk melihat detail.
        </div>
      </aside>
    )
  }

  return (
    <aside className="dapodik-detail">
      <div className="dapodik-panel-title">
        <Database size={20} aria-hidden="true" />
        <div>
          <h2>{selected.name}</h2>
          <p>NPSN {selected.npsn || '-'} / Dapodik {selected.dapodikSchoolId || '-'}</p>
        </div>
      </div>

      <dl className="dapodik-detail-list">
        <div>
          <dt>Wilayah</dt>
          <dd>{[selected.region.district, selected.region.city, selected.region.province].filter(Boolean).join(', ') || '-'}</dd>
        </div>
        <div>
          <dt>Semester</dt>
          <dd>{selected.semesterId || '-'}</dd>
        </div>
        <div>
          <dt>Jenjang / Status</dt>
          <dd>{selected.educationLevel || '-'} / {selected.schoolStatus || '-'}</dd>
        </div>
        <div>
          <dt>Peserta Didik</dt>
          <dd>{formatNumber(selected.studentCount)}</dd>
        </div>
        <div>
          <dt>Last Sync</dt>
          <dd>{formatDateTime(selected.lastSyncAt || selected.fetchedAt)}</dd>
        </div>
        <div>
          <dt>Linked School</dt>
          <dd>{selected.linkedSchool ? `#${selected.linkedSchool.id} - ${selected.linkedSchool.name}` : 'Belum terhubung'}</dd>
        </div>
      </dl>

      <div className="dapodik-detail-actions">
        <button type="button" onClick={() => onPromote(selected)}>
          Promote ke School
        </button>
        <button type="button" onClick={() => onLink(selected)}>
          Link Existing
        </button>
      </div>
    </aside>
  )
}

function ActionModal({ title, onClose, children }) {
  return (
    <div className="dapodik-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="dapodik-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup modal">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function SelectedSchoolSummary({ row }) {
  if (!row) return null

  return (
    <div className="dapodik-selected-summary">
      <strong>{row.name}</strong>
      <span>{[row.region?.district, row.region?.city, row.region?.province].filter(Boolean).join(', ') || '-'}</span>
      <span>NPSN {row.npsn || '-'} / Dapodik {row.dapodikSchoolId || '-'}</span>
    </div>
  )
}

export default DapodikImport
