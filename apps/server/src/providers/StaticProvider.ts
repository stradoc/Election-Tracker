/**
 * StaticProvider.ts: serves historical results from the pipeline's JSON output.
 *
 * Server position: the ResultsProvider for every election up to 2024. Past results never
 * change, so each file is read from disk once and then kept in memory.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Manifest, ResultsDataset } from '@tippingpoint/shared';
import type { DatasetKey, ResultsProvider } from './ResultsProvider.ts';

/** data/processed, resolved from this file (apps/server/src/providers/). */
const DEFAULT_PROCESSED_DIR = fileURLToPath(
  new URL('../../../../data/processed/', import.meta.url),
);

/** Reads data/processed and caches every file it has read. */
export class StaticProvider implements ResultsProvider {
  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly processedDir: string;

  /** @param processedDir override for tests; defaults to the repo's data/processed */
  constructor(processedDir: string = DEFAULT_PROCESSED_DIR) {
    this.processedDir = processedDir;
  }

  /** The pipeline manifest. An empty manifest if the pipeline hasn't run yet. */
  async manifest(): Promise<Manifest> {
    const manifest = await this.readJson<Manifest>('manifest.json');
    return manifest ?? { elections: [] };
  }

  /** One dataset file, e.g. 2024/president/results.json or .../results/42.json. */
  async dataset(key: DatasetKey): Promise<ResultsDataset | undefined> {
    const base = path.join(String(key.year), key.office);
    const relative =
      key.stateFips === undefined
        ? path.join(base, `${key.dataset}.json`)
        : path.join(base, key.dataset, `${key.stateFips}.json`);
    return this.readJson<ResultsDataset>(relative);
  }

  /**
   * Read and cache a JSON file under processedDir; undefined if it doesn't exist.
   * The cache stores the pending promise, so simultaneous requests share one disk read.
   */
  private readJson<T>(relativePath: string): Promise<T | undefined> {
    const cached = this.cache.get(relativePath);
    if (cached !== undefined) return cached as Promise<T | undefined>;
    const pending = loadJson<T>(path.join(this.processedDir, relativePath));
    this.cache.set(relativePath, pending);
    return pending;
  }
}

/** Parse a JSON file, or return undefined if it doesn't exist. */
async function loadJson<T>(filePath: string): Promise<T | undefined> {
  if (!existsSync(filePath)) return undefined;
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text) as T;
}
