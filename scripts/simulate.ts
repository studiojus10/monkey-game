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
 * hats, and aims word slots at the best line in reach like a manager
 * would. It never pets the monkey and doesn't design the office.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as config from '../src/game/config';
import { hats, monkeyShop, sentenceRules, departmentRules, furnitureKinds, typewriterKeys, managers } from '../src/game/config';
import {
  availableKeys,
  availablePlays,
  buyComboStart,
  buyFasterTyping,
  buyFurniture,
  buyKey,
  buyLetter,
  buyMonkey,
  buyRoom,
  buySection,
  buySlot,
  buyTypewriter,
  managerBlocker,
  hireManager,
  canSeatMonkey,
  comboStartCost,
  chooseFirstLetter,
  chooseStarterPlay,
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
  hatCost,
  wearHat,
  keyCost,
  letterCost,
  canAffordLetter,
  monkeyGenre,
  nextMonkeyCost,
  openDepartment,
  roomCost,
  roomlessDepartments,
  sectionPrice,
  setPlays,
  setWordList,
  skillCap,
  slotsUnlocked,
  squareCost,
  starterPlays,
  tick,
  upgradeManager,
  managerUpgradeCost,
  folioPagesNow,
  folioMultiplier,
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
import { deserialize, serialize } from '../src/game/save';

const hours = Number(process.argv[2] ?? 24);
// Try other settings without editing config: SIM_CHAIN_WORDS=6 SIM_WORD_MIN=3
if (process.env.SIM_CHAIN_WORDS) sentenceRules.chainWords = Number(process.env.SIM_CHAIN_WORDS);
if (process.env.SIM_WORD_MIN) sentenceRules.wordMinLength = Number(process.env.SIM_WORD_MIN);
// ...and monkey prices: SIM_MONKEY_COST=1e5 SIM_MONKEY_GROWTH=5 SIM_DEPT_GROWTH=50
if (process.env.SIM_MONKEY_COST) monkeyShop.baseCost = Number(process.env.SIM_MONKEY_COST);
if (process.env.SIM_MONKEY_GROWTH) monkeyShop.costGrowth = Number(process.env.SIM_MONKEY_GROWTH);
if (process.env.SIM_DEPT_GROWTH) monkeyShop.departmentGrowth = Number(process.env.SIM_DEPT_GROWTH);
// Letters a second simulated one by one (the game itself does maxSimulatedLettersPerSecond;
// fewer runs faster, but Lines and Sentences, which need real letters, come slower): SIM_CAP=4000
const simCap = Number(process.env.SIM_CAP ?? 300);
// ...or any number in config.ts: SIM_SET='wordSlots.baseCost=2,managers.sentencesPerMonkey=20'
for (const pair of (process.env.SIM_SET ?? '').split(',').filter(Boolean)) {
  const [path, value] = pair.split('=');
  const keys = path.split('.');
  const target = keys.slice(0, -1).reduce((o: any, k) => o[k], config as any);
  target[keys[keys.length - 1]] = Number(value);
}
let seed = Number(process.argv[3] ?? 1);
/** The line the bot aims each department's word slots at, kept until written. */
const aims = new Map<string, { play: string; index: number }>();
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const root = new URL('../', import.meta.url);
setWordList(readFileSync(fileURLToPath(new URL('data/words.txt', root)), 'utf8').split(/\r?\n/).filter(Boolean).map((w) => w.toUpperCase()));
const dir = fileURLToPath(new URL('data/plays/', root));
setPlays(readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as PlayData));

// Continue from a save the simulator wrote (SIM_LOAD=file), and write one at the end (SIM_SAVE=file),
// to try late-game numbers without replaying the early game. Times count from the save.
const s: GameState = process.env.SIM_LOAD ? deserialize(readFileSync(process.env.SIM_LOAD, 'utf8'), 0) : createInitialState(0);
if (!process.env.SIM_LOAD) {
  openDepartment(s, departmentChoices(s)[0]);
  chooseStarterPlay(s, starterPlays(s)[0].id);
  chooseFirstLetter(s, 'A');
}

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
    } else if (s.freeLetters > 0) {
      // Free letters go on the next letter the bot can't afford yet.
      const l = letterOrder.find((x) => !s.letters.includes(x));
      if (l && buyLetter(s, l, true)) bought = true;
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
    for (const g of roomlessDepartments(s)) if (s.sentences >= roomCost(s) && buyRoom(s, 'department', g)) bought = true;
    // Monkeys, with floor space for them: each department has its own price, so the cheapest with room.
    {
      const rooms = departmentsWithRoom(s);
      const g = rooms.length > 0 ? rooms.reduce((a, b) => (nextMonkeyCost(s, a) <= nextMonkeyCost(s, b) ? a : b)) : undefined;
      const want = departmentGenres(s).length > 0 ? departmentGenres(s).reduce((a, b) => (nextMonkeyCost(s, a) <= nextMonkeyCost(s, b) ? a : b)) : undefined;
      if (want && s.currency >= nextMonkeyCost(s, want) && !rooms.includes(want) && departmentTypists(s, want) < departmentRules.maxTypists) {
        const room = departmentRoom(s, want);
        if (room && s.sentences >= squareCost(s) && s.currency >= nextMonkeyCost(s, want)) expandRoom(s, room.id);
      }
      if (g ? s.currency >= nextMonkeyCost(s, g) && buyMonkey(s, g) : s.currency >= nextMonkeyCost(s) && buyMonkey(s)) bought = true;
    }
    while (s.unassignedMonkeys > 0 && assignMonkey(s, departmentsWithRoom(s)[0])) bought = true;
    // Combo cap with Sentences.
    if (s.sentences >= comboStartCost(s.comboStartLevel) && buyComboStart(s)) bought = true;
    // The cheapest unowned play, if it costs under a quarter of the points in hand.
    const buyable = availablePlays()
      .filter((p) => departmentGenres(s).includes(p.genre))
      .map((p) => ({ p, price: sectionPrice(s, p) }))
      .filter((x) => x.price > 0)
      .sort((a, b) => a.price - b.price);
    if (buyable[0] && s.currency >= buyable[0].price * 4 && buySection(s, buyable[0].p.id)) bought = true;
    // A manager for each department big enough, in an office next door.
    for (const g of departmentGenres(s)) {
      if (managerBlocker(s, g) === 'office needed' && departmentTypists(s, g) >= managers.minDepartmentMonkeys && buyRoom(s, 'office', g)) bought = true;
      if (!managerBlocker(s, g) && hireManager(s, g)) bought = true;
    }
    // Manager upgrades with spare Sentences.
    for (const i of s.monkeys.flatMap((m, k) => (m.manager ? [k] : []))) {
      if (s.sentences >= managerUpgradeCost(s, s.monkeys[i]) * 2 && upgradeManager(s, i)) bought = true;
    }
    // Word slots (managers fill them) and typewriter keys.
    if (slotsUnlocked(s)) for (const g of departmentGenres(s)) if (buySlot(s, g)) bought = true;
    const key = availableKeys(s).find((k) => s.currency >= keyCost(s, k) * 3);
    if (key && buyKey(s, key)) bought = true;
    // A little furniture with spare points, and better hats with spare Sentences.
    const f = furnitureKinds.find((k) => s.sentences >= furnitureCost(s, k.id) * 10 && furnitureSpot(s, k.id));
    if (f && s.office.some((r) => r.kind === 'break') && buyFurniture(s, f.id)) bought = true;
    if (!s.office.some((r) => r.kind === 'break') && s.monkeys.length >= 5 && s.sentences >= roomCost(s) * 5 && buyRoom(s, 'break')) bought = true;
    const rank = (id: string) => hats.findIndex((h) => h.id === id);
    for (const h of [...hats].reverse()) {
      const i = typists.find((k) => rank(s.monkeys[k].hat) < rank(h.id));
      if (i !== undefined && s.sentences >= hatCost(s, h.id) * 2 && wearHat(s, i, h.id)) bought = true;
    }
    if (!bought) break;
  }
  // Like a player (or a manager), aim word slots at a line in reach.
  for (const g of departmentGenres(s)) {
    if (managerOf(s, g)) continue;
    // Keep the line until it's written, as managers do.
    const kept = aims.get(g);
    const target = kept && !(s.completed[kept.play] ?? []).includes(kept.index) ? kept : managerLine(s, g, rng);
    if (target) aims.set(g, target);
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
  tick(s, step, rng, simCap);
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
  const worn = s.monkeys.filter((m) => m.hat).length;
  for (const n of [1, 5, 10, 20, 40]) if (worn >= n) mark(`${n} hats`, t);
  if (t >= nextReport) {
    const written = Object.values(s.completed).reduce((a, l) => a + l.length, 0);
    console.log(
      `   -- ${fmt(t)}: ${s.letters.length} letters, ${s.monkeys.length} monkeys, ${written} lines written, ` +
        `points ${s.currency.toExponential(2)} (earned ${s.totalEarned.toExponential(2)}), Lines ${s.lines}, Sentences ${s.sentences} (${s.stats.chainSentences} from chains), Words ${s.words}, ` +
        `skill ${s.monkeys.map((m) => m.skill).join('/')}, rooms ${s.office.length}, ` +
        `scenes owned ${s.owned.length}, lines in reach ${availablePlays().reduce((n, p) => n + reachableLines(s, p.id).length, 0)}, ` +
        `departments ${departmentGenres(s).length}, managers ${s.monkeys.filter((m) => m.manager).map((m) => m.managerLevel).join('/') || '-'}, ` +
        `Folio pages ${folioPagesNow(s)} (would make points x${folioMultiplier({ ...s, folioPages: s.folioPages + folioPagesNow(s) }).toFixed(2)})`,
    );
    if (process.env.SIM_SAVE) writeFileSync(`${process.env.SIM_SAVE.replace(/\.json$/, '')}-${Math.round(t / 3600)}h.json`, serialize(s));
    nextReport += 3600 * (hours > 24 ? 6 : 1);
  }
}
console.log(`typewriter keys unlock at ${typewriterKeys.unlockLetters} letters`);
if (process.env.SIM_SAVE) writeFileSync(process.env.SIM_SAVE, serialize(s)); // and one at every report: <name>-<hours>h.json
void monkeyGenre;
