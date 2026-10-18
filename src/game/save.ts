import { desk, folio, furnitureKinds, hatColors, hats, hr, monkeyStats, petting, research, traits, typing } from './config';
import { furnishOffice } from './logic';
import { addWindow, layOutOffice, tidyDoors } from './layout';
import { monkeyNameFor, createInitialState, createMonkey, type Door, type GameState, type MonkeyState, type Pin, type Room, type SafeState, type TelegramState, type Stats } from './state';

import { GAME_VERSION } from '../version';

/**
 * The save format's version. Bump it when a field's meaning changes, and add
 * a migration below that turns a save of the old version into the new one.
 * (A new field only needs a fallback in deserialize.)
 * Version 1 was the placeholder game before Infinite Monkeys; those saves start fresh.
 * Version 2 had one chosen play (`play`) and pins as line numbers in it; it
 * loads as owning that whole play.
 */
export const SAVE_VERSION = 4;

interface SaveFile {
  version: number; // the save format (SAVE_VERSION)
  gameVersion: string; // the game that wrote it (GAME_VERSION)
  state: GameState;
}

export function serialize(state: GameState): string {
  const file: SaveFile = { version: SAVE_VERSION, gameVersion: GAME_VERSION, state };
  return JSON.stringify(file);
}

type RawState = Record<string, unknown> & { monkeys?: unknown; stored?: { hats?: Record<string, number> } };

/**
 * Migrations, by the save version they upgrade from: each turns a save's
 * state of that version into the next version's, in place. deserialize runs
 * every one from the save's version up to SAVE_VERSION, in order.
 */
export const migrations: Record<number, (s: RawState) => void> = {
  // 3 -> 4 (game 0.2.0): combo cap raises became starting-combo upgrades, and
  // monkeys' wardrobes became the player's inventory (hats not worn go there).
  3: (s) => {
    if (s.comboStartLevel === undefined) s.comboStartLevel = s.comboCapLevel;
    delete s.comboCapLevel;
    if (!Array.isArray(s.monkeys)) return;
    const stored = (s.stored ??= {}).hats ?? {};
    for (const m of s.monkeys as { hat?: unknown; hats?: unknown }[]) {
      for (const id of Array.isArray(m?.hats) ? m.hats : []) {
        if (typeof id === 'string' && id !== m.hat) stored[id] = (typeof stored[id] === 'number' ? stored[id] : 0) + 1;
      }
      if (m) delete m.hats;
    }
    s.stored.hats = stored;
  },
};

/** A save's versions (format and game), or null if it isn't a save. Saves from before game versions say ''. */
export function saveVersions(raw: string | null): { version: number; gameVersion: string } | null {
  try {
    const file = raw ? JSON.parse(raw) : null;
    if (!file || typeof file.version !== 'number') return null;
    return { version: file.version, gameVersion: typeof file.gameVersion === 'string' ? file.gameVersion : '' };
  } catch {
    return null;
  }
}

/** Parses a save, falling back to defaults for missing or corrupt fields. */
/** Counts of stored things by id, keeping only known ids and whole counts above 0. */
function storedCounts(v: unknown, known: (id: string) => boolean): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([id, n]) => known(id) && typeof n === 'number' && Number.isFinite(n) && n >= 1)
      .map(([id, n]) => [id, Math.floor(n as number)]),
  );
}

export function deserialize(raw: string | null, now = Date.now()): GameState {
  const fresh = createInitialState(now);
  if (!raw) return fresh;
  try {
    const file = JSON.parse(raw) as { version?: number; state?: Partial<GameState> & { play?: unknown } };
    if (typeof file.version !== 'number' || file.version < 2) return fresh;
    // Older saves are brought up to date one version at a time; newer ones load as well as they can.
    const old = (file.state ?? {}) as RawState;
    for (let v = file.version; v < SAVE_VERSION; v++) migrations[v]?.(old);
    const s = old as Partial<GameState> & { play?: unknown };
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string') : [];
    const oldTypingLevel = Math.max(0, Math.floor(num((s as { typingLevel?: unknown }).typingLevel, 0)));
    // Hidden stats run from monkeyStats.min up to a temp's best.
    const inStatRange = (n: number) => n >= monkeyStats.min && n <= Math.max(monkeyStats.max, hr.tempStats.max);
    const monkey = (m: Partial<MonkeyState>): MonkeyState => ({
      name: str(m?.name),
      department: str(m?.department),
      manager: !!m?.manager,
      managerLevel: Math.max(0, Math.floor(num(m?.managerLevel, 0))),
      managerSpeedLevel: Math.max(0, Math.floor(num(m?.managerSpeedLevel, 0))),
      slotWait: Math.max(0, num(m?.slotWait, 0)),
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
      chainCounted: Math.max(0, Math.floor(num(m?.chainCounted, 0))),
      chainAll: strings(m?.chainAll).filter((w) => /^\p{Lu}+$/u.test(w)),
      // Saves from before per-monkey skill had one shared "Faster typing" level: every monkey keeps it,
      // with the typewriter it needs.
      skill: Math.max(0, Math.floor(num(m?.skill, oldTypingLevel))),
      typewriter: Math.max(0, Math.floor(num(m?.typewriter, Math.max(0, Math.ceil(oldTypingLevel / typing.levelsPerTypewriter) - 1)))),
      energy: Math.min(1, Math.max(0, num(m?.energy, 1))),
      resting: !!m?.resting,
      // Saves from before hats kept their hats in accessories.
      hat: [str(m?.hat), ...strings((m as { accessories?: unknown })?.accessories)].find((id) => hats.some((h) => h.id === id)) ?? '',
      hatColor: hatColors.some((c) => c.id === m?.hatColor) ? str(m?.hatColor) : '',
      petHappiness: Math.min(petting.maxHappiness, Math.max(0, num(m?.petHappiness, 0))),
      trait: traits.some((t) => t.id === m?.trait) ? str(m?.trait) : '',
      // Stats outside their range (or missing, in old saves) are picked again.
      speedStat: inStatRange(num(m?.speedStat, 0)) ? num(m?.speedStat, 0) : 0,
      stamina: inStatRange(num(m?.stamina, 0)) ? num(m?.stamina, 0) : 0,
      tempLeft: Math.max(0, num(m?.tempLeft, 0)),
      worked: Math.max(0, num(m?.worked, 0)),
      number: Math.max(0, Math.floor(num(m?.number, 0))),
      // Feelings about each job; jobs missing (added since the save) are picked when the game runs.
      jobs: Object.fromEntries(
        monkeyStats.jobs
          .map((j) => [j.id, (m?.jobs as Record<string, unknown> | undefined)?.[j.id]])
          .filter(([, f]) => monkeyStats.feelings.some((x) => x.id === f)) as [string, string][],
      ),
    });
    const isCell = (c: unknown): c is [number, number] => Array.isArray(c) && c.length === 2 && c.every((n) => Number.isInteger(n));
    const rooms: Room[] = (Array.isArray(s.office) ? (s.office as Partial<Room>[]) : [])
      .filter((r) => r && typeof r.id === 'string' && (r.kind === 'department' || r.kind === 'break' || r.kind === 'office' || r.kind === 'lab' || r.kind === 'hr' || r.kind === 'marketing' || r.kind === 'codebreaking' || r.kind === 'library') && Array.isArray(r.cells))
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
    // Monkeys from before M-numbers were kept get the one their place gave them.
    const monkeys = Array.isArray(s.monkeys) ? s.monkeys.map(monkey).map((m, i) => ({ ...m, number: m.number || i + 1 })) : [];
    // Monkeys from before names were given out get one now.
    for (const m of monkeys) if (!m.name) m.name = monkeyNameFor(m.number, monkeys.map((o) => o.name));
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
      letters: counts(st.letters, /^\p{Lu}$/u),
      words: counts(st.words, /^\p{Lu}+$/u),
      longestWord: /^\p{Lu}*$/u.test(str(st.longestWord)) ? str(st.longestWord) : '',
      bestWord: /^\p{Lu}*$/u.test(str(st.bestWord)) ? str(st.bestWord) : '',
      bestWordPoints: Math.max(0, num(st.bestWordPoints, 0)),
      longestChain: Math.max(0, Math.floor(num(st.longestChain, 0))),
      linesTyped: Math.max(0, Math.floor(num(st.linesTyped, 0))),
      longestLine:
        ll && typeof ll.play === 'string' && Number.isInteger(ll.index) && ll.index >= 0
          ? { play: ll.play, index: ll.index }
          : null,
      bestLinePoints: Math.max(0, num(st.bestLinePoints, 0)),
      pets: Math.max(0, Math.floor(num(st.pets, 0))),
      chainSentences: Math.max(0, Math.floor(num(st.chainSentences, 0))),
      sentencesWritten: Math.max(0, Math.floor(num(st.sentencesWritten, 0))),
      longestSentence: strings(st.longestSentence).filter((w) => /^\p{Lu}+$/u.test(w)),
      secondsTyping: Math.max(0, num(st.secondsTyping, 0)),
      secondsOpen: Math.max(0, num(st.secondsOpen, 0)),
      secondsAway: Math.max(0, num(st.secondsAway, 0)),
      dyes: Math.max(0, Math.floor(num(st.dyes, 0))),
      flipsWon: Math.max(0, Math.floor(num(st.flipsWon, 0))),
      flipsLost: Math.max(0, Math.floor(num(st.flipsLost, 0))),
      renamed: Math.max(0, Math.floor(num(st.renamed, 0))),
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
      halls: (Array.isArray(s.halls) ? (s.halls as unknown[]) : []).filter(isCell).map(([x, y]) => [x, y] as [number, number]),
      doors: (Array.isArray(s.doors) ? (s.doors as Partial<Door>[]) : [])
        .filter((d) => d && Number.isInteger(d.x) && Number.isInteger(d.y) && ['n', 'e', 's', 'w'].includes(d.side as string))
        .map((d) => ({ x: d.x!, y: d.y!, side: d.side! })),
      windows: (Array.isArray(s.windows) ? (s.windows as Partial<Door>[]) : [])
        .filter((d) => d && Number.isInteger(d.x) && Number.isInteger(d.y) && ['n', 'e', 's', 'w'].includes(d.side as string))
        .map((d) => ({ x: d.x!, y: d.y!, side: d.side! })),
      fengShuiBook: s.fengShuiBook === true,
      managerBook: s.managerBook === true,
      researchOpen: s.researchOpen === true,
      safes: Object.fromEntries(
        Object.entries(s.safes && typeof s.safes === 'object' ? (s.safes as Record<string, Partial<SafeState>>) : {})
          .filter(([, x]) => typeof x?.combo === 'string' && /^[A-Z0-9]+$/.test(x.combo))
          .map(([g, x], i) => [g, { level: Math.max(0, Math.floor(num(x.level, i))), combo: x.combo!, tries: Math.max(0, num(x.tries, 0)), open: x.open === true, held: str(x.held) }]),
      ),
      codebreakFocus: str(s.codebreakFocus),
      telegrams: (Array.isArray(s.telegrams) ? (s.telegrams as Partial<TelegramState>[]) : [])
        .filter((t) => t && t.key && Array.isArray(t.key.rotors) && t.key.rotors.length === 3 && t.key.rotors.every((r) => Number.isInteger(r) && r >= 0 && r < 5) && /^[A-Z]{3}$/.test(str(t.key.start)) && /^([A-Z]{2})*$/.test(str(t.key.plugs)))
        .map((t) => ({ key: { rotors: [...t.key!.rotors], start: t.key!.start, plugs: t.key!.plugs }, tested: Math.max(0, num(t.tested, 0)), keyAt: Math.max(1, num(t.keyAt, 1)), read: t.read === true })),
      telegramWait: Math.max(0, num(s.telegramWait, 0)),
      researching: research.projects.some((p) => p.id === s.researching) ? str(s.researching) : '',
      researchProgress: Math.max(0, num(s.researchProgress, 0)),
      candidates: (Array.isArray(s.candidates) ? (s.candidates as Partial<MonkeyState>[]) : [])
        .map((c) => monkey(c))
        .filter((c) => c.trait && c.speedStat && c.stamina && Object.keys(c.jobs).length > 0)
        .map(({ trait, speedStat, stamina, jobs, tempLeft }) => ({ trait, speedStat, stamina, jobs, tempLeft })),
      candidatesIn: Math.max(0, num(s.candidatesIn, 0)),
      stored: {
        furniture: storedCounts((s.stored as { furniture?: unknown } | undefined)?.furniture, (id) => furnitureKinds.some((k) => k.id === id)),
        hats: storedCounts((s.stored as { hats?: unknown } | undefined)?.hats, (key) => {
          const [id, color = ''] = key.split(':');
          return hats.some((h) => h.id === id) && (!color || hatColors.some((c) => c.id === color));
        }),
      },
      researched: strings(s.researched).filter((id) => research.projects.some((p) => p.id === id)),
      researchersHired: Math.max(0, Math.floor(num(s.researchersHired, 0))),
      squaresBought: Math.max(0, Math.floor(num(s.squaresBought, 0))),
      furniture: (Array.isArray(s.furniture) ? s.furniture : [])
        .filter((f) => f && (f.kind === desk.id || furnitureKinds.some((k) => k.id === f.kind)) && typeof f.room === 'string' && Number.isInteger(f.x) && Number.isInteger(f.y))
        .map((f) => ({ kind: f.kind, room: f.room, x: f.x, y: f.y, ...(f.turned === true ? { turned: true } : {}) })),
      departments: strings(s.departments).filter((g) => ['comedy', 'history', 'tragedy', 'sonnet', 'greek'].includes(g)),
      owned: oldPlay ? [oldPlay] : strings(s.owned),
      completed,
      scenesDone: strings(s.scenesDone),
      actsDone: strings(s.actsDone),
      playsDone: strings(s.playsDone),
      shelved: strings(s.shelved),
      classical: s.classical === 'latin' ? 'latin' : 'greek',
      galleries: typeof s.galleries === 'number' && s.galleries >= 0 ? Math.floor(s.galleries) : 0,
      lastMilestone,
      pointsBonus: Math.max(0, num(s.pointsBonus, 0)),
      speedBonus: Math.max(0, num(s.speedBonus, 0)),
      pinned,
      lastLine,
      comboStartLevel: Math.max(0, Math.floor(num(s.comboStartLevel, 0))),
      keys: strings(s.keys).filter((k) => /^[A-Z]+$/.test(k)),
      slots: Array.isArray(s.slots)
        ? s.slots
            .filter((x) => x && Number.isInteger(x.position) && x.position > 0)
            .map((x) => ({ department: str(x.department), position: x.position, word: /^\p{Lu}*$/u.test(str(x.word)) ? str(x.word) : '', on: !!x.on }))
        : [],
      letters: Array.isArray(s.letters)
        ? s.letters.filter((l) => typeof l === 'string' && /^[A-Z]$/.test(l))
        : [],
      monkeys: monkeys.length > 0 ? monkeys : [{ ...createMonkey(), number: 1, name: monkeyNameFor(1, []) }],
      monkeysBought: Object.fromEntries(
        Object.entries(s.monkeysBought && typeof s.monkeysBought === 'object' ? (s.monkeysBought as Record<string, unknown>) : {}).map(([k, v]) => [k, Math.max(0, Math.floor(num(v, 0)))]),
      ),
      unassignedMonkeys: Math.max(0, Math.floor(num(s.unassignedMonkeys, 0))),
      wordsTyped: num(s.wordsTyped, 0),
      lastWord: str(s.lastWord),
      lastWordPoints: num(s.lastWordPoints, 0),
      lately: {
        longWord: str(s.lately?.longWord),
        longWordAt: num(s.lately?.longWordAt, 0),
        lastSentence: strings(s.lately?.lastSentence),
        longSentence: strings(s.lately?.longSentence),
        longSentenceAt: num(s.lately?.longSentenceAt, 0),
        news: (Array.isArray(s.lately?.news) ? s.lately.news : []).filter((n) => n && typeof n.text === 'string').map((n) => ({ text: n.text, at: num(n.at, 0) })),
      },
      settings: { autoPlaceFurniture: s.settings?.autoPlaceFurniture !== false, lightBackground: s.settings?.lightBackground === true,
        homeDepartment: typeof s.settings?.homeDepartment === 'string' ? s.settings.homeDepartment : '',
        scientific: s.settings?.scientific === true,
        screenAtTop: s.settings?.screenAtTop === true,
        mouse: s.settings?.mouse !== false,
      },
      stats,
      achievements: strings(s.achievements),
      folios: Math.max(0, Math.floor(num(s.folios, 0))),
      folioPages: Math.max(0, Math.floor(num(s.folioPages, 0))),
      // Saves from before Folios multiplied each other: all pages in one.
      freeLetters: Math.max(0, Math.floor(num(s.freeLetters, 0))),
      letterGifts: strings(s.letterGifts),
      folioBoost: num(s.folioBoost, 0) >= 1 ? num(s.folioBoost, 0) : 1 + Math.max(0, Math.floor(num(s.folioPages, 0))) * folio.bonusPerPage,
      lastSaved: num(s.lastSaved, now),
    };
    // Saves from before rooms get an office that seats their monkeys.
    if (state.office.length === 0) furnishOffice(state);
    // Saves from before hallways had each room on its own grid: lay them out and connect them.
    if (!Array.isArray(s.halls)) layOutOffice(state);
    // Saves from before windows get one in every room; windows that don't face outside go.
    tidyDoors(state);
    if (!Array.isArray(s.windows)) for (const r of state.office) addWindow(state, r);
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
