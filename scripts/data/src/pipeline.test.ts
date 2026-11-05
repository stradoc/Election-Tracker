/**
 * pipeline.test.ts: checks the pipeline's output against known election results.
 *
 * The data tests read data/processed and skip themselves when it hasn't been generated
 * (run `npm run data` first). Expected values live in pipeline.test.json.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  computeScenario,
  findElection,
  type ProfilesDataset,
  type ResultsDataset,
} from '@tippingpoint/shared';
import cases from './pipeline.test.json' with { type: 'json' };
import { sideOf } from './normalize/president.ts';
import { PROCESSED_DIR, processedPathFor } from './paths.ts';

const hasProcessedData = existsSync(PROCESSED_DIR);

describe('candidate matching', () => {
  it.each(cases.sideOf)('"$candidate" counts as $side', ({ candidate, nominees, side }) => {
    expect(sideOf(candidate, nominees)).toBe(side);
  });
});

describe.skipIf(!hasProcessedData)('processed results reproduce real outcomes', () => {
  it.each(cases.elections)('$year: D $dem / R $rep, tipping point $tippingPoint', async (known) => {
    const election = findElection(known.year, 'president');
    expect(election).toBeDefined();
    const file = processedPathFor({ year: known.year, office: 'president', dataset: 'results' });
    const dataset = JSON.parse(await readFile(file, 'utf8')) as ResultsDataset;

    expect(dataset.places).toHaveLength(cases.placesPerElection);
    const actual = computeScenario(dataset.places, { swing: 0 });
    expect(actual.electoral.dem).toBe(known.dem);
    expect(actual.electoral.rep).toBe(known.rep);
    expect(actual.tippingPointId).toBe(known.tippingPoint);
  });
});

describe.skipIf(!hasProcessedData)('processed profiles match the Census', () => {
  const known = cases.profiles;
  const read = async <T>(stateFips?: string): Promise<T> =>
    JSON.parse(
      await readFile(
        processedPathFor({ year: known.year, office: 'president', dataset: 'profiles', stateFips }),
        'utf8',
      ),
    ) as T;

  it('has a profile for every state and D.C.', async () => {
    const national = await read<ProfilesDataset>();
    expect(national.places).toHaveLength(known.states);
  });

  it.each(known.counties)('$geoId matches the ACS ($period)', async (county) => {
    const state = await read<ProfilesDataset>(county.stateFips);
    expect(state.places.find((p) => p.geoId === county.geoId)).toMatchObject({
      population: county.population,
      period: county.period,
    });
  });
});
