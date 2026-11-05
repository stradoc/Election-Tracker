/**
 * registry.ts: the single list of elections TippingPoint covers, and the datasets each has.
 *
 * Pipeline position: the top of everything. The pipeline builds data for each entry, the
 * server only answers for registered elections and datasets, and the web app's year/office
 * pills are generated from this list.
 *
 * The election rows live in ../data/elections.json. To add an election: add a row there,
 * make sure its sources exist in sources.ts and scripts/data, then run `npm run data`.
 * See AGENTS.md → "Add a year or office".
 */

import electionsData from '../data/elections.json' with { type: 'json' };
import type { Office } from './schema.ts';
import type { SourceId } from './sources.ts';

/** Major-party nominees as shown in the UI. The pipeline checks these against the data. */
export interface Nominees {
  readonly dem: string;
  readonly rep: string;
}

/** One election the app can show. */
export interface ElectionEntry {
  readonly year: number;
  readonly office: Office;
  readonly candidates: Nominees;
  /**
   * Final year of the ACS 5-year survey used for demographics. Each election uses the
   * survey ending in its own year (2024 → 2020–2024), so profiles describe the places as
   * they were around the vote.
   */
  readonly acsVintage: number;
  /** Sources the pipeline combines for this election. */
  readonly sources: readonly SourceId[];
}

/**
 * Datasets the API serves for an election, and whether each one differs by office.
 * Results are per office; demographic profiles depend only on the year. Phase 2 adds
 * turnout, group estimates and polls here.
 */
export const DATASET_INFO = {
  results: { perOffice: true },
  profiles: { perOffice: false },
} as const;

/** Id of a dataset the API can serve. */
export type DatasetId = keyof typeof DATASET_INFO;

/** Every dataset id, in registry order. */
export const DATASETS = Object.keys(DATASET_INFO) as DatasetId[];

/** Sources every presidential election is built from. */
const PRESIDENT_SOURCES: readonly SourceId[] = [
  'medsl-president-state',
  'medsl-president-county',
  'ev-districts',
  'census-acs5',
];

/** Every registered election, newest first. */
export const ELECTIONS: readonly ElectionEntry[] = electionsData.president
  .map((row) => ({
    year: row.year,
    office: 'president' as const,
    candidates: { dem: row.dem, rep: row.rep },
    acsVintage: row.acsVintage,
    sources: PRESIDENT_SOURCES,
  }))
  .sort((a, b) => b.year - a.year);

/** Find a registered election, or undefined if TippingPoint doesn't cover it. */
export function findElection(year: number, office: Office): ElectionEntry | undefined {
  return ELECTIONS.find((entry) => entry.year === year && entry.office === office);
}

/** Which file a dataset lives in. */
export interface DatasetKey {
  readonly year: number;
  readonly office: Office;
  readonly dataset: DatasetId;
  /** Omit for the national file; set for one state's counties. */
  readonly stateFips?: string;
}

/**
 * Path of a dataset file relative to data/processed. The pipeline writes here and the
 * server reads here, so the layout is defined once:
 *   2024/president/results.json        results, per office
 *   2024/president/results/42.json     one state's county results
 *   2024/profiles.json                 profiles, shared by every office in a year
 *   2024/profiles/42.json              one state's county profiles
 */
export function datasetPath(key: DatasetKey): string {
  const folder = DATASET_INFO[key.dataset].perOffice ? `${key.year}/${key.office}` : `${key.year}`;
  return key.stateFips === undefined
    ? `${folder}/${key.dataset}.json`
    : `${folder}/${key.dataset}/${key.stateFips}.json`;
}
