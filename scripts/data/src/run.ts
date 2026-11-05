/**
 * run.ts: the pipeline's command-line entry point (`npm run data`).
 *
 * Runs every stage for every election in the registry:
 *   1. sources    download raw files into data/raw (reused if already there)
 *   2. normalize  raw rows → PlaceResult (results) and GeoProfile (demographics)
 *   3. join       check results, map shapes and profiles line up (coverage report)
 *   5. emit       write data/processed (stage 4, derive, arrives with Phase 2 analysis)
 *
 * Options:
 *   --stage sources   only download (useful to prefetch, then work offline)
 *
 * Sources that need the owner (the guestbook-protected county file, the Census API key)
 * are optional: the pipeline prints what to do and emits everything else.
 * Secrets are read from scripts/data/.env (see .env.example).
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ELECTIONS, SOURCES, type DatasetId, type ManifestEntry } from '@tippingpoint/shared';
import { checkCoverage, type ElectionCoverage } from './join.ts';
import { emitProfiles, emitResults, emitRunSummary } from './emit.ts';
import { profilesForElection } from './normalize/acs.ts';
import {
  normalizeCounties,
  normalizeDistricts,
  normalizeStates,
  parseCsv,
  type MedslCountyRow,
  type MedslStateRow,
} from './normalize/president.ts';
import { fetchAcsTables } from './sources/acs.ts';
import { fetchDataverseFile, OwnerActionRequired } from './sources/dataverse.ts';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));

/**
 * Run a step that needs the owner's help (a manual download, an API key). If that help is
 * missing, print the instructions and return undefined so the rest of the pipeline runs.
 */
async function optional<T>(step: () => Promise<T>, without: string): Promise<T | undefined> {
  try {
    return await step();
  } catch (error) {
    if (!(error instanceof OwnerActionRequired)) throw error;
    console.warn(`\n⚠ ${error.message}\n  Continuing without ${without}.\n`);
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
    profiles: coverage.profilesAvailable ? coverage.countyProfiles : 'no API key',
    'no map shape': coverage.resultsWithoutGeometry.length,
    'no result': coverage.geometryWithoutResults.length,
    'no profile': coverage.resultsWithoutProfile.length,
    'state ≠ county sum': coverage.stateSumMismatches.length,
    'wrong-state rows': coverage.rowsInWrongState.length,
    explained: coverage.explained.length,
  };
}

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  const stageOnly = process.argv.includes('--stage')
    ? process.argv[process.argv.indexOf('--stage') + 1]
    : undefined;

  // Stage 1: sources.
  const stateFile = await fetchDataverseFile(SOURCES['medsl-president-state']);
  const countyFile = await optional(
    () => fetchDataverseFile(SOURCES['medsl-president-county']),
    'county results',
  );
  const acsTables = await optional(() => fetchAcsTables(ELECTIONS), 'demographic profiles');
  if (stageOnly === 'sources') {
    console.log('Sources downloaded to data/raw. Skipping the remaining stages (--stage sources).');
    return;
  }

  // Parse each raw file once and share the rows across elections.
  const stateRows = parseCsv<MedslStateRow>(await readFile(stateFile, 'utf8'));
  const countyRows =
    countyFile === undefined
      ? undefined
      : parseCsv<MedslCountyRow>(await readFile(countyFile, 'utf8'));

  const results = await Promise.all(
    ELECTIONS.map(async (election) => {
      // Stage 2: normalize.
      const national = [...normalizeStates(stateRows, election), ...normalizeDistricts(election)];
      const counties =
        countyRows === undefined ? undefined : normalizeCounties(countyRows, election);
      const profiles = acsTables === undefined ? undefined : profilesForElection(election, acsTables);
      // Stage 3: join (checks only).
      const coverage = checkCoverage(election, national, counties, profiles);
      // Stage 5: emit.
      const countyStates = await emitResults(election, national, counties?.byState);
      const datasets: DatasetId[] = ['results'];
      if (profiles !== undefined) {
        await emitProfiles(election, profiles.states, profiles.countiesByState, profiles.periods);
        datasets.push('profiles');
      }
      const entry: ManifestEntry = {
        year: election.year,
        office: election.office,
        countyStates,
        datasets,
      };
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
