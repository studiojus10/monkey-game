import { describe, expect, it } from 'vitest';
import { fitRows, minListRows } from '../src/cli/fit';

const page = (headings: number) => (n: number) => ['T', '', ...Array.from({ length: n + Math.floor(n / 4) * headings }, (_, i) => `row ${i}`), '', ' ---', ' keys'].join('\n');

describe('fitRows', () => {
  it('grows a list to the height', () => {
    const r = fitRows(page(0), 12, 40);
    expect(r.rows).toBe(35);
    expect(r.screen.split('\n')).toHaveLength(40);
  });
  it('steps down when headings make it too tall', () => {
    const r = fitRows(page(1), 12, 40);
    expect(r.screen.split('\n').length).toBeLessThanOrEqual(40);
    expect(fitRows(page(1), 12, 40).rows).toBeGreaterThan(20);
  });
  it('shrinks to fit a small window, never below the floor', () => {
    expect(fitRows(page(0), 12, 15).rows).toBe(10);
    expect(fitRows(page(0), 12, 6).rows).toBe(minListRows);
  });
  it('keeps the default with no height', () => {
    expect(fitRows(page(0), 12, 0).rows).toBe(12);
  });
});
