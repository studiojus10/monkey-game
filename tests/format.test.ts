import { describe, expect, it } from 'vitest';
import { formatNumber } from '../src/ui/format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [2.5, '2.5'],
    [999, '999'],
    [1234, '1.23K'],
    [5_670_000, '5.67M'],
    [1e40, '1.00e+40'],
  ])('%d -> %s', (n, out) => {
    expect(formatNumber(n)).toBe(out);
  });
});
