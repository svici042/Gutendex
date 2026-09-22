import { Link } from 'react-router-dom'
import { useFavorites } from '../context/useFavorites'
import { BookGrid } from '../components/Books'

export default function FavoritesPage() {
  // Saved card metadata comes from context, so this page needs no API request.
  const { favorites } = useFavorites()
  return (
    <>
      <section className="intro">
        <p className="eyebrow">Din egen bokhylle</p>
        <h1>Favoritter</h1>
        <p>{favorites.length} bøker du vil ta vare på.</p>
      </section>
      {/* Removing the last favorite immediately reveals the browsing invitation. */}
      {favorites.length ? <BookGrid books={favorites} /> : (
        <div className="state-box">
          <h2>Bokhyllen din er klar for nye historier</h2>
          <p>Trykk på «Legg til i favoritter» ved en bok for å finne den igjen her.</p>
          <Link className="button-link" to="/">Finn din neste bok</Link>
        </div>
      )}
    </>
  )
}
