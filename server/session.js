import crypto from 'node:crypto'

const COOKIE_NAME = 'choir_catalog_admin'
const SESSION_SECONDS = 60 * 60 * 8

function getSecret() {
  const password = process.env.ADMIN_PASSWORD
  const githubToken = process.env.GITHUB_TOKEN
  if (!password || !githubToken) return ''
  return process.env.SESSION_SECRET || crypto.createHash('sha256').update(`${password}:${githubToken}`).digest('hex')
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator === -1) return ['', '']
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]
  }).filter(([key]) => key))
}

export function isConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.GITHUB_TOKEN && getSecret())
}

export function passwordMatches(candidate = '') {
  const expected = process.env.ADMIN_PASSWORD || ''
  const candidateHash = crypto.createHash('sha256').update(String(candidate)).digest()
  const expectedHash = crypto.createHash('sha256').update(expected).digest()
  return expected.length > 0 && crypto.timingSafeEqual(candidateHash, expectedHash)
}

export function createSessionCookie() {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url')
  const token = `${payload}.${sign(payload)}`
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export function hasValidSession(request) {
  if (!isConfigured()) return false
  const token = parseCookies(request.headers.cookie || '')[COOKIE_NAME]
  if (!token) return false
  const separator = token.lastIndexOf('.')
  if (separator === -1) return false
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const expected = sign(payload)
  if (signature.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(parsed.expiresAt) > Date.now()
  } catch {
    return false
  }
}

export function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  const forwardedHost = request.headers['x-forwarded-host'] || request.headers.host
  const protocol = request.headers['x-forwarded-proto'] || 'https'
  if (!forwardedHost) return false
  return origin === `${protocol}://${forwardedHost}`
}
