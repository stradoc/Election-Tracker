/**
 * acs.ts: turn Census API rows into GeoProfile (shared schema), matched to an election.
 *
 * Pipeline position: stage 2 (normalize). Input: raw ACS tables from sources/acs.ts.
 * Output: state profiles plus county profiles grouped by state, using the same FIPS ids as
 * the results so join.ts can line them up.
 *
 * Rules applied here (each is a data fact, documented in sources/acs.json):
 * - each measure is the sum of its ACS variables; shares are divided by the right base
 *   (race by total population, education by adults 25+);
 * - negative values are the Census Bureau's "not available" codes, so medians become null;
 * - states with a vintage override (Connecticut) take county figures from another survey;
 * - counties are skipped for states with no county map (shared NO_COUNTY_LAYER, Alaska),
 *   and anything outside the 50 states + D.C. (e.g. Puerto Rico) is dropped.
 */

import {
  NO_COUNTY_LAYER,
  stateByFips,
  type ElectionEntry,
  type GeoProfile,
} from '@tippingpoint/shared';
import { ACS_MEASURES, VINTAGE_OVERRIDES, tableKey, type AcsTable } from '../sources/acs.ts';

/** A 5-year survey ending in year Y covers Y−4 through Y. */
const SURVEY_SPAN_YEARS = 4;

/** Profiles for one election, ready for join and emit. */
export interface ElectionProfiles {
  readonly states: GeoProfile[];
  readonly countiesByState: Map<string, GeoProfile[]>;
  /** Every survey period used, e.g. ["2020–2024", "2017–2021"]. */
  readonly periods: string[];
}

/** "2020–2024" for the survey ending in 2024. */
export function surveyPeriod(vintage: number): string {
  return `${vintage - SURVEY_SPAN_YEARS}–${vintage}`;
}

/** Read one measure from a row: the sum of its variables, or NaN if any is unavailable. */
function measure(table: AcsTable, row: readonly string[], name: string): number {
  const variables = ACS_MEASURES[name] ?? [];
  return variables.reduce((sum, variable) => {
    const value = Number(row[table.header.indexOf(variable)]);
    return value < 0 || !Number.isFinite(value) ? Number.NaN : sum + value;
  }, 0);
}

/** Share of a base, or 0 when the base is empty or unknown. */
function share(part: number, base: number): number {
  return Number.isFinite(part) && base > 0 ? part / base : 0;
}

/** A median that may be unavailable (Census "not available" codes become null). */
function median(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/** "Allegheny County, Pennsylvania" → "Allegheny County"; state names pass through. */
function placeName(fullName: string): string {
  return fullName.split(', ')[0] ?? fullName;
}

/** Turn every row of one table into profiles (states or counties). */
export function profilesFromTable(table: AcsTable): GeoProfile[] {
  const column = (name: string): number => table.header.indexOf(name);
  return table.rows
    .map((row): GeoProfile | undefined => {
      const stateFips = row[column('state')] ?? '';
      if (stateByFips(stateFips)?.fips !== stateFips) return undefined; // e.g. Puerto Rico
      const countyPart = table.geography === 'county' ? (row[column('county')] ?? '') : '';
      const population = measure(table, row, 'population');
      const raceTotal = measure(table, row, 'raceTotal');
      return {
        geoId: `${stateFips}${countyPart}`,
        level: table.geography,
        name: placeName(row[column('NAME')] ?? ''),
        stateFips,
        period: surveyPeriod(table.vintage),
        population: Number.isFinite(population) ? population : 0,
        cvap: Math.max(0, measure(table, row, 'cvap') || 0),
        whiteNonHispanic: share(measure(table, row, 'whiteNonHispanic'), raceTotal),
        blackNonHispanic: share(measure(table, row, 'blackNonHispanic'), raceTotal),
        hispanic: share(measure(table, row, 'hispanic'), raceTotal),
        asianNonHispanic: share(measure(table, row, 'asianNonHispanic'), raceTotal),
        bachelorsOrHigher: share(
          measure(table, row, 'bachelorsOrHigher'),
          measure(table, row, 'adults25Plus'),
        ),
        medianHouseholdIncome: median(measure(table, row, 'medianHouseholdIncome')),
        medianAge: median(measure(table, row, 'medianAge')),
      };
    })
    .filter((profile): profile is GeoProfile => profile !== undefined);
}

/** The survey year to use for one state's counties in an election (override or default). */
function countyVintageFor(stateFips: string, vintage: number): number {
  const override = VINTAGE_OVERRIDES[stateFips];
  return override !== undefined && vintage >= override.fromVintage ? override.useVintage : vintage;
}

/**
 * Profiles matched to one election.
 * @param tables every fetched table, keyed by tableKey(vintage, geography)
 * @throws if a needed table wasn't fetched
 */
export function profilesForElection(
  election: ElectionEntry,
  tables: ReadonlyMap<string, AcsTable>,
): ElectionProfiles {
  const table = (vintage: number, geography: 'state' | 'county'): AcsTable => {
    const found = tables.get(tableKey(vintage, geography));
    if (found === undefined) throw new Error(`ACS table ${tableKey(vintage, geography)} not fetched`);
    return found;
  };
  const vintage = election.acsVintage;
  const states = profilesFromTable(table(vintage, 'state'));

  // Each state's counties come from its own survey year (Connecticut may differ).
  const countyVintages = [...new Set(states.map((s) => countyVintageFor(s.stateFips, vintage)))];
  const countiesByVintage = new Map(
    countyVintages.map((v) => [v, Map.groupBy(profilesFromTable(table(v, 'county')), (c) => c.stateFips)]),
  );
  const countiesByState = new Map(
    states
      .filter((state) => NO_COUNTY_LAYER[state.stateFips] === undefined)
      .map((state): [string, GeoProfile[]] => [
        state.stateFips,
        countiesByVintage.get(countyVintageFor(state.stateFips, vintage))?.get(state.stateFips) ?? [],
      ]),
  );

  return { states, countiesByState, periods: countyVintages.map(surveyPeriod) };
}
