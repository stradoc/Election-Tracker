/**
 * shared.test.ts: unit tests for the shared election math.
 *
 * Table-driven: every input and expected value lives in shared.test.json, so the cases are
 * easy to read and extend without touching this file. Uses toy maps, so it runs without
 * downloaded data. Checks against real results (actual EV totals, real tipping points)
 * live in scripts/data and run once the pipeline has produced data/processed.
 */

import { describe, expect, it } from 'vitest';
import cases from './shared.test.json' with { type: 'json' };
import { atLargeElectoralVotes, electoralVotesFor } from './ev-tables.ts';
import { electoralTotals, majorityOf, tippingPoint } from './electoral.ts';
import { STATES } from './fips.ts';
import { formatMargin, marginOf } from './margins.ts';
import { computeScenario } from './scenario.ts';
import type { PlaceResult } from './schema.ts';
import { applyUniformSwing } from './swing.ts';
import { datasetPath, type DatasetKey } from './registry.ts';
import { turnoutRate } from './turnout.ts';

/** Every toy state has this many votes; fixtures give vote shares in percent of it. */
const TOY_TOTAL_VOTES = 1000;
const PERCENT = 100;

/** A toy state as written in the fixture file. */
interface ToyState {
  geoId: string;
  demPct: number;
  repPct: number;
  ev: number;
}

/** Turn a fixture row into a full PlaceResult. */
function toPlace(toy: ToyState): PlaceResult {
  const dem = (toy.demPct / PERCENT) * TOY_TOTAL_VOTES;
  const rep = (toy.repPct / PERCENT) * TOY_TOTAL_VOTES;
  return {
    geoId: toy.geoId,
    level: 'state',
    name: toy.geoId,
    stateFips: toy.geoId,
    dem,
    rep,
    other: TOY_TOTAL_VOTES - dem - rep,
    total: TOY_TOTAL_VOTES,
    electoralVotes: toy.ev,
  };
}

describe('ev-tables', () => {
  const ev = cases.evTables;

  it('every apportionment covers all 51 jurisdictions and sums to 538', () => {
    ev.years.forEach((year) => {
      const votes = Object.values(electoralVotesFor(year));
      expect(votes).toHaveLength(ev.jurisdictions);
      expect(votes).toHaveLength(STATES.length);
      expect(votes.reduce((a, b) => a + b, 0)).toBe(ev.totalVotes);
    });
  });

  it.each(ev.spotChecks)('$postal has $votes EVs in $year', ({ year, postal, votes }) => {
    expect(electoralVotesFor(year)[postal]).toBe(votes);
  });

  it.each(ev.atLarge)('$postal statewide winner gets $votes EVs in $year', (row) => {
    expect(atLargeElectoralVotes(row.year, row.postal)).toBe(row.votes);
  });

  it('rejects years with no recorded apportionment', () => {
    expect(() => electoralVotesFor(ev.unsupportedYear)).toThrow('apportionment');
  });
});

describe('margins', () => {
  it.each(cases.formatMargin)('formats $margin as $label', ({ margin, label }) => {
    expect(formatMargin(margin)).toBe(label);
  });

  it('treats a place with no votes as even', () => {
    expect(marginOf({ dem: 0, rep: 0, total: 0 })).toBe(0);
  });
});

describe('uniform swing', () => {
  const { swing, extremeSwing, precisionDigits } = cases.swing;
  const places = cases.swing.places.map(toPlace);

  it('shifts every margin by the same amount and keeps totals', () => {
    applyUniformSwing(places, swing).forEach((place, i) => {
      const original = places[i]!;
      expect(marginOf(place)).toBeCloseTo(marginOf(original) + swing, precisionDigits);
      expect(place.total).toBe(original.total);
      expect(place.other).toBe(original.other);
      expect(place.dem + place.rep).toBeCloseTo(original.dem + original.rep, precisionDigits);
    });
  });

  it('never produces negative votes on extreme swings', () => {
    applyUniformSwing(places, extremeSwing).forEach((place) => {
      expect(place.dem).toBeGreaterThanOrEqual(0);
      expect(place.rep).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('electoral college', () => {
  const fixture = cases.electoral;
  const map = fixture.map.map(toPlace);

  it('totals EVs by leader and computes the majority line', () => {
    expect(electoralTotals(map)).toEqual(fixture.expectedTotals);
    expect(majorityOf(fixture.majority.of)).toBe(fixture.majority.is);
  });

  it("finds the winner's decisive state as the tipping point", () => {
    expect(tippingPoint(map)?.geoId).toBe(fixture.tippingPoint);
  });

  it('returns no tipping point when nobody has a majority', () => {
    expect(tippingPoint(fixture.noMajorityMap.map(toPlace))).toBeUndefined();
  });
});

describe('scenario engine', () => {
  const fixture = cases.scenario;
  const map = fixture.map.map(toPlace);

  it('leaves real results unchanged with no swing', () => {
    const result = computeScenario(map, { swing: 0 });
    expect(result.electoral.dem).toBe(fixture.actual.dem);
    expect(result.tippingPointId).toBe(fixture.actual.tippingPoint);
  });

  it.each(fixture.flips)('a $swing swing gives D $dem / R $rep', ({ swing, dem, rep }) => {
    const { electoral } = computeScenario(map, { swing });
    expect(electoral.dem).toBe(dem);
    expect(electoral.rep).toBe(rep);
  });
});

describe('dataset paths', () => {
  it.each(cases.datasetPath)('$path', ({ key, path }) => {
    expect(datasetPath(key as DatasetKey)).toBe(path);
  });
});

describe('turnout', () => {
  const { votes, cvap, rate } = cases.turnout;

  it('divides votes cast by citizens 18+', () => {
    expect(turnoutRate({ total: votes }, { cvap })).toBe(rate);
  });

  it('is unknown without a profile or with zero citizens', () => {
    expect(turnoutRate({ total: votes }, undefined)).toBeUndefined();
    expect(turnoutRate({ total: votes }, { cvap: 0 })).toBeUndefined();
  });
});
