import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const layoutPath = resolve(import.meta.dirname, '..', 'src/layouts/DashboardLayout.jsx')
const apiPath = resolve(import.meta.dirname, '..', 'src/services/api.js')
const appPath = resolve(import.meta.dirname, '..', 'src/App.jsx')

describe('PR 3 dashboard real data polish', () => {
  it('wires topbar global search to backend with debounce and result dropdown', async () => {
    const layoutSource = await readFile(layoutPath, 'utf8')
    const apiSource = await readFile(apiPath, 'utf8')

    assert.match(apiSource, /export const getGlobalSearch = .*apiRequest\('\/search'/)
    assert.match(layoutSource, /getGlobalSearch/)
    assert.match(layoutSource, /setTimeout\(async \(\) => \{[\s\S]*350\)/)
    assert.match(layoutSource, /dashboard-search-dropdown/)
    assert.match(layoutSource, /SEARCH_GROUPS/)
    assert.match(layoutSource, /trimmedSearchQuery\.length < 2/)
  })

  it('uses backend notifications and removes static fake notification copy', async () => {
    const layoutSource = await readFile(layoutPath, 'utf8')
    const apiSource = await readFile(apiPath, 'utf8')

    assert.match(apiSource, /export const getNotifications = .*apiRequest\('\/notifications'/)
    assert.match(layoutSource, /getNotifications/)
    assert.match(layoutSource, /markNotificationAsRead/)
    assert.match(layoutSource, /Belum ada notifikasi/)
    assert.doesNotMatch(layoutSource, /Distribusi baru perlu divalidasi/)
    assert.doesNotMatch(layoutSource, /Ada laporan masyarakat baru/)
    assert.doesNotMatch(layoutSource, /Sistem mendeteksi anomali data/)
  })

  it('enables React Router future flags in BrowserRouter', async () => {
    const appSource = await readFile(appPath, 'utf8')

    assert.match(appSource, /future=\{\{[^}]*v7_relativeSplatPath:\s*true/)
    assert.match(appSource, /future=\{\{[^}]*v7_startTransition:\s*true/)
  })
})
