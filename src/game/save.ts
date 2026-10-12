import { createInitialState, createMonkey, type GameState, type MonkeyState } from './state';

// Version 1 was the placeholder game before Infinite Monkeys; those saves start fresh.
const SAVE_VERSION = 2;

interface SaveFile {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const file: SaveFile = { version: SAVE_VERSION, state };
  return JSON.stringify(file);
}

/** Parses a save, falling back to defaults for missing or corrupt fields. */
export function deserialize(raw: string | null, now = Date.now()): GameState {
  const fresh = createInitialState(now);
  if (!raw) return fresh;
  try {
    const file = JSON.parse(raw) as { version?: number; state?: Partial<GameState> };
    if (file.version !== SAVE_VERSION) return fresh;
    const s: Partial<GameState> = file.state ?? {};
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const monkey = (m: Partial<MonkeyState>): MonkeyState => ({
      pending: str(m?.pending),
      line: Array.isArray(m?.line)
        ? m.line
            .filter((seg) => typeof seg?.text === 'string')
            .map((seg) => ({ text: seg.text, scored: !!seg.scored }))
        : [],
      progress: num(m?.progress, 0),
      chainWords: Array.isArray(m?.chainWords)
        ? m.chainWords.filter((w): w is string => typeof w === 'string')
        : [],
      chainPoints: num(m?.chainPoints, 0),
    });
    const monkeys = Array.isArray(s.monkeys) ? s.monkeys.map(monkey) : [];
    return {
      currency: num(s.currency, fresh.currency),
      totalEarned: num(s.totalEarned, fresh.totalEarned),
      letters: Array.isArray(s.letters)
        ? s.letters.filter((l) => typeof l === 'string' && /^[A-Z]$/.test(l))
        : [],
      monkeys: monkeys.length > 0 ? monkeys : [createMonkey()],
      typingLevel: Math.max(0, Math.floor(num(s.typingLevel, 0))),
      wordsTyped: num(s.wordsTyped, 0),
      lastWord: str(s.lastWord),
      lastWordPoints: num(s.lastWordPoints, 0),
      lastSaved: num(s.lastSaved, now),
    };
  } catch {
    return fresh;
  }
}

/** Where a save lives. The terminal uses a file; a browser front end could use localStorage. */
export interface SaveStorage {
  read(): string | null;
  write(data: string): void;
  clear(): void;
}

export function save(state: GameState, storage: SaveStorage, now = Date.now()): void {
  state.lastSaved = now;
  storage.write(serialize(state));
}

export function load(storage: SaveStorage, now = Date.now()): GameState {
  return deserialize(storage.read(), now);
}
