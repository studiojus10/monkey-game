import {
  combo,
  extraWords,
  lineRewards,
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
  startingLetters,
  typewriterKeys,
  wordSlots,
  typing,
} from './config';
import { buildPlay, genres, playGenres, type Genre, type Play, type PlayData, type Scene } from './plays';
import { createMonkey, type GameState, type MonkeyState, type Pin, type Segment, type WordSlot } from './state';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from './words';

/** Random number source in [0, 1); injectable so tests are deterministic. */
export type Rng = () => number;

let wordList: readonly string[] = extraWords;
let cached = new Map<string, { key: string; dict: Dictionary }>();

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
  const list = state.departments.filter((g): g is Genre => genres.includes(g as Genre));
  for (const k of state.owned) {
    const g = plays.get(k.split(':')[0])?.genre;
    if (g && !list.includes(g)) list.push(g);
  }
  return list;
}

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
  const next = [...open.slice(at + 1), ...open.slice(0, at)].find(
    (g) => departmentTypists(state, g) < departmentRules.maxTypists,
  );
  if (!next) return false;
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

/** Points earned are multiplied by this; finished scenes raise it. */
export function pointsMultiplier(state: GameState): number {
  return 1 + state.pointsBonus;
}

/** Typing speed is multiplied by this; finished acts raise it. */
export function speedMultiplier(state: GameState): number {
  return 1 + state.speedBonus;
}

/** Letters per second for each monkey, with "Faster typing" and act bonuses. */
export function monkeySpeed(state: GameState, level = state.typingLevel): number {
  return lettersPerSecond(level) * speedMultiplier(state);
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
      ({ line, i }) => !done.has(i) && ownsLine(state, play, i) && missingLetters(state, line.letters).length === 0,
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
  const key = [...state.letters].sort().join('') + '|' + state.owned.join('|');
  let entry = cached.get(genre ?? '');
  if (entry?.key !== key) {
    const words = [...wordList, ...ownedLines(state, genre).words].filter((w) => !isOneLetterRun(w));
    entry = { key, dict: new Dictionary(words, state.letters) };
    cached.set(genre ?? '', entry);
  }
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

/** Cost in Lines of the next monkey; free monkeys from acts don't raise it. */
export function nextMonkeyCost(state: GameState): number {
  const total = state.monkeys.length + state.unassignedMonkeys;
  return monkeyCost(Math.max(1, total - milestones.actFreeMonkeys * state.actsDone.length));
}

/** Typing monkeys (managers not counted) in a department. */
export function departmentTypists(state: GameState, genre: Genre | undefined): number {
  return departmentMonkeys(state, genre).filter((i) => !state.monkeys[i].manager).length;
}

/** Open departments with room for another typing monkey. */
export function departmentsWithRoom(state: GameState): Genre[] {
  return departmentGenres(state).filter((g) => departmentTypists(state, g) < departmentRules.maxTypists);
}

/**
 * Where a new monkey goes: `genre` if it has room; with no genre given, the
 * only department with room. Null if that's not possible (full, or a choice
 * the player has to make). Before any department is open, '' (no department).
 */
function placeFor(state: GameState, genre?: Genre): string | null {
  const rooms = departmentsWithRoom(state);
  if (departmentGenres(state).length === 0) return departmentTypists(state, undefined) < departmentRules.maxTypists ? '' : null;
  if (genre) return rooms.includes(genre) ? genre : null;
  return rooms.length === 1 ? rooms[0] : null;
}

/**
 * Buys a monkey with Lines for a department. The department can be left out
 * when only one has room; the player chooses otherwise.
 */
export function buyMonkey(state: GameState, genre?: Genre): boolean {
  const cost = nextMonkeyCost(state);
  const dept = placeFor(state, genre);
  if (state.letters.length === 0 || state.lines < cost || dept === null) return false;
  state.lines -= cost;
  state.monkeys.push({ ...createMonkey(), department: dept });
  return true;
}

/** Puts an earned monkey that's waiting for a department to work. */
export function assignMonkey(state: GameState, genre?: Genre): boolean {
  const dept = placeFor(state, genre);
  if (state.unassignedMonkeys === 0 || dept === null) return false;
  state.unassignedMonkeys--;
  state.monkeys.push({ ...createMonkey(), department: dept });
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
  return Math.ceil(typewriterKeys.baseCost * typewriterKeys.heavierCostFactor * 2 ** level);
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
export function keyCost(_state: GameState, key: string): number {
  const factor = typewriterKeys.words.includes(key)
    ? typewriterKeys.wordCostFactor
    : typewriterKeys.combinationCostFactor;
  return Math.ceil(typewriterKeys.baseCost * factor);
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
 * previous word so the slot can follow them.
 */
function dueSlot(state: GameState, m: MonkeyState, dict: Dictionary): string {
  const ready = m.pending === '' ? 0 : dict.isWord(m.pending) ? 1 : -1;
  if (ready < 0) return '';
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
    if (m.pending) events.push({ kind: 'word', text: m.pending });
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
      const paid = scoreInChain(state, m, e.text) * pointsMultiplier(state) * managerMultiplier(state, m);
      earn(state, paid);
      wordEarnings += paid;
      state.wordsTyped++;
      state.lastWord = e.text;
      state.lastWordPoints = paid;
      countWord(state, m, e.text, paid, !!slot && e.text === slot);
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

/** Records a scored word in the statistics. Slot words count their letters as typed here. */
function countWord(state: GameState, m: MonkeyState, word: string, paid: number, fromSlot: boolean): void {
  const st = state.stats;
  if (fromSlot) for (const l of word) st.letters[l] = (st.letters[l] ?? 0) + 1;
  st.words[word] = (st.words[word] ?? 0) + 1;
  if (word.length > st.longestWord.length) st.longestWord = word;
  if (paid > st.bestWordPoints) {
    st.bestWord = word;
    st.bestWordPoints = paid;
  }
  st.longestChain = Math.max(st.longestChain, m.chainLength);
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
    points = line.points * line.words.length ** (verse ? 1 : 2) * pointsMultiplier(state) * managerMultiplier(state, m);
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

/** The player pets the first monkey into typing one extra letter. */
export function poke(state: GameState, rng: Rng = Math.random): void {
  const i = state.monkeys.findIndex((m) => !m.manager);
  if (i < 0 || state.letters.length === 0) return;
  state.stats.pets++;
  typeLetter(state, i, rng);
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
 * The line a manager targets: among a genre's unwritten owned lines that
 * your letters can spell, the one with the fewest words, then the earliest
 * in play order.
 */
export function firstReachableLine(state: GameState, genre: Genre | undefined): Pin | null {
  let best: Pin | null = null;
  let bestWords = Infinity;
  for (const play of plays.values()) {
    if (play.genre !== genre) continue;
    for (const index of reachableLines(state, play.id)) {
      const words = play.lines[index].words.length;
      if (words < bestWords || (words === bestWords && best?.play === play.id && index < best.index)) {
        best = { play: play.id, index };
        bestWords = words;
      }
    }
  }
  return best;
}

/**
 * Runs the managers: each keeps its department's target on a reachable
 * unwritten line (fewest words first, then play order), pins it, and fills its department's word slots
 * with the line's words, by position.
 */
export function manage(state: GameState): void {
  for (const genre of departmentGenres(state)) {
    const boss = managerOf(state, genre);
    if (!boss) continue;
    const t = boss.target;
    const done = t && (state.completed[t.play] ?? []).includes(t.index);
    if (!t || done) {
      if (t) unpin(state, t);
      boss.target = firstReachableLine(state, genre);
      if (boss.target && state.pinned.length < maxPinnedLines && !state.pinned.some((p) => samePin(p, boss.target!))) {
        state.pinned.push(boss.target);
      }
    }
    // Slots past the line's end switch off; with no line in reach they all do, so typing is random again.
    const words = boss.target ? plays.get(boss.target.play)!.lines[boss.target.index].words : [];
    for (const i of departmentSlots(state, genre)) {
      const slot = state.slots[i];
      const word = words[slot.position - 1];
      slot.word = word ?? slot.word;
      slot.on = !!word;
    }
  }
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
  state.stats.secondsTyping += seconds;
  manage(state);
  const due = state.monkeys.map((m) => {
    if (m.manager) return 0;
    m.progress += monkeySpeed(state) * seconds;
    const n = Math.floor(m.progress);
    m.progress -= n;
    return n;
  });
  const total = due.reduce((a, b) => a + b, 0);
  const budget = Math.max(state.monkeys.length, Math.floor(maxSimulatedLettersPerSecond * seconds));
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
}

/**
 * Credits typing for time spent away. Returns the points earned. Long
 * absences with many monkeys simulate only the first maxOfflineLetters
 * letters and scale up the points and words from those.
 */
export function applyOfflineProgress(state: GameState, now: number, rng: Rng = Math.random): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSaved) / 1000), maxOfflineSeconds);
  const letters = seconds * monkeySpeed(state) * state.monkeys.length;
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
