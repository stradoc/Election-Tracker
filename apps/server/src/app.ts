/**
 * app.ts: builds the Fastify app without starting it, so tests can call it in memory.
 *
 * Server position: wiring only. index.ts starts this app; app.test.ts uses Fastify's
 * inject() to exercise the same routes without opening a port.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import type { ResultsProvider } from './providers/ResultsProvider.ts';
import { StaticProvider } from './providers/StaticProvider.ts';
import { registerRoutes } from './routes/dataset.ts';

/**
 * Create the API app.
 * @param provider where results come from (defaults to the static historical files)
 * @param logger whether Fastify logs requests (off in tests)
 */
export function buildApp(
  provider: ResultsProvider = new StaticProvider(),
  logger = false,
): FastifyInstance {
  const app = Fastify({ logger });
  registerRoutes(app, provider);
  return app;
}
