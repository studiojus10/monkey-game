// All player-facing names and balance numbers live here so the game can be
// reskinned or rebalanced without touching the logic. See docs/DESIGN.md.

export const theme = {
  title: 'Infinite Monkeys',
  currency: 'Points',
  pokeAction: 'pet the monkey',
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

/**
 * You start with one monkey. More monkeys are a late upgrade paid in Lines
 * (first-time line completions); the n-th one you buy costs
 * baseCost x costGrowth^(n-1) Lines.
 */
export const monkeyShop = {
  baseCost: 10,
  costGrowth: 2,
};

/**
 * Combos: only words at least minWordLength long raise the multiplier, and it
 * stops at maxMultiplier plus one per cap raise. The n-th cap raise costs
 * capRaiseBaseCost x capRaiseCostGrowth^n Sentences.
 */
export const combo = {
  minWordLength: 4,
  maxMultiplier: 3,
  capRaiseBaseCost: 1,
  capRaiseCostGrowth: 2,
};

/**
 * Typing a line of the play word for word: every time it pays a Sentence
 * (lines of at least sentenceMinWords words only, so one-word lines can't be
 * farmed); the first time it pays a Line and a points bonus of
 * (the line's word points) x (number of words)^2.
 */
export const lineRewards = {
  sentenceMinWords: 3,
};

/**
 * Typewriter keys, a mid-game upgrade bought with points once you own
 * unlockLetters letters. Every key is one more option a monkey can hit:
 * - heavier keys add weight to a letter you own (weight 1 + level);
 * - combination and word keys type their whole text in one keystroke.
 * Prices scale with the price of your next letter. Only curated keys are
 * offered: junk clusters would just dilute the pool.
 */
export const typewriterKeys = {
  unlockLetters: 13,
  baseCost: 4_000_000, // points; fixed, so owning more letters doesn't make keys dearer
  heavierCostFactor: 0.25, // x baseCost x 2^level
  combinationCostFactor: 1, // x baseCost
  wordCostFactor: 3, // x baseCost
  combinations: ['TH', 'HE', 'IN', 'ER', 'AN', 'ST', 'ND', 'OU', 'QU', 'SH', 'CH', 'ING', 'ION', 'ENT'],
  words: ['THE', 'AND', 'YOU', 'NOT', 'THAT', 'WITH', 'THOU', 'THEE', 'THY', 'LORD', 'WHAT', 'HATH', 'LOVE'],
};

export const typing = {
  baseLettersPerSecond: 0.5,
  speedPerLevel: 1.25,
  upgradeBaseCost: 10,
  upgradeCostGrowth: 1.5,
};

/**
 * Milestones for writing every line of a scene, an act or a play. Rewards
 * scale with length, are permanent, and add up: each scene adds
 * scenePointsPerLine per line to the points bonus and pays
 * sceneSentencesPerLine Sentences per line (at least 1); each act adds
 * actSpeedPerLine per line to the typing speed bonus and brings
 * actFreeMonkeys monkeys (which don't raise the monkey price). A play is
 * all its scenes and acts, so finishing one has paid every bonus in it,
 * however its parts were bought.
 */
export const milestones = {
  scenePointsPerLine: 0.001, // a 200-line scene: +20% points
  sceneSentencesPerLine: 0.25,
  actSpeedPerLine: 0.0005, // an 800-line act: +40% typing speed
  actFreeMonkeys: 1,
};

/**
 * The script shop, in points. You start with one free scene and buy the
 * rest: a scene costs pointsPerLetter for each letter in its lines; an act
 * or a whole play costs its unowned scenes' total times its discount.
 * starterScenes is how many short scenes of your first department's genre
 * are offered for free at the start.
 */
export const scriptShop = {
  pointsPerLetter: 10,
  actDiscount: 0.8,
  playDiscount: 0.6,
  starterScenes: 3,
};

/**
 * Departments: one per genre (comedies, histories, tragedies, and last the
 * Sonnets). You open the first at the start; the n-th opens once you have
 * monkeysToOpen[n-1] monkeys, bought or earned. A department holds at most
 * maxTypists typing monkeys plus one manager, so the thresholds must stay
 * reachable: the n-th department needs at most (n-1) x maxTypists. You choose
 * each new monkey's department (automatic when only one has room). Each monkey works in one department and only
 * writes lines of plays in that department's genre, and only plays of a
 * department's genre can be bought.
 */
export const departmentRules = {
  monkeysToOpen: [0, 10, 20, 30],
  maxTypists: 10, // typing monkeys per department, plus one manager
};

/**
 * The sonnet department, opened last (after all three play genres). Verse
 * lines aren't sentences, so sonnets pay mostly in Lines: linesPerLine for
 * each new line written (no Sentences), a smaller points bonus (line word
 * points x words, not words squared), and finishing a sonnet pays
 * linesPerSonnetLine Lines per line in it instead of scene and act bonuses.
 */
export const sonnetRewards = {
  linesPerLine: 2,
  linesPerSonnetLine: 1,
};

/**
 * Manager monkeys: a department with more than minDepartmentMonkeys monkeys
 * can promote one (at most one per department). A manager stops typing and
 * instead keeps its department aimed at the first unwritten line it can
 * spell with your letters: it pins that line and fills your word slots with
 * its words. If several departments have managers, the first department's
 * manager sets the word slots (there's one set of slots). Managers can be
 * upgraded with Lines.
 */
export const managers = {
  minDepartmentMonkeys: 5,
  // Each upgrade adds bonusPerLevel to the points of every monkey in the
  // manager's department (x1.1, x1.2, ...). Upgrades are deliberately very
  // expensive, since one upgrades the whole department: the n-th costs
  // linesPerMonkey Lines per monkey in the department x upgradeCostGrowth^(n-1).
  bonusPerLevel: 0.1,
  linesPerMonkey: 50,
  upgradeCostGrowth: 2,
};

/** Letters per typewriter line on screen. */
export const lineWidth = 60;

/**
 * Word slots, a late upgrade bought with Lines once you own unlockLetters
 * letters. Each slot locks one position in a chain (1st word, 2nd word, ...)
 * to a word you choose; it can be switched off to type fully at random.
 * Each department has its own slots, up to maxSlots; a department's n-th slot
 * costs baseCost x costGrowth^(n-1) Lines.
 */
export const wordSlots = {
  unlockLetters: 13,
  baseCost: 3,
  costGrowth: 2,
  maxSlots: 9,
};

/** How many play lines can be pinned to the home screen. */
export const maxPinnedLines = 5;

/** Longest name a player can give a monkey. */
export const maxMonkeyNameLength = 12;

// Offline progress is capped so a long absence doesn't break balance.
export const maxOfflineSeconds = 8 * 60 * 60;

// Offline time is simulated letter by letter up to this many letters; beyond
// that, the rest is estimated from the simulated part so loading stays quick.
export const maxOfflineLetters = 200_000;
