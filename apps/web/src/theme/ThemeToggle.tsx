/**
 * ThemeToggle.tsx: the light/dark switch in the header.
 *
 * Web position: the only control for useTheme(). The label names the theme it switches
 * to, so the action is clear before it's taken.
 */

import { useTheme } from './useTheme.ts';
import styles from './ThemeToggle.module.css';

/** Button that flips between the paper (light) and black (dark) themes. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
    >
      <span className={styles.icon} data-theme-icon={theme} aria-hidden="true" />
      <span className={styles.text}>{next === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
