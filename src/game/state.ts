/** A piece of a monkey's current line: a scored word or a skipped letter. */
export interface Segment {
  text: string;
  scored: boolean;
}

export interface MonkeyState {
  pending: string; // letters that might still become a word
  line: Segment[]; // what's on the current typewriter line, for display
  progress: number; // fraction of the next letter typed so far
}

export interface GameState {
  currency: number;
  totalEarned: number;
  letters: string[]; // owned letters; empty until the player picks one
  monkeys: MonkeyState[];
  wordsTyped: number;
  lastWord: string; // most recent scored word, for display
  lastSaved: number; // epoch ms
}

export function createMonkey(): MonkeyState {
  return { pending: '', line: [], progress: 0 };
}

export function createInitialState(now = Date.now()): GameState {
  return {
    currency: 0,
    totalEarned: 0,
    letters: [],
    monkeys: [createMonkey()],
    wordsTyped: 0,
    lastWord: '',
    lastSaved: now,
  };
}
