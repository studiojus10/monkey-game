import { afterEach, describe, expect, it } from 'vitest';
import { formatMultiplier, formatNumber, formatPrice, setScientific } from '../src/format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [2.5, '2.5'],
    [999, '999'],
    [1234, '1.23K'],
    [5_670_000, '5.67M'],
    [1e40, '10.00Dd'],
    [4.56e63, '4.56Vg'],
    [1e70, '1.00e70'],
  ])('%d -> %s', (n, out) => {
    expect(formatNumber(n)).toBe(out);
  });
});

describe('scientific numbers', () => {
  afterEach(() => setScientific(false));
  it('shows a million and up as exponents, smaller numbers as before', () => {
    setScientific(true);
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(5_670_000)).toBe('5.67e6');
    expect(formatNumber(1e40)).toBe('1.00e40');
  });
});

describe('formatMultiplier', () => {
  it('shows two decimals below a thousand, then like a big number', () => {
    expect(formatMultiplier(1.234)).toBe('x1.23');
    expect(formatMultiplier(4_560_000)).toBe('x4.56M');
  });
});

describe('formatPrice', () => {
  it('writes prices like the balances (in full to 10 digits, then 1.23e10), rounded up', () => {
    expect(formatPrice(300_000)).toBe('300,000');
    expect(formatPrice(10.2)).toBe('11');
    expect(formatPrice(1e12)).toBe('1.00e12');
  });
});
