import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distribusiPath = resolve(import.meta.dirname, '..', 'src/pages/Distribusi.jsx')
const appPath = resolve(import.meta.dirname, '..', 'src/App.jsx')
const layoutPath = resolve(import.meta.dirname, '..', 'src/layouts/DashboardLayout.jsx')
const apiPath = resolve(import.meta.dirname, '..', 'src/services/api.js')

describe('PR 4 SPPG operational flow frontend', () => {
  it('removes real-looking fallback rows from Distribusi', async () => {
    const source = await readFile(distribusiPath, 'utf8')

    assert.doesNotMatch(source, /FALLBACK_/)
    assert.doesNotMatch(source, /fallback-new/)
    assert.doesNotMatch(source, /isFallbackId/)
    assert.doesNotMatch(source, /import\.meta\.env\.DEV/)
    assert.doesNotMatch(source, /SDN Nusantara/)
    assert.doesNotMatch(source, /demo-proof/)
    assert.match(source, /Belum ada data distribusi dari backend/)
    assert.match(source, /getAssignedSppgSchools/)
    assert.match(source, /getMyRegionPriceThreshold/)
  })

  it('adds SDD SPPG routes and keeps them SPPG-scoped', async () => {
    const appSource = await readFile(appPath, 'utf8')
    const layoutSource = await readFile(layoutPath, 'utf8')

    for (const route of ['/input-menu', '/laporan-kendala', '/riwayat', '/profil']) {
      assert.match(appSource, new RegExp(`path="${route}"`))
      assert.match(layoutSource, new RegExp(`path: '${route}'`))
    }

    assert.match(appSource, /'\/input-menu': \['sppg'\]/)
    assert.match(appSource, /'\/laporan-kendala': \['sppg'\]/)
    assert.match(appSource, /'\/riwayat': \['sppg', 'sekolah'\]/)
    assert.match(appSource, /'\/profil': \['sppg', 'sekolah'\]/)
    assert.match(appSource, /\['\/dashboard\/menu-harian', '\/input-menu'\]/)
    assert.match(appSource, /\['\/dashboard\/kendala', '\/laporan-kendala'\]/)
    assert.match(layoutSource, /label: 'Distribusi'[\s\S]*path: '\/distribusi'/)
    assert.doesNotMatch(layoutSource, /Input Porsi & Distribusi/)
    assert.doesNotMatch(layoutSource, /Status Distribusi/)
  })

  it('uses explicit frontend API helpers for SPPG assigned schools, threshold, menu, and issues', async () => {
    const apiSource = await readFile(apiPath, 'utf8')

    assert.match(apiSource, /getAssignedSppgSchools = .*'\/sppg\/me\/schools'/)
    assert.match(apiSource, /getMyRegionPriceThreshold = .*'\/price-thresholds\/my-region'/)
    assert.match(apiSource, /createMenu =[\s\S]*apiRequest\('\/menus'/)
    assert.match(apiSource, /getIssues = .*'\/issues'/)
    assert.match(apiSource, /createIssue =[\s\S]*apiRequest\('\/issues'/)
  })
})
