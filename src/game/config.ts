// All player-facing names and balance numbers live here so the game can be
// reskinned or rebalanced without touching the logic. See docs/DESIGN.md.

export const theme = {
  title: 'Infinite Monkeys',
  currency: 'Points',
  pokeAction: 'Poke the monkey',
};

/** The player's first letter has to be a word on its own. */
export const startingLetters = ['A', 'I'];

/**
 * Words that can score. For now only the one-letter words; the real word
 * list arrives with the letter shop.
 */
export const words = ['A', 'I'];

/** Scrabble-style letter values; a word scores (sum of values) x length. */
export const letterValues: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

export const monkey = {
  lettersPerSecond: 2,
};

/** Letters per typewriter line on screen. */
export const lineWidth = 30;

// Offline progress is capped so a long absence doesn't break balance.
export const maxOfflineSeconds = 8 * 60 * 60;
