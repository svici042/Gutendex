// Shared by the UI and the snapshot maintenance script.
export const categories = [
  'Fiction', 'Mystery', 'Thriller', 'Romance', 'Fantasy', 'Morality',
  'Society', 'Power', 'Justice', 'Adventure', 'Tragedy', 'War', 'Philosophy',
]

// Only encrypted web links may become cover URLs, reading links or pagination targets.
export function safeUrl(value) {
  try {
    const url = new URL(value)
    // Book metadata comes from outside the app; reject insecure and executable schemes.
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// Require stable identity and a title while allowing optional metadata to vary.
export function validBook(book) {
  return book && Number.isSafeInteger(book.id) && book.id > 0 && typeof book.title === 'string'
}

// Validate the different response shapes before caching or rendering them.
export function validResponse(data, collection) {
  return collection
    ? data && Number.isSafeInteger(data.count) && data.count >= 0
      && Array.isArray(data.results) && data.results.every(validBook)
      && [data.next, data.previous].every((link) => link === null || safeUrl(link))
    : validBook(data)
}

// Use one query format for requests, cache keys and snapshot attribution.
export function categoryPath(category) {
  return `/books?${new URLSearchParams({ topic: category })}`
}

// Snapshots cover only an exact category's first page, never searches or mixes.
export function snapshotCategory(path) {
  const url = new URL(path, 'https://gutendex.com')
  const params = [...url.searchParams]
  return url.pathname === '/books' && params.length === 1
    && params[0][0] === 'topic' && categories.includes(params[0][1])
    ? params[0][1] : null
}

// Check provenance, timestamp and first-page contents before accepting a bundle.
export function validSnapshot(snapshot, category) {
  const path = categoryPath(category)
  return snapshot?.query === path && snapshot.source === `https://gutendex.com${path}`
    && Number.isFinite(Date.parse(snapshot.fetchedAt)) && Date.parse(snapshot.fetchedAt) <= Date.now()
    && validResponse(snapshot.data, true) && snapshot.data.previous === null
    && snapshot.data.results.length <= 32
    && (snapshot.data.count === 0 || snapshot.data.results.length > 0)
    // Any continuation must remain on the public API and the same topic.
    && (snapshot.data.next === null || (
      new URL(snapshot.data.next).origin === 'https://gutendex.com'
      && new URL(snapshot.data.next).searchParams.get('topic') === category
      && new URL(snapshot.data.next).searchParams.get('page') === '2'
    ))
}
