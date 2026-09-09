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

  // Static assets (JS/CSS/images) produced by Vite. Hashed /assets/ files are
  // content-addressed (a code change always gets a new filename) so they can
  // be cached forever; everything else - especially index.html, which is the
  // one file that names those hashed filenames - must always revalidate, or
  // a browser (or an intermediate cache) can keep serving old index.html
  // pointing at asset files a later deploy has since replaced, silently
  // stranding the browser on old code no matter how many times it reloads.
  app.use(
    '/*',
    serveStatic({
      root: CLIENT_DIR,
      onFound: (path, c) => {
        c.header(
          'Cache-Control',
          path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
  );

  // SPA fallback: serve index.html so client-side routing works on deep links.
  app.get(
    '*',
    serveStatic({
      path: `${CLIENT_DIR}/index.html`,
      onFound: (_path, c) => c.header('Cache-Control', 'no-cache'),
    }),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Noe gikk feil. Prøv igjen senere.' }, 500);
  });

  return app;
}
