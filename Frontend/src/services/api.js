import useAuthStore from '../store/authStore.js'

export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

export function isAbortError(error) {
  if (!error) return false

  const name = String(error.name || '')
  const code = String(error.code || '')
  const message = String(error.message || '')

  return (
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    code === 'ERR_CANCELED' ||
    /abort|aborted|cancelled|canceled/i.test(message)
  )
}

function getAccessToken() {
  return useAuthStore.getState().token || null
}

function clearAuthState() {
  useAuthStore.getState().logout()
}

function setAuthSession(user, token) {
  useAuthStore.getState().login(user, token)
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

export function resolveFileUrl(fileUrl) {
  if (!fileUrl) return ''
  if (/^(blob:|data:|https?:\/\/)/i.test(fileUrl)) return fileUrl

  const normalizedFileUrl = normalizePath(fileUrl)
  if (!normalizedFileUrl.startsWith('/storage/')) return normalizedFileUrl

  if (!/^https?:\/\//i.test(API_BASE_URL)) {
    return normalizedFileUrl
  }

  return `${new URL(API_BASE_URL).origin}${normalizedFileUrl}`
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

  setAuthSession(data.user, data.accessToken)
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
        clearAuthState()
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

async function sendBlobRequest(path, options = {}) {
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

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const contentType = response.headers.get('content-type') || blob.type || ''

  if (contentDisposition) {
    Object.defineProperty(blob, 'contentDisposition', {
      value: contentDisposition,
      enumerable: false,
    })
  }

  if (contentType) {
    Object.defineProperty(blob, 'responseContentType', {
      value: contentType,
      enumerable: false,
    })
  }

  return blob
}

export async function apiBlobRequest(path, options = {}) {
  const { skipRefresh = false, ...requestOptions } = options

  try {
    return await sendBlobRequest(path, requestOptions)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !skipRefresh && normalizePath(path) !== '/auth/refresh') {
      try {
        const refreshedToken = await refreshAccessToken()
        return await sendBlobRequest(path, {
          ...requestOptions,
          token: refreshedToken,
        })
      } catch (refreshError) {
        clearAuthState()
        throw refreshError instanceof ApiError
          ? refreshError
          : new ApiError('Session berakhir. Silakan login ulang sebelum mengunduh file.', {
              status: 401,
              code: 'SESSION_REFRESH_FAILED',
              data: refreshError,
            })
      }
    }

    throw error
  }
}

export const loginRequest = (payload) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
    skipRefresh: true,
  })

export const requestPasswordReset = (payload) =>
  apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: payload,
    skipAuth: true,
    skipRefresh: true,
  })

export const resetPassword = (payload) =>
  apiRequest('/auth/reset-password', {
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

export const checkSessionRequest = () =>
  apiRequest('/auth/session', {
    method: 'POST',
    skipAuth: true,
    skipRefresh: true,
  })

export const getCurrentUser = () => apiRequest('/auth/me')

export const getMePermissions = (options = {}) => apiRequest('/me/permissions', options)

export const logoutRequest = () =>
  apiRequest('/auth/logout', {
    method: 'POST',
    skipAuth: true,
    skipRefresh: true,
  })

export const getDashboardSummary = (params) => apiRequest('/analytics/summary', { params })

export const getGlobalSearch = (params, options = {}) => apiRequest('/search', { ...options, params })

const DASHBOARD_SUMMARY_ENDPOINTS = {
  admin: '/dashboard/admin-summary',
  pemerintah: '/dashboard/gov-summary',
  gov: '/dashboard/gov-summary',
  sppg: '/dashboard/sppg-summary',
  sekolah: '/dashboard/school-summary',
}

export const getDashboardRoleSummary = (role, params, options = {}) => {
  const endpoint = DASHBOARD_SUMMARY_ENDPOINTS[role] || DASHBOARD_SUMMARY_ENDPOINTS.pemerintah
  return apiRequest(endpoint, { ...options, params })
}

export const getSppg = (params, options = {}) => apiRequest('/sppg', { ...options, params })

export const getSppgDetail = (id, options = {}) => apiRequest(`/sppg/${id}`, options)

export const getDeletedSppg = (params, options = {}) => apiRequest('/sppg/deleted', { ...options, params })

export const createSppg = (payload) =>
  apiRequest('/sppg', {
    method: 'POST',
    body: payload,
  })

export const updateSppg = (id, payload) =>
  apiRequest(`/sppg/${id}`, {
    method: 'PUT',
    body: payload,
  })

export const updateSppgStatus = (id, status) =>
  apiRequest(`/sppg/${id}/status`, {
    method: 'PATCH',
    body: { status },
  })

export const deleteSppg = (id) =>
  apiRequest(`/sppg/${id}`, {
    method: 'DELETE',
  })

export const restoreSppg = (id) =>
  apiRequest(`/sppg/${id}/restore`, {
    method: 'PATCH',
  })

export const getSppgMapMarkers = (params, options = {}) => apiRequest('/sppg/map-markers', { ...options, params })

export const getSppgOperationalDetail = (id, options = {}) => apiRequest(`/sppg/${id}/detail`, options)

export const getAssignedSppgSchools = (params, options = {}) => apiRequest('/sppg/me/schools', { ...options, params })

export const getMyDapodikSchools = (params, options = {}) => apiRequest('/sppg/me/dapodik-schools', { ...options, params })

export const assignMySppgSchools = (payload, options = {}) =>
  apiRequest('/sppg/me/schools/assign', {
    ...options,
    method: 'POST',
    body: payload,
  })

export const unassignMySppgSchool = (assignmentId, payload = {}, options = {}) =>
  apiRequest(`/sppg/me/schools/${assignmentId}/unassign`, {
    ...options,
    method: 'PATCH',
    body: payload,
  })

export const updateMySppgProfile = (payload, options = {}) =>
  apiRequest('/sppg/me/profile', {
    ...options,
    method: 'PATCH',
    body: payload,
  })

export const updateMySchoolProfile = (payload, options = {}) =>
  apiRequest('/schools/me/profile', {
    ...options,
    method: 'PATCH',
    body: payload,
  })

export const getPublicSppgDetail = (id) => apiRequest(`/public/sppg/${id}`)

export const getSchools = (params, options = {}) => apiRequest('/schools', { ...options, params })

export const getSchoolDetail = (id, options = {}) => apiRequest(`/schools/${id}`, options)

export const getDeletedSchools = (params, options = {}) => apiRequest('/schools/deleted', { ...options, params })

export const createSchool = (payload) =>
  apiRequest('/schools', {
    method: 'POST',
    body: payload,
  })

export const updateSchool = (id, payload) =>
  apiRequest(`/schools/${id}`, {
    method: 'PUT',
    body: payload,
  })

export const deleteSchool = (id) =>
  apiRequest(`/schools/${id}`, {
    method: 'DELETE',
  })

export const restoreSchool = (id) =>
  apiRequest(`/schools/${id}/restore`, {
    method: 'PATCH',
  })

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

export const markDistributionSent = (id) =>
  apiRequest(`/distributions/${id}/mark-sent`, {
    method: 'POST',
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

export const getValidations = (params, options = {}) => apiRequest('/validations', { ...options, params })

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

export const getSchoolReports = (params, options = {}) => apiRequest('/school-reports', { ...options, params })

export const createSchoolReport = (payload) =>
  apiRequest('/school-reports', {
    method: 'POST',
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

export const getPermissions = (options = {}) => apiRequest('/permissions', options)

export const getUserPermissions = (id, options = {}) => apiRequest(`/users/${id}/permissions`, options)

export const grantUserPermission = (id, payload) =>
  apiRequest(`/users/${id}/permissions/grant`, {
    method: 'POST',
    body: payload,
  })

export const denyUserPermission = (id, payload) =>
  apiRequest(`/users/${id}/permissions/deny`, {
    method: 'POST',
    body: payload,
  })

export const revokeUserPermission = (id, payload) =>
  apiRequest(`/users/${id}/permissions/revoke`, {
    method: 'POST',
    body: payload,
  })

export const resetUserPermission = (id, permissionKey) =>
  apiRequest(`/users/${id}/permissions/${encodeURIComponent(permissionKey)}`, {
    method: 'DELETE',
  })

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

export const restoreUser = (id) =>
  apiRequest(`/users/${id}/restore`, {
    method: 'PATCH',
  })

export const getPriceThresholds = (params) => apiRequest('/price-thresholds', { params })

export const getMyRegionPriceThreshold = (options = {}) => apiRequest('/price-thresholds/my-region', options)

export const createMenu = (payload) =>
  apiRequest('/menus', {
    method: 'POST',
    body: payload,
  })

export const validateMenuPrice = (id, payload) =>
  apiRequest(`/menus/${id}/price-validation`, {
    method: 'POST',
    body: payload,
  })

export const getIssues = (params, options = {}) => apiRequest('/issues', { ...options, params })

export const createIssue = (payload) =>
  apiRequest('/issues', {
    method: 'POST',
    body: payload,
  })

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

export const getNotifications = (params, options = {}) => apiRequest('/notifications', { ...options, params })

export const markNotificationAsRead = (id) =>
  apiRequest(`/notifications/${id}/read`, {
    method: 'PUT',
  })

export const markAllNotificationsAsRead = () =>
  apiRequest('/notifications/read-all', {
    method: 'PUT',
  })

export const getFoodPricesLatest = (params) => apiRequest('/food-prices/latest', { params })

export const getMenus = (params, options = {}) => apiRequest('/menus', { ...options, params })

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
