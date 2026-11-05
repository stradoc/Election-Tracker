/**
 * swing.ts: uniform national swing.
 *
 * Pipeline position: shared math, called by the scenario engine (scenario.ts) whenever the
 * user moves the swing slider. Runs in the browser so the map responds instantly.
 *
 * Model: the same number of margin points is added to every place. A +2 swing moves a
 * state from R+1 to D+1 and a county from D+30 to D+32. It is the simplest "what if"
 * model and the one 270ToWin-style maps use. It ignores that some places swing more
 * than others; Phase 2's swing analysis shows how much they actually differed.
 */

import { marginOf } from './margins.ts';
import type { PlaceResult } from './schema.ts';

/** Solving dem + rep = S and dem − rep = D gives dem = (S + D) × HALF. */
const HALF = 0.5;

/**
 * Return a copy of `places` with every margin shifted by `swing`.
 *
 * Votes are moved between the two major parties only: total votes and third-party votes stay
 * the same, so tooltips and tables always show internally consistent numbers.
 *
 * @param places results to shift (not modified)
 * @param swing margin change as a fraction of all votes; +0.02 = 2 points toward Democrats
 */
export function applyUniformSwing(places: readonly PlaceResult[], swing: number): PlaceResult[] {
  if (swing === 0) return places.slice();
  return places.map((place) => {
    const twoParty = place.dem + place.rep;
    const newMargin = marginOf(place) + swing;
    // dem − rep must equal newMargin × total, and dem + rep stays fixed, which gives:
    const dem = clamp((twoParty + newMargin * place.total) * HALF, 0, twoParty);
    return { ...place, dem, rep: twoParty - dem };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
