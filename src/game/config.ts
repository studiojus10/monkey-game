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
 * Words added on top of the main word list (data/words.txt, the public-domain
 * ENABLE list), which leaves out one-letter words.
 */
export const extraWords = ['A', 'I'];

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

/**
 * Monkeys start slow; each "Faster typing" level multiplies their speed.
 * Level n costs upgradeBaseCost x upgradeCostGrowth^n.
 */
/** The n-th letter you buy (after your free first one) costs baseCost x costGrowth^(n-1). */
export const letterShop = {
  baseCost: 25,
  costGrowth: 3,
};

export const typing = {
  baseLettersPerSecond: 0.5,
  speedPerLevel: 1.25,
  upgradeBaseCost: 10,
  upgradeCostGrowth: 1.5,
};

/** Letters per typewriter line on screen. */
export const lineWidth = 30;

// Offline progress is capped so a long absence doesn't break balance.
export const maxOfflineSeconds = 8 * 60 * 60;
