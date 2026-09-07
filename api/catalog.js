import { saveCatalogEntry } from '../server/githubCatalog.js'
import { hasValidSession, isSameOrigin } from '../server/session.js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }
  if (!isSameOrigin(request)) return response.status(403).json({ error: 'This request could not be verified.' })
  if (!hasValidSession(request)) return response.status(401).json({ error: 'Administrator access has expired. Unlock editing and try again.' })

  try {
    const entry = await saveCatalogEntry(request.body || {})
    return response.status(200).json({ entry })
  } catch (error) {
    const knownError = /required|valid|supported|already|no longer|changed|credentials|configured|format/i.test(error.message)
    return response.status(knownError ? 400 : 500).json({ error: knownError ? error.message : 'The entry could not be saved. Please try again.' })
  }
}
