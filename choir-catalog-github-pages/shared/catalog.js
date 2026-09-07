export const CATALOG_HEADERS = [
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

export const PART_OPTIONS = [
  'Unison',
  'Solo',
  '2-Part',
  'SAB',
  'SATB',
  'SSA',
  'SSAA',
  'TTBB',
  'Instrumental',
]

export function parseCSV(input = '') {
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
  }).filter((entry) => entry['Title'] || entry['Catalog Number'])
}

function escapeCSVValue(value) {
  const stringValue = value == null ? '' : String(value)
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }
  return stringValue
}

export function serializeCSV(entries, headers = CATALOG_HEADERS) {
  const lines = [headers.map(escapeCSVValue).join(',')]
  entries.forEach((entry) => {
    lines.push(headers.map((header) => escapeCSVValue(entry[header] || '')).join(','))
  })
  return `\uFEFF${lines.join('\n')}\n`
}

export function splitMultiValue(value = '') {
  return value.split('|').map((item) => item.trim()).filter(Boolean)
}

export function sortCatalog(entries) {
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

export function formatDisplayDate(value) {
  if (!value) return 'Not entered'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Detroit',
  }).format(date)
}
