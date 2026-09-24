import { expect, test } from '@playwright/test'
import initialBooks from '../src/data/initial-books.json' with { type: 'json' }

const storageKey = 'gutendex-responses-v1:https://gutendex.com'
const data = initialBooks.data

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/(www\.)?gutenberg\.org\//, (route) => route.abort())
})

test('snapshot remains usable offline, including details and favorites', async ({ page }) => {
  await page.route('https://gutendex.com/**', (route) => route.abort())
  await page.goto('/')
  await expect(page.locator('.book-card')).toHaveCount(32)
  await expect(page.locator('.notice')).toContainText('forhåndslagrede')
  await expect(page.locator('.notice')).toContainText('fortsatt tilgjengelige')
  await page.screenshot({ path: 'test-results/initial-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/initial-mobile.png' })
  await page.locator('.favorite-button').first().click()
  await page.locator('.book-link').first().click()
  await expect(page.locator('.book-detail h1')).toHaveText(data.results[0].title)
  await page.getByRole('link', { name: 'Favoritter 1' }).click()
  await expect(page.locator('.book-card')).toHaveCount(1)
})

test('responses survive reload and stale data updates in the background', async ({ page }) => {
  let calls = 0
  await page.route('https://gutendex.com/**', (route) => {
    calls += 1
    return route.fulfill({ json: data })
  })
  await page.goto('/?search=persist')
  await expect(page.locator('.book-card')).toHaveCount(32)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).not.toBeNull()
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(32)
  expect(calls).toBe(1)

  await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key))
    stored.collections.forEach(([, entry]) => { entry.updatedAt -= 6 * 60 * 1000 })
    localStorage.setItem(key, JSON.stringify(stored))
  }, storageKey)
  await page.unroute('https://gutendex.com/**')
  await page.route('https://gutendex.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ json: {
      ...data,
      results: [{ ...data.results[0], title: 'Updated title' }, ...data.results.slice(1)],
    } })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.book-card')).toHaveCount(32)
  await expect(page.locator('.notice')).toContainText('Oppdaterer')
  await expect(page.locator('.book-card h2').first()).toHaveText('Updated title')
})

test('bounded timeout offers retry while the initial list stays visible', async ({ page }) => {
  await page.clock.install()
  await page.route('https://gutendex.com/**', () => {})
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.book-card')).toHaveCount(32)
  await page.clock.fastForward(61000)
  await expect(page.getByText(/svarte ikke innen 60 sekunder/)).toBeVisible()
  await expect(page.locator('.book-card')).toHaveCount(32)
  await page.unroute('https://gutendex.com/**')
  await page.route('https://gutendex.com/**', (route) => route.fulfill({ json: data }))
  await page.getByRole('button', { name: 'Prøv igjen' }).click()
  await expect(page.locator('.notice')).toHaveCount(0)
})

test('damaged or unavailable storage does not prevent the first list', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), storageKey)
  await page.route('https://gutendex.com/**', (route) => route.fulfill({ json: data }))
  await page.goto('/')
  await expect(page.locator('.book-card')).toHaveCount(32)
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Blocked') }
    Storage.prototype.setItem = () => { throw new Error('Blocked') }
  })
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(32)
})

test('response persistence runs after fresh results render', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    window.persistenceChecks = []
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('gutendex-responses-')) {
        window.persistenceChecks.push(document.querySelector('.book-card h2')?.textContent)
      }
      return original.call(this, key, value)
    }
  })
  await page.route('https://gutendex.com/**', (route) => route.fulfill({ json: {
    count: 1, next: null, previous: null, results: [{ id: 900001, title: 'Rendered before storage' }],
  } }))
  await page.goto('/?search=deferred')
  await expect.poll(() => page.evaluate(() => window.persistenceChecks)).toEqual(['Rendered before storage'])
})
