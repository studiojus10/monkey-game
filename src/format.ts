const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Formats large numbers as 1.23K, 4.56M, ... and falls back to exponent notation. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return 'inf';
  if (Math.abs(n) < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier >= suffixes.length) return n.toExponential(2);
  return (n / Math.pow(1000, tier)).toFixed(2) + suffixes[tier];
}

/** A length of time: 45s, 12m 5s, 3h 20m, 2d 4h 0m. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const s = Math.floor(seconds);
  const [d, h, m] = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s % 60}s` : `${s % 60}s`;
}
