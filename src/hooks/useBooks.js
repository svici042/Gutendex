import { useEffect, useState } from 'react'
import { cachedBooks, fetchBooks } from '../api'

export default function useBooks(path, collection = false) {
  // Incrementing attempt retries the same URL without changing the browser address.
  const [attempt, setAttempt] = useState(0)
  // Save the request identity alongside its result to distinguish old and new responses.
  const [state, setState] = useState({})
  useEffect(() => {
    // Invalid routes pass null to show a fallback without calling the API.
    if (!path) return
    const controller = new AbortController()
    let active = true
    // Only this effect's active request may publish its data or error.
    fetchBooks(path, controller.signal, collection, attempt > 0)
      .then((data) => {
        if (active) setState({ path, collection, attempt, data })
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError') setState({ path, collection, attempt, error })
      })
    // Cancel requests and prevent already-resolved stale responses from winning.
    return () => {
      active = false
      controller.abort()
    }
  }, [path, collection, attempt])
  // Hide previous results immediately, before the new effect runs.
  // Read cached data during rendering so returning to a page has no loading flash.
  const cached = attempt === 0 && path ? cachedBooks(path, collection) : undefined
  const current = state.path === path && state.collection === collection && state.attempt === attempt
    ? state : cached ? { data: cached } : { loading: Boolean(path) }
  return { ...current, retry: () => setAttempt((value) => value + 1) }
}
