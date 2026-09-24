import { expect, test } from '@playwright/test'
import { categoryDetailFixture } from './snapshot-fixture.js'

const { book, snapshot, category } = categoryDetailFixture()

// Exercise identical public-API fallback behavior in both Vite serving modes.
for (const [mode, baseURL] of [
  ['development', 'http://127.0.0.1:4175'],
  ['preview', 'http://127.0.0.1:4173'],
]) {
  test.describe(mode, () => {
    test.use({ baseURL })

    test('bundled category and category-only details survive an unavailable public API', async ({ page }) => {
      const moduleErrors = []
      const apiRequests = []
      page.on('pageerror', (error) => moduleErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error' && /MIME|JSON module|module script/i.test(message.text())) {
          moduleErrors.push(message.text())
        }
      })
      await page.route('https://gutendex.com/**', (route) => {
        apiRequests.push(route.request().url())
        return route.fulfill({ status: 503, body: 'Unavailable' })
      })
      await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.abort())

      await page.goto(`/category/${category}`)
      await expect(page.locator('.book-card h2')).toHaveText(
        snapshot.data.results.map((item) => item.title),
      )
      await expect(page.locator('.notice')).toContainText('HTTP 503')
      await page.locator(`a.book-link[href="/books/${book.id}"]`).click()
      await expect(page.locator('.book-detail h1')).toHaveText(book.title)
      await page.reload()
      await expect(page.locator('.book-detail h1')).toHaveText(book.title)
      await expect(page.locator('.authors')).toHaveText(
        book.authors.map((author) => author.name).join(' · '),
      )
      await expect(page.locator('.notice')).toContainText('HTTP 503')
      expect(apiRequests.some((url) => url.includes('topic='))).toBe(true)
      expect(apiRequests.some((url) => url.endsWith(`/books/${book.id}`))).toBe(true)
      expect(moduleErrors).toEqual([])
    })
  })
}
