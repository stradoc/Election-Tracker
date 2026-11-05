/**
 * marginBins.ts: which colour step a margin falls into.
 *
 * Web position: the only place margins become colours. The map, the district tiles and
 * the legend all call marginBin() and set `data-bin`; bins.css and tokens.css turn that
 * into the actual colour for the current theme.
 *
 * Every place is coloured for whoever leads it, however narrowly, so a map never shows a
 * winner as "no colour". The neutral `tie` colour is only for an exact tie.
 */

import bins from './margin-bins.json' with { type: 'json' };

/**
 * A colour step: a party plus a strength from 1 (narrowest) to 6 (widest), following
 * margin-bins.json (0–1, 1–2, 2–5, 5–10, 10–20, 20+ points), or "tie" for an exact tie.
 */
export type MarginBin =
  'tie' | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6';

/** Step boundaries: a lead of at least THRESHOLDS[i] gets strength i + 2. */
const THRESHOLDS: readonly number[] = bins.thresholds;

/** The narrowest lead's strength; each threshold passed adds one. */
const NARROWEST_STRENGTH = 1;

/**
 * Map a margin (fraction of all votes, positive = Democratic) to its colour step.
 * Examples: 0.0086 → "d1" (D+0.9, the 0–1 step); −0.014 → "r2" (R+1.4, the 1–2 step).
 */
export function marginBin(margin: number): MarginBin {
  if (margin === 0) return 'tie';
  const passed = THRESHOLDS.filter((threshold) => Math.abs(margin) >= threshold).length;
  return `${margin > 0 ? 'd' : 'r'}${NARROWEST_STRENGTH + passed}` as MarginBin;
}

/** One legend entry: a bin, which side leads, and the margin range it covers, in points. */
export interface LegendStep {
  readonly bin: MarginBin;
  readonly side: 'dem' | 'rep';
  /** Range only, e.g. "5–10"; the legend's end labels say which party. */
  readonly label: string;
}

/** Legend steps from widest Republican margin to widest Democratic margin. */
export function legendSteps(): LegendStep[] {
  const steps = bins.labels.map((label, i) => ({ strength: NARROWEST_STRENGTH + i, label }));
  const rep = steps
    .map(({ strength, label }): LegendStep => ({
      bin: `r${strength}` as MarginBin,
      side: 'rep',
      label,
    }))
    .reverse();
  const dem = steps.map(({ strength, label }): LegendStep => ({
    bin: `d${strength}` as MarginBin,
    side: 'dem',
    label,
  }));
  return [...rep, ...dem];
}
