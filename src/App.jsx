import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Download,
  ExternalLink,
  Filter,
  FileCheck2,
  FileUp,
  Hash,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Music2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  CATALOG_HEADERS,
  PART_OPTIONS,
  formatDisplayDate,
  parseCSV,
  serializeCSV,
  sortCatalog,
  splitMultiValue,
} from '../shared/catalog.js'

const REPOSITORY_RAW_ROOT = 'https://raw.githubusercontent.com/mikemaksimchuk/choir-catalog/main/public'
const configuredSaveApiUrl = window.CHOIR_CATALOG_CONFIG?.saveApiUrl?.trim().replace(/\/+$/, '') || ''
const SAVE_API_URL = configuredSaveApiUrl.startsWith('https://') && !configuredSaveApiUrl.includes('PASTE_')
  ? configuredSaveApiUrl
  : ''
const EMPTY_ENTRY = Object.fromEntries(CATALOG_HEADERS.map((header) => [header, '']))
const CATALOG_SORT_COLUMNS = [
  { label: 'Number', field: 'Catalog Number' },
  { label: 'Title', field: 'Title' },
  { label: 'Season', field: 'General Liturgical Season' },
  { label: 'Theme', field: 'Themes / Topics' },
  { label: 'Performance', field: 'Last Performed' },
]

function compareCatalogEntries(first, second, field, direction) {
  const firstValue = String(first[field] || '').trim()
  const secondValue = String(second[field] || '').trim()
  const firstIsBlank = !firstValue || firstValue === '.'
  const secondIsBlank = !secondValue || secondValue === '.'

  if (firstIsBlank !== secondIsBlank) return firstIsBlank ? 1 : -1

  let comparison = 0
  if (!firstIsBlank) {
    if (field === 'Last Performed') {
      const firstDate = Date.parse(firstValue)
      const secondDate = Date.parse(secondValue)
      comparison = Number.isNaN(firstDate) || Number.isNaN(secondDate)
        ? firstValue.localeCompare(secondValue, undefined, { numeric: true, sensitivity: 'base' })
        : firstDate - secondDate
    } else {
      comparison = firstValue.localeCompare(secondValue, undefined, { numeric: true, sensitivity: 'base' })
    }
  }

  if (comparison !== 0) return direction === 'asc' ? comparison : -comparison
  return String(first['Catalog Number'] || '').localeCompare(String(second['Catalog Number'] || ''), undefined, { numeric: true, sensitivity: 'base' })
}

async function saveApiRequest(path, body) {
  if (!SAVE_API_URL) throw new Error('Online editing has not been connected yet. Complete the Cloudflare Worker setup first.')
  const response = await fetch(`${SAVE_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
  return result
}

function getDataUrl(file) {
  if (!import.meta.env.DEV && SAVE_API_URL) return `${SAVE_API_URL}/${file}?v=${Date.now()}`
  return import.meta.env.DEV ? `/${file}` : `${REPOSITORY_RAW_ROOT}/${file}?v=${Date.now()}`
}

async function fetchCatalogFile(file) {
  const response = await fetch(getDataUrl(file), { cache: 'no-store' })
  if (response.ok || import.meta.env.DEV || !SAVE_API_URL) return response
  return fetch(`${REPOSITORY_RAW_ROOT}/${file}?v=${Date.now()}`, { cache: 'no-store' })
}

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'add') return { page: 'add' }
  if (hash.startsWith('entry/')) return { page: 'detail', id: decodeURIComponent(hash.slice(6)) }
  if (hash.startsWith('edit/')) return { page: 'edit', id: decodeURIComponent(hash.slice(5)) }
  return { page: 'catalog' }
}

function navigate(path = '') {
  window.location.hash = path ? `#/${path}` : ''
}

function uniqueValues(entries, field, isMulti = false) {
  const values = new Set()
  entries.forEach((entry) => {
    const candidates = isMulti ? splitMultiValue(entry[field]) : [entry[field]?.trim()]
    candidates.filter(Boolean).forEach((value) => values.add(value))
  })
  return [...values].sort((first, second) => first.localeCompare(second))
}

function FilterSection({ id, title, icon, children }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="filter-section">
      <button
        className="filter-heading"
        type="button"
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>{createElement(icon, { 'aria-hidden': true, size: 18 })}{title}</span>
        <ChevronDown aria-hidden="true" size={18} className={expanded ? 'chevron is-open' : 'chevron'} />
      </button>
      {expanded && <div className="filter-options" id={`${id}-options`}>{children}</div>}
    </section>
  )
}

function CheckboxList({ values, selected, onToggle, emptyLabel = 'No options entered yet.' }) {
  if (!values.length) return <p className="muted-copy">{emptyLabel}</p>
  return (
    <div className="checkbox-list">
      {values.map((value) => (
        <label className="checkbox-option" key={value}>
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => onToggle(value)}
          />
          <span>{value}</span>
        </label>
      ))}
    </div>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="empty-state" role="status">
      <AlertCircle aria-hidden="true" size={34} />
      <h2>{filtered ? 'No music matches those filters' : 'The catalog is empty'}</h2>
      <p>{filtered ? 'Clear one or more filters and try again.' : 'Add the first piece of music to get started.'}</p>
    </div>
  )
}

function CatalogSortHeader({ sortField, sortDirection, onSort }) {
  return (
    <div className="catalog-table-header" role="group" aria-label="Sort catalog entries">
      {CATALOG_SORT_COLUMNS.map(({ label, field }) => {
        const isActive = sortField === field
        const nextDirection = isActive && sortDirection === 'asc' ? 'descending' : 'ascending'
        const SortIcon = isActive
          ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
          : ChevronsUpDown

        return (
          <button
            type="button"
            className={isActive ? 'catalog-sort-button is-active' : 'catalog-sort-button'}
            key={field}
            onClick={() => onSort(field)}
            aria-label={`Sort by ${label}, ${nextDirection}`}
            aria-pressed={isActive}
          >
            <span>{label}</span>
            <SortIcon aria-hidden="true" size={16} />
            {isActive && <span className="sr-only">Currently sorted {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>}
          </button>
        )
      })}
      <span className="catalog-table-header-spacer" aria-hidden="true" />
    </div>
  )
}

function CatalogCard({ entry }) {
  const themes = splitMultiValue(entry['Themes / Topics'])
  const parts = splitMultiValue(entry.Parts)
  return (
    <button
      type="button"
      className="catalog-card"
      onClick={() => navigate(`entry/${encodeURIComponent(entry['Catalog Number'])}`)}
      aria-label={`View ${entry.Title || 'untitled entry'} by ${entry.Composer || 'unknown composer'}`}
    >
      <span className="catalog-number"><Hash aria-hidden="true" size={14} />{entry['Catalog Number'] || 'N/A'}</span>
      <span className="catalog-title-block">
        <span className="catalog-title">{entry.Title || 'Untitled'}</span>
        <span className="catalog-composer">{entry.Composer || 'Composer not entered'}</span>
      </span>
      <span className="catalog-context">
        <span><CalendarDays aria-hidden="true" size={15} />{entry['General Liturgical Season'] || 'General use'}</span>
        {parts.length > 0 && <span><Users aria-hidden="true" size={15} />{parts.join(', ')}</span>}
      </span>
      <span className="catalog-tags" aria-label="Themes">
        {themes.length > 0 ? themes.slice(0, 3).map((theme) => <span className="tag" key={theme}>{theme}</span>) : <span className="not-entered">No themes entered</span>}
        {themes.length > 3 && <span className="tag tag-more">+{themes.length - 3}</span>}
      </span>
      <span className="catalog-meta">
        <span><strong>{entry.Count && entry.Count !== '.' ? entry.Count : '—'}</strong> copies</span>
        <span>Last performed: <strong>{formatDisplayDate(entry['Last Performed'])}</strong></span>
      </span>
      <span className="card-arrow" aria-hidden="true">View <span>→</span></span>
    </button>
  )
}

function DetailItem({ icon, label, value, link }) {
  const displayValue = value && value !== '.' ? value : 'Not entered'
  return (
    <div className="detail-item">
      <dt>{createElement(icon, { 'aria-hidden': true, size: 18 })}{label}</dt>
      <dd>
        {link && value ? (
          <a href={value} target="_blank" rel="noreferrer">Listen to recording <ExternalLink aria-hidden="true" size={15} /></a>
        ) : displayValue}
      </dd>
    </div>
  )
}

function EntryDetail({ entry, onEdit }) {
  if (!entry) {
    return (
      <main className="page-shell single-page">
        <button type="button" className="back-link" onClick={() => navigate()}><ArrowLeft aria-hidden="true" size={18} />Back to catalog</button>
        <EmptyState filtered />
      </main>
    )
  }

  return (
    <main className="page-shell single-page">
      <button type="button" className="back-link" onClick={() => navigate()}><ArrowLeft aria-hidden="true" size={18} />Back to catalog</button>
      <article className="detail-panel">
        <div className="detail-hero">
          <div>
            <span className="eyebrow">Catalog #{entry['Catalog Number']}</span>
            <h1>{entry.Title}</h1>
            <p>{entry.Composer || 'Composer not entered'}</p>
          </div>
          <button type="button" className="button button-primary" onClick={onEdit}>
            <Pencil aria-hidden="true" size={17} />Edit Entry
          </button>
        </div>
        <dl className="detail-grid">
          <DetailItem icon={Hash} label="Catalog Number" value={entry['Catalog Number']} />
          <DetailItem icon={Users} label="Number of Copies" value={entry.Count} />
          <DetailItem icon={CalendarDays} label="Liturgical Season / Holiday" value={entry['General Liturgical Season']} />
          <DetailItem icon={Users} label="Parts / Voicing" value={splitMultiValue(entry.Parts).join(', ')} />
          <DetailItem icon={BookOpen} label="Bible Verse Reference" value={entry['Bible Verse Reference']} />
          <DetailItem icon={BookOpen} label="Narrative Lectionary Weeks" value={entry['Narrative Lectionary Weeks']} />
          <DetailItem icon={Music2} label="Themes & Topics" value={splitMultiValue(entry['Themes / Topics']).join(', ')} />
          <DetailItem icon={CalendarDays} label="Last Performed" value={entry['Last Performed'] ? formatDisplayDate(entry['Last Performed']) : ''} />
          <DetailItem icon={Link2} label="Recording" value={entry['Recording Link']} link />
        </dl>
      </article>
    </main>
  )
}

function Field({ label, name, value, onChange, type = 'text', required = false, placeholder = '', hint = '' }) {
  return (
    <label className="field">
      <span>{label}{required && <span className="required" aria-hidden="true"> *</span>}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}

function EntryForm({ initialEntry, mode, password, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_ENTRY, ...initialEntry })
  const existingParts = splitMultiValue(initialEntry?.Parts)
  const [selectedParts, setSelectedParts] = useState(existingParts.filter((part) => PART_OPTIONS.includes(part)))
  const [otherParts, setOtherParts] = useState(existingParts.filter((part) => !PART_OPTIONS.includes(part)).join(' | '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function togglePart(part) {
    setSelectedParts((current) => current.includes(part) ? current.filter((value) => value !== part) : [...current, part])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const customParts = splitMultiValue(otherParts)
    const entry = { ...form, Parts: [...selectedParts, ...customParts].join(' | ') }
    try {
      const result = await saveApiRequest('/catalog', {
        password,
        operation: mode === 'add' ? 'add' : 'edit',
        originalCatalogNumber: initialEntry?.['Catalog Number'] || '',
        entry,
      })
      onSaved(result.entry, mode, result.status)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell single-page">
      <button type="button" className="back-link" onClick={() => mode === 'edit' ? navigate(`entry/${encodeURIComponent(initialEntry['Catalog Number'])}`) : navigate()}>
        <ArrowLeft aria-hidden="true" size={18} />Cancel and go back
      </button>
      <section className="form-panel">
        <div className="form-heading">
          <span className="eyebrow"><LockKeyhole aria-hidden="true" size={15} />Administrator</span>
          <h1>{mode === 'add' ? 'Add Music to the Catalog' : 'Edit Catalog Entry'}</h1>
          <p>Required fields are marked with an asterisk.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field label="Catalog Number" name="Catalog Number" value={form['Catalog Number']} onChange={updateField} required />
            <Field label="Title" name="Title" value={form.Title} onChange={updateField} required />
            <Field label="Composer / Arranger" name="Composer" value={form.Composer} onChange={updateField} />
            <Field label="Number of Copies" name="Count" value={form.Count} onChange={updateField} placeholder="e.g., 24" />
            <Field label="Liturgical Season / Holiday" name="General Liturgical Season" value={form['General Liturgical Season']} onChange={updateField} placeholder="e.g., Advent" />
            <Field label="Last Performed" name="Last Performed" value={form['Last Performed']} onChange={updateField} type="date" />
            <Field label="Bible Verse Reference" name="Bible Verse Reference" value={form['Bible Verse Reference']} onChange={updateField} placeholder="e.g., Psalm 100:1–2" />
            <Field label="Narrative Lectionary Weeks" name="Narrative Lectionary Weeks" value={form['Narrative Lectionary Weeks']} onChange={updateField} placeholder="Separate multiple weeks with |" />
            <Field label="Themes & Topics" name="Themes / Topics" value={form['Themes / Topics']} onChange={updateField} placeholder="Separate multiple themes with |" />
            <Field label="Recording Link" name="Recording Link" value={form['Recording Link']} onChange={updateField} type="url" placeholder="https://youtube.com/…" />
          </div>

          <fieldset className="parts-fieldset">
            <legend>Parts / Voicing</legend>
            <div className="parts-grid">
              {PART_OPTIONS.map((part) => (
                <label className="part-option" key={part}>
                  <input type="checkbox" checked={selectedParts.includes(part)} onChange={() => togglePart(part)} />
                  <span><Check aria-hidden="true" size={14} />{part}</span>
                </label>
              ))}
            </div>
            <label className="field other-parts">
              <span>Other parts or voicing</span>
              <input value={otherParts} onChange={(event) => setOtherParts(event.target.value)} placeholder="Separate multiple values with |" />
            </label>
          </fieldset>

          <div className="request-note">
            <LockKeyhole aria-hidden="true" size={18} />
            <p>Saving updates the public catalog and its GitHub backup immediately. No separate GitHub sign-in or approval step is required.</p>
          </div>
          {error && <div className="form-error" role="alert"><AlertCircle aria-hidden="true" size={18} />{error}</div>}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => mode === 'edit' ? navigate(`entry/${encodeURIComponent(initialEntry['Catalog Number'])}`) : navigate()}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <Check aria-hidden="true" size={18} />}
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function AuthDialog({ open, onClose, onAuthenticated }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (open) {
      setPassword('')
      setError('')
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await saveApiRequest('/auth', { password })
      onAuthenticated(password)
    } catch (authError) {
      setError(authError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
        <button type="button" className="icon-button dialog-close" aria-label="Close password dialog" onClick={onClose}><X aria-hidden="true" size={20} /></button>
        <span className="auth-icon"><LockKeyhole aria-hidden="true" size={24} /></span>
        <h2 id="auth-title">Administrator Access</h2>
        <p id="auth-description">Enter the catalog password to add or edit music. It remains active only until this page is closed or refreshed.</p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Password</span>
            <input ref={inputRef} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <div className="form-error" role="alert"><AlertCircle aria-hidden="true" size={18} />{error}</div>}
          <button type="submit" className="button button-primary button-full" disabled={submitting}>
            {submitting ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
            {submitting ? 'Checking…' : 'Unlock Editing'}
          </button>
        </form>
      </section>
    </div>
  )
}

function displayImportValue(value) {
  return value && value !== '.' ? value : 'Not entered'
}

function DatabaseImportDialog({ open, onClose, onCatalogChanged }) {
  const [password, setPassword] = useState('')
  const [file, setFile] = useState(null)
  const [review, setReview] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [activeApproval, setActiveApproval] = useState('')
  const [error, setError] = useState('')
  const passwordRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setFile(null)
    setReview(null)
    setComparing(false)
    setActiveApproval('')
    setError('')
    window.setTimeout(() => passwordRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !comparing && !activeApproval) onClose()
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, comparing, activeApproval, onClose])

  if (!open) return null

  async function handleCompare(event) {
    event.preventDefault()
    if (!file) {
      setError('Select a CSV file before continuing.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The selected CSV is larger than the 5 MB upload limit.')
      return
    }

    setComparing(true)
    setError('')
    try {
      const result = await saveApiRequest('/import/preview', {
        password,
        csv: await file.text(),
      })
      setReview({
        ...result,
        modifications: result.modifications.map((change) => ({ ...change, approvalStatus: 'pending', approvalError: '' })),
        deletions: result.deletions.map((change) => ({ ...change, approvalStatus: 'pending', approvalError: '' })),
      })
      if (result.addedEntries.length) onCatalogChanged(result)
    } catch (compareError) {
      setError(compareError.message)
    } finally {
      setComparing(false)
    }
  }

  async function approveChange(type, change) {
    if (type === 'delete' && !window.confirm(`Delete catalog #${change.catalogNumber}, “${change.title}”?`)) return
    const approvalId = `${type}:${change.catalogNumber}`
    setActiveApproval(approvalId)
    setReview((current) => ({
      ...current,
      [type === 'modify' ? 'modifications' : 'deletions']: current[type === 'modify' ? 'modifications' : 'deletions'].map((item) => (
        item.catalogNumber === change.catalogNumber ? { ...item, approvalError: '' } : item
      )),
    }))

    try {
      const result = await saveApiRequest('/import/apply', {
        password,
        change: {
          type,
          catalogNumber: change.catalogNumber,
          expectedCurrent: change.currentEntry,
          uploadedEntry: type === 'modify' ? change.uploadedEntry : undefined,
        },
      })
      setReview((current) => ({
        ...current,
        [type === 'modify' ? 'modifications' : 'deletions']: current[type === 'modify' ? 'modifications' : 'deletions'].map((item) => (
          item.catalogNumber === change.catalogNumber ? { ...item, approvalStatus: 'approved', approvalError: '' } : item
        )),
      }))
      onCatalogChanged(result)
    } catch (approvalError) {
      setReview((current) => ({
        ...current,
        [type === 'modify' ? 'modifications' : 'deletions']: current[type === 'modify' ? 'modifications' : 'deletions'].map((item) => (
          item.catalogNumber === change.catalogNumber ? { ...item, approvalError: approvalError.message } : item
        )),
      }))
    } finally {
      setActiveApproval('')
    }
  }

  const approvedCount = review
    ? [...review.modifications, ...review.deletions].filter((change) => change.approvalStatus === 'approved').length
    : 0
  const pendingCount = review
    ? review.modifications.length + review.deletions.length - approvedCount
    : 0

  return (
    <div className="dialog-backdrop import-backdrop" role="presentation">
      <section ref={dialogRef} className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby="import-description">
        <div className="import-dialog-header">
          <div>
            <span className="auth-icon"><FileUp aria-hidden="true" size={24} /></span>
            <h2 id="import-title">Upload Database</h2>
            <p id="import-description">Compare a replacement CSV with the current choir catalog before accepting changed or deleted records.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close database upload" onClick={onClose} disabled={comparing || Boolean(activeApproval)}><X aria-hidden="true" size={20} /></button>
        </div>

        {!review ? (
          <form className="import-form" onSubmit={handleCompare}>
            <div className="import-rules" aria-label="Import rules">
              <div><Plus aria-hidden="true" size={18} /><span><strong>New catalog numbers</strong> are added automatically.</span></div>
              <div><Pencil aria-hidden="true" size={18} /><span><strong>Modified entries</strong> require individual approval.</span></div>
              <div><Trash2 aria-hidden="true" size={18} /><span><strong>Potential deletions</strong> require individual approval.</span></div>
            </div>
            <label className="field">
              <span>Upload password</span>
              <input ref={passwordRef} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label className="field file-field">
              <span>Database CSV file</span>
              <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
              <small>The CSV must contain “Catalog Number” and “Title” columns. Maximum file size: 5 MB.</small>
            </label>
            {error && <div className="form-error" role="alert"><AlertCircle aria-hidden="true" size={18} />{error}</div>}
            <div className="form-actions import-form-actions">
              <button type="button" className="button button-secondary" onClick={onClose} disabled={comparing}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={comparing}>
                {comparing ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
                {comparing ? 'Comparing…' : 'Upload and Compare'}
              </button>
            </div>
          </form>
        ) : (
          <div className="import-review">
            <div className="import-summary" aria-label="Import comparison summary">
              <div className="summary-added"><strong>{review.addedEntries.length}</strong><span>Added automatically</span></div>
              <div><strong>{review.modifications.length}</strong><span>Modifications</span></div>
              <div className="summary-delete"><strong>{review.deletions.length}</strong><span>Potential deletions</span></div>
              <div><strong>{review.unchangedCount}</strong><span>Unchanged</span></div>
            </div>

            {review.addedEntries.length > 0 && (
              <section className="import-section import-added-section" aria-labelledby="added-heading">
                <div className="import-section-heading">
                  <div><FileCheck2 aria-hidden="true" size={21} /><div><h3 id="added-heading">Automatically Added</h3><p>These entries are already saved in the live database and backup.</p></div></div>
                </div>
                <ul className="import-added-list">
                  {review.addedEntries.map((entry) => <li key={entry['Catalog Number']}><strong>#{entry['Catalog Number']}</strong><span>{entry.Title}</span></li>)}
                </ul>
              </section>
            )}

            {review.modifications.length > 0 && (
              <section className="import-section" aria-labelledby="modified-heading">
                <div className="import-section-heading">
                  <div><Pencil aria-hidden="true" size={21} /><div><h3 id="modified-heading">Modified Entries</h3><p>The current value remains in place unless you approve its replacement.</p></div></div>
                </div>
                <div className="change-list">
                  {review.modifications.map((change) => {
                    const approvalId = `modify:${change.catalogNumber}`
                    return (
                      <article className="change-card" key={approvalId}>
                        <div className="change-card-heading"><div><span className="catalog-number">#{change.catalogNumber}</span><h4>{change.title}</h4></div><span className={`change-status ${change.approvalStatus}`}>{change.approvalStatus === 'approved' ? 'Approved' : 'Awaiting approval'}</span></div>
                        <div className="change-table-wrap">
                          <table className="change-table">
                            <thead><tr><th scope="col">Field</th><th scope="col">Current database</th><th scope="col">Uploaded CSV</th></tr></thead>
                            <tbody>{change.differences.map((difference) => <tr key={difference.field}><th scope="row">{difference.field}</th><td>{displayImportValue(difference.current)}</td><td>{displayImportValue(difference.uploaded)}</td></tr>)}</tbody>
                          </table>
                        </div>
                        {change.approvalError && <div className="form-error" role="alert"><AlertCircle aria-hidden="true" size={18} />{change.approvalError}</div>}
                        <div className="change-actions">
                          <button type="button" className="button button-primary" onClick={() => approveChange('modify', change)} disabled={change.approvalStatus === 'approved' || Boolean(activeApproval)}>
                            {activeApproval === approvalId ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <Check aria-hidden="true" size={18} />}
                            {change.approvalStatus === 'approved' ? 'Modification Approved' : activeApproval === approvalId ? 'Applying…' : 'Approve Modification'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )}

            {review.deletions.length > 0 && (
              <section className="import-section import-delete-section" aria-labelledby="deleted-heading">
                <div className="import-section-heading">
                  <div><Trash2 aria-hidden="true" size={21} /><div><h3 id="deleted-heading">Potential Deletions</h3><p>These current entries were not found in the uploaded CSV. Nothing is deleted without approval.</p></div></div>
                </div>
                <div className="deletion-list">
                  {review.deletions.map((change) => {
                    const approvalId = `delete:${change.catalogNumber}`
                    return (
                      <article className="deletion-card" key={approvalId}>
                        <div><span className="catalog-number">#{change.catalogNumber}</span><div><h4>{change.title}</h4><p>{change.currentEntry.Composer || 'Composer not entered'}</p></div></div>
                        <div className="deletion-action">
                          <span className={`change-status ${change.approvalStatus}`}>{change.approvalStatus === 'approved' ? 'Deleted' : 'Not deleted'}</span>
                          <button type="button" className="button button-danger" onClick={() => approveChange('delete', change)} disabled={change.approvalStatus === 'approved' || Boolean(activeApproval)}>
                            {activeApproval === approvalId ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <Trash2 aria-hidden="true" size={18} />}
                            {change.approvalStatus === 'approved' ? 'Deletion Approved' : activeApproval === approvalId ? 'Deleting…' : 'Approve Deletion'}
                          </button>
                        </div>
                        {change.approvalError && <div className="form-error" role="alert"><AlertCircle aria-hidden="true" size={18} />{change.approvalError}</div>}
                      </article>
                    )
                  })}
                </div>
              </section>
            )}

            {review.modifications.length === 0 && review.deletions.length === 0 && (
              <div className="import-complete" role="status"><FileCheck2 aria-hidden="true" size={22} /><div><strong>No approvals are needed.</strong><span>The uploaded database matches the existing entries.</span></div></div>
            )}

            <div className="import-review-footer">
              <p aria-live="polite">{pendingCount > 0 ? `${pendingCount} proposed ${pendingCount === 1 ? 'change remains' : 'changes remain'} unapproved.` : 'All reviewed changes are complete.'}</p>
              <button type="button" className="button button-secondary" onClick={onClose} disabled={Boolean(activeApproval)}>Finish</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Header({ backupDate, authenticated, onLogout }) {
  const assetRoot = import.meta.env.BASE_URL
  return (
    <header className="site-header">
      <div className="church-watermark" aria-hidden="true" />
      <div className="header-inner">
        <div className="brand-lockup">
          <img src={`${assetRoot}sparta-umc-logo.png`} alt="Sparta United Methodist Church" className="church-logo" />
          <div className="brand-copy">
            <span className="brand-kicker">Sparta United Methodist Church</span>
            <span className="brand-title">Choir Music Catalog</span>
            <em>Last Updated &amp; Backed Up on {backupDate || 'backup pending'}</em>
          </div>
        </div>
        {authenticated && (
          <button type="button" className="admin-status" onClick={onLogout} title="End administrator session">
            <LockKeyhole aria-hidden="true" size={15} />Editing unlocked <LogOut aria-hidden="true" size={15} />
          </button>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const [data, setData] = useState([])
  const [backupDate, setBackupDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [route, setRoute] = useState(getRoute)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDirection, setSortDirection] = useState('asc')
  const [selectedSeasons, setSelectedSeasons] = useState([])
  const [selectedThemes, setSelectedThemes] = useState([])
  const [selectedComposers, setSelectedComposers] = useState([])
  const [selectedParts, setSelectedParts] = useState([])
  const [oldestDate, setOldestDate] = useState('')
  const [newestDate, setNewestDate] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [pendingRoute, setPendingRoute] = useState('')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getRoute())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let active = true
    async function loadCatalog() {
      try {
        const [catalogResponse, backupResponse] = await Promise.all([
          fetchCatalogFile('data.csv'),
          fetchCatalogFile('backup-status.json'),
        ])
        if (!catalogResponse.ok) throw new Error('The music catalog could not be loaded.')
        const entries = sortCatalog(parseCSV(await catalogResponse.text()))
        const status = backupResponse.ok ? await backupResponse.json() : {}
        if (active) {
          setData(entries)
          setBackupDate(status.displayDate || formatDisplayDate(status.lastBackup))
        }
      } catch (error) {
        if (active) setLoadError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCatalog()
    return () => { active = false }
  }, [])

  const seasons = useMemo(() => uniqueValues(data, 'General Liturgical Season'), [data])
  const themes = useMemo(() => uniqueValues(data, 'Themes / Topics', true), [data])
  const composers = useMemo(() => uniqueValues(data, 'Composer'), [data])
  const parts = useMemo(() => uniqueValues(data, 'Parts', true), [data])

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return data.filter((entry) => {
      const matchesSearch = !term || CATALOG_HEADERS.some((header) => String(entry[header] || '').toLowerCase().includes(term))
      const matchesSeason = !selectedSeasons.length || selectedSeasons.includes(entry['General Liturgical Season'])
      const entryThemes = splitMultiValue(entry['Themes / Topics'])
      const matchesThemes = !selectedThemes.length || selectedThemes.some((theme) => entryThemes.includes(theme))
      const matchesComposer = !selectedComposers.length || selectedComposers.includes(entry.Composer)
      const entryParts = splitMultiValue(entry.Parts)
      const matchesParts = !selectedParts.length || selectedParts.some((part) => entryParts.includes(part))
      const performed = entry['Last Performed']
      const matchesOldest = !oldestDate || (performed && performed >= oldestDate)
      const matchesNewest = !newestDate || (performed && performed <= newestDate)
      return matchesSearch && matchesSeason && matchesThemes && matchesComposer && matchesParts && matchesOldest && matchesNewest
    })
  }, [data, searchTerm, selectedSeasons, selectedThemes, selectedComposers, selectedParts, oldestDate, newestDate])

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData
    return [...filteredData].sort((first, second) => compareCatalogEntries(first, second, sortField, sortDirection))
  }, [filteredData, sortField, sortDirection])

  const activeFilterCount = selectedSeasons.length + selectedThemes.length + selectedComposers.length + selectedParts.length + (oldestDate ? 1 : 0) + (newestDate ? 1 : 0)
  const currentEntry = data.find((entry) => entry['Catalog Number'] === route.id)

  function toggleSelection(setter, value) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function clearFilters() {
    setSelectedSeasons([])
    setSelectedThemes([])
    setSelectedComposers([])
    setSelectedParts([])
    setOldestDate('')
    setNewestDate('')
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  function requireAdmin(destination) {
    if (adminPassword) {
      navigate(destination)
    } else {
      setPendingRoute(destination)
      setAuthDialogOpen(true)
    }
  }

  function handleAuthenticated(password) {
    setAdminPassword(password)
    setAuthDialogOpen(false)
    if (pendingRoute) navigate(pendingRoute)
    setPendingRoute('')
  }

  function handleLogout() {
    setAdminPassword('')
    if (route.page === 'add' || route.page === 'edit') navigate()
  }

  function handleSaved(entry, mode, status) {
    setData((current) => {
      const withoutOriginal = mode === 'edit'
        ? current.filter((item) => item['Catalog Number'] !== currentEntry?.['Catalog Number'])
        : current
      return sortCatalog([...withoutOriginal, entry])
    })
    if (status?.displayDate) setBackupDate(status.displayDate)
    setAnnouncement(`${entry.Title} was saved and backed up successfully.`)
    navigate(`entry/${encodeURIComponent(entry['Catalog Number'])}`)
    window.setTimeout(() => setAnnouncement(''), 5000)
  }

  function handleCatalogImport(result) {
    if (result.addedEntries?.length) {
      setData((current) => {
        const addedNumbers = new Set(result.addedEntries.map((entry) => entry['Catalog Number']))
        return sortCatalog([...current.filter((entry) => !addedNumbers.has(entry['Catalog Number'])), ...result.addedEntries])
      })
      setAnnouncement(`${result.addedEntries.length} new ${result.addedEntries.length === 1 ? 'entry was' : 'entries were'} added and backed up.`)
    }
    if (result.applied?.type === 'modify') {
      setData((current) => sortCatalog(current.map((entry) => entry['Catalog Number'] === result.applied.catalogNumber ? result.applied.entry : entry)))
      setAnnouncement(`Catalog #${result.applied.catalogNumber} was updated and backed up.`)
    }
    if (result.applied?.type === 'delete') {
      setData((current) => current.filter((entry) => entry['Catalog Number'] !== result.applied.catalogNumber))
      setAnnouncement(`Catalog #${result.applied.catalogNumber} was deleted and the backup was updated.`)
    }
    if (result.status?.displayDate) setBackupDate(result.status.displayDate)
    window.setTimeout(() => setAnnouncement(''), 5000)
  }

  function downloadCSV() {
    const blob = new Blob([serializeCSV(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sparta-umc-choir-catalog-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  let content
  if (loading && route.page !== 'catalog') {
    content = <main className="page-shell single-page"><div className="loading-state" role="status"><LoaderCircle aria-hidden="true" className="spin" size={28} />Loading the catalog…</div></main>
  } else if (route.page === 'detail') {
    content = <EntryDetail entry={currentEntry} onEdit={() => requireAdmin(`edit/${encodeURIComponent(route.id)}`)} />
  } else if (route.page === 'add') {
    content = adminPassword ? <EntryForm mode="add" password={adminPassword} onSaved={handleSaved} /> : <main className="page-shell"><EmptyState filtered /></main>
  } else if (route.page === 'edit') {
    content = adminPassword && currentEntry
      ? <EntryForm mode="edit" initialEntry={currentEntry} password={adminPassword} onSaved={handleSaved} />
      : <EntryDetail entry={currentEntry} onEdit={() => requireAdmin(`edit/${encodeURIComponent(route.id)}`)} />
  } else {
    content = (
      <main className="page-shell catalog-layout">
        <section className="toolbar" aria-label="Catalog tools">
          <div className="search-box">
            <Search aria-hidden="true" size={20} />
            <label className="sr-only" htmlFor="catalog-search">Search the music catalog</label>
            <input
              id="catalog-search"
              type="search"
              placeholder="Search title, composer, scripture, theme, or catalog number"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && <button type="button" className="search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search"><X aria-hidden="true" size={18} /></button>}
          </div>
          <button type="button" className="button button-secondary" onClick={downloadCSV}><Download aria-hidden="true" size={18} />Download Database as CSV</button>
          <button type="button" className="button button-secondary" onClick={() => setImportDialogOpen(true)}><FileUp aria-hidden="true" size={18} />Upload Database</button>
          <button type="button" className="button button-primary" onClick={() => requireAdmin('add')}><Plus aria-hidden="true" size={18} />Add Entry</button>
        </section>

        <aside className="filter-sidebar" aria-label="Catalog filters">
          <div className="sidebar-heading">
            <div><Filter aria-hidden="true" size={19} /><h2>Filters</h2>{activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}</div>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters}><RotateCcw aria-hidden="true" size={15} />Clear all</button>}
          </div>
          <FilterSection id="season" title="Liturgical Season / Holiday" icon={CalendarDays}>
            <CheckboxList values={seasons} selected={selectedSeasons} onToggle={(value) => toggleSelection(setSelectedSeasons, value)} />
          </FilterSection>
          <FilterSection id="themes" title="Themes & Topics" icon={BookOpen}>
            <CheckboxList values={themes} selected={selectedThemes} onToggle={(value) => toggleSelection(setSelectedThemes, value)} />
          </FilterSection>
          <FilterSection id="composer" title="Composer" icon={Music2}>
            <CheckboxList values={composers} selected={selectedComposers} onToggle={(value) => toggleSelection(setSelectedComposers, value)} />
          </FilterSection>
          <FilterSection id="performed" title="Last Performed" icon={CalendarDays}>
            <div className="date-filter">
              <label><span>Oldest date</span><input type="date" value={oldestDate} max={newestDate || undefined} onChange={(event) => setOldestDate(event.target.value)} /></label>
              <label><span>Most recent date</span><input type="date" value={newestDate} min={oldestDate || undefined} onChange={(event) => setNewestDate(event.target.value)} /></label>
              <small>Entries without a performance date are excluded when a date is selected.</small>
            </div>
          </FilterSection>
          <FilterSection id="parts" title="Parts / Voicing" icon={Users}>
            <CheckboxList values={parts} selected={selectedParts} onToggle={(value) => toggleSelection(setSelectedParts, value)} emptyLabel="Parts will appear here as they are added to entries." />
          </FilterSection>
        </aside>

        <section className="catalog-results" aria-labelledby="results-heading">
          <div className="results-heading">
            <div>
              <span className="eyebrow">Music Library</span>
              <h1 id="results-heading">Choir Catalog</h1>
            </div>
            <p aria-live="polite">Showing <strong>{filteredData.length}</strong> of <strong>{data.length}</strong> entries</p>
          </div>
          {loading ? (
            <div className="loading-state" role="status"><LoaderCircle aria-hidden="true" className="spin" size={28} />Loading the catalog…</div>
          ) : loadError ? (
            <div className="form-error load-error" role="alert"><AlertCircle aria-hidden="true" size={20} />{loadError}</div>
          ) : filteredData.length ? (
            <>
              <CatalogSortHeader sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <div className="catalog-list">{sortedData.map((entry) => <CatalogCard key={`${entry['Catalog Number']}-${entry.Title}`} entry={entry} />)}</div>
            </>
          ) : <EmptyState filtered={Boolean(searchTerm || activeFilterCount)} />}
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to catalog</a>
      <Header backupDate={backupDate} authenticated={Boolean(adminPassword)} onLogout={handleLogout} />
      <div id="main-content" tabIndex="-1">{content}</div>
      <footer className="site-footer">
        <img src={`${import.meta.env.BASE_URL}umc-cross-flame.png`} alt="" aria-hidden="true" />
        <p>Questions or comments about this music website should be directed to Mike Maksimchuk. All other questions, concerns, or comments should be directed to God.</p>
      </footer>
      <AuthDialog open={authDialogOpen} onClose={() => { setAuthDialogOpen(false); setPendingRoute('') }} onAuthenticated={handleAuthenticated} />
      <DatabaseImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} onCatalogChanged={handleCatalogImport} />
      <div className="sr-only" aria-live="polite">{announcement}</div>
    </div>
  )
}
