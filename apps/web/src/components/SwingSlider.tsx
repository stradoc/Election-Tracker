/**
 * SwingSlider.tsx: the "what if" control. Shift every state's margin by the same amount.
 *
 * Web position: one input to the scenario engine (shared/scenario.ts). Works in points
 * (−10 … +10, positive = toward Democrats); the page converts to the engine's fractions.
 * A native range input, so it works with keyboard, touch and screen readers as-is.
 */

import styles from './SwingSlider.module.css';

/** Largest swing offered, in points, each way. */
export const MAX_SWING_POINTS = 10;
/** Slider step in points. */
const STEP_POINTS = 0.5;

interface SwingSliderProps {
  /** Current swing in points; positive = toward Democrats. */
  readonly value: number;
  readonly onChange: (points: number) => void;
}

/** Plain-language reading of a swing value. */
export function describeSwing(points: number): string {
  if (points === 0) return 'Actual result';
  const party = points > 0 ? 'Democratic' : 'Republican';
  return `Every state ${Math.abs(points).toFixed(1)} points more ${party}`;
}

/** The uniform-swing slider with its live reading and a reset button. */
export function SwingSlider({ value, onChange }: SwingSliderProps) {
  return (
    <div className={styles.swing}>
      <div className={styles.heading}>
        <label htmlFor="swing" className={styles.label}>
          Shift the whole map
        </label>
        <output htmlFor="swing" className={`${styles.reading} tabular`} data-actual={value === 0}>
          {describeSwing(value)}
        </output>
      </div>
      <input
        id="swing"
        className={styles.range}
        type="range"
        min={-MAX_SWING_POINTS}
        max={MAX_SWING_POINTS}
        step={STEP_POINTS}
        value={value}
        aria-valuetext={describeSwing(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className={`${styles.ends} tabular`} aria-hidden="true">
        <span>R+{MAX_SWING_POINTS}</span>
        <span>D+{MAX_SWING_POINTS}</span>
      </div>
      <button
        type="button"
        className={styles.reset}
        onClick={() => onChange(0)}
        disabled={value === 0}
      >
        Reset to actual result
      </button>
    </div>
  );
}
