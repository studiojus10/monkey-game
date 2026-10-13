import { desk, furnitureKinds, typing } from './config';
import { furnishOffice } from './logic';
import { createInitialState, createMonkey, type GameState, type MonkeyState, type Pin, type Room, type Stats } from './state';

// Version 1 was the placeholder game before Infinite Monkeys; those saves start fresh.
// Version 2 had one chosen play (`play`) and pins as line numbers in it; it
// loads as owning that whole play.
const SAVE_VERSION = 3;

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
    const file = JSON.parse(raw) as { version?: number; state?: Partial<GameState> & { play?: unknown } };
    if (file.version !== SAVE_VERSION && file.version !== 2) return fresh;
    const s: Partial<GameState> & { play?: unknown } = file.state ?? {};
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string') : [];
    const oldTypingLevel = Math.max(0, Math.floor(num((s as { typingLevel?: unknown }).typingLevel, 0)));
    const monkey = (m: Partial<MonkeyState>): MonkeyState => ({
      name: str(m?.name),
      department: str(m?.department),
      manager: !!m?.manager,
      managerLevel: Math.max(0, Math.floor(num(m?.managerLevel, 0))),
      target:
        m?.target && typeof m.target.play === 'string' && Number.isInteger(m.target.index)
          ? { play: m.target.play, index: m.target.index }
          : null,
      pending: str(m?.pending),
      line: Array.isArray(m?.line)
        ? m.line
            .filter((seg) => typeof seg?.text === 'string')
            .map((seg) => ({ text: seg.text, scored: !!seg.scored }))
        : [],
      progress: num(m?.progress, 0),
      chainWords: strings(m?.chainWords),
      chainPoints: num(m?.chainPoints, 0),
      chainRecent: strings(m?.chainRecent),
      chainLength: Math.max(0, Math.floor(num(m?.chainLength, 0))),
      // Saves from before per-monkey skill had one shared "Faster typing" level: every monkey keeps it,
      // with the typewriter it needs.
      skill: Math.max(0, Math.floor(num(m?.skill, oldTypingLevel))),
      typewriter: Math.max(0, Math.floor(num(m?.typewriter, Math.max(0, Math.ceil(oldTypingLevel / typing.levelsPerTypewriter) - 1)))),
      energy: Math.min(1, Math.max(0, num(m?.energy, 1))),
      resting: !!m?.resting,
    });
    const isCell = (c: unknown): c is [number, number] => Array.isArray(c) && c.length === 2 && c.every((n) => Number.isInteger(n));
    const rooms: Room[] = (Array.isArray(s.office) ? (s.office as Partial<Room>[]) : [])
      .filter((r) => r && typeof r.id === 'string' && (r.kind === 'department' || r.kind === 'break') && Array.isArray(r.cells))
      .map((r) => ({ id: r.id!, kind: r.kind!, department: str(r.department), cells: r.cells!.filter(isCell).map(([x, y]) => [x, y] as [number, number]) }))
      .filter((r) => r.cells.length > 0);
    const completed: Record<string, number[]> = {};
    if (s.completed && typeof s.completed === 'object') {
      for (const [id, list] of Object.entries(s.completed)) {
        if (Array.isArray(list)) completed[id] = list.filter((i) => Number.isInteger(i) && i >= 0);
      }
    }
    const l = s.lastLine;
    const lastLine =
      l && typeof l.play === 'string' && Number.isInteger(l.index)
        ? { play: l.play, index: l.index, firstTime: !!l.firstTime, points: num(l.points, 0), sentence: !!l.sentence }
        : null;
    const monkeys = Array.isArray(s.monkeys) ? s.monkeys.map(monkey) : [];
    const ms = s.lastMilestone;
    const lastMilestone =
      ms && ['scene', 'act', 'play', 'sonnet'].includes(ms.kind) && typeof ms.play === 'string'
        ? {
            kind: ms.kind,
            play: ms.play,
            act: num(ms.act, 0),
            scene: num(ms.scene, 0),
            sentences: num(ms.sentences, 0),
            bonus: num(ms.bonus, 0),
          }
        : null;
    const counts = (v: unknown, key: RegExp) =>
      Object.fromEntries(
        Object.entries(v && typeof v === 'object' ? v : {}).filter(
          ([k, n]) => key.test(k) && typeof n === 'number' && Number.isInteger(n) && n > 0,
        ),
      ) as Record<string, number>;
    const st: Partial<Stats> = s.stats && typeof s.stats === 'object' ? s.stats : {};
    const ll = st.longestLine;
    const stats: Stats = {
      letters: counts(st.letters, /^[A-Z]$/),
      words: counts(st.words, /^[A-Z]+$/),
      longestWord: /^[A-Z]*$/.test(str(st.longestWord)) ? str(st.longestWord) : '',
      bestWord: /^[A-Z]*$/.test(str(st.bestWord)) ? str(st.bestWord) : '',
      bestWordPoints: Math.max(0, num(st.bestWordPoints, 0)),
      longestChain: Math.max(0, Math.floor(num(st.longestChain, 0))),
      linesTyped: Math.max(0, Math.floor(num(st.linesTyped, 0))),
      longestLine:
        ll && typeof ll.play === 'string' && Number.isInteger(ll.index) && ll.index >= 0
          ? { play: ll.play, index: ll.index }
          : null,
      bestLinePoints: Math.max(0, num(st.bestLinePoints, 0)),
      pets: Math.max(0, Math.floor(num(st.pets, 0))),
      secondsTyping: Math.max(0, num(st.secondsTyping, 0)),
    };
    const oldPlay = file.version === 2 ? str(s.play) : '';
    const pinned = (Array.isArray(s.pinned) ? (s.pinned as unknown[]) : [])
      .map((p) => (typeof p === 'number' ? { play: oldPlay, index: p } : (p as Pin)))
      .filter((p) => p && typeof p.play === 'string' && p.play && Number.isInteger(p.index) && p.index >= 0)
      .map((p) => ({ play: p.play, index: p.index }));
    const state: GameState = {
      currency: num(s.currency, fresh.currency),
      totalEarned: num(s.totalEarned, fresh.totalEarned),
      sentences: num(s.sentences, 0),
      lines: num(s.lines, 0),
      words: num(s.words, Object.keys(stats.words).length), // saves from before Words count what they've spelled
      office: rooms,
      squaresBought: Math.max(0, Math.floor(num(s.squaresBought, 0))),
      furniture: (Array.isArray(s.furniture) ? s.furniture : [])
        .filter((f) => f && (f.kind === desk.id || furnitureKinds.some((k) => k.id === f.kind)) && typeof f.room === 'string' && Number.isInteger(f.x) && Number.isInteger(f.y))
        .map((f) => ({ kind: f.kind, room: f.room, x: f.x, y: f.y })),
      departments: strings(s.departments).filter((g) => ['comedy', 'history', 'tragedy', 'sonnet'].includes(g)),
      owned: oldPlay ? [oldPlay] : strings(s.owned),
      completed,
      scenesDone: strings(s.scenesDone),
      actsDone: strings(s.actsDone),
      playsDone: strings(s.playsDone),
      lastMilestone,
      pointsBonus: Math.max(0, num(s.pointsBonus, 0)),
      speedBonus: Math.max(0, num(s.speedBonus, 0)),
      pinned,
      lastLine,
      comboCapLevel: Math.max(0, Math.floor(num(s.comboCapLevel, 0))),
      keys: strings(s.keys).filter((k) => /^[A-Z]+$/.test(k)),
      slots: Array.isArray(s.slots)
        ? s.slots
            .filter((x) => x && Number.isInteger(x.position) && x.position > 0)
            .map((x) => ({ department: str(x.department), position: x.position, word: /^[A-Z]*$/.test(str(x.word)) ? str(x.word) : '', on: !!x.on }))
        : [],
      letters: Array.isArray(s.letters)
        ? s.letters.filter((l) => typeof l === 'string' && /^[A-Z]$/.test(l))
        : [],
      monkeys: monkeys.length > 0 ? monkeys : [createMonkey()],
      unassignedMonkeys: Math.max(0, Math.floor(num(s.unassignedMonkeys, 0))),
      wordsTyped: num(s.wordsTyped, 0),
      lastWord: str(s.lastWord),
      lastWordPoints: num(s.lastWordPoints, 0),
      settings: { autoPlaceFurniture: s.settings?.autoPlaceFurniture !== false },
      stats,
      lastSaved: num(s.lastSaved, now),
    };
    // Saves from before rooms get an office that seats their monkeys.
    if (state.office.length === 0) furnishOffice(state);
    return state;
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
