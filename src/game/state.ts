/** A piece of a monkey's current line: a scored word or a skipped letter. */
export interface Segment {
  text: string;
  scored: boolean;
}

export interface MonkeyState {
  name: string; // player-given name; empty shows as M-<number>
  department: string; // genre of the department it works in; empty = the first department
  pending: string; // letters that might still become a word
  line: Segment[]; // what's on the current typewriter line, for display
  progress: number; // fraction of the next letter typed so far
  chainWords: string[]; // different long words in the current chain (back-to-back words)
  chainPoints: number; // sum of the chain's word points, before the multiplier
  chainRecent: string[]; // the chain's latest words, enough to hold the longest play line
  chainLength: number; // words in the current chain, for word slots
}

/** A word slot: the word at `position` in a chain (1 = first) is always `word` while on. */
export interface WordSlot {
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

/** A line pinned to the home screen. */
export interface Pin {
  play: string;
  index: number;
}

export interface GameState {
  currency: number;
  totalEarned: number;
  sentences: number; // currency: every time a play line (3+ words) is typed
  lines: number; // currency: first completion of each play line
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
  comboCapLevel: number; // combo cap raises bought
  heavy: Record<string, number>; // letter -> heavier-key level
  keys: string[]; // combination and word keys bought
  slots: WordSlot[];
  letters: string[]; // owned letters; empty until the player picks one
  monkeys: MonkeyState[];
  typingLevel: number; // "Faster typing" upgrades bought
  wordsTyped: number;
  lastWord: string; // most recent scored word, for display
  lastWordPoints: number; // what it paid, combo included
  lastSaved: number; // epoch ms
}

export function createMonkey(): MonkeyState {
  return { name: '', department: '', pending: '', line: [], progress: 0, chainWords: [], chainPoints: 0, chainRecent: [], chainLength: 0 };
}

export function createInitialState(now = Date.now()): GameState {
  return {
    currency: 0,
    totalEarned: 0,
    sentences: 0,
    lines: 0,
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
    comboCapLevel: 0,
    heavy: {},
    keys: [],
    slots: [],
    letters: [],
    monkeys: [createMonkey()],
    typingLevel: 0,
    wordsTyped: 0,
    lastWord: '',
    lastWordPoints: 0,
    lastSaved: now,
  };
}
