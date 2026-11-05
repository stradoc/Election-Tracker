/**
 * EvBar.tsx: the electoral-vote bar across the top of the page.
 *
 * Web position: the headline of every presidential view. Shows each nominee's electoral
 * votes from the scenario engine, filling in from each end toward the 270 line. Segment
 * widths ease with the swing slider (the "measurement" motion in tokens.css).
 */

import { winnerOf, type ElectoralTotals, type Nominees } from '@tippingpoint/shared';
import { surname } from '../format.ts';
import styles from './EvBar.module.css';

const PERCENT = 100;

interface EvBarProps {
  readonly totals: ElectoralTotals;
  readonly nominees: Nominees;
}

/** Electoral votes per nominee, with the majority line. */
export function EvBar({ totals, nominees }: EvBarProps) {
  const widthOf = (votes: number): string => `${(votes / Math.max(totals.total, 1)) * PERCENT}%`;
  const winner = winnerOf(totals);
  const summary =
    `${nominees.dem} ${totals.dem}, ${nominees.rep} ${totals.rep} electoral votes. ` +
    `${totals.needed} needed to win.`;

  return (
    <section className={styles.bar} aria-label="Electoral votes">
      <div className={styles.side} data-side="dem" data-winner={winner === 'dem'}>
        <span className={styles.name}>{nominees.dem}</span>
        <span className={`${styles.count} tabular`}>{totals.dem}</span>
      </div>
      <div className={styles.side} data-side="rep" data-winner={winner === 'rep'}>
        <span className={styles.name}>{nominees.rep}</span>
        <span className={`${styles.count} tabular`}>{totals.rep}</span>
      </div>

      <div className={styles.track} role="img" aria-label={summary}>
        <div className={styles.dem} style={{ width: widthOf(totals.dem) }} />
        <div className={styles.rep} style={{ width: widthOf(totals.rep) }} />
        <div className={styles.majority} style={{ left: widthOf(totals.needed) }}>
          <span className="tabular">{totals.needed} to win</span>
        </div>
      </div>
      <p className="visually-hidden">
        {winner === undefined ? 'Nobody reaches a majority.' : `${surname(nominees[winner])} wins.`}
      </p>
    </section>
  );
}
