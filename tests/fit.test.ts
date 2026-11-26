import { describe, expect, it } from 'vitest';
import { fitPage, fitRows, minListRows } from '../src/cli/fit';

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

describe('fitPage', () => {
  const list = (total: number) => (n: number, message: string) => ['T', '', ...Array.from({ length: Math.min(n, total) }, (_, i) => `row ${i}`), ...(message ? ['', ` ${message}`] : []), '', ` ${'-'.repeat(30)}`, ' keys'].join('\n');
  it('keeps a line for the message, so one showing adds no lines', () => {
    const quiet = fitPage(list(100), { base: 12, total: 100, height: 40 });
    const said = fitPage(list(100), { base: 12, total: 100, height: 40, message: 'Hello.' });
    expect(said.rows).toBe(quiet.rows);
    expect(quiet.screen.split('\n')).toContain(' '.repeat(2)); // the blank message
  });
  it('says whether the list scrolls, and brings the page to the height either way', () => {
    expect(fitPage(list(100), { base: 12, total: 100, height: 40 }).scrolls).toBe(true);
    const whole = fitPage(list(10), { base: 12, total: 10, height: 40 });
    expect(whole.scrolls).toBe(false);
    expect(whole.screen.split('\n')).toHaveLength(40);
    expect(fitPage(list(10), { base: 12, total: 10, height: 0 }).screen.split('\n')).toHaveLength(17); // no height: as drawn
  });
});
