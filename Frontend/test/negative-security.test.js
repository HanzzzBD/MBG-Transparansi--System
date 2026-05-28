import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const srcRoot = resolve(import.meta.dirname, '..', 'src')

async function collectSourceFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      await collectSourceFiles(fullPath, files)
    } else if (/\.(jsx|js|tsx|ts)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

describe('negative security frontend guardrails', () => {
  it('does not render backend/user generated text with dangerouslySetInnerHTML', async () => {
    const files = await collectSourceFiles(srcRoot)

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file} should not use dangerouslySetInnerHTML`)
    }
  })

  it('keeps global search rendered through normal React text nodes', async () => {
    const layoutSource = await readFile(resolve(srcRoot, 'layouts/DashboardLayout.jsx'), 'utf8')

    assert.match(layoutSource, /<span className="dashboard-search-result-title">\{item\.title\}<\/span>/)
    assert.match(layoutSource, /<span className="dashboard-search-result-subtitle">\{item\.subtitle\}<\/span>/)
    assert.doesNotMatch(layoutSource, /innerHTML|insertAdjacentHTML/)
  })

  it('resolves backend local storage URLs from the API origin', async () => {
    const apiSource = await readFile(resolve(srcRoot, 'services/api.js'), 'utf8')
    const distribusiSource = await readFile(resolve(srcRoot, 'pages/Distribusi.jsx'), 'utf8')
    const menuSource = await readFile(resolve(srcRoot, 'pages/SppgMenu.jsx'), 'utf8')

    assert.match(apiSource, /export function resolveFileUrl/)
    assert.match(apiSource, /new URL\(API_BASE_URL\)\.origin/)
    assert.match(distribusiSource, /resolveFileUrl\(item\.proofUrl \|\| proofList\[0\]\?\.file\?\.fileUrl \|\| ''\)/)
    assert.match(menuSource, /resolveFileUrl\(photoFile\?\.fileUrl \|\| photoFile\?\.file_url \|\| ''\)/)
  })

  it('uses lazy route imports so heavy pages do not all ship in the initial bundle', async () => {
    const appSource = await readFile(resolve(srcRoot, 'App.jsx'), 'utf8')

    assert.match(appSource, /const Dashboard = lazy\(\(\) => import\('\.\/pages\/Dashboard\.jsx'\)\)/)
    assert.match(appSource, /const PublicPetaSPPG = lazy\(\(\) => import\('\.\/pages\/PublicPetaSPPG\.jsx'\)\)/)
    assert.match(appSource, /const UserManagement = lazy\(\(\) => import\('\.\/pages\/UserManagement\.jsx'\)\)/)
    assert.match(appSource, /<Suspense fallback=\{<RouteFallback \/>\}>[\s\S]*<Routes>/)
    assert.doesNotMatch(appSource, /import Dashboard from '\.\/pages\/Dashboard\.jsx'/)
  })

  it('keeps public map dense markers readable without blocking popups', async () => {
    const mapSource = await readFile(resolve(srcRoot, 'pages/PublicPetaSPPG.jsx'), 'utf8')

    assert.match(mapSource, /function getMarkerBucketSize/)
    assert.match(mapSource, /function getClusterLabel/)
    assert.match(mapSource, /onOpenDetailRef\.current\(selected\)/)
    assert.doesNotMatch(mapSource, /L\.popup\(/)
  })

  it('renders public SPPG menu detail with safe image URLs and item list', async () => {
    const mapSource = await readFile(resolve(srcRoot, 'pages/PublicPetaSPPG.jsx'), 'utf8')

    assert.match(mapSource, /resolveFileUrl\(menuPhoto\.url \|\| menuPhoto\.fileUrl \|\| menuPhoto\.file_url \|\| ''\)/)
    assert.match(mapSource, /className="public-map-menu-photo"/)
    assert.match(mapSource, /menu\.items\.map/)
    assert.match(mapSource, /formatCurrency\(menu\.manualPricePerPortion\)/)
  })
})
