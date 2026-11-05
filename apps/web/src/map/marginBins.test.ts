/**
 * marginBins.test.ts: checks that margins land in the right colour step and that the
 * legend lists every step in order. Cases live in marginBins.test.json.
 */

import { describe, expect, it } from 'vitest';
import cases from './marginBins.test.json' with { type: 'json' };
import { legendSteps, marginBin } from './marginBins.ts';

describe('marginBin', () => {
  it.each(cases.bins)('$margin → $bin', ({ margin, bin }) => {
    expect(marginBin(margin)).toBe(bin);
  });
});

describe('legendSteps', () => {
  it('runs from widest Republican to widest Democratic margin', () => {
    expect(legendSteps().map((step) => step.bin)).toEqual(cases.legendOrder);
  });

  it('labels each step with its range', () => {
    expect(legendSteps().map((step) => step.label)).toEqual(cases.legendLabels);
  });
});
