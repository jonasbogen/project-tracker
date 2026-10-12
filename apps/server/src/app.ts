import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { clearState, loadState, saveState } from './db.js';

// Resolved relative to the process working directory, which is the repo root
// both for `npm start` locally and for the Buildpacks launch command in Procfile.
const CLIENT_DIR = process.env.CLIENT_DIR ?? './apps/web/dist';

export function createApp(): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.get('/api/state', async (c) => {
    const data = await loadState();
    return c.json({ data });
  });

  app.put('/api/state', async (c) => {
    const body = await c.req.json<{ data: unknown }>();
    if (!body || typeof body !== 'object' || !('data' in body)) {
      return c.json({ error: 'Expected { data }' }, 400);
    }
    await saveState(body.data);
    return c.json({ ok: true });
  });

  app.delete('/api/state', async (c) => {
    await clearState();
    return c.json({ ok: true });
  });

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

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

  app.get(
    '*',
    serveStatic({
      path: `${CLIENT_DIR}/index.html`,
      onFound: (_path, c) => c.header('Cache-Control', 'no-cache'),
    }),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Noe gikk feil.' }, 500);
  });

  return app;
}
