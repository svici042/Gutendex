import { readFileSync, existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { categories, categoryPath } from '../src/bookData.js'

const storageKey = 'gutendex-responses-v1:https://gutendex.com'
const availableSnapshots = categories.filter((topic) => existsSync(new URL(`../src/data/categories/${topic}.json`, import.meta.url)))
const topicData = (topic, page = 1) => ({
  count: 64,
  next: page === 1 ? `https://gutendex.com/books/?topic=${topic}&page=2` : null,
  previous: page === 2 ? `https://gutendex.com/books/?topic=${topic}` : null,
  results: [{ id: 900000 + categories.indexOf(topic) * 10 + page, title: `${topic} page ${page} fresh` }],
})

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.abort())
})

test('all 13 links request their exact topic and render distinct API data', async ({ page }) => {
  const requested = []
  await page.route('https://gutendex.com/**', (route) => {
    const url = new URL(route.request().url())
    requested.push(url)
    const topic = url.searchParams.get('topic')
    return route.fulfill({ json: topicData(topic || 'Home') })
  })
  await page.goto('/')
  for (const topic of categories) {
    const topicRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('topic') === topic)
    await page.getByRole('link', { name: topic, exact: true }).click()
    await topicRequest
    await expect(page.locator('.book-card h2')).toHaveText([`${topic} page 1 fresh`])
    const url = requested.find((item) => item.searchParams.get('topic') === topic)
    expect(url.pathname).toBe('/books')
    expect([...url.searchParams]).toEqual([['topic', topic]])
  }
})

for (const topic of categories) {
  const file = new URL(`../src/data/categories/${topic}.json`, import.meta.url)
  test(`matching ${topic} snapshot survives API failure`, async ({ page }) => {
    test.skip(!existsSync(file), `No genuine ${topic} snapshot available`)
    const snapshot = JSON.parse(readFileSync(file, 'utf8'))
    await page.route('https://gutendex.com/**', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
    const started = Date.now()
    await page.goto(`/category/${topic}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.book-card h2')).toHaveText(snapshot.data.results.map((book) => book.title))
    console.log(`${topic} snapshot DOM: ${Date.now() - started} ms`)
    await expect(page.locator('.notice')).toContainText('HTTP 503')
    await expect(page.locator('.notice')).toContainText('forhåndslagrede')
    await expect(page.locator('.collection-heading')).toContainText(snapshot.data.count.toLocaleString('nb-NO'))
    expect(await page.locator('.pagination button').last().isEnabled()).toBe(Boolean(snapshot.data.next))
  })
}

test('an API response after eleven seconds replaces category snapshot data', async ({ page }) => {
  await page.route('https://gutendex.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 11000))
    await route.fulfill({ json: topicData('Fiction') })
  })
  const started = Date.now()
  await page.goto('/category/Fiction', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/tar litt tid|bruker litt tid/)).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.book-card h2')).toHaveText(['Fiction page 1 fresh'], { timeout: 15000 })
  await expect(page.locator('.notice')).toHaveCount(0)
  console.log(`Controlled fresh category response applied: ${Date.now() - started} ms (11000 ms API delay)`)
})

test('pagination, Back/Forward and cache hits retain the category', async ({ page }) => {
  let calls = 0
  await page.route('https://gutendex.com/**', (route) => {
    calls += 1
    const url = new URL(route.request().url())
    return route.fulfill({ json: topicData(url.searchParams.get('topic'), Number(url.searchParams.get('page') || 1)) })
  })
  await page.goto('/category/Mystery')
  await expect(page.locator('.book-card h2')).toHaveText(['Mystery page 1 fresh'])
  await page.getByRole('button', { name: 'Neste →' }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Mystery page 2 fresh'])
  const started = Date.now()
  await page.goBack()
  await expect(page.locator('.book-card h2')).toHaveText(['Mystery page 1 fresh'])
  console.log(`Cached Back navigation: ${Date.now() - started} ms`)
  await page.goForward()
  await expect(page.locator('.book-card h2')).toHaveText(['Mystery page 2 fresh'])
  expect(calls).toBe(2)
})

test('failed revisit starts a new request and retry stays scoped', async ({ page }) => {
  let fail = true
  let fictionCalls = 0
  await page.route('https://gutendex.com/**', async (route) => {
    const topic = new URL(route.request().url()).searchParams.get('topic')
    if (topic === 'Fiction') fictionCalls += 1
    if (topic === 'Mystery') {
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (fail) return route.fulfill({ status: 503, body: 'Unavailable' })
    }
    return route.fulfill({ json: topicData(topic) })
  })
  await page.goto('/category/Mystery')
  await expect(page.getByText(/HTTP 503/)).toBeVisible()
  await page.getByRole('link', { name: 'Fiction', exact: true }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Fiction page 1 fresh'])
  await page.getByRole('link', { name: 'Mystery', exact: true }).click()
  await expect(page.getByText(/HTTP 503/)).toHaveCount(0)
  await expect(page.getByText(/HTTP 503/)).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Prøv igjen' }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Mystery page 1 fresh'])
  await page.getByRole('link', { name: 'Fiction', exact: true }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Fiction page 1 fresh'])
  expect(fictionCalls).toBe(1)
})

test('rapid switching cancels the obsolete request', async ({ page }) => {
  const cancelled = []
  page.on('requestfailed', (request) => cancelled.push(request.url()))
  await page.route('https://gutendex.com/**', async (route) => {
    const topic = new URL(route.request().url()).searchParams.get('topic')
    if (topic === 'Romance') await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ json: topicData(topic) })
  })
  const startedRequest = page.waitForRequest((request) => request.url().includes('topic=Romance'))
  await page.goto('/category/Romance', { waitUntil: 'domcontentloaded' })
  await startedRequest
  await page.getByRole('link', { name: 'War', exact: true }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['War page 1 fresh'])
  await page.waitForTimeout(1600)
  await expect(page.locator('.book-card h2')).toHaveText(['War page 1 fresh'])
  expect(cancelled.some((url) => url.includes('topic=Romance'))).toBe(true)
})

test('snapshots never fill search results or later pages', async ({ page }) => {
  await page.route('https://gutendex.com/**', (route) => route.abort())
  for (const url of ['/?search=Fiction', '/?page=2', '/category/Fiction?page=2']) {
    await page.goto(url)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('.book-card')).toHaveCount(0)
  }
})

test('only the requested category chunk loads and missing categories stay empty on failure', async ({ page }) => {
  test.skip(!availableSnapshots.length, 'No genuine category snapshots available')
  const loaded = []
  page.on('request', (request) => {
    if (categories.some((topic) => request.url().includes(`/assets/${topic}-`))) loaded.push(request.url())
  })
  await page.route('https://gutendex.com/**', (route) => route.abort())
  await page.goto('/')
  await expect(page.locator('.book-card')).toHaveCount(32)
  expect(loaded).toEqual([])
  const topic = availableSnapshots[0]
  await page.getByRole('link', { name: topic, exact: true }).click()
  await expect(page.locator('.notice')).toContainText('forhåndslagrede')
  expect(loaded.length).toBe(1)
  expect(loaded[0]).toContain(`/assets/${topic}-`)
  const missing = categories.find((category) => !availableSnapshots.includes(category))
  if (missing) {
    await page.getByRole('link', { name: missing, exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('.book-card')).toHaveCount(0)
  }
})

test('newer browser data wins and favorites survive refresh', async ({ page }) => {
  await page.addInitScript(({ key, path, data }) => {
    localStorage.setItem(key, JSON.stringify({
      collections: [[path, { data, updatedAt: Date.now() }]], books: [],
    }))
  }, { key: storageKey, path: categoryPath('Fiction'), data: topicData('Fiction') })
  let calls = 0
  await page.route('https://gutendex.com/**', (route) => { calls += 1; return route.abort() })
  await page.goto('/category/Fiction')
  await expect(page.locator('.book-card h2')).toHaveText(['Fiction page 1 fresh'])
  await page.locator('.favorite-button').click()
  await page.reload()
  await page.getByRole('link', { name: 'Favoritter 1' }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Fiction page 1 fresh'])
  expect(calls).toBe(0)
})
