# project-tracker

Internal tool for Intility staff to track projects: status, challenges, timeline,
customer, the person responsible, and cases linked to each project.

- Main page lists all projects with customer, status, responsible owner, timeline, and case count.
- Clicking into a project shows the full detail view: status, challenges, timeline, customer,
  responsible owner, and the list of cases tied to that project. Cases can be added and removed
  from the detail page.

## Architecture

Turborepo monorepo with two workspaces, built and shipped as a **single deployable app** (Minato
runs one container on one port):

```
apps/
  server/   Hono + TypeScript API (pg), also serves the built frontend
  web/      React + Vite + Intility Bifrost frontend (SPA)
```

- **Backend** – [Hono](https://hono.dev/) on `@hono/node-server`, TypeScript, PostgreSQL via `pg`.
  Schema is created automatically on startup (`CREATE TABLE IF NOT EXISTS`). Exposes a JSON API
  under `/api/*`.
- **Frontend** – React (Vite) using the [Intility Bifrost](https://bifrost.intility.com) design
  system. Talks to the API under `/api`.
- **Single-process serving** – in production the Hono server serves both the JSON API and the
  static Vite build (`apps/web/dist`), with an SPA fallback to `index.html`. This matches Minato's
  one-app / one-port (Knative, port `8080`) model.
- **Turborepo** orchestrates the `dev`, `build`, `typecheck`, and `test` tasks across both
  workspaces.

## Local development

```bash
npm install
cp .env.example .env      # point DATABASE_URL at a local Postgres instance

npm run dev               # runs BOTH apps via Turborepo:
                          #   - Hono API  (tsx watch)  on http://localhost:8080
                          #   - Vite dev server        on http://localhost:5173  (proxies /api -> :8080)
```

Open http://localhost:5173 during development. The Vite dev server proxies `/api` to the Hono
process, so you get hot-reload for the frontend and the real API.

### Production build / start (single process)

```bash
npm run build             # turbo: tsc (server) + vite build (web)
npm start                 # node apps/server/dist/index.js  — serves API + SPA on PORT (default 8080)
```

`npm start` must be run from the repo root (that is also the Minato/Buildpacks launch context; see
`Procfile`).

> **Locked-down Windows note.** Some Intility machines block executing native binaries out of
> `node_modules` (AppLocker/EDR). That prevents esbuild-based tools (`vite`, `vitest`, `tsx`, the
> `turbo` binary) from running **locally on those machines** — you'll see `spawnSync ... UNKNOWN`.
> The pure-JS TypeScript compiler still works, so you can always typecheck:
>
> ```bash
> node node_modules/typescript/bin/tsc -p apps/server/tsconfig.json --noEmit
> node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
> ```
>
> The full build/test always works in CI and on Minato (Linux), where those binaries run normally.

## Tests

```bash
npm test                  # turbo -> vitest (server API tests, DB layer mocked)
```

Tests mock the database layer, so no Postgres instance is required to run them.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `8080`. Minato sets this automatically. |
| `DATABASE_URL` | Yes at runtime | Injected automatically by Minato's managed Postgres. For local dev, point it at your own Postgres instance. |
| `CLIENT_DIR` | No | Override the static frontend directory. Defaults to `./apps/web/dist`. |

No application secrets are required. This app has no external integrations. Access is gated by
Minato's mandatory tenant SSO at the gateway, so the app needs no auth of its own.

## Deploying on Minato

Minato builds from Git with Cloud Native Buildpacks (the `node` builder) and runs the result as a
single signed app. There is **no Dockerfile** — the `node` buildpack runs `npm ci`, then
`npm run build` (Turborepo builds both workspaces), and launches the process from `Procfile`
(`node apps/server/dist/index.js`).

1. Deploy from this repository with `minato_deploy` (MCP), the Minato CLI, or the portal, using the
   `node` builder and the repo root as the build context. No secrets are required.
2. Enable the managed Postgres database for the app (`small` plan, version `16`). Minato injects
   `DATABASE_URL` into the running app automatically.
3. On boot the app runs `CREATE TABLE IF NOT EXISTS` for its two tables (`projects`, `cases`), so
   no manual migration step is needed.

### CI and deployment

- `.github/workflows/ci.yml` runs typecheck + tests + build on every push/PR (Linux runners).
- `.github/workflows/deploy.yml` can **queue** a deploy on push to `main`/`master` (or manually via
  *workflow_dispatch*). **It cannot make a release live by itself:** Minato has no webhooks and every
  deploy is approval-gated, so a human still approves the plan in the portal. The job stays skipped
  until you opt in by setting these repo settings:
  - Variable `MINATO_DEPLOY_ENABLED` = `true`
  - Variable `MINATO_API_URL` = the Minato API base URL
  - Secret `MINATO_TOKEN` = a Minato API bearer token
  - A **self-hosted runner** with network access to the Minato API (the API is internal, so
    GitHub-hosted runners likely can't reach it), with the `minato` CLI available.
