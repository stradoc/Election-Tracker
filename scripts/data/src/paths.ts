/**
 * paths.ts: where the pipeline reads and writes, all inside the repository.
 *
 * Pipeline position: used by every stage. Raw downloads go to data/raw/<source id>/ and
 * generated JSON goes to data/processed/. Both folders are gitignored (RULES.md rules 2–3).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Repository root (this file is at scripts/data/src/paths.ts). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Downloaded third-party files, one folder per source id. */
export const RAW_DIR = path.join(REPO_ROOT, 'data', 'raw');

/** Pipeline output, read by the server. */
export const PROCESSED_DIR = path.join(REPO_ROOT, 'data', 'processed');

/** Folder for one source's raw files, e.g. data/raw/medsl-president-state. */
export function rawDirFor(sourceId: string): string {
  return path.join(RAW_DIR, sourceId);
}

/**
 * Output path for one dataset, e.g. data/processed/2024/president/results.json, or with a
 * state, data/processed/2024/president/results/42.json (Pennsylvania's counties).
 */
export function processedPathFor(
  year: number,
  office: string,
  dataset: string,
  stateFips?: string,
): string {
  const base = path.join(PROCESSED_DIR, String(year), office);
  return stateFips === undefined
    ? path.join(base, `${dataset}.json`)
    : path.join(base, dataset, `${stateFips}.json`);
}
