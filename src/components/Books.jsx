import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authorNames, resource } from '../api'
import { useFavorites } from '../context/useFavorites'

// Shared cover rendering for collection cards and book details.
export function Cover({ book }) {
  // Try the API's JPEG first, then PNG. Remember a failed URL to avoid retry loops.
  const src = resource(book, 'image/jpeg') || resource(book, 'image/png')
  const [broken, setBroken] = useState(null)
  return (
    <div className="cover">
      {/* Missing or failed images keep a visible placeholder in the cover area. */}
      {src && broken !== src
        ? <img src={src} alt={`Omslag til ${book.title}`} loading="lazy" onError={() => setBroken(src)} />
        : <div className="cover-placeholder"><span aria-hidden="true">▤</span><span>Omslag mangler</span></div>}
    </div>
  )
}

// Accessible favorite controls share the same state across all pages.
export function FavoriteButton({ book }) {
  // Derive the button state from the shared list so every copy of this book stays in sync.
  const { favorites, toggle } = useFavorites()
  const saved = favorites.some((item) => item.id === book.id)
  const label = saved ? 'Fjern fra favoritter' : 'Legg til i favoritter'
  return (
    <button className="favorite-button" aria-pressed={saved} aria-label={`${label}: ${book.title}`} onClick={() => toggle(book)}>
      <span aria-hidden="true">{saved ? '♥' : '♡'}</span> {label}
    </button>
  )
}

// Reuse the same card layout for API results, snapshots and saved favorites.
export function BookGrid({ books }) {
  return (
    <div className="book-grid">
      {books.map((book) => (
        <article className="book-card" key={book.id}>
          {/* Route by ID so the detail URL also works when opened directly. */}
          <Link className="book-link" to={`/books/${book.id}`}>
            <Cover book={book} />
            <h2>{book.title || 'Ukjent tittel'}</h2>
            <p>{authorNames(book).join(' · ') || 'Ukjent forfatter'}</p>
            <span className="detail-link">Se boken <span aria-hidden="true">↗</span></span>
          </Link>
          {/* Keep this button outside the link so saving does not open the detail page. */}
          <FavoriteButton book={book} />
        </article>
      ))}
    </div>
  )
}

// Request feedback distinguishes an empty view from usable fallback data.
export function RequestState({ loading, error, retry, data, updatedAt, snapshot, stale, refreshing, slow }) {
  // Announce loading politely and errors immediately; successful requests need no message.
  if (loading) return <p className="state-box" role="status">
    {slow ? 'Boktjenesten bruker litt tid. Vi venter fortsatt på svar …' : 'Henter bøker fra biblioteket …'}
  </p>
  // Keep existing books visible while explaining their age and refresh status.
  if (data && (snapshot || stale || error || refreshing)) return (
    <div className="notice" role="status">
      <p>
        Viser {snapshot ? 'forhåndslagrede' : 'lagrede'} bokdata
        {updatedAt ? ` fra ${new Date(updatedAt).toLocaleString('nb-NO')}` : ''}.
        {refreshing ? slow ? ' Oppdateringen tar litt tid …' : ' Oppdaterer …' : ''}
      </p>
      {/* A failed refresh can be retried without discarding the displayed books. */}
      {error && <>
        <p>{error.message} Lagrede bøker er fortsatt tilgjengelige.</p>
        <button onClick={retry}>Prøv igjen</button>
      </>}
    </div>
  )
  // Use the full error view only when no usable data remains.
  if (error) return (
    <div className="state-box" role="alert">
      <h2>Vi fikk ikke hentet innholdet</h2>
      <p>{error.message}</p>
      <button onClick={retry}>Prøv igjen</button>
    </div>
  )
  return null
}
