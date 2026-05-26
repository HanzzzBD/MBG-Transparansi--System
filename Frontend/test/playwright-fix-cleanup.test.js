import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const apiPath = resolve(import.meta.dirname, '..', 'src/services/api.js')
const appPath = resolve(import.meta.dirname, '..', 'src/App.jsx')
const loginPath = resolve(import.meta.dirname, '..', 'src/pages/Login.jsx')
const layoutPath = resolve(import.meta.dirname, '..', 'src/layouts/DashboardLayout.jsx')
const distribusiPath = resolve(import.meta.dirname, '..', 'src/pages/Distribusi.jsx')
const sppgHistoryPath = resolve(import.meta.dirname, '..', 'src/pages/SppgHistory.jsx')
const schoolHistoryPath = resolve(import.meta.dirname, '..', 'src/pages/SchoolHistory.jsx')
const dashboardPath = resolve(import.meta.dirname, '..', 'src/pages/Dashboard.jsx')
const anggaranPath = resolve(import.meta.dirname, '..', 'src/pages/Anggaran.jsx')
const exportPath = resolve(import.meta.dirname, '..', 'src/pages/ExportData.jsx')
const auditPath = resolve(import.meta.dirname, '..', 'src/pages/AuditLog.jsx')
const dapodikPath = resolve(import.meta.dirname, '..', 'src/pages/DapodikImport.jsx')
const proofValidPath = resolve(import.meta.dirname, 'fixtures/proof-valid.png')
const proofInvalidPath = resolve(import.meta.dirname, 'fixtures/proof-invalid.txt')

describe('Playwright audit cleanup guardrails', () => {
  it('centralizes abort detection and keeps abort noise out of user-facing error state', async () => {
    const apiSource = await readFile(apiPath, 'utf8')
    const sources = [
      await readFile(distribusiPath, 'utf8'),
      await readFile(sppgHistoryPath, 'utf8'),
      await readFile(schoolHistoryPath, 'utf8'),
      await readFile(exportPath, 'utf8'),
      await readFile(auditPath, 'utf8'),
    ].join('\n')

    assert.match(apiSource, /export function isAbortError/)
    assert.match(apiSource, /AbortError/)
    assert.match(apiSource, /ERR_CANCELED/)
    assert.match(apiSource, /abort\|aborted\|cancelled\|canceled/i)
    assert.match(sources, /isAbortError/)
    assert.doesNotMatch(sources, /setError\([^)]*aborted/i)
    assert.doesNotMatch(sources, /signal is aborted without reason/)
  })

  it('keeps login click submit and logout/session flows testable', async () => {
    const loginSource = await readFile(loginPath, 'utf8')
    const appSource = await readFile(appPath, 'utf8')

    assert.match(loginSource, /<form className="login-form" onSubmit=\{handleSubmit\}/)
    assert.match(loginSource, /<button className="login-submit" type="submit" disabled=\{isLoading\}>/)
    assert.match(appSource, /navigate\('\/login', \{ replace: true \}\)/)
    assert.match(appSource, /let sessionCheckPromise = null/)
    assert.match(appSource, /if \(!sessionCheckPromise\)/)
  })

  it('caches notification fetches and refreshes them intentionally', async () => {
    const layoutSource = await readFile(layoutPath, 'utf8')

    assert.match(layoutSource, /NOTIFICATION_CACHE_TTL_MS/)
    assert.match(layoutSource, /notificationCache/)
    assert.match(layoutSource, /notificationRequest/)
    assert.match(layoutSource, /force = false/)
    assert.match(layoutSource, /loadNotifications\(undefined, \{ force: true \}\)/)
  })

  it('renders dashboard and budget Recharts containers with stable numeric heights', async () => {
    const dashboardSource = await readFile(dashboardPath, 'utf8')
    const anggaranSource = await readFile(anggaranPath, 'utf8')

    assert.doesNotMatch(dashboardSource, /ResponsiveContainer width="100%" height="100%"/)
    assert.doesNotMatch(anggaranSource, /ResponsiveContainer width="100%" height="100%"/)
    assert.match(dashboardSource, /ResponsiveContainer width="100%" height=\{320\}/)
    assert.match(anggaranSource, /ResponsiveContainer width="100%" height=\{320\}/)
  })

  it('includes safe upload proof fixtures for browser E2E', async () => {
    const valid = await stat(proofValidPath)
    const invalid = await stat(proofInvalidPath)

    assert.ok(valid.size > 0)
    assert.ok(valid.size < 1024)
    assert.ok(invalid.size > 0)
    assert.ok(invalid.size < 1024)
  })

  it('uses searchable SPPG selection for Dapodik promote instead of ID/dropdown selection', async () => {
    const dapodikSource = await readFile(dapodikPath, 'utf8')

    assert.match(dapodikSource, /function SppgAutocomplete/)
    assert.match(dapodikSource, /placeholder="Cari nama, kota, provinsi"/)
    assert.match(dapodikSource, /getSppg\(\{[\s\S]*search: search\.trim\(\)/)
    assert.doesNotMatch(dapodikSource, /Pilih dari 100 SPPG pertama/)
    assert.doesNotMatch(dapodikSource, /<span>ID SPPG Tujuan<\/span>/)
  })
})
