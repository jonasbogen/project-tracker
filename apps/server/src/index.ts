import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initSchema } from './db.js';
import { syncGithubProjects } from './github-sync.js';

const PORT = Number(process.env.PORT) || 8080;
// The webhook (see POST /api/webhooks/github) makes changes appear near-instantly
// when it's configured; this is just the fallback for when it isn't (or a delivery
// is missed), so a few minutes' staleness at worst is fine.
const GITHUB_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function runGithubSync(): void {
  if (!process.env.GITHUB_TOKEN) {
    console.log('GitHub sync skipped: GITHUB_TOKEN is not set');
    return;
  }
  syncGithubProjects()
    .then(({ projects, cases }) =>
      console.log(`GitHub sync: ${projects} project(s), ${cases} case(s)`),
    )
    .catch((err) => console.error('GitHub sync failed', err));
}

async function main(): Promise<void> {
  await initSchema();

  runGithubSync();
  setInterval(runGithubSync, GITHUB_SYNC_INTERVAL_MS);

  const app = createApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`project-tracker listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start project-tracker', err);
  process.exit(1);
});
