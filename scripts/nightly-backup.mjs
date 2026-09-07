import fs from 'node:fs/promises'
import { parseCSV } from '../shared/catalog.js'

const catalogPath = new URL('../public/data.csv', import.meta.url)
const backupPath = new URL('../backups/latest-data.csv', import.meta.url)
const statusPath = new URL('../public/backup-status.json', import.meta.url)
const now = new Date()
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
}).formatToParts(now).map(({ type, value }) => [type, value]))

if (process.env.FORCE_BACKUP !== 'true' && parts.hour !== '00') {
  console.log('Not midnight in America/Detroit; no backup needed on this run.')
  process.exit(0)
}

const isoDate = `${parts.year}-${parts.month}-${parts.day}`
const displayDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(now)
const catalog = await fs.readFile(catalogPath, 'utf8')
const recordCount = parseCSV(catalog).length

await fs.mkdir(new URL('../backups/', import.meta.url), { recursive: true })
await fs.writeFile(backupPath, catalog, 'utf8')
await fs.writeFile(statusPath, `${JSON.stringify({ lastBackup: isoDate, displayDate, recordCount, lastUpdated: now.toISOString() }, null, 2)}\n`, 'utf8')
console.log(`Backed up ${recordCount} entries on ${displayDate}.`)
