import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the API runs as a separate Hono process (tsx watch) on $PORT (8080 by
// default); Vite serves the React app on :5173 and proxies /api to it. In
// production a single Hono process serves both this build output and the API.
const apiPort = process.env.PORT ?? '8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
