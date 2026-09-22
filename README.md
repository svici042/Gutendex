# Gutendex

En bokapp laget til «React Oppgave 4: Gutendex». Oppdag litteratur fra Project Gutenberg, søk etter bøker og forfattere, og samle favoritter i din egen bokhylle.

## Kom i gang

```sh
npm install
npm run dev
```

Åpne adressen Vite viser i terminalen. `npm run lint` sjekker koden, `npm run build` lager produksjonsbygget, og `npm run preview` viser bygget lokalt.

## Funksjoner og teknologi

Appen bruker React, JavaScript, Vite, React Router og vanlig CSS. Den har 13 kategorier, søk, paginering, bokdetaljer og leselenker. Favoritter deles mellom sidene og lagres lokalt i nettleseren. Hvis lagringen ikke fungerer, vises en beskjed. Søkeord og sidetall ligger i URL-en, slik at tilbake, fremover og oppdatering beholder visningen.

API-kall er samlet i `src/api.js`. Sidene ligger i `src/pages`, delte komponenter i `src/components`, og favorittilstanden i `src/context`.

## Datakilde

Integrasjonen følger [Gutendex-dokumentasjonen](https://gutendex.com/) og [prosjektets README på GitHub](https://github.com/garethbjohnson/gutendex). `search` søker i titler og forfatternavn, `topic` søker i emner og bokhyller, og pagineringen bruker sideverdiene fra API-ets `next` og `previous`. Bokdetaljer hentes fra `/books/:id`. Omslag og leselenker kommer fra `formats`, også når MIME-typene har charset-parametere.

Standardadressen er `https://gutendex.com`. Ingen miljøfil er nødvendig. En annen server kan angis i en lokal `.env`-fil:

```env
VITE_GUTENDEX_API_URL=https://din-gutendex-server.example
```

Start Vite på nytt etter endringen. Det offentlige endepunktet brukes til denne skoledemonstrasjonen. Oppstrømsprosjektet anbefaler en egen server for langsiktig bruk; backend er ikke en del av denne appen.

## Hosting

Appen bruker `createBrowserRouter`. Ved hosting må serveren sende `index.html` for ukjente frontend-stier, for eksempel `/books/1342`, uten å endre adressen. En eventuell undermappe angis med Vites `base`; ruteren bruker samme base automatisk. SPA-fallback må konfigureres og kontrolleres hos en eventuell hosting-leverandør. Appen er ikke publisert.
