const CATALOG_HEADERS = [
  'Catalog Number',
  'Title',
  'Composer',
  'Count',
  'Bible Verse Reference',
  'General Liturgical Season',
  'Narrative Lectionary Weeks',
  'Themes / Topics',
  'Parts',
  'Last Performed',
  'Recording Link',
]

const DEFAULT_REPOSITORY = 'mikemaksimchuk/choir-catalog'
const DEFAULT_BRANCH = 'main'
const DEFAULT_ORIGIN = 'https://mikemaksimchuk.github.io'

function parseCSV(input = '') {
  const text = input.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]
    if (character === '"' && inQuotes && nextCharacter === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(value)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value)
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  }
  if (rows.length < 2) return []

  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((values) => {
    const entry = {}
    headers.forEach((header, index) => {
      if (header) entry[header] = (values[index] || '').trim()
    })
    CATALOG_HEADERS.forEach((header) => {
      if (!(header in entry)) entry[header] = ''
    })
    return entry
  }).filter((entry) => entry.Title || entry['Catalog Number'])
}

function escapeCSVValue(value) {
  const stringValue = value == null ? '' : String(value)
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

function serializeCSV(entries) {
  const lines = [CATALOG_HEADERS.map(escapeCSVValue).join(',')]
  entries.forEach((entry) => {
    lines.push(CATALOG_HEADERS.map((header) => escapeCSVValue(entry[header] || '')).join(','))
  })
  return `\uFEFF${lines.join('\n')}\n`
}

function sortCatalog(entries) {
  return [...entries].sort((first, second) => {
    const firstNumber = Number.parseInt(first['Catalog Number'], 10)
    const secondNumber = Number.parseInt(second['Catalog Number'], 10)
    if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber) && firstNumber !== secondNumber) {
      return firstNumber - secondNumber
    }
    return String(first['Catalog Number'] || '').localeCompare(String(second['Catalog Number'] || ''), undefined, { numeric: true })
      || String(first.Title || '').localeCompare(String(second.Title || ''))
  })
}

function cleanText(value, field) {
  const text = String(value ?? '').trim()
  const maximumLength = field === 'Recording Link' ? 2000 : 500
  if (text.length > maximumLength) throw new Error(`${field} is longer than ${maximumLength} characters.`)
  return text
}

function validateRequest(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('The request is invalid.')
  if (!['add', 'edit'].includes(payload.operation)) throw new Error('The operation must be add or edit.')
  if (!payload.entry || typeof payload.entry !== 'object' || Array.isArray(payload.entry)) throw new Error('The entry data is missing.')

  const entry = Object.fromEntries(CATALOG_HEADERS.map((header) => [header, cleanText(payload.entry[header], header)]))
  if (!entry['Catalog Number']) throw new Error('Catalog Number is required.')
  if (!entry.Title) throw new Error('Title is required.')

  if (entry['Last Performed']) {
    const date = new Date(`${entry['Last Performed']}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry['Last Performed']) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entry['Last Performed']) {
      throw new Error('Last Performed must be a real date in YYYY-MM-DD format.')
    }
  }

  if (entry['Recording Link']) {
    let url
    try {
      url = new URL(entry['Recording Link'])
    } catch {
      throw new Error('Recording Link must be a valid web address.')
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Recording Link must begin with http:// or https://.')
  }

  return {
    operation: payload.operation,
    originalCatalogNumber: cleanText(payload.originalCatalogNumber, 'Original Catalog Number'),
    entry,
  }
}

function applyChange(entries, payload) {
  const newNumber = payload.entry['Catalog Number']
  if (payload.operation === 'add') {
    if (entries.some((entry) => entry['Catalog Number'] === newNumber)) throw new Error(`Catalog Number ${newNumber} already exists.`)
    entries.push(payload.entry)
    return
  }

  if (!payload.originalCatalogNumber) throw new Error('The original catalog number is required for an edit.')
  const index = entries.findIndex((entry) => entry['Catalog Number'] === payload.originalCatalogNumber)
  if (index === -1) throw new Error(`Catalog Number ${payload.originalCatalogNumber} could not be found.`)
  const duplicateIndex = entries.findIndex((entry) => entry['Catalog Number'] === newNumber)
  if (duplicateIndex !== -1 && duplicateIndex !== index) throw new Error(`Catalog Number ${newNumber} already exists.`)
  entries[index] = payload.entry
}

function repositoryDetails(env) {
  const [owner, repository, ...extra] = (env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY).split('/')
  if (!owner || !repository || extra.length) throw new Error('GITHUB_REPOSITORY must use owner/repository format.')
  return { owner, repository, branch: env.GITHUB_BRANCH || DEFAULT_BRANCH }
}

async function githubRequest(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'sparta-umc-choir-catalog',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = new Error(`GitHub returned ${response.status}.`)
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null
  return response.json()
}

async function readGithubFile(env, path, ref) {
  const { owner, repository } = repositoryDetails(env)
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'sparta-umc-choir-catalog',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    const error = new Error(`GitHub returned ${response.status} while reading ${path}.`)
    error.status = response.status
    throw error
  }
  return response.text()
}

function getDetroitStatus(recordCount) {
  const now = new Date()
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]))
  return {
    lastBackup: `${parts.year}-${parts.month}-${parts.day}`,
    displayDate: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Detroit',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(now),
    recordCount,
    lastUpdated: now.toISOString(),
  }
}

async function commitFiles(env, headSha, baseTreeSha, files, message) {
  const { owner, repository, branch } = repositoryDetails(env)
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
  const blobs = await Promise.all(files.map((file) => githubRequest(env, `${repositoryPath}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
  })))
  const tree = await githubRequest(env, `${repositoryPath}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: files.map((file, index) => ({ path: file.path, mode: '100644', type: 'blob', sha: blobs[index].sha })),
    }),
  })
  const commit = await githubRequest(env, `${repositoryPath}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  })
  await githubRequest(env, `${repositoryPath}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
}

async function saveCatalog(env, body) {
  const payload = validateRequest(body)
  const { owner, repository, branch } = repositoryDetails(env)
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
  const reference = await githubRequest(env, `${repositoryPath}/git/ref/heads/${encodeURIComponent(branch)}`)
  const headSha = reference.object.sha
  const [commit, catalog] = await Promise.all([
    githubRequest(env, `${repositoryPath}/git/commits/${headSha}`),
    readGithubFile(env, 'public/data.csv', headSha),
  ])
  const entries = parseCSV(catalog)
  applyChange(entries, payload)
  const sortedEntries = sortCatalog(entries)
  const csv = serializeCSV(sortedEntries)
  const status = getDetroitStatus(sortedEntries.length)
  const action = payload.operation === 'add' ? 'Add' : 'Update'
  const message = `${action} choir catalog #${payload.entry['Catalog Number']}: ${payload.entry.Title}`.slice(0, 220)

  await commitFiles(env, headSha, commit.tree.sha, [
    { path: 'public/data.csv', content: csv },
    { path: 'backups/latest-data.csv', content: csv },
    { path: 'public/backup-status.json', content: `${JSON.stringify(status, null, 2)}\n` },
  ], message)
  return { entry: payload.entry, status }
}

async function hashText(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function passwordMatches(provided, expected) {
  if (!expected || typeof provided !== 'string') return false
  const [providedHash, expectedHash] = await Promise.all([hashText(provided), hashText(expected)])
  let difference = providedHash.length ^ expectedHash.length
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ (expectedHash[index] || 0)
  }
  return difference === 0
}

function corsHeaders(request, env, isPublic = false) {
  const configuredOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
  const requestOrigin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': isPublic ? '*' : (requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
    const requestOrigin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      if (requestOrigin && requestOrigin !== allowedOrigin) return new Response(null, { status: 403 })
      return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    }

    try {
      if (request.method === 'GET' && ['/data.csv', '/catalog.csv'].includes(url.pathname)) {
        const catalog = await readGithubFile(env, 'public/data.csv', repositoryDetails(env).branch)
        return new Response(catalog, {
          headers: {
            ...corsHeaders(request, env, true),
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }

      if (request.method === 'GET' && url.pathname === '/backup-status.json') {
        const status = await readGithubFile(env, 'public/backup-status.json', repositoryDetails(env).branch)
        return new Response(status, {
          headers: {
            ...corsHeaders(request, env, true),
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }

      if (request.method !== 'POST' || !['/auth', '/catalog'].includes(url.pathname)) {
        return jsonResponse(request, env, { error: 'Not found.' }, 404)
      }
      if (requestOrigin && requestOrigin !== allowedOrigin) {
        return jsonResponse(request, env, { error: 'This website is not allowed to use the catalog service.' }, 403)
      }

      const body = await request.json()
      if (!await passwordMatches(body.password, env.ADMIN_PASSWORD)) {
        return jsonResponse(request, env, { error: 'That password was not accepted.' }, 401)
      }
      if (url.pathname === '/auth') return jsonResponse(request, env, { authenticated: true })

      const result = await saveCatalog(env, body)
      return jsonResponse(request, env, result)
    } catch (error) {
      if (error.status === 422 || error.status === 409) {
        return jsonResponse(request, env, { error: 'Someone else updated the catalog at the same time. Refresh and try again.' }, 409)
      }
      const safeMessage = error.message?.startsWith('GitHub returned')
        ? 'GitHub could not save the catalog. Check the Worker token and try again.'
        : error.message || 'The catalog could not be saved.'
      return jsonResponse(request, env, { error: safeMessage }, 500)
    }
  },
}
