# Spillkveld

X-kamp-app for fire lag på én felles skjerm. Spill-lederen klikker seg gjennom
øvelsene med én knapp (eller mellomrom/Enter/→), og registrerer hvem som kom
på 1., 2., 3. og 4. plass. Musikk og lydeffekter lages i nettleseren med Web
Audio, så appen trenger ingen eksterne filer.

## Øvelser

| Øvelse | Hva appen gjør | Poeng (standard) |
| --- | --- | --- |
| **6 minutter** | Skjult nedtelling. Trykk START, klokken vises ikke, alarm når tiden er ute. | Taperen får −5 |
| **Hesteveddeløpet** | Hvert lag trekker en hest (kortfarge). Kort flippes automatisk, hestene galopperer, sidekort sender hester tilbake. Rekkefølgen fylles inn fra målgangen. | 6 / 4 / 2 / 1 |
| **Mafia og politi** | Appen er forteller: natt (mafia, politi), dag (diskusjon med nedtelling, avstemning), rolleavsløring, vinnersjekk og automatisk poengforslag per lag. Roller deles ut med fysiske kort (ess = mafia, konge = politi). | 10 / 7 / 5 / 3 |
| **Egen øvelse** | Stoppeklokke og manuell rangering. | 10 / 7 / 5 / 3 |

Poengene per øvelse kan endres i oppsettet. Delte plasser deler poengene.

## Taster

- Mellomrom / Enter / → : neste (den gule knappen)
- M : lyd av/på
- F : fullskjerm

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
