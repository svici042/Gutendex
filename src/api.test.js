import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cachedBooks, fetchBooks } from './api.js'

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
