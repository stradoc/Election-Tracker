/**
 * vite.config.ts: dev server and build for the web app.
 *
 * In development, requests to /api are proxied to the API server (apps/server), so the
 * browser talks to one origin and the app uses plain relative URLs like /api/elections.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULT_API_PORT } from '@tippingpoint/shared';

const apiPort = Number(process.env.PORT ?? DEFAULT_API_PORT);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
});
