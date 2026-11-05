/**
 * vitest.config.ts: one test runner for the whole monorepo (`npm test`).
 *
 * Tests sit next to the code they check (*.test.ts). Data-backed tests under scripts/data
 * skip themselves when data/processed has not been generated yet.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'scripts/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
