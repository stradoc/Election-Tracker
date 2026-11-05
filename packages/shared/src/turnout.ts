/**
 * turnout.ts: turnout as a share of the people who could vote.
 *
 * Pipeline position: shared math joining results (votes cast) with ACS profiles (citizens
 * 18+), so the hover card, tables and the Phase 2 turnout module all compute it the same
 * way. Places evidence: it measures a place, not any group within it.
 */

import type { GeoProfile, PlaceResult } from './schema.ts';

/**
 * Votes cast for the office divided by the citizen voting-age population (CVAP).
 * It slightly understates true turnout, because blank or spoiled presidential ballots
 * aren't counted, and CVAP is a survey estimate, so small counties can come out a little
 * off (even above 100%).
 * @returns a fraction (0.64 = 64%), or undefined when CVAP is zero or unknown
 */
export function turnoutRate(
  result: Pick<PlaceResult, 'total'>,
  profile: Pick<GeoProfile, 'cvap'> | undefined,
): number | undefined {
  if (profile === undefined || profile.cvap <= 0) return undefined;
  return result.total / profile.cvap;
}
