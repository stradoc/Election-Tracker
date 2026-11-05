/**
 * paths.ts: where the pipeline reads and writes, all inside the repository.
 *
 * Pipeline position: used by every stage. Raw downloads go to data/raw/<source id>/ and
 * generated JSON goes to data/processed/. Both folders are gitignored (RULES.md rules 2–3).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { datasetPath, type DatasetKey } from '@tippingpoint/shared';

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
 * Absolute output path for one dataset file. The layout itself (which folders, which
 * datasets are per office) is defined once in the shared datasetPath(), which the server
 * also uses to read the files.
 */
export function processedPathFor(key: DatasetKey): string {
  return path.join(PROCESSED_DIR, datasetPath(key));
}
