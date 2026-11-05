/**
 * acs.test.ts: unit tests for the ACS normalizer, on synthetic Census API tables.
 *
 * Pins down each rule in normalize/acs.ts: measures are sums of variables, shares use the
 * right base, "not available" codes become null, Connecticut takes its counties from the
 * override survey year, Alaska has no counties, and non-states (Puerto Rico) are dropped.
 * Tables and expected values live in acs.test.json.
 */

import { describe, expect, it } from 'vitest';
import type { ElectionEntry } from '@tippingpoint/shared';
import { tableKey, type AcsTable } from '../sources/acs.ts';
import fixture from './acs.test.json' with { type: 'json' };
import { profilesForElection } from './acs.ts';

const election = fixture.election as ElectionEntry;
const tables = new Map(
  (fixture.tables as AcsTable[]).map((table) => [tableKey(table.vintage, table.geography), table]),
);

describe('profilesForElection', () => {
  const { states, countiesByState, periods } = profilesForElection(election, tables);
  const counties = new Map([...countiesByState.values()].flat().map((c) => [c.geoId, c]));
  const expected = fixture.expected;

  it('keeps the 50 states and D.C. only (drops Puerto Rico)', () => {
    expect(states.map((s) => s.geoId).sort()).toEqual(expected.states);
  });

  it('has no county layer for Alaska', () => {
    expect([...countiesByState.keys()].sort()).toEqual(expected.countyStates);
  });

  it.each(Object.entries(expected.counties))('state %s has the right counties', (fips, ids) => {
    expect((countiesByState.get(fips) ?? []).map((c) => c.geoId).sort()).toEqual(ids);
  });

  it('sums variables and divides shares by the right base', () => {
    expect(counties.get('42003')).toMatchObject(expected.allegheny);
  });

  it('takes Connecticut counties from the override survey year', () => {
    expect(counties.get('09001')?.period).toBe(expected.fairfieldPeriod);
    expect([...periods].sort()).toEqual(expected.periods);
  });

  it('turns the Census "not available" code into null', () => {
    expect(counties.get('42001')?.medianHouseholdIncome).toBe(expected.adamsIncome);
  });
});
