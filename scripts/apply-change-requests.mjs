import fs from 'node:fs/promises'
import { CATALOG_HEADERS, parseCSV, serializeCSV, sortCatalog } from '../shared/catalog.js'

const marker = '<!-- choir-catalog-change:v1 -->'
const catalogPath = new URL('../public/data.csv', import.meta.url)
const resultsPath = '/tmp/choir-catalog-processed.json'
const trustedAssociations = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const mode = process.argv[2]

function isDetroitMidnight() {
  if (process.env.FORCE_BACKUP === 'true') return true
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
  return hour === '00'
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8')
  }
}

function repositoryDetails() {
  const [owner, repository, ...extra] = (process.env.GITHUB_REPOSITORY || '').split('/')
  if (!owner || !repository || extra.length) throw new Error('GITHUB_REPOSITORY must be in owner/repository format.')
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required.')
  return { owner, repository }
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function getChangeRequestIssues(owner, repository) {
  const issues = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues?state=open&sort=created&direction=asc&per_page=100&page=${page}`)
    const matching = batch.filter((issue) => !issue.pull_request && issue.body?.includes(marker))
    issues.push(...matching)
    if (batch.length < 100) break
  }
  return issues
}

function cleanText(value, field) {
  const text = String(value ?? '').trim()
  const maximumLength = field === 'Recording Link' ? 2000 : 500
  if (text.length > maximumLength) throw new Error(`${field} is longer than ${maximumLength} characters.`)
  return text
}

function parsePayload(body) {
  const match = body.match(/```json\s*([\s\S]*?)```/i)
  if (!match) throw new Error('The structured JSON block is missing.')
  let payload
  try {
    payload = JSON.parse(match[1])
  } catch {
    throw new Error('The structured JSON block is not valid JSON.')
  }
  if (!payload || typeof payload !== 'object') throw new Error('The request payload is invalid.')
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

function applyPayload(entries, payload) {
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

async function prepare() {
  await fs.rm(resultsPath, { force: true })
  const shouldRun = isDetroitMidnight()
  await setOutput('should_run', String(shouldRun))
  if (!shouldRun) {
    console.log('Not midnight in America/Detroit; no catalog update needed on this run.')
    return
  }

  const { owner, repository } = repositoryDetails()
  const issues = await getChangeRequestIssues(owner, repository)
  const entries = parseCSV(await fs.readFile(catalogPath, 'utf8'))
  const results = []
  let appliedCount = 0

  for (const issue of issues) {
    if (!trustedAssociations.has(issue.author_association)) {
      results.push({
        number: issue.number,
        success: false,
        message: `GitHub does not identify @${issue.user.login} as a repository owner, member, or collaborator.`,
      })
      continue
    }

    try {
      const payload = parsePayload(issue.body)
      applyPayload(entries, payload)
      appliedCount += 1
      results.push({
        number: issue.number,
        success: true,
        message: `${payload.operation === 'add' ? 'Added' : 'Updated'} catalog number ${payload.entry['Catalog Number']} (${payload.entry.Title}).`,
      })
    } catch (error) {
      results.push({ number: issue.number, success: false, message: error.message })
    }
  }

  if (appliedCount > 0) {
    await fs.writeFile(catalogPath, serializeCSV(sortCatalog(entries)), 'utf8')
  }
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  console.log(`Reviewed ${issues.length} change request(s); ${appliedCount} will be applied.`)
}

async function complete() {
  let results
  try {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No change requests were processed on this run.')
      return
    }
    throw error
  }

  const { owner, repository } = repositoryDetails()
  for (const result of results) {
    const comment = result.success
      ? `✅ ${result.message}\n\nThe change is now in the catalog, included in the nightly backup, and published to GitHub Pages.`
      : `⚠️ This request was not applied: ${result.message}\n\nPlease correct the entry and submit a new request if needed.`
    const issuePath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues/${result.number}`
    await githubRequest(`${issuePath}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment }),
    })
    await githubRequest(issuePath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    })
  }
  console.log(`Closed ${results.length} processed change request(s).`)
}

if (mode === 'prepare') {
  await prepare()
} else if (mode === 'complete') {
  await complete()
} else {
  throw new Error('Use "prepare" or "complete" as the script mode.')
}
