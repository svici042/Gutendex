import { readFileSync } from 'node:fs'
import home from '../src/data/initial-books.json' with { type: 'json' }
import { bookSnapshotCategories } from '../src/data/category-loaders.js'

// Use genuine metadata outside the home fallback, selected from the generated index.
const homeIds = new Set(home.data.results.map((book) => book.id))
export function categoryDetailFixture() {
  for (const [id, category] of Object.entries(bookSnapshotCategories)) {
    if (homeIds.has(Number(id))) continue
    const snapshot = JSON.parse(readFileSync(new URL(`../src/data/categories/${category}.json`, import.meta.url), 'utf8'))
    const book = snapshot.data.results.find((item) => item.id === Number(id))
    if (book?.authors?.length && book.languages?.length && book.formats?.['image/jpeg']) {
      return { book, snapshot, category }
    }
  }
  throw new Error('No category-only book with full test metadata is available')
}
