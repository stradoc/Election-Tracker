/**
 * ev-tables.ts: electoral votes per state, by census apportionment.
 *
 * Pipeline position: the normalize stage uses this to attach `electoralVotes` to each state
 * and ME/NE district result. The web app never hard-codes EV counts.
 *
 * The numbers live in ../data/apportionment.json (reference data, kept out of code).
 * Each census reapportions House seats, and a state's electoral votes = House seats + 2.
 * - 2010 census: used for the 2012, 2016 and 2020 elections.
 * - 2020 census: used for the 2024 and 2028 elections.
 */

import apportionmentData from '../data/apportionment.json' with { type: 'json' };

/** One census apportionment and the presidential elections it applies to (inclusive). */
interface Apportionment {
  readonly census: number;
  readonly firstElection: number;
  readonly lastElection: number;
  /** Postal code → electoral votes, districts included. */
  readonly votes: Readonly<Record<string, number>>;
}

const APPORTIONMENTS: readonly Apportionment[] = apportionmentData.apportionments;

/** Electoral votes the statewide winner gets in a district-split state (ME, NE). */
const AT_LARGE_VOTES: number = apportionmentData.atLargeVotes;

/**
 * States that award one electoral vote per congressional district, plus two at-large votes
 * to the statewide winner. Postal code → number of districts.
 */
export const DISTRICT_SPLIT_STATES: Readonly<Record<string, number>> =
  apportionmentData.districtSplitStates;

/**
 * Electoral votes per state (postal code → total EVs, districts included) for a
 * presidential election year.
 * @throws if the year falls outside the recorded apportionments.
 */
export function electoralVotesFor(year: number): Readonly<Record<string, number>> {
  const match = APPORTIONMENTS.find((a) => year >= a.firstElection && year <= a.lastElection);
  if (match === undefined) {
    throw new Error(
      `No electoral-vote apportionment recorded for ${year}. Add it to data/apportionment.json.`,
    );
  }
  return match.votes;
}

/**
 * Electoral votes the statewide winner receives: the full total, or only the two
 * at-large votes in ME and NE, where districts award the rest.
 */
export function atLargeElectoralVotes(year: number, postal: string): number {
  const total = electoralVotesFor(year)[postal];
  if (total === undefined) throw new Error(`Unknown state postal code: ${postal}`);
  return DISTRICT_SPLIT_STATES[postal] === undefined ? total : AT_LARGE_VOTES;
}
