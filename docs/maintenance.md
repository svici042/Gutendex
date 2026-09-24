# Vedlikehold og bidrag

Kjør kommandoene fra prosjektroten etter `npm install`.

## Oppdatere lagrede bokutvalg

Oppdater alle kategorier, velg bestemte kategorier eller bygg importoversikten og indeksen på nytt fra eksisterende filer uten nettverkskall:

```sh
npm run snapshots:refresh
npm run snapshots:refresh -- Fiction Mystery
npm run snapshots:refresh -- --index-only
```

Kategoriutvalgene ligger i `src/data/categories/`. Mislykkede oppdateringer beholder eksisterende gyldige filer. Startsideutvalget ligger separat i `src/data/initial-books.json`. Behold kildeinformasjonen, og endre hentetidspunkt bare når nye data faktisk er hentet. Et vanlig produksjonsbygg oppdaterer ikke utvalgene.

## Valgfrie miljøinnstillinger

Standardverdiene kan overstyres i en lokal `.env`-fil:

```env
VITE_GUTENDEX_API_URL=https://gutendex.com
VITE_API_TIMEOUT_MS=60000
```

Start utviklingsserveren på nytt etter endringer, og bygg på nytt før publisering. Offentlige bokutvalg brukes ikke når en annen API-adresse er valgt. `VITE_`-variabler er synlige i klienten og skal ikke inneholde hemmeligheter.

En egen API-instans er valgfri. Se den [offisielle installasjonsveiledningen for Gutendex](https://github.com/garethbjohnson/gutendex/wiki/Installation-Guide) for selvhosting.

## Kontroller og kildearkiv

```sh
npm run lint
npm test
npx playwright install chromium
npm run test:browser
npm run test:live
npm run archive
```

Installer Chromium før første nettlesertest. `test:browser` bygger appen og kjører nettlesertestene. `test:live` kontakter det offentlige API-et og avhenger av tilgjengeligheten der. Arkivkommandoen krever Windows PowerShell og lager et kildearkiv i `artifacts/`.

## Hosting

Publiser innholdet i `dist/` etter `npm run build`. Verten må sende ukjente applikasjonsstier til `index.html`, slik at direkte lenker og sideoppdateringer fungerer med SPA-rutingen. Ved publisering i en undermappe må Vites `base` samsvare med stien.

Konfigurer HTTPS og HTTP-hoder på hosting- eller CDN-nivå: `Strict-Transport-Security`, en passende `Content-Security-Policy`, `X-Content-Type-Options: nosniff` og `Referrer-Policy`. CSP må tillate appens filer, Gutendex API over HTTPS samt omslag og leselenker. Lokal Vite-utvikling kan trenge en egen policy for HMR.

Tilbake til [prosjektbeskrivelsen](../README.md).
