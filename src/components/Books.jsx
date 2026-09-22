import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authorNames, resource } from '../api'
import { useFavorites } from '../context/useFavorites'

export function Cover({ book }) {
  // Try the API's JPEG first, then PNG. Remember a failed URL to avoid retry loops.
  const src = resource(book, 'image/jpeg') || resource(book, 'image/png')
  const [broken, setBroken] = useState(null)
  return (
    <div className="cover">
      {src && broken !== src
        ? <img src={src} alt={`Omslag til ${book.title}`} loading="lazy" onError={() => setBroken(src)} />
        : <div className="cover-placeholder"><span aria-hidden="true">▤</span><span>Omslag mangler</span></div>}
    </div>
  )
}

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

export function BookGrid({ books }) {
  return (
    <div className="book-grid">
      {books.map((book) => (
        <article className="book-card" key={book.id}>
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

export function RequestState({ loading, error, retry }) {
  // Announce loading politely and errors immediately; successful requests need no message.
  if (loading) return <p className="state-box" role="status">Henter bøker fra biblioteket …</p>
  if (error) return (
    <div className="state-box" role="alert">
      <h2>Vi fikk ikke hentet innholdet</h2>
      <p>{error.message}</p>
      <button onClick={retry}>Prøv igjen</button>
    </div>
  )
  return null
}
