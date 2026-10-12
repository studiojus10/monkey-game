import {
  extraWords,
  letterShop,
  lineWidth,
  maxOfflineLetters,
  maxOfflineSeconds,
  monkeyShop,
  startingLetters,
  typing,
} from './config';
import { createMonkey, type GameState, type MonkeyState, type Segment } from './state';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from './words';

/** Random number source in [0, 1); injectable so tests are deterministic. */
export type Rng = () => number;

let wordList: readonly string[] = extraWords;
let cached: { key: string; dict: Dictionary } | undefined;

/**
 * Sets the words that can score. The front end loads the word list and hands
 * it over here, so the game logic never touches the file system.
 */
export function setWordList(list: readonly string[]): void {
  wordList = [...list, ...extraWords];
  cached = undefined;
}

/** The dictionary for the player's current letters, rebuilt only when they change. */
export function dictionaryFor(state: GameState): Dictionary {
  const key = [...state.letters].sort().join('');
  if (cached?.key !== key) cached = { key, dict: new Dictionary(wordList, state.letters) };
  return cached.dict;
}

function earn(state: GameState, amount: number): void {
  state.currency += amount;
  state.totalEarned += amount;
}

/** Sets the player's first letter. Only allowed once, and only for a starting letter. */
export function chooseFirstLetter(state: GameState, letter: string): boolean {
  const l = letter.toUpperCase();
  if (state.letters.length > 0 || !startingLetters.includes(l)) return false;
  state.letters.push(l);
  return true;
}

/** Cost of the next letter, given how many you own. */
export function letterCost(owned: number): number {
  return Math.ceil(letterShop.baseCost * Math.pow(letterShop.costGrowth, Math.max(0, owned - 1)));
}

/** Buys a letter you don't own yet. */
export function buyLetter(state: GameState, letter: string): boolean {
  const l = letter.toUpperCase();
  const cost = letterCost(state.letters.length);
  if (state.letters.length === 0 || !/^[A-Z]$/.test(l) || state.letters.includes(l)) return false;
  if (state.currency < cost) return false;
  state.currency -= cost;
  state.letters.push(l);
  return true;
}

/** Cost of the next monkey, given how many you have. */
export function monkeyCost(owned: number): number {
  return Math.ceil(monkeyShop.baseCost * Math.pow(monkeyShop.costGrowth, Math.max(0, owned - 1)));
}

export function monkeysUnlocked(state: GameState): boolean {
  return state.letters.length >= monkeyShop.unlockLetters;
}

export function buyMonkey(state: GameState): boolean {
  const cost = monkeyCost(state.monkeys.length);
  if (!monkeysUnlocked(state) || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeys.push(createMonkey());
  return true;
}

function lineLength(m: MonkeyState): number {
  return m.line.reduce((n, s) => n + s.text.length, 0) + m.pending.length;
}

function addToLine(m: MonkeyState, segment: Segment): void {
  if (lineLength(m) + segment.text.length > lineWidth) m.line = [];
  m.line.push(segment);
}

/** One monkey types one random letter from the player's letters. */
export function typeLetter(state: GameState, index: number, rng: Rng = Math.random): void {
  const m = state.monkeys[index];
  if (!m || state.letters.length === 0) return;
  const letter = state.letters[Math.floor(rng() * state.letters.length)];
  const events: ReadEvent[] = [];
  m.pending = readLetter(dictionaryFor(state), m.pending, letter, events);
  for (const e of events) {
    if (e.kind === 'word') {
      earn(state, wordPoints(e.text));
      state.wordsTyped++;
      state.lastWord = e.text;
    }
    addToLine(m, { text: e.text, scored: e.kind === 'word' });
  }
}

/** The player pokes the first monkey into typing one extra letter. */
export function poke(state: GameState, rng: Rng = Math.random): void {
  typeLetter(state, 0, rng);
}

/** Letters per second for each monkey at a given "Faster typing" level. */
export function lettersPerSecond(level: number): number {
  return typing.baseLettersPerSecond * Math.pow(typing.speedPerLevel, level);
}

export function typingUpgradeCost(level: number): number {
  return Math.ceil(typing.upgradeBaseCost * Math.pow(typing.upgradeCostGrowth, level));
}

/** Buys one level of "Faster typing". */
export function buyFasterTyping(state: GameState): boolean {
  const cost = typingUpgradeCost(state.typingLevel);
  if (state.letters.length === 0 || state.currency < cost) return false;
  state.currency -= cost;
  state.typingLevel++;
  return true;
}

export function tick(state: GameState, seconds: number, rng: Rng = Math.random): void {
  if (seconds <= 0 || state.letters.length === 0) return;
  state.monkeys.forEach((m, i) => {
    m.progress += lettersPerSecond(state.typingLevel) * seconds;
    while (m.progress >= 1) {
      m.progress -= 1;
      typeLetter(state, i, rng);
    }
  });
}

/**
 * Credits typing for time spent away. Returns the points earned. Long
 * absences with many monkeys simulate only the first maxOfflineLetters
 * letters and scale up the points and words from those.
 */
export function applyOfflineProgress(state: GameState, now: number, rng: Rng = Math.random): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSaved) / 1000), maxOfflineSeconds);
  const letters = seconds * lettersPerSecond(state.typingLevel) * state.monkeys.length;
  const simulated = Math.min(1, maxOfflineLetters / Math.max(letters, 1));
  const before = state.currency;
  const wordsBefore = state.wordsTyped;
  tick(state, seconds * simulated, rng);
  const scale = 1 / simulated - 1;
  if (scale > 0) {
    earn(state, (state.currency - before) * scale);
    state.wordsTyped += Math.round((state.wordsTyped - wordsBefore) * scale);
  }
  return state.currency - before;
}
