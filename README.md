# Gutendex

Gutendex er en norsk bokapp for å utforske litteratur fra Project Gutenberg. Finn en kjent klassiker, oppdag en ny forfatter eller samle bøker du vil lese senere. Grensesnittet er på norsk bokmål, mens bøkenes titler og innhold følger katalogen.

## Utforsk biblioteket

- Søk etter bøker med tittel eller forfatternavn.
- Bla gjennom 13 kategorier, og bruk pagineringen for å se flere bøker.
- Åpne bokdetaljer med forfatter, språk, emner og sammendrag når dette finnes.
- Følg digitale leselenker for å lese i nettleseren eller laste ned tilgjengelige bokformater.
- Lagre favoritter i nettleseren og finn dem igjen etter at siden er lukket.

Hver bok har en egen detaljside som kan åpnes via en direkte lenke. Favorittlisten gir rask tilgang til bøker du har valgt, uten at du trenger en konto. Listen er knyttet til nettleseren der du lagrer den.

**Teknologi:** React, Vite, React Router, CSS og Gutendex API.

## Kjør lokalt

Du trenger Node.js og npm. Kjør kommandoene fra prosjektmappen, og åpne den lokale adressen Vite viser i terminalen.

```sh
npm install
npm run dev
```

## Bygg og forhåndsvisning

Lag et produksjonsbygg og forhåndsvis det lokalt:

```sh
npm run build
npm run preview
```

## Bokdata og tilgjengelighet

Det offentlige API-et kan være tregt eller utilgjengelig. Lagrede bokutvalg hjelper enkelte visninger, men nye søk og sider som ikke er lagret, krever fortsatt API-et. Thriller har foreløpig ikke noe medfølgende bokutvalg som reserve. Omslag og bokfiler hentes fra eksterne tjenester.

Les mer i [Gutendex-dokumentasjonen](https://gutendex.com/) og det [offisielle repositoriet](https://github.com/garethbjohnson/gutendex).

[Vedlikehold og bidrag](docs/maintenance.md)
