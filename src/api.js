import initialBooks from './data/initial-books.json' with { type: 'json' }
import { categoryLoaders, bookSnapshotCategories } from './data/category-loaders.js'
import { safeUrl, validResponse, categoryPath, snapshotCategory, validSnapshot } from './bookData.js'
export { categories, safeUrl, validBook } from './bookData.js'

// Use the public API by default and avoid double slashes when adding a path.
export const API_BASE = (import.meta.env?.VITE_GUTENDEX_API_URL || 'https://gutendex.com').replace(/\/+$/, '')

// Keep recent responses in memory, with separate limits for lists and full books.
// Expiration refreshes metadata; limits prevent long browsing sessions growing forever.
const CACHE_TTL = 5 * 60 * 1000
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000
const STORAGE_KEY = `gutendex-responses-v1:${API_BASE}`
const MAX_STORAGE_SIZE = 1000000
const configuredTimeout = Number(import.meta.env?.VITE_API_TIMEOUT_MS)
export const REQUEST_TIMEOUT = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
  ? Math.min(configuredTimeout, 90000) : 60000
export const SLOW_RESPONSE_DELAY = 5000
const collections = new Map()
const books = new Map()
let restored = false
const loadedSnapshots = new Map()
const snapshotBooks = new Map()
let persistencePending = false

// Storage is optional: blocked, full or damaged storage must not break browsing.
function restoreCache() {
  if (restored) return
  restored = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || raw.length > MAX_STORAGE_SIZE) return
    const stored = JSON.parse(raw)
    for (const [name, cache, limit] of [['collections', collections, 20], ['books', books, 200]]) {
      if (!Array.isArray(stored[name])) continue
      for (const item of stored[name].slice(-limit)) {
        if (!Array.isArray(item) || item.length !== 2) continue
        const [path, entry] = item
        if (typeof path === 'string' && entry && Number.isFinite(entry.updatedAt)
          && entry.updatedAt <= Date.now() && Date.now() - entry.updatedAt < MAX_CACHE_AGE
          && validResponse(entry.data, name === 'collections')) {
          cache.set(path, entry)
        }
      }
    }
  } catch {
    // Continue with the in-memory cache and bundled initial list.
  }
}

function persistCache() {
  try {
    const stored = { collections: [...collections], books: [...books] }
    let serialized = JSON.stringify(stored)
    // Bound the serialized payload as well as the number of entries.
    while (serialized.length > MAX_STORAGE_SIZE && (stored.books.length || stored.collections.length)) {
      if (stored.books.length) stored.books.shift()
      else stored.collections.shift()
      serialized = JSON.stringify(stored)
    }
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch {
    // A quota or privacy restriction only disables persistence.
  }
}

function schedulePersistence() {
  if (typeof window === 'undefined' || persistencePending) return
  persistencePending = true
  // Yield through a frame and task before doing optional synchronous storage work.
  // Coalesce responses; favorites keep their separate immediate persistence.
  const write = () => {
    persistencePending = false
    persistCache()
  }
  const idle = () => {
    if (window.requestIdleCallback) window.requestIdleCallback(write, { timeout: 2000 })
    else setTimeout(write, 0)
  }
  window.requestAnimationFrame(() => setTimeout(idle, 0))
}

export async function loadSnapshot(path, collection = false) {
  if (API_BASE !== 'https://gutendex.com') return
  const bookId = !collection && /^\/books\/([1-9]\d*)$/.exec(path)?.[1]
  const category = collection ? snapshotCategory(path) : bookSnapshotCategories[bookId]
  const loader = categoryLoaders[category]
  if (!loader) return
  const snapshotPath = categoryPath(category)
  if (loadedSnapshots.has(snapshotPath)) return
  try {
    const { default: snapshot } = await loader()
    if (validSnapshot(snapshot, category)) {
      const entry = {
        data: snapshot.data,
        updatedAt: Date.parse(snapshot.fetchedAt),
        source: snapshot.source,
        stale: true,
        snapshot: true,
      }
      loadedSnapshots.set(snapshotPath, entry)
      // Keep full snapshot metadata separate from fresh API data and compact favorites.
      for (const book of snapshot.data.results) {
        const detailPath = `/books/${book.id}`
        const previous = snapshotBooks.get(detailPath)
        if (!previous || previous.updatedAt < entry.updatedAt) {
          snapshotBooks.set(detailPath, { ...entry, data: book })
        }
      }
    }
  } catch {
    // A missing or failed chunk never prevents trying the real API.
  }
}

export function cachedBookState(path, collection = false) {
  restoreCache()
  const cache = collection ? collections : books
  const entry = cache.get(path)
  const cached = entry && Date.now() - entry.updatedAt < MAX_CACHE_AGE
    ? { ...entry, stale: Date.now() - entry.updatedAt >= CACHE_TTL } : undefined
  if (!cached) cache.delete(path)
  // Public snapshots cover exact first-page collections and their individual books.
  if (API_BASE === 'https://gutendex.com') {
    const data = collection
      ? path === '/books?' ? initialBooks.data : undefined
      : initialBooks.data.results.find((book) => path === `/books/${book.id}`)
    const home = data ? {
      data, updatedAt: Date.parse(initialBooks.fetchedAt), source: initialBooks.source,
      stale: true, snapshot: true,
    } : undefined
    const category = collection ? loadedSnapshots.get(path) : snapshotBooks.get(path)
    const snapshot = category && (!home || category.updatedAt > home.updatedAt) ? category : home
    if (snapshot && (!cached || snapshot.updatedAt > cached.updatedAt)) return snapshot
  }
  return cached
}

export function cachedBooks(path, collection = false) {
  const entry = cachedBookState(path, collection)
  return entry && !entry.stale ? entry.data : undefined
}

function remember(cache, path, data, limit) {
  cache.delete(path)
  cache.set(path, { data, updatedAt: Date.now() })
  if (cache.size > limit) cache.delete(cache.keys().next().value)
}

export function resource(book, mime) {
  // Ignore charset parameters when matching MIME types. Return the matching URL,
  // excluding ZIP archives that cannot be opened directly as a book or cover.
  return Object.entries(book.formats || {}).find(([type, url]) => (
    type.split(';')[0].trim().toLowerCase() === mime
    && safeUrl(url)
    && !new URL(url).pathname.toLowerCase().endsWith('.zip')
  ))?.[1]
}

// Optional metadata can be absent or contain invalid items; views receive a usable list.
export const strings = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === 'string' && item.trim()) : []

export function authorNames(book) {
  // Extract names without assuming every author object contains a valid name.
  return Array.isArray(book.authors)
    ? book.authors.map((author) => author?.name).filter((name) => typeof name === 'string' && name.trim()) : []
}

function requestError(message, kind, status) {
  return Object.assign(new Error(message), { kind, status })
}

export async function fetchBooks(path, signal, collection = false, refresh = false) {
  signal?.throwIfAborted()
  const cached = !refresh && cachedBooks(path, collection)
  if (cached) return cached
  const timeoutController = new AbortController()
  const timeout = timeoutController.signal
  const timer = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    // The caller owns cancellation. Preserve AbortError so cancellation stays silent.
    let response
    try {
      response = await fetch(`${API_BASE}${path}`, { signal: requestSignal })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw requestError('Kunne ikke kontakte boktjenesten. Prøv igjen om litt.', 'network')
    }
    // HTTP errors do not reject fetch automatically. Keep the status for the 404 view.
    if (!response.ok) {
      throw requestError(response.status === 404
        ? 'Fant ikke boken eller siden.' : `Boktjenesten svarte med HTTP ${response.status}. Prøv igjen om litt.`,
      'http', response.status)
    }
    // A successful HTTP response can still contain invalid JSON, such as an error page.
    let data
    try {
      data = await response.json()
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw requestError('Boktjenesten sendte ugyldig JSON. Prøv igjen.', 'json')
    }
    // Collections have pagination metadata; detail requests return a single book.
    // Validate this boundary before components attempt to render the response.
    const valid = validResponse(data, collection)
    if (!valid) throw requestError('Boktjenesten sendte et uventet svar. Prøv igjen.', 'data')
    requestSignal.throwIfAborted()
    if (collection) {
      remember(collections, path, data, 20)
      // Collection results contain full API books, unlike compact saved favorites.
      for (const book of data.results) {
        remember(books, `/books/${book.id}`, book, 200)
      }
    } else {
      remember(books, path, data, 200)
    }
    schedulePersistence()
    return data
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (timeout.aborted) {
      throw requestError(`Boktjenesten svarte ikke innen ${REQUEST_TIMEOUT / 1000} sekunder. Prøv igjen om litt.`, 'timeout')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
