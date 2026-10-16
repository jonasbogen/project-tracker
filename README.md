# Spillkveld

X-kamp-app for fire lag på én felles skjerm. Spill-lederen klikker seg gjennom
øvelsene med én knapp (eller mellomrom/Enter/→), og registrerer hvem som kom
på 1., 2., 3. og 4. plass. Musikk og lydeffekter lages i nettleseren med Web
Audio, så appen trenger ingen eksterne filer.

Lag legges til og fjernes på oppsettsiden (2–4 lag; hesteveddeløpet har fire hester).

**Smirnoff Ice gjennom kvelden:** hvert lag får én Ice-sjanse. Hesteveddeløpet spør sisteplassen, 6 minutter, Emoji Movie og hjulet spør hver sin gang det neste laget som ikke har fått tilbudet (`state.iceOffered`); hvem som faktisk chugget ligger i `state.iceTeams`.

## Øvelser

| Øvelse | Hva appen gjør | Poeng (standard) |
| --- | --- | --- |
| **6 minutter** | Skjult nedtelling med musikkquiz oppå: 40 sanger (20 sekunder lyd hver, fra `public/six/`, listen med emoji-scener og artistportretter i `src/game/songs.ts`) i tilfeldig rekkefølge, Kygo Jo alltid først. Lagene bytter på, én sang hver, lag 1 begynner; kortet til venstre viser hvem som har tur. To bokser, **Tittel** og **Artist** (taster T/A): trykk når laget tar den, svaret vises i boksen (tittel med animasjon, artist med portrett) med «del ut 5 slurker» og en angreknapp. «Neste» (N) eller 20 sekunder åpner resten og gir 2 sekunder pause før neste sang; poeng som er trykket beholdes. Ved første sangbytte etter 3:40 stopper klokken for en **Ice-runde**: Ice-sangen spilles og laget som står for tur kan chugge en Smirnoff Ice for doble poeng på sin sang (lag som tok Ice i hesteveddeløpet står over, runden venter en sang). Tabellen nede til venstre sorteres fortløpende med lederen øverst (likt: færrest sanger vinner); lederen får +2 poeng. Ingen teller på skjermen. Alarmlyd når tiden er ute, så fader bakgrunnsmusikken inn igjen; laget som hadde tur taper automatisk (ingen rangeringsside) og alle på laget tar 5 slurker selv. Alle lydfiler er normalisert til −14 LUFS. | Taperen får −5, flest riktige +2 |
| **Hesteveddeløpet** | Hvert lag velger sin hest (kortfarge, ett lag per hest). De fire hestene er tegnet i SVG (`components/HorseFigure.tsx`) i kostyme: ♠ Bling (gullkjeder og solbriller), ♥ Smoking (smoking, sløyfe og flosshatt), ♦ Sponsen (Intility-sponsordekken), ♣ Kostymet (to personer i hestekostyme). Kort flippes automatisk på en travbane, sidekort sender hester tilbake. Rekkefølgen fylles inn fra målgangen. | 6 / 4 / 2 / 1 |
| **Mafia og politi** | Appen er forteller: natt (mafia, politi), dag (diskusjon med nedtelling, avstemning), rolleavsløring, vinnersjekk og automatisk poengforslag per lag. Roller deles ut med fysiske kort (ess = mafia, konge = politi). | 10 / 7 / 5 / 3 |
| **Emoji Movie** | Tolv filmer forklart med emojis, tre per lag (tre runder). 10 sekunder per film, bare riktig/feil teller. Likt antall riktige deler plassen. Mellom rundene: Ice-sangen, og et lag uten Ice-sjanse hittil kan chugge en Ice og vinner da ved likt. | 10 / 7 / 5 / 3 |
| **Wheel of Fortune** | 12 felt på et hjul. Lagene velger ett felt hver (ett lag per felt). Når alle har valgt kommer Ice-sangen og -videoen; det siste laget uten Ice-sjanse kan chugge en Ice og får to felt til. Hjulet snurres én gang. Treff gir flate poeng. | +5 ved treff |
| **Deal or Drink** | Koffert-gameshow for fire lag: 20 kofferter med verdier i kroner, Esko i Banken ringer selv (annenhver runde, hver runde når få kofferter er igjen) med et eget tilbud og begrunnelse til hvert lag, DEAL/NO DEAL, finale, avsløring og resultatskjerm med beste/verste deal. Host-panelet (tast **H**) viser verdiene og lar deg overstyre eller angre. Drikkekonsekvens per åpning, alkoholfri variant. Lagene rangeres etter hva de sitter igjen med. | 10 / 7 / 5 / 3 |
| **Egen øvelse** | Stoppeklokke og manuell rangering. | 10 / 7 / 5 / 3 |

Poengene per øvelse kan endres i oppsettet. Delte plasser deler poengene.

## Taster

- Mellomrom / Enter / → : neste (den gule knappen)
- M : lyd av/på
- F : fullskjerm
- H : host-panel i Deal or Drink (koffertverdier, banktilbud, angre, dramatisk pause)
- T / A / N : i 6 minutter – Tittel tatt, Artist tatt, Neste

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
