/**
 * useTheme.ts: the light/dark theme switch.
 *
 * Web position: index.html applies the saved or system theme before first paint (so the
 * page never flashes). This hook reads that attribute as its starting point and owns
 * every change after it, saving the choice so it survives reloads.
 */

import { useCallback, useState } from 'react';

/** The two themes tokens.css defines. */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tippingpoint:theme';
const ATTRIBUTE = 'data-theme';

/** The theme currently applied to <html>. */
function appliedTheme(): Theme {
  return document.documentElement.getAttribute(ATTRIBUTE) === 'dark' ? 'dark' : 'light';
}

/** Current theme and a function that flips it. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(appliedTheme);

  const toggle = useCallback(() => {
    const next: Theme = appliedTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute(ATTRIBUTE, next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or blocked storage: the choice lasts for this visit only.
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}
