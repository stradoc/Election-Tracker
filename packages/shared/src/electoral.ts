/**
 * electoral.ts: Electoral College arithmetic. Totals, the majority line, and the
 * tipping-point state the project is named after.
 *
 * Pipeline position: shared math, called by the scenario engine for the EV bar and the
 * tipping-point outline on the map, and by tests that check the data against known results.
 */

import { leaderOf, marginOf } from './margins.ts';
import type { PlaceResult } from './schema.ts';

/** Electoral votes won by each side. `tied` counts places with an exact tie. */
export interface ElectoralTotals {
  readonly dem: number;
  readonly rep: number;
  readonly tied: number;
  /** Total electoral votes in play (538 in every modern election). */
  readonly total: number;
  /** Votes needed to win: a majority of `total` (270 of 538). */
  readonly needed: number;
}

/** A majority is more than half: floor(total / MAJORITY_DIVISOR) + 1. */
const MAJORITY_DIVISOR = 2;

/** The two sides that can win electoral votes, in a fixed order. */
const SIDES = ['dem', 'rep'] as const;

/** Smallest number of votes that is a majority of `total` (270 for 538). */
export function majorityOf(total: number): number {
  return Math.floor(total / MAJORITY_DIVISOR) + 1;
}

/**
 * Sum electoral votes by leading party. Places without `electoralVotes` (counties) are
 * ignored, so a mixed list is safe to pass.
 */
export function electoralTotals(places: readonly PlaceResult[]): ElectoralTotals {
  const empty = { dem: 0, rep: 0, tied: 0, total: 0 };
  const sums = places.reduce((acc, place) => {
    const ev = place.electoralVotes;
    if (ev === undefined) return acc;
    const leader = leaderOf(place);
    const bucket = leader === 'tie' ? 'tied' : leader;
    return { ...acc, [bucket]: acc[bucket] + ev, total: acc.total + ev };
  }, empty);
  return { ...sums, needed: majorityOf(sums.total) };
}

/** The side that reached a majority, or undefined if nobody did (e.g. a 269–269 tie). */
export function winnerOf(totals: ElectoralTotals): 'dem' | 'rep' | undefined {
  return SIDES.find((side) => totals[side] >= totals.needed);
}

/**
 * Find the tipping-point place: the state (or ME/NE district) that gave the winner their
 * decisive electoral vote.
 *
 * Method: rank every place the winner carried from their best margin to their worst, then
 * add up electoral votes down that list. The place where the running total first reaches
 * the majority line is the tipping point. Its margin is how far the whole map could have
 * shifted before the result flipped.
 *
 * @returns the tipping-point place, or undefined if nobody reached a majority.
 */
export function tippingPoint(places: readonly PlaceResult[]): PlaceResult | undefined {
  const totals = electoralTotals(places);
  const winner = winnerOf(totals);
  if (winner === undefined) return undefined;

  // Margin from the winner's point of view: bigger = safer for the winner.
  const winnerMargin = (place: PlaceResult): number =>
    winner === 'dem' ? marginOf(place) : -marginOf(place);

  const carried = places
    .filter((place) => place.electoralVotes !== undefined && leaderOf(place) === winner)
    .sort((a, b) => winnerMargin(b) - winnerMargin(a));

  // Running EV total down the ranked list: runningTotals[i] = EVs of carried[0..i].
  const runningTotals = carried.reduce<number[]>(
    (acc, place) => [...acc, (acc.at(-1) ?? 0) + (place.electoralVotes ?? 0)],
    [],
  );
  const decisiveIndex = runningTotals.findIndex((sum) => sum >= totals.needed);
  return carried[decisiveIndex];
}
