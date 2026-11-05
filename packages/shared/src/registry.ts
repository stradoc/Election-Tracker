/**
 * registry.ts: the single list of elections TippingPoint covers.
 *
 * Pipeline position: the top of everything. The pipeline builds data for each entry, the
 * server only answers for registered elections, and the web app's year/office pills are
 * generated from this list.
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
  /** Sources the pipeline combines for this election. */
  readonly sources: readonly SourceId[];
}

/** Datasets the API serves for an election. Phase 2 adds profiles, turnout, groups, polls. */
export const DATASETS = ['results'] as const;

/** Id of a dataset the API can serve. */
export type DatasetId = (typeof DATASETS)[number];

/** Sources every presidential election is built from. */
const PRESIDENT_SOURCES: readonly SourceId[] = [
  'medsl-president-state',
  'medsl-president-county',
  'ev-districts',
];

/** Every registered election, newest first. */
export const ELECTIONS: readonly ElectionEntry[] = electionsData.president
  .map((row) => ({
    year: row.year,
    office: 'president' as const,
    candidates: { dem: row.dem, rep: row.rep },
    sources: PRESIDENT_SOURCES,
  }))
  .sort((a, b) => b.year - a.year);

/** Find a registered election, or undefined if TippingPoint doesn't cover it. */
export function findElection(year: number, office: Office): ElectionEntry | undefined {
  return ELECTIONS.find((entry) => entry.year === year && entry.office === office);
}
