/**
 * emit.ts: write normalized, checked results as JSON for the server.
 *
 * Pipeline position: stage 5 (emit), the last stage. (Stage 4, derive, arrives in
 * Phase 2 for swing, turnout and group estimates.) Output layout:
 *   data/processed/manifest.json                     what was generated
 *   data/processed/coverage.json                     the join stage's findings
 *   data/processed/<year>/<office>/results.json      states + ME/NE districts
 *   data/processed/<year>/<office>/results/<fips>.json  one state's counties
 * Output is deterministic: same inputs → byte-identical files (no timestamps, sorted rows).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SOURCES,
  type ElectionEntry,
  type Manifest,
  type PlaceResult,
  type ResultsDataset,
  type SourceRef,
} from '@tippingpoint/shared';
import type { ElectionCoverage } from './join.ts';
import { PROCESSED_DIR, processedPathFor } from './paths.ts';

/** Indentation for the human-read files (manifest, coverage). Data files stay compact. */
const READABLE_INDENT = 2;

/** Which source versions each dataset was built from (shown in the API and on the page). */
const NATIONAL_SOURCES: readonly SourceRef[] = [
  { id: 'medsl-president-state', version: `Dataverse v${SOURCES['medsl-president-state'].dataverse.version}` },
  { id: 'ev-districts', version: 'curated from certified results' },
];
const COUNTY_SOURCES: readonly SourceRef[] = [
  { id: 'medsl-president-county', version: `Dataverse v${SOURCES['medsl-president-county'].dataverse.version}` },
];

/** Write a JSON file, creating folders as needed. */
async function writeJson(filePath: string, value: unknown, indent?: number): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, indent)}\n`);
}

/** Sort places by id so output order never depends on input order. */
function sorted(places: readonly PlaceResult[]): PlaceResult[] {
  return [...places].sort((a, b) => a.geoId.localeCompare(b.geoId));
}

/**
 * Write one election's results files.
 * @returns state FIPS codes that got a county file (for the manifest)
 */
export async function emitElection(
  election: ElectionEntry,
  national: readonly PlaceResult[],
  countiesByState: Map<string, PlaceResult[]> | undefined,
): Promise<string[]> {
  const nationalDataset: ResultsDataset = {
    year: election.year,
    office: election.office,
    scope: 'national',
    candidates: election.candidates,
    places: sorted(national),
    sources: [...NATIONAL_SOURCES],
  };
  await writeJson(processedPathFor(election.year, election.office, 'results'), nationalDataset);

  const stateEntries = [...(countiesByState ?? new Map<string, PlaceResult[]>()).entries()];
  await Promise.all(
    stateEntries.map(([stateFips, counties]) => {
      const stateDataset: ResultsDataset = {
        year: election.year,
        office: election.office,
        scope: 'state',
        stateFips,
        candidates: election.candidates,
        places: sorted(counties),
        sources: [...COUNTY_SOURCES],
      };
      return writeJson(
        processedPathFor(election.year, election.office, 'results', stateFips),
        stateDataset,
      );
    }),
  );
  return stateEntries.map(([stateFips]) => stateFips).sort();
}

/** Write the manifest and the coverage report for the whole run. */
export async function emitRunSummary(
  manifest: Manifest,
  coverage: readonly ElectionCoverage[],
): Promise<void> {
  await writeJson(path.join(PROCESSED_DIR, 'manifest.json'), manifest, READABLE_INDENT);
  await writeJson(path.join(PROCESSED_DIR, 'coverage.json'), coverage, READABLE_INDENT);
}
