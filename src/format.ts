const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Formats large numbers as 1.23K, 4.56M, ... and falls back to exponent notation. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier >= suffixes.length) return n.toExponential(2);
  return (n / Math.pow(1000, tier)).toFixed(2) + suffixes[tier];
}
