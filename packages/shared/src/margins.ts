/**
 * margins.ts: how TippingPoint measures and labels a lead.
 *
 * Pipeline position: shared math used by swing, the map colour scale, tooltips and tables,
 * so every part of the app agrees on what "D+3.2" means.
 *
 * Convention: margin = (dem − rep) / total votes, as a fraction.
 *   +0.032 → Democrats lead by 3.2 points ("D+3.2")
 *   −0.017 → Republicans lead by 1.7 points ("R+1.7")
 * It uses the share of *all* votes (not two-party votes), matching how news outlets report
 * results.
 */

import type { PlaceResult } from './schema.ts';

/** Margins and shares are stored as fractions; multiply by this to show percentage points. */
const PERCENT = 100;

/** Who leads a place. "tie" covers an exact tie and places with no votes. */
export type Leader = 'dem' | 'rep' | 'tie';

/** Margin of a place as a fraction of all votes cast. Positive = Democratic lead. */
export function marginOf(place: Pick<PlaceResult, 'dem' | 'rep' | 'total'>): number {
  if (place.total <= 0) return 0;
  return (place.dem - place.rep) / place.total;
}

/** Which party leads a place. */
export function leaderOf(place: Pick<PlaceResult, 'dem' | 'rep'>): Leader {
  if (place.dem > place.rep) return 'dem';
  if (place.rep > place.dem) return 'rep';
  return 'tie';
}

/**
 * Format a margin for display, e.g. 0.0321 → "D+3.2", −0.0172 → "R+1.7", 0 → "Even".
 * @param digits decimal places to show (default 1)
 */
export function formatMargin(margin: number, digits = 1): string {
  const points = Math.abs(margin * PERCENT);
  // Round before testing for zero, so that e.g. 0.0004 shows as "Even", not "D+0.0".
  if (Number(points.toFixed(digits)) === 0) return 'Even';
  return `${margin > 0 ? 'D' : 'R'}+${points.toFixed(digits)}`;
}

/** Format a vote share (0.4823 → "48.2%"). */
export function formatShare(share: number, digits = 1): string {
  return `${(share * PERCENT).toFixed(digits)}%`;
}
