import {
  combo,
  extraWords,
  lineRewards,
  sentenceRules,
  letterShop,
  lineWidth,
  maxOfflineLetters,
  maxSimulatedLettersPerSecond,
  maxMonkeyNameLength,
  maxPinnedLines,
  milestones,
  scriptShop,
  departmentRules,
  sonnetRewards,
  managers,
  maxOfflineSeconds,
  monkeyShop,
  office as officeRules,
  energy as energyRules,
  hats,
  hatColors,
  dyeCost,
  desk,
  furnitureKinds,
  startingLetters,
  typewriterKeys,
  wordSlots,
  typing,
  petting,
  achievements,
  folio,
  fengShui,
} from './config';
import { buildPlay, genres, playGenres, type Genre, type Play, type PlayData, type Scene } from './plays';
import { createInitialState, createMonkey, rectangle, type Furniture, type GameState, type Room, type MonkeyState, type Pin, type Segment, type WordSlot } from './state';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from './words';
import { addWindow, autoConnect, connectedRooms, doorToTouching, loungeOf, placeRoom, roomCanUse, tidyDoors, touchingRooms } from './layout';
import { chiHappiness, roomChi, squareRank } from './fengshui';

/** Random number source in [0, 1); injectable so tests are deterministic. */
export type Rng = () => number;

let wordList: readonly string[] = extraWords;
let cached = new Map<string, { key: string; dict: Dictionary; letters: Snapshot; owned: Snapshot }>();

/**
 * Sets the words that can score. The front end loads the word list and hands
 * it over here, so the game logic never touches the file system.
 */
export function setWordList(list: readonly string[]): void {
  wordList = [...list, ...extraWords];
  cached.clear();
}

const plays = new Map<string, Play>();
let longestLine = 0;

/** Registers the plays whose scenes can be bought; the front end loads them. */
export function setPlays(list: readonly PlayData[]): void {
  plays.clear();
  for (const data of list) plays.set(data.id, buildPlay(data));
  longestLine = Math.max(0, ...[...plays.values()].map((p) => p.longestLine));
  cached.clear();
  ownedCache.clear();
}

export function availablePlays(): Play[] {
  return [...plays.values()];
}

export function getPlay(id: string): Play | undefined {
  return plays.get(id);
}

/** Whether the player owns a scene, directly or through its act or play. */
export function ownsScene(state: GameState, play: string, sc: Scene): boolean {
  return (
    state.owned.includes(play) || state.owned.includes(`${play}:${sc.act}`) || state.owned.includes(`${play}:${sc.key}`)
  );
}

/** The scene a line belongs to. */
export function sceneOf(play: Play, index: number): Scene | undefined {
  const l = play.lines[index];
  return l && play.scenes.find((sc) => sc.act === l.act && sc.scene === l.scene);
}

export function ownsLine(state: GameState, play: Play, index: number): boolean {
  const sc = sceneOf(play, index);
  return !!sc && ownsScene(state, play.id, sc);
}

/**
 * Genres with a department, in the order opened. (An old save that owns a
 * play but opened no department counts that play's genre.)
 */
export function departmentGenres(state: GameState): Genre[] {
  // Called for nearly every letter typed, so it's remembered until departments or the script change.
  const memo = genreMemo.get(state);
  if (memo && unchanged(memo.departments, state.departments) && unchanged(memo.owned, state.owned)) return memo.list.slice();
  const list = state.departments.filter((g): g is Genre => genres.includes(g as Genre));
  for (const k of state.owned) {
    const g = plays.get(k.split(':')[0])?.genre;
    if (g && !list.includes(g)) list.push(g);
  }
  genreMemo.set(state, { departments: snapshot(state.departments), owned: snapshot(state.owned), list });
  return list.slice();
}

/**
 * An array as it was: these lists only ever grow by push or get replaced
 * whole, so the same array at the same length holds the same items.
 */
type Snapshot = { array: readonly string[]; length: number };
const snapshot = (array: readonly string[]): Snapshot => ({ array, length: array.length });
const unchanged = (s: Snapshot, array: readonly string[]) => s.array === array && s.length === array.length;
const genreMemo = new WeakMap<GameState, { departments: Snapshot; owned: Snapshot; list: Genre[] }>();

/** Genres that have at least one play. */
export function genresWithPlays(): Genre[] {
  return genres.filter((g) => availablePlays().some((p) => p.genre === g));
}

/** How many more departments you may open now: one at the start, more as your monkeys grow. */
export function departmentPicks(state: GameState): number {
  const open = departmentGenres(state).length;
  const locked = genresWithPlays().filter((g) => !departmentGenres(state).includes(g)).length;
  const total = state.monkeys.length + state.unassignedMonkeys;
  const earned = departmentRules.monkeysToOpen.filter((n, i) => i === 0 || total >= n).length;
  return Math.max(0, Math.min(locked, earned - open));
}

/** Monkeys needed to open the next department, or 0 if none is left to open. */
export function nextDepartmentAt(state: GameState): number {
  const open = departmentGenres(state).length;
  if (open >= genresWithPlays().length) return 0;
  return departmentRules.monkeysToOpen[open] ?? 0;
}

/** Genres you could open a department for next: the play genres first, the Sonnets last. */
export function departmentChoices(state: GameState): Genre[] {
  const unopened = genresWithPlays().filter((g) => !departmentGenres(state).includes(g));
  const plays = unopened.filter((g) => playGenres.includes(g));
  return plays.length > 0 ? plays : unopened;
}

/** Opens a department for a genre, if you've earned one. */
export function openDepartment(state: GameState, genre: string): boolean {
  const g = departmentChoices(state).find((x) => x === genre);
  if (!g || departmentPicks(state) === 0) return false;
  // The first department takes the room you start in.
  if (departmentGenres(state).length === 0) for (const r of state.office) if (r.kind === 'department' && r.department === '') r.department = g;
  state.departments.push(g);
  return true;
}

/** The genre a monkey works in. */
export function monkeyGenre(state: GameState, m: MonkeyState): Genre | undefined {
  const open = departmentGenres(state);
  return open.find((g) => g === m.department) ?? open[0];
}

/** Moves a monkey to the next open department, round the list. */
export function moveMonkey(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  const open = departmentGenres(state);
  if (!m || open.length < 2) return false;
  // The next department round the list that has room.
  const at = open.indexOf(monkeyGenre(state, m)!);
  const from = monkeyGenre(state, m);
  const next = [...open.slice(at + 1), ...open.slice(0, at)].find(
    (g) => departmentTypists(state, g) < departmentRules.maxTypists && hasDeskSpace(state, g),
  );
  if (!next) return false;
  // Its desk moves with it.
  const oldRoom = departmentRoom(state, from);
  const oldDesk = oldRoom ? roomDesks(state, oldRoom).pop() : undefined;
  if (oldDesk !== undefined) state.furniture.splice(oldDesk, 1);
  placeDesk(state, next);
  if (m.manager) {
    // A manager moving departments goes back to typing there.
    m.manager = false;
    if (m.target) unpin(state, m.target);
    m.target = null;
  }
  m.department = next;
  return true;
}

/** The free scenes offered at the start: the shortest scenes in your first genre. */
export function starterScenes(state: GameState): { play: Play; scene: Scene }[] {
  return availablePlays()
    .filter((p) => departmentGenres(state)[0] === p.genre)
    .flatMap((play) => play.scenes.map((scene) => ({ play, scene })))
    .sort((a, b) => a.scene.letters - b.scene.letters || a.play.id.localeCompare(b.play.id))
    .slice(0, scriptShop.starterScenes);
}

/** Takes the free starter scene. Only allowed once, before anything is owned. */
export function chooseStarterScene(state: GameState, play: string, sceneKey: string): boolean {
  const ok = starterScenes(state).some((x) => x.play.id === play && x.scene.key === sceneKey);
  if (!ok || state.owned.length > 0) return false;
  state.owned.push(`${play}:${sceneKey}`);
  state.completed[play] ??= [];
  return true;
}

/** Points price of one scene, before any discount. */
export function scenePrice(sc: Scene): number {
  return Math.ceil(scriptShop.pointsPerLetter * sc.letters);
}

/**
 * What it costs to buy a scene, an act (sceneKey omitted) or a whole play
 * (act omitted too): the unowned scenes' prices times the discount for that
 * size. Returns 0 if everything in it is owned already.
 */
export function sectionPrice(state: GameState, play: Play, act?: number, sceneKey?: string): number {
  const scenes = play.scenes.filter(
    (sc) => (act === undefined || sc.act === act) && (sceneKey === undefined || sc.key === sceneKey),
  );
  const unowned = scenes.filter((sc) => !ownsScene(state, play.id, sc));
  const discount =
    sceneKey !== undefined ? 1 : act !== undefined ? scriptShop.actDiscount : scriptShop.playDiscount;
  return Math.ceil(unowned.reduce((n, sc) => n + scenePrice(sc), 0) * discount);
}

/** Buys a scene, an act or a whole play with points. */
export function buySection(state: GameState, playId: string, act?: number, sceneKey?: string): boolean {
  const play = plays.get(playId);
  if (!play || state.owned.length === 0 || !departmentGenres(state).includes(play.genre)) return false;
  const exists = play.scenes.some(
    (sc) => (act === undefined || sc.act === act) && (sceneKey === undefined || sc.key === sceneKey),
  );
  const price = sectionPrice(state, play, act, sceneKey);
  if (!exists || price === 0 || state.currency < price) return false;
  state.currency -= price;
  const key = act === undefined ? playId : sceneKey === undefined ? `${playId}:${act}` : `${playId}:${sceneKey}`;
  // Drop smaller purchases the new one covers.
  state.owned = state.owned.filter((k) => !(key === playId ? k.startsWith(`${playId}:`) : k.startsWith(`${key}.`)));
  state.owned.push(key);
  state.completed[playId] ??= [];
  return true;
}

/** Lines written and total in one scene. */
export function sceneProgress(state: GameState, play: Play, sc: Scene): [number, number] {
  const done = new Set(state.completed[play.id] ?? []);
  return [sc.lines.filter((i) => done.has(i)).length, sc.lines.length];
}

/** Lines written and total across everything owned. */
export function ownedProgress(state: GameState): [number, number] {
  let written = 0;
  let total = 0;
  for (const play of plays.values()) {
    for (const sc of play.scenes) {
      if (!ownsScene(state, play.id, sc)) continue;
      const [w, t] = sceneProgress(state, play, sc);
      written += w;
      total += t;
    }
  }
  return [written, total];
}

/** Points a monkey earns are multiplied by this; finished scenes raise it, and so does its department's happiness. */
export function pointsMultiplier(state: GameState, m?: MonkeyState): number {
  return (1 + state.pointsBonus) * (1 + happiness(state, m && monkeyGenre(state, m))) * folioMultiplier(state);
}

/** Points are multiplied by this for good, from the pages of every Folio published. */
export function folioMultiplier(state: GameState): number {
  return 1 + state.folioPages * folio.bonusPerPage;
}

/** Whether a Folio can be published: a whole play is finished. */
export function canPublishFolio(state: GameState): boolean {
  return state.playsDone.length > 0;
}

/** Pages publishing a Folio now would bank: a page per line written, and the lines of each finished play once more. */
export function folioPagesNow(state: GameState): number {
  const written = Object.values(state.completed).reduce((n, lines) => n + lines.length, 0);
  const finished = state.playsDone.reduce((n, id) => n + (getPlay(id)?.lines.length ?? 0), 0);
  return written + finished * folio.finishedPlayPages;
}

/**
 * Publishes a Folio: the prestige reset. Returns the new game, started over
 * but keeping achievements, statistics, options and the Folio (its pages
 * raise points for good). Returns null if no play is finished yet.
 */
export function publishFolio(state: GameState): GameState | null {
  if (!canPublishFolio(state)) return null;
  const next = createInitialState(state.lastSaved);
  next.folios = state.folios + 1;
  next.folioPages = state.folioPages + folioPagesNow(state);
  next.achievements = [...state.achievements];
  next.stats = state.stats;
  next.settings = state.settings;
  checkAchievements(next);
  return next;
}

/** Typing speed is multiplied by this; finished acts raise it. */
export function speedMultiplier(state: GameState): number {
  return 1 + state.speedBonus;
}

/** Letters per second for a monkey, from its typing skill and act bonuses. */
export function monkeySpeed(state: GameState, m: MonkeyState, skill = m.skill): number {
  return lettersPerSecond(skill) * speedMultiplier(state) * (1 + wearing(m, 'speed'));
}

/** What a monkey's hat gives it for one effect. */
export function wearing(m: MonkeyState, effect: 'points' | 'speed' | 'drain' | 'rest' | 'combo'): number {
  return hats.find((h) => h.id === m.hat)?.[effect] ?? 0;
}

/** Sentences for the next hat of a kind: each costs costGrowth times the last, across all monkeys. */
export function hatCost(state: GameState, id: string): number {
  const h = hats.find((x) => x.id === id);
  if (!h) return Infinity;
  const owned = state.monkeys.filter((m) => m.hats.includes(id)).length;
  return Math.ceil(h.cost * Math.pow(h.costGrowth, owned));
}

/**
 * Puts a hat on a monkey: free if it has that hat already, else bought with
 * Sentences (it keeps it). A monkey already wearing that hat takes it off.
 */
export function wearHat(state: GameState, index: number, id: string): boolean {
  const m = state.monkeys[index];
  if (!m || !hats.some((h) => h.id === id)) return false;
  if (m.hat === id) {
    m.hat = '';
    return true;
  }
  if (!m.hats.includes(id)) {
    const cost = hatCost(state, id);
    if (state.sentences < cost) return false;
    state.sentences -= cost;
    m.hats.push(id);
  }
  m.hat = id;
  return true;
}

/**
 * Dyes a monkey's hat a colour (a hatColors id) for dyeCost Sentences; '' washes
 * the dye out for free. It needs to be wearing a hat.
 */
export function dyeHat(state: GameState, index: number, color: string): boolean {
  const m = state.monkeys[index];
  if (!m || !m.hat || m.hatColor === color) return false;
  if (!color) {
    m.hatColor = '';
    return true;
  }
  if (!hatColors.some((c) => c.id === color) || state.sentences < dyeCost) return false;
  state.sentences -= dyeCost;
  m.hatColor = color;
  state.stats.dyes++;
  return true;
}

/** How fast a monkey's energy lets it type: 1 when rested, down to 1 - maxSlowdown when worn out. */
export function energyFactor(energy: number): number {
  return 1 - energyRules.maxSlowdown * (1 - energy);
}

/** Whether a monkey can get to its desk: its department's room connects to the office entrance. */
export function canReachDesk(state: GameState, m: MonkeyState): boolean {
  const room = departmentRoom(state, monkeyGenre(state, m));
  return !room || connectedRooms(state).has(room.id);
}

/** A monkey's speed right now: tiredness slows it, and on a break (or locked out of its room) it doesn't type. */
export function currentSpeed(state: GameState, m: MonkeyState): number {
  return m.manager || m.resting || !canReachDesk(state, m) ? 0 : monkeySpeed(state, m) * energyFactor(m.energy);
}

const kindOf = (id: string) => (id === desk.id ? desk : furnitureKinds.find((k) => k.id === id));

/**
 * The rooms whose furniture a department enjoys: its own room, and its lounge
 * (the nearest break room, see loungeOf). None if its room can't be reached.
 */
export function enjoyedRooms(state: GameState, genre: Genre | undefined): Room[] {
  const room = departmentRoom(state, genre);
  if (!room || !connectedRooms(state).has(room.id)) return [];
  const lounge = loungeOf(state, room);
  return lounge ? [room, lounge] : [room];
}

/** Adds up one effect of the furniture a department enjoys. */
function furnitureSum(state: GameState, genre: Genre | undefined, effect: 'drain' | 'rest' | 'happiness'): number {
  const ids = new Set(enjoyedRooms(state, genre).map((r) => r.id));
  return state.furniture.reduce((n, f) => n + (ids.has(f.room) ? (kindOf(f.kind)?.[effect] ?? 0) : 0), 0);
}

/** How much slower a department's monkeys tire, from the decor in its room and its lounge (0.1 = 10%). */
export function drainCut(state: GameState, genre: Genre | undefined): number {
  return Math.min(energyRules.maxDrainCut, furnitureSum(state, genre, 'drain'));
}

/** How much faster a department's breaks go, from the comforts in its room and its lounge (0.5 = 50%). */
export function restBoost(state: GameState, genre: Genre | undefined): number {
  return Math.min(energyRules.maxRestBoost, furnitureSum(state, genre, 'rest'));
}

/** A department's happiness from the furniture in its room and its lounge (capped): points x (1 + happiness), and its monkeys tire slower and rest faster. */
export function furnitureHappiness(state: GameState, genre: Genre | undefined): number {
  return Math.min(energyRules.maxHappiness, furnitureSum(state, genre, 'happiness'));
}

/** A department's happiness: its furniture's, plus the whole office's feng shui (see fengshui.ts). */
export function happiness(state: GameState, genre: Genre | undefined): number {
  return furnitureHappiness(state, genre) + chiHappiness(state);
}

/** A monkey's happiness: its department's, plus its own from petting. Happier monkeys tire slower and rest faster. */
export function monkeyHappiness(state: GameState, m: MonkeyState): number {
  return happiness(state, monkeyGenre(state, m)) + m.petHappiness;
}

/** Seconds of typing that drain a monkey, and of rest that refill it, with the office's furniture and its happiness. */
export function energyRates(state: GameState, m: MonkeyState): EnergyRates {
  const happy = 1 + monkeyHappiness(state, m);
  return {
    drainSeconds: (energyRules.drainSeconds * happy) / ((1 - drainCut(state, monkeyGenre(state, m))) * (1 - Math.min(0.9, wearing(m, 'drain')))),
    breakSeconds: energyRules.breakSeconds / ((1 + restBoost(state, monkeyGenre(state, m))) * (1 + wearing(m, 'rest')) * happy),
  };
}

export interface EnergyRates {
  drainSeconds: number;
  breakSeconds: number;
}

/** Seconds of a break left. */
export function breakLeft(m: MonkeyState, rates: EnergyRates = energyRules): number {
  return m.resting ? (1 - m.energy) * rates.breakSeconds : 0;
}

/**
 * Runs a typing monkey's energy for `seconds`: it tires while typing, takes a
 * break at 0% and goes back to work rested. Returns the seconds of full-speed
 * typing that time was worth, exactly, however long it is.
 */
export function spendEnergy(m: MonkeyState, seconds: number, rates: EnergyRates = energyRules): number {
  const drain = 1 / rates.drainSeconds;
  const rest = 1 / rates.breakSeconds;
  const k = energyRules.maxSlowdown;
  let worth = 0;
  for (let left = seconds; left > 1e-9; ) {
    if (m.resting) {
      const t = Math.min(left, (1 - m.energy) / rest);
      m.energy = Math.min(1, m.energy + t * rest);
      left -= t;
      if (m.energy >= 1 - 1e-9) {
        m.energy = 1;
        m.resting = false;
      }
    } else {
      const t = Math.min(left, m.energy / drain);
      const end = Math.max(0, m.energy - t * drain);
      worth += t * (1 - k) + k * t * ((m.energy + end) / 2); // energyFactor averaged over the stretch
      m.energy = end;
      left -= t;
      if (m.energy <= 1e-9) {
        m.energy = 0;
        m.resting = true;
      }
    }
  }
  return worth;
}

/** Points bonus for finishing a scene, by its length. */
export function sceneBonus(sc: Scene): number {
  return milestones.scenePointsPerLine * sc.lines.length;
}

/** Typing speed bonus for finishing an act, by its length. */
export function actBonus(play: Play, act: number): number {
  return milestones.actSpeedPerLine * play.lines.filter((l) => l.act === act).length;
}

const samePin = (a: Pin, b: Pin) => a.play === b.play && a.index === b.index;

/** Pins or unpins a line you own. Returns false if it isn't owned or the pin limit is reached. */
/**
 * Where the player is working, for opening the script browser: the most
 * recent pin, else the first unwritten owned line of the play last written
 * in, else of the first play owned. Null before any script is owned.
 */
export function currentWork(state: GameState): Pin | null {
  const pin = state.pinned[state.pinned.length - 1];
  if (pin && plays.has(pin.play)) return { ...pin };
  const ids = [state.lastLine?.play, ...state.owned.map((k) => k.split(':')[0])];
  const play = ids.map((id) => (id ? plays.get(id) : undefined)).find((p) => p && p.lines.some((_, i) => ownsLine(state, p, i)));
  if (!play) return null;
  const done = new Set(state.completed[play.id] ?? []);
  const owned = play.lines.map((_, i) => i).filter((i) => ownsLine(state, play, i));
  return { play: play.id, index: owned.find((i) => !done.has(i)) ?? owned[0] };
}

/**
 * The first line of the next (dir 1) or previous (dir -1) owned scene from
 * a line, across plays in order, wrapping around. Null if nothing is owned.
 */
export function nextOwnedScene(state: GameState, playId: string, index: number, dir: 1 | -1): Pin | null {
  const all = [...plays.values()];
  const starts = all.flatMap((p, order) =>
    p.scenes.filter((sc) => ownsScene(state, p.id, sc)).map((sc) => ({ order, play: p.id, index: sc.lines[0] })),
  ).sort((a, b) => a.order - b.order || a.index - b.index);
  if (starts.length === 0) return null;
  const here = Math.max(0, all.findIndex((p) => p.id === playId));
  const play = plays.get(playId);
  const at = play && sceneOf(play, index) ? sceneOf(play, index)!.lines[0] : index;
  const cmp = (x: { order: number; index: number }) => x.order - here || x.index - at;
  const pick = dir > 0 ? starts.find((x) => cmp(x) > 0) ?? starts[0] : [...starts].reverse().find((x) => cmp(x) < 0) ?? starts[starts.length - 1];
  return { play: pick.play, index: pick.index };
}

/** The next (or previous) pinned line after a line, in play order then line order, wrapping around; null with no pins. */
export function nextPin(state: GameState, playId: string, index: number, dir: 1 | -1): Pin | null {
  const all = [...plays.values()];
  const order = (id: string) => all.findIndex((p) => p.id === id);
  const pins = [...state.pinned].sort((a, b) => order(a.play) - order(b.play) || a.index - b.index);
  if (pins.length === 0) return null;
  const cmp = (x: Pin) => order(x.play) - order(playId) || x.index - index;
  const pick = dir > 0 ? pins.find((x) => cmp(x) > 0) ?? pins[0] : [...pins].reverse().find((x) => cmp(x) < 0) ?? pins[pins.length - 1];
  return { play: pick.play, index: pick.index };
}

export function togglePin(state: GameState, playId: string, index: number): boolean {
  const play = plays.get(playId);
  if (!play || !ownsLine(state, play, index)) return false;
  const pin = { play: playId, index };
  const at = state.pinned.findIndex((p) => samePin(p, pin));
  if (at >= 0) {
    state.pinned.splice(at, 1);
    return true;
  }
  if (state.pinned.length >= maxPinnedLines) return false;
  state.pinned.push(pin);
  return true;
}

/** Letters a line needs that you don't own yet. */
/** True when you own every letter in `letters`. */
export function inReach(state: GameState, letters: string): boolean {
  for (const c of letters) if (!state.letters.includes(c)) return false;
  return true;
}

export function missingLetters(state: GameState, letters: string): string[] {
  return [...new Set(letters)].filter((c) => !state.letters.includes(c)).sort();
}

/** Unwritten lines of a play that you own, with every letter they need, shortest first. */
export function reachableLines(state: GameState, playId: string): number[] {
  const play = plays.get(playId);
  if (!play) return [];
  const done = new Set(state.completed[play.id] ?? []);
  return play.lines
    .map((line, i) => ({ line, i }))
    .filter(
      ({ line, i }) => !done.has(i) && ownsLine(state, play, i) && inReach(state, line.letters),
    )
    .sort((a, b) => a.line.letters.length - b.line.letters.length || a.i - b.i)
    .map(({ i }) => i);
}

/** Owned lines of one genre by their letters, rebuilt when ownership changes. */
let ownedCache = new Map<string, { key: string; byLetters: Map<string, Pin[]>; words: string[] }>();

function ownedLines(state: GameState, genre: Genre | undefined): { byLetters: Map<string, Pin[]>; words: string[] } {
  const key = state.owned.join('|');
  let entry = ownedCache.get(genre ?? '');
  if (entry?.key !== key) {
    const byLetters = new Map<string, Pin[]>();
    const words = new Set<string>();
    for (const play of plays.values()) {
      if (play.genre !== genre) continue;
      for (const sc of play.scenes) {
        if (!ownsScene(state, play.id, sc)) continue;
        for (const index of sc.lines) {
          const line = play.lines[index];
          line.words.forEach((w) => words.add(w));
          const list = byLetters.get(line.letters) ?? [];
          list.push({ play: play.id, index });
          byLetters.set(line.letters, list);
        }
      }
    }
    entry = { key, byLetters, words: [...words] };
    ownedCache.set(genre ?? '', entry);
  }
  return entry;
}

/** A run of one letter, like AA, AAA or MM: never a word, though the word list has AA and MM. */
function isOneLetterRun(word: string): boolean {
  return /^(.)\1+$/.test(word);
}

/**
 * The dictionary for the player's current letters plus the words of a
 * department's owned scenes (which always count), rebuilt only when they change.
 */
export function dictionaryFor(state: GameState, genre = departmentGenres(state)[0]): Dictionary {
  let entry = cached.get(genre ?? '');
  // Checking the snapshots first skips building the key on almost every letter.
  if (entry && unchanged(entry.letters, state.letters) && unchanged(entry.owned, state.owned)) return entry.dict;
  const key = [...state.letters].sort().join('') + '|' + state.owned.join('|');
  if (entry?.key !== key) {
    const words = [...wordList, ...ownedLines(state, genre).words].filter((w) => !isOneLetterRun(w));
    entry = { key, dict: new Dictionary(words, state.letters), letters: snapshot(state.letters), owned: snapshot(state.owned) };
    cached.set(genre ?? '', entry);
  }
  entry.letters = snapshot(state.letters);
  entry.owned = snapshot(state.owned);
  return entry.dict;
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

/** Cost in Words of the next letter, given how many you own. */
export function letterWordsCost(owned: number): number {
  return Math.floor(letterShop.wordsCostFactor * owned ** letterShop.wordsCostPower);
}

/** Whether you have the points and Words for your next letter. */
export function canAffordLetter(state: GameState): boolean {
  return state.currency >= letterCost(state.letters.length) && state.words >= letterWordsCost(state.letters.length);
}

/** Buys a letter you don't own yet, for points and Words. */
export function buyLetter(state: GameState, letter: string): boolean {
  const l = letter.toUpperCase();
  const cost = letterCost(state.letters.length);
  if (state.letters.length === 0 || !/^[A-Z]$/.test(l) || state.letters.includes(l)) return false;
  if (!canAffordLetter(state)) return false;
  state.words -= letterWordsCost(state.letters.length);
  state.currency -= cost;
  state.letters.push(l);
  return true;
}

/** Cost in points of a monkey for the department-th department opened (from 0) that has already bought `bought`. */
export function monkeyCost(bought: number, department = 0): number {
  return Math.ceil(monkeyShop.baseCost * Math.pow(monkeyShop.departmentGrowth, department) * Math.pow(monkeyShop.costGrowth, bought));
}

/**
 * Cost in points of the next monkey for a department (by default the one a
 * new monkey would go to). Only bought monkeys raise it; free ones from acts don't.
 */
export function nextMonkeyCost(state: GameState, genre?: Genre): number {
  const open = departmentGenres(state);
  const dept = genre ?? departmentsWithRoom(state)[0] ?? open[0] ?? '';
  return monkeyCost(state.monkeysBought[dept] ?? 0, Math.max(0, open.indexOf(dept as Genre)));
}

/** The department a room belongs to: undefined for a break room. */
export function roomGenre(state: GameState, room: Room): Genre | undefined {
  if (room.kind !== 'department') return undefined;
  const open = departmentGenres(state);
  return open.find((g) => g === room.department) ?? (room.department === '' ? open[0] : undefined);
}

/** A department's room (before any department opens, the room you start in). */
export function departmentRoom(state: GameState, genre: Genre | undefined): Room | undefined {
  return state.office.find((r) => r.kind === 'department' && (roomGenre(state, r) === genre || (!genre && r.department === '')));
}

/** Open departments that don't have a room yet. */
export function roomlessDepartments(state: GameState): Genre[] {
  return departmentGenres(state).filter((g) => !departmentRoom(state, g));
}

const hasCell = (room: Room, x: number, y: number) => room.cells.some(([cx, cy]) => cx === x && cy === y);
const readingOrder = (a: [number, number], b: [number, number]) => a[1] - b[1] || a[0] - b[0];

/** The smallest rectangle around a room's squares. */
export function roomBounds(room: Room): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = room.cells.map(([x]) => x);
  const ys = room.cells.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** What a square holds: furniture (its index in state.furniture), free floor, or null if it's not in the room. */
export function cellAt(state: GameState, roomId: string, x: number, y: number): number | 'floor' | null {
  const room = state.office.find((r) => r.id === roomId);
  if (!room || !hasCell(room, x, y)) return null;
  const f = state.furniture.findIndex((p) => p.room === roomId && covers(p, x, y));
  return f >= 0 ? f : 'floor';
}

/** How many squares a kind of furniture takes, across and down. */
export function pieceSize(kind: string, turned = false): [number, number] {
  const [w, h] = (kind === desk.id ? desk : furnitureKinds.find((k) => k.id === kind))?.size ?? [1, 1];
  return turned ? [h, w] : [w, h];
}

/** The squares a piece of furniture stands on: its own square and, for bigger pieces, those right of and below it. */
export function footprint(f: Pick<Furniture, 'kind' | 'x' | 'y' | 'turned'>): [number, number][] {
  const [w, h] = pieceSize(f.kind, f.turned);
  const out: [number, number][] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([f.x + dx, f.y + dy]);
  return out;
}

const covers = (f: Furniture, x: number, y: number) => footprint(f).some(([px, py]) => px === x && py === y);

/** Whether a kind of furniture may stand in a room: televisions only in break rooms, for example (see furnitureKinds' rooms). */
export function allowedIn(state: GameState, kind: string, roomId: string): boolean {
  const room = state.office.find((r) => r.id === roomId);
  return !!room && !!kindOf(kind)?.rooms.includes(room.kind);
}

/** Whether a piece fits with its first square at x, y: a room it may stand in, every square in it and free (`ignore` is the piece being moved). */
export function fitsAt(state: GameState, roomId: string, kind: string, x: number, y: number, turned = false, ignore = -1): boolean {
  return allowedIn(state, kind, roomId) && footprint({ kind, x, y, turned }).every(([px, py]) => {
    const here = cellAt(state, roomId, px, py);
    return here === 'floor' || here === ignore;
  });
}

/** A room's free squares, in reading order. */
export function freeSquares(state: GameState, room: Room): [number, number][] {
  return [...room.cells].sort(readingOrder).filter(([x, y]) => cellAt(state, room.id, x, y) === 'floor');
}

/** The desks in a room, as indices into state.furniture. Monkeys of its department sit at them in order. */
export function roomDesks(state: GameState, room: Room): number[] {
  return state.furniture.flatMap((f, i) => (f.kind === desk.id && f.room === room.id ? [i] : []));
}

/** Whether a department's room has a free square for another monkey's desk. */
export function hasDeskSpace(state: GameState, genre: Genre | undefined): boolean {
  const room = departmentRoom(state, genre);
  return !!room && freeSquares(state, room).length > 0;
}

/**
 * A room's free squares, best first for a new piece: out of the way of doors
 * (see squareRank), and for desks against a wall too, then in reading order.
 */
function bestSquares(state: GameState, room: Room, forDesk = false): [number, number][] {
  const inRoom = (x: number, y: number) => hasCell(room, x, y);
  const open = ([x, y]: [number, number]) => (forDesk && inRoom(x, y - 1) && inRoom(x + 1, y) && inRoom(x, y + 1) && inRoom(x - 1, y) ? 1 : 0);
  return freeSquares(state, room)
    .map((sq, i) => ({ sq, score: [squareRank(state, room, sq[0], sq[1]), open(sq), i] }))
    .sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2])
    .map((x) => x.sq);
}

/** Stands a new desk on the best free square of a department's room (see bestSquares). */
function placeDesk(state: GameState, genre: Genre | undefined): void {
  const room = departmentRoom(state, genre);
  const square = room && bestSquares(state, room, true)[0];
  if (room && square) state.furniture.push({ kind: desk.id, room: room.id, x: square[0], y: square[1] });
}

/** Seats monkeys waiting for a desk, if there's only one department to choose. */
function seatWaiting(state: GameState): void {
  while (state.unassignedMonkeys > 0 && departmentsWithRoom(state).length <= 1 && assignMonkey(state));
}

/** Points for a new 3x3 room. */
export function roomCost(state: GameState): number {
  return Math.ceil(officeRules.roomBaseCost * Math.pow(officeRules.roomCostGrowth, Math.max(0, state.office.length - 1)));
}

/** Buys a room: for a department that has none, or a break room. */
export function buyRoom(state: GameState, kind: Room['kind'], genre?: Genre): boolean {
  const cost = roomCost(state);
  if (state.currency < cost || (kind === 'department' && (!genre || !roomlessDepartments(state).includes(genre)))) return false;
  state.currency -= cost;
  addRoom(state, kind, genre ?? '', officeRules.newRoomWidth, officeRules.newRoomHeight);
  seatWaiting(state);
  return true;
}

/**
 * Adds a w x h room where it fits best, with a door into each room of the
 * other kind it touches, and a hallway to the rest of the office if it still
 * needs one. Returns it.
 */
export function addRoom(state: GameState, kind: Room['kind'], department: string, width: number, height: number): Room {
  const id = `r${Math.max(0, ...state.office.map((r) => Number(r.id.slice(1)) || 0)) + 1}`;
  const [x0, y0] = placeRoom(state, width, height, kind);
  const room: Room = { id, kind, department: kind === 'department' ? department : '', cells: rectangle(width, height).map(([x, y]) => [x + x0, y + y0]) };
  state.office.push(room);
  doorToTouching(state, room);
  autoConnect(state);
  tidyDoors(state); // windows the new hallway now covers
  for (const r of state.office) addWindow(state, r);
  return room;
}

/** Points for the next square added to a room. */
export function squareCost(state: GameState): number {
  return Math.ceil(officeRules.squareBaseCost * Math.pow(officeRules.squareCostGrowth, state.squaresBought));
}

/**
 * Squares a room could grow into, in reading order: next to it, empty (not a
 * hallway) and not touching another room of its kind.
 */
export function expansionSquares(state: GameState, room: Room): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of room.cells) {
    for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]] as [number, number][]) {
      if (!hasCell(room, nx, ny) && !out.some(([ox, oy]) => ox === nx && oy === ny) && roomCanUse(state, nx, ny, room)) out.push([nx, ny]);
    }
  }
  return out.sort(readingOrder);
}

/** The square a room grows into when you don't choose: the one that keeps it most compact. */
export function bestExpansion(state: GameState, room: Room): [number, number] | undefined {
  const area = (cells: [number, number][]) => {
    const b = roomBounds({ ...room, cells });
    return (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
  };
  const options = expansionSquares(state, room);
  if (options.length === 0) return undefined;
  return options.reduce((best, c) => (area([...room.cells, c]) < area([...room.cells, best]) ? c : best), options[0]);
}

/** Adds one square to a room: `square` if given (it must be next to the room), else the most compact one. */
export function expandRoom(state: GameState, roomId: string, square?: [number, number]): boolean {
  const room = state.office.find((r) => r.id === roomId);
  const cost = squareCost(state);
  if (!room || state.currency < cost) return false;
  const target = square ?? bestExpansion(state, room);
  if (!target) return false;
  const [x, y] = target;
  if (!expansionSquares(state, room).some(([ex, ey]) => ex === x && ey === y)) return false;
  state.currency -= cost;
  const touched = touchingRooms(state, room);
  room.cells.push([x, y]);
  state.squaresBought++;
  doorToTouching(state, room, touched); // a door into a room it has just grown against
  tidyDoors(state); // a window in the wall it grew through is gone
  addWindow(state, room);
  seatWaiting(state);
  return true;
}

/** Where a new piece goes: the first spot it fits in a room of the kind it suits, else in any room it may stand in (turned if only that fits). */
export function furnitureSpot(state: GameState, kind = 'plant', roomKind?: Room['kind']): Omit<Furniture, 'kind'> | null {
  // Only rooms of roomKind when given; else rooms of the kind it suits first (decor in departments' rooms, comforts in break rooms).
  const first: Room['kind'] = roomKind ?? ((kindOf(kind)?.drain ?? 0) > 0 ? 'department' : 'break');
  const rooms = [...state.office.filter((r) => r.kind === first), ...(roomKind ? [] : state.office.filter((r) => r.kind !== first))];
  const [w, h] = pieceSize(kind);
  for (const room of rooms) {
    for (const [x, y] of bestSquares(state, room)) {
      if (fitsAt(state, room.id, kind, x, y)) return { room: room.id, x, y };
      if (w !== h && fitsAt(state, room.id, kind, x, y, true)) return { room: room.id, x, y, turned: true };
    }
  }
  return null;
}

/** Whether a piece of furniture hides the feng shui book, not yet read (it's in every bookshelf until then). */
export function hidesBook(state: GameState, index: number): boolean {
  return !state.fengShuiBook && state.furniture[index]?.kind === fengShui.hiddenIn;
}

/** Reads the feng shui book found in a piece: from then on chi counts, and the map shows it. */
export function readFengShuiBook(state: GameState, index: number): boolean {
  if (!hidesBook(state, index)) return false;
  state.fengShuiBook = true;
  return true;
}

/** Points for the next piece of a kind of furniture. */
export function furnitureCost(state: GameState, kind: string): number {
  const k = furnitureKinds.find((f) => f.id === kind);
  if (!k) return Infinity;
  const owned = state.furniture.filter((f) => f.kind === kind).length;
  return Math.ceil(k.cost * Math.pow(k.costGrowth, owned));
}

/** Buys a piece of furniture and stands it where it fits (see furnitureSpot), in a room of roomKind if given. */
export function buyFurniture(state: GameState, kind: string, roomKind?: Room['kind']): boolean {
  const cost = furnitureCost(state, kind);
  const spot = furnitureSpot(state, kind, roomKind);
  if (!spot || state.currency < cost) return false;
  state.currency -= cost;
  state.furniture.push({ kind, ...spot });
  return true;
}

/**
 * Turns a piece bigger than one square a quarter turn (a 2 x 1 couch stands
 * 1 x 2). It doesn't check the floor: that happens when the piece is put
 * down (see moveFurniture). One-square pieces don't turn.
 */
export function rotateFurniture(state: GameState, index: number): boolean {
  const f = state.furniture[index];
  if (!f) return false;
  const [w, h] = pieceSize(f.kind);
  if (w === h) return false;
  if (f.turned) delete f.turned;
  else f.turned = true;
  return true;
}

/** Moves a piece of furniture so its first square is x, y, if all its squares are free floor of one room. Desks stay in their department's room. */
export function moveFurniture(state: GameState, index: number, roomId: string, x: number, y: number): boolean {
  const f = state.furniture[index];
  if (!f || !fitsAt(state, roomId, f.kind, x, y, f.turned, index) || (f.kind === desk.id && f.room !== roomId)) return false;
  Object.assign(f, { room: roomId, x, y });
  return true;
}

/**
 * Gives a save from before rooms an office: a room for each department, grown
 * until it fits its monkeys, each with a desk.
 */
export function furnishOffice(state: GameState): void {
  state.furniture = state.furniture.filter((f) => f.kind !== desk.id);
  const depts = state.departments.length > 0 ? state.departments : [''];
  state.office = depts.map((g, i) => ({
    id: `r${i + 1}`,
    kind: 'department' as const,
    department: g,
    cells: i === 0 ? rectangle(officeRules.starterWidth, officeRules.starterHeight) : rectangle(officeRules.newRoomWidth, officeRules.newRoomHeight),
  }));
  state.monkeys.forEach((m) => {
    const room = state.office.find((r) => r.department === m.department) ?? state.office[0];
    if (freeSquares(state, room).length === 0) room.cells.push(bestExpansion(state, room) ?? [Math.max(...room.cells.map(([x]) => x)) + 1, 0]);
    const [x, y] = freeSquares(state, room)[0];
    state.furniture.push({ kind: desk.id, room: room.id, x, y });
  });
}

/** Typing monkeys (managers not counted) in a department. */
export function departmentTypists(state: GameState, genre: Genre | undefined): number {
  return departmentMonkeys(state, genre).filter((i) => !state.monkeys[i].manager).length;
}

/** Whether a new monkey has somewhere to go: a department with room, or (before any department) the first room. */
export function canSeatMonkey(state: GameState): boolean {
  if (departmentGenres(state).length === 0) return departmentTypists(state, undefined) < departmentRules.maxTypists && hasDeskSpace(state, undefined);
  return departmentsWithRoom(state).length > 0;
}

/** Open departments with room for another typing monkey: a free typing place and a free square for its desk. */
export function departmentsWithRoom(state: GameState): Genre[] {
  return departmentGenres(state).filter((g) => departmentTypists(state, g) < departmentRules.maxTypists && hasDeskSpace(state, g));
}

/**
 * Where a new monkey goes: `genre` if it has room; with no genre given, the
 * only department with room. Null if that's not possible (full, or a choice
 * the player has to make, or no square for a desk). Before any department is open, '' (no department).
 */
function placeFor(state: GameState, genre?: Genre): string | null {
  const rooms = departmentsWithRoom(state);
  if (departmentGenres(state).length === 0) return departmentTypists(state, undefined) < departmentRules.maxTypists && hasDeskSpace(state, undefined) ? '' : null;
  if (genre) return rooms.includes(genre) ? genre : null;
  return rooms.length === 1 ? rooms[0] : null;
}

/**
 * Buys a monkey with points for a department. The department can be left out
 * when only one has room; the player chooses otherwise.
 */
export function buyMonkey(state: GameState, genre?: Genre): boolean {
  const dept = placeFor(state, genre);
  if (dept === null) return false;
  const cost = nextMonkeyCost(state, (dept || undefined) as Genre | undefined);
  if (state.letters.length === 0 || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeysBought[dept] = (state.monkeysBought[dept] ?? 0) + 1;
  state.monkeys.push({ ...createMonkey(), department: dept });
  placeDesk(state, (dept || undefined) as Genre | undefined);
  return true;
}

/** Puts an earned monkey that's waiting for a department to work. */
export function assignMonkey(state: GameState, genre?: Genre): boolean {
  const dept = placeFor(state, genre);
  if (state.unassignedMonkeys === 0 || dept === null) return false;
  state.unassignedMonkeys--;
  state.monkeys.push({ ...createMonkey(), department: dept });
  placeDesk(state, (dept || undefined) as Genre | undefined);
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

let lineLimit = lineWidth;

/** How many letters a monkey's line holds before it starts over: a front end sets this to fit its screen. */
export function setLineWidth(letters: number): void {
  lineLimit = Math.max(10, Math.floor(letters) || lineWidth);
}

function addToLine(m: MonkeyState, segment: Segment): void {
  if (lineLength(m) + segment.text.length > lineLimit) m.line = [];
  m.line.push(segment);
}

export function keysUnlocked(state: GameState): boolean {
  return state.letters.length >= typewriterKeys.unlockLetters;
}

/** Points price of a combination or word key: word keys cost by length. */
export function keyCost(_state: GameState, key: string): number {
  const factor = typewriterKeys.combinations.includes(key)
    ? typewriterKeys.combinationCostFactor
    : typewriterKeys.wordCostPerLetter * key.length;
  return Math.ceil(typewriterKeys.baseCost * factor);
}

/** How many times a word must be spelled to unlock as your next word key. */
export function wordKeySpellsNeeded(state: GameState): number {
  const owned = state.keys.filter((k) => !typewriterKeys.combinations.includes(k)).length;
  return Math.ceil(typewriterKeys.wordSpellsToUnlock * typewriterKeys.wordSpellsGrowth ** owned);
}

/** Words your monkeys have spelled often enough to become keys, most spelled first. */
export function unlockedWordKeys(state: GameState): string[] {
  const needed = wordKeySpellsNeeded(state);
  return Object.entries(state.stats.words)
    .filter(([w, n]) => n >= needed && w.length >= typewriterKeys.wordMinLength)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([w]) => w);
}

/** Combination and word keys you could buy now: not owned, and spelled with your letters. */
export function availableKeys(state: GameState): string[] {
  if (!keysUnlocked(state)) return [];
  const usable = (list: string[]) =>
    list.filter((k) => !state.keys.includes(k) && [...k].every((c) => state.letters.includes(c)));
  // Alternate combinations and words so menus show both kinds.
  const combos = usable(typewriterKeys.combinations);
  const words = usable(unlockedWordKeys(state));
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

/** Everything a monkey can hit, with weights: your letters and your keys. */
export function keyboard(state: GameState): { text: string; weight: number }[] {
  return [
    ...state.letters.map((l) => ({ text: l, weight: 1 })),
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

/** Cost in Lines of a department's next word slot, given how many it has. */
export function slotCost(owned: number): number {
  return Math.ceil(wordSlots.baseCost * Math.pow(wordSlots.costGrowth, owned));
}

/** The genre of the department a slot belongs to. */
export function slotGenre(state: GameState, slot: WordSlot): Genre | undefined {
  const open = departmentGenres(state);
  return open.find((g) => g === slot.department) ?? open[0];
}

/** Indices (into state.slots) of a department's slots, by position. */
export function departmentSlots(state: GameState, genre: Genre | undefined): number[] {
  return state.slots
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => slotGenre(state, x) === genre)
    .sort((a, b) => a.x.position - b.x.position)
    .map(({ i }) => i);
}

/** Buys a slot for a department at its first free position. It starts on, with no word set. */
export function buySlot(state: GameState, genre = departmentGenres(state)[0]): boolean {
  const mine = departmentSlots(state, genre).map((i) => state.slots[i]);
  const cost = slotCost(mine.length);
  if (!slotsUnlocked(state) || mine.length >= wordSlots.maxSlots || state.lines < cost) return false;
  let position = 1;
  while (mine.some((x) => x.position === position)) position++;
  state.lines -= cost;
  state.slots.push({ department: genre ?? '', position, word: '', on: true });
  return true;
}

/** Sets a slot's word. It must be a word you can spell with your letters. Free, any time. */
export function setSlotWord(state: GameState, slot: number, word: string): boolean {
  const s = state.slots[slot];
  const w = word.toUpperCase();
  if (!s || !dictionaryFor(state, slotGenre(state, s)).isWord(w)) return false;
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
  const mine = departmentSlots(state, slotGenre(state, s)).map((i) => state.slots[i]);
  let p = s.position + delta;
  while (p >= 1 && mine.some((x) => x !== s && x.position === p)) p += delta;
  if (p < 1 || p > wordSlots.maxSlots + mine.length) return false;
  s.position = p;
  return true;
}

/**
 * The slot due for this monkey's next word, if any. Slots apply at a word
 * break; if the letters waiting are already a word, they count as the
 * previous word so the slot can follow them. Letters waiting that aren't a
 * word yet don't hold a slot up: the monkey drops them and types the slot's
 * word (with many letters and keys there's nearly always something waiting,
 * so otherwise slots would hardly ever apply).
 */
function dueSlot(state: GameState, m: MonkeyState, dict: Dictionary): string {
  const ready = m.pending !== '' && dict.isWord(m.pending) ? 1 : 0;
  const genre = monkeyGenre(state, m);
  const s = state.slots.find(
    (x) => x.on && x.word && x.position === m.chainLength + ready + 1 && slotGenre(state, x) === genre,
  );
  return s && dict.isWord(s.word) ? s.word : '';
}

/**
 * One monkey presses one key. If a word slot is due, it types the slot's word
 * as a finished word (it can't run into the next letters); otherwise it
 * presses a random key (usually a letter, or a combination or word key).
 */
/** Points paid for words (not line bonuses) since the module loaded; tick() uses the difference. */
let wordEarnings = 0;

export function typeLetter(state: GameState, index: number, rng: Rng = Math.random): void {
  const m = state.monkeys[index];
  if (!m || m.manager || state.letters.length === 0) return;
  const dict = dictionaryFor(state, monkeyGenre(state, m));
  const events: ReadEvent[] = [];
  const slot = dueSlot(state, m, dict);
  if (slot) {
    if (m.pending && dict.isWord(m.pending)) events.push({ kind: 'word', text: m.pending });
    events.push({ kind: 'word', text: slot });
    m.pending = '';
  } else {
    for (const letter of pressKey(state, rng)) {
      state.stats.letters[letter] = (state.stats.letters[letter] ?? 0) + 1;
      m.pending = readLetter(dict, m.pending, letter, events);
    }
  }
  for (const e of events) {
    if (e.kind === 'word') {
      const paid = scoreInChain(state, m, e.text) * pointsMultiplier(state, m) * managerMultiplier(state, m) * (1 + wearing(m, 'points'));
      earn(state, paid);
      wordEarnings += paid;
      state.wordsTyped++;
      state.lastWord = e.text;
      state.lastWordPoints = paid;
      countWord(state, m, e.text, paid, !!slot && e.text === slot);
      checkPlayLines(state, m);
    } else {
      endChain(state, m);
      m.chainWords = [];
      m.chainPoints = 0;
      m.chainRecent = [];
      m.chainLength = 0;
      m.chainCounted = 0;
      m.chainAll = [];
    }
    addToLine(m, { text: e.text, scored: e.kind === 'word' });
  }
}

/** Sentences a chain of `counted` long-enough words pays when it ends. */
export function chainSentences(counted: number): number {
  return counted < sentenceRules.chainWords ? 0 : 1 + Math.floor((counted - sentenceRules.chainWords) / sentenceRules.extraEvery);
}

/** A chain just broke: a long one pays Sentences. */
function endChain(state: GameState, m: MonkeyState): void {
  const n = chainSentences(m.chainCounted);
  state.sentences += n;
  state.stats.chainSentences += n;
  if (n === 0) return;
  state.stats.sentencesWritten++;
  if (m.chainAll.length > state.stats.longestSentence.length) state.stats.longestSentence = [...m.chainAll];
}

/** Records a scored word in the statistics. Slot words count their letters as typed here. */
function countWord(state: GameState, m: MonkeyState, word: string, paid: number, fromSlot: boolean): void {
  const st = state.stats;
  if (fromSlot) for (const l of word) st.letters[l] = (st.letters[l] ?? 0) + 1;
  if (!st.words[word]) state.words++; // a new word for the dictionary
  st.words[word] = (st.words[word] ?? 0) + 1;
  if (word.length > st.longestWord.length) st.longestWord = word;
  if (paid > st.bestWordPoints) {
    st.bestWord = word;
    st.bestWordPoints = paid;
  }
  st.longestChain = Math.max(st.longestChain, m.chainLength);
  if (word.length >= sentenceRules.wordMinLength) m.chainCounted++;
}

/** The combo multiplier: how many different long words are in the chain, up to the cap. */
export function comboMultiplier(state: GameState, m: MonkeyState): number {
  return Math.min(comboCap(state) + wearing(m, 'combo'), Math.max(1, m.chainWords.length));
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
  if (m.chainAll.length < sentenceRules.maxRecordWords) m.chainAll.push(word);
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
  const { byLetters } = ownedLines(state, monkeyGenre(state, m));
  if (byLetters.size === 0) return;
  let letters = '';
  for (let k = m.chainRecent.length - 1; k >= 0; k--) {
    letters = m.chainRecent[k] + letters;
    const matches = byLetters.get(letters);
    if (matches) typedLine(state, matches, m);
  }
}

/**
 * Rewards typing a line: a Sentence every time; a Line and a bonus the first
 * time. Identical lines (in any owned scene) are written one per typing.
 */
function typedLine(state: GameState, matches: Pin[], m: MonkeyState): void {
  const fresh = matches.find((p) => !(state.completed[p.play] ?? []).includes(p.index));
  const pick = fresh ?? matches[0];
  const play = plays.get(pick.play)!;
  const line = play.lines[pick.index];
  const verse = play.genre === 'sonnet';
  const sentence = !verse && line.words.length >= lineRewards.sentenceMinWords;
  if (sentence) state.sentences++;
  state.stats.linesTyped++;
  const longest = state.stats.longestLine;
  const longestLetters = longest ? (plays.get(longest.play)?.lines[longest.index]?.letters.length ?? 0) : 0;
  if (line.letters.length > longestLetters) state.stats.longestLine = { play: play.id, index: pick.index };
  let points = 0;
  if (fresh) {
    (state.completed[play.id] ??= []).push(fresh.index);
    state.lines += verse ? sonnetRewards.linesPerLine : 1;
    points = line.points * line.words.length ** (verse ? 1 : 2) * pointsMultiplier(state, m) * managerMultiplier(state, m) * (1 + wearing(m, 'points'));
    earn(state, points);
    state.stats.bestLinePoints = Math.max(state.stats.bestLinePoints, points);
  }
  state.lastLine = { play: play.id, index: pick.index, firstTime: !!fresh, points, sentence };
  if (fresh) {
    checkMilestones(state, play, fresh.index);
    if (state.monkeys.some((x) => x.manager)) manage(state); // managers move on right away
  }
}

/**
 * After a new line, rewards its scene, act and play if they're now fully
 * written. Bonuses depend only on what was finished, never on how it was bought.
 */
function checkMilestones(state: GameState, play: Play, index: number): void {
  const done = new Set(state.completed[play.id] ?? []);
  const finished = (sc: Scene) => sc.lines.every((i) => done.has(i));
  const sc = sceneOf(play, index);
  if (!sc || !finished(sc)) return;
  const { act, scene } = sc;
  const sceneKey = `${play.id}:${sc.key}`;
  if (play.genre === 'sonnet') {
    if (state.scenesDone.includes(sceneKey)) return;
    state.scenesDone.push(sceneKey);
    const lines = sc.lines.length * sonnetRewards.linesPerSonnetLine;
    state.lines += lines;
    state.lastMilestone = { kind: 'sonnet', play: play.id, act, scene, sentences: 0, bonus: lines };
    if (play.scenes.every(finished)) {
      state.playsDone.push(play.id);
      state.lastMilestone = { kind: 'play', play: play.id, act: 0, scene: 0, sentences: 0, bonus: 0 };
    }
    return;
  }
  if (!state.scenesDone.includes(sceneKey)) {
    state.scenesDone.push(sceneKey);
    const sentences = Math.max(1, Math.round(sc.lines.length * milestones.sceneSentencesPerLine));
    const bonus = sceneBonus(sc);
    state.sentences += sentences;
    state.pointsBonus += bonus;
    state.lastMilestone = { kind: 'scene', play: play.id, act, scene, sentences, bonus };
  }
  if (!play.scenes.filter((x) => x.act === act).every(finished)) return;
  const actKey = `${play.id}:${act}`;
  if (!state.actsDone.includes(actKey)) {
    state.actsDone.push(actKey);
    const bonus = actBonus(play, act);
    state.speedBonus += bonus;
    // Free monkeys start work at once if only one department has room; otherwise they wait for the player to pick.
    for (let k = 0; k < milestones.actFreeMonkeys; k++) {
      state.unassignedMonkeys++;
      if (departmentsWithRoom(state).length <= 1) assignMonkey(state);
    }
    state.lastMilestone = { kind: 'act', play: play.id, act, scene: 0, sentences: 0, bonus };
  }
  if (play.scenes.every(finished) && !state.playsDone.includes(play.id)) {
    state.playsDone.push(play.id);
    state.lastMilestone = { kind: 'play', play: play.id, act: 0, scene: 0, sentences: 0, bonus: 0 };
  }
}

/**
 * The player pets the least happy typing monkey (the first, on a tie): it
 * gets a little happier (see `petting`). Returns its index, or -1.
 */
export function poke(state: GameState): number {
  let i = -1;
  state.monkeys.forEach((m, k) => {
    if (!m.manager && (i < 0 || m.petHappiness < state.monkeys[i].petHappiness)) i = k;
  });
  if (i < 0) return -1;
  const m = state.monkeys[i];
  m.petHappiness = Math.min(petting.maxHappiness, m.petHappiness + petting.happinessPerPet);
  state.stats.pets++;
  checkAchievements(state);
  return i;
}

/** Monkeys working in a department (managers included). */
export function departmentMonkeys(state: GameState, genre: Genre | undefined): number[] {
  return state.monkeys.flatMap((m, i) => (monkeyGenre(state, m) === genre ? [i] : []));
}

/** Whether a monkey can be promoted: its department is big enough and has no manager yet. */
export function canPromote(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  if (!m || m.manager) return false;
  const team = departmentMonkeys(state, monkeyGenre(state, m));
  return team.length > managers.minDepartmentMonkeys && !team.some((i) => state.monkeys[i].manager);
}

/** A department's manager, if it has one. */
export function managerOf(state: GameState, genre: Genre | undefined): MonkeyState | undefined {
  return departmentMonkeys(state, genre)
    .map((i) => state.monkeys[i])
    .find((m) => m.manager);
}

/** Points multiplier from a monkey's department manager: x1 plus bonusPerLevel per upgrade. */
export function managerMultiplier(state: GameState, m: MonkeyState): number {
  const boss = managerOf(state, monkeyGenre(state, m));
  return 1 + (boss ? managers.bonusPerLevel * boss.managerLevel : 0);
}

/** Lines price of a manager's next upgrade: grows with its department's size and each level. */
export function managerUpgradeCost(state: GameState, m: MonkeyState): number {
  const team = departmentMonkeys(state, monkeyGenre(state, m)).length;
  return Math.ceil(managers.linesPerMonkey * team * Math.pow(managers.upgradeCostGrowth, m.managerLevel));
}

/** Upgrades a manager with Lines. */
export function upgradeManager(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  if (!m?.manager) return false;
  const cost = managerUpgradeCost(state, m);
  if (state.lines < cost) return false;
  state.lines -= cost;
  m.managerLevel++;
  return true;
}

/** Promotes a monkey to manager, or sends a manager back to typing. */
export function toggleManager(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  if (!m) return false;
  if (m.manager) {
    // Back to typing only if the department has a free typing seat.
    if (departmentTypists(state, monkeyGenre(state, m)) >= departmentRules.maxTypists) return false;
    m.manager = false;
    if (m.target) unpin(state, m.target);
    m.target = null;
    return true;
  }
  if (!canPromote(state, index)) return false;
  m.manager = true;
  m.pending = '';
  m.progress = 0;
  manage(state);
  return true;
}

function unpin(state: GameState, pin: Pin): void {
  state.pinned = state.pinned.filter((p) => !samePin(p, pin));
}

/**
 * The line a manager targets among a genre's unwritten owned lines: one
 * within reach (your letters can spell it) if any, then the fewest words,
 * then the earliest in play order. Null when every owned line is written.
 */
export function managerLine(state: GameState, genre: Genre | undefined): Pin | null {
  let best: Pin | null = null;
  let bestRank: [number, number] = [2, Infinity]; // [0 if within reach else 1, words]
  for (const play of plays.values()) {
    if (play.genre !== genre) continue;
    const done = new Set(state.completed[play.id] ?? []);
    play.lines.forEach((line, index) => {
      if (done.has(index) || !ownsLine(state, play, index)) return;
      const rank: [number, number] = [inReach(state, line.letters) ? 0 : 1, line.words.length];
      if (rank[0] < bestRank[0] || (rank[0] === bestRank[0] && rank[1] < bestRank[1])) {
        best = { play: play.id, index };
        bestRank = rank;
      }
    });
  }
  return best;
}

/** Letters and script owned when each department's manager last chose a line it couldn't reach. */
const managerChecked = new Map<string, string>();

/**
 * Runs the managers: each keeps its department's target on an unwritten
 * line (see managerLine), pins it, and fills its department's word slots
 * with the line's words, by position.
 */
export function manage(state: GameState): void {
  for (const genre of departmentGenres(state)) {
    const boss = managerOf(state, genre);
    if (!boss) continue;
    const t = boss.target;
    const done = t && (state.completed[t.play] ?? []).includes(t.index);
    // An out-of-reach target is reconsidered when letters or script change, in case a line came within reach.
    const key = `${state.letters.join('')}|${state.owned.join('|')}`;
    const line = t && plays.get(t.play)?.lines[t.index];
    const stale = !!line && !inReach(state, line.letters) && managerChecked.get(genre) !== key;
    if (!t || done || stale) {
      if (t) unpin(state, t);
      boss.target = managerLine(state, genre);
      const picked = boss.target && plays.get(boss.target.play)?.lines[boss.target.index];
      if (picked && !inReach(state, picked.letters)) managerChecked.set(genre, key);
      if (boss.target && state.pinned.length < maxPinnedLines && !state.pinned.some((p) => samePin(p, boss.target!))) {
        state.pinned.push(boss.target);
      }
    }
    // Slots past the line's end switch off; with no line left they all do, so typing is random again.
    const words = boss.target ? plays.get(boss.target.play)!.lines[boss.target.index].words : [];
    for (const i of departmentSlots(state, genre)) {
      const slot = state.slots[i];
      const word = words[slot.position - 1];
      slot.word = word ?? slot.word;
      slot.on = !!word;
    }
  }
}

/** Letters per second for a monkey at a given typing skill level (before bonuses). */
export function lettersPerSecond(level: number): number {
  return typing.baseLettersPerSecond * Math.pow(typing.speedPerLevel, level);
}

export function typingUpgradeCost(level: number): number {
  return Math.ceil(typing.upgradeBaseCost * Math.pow(typing.upgradeCostGrowth, level));
}

/** The highest typing skill a monkey's typewriter allows. */
export function skillCap(m: MonkeyState): number {
  return (m.typewriter + 1) * typing.levelsPerTypewriter;
}

/** Name of a typewriter tier. */
export function typewriterName(tier: number): string {
  return typing.typewriters[tier] ?? `Typewriter Mk ${tier + 1}`;
}

/** Points price of a monkey's next typewriter. */
export function typewriterCost(m: MonkeyState): number {
  return Math.ceil(typing.typewriterBaseCost * Math.pow(typing.typewriterCostGrowth, m.typewriter));
}

/** Buys one level of typing skill ("Faster typing") for monkey `index`, up to its typewriter's cap. */
export function buyFasterTyping(state: GameState, index = 0): boolean {
  const m = state.monkeys[index];
  if (!m || state.letters.length === 0 || m.skill >= skillCap(m)) return false;
  const cost = typingUpgradeCost(m.skill);
  if (state.currency < cost) return false;
  state.currency -= cost;
  m.skill++;
  return true;
}

/** Buys monkey `index` a better typewriter, allowing another set of skill levels. */
export function buyTypewriter(state: GameState, index = 0): boolean {
  const m = state.monkeys[index];
  if (!m || state.letters.length === 0) return false;
  const cost = typewriterCost(m);
  if (state.currency < cost) return false;
  state.currency -= cost;
  m.typewriter++;
  return true;
}

export function tick(state: GameState, seconds: number, rng: Rng = Math.random, lettersPerSecondCap = maxSimulatedLettersPerSecond): void {
  if (seconds <= 0 || state.letters.length === 0) return;
  state.stats.secondsTyping += seconds;
  for (const m of state.monkeys) m.petHappiness = Math.max(0, m.petHappiness - (petting.fadePerMinute * seconds) / 60);
  manage(state);
  const due = state.monkeys.map((m) => {
    if (m.manager || !canReachDesk(state, m)) return 0;
    m.progress += monkeySpeed(state, m) * spendEnergy(m, seconds, energyRates(state, m));
    const n = Math.floor(m.progress);
    m.progress -= n;
    return n;
  });
  const total = due.reduce((a, b) => a + b, 0);
  const budget = Math.max(state.monkeys.length, Math.floor(lettersPerSecondCap * seconds));
  const share = total > budget ? budget / total : 1;
  const before = wordEarnings;
  const wordsBefore = state.wordsTyped;
  due.forEach((n, i) => {
    const typed = share < 1 ? Math.round(n * share) : n;
    for (let k = 0; k < typed; k++) typeLetter(state, i, rng);
  });
  // Letters past the budget earn what the simulated ones did for words, on average.
  if (share < 1) {
    const extra = total / Math.max(1, due.reduce((a, n) => a + Math.round(n * share), 0)) - 1;
    earn(state, (wordEarnings - before) * extra);
    state.wordsTyped += Math.round((state.wordsTyped - wordsBefore) * extra);
  }
  checkAchievements(state);
}

/** How far along an achievement's measure is (see `achievements` in config.ts). */
export function achievementValue(state: GameState, stat: string): number {
  const ms = state.monkeys;
  const most = (f: (m: MonkeyState) => number) => ms.reduce((n, m) => Math.max(n, f(m)), 0);
  if (stat.startsWith('word:')) return state.stats.words[stat.slice(5)] ?? 0;
  if (stat.startsWith('wearing:')) return ms.filter((m) => m.hat === stat.slice(8)).length;
  switch (stat) {
    case 'wordsSpelled': return state.wordsTyped;
    case 'lettersOwned': return state.letters.length;
    case 'chain': return state.stats.longestChain;
    case 'chainSentences': return state.stats.chainSentences;
    case 'linesWritten': return Object.values(state.completed).reduce((n, l) => n + l.length, 0);
    case 'scenes': return state.scenesDone.length;
    case 'acts': return state.actsDone.length;
    case 'plays': return state.playsDone.length;
    case 'monkeys': return ms.length;
    case 'named': return ms.filter((m) => m.name).length;
    case 'managers': return ms.filter((m) => m.manager).length;
    case 'departments': return state.departments.length;
    case 'rooms': return state.office.length;
    case 'furniture': return state.furniture.filter((f) => f.kind !== desk.id).length;
    case 'harmony': return state.office.filter((r) => roomChi(state, r) === 1).length;
    case 'hats': return ms.reduce((n, m) => n + m.hats.length, 0);
    case 'hatKinds': return new Set(ms.flatMap((m) => m.hats)).size;
    case 'dyed': return state.stats.dyes;
    case 'skill': return most((m) => m.skill);
    case 'typewriter': return most((m) => m.typewriter);
    case 'keys': return state.keys.length;
    case 'slots': return state.slots.length;
    case 'pets': return state.stats.pets;
    case 'happiest': return ms.filter((m) => m.petHappiness >= petting.maxHappiness - 1e-9).length;
    case 'longestWord': return state.stats.longestWord.length;
    case 'dictionary': return Object.keys(state.stats.words).length;
    case 'lettersTyped': return Object.values(state.stats.letters).reduce((n, c) => n + c, 0);
    case 'biggestDepartment': {
      const sizes = new Map<string, number>();
      for (const m of ms) sizes.set(monkeyGenre(state, m) ?? '', (sizes.get(monkeyGenre(state, m) ?? '') ?? 0) + 1);
      return Math.max(0, ...sizes.values());
    }
    case 'hoursTyping': return state.stats.secondsTyping / 3600;
    case 'points': return state.totalEarned;
    case 'folios': return state.folios;
    default: return 0;
  }
}

/** Unlocks every achievement whose measure is reached. Returns the ids newly unlocked. */
export function checkAchievements(state: GameState): string[] {
  const got: string[] = [];
  for (const a of achievements) {
    if (!state.achievements.includes(a.id) && achievementValue(state, a.stat) >= a.at) {
      state.achievements.push(a.id);
      got.push(a.id);
    }
  }
  return got;
}

/**
 * Credits typing for time spent away. Returns the points earned. Long
 * absences with many monkeys simulate only the first maxOfflineLetters
 * letters and scale up the points and words from those.
 */
export function applyOfflineProgress(state: GameState, now: number, rng: Rng = Math.random): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSaved) / 1000), maxOfflineSeconds);
  const letters = seconds * state.monkeys.reduce((n, m) => n + (m.manager ? 0 : monkeySpeed(state, m)), 0);
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
