import { lineWidth, maxOfflineSeconds, monkey, startingLetters, words } from './config';
import type { GameState, MonkeyState, Segment } from './state';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from './words';

/** Random number source in [0, 1); injectable so tests are deterministic. */
export type Rng = () => number;

let cached: { key: string; dict: Dictionary } | undefined;

/** The dictionary for the player's current letters, rebuilt only when they change. */
export function dictionaryFor(state: GameState): Dictionary {
  const key = [...state.letters].sort().join('');
  if (cached?.key !== key) cached = { key, dict: new Dictionary(words, state.letters) };
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

export function lettersPerSecond(): number {
  return monkey.lettersPerSecond;
}

export function tick(state: GameState, seconds: number, rng: Rng = Math.random): void {
  if (seconds <= 0 || state.letters.length === 0) return;
  state.monkeys.forEach((m, i) => {
    m.progress += lettersPerSecond() * seconds;
    while (m.progress >= 1) {
      m.progress -= 1;
      typeLetter(state, i, rng);
    }
  });
}

/** Credits typing for time spent away. Returns the points earned. */
export function applyOfflineProgress(state: GameState, now: number, rng: Rng = Math.random): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSaved) / 1000), maxOfflineSeconds);
  const before = state.currency;
  tick(state, seconds, rng);
  return state.currency - before;
}
