import { Link } from 'react-router-dom'

export default function NotFound({ title = 'Denne siden finnes ikke' }) {
  return (
    <section className="state-box">
      <p className="eyebrow">Et kapittel mangler</p>
      <h1>{title}</h1>
      <p>Gå tilbake til biblioteket og finn noe nytt å lese.</p>
      <Link className="button-link" to="/">Utforsk bøker</Link>
    </section>
  )
}
