import { useEffect, useState } from 'react'
import { fetchBooks } from '../api'

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
    fetchBooks(path, controller.signal, collection)
      .then((data) => {
        if (active) setState({ path, attempt, data })
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError') setState({ path, attempt, error })
      })
    // Cancel requests and prevent already-resolved stale responses from winning.
    return () => {
      active = false
      controller.abort()
    }
  }, [path, collection, attempt])
  // Hide previous results immediately, before the new effect runs.
  const current = state.path === path && state.attempt === attempt
    ? state : { loading: Boolean(path) }
  return { ...current, retry: () => setAttempt((value) => value + 1) }
}
