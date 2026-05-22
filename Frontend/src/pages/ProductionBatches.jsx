import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, RefreshCcw, Utensils } from 'lucide-react'
import {
  createProductionBatch,
  createProductionBatchItem,
  getProductionBatchDetail,
  getProductionBatches,
} from '../services/api'
import './ProductionBatches.css'

const TODAY = new Date().toISOString().slice(0, 10)

const FALLBACK_BATCHES = [
  {
    id: 'fallback-batch-1',
    productionDate: TODAY,
    totalPortions: 1250,
    rawMaterialCost: 8750000,
    operationalCost: 1500000,
    packagingCost: 950000,
    distributionCost: 750000,
    totalCost: 11950000,
    costPerPortion: 9560,
    notes: 'Fallback preview ketika API batch kosong.',
    _count: { items: 5, anomalyLogs: 0 },
    sppg: { name: 'SPPG Demo Bandung' },
    items: [
      { id: 'item-1', commodityName: 'Beras Medium', quantity: 180, unit: 'kg', unitPrice: 15000, totalPrice: 2700000 },
      { id: 'item-2', commodityName: 'Daging Ayam Ras', quantity: 110, unit: 'kg', unitPrice: 42000, totalPrice: 4620000 },
    ],
  },
]

const initialBatchForm = {
  sppgId: '',
  productionDate: TODAY,
  totalPortions: '',
  operationalCost: '0',
  packagingCost: '0',
  distributionCost: '0',
  notes: '',
}

const initialItemForm = {
  commodityName: '',
  variantId: '',
  quantity: '',
  unit: 'kg',
  unitPrice: '',
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatRupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(safeNumber(value))}`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function normalizeBatch(item) {
  return {
    ...item,
    productionDate: item.productionDate || item.production_date,
    totalPortions: safeNumber(item.totalPortions ?? item.total_portions),
    rawMaterialCost: safeNumber(item.rawMaterialCost ?? item.raw_material_cost),
    operationalCost: safeNumber(item.operationalCost ?? item.operational_cost),
    packagingCost: safeNumber(item.packagingCost ?? item.packaging_cost),
    distributionCost: safeNumber(item.distributionCost ?? item.distribution_cost),
    totalCost: safeNumber(item.totalCost ?? item.total_cost),
    costPerPortion: safeNumber(item.costPerPortion ?? item.cost_per_portion),
    items: Array.isArray(item.items) ? item.items : [],
    anomalyLogs: Array.isArray(item.anomalyLogs) ? item.anomalyLogs : [],
  }
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback
}

function ProductionBatches({ userRole = 'sppg', userName = 'Petugas SPPG', user }) {
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [filterDate, setFilterDate] = useState(TODAY)
  const [batchForm, setBatchForm] = useState(initialBatchForm)
  const [itemForm, setItemForm] = useState(initialItemForm)
  const [formErrors, setFormErrors] = useState({})
  const [itemErrors, setItemErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  const isAdmin = userRole === 'admin'
  const canCreate = userRole === 'sppg' || isAdmin
  const activeBatch = selectedBatch || batches[0]

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fetchBatches = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const payload = await getProductionBatches({
          date: filterDate,
          limit: 25,
        })
        const rows = Array.isArray(payload.data) ? payload.data.map(normalizeBatch) : []

        if (!rows.length) {
          setBatches(FALLBACK_BATCHES)
          setSelectedBatch(FALLBACK_BATCHES[0])
          setError('Data production batch API kosong. Fallback preview ditampilkan sementara.')
          return
        }

        setBatches(rows)
        setSelectedBatch((current) => rows.find((item) => item.id === current?.id) || rows[0])
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setBatches(FALLBACK_BATCHES)
          setSelectedBatch(FALLBACK_BATCHES[0])
          setError(getErrorMessage(fetchError, 'Production batch gagal dimuat dari backend.'))
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [filterDate],
  )

  const fetchDetail = useCallback(
    async (batchId) => {
      if (!batchId || String(batchId).startsWith('fallback')) return

      setDetailLoading(true)
      try {
        const payload = await getProductionBatchDetail(batchId)
        setSelectedBatch(normalizeBatch(payload.data))
      } catch (detailError) {
        showToast('warning', getErrorMessage(detailError, 'Detail batch belum bisa dimuat.'))
      } finally {
        setDetailLoading(false)
      }
    },
    [showToast],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchBatches(controller.signal))

    return () => controller.abort()
  }, [fetchBatches])

  const costPreview = useMemo(() => {
    const total =
      safeNumber(batchForm.operationalCost) +
      safeNumber(batchForm.packagingCost) +
      safeNumber(batchForm.distributionCost)
    const portions = safeNumber(batchForm.totalPortions)

    return {
      total,
      costPerPortion: portions > 0 ? total / portions : 0,
    }
  }, [batchForm])

  const itemTotalPreview = safeNumber(itemForm.quantity) * safeNumber(itemForm.unitPrice)

  const handleBatchFormChange = (event) => {
    const { name, value } = event.target
    setBatchForm((current) => ({ ...current, [name]: value }))
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: '' }))
  }

  const handleItemFormChange = (event) => {
    const { name, value } = event.target
    setItemForm((current) => ({ ...current, [name]: value }))
    if (itemErrors[name]) setItemErrors((current) => ({ ...current, [name]: '' }))
  }

  const validateBatchForm = () => {
    const nextErrors = {}

    if (isAdmin && !batchForm.sppgId) nextErrors.sppgId = 'Admin wajib mengisi SPPG ID.'
    if (!batchForm.productionDate) nextErrors.productionDate = 'Tanggal produksi wajib diisi.'
    if (!safeNumber(batchForm.totalPortions)) nextErrors.totalPortions = 'Total porsi wajib lebih dari 0.'

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateItemForm = () => {
    const nextErrors = {}

    if (!activeBatch?.id) nextErrors.batch = 'Pilih batch terlebih dahulu.'
    if (String(activeBatch?.id).startsWith('fallback')) nextErrors.batch = 'Fallback batch tidak bisa menerima item baru.'
    if (!itemForm.commodityName.trim()) nextErrors.commodityName = 'Nama bahan baku wajib diisi.'
    if (!safeNumber(itemForm.quantity)) nextErrors.quantity = 'Jumlah wajib lebih dari 0.'
    if (!itemForm.unit.trim()) nextErrors.unit = 'Satuan wajib diisi.'
    if (!safeNumber(itemForm.unitPrice)) nextErrors.unitPrice = 'Harga satuan wajib lebih dari 0.'

    setItemErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCreateBatch = async (event) => {
    event.preventDefault()
    if (!validateBatchForm()) return

    setSubmitLoading('batch')
    try {
      const payload = await createProductionBatch({
        ...(isAdmin ? { sppgId: Number(batchForm.sppgId) } : {}),
        productionDate: batchForm.productionDate,
        totalPortions: Number(batchForm.totalPortions),
        operationalCost: Number(batchForm.operationalCost || 0),
        packagingCost: Number(batchForm.packagingCost || 0),
        distributionCost: Number(batchForm.distributionCost || 0),
        notes: batchForm.notes || null,
      })
      const created = normalizeBatch(payload.data)
      setBatches((current) => [created, ...current.filter((item) => !String(item.id).startsWith('fallback'))])
      setSelectedBatch(created)
      setBatchForm({ ...initialBatchForm, productionDate: batchForm.productionDate })
      showToast('success', 'Production batch berhasil dibuat.')
    } catch (submitError) {
      showToast('danger', getErrorMessage(submitError, 'Gagal membuat production batch.'))
    } finally {
      setSubmitLoading('')
    }
  }

  const handleAddItem = async (event) => {
    event.preventDefault()
    if (!validateItemForm()) return

    setSubmitLoading('item')
    try {
      await createProductionBatchItem(activeBatch.id, {
        commodityName: itemForm.commodityName,
        ...(itemForm.variantId ? { variantId: Number(itemForm.variantId) } : {}),
        quantity: Number(itemForm.quantity),
        unit: itemForm.unit,
        unitPrice: Number(itemForm.unitPrice),
      })
      setItemForm(initialItemForm)
      await fetchDetail(activeBatch.id)
      await fetchBatches()
      showToast('success', 'Bahan baku berhasil ditambahkan dan costing dihitung ulang.')
    } catch (submitError) {
      showToast('danger', getErrorMessage(submitError, 'Gagal menambahkan bahan baku.'))
    } finally {
      setSubmitLoading('')
    }
  }

  return (
    <main className="batch-page">
      <header className="batch-header">
        <div>
          <p className="batch-subtitle">Production Batch & Costing</p>
          <h1 className="batch-title">Batch Produksi Harian</h1>
          <p className="batch-desc">
            Kelola costing produksi nyata SPPG, bahan baku, dan harga per porsi untuk distribusi MBG.
          </p>
        </div>
        <div className="batch-header-actions">
          <span>{userName || user?.name || 'Pengguna'}</span>
          <button className="batch-btn batch-btn-secondary" type="button" onClick={() => fetchBatches()}>
            <RefreshCcw aria-hidden="true" />
            Muat Ulang
          </button>
        </div>
      </header>

      {toast ? <div className={`batch-toast batch-toast-${toast.type}`}>{toast.message}</div> : null}

      {error ? (
        <div className="batch-error">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="batch-filter-card">
        <label className="batch-field">
          <span className="batch-label">Tanggal Produksi</span>
          <input className="batch-input" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </label>
        <p>Backend menjadi sumber utama. Jika API gagal/kosong, preview fallback hanya ditampilkan untuk menjaga halaman tetap hidup.</p>
      </section>

      <div className="batch-layout">
        <section className="batch-card">
          <div className="batch-section-header">
            <h2>Daftar Batch</h2>
            {loading ? <Loader2 className="batch-spin" aria-hidden="true" /> : null}
          </div>

          <div className="batch-list">
            {batches.map((batch) => (
              <button
                key={batch.id}
                className={`batch-list-item ${activeBatch?.id === batch.id ? 'batch-list-item-active' : ''}`}
                type="button"
                onClick={() => {
                  setSelectedBatch(batch)
                  fetchDetail(batch.id)
                }}
              >
                <span>Batch #{batch.id}</span>
                <strong>{formatDate(batch.productionDate)}</strong>
                <small>
                  {batch.totalPortions.toLocaleString('id-ID')} porsi - {formatRupiah(batch.costPerPortion)}/porsi
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="batch-card batch-detail-card">
          <div className="batch-section-header">
            <h2>Ringkasan Costing</h2>
            {detailLoading ? <Loader2 className="batch-spin" aria-hidden="true" /> : null}
          </div>

          {activeBatch ? (
            <>
              <div className="batch-cost-grid">
                <CostItem label="Bahan Baku" value={formatRupiah(activeBatch.rawMaterialCost)} />
                <CostItem label="Operasional" value={formatRupiah(activeBatch.operationalCost)} />
                <CostItem label="Packaging" value={formatRupiah(activeBatch.packagingCost)} />
                <CostItem label="Distribusi" value={formatRupiah(activeBatch.distributionCost)} />
                <CostItem label="Total Cost" value={formatRupiah(activeBatch.totalCost)} highlight />
                <CostItem label="Cost/Porsi" value={formatRupiah(activeBatch.costPerPortion)} highlight />
              </div>

              <div className="batch-table-wrap">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>Bahan Baku</th>
                      <th>Qty</th>
                      <th>Harga Satuan</th>
                      <th>Total</th>
                      <th>Ref Pasar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatch.items?.length ? (
                      activeBatch.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.commodityName || item.commodity_name}</td>
                          <td>
                            {safeNumber(item.quantity).toLocaleString('id-ID')} {item.unit}
                          </td>
                          <td>{formatRupiah(item.unitPrice ?? item.unit_price)}</td>
                          <td>{formatRupiah(item.totalPrice ?? item.total_price)}</td>
                          <td>
                            {item.marketReferencePrice || item.market_reference_price
                              ? formatRupiah(item.marketReferencePrice ?? item.market_reference_price)
                              : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5">Belum ada bahan baku pada batch ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="batch-empty">Belum ada batch untuk tanggal ini.</div>
          )}
        </section>
      </div>

      {canCreate ? (
        <div className="batch-form-grid">
          <section className="batch-card">
            <div className="batch-section-header">
              <h2>Buat Batch Baru</h2>
              <Plus aria-hidden="true" />
            </div>
            <form className="batch-form" onSubmit={handleCreateBatch}>
              {isAdmin ? (
                <label className="batch-field">
                  <span className="batch-label">SPPG ID</span>
                  <input className="batch-input" name="sppgId" value={batchForm.sppgId} onChange={handleBatchFormChange} />
                  {formErrors.sppgId ? <small className="batch-field-error">{formErrors.sppgId}</small> : null}
                </label>
              ) : null}

              <label className="batch-field">
                <span className="batch-label">Tanggal Produksi</span>
                <input className="batch-input" name="productionDate" type="date" value={batchForm.productionDate} onChange={handleBatchFormChange} />
                {formErrors.productionDate ? <small className="batch-field-error">{formErrors.productionDate}</small> : null}
              </label>

              <label className="batch-field">
                <span className="batch-label">Total Porsi</span>
                <input className="batch-input" name="totalPortions" type="number" min="1" value={batchForm.totalPortions} onChange={handleBatchFormChange} />
                {formErrors.totalPortions ? <small className="batch-field-error">{formErrors.totalPortions}</small> : null}
              </label>

              <label className="batch-field">
                <span className="batch-label">Biaya Operasional</span>
                <input className="batch-input" name="operationalCost" type="number" min="0" value={batchForm.operationalCost} onChange={handleBatchFormChange} />
              </label>

              <label className="batch-field">
                <span className="batch-label">Biaya Packaging</span>
                <input className="batch-input" name="packagingCost" type="number" min="0" value={batchForm.packagingCost} onChange={handleBatchFormChange} />
              </label>

              <label className="batch-field">
                <span className="batch-label">Biaya Distribusi</span>
                <input className="batch-input" name="distributionCost" type="number" min="0" value={batchForm.distributionCost} onChange={handleBatchFormChange} />
              </label>

              <label className="batch-field batch-field-wide">
                <span className="batch-label">Catatan</span>
                <textarea className="batch-textarea" name="notes" value={batchForm.notes} onChange={handleBatchFormChange} />
              </label>

              <div className="batch-preview">
                <Utensils aria-hidden="true" />
                <span>Estimasi cost awal tanpa bahan baku</span>
                <strong>{formatRupiah(costPreview.costPerPortion)}/porsi</strong>
              </div>

              <button className="batch-btn batch-btn-primary" type="submit" disabled={submitLoading === 'batch'}>
                {submitLoading === 'batch' ? <Loader2 aria-hidden="true" /> : <Plus aria-hidden="true" />}
                Simpan Batch
              </button>
            </form>
          </section>

          <section className="batch-card">
            <div className="batch-section-header">
              <h2>Tambah Bahan Baku</h2>
              <Plus aria-hidden="true" />
            </div>
            <form className="batch-form" onSubmit={handleAddItem}>
              {itemErrors.batch ? <div className="batch-warning">{itemErrors.batch}</div> : null}

              <label className="batch-field">
                <span className="batch-label">Nama Komoditas</span>
                <input className="batch-input" name="commodityName" value={itemForm.commodityName} onChange={handleItemFormChange} placeholder="Beras Medium" />
                {itemErrors.commodityName ? <small className="batch-field-error">{itemErrors.commodityName}</small> : null}
              </label>

              <label className="batch-field">
                <span className="batch-label">Variant ID SP2KP</span>
                <input className="batch-input" name="variantId" type="number" min="1" value={itemForm.variantId} onChange={handleItemFormChange} placeholder="Opsional" />
              </label>

              <label className="batch-field">
                <span className="batch-label">Quantity</span>
                <input className="batch-input" name="quantity" type="number" min="0" step="0.01" value={itemForm.quantity} onChange={handleItemFormChange} />
                {itemErrors.quantity ? <small className="batch-field-error">{itemErrors.quantity}</small> : null}
              </label>

              <label className="batch-field">
                <span className="batch-label">Satuan</span>
                <input className="batch-input" name="unit" value={itemForm.unit} onChange={handleItemFormChange} />
                {itemErrors.unit ? <small className="batch-field-error">{itemErrors.unit}</small> : null}
              </label>

              <label className="batch-field">
                <span className="batch-label">Harga Satuan</span>
                <input className="batch-input" name="unitPrice" type="number" min="1" value={itemForm.unitPrice} onChange={handleItemFormChange} />
                {itemErrors.unitPrice ? <small className="batch-field-error">{itemErrors.unitPrice}</small> : null}
              </label>

              <div className="batch-preview">
                <span>Total bahan baku</span>
                <strong>{formatRupiah(itemTotalPreview)}</strong>
              </div>

              <button className="batch-btn batch-btn-primary" type="submit" disabled={submitLoading === 'item'}>
                {submitLoading === 'item' ? <Loader2 aria-hidden="true" /> : <Plus aria-hidden="true" />}
                Tambah Item
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function CostItem({ label, value, highlight = false }) {
  return (
    <div className={`batch-cost-item ${highlight ? 'batch-cost-highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default ProductionBatches
