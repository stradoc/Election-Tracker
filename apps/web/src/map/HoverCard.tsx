/**
 * HoverCard.tsx: the floating card that shows one place's result under the pointer.
 *
 * Web position: rendered by UsMap for whichever state or county is hovered or focused.
 * Shows both nominees' votes and shares, the lead, and electoral votes where they apply.
 * When demographics are loaded it adds a short profile of the place (ACS): turnout,
 * education, race and ethnicity, income. These describe the place, not how any group voted.
 */

import {
  formatShare,
  turnoutRate,
  type GeoProfile,
  type Nominees,
  type PlaceResult,
} from '@tippingpoint/shared';
import { formatDollars, formatVotes, leadLabel, shareOf, surname } from '../format.ts';
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
/** Card width in pixels; must match .card width in HoverCard.module.css. */
const CARD_WIDTH = 280;
/** Whole percentages are precise enough for demographics. */
const PROFILE_DIGITS = 0;

interface HoverCardProps {
  readonly place: PlaceResult;
  readonly nominees: Nominees;
  /** The place's demographic profile, when loaded. */
  readonly profile?: GeoProfile;
  /** Undefined for keyboard focus: the card then sits in the frame's top-left corner. */
  readonly position?: CardPosition;
  /** Extra line under the numbers, e.g. "Select to see counties". */
  readonly hint?: string;
}

/** One line of the profile. `stacked` puts a long value under its label. */
interface ProfileRow {
  readonly label: string;
  readonly value: string;
  readonly stacked?: boolean;
}

/** The profile rows shown on the card, in order. */
function profileRows(place: PlaceResult, profile: GeoProfile): ProfileRow[] {
  const turnout = turnoutRate(place, profile);
  const pct = (fraction: number): string => formatShare(fraction, PROFILE_DIGITS);
  return [
    {
      label: 'Turnout of citizens 18+',
      value: turnout === undefined ? '–' : pct(turnout),
    },
    { label: "Bachelor's degree or higher", value: pct(profile.bachelorsOrHigher) },
    {
      label: 'Race and ethnicity',
      // Largest group first; "White" and "Black" here mean non-Hispanic.
      value: [
        { name: 'White', share: profile.whiteNonHispanic },
        { name: 'Black', share: profile.blackNonHispanic },
        { name: 'Hispanic', share: profile.hispanic },
        { name: 'Asian', share: profile.asianNonHispanic },
      ]
        .sort((x, y) => y.share - x.share)
        .map((group) => `${pct(group.share)} ${group.name}`)
        .join(', '),
      stacked: true,
    },
    {
      label: 'Median household income',
      value:
        profile.medianHouseholdIncome === null ? '–' : formatDollars(profile.medianHouseholdIncome),
    },
  ];
}

/** One place's result, floating next to the pointer. */
export function HoverCard({ place, nominees, profile, position, hint }: HoverCardProps) {
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
      {profile !== undefined && (
        <dl className={styles.profile}>
          {profileRows(place, profile).map((row) => (
            <div key={row.label} className={styles.profileRow} data-stacked={row.stacked === true}>
              <dt>{row.label}</dt>
              <dd className="tabular">{row.value}</dd>
            </div>
          ))}
          <div className={styles.source}>Census ACS {profile.period}</div>
        </dl>
      )}
      {hint !== undefined && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
