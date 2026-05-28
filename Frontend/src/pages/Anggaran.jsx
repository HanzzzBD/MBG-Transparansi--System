import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import {
  apiRequest as requestJson,
  createExport,
  isAbortError,
  resolveAnomaly as resolveAnomalyLog,
} from '../services/api'
import './Anggaran.css'

const EMPTY_BUDGET_SUMMARY = {
  totalBudgetUsed: 0,
  totalPortions: 0,
  avgPricePerPortion: 0,
  anomalyCount: 0,
  rawMaterialAnomalyCount: 0,
  avgRawMaterialCost: 0,
  savingVsTarget: 0,
  dataSource: 'Belum ada data',
  hasProductionBatchCosting: false,
  hasLegacyDistributionBudget: false,
  note: '',
}

const EMPTY_DATA_TIMESTAMPS = {
  budget: null,
  sp2kp: null,
  anomaly: null,
  productionBatch: null,
}

const BGN_CONFIG_KEYS = {
  banperRegularAmount: 'banper_regular_amount',
  banperSpecialAmount: 'banper_special_amount',
  rawMaterialMinPerPortion: 'raw_material_min_per_portion',
  rawMaterialMaxPerPortion: 'raw_material_max_per_portion',
  operationalMaxPerPortion: 'operational_max_per_portion',
  rentMaxPerPortion: 'rent_max_per_portion',
}

const EMPTY_BGN_INDICATORS = {
  banperRegularAmount: 0,
  banperSpecialAmount: 0,
  rawMaterialMinPerPortion: 0,
  rawMaterialMaxPerPortion: 0,
  operationalMaxPerPortion: 0,
  rentMaxPerPortion: 0,
  loaded: false,
}

const EMPTY_BGN_COMPONENT_STATUS = {
  available: false,
  batchCount: 0,
  totalPortions: 0,
  rawMaterialCost: 0,
  operationalCost: 0,
  packagingCost: 0,
  distributionCost: 0,
  rentCost: 0,
  totalCost: 0,
  rawMaterialCostPerPortion: null,
  operationalCostPerPortion: null,
  totalCostPerPortion: null,
  rentCostPerPortion: null,
  rawMaterialStatus: 'unavailable',
  operationalStatus: 'unavailable',
  banperStatus: 'unavailable',
  rentStatus: 'unavailable',
}

const ANOMALY_TYPE_LABELS = {
  PRICE_ANOMALY: 'Harga Porsi',
  RAW_MATERIAL_PRICE_ANOMALY: 'Bahan Pangan',
}

const BUDGET_EXPORT_DATASETS = [
  'budget_by_region',
  'production_batches',
  'food_prices',
  'anomalies',
]

const BUDGET_EXPORT_ANOMALY_TYPES = [
  'PRICE_ANOMALY',
  'RAW_MATERIAL_PRICE_ANOMALY',
]

function formatRupiah(value) {
  const number = Number(value) || 0
  if (Math.abs(number) >= 1000000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(number / 1000000000)} Miliar`
  }
  if (Math.abs(number) >= 1000000) {
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(number / 1000000)} Juta`
  }
  return `Rp ${new Intl.NumberFormat('id-ID').format(number)}`
}

function formatTanggal(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

function formatTanggalWaktu(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeTimestamp(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function getLatestTimestamp(values) {
  const timestamps = values.map(normalizeTimestamp).filter(Boolean)
  if (!timestamps.length) return null
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function getPriceStatus(row) {
  if (Number(row.avgHarga) > Number(row.thresholdMax)) return 'over'
  if (Number(row.avgHarga) < Number(row.thresholdMin)) return 'under'
  return 'normal'
}

function getStatusLabel(status) {
  if (status === 'over') return 'Di Atas Batas'
  if (status === 'under') return 'Di Bawah Minimum'
  return 'Normal'
}

function sortRows(rows, sortKey, sortDirection) {
  const direction = sortDirection === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const aValue = sortKey === 'status' ? getStatusLabel(getPriceStatus(a)) : a[sortKey]
    const bValue = sortKey === 'status' ? getStatusLabel(getPriceStatus(b)) : b[sortKey]

    if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction
    return String(aValue || '').localeCompare(String(bValue || ''), 'id') * direction
  })
}

function normalizeThresholds(items) {
  if (!Array.isArray(items)) return {}
  return items.reduce((map, item) => {
    map[String(item.province || '').toLowerCase()] = {
      thresholdMin: Number(item.thresholdMin ?? item.minPrice ?? item.min_price) || 0,
      thresholdMax: Number(item.thresholdMax ?? item.maxPrice ?? item.max_price) || 0,
    }
    return map
  }, {})
}

function normalizeProvincePrices(budgetByProvince, thresholds) {
  if (!Array.isArray(budgetByProvince) || !budgetByProvince.length) return []

  return budgetByProvince.map((row) => {
    const threshold = thresholds[String(row.province || '').toLowerCase()] || {}
    return {
      province: row.province || '-',
      minHarga: Number(row.minHarga ?? row.min_price_per_portion) || 0,
      maxHarga: Number(row.maxHarga ?? row.max_price_per_portion) || 0,
      avgHarga: Number(row.avgHarga ?? row.avg_price_per_portion ?? row.avgReferencePrice) || 0,
      thresholdMin: Number(row.thresholdMin ?? row.minPrice ?? threshold.thresholdMin) || 0,
      thresholdMax: Number(row.thresholdMax ?? row.maxPrice ?? threshold.thresholdMax) || 0,
      totalBudget: Number(row.totalBudget ?? row.total_budget ?? row.totalBudgetUsed) || 0,
      totalPortions: Number(row.totalPortions ?? row.total_portions) || 0,
      totalDistributions: Number(row.totalDistributions ?? row.total_distributions) || 0,
      source: row.source || null,
      generatedAt: row.generatedAt || row.generated_at || null,
      createdAt: row.createdAt || row.created_at || null,
      updatedAt: row.updatedAt || row.updated_at || null,
    }
  })
}

function buildLegacyProvinceMap(rows) {
  if (!Array.isArray(rows)) return {}
  return rows.reduce((map, row) => {
    const key = String(row.province || '').toLowerCase()
    if (!key) return map
    map[key] = row
    return map
  }, {})
}

function mergeLegacyProvinceBudget(provinceRows, legacyByProvince) {
  const legacyMap = buildLegacyProvinceMap(legacyByProvince)
  const mergedRows = provinceRows.map((row) => {
    const legacyRow = legacyMap[String(row.province || '').toLowerCase()]
    if (!legacyRow) return row

    return {
      ...row,
      minHarga: Number(row.minHarga) || Number(legacyRow.min_price_per_portion) || 0,
      maxHarga: Number(row.maxHarga) || Number(legacyRow.max_price_per_portion) || 0,
      avgHarga: Number(row.avgHarga) || Number(legacyRow.avg_price_per_portion) || 0,
      totalBudget: Number(row.totalBudget) || Number(legacyRow.total_budget) || 0,
      totalPortions: Number(row.totalPortions) || Number(legacyRow.total_portions) || 0,
      totalDistributions: Number(row.totalDistributions) || Number(legacyRow.total_distributions) || 0,
    }
  })

  const existingKeys = new Set(mergedRows.map((row) => String(row.province || '').toLowerCase()))
  const legacyOnlyRows = Array.isArray(legacyByProvince)
    ? legacyByProvince
        .filter((row) => !existingKeys.has(String(row.province || '').toLowerCase()))
        .map((row) => ({
          province: row.province || '-',
          minHarga: Number(row.min_price_per_portion) || 0,
          maxHarga: Number(row.max_price_per_portion) || 0,
          avgHarga: Number(row.avg_price_per_portion) || 0,
          thresholdMin: 0,
          thresholdMax: 0,
          totalBudget: Number(row.total_budget) || 0,
          totalPortions: Number(row.total_portions) || 0,
          totalDistributions: Number(row.total_distributions) || 0,
          source: null,
          generatedAt: null,
          createdAt: row.created_at || row.createdAt || null,
          updatedAt: row.updated_at || row.updatedAt || null,
        }))
    : []

  return [...mergedRows, ...legacyOnlyRows]
}

function buildUnifiedBudgetSummary(summaryData = {}, legacyBudget = {}, anomalies = []) {
  const legacySummary = legacyBudget?.summary || {}
  const productionTotalBudget = Number(summaryData.total_budget_used ?? summaryData.totalBudgetUsed) || 0
  const productionTotalPortions = Number(summaryData.total_portions ?? summaryData.totalPortions) || 0
  const productionAvgPrice = Number(
    summaryData.avg_cost_per_portion ?? summaryData.avg_price_per_portion ?? summaryData.avgPricePerPortion,
  ) || 0
  const productionBatchCount = Number(summaryData.total_batches ?? summaryData.totalBatches) || 0

  const legacyTotalBudget = Number(legacySummary.total_budget ?? legacySummary.totalBudget) || 0
  const legacyTotalPortions = Number(legacySummary.total_portions ?? legacySummary.totalPortions) || 0
  const legacyAvgPrice = Number(legacySummary.avg_price_per_portion ?? legacySummary.avgPricePerPortion) || 0

  const hasProductionBatchCosting = productionBatchCount > 0 || productionTotalBudget > 0 || productionTotalPortions > 0
  const hasLegacyDistributionBudget = legacyTotalBudget > 0 || legacyTotalPortions > 0
  const usedLegacyTotal = productionTotalBudget <= 0 && legacyTotalBudget > 0
  const usedLegacyPortions = productionTotalPortions <= 0 && legacyTotalPortions > 0
  const usedLegacyAverage = productionAvgPrice <= 0 && legacyAvgPrice > 0

  const totalBudgetUsed = usedLegacyTotal ? legacyTotalBudget : productionTotalBudget
  const totalPortions = usedLegacyPortions ? legacyTotalPortions : productionTotalPortions
  const avgPricePerPortion = usedLegacyAverage
    ? legacyAvgPrice
    : productionAvgPrice || (totalPortions ? totalBudgetUsed / totalPortions : 0)

  let dataSource = 'Belum ada data'
  if (hasProductionBatchCosting && (usedLegacyTotal || usedLegacyPortions || usedLegacyAverage)) {
    dataSource = 'Mixed'
  } else if (hasProductionBatchCosting) {
    dataSource = 'Production Batch'
  } else if (hasLegacyDistributionBudget) {
    dataSource = 'Distribusi Legacy'
  }

  return {
    totalBudgetUsed,
    totalPortions,
    avgPricePerPortion,
    anomalyCount: anomalies.filter((row) => row.anomalyType === 'PRICE_ANOMALY' && !row.isResolved).length || Number(summaryData.price_anomaly_count) || 0,
    rawMaterialAnomalyCount: anomalies.filter((row) => row.anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY' && !row.isResolved).length,
    avgRawMaterialCost: Number(summaryData.avg_raw_material_cost) || 0,
    savingVsTarget: Number(summaryData.savings_vs_target) || 0,
    dataSource,
    hasProductionBatchCosting,
    hasLegacyDistributionBudget,
    note: !hasProductionBatchCosting && hasLegacyDistributionBudget
      ? 'Costing production batch belum tersedia, total realisasi menggunakan data distribusi.'
      : '',
  }
}

function normalizeSpending(byProvince) {
  if (!Array.isArray(byProvince) || !byProvince.length) return []
  return byProvince.slice(0, 10).map((row) => ({
    province: row.province || '-',
    totalSpending: Number(row.totalBudget ?? row.total_budget ?? row.totalBudgetUsed ?? 0),
  }))
}

function getAnomalyTypeLabel(type) {
  return ANOMALY_TYPE_LABELS[type] || type || 'Anomali'
}

function formatReferenceRange(row) {
  if (row.referencePrice) return formatRupiah(row.referencePrice)
  if (row.thresholdMin || row.thresholdMax) return `${formatRupiah(row.thresholdMin)} - ${formatRupiah(row.thresholdMax)}`
  return '-'
}

function normalizeAnomaly(item, thresholdSource = {}) {
  const anomalyType = item.anomalyType || item.anomaly_type || 'PRICE_ANOMALY'
  const distribution = item.distribution || {}
  const distributionSppg = distribution.sppg || {}
  const school = distribution.school || {}
  const batch = item.productionBatch || item.production_batch || {}
  const batchSppg = batch.sppg || {}
  const batchItem = item.productionBatchItem || item.production_batch_item || {}
  const metadata = item.metadata || {}
  const province = distributionSppg.province || batchSppg.province || metadata.province || item.province || '-'
  const threshold = thresholdSource[String(province || '').toLowerCase()] || { thresholdMin: 0, thresholdMax: 0 }
  const distributionPrice = Number(distribution.pricePerPortion ?? distribution.price_per_portion ?? 0)
  const rawActualPrice = Number(metadata.input_price ?? batchItem.unitPrice ?? batchItem.unit_price ?? 0)
  const rawReferencePrice = Number(metadata.market_price ?? batchItem.marketReferencePrice ?? batchItem.market_reference_price ?? 0)
  const actualPrice = anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY' ? rawActualPrice : distributionPrice
  const referencePrice = anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY' ? rawReferencePrice : 0
  const itemName = anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY'
    ? metadata.commodity_name || batchItem.commodityName || batchItem.commodity_name || '-'
    : school.name || item.school_name || '-'

  return {
    id: item.id,
    anomalyType,
    anomalyTypeLabel: getAnomalyTypeLabel(anomalyType),
    sppg: distributionSppg.name || batchSppg.name || item.sppg_name || '-',
    itemName,
    province,
    actualPrice,
    referencePrice,
    thresholdMin: anomalyType === 'PRICE_ANOMALY' ? threshold.thresholdMin : 0,
    thresholdMax: anomalyType === 'PRICE_ANOMALY' ? threshold.thresholdMax : 0,
    differencePercent: Number(metadata.selisih_percent ?? batchItem.priceDifferencePercent ?? batchItem.price_difference_percent ?? 0) || 0,
    description: item.description || '-',
    date: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at || null,
    isResolved: Boolean(item.isResolved ?? item.is_resolved),
  }
}

function normalizeProductionBatch(item) {
  return {
    id: item.id,
    rawMaterialCost: Number(item.rawMaterialCost ?? item.raw_material_cost) || 0,
    operationalCost: Number(item.operationalCost ?? item.operational_cost) || 0,
    packagingCost: Number(item.packagingCost ?? item.packaging_cost) || 0,
    distributionCost: Number(item.distributionCost ?? item.distribution_cost) || 0,
    rentCost: Number(item.rentCost ?? item.rent_cost) || 0,
    totalCost: Number(item.totalCost ?? item.total_cost) || 0,
    costPerPortion: Number(item.costPerPortion ?? item.cost_per_portion) || 0,
    totalPortions: Number(item.totalPortions ?? item.total_portions) || 0,
    createdAt: item.createdAt ?? item.created_at ?? null,
    updatedAt: item.updatedAt ?? item.updated_at ?? null,
  }
}

function buildThresholdMapFromProvincePrices(rows) {
  return rows.reduce((map, row) => {
    map[String(row.province || '').toLowerCase()] = {
      thresholdMin: Number(row.thresholdMin) || 0,
      thresholdMax: Number(row.thresholdMax) || 0,
    }
    return map
  }, {})
}

function getSystemConfigValue(result) {
  const value =
    result?.data?.value ??
    result?.data?.config?.value ??
    result?.config?.value ??
    result?.value

  return Number(value) || 0
}

async function fetchBgnBudgetIndicators(signal) {
  const entries = Object.entries(BGN_CONFIG_KEYS)
  const results = await Promise.allSettled(
    entries.map(([, key]) => requestJson(`/system-configs/${key}`, { signal })),
  )
  const failedResult = results.find((result) => result.status === 'rejected')
  if (failedResult) throw failedResult.reason

  return entries.reduce((config, [field], index) => ({
    ...config,
    [field]: results[index].status === 'fulfilled' ? getSystemConfigValue(results[index].value) : 0,
  }), { ...EMPTY_BGN_INDICATORS, loaded: true })
}

function extractProductionBatchRows(result) {
  const rows = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.data?.items)
      ? result.data.items
      : Array.isArray(result?.items)
        ? result.items
        : []

  return rows.map(normalizeProductionBatch)
}

function extractAnomalyRows(result) {
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.data?.items)) return result.data.items
  if (Array.isArray(result?.items)) return result.items
  return []
}

function getRawMaterialStatus(value, indicators) {
  if (value === null || !indicators.loaded) return 'unavailable'
  if (value < indicators.rawMaterialMinPerPortion) return 'below_min'
  if (value > indicators.rawMaterialMaxPerPortion) return 'above_max'
  return 'normal'
}

function getOperationalStatus(value, indicators) {
  if (value === null || !indicators.loaded) return 'unavailable'
  return value > indicators.operationalMaxPerPortion ? 'over_limit' : 'normal'
}

function getBanperStatus(value, indicators) {
  if (value === null || !indicators.loaded) return 'unavailable'
  if (value <= indicators.banperRegularAmount) return 'within_13000'
  if (value <= indicators.banperSpecialAmount) return 'within_15000'
  return 'over_banper'
}

function buildBgnComponentStatus(batches, indicators) {
  const costingBatches = Array.isArray(batches)
    ? batches.filter((batch) => Number(batch.totalPortions) > 0)
    : []

  if (!costingBatches.length) return EMPTY_BGN_COMPONENT_STATUS

  const totals = costingBatches.reduce((summary, batch) => ({
    batchCount: summary.batchCount + 1,
    totalPortions: summary.totalPortions + batch.totalPortions,
    rawMaterialCost: summary.rawMaterialCost + batch.rawMaterialCost,
    operationalCost: summary.operationalCost + batch.operationalCost,
    packagingCost: summary.packagingCost + batch.packagingCost,
    distributionCost: summary.distributionCost + batch.distributionCost,
    rentCost: summary.rentCost + batch.rentCost,
    totalCost: summary.totalCost + batch.totalCost,
  }), {
    batchCount: 0,
    totalPortions: 0,
    rawMaterialCost: 0,
    operationalCost: 0,
    packagingCost: 0,
    distributionCost: 0,
    rentCost: 0,
    totalCost: 0,
  })

  const rawMaterialCostPerPortion = totals.rawMaterialCost / totals.totalPortions
  const operationalCostPerPortion = totals.operationalCost / totals.totalPortions
  const totalCostPerPortion = totals.totalCost / totals.totalPortions
  const rentCostPerPortion = totals.rentCost / totals.totalPortions

  return {
    ...totals,
    available: true,
    rawMaterialCostPerPortion,
    operationalCostPerPortion,
    totalCostPerPortion,
    rentCostPerPortion,
    rawMaterialStatus: getRawMaterialStatus(rawMaterialCostPerPortion, indicators),
    operationalStatus: getOperationalStatus(operationalCostPerPortion, indicators),
    banperStatus: getBanperStatus(totalCostPerPortion, indicators),
    rentStatus: getRentStatus(rentCostPerPortion, indicators),
  }
}

function getRentStatus(value, indicators) {
  if (value === null || !indicators.loaded) return 'unavailable'
  return value > indicators.rentMaxPerPortion ? 'over_limit' : 'normal'
}

function getBgnStatusLabel(status) {
  const labels = {
    below_min: 'Di bawah minimum',
    normal: 'Normal',
    above_max: 'Di atas maksimum',
    over_limit: 'Melebihi batas',
    within_13000: 'Dalam Banper 13k',
    within_15000: 'Dalam Banper 15k',
    over_banper: 'Melebihi Banper',
    unavailable: 'Belum tersedia',
  }
  return labels[status] || 'Belum tersedia'
}

function getAnomalyFilteredRows(rows, anomalyFilter) {
  if (anomalyFilter === 'resolved') return rows.filter((row) => row.isResolved)
  if (anomalyFilter === 'unresolved') return rows.filter((row) => !row.isResolved)
  return rows
}

function isValidDateInput(value) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function compactObject(value) {
  return Object.entries(value).reduce((result, [key, item]) => {
    if (item === undefined || item === null || item === '') return result
    if (Array.isArray(item) && item.length === 0) return result
    result[key] = item
    return result
  }, {})
}

function getFriendlyExportError(error) {
  const message = String(error?.message || '')
  if (!message) return 'Export gagal diproses.'
  if (/invalid.*date|date.*invalid/i.test(message)) return 'Filter tanggal export tidak valid.'
  if (/prisma|stack|trace|\\n/i.test(message)) return 'Export gagal diproses backend.'
  return message
}

function buildDataTimestamps({ summaryData = {}, legacyBudget = {}, provinceRows = [], anomalies = [], productionBatches = [] }) {
  const legacySummary = legacyBudget.summary || {}
  return {
    budget: getLatestTimestamp([
      summaryData.updatedAt,
      summaryData.updated_at,
      summaryData.generatedAt,
      summaryData.generated_at,
      summaryData.createdAt,
      summaryData.created_at,
      legacyBudget.updatedAt,
      legacyBudget.updated_at,
      legacyBudget.generatedAt,
      legacyBudget.generated_at,
      legacySummary.updatedAt,
      legacySummary.updated_at,
      legacySummary.generatedAt,
      legacySummary.generated_at,
    ]),
    sp2kp: getLatestTimestamp(provinceRows.flatMap((row) => [row.generatedAt, row.updatedAt, row.createdAt])),
    anomaly: getLatestTimestamp(anomalies.flatMap((row) => [row.updatedAt, row.date])),
    productionBatch: getLatestTimestamp(productionBatches.flatMap((row) => [row.updatedAt, row.createdAt])),
  }
}

function getTimestampLabel(timestamps) {
  const entries = [
    ['Budget', timestamps.budget],
    ['SP2KP', timestamps.sp2kp],
    ['Anomali', timestamps.anomaly],
    ['Batch', timestamps.productionBatch],
  ]
    .map(([label, value]) => [label, formatTanggalWaktu(value)])
    .filter(([, value]) => value)

  if (!entries.length) return 'Timestamp data tidak tersedia'
  return entries.map(([label, value]) => `${label}: ${value}`).join(' | ')
}

function SortIcon({ active, direction }) {
  if (!active) return null
  return direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />
}

function Anggaran({ userRole, userName, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const resolvedRole = userRole || 'pemerintah'
  const displayName = userName || 'Pengguna MBG'
  const [budgetSummary, setBudgetSummary] = useState(EMPTY_BUDGET_SUMMARY)
  const [bgnIndicators, setBgnIndicators] = useState(EMPTY_BGN_INDICATORS)
  const [bgnComponentStatus, setBgnComponentStatus] = useState(EMPTY_BGN_COMPONENT_STATUS)
  const [dataTimestamps, setDataTimestamps] = useState(EMPTY_DATA_TIMESTAMPS)
  const [provincePrices, setProvincePrices] = useState([])
  const [spendingData, setSpendingData] = useState([])
  const [anomalyRows, setAnomalyRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('avgHarga')
  const [sortDirection, setSortDirection] = useState('desc')
  const [anomalyFilter, setAnomalyFilter] = useState('unresolved')
  const [anomalyExpanded, setAnomalyExpanded] = useState(true)
  const [exportLoading, setExportLoading] = useState('')
  const [resolvingAnomalyId, setResolvingAnomalyId] = useState('')
  const [toast, setToast] = useState(null)

  const isAdmin = resolvedRole === 'admin'
  const timestampLabel = useMemo(() => getTimestampLabel(dataTimestamps), [dataTimestamps])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3400)
  }, [])

  const fetchBudgetData = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')

      try {
        const [
          summaryResult,
          provinceResult,
          anomalyResult,
          anomalyLogResult,
          legacyBudgetResult,
          bgnIndicatorsResult,
          productionBatchResult,
        ] = await Promise.allSettled([
          requestJson('/analytics/budget-summary', { signal }),
          requestJson('/analytics/price-per-province', { signal }),
          requestJson('/analytics/price-anomalies', { signal, params: { limit: 50 } }),
          requestJson('/anomaly-logs', { signal, params: { limit: 100 } }),
          requestJson('/analytics/budget', { signal }),
          fetchBgnBudgetIndicators(signal),
          requestJson('/production-batches', { signal, params: { limit: 100 } }),
        ])

        const summaryData = summaryResult.status === 'fulfilled' ? summaryResult.value.data || {} : {}
        const provinceApiRows = provinceResult.status === 'fulfilled' ? provinceResult.value.data : []
        const legacyBudget = legacyBudgetResult.status === 'fulfilled' ? legacyBudgetResult.value.data || {} : {}
        const nextBgnIndicators = bgnIndicatorsResult.status === 'fulfilled'
          ? bgnIndicatorsResult.value
          : EMPTY_BGN_INDICATORS
        const productionBatches = productionBatchResult.status === 'fulfilled'
          ? extractProductionBatchRows(productionBatchResult.value)
          : []
        const normalizedProvinceRows = normalizeProvincePrices(
          Array.isArray(provinceApiRows) && provinceApiRows.length ? provinceApiRows : legacyBudget.byProvince,
          normalizeThresholds(provinceApiRows),
        )
        const provinceRows = mergeLegacyProvinceBudget(normalizedProvinceRows, legacyBudget.byProvince)
        const thresholds = buildThresholdMapFromProvincePrices(provinceRows)
        const anomalyApiRows = anomalyLogResult.status === 'fulfilled'
          ? extractAnomalyRows(anomalyLogResult.value).filter((item) => (
              ['PRICE_ANOMALY', 'RAW_MATERIAL_PRICE_ANOMALY'].includes(item.anomalyType || item.anomaly_type)
            ))
          : anomalyResult.status === 'fulfilled'
            ? extractAnomalyRows(anomalyResult.value)
            : []
        const anomalies = anomalyApiRows.map((item) => normalizeAnomaly(item, thresholds))

        setBudgetSummary(buildUnifiedBudgetSummary(summaryData, legacyBudget, anomalies))
        setBgnIndicators(nextBgnIndicators)
        setBgnComponentStatus(buildBgnComponentStatus(productionBatches, nextBgnIndicators))
        setDataTimestamps(buildDataTimestamps({
          summaryData,
          legacyBudget,
          provinceRows,
          anomalies,
          productionBatches,
        }))
        setProvincePrices(provinceRows)
        setSpendingData(normalizeSpending(provinceRows))
        setAnomalyRows(anomalies)

        const hasNonAbortPartialFailure = [summaryResult, provinceResult, anomalyResult, anomalyLogResult, bgnIndicatorsResult, productionBatchResult].some((result) => (
          result.status === 'rejected' && !isAbortError(result.reason)
        ))
        if (hasNonAbortPartialFailure) {
          setError('Sebagian data anggaran gagal dimuat dari API.')
        }
      } catch (fetchError) {
        if (!isAbortError(fetchError)) {
          setBudgetSummary(EMPTY_BUDGET_SUMMARY)
          setBgnIndicators(EMPTY_BGN_INDICATORS)
          setBgnComponentStatus(EMPTY_BGN_COMPONENT_STATUS)
          setDataTimestamps(EMPTY_DATA_TIMESTAMPS)
          setProvincePrices([])
          setSpendingData([])
          setAnomalyRows([])
          setError('Data anggaran gagal dimuat dari API.')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => fetchBudgetData(controller.signal))

    return () => controller.abort()
  }, [fetchBudgetData])

  const sortedProvincePrices = useMemo(
    () => sortRows(provincePrices, sortKey, sortDirection),
    [provincePrices, sortDirection, sortKey],
  )
  const filteredAnomalyRows = useMemo(
    () => getAnomalyFilteredRows(anomalyRows, anomalyFilter),
    [anomalyFilter, anomalyRows],
  )
  const exportQueryFilters = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      dateFrom: params.get('dateFrom') || params.get('start_date') || '',
      dateTo: params.get('dateTo') || params.get('end_date') || '',
      province: params.get('province') || '',
      status: params.get('status') || '',
      anomalyType: params.get('anomalyType') || params.get('anomaly_type') || '',
    }
  }, [location.search])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const handleResolve = async (row) => {
    if (!isAdmin || row.isResolved || resolvingAnomalyId) return

    setResolvingAnomalyId(row.id)
    try {
      if (!String(row.id).startsWith('anomaly-')) {
        await resolveAnomalyLog(row.id, {
          isResolved: true,
          reason: 'Ditandai selesai dari halaman Transparansi Anggaran',
        })
      }
      setAnomalyRows((current) => current.map((item) => (item.id === row.id ? { ...item, isResolved: true } : item)))
      setBudgetSummary((current) => ({
        ...current,
        anomalyCount: row.anomalyType === 'PRICE_ANOMALY' ? Math.max(0, current.anomalyCount - 1) : current.anomalyCount,
        rawMaterialAnomalyCount: row.anomalyType === 'RAW_MATERIAL_PRICE_ANOMALY'
          ? Math.max(0, current.rawMaterialAnomalyCount - 1)
          : current.rawMaterialAnomalyCount,
      }))
      showToast('Anomali berhasil ditandai selesai oleh admin.', 'success')
    } catch (resolveError) {
      showToast(resolveError.message || 'Resolve anomali gagal.', 'danger')
    } finally {
      setResolvingAnomalyId('')
    }
  }

  const handleExport = async (type) => {
    const dateFrom = exportQueryFilters.dateFrom.trim()
    const dateTo = exportQueryFilters.dateTo.trim()
    if (!isValidDateInput(dateFrom) || !isValidDateInput(dateTo)) {
      showToast('Filter tanggal export tidak valid.', 'warning')
      return
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      showToast('Tanggal awal export tidak boleh lebih besar dari tanggal akhir.', 'warning')
      return
    }

    const province = exportQueryFilters.province.trim()
    const status = exportQueryFilters.status.trim() || (anomalyFilter !== 'all' ? anomalyFilter : '')
    const anomalyType = exportQueryFilters.anomalyType.trim()
    const filterParams = compactObject({
      page: 'anggaran',
      exportScope: 'budget_feature',
      datasets: BUDGET_EXPORT_DATASETS,
      datasetModes: {
        budget_by_region: 'detail',
        production_batches: 'detail',
        food_prices: 'detail',
        anomalies: 'detail',
      },
      dateFrom,
      dateTo,
      start_date: dateFrom,
      end_date: dateTo,
      province,
      provinces: province ? [province] : [],
      status,
      anomalyStatus: anomalyFilter,
      anomalyType: anomalyType || BUDGET_EXPORT_ANOMALY_TYPES,
      anomalyTypes: anomalyType ? [anomalyType] : BUDGET_EXPORT_ANOMALY_TYPES,
      sortKey,
      sortDirection,
    })

    setExportLoading(type)
    showToast('Menggenerate laporan...', 'warning')

    try {
      await createExport({
        type,
        filterParams,
      })
      showToast('Laporan anggaran sedang diproses. Buka Riwayat Export untuk mengunduh file.', 'success')
    } catch (exportError) {
      showToast(getFriendlyExportError(exportError), 'danger')
    } finally {
      setExportLoading('')
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    navigate('/login')
  }

  const kpis = [
    { title: 'Total Anggaran Digunakan', value: formatRupiah(budgetSummary.totalBudgetUsed), color: '#0f4c81', icon: Wallet },
    { title: 'Avg Cost Per Portion', value: formatRupiah(budgetSummary.avgPricePerPortion), color: '#0071e4', icon: BarChart3 },
    { title: 'Avg Raw Material Cost', value: formatRupiah(budgetSummary.avgRawMaterialCost), color: '#057a55', icon: ShieldCheck },
    { title: 'Price Anomaly', value: new Intl.NumberFormat('id-ID').format(budgetSummary.anomalyCount), color: '#9b1c1c', icon: Zap },
    { title: 'Raw Material Anomaly', value: new Intl.NumberFormat('id-ID').format(budgetSummary.rawMaterialAnomalyCount), color: '#92400e', icon: AlertTriangle },
  ]

  const bgnReferenceItems = [
    {
      title: 'Tarif Banper',
      value: `${formatRupiah(bgnIndicators.banperRegularAmount)} / ${formatRupiah(bgnIndicators.banperSpecialAmount)}`,
      meta: 'Reguler / khusus per porsi',
    },
    {
      title: 'Biaya Bahan Pangan',
      value: `${formatRupiah(bgnIndicators.rawMaterialMinPerPortion)} - ${formatRupiah(bgnIndicators.rawMaterialMaxPerPortion)}`,
      meta: 'Rentang acuan per porsi',
    },
    {
      title: 'Biaya Operasional',
      value: `Maks. ${formatRupiah(bgnIndicators.operationalMaxPerPortion)}`,
      meta: 'Batas operasional per porsi',
    },
    {
      title: 'Biaya Sewa',
      value: `Maks. ${formatRupiah(bgnIndicators.rentMaxPerPortion)}`,
      meta: 'Batas sewa per porsi',
    },
  ]

  const bgnStatusItems = [
    {
      title: 'Status Bahan Pangan',
      value: bgnComponentStatus.available ? formatRupiah(bgnComponentStatus.rawMaterialCostPerPortion) : 'Belum tersedia',
      status: bgnComponentStatus.rawMaterialStatus,
      meta: bgnComponentStatus.available
        ? `Acuan ${formatRupiah(bgnIndicators.rawMaterialMinPerPortion)} - ${formatRupiah(bgnIndicators.rawMaterialMaxPerPortion)} per porsi`
        : 'Menunggu data ProductionBatch',
    },
    {
      title: 'Status Operasional',
      value: bgnComponentStatus.available ? formatRupiah(bgnComponentStatus.operationalCostPerPortion) : 'Belum tersedia',
      status: bgnComponentStatus.operationalStatus,
      meta: bgnComponentStatus.available
        ? `Batas ${formatRupiah(bgnIndicators.operationalMaxPerPortion)} per porsi`
        : 'Menunggu data ProductionBatch',
    },
    {
      title: 'Status Banper',
      value: bgnComponentStatus.available ? formatRupiah(bgnComponentStatus.totalCostPerPortion) : 'Belum tersedia',
      status: bgnComponentStatus.banperStatus,
      meta: bgnComponentStatus.available
        ? `Banper ${formatRupiah(bgnIndicators.banperRegularAmount)} / ${formatRupiah(bgnIndicators.banperSpecialAmount)} per porsi`
        : 'Menunggu data ProductionBatch',
    },
    {
      title: 'Status Biaya Sewa',
      value: bgnComponentStatus.available ? formatRupiah(bgnComponentStatus.rentCostPerPortion) : 'Belum tersedia',
      status: bgnComponentStatus.rentStatus,
      meta: bgnComponentStatus.available
        ? `Batas ${formatRupiah(bgnIndicators.rentMaxPerPortion)} per porsi`
        : 'Menunggu data ProductionBatch',
    },
  ]

  return (
    <DashboardLayout
      userRole={isAdmin ? 'admin' : 'pemerintah'}
      userName={displayName}
      currentPath={location.pathname}
      onLogout={handleLogout}
      notifCount={anomalyRows.filter((row) => !row.isResolved).length}
    >
      <div className="anggaran-page">
        <header className="anggaran-header">
          <div>
            <p className="anggaran-subtitle">Pemerintah & Admin</p>
            <h1 className="anggaran-title">Transparansi Anggaran MBG</h1>
            <p>Data penggunaan anggaran program Makan Bergizi Gratis seluruh Indonesia</p>
          </div>
          <span className="anggaran-date-badge" title={timestampLabel}>Data diperbarui: {timestampLabel}</span>
        </header>

        {toast ? <div className={`anggaran-toast anggaran-toast-${toast.type}`}>{toast.message}</div> : null}

        {loading ? (
          <div className="anggaran-loading">
            <Loader2 aria-hidden="true" />
            Memuat data anggaran...
          </div>
        ) : null}

        {error ? (
          <div className="anggaran-error">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {!loading ? (
          <section className="anggaran-source-strip" aria-label="Sumber data anggaran">
            <div>
              <span>Sumber Data</span>
              <strong>{budgetSummary.dataSource}</strong>
            </div>
            <div>
              <span>Total Porsi</span>
              <strong>{new Intl.NumberFormat('id-ID').format(budgetSummary.totalPortions)}</strong>
            </div>
            {budgetSummary.note ? <p>{budgetSummary.note}</p> : null}
          </section>
        ) : null}

        <section className="anggaran-section">
          <div className="anggaran-kpi-grid">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <article key={kpi.title} className="anggaran-card" style={{ '--kpi-color': kpi.color }}>
                  <span><Icon aria-hidden="true" /></span>
                  <div>
                    <p>{kpi.title}</p>
                    <strong>{kpi.value}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="anggaran-section anggaran-bgn-reference" aria-labelledby="anggaran-bgn-title">
          <div className="anggaran-section-header">
            <div>
              <h2 id="anggaran-bgn-title" className="anggaran-section-title">Referensi Indikator BGN</h2>
              <p className="anggaran-section-note">Nilai diambil dari system-configs dan siap dipakai untuk status anggaran berikutnya.</p>
            </div>
          </div>
          {bgnIndicators.loaded ? (
            <div className="anggaran-bgn-grid">
              {bgnReferenceItems.map((item) => (
                <article key={item.title} className="anggaran-bgn-item">
                  <p>{item.title}</p>
                  <strong>{item.value}</strong>
                  <span>{item.meta}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="anggaran-empty-note">Konfigurasi indikator BGN belum tersedia dari backend.</p>
          )}
        </section>

        <section className="anggaran-section anggaran-bgn-status" aria-labelledby="anggaran-bgn-status-title">
          <div className="anggaran-section-header">
            <div>
              <h2 id="anggaran-bgn-status-title" className="anggaran-section-title">Status Komponen Anggaran BGN</h2>
              <p className="anggaran-section-note">
                Status dihitung dari costing ProductionBatch. Jika batch kosong, status tidak memakai fallback distribusi.
              </p>
            </div>
          </div>
          <div className="anggaran-bgn-status-summary">
            <div>
              <span>Batch Costing</span>
              <strong>{bgnComponentStatus.available ? new Intl.NumberFormat('id-ID').format(bgnComponentStatus.batchCount) : 'Belum tersedia'}</strong>
            </div>
            <div>
              <span>Porsi Costing</span>
              <strong>{bgnComponentStatus.available ? new Intl.NumberFormat('id-ID').format(bgnComponentStatus.totalPortions) : 'Belum tersedia'}</strong>
            </div>
            <div>
              <span>Total Costing</span>
              <strong>{bgnComponentStatus.available ? formatRupiah(bgnComponentStatus.totalCost) : 'Belum tersedia'}</strong>
            </div>
          </div>
          <div className="anggaran-bgn-status-grid">
            {bgnStatusItems.map((item) => (
              <article key={item.title} className="anggaran-bgn-status-item">
                <div>
                  <p>{item.title}</p>
                  <span className={`anggaran-bgn-badge anggaran-bgn-badge-${item.status}`}>
                    {getBgnStatusLabel(item.status)}
                  </span>
                </div>
                <strong>{item.value}</strong>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="anggaran-section anggaran-section-alt">
          <div className="anggaran-section-header">
            <div className="anggaran-info-wrap">
              <h2 className="anggaran-section-title">Harga Per Porsi per Provinsi</h2>
              <button className="anggaran-info-tooltip" type="button" aria-label="Rata-rata dari semua distribusi bulan ini">
                <Info aria-hidden="true" />
                <span>Rata-rata dari semua distribusi bulan ini</span>
              </button>
            </div>
          </div>

          <div className="anggaran-table-wrap">
            <table className="anggaran-table">
              <thead>
                <tr>
                  {[
                    ['province', 'Provinsi'],
                    ['minHarga', 'Min Harga'],
                    ['maxHarga', 'Max Harga'],
                    ['avgHarga', 'Avg Harga'],
                    ['thresholdMax', 'Threshold'],
                    ['status', 'Status'],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button className="anggaran-sort-btn" type="button" onClick={() => handleSort(key)}>
                        {label}
                        <SortIcon active={sortKey === key} direction={sortDirection} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProvincePrices.map((row) => {
                  const status = getPriceStatus(row)
                  return (
                    <tr key={row.province} className={status === 'over' ? 'anggaran-row-over' : status === 'under' ? 'anggaran-row-under' : ''}>
                      <td>{row.province}</td>
                      <td>{formatRupiah(row.minHarga)}</td>
                      <td>
                        {formatRupiah(row.maxHarga)}
                        {row.maxHarga > row.thresholdMax && status === 'normal' ? <small>Max melewati batas</small> : null}
                      </td>
                      <td>{formatRupiah(row.avgHarga)}</td>
                      <td>
                        {formatRupiah(row.thresholdMin)} - {formatRupiah(row.thresholdMax)}
                        {row.source ? <small>{row.source}{row.generatedAt ? ` - ${formatTanggal(row.generatedAt)}` : ''}</small> : null}
                      </td>
                      <td><span className={`anggaran-status-${status}`}>{getStatusLabel(status)}</span></td>
                    </tr>
                  )
                })}
                {!sortedProvincePrices.length ? (
                  <tr>
                    <td colSpan="6">Belum ada data harga provinsi dari backend.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="anggaran-section">
          <div className="anggaran-section-header">
            <h2 className="anggaran-section-title">Distribusi Total Pengeluaran per Provinsi</h2>
          </div>
          <article className="anggaran-chart-card">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={spendingData} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid stroke="#f4f8fb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `${Number(value) / 1000000000}M`} />
                <YAxis type="category" dataKey="province" width={128} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Bar dataKey="totalSpending" name="Total Pengeluaran" fill="#0f4c81" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {!spendingData.length ? <p>Belum ada data pengeluaran per provinsi dari backend.</p> : null}
          </article>
        </section>

        <section className="anggaran-section anggaran-section-alt">
          <div className="anggaran-anomaly-header">
            <h2 className="anggaran-section-title">{filteredAnomalyRows.length} Anomali Anggaran Terdeteksi</h2>
            <button className="anggaran-collapse-btn" type="button" aria-expanded={anomalyExpanded} onClick={() => setAnomalyExpanded((current) => !current)}>
              {anomalyExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              {anomalyExpanded ? 'Tutup' : 'Buka'}
            </button>
          </div>

          {anomalyExpanded ? (
            <>
              <div className="anggaran-filter-row">
                {[
                  ['unresolved', 'Belum Resolve'],
                  ['resolved', 'Sudah Resolve'],
                  ['all', 'Semua'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`anggaran-filter-btn ${anomalyFilter === value ? 'anggaran-filter-btn-active' : ''}`}
                    type="button"
                    onClick={() => setAnomalyFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="anggaran-table-wrap">
                <table className="anggaran-table">
                  <thead>
                    <tr>
                      <th>Tipe</th>
                      <th>SPPG</th>
                      <th>Region</th>
                      <th>Item / Sekolah</th>
                      <th>Harga Aktual</th>
                      <th>Referensi / Threshold</th>
                      <th>Selisih</th>
                      <th>Deskripsi</th>
                      <th>Tanggal</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalyRows.map((row) => {
                      const priceDiff = row.referencePrice
                        ? row.actualPrice - row.referencePrice
                        : row.actualPrice > row.thresholdMax
                          ? row.actualPrice - row.thresholdMax
                          : row.thresholdMin - row.actualPrice
                      return (
                        <tr key={row.id}>
                          <td><span className={`anggaran-anomaly-type anggaran-anomaly-type-${row.anomalyType}`}>{row.anomalyTypeLabel}</span></td>
                          <td>{row.sppg}</td>
                          <td>{row.province}</td>
                          <td>{row.itemName}</td>
                          <td>{row.actualPrice ? formatRupiah(row.actualPrice) : '-'}</td>
                          <td>{formatReferenceRange(row)}</td>
                          <td>
                            {row.actualPrice
                              ? row.differencePercent
                                ? `${row.differencePercent.toLocaleString('id-ID')}%`
                                : formatRupiah(Math.max(0, priceDiff))
                              : '-'}
                          </td>
                          <td>{row.description}</td>
                          <td>{formatTanggal(row.date || new Date())}</td>
                          <td>
                            <span className={row.isResolved ? 'anggaran-status-normal' : 'anggaran-status-over'}>
                              {row.isResolved ? 'Sudah Resolve' : 'Belum Resolve'}
                            </span>
                          </td>
                          <td>
                            {isAdmin && !row.isResolved ? (
                              <button
                                className="anggaran-resolve-btn"
                                type="button"
                                disabled={resolvingAnomalyId === row.id}
                                onClick={() => handleResolve(row)}
                              >
                                {resolvingAnomalyId === row.id ? <Loader2 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                                {resolvingAnomalyId === row.id ? 'Memproses' : 'Resolve'}
                              </button>
                            ) : (
                              <button className="anggaran-detail-btn" type="button" title={row.isResolved ? 'Ditandai selesai oleh admin' : 'Lihat detail'}>
                                <Eye aria-hidden="true" />
                                Detail
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {!filteredAnomalyRows.length ? (
                      <tr>
                        <td colSpan="11">Belum ada anomali harga porsi atau bahan pangan untuk filter ini.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>

        <section className="anggaran-section">
          <div className="anggaran-export-row">
            <button className="anggaran-btn anggaran-btn-primary" type="button" disabled={Boolean(exportLoading)} onClick={() => handleExport('pdf')}>
              {exportLoading === 'pdf' ? <Loader2 aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Export PDF
            </button>
            <button className="anggaran-btn anggaran-btn-secondary" type="button" disabled={Boolean(exportLoading)} onClick={() => handleExport('excel')}>
              {exportLoading === 'excel' ? <Loader2 aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
              Export Excel
            </button>
            <button className="anggaran-btn anggaran-btn-secondary" type="button" onClick={() => navigate('/export')}>
              <Eye aria-hidden="true" />
              Riwayat Export
            </button>
            <Download aria-hidden="true" className="anggaran-export-icon" />
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Anggaran
