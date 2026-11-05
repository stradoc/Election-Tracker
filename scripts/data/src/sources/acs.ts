/**
 * acs.ts: download American Community Survey 5-year estimates from the Census Data API.
 *
 * Pipeline position: stage 1 (sources). Fetches one table per survey year and geography
 * (all states, or all counties) and stores the API's raw response in
 * data/raw/census-acs5/<year>-<geography>.json. Nothing is interpreted here;
 * normalize/acs.ts turns rows into GeoProfile. Saved files are reused, so later runs work
 * offline and don't use the API quota.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ElectionEntry } from '@tippingpoint/shared';
import { rawDirFor } from '../paths.ts';
import config from './acs.json' with { type: 'json' };
import { OwnerActionRequired } from './dataverse.ts';

const SOURCE_ID = 'census-acs5';
const API_BASE = 'https://api.census.gov/data';

/** Geographies the pipeline fetches. */
export type AcsGeography = 'state' | 'county';
const GEOGRAPHIES: readonly AcsGeography[] = ['state', 'county'];

/** The API's answer: a header row of column names, then one row of strings per place. */
export interface AcsTable {
  readonly vintage: number;
  readonly geography: AcsGeography;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Measure name → the ACS variables summed to make it (see acs.json). */
export const ACS_MEASURES: Readonly<Record<string, readonly string[]>> = config.measures;

/** A state whose county figures come from a different survey year (Connecticut). */
export interface VintageOverride {
  readonly fromVintage: number;
  readonly useVintage: number;
  readonly why: string;
}

/** Overrides by state FIPS (see acs.json). */
export const VINTAGE_OVERRIDES: Readonly<Record<string, VintageOverride>> =
  config.vintageOverrides;

/** Every ACS variable to request, without duplicates. */
function variables(): string[] {
  return [...new Set(Object.values(ACS_MEASURES).flat())];
}

/** Survey years needed for these elections, including any override years. */
export function requiredVintages(elections: readonly ElectionEntry[]): number[] {
  const base = elections.map((e) => e.acsVintage);
  const overrides = Object.values(VINTAGE_OVERRIDES)
    .filter((o) => base.some((vintage) => vintage >= o.fromVintage))
    .map((o) => o.useVintage);
  return [...new Set([...base, ...overrides])].sort();
}

/**
 * Get one ACS table, from data/raw if saved earlier, otherwise from the API.
 * @throws OwnerActionRequired if no API key is configured and the table isn't saved yet
 */
export async function fetchAcsTable(vintage: number, geography: AcsGeography): Promise<AcsTable> {
  const file = path.join(rawDirFor(SOURCE_ID), `${vintage}-${geography}.json`);
  if (!existsSync(file)) await downloadTable(vintage, geography, file);
  const [header = [], ...rows] = JSON.parse(await readFile(file, 'utf8')) as string[][];
  return { vintage, geography, header, rows };
}

/** Fetch every table these elections need, keyed "<vintage>-<geography>". */
export async function fetchAcsTables(
  elections: readonly ElectionEntry[],
): Promise<Map<string, AcsTable>> {
  const requests = requiredVintages(elections).flatMap((vintage) =>
    GEOGRAPHIES.map((geography) => ({ vintage, geography })),
  );
  const tables = await Promise.all(
    requests.map(({ vintage, geography }) => fetchAcsTable(vintage, geography)),
  );
  return new Map(tables.map((table) => [tableKey(table.vintage, table.geography), table]));
}

/** Key used in the map returned by fetchAcsTables. */
export function tableKey(vintage: number, geography: AcsGeography): string {
  return `${vintage}-${geography}`;
}

/** Call the Census API and save its raw JSON response. */
async function downloadTable(vintage: number, geography: AcsGeography, file: string): Promise<void> {
  const key = process.env.CENSUS_API_KEY;
  if (key === undefined || key === '') {
    throw new OwnerActionRequired(
      [
        `${SOURCE_ID}: no Census API key. Get a free key at https://api.census.gov/data/key_signup.html,`,
        '  then copy scripts/data/.env.example to scripts/data/.env and set CENSUS_API_KEY.',
      ].join('\n'),
    );
  }
  // The key is appended last and kept out of error messages, so it never lands in logs.
  const query = `get=NAME,${variables().join(',')}&for=${geography}:*`;
  const publicUrl = `${API_BASE}/${vintage}/acs/acs5?${query}`;
  const response = await fetch(`${publicUrl}&key=${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw new Error(`${SOURCE_ID}: ${response.status} from ${publicUrl}: ${await response.text()}`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await response.text());
}
