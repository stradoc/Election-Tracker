/**
 * DataProvider.ts: the one interface the API reads election data through.
 *
 * Server position: routes never touch files or feeds directly. Today the only
 * implementation is StaticProvider (historical data from data/processed). Phase 6 adds a
 * live provider for future elections behind this same interface, so routes and the web
 * app don't change. Dataset keys and file layout come from the shared registry.
 */

import type { Dataset, DatasetKey, Manifest } from '@tippingpoint/shared';

/** Source of election data (results, profiles, …) for the API. */
export interface DataProvider {
  /** What data exists (the pipeline's manifest). */
  manifest(): Promise<Manifest>;
  /** One dataset file, or undefined if it wasn't generated. */
  dataset(key: DatasetKey): Promise<Dataset<unknown> | undefined>;
}
