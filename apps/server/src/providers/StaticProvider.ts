/**
 * StaticProvider.ts: serves historical data from the pipeline's JSON output.
 *
 * Server position: the DataProvider for every election up to 2024. Files are read from
 * data/processed at the paths the shared datasetPath() defines and kept in memory. Each
 * cached file remembers its modification time, so after `npm run data` regenerates it the
 * next request picks up the new version without restarting the server. Missing files
 * aren't cached, so data generated while the server runs appears straight away.
 */

import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datasetPath, type Dataset, type DatasetKey, type Manifest } from '@tippingpoint/shared';
import type { DataProvider } from './DataProvider.ts';

/** data/processed, resolved from this file (apps/server/src/providers/). */
const DEFAULT_PROCESSED_DIR = fileURLToPath(
  new URL('../../../../data/processed/', import.meta.url),
);

/** A parsed file and the modification time it was read at. */
interface CacheEntry {
  readonly modifiedMs: number;
  readonly value: unknown;
}

/** Reads data/processed, caching each file until it changes on disk. */
export class StaticProvider implements DataProvider {
  private readonly cache = new Map<string, CacheEntry>();
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

  /** One dataset file, e.g. 2024/president/results.json or 2024/profiles/42.json. */
  dataset(key: DatasetKey): Promise<Dataset<unknown> | undefined> {
    return this.readJson<Dataset<unknown>>(datasetPath(key));
  }

  /** Read a JSON file under processedDir (cached until it changes); undefined if missing. */
  private async readJson<T>(relativePath: string): Promise<T | undefined> {
    const filePath = path.join(this.processedDir, relativePath);
    const modifiedMs = await modificationTime(filePath);
    if (modifiedMs === undefined) return undefined;
    const cached = this.cache.get(relativePath);
    if (cached?.modifiedMs === modifiedMs) return cached.value as T;
    const value = JSON.parse(await readFile(filePath, 'utf8')) as T;
    this.cache.set(relativePath, { modifiedMs, value });
    return value;
  }
}

/** A file's modification time in ms, or undefined if it doesn't exist. */
async function modificationTime(filePath: string): Promise<number | undefined> {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return undefined;
  }
}
