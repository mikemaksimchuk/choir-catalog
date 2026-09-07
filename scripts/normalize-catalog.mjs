import fs from 'node:fs/promises'
import { parseCSV, serializeCSV, sortCatalog } from '../shared/catalog.js'

const catalogPath = new URL('../public/data.csv', import.meta.url)
const contents = await fs.readFile(catalogPath, 'utf8')
const entries = sortCatalog(parseCSV(contents))
await fs.writeFile(catalogPath, serializeCSV(entries), 'utf8')
console.log(`Normalized ${entries.length} catalog entries.`)
