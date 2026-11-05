/**
 * marginBins.ts: which colour step a margin falls into.
 *
 * Web position: the only place margins become colours. The map, the district tiles and
 * the legend all call marginBin() and set `data-bin`; bins.css and tokens.css turn that
 * into the actual colour for the current theme.
 */

import bins from './margin-bins.json' with { type: 'json' };

/**
 * A colour step: toss-up (under 1 point), or a party plus a strength from 1 (narrow) to
 * 5 (wide). Strengths follow margin-bins.json: 1–2, 2–5, 5–10, 10–20, 20+ points.
 */
export type MarginBin =
  'tossup' | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5';

const THRESHOLDS: readonly number[] = bins.thresholds;

/**
 * Map a margin (fraction of all votes, positive = Democratic) to its colour step.
 * Examples: 0.014 → "d1" (D+1.4, the 1–2 step); −0.032 → "r2" (R+3.2, the 2–5 step).
 */
export function marginBin(margin: number): MarginBin {
  const strength = THRESHOLDS.filter((threshold) => Math.abs(margin) >= threshold).length;
  if (strength === 0) return 'tossup';
  return `${margin > 0 ? 'd' : 'r'}${strength}` as MarginBin;
}

/** One legend entry: a bin, which side leads, and the margin range it covers, in points. */
export interface LegendStep {
  readonly bin: MarginBin;
  readonly side: 'dem' | 'rep' | 'tossup';
  /** Range only, e.g. "5–10"; the legend's end labels say which party. */
  readonly label: string;
}

/** Legend steps from widest Republican margin, through toss-up, to widest Democratic margin. */
export function legendSteps(): LegendStep[] {
  const [tossupLabel = 'Under 1', ...partyLabels] = bins.labels;
  const strengths = partyLabels.map((label, i) => ({ strength: i + 1, label }));
  const rep = strengths
    .map(({ strength, label }): LegendStep => ({
      bin: `r${strength}` as MarginBin,
      side: 'rep',
      label,
    }))
    .reverse();
  const dem = strengths.map(({ strength, label }): LegendStep => ({
    bin: `d${strength}` as MarginBin,
    side: 'dem',
    label,
  }));
  return [...rep, { bin: 'tossup', side: 'tossup', label: tossupLabel }, ...dem];
}
