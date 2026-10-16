# Spillkveld

X-kamp-app for fire lag på én felles skjerm. Spill-lederen klikker seg gjennom
øvelsene med én knapp (eller mellomrom/Enter/→), og registrerer hvem som kom
på 1., 2., 3. og 4. plass. Musikk og lydeffekter lages i nettleseren med Web
Audio, så appen trenger ingen eksterne filer.

## Øvelser

| Øvelse | Hva appen gjør | Poeng (standard) |
| --- | --- | --- |
| **6 minutter** | Skjult nedtelling med musikkquiz oppå: 40 sanger (20 sekunder lyd hver, fra `public/six/`, listen med emoji-scener i `src/game/songs.ts`) i tilfeldig rekkefølge, Kygo Jo alltid først. To bokser, **Tittel** og **Artist** (taster T/A): trykk når noen tar den, svaret vises i boksen med «del ut 5 slurker» og en liten animasjon for sangen. Begge kan tas. Når begge er åpne, eller 20 sekunder har gått (resten åpnes grått), er det 3 sekunder pause før neste sang. Ingen teller på skjermen. Alarm når tiden er ute. | Taperen får −5 |
| **Hesteveddeløpet** | Hvert lag velger sin hest (kortfarge, ett lag per hest). Kort flippes automatisk på en travbane, sidekort sender hester tilbake. Rekkefølgen fylles inn fra målgangen. | 6 / 4 / 2 / 1 |
| **Mafia og politi** | Appen er forteller: natt (mafia, politi), dag (diskusjon med nedtelling, avstemning), rolleavsløring, vinnersjekk og automatisk poengforslag per lag. Roller deles ut med fysiske kort (ess = mafia, konge = politi). | 10 / 7 / 5 / 3 |
| **Emoji Movie** | Åtte filmer forklart med emojis, to per lag. 10 sekunder per film, bare riktig/feil teller. Likt antall riktige deler plassen. | 10 / 7 / 5 / 3 |
| **Wheel of Fortune** | 25 felt på et hjul. Lagene velger ett felt hver (ett lag per felt), hjulet snurres én gang. Treff gir flate poeng. | +5 ved treff |
| **Deal or Drink** | Koffert-gameshow for fire lag: 20 kofferter med verdier i kroner, Esko i Banken ringer selv (annenhver runde, hver runde når få kofferter er igjen) med et eget tilbud og begrunnelse til hvert lag, DEAL/NO DEAL, finale, avsløring og resultatskjerm med beste/verste deal. Host-panelet (tast **H**) viser verdiene og lar deg overstyre eller angre. Drikkekonsekvens per åpning, alkoholfri variant. Lagene rangeres etter hva de sitter igjen med. | 10 / 7 / 5 / 3 |
| **Egen øvelse** | Stoppeklokke og manuell rangering. | 10 / 7 / 5 / 3 |

Poengene per øvelse kan endres i oppsettet. Delte plasser deler poengene.

## Taster

- Mellomrom / Enter / → : neste (den gule knappen)
- M : lyd av/på
- F : fullskjerm
- H : host-panel i Deal or Drink (koffertverdier, banktilbud, angre, dramatisk pause)
- T / A / N : i 6 minutter – Tittel tatt, Artist tatt, hopp over sangen

## Kjøre lokalt

```bash
npm install
npm run build
PORT=3000 npm start
```

Spilltilstanden lagres i nettleseren og i Postgres (`DATABASE_URL`) hvis den
finnes, så en oppfriskning midt i kvelden mister ingenting.

## Struktur

- `apps/server` – Hono-server: statiske filer + `/api/state` (lagring)
- `apps/web` – React (Vite): skjermene i `src/screens`, lyd i `src/audio`,
  poenglogikk i `src/game`
