/**
 * index.ts: starts the API server (`npm run dev` from the repo root starts it with the web app).
 *
 * Server position: entry point. Loads apps/server/.env if it exists (see .env.example) and
 * serves the routes in routes/dataset.ts.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_API_PORT } from '@tippingpoint/shared';
import { buildApp } from './app.ts';

// Loaded here rather than with `node --env-file`, which crashes `node --watch` when the
// optional .env file doesn't exist.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT ?? DEFAULT_API_PORT);
const app = buildApp(undefined, true);

await app.listen({ port, host: '127.0.0.1' });
