import { expect, test } from '@playwright/test'
import { categoryDetailFixture } from './snapshot-fixture.js'

const { book, snapshot, category } = categoryDetailFixture()
const detailPath = `/books/${book.id}`

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50"><rect width="40" height="50" fill="tan"/></svg>',
  }))
})

async function expectSnapshotDetails(page) {
  await expect(page.locator('.book-detail h1')).toHaveText(book.title)
  await expect(page.locator('.authors')).toHaveText(book.authors.map((author) => author.name).join(' · '))
  await expect(page.locator('.detail-cover img')).toHaveAttribute('src', book.formats['image/jpeg'])
  await expect(page.locator('.metadata dd').last()).toHaveText(book.download_count.toLocaleString('nb-NO'))
  const languages = book.languages.map((code) => new Intl.DisplayNames(['nb'], { type: 'language' }).of(code))
  await expect(page.locator('.metadata dd').first()).toHaveText(languages.join(', '))
  await expect(page.locator('.topics li')).toHaveText([...new Set([...book.subjects, ...book.bookshelves])])
  const expectedFormats = ['text/html', 'application/epub+zip', 'text/plain'].flatMap((mime) => {
    const entry = Object.entries(book.formats).find(([type, url]) => type.split(';')[0] === mime && !url.endsWith('.zip'))
    return entry ? [entry[1]] : []
  })
  expect(await page.locator('.reading-links a').evaluateAll((links) => links.map((link) => link.href))).toEqual(expectedFormats)
  await expect(page.locator('.book-detail .favorite-button')).toBeVisible()
  await expect(page.locator('.notice')).toContainText('forhåndslagrede')
  const expectedDate = await page.evaluate((date) => new Date(date).toLocaleString('nb-NO'), snapshot.fetchedAt)
  await expect(page.locator('.notice')).toContainText(expectedDate)
}

test('category-only book opens immediately and survives reload with the API unavailable', async ({ page }) => {
  await page.route('https://gutendex.com/**', (route) => route.abort())
  await page.goto(`/category/${category}`)
  const started = Date.now()
  await page.locator(`a.book-link[href="${detailPath}"]`).click()
  await expectSnapshotDetails(page)
  console.log(`Category snapshot detail navigation: ${Date.now() - started} ms; book ${book.id}`)
  await page.reload()
  await expectSnapshotDetails(page)
  await expect(page.locator('.notice')).toContainText('fortsatt tilgjengelige')
  await page.screenshot({ path: 'test-results/desktop-category-detail.png', fullPage: true })
})

test('direct detail URL loads only its indexed category and works at mobile width', async ({ page }) => {
  const categoryChunks = []
  page.on('request', (request) => {
    if (/\/assets\/(Fiction|Mystery|Thriller|Romance|Fantasy|Morality|Society|Power|Justice|Adventure|Tragedy|War|Philosophy)-/.test(request.url())) {
      categoryChunks.push(request.url())
    }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('https://gutendex.com/**', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  const started = Date.now()
  await page.goto(detailPath, { waitUntil: 'domcontentloaded' })
  await expectSnapshotDetails(page)
  console.log(`Direct detail snapshot DOM: ${Date.now() - started} ms`)
  expect(categoryChunks).toHaveLength(1)
  expect(categoryChunks[0]).toContain(`/assets/${category}-`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/mobile-category-detail.png', fullPage: true })
  await page.locator('.book-detail .favorite-button').click()
  await page.reload()
  await expect(page.locator('.book-detail .favorite-button')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Favoritter 1' }).click()
  await expect(page.locator('.book-card h2')).toHaveText([book.title])
  await page.locator('.favorite-button').click()
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Favoritter 0' })).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-favorites.png' })
})

test('newer API detail cache takes precedence over bundled metadata', async ({ page }) => {
  await page.addInitScript(({ path, data }) => {
    localStorage.setItem('gutendex-responses-v1:https://gutendex.com', JSON.stringify({
      collections: [], books: [[path, { data: { ...data, title: 'Newer cached metadata' }, updatedAt: Date.now() }]],
    }))
  }, { path: detailPath, data: book })
  let requests = 0
  await page.route('https://gutendex.com/**', (route) => {
    requests += 1
    return route.fulfill({ json: { ...book, title: 'Fresh API metadata' } })
  })
  await page.goto(detailPath)
  await expect(page.locator('.book-detail h1')).toHaveText('Newer cached metadata')
  await expect(page.locator('.notice')).toHaveCount(0)
  expect(requests).toBe(0)
})

test('a real-shaped fresh response updates snapshot details in the background', async ({ page }) => {
  await page.route('https://gutendex.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.fulfill({ json: { ...book, title: 'Updated full detail metadata' } })
  })
  await page.goto(detailPath, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.book-detail h1')).toHaveText(book.title)
  await expect(page.locator('.book-detail h1')).toHaveText('Updated full detail metadata')
  await expect(page.locator('.notice')).toHaveCount(0)
})
