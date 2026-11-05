/**
 * president.ts: turn raw MEDSL presidential files (plus curated ME/NE districts) into the
 * shared PlaceResult shape.
 *
 * Pipeline position: stage 2 (normalize). Input: CSV text from data/raw. Output: plain
 * arrays of PlaceResult, with no file writing (emit.ts does that).
 *
 * MEDSL quirks handled here (each one is a data fact, not a display choice):
 * - Candidates can appear on several party lines (New York fusion voting), so votes are
 *   assigned by matching the nominee's surname, not by the party column.
 * - Some counties report by vote mode (election day / absentee / ...). If a county has a
 *   TOTAL row, only TOTAL rows are used; otherwise all modes are summed.
 * - A few county codes differ from the map's codes; see county-fips-fixes.json.
 */

import { parse } from 'csv-parse/sync';
import {
  atLargeElectoralVotes,
  NO_COUNTY_LAYER,
  stateByFips,
  stateByPostal,
  type ElectionEntry,
  type Nominees,
  type PlaceResult,
} from '@tippingpoint/shared';
import { districtResultsFor } from '../sources/ev-districts.ts';
import fixes from './county-fips-fixes.json' with { type: 'json' };

/** The MEDSL office label for presidential rows (both files use it). */
const PRESIDENT_OFFICE = 'US PRESIDENT';

/** MEDSL's vote-mode label for a county's all-modes total. */
const TOTAL_MODE = 'TOTAL';

/** County FIPS codes are five digits, zero-padded ("01001"). */
const COUNTY_FIPS_DIGITS = 5;

/** The first two digits of a county code are its state's code ("42003" → "42"). */
const STATE_FIPS_DIGITS = 2;

/** Each ME/NE district awards exactly one electoral vote. */
const DISTRICT_ELECTORAL_VOTES = 1;

const COUNTY_REMAP: Readonly<Record<string, { to: string; why: string }>> = fixes.remap;

/** Columns used from MEDSL's "1976-2024-president.csv". */
export interface MedslStateRow {
  year: string;
  office: string;
  state_po: string;
  candidate: string;
  candidatevotes: string;
}

/** Columns used from MEDSL's "countypres_2000-2024.csv". */
export interface MedslCountyRow {
  year: string;
  office: string;
  state_po: string;
  county_name: string;
  county_fips: string;
  candidate: string;
  candidatevotes: string;
  mode: string;
}

/** Vote totals for one place before it gets an id and a name. */
interface Tally {
  dem: number;
  rep: number;
  other: number;
  total: number;
}

/** Rows the county normalizer could not place, by reason, for the coverage report. */
export interface CountySkips {
  /** Rows with no usable county code (e.g. statewide overseas ballots). */
  noFips: number;
  /** States whose county rows are dropped on purpose (shared NO_COUNTY_LAYER), with reasons. */
  skippedStates: Record<string, string>;
}

/** Parse a CSV file with a header row into objects keyed by column name. */
export function parseCsv<Row>(text: string): Row[] {
  return parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
}

/**
 * Any run of characters that are not A–Z: the separators between words in a name.
 * Matches ", " in "TRUMP, DONALD J." and "." at its end; does not match "TRUMP".
 * Tester: https://regex101.com/?regex=%5B%5EA-Z%5D%2B&testString=TRUMP%2C%20DONALD%20J.
 */
const NON_LETTERS = /[^A-Z]+/;

/**
 * Split a name into upper-case words, ignoring punctuation:
 * "TRUMP, DONALD J." → ["TRUMP", "DONALD", "J"]; "JOSEPH R BIDEN JR" → [..., "BIDEN", "JR"].
 */
function nameWords(name: string): string[] {
  return name
    .toUpperCase()
    .split(NON_LETTERS)
    .filter((word) => word.length > 0);
}

/** A nominee's surname in MEDSL's upper-case style ("Kamala Harris" → "HARRIS"). */
function surname(fullName: string): string {
  return nameWords(fullName).at(-1) ?? '';
}

/**
 * Which major-party nominee a MEDSL candidate string refers to, if any.
 * Matching on surname works for both MEDSL formats ("TRUMP, DONALD J." and "DONALD J TRUMP").
 */
export function sideOf(candidate: string, nominees: Nominees): 'dem' | 'rep' | 'other' {
  const words = nameWords(candidate);
  if (words.includes(surname(nominees.dem))) return 'dem';
  if (words.includes(surname(nominees.rep))) return 'rep';
  return 'other';
}

/** Add up candidate rows into Dem / Rep / everyone else. */
function tally(rows: readonly { candidate: string; candidatevotes: string }[], nominees: Nominees): Tally {
  return rows.reduce<Tally>(
    (acc, row) => {
      const votes = Number(row.candidatevotes);
      if (!Number.isFinite(votes)) return acc;
      const side = sideOf(row.candidate, nominees);
      return { ...acc, [side]: acc[side] + votes, total: acc.total + votes };
    },
    { dem: 0, rep: 0, other: 0, total: 0 },
  );
}

/** Rows for one election's year and the presidential office. */
function rowsForElection<Row extends { year: string; office: string }>(
  rows: readonly Row[],
  election: ElectionEntry,
): Row[] {
  return rows.filter((row) => Number(row.year) === election.year && row.office === PRESIDENT_OFFICE);
}

/**
 * Statewide results (51 places, DC included) with at-large electoral votes attached.
 * @throws if a state is missing, or a nominee got no votes (likely a name mismatch).
 */
export function normalizeStates(rows: readonly MedslStateRow[], election: ElectionEntry): PlaceResult[] {
  const byState = Map.groupBy(rowsForElection(rows, election), (row) => row.state_po);
  return [...byState.entries()].map(([postal, stateRows]) => {
    const info = stateByPostal(postal);
    if (info === undefined) throw new Error(`MEDSL state file: unknown state "${postal}"`);
    const votes = tally(stateRows, election.candidates);
    if (votes.dem === 0 || votes.rep === 0) {
      const names = [...new Set(stateRows.map((r) => r.candidate))].join('; ');
      throw new Error(`${election.year} ${postal}: a nominee got 0 votes. Candidates: ${names}`);
    }
    return {
      geoId: info.fips,
      level: 'state',
      name: info.name,
      stateFips: info.fips,
      ...votes,
      electoralVotes: atLargeElectoralVotes(election.year, postal),
    };
  });
}

/** ME/NE congressional-district results, one electoral vote each. */
export function normalizeDistricts(election: ElectionEntry): PlaceResult[] {
  return districtResultsFor(election.year).districts.map((row) => {
    const info = stateByPostal(row.state);
    if (info === undefined) throw new Error(`ev-districts.json: unknown state "${row.state}"`);
    return {
      geoId: `${info.fips}-${row.district}`,
      level: 'district',
      name: `${info.name} ${ordinal(row.district)} District`,
      stateFips: info.fips,
      dem: row.dem,
      rep: row.rep,
      other: row.other,
      total: row.dem + row.rep + row.other,
      electoralVotes: DISTRICT_ELECTORAL_VOTES,
    };
  });
}

/**
 * County results grouped by state FIPS, plus a count of rows that couldn't be placed.
 * States in NO_COUNTY_LAYER (Alaska) are skipped on purpose: no county-level results exist.
 */
export function normalizeCounties(
  rows: readonly MedslCountyRow[],
  election: ElectionEntry,
): { byState: Map<string, PlaceResult[]>; skips: CountySkips } {
  const electionRows = rowsForElection(rows, election);
  const withFips = electionRows
    .map((row) => ({ row, fips: countyFips(row.county_fips) }))
    .filter((entry): entry is { row: MedslCountyRow; fips: string } => entry.fips !== undefined);
  const placeable = withFips.filter(({ fips }) => NO_COUNTY_LAYER[fips.slice(0, STATE_FIPS_DIGITS)] === undefined);

  const byCounty = Map.groupBy(placeable, ({ fips }) => fips);
  const counties = [...byCounty.entries()].map(([fips, entries]) =>
    countyPlace(fips, entries.map((e) => e.row), election.candidates),
  );

  return {
    byState: Map.groupBy(counties, (county) => county.stateFips),
    skips: {
      noFips: electionRows.length - withFips.length,
      skippedStates: { ...NO_COUNTY_LAYER },
    },
  };
}

/** Build one county's PlaceResult, using TOTAL rows when the county reports them. */
function countyPlace(fips: string, rows: readonly MedslCountyRow[], nominees: Nominees): PlaceResult {
  const hasTotalRows = rows.some((row) => row.mode === TOTAL_MODE);
  const counted = hasTotalRows ? rows.filter((row) => row.mode === TOTAL_MODE) : rows;
  const stateFips = fips.slice(0, STATE_FIPS_DIGITS);
  if (stateByFips(stateFips) === undefined) throw new Error(`Unknown state in county code ${fips}`);
  return {
    geoId: fips,
    level: 'county',
    name: titleCase(rows[0]?.county_name ?? fips),
    stateFips,
    ...tally(counted, nominees),
  };
}

/**
 * Turn MEDSL's county code into the map's 5-digit FIPS, applying documented remaps.
 * Returns undefined for rows with no county (MEDSL writes "NA" for statewide ballots).
 */
function countyFips(raw: string): string | undefined {
  const numeric = Number(raw);
  if (raw === '' || !Number.isInteger(numeric)) return undefined;
  const padded = String(numeric).padStart(COUNTY_FIPS_DIGITS, '0');
  return COUNTY_REMAP[padded]?.to ?? padded;
}

/** "ST. LOUIS CITY" → "St. Louis City". */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** English ordinal suffixes, indexed by number (only 1–3 occur: ME has 2 districts, NE 3). */
const ORDINAL_SUFFIXES: readonly string[] = ['th', 'st', 'nd', 'rd'];

/** 1 → "1st", 2 → "2nd", 3 → "3rd". */
function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIXES[n] ?? 'th'}`;
}
