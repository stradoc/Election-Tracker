/**
 * join.ts: check that results line up with the map before anything is emitted.
 *
 * Pipeline position: stage 3 (join). Phase 1 joins results to boundaries by FIPS code;
 * Phase 2 adds ACS demographics on the same key. This stage changes no numbers. It
 * reports every place that fails to match, so data gaps are visible instead of silently
 * leaving blank counties on the map.
 */

import countiesTopology from 'us-atlas/counties-albers-10m.json' with { type: 'json' };
import type { ElectionEntry, PlaceResult } from '@tippingpoint/shared';
import type { CountySkips } from './normalize/president.ts';

/**
 * County sums and statewide totals come from different MEDSL files and can differ a
 * little (e.g. statewide overseas ballots). Differences above this share get reported.
 */
const STATE_SUM_TOLERANCE = 0.005;

/** Every county code in the map's boundary file. */
const GEOMETRY_COUNTY_IDS: ReadonlySet<string> = new Set(
  countiesTopology.objects.counties.geometries.map((geometry) => String(geometry.id)),
);

/** A state whose county results don't add up to its statewide result. */
export interface StateSumMismatch {
  stateFips: string;
  name: string;
  /** (county sum − statewide) / statewide, for each party. */
  demDiff: number;
  repDiff: number;
}

/** Everything the join stage found for one election. Written to data/processed/coverage.json. */
export interface ElectionCoverage {
  year: number;
  office: string;
  states: number;
  districts: number;
  /** False when the county source hasn't been downloaded yet. */
  countiesAvailable: boolean;
  counties: number;
  /** County results whose code has no shape on the map. */
  resultsWithoutGeometry: string[];
  /** Map shapes with no county result (skipped states excluded). */
  geometryWithoutResults: string[];
  stateSumMismatches: StateSumMismatch[];
  countyRowsWithoutFips: number;
  skippedStates: Record<string, string>;
}

/**
 * Check one election's normalized results against the map and against each other.
 * @param national statewide + district results
 * @param counties county results by state, or undefined if the county file is missing
 */
export function checkCoverage(
  election: ElectionEntry,
  national: readonly PlaceResult[],
  counties: { byState: Map<string, PlaceResult[]>; skips: CountySkips } | undefined,
): ElectionCoverage {
  const states = national.filter((place) => place.level === 'state');
  const base = {
    year: election.year,
    office: election.office,
    states: states.length,
    districts: national.filter((place) => place.level === 'district').length,
  };
  if (counties === undefined) {
    return {
      ...base,
      countiesAvailable: false,
      counties: 0,
      resultsWithoutGeometry: [],
      geometryWithoutResults: [],
      stateSumMismatches: [],
      countyRowsWithoutFips: 0,
      skippedStates: {},
    };
  }

  const countyPlaces = [...counties.byState.values()].flat();
  const resultIds = new Set(countyPlaces.map((county) => county.geoId));
  const skippedStateCodes = Object.keys(counties.skips.skippedStates);

  return {
    ...base,
    countiesAvailable: true,
    counties: countyPlaces.length,
    resultsWithoutGeometry: [...resultIds].filter((id) => !GEOMETRY_COUNTY_IDS.has(id)).sort(),
    geometryWithoutResults: [...GEOMETRY_COUNTY_IDS]
      .filter((id) => !resultIds.has(id) && !skippedStateCodes.some((code) => id.startsWith(code)))
      .sort(),
    stateSumMismatches: states
      .map((state) => compareCountySum(state, counties.byState.get(state.stateFips) ?? []))
      .filter((mismatch): mismatch is StateSumMismatch => mismatch !== undefined),
    countyRowsWithoutFips: counties.skips.noFips,
    skippedStates: counties.skips.skippedStates,
  };
}

/** Compare a state's county sums to its statewide result; undefined if within tolerance. */
function compareCountySum(
  state: PlaceResult,
  counties: readonly PlaceResult[],
): StateSumMismatch | undefined {
  if (counties.length === 0) return undefined; // skipped states (Alaska) have no counties
  const sum = (key: 'dem' | 'rep'): number => counties.reduce((acc, c) => acc + c[key], 0);
  const demDiff = (sum('dem') - state.dem) / state.dem;
  const repDiff = (sum('rep') - state.rep) / state.rep;
  const within = Math.abs(demDiff) <= STATE_SUM_TOLERANCE && Math.abs(repDiff) <= STATE_SUM_TOLERANCE;
  return within ? undefined : { stateFips: state.stateFips, name: state.name, demDiff, repDiff };
}
