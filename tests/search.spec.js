import { expect, test } from '@playwright/test'

test('header Enter and button search use API results and retain search during pagination', async ({ page }) => {
  const requests = []
  await page.route('https://gutendex.com/**', (route) => {
    const url = new URL(route.request().url())
    const search = url.searchParams.get('search')
    const number = Number(url.searchParams.get('page') || 1)
    requests.push({ search, number, topic: url.searchParams.get('topic') })
    return route.fulfill({ json: {
      count: 40,
      results: [{ id: number + 900000, title: `${search || 'Home'} result ${number}` }],
      next: number === 1 ? `https://gutendex.com/books/?${new URLSearchParams({ search: search || '', page: '2' })}` : null,
      previous: number === 2 ? `https://gutendex.com/books/?${new URLSearchParams({ search })}` : null,
    } })
  })
  await page.goto('/')
  const search = page.getByRole('searchbox')
  await search.fill('  Jane Austen  ')
  await search.press('Enter')
  await expect(page.locator('.book-card h2')).toHaveText(['Jane Austen result 1'])
  await page.getByRole('button', { name: 'Neste →' }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['Jane Austen result 2'])
  await expect(search).toHaveValue('Jane Austen')
  expect(new URL(page.url()).searchParams.get('page')).toBe('2')
  await page.goBack()
  await expect(page.locator('.book-card h2')).toHaveText(['Jane Austen result 1'])
  await search.fill('war & peace')
  await page.getByRole('button', { name: 'Søk', exact: true }).click()
  await expect(page.locator('.book-card h2')).toHaveText(['war & peace result 1'])
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(requests).toContainEqual({ search: 'Jane Austen', number: 2, topic: null })
  expect(requests).toContainEqual({ search: 'war & peace', number: 1, topic: null })
  await expect(page.locator('.site-header')).toBeVisible()
})
