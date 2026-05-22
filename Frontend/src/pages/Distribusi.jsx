import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  Send,
  UploadCloud,
  X,
} from 'lucide-react'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import { apiRequest as requestJson } from '../services/api'
import './Distribusi.css'

const TODAY = new Date().toISOString().slice(0, 10)
const FALLBACK_CAPACITY = 1500
const FALLBACK_PRICE_THRESHOLD = 13000
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png']

const TABS = [
  { value: 'today', label: 'Distribusi Hari Ini' },
  { value: 'create', label: 'Tambah Distribusi Baru' },
  { value: 'proof', label: 'Upload Bukti Foto' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'in_progress', label: 'Proses' },
  { value: 'delivered', label: 'Terkirim' },
  { value: 'failed', label: 'Gagal' },
]

const STATUS_LABELS = {
  in_progress: 'Proses',
  delivered: 'Terkirim',
  failed: 'Gagal',
}

const FALLBACK_SCHOOLS = [
  { id: 101, name: 'SDN Nusantara 01', province: 'Jawa Barat', city: 'Bogor', totalStudents: 420 },
  { id: 102, name: 'SMP Negeri 4 Cibinong', province: 'Jawa Barat', city: 'Bogor', totalStudents: 680 },
  { id: 103, name: 'SDN Merdeka 03', province: 'Jawa Barat', city: 'Depok', totalStudents: 310 },
  { id: 104, name: 'MI Al Amanah', province: 'Jawa Barat', city: 'Bekasi', totalStudents: 250 },
  { id: 105, name: 'SDN Harapan Jaya', province: 'Jawa Barat', city: 'Bekasi', totalStudents: 390 },
  { id: 106, name: 'SMP Pertiwi', province: 'Jawa Barat', city: 'Bandung', totalStudents: 720 },
  { id: 107, name: 'SDN Cendana', province: 'Jawa Barat', city: 'Bandung', totalStudents: 360 },
  { id: 108, name: 'SDN Melati 02', province: 'Jawa Barat', city: 'Cimahi', totalStudents: 280 },
  { id: 109, name: 'SMP Negeri 8', province: 'Jawa Barat', city: 'Cirebon', totalStudents: 640 },
  { id: 110, name: 'SDN Kartini', province: 'Jawa Barat', city: 'Sukabumi', totalStudents: 330 },
  { id: 111, name: 'SDN Diponegoro', province: 'Jawa Tengah', city: 'Semarang', totalStudents: 410 },
  { id: 112, name: 'SMP Negeri 12 Semarang', province: 'Jawa Tengah', city: 'Semarang', totalStudents: 700 },
  { id: 113, name: 'SDN Tunas Bangsa', province: 'Jawa Tengah', city: 'Solo', totalStudents: 290 },
  { id: 114, name: 'MI Nurul Huda', province: 'Jawa Tengah', city: 'Kudus', totalStudents: 260 },
  { id: 115, name: 'SDN Trunojoyo', province: 'Jawa Timur', city: 'Surabaya', totalStudents: 450 },
  { id: 116, name: 'SMP Negeri 5 Surabaya', province: 'Jawa Timur', city: 'Surabaya', totalStudents: 780 },
  { id: 117, name: 'SDN Kenanga', province: 'Jawa Timur', city: 'Malang', totalStudents: 340 },
  { id: 118, name: 'SD Inpres Paotere', province: 'Sulawesi Selatan', city: 'Makassar', totalStudents: 380 },
  { id: 119, name: 'SMP Negeri 3 Denpasar', province: 'Bali', city: 'Denpasar', totalStudents: 610 },
  { id: 120, name: 'SDN Abepura 01', province: 'Papua', city: 'Jayapura', totalStudents: 300 },
]

const FALLBACK_DISTRIBUTIONS = [
  { id: 'fallback-1', schoolId: 101, schoolName: 'SDN Nusantara 01', portions: 420, pricePerPortion: 12000, status: 'in_progress', distributionDate: TODAY, time: '08:10', failureReason: '', hasProof: false, proofUrl: '' },
  { id: 'fallback-2', schoolId: 102, schoolName: 'SMP Negeri 4 Cibinong', portions: 680, pricePerPortion: 12000, status: 'delivered', distributionDate: TODAY, time: '08:35', failureReason: '', hasProof: true, proofUrl: '/storage/demo-proof-1.jpg' },
  { id: 'fallback-3', schoolId: 103, schoolName: 'SDN Merdeka 03', portions: 310, pricePerPortion: 12500, status: 'in_progress', distributionDate: TODAY, time: '09:00', failureReason: '', hasProof: false, proofUrl: '' },
  { id: 'fallback-4', schoolId: 104, schoolName: 'MI Al Amanah', portions: 250, pricePerPortion: 12000, status: 'failed', distributionDate: TODAY, time: '09:20', failureReason: 'Kendaraan distribusi mengalami gangguan.', hasProof: false, proofUrl: '' },
  { id: 'fallback-5', schoolId: 105, schoolName: 'SDN Harapan Jaya', portions: 390, pricePerPortion: 13000, status: 'delivered', distributionDate: TODAY, time: '09:45', failureReason: '', hasProof: true, proofUrl: '/storage/demo-proof-2.jpg' },
  { id: 'fallback-6', schoolId: 106, schoolName: 'SMP Pertiwi', portions: 720, pricePerPortion: 12500, status: 'in_progress', distributionDate: TODAY, time: '10:05', failureReason: '', hasProof: false, proofUrl: '' },
  { id: 'fallback-7', schoolId: 107, schoolName: 'SDN Cendana', portions: 360, pricePerPortion: 12000, status: 'delivered', distributionDate: TODAY, time: '10:35', failureReason: '', hasProof: false, proofUrl: '' },
  { id: 'fallback-8', schoolId: 108, schoolName: 'SDN Melati 02', portions: 280, pricePerPortion: 12000, status: 'in_progress', distributionDate: TODAY, time: '11:00', failureReason: '', hasProof: false, proofUrl: '' },
]

const initialFormData = {
  schoolId: '',
  productionBatchId: '',
  portions: '',
  pricePerPortion: '',
  distributionDate: TODAY,
}

function getStorageItem(key) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
}

function getStoredUser() {
  const rawUser = getStorageItem('mbg.user') || getStorageItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
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

function normalizeDistribution(item) {
  const price = Number(item.pricePerPortion ?? item.price_per_portion ?? 0)
  const portions = Number(item.portions ?? 0)
  const schoolName = item.schoolName || item.school?.name || '-'
  const proofList = Array.isArray(item.proofs) ? item.proofs : []

  return {
    id: item.id,
    schoolId: item.schoolId ?? item.school_id ?? item.school?.id,
    schoolName,
    portions,
    pricePerPortion: price,
    totalCost: Number(item.totalCost ?? item.total_cost ?? portions * price),
    status: item.status || 'in_progress',
    distributionDate: item.distributionDate || item.distribution_date || TODAY,
    time: item.time || formatTime(item.distributionDate || item.createdAt),
    failureReason: item.failureReason || item.failure_reason || '',
    hasProof: item.hasProof ?? proofList.length > 0,
    proofUrl: item.proofUrl || proofList[0]?.file?.fileUrl || '',
  }
}

function normalizeSchool(item) {
  return {
    id: item.id,
    name: item.name || '-',
    province: item.province || item.sppg?.province || '',
    city: item.city || '',
    totalStudents: Number(item.totalStudents || 0),
  }
}

function normalizeProductionBatch(item) {
  return {
    id: item.id,
    productionDate: item.productionDate || item.production_date,
    totalPortions: Number(item.totalPortions ?? item.total_portions ?? 0),
    costPerPortion: Number(item.costPerPortion ?? item.cost_per_portion ?? 0),
    rawMaterialCost: Number(item.rawMaterialCost ?? item.raw_material_cost ?? 0),
    totalCost: Number(item.totalCost ?? item.total_cost ?? 0),
    itemCount: Number(item._count?.items ?? item.items?.length ?? 0),
  }
}

function formatRupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(value) || 0)}`
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

function isFallbackId(id) {
  return String(id).startsWith('fallback-')
}

function StatusBadge({ status }) {
  return <span className={`distribusi-status distribusi-status-${status}`}>{STATUS_LABELS[status] || status}</span>
}

function Distribusi({ onLogout }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(location.pathname.includes('/input') ? 'create' : 'today')
  const [distributions, setDistributions] = useState([])
  const [schools, setSchools] = useState([])
  const [productionBatches, setProductionBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDistribution, setSelectedDistribution] = useState(null)
  const [formData, setFormData] = useState(initialFormData)
  const [formErrors, setFormErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [uploadFiles, setUploadFiles] = useState({})
  const [uploadPreview, setUploadPreview] = useState({})
  const [uploadedStatus, setUploadedStatus] = useState({})
  const [submitLoading, setSubmitLoading] = useState('')
  const [schoolSearch, setSchoolSearch] = useState('')
  const [priceThreshold, setPriceThreshold] = useState(FALLBACK_PRICE_THRESHOLD)
  const [sppgCapacity, setSppgCapacity] = useState(FALLBACK_CAPACITY)
  const [uploadErrors, setUploadErrors] = useState({})
  const fileInputRefs = useRef({})

  const sppgId = storedUser?.sppgId || storedUser?.sppg_id || ''
  const userName = storedUser?.name || storedUser?.email || 'Petugas SPPG'

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchDistributions = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const { data } = await requestJson('/distributions', {
          signal,
          params: {
            date: TODAY,
            status: statusFilter,
            ...(sppgId ? { sppgId } : {}),
            limit: 50,
          },
        })
        const normalized = Array.isArray(data) ? data.map(normalizeDistribution) : []
        setDistributions(normalized.length ? normalized : FALLBACK_DISTRIBUTIONS)
        if (!normalized.length) {
          setError('Data distribusi API kosong. Fallback preview ditampilkan sementara.')
        }
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setDistributions(FALLBACK_DISTRIBUTIONS)
          setError('Data distribusi gagal dimuat dari API. Fallback preview ditampilkan.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [sppgId, statusFilter],
  )

  const fetchSchoolsAndThreshold = useCallback(async (signal) => {
    const schoolResult = requestJson('/schools', {
      signal,
      params: {
        ...(sppgId ? { sppgId } : {}),
        limit: 100,
      },
    })
    const thresholdResult = requestJson('/admin/price-thresholds', {
      signal,
      params: { limit: 1 },
    })
    const sppgResult = sppgId ? requestJson(`/sppg/${sppgId}`, { signal }) : Promise.resolve({ data: null })

    const [schoolsSettled, thresholdSettled, sppgSettled] = await Promise.allSettled([
      schoolResult,
      thresholdResult,
      sppgResult,
    ])

    if (schoolsSettled.status === 'fulfilled' && Array.isArray(schoolsSettled.value.data) && schoolsSettled.value.data.length) {
      setSchools(schoolsSettled.value.data.map(normalizeSchool))
    } else {
      // TODO: Backend /schools saat ini dibatasi pemerintah/admin. Sediakan endpoint sekolah tujuan untuk role SPPG.
      setSchools(FALLBACK_SCHOOLS)
    }

    if (thresholdSettled.status === 'fulfilled' && Array.isArray(thresholdSettled.value.data) && thresholdSettled.value.data[0]) {
      const maxPrice = Number(thresholdSettled.value.data[0].maxPrice || thresholdSettled.value.data[0].max_price)
      setPriceThreshold(Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : FALLBACK_PRICE_THRESHOLD)
    } else {
      // TODO: Sediakan endpoint threshold wilayah yang bisa dibaca role SPPG.
      setPriceThreshold(FALLBACK_PRICE_THRESHOLD)
    }

    if (sppgSettled.status === 'fulfilled' && sppgSettled.value.data?.capacity) {
      setSppgCapacity(Number(sppgSettled.value.data.capacity) || FALLBACK_CAPACITY)
    }
  }, [sppgId])

  const fetchProductionBatches = useCallback(async (signal) => {
    try {
      const { data } = await requestJson('/production-batches', {
        signal,
        params: {
          date: formData.distributionDate || TODAY,
          ...(sppgId ? { sppgId } : {}),
          limit: 20,
        },
      })
      setProductionBatches(Array.isArray(data) ? data.map(normalizeProductionBatch) : [])
    } catch {
      setProductionBatches([])
    }
  }, [formData.distributionDate, sppgId])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchDistributions(controller.signal))

    return () => controller.abort()
  }, [fetchDistributions])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchSchoolsAndThreshold(controller.signal))

    return () => controller.abort()
  }, [fetchSchoolsAndThreshold])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchProductionBatches(controller.signal))

    return () => controller.abort()
  }, [fetchProductionBatches])

  useEffect(() => {
    return () => {
      Object.values(uploadPreview).forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    }
  }, [uploadPreview])

  const filteredDistributions = useMemo(() => {
    return statusFilter ? distributions.filter((item) => item.status === statusFilter) : distributions
  }, [distributions, statusFilter])

  const uploadTargets = useMemo(() => {
    return distributions.filter((item) => !item.hasProof || selectedDistribution?.id === item.id)
  }, [distributions, selectedDistribution])

  const filteredSchools = useMemo(() => {
    const keyword = schoolSearch.trim().toLowerCase()
    if (!keyword) return schools

    return schools.filter((school) => {
      return [school.name, school.city, school.province].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [schoolSearch, schools])

  const totalPortions = filteredDistributions.reduce((total, item) => total + item.portions, 0)
  const totalCost = filteredDistributions.reduce((total, item) => total + item.totalCost, 0)
  const deliveredCount = filteredDistributions.filter((item) => item.status === 'delivered').length
  const previewTotal = (Number(formData.portions) || 0) * (Number(formData.pricePerPortion) || 0)
  const priceWarning = Number(formData.pricePerPortion) > priceThreshold
  const selectedBatch = productionBatches.find((batch) => String(batch.id) === String(formData.productionBatchId))

  const validateForm = () => {
    const nextErrors = {}
    const portions = Number(formData.portions)
    const price = Number(formData.pricePerPortion)

    if (!formData.schoolId) nextErrors.schoolId = 'Sekolah tujuan wajib dipilih.'
    if (!formData.portions) nextErrors.portions = 'Jumlah porsi wajib diisi.'
    if (formData.portions && (!Number.isFinite(portions) || portions <= 0)) nextErrors.portions = 'Jumlah porsi harus lebih dari 0.'
    if (portions > sppgCapacity) nextErrors.portions = `Jumlah porsi melebihi kapasitas SPPG (${sppgCapacity}).`
    if (!formData.pricePerPortion && !formData.productionBatchId) nextErrors.pricePerPortion = 'Harga per porsi wajib diisi jika belum memilih batch produksi.'
    if (formData.pricePerPortion && (!Number.isFinite(price) || price <= 0)) nextErrors.pricePerPortion = 'Harga harus lebih dari 0.'
    if (!formData.distributionDate) nextErrors.distributionDate = 'Tanggal distribusi wajib diisi.'

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => {
      if (name === 'productionBatchId') {
        const batch = productionBatches.find((item) => String(item.id) === String(value))
        return {
          ...current,
          productionBatchId: value,
          pricePerPortion: batch?.costPerPortion ? String(batch.costPerPortion) : current.pricePerPortion,
        }
      }

      return { ...current, [name]: value }
    })
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setFormErrors({})
    setSchoolSearch('')
  }

  const handleCreateDistribution = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    const selectedSchool = schools.find((school) => String(school.id) === String(formData.schoolId))
    const payload = {
      ...(sppgId ? { sppgId: Number(sppgId) } : {}),
      schoolId: Number(formData.schoolId),
      ...(formData.productionBatchId ? { productionBatchId: Number(formData.productionBatchId) } : {}),
      portions: Number(formData.portions),
      ...(formData.pricePerPortion ? { pricePerPortion: Number(formData.pricePerPortion) } : {}),
      distributionDate: formData.distributionDate,
    }

    setSubmitLoading('create')

    try {
      const { data } = await requestJson('/distributions', {
        method: 'POST',
        body: payload,
      })
      const created = normalizeDistribution(data)
      setDistributions((current) => [created, ...current])
      showToast('success', 'Distribusi berhasil disimpan.')
      resetForm()
      setActiveTab('today')
    } catch (submitError) {
      if (import.meta.env.DEV) {
        const fallbackCreated = {
          id: `fallback-new-${Date.now()}`,
          schoolId: payload.schoolId,
          schoolName: selectedSchool?.name || 'Sekolah',
          portions: payload.portions,
          pricePerPortion: payload.pricePerPortion,
          totalCost: payload.portions * payload.pricePerPortion,
          status: 'in_progress',
          distributionDate: payload.distributionDate,
          time: formatTime(new Date()),
          failureReason: '',
          hasProof: false,
          proofUrl: '',
        }
        setDistributions((current) => [fallbackCreated, ...current])
        showToast('warning', 'API create gagal, fallback development ditambahkan sementara.')
        resetForm()
        setActiveTab('today')
      } else {
        showToast('danger', submitError.message || 'Distribusi gagal disimpan.')
      }
    } finally {
      setSubmitLoading('')
    }
  }

  const openDeliveredModal = (distribution) => {
    setSelectedDistribution(distribution)
    setModalOpen(true)
  }

  const handleConfirmDelivered = async () => {
    if (!selectedDistribution) return
    setSubmitLoading(`status-${selectedDistribution.id}`)

    try {
      if (!isFallbackId(selectedDistribution.id)) {
        await requestJson(`/distributions/${selectedDistribution.id}`, {
          method: 'PUT',
          body: { status: 'delivered' },
        })
      }
      setDistributions((current) => {
        return current.map((item) => (item.id === selectedDistribution.id ? { ...item, status: 'delivered' } : item))
      })
      setModalOpen(false)
      showToast('success', 'Distribusi ditandai terkirim.')
    } catch (statusError) {
      showToast('danger', statusError.message || 'Status gagal diperbarui.')
    } finally {
      setSubmitLoading('')
    }
  }

  const handleUploadShortcut = (distribution) => {
    setSelectedDistribution(distribution)
    setActiveTab('proof')
    window.setTimeout(() => {
      const card = document.getElementById(`upload-card-${distribution.id}`)
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  const validateFile = (file) => {
    if (!file) return 'File wajib dipilih.'
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Format hanya JPG atau PNG.'
    if (file.size > MAX_FILE_SIZE) return 'Ukuran file maksimal 5MB.'
    return ''
  }

  const setUploadFileForDistribution = (distributionId, file) => {
    const validationMessage = validateFile(file)
    if (validationMessage) {
      setUploadErrors((current) => ({ ...current, [distributionId]: validationMessage }))
      return
    }

    setUploadErrors((current) => ({ ...current, [distributionId]: '' }))
    setUploadFiles((current) => ({ ...current, [distributionId]: file }))
    setUploadPreview((current) => {
      if (current[distributionId]) URL.revokeObjectURL(current[distributionId])
      return { ...current, [distributionId]: URL.createObjectURL(file) }
    })
  }

  const handleDrop = (event, distributionId) => {
    event.preventDefault()
    event.currentTarget.classList.remove('distribusi-dropzone-active')
    setUploadFileForDistribution(distributionId, event.dataTransfer.files?.[0])
  }

  const handleUploadSubmit = async (distribution) => {
    const file = uploadFiles[distribution.id]
    const validationMessage = validateFile(file)
    if (validationMessage) {
      setUploadErrors((current) => ({ ...current, [distribution.id]: validationMessage }))
      return
    }

    const controller = new AbortController()
    setSubmitLoading(`upload-${distribution.id}`)

    try {
      if (!isFallbackId(distribution.id)) {
        const uploadedFile = await uploadFile(file, controller.signal)
        await requestJson('/proofs', {
          method: 'POST',
          body: {
            distributionId: Number(distribution.id),
            fileId: Number(uploadedFile.id),
          },
          signal: controller.signal,
        })
      }

      setUploadedStatus((current) => ({ ...current, [distribution.id]: 'done' }))
      setDistributions((current) => {
        return current.map((item) => {
          return item.id === distribution.id
            ? { ...item, hasProof: true, proofUrl: uploadPreview[distribution.id] || item.proofUrl }
            : item
        })
      })
      showToast('success', 'Bukti foto berhasil diupload.')
    } catch (uploadError) {
      if (import.meta.env.DEV) {
        setUploadedStatus((current) => ({ ...current, [distribution.id]: 'done' }))
        setDistributions((current) => {
          return current.map((item) => {
            return item.id === distribution.id
              ? { ...item, hasProof: true, proofUrl: uploadPreview[distribution.id] || item.proofUrl }
              : item
          })
        })
        showToast('warning', 'API upload gagal, fallback development menandai foto terupload.')
      } else {
        showToast('danger', uploadError.message || 'Upload bukti gagal.')
      }
    } finally {
      setSubmitLoading('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    window.localStorage.removeItem('mbg.accessToken')
    window.localStorage.removeItem('mbg.user')
    window.sessionStorage.removeItem('mbg.accessToken')
    window.sessionStorage.removeItem('mbg.user')
    navigate('/login')
  }

  return (
    <DashboardLayout
      userRole="sppg"
      userName={userName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={distributions.filter((item) => item.status === 'in_progress').length}
    >
      <div className="distribusi-page">
        <header className="distribusi-header">
          <div>
            <p className="distribusi-subtitle">Operasional SPPG</p>
            <h1 className="distribusi-title">Distribusi Harian</h1>
            <p>Input distribusi, update status terkirim, dan unggah bukti foto sesuai alur SDD MBG.</p>
          </div>
          <button className="distribusi-btn distribusi-btn-secondary" type="button" onClick={() => fetchDistributions(new AbortController().signal)}>
            <RefreshCcw aria-hidden="true" />
            Muat Ulang
          </button>
        </header>

        {toast ? (
          <div className={`distribusi-toast distribusi-toast-${toast.type === 'success' ? 'success' : 'danger'} ${toast.type === 'warning' ? 'distribusi-toast-warning' : ''}`}>
            {toast.message}
          </div>
        ) : null}

        {error ? (
          <div className="distribusi-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="distribusi-tabs" role="tablist" aria-label="Tab distribusi SPPG">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={`distribusi-tab ${activeTab === tab.value ? 'distribusi-tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'today' ? (
          <section className="distribusi-card">
            <div className="distribusi-filter-row">
              <label className="distribusi-field">
                <span className="distribusi-label">Filter Status</span>
                <select className="distribusi-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="distribusi-table-note">
                Tanggal: <strong>{formatDate(TODAY)}</strong>
              </div>
            </div>

            {loading ? (
              <div className="distribusi-loading">
                <Loader2 aria-hidden="true" />
                Memuat distribusi...
              </div>
            ) : null}

            <div className="distribusi-table-wrap">
              <table className="distribusi-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Sekolah Tujuan</th>
                    <th>Porsi</th>
                    <th>Harga/Porsi</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDistributions.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.schoolName}</strong>
                        <span>{formatDate(item.distributionDate)} - {item.time}</span>
                      </td>
                      <td>{item.portions.toLocaleString('id-ID')}</td>
                      <td>{formatRupiah(item.pricePerPortion)}</td>
                      <td>{formatRupiah(item.totalCost)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                        {item.status === 'failed' && item.failureReason ? <small>{item.failureReason}</small> : null}
                      </td>
                      <td>
                        <div className="distribusi-action-row">
                          {item.status === 'in_progress' ? (
                            <>
                              <button className="distribusi-btn distribusi-btn-primary" type="button" onClick={() => openDeliveredModal(item)}>
                                <CheckCircle2 aria-hidden="true" />
                                Tandai Terkirim
                              </button>
                              <button className="distribusi-btn distribusi-btn-secondary" type="button" onClick={() => handleUploadShortcut(item)}>
                                <Camera aria-hidden="true" />
                                Upload Foto
                              </button>
                            </>
                          ) : null}
                          {item.status === 'delivered' ? (
                            <>
                              <span className="distribusi-delivered-label">Terkirim</span>
                              <button className="distribusi-btn distribusi-btn-secondary" type="button" onClick={() => handleUploadShortcut(item)}>
                                Lihat Bukti
                              </button>
                            </>
                          ) : null}
                          {item.status === 'failed' ? <span className="distribusi-failed-label">Gagal diproses</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="distribusi-summary">
              <span>Total porsi: <strong>{totalPortions.toLocaleString('id-ID')}</strong></span>
              <span>Total biaya: <strong>{formatRupiah(totalCost)}</strong></span>
              <span>Terkirim: <strong>{deliveredCount}/{filteredDistributions.length}</strong></span>
            </footer>
          </section>
        ) : null}

        {activeTab === 'create' ? (
          <section className="distribusi-card">
            <form className="distribusi-form" onSubmit={handleCreateDistribution}>
              <div className="distribusi-form-grid">
                <label className="distribusi-field distribusi-field-wide">
                  <span className="distribusi-label">Cari Sekolah</span>
                  <span className="distribusi-search-wrap">
                    <Search aria-hidden="true" />
                    <input
                      className="distribusi-input"
                      value={schoolSearch}
                      onChange={(event) => setSchoolSearch(event.target.value)}
                      placeholder="Cari nama sekolah/kota..."
                      type="search"
                    />
                  </span>
                </label>

                <label className="distribusi-field distribusi-field-wide">
                  <span className="distribusi-label">Sekolah Tujuan</span>
                  <select className="distribusi-select" name="schoolId" value={formData.schoolId} onChange={handleFormChange}>
                    <option value="">Pilih sekolah tujuan</option>
                    {filteredSchools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name} - {school.city}
                      </option>
                    ))}
                  </select>
                  {formErrors.schoolId ? <small className="distribusi-field-error">{formErrors.schoolId}</small> : null}
                </label>

                <label className="distribusi-field distribusi-field-wide">
                  <span className="distribusi-label">Production Batch Hari Ini</span>
                  <select className="distribusi-select" name="productionBatchId" value={formData.productionBatchId} onChange={handleFormChange}>
                    <option value="">Tidak pakai batch costing</option>
                    {productionBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        Batch #{batch.id} - {batch.totalPortions.toLocaleString('id-ID')} porsi - {formatRupiah(batch.costPerPortion)}/porsi
                      </option>
                    ))}
                  </select>
                  {selectedBatch ? (
                    <small className="distribusi-helper">
                      Raw material {formatRupiah(selectedBatch.rawMaterialCost)} dari {selectedBatch.itemCount} item. Harga per porsi otomatis dari costing batch.
                    </small>
                  ) : null}
                </label>

                <label className="distribusi-field">
                  <span className="distribusi-label">Jumlah Porsi</span>
                  <input
                    className="distribusi-input"
                    name="portions"
                    type="number"
                    min="1"
                    max={sppgCapacity}
                    value={formData.portions}
                    onChange={handleFormChange}
                    placeholder="Contoh: 450"
                  />
                  {formErrors.portions ? <small className="distribusi-field-error">{formErrors.portions}</small> : null}
                </label>

                <label className="distribusi-field">
                  <span className="distribusi-label">Harga Per Porsi</span>
                  <input
                    className="distribusi-input"
                    name="pricePerPortion"
                    type="number"
                    min="1"
                    value={formData.pricePerPortion}
                    onChange={handleFormChange}
                    placeholder="Rp"
                  />
                  {formErrors.pricePerPortion ? <small className="distribusi-field-error">{formErrors.pricePerPortion}</small> : null}
                </label>

                <label className="distribusi-field">
                  <span className="distribusi-label">Tanggal Distribusi</span>
                  <input
                    className="distribusi-input"
                    name="distributionDate"
                    type="date"
                    value={formData.distributionDate}
                    onChange={handleFormChange}
                  />
                  {formErrors.distributionDate ? <small className="distribusi-field-error">{formErrors.distributionDate}</small> : null}
                </label>

                <div className="distribusi-total-preview">
                  <span>Total Biaya</span>
                  <strong>{formatRupiah(previewTotal)}</strong>
                </div>
              </div>

              {priceWarning ? (
                <div className="distribusi-warning">
                  <AlertTriangle aria-hidden="true" />
                  Harga melebihi batas normal wilayah ini (max {formatRupiah(priceThreshold)})
                </div>
              ) : null}

              <div className="distribusi-action-row">
                <button className="distribusi-btn distribusi-btn-primary" type="submit" disabled={submitLoading === 'create'}>
                  {submitLoading === 'create' ? <Loader2 aria-hidden="true" /> : <Save aria-hidden="true" />}
                  Simpan Distribusi
                </button>
                <button className="distribusi-btn distribusi-btn-secondary" type="button" onClick={resetForm}>
                  Batal
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === 'proof' ? (
          <section className="distribusi-upload-list">
            {uploadTargets.map((item) => (
              <article
                key={item.id}
                id={`upload-card-${item.id}`}
                className={`distribusi-upload-card ${selectedDistribution?.id === item.id ? 'distribusi-upload-card-selected' : ''}`}
              >
                <div className="distribusi-upload-info">
                  <div>
                    <h2>{item.schoolName}</h2>
                    <p>{item.portions.toLocaleString('id-ID')} porsi - {formatDate(item.distributionDate)}</p>
                  </div>
                  <div className={`distribusi-upload-status ${item.hasProof || uploadedStatus[item.id] === 'done' ? 'distribusi-upload-status-done' : 'distribusi-upload-status-empty'}`}>
                    {item.hasProof || uploadedStatus[item.id] === 'done' ? 'Foto terupload ✓' : 'Belum ada foto'}
                  </div>
                </div>

                <div
                  className="distribusi-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRefs.current[item.id]?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') fileInputRefs.current[item.id]?.click()
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.currentTarget.classList.add('distribusi-dropzone-active')
                  }}
                  onDragLeave={(event) => event.currentTarget.classList.remove('distribusi-dropzone-active')}
                  onDrop={(event) => handleDrop(event, item.id)}
                >
                  <UploadCloud aria-hidden="true" />
                  <strong>Tarik foto ke sini atau klik untuk memilih</strong>
                  <span>JPG/PNG maksimal 5MB</span>
                  <input
                    ref={(node) => {
                      fileInputRefs.current[item.id] = node
                    }}
                    type="file"
                    accept="image/jpeg,image/png"
                    hidden
                    onChange={(event) => setUploadFileForDistribution(item.id, event.target.files?.[0])}
                  />
                </div>

                {uploadPreview[item.id] ? (
                  <img className="distribusi-upload-preview" src={uploadPreview[item.id]} alt={`Preview bukti ${item.schoolName}`} />
                ) : null}

                {uploadErrors[item.id] ? <small className="distribusi-field-error">{uploadErrors[item.id]}</small> : null}

                <div className="distribusi-action-row">
                  <button
                    className="distribusi-btn distribusi-btn-primary"
                    type="button"
                    disabled={!uploadFiles[item.id] || submitLoading === `upload-${item.id}`}
                    onClick={() => handleUploadSubmit(item)}
                  >
                    {submitLoading === `upload-${item.id}` ? <Loader2 aria-hidden="true" /> : <Send aria-hidden="true" />}
                    Upload
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {modalOpen && selectedDistribution ? (
          <div className="distribusi-modal-backdrop" role="presentation">
            <div className="distribusi-modal" role="dialog" aria-modal="true" aria-labelledby="distribusi-modal-title">
              <button className="distribusi-modal-close" type="button" aria-label="Tutup modal" onClick={() => setModalOpen(false)}>
                <X aria-hidden="true" />
              </button>
              <h2 id="distribusi-modal-title">Tandai Distribusi Terkirim?</h2>
              <p>
                {selectedDistribution.schoolName}, {selectedDistribution.portions.toLocaleString('id-ID')} porsi,
                tanggal {formatDate(selectedDistribution.distributionDate)}.
              </p>
              <div className="distribusi-action-row">
                <button className="distribusi-btn distribusi-btn-secondary" type="button" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button
                  className="distribusi-btn distribusi-btn-primary"
                  type="button"
                  disabled={submitLoading === `status-${selectedDistribution.id}`}
                  onClick={handleConfirmDelivered}
                >
                  {submitLoading === `status-${selectedDistribution.id}` ? <Loader2 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                  Ya, Tandai Terkirim
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default Distribusi
