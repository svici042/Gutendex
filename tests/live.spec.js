import { expect, test } from '@playwright/test'
import { categories, validResponse } from '../src/bookData.js'

// No retries: each case makes one real request per operation and records HTTP evidence.
async function freshResponse(page, testInfo, label, matches, navigate, collection = true) {
  const started = Date.now()
  const outcomes = []
  const responseListener = (response) => {
    if (response.url().startsWith('https://gutendex.com/')) {
      outcomes.push({ url: response.url(), status: response.status(), ms: Date.now() - started })
    }
  }
  const failureListener = (request) => {
    if (request.url().startsWith('https://gutendex.com/')) {
      outcomes.push({ url: request.url(), failure: request.failure(), ms: Date.now() - started })
    }
  }
  page.on('response', responseListener)
  page.on('requestfailed', failureListener)
  const pending = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.origin === 'https://gutendex.com' && matches(url)
      && !(response.status() >= 300 && response.status() < 400)
  }, { timeout: 65000 }).then((response) => ({ response }), (error) => ({ error }))
  try {
    await navigate()
    const { response, error } = await pending
    if (error) throw error
    expect(response.ok(), `${label}: HTTP ${response.status()}`).toBe(true)
    const data = await response.json()
    expect(validResponse(data, collection)).toBe(true)
    if (collection) {
      await expect(page.locator('.book-card h2')).toHaveText(data.results.map((book) => book.title))
    } else {
      await expect(page.locator('.book-detail h1')).toHaveText(data.title)
    }
    await expect(page.locator('.notice')).toHaveCount(0)
    outcomes.push({ appliedToUI: true, ms: Date.now() - started })
    return data
  } finally {
    page.off('response', responseListener)
    page.off('requestfailed', failureListener)
    console.log(`${label}: ${JSON.stringify(outcomes)}`)
    await testInfo.attach(label, { body: JSON.stringify(outcomes, null, 2), contentType: 'application/json' })
  }
}

test.beforeEach(async ({ page }) => {
  // Cover delivery is deliberately outside these API checks.
  await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.abort())
})

for (const topic of categories) {
  test(`live topic response applied: ${topic}`, async ({ page }, testInfo) => {
    test.setTimeout(75000)
    await freshResponse(page, testInfo, topic,
      (url) => url.searchParams.get('topic') === topic,
      () => page.goto(`/category/${topic}`, { waitUntil: 'domcontentloaded' }))
  })
}

test('live header search and its next page', async ({ page }, testInfo) => {
  test.setTimeout(145000)
  await page.goto('/favorites')
  await page.getByRole('searchbox').fill('love')
  const data = await freshResponse(page, testInfo, 'search-love-page-1',
    (url) => url.searchParams.get('search') === 'love' && !url.searchParams.has('page'),
    () => page.getByRole('searchbox').press('Enter'))
  if (!data.next) {
    testInfo.annotations.push({ type: 'pagination', description: 'API returned no next page' })
    return
  }
  const nextPage = new URL(data.next).searchParams.get('page')
  await freshResponse(page, testInfo, 'search-love-next-page',
    (url) => url.searchParams.get('search') === 'love' && url.searchParams.get('page') === nextPage,
    () => page.getByRole('button', { name: 'Neste →' }).click())
})

test('live full book detail response applied', async ({ page }, testInfo) => {
  test.setTimeout(75000)
  await freshResponse(page, testInfo, 'book-1342',
    (url) => url.pathname.replace(/\/$/, '') === '/books/1342',
    () => page.goto('/books/1342', { waitUntil: 'domcontentloaded' }), false)
})
