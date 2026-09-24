import { expect, test } from '@playwright/test'
import { categoryDetailFixture } from './snapshot-fixture.js'

test.use({ baseURL: 'http://127.0.0.1:4174' })

test('custom API never uses public snapshots and StrictMode leaves requests usable', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('http://127.0.0.1:4999/**', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  for (const url of ['/', '/category/Fiction', '/books/1342', `/books/${categoryDetailFixture().book.id}`]) {
    await page.goto(url)
    await expect(page.getByRole('alert')).toContainText('HTTP 503')
    await expect(page.locator('.book-card')).toHaveCount(0)
    await expect(page.locator('.book-detail')).toHaveCount(0)
  }
  await page.unroute('http://127.0.0.1:4999/**')
  await page.route('http://127.0.0.1:4999/**', (route) => route.fulfill({ json: {
    count: 1, results: [{ id: 900001, title: 'Custom Fiction' }], next: null, previous: null,
  } }))
  await page.goto('/category/Fiction')
  await expect(page.locator('.book-card h2')).toHaveText(['Custom Fiction'])
  expect(errors).toEqual([])
})
