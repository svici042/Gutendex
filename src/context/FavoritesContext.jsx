import { useState } from 'react'
import { authorNames, resource, validBook } from '../api'
import { FavoritesContext } from './useFavorites'

const STORAGE_KEY = 'gutendex-favorites'

function compactBook(book) {
  // Store only card metadata so saved books render after refresh without extra requests.
  const cover = resource(book, 'image/jpeg') || resource(book, 'image/png')
  return {
    id: book.id,
    title: book.title,
    authors: authorNames(book).map((name) => ({ name })),
    formats: cover ? { 'image/jpeg': cover } : {},
  }
}

function loadFavorites() {
  // Read once on mount; only subsequent user changes are written to storage.
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { books: [], notice: '' }
    // Parsing stored text does not guarantee that it contains a valid array of books.
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(validBook)) throw new Error('Invalid favorites')
    // Map keys are unique book IDs, so duplicate saved entries become a single favorite.
    return {
      books: [...new Map(parsed.map((book) => [book.id, compactBook(book)])).values()],
      notice: '',
    }
  } catch {
    // Broken JSON and blocked storage both fall back to a usable in-memory list.
    return { books: [], notice: 'Lagrede favoritter kunne ikke leses. Du kan fortsatt bruke favoritter i denne økten.' }
  }
}

export function FavoritesProvider({ children }) {
  // Passing the function reads storage during initialization rather than every render.
  // StrictMode may call it twice in development; loading does not modify storage.
  const [initial] = useState(loadFavorites)
  const [favorites, setFavorites] = useState(initial.books)
  const [notice, setNotice] = useState(initial.notice)
  function toggle(book) {
    // Create a new array: remove an existing ID or append a compact copy of a new book.
    const next = favorites.some((item) => item.id === book.id)
      ? favorites.filter((item) => item.id !== book.id)
      : [...favorites, compactBook(book)]
    setFavorites(next)
    // Persist only user changes, after initialization and outside state updaters.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setNotice('')
    } catch {
      // Keep the React update even if persistence fails, and explain the limitation.
      setNotice('Favorittene er bare lagret i minnet. Nettleseren kunne ikke lagre dem, og endringene forsvinner når siden lastes på nytt.')
    }
  }
  // Shared state synchronizes cards, detail pages and the header count.
  return (
    <FavoritesContext.Provider value={{ favorites, toggle, notice }}>
      {children}
    </FavoritesContext.Provider>
  )
}
