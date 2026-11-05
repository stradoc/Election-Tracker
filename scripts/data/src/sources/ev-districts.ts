/**
 * ev-districts.ts: Maine and Nebraska presidential results by congressional district.
 *
 * Pipeline position: stage 1 (sources). Unlike the MEDSL sources there is nothing to
 * download: the certified figures are curated in ev-districts.json, with a citation per
 * year. MEDSL's state file has no district rows, and these 5 districts decide up to 5
 * electoral votes, so they are entered by hand from the certified documents.
 */

import data from './ev-districts.json' with { type: 'json' };

/** One district's certified result. */
export interface DistrictRow {
  /** Postal code: "ME" or "NE". */
  readonly state: string;
  readonly district: number;
  readonly dem: number;
  readonly rep: number;
  readonly other: number;
}

/** All curated district rows for a year, plus the documents they came from. */
export interface DistrictYear {
  readonly sources: readonly string[];
  readonly notes: string;
  readonly districts: readonly DistrictRow[];
}

const YEARS: Readonly<Record<string, DistrictYear>> = data.years;

/**
 * Certified ME/NE district results for one presidential year.
 * @throws if the year hasn't been curated yet (add it to ev-districts.json).
 */
export function districtResultsFor(year: number): DistrictYear {
  const entry = YEARS[String(year)];
  if (entry === undefined) {
    throw new Error(`No ME/NE district results curated for ${year}. Add them to ev-districts.json.`);
  }
  return entry;
}
