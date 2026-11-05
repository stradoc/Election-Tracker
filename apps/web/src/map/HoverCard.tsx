/**
 * HoverCard.tsx: the floating card that shows one place's result under the pointer.
 *
 * Web position: rendered by UsMap for whichever state or county is hovered or focused.
 * Shows both nominees' votes and shares, the lead, and electoral votes where they apply.
 */

import type { Nominees, PlaceResult } from '@tippingpoint/shared';
import { formatVotes, leadLabel, shareOf, surname } from '../format.ts';
import styles from './HoverCard.module.css';

/** Where to draw the card, in pixels from the map frame's top-left corner. */
export interface CardPosition {
  readonly x: number;
  readonly y: number;
  /** Frame width, so the card can flip to the pointer's left near the right edge. */
  readonly frameWidth: number;
}

/** Gap between the pointer and the card. */
const POINTER_OFFSET = 16;
/** Card width in pixels; must match .card max width in HoverCard.module.css. */
const CARD_WIDTH = 260;

interface HoverCardProps {
  readonly place: PlaceResult;
  readonly nominees: Nominees;
  /** Undefined for keyboard focus: the card then sits in the frame's top-left corner. */
  readonly position?: CardPosition;
  /** Extra line under the numbers, e.g. "Select to see counties". */
  readonly hint?: string;
}

/** One place's result, floating next to the pointer. */
export function HoverCard({ place, nominees, position, hint }: HoverCardProps) {
  const flip =
    position !== undefined && position.x + POINTER_OFFSET + CARD_WIDTH > position.frameWidth;
  const style =
    position === undefined
      ? undefined
      : {
          left: flip ? position.x - POINTER_OFFSET - CARD_WIDTH : position.x + POINTER_OFFSET,
          top: position.y + POINTER_OFFSET,
        };

  const rows = (['dem', 'rep'] as const)
    .map((side) => ({ side, name: surname(nominees[side]), votes: place[side] }))
    .sort((a, b) => b.votes - a.votes);

  return (
    <div className={styles.card} style={style} role="status" aria-live="polite">
      <div className={styles.header}>
        <span className={styles.name}>{place.name}</span>
        {place.electoralVotes !== undefined && (
          <span className={`${styles.ev} tabular`}>{place.electoralVotes} electoral votes</span>
        )}
      </div>
      <table className={styles.rows}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.side}>
              <td>
                <span className={styles.chip} data-side={row.side} aria-hidden="true" />
                {row.name}
              </td>
              <td className="tabular">{formatVotes(row.votes)}</td>
              <td className="tabular">{shareOf(place, row.side)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.lead}>{leadLabel(place, nominees)}</div>
      {hint !== undefined && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
