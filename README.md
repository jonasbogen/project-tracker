# project-tracker

Internal tool for Intility staff to track projects: status, challenges, timeline,
customer, the person responsible, and cases linked to each project.

- **Oversikt** (`/`) – a dashboard with stat tiles, a project-status breakdown, a "cases per
  owner" chart, and upcoming project deadlines.
- **Milestones** (`/projects`) – lists all projects with customer, status, responsible owner,
  timeline, and case count; searchable by name/customer and filterable by team.
- **Team** (`/team`) – everyone currently assigned to at least one GitHub-synced case, with
  open/total case counts.
- Clicking into a project (`/projects/:id`) shows the full detail view: status, challenges,
  timeline, customer, responsible owner, a calendar of the project's deadline and case activity,
  a case-status breakdown, and the list of cases tied to that project (each case shows its GitHub
  assignee as "Eier" when synced). Cases can be added and removed from the detail page.

## Architecture

A **single Node package** at the repo root, with the two apps kept in separate folders and built
and shipped as **one deployable app** (Minato runs one container on one port):

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
- **One root `package.json`** holds all dependencies and the `dev`/`build`/`typecheck`/`test`
  scripts. There are **no npm workspaces and no Turborepo**: Minato builds with Cloud Native
  Buildpacks (Paketo `node`), whose build model is a single conventional Node app at the repo root —
  a workspaces/Turborepo layout does not build cleanly there. The two-folder layout keeps the code
  organised without that build-time cost.

## Local development

```bash
npm install
cp .env.example .env      # point DATABASE_URL at a local Postgres instance

npm run dev               # runs BOTH apps (via concurrently):
                          #   - Hono API  (tsx watch)  on http://localhost:8080
                          #   - Vite dev server        on http://localhost:5173  (proxies /api -> :8080)
```

Open http://localhost:5173 during development. The Vite dev server proxies `/api` to the Hono
process, so you get hot-reload for the frontend and the real API.

### Production build / start (single process)

```bash
npm run build             # tsc (server) then vite build (web)
npm start                 # node apps/server/dist/index.js  — serves API + SPA on PORT (default 8080)
```

`npm start` must be run from the repo root (that is also the Minato/Buildpacks launch context; see
`Procfile`).

> **Locked-down Windows note.** Some Intility machines block executing native binaries (AppLocker /
> group policy). That prevents esbuild-based tools (`vite`, `vitest`, `tsx`) — and even the Minato
> CLI — from running **locally on those machines** (`spawnSync … UNKNOWN`, or "blocked by group
> policy"). The pure-JS TypeScript compiler still works, so you can always typecheck:
>
> ```bash
> node node_modules/typescript/bin/tsc -p apps/server/tsconfig.json --noEmit
> node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
> ```
>
> The full build/test always works in CI and on Minato (Linux), where those binaries run normally.

## Tests

```bash
npm test                  # vitest (server API tests, DB layer mocked)
```

Tests mock the database layer, so no Postgres instance is required to run them.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `8080`. Minato sets this automatically. |
| `DATABASE_URL` | Yes at runtime | Injected automatically by Minato's managed Postgres. For local dev, point it at your own Postgres instance. |
| `CLIENT_DIR` | No | Override the static frontend directory. Defaults to `./apps/web/dist`. |
| `GITHUB_TOKEN` | No | A GitHub token (read + write on issues/milestones) for the source repo below — write is needed to create milestones for app-created projects. Without it, GitHub sync is skipped (logged, not fatal). **Secret** — set via the Minato portal or `minato secrets set`, never in plain env. |
| `GITHUB_ORG` | No | GitHub org that owns the source repo. Defaults to `intility`. |
| `GITHUB_REPO` | No | Repo to sync from. Defaults to `Prosjektmappe` — the OT/Edge Platform project tracker repo, one milestone per customer project. |

Access is gated by Minato's mandatory tenant SSO at the gateway, so the app needs no auth of its
own for users. `GITHUB_TOKEN` is the one exception: an outbound credential the app itself uses to
call the GitHub API (see "GitHub sync" below).

## GitHub sync

`github.com/intility/Prosjektmappe` is the source of truth for OT/Edge Platform customer projects:
one **milestone** per customer project, one **issue** per case/task within that project. Issue
bodies follow a form template with `### Kunde` and `### Beskrivelse` headings.

On startup, and then every hour, the server reads that repo's milestones and milestone-linked
issues (pull requests and issues without a milestone are skipped) and upserts:

- **One project per milestone** — `name` = milestone title, `customer` = the `Kunde` field from any
  of its linked issues (falls back to the milestone title if none is set), `team` = `OT`,
  `status`: `Fullført` if closed, `Forsinket` if open and past its due date, otherwise `Pågår`,
  `end_date` = milestone due date, `challenges` = milestone description.
- **One case per issue** — `title` = issue title, `description` = the `Beskrivelse` field (falls
  back to the raw issue body), `status`: `Løst` if closed, otherwise `Åpen`, `case_date` = issue
  creation date.

Re-running the sync updates those fields in place (matched on repo + milestone/issue number — see
the `github_repo` / `github_milestone_number` / `github_issue_number` columns) rather than creating
duplicates. Cases created manually through the UI are never touched by the sync. Requires
`GITHUB_TOKEN`; without it the sync is skipped and logs a message, the rest of the app works
normally.

**The other direction:** creating a project in the UI immediately creates a matching milestone in
`Prosjektmappe` (title, description, due date), and links the new project to it — so it shows up
with the same "GitHub" badge as a synced project, and the next hourly pull recognizes it instead of
duplicating it. This call is best-effort: if `GITHUB_TOKEN` is absent, read-only, or GitHub is
briefly unreachable, the project is still created in the app; only the GitHub link is skipped
(logged, not surfaced as an error to the user).

The case form's "Eier" field is a dropdown of the repo's assignable GitHub users
(`GET /repos/{org}/{repo}/assignees`, read-only) when `GITHUB_TOKEN` is set, falling back to a
plain text field otherwise.

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
