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
  // Each letter also costs Words: floor(wordsCostFactor x owned^wordsCostPower), so 0, 1, 2, 4, 6, 9, ...
  // Kept gentle early: a poor second or third letter (Q, J) adds few new words, and must not lock you out.
  wordsCostFactor: 0.25,
  wordsCostPower: 2,
};

/**
 * You start with one monkey. More monkeys are paid in Points. Each
 * department has its own price: the n-th monkey bought for the d-th
 * department opened (both from 0) costs
 * baseCost x departmentGrowth^d x costGrowth^n, so every department takes
 * days to fill however many monkeys came before it.
 */
export const monkeyShop = {
  baseCost: 300_000, // scripts/simulate.ts: 2nd monkey after about 2.5h, a full department (10) after about 3 days
  costGrowth: 6,
  departmentGrowth: 100,
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
 * Sentences from babbling: when a monkey's chain ends, it pays a Sentence if
 * it held at least chainWords words of wordMinLength+ letters, and one more
 * for every extraEvery such words past that. Renewable and slow-paced.
 */
export const sentenceRules = {
  chainWords: 3, // measured with scripts/simulate.ts: about 40 the first hour, about 100 an hour by hour 5
  wordMinLength: 4, // the same long words that raise the combo
  extraEvery: 3,
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
 * unlockLetters letters. Each key is one more option a monkey can hit, and
 * types its whole text in one keystroke:
 * - combination keys come from a curated list (junk clusters would just
 *   dilute the pool);
 * - a word key unlocks once your monkeys have spelled that word enough
 *   times: wordSpellsToUnlock for the first word key, then wordSpellsGrowth
 *   times more for each word key you own (words of wordMinLength+ letters).
 * Prices are fixed, so owning more letters doesn't make keys dearer.
 */
export const typewriterKeys = {
  unlockLetters: 13,
  baseCost: 4_000_000, // points
  combinationCostFactor: 1, // x baseCost
  wordCostPerLetter: 1, // x baseCost per letter of the word
  wordSpellsToUnlock: 100,
  wordSpellsGrowth: 1.1, // +10% per word key owned
  wordMinLength: 3,
  combinations: ['TH', 'HE', 'IN', 'ER', 'AN', 'ST', 'ND', 'OU', 'QU', 'SH', 'CH', 'ING', 'ION', 'ENT'],
};

/**
 * Each monkey has its own typing skill, trained one level at a time with
 * points. Its typewriter caps the skill at levelsPerTypewriter levels per
 * typewriter; a better typewriter (also points) allows another set of levels.
 */
export const typing = {
  baseLettersPerSecond: 0.5,
  speedPerLevel: 1.25,
  upgradeBaseCost: 10,
  upgradeCostGrowth: 1.5,
  levelsPerTypewriter: 10,
  typewriterBaseCost: 1000, // points for the 2nd typewriter
  typewriterCostGrowth: 25, // x per typewriter after that
  typewriters: ['Rusty typewriter', 'Portable typewriter', 'Office typewriter', 'Electric typewriter', 'Golden typewriter', 'Diamond typewriter'],
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
/**
 * Office space. Each department needs its own room, and every monkey needs a
 * desk in its department's room; a desk comes free with each monkey and stands
 * on a free square, so a department's floor space caps its monkeys. Break
 * rooms hold furniture. You start with one small room; new rooms (starting at
 * newRoomWidth x newRoomHeight) cost roomBaseCost x roomCostGrowth^(rooms bought
 * before), and rooms grow one square at a time, the n-th square bought costing
 * squareBaseCost x squareCostGrowth^n. Everything places itself; the office
 * map is there for players who want to design the layout. Costs are placeholders.
 */
export const office = {
  starterWidth: 2,
  starterHeight: 2,
  newRoomWidth: 3,
  newRoomHeight: 3,
  roomBaseCost: 10_000,
  roomCostGrowth: 10,
  squareBaseCost: 500,
  squareCostGrowth: 1.15,
  mapWidth: 18, // squares across the office map before new rooms go below instead
};

/**
 * Furniture, bought with points in the Furniture store. Each piece fills one
 * square, placed in the first free square of a break room (else any room); the
 * office map moves it. Each one of a kind costs costGrowth times the last.
 * Decor (drain) in a department's room slows its monkeys' tiring; comfort
 * (rest) in a break room speeds up everyone's breaks; every piece adds a little
 * happiness to every monkey (see `petting`). Bonuses add up to the caps in `energy`. All
 * numbers are placeholders.
 */
export interface FurnitureKind {
  id: string;
  name: string;
  glyph: string; // one character on the office map
  cost: number;
  costGrowth: number;
  drain: number; // decor: in a department's room, its monkeys tire this much slower (0.03 = 3%)
  rest: number; // in a break room, every monkey's breaks go this much faster (0.15 = 15%)
  happiness: number; // anywhere in the office: points x (1 + happiness), added up; monkeys also tire slower and rest faster
  size?: [number, number]; // squares across and down (1 x 1 when missing); turning a piece swaps them
  element: Element; // its feng shui element
}

/** The five feng shui elements. A room with all five is balanced. */
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** The desk every monkey gets free, in its department's room. Not sold. */
export const desk: FurnitureKind = { id: 'desk', name: 'Desk', glyph: '@', cost: 0, costGrowth: 1, drain: 0, rest: 0, happiness: 0, element: 'metal' }; // the typewriter is metal

export const furnitureKinds: FurnitureKind[] = [
  { id: 'plant', name: 'Potted plant', glyph: 'P', cost: 500, costGrowth: 1.5, drain: 0.03, rest: 0, happiness: 0.01, element: 'wood' },
  { id: 'lamp', name: 'Floor lamp', glyph: 'L', cost: 2_000, costGrowth: 1.5, drain: 0.04, rest: 0, happiness: 0.01, element: 'metal' },
  { id: 'bookshelf', name: 'Bookshelf', glyph: 'B', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'wood' },
  { id: 'bench', name: 'Bench', glyph: 'H', cost: 10_000, costGrowth: 1.5, drain: 0, rest: 0.08, happiness: 0.01, size: [2, 1], element: 'earth' },
  { id: 'cooler', name: 'Water cooler', glyph: 'W', cost: 50_000, costGrowth: 2, drain: 0, rest: 0.15, happiness: 0.01, element: 'water' },
  { id: 'couch', name: 'Couch', glyph: 'C', cost: 200_000, costGrowth: 2, drain: 0, rest: 0.25, happiness: 0.02, size: [2, 1], element: 'earth' },
  { id: 'tv', name: 'Television', glyph: 'T', cost: 1_000_000, costGrowth: 2, drain: 0, rest: 0.4, happiness: 0.03, element: 'fire' },
];

/**
 * Feng shui: each room has five rules (see logic's roomChi), and its chi is
 * the share it keeps. The office's chi (the average over rooms you can reach)
 * adds up to maxHappiness to happiness once you own the feng shui book (in
 * the Furniture store), which also shows the rules and each room's chi.
 * Windows count as Fire. Placeholders.
 */
export const fengShui = {
  maxHappiness: 0.1,
  bookCost: 5_000,
  windowElement: 'fire' as Element,
};

/**
 * Monkey energy, from 1 (100%) to 0. Typing drains it in drainSeconds; a tired
 * monkey types slower, down to (1 - maxSlowdown) of its speed at 0%, when it
 * takes a break on its own and rests back to 100% in breakSeconds. Managers
 * don't type, so they don't tire. Placeholders for the balance pass; furniture
 * will change these rates.
 */
export const energy = {
  drainSeconds: 600,
  breakSeconds: 60,
  maxSlowdown: 0.25,
  maxDrainCut: 0.5, // furniture slows tiring by at most half
  maxRestBoost: 3, // and speeds up breaks by at most +300%
  maxHappiness: 0.5, // and adds at most +50% happiness: points x (1 + happiness), and see `petting`
};

/**
 * A monkey's happiness (the office's, from furniture, plus its own from
 * petting) makes it tire slower and rest faster: drain time x (1 + happiness),
 * break time / (1 + happiness). Petting (enter) makes the least happy typing
 * monkey a little happier; it's mostly for fun (Justin: "petting should have
 * very little effect on the gameplay"), so it adds little and wears off.
 */
export const petting = {
  happinessPerPet: 0.005,
  maxHappiness: 0.05, // petting adds at most +5% to a monkey's happiness
  fadePerMinute: 0.01, // and wears off this fast
};

/**
 * Publishing a Folio (the prestige reset), open once a whole play is
 * finished (Justin, 2026-10-14: the player chooses when). Everything starts
 * over except achievements, statistics, options and the Folio itself, which
 * keeps a page for every play line written, in every department, plus
 * finishedPlayPages more per line of each finished play. Every page banked
 * raises points by bonusPerPage for good. Placeholders.
 */
export const folio = {
  bonusPerPage: 0.001, // +0.1% points a page: a finished Midsummer (2,160 lines, counted twice) is about +432%
  finishedPlayPages: 1,
};

/**
 * Achievements: no reward, just a record on the achievements page ([a]).
 * Each one unlocks when its measure (see achievementValue in logic.ts)
 * reaches `at`. Measures named word:XYZ count how often the monkeys spelled
 * XYZ; wearing:id counts monkeys wearing that hat. Secret ones show as
 * ??? until unlocked.
 */
export interface Achievement {
  id: string;
  name: string;
  text: string;
  stat: string;
  at: number;
  secret?: boolean;
}

export const achievements: Achievement[] = [
  // Every first.
  { id: 'first-word', name: 'Hello, world', text: 'Spell your first word', stat: 'wordsSpelled', at: 1 },
  { id: 'first-letter', name: 'Second letter', text: 'Buy a second letter', stat: 'lettersOwned', at: 2 },
  { id: 'first-combo', name: 'Combo', text: 'Spell two words in a row', stat: 'chain', at: 2 },
  { id: 'first-sentence', name: 'Full stop', text: 'Earn a Sentence from a long chain', stat: 'chainSentences', at: 1 },
  { id: 'first-line', name: 'To be...', text: 'Write your first line of a play', stat: 'linesWritten', at: 1 },
  { id: 'first-scene', name: 'Scene!', text: 'Finish a scene', stat: 'scenes', at: 1 },
  { id: 'first-act', name: 'Curtain call', text: 'Finish an act', stat: 'acts', at: 1 },
  { id: 'first-play', name: 'Exeunt', text: 'Finish a whole play', stat: 'plays', at: 1 },
  { id: 'first-hire', name: 'Company', text: 'Hire a second monkey', stat: 'monkeys', at: 2 },
  { id: 'first-name', name: "What's in a name?", text: 'Name a monkey', stat: 'named', at: 1 },
  { id: 'first-manager', name: 'Middle management', text: 'Promote a monkey to manager', stat: 'managers', at: 1 },
  { id: 'first-department', name: 'Expansion', text: 'Open a second department', stat: 'departments', at: 2 },
  { id: 'first-room', name: 'Room to breathe', text: 'Buy a new room', stat: 'rooms', at: 2 },
  { id: 'first-furniture', name: 'Interior design', text: 'Buy a piece of furniture', stat: 'furniture', at: 1 },
  { id: 'harmony', name: 'Harmony', text: 'Give a room perfect chi (feng shui)', stat: 'harmony', at: 1 },
  { id: 'first-hat', name: 'Hat trick', text: 'Give a monkey a hat', stat: 'hats', at: 1 },
  { id: 'first-dye', name: 'Dressed to the nines', text: 'Dye a hat', stat: 'dyed', at: 1 },
  { id: 'first-faster', name: 'Practice', text: 'Teach a monkey to type faster', stat: 'skill', at: 1 },
  { id: 'first-typewriter', name: 'Upgrade', text: 'Give a monkey a better typewriter', stat: 'typewriter', at: 1 },
  { id: 'first-key', name: 'Shortcut', text: 'Buy a typewriter key', stat: 'keys', at: 1 },
  { id: 'first-slot', name: 'Fill in the blank', text: 'Buy a word slot', stat: 'slots', at: 1 },
  { id: 'first-pet', name: 'Good monkey', text: 'Pet a monkey', stat: 'pets', at: 1 },
  { id: 'first-folio', name: 'First Folio', text: 'Publish a Folio', stat: 'folios', at: 1 },
  // Just for fun.
  { id: 'pets-100', name: 'Best friends', text: 'Pet the monkeys 100 times', stat: 'pets', at: 100 },
  { id: 'pets-1000', name: 'Pet project', text: 'Pet the monkeys 1,000 times', stat: 'pets', at: 1_000 },
  { id: 'pets-10000', name: 'Spoiled rotten', text: 'Pet the monkeys 10,000 times', stat: 'pets', at: 10_000 },
  { id: 'happiest', name: 'Over the moon', text: 'Pet a monkey until it can be no happier', stat: 'happiest', at: 1 },
  { id: 'chain-10', name: 'On a roll', text: 'Spell 10 words in a row', stat: 'chain', at: 10 },
  { id: 'word-8', name: 'Big words', text: 'Spell a word of 8 letters', stat: 'longestWord', at: 8 },
  { id: 'word-12', name: 'Sesquipedalian', text: 'Spell a word of 12 letters', stat: 'longestWord', at: 12 },
  { id: 'dictionary-100', name: 'Vocabulary', text: 'Spell 100 different words', stat: 'dictionary', at: 100 },
  { id: 'dictionary-1000', name: 'Lexicon', text: 'Spell 1,000 different words', stat: 'dictionary', at: 1_000 },
  { id: 'dictionary-10000', name: 'Walking dictionary', text: 'Spell 10,000 different words', stat: 'dictionary', at: 10_000 },
  { id: 'letters-1m', name: 'A million monkeys', text: 'Type a million letters', stat: 'lettersTyped', at: 1_000_000 },
  { id: 'alphabet', name: 'A to Z', text: 'Own all 26 letters', stat: 'lettersOwned', at: 26 },
  { id: 'full-department', name: 'Full house', text: 'Fill a department with 10 monkeys', stat: 'biggestDepartment', at: 10 },
  { id: 'day-job', name: 'Day job', text: 'Keep the monkeys typing for 24 hours', stat: 'hoursTyping', at: 24 },
  { id: 'crown', name: 'Long live the king', text: 'Crown a monkey', stat: 'wearing:crown', at: 1 },
  { id: 'halo', name: 'Angelic', text: 'Give a monkey a halo', stat: 'wearing:halo', at: 1 },
  { id: 'hats-all', name: 'Mad hatter', text: 'Own 7 different kinds of hat', stat: 'hatKinds', at: 7 },
  { id: 'billion', name: 'Billionaire', text: 'Earn a billion Points', stat: 'points', at: 1e9 },
  // Secrets: words the monkeys might stumble on.
  { id: 'word-monkey', name: 'Self-aware', text: 'The monkeys spelled MONKEY', stat: 'word:MONKEY', at: 1, secret: true },
  { id: 'word-banana', name: 'Snack break', text: 'The monkeys spelled BANANA', stat: 'word:BANANA', at: 1, secret: true },
  { id: 'word-hamlet', name: 'Prince of Denmark', text: 'The monkeys spelled HAMLET', stat: 'word:HAMLET', at: 1, secret: true },
  { id: 'word-bard', name: 'The Bard', text: 'The monkeys spelled BARD', stat: 'word:BARD', at: 1, secret: true },
  { id: 'word-typewriter', name: 'Know your tools', text: 'The monkeys spelled TYPEWRITER', stat: 'word:TYPEWRITER', at: 1, secret: true },
  { id: 'word-infinite', name: 'To infinity', text: 'The monkeys spelled INFINITE', stat: 'word:INFINITE', at: 1, secret: true },
];

/**
 * Hats, the only thing monkeys wear (Justin, 2026-10-14: hats are what
 * change how a monkey looks). Bought with Sentences in the Hats store for one
 * monkey at a time; a monkey keeps every hat it was given and wears one, and
 * changing hats is free. Each one of a kind costs costGrowth times the last,
 * across all monkeys. Hats come in price tiers, several hats to a tier, with
 * two absurdly expensive ones at the top. Effects, for the monkey wearing it:
 * points (its words and lines pay this much more), speed (types faster), drain
 * (tires slower), rest (breaks go faster), combo (its combo cap is this much
 * higher). The icon is the hat's ASCII character, worn on the monkey's icon
 * (#@ for a top hat). Numbers are placeholders.
 */
export interface Hat {
  id: string;
  name: string;
  icon: string; // one ASCII character, worn left of the monkey's face
  cost: number;
  costGrowth: number;
  points?: number;
  speed?: number;
  drain?: number;
  rest?: number;
  combo?: number;
}

/** A monkey's face in its icon; a hat goes on its left. All icons are ASCII. */
export const monkeyIcon = '@';

export const hats: Hat[] = [
  { id: 'baseball', name: 'Baseball cap', icon: 'd', cost: 25, costGrowth: 1.5, drain: 0.1 },
  { id: 'beanie', name: 'Beanie', icon: 'n', cost: 25, costGrowth: 1.5, rest: 0.2 },
  { id: 'party', name: 'Party hat', icon: 'A', cost: 25, costGrowth: 1.5, speed: 0.05 },
  { id: 'tophat', name: 'Top hat', icon: '#', cost: 500, costGrowth: 1.5, points: 0.15 },
  { id: 'cowboy', name: 'Cowboy hat', icon: '~', cost: 500, costGrowth: 1.5, drain: 0.25 },
  { id: 'cap', name: 'Thinking cap', icon: '^', cost: 5_000, costGrowth: 2, combo: 1 },
  { id: 'crown', name: 'Crown', icon: 'W', cost: 1_000_000, costGrowth: 3, points: 0.25, speed: 0.25 },
  { id: 'halo', name: 'Halo', icon: 'o', cost: 1_000_000_000, costGrowth: 10, points: 0.5, speed: 0.5, drain: 0.5 },
];

/**
 * Dyes for hats: any monkey's hat can be dyed one of these colours (ANSI
 * codes, so any terminal shows them), for dyeCost Sentences. Just for looks.
 */
export const hatColors = [
  { id: 'red', name: 'Red', ansi: 31 },
  { id: 'green', name: 'Green', ansi: 32 },
  { id: 'yellow', name: 'Yellow', ansi: 33 },
  { id: 'blue', name: 'Blue', ansi: 34 },
  { id: 'magenta', name: 'Magenta', ansi: 35 },
  { id: 'cyan', name: 'Cyan', ansi: 36 },
];
export const dyeCost = 10;

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

/** Letters per typewriter line until a front end sets its own (the terminal sets it to reach the screen's edge). */
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

/**
 * At most this many letters a second are simulated one by one while playing,
 * shared across all monkeys. Faster typing than that is credited by scaling
 * up the points and words of the letters that were simulated (as offline
 * progress does), so huge speeds don't slow the game down.
 */
export const maxSimulatedLettersPerSecond = 4000;
