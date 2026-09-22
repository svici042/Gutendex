import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { categories } from '../api'
import { useFavorites } from '../context/useFavorites'

export default function Layout() {
  const { favorites, notice } = useFavorites()
  const location = useLocation()
  const navigate = useNavigate()
  // Global search belongs to the home route; other pages start with an empty input.
  const search = location.pathname === '/'
    ? new URLSearchParams(location.search).get('search') || '' : ''

  function submit(event) {
    // Handle Enter and the submit button without the browser reloading the page.
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('search').trim()
    // Encode special characters and discard the previous page number with a fresh query.
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    navigate(`/${params.size ? `?${params}` : ''}`)
  }

  return (
    <>
      <a className="skip-link" href="#main">Hopp til innhold</a>
      <header className="site-header">
        <div className="header-top container">
          <Link className="brand" to="/">Gutendex<span>Et bibliotek av muligheter</span></Link>
          {/* A new route key resets the uncontrolled input, including on Back/Forward. */}
          <form className="search-form" onSubmit={submit} key={`${location.pathname}${location.search}`} role="search">
            <label htmlFor="book-search">Søk etter bøker og forfattere</label>
            <div className="search-controls">
              <input id="book-search" name="search" type="search" defaultValue={search} placeholder="En bok, en forfatter, en ny verden …" />
              <button type="submit">Søk</button>
            </div>
          </form>
          <NavLink className="favorites-link" to="/favorites">Favoritter <span>{favorites.length}</span></NavLink>
        </div>
        <nav className="category-nav container" aria-label="Bokkategorier">
          <NavLink to="/" end>Alle bøker</NavLink>
          {categories.map((category) => (
            <NavLink key={category} to={`/category/${category}`}>{category}</NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {notice && <p className="notice" role="status">{notice}</p>}
        {/* Render the matched child page while keeping the shared header above it. */}
        <Outlet />
      </main>
      <footer className="container">Gutendex <span>Litteratur fra Project Gutenberg. Nye oppdagelser, side for side.</span></footer>
    </>
  )
}
