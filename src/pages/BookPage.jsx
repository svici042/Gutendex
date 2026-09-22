import { Link, useParams } from 'react-router-dom'
import { authorNames, resource, strings } from '../api'
import useBooks from '../hooks/useBooks'
import { Cover, FavoriteButton, RequestState } from '../components/Books'
import NotFound from './NotFound'

function languageName(code) {
  // Use Norwegian language names when supported, retaining the code as a fallback.
  try {
    return new Intl.DisplayNames(['nb'], { type: 'language' }).of(code)
  } catch {
    return code
  }
}

export default function BookPage() {
  // Load from the route ID so direct links work without visiting a collection first.
  const { bookId } = useParams()
  const validId = /^[1-9]\d*$/.test(bookId) && Number.isSafeInteger(Number(bookId))
  const request = useBooks(validId ? `/books/${bookId}` : null)
  // Invalid IDs and missing books have dedicated views; other failures remain retryable.
  if (!validId) return <NotFound title="Ugyldig boknummer" />
  if (request.error?.status === 404) return <NotFound title="Boken finnes ikke" />
  const book = request.data
  if (!book) return <RequestState {...request} />

  // Prefer browser reading, then offer downloads only for formats present in the API.
  const formats = [
    ['text/html', 'Les i nettleseren'],
    ['application/epub+zip', 'Last ned EPUB'],
    ['text/plain', 'Les ren tekst'],
  ].map(([mime, label]) => ({ label, url: resource(book, mime) })).filter((item) => item.url)
  // Subjects and bookshelves can overlap; Set removes repeated labels from the list.
  const topics = [...new Set([...strings(book.subjects), ...strings(book.bookshelves)])]

  return (
    <>
      <Link className="back-link" to="/">← Til biblioteket</Link>
      <article className="book-detail">
        <div className="detail-cover"><Cover book={book} /></div>
        <div>
          <p className="eyebrow">Fra Project Gutenberg · Bok {book.id}</p>
          <h1>{book.title || 'Ukjent tittel'}</h1>
          <p className="authors">{authorNames(book).join(' · ') || 'Ukjent forfatter'}</p>
          <FavoriteButton book={book} />
          <dl className="metadata">
            <div><dt>Språk</dt><dd>{strings(book.languages).map(languageName).join(', ') || 'Ikke oppgitt'}</dd></div>
            <div><dt>Nedlastinger</dt><dd>{Number.isFinite(book.download_count) ? book.download_count.toLocaleString('nb-NO') : 'Ikke oppgitt'}</dd></div>
          </dl>
          {/* Summaries are optional and rendered as text, never interpreted as HTML. */}
          {strings(book.summaries).length > 0 && (
            <section>
              <h2>Om boken</h2>
              {strings(book.summaries).map((text, index) => <p key={index}>{text}</p>)}
            </section>
          )}
          <section>
            <h2>Les og last ned</h2>
            <div className="reading-links">
              {formats.length ? formats.map(({ url, label }) => (
                <a className="button-link" key={label} href={url} target="_blank" rel="noreferrer">{label} ↗</a>
              )) : <p>Ingen leselenker er tilgjengelige.</p>}
            </div>
          </section>
          <section>
            <h2>Emner og bokhyller</h2>
            {topics.length
              ? <ul className="topics">{topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
              : <p>Ingen emner er oppgitt.</p>}
          </section>
        </div>
      </article>
    </>
  )
}
