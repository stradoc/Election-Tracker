/**
 * Legend.tsx: the map's colour key, from widest Republican margin to widest Democratic.
 *
 * Web position: under the map. Steps come from marginBins.ts, so the key always matches
 * the colours on the map.
 */

import type { Nominees } from '@tippingpoint/shared';
import { surname } from '../format.ts';
import { legendSteps } from '../map/marginBins.ts';
import styles from './Legend.module.css';

/** Colour key for the margin scale, labelled with the nominees' names. */
export function Legend({ nominees }: { readonly nominees: Nominees }) {
  const sideName = { dem: surname(nominees.dem), rep: surname(nominees.rep), tossup: 'Either' };
  return (
    <figure className={styles.legend}>
      <div className={styles.ends} aria-hidden="true">
        <span>{surname(nominees.rep)} ahead</span>
        <span>{surname(nominees.dem)} ahead</span>
      </div>
      <ol className={styles.swatches} aria-label="Map colours by margin">
        {legendSteps().map((step) => (
          <li
            key={step.bin}
            className={styles.step}
            aria-label={`${sideName[step.side]} by ${step.label} points`}
          >
            <span className={styles.swatch} data-bin={step.bin} aria-hidden="true" />
            <span className={`${styles.label} tabular`} aria-hidden="true">
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={styles.caption}>Margin in percentage points</figcaption>
    </figure>
  );
}
