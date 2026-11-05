/**
 * format.ts: display helpers that need nominee names (so they can't live in shared).
 *
 * Web position: used by the hover card, tables and the tipping-point note, so a lead
 * always reads the same way everywhere ("Trump +1.7").
 */

import {
  formatShare,
  leaderOf,
  marginOf,
  type Nominees,
  type PlaceResult,
} from '@tippingpoint/shared';

/** Margins are fractions; multiply by this for percentage points. */
const PERCENT = 100;

const voteFormat = new Intl.NumberFormat('en-US');

/** 3543308 → "3,543,308". Swing can produce fractional votes, so round for display. */
export function formatVotes(votes: number): string {
  return voteFormat.format(Math.round(votes));
}

/** "Kamala Harris" → "Harris". */
export function surname(fullName: string): string {
  return fullName.split(' ').at(-1) ?? fullName;
}

/** Margin in points with one decimal and no sign: 0.0172 → "1.7". */
export function marginPoints(margin: number): string {
  return Math.abs(margin * PERCENT).toFixed(1);
}

/** Who leads and by how much, using the nominee's surname: "Trump +1.7", or "Even". */
export function leadLabel(place: PlaceResult, nominees: Nominees): string {
  const leader = leaderOf(place);
  if (leader === 'tie') return 'Even';
  return `${surname(nominees[leader])} +${marginPoints(marginOf(place))}`;
}

/** A party's share of all votes in a place, formatted ("48.7%"). */
export function shareOf(place: PlaceResult, side: 'dem' | 'rep'): string {
  return place.total > 0 ? formatShare(place[side] / place.total) : '–';
}
