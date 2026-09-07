import { CATALOG_HEADERS, parseCSV, serializeCSV, sortCatalog } from '../shared/catalog.js'

const DEFAULT_REPOSITORY = 'mikemaksimchuk/choir-catalog'
const DEFAULT_BRANCH = 'main'
const DATA_PATH = 'public/data.csv'
const MAX_LENGTHS = {
  'Catalog Number': 40,
  Title: 300,
  Composer: 250,
  Count: 40,
  'Bible Verse Reference': 500,
  'General Liturgical Season': 180,
  'Narrative Lectionary Weeks': 500,
  'Themes / Topics': 1000,
  Parts: 500,
  'Last Performed': 10,
  'Recording Link': 1200,
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sparta-umc-choir-catalog',
  }
}

function repositorySettings() {
  const repository = process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY
  const [owner, repo] = repository.split('/')
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must use the owner/repository format.')
  return { owner, repo, branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH }
}

async function parseGitHubError(response) {
  const result = await response.json().catch(() => ({}))
  if (response.status === 401 || response.status === 403) return 'The catalog repository credentials need attention.'
  if (response.status === 409 || response.status === 422) return 'The catalog changed while this entry was being saved. Refresh the page and try again.'
  return result.message || 'GitHub could not update the catalog.'
}

function normalizeEntry(entry = {}) {
  const normalized = {}
  CATALOG_HEADERS.forEach((header) => {
    normalized[header] = String(entry[header] || '').trim().slice(0, MAX_LENGTHS[header])
  })
  if (!normalized['Catalog Number']) throw new Error('Catalog Number is required.')
  if (!normalized.Title) throw new Error('Title is required.')
  if (normalized['Last Performed'] && !/^\d{4}-\d{2}-\d{2}$/.test(normalized['Last Performed'])) {
    throw new Error('Last Performed must be a valid date.')
  }
  if (normalized['Recording Link']) {
    let url
    try { url = new URL(normalized['Recording Link']) } catch { throw new Error('Recording Link must be a valid web address.') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Recording Link must begin with http:// or https://.')
  }
  return normalized
}

export async function saveCatalogEntry({ operation, originalCatalogNumber, entry }) {
  if (!process.env.GITHUB_TOKEN) throw new Error('Administrator saving has not been configured yet.')
  if (!['add', 'edit'].includes(operation)) throw new Error('The requested catalog operation is not supported.')

  const normalized = normalizeEntry(entry)
  const { owner, repo, branch } = repositorySettings()
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_PATH}`
  const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() })
  if (!currentResponse.ok) throw new Error(await parseGitHubError(currentResponse))
  const currentFile = await currentResponse.json()
  const decoded = Buffer.from(String(currentFile.content || '').replaceAll('\n', ''), 'base64').toString('utf8')
  const entries = parseCSV(decoded)

  const matchNumber = operation === 'edit' ? String(originalCatalogNumber || '').trim() : normalized['Catalog Number']
  const existingIndex = entries.findIndex((item) => item['Catalog Number'] === matchNumber)
  if (operation === 'edit' && existingIndex === -1) throw new Error('This catalog entry no longer exists. Refresh the page and try again.')
  if (operation === 'add' && existingIndex !== -1) throw new Error('That catalog number is already in use.')
  const duplicateIndex = entries.findIndex((item, index) => item['Catalog Number'] === normalized['Catalog Number'] && index !== existingIndex)
  if (duplicateIndex !== -1) throw new Error('That catalog number is already in use.')

  if (operation === 'add') entries.push(normalized)
  else entries[existingIndex] = normalized

  const body = {
    message: operation === 'add' ? `Add choir catalog entry ${normalized['Catalog Number']}` : `Update choir catalog entry ${normalized['Catalog Number']}`,
    content: Buffer.from(serializeCSV(sortCatalog(entries)), 'utf8').toString('base64'),
    sha: currentFile.sha,
    branch,
  }
  const updateResponse = await fetch(endpoint, {
    method: 'PUT',
    headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!updateResponse.ok) throw new Error(await parseGitHubError(updateResponse))
  return normalized
}
