import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { api } from './routes/projects.js';
import { chat } from './routes/chat.js';
import { pricesApi } from './routes/prices.js';

// The Vite build output. Resolved relative to the process working directory,
// which is the repo root both for `npm start` locally and for the Minato
// (Buildpacks) launch command in Procfile.
const CLIENT_DIR = process.env.CLIENT_DIR ?? './apps/web/dist';

export function createApp(): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  // JSON API.
  app.route('/api', api);
  app.route('/api', chat);
  app.route('/api', pricesApi);

  // Any other /api path is a genuine 404 (don't fall through to the SPA).
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  // Static assets (JS/CSS/images) produced by Vite.
  app.use('/*', serveStatic({ root: CLIENT_DIR }));

  // SPA fallback: serve index.html so client-side routing works on deep links.
  app.get('*', serveStatic({ path: `${CLIENT_DIR}/index.html` }));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Noe gikk feil. Prøv igjen senere.' }, 500);
  });

  return app;
}
