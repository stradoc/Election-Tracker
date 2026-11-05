/**
 * app.test.ts: API route tests, run in memory through Fastify's inject().
 *
 * Tests that need generated data skip themselves until `npm run data` has run.
 * Expected values live in app.test.json.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ResultsDataset } from '@tippingpoint/shared';
import { buildApp } from './app.ts';
import cases from './app.test.json' with { type: 'json' };

const hasProcessedData = existsSync(
  new URL('../../../data/processed/manifest.json', import.meta.url),
);

describe('API errors', () => {
  const app = buildApp();

  it.each(cases.notFound)('$url → 404', async ({ url }) => {
    const response = await app.inject({ url });
    expect(response.statusCode).toBe(cases.status.notFound);
    expect(response.json()).toHaveProperty('message');
  });
});

describe.skipIf(!hasProcessedData)('API with generated data', () => {
  const app = buildApp();

  it('lists every generated election', async () => {
    const response = await app.inject({ url: '/api/elections' });
    expect(response.statusCode).toBe(cases.status.ok);
    expect(response.json()).toHaveLength(cases.electionCount);
  });

  it('serves the national results file with cache headers', async () => {
    const response = await app.inject({ url: cases.nationalUrl });
    expect(response.statusCode).toBe(cases.status.ok);
    expect(response.headers['cache-control']).toContain('max-age');
    const dataset = response.json<ResultsDataset>();
    expect(dataset.scope).toBe('national');
    expect(dataset.places).toHaveLength(cases.nationalPlaces);
  });
});
