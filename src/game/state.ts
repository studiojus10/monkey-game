import { maxMonkeyNameLength, monkeyNames, parodyNames, office as officeRules } from './config';

/** A piece of a monkey's current line: a scored word or a skipped letter. */
export interface Segment {
  text: string;
  scored: boolean;
}

export interface MonkeyState {
  name: string; // player-given name; empty shows as M-<number>
  department: string; // genre of the department it works in; empty = the first department
  manager: boolean; // a manager doesn't type; it picks its department's target line, pins it and fills word slots
  target: Pin | null; // a manager's current target line
  managerLevel: number; // manager upgrades bought; each raises its department's points
  pending: string; // letters that might still become a word
  line: Segment[]; // what's on the current typewriter line, for display
  progress: number; // fraction of the next letter typed so far
  chainWords: string[]; // the words that build the combo in the current chain (back-to-back words)
  chainPoints: number; // sum of the chain's word points, before the multiplier
  chainRecent: string[]; // the chain's latest words, enough to hold the longest play line
  chainLength: number; // words in the current chain, for word slots
  chainCounted: number; // words in the current chain long enough to count towards a Sentence
  chainAll: string[]; // every word of the chain so far, for the longest-sentence record (up to sentenceRules.maxRecordWords)
  skill: number; // typing skill level: "Faster typing" bought for this monkey
  typewriter: number; // typewriter tier, 0 = the first; caps skill at (tier + 1) x levelsPerTypewriter
  energy: number; // 1 = rested, 0 = worn out; a tired monkey types slower
  resting: boolean; // on a break until its energy is back to full
  hats: string[]; // ids of the hats it was given (it keeps them all)
  hat: string; // the hat it wears, '' for none
  hatColor: string; // its hat's dye (a hatColors id), '' for undyed
  petHappiness: number; // happiness from petting (0.01 = 1%), wearing off
  trait: string; // a traits id, picked when it joins ('' until then); hidden until the manager's book is read
  speedStat: number; // hidden stat: typing speed x this (0 until picked when it joins); shown once HR is built
  stamina: number; // hidden stat: energy lasts x this (0 until picked)
  tempLeft: number; // a temp's seconds left before it leaves (0: not a temp)
  number: number; // its M-number, kept for good (0: not given yet; then it goes by its place in the list)
  jobs: Record<string, string>; // hidden: its feeling (monkeyStats.feelings id) about each job id; empty until picked
}

/**
 * A word slot: the word at `position` in a chain (1 = first) is always
 * `word` while on, for the monkeys of its department.
 */
export interface WordSlot {
  department: string; // genre of its department; empty = the first department
  position: number;
  word: string; // empty until the player sets one
  on: boolean;
}

/** The most recent play line a monkey typed, for display. */
export interface LastLine {
  play: string;
  index: number;
  firstTime: boolean;
  points: number; // bonus paid (first time only)
  sentence: boolean; // whether it paid a Sentence
}

/** The most recent scene, act or play finished, for display. */
export interface Milestone {
  kind: 'scene' | 'act' | 'play' | 'sonnet';
  play: string;
  act: number;
  scene: number;
  sentences: number; // Sentences paid (scenes)
  bonus: number; // points bonus (scenes) or typing speed bonus (acts) it added, e.g. 0.2 = +20%; Lines paid (sonnets)
}

/**
 * A room of the office: a department's room (its monkeys' desks go here) or a
 * break room. Its squares are [x, y] cells on its own grid; any shape.
 */
export interface Room {
  id: string;
  kind: 'department' | 'break' | 'office' | 'lab' | 'hr' | 'marketing'; // an office is a department's manager's office; the lab is R&D's; hr is HR's office; marketing is Marketing's
  department: string; // genre of a department room; empty = the first department
  cells: [number, number][];
}

export type Side = 'n' | 'e' | 's' | 'w';

/** A door in the wall on one side of a room's square, into a hallway or another room. */
export interface Door {
  x: number;
  y: number;
  side: Side;
}

/** A piece of furniture standing on one square of a room. Desks are furniture too. */
export interface Furniture {
  kind: string; // 'desk' or a furnitureKinds id
  room: string; // a Room id
  x: number;
  y: number;
  turned?: boolean; // a piece bigger than one square, turned a quarter turn (its width and height swap)
}

/** A line pinned to the home screen. */
export interface Pin {
  play: string;
  index: number;
}

/** Recent words and sentences for the home screen's LATELY feed; times are stats.secondsTyping. */
export interface Lately {
  longWord: string; // the longest word lately
  longWordAt: number;
  lastSentence: string[]; // the words of the newest sentence (a chain that paid a Sentence)
  longSentence: string[]; // the longest sentence lately
  longSentenceAt: number;
}

export function createLately(): Lately {
  return { longWord: '', longWordAt: 0, lastSentence: [], longSentence: [], longSentenceAt: 0 };
}

export interface GameState {
  currency: number;
  totalEarned: number;
  sentences: number; // currency: every time a play line (3+ words) is typed
  lines: number; // currency: first completion of each play line
  words: number; // currency: one for each different word ever spelled (each new dictionary entry)
  office: Room[]; // rooms, in the order bought, on one grid; the first is where you start (the entrance)
  halls: [number, number][]; // hallway squares
  doors: Door[];
  windows: Door[]; // windows, each in a wall on one side of a room's square that faces outside
  fengShuiBook: boolean; // read the feng shui book (found in a bookshelf): chi counts, and the office map shows it
  managerBook: boolean; // read the book in a manager's desk: monkeys' traits show
  researchOpen: boolean; // R&D is open
  researching: string; // the project under way ('' for none)
  researchProgress: number; // researcher-seconds of work done on it
  researched: string[]; // finished projects
  researchersHired: number; // researchers hired, for their price
  candidates: Candidate[]; // monkeys HR could hire now (see hr in config.ts)
  stored: { furniture: Record<string, number>; hats: Record<string, number> }; // put away: furniture off the map, hats of fired monkeys; used again for free
  candidatesIn: number; // seconds until HR draws a new list of candidates (0: at the next tick)
  squaresBought: number; // squares added to rooms, which raises the price of the next
  furniture: Furniture[]; // pieces bought, where they stand
  departments: string[]; // genres with a department, in the order opened: the first at the start, more as monkeys grow
  owned: string[]; // script bought: "play", "play:act" or "play:act.scene"; empty until the free starter scene
  completed: Record<string, number[]>; // play id -> completed line indices
  scenesDone: string[]; // finished scenes as "play:act.scene"
  actsDone: string[]; // finished acts as "play:act"
  playsDone: string[]; // finished play ids
  lastMilestone: Milestone | null;
  pointsBonus: number; // from finished scenes: points x (1 + pointsBonus)
  speedBonus: number; // from finished acts: typing speed x (1 + speedBonus)
  pinned: Pin[]; // lines pinned to the home screen
  lastLine: LastLine | null;
  comboStartLevel: number; // starting-combo upgrades bought
  keys: string[]; // combination and word keys bought
  slots: WordSlot[];
  letters: string[]; // owned letters; empty until the player picks one
  monkeys: MonkeyState[];
  monkeysBought: Record<string, number>; // monkeys bought per department ('' before the first opens), for its price
  unassignedMonkeys: number; // earned monkeys waiting for the player to pick their department
  wordsTyped: number;
  lastWord: string; // most recent scored word, for display
  lastWordPoints: number; // what it paid, combo included
  lately: Lately;
  settings: Settings;
  stats: Stats;
  achievements: string[]; // ids of achievements unlocked, in order
  folios: number; // Folios published (prestige resets)
  folioPages: number; // pages banked by every Folio published (Marketing's royalties count them)
  freeLetters: number; // letters you can take for free (letterGifts)
  letterGifts: string[]; // achievements whose free letter (letterGifts) has been given; kept by Folios
  folioBoost: number; // bananas x this for good: every Folio's (1 + its pages x folio.bonusPerPage), multiplied together
  lastSaved: number; // epoch ms
}

/** Player options, from the options menu. */
export interface Settings {
  autoPlaceFurniture: boolean; // new furniture places itself; off opens the office map to place it
  lightBackground: boolean; // colours for a terminal with a light background (darker yellow, cyan and green)
  scientific: boolean; // big numbers as 1.23e45 instead of short names
  screenAtTop: boolean; // the game sits at the top of the terminal; off (the default) keeps it at the bottom
  homeDepartment: string; // the department whose monkeys the home screen shows ('' or a closed one: the first)
}

export function createSettings(): Settings {
  return { autoPlaceFurniture: true, lightBackground: false, homeDepartment: '', scientific: false, screenAtTop: false };
}

/** Lifetime statistics, for the statistics page. They never affect play. */
/** Someone HR could hire: a monkey's trait and hidden stats, before it joins. */
export interface Candidate {
  trait: string;
  speedStat: number;
  stamina: number;
  jobs: Record<string, string>;
  tempLeft: number; // a temp's working time in seconds (0: not a temp)
}

export interface Stats {
  letters: Record<string, number>; // letter -> times typed
  words: Record<string, number>; // word -> times spelled
  longestWord: string;
  bestWord: string; // the single word that paid the most points
  bestWordPoints: number;
  longestChain: number; // most words in one unbroken chain
  linesTyped: number; // play lines typed, repeats included
  longestLine: Pin | null; // the longest play line written (by letters)
  bestLinePoints: number; // the biggest first-time line payout
  pets: number; // times the player petted a monkey
  chainSentences: number; // Sentences paid by long chains
  sentencesWritten: number; // chains long enough to pay a Sentence
  longestSentence: string[]; // the words of the longest chain that paid a Sentence
  secondsTyping: number; // time the monkeys have been at work, offline included
  secondsOpen: number; // time with the game open
  secondsAway: number; // time the game was closed and the monkeys kept typing in the background
  dyes: number; // hats dyed
  flipsWon: number; // coin flips won (all bananas doubled)
  flipsLost: number; // coin flips lost (all bananas gone)
  renamed: number; // monkeys the player renamed (they all start with a name of their own)
}

export function createStats(): Stats {
  return { letters: {}, words: {}, longestWord: '', bestWord: '', bestWordPoints: 0, longestChain: 0, linesTyped: 0, longestLine: null, bestLinePoints: 0, pets: 0, chainSentences: 0, sentencesWritten: 0, longestSentence: [], secondsTyping: 0, secondsOpen: 0, secondsAway: 0, dyes: 0, flipsWon: 0, flipsLost: 0, renamed: 0 };
}

export function createMonkey(): MonkeyState {
  return { name: '', department: '', manager: false, target: null, managerLevel: 0, pending: '', line: [], progress: 0, chainWords: [], chainPoints: 0, chainRecent: [], chainLength: 0, chainCounted: 0, chainAll: [], skill: 0, typewriter: 0, energy: 1, resting: false, hats: [], hat: '', hatColor: '', petHappiness: 0, trait: '', speedStat: 0, stamina: 0, jobs: {}, tempLeft: 0, number: 0 };
}

/** A name with the sounds before each word's first vowel swapped for `onset` (King Kong -> Bing Bong); words without a vowel stay. */
export function parodyOf(name: string, onset: string): string {
  return name.replace(/[A-Za-z]+/g, (word) => {
    const start = word.search(/[aeiouAEIOU]/);
    if (start < 0 || (start === 0 && word.length <= 1)) return word;
    const rest = word.slice(start).toLowerCase();
    return word[0] === word[0].toUpperCase() ? onset + rest : onset.toLowerCase() + rest;
  });
}

/** Every parody of every famous monkey name (see parodyNames in config.ts), none the same as a real one. */
export function monkeyParodies(): string[] {
  const real = new Set(monkeyNames);
  const all = monkeyNames.flatMap((n) => parodyNames.onsets.map((o) => parodyOf(n, o)));
  return [...new Set(all)].filter((n) => !real.has(n));
}

/**
 * A name for a new monkey that nobody in `taken` has, picked by its M-number
 * so it looks random but stays put: one of monkeyNames, or with
 * parodyNames.chance (and always once the real names are all in use) a
 * parody of one (with " II", " III" and so on once even those run out).
 */
export function monkeyNameFor(number: number, taken: string[]): string {
  if (monkeyNames.length === 0) return '';
  const pick = (list: string[]) => list[(number * 7919) % list.length];
  const free = (list: string[]) => list.filter((n) => n.length <= maxMonkeyNameLength && !taken.includes(n));
  const parody = ((number * 2654435761) >>> 0) % 1000 < parodyNames.chance * 1000;
  const real = free(monkeyNames);
  if (!parody && real.length > 0) return pick(real);
  const parodies = free(monkeyParodies());
  if (parodies.length > 0) return pick(parodies);
  if (real.length > 0) return pick(real);
  for (let round = 2; ; round++) {
    const suffix = round <= 3 ? ` ${'I'.repeat(round)}` : ` ${round}`;
    const more = free(monkeyNames.map((n) => n + suffix));
    if (more.length > 0) return pick(more);
  }
}

/** A rectangle of squares from (0, 0). */
export function rectangle(width: number, height: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push([x, y]);
  return cells;
}

/** The room you start in: the first department's. */
export function starterRoom(): Room {
  return { id: 'r1', kind: 'department', department: '', cells: rectangle(officeRules.starterWidth, officeRules.starterHeight) };
}

export function createInitialState(now = Date.now()): GameState {
  return {
    currency: 0,
    totalEarned: 0,
    sentences: 0,
    lines: 0,
    words: 0,
    office: [starterRoom()],
    halls: [],
    doors: [],
    windows: [{ x: 1, y: 0, side: 'e' }],
    fengShuiBook: false,
    managerBook: false,
    researchOpen: false,
    researching: '',
    researchProgress: 0,
    researched: [],
    researchersHired: 0,
    candidates: [],
    stored: { furniture: {}, hats: {} },
    candidatesIn: 0,
    squaresBought: 0,
    furniture: [{ kind: 'desk', room: 'r1', x: 0, y: 0 }],
    departments: [],
    owned: [],
    completed: {},
    scenesDone: [],
    actsDone: [],
    playsDone: [],
    lastMilestone: null,
    pointsBonus: 0,
    speedBonus: 0,
    pinned: [],
    lastLine: null,
    comboStartLevel: 0,
    keys: [],
    slots: [],
    letters: [],
    monkeys: [{ ...createMonkey(), number: 1, name: monkeyNameFor(1, []) }],
    monkeysBought: {},
    unassignedMonkeys: 0,
    wordsTyped: 0,
    lastWord: '',
    lastWordPoints: 0,
    lately: createLately(),
    settings: createSettings(),
    stats: createStats(),
    achievements: [],
    folios: 0,
    folioPages: 0,
    freeLetters: 0,
    letterGifts: [],
    folioBoost: 1,
    lastSaved: now,
  };
}
