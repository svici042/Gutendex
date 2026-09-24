import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cachedBookState, fetchBooks, loadSnapshot, SLOW_RESPONSE_DELAY } from '../api'

// Coordinate route changes, local fallback data and background API requests.
export default function useBooks(path, collection = false) {
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const retryTarget = useRef(null)
  // A new history entry or retry has its own identity, including revisits to failed URLs.
  const identity = useMemo(() => ({ path, collection, key: location.key, attempt }),
    [path, collection, location.key, attempt])
  // Seed each route immediately and prevent the previous route's data flashing.
  const cached = path ? cachedBookState(path, collection) : undefined
  const pending = { identity, ...cached, refreshing: Boolean(cached) }
  const [state, setState] = useState(pending)
  if (state.identity !== identity) setState(pending)
  const current = state.identity === identity ? state : pending

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let active = true
    // An explicit retry bypasses fresh cache only for its original target.
    const force = retryTarget.current?.path === path
      && retryTarget.current?.collection === collection
    retryTarget.current = null
    // Slow feedback does not cancel the request or shorten its timeout.
    const slowTimer = setTimeout(() => {
      if (active) setState((previous) => previous.identity === identity
        ? { ...previous, slow: true } : previous)
    }, SLOW_RESPONSE_DELAY)

    async function load() {
      // This is a local, lazy chunk, not another request to the public API.
      await loadSnapshot(path, collection)
      if (!active) return
      const available = cachedBookState(path, collection)
      setState({ identity, ...available, refreshing: Boolean(available) })
      // Replace fallback data on success; preserve it when refreshing fails.
      try {
        const data = await fetchBooks(path, controller.signal, collection, force || Boolean(available?.stale))
        if (active) setState({
          identity, data, updatedAt: cachedBookState(path, collection)?.updatedAt,
        })
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setState({ identity, ...available, error })
        }
      } finally {
        clearTimeout(slowTimer)
      }
    }
    void load()
    // Navigation and StrictMode cleanup must not update an obsolete view.
    return () => {
      active = false
      clearTimeout(slowTimer)
      controller.abort()
    }
  }, [path, collection, identity])

  // A background refresh is not an initial loading screen when books exist.
  return {
    ...current,
    loading: Boolean(path) && !current.data && !current.error,
    retry: () => {
      retryTarget.current = { path, collection }
      setAttempt((value) => value + 1)
    },
  }
}
