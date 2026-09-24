import { expect, test } from '@playwright/test'
import initialBooks from '../src/data/initial-books.json' with { type: 'json' }

// Local snapshot/render measurement, not public API latency.
test('home snapshot display is independent of API availability', async ({ page }) => {
  await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.abort())
  await page.route('https://gutendex.com/**', (route) => route.abort())
  const started = Date.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.book-card')).toHaveCount(initialBooks.data.results.length)
  console.log(`Home snapshot DOM: ${Date.now() - started} ms`)
  await expect(page.locator('.notice')).toContainText('forhåndslagrede')
})
