import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const konfirmasiPath = resolve(import.meta.dirname, '..', 'src/pages/Konfirmasi.jsx')
const appPath = resolve(import.meta.dirname, '..', 'src/App.jsx')
const layoutPath = resolve(import.meta.dirname, '..', 'src/layouts/DashboardLayout.jsx')
const apiPath = resolve(import.meta.dirname, '..', 'src/services/api.js')

describe('PR 5 school validation flow frontend', () => {
  it('removes validation fallback rows from Konfirmasi', async () => {
    const source = await readFile(konfirmasiPath, 'utf8')

    assert.doesNotMatch(source, /FALLBACK_/)
    assert.doesNotMatch(source, /pending-1/)
    assert.doesNotMatch(source, /history-\$\{/)
    assert.doesNotMatch(source, /SPPG Kecamatan/)
    assert.doesNotMatch(source, /fallback development/i)
    assert.doesNotMatch(source, /import\.meta\.env\.DEV/)
    assert.match(source, /Belum ada distribusi yang perlu dikonfirmasi/)
    assert.match(source, /Belum ada riwayat validasi dari backend/)
  })

  it('registers school SDD routes and routes shared pages by role', async () => {
    const appSource = await readFile(appPath, 'utf8')
    const layoutSource = await readFile(layoutPath, 'utf8')

    for (const route of ['/validasi', '/laporan-sekolah', '/riwayat', '/profil']) {
      assert.match(appSource, new RegExp(`path="${route}"`))
    }

    assert.match(appSource, /'\/validasi': \['sekolah'\]/)
    assert.match(appSource, /'\/laporan-sekolah': \['sekolah'\]/)
    assert.match(appSource, /RoleAwareHistory/)
    assert.match(appSource, /RoleAwareProfile/)
    assert.match(appSource, /\['\/konfirmasi', '\/validasi'\]/)
    assert.match(layoutSource, /path: '\/validasi\?mode=konfirmasi'/)
    assert.match(layoutSource, /path: '\/validasi\?mode=validasi'/)
    assert.match(layoutSource, /path: '\/laporan-sekolah'/)
    assert.match(layoutSource, /path: '\/riwayat'/)
    assert.match(layoutSource, /path: '\/profil'/)
  })

  it('uses API helpers for school reports, school profile, and validations without fake data', async () => {
    const apiSource = await readFile(apiPath, 'utf8')

    assert.match(apiSource, /getValidations = .*'\/validations'/)
    assert.match(apiSource, /getSchoolReports = .*'\/school-reports'/)
    assert.match(apiSource, /createSchoolReport =[\s\S]*apiRequest\('\/school-reports'/)
    assert.match(apiSource, /getSchoolDetail = .*apiRequest\(`\/schools\/\$\{id\}`/)
  })
})
