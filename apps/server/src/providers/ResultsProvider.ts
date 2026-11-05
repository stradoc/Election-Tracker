/**
 * ResultsProvider.ts: the one interface the API reads election data through.
 *
 * Server position: routes never touch files or feeds directly. Today the only
 * implementation is StaticProvider (historical results from data/processed). Phase 6 adds
 * a live provider for future elections behind this same interface, so routes and the web
 * app don't change.
 */

import type { DatasetId, Manifest, Office, ResultsDataset } from '@tippingpoint/shared';

/** Identifies one dataset file: an election, a dataset kind, and optionally one state. */
export interface DatasetKey {
  readonly year: number;
  readonly office: Office;
  readonly dataset: DatasetId;
  /** Omit for the national file; set for one state's counties. */
  readonly stateFips?: string;
}

/** Source of election data for the API. */
export interface ResultsProvider {
  /** What data exists (the pipeline's manifest). */
  manifest(): Promise<Manifest>;
  /** One dataset, or undefined if it wasn't generated. */
  dataset(key: DatasetKey): Promise<ResultsDataset | undefined>;
}
