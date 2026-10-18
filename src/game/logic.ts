import {
  combo,
  letterGifts,
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
  dye,
  desk,
  furnitureKinds,
  startingLetters,
  typewriterKeys,
  wordSlots,
  typing,
  petting,
  lately,
  achievements,
  folio,
  fengShui,
  managerDesk,
  managerOffice,
  managerBook,
  traits,
  traitRules,
  type Trait,
  research,
  type ResearchProject,
  hr,
  marketing,
  codebreaking,
  library,
  safe,
  safes,
  translation,
  enigma,
  monkeyStats,
  coinFlip,
  sellBack,
} from './config';
import { allGenres, buildPlay, departmentOf, genres, greekLetters, isForeign, playGenres, type Genre, type Play, type PlayData, type Scene } from './plays';
import { createInitialState, createMonkey, monkeyNameFor, rectangle, type Candidate, type Furniture, type GameState, type Room, type MonkeyState, type SafeState, type TelegramState, type Pin, type Segment, type WordSlot } from './state';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from './words';
import { addWindow, autoConnect, connectedRooms, doorBetween, doorToTouching, loungeOf, moveRoom, placeRoom, roomCanUse, roomFits, tidyDoors, touchingRooms, type Square } from './layout';
import { chiHappiness, roomChi, spaceFactor, squareRank, varietyBonus } from './fengshui';
import { encipher, randomKey } from './enigma';

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
let latinLetters: string[] = []; // the capitals in the Latin texts, which Latin monkeys type
let longestLine = 0;

/** Registers the plays whose scenes can be bought; the front end loads them. */
export function setPlays(list: readonly PlayData[]): void {
  plays.clear();
  // Foreign texts come after the plays, so the script opens on a play.
  const foreign = (d: PlayData) => Number(isForeign(d.genre));
  for (const data of [...list].sort((a, b) => foreign(a) - foreign(b))) plays.set(data.id, buildPlay(data));
  latinLetters = [...new Set([...plays.values()].filter((p) => p.genre === 'latin').flatMap((p) => p.lines.flatMap((l) => [...l.letters])))].sort();
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
  const list = state.departments.filter((g): g is Genre => allGenres.includes(g as Genre));
  for (const k of state.owned) {
    const g = plays.get(k.split(':')[0])?.genre;
    if (g && !list.includes(departmentOf(g))) list.push(departmentOf(g));
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

/** Whether a monkey works in R&D. */
export function isResearcher(m: MonkeyState): boolean {
  return m.department === research.id;
}

/** Whether a monkey works in HR. */
export function isHR(m: MonkeyState): boolean {
  return m.department === hr.id;
}

/** Whether a monkey works in Marketing. */
export function isMarketer(m: MonkeyState): boolean {
  return m.department === marketing.id;
}

/** Whether a monkey works outside the play departments (R&D, HR or Marketing). */
export function isStaff(m: MonkeyState): boolean {
  return isResearcher(m) || isHR(m) || isMarketer(m) || isCodebreaker(m);
}

/** Whether a monkey works in Codebreaking. */
export function isCodebreaker(m: MonkeyState): boolean {
  return m.department === codebreaking.id;
}

/** Whether a monkey types: not a manager, not in R&D or HR. */
export function isTypist(m: MonkeyState): boolean {
  return !m.manager && !isStaff(m);
}

/** The genre a monkey works in (none for R&D or HR). */
export function monkeyGenre(state: GameState, m: MonkeyState): Genre | undefined {
  if (isStaff(m)) return undefined;
  const open = departmentGenres(state);
  return open.find((g) => g === m.department) ?? open[0];
}

/** Moves a monkey to the next open department, round the list. R&D and HR monkeys stay put. */
export function moveMonkey(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  const open = departmentGenres(state);
  if (!m || open.length < 2 || isStaff(m)) return false;
  // The next department round the list that has room.
  const at = open.indexOf(monkeyGenre(state, m)!);
  const from = monkeyGenre(state, m);
  const next = [...open.slice(at + 1), ...open.slice(0, at)].find(
    (g) => departmentTypists(state, g) < departmentRules.maxTypists && hasDeskSpace(state, g),
  );
  if (!next) return false;
  // Its desk moves with it (a manager's desk stays in its office).
  const oldRoom = m.manager && officeOf(state, from) ? undefined : departmentRoom(state, from);
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
  if (!play || state.owned.length === 0 || !departmentGenres(state).includes(departmentOf(play.genre))) return false;
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
  return (1 + state.pointsBonus) * (1 + happiness(state, m && monkeyGenre(state, m))) * folioMultiplier(state) * (m ? 1 + traitBonus(state, m, 'pay') : 1) * (1 + researchBonus(state, 'points')) * (1 + libraryBonus(state));
}

/** Points are multiplied by this for good: every Folio published multiplies it by 1 + its pages x bonusPerPage. */
export function folioMultiplier(state: GameState): number {
  return state.folioBoost;
}

/** What folioMultiplier would be after publishing a Folio now. */
export function folioMultiplierAfter(state: GameState): number {
  return state.folioBoost * (1 + folioPagesNow(state) * folio.bonusPerPage);
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
  shelveBooks(state);
  const next = createInitialState(state.lastSaved);
  next.folios = state.folios + 1;
  next.shelved = [...state.shelved, `folio-${next.folios}`];
  next.galleries = state.galleries;
  next.folioPages = state.folioPages + folioPagesNow(state);
  next.folioBoost = folioMultiplierAfter(state);
  next.achievements = [...state.achievements];
  next.letterGifts = [...state.letterGifts];
  next.freeLetters = state.freeLetters;
  next.stats = state.stats;
  next.settings = state.settings;
  checkAchievements(next);
  return next;
}

/** Typing speed is multiplied by this; finished acts raise it. */
export function speedMultiplier(state: GameState): number {
  return 1 + state.speedBonus + researchBonus(state, 'speed');
}

/** Letters per second for a monkey, from its typing skill and act bonuses. */
export function monkeySpeed(state: GameState, m: MonkeyState, skill = m.skill): number {
  return lettersPerSecond(skill) * speedMultiplier(state) * (1 + wearing(m, 'speed')) * (1 + traitBonus(state, m, 'speed')) * (m.speedStat || 1) * (1 + jobBonus(m)) * (1 + roomEffect(state, m, 'speed'));
}

let hour = 12;

/** Sets the hour of the day (0-23) for traits that care whether it's day or night; the front end keeps it on the player's clock. */
export function setHour(h: number): void {
  hour = ((Math.floor(h) % 24) + 24) % 24;
}

/** Whether it's day by the clock setHour keeps (see traitRules). */
export function isDay(): boolean {
  return hour >= traitRules.dayStart && hour < traitRules.nightStart;
}

/** A monkey's trait, if it has been given one. */
export function traitOf(m: MonkeyState): Trait | undefined {
  return traits.find((t) => t.id === m.trait);
}

/** Gives every monkey without a trait a random one, and without hidden stats random ones. They work from then on, seen or not. */
export function giveTraits(state: GameState, rng: Rng): void {
  for (const m of state.monkeys) {
    if (!m.trait) m.trait = traits[Math.min(traits.length - 1, Math.floor(rng() * traits.length))].id;
    const stat = () => Math.round((monkeyStats.min + rng() * (monkeyStats.max - monkeyStats.min)) * 100) / 100;
    if (!m.speedStat) m.speedStat = stat();
    if (!m.stamina) m.stamina = stat();
    for (const j of monkeyStats.jobs) {
      if (m.jobs[j.id]) continue;
      let r = rng();
      const f = monkeyStats.feelings.find((x) => (r -= x.weight) < 0) ?? monkeyStats.feelings[monkeyStats.feelings.length - 1];
      m.jobs = { ...m.jobs, [j.id]: f.id };
    }
  }
}

/** The job a monkey does: managing, research, hr or typing (a monkeyStats.jobs id). */
export function jobOf(m: MonkeyState): string {
  return m.manager ? 'managing' : isResearcher(m) ? 'research' : isHR(m) ? 'hr' : isMarketer(m) ? 'marketing' : isCodebreaker(m) ? 'codebreaking' : 'typing';
}

/** How a monkey feels about a job (fine until its stats are picked). */
export function jobFeeling(m: MonkeyState, job: string): (typeof monkeyStats.feelings)[number] {
  return monkeyStats.feelings.find((f) => f.id === m.jobs[job]) ?? monkeyStats.feelings.find((f) => f.id === 'fine')!;
}

/** What a monkey's feeling about the job it does adds (0.2 = +20%), seen or not. */
export function jobBonus(m: MonkeyState): number {
  return jobFeeling(m, jobOf(m)).bonus;
}

/** Whether the hidden stats show: once an HR office is built. */
export function statsShown(state: GameState): boolean {
  return !!hrRoom(state);
}

/** The room a monkey works in: a manager's office, else its department's room. */
export function workRoom(state: GameState, m: MonkeyState): Room | undefined {
  if (isResearcher(m)) return labRoom(state);
  if (isHR(m)) return hrRoom(state);
  if (isMarketer(m)) return marketingRoom(state);
  if (isCodebreaker(m)) return codebreakingRoom(state);
  const genre = monkeyGenre(state, m);
  return (m.manager ? officeOf(state, genre) : undefined) ?? departmentRoom(state, genre);
}

/**
 * How a monkey's trait is going, from 1 (its condition is good: full bonus) to
 * -1 (bad: its penalty); 0 is neither. Social goes up by the monkey in its room.
 */
export function traitMood(state: GameState, m: MonkeyState): number {
  const room = workRoom(state, m);
  const inRoom = (kinds: string[]) => !!room && state.furniture.some((f) => f.room === room.id && kinds.includes(f.kind));
  const typists = room?.kind === 'department' ? departmentTypists(state, monkeyGenre(state, m)) : room?.kind === 'lab' ? researchers(state).length : room?.kind === 'hr' ? hrStaff(state).length : room?.kind === 'marketing' ? marketers(state).length : room?.kind === 'codebreaking' ? codebreakers(state).length : 1;
  switch (m.trait) {
    case 'claustrophobic': {
      const index = state.monkeys.indexOf(m);
      const seat = index >= 0 ? deskOf(state, index) : undefined;
      if (seat === undefined) return 0;
      const { x, y } = state.furniture[seat];
      const within = (n: number) => (d: { x: number; y: number }) => Math.abs(d.x - x) + Math.abs(d.y - y) <= n;
      if (state.windows.some(within(1))) return 1;
      return state.doors.some(within(traitRules.claustrophobicReach)) || state.windows.some(within(traitRules.claustrophobicReach)) ? 0 : -1;
    }
    case 'nightowl':
      return isDay() ? -1 : 1;
    case 'earlybird':
      return isDay() ? 1 : -1;
    case 'social': {
      const most = traitOf(m)?.speed?.[0] ?? 0;
      return most > 0 ? Math.min(1, (traitRules.socialPerMonkey * Math.max(0, typists - 1)) / most) : 0;
    }
    case 'loner':
      return typists <= traitRules.lonerFew ? 1 : typists >= traitRules.lonerCrowd ? -1 : 0;
    case 'greenthumb':
      return inRoom(traitRules.greenthumbPlants) ? 1 : 0;
    case 'bookworm':
      return inRoom(traitRules.bookwormBooks) ? 1 : 0;
    case 'couchpotato': {
      const lounge = loungeOf(state, departmentRoom(state, monkeyGenre(state, m)));
      return !!lounge && state.furniture.some((f) => f.room === lounge.id && traitRules.couchpotatoSeats.includes(f.kind)) ? 1 : 0;
    }
    case 'perfectionist':
    case 'slacker':
      return 1;
    default:
      return 0;
  }
}

/** What a monkey's trait does to one thing right now (0.1 = +10%): see traits in config.ts. */
export function traitBonus(state: GameState, m: MonkeyState, effect: 'speed' | 'pay' | 'rest'): number {
  const [good, bad] = traitOf(m)?.[effect] ?? [0, 0];
  if (good === 0 && bad === 0) return 0;
  const mood = traitMood(state, m);
  return mood >= 0 ? good * mood : bad * -mood;
}

/** The other monkeys who work in the same room as a monkey. */
export function roomMates(state: GameState, m: MonkeyState): MonkeyState[] {
  const room = workRoom(state, m);
  return room ? state.monkeys.filter((o) => o !== m && workRoom(state, o) === room) : [];
}

/** What the traits of a monkey's room-mates do to it (0.05 = +5%), up to traitRules.maxRoomEffect either way. */
export function roomEffect(state: GameState, m: MonkeyState, effect: 'happiness' | 'speed'): number {
  const n = roomMates(state, m).reduce((sum, o) => sum + (traitOf(o)?.room?.[effect] ?? 0), 0);
  return Math.max(-traitRules.maxRoomEffect, Math.min(traitRules.maxRoomEffect, n));
}

/** What a monkey's hat gives it for one effect. */
export function wearing(m: MonkeyState, effect: 'points' | 'speed' | 'drain' | 'rest' | 'combo'): number {
  return hats.find((h) => h.id === m.hat)?.[effect] ?? 0;
}

/**
 * The player's inventory keeps hats by kind and dye: 'tophat', or
 * 'tophat:red' for a dyed one (Justin, 2026-10-16: no wardrobes, one
 * inventory for furniture and hats).
 */
export function hatKey(id: string, color = ''): string {
  return color ? `${id}:${color}` : id;
}

export function splitHatKey(key: string): { id: string; color: string } {
  const [id, color = ''] = key.split(':');
  return { id, color };
}

/** How many hats of a kind the player has: worn and in the inventory. */
export function hatsOwned(state: GameState, id: string): number {
  return (
    state.monkeys.filter((m) => m.hat === id).length +
    Object.entries(state.stored.hats).reduce((n, [key, k]) => n + (splitHatKey(key).id === id ? k : 0), 0)
  );
}

/** A hat of this kind in the inventory (undyed first), or undefined. */
export function storedHat(state: GameState, id: string): string | undefined {
  return state.stored.hats[id] ? id : Object.keys(state.stored.hats).find((key) => splitHatKey(key).id === id);
}

/** Sentences for the next hat of a kind: each costs costGrowth times the last, counting every one owned. */
export function hatCost(state: GameState, id: string): number {
  const h = hats.find((x) => x.id === id);
  if (!h) return Infinity;
  return Math.ceil(h.cost * Math.pow(h.costGrowth, hatsOwned(state, id)));
}

/** A monkey takes its hat off; it goes into the inventory, dye and all. */
function takeOffHat(state: GameState, m: MonkeyState): void {
  if (!m.hat) return;
  const key = hatKey(m.hat, m.hatColor);
  state.stored.hats[key] = (state.stored.hats[key] ?? 0) + 1;
  m.hat = '';
  m.hatColor = '';
}

/**
 * Puts a hat on a monkey: a new one bought with Sentences (the store always
 * sells a new one, Justin 2026-10-16), or with `key` the one from the
 * inventory, for free. The hat it wore goes into the inventory. Buying the
 * kind it already wears takes that off instead.
 */
export function wearHat(state: GameState, index: number, id: string, key?: string): boolean {
  const m = state.monkeys[index];
  if (!m || !hats.some((h) => h.id === id)) return false;
  if (m.hat === id && !key) {
    takeOffHat(state, m);
    return true;
  }
  const stored = key && state.stored.hats[key] ? key : undefined;
  if (key && !stored) return false;
  const cost = stored ? 0 : hatCost(state, id);
  if (state.sentences < cost) return false;
  state.sentences -= cost;
  if (stored) unstore(state.stored.hats, stored);
  takeOffHat(state, m);
  m.hat = id;
  m.hatColor = stored ? splitHatKey(stored).color : '';
  return true;
}

/**
 * Dyes a monkey's hat a colour (a hatColors id) for dyeCost(state) Sentences; '' washes
 * the dye out for free. It needs to be wearing a hat.
 */
export function dyeHat(state: GameState, index: number, color: string): boolean {
  const m = state.monkeys[index];
  if (!m || !m.hat || m.hatColor === color) return false;
  if (!color) {
    m.hatColor = '';
    return true;
  }
  if (!hatColors.some((c) => c.id === color) || state.sentences < dyeCost(state)) return false;
  state.sentences -= dyeCost(state);
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
  const room = workRoom(state, m);
  return !room || connectedRooms(state).has(room.id);
}

/** A monkey's speed right now: tiredness slows it, and on a break (or locked out of its room) it doesn't type. */
export function currentSpeed(state: GameState, m: MonkeyState): number {
  return !isTypist(m) || m.resting || !canReachDesk(state, m) ? 0 : monkeySpeed(state, m) * energyFactor(m.energy);
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

/** How much slower a department's monkeys tire, from the decor in its room and its lounge (0.1 = 10%), times feng shui's space factor. */
export function drainCut(state: GameState, genre: Genre | undefined): number {
  return Math.min(0.9, Math.min(energyRules.maxDrainCut, furnitureSum(state, genre, 'drain')) * spaceFactor(state, enjoyedRooms(state, genre)));
}

/** How much faster a department's breaks go, from the comforts in its room and its lounge (0.5 = 50%), with feng shui's space and variety. */
export function restBoost(state: GameState, genre: Genre | undefined): number {
  const rooms = enjoyedRooms(state, genre);
  return Math.min(energyRules.maxRestBoost, furnitureSum(state, genre, 'rest')) * spaceFactor(state, rooms) + varietyBonus(state, rooms);
}

/** A department's happiness from the furniture in its room and its lounge (capped, then with feng shui's space and variety): points x (1 + happiness), and its monkeys tire slower and rest faster. */
export function furnitureHappiness(state: GameState, genre: Genre | undefined): number {
  const rooms = enjoyedRooms(state, genre);
  return Math.min(energyRules.maxHappiness, furnitureSum(state, genre, 'happiness')) * spaceFactor(state, rooms) + varietyBonus(state, rooms);
}

/** A department's happiness: its furniture's, plus the whole office's feng shui (see fengshui.ts) and HR's. */
export function happiness(state: GameState, genre: Genre | undefined): number {
  return furnitureHappiness(state, genre) + chiHappiness(state) + hrHappiness(state);
}

/** A monkey's happiness: its department's, plus its own from petting. Happier monkeys tire slower and rest faster. */
export function monkeyHappiness(state: GameState, m: MonkeyState): number {
  return happiness(state, monkeyGenre(state, m)) + m.petHappiness + roomEffect(state, m, 'happiness');
}

/** Seconds of typing that drain a monkey, and of rest that refill it, with the office's furniture and its happiness. */
export function energyRates(state: GameState, m: MonkeyState): EnergyRates {
  const happy = 1 + monkeyHappiness(state, m);
  return {
    drainSeconds: (energyRules.drainSeconds * happy * (m.stamina || 1)) / ((1 - drainCut(state, monkeyGenre(state, m))) * (1 - Math.min(0.9, wearing(m, 'drain'))) * (1 - Math.min(0.9, researchBonus(state, 'drain')))),
    breakSeconds: energyRules.breakSeconds / ((1 + restBoost(state, monkeyGenre(state, m))) * (1 + wearing(m, 'rest')) * (1 + traitBonus(state, m, 'rest')) * (1 + researchBonus(state, 'rest')) * happy),
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
export function inReach(state: GameState, letters: string, genre?: Genre): boolean {
  for (const c of letters) if (!hasLetter(state, c, genre)) return false;
  return true;
}

export function missingLetters(state: GameState, letters: string, genre?: Genre): string[] {
  return [...new Set(letters)].filter((c) => !hasLetter(state, c, genre)).sort();
}

/** Whether monkeys can type a letter of a genre's text: one you own, or for a foreign text any letter of its alphabet (that department has them all). */
function hasLetter(state: GameState, c: string, genre?: Genre): boolean {
  return isForeign(genre) ? alphabet(state, genre).includes(c) : state.letters.includes(c) || greekLetters.includes(c);
}

/** The letters a department's monkeys type: the Greek capitals for Greek, your letters for the rest. */
export function lettersFor(state: GameState, genre: Genre | undefined): string[] {
  return alphabet(state, textGenre(state, genre));
}

/** The letters a genre's texts are typed in: the Greek capitals, the Latin texts' capitals, or your letters. */
function alphabet(state: GameState, genre: Genre | undefined): string[] {
  return genre === 'greek' ? greekLetters : genre === 'latin' ? latinLetters : state.letters;
}

/** The genre a department types now: the Greek department's language once it can type Latin too (see switchClassical), else its own. */
export function textGenre(state: GameState, department: Genre | undefined): Genre | undefined {
  return department === 'greek' && latinUnlocked(state) ? state.classical : department;
}

/** Unwritten lines of a play that you own, with every letter they need, shortest first. */
export function reachableLines(state: GameState, playId: string): number[] {
  const play = plays.get(playId);
  if (!play) return [];
  const done = new Set(state.completed[play.id] ?? []);
  return play.lines
    .map((line, i) => ({ line, i }))
    .filter(
      ({ line, i }) => !done.has(i) && ownsLine(state, play, i) && inReach(state, line.letters, play.genre),
    )
    .sort((a, b) => a.line.letters.length - b.line.letters.length || a.i - b.i)
    .map(({ i }) => i);
}

/** Owned lines of one genre by their letters, rebuilt when ownership changes. */
let ownedCache = new Map<string, { key: string; byLetters: Map<string, Pin[]>; words: string[] }>();

function ownedLines(state: GameState, department: Genre | undefined): { byLetters: Map<string, Pin[]>; words: string[] } {
  const genre = textGenre(state, department);
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
export function dictionaryFor(state: GameState, department = departmentGenres(state)[0]): Dictionary {
  const genre = textGenre(state, department);
  let entry = cached.get(genre ?? '');
  // Checking the snapshots first skips building the key on almost every letter.
  if (entry && unchanged(entry.letters, state.letters) && unchanged(entry.owned, state.owned)) return entry.dict;
  const key = [...state.letters].sort().join('') + '|' + state.owned.join('|');
  if (entry?.key !== key) {
    // A foreign text scores only its own words.
    const words = [...(isForeign(genre) ? [] : wordList), ...ownedLines(state, genre).words].filter((w) => !isOneLetterRun(w));
    entry = { key, dict: new Dictionary(words, lettersFor(state, genre)), letters: snapshot(state.letters), owned: snapshot(state.owned) };
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

/** Buys a letter you don't own yet for points and Words, or with `free` takes it for one of your free letters (letterGifts). */
export function buyLetter(state: GameState, letter: string, free = false): boolean {
  const l = letter.toUpperCase();
  const cost = letterCost(state.letters.length);
  if (state.letters.length === 0 || !/^[A-Z]$/.test(l) || state.letters.includes(l)) return false;
  if (free ? state.freeLetters <= 0 : !canAffordLetter(state)) return false;
  if (free) state.freeLetters--;
  else {
    state.words -= letterWordsCost(state.letters.length);
    state.currency -= cost;
  }
  state.letters.push(l);
  return true;
}

/** Play lines written this game, in every play. */
export function linesWritten(state: GameState): number {
  return Object.values(state.completed).reduce((n, done) => n + done.length, 0);
}

/** Gives a free letter for each achievement in letterGifts unlocked and not yet rewarded; returns their ids. */
export function checkLetterGifts(state: GameState): string[] {
  const given = letterGifts.filter((id) => !state.letterGifts.includes(id) && state.achievements.includes(id));
  for (const id of given) {
    state.letterGifts.push(id);
    state.freeLetters++;
  }
  return given;
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
  return Math.ceil(monkeyCost(state.monkeysBought[dept] ?? 0, Math.max(0, open.indexOf(dept as Genre))) * (1 - hrDiscount(state)));
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

/** A department's manager's office, if it has one. */
export function officeOf(state: GameState, genre: Genre | undefined): Room | undefined {
  return genre ? state.office.find((r) => r.kind === 'office' && r.department === genre) : undefined;
}

/** Open departments that have a room but no manager's office yet. */
export function officelessDepartments(state: GameState): Genre[] {
  return departmentGenres(state).filter((g) => departmentRoom(state, g) && !officeOf(state, g));
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

/**
 * The desk a monkey sits at, as an index into state.furniture: a manager at
 * the manager's desk in its office; everyone else at a desk in its
 * department's room, in the order they joined (a manager with no office after
 * the typists). Undefined if there's none for it.
 */
export function deskOf(state: GameState, index: number): number | undefined {
  const m = state.monkeys[index];
  if (!m) return undefined;
  if (isResearcher(m)) {
    const lab = labRoom(state);
    return lab ? roomDesks(state, lab)[researchers(state).indexOf(index)] : undefined;
  }
  if (isHR(m)) {
    const room = hrRoom(state);
    return room ? roomDesks(state, room)[hrStaff(state).indexOf(index)] : undefined;
  }
  if (isMarketer(m)) {
    const room = marketingRoom(state);
    return room ? roomDesks(state, room)[marketers(state).indexOf(index)] : undefined;
  }
  if (isCodebreaker(m)) {
    const room = codebreakingRoom(state);
    return room ? roomDesks(state, room)[codebreakers(state).indexOf(index)] : undefined;
  }
  const genre = monkeyGenre(state, m);
  const office = officeOf(state, genre);
  if (m.manager && office) {
    const f = state.furniture.findIndex((p) => p.room === office.id && p.kind === managerDesk.id);
    return f >= 0 ? f : undefined;
  }
  const room = departmentRoom(state, genre);
  if (!room) return undefined;
  const team = departmentMonkeys(state, genre).filter((i) => !(state.monkeys[i].manager && office));
  const order = [...team.filter((i) => !state.monkeys[i].manager), ...team.filter((i) => state.monkeys[i].manager)];
  return roomDesks(state, room)[order.indexOf(index)];
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

/**
 * Buys a room: for a department that has none, a break room, or a manager's
 * office for a department that has a room and no office (it comes with a
 * manager's desk, beside the department's room with a door between).
 */
export function buyRoom(state: GameState, kind: Room['kind'], genre?: Genre, at?: Square): boolean {
  const cost = roomCost(state);
  if (state.sentences < cost) return false;
  if (at && !roomFitsAt(state, kind, genre ?? '', newRoomCells(kind, at))) return false;
  if (kind === 'department' && (!genre || !roomlessDepartments(state).includes(genre))) return false;
  if (kind === 'office' && (!genre || !officelessDepartments(state).includes(genre))) return false;
  if (kind === 'lab' && !canBuildLab(state)) return false;
  if (kind === 'hr' && !canBuildHR(state)) return false;
  if (kind === 'marketing' && !canBuildMarketing(state)) return false;
  if (kind === 'codebreaking' && !canBuildCodebreaking(state)) return false;
  if (kind === 'library' && !canBuildLibrary(state)) return false;
  state.sentences -= cost;
  if (kind === 'office') {
    const room = addRoom(state, kind, genre!, managerOffice.width, managerOffice.height, at);
    const square = bestSquares(state, room, true)[0];
    if (square) state.furniture.push({ kind: managerDesk.id, room: room.id, x: square[0], y: square[1] });
  } else addRoom(state, kind, genre ?? '', officeRules.newRoomWidth, officeRules.newRoomHeight, at);
  if (kind === 'lab') state.researchOpen = true; // building the lab opens R&D
  if (kind === 'library') {
    state.galleries = Math.max(1, state.galleries); // the first gallery comes with the room
    shelveBooks(state);
    unlockLatin(state);
  }
  seatWaiting(state);
  return true;
}

/**
 * Adds a w x h room where it fits best, with a door into each room of the
 * other kind it touches, and a hallway to the rest of the office if it still
 * needs one. Returns it.
 */
export function addRoom(state: GameState, kind: Room['kind'], department: string, width: number, height: number, at?: Square): Room {
  const id = `r${Math.max(0, ...state.office.map((r) => Number(r.id.slice(1)) || 0)) + 1}`;
  const [x0, y0] = at ?? placeRoom(state, width, height, kind, kind === 'office' ? departmentRoom(state, department as Genre) : undefined);
  const room: Room = { id, kind, department: kind === 'break' ? '' : department, cells: rectangle(width, height).map(([x, y]) => [x + x0, y + y0]) };
  state.office.push(room);
  doorToTouching(state, room);
  autoConnect(state);
  tidyDoors(state); // windows the new hallway now covers
  for (const r of state.office) addWindow(state, r);
  return room;
}

/** Where a new room of a kind goes if the player doesn't choose: see placeRoom (a manager's office goes beside its department's room). */
export function suggestRoomSpot(state: GameState, kind: Room['kind'], department: string): Square {
  const [w, h] = kind === 'office' ? [managerOffice.width, managerOffice.height] : [officeRules.newRoomWidth, officeRules.newRoomHeight];
  return placeRoom(state, w, h, kind, kind === 'office' ? departmentRoom(state, department as Genre) : undefined);
}

/** The squares a new room of a kind takes with its top-left corner at a square. */
export function newRoomCells(kind: Room['kind'], [x0, y0]: Square): Square[] {
  const [w, h] = kind === 'office' ? [managerOffice.width, managerOffice.height] : [officeRules.newRoomWidth, officeRules.newRoomHeight];
  return rectangle(w, h).map(([x, y]): Square => [x + x0, y + y0]);
}

const touches = (a: Square[], b: Square[]) => a.some(([x, y]) => b.some(([bx, by]) => Math.abs(bx - x) + Math.abs(by - y) === 1));

/**
 * Whether a room (new, or `id` moved) can stand on these squares: free floor
 * (see roomFits), and a manager's office beside its department's room.
 */
export function roomFitsAt(state: GameState, kind: Room['kind'], department: string, cells: Square[], id = ''): boolean {
  if (!roomFits(state, cells, { id, kind })) return false;
  if (kind === 'office') {
    const dept = departmentRoom(state, department as Genre);
    return !!dept && touches(cells, dept.cells);
  }
  const office = kind === 'department' ? officeOf(state, department as Genre) : undefined;
  return !office || touches(cells, office.cells);
}

/** Moves a room by dx, dy (with its furniture, windows and doors), if it can stand there (see roomFitsAt). */
export function moveRoomBy(state: GameState, id: string, dx: number, dy: number): boolean {
  const room = state.office.find((r) => r.id === id);
  if (!room || (dx === 0 && dy === 0)) return false;
  if (!roomFitsAt(state, room.kind, room.department, room.cells.map(([x, y]): Square => [x + dx, y + dy]), id)) return false;
  return moveRoom(state, room, dx, dy);
}

/** Points for the next square added to a room. */
export function squareCost(state: GameState): number {
  return Math.ceil(officeRules.squareBaseCost * Math.pow(officeRules.squareCostGrowth, state.squaresBought) * (1 - researchBonus(state, 'squares')));
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
  if (!room || state.sentences < cost) return false;
  const target = square ?? bestExpansion(state, room);
  if (!target) return false;
  const [x, y] = target;
  if (!expansionSquares(state, room).some(([ex, ey]) => ex === x && ey === y)) return false;
  state.sentences -= cost;
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
  const suits = kindOf(kind)?.rooms ?? [];
  const first: Room['kind'] = roomKind ?? (suits.length === 1 ? suits[0] : (kindOf(kind)?.drain ?? 0) > 0 ? 'department' : 'break');
  const rooms =
    kind === safe.id
      ? officesWithoutSafe(state)
      : [...state.office.filter((r) => r.kind === first), ...(roomKind ? [] : state.office.filter((r) => r.kind !== first))];
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

/** Whether a piece of furniture hides the manager's book, not yet read (it's in every manager's desk until then). */
export function hidesManagerBook(state: GameState, index: number): boolean {
  return !state.managerBook && state.furniture[index]?.kind === managerBook.hiddenIn;
}

/** Reads the manager's book found in a piece: from then on every monkey's trait shows. */
export function readManagerBook(state: GameState, index: number): boolean {
  if (!hidesManagerBook(state, index)) return false;
  state.managerBook = true;
  return true;
}

/** Sentences for the next dye: dearer for every hat already dyed. */
export function dyeCost(state: GameState): number {
  return Math.ceil(dye.cost * Math.pow(dye.costGrowth, state.monkeys.filter((m) => m.hatColor).length));
}

/** Sentences for the next piece of a kind of furniture. */
export function furnitureCost(state: GameState, kind: string): number {
  const k = furnitureKinds.find((f) => f.id === kind);
  if (!k) return Infinity;
  return Math.ceil(k.cost * Math.pow(k.costGrowth, furnitureOwned(state, kind)));
}

/**
 * Buys a new piece of furniture at its price and stands it where it fits
 * (see furnitureSpot), in a room of roomKind if given. The store always sells
 * a new one (Justin, 2026-10-16); pieces in the inventory go back in with
 * placeStoredFurniture.
 */
export function buyFurniture(state: GameState, kind: string, roomKind?: Room['kind']): boolean {
  const cost = furnitureCost(state, kind);
  const spot = furnitureSpot(state, kind, roomKind);
  if (!spot || state.sentences < cost) return false;
  state.sentences -= cost;
  state.furniture.push({ kind, ...spot });
  return true;
}

/** Takes a piece of furniture out of the inventory and stands it where it fits, for free. */
export function placeStoredFurniture(state: GameState, kind: string): boolean {
  const spot = furnitureSpot(state, kind);
  if (!state.stored.furniture[kind] || !spot) return false;
  unstore(state.stored.furniture, kind);
  state.furniture.push({ kind, ...spot });
  return true;
}

/** How many pieces of a kind the player owns: standing in the office and in the inventory. */
export function furnitureOwned(state: GameState, kind: string): number {
  return state.furniture.filter((f) => f.kind === kind).length + (state.stored.furniture[kind] ?? 0);
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
  if (!f || !fitsAt(state, roomId, f.kind, x, y, f.turned, index) || ((f.kind === desk.id || f.kind === safe.id) && f.room !== roomId)) return false;
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
export function buyMonkey(state: GameState, genre?: Genre, from?: number): boolean {
  const dept = placeFor(state, genre);
  if (dept === null) return false;
  const cost = hirePrice(state, nextMonkeyCost(state, (dept || undefined) as Genre | undefined), 'typing', from);
  if (state.letters.length === 0 || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeysBought[dept] = (state.monkeysBought[dept] ?? 0) + 1;
  addMonkey(state, { ...takeCandidate(state, from), department: dept });
  placeDesk(state, (dept || undefined) as Genre | undefined);
  return true;
}

/** Puts an earned monkey that's waiting for a department to work. */
export function assignMonkey(state: GameState, genre?: Genre): boolean {
  const dept = placeFor(state, genre);
  if (state.unassignedMonkeys === 0 || dept === null) return false;
  state.unassignedMonkeys--;
  addMonkey(state, { department: dept });
  placeDesk(state, (dept || undefined) as Genre | undefined);
  return true;
}

/** Display name of a monkey: its given name, or M-<number>. */
export function monkeyName(state: GameState, index: number): string {
  const m = state.monkeys[index];
  return m?.name || `M-${m?.number || index + 1}`;
}

/** Adds a new monkey with the next M-number (one past the highest, so nobody else's changes when a monkey leaves). */
export function addMonkey(state: GameState, fields: Partial<MonkeyState>): MonkeyState {
  const number = Math.max(0, ...state.monkeys.map((m, i) => m.number || i + 1)) + 1;
  const m = { ...createMonkey(), name: monkeyNameFor(number, state.monkeys.map((o) => o.name)), ...fields, number };
  state.monkeys.push(m);
  return m;
}

/**
 * Names monkey `index`. Letters, digits, spaces, - and ' only, up to maxMonkeyNameLength;
 * an empty name goes back to M-<number>. Returns false if the name isn't allowed.
 */
export function renameMonkey(state: GameState, index: number, name: string): boolean {
  const m = state.monkeys[index];
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!m || clean.length > maxMonkeyNameLength || !/^[A-Za-z0-9 '-]*$/.test(clean)) return false;
  if (!clean) {
    // An empty name gives the monkey a famous name again.
    const others = state.monkeys.filter((o) => o !== m).map((o) => o.name);
    m.name = monkeyNameFor(m.number, others);
    return true;
  }
  if (clean !== m.name) state.stats.renamed++;
  m.name = clean;
  return true;
}

/** Cost in Sentences of the next starting-combo upgrade. */
export function comboStartCost(level: number): number {
  return Math.ceil(combo.startBaseCost * Math.pow(combo.startCostGrowth, level));
}

export function comboCap(state: GameState): number {
  return combo.maxMultiplier + researchBonus(state, 'combo');
}

/** Where every chain's combo starts: x1 plus a step per upgrade bought. */
export function comboStart(state: GameState): number {
  return Math.round((1 + combo.step * state.comboStartLevel) * 10) / 10;
}

/** Raises every chain's starting combo by one step, until it reaches the combo cap. */
export function buyComboStart(state: GameState): boolean {
  const cost = comboStartCost(state.comboStartLevel);
  if (state.letters.length === 0 || state.sentences < cost || comboStart(state) >= comboCap(state)) return false;
  state.sentences -= cost;
  state.comboStartLevel++;
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

/** Everything a monkey can hit, with weights: your letters and your keys (a Greek department's monkeys: the Greek capitals). */
export function keyboard(state: GameState, genre?: Genre): { text: string; weight: number }[] {
  if (isForeign(textGenre(state, genre))) return lettersFor(state, genre).map((l) => ({ text: l, weight: 1 }));
  return [
    ...state.letters.map((l) => ({ text: l, weight: 1 })),
    ...state.keys.map((k) => ({ text: k, weight: 1 })),
  ];
}

function pressKey(state: GameState, rng: Rng, genre?: Genre): string {
  const keys = keyboard(state, genre);
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
  if (!m || !isTypist(m) || state.letters.length === 0) return;
  const genre = monkeyGenre(state, m);
  const dict = dictionaryFor(state, genre);
  const events: ReadEvent[] = [];
  const slot = dueSlot(state, m, dict);
  if (slot) {
    if (m.pending && dict.isWord(m.pending)) events.push({ kind: 'word', text: m.pending });
    events.push({ kind: 'word', text: slot });
    m.pending = '';
  } else {
    for (const letter of pressKey(state, rng, genre)) {
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
      noteLately(state, 'word', [e.text]);
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
  noteLately(state, 'sentence', m.chainAll);
}

/**
 * Keeps the LATELY feed: the newest sentence, and the longest word and
 * sentence of the last lately.windowSeconds of typing (an older one gives
 * way to whatever comes next).
 */
export function noteLately(state: GameState, kind: 'word' | 'sentence', words: string[]): void {
  const now = state.stats.secondsTyping;
  const l = state.lately;
  const stale = (at: number) => now - at > lately.windowSeconds;
  if (kind === 'word') {
    if (words[0].length > l.longWord.length || stale(l.longWordAt)) Object.assign(l, { longWord: words[0], longWordAt: now });
    return;
  }
  const kept = words.slice(0, lately.maxSentenceWords);
  l.lastSentence = kept;
  if (words.length > l.longSentence.length || stale(l.longSentenceAt)) Object.assign(l, { longSentence: kept, longSentenceAt: now });
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

/** The combo multiplier: the starting combo plus a step per word in the chain, up to the cap. */
export function comboMultiplier(state: GameState, m: MonkeyState): number {
  return Math.min(comboCap(state) + wearing(m, 'combo'), Math.round((comboStart(state) + combo.step * m.chainWords.length) * 10) / 10);
}

/**
 * Adds a word to the monkey's chain and returns what it pays: whatever
 * brings the chain's total up to (sum of its word points) x multiplier.
 * One-letter words join the chain but don't raise the multiplier.
 */
function scoreInChain(state: GameState, m: MonkeyState, word: string): number {
  const before = m.chainPoints * comboMultiplier(state, m);
  if (word.length >= combo.minWordLength && m.chainWords.length < 1000) m.chainWords.push(word);
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
 * The player pets typing monkey `who`, or with none given the least happy
 * one (the first, on a tie): it gets a little happier (see `petting`).
 * Returns its index, or -1.
 */
export function poke(state: GameState, who = -1): number {
  let i = -1;
  if (who >= 0) i = state.monkeys[who] && isTypist(state.monkeys[who]) ? who : -1;
  else
    state.monkeys.forEach((m, k) => {
      if (isTypist(m) && (i < 0 || m.petHappiness < state.monkeys[i].petHappiness)) i = k;
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

/**
 * Why a department can't hire a manager right now, money aside ('' if it
 * can): it has one, it needs a manager's office with a door into its room
 * and a manager's desk, and minDepartmentMonkeys typing monkeys to manage.
 */
export function managerBlocker(state: GameState, genre: Genre | undefined): string {
  if (managerOf(state, genre)) return 'has a manager';
  const office = officeOf(state, genre);
  const room = departmentRoom(state, genre);
  if (!office || !room) return 'office needed';
  if (!doorBetween(state, office, room)) return 'door needed';
  if (!state.furniture.some((f) => f.room === office.id && f.kind === managerDesk.id)) return "manager's desk needed";
  const short = managers.minDepartmentMonkeys - departmentTypists(state, genre);
  return short > 0 ? `${short} more monkey${short === 1 ? '' : 's'} needed` : '';
}

/** Points for a department's manager: the price of its next monkey. */
export function managerCost(state: GameState, genre: Genre): number {
  return nextMonkeyCost(state, genre);
}

/** Hires a manager for a department, into the manager's desk in its office (see managerBlocker). */
export function hireManager(state: GameState, genre: Genre | undefined, from?: number): boolean {
  if (!genre || managerBlocker(state, genre)) return false;
  const cost = hirePrice(state, managerCost(state, genre), 'managing', from);
  if (state.currency < cost || state.letters.length === 0) return false;
  state.currency -= cost;
  addMonkey(state, { ...takeCandidate(state, from), department: genre, manager: true });
  manage(state);
  return true;
}

/** Points multiplier from a monkey's department manager: x1 plus bonusPerLevel per upgrade. */
export function managerMultiplier(state: GameState, m: MonkeyState): number {
  const boss = managerOf(state, monkeyGenre(state, m));
  return boss ? (1 + managers.bonusPerLevel * boss.managerLevel) * (1 + jobBonus(boss)) : 1;
}

/** Lines price of a manager's next upgrade: grows with its department's size and each level. */
export function managerUpgradeCost(state: GameState, m: MonkeyState): number {
  const team = departmentMonkeys(state, monkeyGenre(state, m)).length;
  return Math.ceil(managers.linesPerMonkey * team * Math.pow(managers.upgradeCostGrowth, m.managerLevel));
}

/** Upgrades a manager with Lines. */
export function upgradeManager(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  if (!m?.manager || isTemp(m)) return false;
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
 * within reach (your letters can spell it), picked at random (Justin,
 * 2026-10-16: "pick the next line at random"), among those with no more
 * words than the department has slots when there are any. Null when nothing
 * is in reach.
 */
export function managerLine(state: GameState, department: Genre | undefined, rng: Rng = Math.random): Pin | null {
  const lines: { pin: Pin; words: number }[] = [];
  const genre = textGenre(state, department);
  for (const play of plays.values()) {
    if (play.genre !== genre) continue;
    const done = new Set(state.completed[play.id] ?? []);
    play.lines.forEach((line, index) => {
      if (!done.has(index) && ownsLine(state, play, index) && inReach(state, line.letters, genre)) lines.push({ pin: { play: play.id, index }, words: line.words.length });
    });
  }
  const slots = departmentSlots(state, department).length;
  const fit = lines.filter((l) => l.words <= slots);
  const pool = fit.length > 0 ? fit : lines;
  return pool.length > 0 ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].pin : null;
}

/** Whether a manager's line still stands: owned, unwritten and within reach. */
function lineStands(state: GameState, t: Pin): boolean {
  const play = plays.get(t.play);
  return !!play?.lines[t.index] && !(state.completed[t.play] ?? []).includes(t.index) && ownsLine(state, play, t.index) && inReach(state, play.lines[t.index].letters, play.genre);
}

/** How much quicker than usual a manager changes slots: upgrades, its office's furniture and (with the book) its chi. */
export function managerSpeed(state: GameState, m: MonkeyState): number {
  const office = officeOf(state, monkeyGenre(state, m));
  const pieces = office ? state.furniture.filter((f) => f.room === office.id) : [];
  const furniture = Math.min(managerOffice.maxFurnitureSpeed, pieces.reduce((n, f) => n + (kindOf(f.kind)?.happiness ?? 0) * managerOffice.speedPerHappiness, 0));
  const chi = office && state.fengShuiBook ? roomChi(state, office) * managerOffice.chiSpeed : 0;
  return 1 + managers.speedPerLevel * m.managerSpeedLevel + furniture + chi;
}

/** Seconds between a manager's slot changes. */
export function slotDelay(state: GameState, m: MonkeyState): number {
  return managers.secondsPerSlot / managerSpeed(state, m);
}

/** Bananas price of a manager's next "Quicker manager" upgrade. */
export function managerSpeedCost(m: MonkeyState): number {
  return Math.ceil(managers.speedBaseCost * Math.pow(managers.speedCostGrowth, m.managerSpeedLevel));
}

/** Makes a manager quicker at changing slots, for Bananas. */
export function buyManagerSpeed(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  if (!m?.manager || isTemp(m)) return false;
  const cost = managerSpeedCost(m);
  if (state.currency < cost) return false;
  state.currency -= cost;
  m.managerSpeedLevel++;
  return true;
}

/** The slot a manager changes next (in position order), and to what: a word, or '' to switch it off. */
export function nextSlotChange(state: GameState, genre: Genre | undefined, boss: MonkeyState): { slot: number; word: string } | null {
  const words = boss.target ? plays.get(boss.target.play)!.lines[boss.target.index].words : [];
  for (const i of departmentSlots(state, genre)) {
    const slot = state.slots[i];
    const word = words[slot.position - 1] ?? '';
    if (word ? !slot.on || slot.word !== word : slot.on) return { slot: i, word };
  }
  return null;
}

/**
 * Runs the managers for `seconds`: each keeps its department's target on an
 * unwritten line within reach (see managerLine) until it is written, pins
 * it, and fills its department's word slots with the line's words, one slot
 * at a time, slotDelay apart (slots past the line's end switch off, one at a
 * time too). A manager with nothing to change is ready to change one at once.
 */
export function manage(state: GameState, seconds = 0, rng: Rng = Math.random): void {
  for (const genre of departmentGenres(state)) {
    const boss = managerOf(state, genre);
    if (!boss) continue;
    const t = boss.target;
    if (!t || !lineStands(state, t)) {
      if (t) unpin(state, t);
      boss.target = managerLine(state, genre, rng);
      if (boss.target && state.pinned.length < maxPinnedLines && !state.pinned.some((p) => samePin(p, boss.target!))) {
        state.pinned.push(boss.target);
      }
    }
    boss.slotWait -= seconds;
    while (boss.slotWait <= 0) {
      const change = nextSlotChange(state, genre, boss);
      if (!change) {
        boss.slotWait = 0;
        break;
      }
      const slot = state.slots[change.slot];
      slot.word = change.word || slot.word;
      slot.on = !!change.word;
      boss.slotWait += slotDelay(state, boss);
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
  if (!m || isTemp(m) || state.letters.length === 0 || m.skill >= skillCap(m)) return false;
  const cost = typingUpgradeCost(m.skill);
  if (state.currency < cost) return false;
  state.currency -= cost;
  m.skill++;
  return true;
}

/** Buys monkey `index` a better typewriter, allowing another set of skill levels. */
export function buyTypewriter(state: GameState, index = 0): boolean {
  const m = state.monkeys[index];
  if (!m || isTemp(m) || state.letters.length === 0) return false;
  const cost = typewriterCost(m);
  if (state.currency < cost) return false;
  state.currency -= cost;
  m.typewriter++;
  return true;
}

export function tick(state: GameState, seconds: number, rng: Rng = Math.random, lettersPerSecondCap = maxSimulatedLettersPerSecond): void {
  if (seconds <= 0 || state.letters.length === 0) return;
  state.stats.secondsTyping += seconds;
  giveTraits(state, rng);
  drawCandidates(state, seconds, rng);
  endTemps(state, seconds);
  for (const m of state.monkeys) m.petHappiness = Math.max(0, m.petHappiness - (petting.fadePerMinute * seconds) / 60);
  manage(state, seconds, rng);
  advanceResearch(state, seconds);
  checkLetterGifts(state);
  earn(state, royalties(state) * seconds);
  crackSafes(state, seconds, rng);
  unlockGreek(state);
  shelveBooks(state);
  unlockLatin(state);
  deliverTelegrams(state, seconds, rng);
  const due = state.monkeys.map((m) => {
    if (!isTypist(m) || !canReachDesk(state, m)) return 0;
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
    case 'named': return state.stats.renamed;
    case 'managers': return ms.filter((m) => m.manager).length;
    case 'researchers': return ms.filter(isResearcher).length;
    case 'researched': return state.researched.length;
    case 'hrStaff': return ms.filter(isHR).length;
    case 'marketers': return ms.filter(isMarketer).length;
    case 'departments': return state.departments.length;
    case 'rooms': return state.office.length;
    case 'furniture': return state.furniture.filter((f) => f.kind !== desk.id).length;
    case 'harmony': return state.office.filter((r) => roomChi(state, r) === 1).length;
    case 'hats': return hats.reduce((n, h) => n + hatsOwned(state, h.id), 0);
    case 'hatKinds': return hats.filter((h) => hatsOwned(state, h.id) > 0).length;
    case 'dyed': return state.stats.dyes;
    case 'skill': return most((m) => m.skill);
    case 'typewriter': return most((m) => m.typewriter);
    case 'keys': return state.keys.length;
    case 'slots': return state.slots.length;
    case 'pets': return state.stats.pets;
    case 'flipsWon': return state.stats.flipsWon;
    case 'flipsLost': return state.stats.flipsLost;
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
  const away = Math.max(0, (now - state.lastSaved) / 1000);
  if (state.letters.length > 0) state.stats.secondsAway += away;
  const seconds = Math.min(away, maxOfflineSeconds);
  const letters = seconds * state.monkeys.reduce((n, m) => n + (isTypist(m) ? monkeySpeed(state, m) : 0), 0);
  const simulated = Math.min(1, maxOfflineLetters / Math.max(letters, 1));
  const before = state.currency;
  const wordsBefore = state.wordsTyped;
  tick(state, seconds * simulated, rng);
  // Research runs in real time: the whole time away, not just what was simulated.
  if (state.letters.length > 0) advanceResearch(state, away - seconds * simulated);
  const scale = 1 / simulated - 1;
  if (scale > 0) {
    earn(state, (state.currency - before) * scale);
    state.wordsTyped += Math.round((state.wordsTyped - wordsBefore) * scale);
  }
  return state.currency - before;
}

/** The R&D lab, if you have one. */
export function labRoom(state: GameState): Room | undefined {
  return state.office.find((r) => r.kind === 'lab');
}

/** Researchers, by index. */
export function researchers(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isResearcher(m) ? [i] : []));
}

/** Whether an R&D lab can be built on the office map: you have research.opensAt monkeys and no lab yet. Building it opens R&D. */
export function canBuildLab(state: GameState): boolean {
  return !labRoom(state) && state.monkeys.length >= research.opensAt;
}

/** Points for the next researcher. */
export function researcherCost(state: GameState): number {
  return Math.ceil(research.hireCost * Math.pow(research.hireCostGrowth, state.researchersHired));
}

/** Why a researcher can't be hired right now, money aside ('' if one can). */
export function researcherBlocker(state: GameState): string {
  const lab = labRoom(state);
  if (!lab) return 'lab needed';
  if (researchers(state).length >= research.maxResearchers) return 'lab full';
  return freeSquares(state, lab).length > 0 ? '' : 'desk needed';
}

/** Hires a researcher into the lab, with a desk. */
export function hireResearcher(state: GameState, from?: number): boolean {
  const cost = hirePrice(state, researcherCost(state), 'research', from);
  if (researcherBlocker(state) || state.currency < cost) return false;
  state.currency -= cost;
  state.researchersHired++;
  addMonkey(state, { ...takeCandidate(state, from), department: research.id });
  const lab = labRoom(state)!;
  const square = bestSquares(state, lab, true)[0];
  state.furniture.push({ kind: desk.id, room: lab.id, x: square[0], y: square[1] });
  return true;
}

/** A research project by id. */
export function projectOf(id: string): ResearchProject | undefined {
  return research.projects.find((p) => p.id === id);
}

/** Projects not yet finished (the one under way included), in order. */
export function projectsLeft(state: GameState): ResearchProject[] {
  return research.projects.filter((p) => !state.researched.includes(p.id) && (state.researching === p.id || ((p.needs !== 'marketing' || !!marketingRoom(state)) && (p.needs !== 'telegram' || state.telegrams.length > 0) && (!p.after || state.researched.includes(p.after)))));
}

/** Starts a project, paying its price. One at a time. */
export function startResearch(state: GameState, id: string): boolean {
  const p = projectOf(id);
  if (!p || !state.researchOpen || state.researching || state.researched.includes(id) || state.currency < p.cost) return false;
  state.currency -= p.cost;
  state.researching = id;
  state.researchProgress = 0;
  return true;
}

/** How fast R&D works: one per researcher who can reach its desk, more or less by its trait (a researcher's speed trait speeds its research). */
export function researchRate(state: GameState): number {
  return researchers(state).reduce((n, i) => {
    const m = state.monkeys[i];
    return n + (canReachDesk(state, m) && deskOf(state, i) !== undefined ? (1 + traitBonus(state, m, 'speed')) * (1 + jobBonus(m)) : 0);
  }, 0);
}

/** Seconds of real time until the project under way is done at today's rate (Infinity with nobody working on it). */
export function researchSecondsLeft(state: GameState): number {
  const p = projectOf(state.researching);
  if (!p) return 0;
  const rate = researchRate(state);
  return rate > 0 ? Math.max(0, p.hours * 3600 - state.researchProgress) / rate : Infinity;
}

/** Share of the project under way that's done, 0 to 1. */
export function researchShare(state: GameState): number {
  const p = projectOf(state.researching);
  return p ? Math.min(1, state.researchProgress / (p.hours * 3600)) : 0;
}

/** Runs R&D for `seconds`: the project under way gets researchRate x seconds of work, and finishes when it has enough. */
export function advanceResearch(state: GameState, seconds: number): void {
  const p = projectOf(state.researching);
  if (!p || seconds <= 0) return;
  state.researchProgress += researchRate(state) * seconds;
  if (state.researchProgress >= p.hours * 3600) {
    state.researched.push(p.id);
    state.researching = '';
    state.researchProgress = 0;
  }
}

/** What finished projects add up to for one effect (see research in config.ts). */
export function researchBonus(state: GameState, effect: 'points' | 'speed' | 'drain' | 'rest' | 'combo' | 'squares' | 'marketing' | 'bombe'): number {
  let n = 0;
  for (const id of state.researched) n += projectOf(id)?.[effect] ?? 0;
  return n;
}

/** HR's office, if built. */
export function hrRoom(state: GameState): Room | undefined {
  return state.office.find((r) => r.kind === 'hr');
}

/** HR monkeys, by index. */
export function hrStaff(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isHR(m) ? [i] : []));
}

/** Managers' offices without a safe yet: where the Manager store's safe goes (one each). */
export function officesWithoutSafe(state: GameState): Room[] {
  return state.office.filter((r) => r.kind === 'office' && !state.furniture.some((f) => f.room === r.id && f.kind === safe.id));
}

/** The genre of the manager's office a piece of furniture stands in ('' if none). */
function officeGenre(state: GameState, index: number): string {
  const room = state.office.find((r) => r.id === state.furniture[index]?.room);
  return room?.kind === 'office' ? room.department : '';
}

/** The safe a piece of furniture is, by its office's genre, once found (undefined: not a safe, or not found yet). */
export function safeAt(state: GameState, index: number): SafeState | undefined {
  return state.furniture[index]?.kind === safe.id ? state.safes[officeGenre(state, index)] : undefined;
}

/**
 * Finds the safe at a piece of furniture (inspecting it): it gets a random
 * combination, and Codebreaking turns to it if it has nothing else to work
 * on. False if it isn't a safe or was found already.
 */
export function findSafe(state: GameState, index: number, rng: Rng = Math.random): boolean {
  if (state.furniture[index]?.kind !== safe.id || safeAt(state, index)) return false;
  const genre = officeGenre(state, index);
  const level = Object.keys(state.safes).length;
  const lock = lockOf(level);
  let combo = '';
  for (let i = 0; i < lock.length; i++) combo += lock.symbols[Math.min(lock.symbols.length - 1, Math.floor(rng() * lock.symbols.length))];
  state.safes[genre] = { level, combo, tries: 0, open: false, held: '' };
  if (!codebreakTargets(state).includes(state.codebreakFocus)) state.codebreakFocus = genre;
  return true;
}

/** The lock of the safe found `level`-th (from 0): safes.locks in turn, then one more character of letters and digits each. */
export function lockOf(level: number): { length: number; symbols: string; name: string } {
  const last = safes.locks[safes.locks.length - 1];
  if (level < safes.locks.length) return safes.locks[level];
  const length = last.length + level - safes.locks.length + 1;
  return { length, symbols: last.symbols, name: `a ${length}-character password of letters and digits` };
}

/** Combinations a lock has: symbols ^ length, the tries it takes on average. */
export function lockCombinations(level: number): number {
  const lock = lockOf(level);
  return Math.pow(lock.symbols.length, lock.length);
}

/** Found safes not yet open, by genre, in the order found. */
export function lockedSafes(state: GameState): string[] {
  return Object.keys(state.safes).filter((g) => !state.safes[g].open);
}

/** Whether the scroll has turned up: the first safe opened holds it. */
export function scrollFound(state: GameState): boolean {
  return Object.values(state.safes).some((x) => x.open && x.held === safes.contents[0]);
}

/**
 * The Greek scroll opens the Greek department (Justin, 2026-10-17: "when the
 * first foreign language text is found in the first safe, it unlocks the
 * ability to do translation"): you own the scroll's text, Aristotle's
 * Metaphysics I.4, so its genre has a department; De generatione et
 * corruptione is then for sale like a play. Old saves that found the scroll
 * get it too. Returns whether it just opened.
 */
export function unlockGreek(state: GameState): boolean {
  const play = plays.get(translation.firstText);
  if (!play || !scrollFound(state) || state.owned.some((k) => k.startsWith(`${play.id}:`))) return false;
  for (const sc of play.scenes) state.owned.push(`${play.id}:${sc.key}`);
  state.completed[play.id] ??= [];
  if (!state.departments.includes('greek')) state.departments.push('greek');
  announce(state, `The scroll is in Greek: a Greek department opened to type and translate it.`);
  return true;
}

/** What Codebreaking can work on: locked safes in the order found, then a telegram once the Bombe is built. */
export function codebreakTargets(state: GameState): string[] {
  return [...lockedSafes(state), ...(bombeBuilt(state) && unreadTelegram(state) ? ['telegram'] : [])];
}

/** Turns Codebreaking to the next thing it can work on (Justin: "the option at any time to shift the focus of the department"). */
export function cycleCodebreakFocus(state: GameState): boolean {
  const targets = codebreakTargets(state);
  if (targets.length === 0) return false;
  state.codebreakFocus = targets[(targets.indexOf(state.codebreakFocus) + 1) % targets.length];
  return true;
}

/** Codebreaking's office, if built. */
export function codebreakingRoom(state: GameState): Room | undefined {
  return state.office.find((r) => r.kind === 'codebreaking');
}

/** Codebreakers, by index. */
export function codebreakers(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isCodebreaker(m) ? [i] : []));
}

/** Whether Codebreaking's office can be built on the office map: a safe has been found and there's no Codebreaking office yet. */
export function canBuildCodebreaking(state: GameState): boolean {
  return !codebreakingRoom(state) && Object.keys(state.safes).length > 0;
}

/** Bananas for the next codebreaker (before HR's discount on a candidate). */
export function codebreakerCost(state: GameState): number {
  return Math.ceil(codebreaking.hireCost * Math.pow(codebreaking.hireCostGrowth, state.monkeysBought[codebreaking.id] ?? 0));
}

/** Why a codebreaker can't be hired right now, money aside ('' if one can). */
export function codebreakerBlocker(state: GameState): string {
  const room = codebreakingRoom(state);
  if (!room) return `${codebreaking.name} office needed`;
  if (codebreakers(state).length >= codebreaking.maxStaff) return `${codebreaking.name} full`;
  return freeSquares(state, room).length > 0 ? '' : 'desk needed';
}

/** Hires a codebreaker into Codebreaking's office, with a desk. */
export function hireCodebreaker(state: GameState, from?: number): boolean {
  const cost = hirePrice(state, codebreakerCost(state), 'codebreaking', from);
  if (codebreakerBlocker(state) || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeysBought[codebreaking.id] = (state.monkeysBought[codebreaking.id] ?? 0) + 1;
  addMonkey(state, { ...takeCandidate(state, from), department: codebreaking.id });
  const room = codebreakingRoom(state)!;
  const square = bestSquares(state, room, true)[0];
  state.furniture.push({ kind: desk.id, room: room.id, x: square[0], y: square[1] });
  return true;
}

/** Combinations a second Codebreaking tries: triesPerSecond for each codebreaker at its desk, more or less by its trait and how it feels about codebreaking. */
export function codebreakingRate(state: GameState): number {
  return codebreakers(state).reduce((n, i) => {
    const m = state.monkeys[i];
    return n + (canReachDesk(state, m) && deskOf(state, i) !== undefined ? codebreaking.triesPerSecond * (1 + traitBonus(state, m, 'speed')) * (1 + jobBonus(m)) : 0);
  }, 0);
}

/**
 * Codebreaking works on the safe in focus for `seconds`: every try is a
 * random combination (repeats and all), so each opens it with a chance of
 * 1 in its lock's combinations; the chance over all of a stretch's tries is drawn once, so
 * it's exact over any stretch, offline too. Whatever the department, the
 * n-th safe opened holds safes.contents[n - 1] (the first, the Greek scroll).
 * With the Bombe built it can work on a telegram instead, testing
 * enigma.settingsPerTry settings for each try, until it reaches the key.
 */
export function crackSafes(state: GameState, seconds: number, rng: Rng = Math.random): void {
  const targets = codebreakTargets(state);
  if (!targets.includes(state.codebreakFocus)) state.codebreakFocus = targets[0] ?? ''; // e.g. once the Bombe is built
  const tries = codebreakingRate(state) * seconds;
  if (state.codebreakFocus === 'telegram') {
    const t = unreadTelegram(state);
    if (!t || !bombeBuilt(state) || tries <= 0) return;
    t.tested = Math.min(t.keyAt, t.tested + tries * enigma.settingsPerTry * (1 + researchBonus(state, 'bombe')));
    if (t.tested < t.keyAt) return;
    t.read = true;
    state.telegramWait = enigma.hoursBetween * 3600;
    state.codebreakFocus = codebreakTargets(state)[0] ?? '';
    return;
  }
  const target = state.safes[state.codebreakFocus];
  if (!target || target.open || tries <= 0) return;
  const before = Math.floor(target.tries);
  target.tries += tries;
  const n = Math.floor(target.tries) - before;
  if (n <= 0 || rng() >= 1 - Math.pow(1 - 1 / lockCombinations(target.level), n)) return;
  const opened = Object.values(state.safes).filter((x) => x.open).length;
  target.open = true;
  target.held = safes.contents[opened] ?? safes.empty;
  announce(state, `${codebreaking.name} cracked a safe! It held ${target.held}.`);
  state.codebreakFocus = codebreakTargets(state)[0] ?? '';
}

/** Whether R&D has built the Bombe, so Codebreaking can work on telegrams. */
export function bombeBuilt(state: GameState): boolean {
  return state.researched.includes('bombe');
}

/** The telegram waiting to be read, if any (one comes at a time). */
export function unreadTelegram(state: GameState): TelegramState | undefined {
  return state.telegrams.find((t) => !t.read);
}

/** Rotor settings the n-th telegram's key hides among (n from 0): each one is harder. */
export function telegramSettings(n: number): number {
  return enigma.settings * Math.pow(enigma.settingsGrowth, n);
}

/** The n-th telegram's plain text (placeholder nonsense, in turn). */
export function telegramText(n: number): string {
  return enigma.telegrams[n % enigma.telegrams.length];
}

/** The n-th telegram as it came: its plain text through the Enigma with its key. */
export function telegramCipher(state: GameState, n: number): string {
  return encipher(state.telegrams[n].key, telegramText(n));
}

/**
 * A knock at the door: the first telegram comes once every department's safe
 * is open (Justin: "after all of the safes are unlocked"), and each next one
 * enigma.hoursBetween after the last is read, offline too. Returns whether
 * one came.
 */
export function deliverTelegrams(state: GameState, seconds: number, rng: Rng = Math.random): boolean {
  const last = state.telegrams[state.telegrams.length - 1];
  if (last) {
    if (!last.read) return false;
    state.telegramWait = Math.max(0, state.telegramWait - seconds);
    if (state.telegramWait > 0) return false;
  } else {
    const all = genresWithPlays();
    if (all.length === 0 || !all.every((g) => state.safes[g]?.open)) return false;
  }
  const n = state.telegrams.length;
  state.telegrams.push({ key: randomKey(enigma.leads + n, rng), tested: 0, keyAt: 1 + Math.floor(rng() * telegramSettings(n)), read: false });
  announce(state, 'A telegram came, in Enigma (Staff store).');
  return true;
}

/** Marketing's office, if built. */
export function marketingRoom(state: GameState): Room | undefined {
  return state.office.find((r) => r.kind === 'marketing');
}

/** Marketing monkeys, by index. */
export function marketers(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isMarketer(m) ? [i] : []));
}

/** Whether Marketing's office can be built on the office map: there's an HR office and no Marketing office yet. */
export function canBuildMarketing(state: GameState): boolean {
  return !marketingRoom(state) && !!hrRoom(state);
}

/** Bananas for the next marketing monkey (before HR's discount on a candidate). */
export function marketingCost(state: GameState): number {
  return Math.ceil(marketing.hireCost * Math.pow(marketing.hireCostGrowth, state.monkeysBought[marketing.id] ?? 0));
}

/** Why a marketing monkey can't be hired right now, money aside ('' if one can). */
export function marketingBlocker(state: GameState): string {
  const room = marketingRoom(state);
  if (!room) return 'Marketing office needed';
  if (marketers(state).length >= marketing.maxStaff) return 'Marketing full';
  return freeSquares(state, room).length > 0 ? '' : 'desk needed';
}

/** Hires a marketing monkey into Marketing's office, with a desk. */
export function hireMarketer(state: GameState, from?: number): boolean {
  const cost = hirePrice(state, marketingCost(state), 'marketing', from);
  if (marketingBlocker(state) || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeysBought[marketing.id] = (state.monkeysBought[marketing.id] ?? 0) + 1;
  addMonkey(state, { ...takeCandidate(state, from), department: marketing.id });
  const room = marketingRoom(state)!;
  const square = bestSquares(state, room, true)[0];
  state.furniture.push({ kind: desk.id, room: room.id, x: square[0], y: square[1] });
  return true;
}

/** How popular your work is: the lines of every scene finished this run, and Folio pages (worth perPage / perLine lines each). */
export function popularity(state: GameState): { lines: number; pages: number } {
  const lines = state.scenesDone.reduce((n, key) => {
    const [id, scene] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    return n + (getPlay(id)?.scenes.find((sc) => sc.key === scene)?.lines.length ?? 0);
  }, 0);
  return { lines, pages: state.folioPages };
}

/** Bananas a second Marketing earns: royalties on finished scenes and Folio pages, per marketing monkey at its desk (more or less by how it feels about marketing), raised by tactics. */
export function royalties(state: GameState): number {
  const working = marketers(state)
    .filter((i) => canReachDesk(state, state.monkeys[i]) && deskOf(state, i) !== undefined)
    .reduce((n, i) => n + (1 + jobBonus(state.monkeys[i])) * (1 + traitBonus(state, state.monkeys[i], 'speed')), 0);
  if (working <= 0) return 0;
  const { lines, pages } = popularity(state);
  return working * (lines * marketing.perLine + pages * marketing.perPage) * (1 + researchBonus(state, 'marketing'));
}

/** Whether HR's office can be built on the office map: a manager has been hired and there's no HR office yet. */
export function canBuildHR(state: GameState): boolean {
  return !hrRoom(state) && state.monkeys.some((m) => m.manager);
}

/** Points for the next HR monkey. */
export function hrCost(state: GameState): number {
  return Math.ceil(hr.hireCost * Math.pow(hr.hireCostGrowth, state.monkeysBought[hr.id] ?? 0));
}

/** Why an HR monkey can't be hired right now, money aside ('' if one can). */
export function hrBlocker(state: GameState): string {
  const room = hrRoom(state);
  if (!room) return 'HR office needed';
  if (hrStaff(state).length >= hr.maxStaff) return 'HR full';
  return freeSquares(state, room).length > 0 ? '' : 'desk needed';
}

/** Hires an HR monkey into HR's office, with a desk. */
export function hireHR(state: GameState, from?: number): boolean {
  const cost = hirePrice(state, hrCost(state), 'hr', from);
  if (hrBlocker(state) || state.currency < cost) return false;
  state.currency -= cost;
  state.monkeysBought[hr.id] = (state.monkeysBought[hr.id] ?? 0) + 1;
  addMonkey(state, { ...takeCandidate(state, from), department: hr.id });
  const room = hrRoom(state)!;
  const square = bestSquares(state, room, true)[0];
  state.furniture.push({ kind: desk.id, room: room.id, x: square[0], y: square[1] });
  return true;
}

/** HR monkeys at work (those who can reach their desks), each counted more or less by how it feels about HR. */
export function hrWorking(state: GameState): number {
  return hrStaff(state)
    .filter((i) => canReachDesk(state, state.monkeys[i]) && deskOf(state, i) !== undefined)
    .reduce((n, i) => n + 1 + jobBonus(state.monkeys[i]), 0);
}

/** Happiness HR adds to every typing monkey. */
export function hrHappiness(state: GameState): number {
  return hrWorking(state) * hr.happierEach;
}

/** How much cheaper HR makes new typing monkeys (0.1 = 10%). */
export function hrDiscount(state: GameState): number {
  return Math.min(0.9, hrWorking(state) * hr.discountEach);
}

/**
 * The coin flip, just for fun (Justin, 2026-10-14: "flip a coin and bet to
 * double all of their points or lose all of their points"): heads (a
 * flipChance chance) doubles every banana you have, tails loses them
 * all. Needs some bananas. Returns whether it won, or null if there was
 * nothing to bet.
 */
export function flipCoin(state: GameState, rng: Rng): boolean | null {
  if (state.currency <= 0) return null;
  const won = rng() < flipChance(state);
  if (won) {
    state.currency *= 2; // winnings don't count as earned, so they unlock no earning achievements
    state.stats.flipsWon++;
  } else {
    state.currency = 0;
    state.stats.flipsLost++;
  }
  checkAchievements(state);
  return won;
}

/** Heads' chance on the coin flip: coinFlip.winChance, plus perThing for every achievement, scene, act and play finished and flip won. */
export function flipChance(state: GameState): number {
  const things = state.achievements.length + state.scenesDone.length + state.actsDone.length + state.playsDone.length + state.stats.flipsWon;
  return Math.min(coinFlip.maxChance, coinFlip.winChance + coinFlip.perThing * things);
}

/** How many candidates HR shows: candidatesBase plus one per HR monkey, up to maxCandidates. */
export function candidateCount(state: GameState): number {
  return Math.min(hr.maxCandidates, hr.candidatesBase + hrStaff(state).length);
}

/** Draws a new list of candidates every refreshHours while an HR office stands (the first right away). */
export function drawCandidates(state: GameState, seconds: number, rng: Rng): void {
  if (!hrRoom(state)) return;
  state.candidatesIn -= seconds;
  if (state.candidatesIn > 0) return;
  const pool = { ...state, monkeys: Array.from({ length: candidateCount(state) }, createMonkey) };
  giveTraits(pool, rng);
  state.candidates = pool.monkeys.map(({ trait, speedStat, stamina, jobs }) => {
    if (rng() >= hr.tempChance) return { trait, speedStat, stamina, jobs, tempLeft: 0 };
    // A temp: better stats, a helpful trait, happy in any job.
    const pick = <T>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    const stat = () => Math.round((hr.tempStats.min + rng() * (hr.tempStats.max - hr.tempStats.min)) * 100) / 100;
    return {
      trait: pick(hr.tempTraits),
      speedStat: stat(),
      stamina: stat(),
      jobs: Object.fromEntries(monkeyStats.jobs.map((j) => [j.id, pick(hr.tempFeelings)])),
      tempLeft: hr.tempHours * 3600,
    };
  });
  state.candidatesIn = hr.refreshHours * 3600;
}

/**
 * What a candidate's stats do to its price for a job: (average of speed and
 * stamina) x (1 + its feeling about the job), squared. About 2x for the best,
 * a quarter for the worst.
 */
export function candidateFactor(c: Candidate, job: string): number {
  const f = jobFeeling({ ...createMonkey(), ...c }, job);
  return Math.pow(((c.speedStat + c.stamina) / 2) * (1 + f.bonus), 2);
}

/** A hire's price: the job's price, times the candidate's factor when hiring one (from: its index in state.candidates). */
export function hirePrice(state: GameState, base: number, job: string, from?: number): number {
  const c = from === undefined ? undefined : state.candidates[from];
  return c ? Math.ceil(base * candidateFactor(c, job) * (c.tempLeft > 0 ? hr.tempPrice : 1)) : base;
}

/** A job a monkey can be hired for (a monkeyStats.jobs id). */
export type Job = 'typing' | 'managing' | 'research' | 'hr' | 'marketing' | 'codebreaking';

/**
 * A place a monkey can work: typing for a department, its manager's chair,
 * or a seat in R&D, HR, Marketing or Codebreaking. `id` is the genre (typing),
 * `boss:<genre>` (managing) or the staff department's id. `have` of `max`
 * places are taken; `blocked` says why nobody can go there now ('' if they can).
 */
export interface Post {
  id: string;
  job: Job;
  genre?: Genre;
  have: number;
  max: number;
  blocked: string;
}

/** Why a staff department can't take another monkey, money aside: no office, full, or no square for a desk. */
function staffBlocker(room: Room | undefined, have: number, max: number, state: GameState, needed: string): string {
  if (!room) return needed;
  if (have >= max) return 'full';
  return freeSquares(state, room).length > 0 ? '' : 'desk needed';
}

/**
 * Every place a monkey could work, for hiring (with managers' chairs) or
 * moving a monkey (without): each department with its count of how many it holds.
 */
export function posts(state: GameState, managing = true): Post[] {
  const open = departmentGenres(state);
  const typing: Post[] = (open.length > 0 ? open : [undefined]).map((g) => {
    const have = departmentTypists(state, g);
    const blocked = have >= departmentRules.maxTypists ? 'full' : !departmentRoom(state, g) ? 'room needed' : hasDeskSpace(state, g) ? '' : 'desk needed';
    return { id: g ?? '', job: 'typing', genre: g, have, max: departmentRules.maxTypists, blocked };
  });
  // A department's manager's chair shows once it has an office or the monkeys for one, as the shop did.
  const bosses: Post[] = !managing
    ? []
    : open
        .filter((g) => managerOf(state, g) || officeOf(state, g) || departmentTypists(state, g) >= managers.minDepartmentMonkeys)
        .map((g) => ({ id: `boss:${g}`, job: 'managing', genre: g, have: managerOf(state, g) ? 1 : 0, max: 1, blocked: managerOf(state, g) ? 'full' : managerBlocker(state, g) }));
  const staff: Post[] = [
    ...(state.researchOpen ? [{ id: research.id, job: 'research' as Job, have: researchers(state).length, max: research.maxResearchers, room: labRoom(state), name: 'lab needed' }] : []),
    ...(hrRoom(state) ? [{ id: hr.id, job: 'hr' as Job, have: hrStaff(state).length, max: hr.maxStaff, room: hrRoom(state), name: `${hr.name} office needed` }] : []),
    ...(marketingRoom(state) ? [{ id: marketing.id, job: 'marketing' as Job, have: marketers(state).length, max: marketing.maxStaff, room: marketingRoom(state), name: `${marketing.name} office needed` }] : []),
    ...(codebreakingRoom(state) ? [{ id: codebreaking.id, job: 'codebreaking' as Job, have: codebreakers(state).length, max: codebreaking.maxStaff, room: codebreakingRoom(state), name: `${codebreaking.name} office needed` }] : []),
  ].map(({ room, name, ...p }) => ({ ...p, blocked: staffBlocker(room, p.have, p.max, state, name) }));
  return [...typing, ...bosses, ...staff];
}

/** The usual price of a hire for a post, before a candidate's stats change it. */
export function postCost(state: GameState, post: Post): number {
  if (post.job === 'managing') return managerCost(state, post.genre!);
  if (post.job === 'research') return researcherCost(state);
  if (post.job === 'hr') return hrCost(state);
  if (post.job === 'marketing') return marketingCost(state);
  if (post.job === 'codebreaking') return codebreakerCost(state);
  return nextMonkeyCost(state, post.genre);
}

/** Hires a monkey for a post: candidate `from` on HR's list, or someone unseen (random stats and trait). */
export function hireFor(state: GameState, post: Post, from?: number): boolean {
  if (post.job === 'managing') return hireManager(state, post.genre, from);
  if (post.job === 'research') return hireResearcher(state, from);
  if (post.job === 'hr') return hireHR(state, from);
  if (post.job === 'marketing') return hireMarketer(state, from);
  if (post.job === 'codebreaking') return hireCodebreaker(state, from);
  return buyMonkey(state, post.genre, from);
}

/** The room a staff department works in, by its id. */
function staffRoom(state: GameState, id: string): Room | undefined {
  return id === research.id ? labRoom(state) : id === hr.id ? hrRoom(state) : id === marketing.id ? marketingRoom(state) : id === codebreaking.id ? codebreakingRoom(state) : undefined;
}

/** The post a monkey works at now, by its id (as in posts). */
export function postOf(state: GameState, m: MonkeyState): string {
  if (isStaff(m)) return m.department;
  const g = monkeyGenre(state, m) ?? '';
  return m.manager ? `boss:${g}` : g;
}

/**
 * Moves a monkey to another department, typing or staff (see posts), with
 * its desk. A manager who moves goes back to typing (or to its new job).
 */
export function moveMonkeyTo(state: GameState, index: number, postId: string): boolean {
  const m = state.monkeys[index];
  const post = posts(state, false).find((p) => p.id === postId);
  if (!m || !post || post.blocked || postOf(state, m) === postId) return false;
  // Its desk moves with it (a manager's desk stays in its office).
  const from = monkeyGenre(state, m);
  const oldRoom = isStaff(m) ? staffRoom(state, m.department) : m.manager && officeOf(state, from) ? undefined : departmentRoom(state, from);
  const oldDesk = oldRoom ? roomDesks(state, oldRoom).pop() : undefined;
  if (oldDesk !== undefined) state.furniture.splice(oldDesk, 1);
  if (m.manager) {
    m.manager = false;
    if (m.target) unpin(state, m.target);
    m.target = null;
  }
  m.department = post.id;
  const room = post.job === 'typing' ? departmentRoom(state, post.genre) : staffRoom(state, post.id);
  const square = room && bestSquares(state, room, true)[0];
  if (room && square) state.furniture.push({ kind: desk.id, room: room.id, x: square[0], y: square[1] });
  return true;
}

/** Takes a candidate off the list, for a hire: its trait and stats (nothing for an unseen hire). */
function takeCandidate(state: GameState, from?: number): Partial<Candidate> {
  if (from === undefined || !state.candidates[from]) return {};
  return state.candidates.splice(from, 1)[0];
}

/** Takes one thing out of a storage count. */
function unstore(counts: Record<string, number>, id: string): void {
  if ((counts[id] = (counts[id] ?? 0) - 1) <= 0) delete counts[id];
}

/** What a piece of furniture or a hat sells for: sellBack of its base price. */
export function sellValue(cost: number): number {
  return Math.floor(cost * sellBack);
}

/** Whether a piece can be put away or sold: anything but a desk or a manager's desk (monkeys sit at those). */
export function canRemoveFurniture(state: GameState, index: number): boolean {
  const f = state.furniture[index];
  return !!f && f.kind !== desk.id && f.kind !== managerDesk.id && f.kind !== safe.id;
}

/** Puts a piece of furniture away in storage; buying one of its kind later takes it out for free. */
export function storeFurniture(state: GameState, index: number): boolean {
  if (!canRemoveFurniture(state, index)) return false;
  const [f] = state.furniture.splice(index, 1);
  state.stored.furniture[f.kind] = (state.stored.furniture[f.kind] ?? 0) + 1;
  return true;
}

/** Sells a piece of furniture for sellBack of its base price (in bananas). */
export function sellFurniture(state: GameState, index: number): boolean {
  if (!canRemoveFurniture(state, index)) return false;
  const [f] = state.furniture.splice(index, 1);
  state.sentences += sellValue(furnitureKinds.find((k) => k.id === f.kind)?.cost ?? 0);
  return true;
}

/** Sells the hat a monkey wears for sellBack of its base price (in Sentences). */
export function sellHat(state: GameState, index: number): boolean {
  const m = state.monkeys[index];
  const h = hats.find((x) => x.id === m?.hat);
  if (!m || !h) return false;
  m.hat = '';
  m.hatColor = '';
  state.sentences += sellValue(h.cost);
  return true;
}

/**
 * Moves a hat: the one a monkey wears (`from` its index) or one from the
 * inventory (`from` 'storage', `key` as hatKey), onto another monkey (whose
 * own hat goes into the inventory) or into the inventory.
 */
export function moveHat(state: GameState, from: number | 'storage', key: string, to: number | 'storage'): boolean {
  if (from === to) return false;
  const giver = from === 'storage' ? undefined : state.monkeys[from];
  const taker = to === 'storage' ? undefined : state.monkeys[to];
  if (to !== 'storage' && !taker) return false;
  if (giver ? !giver.hat || hatKey(giver.hat, giver.hatColor) !== key : !state.stored.hats[key]) return false;
  if (giver) takeOffHat(state, giver); // into the inventory for a moment
  if (taker) return wearHat(state, to as number, splitHatKey(key).id, key);
  return true;
}

/**
 * Two monkeys swap typewriters. Skill stays with the monkey; one above its
 * new typewriter's cap keeps it but can't train further. Temps can't swap.
 */
export function swapTypewriters(state: GameState, a: number, b: number): boolean {
  const [x, y] = [state.monkeys[a], state.monkeys[b]];
  if (!x || !y || a === b || isTemp(x) || isTemp(y)) return false;
  [x.typewriter, y.typewriter] = [y.typewriter, x.typewriter];
  return true;
}

/** Why a monkey can't be fired ('' if it can): the office needs at least one typing monkey. */
export function fireBlocker(state: GameState, index: number): string {
  const m = state.monkeys[index];
  if (!m) return 'no such monkey';
  // Temps leave on their own, so the office keeps one typing monkey that isn't a temp.
  const staying = (o: MonkeyState) => isTypist(o) && !isTemp(o);
  return staying(m) && state.monkeys.filter(staying).length <= 1 ? 'your last typing monkey' : '';
}

/**
 * Fires a monkey: it leaves (its desk stays, free), and its hat goes into
 * storage for other monkeys to wear for free. Nothing is paid back, and the
 * price of the next hire doesn't drop.
 */
export function fireMonkey(state: GameState, index: number): boolean {
  if (fireBlocker(state, index)) return false;
  letGo(state, index);
  return true;
}

/** A monkey leaves: its desk stays, free, and its hat goes into the inventory. */
function letGo(state: GameState, index: number): void {
  const [m] = state.monkeys.splice(index, 1);
  takeOffHat(state, m);
  if (m.manager) manage(state);
}

/** Whether a monkey is a temp (hired from HR's list; it leaves when its time is up). */
export function isTemp(m: MonkeyState): boolean {
  return m.tempLeft > 0;
}

/** Temps work their time down; those whose time is up leave. Returns the names of those who left. */
export function endTemps(state: GameState, seconds: number): string[] {
  const left: string[] = [];
  for (let i = state.monkeys.length - 1; i >= 0; i--) {
    const m = state.monkeys[i];
    if (!isTemp(m)) continue;
    m.tempLeft -= seconds;
    if (m.tempLeft > 0) continue;
    left.unshift(monkeyName(state, i));
    letGo(state, i);
  }
  return left;
}


/** The Library, if built. */
export function libraryRoom(state: GameState): Room | undefined {
  return state.office.find((r) => r.kind === 'library');
}

/** Whether the Library can be built on the office map: a play or text is finished (or shelved before a Folio) and there's no Library yet. */
export function canBuildLibrary(state: GameState): boolean {
  return !libraryRoom(state) && (state.playsDone.length > 0 || state.shelved.length > 0);
}

/** Shelves every finished play and text not shelved yet. Returns whether any was. */
export function shelveBooks(state: GameState): boolean {
  const fresh = state.playsDone.filter((id) => !state.shelved.includes(id));
  state.shelved.push(...fresh);
  if (libraryRoom(state)) for (const id of fresh) announce(state, `${bookTitle(id)} is shelved in the ${library.name}.`);
  return fresh.length > 0;
}

/** A shelved book's title: its play or text, or "Folio N". */
export function bookTitle(id: string): string {
  if (id === 'bibliography') return 'Bibliography';
  const folio = /^folio-(\d+)$/.exec(id);
  return folio ? `Folio ${folio[1]}` : (getPlay(id)?.title ?? id);
}

/** The Library's galleries, each a list of its books (first to last, filled in the order shelved). Empty without the Library. */
export function libraryGalleries(state: GameState): string[][] {
  if (!libraryRoom(state)) return [];
  return Array.from({ length: Math.max(1, state.galleries) }, (_, g) => state.shelved.slice(g * library.booksPerGallery, (g + 1) * library.booksPerGallery));
}

/** Books waiting for a gallery with room. */
export function unshelvedBooks(state: GameState): number {
  return libraryRoom(state) ? Math.max(0, state.shelved.length - Math.max(1, state.galleries) * library.booksPerGallery) : state.shelved.length;
}

/** Lines for the next gallery. */
export function galleryCost(state: GameState): number {
  return Math.ceil(library.galleryCost * Math.pow(library.galleryCostGrowth, Math.max(0, state.galleries - 1)));
}

/** Buys a gallery for the Library. */
export function buyGallery(state: GameState): boolean {
  const cost = galleryCost(state);
  if (!libraryRoom(state) || state.lines < cost) return false;
  state.lines -= cost;
  state.galleries = Math.max(1, state.galleries) + 1;
  return true;
}

/** Points bonus from the Library: fullBonus for each full gallery. */
export function libraryBonus(state: GameState): number {
  if (!libraryRoom(state)) return 0;
  return Math.min(Math.max(1, state.galleries), Math.floor(state.shelved.length / library.booksPerGallery)) * library.fullBonus;
}

/** Whether the Latin text is found: the Library's first shelf held it, which makes the Greek department the Classical department. */
export function latinUnlocked(state: GameState): boolean {
  return state.owned.some((k) => k.startsWith(`${translation.latinText}:`));
}

/**
 * Building the Library for the first time (and again after a Folio) finds
 * the Latin text on its first shelf (Justin, 2026-10-17): you own all of it,
 * it's shelved, and the Greek department (opened now if it isn't yet) becomes
 * the Classical department, which can type Greek or Latin. Returns whether it
 * was found now.
 */
export function unlockLatin(state: GameState): boolean {
  const play = plays.get(translation.latinText);
  if (!play || !libraryRoom(state) || latinUnlocked(state)) return false;
  const opened = state.departments.includes('greek');
  for (const sc of play.scenes) state.owned.push(`${play.id}:${sc.key}`);
  state.completed[play.id] ??= [];
  if (!opened) state.departments.push('greek');
  if (!state.shelved.includes(play.id)) state.shelved.push(play.id);
  announce(state, `A book in Latin was waiting on the ${library.name}'s first shelf: ${play.title}.`);
  announce(state, opened ? 'The Greek department is now the Classical department: it can type Latin too (Staff store).' : 'A Classical department opened to type it: build its room on the office map.');
  return true;
}

/** Switches the Classical department between Greek and Latin. Its slots and its manager's line start over in the new language. */
export function switchClassical(state: GameState): boolean {
  if (!latinUnlocked(state)) return false;
  state.classical = state.classical === 'greek' ? 'latin' : 'greek';
  state.slots = state.slots.map((x) => (x.department === 'greek' ? { ...x, word: '', on: false } : x));
  for (const m of state.monkeys) if (m.manager && m.department === 'greek') m.target = null;
  announce(state, `The Classical department is typing ${state.classical === 'greek' ? 'Greek' : 'Latin'} now.`);
  return true;
}

/** Adds a line to the LATELY feed's news: what just opened or changed (Justin, 2026-10-17: "it shows up as messages in the lately category"). */
export function announce(state: GameState, text: string): void {
  state.lately.news = [...state.lately.news, { text, at: state.stats.secondsTyping }].slice(-lately.maxNews);
}
