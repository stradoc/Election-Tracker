/**
 * emit.ts: write normalized, checked data as JSON for the server.
 *
 * Pipeline position: stage 5 (emit), the last stage. (Stage 4, derive, arrives with the
 * Phase 2 analysis modules.) Every dataset is written the same way, as one national file
 * plus one file per state, at the paths the shared datasetPath() defines:
 *   data/processed/manifest.json           what was generated
 *   data/processed/coverage.json           the join stage's findings
 *   data/processed/2024/president/results.json   (+ results/<fips>.json per state)
 *   data/processed/2024/profiles.json             (+ profiles/<fips>.json per state)
 * Output is deterministic: same inputs → byte-identical files (no timestamps, sorted rows).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SOURCES,
  type Dataset,
  type DatasetId,
  type ElectionEntry,
  type GeoProfile,
  type Manifest,
  type PlaceResult,
  type SourceRef,
} from '@tippingpoint/shared';
import type { ElectionCoverage } from './join.ts';
import { PROCESSED_DIR, processedPathFor } from './paths.ts';

/** Indentation for the human-read files (manifest, coverage). Data files stay compact. */
const READABLE_INDENT = 2;

/** Which source versions the results files were built from (shown in the API). */
const RESULTS_SOURCES: { national: readonly SourceRef[]; state: readonly SourceRef[] } = {
  national: [
    {
      id: 'medsl-president-state',
      version: `Dataverse v${SOURCES['medsl-president-state'].dataverse.version}`,
    },
    { id: 'ev-districts', version: 'curated from certified results' },
  ],
  state: [
    {
      id: 'medsl-president-county',
      version: `Dataverse v${SOURCES['medsl-president-county'].dataverse.version}`,
    },
  ],
};

/** Write a JSON file, creating folders as needed. */
async function writeJson(filePath: string, value: unknown, indent?: number): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, indent)}\n`);
}

/** Sort places by id so output order never depends on input order. */
function sorted<Place extends { geoId: string }>(places: readonly Place[]): Place[] {
  return [...places].sort((a, b) => a.geoId.localeCompare(b.geoId));
}

/**
 * Write one dataset: a national file and one file per state.
 * @param extra fields added to every file of this dataset (e.g. office and nominees)
 * @returns state FIPS codes that got a file, sorted (for the manifest)
 */
async function emitDataset<Place extends { geoId: string }>(
  election: ElectionEntry,
  dataset: DatasetId,
  national: readonly Place[],
  byState: ReadonlyMap<string, Place[]> | undefined,
  sources: { national: readonly SourceRef[]; state: readonly SourceRef[] },
  extra: object = {},
): Promise<string[]> {
  const key = { year: election.year, office: election.office, dataset };
  const nationalFile: Dataset<Place> = {
    year: election.year,
    ...extra,
    scope: 'national',
    places: sorted(national),
    sources: [...sources.national],
  };
  await writeJson(processedPathFor(key), nationalFile);

  const states = [...(byState ?? new Map<string, Place[]>()).entries()];
  await Promise.all(
    states.map(([stateFips, places]) => {
      const stateFile: Dataset<Place> = {
        year: election.year,
        ...extra,
        scope: 'state',
        stateFips,
        places: sorted(places),
        sources: [...sources.state],
      };
      return writeJson(processedPathFor({ ...key, stateFips }), stateFile);
    }),
  );
  return states.map(([stateFips]) => stateFips).sort();
}

/**
 * Write one election's results files.
 * @returns state FIPS codes that got a county file (for the manifest)
 */
export function emitResults(
  election: ElectionEntry,
  national: readonly PlaceResult[],
  countiesByState: ReadonlyMap<string, PlaceResult[]> | undefined,
): Promise<string[]> {
  return emitDataset(election, 'results', national, countiesByState, RESULTS_SOURCES, {
    office: election.office,
    candidates: election.candidates,
  });
}

/**
 * Write one election year's demographic profiles (states, and counties per state).
 * @param periods the ACS survey periods used, e.g. ["2020–2024", "2017–2021"], for the source note
 */
export function emitProfiles(
  election: ElectionEntry,
  states: readonly GeoProfile[],
  countiesByState: ReadonlyMap<string, GeoProfile[]>,
  periods: readonly string[],
): Promise<string[]> {
  const acs: readonly SourceRef[] = [
    { id: 'census-acs5', version: `ACS 5-year ${periods.join(', ')}` },
  ];
  return emitDataset(election, 'profiles', states, countiesByState, { national: acs, state: acs });
}

/** Write the manifest and the coverage report for the whole run. */
export async function emitRunSummary(
  manifest: Manifest,
  coverage: readonly ElectionCoverage[],
): Promise<void> {
  await writeJson(path.join(PROCESSED_DIR, 'manifest.json'), manifest, READABLE_INDENT);
  await writeJson(path.join(PROCESSED_DIR, 'coverage.json'), coverage, READABLE_INDENT);
}
