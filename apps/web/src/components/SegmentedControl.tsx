/**
 * SegmentedControl.tsx: a row of pill buttons where exactly one is selected.
 *
 * Web position: the one control for picking between a few options (election year today;
 * office and view later). Built as a radio group so keyboard and screen-reader users get
 * the expected arrow-key behaviour for free.
 */

import { useId } from 'react';
import styles from './SegmentedControl.module.css';

interface SegmentedControlProps<Value extends string | number> {
  /** Accessible name for the group, e.g. "Election year". */
  readonly label: string;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

/** Pill-style single choice. */
export function SegmentedControl<Value extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  const name = useId();
  return (
    <div className={styles.track} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={styles.option} data-active={option.value === value}>
          <input
            type="radio"
            name={name}
            className="visually-hidden"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="tabular">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
