/**
 * run.ts: the pipeline's command-line entry point (`npm run data`).
 *
 * Runs every stage for every election in the registry:
 *   1. sources    download raw files into data/raw (reused if already there)
 *   2. normalize  raw rows → PlaceResult
 *   3. join       check results against the map and each other (coverage report)
 *   5. emit       write data/processed (stage 4, derive, arrives in Phase 2)
 *
 * Options:
 *   --stage sources   only download (useful to prefetch, then work offline)
 *
 * If the county file hasn't been downloaded (it needs a manual guestbook step), the
 * pipeline still emits state-level results and prints the steps to get the county file.
 */

import { readFile } from 'node:fs/promises';
import { ELECTIONS, SOURCES, type ManifestEntry } from '@tippingpoint/shared';
import { checkCoverage, type ElectionCoverage } from './join.ts';
import { emitElection, emitRunSummary } from './emit.ts';
import {
  normalizeCounties,
  normalizeDistricts,
  normalizeStates,
  parseCsv,
  type MedslCountyRow,
  type MedslStateRow,
} from './normalize/president.ts';
import { fetchDataverseFile, ManualDownloadRequired } from './sources/dataverse.ts';

/** Download a source, or return undefined (after printing instructions) if it needs a manual step. */
async function fetchOptional(source: Parameters<typeof fetchDataverseFile>[0]): Promise<string | undefined> {
  try {
    return await fetchDataverseFile(source);
  } catch (error) {
    if (!(error instanceof ManualDownloadRequired)) throw error;
    console.warn(`\n⚠ ${error.message}\n  Continuing with state-level results only.\n`);
    return undefined;
  }
}

/** One line per election for the terminal summary. */
function summaryRow(coverage: ElectionCoverage): Record<string, string | number> {
  return {
    election: `${coverage.year} ${coverage.office}`,
    states: coverage.states,
    districts: coverage.districts,
    counties: coverage.countiesAvailable ? coverage.counties : 'not downloaded',
    'no map shape': coverage.resultsWithoutGeometry.length,
    'no result': coverage.geometryWithoutResults.length,
    'state ≠ county sum': coverage.stateSumMismatches.length,
  };
}

async function main(): Promise<void> {
  const stageOnly = process.argv.includes('--stage')
    ? process.argv[process.argv.indexOf('--stage') + 1]
    : undefined;

  // Stage 1: sources.
  const stateFile = await fetchDataverseFile(SOURCES['medsl-president-state']);
  const countyFile = await fetchOptional(SOURCES['medsl-president-county']);
  if (stageOnly === 'sources') {
    console.log('Sources downloaded to data/raw. Skipping the remaining stages (--stage sources).');
    return;
  }

  // Parse each raw file once and share the rows across elections.
  const stateRows = parseCsv<MedslStateRow>(await readFile(stateFile, 'utf8'));
  const countyRows =
    countyFile === undefined ? undefined : parseCsv<MedslCountyRow>(await readFile(countyFile, 'utf8'));

  const results = await Promise.all(
    ELECTIONS.map(async (election) => {
      // Stage 2: normalize.
      const national = [...normalizeStates(stateRows, election), ...normalizeDistricts(election)];
      const counties = countyRows === undefined ? undefined : normalizeCounties(countyRows, election);
      // Stage 3: join (checks only).
      const coverage = checkCoverage(election, national, counties);
      // Stage 5: emit.
      const countyStates = await emitElection(election, national, counties?.byState);
      const entry: ManifestEntry = { year: election.year, office: election.office, countyStates };
      return { entry, coverage };
    }),
  );

  await emitRunSummary(
    { elections: results.map((r) => r.entry) },
    results.map((r) => r.coverage),
  );
  console.table(results.map((r) => summaryRow(r.coverage)));
  console.log('Wrote data/processed. Full findings: data/processed/coverage.json');
}

await main();
