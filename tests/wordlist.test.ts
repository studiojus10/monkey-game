import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('data/words.txt', () => {
  const words = readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8').split('\n');

  it('is the ENABLE list: lowercase letters only, one word per line', () => {
    expect(words.length).toBeGreaterThan(170_000);
    expect(words.filter(Boolean).every((w) => /^[a-z]+$/.test(w))).toBe(true);
    for (const w of ['it', 'cat', 'zap', 'quiz', 'thou']) expect(words).toContain(w);
  });
});
