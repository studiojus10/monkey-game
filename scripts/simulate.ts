/**
 * Plays the game headlessly with a simple greedy bot and prints when each
 * stage is reached, to check pacing for the balance pass.
 *
 *   npx tsx scripts/simulate.ts [hours=24] [seed=1]
 *
 * The bot checks the shop every few seconds and buys what a reasonable player
 * would: letters (common ones first), faster typing and typewriters, monkeys
 * and the floor space for them, combo cap raises, cheap scenes, departments
 * and their rooms, managers and word slots, and some furniture and
 * accessories, and aims word slots at the best line in reach like a manager
 * would. It never pets the monkey and doesn't design the office.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { accessories, departmentRules, furnitureKinds, typewriterKeys } from '../src/game/config';
import {
  accessoryCost,
  availableKeys,
  availablePlays,
  buyAccessory,
  buyCapRaise,
  buyFasterTyping,
  buyFurniture,
  buyKey,
  buyLetter,
  buyMonkey,
  buyRoom,
  buySection,
  buySlot,
  buyTypewriter,
  canPromote,
  canSeatMonkey,
  capRaiseCost,
  chooseFirstLetter,
  chooseStarterScene,
  departmentChoices,
  departmentGenres,
  departmentMonkeys,
  departmentPicks,
  departmentRoom,
  departmentsWithRoom,
  departmentTypists,
  expandRoom,
  furnitureCost,
  furnitureSpot,
  keyCost,
  letterCost,
  canAffordLetter,
  monkeyGenre,
  nextMonkeyCost,
  openDepartment,
  ownsScene,
  roomCost,
  roomlessDepartments,
  scenePrice,
  setPlays,
  setWordList,
  skillCap,
  slotsUnlocked,
  squareCost,
  starterScenes,
  tick,
  toggleManager,
  typewriterCost,
  typingUpgradeCost,
  assignMonkey,
  reachableLines,
  managerOf,
  managerLine,
  getPlay,
  departmentSlots,
} from '../src/game/logic';
import type { PlayData } from '../src/game/plays';
import { createInitialState, type GameState } from '../src/game/state';

const hours = Number(process.argv[2] ?? 24);
let seed = Number(process.argv[3] ?? 1);
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const root = new URL('../', import.meta.url);
setWordList(readFileSync(fileURLToPath(new URL('data/words.txt', root)), 'utf8').split(/\r?\n/).filter(Boolean).map((w) => w.toUpperCase()));
const dir = fileURLToPath(new URL('data/plays/', root));
setPlays(readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as PlayData));

const s: GameState = createInitialState(0);
openDepartment(s, departmentChoices(s)[0]);
const starter = starterScenes(s)[0];
chooseStarterScene(s, starter.play.id, starter.scene.key);
chooseFirstLetter(s, 'A');

const letterOrder = 'ETOINSHRDLUCMWFGYPBVKJXQZ'.split('');
const seen = new Map<string, number>();
const fmt = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;
};
const mark = (label: string, t: number) => {
  if (!seen.has(label)) {
    seen.set(label, t);
    console.log(`${fmt(t).padStart(8)}  ${label}`);
  }
};

/** One round of shopping: keeps buying until nothing more is worth it. */
function shop(): void {
  for (let guard = 0; guard < 200; guard++) {
    let bought = false;
    // Letters, common first.
    if (canAffordLetter(s)) {
      const l = letterOrder.find((x) => !s.letters.includes(x));
      if (l && buyLetter(s, l)) bought = true;
    }
    // Typing: the cheapest skill level or typewriter across monkeys.
    const typists = s.monkeys.map((m, i) => i).filter((i) => !s.monkeys[i].manager);
    for (const i of typists) {
      const m = s.monkeys[i];
      if (m.skill < skillCap(m) && s.currency >= typingUpgradeCost(m.skill) && buyFasterTyping(s, i)) bought = true;
      else if (m.skill >= skillCap(m) && s.currency >= typewriterCost(m) * 2 && buyTypewriter(s, i)) bought = true;
    }
    // Departments and their rooms.
    if (departmentPicks(s) > 0) {
      const g = departmentChoices(s)[0];
      if (g && openDepartment(s, g)) bought = true;
    }
    for (const g of roomlessDepartments(s)) if (s.currency >= roomCost(s) && buyRoom(s, 'department', g)) bought = true;
    // Monkeys, with floor space for them.
    if (s.lines >= nextMonkeyCost(s)) {
      if (!canSeatMonkey(s)) {
        const g = departmentGenres(s).find((x) => departmentTypists(s, x) < departmentRules.maxTypists && departmentRoom(s, x));
        const room = g && departmentRoom(s, g);
        if (room && s.currency >= squareCost(s)) expandRoom(s, room.id);
      }
      const rooms = departmentsWithRoom(s);
      const g = rooms.length > 0 ? rooms.reduce((a, b) => (departmentTypists(s, a) <= departmentTypists(s, b) ? a : b)) : undefined;
      if ((g ? buyMonkey(s, g) : buyMonkey(s))) bought = true;
    }
    while (s.unassignedMonkeys > 0 && assignMonkey(s, departmentsWithRoom(s)[0])) bought = true;
    // Combo cap with Sentences.
    if (s.sentences >= capRaiseCost(s.comboCapLevel) && buyCapRaise(s)) bought = true;
    // The cheapest unowned scene, if it costs under a quarter of the points in hand.
    const scenes = availablePlays()
      .filter((p) => departmentGenres(s).includes(p.genre))
      .flatMap((p) => p.scenes.filter((sc) => !ownsScene(s, p.id, sc)).map((sc) => ({ p, sc, price: scenePrice(sc) })))
      .sort((a, b) => a.price - b.price);
    if (scenes[0] && s.currency >= scenes[0].price * 4 && buySection(s, scenes[0].p.id, scenes[0].sc.act, scenes[0].sc.key)) bought = true;
    // A manager for each department of 6+.
    for (const g of departmentGenres(s)) {
      const i = departmentMonkeys(s, g).find((k) => canPromote(s, k));
      if (i !== undefined && toggleManager(s, i)) bought = true;
    }
    // Word slots (managers fill them) and typewriter keys.
    if (slotsUnlocked(s)) for (const g of departmentGenres(s)) if (buySlot(s, g)) bought = true;
    const key = availableKeys(s).find((k) => s.currency >= keyCost(s, k) * 3);
    if (key && buyKey(s, key)) bought = true;
    // A little furniture and some accessories, with spare points.
    const f = furnitureKinds.find((k) => s.currency >= furnitureCost(s, k.id) * 10 && furnitureSpot(s));
    if (f && s.office.some((r) => r.kind === 'break') && buyFurniture(s, f.id)) bought = true;
    if (!s.office.some((r) => r.kind === 'break') && s.monkeys.length >= 5 && s.currency >= roomCost(s) * 5 && buyRoom(s, 'break')) bought = true;
    for (const a of accessories) {
      const i = typists.find((k) => !s.monkeys[k].accessories.some((x) => accessories.find((y) => y.id === x)?.slot === a.slot));
      if (i !== undefined && s.currency >= accessoryCost(s, a.id) * 10 && buyAccessory(s, i, a.id)) bought = true;
    }
    if (!bought) break;
  }
  // Like a player (or a manager), aim word slots at the best line in reach.
  for (const g of departmentGenres(s)) {
    if (managerOf(s, g)) continue;
    const target = managerLine(s, g);
    const words = target ? getPlay(target.play)!.lines[target.index].words : [];
    for (const i of departmentSlots(s, g)) {
      const slot = s.slots[i];
      slot.word = words[slot.position - 1] ?? slot.word;
      slot.on = !!words[slot.position - 1];
    }
  }
}

const end = hours * 3600;
let t = 0;
let nextReport = 3600;
while (t < end) {
  const step = t < 600 ? 1 : 5;
  tick(s, step, rng, 300);
  t += step;
  shop();
  for (const n of [2, 3, 5, 8, 10, 13, 18, 22, 26]) if (s.letters.length >= n) mark(`${n} letters`, t);
  for (const n of [2, 3, 5, 10, 20, 30, 40]) if (s.monkeys.length >= n) mark(`${n} monkeys`, t);
  for (const n of [2, 3, 4]) if (departmentGenres(s).length >= n) mark(`${n} departments`, t);
  for (const n of [1, 10, 50, 100, 500, 1000]) if (s.lines >= 0 && Object.values(s.completed).reduce((a, l) => a + l.length, 0) >= n) mark(`${n} lines written`, t);
  for (const n of [1, 5, 20]) if (s.scenesDone.length >= n) mark(`${n} scenes finished`, t);
  for (const n of [1, 3]) if (s.actsDone.length >= n) mark(`${n} acts finished`, t);
  if (s.playsDone.length >= 1) mark('first play finished', t);
  for (const n of [1, 3]) if (s.keys.length >= n) mark(`${n} typewriter keys`, t);
  if (s.slots.length >= 1) mark('first word slot', t);
  for (const w of [4, 6, 8]) if (s.stats.longestWord.length >= w) mark(`first ${w}-letter word`, t);
  if (s.monkeys.some((m) => m.typewriter > 0)) mark('first better typewriter', t);
  if (t >= nextReport) {
    const written = Object.values(s.completed).reduce((a, l) => a + l.length, 0);
    console.log(
      `   -- ${fmt(t)}: ${s.letters.length} letters, ${s.monkeys.length} monkeys, ${written} lines written, ` +
        `points ${s.currency.toExponential(2)}, Lines ${s.lines}, Sentences ${s.sentences}, Words ${s.words}, ` +
        `skill ${s.monkeys.map((m) => m.skill).join('/')}, rooms ${s.office.length}, ` +
        `scenes owned ${s.owned.length}, lines in reach ${availablePlays().reduce((n, p) => n + reachableLines(s, p.id).length, 0)}`,
    );
    nextReport += 3600 * (hours > 24 ? 6 : 1);
  }
}
console.log(`typewriter keys unlock at ${typewriterKeys.unlockLetters} letters`);
void monkeyGenre;
