// Short names up to vigintillion (1e63); bigger numbers use exponents.
const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'];

let scientific = false;

/** Shows numbers from a million up in scientific notation (1.23e45) instead of short names: the Scientific numbers option. */
export function setScientific(on: boolean): void {
  scientific = on;
}

/** Formats large numbers as 1.23K, 4.56M, ... (or 1.23e6 with setScientific) and falls back to exponent notation. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return 'inf';
  if (Math.abs(n) < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier >= suffixes.length || (scientific && tier >= 2)) return n.toExponential(2).replace('e+', 'e');
  return (n / Math.pow(1000, tier)).toFixed(2) + suffixes[tier];
}

/** Digits a balance shows in full (1,234,567,890) before it switches to short names or exponents (Justin, 2026-10-16: "big number better"). */
export const fullDigits = 10;

/** A balance (Bananas, Words, Sentences, Lines): whole, with commas, up to fullDigits digits; bigger ones in scientific notation (1.23e10). */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return formatNumber(n);
  if (Math.abs(n) >= Math.pow(10, fullDigits)) return n.toExponential(2).replace('e+', 'e');
  return Math.floor(n).toLocaleString('en-US');
}

/** A price, written like the balances it is paid from (formatAmount), so the two compare at a glance; rounded up, as a part of a Banana still has to be paid. */
export function formatPrice(n: number): string {
  return formatAmount(Number.isFinite(n) ? Math.ceil(n) : n);
}

/** A multiplier: x1.25 below a thousand, then like any big number (x4.56M). */
export function formatMultiplier(n: number): string {
  return `x${n < 1000 ? n.toFixed(2) : formatNumber(n)}`;
}

/** A length of time: 45s, 12m 5s, 3h 20m, 2d 4h 0m. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const s = Math.floor(seconds);
  const [d, h, m] = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s % 60}s` : `${s % 60}s`;
}
