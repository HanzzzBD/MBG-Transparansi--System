import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function createStorageMock() {
  const values = new Map()

  return {
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    key(index) {
      return Array.from(values.keys())[index] || null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    get length() {
      return values.size
    },
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

globalThis.window = {
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
}

const { default: useAuthStore } = await import('../src/store/authStore.js')
const { ApiError, apiBlobRequest } = await import('../src/services/api.js')

function resetAuthState() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isRefreshingSession: false,
    isSessionChecked: false,
  })
  localStorageMock.clear()
  sessionStorageMock.clear()
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function blobResponse(body, headers = {}) {
  return new Response(body, {
    status: 200,
    headers,
  })
}

function getAuthorization(headers) {
  return headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization || headers?.authorization || null
}

afterEach(() => {
  globalThis.fetch = undefined
  resetAuthState()
})

describe('auth store hardening', () => {
  it('does not persist access token or user to browser storage after login', () => {
    localStorageMock.setItem('mbg.accessToken', 'legacy-token')
    localStorageMock.setItem('mbg.user', JSON.stringify({ role: 'admin' }))
    localStorageMock.setItem('mbg-auth-storage', JSON.stringify({ state: { token: 'legacy-token' } }))

    useAuthStore.getState().login(
      {
        id: 10,
        name: 'Admin',
        email: 'admin@example.test',
        role: 'admin',
      },
      'memory-token',
    )

    assert.equal(useAuthStore.getState().token, 'memory-token')
    assert.equal(useAuthStore.getState().isAuthenticated, true)
    assert.equal(localStorageMock.getItem('mbg.accessToken'), null)
    assert.equal(localStorageMock.getItem('mbg.user'), null)
    assert.equal(localStorageMock.getItem('mbg-auth-storage'), null)
    assert.equal(sessionStorageMock.getItem('mbg.accessToken'), null)
  })

  it('does not authenticate from stale mbg.user when memory auth is empty', () => {
    localStorageMock.setItem('mbg.user', JSON.stringify({ id: 99, role: 'admin' }))

    useAuthStore.getState().startSessionCheck()
    useAuthStore.getState().finishSessionCheck()

    assert.equal(useAuthStore.getState().user, null)
    assert.equal(useAuthStore.getState().token, null)
    assert.equal(useAuthStore.getState().isAuthenticated, false)
    assert.equal(localStorageMock.getItem('mbg.user'), null)
  })
})

describe('frontend auth storage audit', () => {
  it('does not read localStorage/sessionStorage as role or permission source in app pages/layout', async () => {
    const files = [
      'src/App.jsx',
      'src/layouts/DashboardLayout.jsx',
      'src/pages/Dashboard.jsx',
      'src/pages/Anggaran.jsx',
      'src/pages/AuditLog.jsx',
      'src/pages/Distribusi.jsx',
      'src/pages/ExportData.jsx',
      'src/pages/Konfirmasi.jsx',
      'src/pages/LaporanMasyarakat.jsx',
      'src/pages/LockUnlock.jsx',
      'src/pages/OverrideData.jsx',
      'src/pages/UserManagement.jsx',
    ]

    for (const file of files) {
      const source = await readFile(resolve(import.meta.dirname, '..', file), 'utf8')
      assert.doesNotMatch(source, /localStorage\.getItem|sessionStorage\.getItem|getStoredUser|mbg\.user/)
      assert.doesNotMatch(source, /mbg-auth-storage/)
    }
  })
})

describe('apiBlobRequest refresh flow', () => {
  it('downloads blob with the active memory access token', async () => {
    const calls = []
    useAuthStore.getState().login({ id: 1, email: 'gov@example.test', role: 'pemerintah' }, 'valid-token')
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return blobResponse('pdf-data', {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="report.pdf"',
      })
    }

    const blob = await apiBlobRequest('/exports/1/download')

    assert.equal(calls.length, 1)
    assert.equal(getAuthorization(calls[0].options.headers), 'Bearer valid-token')
    assert.equal(blob.type, 'application/pdf')
    assert.equal(blob.contentDisposition, 'attachment; filename="report.pdf"')
  })

  it('refreshes once after 401 and retries the original blob request', async () => {
    const calls = []
    useAuthStore.getState().login({ id: 1, email: 'gov@example.test', role: 'pemerintah' }, 'expired-token')
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })

      if (calls.length === 1) {
        return jsonResponse({ message: 'Access token has expired.' }, 401)
      }

      if (String(url).endsWith('/auth/refresh')) {
        return jsonResponse({
          status: 'success',
          data: {
            accessToken: 'fresh-token',
            user: { id: 1, email: 'gov@example.test', role: 'pemerintah' },
          },
        })
      }

      return blobResponse('xlsx-data', {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    }

    const blob = await apiBlobRequest('/exports/1/download')

    assert.equal(calls.length, 3)
    assert.equal(String(calls[1].url), '/api/auth/refresh')
    assert.equal(getAuthorization(calls[1].options.headers), null)
    assert.equal(getAuthorization(calls[2].options.headers), 'Bearer fresh-token')
    assert.equal(useAuthStore.getState().token, 'fresh-token')
    assert.match(blob.type, /spreadsheetml/)
  })

  it('clears auth when blob request 401 refresh fails', async () => {
    const calls = []
    useAuthStore.getState().login({ id: 1, email: 'gov@example.test', role: 'pemerintah' }, 'expired-token')
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return jsonResponse({ message: 'Unauthorized' }, 401)
    }

    await assert.rejects(() => apiBlobRequest('/exports/1/download'), ApiError)

    assert.equal(calls.length, 2)
    assert.equal(useAuthStore.getState().user, null)
    assert.equal(useAuthStore.getState().token, null)
    assert.equal(useAuthStore.getState().isAuthenticated, false)
  })

  it('does not enter an infinite retry loop when refreshed blob retry is still 401', async () => {
    const calls = []
    useAuthStore.getState().login({ id: 1, email: 'gov@example.test', role: 'pemerintah' }, 'expired-token')
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })

      if (String(url).endsWith('/auth/refresh')) {
        return jsonResponse({
          status: 'success',
          data: {
            accessToken: 'fresh-token',
            user: { id: 1, email: 'gov@example.test', role: 'pemerintah' },
          },
        })
      }

      return jsonResponse({ message: 'Unauthorized' }, 401)
    }

    await assert.rejects(() => apiBlobRequest('/exports/1/download'), ApiError)

    assert.equal(calls.length, 3)
    assert.equal(calls.filter((call) => String(call.url).endsWith('/auth/refresh')).length, 1)
    assert.equal(useAuthStore.getState().user, null)
    assert.equal(useAuthStore.getState().token, null)
  })
})
