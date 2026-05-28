import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

async function readSource(relativePath) {
  return readFile(resolve(import.meta.dirname, '..', relativePath), 'utf8')
}

describe('PR 2 public feature completeness', () => {
  it('registers public statistics and budget routes without ProtectedRoute', async () => {
    const appSource = await readSource('src/App.jsx')
    const routeLines = appSource.split(/\r?\n/).filter((line) => line.includes('path="/statistik"') || line.includes('path="/anggaran-publik"'))

    assert.match(appSource, /path="\/statistik"\s+element=\{<PublicStatistik \/>/)
    assert.match(appSource, /path="\/anggaran-publik"\s+element=\{<PublicStatistik \/>/)
    assert.equal(routeLines.length, 2)
    routeLines.forEach((line) => {
      assert.doesNotMatch(line, /ProtectedRoute/)
    })
  })

  it('removes landing fallback KPI and marker dummy data', async () => {
    const landingSource = await readSource('src/pages/Landing.jsx')

    assert.doesNotMatch(landingSource, /FALLBACK_SUMMARY|FALLBACK_MARKERS|fallback preview/i)
    assert.doesNotMatch(landingSource, /2847|18432|94\.7|fallback-aceh|fallback-jayapura/)
    assert.match(landingSource, /\/public\/statistics/)
    assert.match(landingSource, /Belum ada lokasi SPPG publik untuk ditampilkan/)
  })

  it('public statistics page uses public endpoints and exposes budget section', async () => {
    const pageSource = await readSource('src/pages/PublicStatistik.jsx')

    assert.match(pageSource, /\/public\/statistics/)
    assert.match(pageSource, /\/public\/budget/)
    assert.match(pageSource, /id="anggaran-publik"/)
    assert.doesNotMatch(pageSource, /localStorage|getStoredUser|mbg\.user|FALLBACK|dummy/i)
  })
})
