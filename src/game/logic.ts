import {
  combo,
  extraWords,
  lineRewards,
  letterShop,
  lineWidth,
  maxOfflineLetters,
  maxMonkeyNameLength,
  maxPinnedLines,
  maxOfflineSeconds,
  monkeyShop,
  startingLetters,
  typewriterKeys,
  wordSlots,
  typing,
} from './config';
import { buildPlay, type Play, type PlayData } from './plays';
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

const plays = new Map<string, Play>();
let longestLine = 0;

/** Registers the plays the player can choose from; the front end loads them. */
export function setPlays(list: readonly PlayData[]): void {
  plays.clear();
  for (const data of list) plays.set(data.id, buildPlay(data));
  longestLine = Math.max(0, ...[...plays.values()].map((p) => p.longestLine));
  cached = undefined;
}

export function availablePlays(): Play[] {
  return [...plays.values()];
}

export function activePlay(state: GameState): Play | undefined {
  return plays.get(state.play);
}

/** Picks the starter play. Only allowed once. */
export function chooseStarterPlay(state: GameState, id: string): boolean {
  if (state.play || !plays.has(id)) return false;
  state.play = id;
  state.completed[id] ??= [];
  return true;
}

/** Pins or unpins a line of the active play. Returns false if the pin limit is reached. */
export function togglePin(state: GameState, index: number): boolean {
  const play = activePlay(state);
  if (!play || index < 0 || index >= play.lines.length) return false;
  const at = state.pinned.indexOf(index);
  if (at >= 0) {
    state.pinned.splice(at, 1);
    return true;
  }
  if (state.pinned.length >= maxPinnedLines) return false;
  state.pinned.push(index);
  return true;
}

/** Letters a line needs that you don't own yet. */
export function missingLetters(state: GameState, letters: string): string[] {
  return [...new Set(letters)].filter((c) => !state.letters.includes(c)).sort();
}

/** Unwritten lines of the active play you own every letter for, shortest first. */
export function reachableLines(state: GameState): number[] {
  const play = activePlay(state);
  if (!play) return [];
  const done = new Set(state.completed[play.id] ?? []);
  return play.lines
    .map((line, i) => ({ line, i }))
    .filter(({ line, i }) => !done.has(i) && missingLetters(state, line.letters).length === 0)
    .sort((a, b) => a.line.letters.length - b.line.letters.length || a.i - b.i)
    .map(({ i }) => i);
}

/**
 * The dictionary for the player's current letters (and play, whose words
 * always count), rebuilt only when they change.
 */
export function dictionaryFor(state: GameState): Dictionary {
  const key = [...state.letters].sort().join('') + '|' + state.play;
  if (cached?.key !== key) {
    const playWords = activePlay(state)?.words ?? [];
    cached = { key, dict: new Dictionary([...wordList, ...playWords], state.letters) };
  }
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

/** Cost in Lines of the next monkey, given how many you have. */
export function monkeyCost(owned: number): number {
  return Math.ceil(monkeyShop.baseCost * Math.pow(monkeyShop.costGrowth, Math.max(0, owned - 1)));
}

export function buyMonkey(state: GameState): boolean {
  const cost = monkeyCost(state.monkeys.length);
  if (state.letters.length === 0 || state.lines < cost) return false;
  state.lines -= cost;
  state.monkeys.push(createMonkey());
  return true;
}

/** Display name of a monkey: its given name, or M-<number>. */
export function monkeyName(state: GameState, index: number): string {
  return state.monkeys[index]?.name || `M-${index + 1}`;
}

/**
 * Names monkey `index`. Letters, digits, spaces, - and ' only, up to maxMonkeyNameLength;
 * an empty name goes back to M-<number>. Returns false if the name isn't allowed.
 */
export function renameMonkey(state: GameState, index: number, name: string): boolean {
  const m = state.monkeys[index];
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!m || clean.length > maxMonkeyNameLength || !/^[A-Za-z0-9 '-]*$/.test(clean)) return false;
  m.name = clean;
  return true;
}

/** Cost in Sentences of the next combo cap raise. */
export function capRaiseCost(level: number): number {
  return Math.ceil(combo.capRaiseBaseCost * Math.pow(combo.capRaiseCostGrowth, level));
}

export function comboCap(state: GameState): number {
  return combo.maxMultiplier + state.comboCapLevel;
}

export function buyCapRaise(state: GameState): boolean {
  const cost = capRaiseCost(state.comboCapLevel);
  if (state.letters.length === 0 || state.sentences < cost) return false;
  state.sentences -= cost;
  state.comboCapLevel++;
  return true;
}

function lineLength(m: MonkeyState): number {
  return m.line.reduce((n, s) => n + s.text.length, 0) + m.pending.length;
}

function addToLine(m: MonkeyState, segment: Segment): void {
  if (lineLength(m) + segment.text.length > lineWidth) m.line = [];
  m.line.push(segment);
}

export function keysUnlocked(state: GameState): boolean {
  return state.letters.length >= typewriterKeys.unlockLetters;
}

/** Points price of the next heavier-key level for a letter. */
export function heavierCost(state: GameState, letter: string): number {
  const level = state.heavy[letter] ?? 0;
  return Math.ceil(letterCost(state.letters.length) * typewriterKeys.heavierCostFactor * 2 ** level);
}

/** Makes a letter you own come up more often. */
export function buyHeavier(state: GameState, letter: string): boolean {
  const l = letter.toUpperCase();
  const cost = heavierCost(state, l);
  if (!keysUnlocked(state) || !state.letters.includes(l) || state.currency < cost) return false;
  state.currency -= cost;
  state.heavy[l] = (state.heavy[l] ?? 0) + 1;
  return true;
}

/** Points price of a combination or word key. */
export function keyCost(state: GameState, key: string): number {
  const factor = typewriterKeys.words.includes(key)
    ? typewriterKeys.wordCostFactor
    : typewriterKeys.combinationCostFactor;
  return Math.ceil(letterCost(state.letters.length) * factor);
}

/** Combination and word keys you could buy now: not owned, and spelled with your letters. */
export function availableKeys(state: GameState): string[] {
  if (!keysUnlocked(state)) return [];
  const usable = (list: string[]) =>
    list.filter((k) => !state.keys.includes(k) && [...k].every((c) => state.letters.includes(c)));
  // Alternate combinations and words so menus show both kinds.
  const combos = usable(typewriterKeys.combinations);
  const words = usable(typewriterKeys.words);
  return Array.from({ length: Math.max(combos.length, words.length) }, (_, i) => [combos[i], words[i]])
    .flat()
    .filter((k): k is string => k !== undefined);
}

export function buyKey(state: GameState, key: string): boolean {
  const cost = keyCost(state, key);
  if (!availableKeys(state).includes(key) || state.currency < cost) return false;
  state.currency -= cost;
  state.keys.push(key);
  return true;
}

/** Everything a monkey can hit, with weights: your letters (plus heavier levels) and your keys. */
export function keyboard(state: GameState): { text: string; weight: number }[] {
  return [
    ...state.letters.map((l) => ({ text: l, weight: 1 + (state.heavy[l] ?? 0) })),
    ...state.keys.map((k) => ({ text: k, weight: 1 })),
  ];
}

function pressKey(state: GameState, rng: Rng): string {
  const keys = keyboard(state);
  let r = rng() * keys.reduce((n, k) => n + k.weight, 0);
  for (const k of keys) {
    r -= k.weight;
    if (r < 0) return k.text;
  }
  return keys[keys.length - 1].text;
}

export function slotsUnlocked(state: GameState): boolean {
  return state.letters.length >= wordSlots.unlockLetters;
}

/** Cost in Lines of the next word slot, given how many you have. */
export function slotCost(owned: number): number {
  return Math.ceil(wordSlots.baseCost * Math.pow(wordSlots.costGrowth, owned));
}

/** Buys a slot at the first free position. It starts on, with no word set. */
export function buySlot(state: GameState): boolean {
  const cost = slotCost(state.slots.length);
  if (!slotsUnlocked(state) || state.slots.length >= wordSlots.maxSlots || state.lines < cost) return false;
  let position = 1;
  while (state.slots.some((x) => x.position === position)) position++;
  state.lines -= cost;
  state.slots.push({ position, word: '', on: true });
  return true;
}

/** Sets a slot's word. It must be a word you can spell with your letters. Free, any time. */
export function setSlotWord(state: GameState, slot: number, word: string): boolean {
  const s = state.slots[slot];
  const w = word.toUpperCase();
  if (!s || !dictionaryFor(state).isWord(w)) return false;
  s.word = w;
  return true;
}

export function toggleSlot(state: GameState, slot: number): boolean {
  const s = state.slots[slot];
  if (!s) return false;
  s.on = !s.on;
  return true;
}

/** Moves a slot to another position, skipping positions other slots hold. */
export function moveSlot(state: GameState, slot: number, delta: 1 | -1): boolean {
  const s = state.slots[slot];
  if (!s) return false;
  let p = s.position + delta;
  while (p >= 1 && state.slots.some((x) => x !== s && x.position === p)) p += delta;
  if (p < 1 || p > wordSlots.maxSlots + state.slots.length) return false;
  s.position = p;
  return true;
}

/**
 * The slot due for this monkey's next word, if any. Slots apply at a word
 * break; if the letters waiting are already a word, they count as the
 * previous word so the slot can follow them.
 */
function dueSlot(state: GameState, m: MonkeyState, dict: Dictionary): string {
  const ready = m.pending === '' ? 0 : dict.isWord(m.pending) ? 1 : -1;
  if (ready < 0) return '';
  const s = state.slots.find((x) => x.on && x.word && x.position === m.chainLength + ready + 1);
  return s && dict.isWord(s.word) ? s.word : '';
}

/**
 * One monkey presses one key. If a word slot is due, it types the slot's word
 * as a finished word (it can't run into the next letters); otherwise it
 * presses a random key (usually a letter, or a combination or word key).
 */
export function typeLetter(state: GameState, index: number, rng: Rng = Math.random): void {
  const m = state.monkeys[index];
  if (!m || state.letters.length === 0) return;
  const dict = dictionaryFor(state);
  const events: ReadEvent[] = [];
  const slot = dueSlot(state, m, dict);
  if (slot) {
    if (m.pending) events.push({ kind: 'word', text: m.pending });
    events.push({ kind: 'word', text: slot });
    m.pending = '';
  } else {
    for (const letter of pressKey(state, rng)) m.pending = readLetter(dict, m.pending, letter, events);
  }
  for (const e of events) {
    if (e.kind === 'word') {
      const paid = scoreInChain(state, m, e.text);
      earn(state, paid);
      state.wordsTyped++;
      state.lastWord = e.text;
      state.lastWordPoints = paid;
      checkPlayLines(state, m);
    } else {
      m.chainWords = [];
      m.chainPoints = 0;
      m.chainRecent = [];
      m.chainLength = 0;
    }
    addToLine(m, { text: e.text, scored: e.kind === 'word' });
  }
}

/** The combo multiplier: how many different long words are in the chain, up to the cap. */
export function comboMultiplier(state: GameState, m: MonkeyState): number {
  return Math.min(comboCap(state), Math.max(1, m.chainWords.length));
}

/**
 * Adds a word to the monkey's chain and returns what it pays: whatever
 * brings the chain's total up to (sum of its word points) x multiplier.
 * Short or repeated words join the chain but don't raise the multiplier.
 */
function scoreInChain(state: GameState, m: MonkeyState, word: string): number {
  const before = m.chainPoints * comboMultiplier(state, m);
  if (word.length >= combo.minWordLength && !m.chainWords.includes(word)) m.chainWords.push(word);
  m.chainPoints += wordPoints(word);
  m.chainLength++;
  m.chainRecent.push(word);
  let kept = m.chainRecent.reduce((n, w) => n + w.length, 0);
  while (m.chainRecent.length > 1 && kept - m.chainRecent[0].length >= longestLine) {
    kept -= m.chainRecent.shift()!.length;
  }
  return m.chainPoints * comboMultiplier(state, m) - before;
}

/**
 * After a word lands, checks whether the chain now ends with a line of the
 * play. Lines match on letters, starting and ending at word breaks, so the
 * exact split into words doesn't matter.
 */
function checkPlayLines(state: GameState, m: MonkeyState): void {
  const play = activePlay(state);
  if (!play) return;
  let letters = '';
  for (let k = m.chainRecent.length - 1; k >= 0; k--) {
    letters = m.chainRecent[k] + letters;
    const indices = play.byLetters.get(letters);
    if (indices) typedLine(state, play, indices);
  }
}

/** Rewards typing a line: a Sentence every time; a Line and a bonus the first time. */
function typedLine(state: GameState, play: Play, indices: number[]): void {
  const done = (state.completed[play.id] ??= []);
  const fresh = indices.find((i) => !done.includes(i));
  const line = play.lines[fresh ?? indices[0]];
  const sentence = line.words.length >= lineRewards.sentenceMinWords;
  if (sentence) state.sentences++;
  let points = 0;
  if (fresh !== undefined) {
    done.push(fresh);
    state.lines++;
    points = line.points * line.words.length ** 2;
    earn(state, points);
  }
  state.lastLine = { play: play.id, index: fresh ?? indices[0], firstTime: fresh !== undefined, points, sentence };
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
