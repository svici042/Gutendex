import { useParams, useSearchParams } from 'react-router-dom'
import { categories } from '../api'
import useBooks from '../hooks/useBooks'
import { BookGrid, RequestState } from '../components/Books'
import NotFound from './NotFound'

export default function CollectionPage() {
  // Read filters from the URL so refresh and browser history restore the same collection.
  const { category } = useParams()
  const [params, setParams] = useSearchParams()
  const search = category ? '' : (params.get('search') || '').trim()
  // Manually edited URLs may contain invalid page numbers; use page one in that case.
  const pageValue = params.get('page') || '1'
  const page = /^\d+$/.test(pageValue) && Number.isSafeInteger(Number(pageValue)) && Number(pageValue) > 0
    ? Number(pageValue) : 1
  const validCategory = !category || categories.includes(category)
  // Translate the category route into topic, or use global search, requesting one page.
  const query = new URLSearchParams()
  if (category) query.set('topic', category)
  if (search) query.set('search', search)
  if (page > 1) query.set('page', page)
  // A null path prevents requests for categories outside the shared navigation list.
  const request = useBooks(validCategory ? `/books?${query}` : null, true)

  function changePage(link) {
    // Use the returned page value and retain the active route/filter.
    const nextPage = new URL(link).searchParams.get('page') || '1'
    const nextParams = new URLSearchParams()
    if (search) nextParams.set('search', search)
    if (nextPage !== '1') nextParams.set('page', nextPage)
    setParams(nextParams)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (!validCategory) return <NotFound title="Ukjent kategori" />
  return (
    <>
      <section className="intro">
        <p className="eyebrow">Ditt neste kapittel</p>
        <h1>{category || (search ? `Søkeresultater for «${search}»` : 'Store historier. Nye oppdagelser.')}</h1>
        <p>{category ? `Utforsk bøker innen ${category}.` : search
          ? 'Bøker som matcher søket ditt i tittel eller forfatternavn.'
          : 'Finn klassikere, følg nysgjerrigheten og samle favorittene dine. En god bok venter på deg.'}</p>
      </section>
      <RequestState {...request} />
      {/* Show result counts and pagination only after this request has valid data. */}
      {request.data && (
        <section aria-label="Bokliste">
          <div className="collection-heading">
            <h2>{category ? 'I denne kategorien' : search ? 'Dette fant vi' : 'Populært i biblioteket'}</h2>
            <p role="status">{request.data.count.toLocaleString('nb-NO')} bøker · Side {page}</p>
          </div>
          {request.data.results.length
            ? <BookGrid books={request.data.results} />
            : <div className="state-box"><h2>Ingen bøker funnet</h2><p>Prøv et annet søkeord eller velg en kategori.</p></div>}
          {/* The API decides whether another page exists; null links disable its button. */}
          <nav className="pagination" aria-label="Paginering">
            <button disabled={!request.data.previous} onClick={() => changePage(request.data.previous)}>← Forrige</button>
            <span>Side {page}</span>
            <button disabled={!request.data.next} onClick={() => changePage(request.data.next)}>Neste →</button>
          </nav>
        </section>
      )}
    </>
  )
}
