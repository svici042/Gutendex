# Gutendex

En norsk bokapp laget til «React Oppgave 4: Gutendex». Utforsk klassikere fra Project Gutenberg, søk etter tittel eller forfatter, bla i kategorier og lagre favoritter lokalt i nettleseren. Appen bruker React, Vite, vanlig CSS og React Router med `createBrowserRouter`.

## Kom i gang

```sh
npm install
npm run dev
```

`npm run build` lager produksjonsbygget. `npm run preview` viser det lokalt. Ved hosting må ukjente frontend-stier sendes til `index.html`; en eventuell undermappe settes med Vites `base`.

## Bokdata og tilgjengelighet

Appen bruker [Gutendex-API-et](https://gutendex.com/) etter [prosjektets dokumentasjon](https://github.com/garethbjohnson/gutendex). Kategorier bruker `topic`, søk bruker `search`, og antall bøker og paginering kommer fra API-et.

Det offentlige API-et kan svare sent, med feil eller ikke i det hele tatt. Vedlikeholdsforespørsler har brukt opptil omtrent 88 sekunder. Appen viser et sakte-svar-varsel etter fem sekunder og beholder grensen på 60 sekunder. Navigering avbryter foreldede forespørsler umiddelbart. Nye forsøk startes av brukeren.

Ekte forhåndshentede data gir en tilgjengelig startside og første side for kategorier som har et lagret utvalg. Kategoriutvalg lastes ved behov. Bøkene i utvalgene kan også åpnes direkte eller etter sideoppdatering: en liten ID-indeks finner riktig fil uten å laste alle kategoriene. Opprinnelig hentetidspunkt beholdes, og ferske API-data hentes i bakgrunnen. Utvalgene er ikke hele katalogen; senere sider og nye søk trenger fortsatt API-et. Omslag og bokfiler lastes eksternt.

Et nyere gyldig nettlesermellomlager foretrekkes. Det har grenser på 20 lister, 200 bøker og én million tegn i lagret JSON. Data er ferske i fem minutter og kan vises i opptil ett døgn under oppdatering. Lagringen utsettes til etter at gjengivelse kan starte. Feil eller blokkert lagring hindrer ikke appen; favoritter lagres separat og sendes ikke til en loggingtjeneste.

Valgfri lokal `.env`:

```env
VITE_GUTENDEX_API_URL=https://gutendex.com
VITE_API_TIMEOUT_MS=60000
```

Start Vite på nytt etter endring. Tidsgrensen kan settes mellom 1 000 og 90 000 ms. Forhåndshentede offentlige data brukes ikke med en annen API-adresse. Et eget API er ikke nødvendig for å kjøre prosjektet.

## Oppdatere kategoriutvalg

```sh
npm run snapshots:refresh
# Eller bare bestemte kategorier:
npm run snapshots:refresh -- Fiction Mystery
```

Kjør med en moderne Node-versjon som støttes av Vite (Node 22.12+). Vedlikeholdsskriptet bruker to samtidige forespørsler, høyst to forsøk per kategori, 90 sekunder per forsøk og fem sekunders pause før nytt forsøk. Det validerer ekte `topic`-svar og lagrer kilde, spørring, faktisk hentetidspunkt og full respons i `src/data/categories`. Mislykket oppdatering beholder eksisterende gyldige filer. Dynamiske importer og bok-ID-indeksen oppdateres samlet. `npm run snapshots:refresh -- --index-only` bygger bare indeksen fra eksisterende filer, uten nettverk. Vanlig bygg henter aldri data fra API-et.

Startsideutvalget ligger separat i `src/data/initial-books.json`. Datoer skal bare oppdateres ved en reell vellykket innhenting, aldri for å få gamle data til å se nye ut.

Ekte utvalg finnes for Fiction, Mystery, Romance, Fantasy, Morality, Society, Power, Justice, Adventure, Tragedy, War og Philosophy. Thriller mangler etter HTTP 503 og et tidsavbrudd på 90 sekunder under siste oppdatering. Den kategorien forsøker fortsatt det virkelige API-et og får ikke andre kategoriers bøker som erstatning.

## Kontroll og deling

```sh
npm run lint
npm test
npx playwright install chromium
npm run test:browser
# Separat nettverksavhengig kontroll av reelle API-svar:
npm run test:live
# Windows: kildearkiv i artifacts/
npm run archive
```

Nettlesertestene skiller mellom lagrede utvalg, ferske kontrollerte svar og navigering med mellomlager. Live-testene prøver alle 13 emner, søk med neste side når tilgjengelig, og bokdetaljer én gang, med høyst to samtidige tester. De krever et vellykket HTTP-svar og at svaret brukes i grensesnittet; et synlig utvalg er ikke nok. HTTP-utfall og tider lagres som testvedlegg. Målingene gjelder innhold i siden, ikke ferdig lastede omslag. Manglende ekte utvalg rapporteres som hoppede utvalgstester.

Arkivskriptet inkluderer kildekode, låsefil, tester, tilgjengelige utvalg og prosjektkonfigurasjon, inkludert `.oxlintrc.json`. Git-historikk, avhengigheter, bygg, miljøfiler, privat arbeidsinnhold og testresultater følger ikke med. Arbeidsmappens Git-historikk endres ikke.

## Egen Gutendex-instans

Neste steg ved vedvarende API-problemer er en separat installasjon av den [offisielle Gutendex-serveren](https://github.com/garethbjohnson/gutendex/wiki/Installation-Guide), med egen importert katalog. En videresendende proxy alene fjerner ikke avhengigheten av en utilgjengelig oppstrømstjeneste.

- Sett opp Linux-hosting, Python 3.12+ med virtuelt miljø, prosjektets Python-avhengigheter, PostgreSQL 16+ og varig lagring for database og katalogfiler.
- Konfigurer serverens miljøvariabler etter dens mal, med databaseforbindelse, hemmelig `SECRET_KEY`, `DEBUG=false` og riktige `ALLOWED_HOSTS`. Hemmeligheter skal ikke legges i frontendens `VITE_`-variabler.
- Kjør `manage.py migrate`, `manage.py updatecatalog` og `manage.py collectstatic`. Planlegg katalogoppdatering og sikkerhetskopiering. Serveren trenger tilgang til Gutenbergs katalogarkiv.
- Publiser Django via en produksjonsserver, for eksempel Apache/mod_wsgi som i veiledningen, med HTTPS. Tillat frontendens origin via CORS dersom domenene er ulike. Kontroller ekte søk, emner, bokdetaljer og paginering før tilkobling.
- Sett frontendens `VITE_GUTENDEX_API_URL` til serverens basisadresse og bygg på nytt. Støtten finnes og testes med kontrollerte svar; ingen egen backend er opprettet eller publisert i dette prosjektet.
