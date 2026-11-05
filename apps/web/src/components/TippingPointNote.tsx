/**
 * TippingPointNote.tsx: one sentence naming the state that decided the election.
 *
 * Web position: the project's signature line, next to the map's outlined state. It updates
 * live with the swing slider, so readers can watch the deciding state move.
 */

import {
  marginOf,
  type ElectoralTotals,
  type Nominees,
  type PlaceResult,
} from '@tippingpoint/shared';
import { marginPoints, surname } from '../format.ts';
import styles from './TippingPointNote.module.css';

interface TippingPointNoteProps {
  readonly place?: PlaceResult;
  readonly totals: ElectoralTotals;
  readonly nominees: Nominees;
  /** True when no what-if is applied, so the sentence talks about what happened. */
  readonly isActual: boolean;
}

/** "Wisconsin decided it: it gave Trump his 270th electoral vote, by 0.8 points." */
export function TippingPointNote({ place, totals, nominees, isActual }: TippingPointNoteProps) {
  if (place === undefined) {
    return (
      <p className={styles.note}>
        Nobody reaches {totals.needed}. The House of Representatives would choose the president.
      </p>
    );
  }
  const winner = marginOf(place) > 0 ? nominees.dem : nominees.rep;
  const margin = marginPoints(marginOf(place));
  return (
    <p className={styles.note}>
      <strong className={styles.state}>{place.name}</strong>
      {isActual ? ' decided it. ' : ' would decide it. '}
      It {isActual ? 'gave' : 'would give'} {surname(winner)} the {totals.needed}th electoral vote,
      by <span className="tabular">{margin}</span> points.
    </p>
  );
}
