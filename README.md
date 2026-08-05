# project-tracker

Internal tool for Intility staff to track projects: status, challenges, timeline,
customer, the person responsible, and cases linked to each project.

- Main page lists all projects with customer, status, responsible owner, timeline, and case count.
- Clicking into a project shows the full detail view: status, challenges, timeline, customer,
  responsible owner, and the list of cases tied to that project. Cases can be added and removed
  from the detail page.

## Stack

- Node.js + Express, server-rendered with EJS views.
- PostgreSQL via `pg`, schema created automatically on startup (`CREATE TABLE IF NOT EXISTS`).
- Tests: Jest + Supertest.

## Local development

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres instance
npm start               # or: node src/server.js
```

The app listens on `PORT`, defaulting to `8080` when unset.

## Tests

```bash
npm test
```

If `npm test` is blocked by local policy (e.g. some locked-down Windows environments
block `.cmd` shims), run Jest directly instead:

```bash
node node_modules/jest/bin/jest.js
```

Tests mock the database layer, so no Postgres instance is required to run them.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `8080`. Minato sets this automatically. |
| `DATABASE_URL` | Yes at runtime | Injected automatically by Minato's managed Postgres. For local dev, point it at your own Postgres instance. |

No application secrets are required. This app has no external integrations.

## Deploying on Minato

1. Deploy from this repository with `minato_deploy` (or the Minato CLI/portal), using the Node
   builder. No secrets are required for the first deployment.
2. Enable the managed Postgres database for the app (`small` plan, version `16`). Minato injects
   `DATABASE_URL` (and the standard `PG*` variables) into the running app automatically.
3. On boot, the app runs `CREATE TABLE IF NOT EXISTS` for its two tables (`projects`, `cases`), so
   no manual migration step is needed.
