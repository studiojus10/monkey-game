import { createInitialState, type GameState } from './state';

export const SAVE_KEY = 'idle-game-save';
const SAVE_VERSION = 1;

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
    const file = JSON.parse(raw) as { state?: Partial<GameState> };
    const s: Partial<GameState> = file.state ?? {};
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return {
      currency: num(s.currency, fresh.currency),
      totalEarned: num(s.totalEarned, fresh.totalEarned),
      generators: s.generators && typeof s.generators === 'object' ? { ...s.generators } : {},
      upgrades: Array.isArray(s.upgrades) ? [...s.upgrades] : [],
      lastSaved: num(s.lastSaved, now),
    };
  } catch {
    return fresh;
  }
}

export function save(state: GameState, storage: Storage = localStorage, now = Date.now()): void {
  state.lastSaved = now;
  storage.setItem(SAVE_KEY, serialize(state));
}

export function load(storage: Storage = localStorage, now = Date.now()): GameState {
  return deserialize(storage.getItem(SAVE_KEY), now);
}

export function wipe(storage: Storage = localStorage): void {
  storage.removeItem(SAVE_KEY);
}
