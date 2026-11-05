/**
 * join.ts: check that results line up with the map before anything is emitted.
 *
 * Pipeline position: stage 3 (join). Phase 1 joins results to boundaries by FIPS code;
 * Phase 2 adds ACS demographics on the same key. This stage changes no numbers. It
 * reports every place that fails to match, so data gaps are visible instead of silently
 * leaving blank counties on the map. Gaps with a documented reason (known-gaps.json) are
 * listed separately as "explained", so the problem counts only show what still needs work.
 */

import countiesTopology from 'us-atlas/counties-albers-10m.json' with { type: 'json' };
import type { ElectionEntry, GeoProfile, PlaceResult } from '@tippingpoint/shared';
import knownGaps from './known-gaps.json' with { type: 'json' };
import type { ElectionProfiles } from './normalize/acs.ts';
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

/** Map shapes known to have no result of their own, keyed by county FIPS, with the reason. */
const EXPLAINED_MISSING_RESULTS: Readonly<Record<string, string>> =
  knownGaps.geometryWithoutResults;

/** States whose county sums are known to differ from the statewide total, with the reason. */
const EXPLAINED_SUM_MISMATCHES: Readonly<Record<string, string>> = knownGaps.stateSumMismatches;

/** A state whose county results don't add up to its statewide result. */
export interface StateSumMismatch {
  stateFips: string;
  name: string;
  /** (county sum − statewide) / statewide, for each party. */
  demDiff: number;
  repDiff: number;
}

/** A finding that is expected, with the documented reason (from known-gaps.json). */
export interface ExplainedFinding {
  id: string;
  reason: string;
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
  /** Map shapes with no county result (skipped states and explained gaps excluded). */
  geometryWithoutResults: string[];
  /** States whose counties don't add up to the statewide result (explained ones excluded). */
  stateSumMismatches: StateSumMismatch[];
  /** "<postal>:<code>" rows dropped because their code belongs to another state. */
  rowsInWrongState: string[];
  /** False when demographics weren't built (no Census API key). */
  profilesAvailable: boolean;
  /** Number of county profiles. */
  countyProfiles: number;
  /** State or county results with no demographic profile to join to. */
  resultsWithoutProfile: string[];
  countyRowsWithoutFips: number;
  /** Expected findings with their reasons; not counted as problems. */
  explained: ExplainedFinding[];
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
  profiles: ElectionProfiles | undefined,
): ElectionCoverage {
  const states = national.filter((place) => place.level === 'state');
  const base = {
    year: election.year,
    office: election.office,
    states: states.length,
    districts: national.filter((place) => place.level === 'district').length,
    ...profileCoverage(states, counties?.byState, profiles),
  };
  if (counties === undefined) {
    return {
      ...base,
      countiesAvailable: false,
      counties: 0,
      resultsWithoutGeometry: [],
      geometryWithoutResults: [],
      stateSumMismatches: [],
      rowsInWrongState: [],
      countyRowsWithoutFips: 0,
      explained: [],
      skippedStates: {},
    };
  }

  const countyPlaces = [...counties.byState.values()].flat();
  const resultIds = new Set(countyPlaces.map((county) => county.geoId));
  const skippedStateCodes = Object.keys(counties.skips.skippedStates);

  const missingResults = [...GEOMETRY_COUNTY_IDS]
    .filter((id) => !resultIds.has(id) && !skippedStateCodes.some((code) => id.startsWith(code)))
    .sort();
  const sumMismatches = states
    .map((state) => compareCountySum(state, counties.byState.get(state.stateFips) ?? []))
    .filter((mismatch): mismatch is StateSumMismatch => mismatch !== undefined);

  const explainedMissing = missingResults.filter((id) => id in EXPLAINED_MISSING_RESULTS);
  const explainedSums = sumMismatches.filter((m) => m.stateFips in EXPLAINED_SUM_MISMATCHES);

  return {
    ...base,
    countiesAvailable: true,
    counties: countyPlaces.length,
    resultsWithoutGeometry: [...resultIds].filter((id) => !GEOMETRY_COUNTY_IDS.has(id)).sort(),
    geometryWithoutResults: missingResults.filter((id) => !(id in EXPLAINED_MISSING_RESULTS)),
    stateSumMismatches: sumMismatches.filter((m) => !(m.stateFips in EXPLAINED_SUM_MISMATCHES)),
    rowsInWrongState: counties.skips.wrongState,
    countyRowsWithoutFips: counties.skips.noFips,
    explained: [
      ...explainedMissing.map((id) => ({ id, reason: EXPLAINED_MISSING_RESULTS[id] ?? '' })),
      ...explainedSums.map((m) => ({
        id: `${m.name} county sum`,
        reason: EXPLAINED_SUM_MISMATCHES[m.stateFips] ?? '',
      })),
    ],
    skippedStates: counties.skips.skippedStates,
  };
}

/** Which results have no demographic profile (states always; counties when downloaded). */
function profileCoverage(
  states: readonly PlaceResult[],
  countiesByState: Map<string, PlaceResult[]> | undefined,
  profiles: ElectionProfiles | undefined,
): Pick<ElectionCoverage, 'profilesAvailable' | 'countyProfiles' | 'resultsWithoutProfile'> {
  if (profiles === undefined) {
    return { profilesAvailable: false, countyProfiles: 0, resultsWithoutProfile: [] };
  }
  const countyProfiles: GeoProfile[] = [...profiles.countiesByState.values()].flat();
  const profileIds = new Set([...profiles.states, ...countyProfiles].map((p) => p.geoId));
  const results = [...states, ...[...(countiesByState?.values() ?? [])].flat()];
  return {
    profilesAvailable: true,
    countyProfiles: countyProfiles.length,
    resultsWithoutProfile: results
      .map((result) => result.geoId)
      .filter((id) => !profileIds.has(id))
      .sort(),
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
  const within =
    Math.abs(demDiff) <= STATE_SUM_TOLERANCE && Math.abs(repDiff) <= STATE_SUM_TOLERANCE;
  return within ? undefined : { stateFips: state.stateFips, name: state.name, demDiff, repDiff };
}
