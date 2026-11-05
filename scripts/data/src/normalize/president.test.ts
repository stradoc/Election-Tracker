/**
 * president.test.ts: unit tests for the county normalizer, on synthetic MEDSL rows.
 *
 * The real county file needs a manual download, so these tests pin down each data rule
 * (vote modes, FIPS remaps, skipped states, rows without a county) with small made-up
 * rows from president.test.json.
 */

import { describe, expect, it } from 'vitest';
import type { ElectionEntry } from '@tippingpoint/shared';
import fixture from './president.test.json' with { type: 'json' };
import { normalizeCounties, type MedslCountyRow } from './president.ts';

const election = fixture.election as ElectionEntry;
const rows: MedslCountyRow[] = fixture.rows;

describe('normalizeCounties', () => {
  const { byState, skips } = normalizeCounties(rows, election);
  const counties = new Map([...byState.values()].flat().map((county) => [county.geoId, county]));

  it('groups counties by state and skips states with no county layer (Alaska)', () => {
    expect([...byState.keys()].sort()).toEqual(fixture.expected.states);
  });

  it.each(Object.entries(fixture.expected.counties))('%s has the expected totals', (fips, expected) => {
    expect(counties.get(fips)).toMatchObject(expected);
  });

  it('counts rows that have no county code', () => {
    expect(skips.noFips).toBe(fixture.expected.noFips);
  });
});
