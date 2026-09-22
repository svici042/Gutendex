// Use the public API by default and avoid double slashes when adding a path.
export const API_BASE = (import.meta.env.VITE_GUTENDEX_API_URL || 'https://gutendex.com').replace(/\/+$/, '')
// Navigation and route validation share this list to keep their categories in sync.
export const categories = [
  'Fiction', 'Mystery', 'Thriller', 'Romance', 'Fantasy', 'Morality',
  'Society', 'Power', 'Justice', 'Adventure', 'Tragedy', 'War', 'Philosophy',
]

export function safeUrl(value) {
  // Accept web links only; malformed URLs and executable schemes are rejected.
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
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

export function validBook(book) {
  // Require only the fields needed to identify and display a book; others are optional.
  return book && Number.isSafeInteger(book.id) && book.id > 0 && typeof book.title === 'string'
}

// Optional metadata can be absent or contain invalid items; views receive a usable list.
export const strings = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === 'string' && item.trim()) : []

export function authorNames(book) {
  // Extract names without assuming every author object contains a valid name.
  return Array.isArray(book.authors)
    ? book.authors.map((author) => author?.name).filter((name) => typeof name === 'string' && name.trim()) : []
}

export async function fetchBooks(path, signal, collection = false) {
  // The caller owns cancellation. Preserve AbortError so cancellation stays silent.
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Kunne ikke kontakte boktjenesten. Kontroller internettforbindelsen og prøv igjen.')
  }
  // HTTP errors do not reject fetch automatically. Keep the status for the 404 view.
  if (!response.ok) {
    const error = new Error(response.status === 404
      ? 'Fant ikke boken eller siden.' : 'Kunne ikke hente bøker. Prøv igjen om litt.')
    error.status = response.status
    throw error
  }
  // A successful HTTP response can still contain invalid JSON, such as an error page.
  let data
  try {
    data = await response.json()
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Boktjenesten sendte et uventet svar. Prøv igjen.')
  }
  // Collections have pagination metadata; detail requests return a single book.
  // Validate this boundary before components attempt to render the response.
  const valid = collection
    ? data && Number.isFinite(data.count) && data.count >= 0
      && Array.isArray(data.results) && data.results.every(validBook)
      && [data.next, data.previous].every((link) => link === null || safeUrl(link))
    : validBook(data)
  if (!valid) throw new Error('Boktjenesten sendte et uventet svar. Prøv igjen.')
  return data
}
