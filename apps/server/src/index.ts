import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initSchema } from './db.js';

const PORT = Number(process.env.PORT) || 8080;

async function main(): Promise<void> {
  await initSchema();

  const app = createApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`project-tracker listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start project-tracker', err);
  process.exit(1);
});
