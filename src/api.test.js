import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { cachedBooks, cachedBookState, fetchBooks, loadSnapshot } from './api.js'
import { categories, categoryPath, snapshotCategory, validSnapshot } from './bookData.js'
import home from './data/initial-books.json' with { type: 'json' }
import { categoryLoaders, bookSnapshotCategories } from './data/category-loaders.js'

// Vite transforms browser JSON imports into JavaScript. Native Node tests read
// the same fixtures through fs; Playwright verifies the actual browser loaders.
const browserLoaders = { ...categoryLoaders }
before(() => {
  for (const category of Object.keys(categoryLoaders)) {
    categoryLoaders[category] = async () => ({
      default: JSON.parse(await readFile(
        new URL(`./data/categories/${category}.json`, import.meta.url),
        'utf8',
      )),
    })
  }
})
after(() => Object.assign(categoryLoaders, browserLoaders))

test('cached navigation reuses full books and refresh still contacts the API', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let calls = 0
  let now = originalNow()
  const book = { id: 101, title: 'Example', summaries: ['Full metadata'] }
  const page = { count: 1, results: [book], next: null, previous: null }
  const path = '/books?search=cache-test'

  try {
    Date.now = () => now
    globalThis.fetch = async () => {
      calls += 1
      return { ok: true, json: async () => page }
    }

    await fetchBooks(path, undefined, true)
    assert.equal(await fetchBooks(path, undefined, true), page)
    assert.equal(await fetchBooks('/books/101'), book)
    assert.equal(calls, 1, 'returning to the list and opening its book need no extra requests')
    assert.equal(cachedBooks(path), undefined, 'collection and detail caches stay separate')

    await fetchBooks(path, undefined, true, true)
    assert.equal(calls, 2, 'explicit retry bypasses cached data')

    const controller = new AbortController()
    controller.abort()
    await assert.rejects(fetchBooks(path, controller.signal, true), { name: 'AbortError' })

    now += 5 * 60 * 1000 + 1
    assert.equal(cachedBooks('/books/101'), undefined)
    assert.equal(cachedBookState('/books/101').data, book, 'stale data remains available for background refresh')
    assert.equal(cachedBookState('/books/101').stale, true)
    await fetchBooks(path, undefined, true)
    assert.equal(calls, 3, 'expired responses are fetched again')

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ invalid: true }) })
    await assert.rejects(fetchBooks('/books?invalid', undefined, true))
    assert.equal(cachedBooks('/books?invalid', true), undefined)

    globalThis.fetch = async () => ({ ok: false, status: 404 })
    await assert.rejects(fetchBooks('/books/999'), { status: 404 })
    assert.equal(cachedBooks('/books/999'), undefined)

    globalThis.fetch = async () => ({ ok: true, json: async () => page })
    for (let index = 0; index < 21; index += 1) {
      await fetchBooks(`/books?limit=${index}`, undefined, true)
    }
    assert.equal(cachedBooks('/books?limit=0', true), undefined)
    assert.equal(cachedBooks('/books?limit=20', true), page)
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
  }
})

test('category snapshot scope is exact', () => {
  for (const category of categories) {
    assert.equal(snapshotCategory(categoryPath(category)), category)
  }
  for (const path of ['/books?search=Fiction', '/books?topic=Fiction&page=2',
    '/books?topic=Fiction&search=test', '/books?topic=Unknown', '/books/1342']) {
    assert.equal(snapshotCategory(path), null)
  }
})

test('request failures retain their category and navigation cancellation stays silent', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(fetchBooks('/books?test=network', undefined, true), { kind: 'network' })
    globalThis.fetch = async () => ({ ok: false, status: 503 })
    await assert.rejects(fetchBooks('/books?test=http', undefined, true), { kind: 'http', status: 503 })
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })
    await assert.rejects(fetchBooks('/books?test=json', undefined, true), { kind: 'json' })
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ count: 3, results: null }) })
    await assert.rejects(fetchBooks('/books?test=data', undefined, true), { kind: 'data' })
    globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
    const controller = new AbortController()
    const pending = fetchBooks('/books?test=cancel', controller.signal, true)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('indexed detail fallback preserves provenance and yields to newer API metadata', async () => {
  const [id, category] = Object.entries(bookSnapshotCategories)
    .find(([id]) => !home.data.results.some((book) => book.id === Number(id)))
  const path = `/books/${id}`
  const { default: snapshot } = await categoryLoaders[category]()
  const book = snapshot.data.results.find((item) => item.id === Number(id))
  await loadSnapshot(path)
  const cached = cachedBookState(path)
  assert.deepEqual(cached.data, book)
  assert.equal(cached.source, snapshot.source)
  assert.equal(cached.updatedAt, Date.parse(snapshot.fetchedAt))
  assert.equal(cached.snapshot, true)
  assert.equal(cached.stale, true)
  assert.equal(cachedBooks(path), undefined, 'snapshot metadata must still refresh')
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...book, title: 'New API title' }) })
    await fetchBooks(path)
    assert.equal(cachedBookState(path).data.title, 'New API title')
    assert.equal(cachedBookState(path).snapshot, undefined)
    assert.equal(cachedBookState(path).stale, false)
    // Snapshot collections retain the actual original timestamp after detail refresh.
    assert.equal(cachedBookState(categoryPath(category), true).updatedAt, Date.parse(snapshot.fetchedAt))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('generated detail index covers the newest genuine snapshot for every bundled category book', async () => {
  const expected = new Map()
  for (const [category, loader] of Object.entries(categoryLoaders)) {
    const { default: snapshot } = await loader()
    assert.equal(validSnapshot(snapshot, category), true)
    for (const book of snapshot.data.results) {
      const updatedAt = Date.parse(snapshot.fetchedAt)
      if (!expected.has(book.id) || expected.get(book.id).updatedAt < updatedAt) {
        expected.set(book.id, { category, updatedAt })
      }
    }
  }
  assert.deepEqual(bookSnapshotCategories,
    Object.fromEntries([...expected].map(([id, entry]) => [id, entry.category])))
})
