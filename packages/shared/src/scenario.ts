/**
 * scenario.ts: the single "what if" engine.
 *
 * Pipeline position: the last step before display. The web app always draws the map, the
 * EV bar and the tables from computeScenario(); it never applies swing or other what-ifs on
 * its own. Each new kind of what-if (Phase 2: "if only group X voted") becomes a new field
 * on Scenario, handled here, so every view picks it up at once.
 */

import { electoralTotals, tippingPoint, type ElectoralTotals } from './electoral.ts';
import type { PlaceResult } from './schema.ts';
import { applyUniformSwing } from './swing.ts';

/** User-controlled adjustments to the real results. */
export interface Scenario {
  /** Uniform margin shift as a fraction of all votes; +0.02 = 2 points toward Democrats. */
  swing: number;
}

/** The real results: no adjustments. */
export const ACTUAL_RESULTS: Scenario = { swing: 0 };

/** What the views render. */
export interface ScenarioResult {
  /** Adjusted results, same order as the input. */
  places: PlaceResult[];
  /** Electoral-vote totals (all zeros for county-level input). */
  electoral: ElectoralTotals;
  /** geoId of the tipping-point place, if anyone reached a majority. */
  tippingPointId?: string;
}

/** Whether a scenario changes anything; the UI uses this to show "Actual result" labels. */
export function isActual(scenario: Scenario): boolean {
  return scenario.swing === 0;
}

/**
 * Apply a scenario to a set of results and recompute everything derived from them.
 * @param places real results for one level (national states or one state's counties)
 * @param scenario the user's adjustments
 */
export function computeScenario(
  places: readonly PlaceResult[],
  scenario: Scenario,
): ScenarioResult {
  const adjusted = applyUniformSwing(places, scenario.swing);
  const electoral = electoralTotals(adjusted);
  const tipping = electoral.total > 0 ? tippingPoint(adjusted) : undefined;
  return { places: adjusted, electoral, tippingPointId: tipping?.geoId };
}
