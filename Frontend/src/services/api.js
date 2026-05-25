import useAuthStore from '../store/authStore'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

function getAccessToken() {
  return useAuthStore.getState().token || null
}

function normalizePath(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return path.startsWith('/') ? path : `/${path}`
}

function appendQuery(url, params) {
  if (!params || Object.keys(params).length === 0) return url

  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          searchParams.append(key, item)
        }
      })
      return
    }

    searchParams.append(key, value)
  })

  const queryString = searchParams.toString()
  if (!queryString) return url

  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`
}

export function buildApiUrl(path, params) {
  const normalizedPath = normalizePath(path)
  const baseUrl = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${API_BASE_URL}${normalizedPath}`
  return appendQuery(baseUrl, params)
}

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text ? { data: text } : null
}

function getErrorMessage(payload, response) {
  return (
    payload?.message ||
    payload?.error?.message ||
    payload?.error ||
    response.statusText ||
    'Terjadi kesalahan saat menghubungi server.'
  )
}

async function refreshAccessToken() {
  const payload = await apiRequest('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
    skipRefresh: true,
  })
  const data = payload?.data || payload || {}

  if (!data.accessToken || !data.user) {
    throw new ApiError('Refresh session tidak mengembalikan access token.', {
      status: 401,
      code: 'REFRESH_SESSION_INVALID',
      data: payload,
    })
  }

  useAuthStore.getState().login(data.user, data.accessToken)
  return data.accessToken
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    params,
    body,
    headers = {},
    token,
    signal,
    credentials = 'include',
    skipAuth = false,
    skipRefresh = false,
    ...fetchOptions
  } = options

  const requestHeaders = new Headers(headers)
  const accessToken = skipAuth ? null : token ?? getAccessToken()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (accessToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  if (body !== undefined && body !== null && !isFormData && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(path, params), {
    method,
    credentials,
    headers: requestHeaders,
    body: body === undefined || body === null || isFormData ? body : JSON.stringify(body),
    signal,
    ...fetchOptions,
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    if (!skipRefresh && response.status === 401 && normalizePath(path) !== '/auth/refresh') {
      try {
        const refreshedToken = await refreshAccessToken()
        return apiRequest(path, {
          ...options,
          token: refreshedToken,
          skipRefresh: true,
        })
      } catch {
        useAuthStore.getState().logout()
      }
    }

    throw new ApiError(getErrorMessage(payload, response), {
      status: response.status,
      code: payload?.code || payload?.error?.code || 'API_ERROR',
      data: payload,
    })
  }

  return payload
}

export async function apiBlobRequest(path, options = {}) {
  const { params, headers = {}, token, credentials = 'include', skipAuth = false, ...fetchOptions } = options
  const requestHeaders = new Headers(headers)
  const accessToken = skipAuth ? null : token ?? getAccessToken()

  if (accessToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(buildApiUrl(path, params), {
    method: 'GET',
    credentials,
    headers: requestHeaders,
    ...fetchOptions,
  })

  if (!response.ok) {
    const payload = await parseResponse(response).catch(() => null)
    throw new ApiError(getErrorMessage(payload, response), {
      status: response.status,
      code: payload?.code || payload?.error?.code || 'API_ERROR',
      data: payload,
    })
  }

  return response.blob()
}

export const loginRequest = (payload) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
    skipRefresh: true,
  })

export const refreshSessionRequest = () =>
  apiRequest('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
    skipRefresh: true,
  })

export const getCurrentUser = () => apiRequest('/auth/me')

export const logoutRequest = () =>
  apiRequest('/auth/logout', {
    method: 'POST',
    skipAuth: true,
    skipRefresh: true,
  })

export const getDashboardSummary = (params) => apiRequest('/analytics/summary', { params })

const DASHBOARD_SUMMARY_ENDPOINTS = {
  admin: '/dashboard/admin-summary',
  pemerintah: '/dashboard/gov-summary',
  sppg: '/dashboard/sppg-summary',
  sekolah: '/dashboard/school-summary',
}

export const getDashboardRoleSummary = (role, params, options = {}) => {
  const endpoint = DASHBOARD_SUMMARY_ENDPOINTS[role] || DASHBOARD_SUMMARY_ENDPOINTS.pemerintah
  return apiRequest(endpoint, { ...options, params })
}

export const getSppg = (params, options = {}) => apiRequest('/sppg', { ...options, params })

export const getSppgDetail = (id) => apiRequest(`/sppg/${id}`)

export const getSppgMapMarkers = (params, options = {}) => apiRequest('/sppg/map-markers', { ...options, params })

export const getSppgOperationalDetail = (id, options = {}) => apiRequest(`/sppg/${id}/detail`, options)

export const getPublicSppgDetail = (id) => apiRequest(`/public/sppg/${id}`)

export const getSchools = (params, options = {}) => apiRequest('/schools', { ...options, params })

export const getDapodikStagedSchools = (params) => apiRequest('/dapodik/staged-schools', { params })

export const getDapodikStagedSchoolDetail = (id) => apiRequest(`/dapodik/staged-schools/${id}`)

export const importDapodikSchools = (payload) =>
  apiRequest('/dapodik/import-schools', {
    method: 'POST',
    body: payload,
  })

export const promoteDapodikSchool = (id, payload) =>
  apiRequest(`/dapodik/staged-schools/${id}/promote`, {
    method: 'POST',
    body: payload,
  })

export const linkDapodikSchool = (id, payload) =>
  apiRequest(`/dapodik/staged-schools/${id}/link`, {
    method: 'POST',
    body: payload,
  })

export const getDistributions = (params, options = {}) => apiRequest('/distributions', { ...options, params })

export const getDistributionDetail = (id, options = {}) => apiRequest(`/distributions/${id}`, options)

export const getDistributionLockSummary = (options = {}) => apiRequest('/distributions/lock-summary', options)

export const createDistribution = (payload) =>
  apiRequest('/distributions', {
    method: 'POST',
    body: payload,
  })

export const updateDistribution = (id, payload) =>
  apiRequest(`/distributions/${id}`, {
    method: 'PUT',
    body: payload,
  })

export const getProductionBatches = (params, options = {}) => apiRequest('/production-batches', { ...options, params })

export const getProductionBatchDetail = (id, options = {}) => apiRequest(`/production-batches/${id}`, options)

export const createProductionBatch = (payload) =>
  apiRequest('/production-batches', {
    method: 'POST',
    body: payload,
  })

export const createProductionBatchItem = (batchId, payload) =>
  apiRequest(`/production-batches/${batchId}/items`, {
    method: 'POST',
    body: payload,
  })

export const getProductionBatchCostSummary = (batchId, options = {}) =>
  apiRequest(`/production-batches/${batchId}/cost-summary`, options)

export const getProductionBatchAnomalies = (batchId) =>
  apiRequest(`/production-batches/${batchId}/anomalies`)

export const getValidations = (params) => apiRequest('/validations', { params })

export const updateValidation = (id, payload) =>
  apiRequest(`/validations/${id}`, {
    method: 'PATCH',
    body: payload,
  })

export const getPublicReports = (params, options = {}) => apiRequest('/public-reports', { ...options, params })

export const getPublicReportsSummary = (params, options = {}) =>
  apiRequest('/public-reports/summary', { ...options, params })

export const getPublicReportDetail = (id, options = {}) => apiRequest(`/public-reports/${id}`, options)

export const getAnalyticsPublicReportsSummary = (params, options = {}) =>
  apiRequest('/analytics/public-reports-summary', { ...options, params })

export const getAnalyticsPublicReportsTrend = (params, options = {}) =>
  apiRequest('/analytics/public-reports-trend', { ...options, params })

export const getAnalyticsPublicReportsTopRegions = (params, options = {}) =>
  apiRequest('/analytics/public-reports-top-regions', { ...options, params })

export const updatePublicReportStatus = (id, payload) =>
  apiRequest(`/public-reports/${id}/status`, {
    method: 'PATCH',
    body: payload,
  })

export const getAuditLogs = (params, options = {}) => apiRequest('/audit-logs', { ...options, params })

export const getAuditLogsSummary = (params, options = {}) =>
  apiRequest('/audit-logs/summary', { ...options, params })

export const getAuditLogDetail = (id, options = {}) => apiRequest(`/audit-logs/${id}`, options)

export const getExports = (params, options = {}) => apiRequest('/exports', { ...options, params })

export const createExport = (payload) =>
  apiRequest('/exports', {
    method: 'POST',
    body: payload,
  })

export const getExportDetail = (id, options = {}) => apiRequest(`/exports/${id}`, options)

export const retryExport = (id) =>
  apiRequest(`/exports/${id}/retry`, {
    method: 'POST',
  })

export const downloadExport = (id) => apiBlobRequest(`/exports/${id}/download`)

export const getAnomalies = (params) => apiRequest('/anomaly-logs', { params })

export const resolveAnomaly = (id, payload = {}) =>
  apiRequest(`/anomaly-logs/${id}/resolve`, {
    method: 'PATCH',
    body: payload,
  })

export const getUsers = (params, options = {}) => apiRequest('/users', { ...options, params })

export const getRoles = (options = {}) => apiRequest('/roles', options)

export const createUser = (payload) =>
  apiRequest('/users', {
    method: 'POST',
    body: payload,
  })

export const updateUser = (id, payload) =>
  apiRequest(`/users/${id}`, {
    method: 'PATCH',
    body: payload,
  })

export const updateUserStatus = (id, payload) =>
  apiRequest(`/users/${id}`, {
    method: 'PATCH',
    body: payload,
  })

export const deleteUser = (id) =>
  apiRequest(`/users/${id}`, {
    method: 'DELETE',
  })

export const getPriceThresholds = (params) => apiRequest('/price-thresholds', { params })

export const getMonitoringSummary = (options = {}) => apiRequest('/monitoring/summary', options)

export const getMonitoringApis = (options = {}) => apiRequest('/monitoring/apis', options)

export const getMonitoringErrors = (options = {}) => apiRequest('/monitoring/errors', options)

export const getMonitoringSyncSources = (options = {}) => apiRequest('/monitoring/sync-sources', options)

export const testMonitoringApi = (id) =>
  apiRequest(`/monitoring/apis/${id}/test`, {
    method: 'POST',
  })

export const syncMonitoringSource = (id) =>
  apiRequest(`/monitoring/sync-sources/${id}/sync`, {
    method: 'POST',
  })

export const getFoodPricesLatest = (params) => apiRequest('/food-prices/latest', { params })

export const getMenus = (params) => apiRequest('/menus', { params })

export const uploadFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest('/files/upload', {
    method: 'POST',
    body: formData,
  })
}

export const createProof = (payload) =>
  apiRequest('/proofs', {
    method: 'POST',
    body: payload,
  })

export const lockDistribution = (id, payload) =>
  apiRequest(`/distributions/${id}/lock`, {
    method: 'PATCH',
    body: payload,
  })

export const unlockDistribution = (id, payload) =>
  apiRequest(`/distributions/${id}/unlock`, {
    method: 'PATCH',
    body: payload,
  })

export const overrideDistribution = (id, payload) =>
  apiRequest(`/distributions/${id}/override`, {
    method: 'PATCH',
    body: payload,
  })

export default apiRequest
