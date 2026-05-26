import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './Konfirmasi.css'

const PAGE_SIZE = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png']

const REPORT_CATEGORIES = [
  { value: 'keterlambatan', label: 'Keterlambatan' },
  { value: 'kekurangan_porsi', label: 'Kekurangan Porsi' },
  { value: 'kualitas_makanan', label: 'Kualitas Makanan' },
  { value: 'lainnya', label: 'Lainnya' },
]

const STATUS_LABELS = {
  pending: 'PENDING',
  verified: 'VERIFIED',
  conflict: 'CONFLICT',
}

const initialFormData = {
  receivedPortions: '',
  qualityOk: '',
  notes: '',
  file: null,
}

const initialReportData = {
  category: 'keterlambatan',
  message: '',
}

async function uploadFile(file, signal) {
  const formData = new FormData()
  formData.append('file', file)

  const payload = await requestJson('/files/upload', {
    method: 'POST',
    body: formData,
    signal,
  })

  return payload.data ?? payload
}

function normalizeValidation(item) {
  const distribution = item.distribution || {}
  const sppg = distribution.sppg || item.school?.sppg || {}
  const distributionDate = distribution.distributionDate || distribution.distribution_date || item.createdAt

  return {
    id: item.id,
    validationId: item.id,
    distributionId: item.distributionId || item.distribution_id || distribution.id,
    schoolId: item.schoolId || item.school_id || item.school?.id || distribution.school?.id,
    sppgName: sppg.name || '-',
    sppgCity: sppg.city || '-',
    claimedPortions: Number(distribution.portions || 0),
    receivedPortions: Number(item.receivedPortions || 0),
    qualityOk: item.qualityOk,
    distributionDate,
    distributionTime: formatTime(distributionDate),
    status: item.status || 'pending',
    notes: item.notes || '',
    createdAt: item.createdAt || distributionDate,
    validatedAt: item.validatedAt,
  }
}

function toHistoryRow(item) {
  return {
    id: item.id,
    date: item.validatedAt || item.createdAt || item.distributionDate,
    sppgName: item.sppgName,
    portions: item.receivedPortions || item.claimedPortions,
    status: item.status,
    notes: item.notes || (item.status === 'verified' ? 'Sesuai standar.' : 'Perlu tindak lanjut.'),
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getHoursSince(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

function validateFile(file) {
  if (!file) return ''
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Format foto hanya JPG atau PNG.'
  if (file.size > MAX_FILE_SIZE) return 'Ukuran foto maksimal 5MB.'
  return ''
}

function StatusBadge({ status }) {
  return <span className={`konfirmasi-status konfirmasi-status-${status}`}>{STATUS_LABELS[status] || status}</span>
}

function Konfirmasi({ onLogout, user, userName: authenticatedUserName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingList, setPendingList] = useState([])
  const [historyList, setHistoryList] = useState([])
  const [selectedDistribusi, setSelectedDistribusi] = useState(null)
  const [formData, setFormData] = useState(initialFormData)
  const [reportData, setReportData] = useState(initialReportData)
  const [showReportForm, setShowReportForm] = useState(false)
  const [submittedIds, setSubmittedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState('')
  const [toast, setToast] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [formErrors, setFormErrors] = useState({})
  const [reportErrors, setReportErrors] = useState({})
  const [filePreview, setFilePreview] = useState('')

  const userName = authenticatedUserName || user?.name || user?.email || 'Petugas Sekolah'
  const schoolId = user?.schoolId || user?.school_id || selectedDistribusi?.schoolId || ''

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchValidations = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const { data } = await requestJson('/validations', {
        signal,
        params: { limit: 100 },
      })
      const rows = Array.isArray(data) ? data.map(normalizeValidation) : []
      const pending = rows.filter((item) => item.status === 'pending')
      const history = rows.filter((item) => item.status !== 'pending').map(toHistoryRow)

      setPendingList(pending)
      setHistoryList(history)
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setPendingList([])
        setHistoryList([])
        setError(fetchError.message || 'Data validasi gagal dimuat dari API.')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchValidations(controller.signal))

    return () => controller.abort()
  }, [fetchValidations])

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
  }, [filePreview])

  const historyPageCount = Math.max(1, Math.ceil(historyList.length / PAGE_SIZE))
  const pagedHistory = historyList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selectedDifference = selectedDistribusi
    ? Number(formData.receivedPortions || 0) - Number(selectedDistribusi.claimedPortions || 0)
    : 0
  const willConflict = selectedDistribusi
    ? selectedDifference !== 0 || formData.qualityOk === 'false'
    : false

  const selectForValidation = (item) => {
    setSelectedDistribusi(item)
    setShowReportForm(false)
    setFormErrors({})
    setReportErrors({})
    setFormData({
      receivedPortions: String(item.claimedPortions || 0),
      qualityOk: 'true',
      notes: '',
      file: null,
    })
    setFilePreview('')
  }

  const openReportForm = (item) => {
    setSelectedDistribusi(item)
    setShowReportForm(true)
    setReportErrors({})
    setReportData(initialReportData)
  }

  const handleFormChange = (event) => {
    const { name, value, files } = event.target

    if (name === 'file') {
      const file = files?.[0] || null
      const fileError = validateFile(file)
      if (fileError) {
        setFormErrors((current) => ({ ...current, file: fileError }))
        return
      }

      if (filePreview) URL.revokeObjectURL(filePreview)
      setFilePreview(file ? URL.createObjectURL(file) : '')
      setFormData((current) => ({ ...current, file }))
      setFormErrors((current) => ({ ...current, file: '' }))
      return
    }

    setFormData((current) => ({ ...current, [name]: value }))
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const validateConfirmation = () => {
    const errors = {}
    const received = Number(formData.receivedPortions)

    if (formData.receivedPortions === '') errors.receivedPortions = 'Jumlah porsi diterima wajib diisi.'
    if (formData.receivedPortions !== '' && (!Number.isFinite(received) || received < 0)) {
      errors.receivedPortions = 'Jumlah porsi harus minimal 0.'
    }
    if (formData.qualityOk === '') errors.qualityOk = 'Pilih status kualitas makanan.'
    const fileError = validateFile(formData.file)
    if (fileError) errors.file = fileError

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const uploadOptionalProof = async (target, signal) => {
    if (!formData.file) return

    // TODO: Backend belum punya attachment khusus validationId. Foto penerimaan ditempel ke proof distribusi.
    const uploadedFile = await uploadFile(formData.file, signal)
    await requestJson('/proofs', {
      method: 'POST',
      signal,
      body: {
        distributionId: Number(target.distributionId),
        fileId: Number(uploadedFile.id),
      },
    })
  }

  const handleSubmitValidation = async (event) => {
    event.preventDefault()
    if (!selectedDistribusi || !validateConfirmation()) return

    const receivedPortions = Number(formData.receivedPortions)
    const qualityOk = formData.qualityOk === 'true'
    const status = receivedPortions === Number(selectedDistribusi.claimedPortions) && qualityOk ? 'verified' : 'conflict'
    const payload = {
      receivedPortions,
      qualityOk,
      status,
      notes: formData.notes.trim() || null,
    }
    const controller = new AbortController()

    setSubmitLoading('validation')

    try {
      const response = await requestJson(`/validations/${selectedDistribusi.validationId}`, {
        method: 'PUT',
        signal: controller.signal,
        body: payload,
      })
      await uploadOptionalProof(selectedDistribusi, controller.signal)

      const updatedValidation = normalizeValidation(response.data)
      const historyRow = toHistoryRow(updatedValidation)

      setPendingList((current) => current.filter((item) => item.validationId !== selectedDistribusi.validationId))
      setHistoryList((current) => [historyRow, ...current])
      setSubmittedIds((current) => [...current, selectedDistribusi.validationId])
      setSelectedDistribusi(null)
      setShowReportForm(false)
      setFormData(initialFormData)
      setFilePreview('')
      showToast(status === 'verified' ? 'success' : 'warning', status === 'verified' ? 'Distribusi berhasil diverifikasi.' : 'Validasi tersimpan sebagai conflict.')
    } catch (submitError) {
      showToast('danger', submitError.message || 'Validasi gagal disimpan.')
    } finally {
      setSubmitLoading('')
    }
  }

  const validateReport = () => {
    const errors = {}
    if (!reportData.category) errors.category = 'Kategori wajib dipilih.'
    if (reportData.message.trim().length < 20) errors.message = 'Pesan minimal 20 karakter.'
    setReportErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmitReport = async (event) => {
    event.preventDefault()
    if (!selectedDistribusi || !validateReport()) return

    const message = [
      reportData.message.trim(),
      `Distribusi: ${selectedDistribusi.distributionId}`,
      `SPPG: ${selectedDistribusi.sppgName}`,
      `Porsi diklaim: ${selectedDistribusi.claimedPortions}`,
    ].join('\n')

    setSubmitLoading('report')

    try {
      await requestJson('/school-reports', {
        method: 'POST',
        body: {
          ...(schoolId ? { schoolId: Number(schoolId) } : {}),
          category: reportData.category,
          message,
        },
      })
      showToast('success', 'Laporan masalah berhasil dikirim.')
      setReportData(initialReportData)
      setShowReportForm(false)
    } catch (reportError) {
      showToast('danger', reportError.message || 'Laporan masalah gagal dikirim.')
    } finally {
      setSubmitLoading('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    navigate('/login')
  }

  return (
    <DashboardLayout
      userRole="sekolah"
      userName={userName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={pendingList.length}
    >
      <div className="konfirmasi-page">
        <header className="konfirmasi-header">
          <div>
            <p className="konfirmasi-subtitle">Validasi Sekolah</p>
            <h1 className="konfirmasi-title">Konfirmasi & Validasi Distribusi</h1>
            <p>Konfirmasi porsi diterima, kualitas makanan, bukti penerimaan, dan laporan masalah distribusi MBG.</p>
          </div>
          <button className="konfirmasi-btn konfirmasi-btn-primary" type="button" onClick={() => fetchValidations(new AbortController().signal)}>
            <RefreshCcw aria-hidden="true" />
            Muat Ulang
          </button>
        </header>

        {toast ? <div className={`konfirmasi-toast konfirmasi-toast-${toast.type}`}>{toast.message}</div> : null}

        {error ? (
          <div className="konfirmasi-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="konfirmasi-loading">
            <Loader2 aria-hidden="true" />
            Memuat data validasi...
          </div>
        ) : null}

        <div className="konfirmasi-grid">
          <main className="konfirmasi-left">
            <section className="konfirmasi-card">
              <h2 className="konfirmasi-section-title">Menunggu Konfirmasi ({pendingList.length})</h2>
              <div className="konfirmasi-pending-list">
                {!loading && pendingList.length === 0 ? (
                  <div className="konfirmasi-empty-state">Belum ada distribusi yang perlu dikonfirmasi.</div>
                ) : null}
                {pendingList.map((item) => {
                  const isLate = getHoursSince(item.createdAt) > 12

                  return (
                    <article key={item.id} className={`konfirmasi-pending-card ${isLate ? 'konfirmasi-pending-late' : ''}`}>
                      <div className="konfirmasi-pending-head">
                        <span className="konfirmasi-sppg-badge">{item.sppgName} - {item.sppgCity}</span>
                        <StatusBadge status="pending" />
                      </div>
                      <div className="konfirmasi-meta">
                        {formatDate(item.distributionDate)} pukul {item.distributionTime}
                        {isLate ? <strong>Pending lebih dari 12 jam</strong> : null}
                      </div>
                      <div className="konfirmasi-porsi">
                        <span>Porsi diklaim</span>
                        <strong>{item.claimedPortions.toLocaleString('id-ID')}</strong>
                      </div>
                      <div className="konfirmasi-actions">
                        <button className="konfirmasi-btn konfirmasi-btn-success" type="button" onClick={() => selectForValidation(item)}>
                          <ClipboardCheck aria-hidden="true" />
                          Konfirmasi
                        </button>
                        <button className="konfirmasi-btn konfirmasi-btn-danger-outline" type="button" onClick={() => openReportForm(item)}>
                          <FileWarning aria-hidden="true" />
                          Laporkan Masalah
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="konfirmasi-card konfirmasi-history">
              <h2 className="konfirmasi-section-title">Riwayat Validasi</h2>
              <div className="konfirmasi-table-wrap">
                <table className="konfirmasi-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>SPPG</th>
                      <th>Porsi</th>
                      <th>Status</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pagedHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="konfirmasi-empty-state">Belum ada riwayat validasi dari backend.</div>
                        </td>
                      </tr>
                    ) : null}
                    {pagedHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.date)}</td>
                        <td>{item.sppgName}</td>
                        <td>{item.portions.toLocaleString('id-ID')}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="konfirmasi-pagination">
                <button className="konfirmasi-btn konfirmasi-btn-primary" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>
                  Sebelumnya
                </button>
                <span>Halaman {currentPage} / {historyPageCount}</span>
                <button className="konfirmasi-btn konfirmasi-btn-primary" type="button" disabled={currentPage === historyPageCount} onClick={() => setCurrentPage((page) => page + 1)}>
                  Berikutnya
                </button>
              </div>
            </section>
          </main>

          <aside className="konfirmasi-right">
            <section className="konfirmasi-card">
              {selectedDistribusi ? (
                <>
                  <div className="konfirmasi-form-header">
                    <div>
                      <h2>Validasi Distribusi</h2>
                      <div className="konfirmasi-subinfo">
                        {selectedDistribusi.sppgName} - {formatDate(selectedDistribusi.distributionDate)} - {selectedDistribusi.claimedPortions.toLocaleString('id-ID')} porsi
                      </div>
                    </div>
                    <button className="konfirmasi-close-btn" type="button" aria-label="Tutup form" onClick={() => setSelectedDistribusi(null)}>
                      <X aria-hidden="true" />
                    </button>
                  </div>

                  {!showReportForm ? (
                    <form className="konfirmasi-form" onSubmit={handleSubmitValidation}>
                      <label className="konfirmasi-field">
                        <span className="konfirmasi-label">Jumlah Porsi yang Diterima</span>
                        <input
                          className="konfirmasi-input"
                          name="receivedPortions"
                          type="number"
                          min="0"
                          value={formData.receivedPortions}
                          onChange={handleFormChange}
                        />
                        {formErrors.receivedPortions ? <small>{formErrors.receivedPortions}</small> : null}
                      </label>

                      {selectedDifference !== 0 ? (
                        <div className="konfirmasi-warning">
                          <AlertTriangle aria-hidden="true" />
                          Terdapat selisih {Math.abs(selectedDifference).toLocaleString('id-ID')} porsi
                        </div>
                      ) : null}

                      <fieldset className="konfirmasi-field">
                        <legend className="konfirmasi-label">Kualitas Makanan</legend>
                        <div className="konfirmasi-radio-group">
                          <label className="konfirmasi-radio-card">
                            <input type="radio" name="qualityOk" value="true" checked={formData.qualityOk === 'true'} onChange={handleFormChange} />
                            Sesuai standar
                          </label>
                          <label className="konfirmasi-radio-card">
                            <input type="radio" name="qualityOk" value="false" checked={formData.qualityOk === 'false'} onChange={handleFormChange} />
                            Tidak sesuai standar
                          </label>
                        </div>
                        {formErrors.qualityOk ? <small>{formErrors.qualityOk}</small> : null}
                      </fieldset>

                      <label className="konfirmasi-field">
                        <span className="konfirmasi-label">Catatan</span>
                        <textarea
                          className="konfirmasi-textarea"
                          name="notes"
                          value={formData.notes}
                          onChange={handleFormChange}
                          placeholder="Tambahkan catatan jika ada ketidaksesuaian..."
                        />
                      </label>

                      <label className="konfirmasi-upload">
                        <Camera aria-hidden="true" />
                        <span>{formData.file ? formData.file.name : 'Upload foto opsional JPG/PNG maksimal 5MB'}</span>
                        <input type="file" name="file" accept="image/jpeg,image/png" onChange={handleFormChange} hidden />
                      </label>
                      {filePreview ? <img className="konfirmasi-upload-preview" src={filePreview} alt="Preview bukti penerimaan" /> : null}
                      {formErrors.file ? <small className="konfirmasi-field-error">{formErrors.file}</small> : null}

                      {willConflict ? (
                        <div className="konfirmasi-conflict-alert">
                          Validasi ini akan masuk status CONFLICT karena ada selisih porsi atau kualitas tidak sesuai.
                        </div>
                      ) : null}

                      <button className="konfirmasi-btn konfirmasi-btn-success konfirmasi-full-btn" type="submit" disabled={submitLoading === 'validation'}>
                        {submitLoading === 'validation' ? <Loader2 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                        Konfirmasi Diterima
                      </button>
                      <button className="konfirmasi-btn konfirmasi-btn-danger-outline konfirmasi-full-btn" type="button" onClick={() => setShowReportForm(true)}>
                        <MessageSquare aria-hidden="true" />
                        Laporkan Masalah
                      </button>
                    </form>
                  ) : (
                    <form className="konfirmasi-report-form" onSubmit={handleSubmitReport}>
                      <label className="konfirmasi-field">
                        <span className="konfirmasi-label">Kategori</span>
                        <select className="konfirmasi-input" value={reportData.category} onChange={(event) => setReportData((current) => ({ ...current, category: event.target.value }))}>
                          {REPORT_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>{category.label}</option>
                          ))}
                        </select>
                        {reportErrors.category ? <small>{reportErrors.category}</small> : null}
                      </label>
                      <label className="konfirmasi-field">
                        <span className="konfirmasi-label">Pesan</span>
                        <textarea
                          className="konfirmasi-textarea"
                          value={reportData.message}
                          onChange={(event) => setReportData((current) => ({ ...current, message: event.target.value }))}
                          placeholder="Jelaskan masalah yang ditemukan minimal 20 karakter..."
                        />
                        {reportErrors.message ? <small>{reportErrors.message}</small> : null}
                      </label>
                      <button className="konfirmasi-btn konfirmasi-btn-primary konfirmasi-full-btn" type="submit" disabled={submitLoading === 'report'}>
                        {submitLoading === 'report' ? <Loader2 aria-hidden="true" /> : <Send aria-hidden="true" />}
                        Kirim Laporan
                      </button>
                      <button className="konfirmasi-btn konfirmasi-btn-danger-outline konfirmasi-full-btn" type="button" onClick={() => setShowReportForm(false)}>
                        Batal
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <div className="konfirmasi-empty">
                  <ClipboardCheck aria-hidden="true" />
                  <strong>Pilih distribusi untuk divalidasi</strong>
                  <span>Klik tombol Konfirmasi pada daftar pending di panel kiri.</span>
                  {submittedIds.length ? <small>{submittedIds.length} validasi selesai pada sesi ini.</small> : null}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Konfirmasi
