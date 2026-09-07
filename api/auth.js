import { clearSessionCookie, createSessionCookie, hasValidSession, isConfigured, isSameOrigin, passwordMatches } from '../server/session.js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method === 'GET') {
    return response.status(200).json({ authenticated: hasValidSession(request), configured: isConfigured() })
  }

  if (!isSameOrigin(request)) return response.status(403).json({ error: 'This request could not be verified.' })

  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', clearSessionCookie())
    return response.status(200).json({ authenticated: false })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  if (!isConfigured()) return response.status(503).json({ error: 'Administrator access has not been configured yet.' })
  if (!passwordMatches(request.body?.password)) return response.status(401).json({ error: 'That password was not accepted.' })

  response.setHeader('Set-Cookie', createSessionCookie())
  return response.status(200).json({ authenticated: true })
}
