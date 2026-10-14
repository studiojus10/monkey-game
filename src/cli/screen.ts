import { dyeCost, energyColors, maxMonkeyNameLength, departmentRules, fengShui, folio, hatColors, hats, monkeyIcon, type Hat, furnitureKinds, type FurnitureKind, typing, letterValues, managers, maxPinnedLines, sonnetRewards, startingLetters, theme, traits, typewriterKeys, wordSlots, managerDesk, research } from '../game/config';
import {
  availableKeys,
  canPublishFolio,
  folioMultiplier,
  folioPagesNow,
  furnitureSpot,
  hatCost,
  furnitureCost,
  canSeatMonkey,
  availablePlays,
  departmentPicks,
  departmentChoices,
  departmentGenres,
  monkeyGenre,
  departmentSlots,
  managerOf,
  slotGenre,
  managerUpgradeCost,
  nextDepartmentAt,
  getPlay,
  capRaiseCost,
  comboCap,
  comboMultiplier,
  keyCost,
  wordKeySpellsNeeded,
  keysUnlocked,
  letterCost,
  letterWordsCost,
  canAffordLetter,
  monkeySpeed,
  currentSpeed,
  nextMonkeyCost,
  departmentTypists,
  hasDeskSpace,
  departmentRoom,
  ownedProgress,
  ownsLine,
  ownsScene,
  sceneOf,
  sceneProgress,
  sectionPrice,
  starterScenes,
  missingLetters,
  slotCost,
  slotsUnlocked,
  monkeyName,
  typingUpgradeCost,
  skillCap,
  typewriterCost,
  typewriterName,
  managerBlocker,
  managerCost,
  officeOf,
  traitOf,
  traitBonus,
  isResearcher,
  isTypist,
  researchers,
  canBuildLab,
  labRoom,
  researcherBlocker,
  researcherCost,
  projectOf,
  projectsLeft,
  researchRate,
  researchSecondsLeft,
  researchShare,
} from '../game/logic';
import { lineLocation, sceneName, type Genre, type Play } from '../game/plays';
import { devTools } from '../game/dev';

import type { GameState, MonkeyState } from '../game/state';
import { formatDuration, formatNumber } from '../format';
import { blue, bold, dim, green, inverse, keyRow, padVisible, plainText, red, rule, titleBar, yellow } from './style';

/**
 * A monkey's current line, all capitals: scored words and skipped letters,
 * then any letters still waiting to become a word and a cursor. At most
 * `room` letters show: the newest ones.
 * Uses ANSI bold, which every common terminal supports.
 */
export function renderLine(m: MonkeyState, room = Infinity): string {
  let text = m.line.map((s) => s.text.toUpperCase());
  // On a screen narrower than the line, its oldest letters drop off the left.
  let over = text.join('').length + m.pending.length - room;
  for (let i = 0; over > 0 && i < text.length; i++) {
    const cut = Math.min(over, text[i].length);
    text = text.map((t, j) => (j === i ? t.slice(cut) : t));
    over -= cut;
  }
  // The live part is bold: the current run of back-to-back words plus any
  // letters still forming a word. If the newest letter was skipped, just it.
  let lastSkip = m.line.length - 1;
  while (lastSkip >= 0 && m.line[lastSkip].scored) lastSkip--;
  if (lastSkip === m.line.length - 1 && !m.pending) lastSkip--;
  const settled = text.slice(0, lastSkip + 1).join('');
  const live = text.slice(lastSkip + 1).join('') + m.pending;
  return settled + (live ? bold(live) : '') + '_';
}


/** A price in bold: green when you can afford it, the terminal's normal text color when you can't. */
export function price(cost: number, have: number): string {
  const text = bold(formatNumber(cost));
  return have >= cost ? green(text) : text;
}

/** Monkey lines shown on screen; the rest are summarized in one line. */
export const maxMonkeyLines = 10;

export function unownedLetters(state: GameState): string[] {
  return Object.keys(letterValues)
    .sort()
    .filter((l) => !state.letters.includes(l));
}

/** The prompt shown while picking which letter to buy, with each letter's value. */
export function letterPickPrompt(state: GameState): string {
  const choices = unownedLetters(state).map((l) => `${l}(${letterValues[l]})`);
  return `Press letters to buy (any other key: done). Values: ${choices.join(' ')}`;
}

/** Exact counts with thousands separators, e.g. 4,011. */
const count = (n: number) => n.toLocaleString('en-US');

/** Genre names for display. */
export const genreNames: Record<Genre, string> = {
  comedy: 'Comedies',
  history: 'Histories',
  tragedy: 'Tragedies',
  sonnet: 'Sonnets',
};

/**
 * One of the opening screens (genre, free scene, first letter): the title,
 * a line of story, a dim explanation, the choices with dim details lined up
 * after them, and the keys.
 */
function openingScreen(intro: string, explain: string[], choices: [string, string, string][], keys: [string, string][], message: string, columns: number): string {
  const width = Math.max(...choices.map(([, name]) => name.length));
  return [
    bold(inverse(` ${theme.title.toUpperCase()} `)),
    '',
    ...(intro ? [` ${intro}`] : []),
    ...explain.map((r) => dim(` ${r}`)),
    '',
    ...choices.map(([key, name, details]) => `   ${bold(`[${key}]`)} ${details ? `${name.padEnd(width)}   ${dim(details)}` : name}`),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow(keys, columns),
  ].join('\n');
}

/** The prompt for unlocking another genre. */
export function departmentPrompt(state: GameState): string {
  return `Open a department: ${departmentChoices(state).map((g, i) => `[${i + 1}] ${genreNames[g]}`).join('   ')}   (any other key cancels)`;
}

/** A bonus as a percentage, e.g. 0.215 -> "21.5%". */
const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;

/** Column widths of the monkey table, fixed so nothing shifts as numbers change. */
const col = { name: maxMonkeyNameLength, speed: 8, energy: 7, combo: 5, trait: Math.max(...traits.map((t) => t.name.length)) };

/** Whether the monkey table shows traits: once the manager's book is read. */
const hasTraitColumn = (state: GameState) => state.managerBook;

/** What a monkey's trait is doing for it right now, e.g. "+15% speed" or "-5% speed, +20% pay"; "no effect right now" when nothing. */
export function traitNow(state: GameState, m: MonkeyState): string {
  const parts = (['speed', 'pay', 'rest'] as const).flatMap((e) => {
    const b = traitBonus(state, m, e);
    return b === 0 ? [] : [`${b > 0 ? '+' : ''}${Math.round(b * 100)}% ${e === 'rest' ? 'faster breaks' : e}`];
  });
  return parts.length > 0 ? parts.join(', ') : 'no effect right now';
}

/** A monkey's trait for the TRAIT column: green while it helps, red while it hurts, dim when it does nothing. */
function traitText(state: GameState, m: MonkeyState): string {
  const text = (traitOf(m)?.name ?? '?').padEnd(col.trait);
  const net = traitBonus(state, m, 'speed') + traitBonus(state, m, 'pay') + traitBonus(state, m, 'rest');
  return net > 0 ? green(text) : net < 0 ? red(text) : dim(text);
}

/** Whether the monkey table has a department column (once there's more than one department). */
const hasDeptColumn = (state: GameState) => departmentGenres(state).length > 1;

/** Width of a monkey row before its line: icon, department, name and heart, speed, energy and combo. */
function monkeyPrefixWidth(state: GameState): number {
  return 1 + 3 + (hasDeptColumn(state) ? 2 : 0) + col.name + 2 + 2 + (hasTraitColumn(state) ? col.trait + 2 : 0) + col.speed + 2 + col.energy + 2 + col.combo + 2;
}

/** A speed for the SPEED column: 0.50/s, 33.3/s, 1.23K/s. */
export function speedText(n: number): string {
  return `${n >= 1000 ? formatNumber(n) : n.toFixed(n < 10 ? 2 : 1)}/s`;
}

/** A typist's energy as a percent, green when fresh, yellow when tiring, red when nearly spent; Resting in blue on a break. */
function energyText(m: MonkeyState): string {
  if (!isTypist(m)) return dim('-'.padStart(col.energy));
  if (m.resting) return blue('Resting'.padStart(col.energy));
  const p = Math.round(m.energy * 100);
  const text = `${p}%`.padStart(col.energy);
  return p > energyColors.green ? green(text) : p > energyColors.yellow ? yellow(text) : red(text);
}

/** The departments [tab] goes through on the home screen: the play departments, then R&D once it's open. */
export function homeViews(state: GameState): string[] {
  return [...departmentGenres(state), ...(state.researchOpen ? [research.id] : [])];
}

/** The department whose monkeys the home screen shows: the one chosen with [tab], else the first. */
export function homeView(state: GameState): string | undefined {
  const views = homeViews(state);
  return views.find((g) => g === state.settings.homeDepartment) ?? views[0];
}

/** The play department the home screen shows, if it shows one (not R&D). */
export function homeGenre(state: GameState): Genre | undefined {
  const view = homeView(state);
  return view === research.id ? undefined : (view as Genre | undefined);
}

/** The monkeys on the home screen, by index: with several departments, only the shown department's. */
function homeMonkeys(state: GameState): number[] {
  if (homeViews(state).length <= 1) return state.monkeys.map((_, i) => i);
  if (homeView(state) === research.id) return researchers(state);
  const shown = homeGenre(state);
  return state.monkeys.flatMap((m, i) => (!isResearcher(m) && monkeyGenre(state, m) === shown ? [i] : []));
}

/** What R&D is up to, in a line: the project under way with how far along and how long it has left. */
export function researchStatus(state: GameState): string {
  const p = projectOf(state.researching);
  if (!p) return projectsLeft(state).length > 0 ? 'No project under way: start one in the Research store.' : 'Every project is done.';
  const left = researchSecondsLeft(state);
  return `Researching ${p.name}: ${Math.floor(researchShare(state) * 100)}%, ${Number.isFinite(left) ? `${formatDuration(left)} left` : 'nobody working on it'}`;
}

/** The monkey table's column headings. */
function monkeyHeadings(state: GameState): string {
  return dim(
    ' ' + 'MONKEY'.padEnd(3 + (hasDeptColumn(state) ? 2 : 0) + col.name + 2) + '  ' + (hasTraitColumn(state) ? 'TRAIT'.padEnd(col.trait) + '  ' : '') + 'SPEED'.padStart(col.speed) + '  ' +
      'ENERGY'.padStart(col.energy) + '  ' + 'COMBO'.padStart(col.combo) + '  ' + (state.monkeys.some((m) => !isTypist(m)) ? 'TYPING (or managing, researching)' : 'TYPING'),
  );
}

/** One monkey's row: its icon (hat dyed), department initial, name (a heart if petted lately), speed, energy, combo and line. */
function monkeyRow(state: GameState, i: number, room: number): string {
  const m = state.monkeys[i];
  const dept = hasDeptColumn(state) ? `${isResearcher(m) ? 'R' : genreNames[monkeyGenre(state, m)!][0]} ` : '';
  const name = `${monkeyName(state, i).padEnd(col.name)}${m.petHappiness > 0 ? '<3' : '  '}`;
  const speed = !isTypist(m) ? dim('-'.padStart(col.speed)) : speedText(currentSpeed(state, m)).padStart(col.speed);
  const combo = !isTypist(m) ? dim('-'.padStart(col.combo)) : `x${comboMultiplier(state, m)}`.padStart(col.combo);
  const trait = hasTraitColumn(state) ? `${traitText(state, m)}  ` : '';
  return ` ${dyed(m, iconOf(m))} ${dept}${name}  ${trait}${speed}  ${energyText(m)}  ${combo}  ${m.manager ? managerLine(m) : isResearcher(m) ? researcherLine(state) : renderLine(m, room)}`;
}

/** A researcher's line on the home screen: what R&D is working on. */
function researcherLine(state: GameState): string {
  const p = projectOf(state.researching);
  return p ? `RESEARCHING ${p.name.toUpperCase()} ${Math.floor(researchShare(state) * 100)}%` : dim('RESEARCHING nothing yet');
}

/** Letters a monkey's line has room for on a screen this many columns wide (after its columns, keeping the last column and the cursor free). */
export function lineRoom(state: GameState, columns: number): number {
  return columns - monkeyPrefixWidth(state) - 2;
}

/** The alphabet in order: letters you own in their places, the rest as blank slots. */
function letterRow(state: GameState): string {
  const alphabet = Object.keys(letterValues).sort();
  return alphabet.map((l) => (state.letters.includes(l) ? bold(l) : dim('_'))).join(' ') + dim(`   (${state.letters.length} of ${alphabet.length})`);
}

/** What happened lately: the last word, line and milestone (dim), anything waiting for you, then the newest message in bold. */
function latelyLines(state: GameState, message: string): string[] {
  const rows = [
    ...(state.lastWord ? [dim(`Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}`)] : []),
    ...[...lastLineText(state), ...lastMilestoneText(state)].map((t) => dim(t.replace(/^\* /, ''))),
    ...folioOffer(state),
    ...(departmentPicks(state) > 0 ? ['* You can open a new department in the Staff store.'] : []),
    ...(canBuildLab(state) ? ['* You can build an R&D lab on the office map ([o], then [r]).'] : []),
    ...(state.researchOpen ? [`${research.name}: ${researchStatus(state)}`] : []),
    ...(message ? [bold(message)] : []),
  ];
  return rows.length === 0 ? [] : ['', dim(' LATELY'), ...rows.map((r) => `   ${r}`)];
}

/** The keys shown under the home screen: where to go, then what to do. Every key is on the [?] page. */
function homeKeys(state: GameState, columns: number): string[] {
  return [
    keyRow([['space', 'shop'], ['m', 'monkeys'], ['p', 'script'], ['o', 'office'], ['t', 'stats'], ['a', 'achievements'], ['w', 'dictionary']], columns),
    keyRow([
      ...(homeViews(state).length > 1 ? [['tab', 'department'] as [string, string]] : []),
      ['enter', theme.pokeAction],
      ['n', 'name'],
      ['d', 'move'],
      ['c', 'options'],
      ...(canPublishFolio(state) ? [['f', 'publish a Folio'] as [string, string]] : []),
      ['?', 'all keys'],
      ['q', 'quit'],
    ], columns),
  ];
}

/** Every key on the home screen, for the [?] page. */
export function renderHomeKeys(state: GameState): string {
  const group = (title: string, keys: [string, string][]) => [dim(` ${title}`), ...keys.map(([k, what]) => `   ${bold(`[${k}]`.padEnd(9))} ${what}`), ''];
  return [
    titleBar(state, 'Keys'),
    '',
    ...group('GO TO', [
      ['space', 'the shop (then [left/right] another store, [1-9] buy, [i] inspect, [up/down] more items)'],
      ['m', 'your monkeys: each one\'s job, typing, hats, trait and desk'],
      ['p', 'the script: plays, pins and scenes to buy'],
      ['o', 'the office map'],
      ['t', 'statistics'],
      ['a', 'achievements'],
      ['w', 'the dictionary of words your monkeys have spelled'],
      ['c', 'options'],
    ]),
    ...group('MONKEYS', [
      ...(homeViews(state).length > 1 ? [['tab', "show the next department's monkeys"] as [string, string]] : []),
      ['enter', theme.pokeAction],
      ['n', 'name a monkey'],
      ['d', 'move a monkey to another department'],
    ]),
    ...group('GAME', [
      ...(canPublishFolio(state) ? [['f', 'publish a Folio and start over'] as [string, string]] : []),
      ['s', 'save now (the game also saves on its own)'],
      ['r', 'reset: start a new game'],
      ['`', 'dev tools'],
      ['q', 'quit'],
    ]),
    rule(),
    keyRow([['esc', 'back']]),
  ].join('\n');
}

/** Renders the whole game screen as plain text. */
export function renderScreen(state: GameState, message = '', shop: Store | null = null, columns = 0, page = 0, rows = 0): string {
  if (state.owned.length === 0 && state.departments.length === 0) {
    const genres = departmentChoices(state);
    return openingScreen(
      'Somewhere, infinite monkeys are trying to write Shakespeare.',
      ['Choose their first department. Each works on one genre; the others', 'open as you gather more monkeys.'],
      genres.map((g, i) => [String(i + 1), genreNames[g], availablePlays().filter((p) => p.genre === g).map((p) => p.title).join(', ')]),
      [[genres.length === 1 ? '1' : `1-${genres.length}`, 'choose'], ['q', 'quit']],
      message,
      columns,
    );
  }

  if (state.owned.length === 0) {
    const scenes = starterScenes(state);
    return openingScreen(
      'Choose a free first scene for your monkeys to work toward.',
      ['Later you can buy more scenes, acts and whole plays in the script.'],
      scenes.map(({ play, scene }, i) => [String(i + 1), `${play.title}, ${sceneName(scene.act, scene.scene)}`, `${count(scene.lines.length)} line${scene.lines.length === 1 ? '' : 's'}`]),
      [[scenes.length === 1 ? '1' : `1-${scenes.length}`, 'choose'], ['q', 'quit']],
      message,
      columns,
    );
  }

  if (state.letters.length === 0) {
    return openingScreen(
      'Your monkey sits at a typewriter with no keys.',
      ['Pick its first letter. It has to be a word on its own.'],
      startingLetters.map((l) => [l.toLowerCase(), l, ''] as [string, string, string]),
      [[startingLetters.map((l) => l.toLowerCase()).join('/'), 'choose'], ['q', 'quit']],
      message,
      columns,
    );
  }

  if (shop) {
    // The shop opens under the home screen when the screen is tall enough for both, else on its own.
    const both = [...homeLines(state, '', columns), rule(columns), ...renderShop(state, shop, page, message, columns, true).split('\n')];
    return rows > 0 && both.length <= rows ? both.join('\n') : renderShop(state, shop, page, message, columns);
  }
  return [...homeLines(state, message, columns), '', rule(columns), ...homeKeys(state, columns)].join('\n');
}

/** The home screen above its keys: the monkey table, letters, script, LATELY and pins. */
function homeLines(state: GameState, message: string, columns: number): string[] {
  const [written, ownedLines] = ownedProgress(state);
  const ownedScenes = scenesOwned(state);
  const room = columns > 0 ? lineRoom(state, columns) : Infinity;
  const label = (s: string) => dim(` ${s.padEnd(8)}`);
  const views = homeViews(state);
  const shown = homeMonkeys(state);
  const view = homeView(state);
  const viewName = view === research.id ? research.name : view ? genreNames[view as Genre] : '';
  const lines = [
    titleBar(state),
    '',
    // With several departments, one at a time: its name, then which of how many.
    ...(views.length > 1 && view ? [` ${bold(viewName.toUpperCase())}${dim(`   department ${views.indexOf(view) + 1} of ${views.length}`)}`] : []),
    monkeyHeadings(state),
    ...shown.slice(0, maxMonkeyLines).map((i) => monkeyRow(state, i, room)),
    ...(shown.length > maxMonkeyLines ? [dim(` ...and ${shown.length - maxMonkeyLines} more monkeys typing`)] : []),
    '',
    `${label('Letters')} ${letterRow(state)}`,
    `${label('Script')} ${count(written)} / ${count(ownedLines)} lines written${dim(`   ${count(ownedScenes)} scene${ownedScenes === 1 ? '' : 's'} owned`)}`,
    ...milestoneSummary(state).map((b) => `${label('Bonuses')} ${b}`),
    ...latelyLines(state, message),
    ...pinnedText(state),
  ];
  return lines;
}

/** Monkeys that type (not managers), by index. */
export function typists(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isTypist(m) ? [i] : []));
}

/** Shop items for typing skill and typewriters: spelled out for one monkey, the cheapest for several. */
function typingItems(state: GameState): { skill: ShopItem; typewriter: ShopItem } {
  const team = typists(state);
  const can = (n: number) => state.currency >= n;
  const trainable = team.filter((i) => state.monkeys[i].skill < skillCap(state.monkeys[i]));
  const cheapestSkill = Math.min(...trainable.map((i) => typingUpgradeCost(state.monkeys[i].skill)));
  const cheapestWriter = Math.min(...team.map((i) => typewriterCost(state.monkeys[i])));
  if (team.length === 1) {
    const m = state.monkeys[team[0]];
    const name = monkeyName(state, team[0]);
    const cost = typingUpgradeCost(m.skill);
    const writer = typewriterCost(m);
    return {
      skill:
        m.skill < skillCap(m)
          ? {
              id: 'train',
              star: can(cost),
              text: 'Faster typing',
              effect: `${name}: ${monkeySpeed(state, m).toFixed(2)} -> ${monkeySpeed(state, m, m.skill + 1).toFixed(2)}/s, skill ${m.skill}/${skillCap(m)}`,
              cost: [[cost, 'currency']],
            }
          : { id: 'train', text: 'Faster typing', effect: `${name}: skill ${m.skill}/${skillCap(m)}, needs a better typewriter` },
      typewriter: {
        id: 'typewriter',
        star: can(writer),
        text: typewriterName(m.typewriter + 1),
        effect: `${name}: skill cap ${skillCap(m)} -> ${skillCap(m) + typing.levelsPerTypewriter}`,
        cost: [[writer, 'currency']],
      },
    };
  }
  return {
    skill:
      trainable.length > 0
        ? { id: 'train', star: can(cheapestSkill), text: 'Faster typing', effect: '+1 skill for a monkey', cost: [[cheapestSkill, 'currency']], costFrom: true }
        : { id: 'train', text: 'Faster typing', effect: 'every typewriter is maxed out' },
    typewriter: {
      id: 'typewriter',
      star: can(cheapestWriter),
      text: 'Better typewriter',
      effect: `skill cap +${typing.levelsPerTypewriter} for a monkey`,
      cost: [[cheapestWriter, 'currency']],
      costFrom: true,
    },
  };
}

/** Picker prompt for Faster typing or a better typewriter: each typing monkey with its skill and the price. */
export function typingPickPrompt(state: GameState, what: 'skill' | 'typewriter'): string {
  const rows = typists(state)
    .filter((i) => i < 9)
    .map((i) => {
      const m = state.monkeys[i];
      const cost = what === 'skill' ? typingUpgradeCost(m.skill) : typewriterCost(m);
      const capped = what === 'skill' && m.skill >= skillCap(m);
      return `[${i + 1}] ${monkeyName(state, i)} ${m.skill}/${skillCap(m)}${capped ? ' (needs a typewriter)' : ` ${price(cost, state.currency)}`}`;
    });
  return `${what === 'skill' ? 'Faster typing' : 'Better typewriter'} for which monkey? ${rows.join('   ')}   (any other key: done)`;
}

/** The shop's stores, shown as tabs; left and right switch between them. */
export const stores = ['typewriters', 'staff', 'script', 'department', 'break', 'hats', 'research'] as const;
export type Store = (typeof stores)[number];

/** The stores you can open now: Research only once the R&D lab is built. */
export function openStores(state: GameState): Store[] {
  return stores.filter((x) => x !== 'research' || !!labRoom(state));
}
export const storeNames: Record<Store, string> = {
  typewriters: 'Typewriters',
  staff: 'Staff',
  script: 'Script',
  research: 'Research',
  department: 'Office',
  break: 'Breakroom',
  hats: 'Hats',
};

/** A currency, by its GameState field. */
type Currency = 'currency' | 'words' | 'sentences' | 'lines';

/**
 * Something for sale in a store, in columns: its name, look, feng shui
 * element, what it does and its price. Items without an id are notes and get
 * no number.
 */
export interface ShopItem {
  id?: string;
  star?: boolean;
  /** The item's name, or a note's words. */
  text: string;
  glyph?: string;
  element?: string;
  effect?: string;
  cost?: [number, Currency][];
  /** The price is the cheapest of several ("from"). */
  costFrom?: boolean;
  /** Why it can't be bought however much you have, shown in red where the price goes (e.g. "desk needed"). */
  blocked?: string;
}

const currencyNames: Record<Currency, string> = { currency: theme.currency, words: 'Words', sentences: 'Sentences', lines: 'Lines' };

/** What a store sells. Numbered items (those with an id) are bought with 1-9 in this order. */
export function storeItems(state: GameState, store: Store): ShopItem[] {
  const typingShop = typingItems(state);
  switch (store) {
    case 'staff': {
      const nextCap = capRaiseCost(state.comboCapLevel);
      const open = departmentGenres(state);
      // With several departments each has its own price, so each gets its own line.
      // A department with no free square for a desk (or no room yet) says so where the price goes.
      const hire = (genre?: Genre): ShopItem => {
        const cost = nextMonkeyCost(state, genre);
        const where = genre ? `for ${genreNames[genre]} (${departmentTypists(state, genre)}/${departmentRules.maxTypists})` : `you have ${state.monkeys.length}`;
        const item: ShopItem = { id: genre ? `hire:${genre}` : 'hire', text: 'Hire a monkey', effect: where };
        return hasDeskSpace(state, genre ?? open[0])
          ? { ...item, star: state.currency >= cost, cost: [[cost, 'currency']] }
          : { ...item, blocked: departmentRoom(state, genre ?? open[0]) ? 'desk needed' : 'room needed' };
      };
      const hiring = open.filter((g) => departmentTypists(state, g) < departmentRules.maxTypists);
      // A department can hire a manager once it has the monkeys or an office for one; until then a note says what it takes.
      const managing = open.filter((g) => !managerOf(state, g) && (officeOf(state, g) || departmentTypists(state, g) >= managers.minDepartmentMonkeys));
      const hireManager = (g: Genre): ShopItem => {
        const cost = managerCost(state, g);
        const blocked = managerBlocker(state, g);
        const item: ShopItem = { id: `boss:${g}`, text: 'Hire a manager', effect: open.length > 1 ? `for ${genreNames[g]}` : 'picks lines, fills slots' };
        return blocked ? { ...item, blocked } : { ...item, star: state.currency >= cost, cost: [[cost, 'currency']] };
      };
      return [
        ...(departmentPicks(state) > 0
          ? [{ id: 'department', star: true, text: 'Open a new department!' }]
          : nextDepartmentAt(state) > 0
            ? [{ text: `Next department opens at ${nextDepartmentAt(state)} monkeys.` }]
            : []),
        typingShop.skill,
        ...(open.length > 1
          ? hiring.map((g) => hire(g))
          : hiring.length > 0 || open.length === 0
            ? [hire()]
            : [{ text: 'Hire a monkey: the department is full. Open another to hire more.' }]),
        ...(state.researchOpen
          ? [
              ((): ShopItem => {
                const cost = researcherCost(state);
                const blocked = researcherBlocker(state);
                const item: ShopItem = { id: 'researcher', text: 'Hire a researcher', effect: `${researchers(state).length}/${research.maxResearchers} in ${research.name}` };
                return blocked ? { ...item, blocked } : { ...item, star: state.currency >= cost, cost: [[cost, 'currency']] };
              })(),
            ]
          : []),
        ...(managing.length > 0
          ? managing.map(hireManager)
          : open.some((g) => !managerOf(state, g))
            ? [{ text: `A department of ${managers.minDepartmentMonkeys} monkeys can hire a manager, with an office next door.` }]
            : []),
        ...(state.unassignedMonkeys > 0
          ? [
              canSeatMonkey(state)
                ? { id: 'assign', text: `Assign ${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? '' : 's'}`, effect: 'to a department' }
                : { text: `${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? ' is' : 's are'} waiting for a free square for a desk.` },
            ]
          : []),
        { id: 'combo', star: state.sentences >= nextCap, text: 'Raise combo cap', effect: `x${comboCap(state)} -> x${comboCap(state) + 1}`, cost: [[nextCap, 'sentences']] },
        ...(managerChoices(state).length > 0
          ? [
              {
                id: 'manager',
                text: 'Upgrade a manager',
                effect: `+${managers.bonusPerLevel}x bananas for its department`,
                cost: [[Math.min(...managerChoices(state).map((i) => managerUpgradeCost(state, state.monkeys[i]))), 'lines']] as [number, Currency][],
                costFrom: managerChoices(state).length > 1,
                star: managerChoices(state).some((i) => state.lines >= managerUpgradeCost(state, state.monkeys[i])),
              },
            ]
          : []),
      ];
    }
    case 'typewriters': {
      const nextLetter = letterCost(state.letters.length);
      const nextLetterWords = letterWordsCost(state.letters.length);
      return [
        ...(unownedLetters(state).length > 0
          ? [
              {
                id: 'letter',
                star: canAffordLetter(state),
                text: 'Buy a letter key',
                effect: `you choose it (${unownedLetters(state).length} left)`,
                cost: [[nextLetter, 'currency'], ...(nextLetterWords > 0 ? [[nextLetterWords, 'words'] as [number, Currency]] : [])] as [number, Currency][],
              },
            ]
          : []),
        typingShop.typewriter,
        keysUnlocked(state)
          ? { id: 'keys', text: 'Typewriter keys...', effect: 'letter combos and whole words' }
          : { text: `Typewriter keys unlock when you own ${typewriterKeys.unlockLetters} letters.` },
        slotsUnlocked(state)
          ? { id: 'slots', text: 'Word slots...', effect: `${state.slots.filter((x) => x.on && x.word).length} active` }
          : { text: `Word slots unlock when you own ${wordSlots.unlockLetters} letters.` },
      ];
    }
    case 'department':
    case 'break': {
      const have = state.office.some((r) => r.kind === store);
      // The Office store also sells manager's desks, for managers' offices.
      const kinds = furnitureKinds.filter((k) => k.rooms.includes(store) || (store === 'department' && k.id === managerDesk.id)).sort((a, b) => a.cost - b.cost);
      return [
        {
          text:
            store === 'department'
              ? "Furniture for a department's own room: it helps the monkeys who work there."
              : 'Furniture for break rooms: it helps each department whose nearest one it is.',
        },
        ...kinds.map((k): ShopItem => {
          const cost = furnitureCost(state, k.id);
          const where = k.rooms.includes(store) ? store : k.rooms[0];
          return {
            id: `furniture:${k.id}@${where}`,
            star: !!furnitureSpot(state, k.id, where) && state.currency >= cost,
            text: k.size ? `${k.name} (${k.size[0]}x${k.size[1]})` : k.name,
            glyph: k.glyph,
            // Elements mean nothing until the feng shui book explains them.
            ...(state.fengShuiBook ? { element: k.element } : {}),
            effect: furnitureEffect(k),
            cost: [[cost, 'currency']],
          };
        }),
        {
          text: !have
            ? `You have no ${store === 'break' ? 'break room' : "department's room"} yet: buy one on the office map ([o], then [r]).`
            : state.settings.autoPlaceFurniture
              ? `New furniture places itself in a ${store === 'break' ? 'break room' : "department's room"} ([c] options).`
              : 'New furniture opens the office map so you can place it.',
        },
      ];
    }
    case 'research': {
      const busy = !!state.researching;
      const rate = researchRate(state);
      const done = research.projects.filter((p) => state.researched.includes(p.id)).map((p) => p.name);
      return [
        { text: researchStatus(state) },
        ...projectsLeft(state)
          .filter((p) => p.id !== state.researching)
          .map((p): ShopItem => {
            // How long it takes: with today's researchers, or with one if there are none.
            const time = formatDuration((p.hours * 3600) / Math.max(1, rate));
            const item: ShopItem = { id: `research:${p.id}`, text: p.name, effect: `${p.text} ${time}` };
            return busy ? { ...item, blocked: 'one at a time' } : { ...item, star: state.currency >= p.cost, cost: [[p.cost, 'currency']] };
          }),
        ...(done.length > 0 ? [{ text: `Done: ${done.join(', ')}.` }] : []),
        ...(rate === 0 ? [{ text: 'Nobody is researching: hire researchers in the Staff store.' }] : []),
      ];
    }
    case 'script':
      return [{ id: 'script', text: 'Scenes, acts and plays...', effect: `for ${departmentGenres(state).map((g) => genreNames[g]).join(', ')}` }];
    case 'hats': {
      const team = state.monkeys.map((_, i) => i).filter((i) => i < 9);
      return [
        ...hats.map((h): ShopItem => {
          const cost = hatCost(state, h.id);
          const someone = team.some((i) => !state.monkeys[i].hats.includes(h.id));
          return { id: `hat:${h.id}`, star: someone && state.sentences >= cost, text: h.name, glyph: `${h.icon}${monkeyIcon}`, effect: hatEffect(h), cost: [[cost, 'sentences']] };
        }),
        {
          id: 'dye',
          star: state.monkeys.some((m) => m.hat) && state.sentences >= dyeCost,
          text: 'Dye a hat...',
          effect: hatColors.map((c) => paint(c.id, c.name)).join(', '),
          cost: [[dyeCost, 'sentences']],
        },
        { text: 'Monkeys keep every hat they get: wearing one again is free.' },
      ];
    }
  }
}

/** How monkeys show on the office map: at a desk [@], a hat in place of the [, & marking a manager. */
export const monkeyIconLegend = [`[${monkeyIcon}] monkey`, `[${monkeyIcon}& manager`, `#${monkeyIcon}] in a hat`];

/** A monkey's hat character, if it wears one. */
export function hatOf(m: MonkeyState): string | undefined {
  return hats.find((h) => h.id === m.hat)?.icon;
}

/** A monkey's icon, two ASCII characters: its hat (or a space) and its face, e.g. #@. */
export function iconOf(m: MonkeyState): string {
  return `${hatOf(m) ?? ' '}${monkeyIcon}`;
}

/** Text in a hat colour (ANSI), or as it is for no colour. */
export function paint(color: string, text: string): string {
  const c = hatColors.find((x) => x.id === color);
  return c ? `\x1b[${c.ansi}m${text}\x1b[39m` : text;
}

/** Text that starts with a monkey's hat character, with the hat in its dye colour. */
export function dyed(m: MonkeyState, text: string): string {
  return m.hat && m.hatColor ? paint(m.hatColor, text[0]) + text.slice(1) : text;
}

/** What a hat does for the monkey wearing it, in a few words. */
export function hatEffect(h: Hat): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    ...(h.points ? [`+${pct(h.points)} pay`] : []),
    ...(h.speed ? [`+${pct(h.speed)} speed`] : []),
    ...(h.drain ? [`tires ${pct(h.drain)} slower`] : []),
    ...(h.rest ? [`breaks ${pct(h.rest)} faster`] : []),
    ...(h.combo ? [`combo cap +${h.combo}`] : []),
  ].join(', ');
}

/** The monkeys a picker offers (keys 1-9), with a note for each. */
function monkeyChoices(state: GameState, note: (m: MonkeyState) => string): string {
  return state.monkeys
    .slice(0, 9)
    .map((m, i) => `[${i + 1}] ${monkeyName(state, i)}${note(m)}`)
    .join('   ');
}

/** The prompt for choosing which monkey gets a hat. */
export function hatPickPrompt(state: GameState, id: string): string {
  const h = hats.find((x) => x.id === id)!;
  const rows = monkeyChoices(state, (m) =>
    m.hat === id ? ' (wearing it: takes it off)' : m.hats.includes(id) ? ' (has one: free)' : hatOf(m) ? ` (swaps its ${hats.find((x) => x.id === m.hat)!.name.toLowerCase()})` : '',
  );
  return `${h.name} (${price(hatCost(state, id), state.sentences)} Sentences) for which monkey? ${rows}   (any other key: done)`;
}

/** The prompt for choosing a dye. */
export function dyeColorPrompt(): string {
  return `Dye which colour? ${hatColors.map((c, i) => `[${i + 1}] ${paint(c.id, c.name)}`).join('   ')}   [0] undyed   (any other key cancels)`;
}

/** The prompt for choosing which monkey's hat to dye. */
export function dyePickPrompt(state: GameState, color: string): string {
  const name = hatColors.find((c) => c.id === color)?.name ?? 'Undyed';
  const rows = monkeyChoices(state, (m) => (!m.hat ? ' (no hat)' : m.hatColor === color ? ' (already)' : ''));
  return `${paint(color, name)} (${color ? `${price(dyeCost, state.sentences)} Sentences` : 'free'}) for which monkey's hat? ${rows}   (any other key: done)`;
}

/** What inspecting a store item shows: its description, or nothing of interest. */
export function inspectItem(id: string | undefined): string {
  const [what, which] = (id ?? '').split('@')[0].split(':');
  const d = what === 'furniture' ? furnitureKinds.find((k) => k.id === which)?.description : what === 'hat' ? hats.find((h) => h.id === which)?.description : undefined;
  return d ?? fengShui.nothing;
}

/** What a kind of furniture does, in a few words. */
export function furnitureEffect(k: FurnitureKind): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    ...(k.drain ? [`tire ${pct(k.drain)} slower`] : []),
    ...(k.rest ? [`breaks ${pct(k.rest)} faster`] : []),
    ...(k.happiness ? [`+${pct(k.happiness)} pay`] : []),
  ].join(', ');
}

/** The numbered (buyable) items of a store, in key order 1-9. */
export function storeChoices(state: GameState, store: Store, page = 0): ShopItem[] {
  return storeItems(state, store)
    .filter((x) => x.id)
    .slice(page * storePageSize, (page + 1) * storePageSize);
}

/** Numbered items a store shows at once (keys 1-9); a bigger store has pages. */
export const storePageSize = 9;

/** How many pages a store's numbered items fill. */
export function storePages(state: GameState, store: Store): number {
  return Math.max(1, Math.ceil(storeItems(state, store).filter((x) => x.id).length / storePageSize));
}

/** A price as text, e.g. "from 500 Bananas" or "75 Bananas + 1 Words"; numbers in bold when `boldNumbers`. */
function costText(item: ShopItem, boldNumbers = false): string {
  const parts = (item.cost ?? []).map(([n, c]) => `${boldNumbers ? bold(formatNumber(n)) : formatNumber(n)} ${currencyNames[c]}`);
  return parts.length === 0 ? '' : `${item.costFrom ? 'from ' : ''}${parts.join(' + ')}`;
}

/**
 * The shop, on its own screen: the stores as tabs (the open one inverse, a *
 * on any with something you can afford), then the open store's items in
 * columns with prices on the right. What you can afford has a green price and
 * a *; what you can't yet is dim. Notes are dim too. Feng shui elements show
 * only once the feng shui book is read. `under` leaves out the title bar, for
 * the shop under the home screen.
 */
export function renderShop(state: GameState, store: Store, page = 0, message = '', columns = 0, under = false): string {
  const items = storeItems(state, store);
  const numbered = items.filter((x) => x.id);
  const pages = storePages(state, store);
  const tabs = openStores(state).map((x) => {
    const star = storeItems(state, x).some((i) => i.star) ? '*' : ' ';
    return x === store ? bold(inverse(` ${storeNames[x]}${star}`)) : dim(` ${storeNames[x]}`) + green(star);
  });

  // Column widths come from every numbered item in the store, so they stay put between pages.
  const width = (f: (x: ShopItem) => string | undefined) => Math.max(0, ...numbered.map((x) => plainText(f(x) ?? '').length));
  const nameWidth = width((x) => x.text);
  const glyphWidth = width((x) => x.glyph);
  const elementWidth = numbered.some((x) => x.element) ? Math.max('ELEMENT'.length, width((x) => x.element)) : 0;
  const effectWidth = width((x) => x.effect);
  const costWidth = Math.max('PRICE'.length, width((x) => (x.cost ? `* ${costText(x)}` : (x.blocked ?? ''))));
  // Columns are two spaces apart, or one when that's what fits the screen.
  const widths = [5 + nameWidth, glyphWidth, elementWidth, effectWidth, costWidth].filter((w) => w > 0);
  const gap = columns > 0 && widths.reduce((a, b) => a + b, 0) + 2 * (widths.length - 1) >= columns ? ' ' : '  ';
  const row = (num: string, name: string, glyph: string, element: string, effect: string, cost: string) =>
    [
      ` ${num.padEnd(4)}${padVisible(name, nameWidth)}`,
      ...(glyphWidth > 0 ? [padVisible(glyph, glyphWidth)] : []),
      ...(elementWidth > 0 ? [padVisible(element, elementWidth)] : []),
      padVisible(effect, effectWidth),
      padVisible(cost, costWidth, 'right'),
    ].join(gap);

  const firstItem = items.findIndex((x) => x.id);
  const intro = items.slice(0, Math.max(0, firstItem));
  let k = 0; // numbered items so far, across pages
  const list = items.slice(Math.max(0, firstItem)).flatMap((x) => {
    if (!x.id) return [`     ${dim(x.text)}`];
    const n = k++ - page * storePageSize;
    if (n < 0 || n >= storePageSize) return [];
    const cost = x.blocked ? red(x.blocked) : !x.cost ? '' : x.star ? green(`* ${costText(x, true)}`) : costText(x);
    const text = row(`[${n + 1}]`, x.text, x.glyph ?? '', x.element ?? '', x.effect ?? '', cost);
    return [x.cost && !x.star ? dim(plainText(text)) : text];
  });

  return [
    ...(under ? [] : [titleBar(state, 'Shop', columns), '']),
    tabs.join(' '),
    '',
    ...intro.map((x) => ` ${dim(x.text)}`),
    ...(intro.length > 0 ? [''] : []),
    dim(row('', 'ITEM', '', elementWidth > 0 ? 'ELEMENT' : '', 'EFFECT', 'PRICE').trimEnd()),
    ...list,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow(
      [
        ['1-9', 'buy'],
        ['i', 'inspect'],
        ['left/right', 'store'],
        ...(pages > 1 ? [['up/down', `page ${page + 1} of ${pages}`] as [string, string]] : []),
        ['esc', 'back'],
      ],
      columns,
    ),
  ].join('\n');
}

/** The options menu. */
export function renderOptions(state: GameState, columns = 0): string {
  const onOff = (on: boolean) => (on ? green(bold('ON')) : dim('off'));
  const option = (key: string, label: string, on: boolean, notes: string[]) => [` ${bold(`[${key}]`)} ${label.padEnd(26)}${onOff(on)}`, ...notes.map((n) => dim(`     ${n}`)), ''];
  return [
    titleBar(state, 'Options', columns),
    '',
    ...option('1', 'Furniture places itself', state.settings.autoPlaceFurniture, [
      'On: new furniture goes in the first free square (a break room first).',
      'Off: buying furniture opens the office map so you can place it.',
    ]),
    ...option('2', 'Light background', state.settings.lightBackground, ["On: darker colours that are easy to read when your terminal's theme is light."]),
    rule(columns),
    keyRow([['1-2', 'switch'], ['esc', 'back']], columns),
  ].join('\n');
}

/** The development tools menu, for testing features. */
export function renderDevMenu(state: GameState, message = '', columns = 0): string {
  return [
    titleBar(state, 'Dev tools', columns),
    '',
    dim(' For testing: these change your save.'),
    '',
    ...devTools.map((t, i) => ` ${bold(`[${i + 1}]`)} ${t.label}`),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([[`1-${devTools.length}`, 'use a tool'], ['esc', 'back']], columns),
  ].join('\n');
}

/** Ordinal for a chain position: 1st, 2nd, 3rd, 4th, ... */
export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/**
 * The word slots menu. `selected` is the slot being edited; `typing` is the
 * word being typed in, or null when not typing.
 */
export function renderSlotsMenu(
  state: GameState,
  genre: Genre | undefined,
  selected: number,
  typing: string | null,
  message = '',
  columns = 0,
): string {
  const mine = departmentSlots(state, genre);
  const next = slotCost(mine.length);
  const canBuy = mine.length < wordSlots.maxSlots;
  const rows = mine.map((i, k) => {
    const x = state.slots[i];
    const word = i === selected && typing !== null ? `${typing}_` : x.word || dim('(no word)');
    const row = `${i === selected ? '>' : ' '} [${k + 1}] ${ordinal(x.position).padEnd(4)} word  ${padVisible(word, 16)} ${x.on ? green('ON') : dim('off')}`;
    return i === selected ? inverse(plainText(row) + ' ') : row;
  });
  const managed = !!managerOf(state, genre);
  const many = departmentGenres(state).length > 1;
  return [
    titleBar(state, 'Word slots', columns),
    '',
    ...(genre ? [` ${bold(`${genreNames[genre]} department`)}`, ''] : []),
    dim(' Each slot makes the word at its position in a chain always the word you'),
    dim(' choose, e.g. 3rd word: FRIEND. Switch slots off for fully random typing.'),
    '',
    ...(managed ? [" This department's manager sets these slots for you.", ''] : []),
    ...(rows.length > 0 ? rows : [dim('   No slots yet.')]),
    ...(canBuy
      ? ['', ` ${bold('[b]')} buy a slot   ${state.lines >= next ? green(`* ${bold(formatNumber(next))} Lines`) : `${formatNumber(next)} Lines`}`]
      : []),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    typing !== null
      ? keyRow([['a-z', 'type the word'], ['enter', 'set it'], ['esc', 'cancel']], columns)
      : keyRow(
          [
            ['up/down', 'select'],
            ['w', 'set word'],
            ['o', 'on/off'],
            ['left/right', 'move position'],
            ...(many ? [['tab', 'next department'] as [string, string]] : []),
            ['esc', 'back'],
          ],
          columns,
        ),
  ].join('\n');
}

/** Keys 1-9 in the typewriter keys menu buy these, in order. */
export function keyChoices(state: GameState): string[] {
  return availableKeys(state).slice(0, 9);
}

/** The words closest to unlocking as keys, with how often they've been spelled. */
function nextWordKeys(state: GameState): string[] {
  const near = Object.entries(state.stats.words)
    .filter(([w, n]) => w.length >= typewriterKeys.wordMinLength && n < wordKeySpellsNeeded(state) && !state.keys.includes(w))
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, 5)
    .map(([w, n]) => `${w} ${n}/${wordKeySpellsNeeded(state)}`);
  return near.length > 0 ? [`  Closest: ${near.join('   ')}`] : [];
}

/** The typewriter keys menu: combination keys and the word keys your monkeys have unlocked. */
export function renderKeysMenu(state: GameState, message = '', columns = 0): string {
  const owned = state.keys.length > 0 ? state.keys.join(' ') : dim('none yet');
  const choices = keyChoices(state).map((k) => ({ k, kind: typewriterKeys.combinations.includes(k) ? 'combination' : 'word', cost: keyCost(state, k) }));
  const keyWidth = Math.max(3, ...choices.map((c) => c.k.length));
  return [
    titleBar(state, 'Typewriter keys', columns),
    '',
    dim(` Each key types its whole text in one keystroke. Words of ${typewriterKeys.wordMinLength}+ letters become`),
    dim(
      ` keys after ${wordKeySpellsNeeded(state)} spellings` +
        ` (${Math.round((typewriterKeys.wordSpellsGrowth - 1) * 100)}% more for each word key you own).`,
    ),
    ...nextWordKeys(state).map((r) => ` ${dim('Closest')} ${r.replace(/^ *Closest: /, '')}`),
    '',
    ...choices.map(({ k, kind, cost }, i) => {
      const row = ` [${i + 1}] ${k.padEnd(keyWidth)}  ${kind.padEnd(11)}  `;
      return state.currency >= cost ? `${row}${green(`* ${bold(formatNumber(cost))} ${theme.currency}`)}` : dim(`${row}  ${formatNumber(cost)} ${theme.currency}`);
    }),
    ...(choices.length === 0 ? [dim('   None available yet.')] : []),
    '',
    ` ${dim('Owned')}  ${owned}`,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([...(choices.length > 0 ? [[`1-${choices.length}`, 'buy'] as [string, string]] : []), ['esc', 'back']], columns),
  ].join('\n');
}

/** What a manager shows instead of typing: the line it has its department aiming at. */
function managerLine(m: MonkeyState): string {
  const play = m.target && getPlay(m.target.play);
  const line = play && m.target && play.lines[m.target.index];
  const title = `MANAGER (department x${(1 + managers.bonusPerLevel * m.managerLevel).toFixed(1)})`;
  return play && line
    ? `${title}, aiming at ${play.title} ${lineLocation(line, play.genre)}`
    : `${title}, waiting for a line your letters can spell`;
}

/** Managers by monkey index, for the upgrade menu (keys 1-9 in this order). */
export function managerChoices(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (m.manager ? [i] : [])).slice(0, 9);
}

/** The prompt for upgrading a manager, with each one's next bonus and price. */
export function managerUpgradePrompt(state: GameState): string {
  const choices = managerChoices(state).map((i, k) => {
    const m = state.monkeys[i];
    const now = 1 + managers.bonusPerLevel * m.managerLevel;
    return `[${k + 1}] ${monkeyName(state, i)} x${now.toFixed(1)} -> x${(now + managers.bonusPerLevel).toFixed(1)} ` +
      `${price(managerUpgradeCost(state, m), state.lines)} Lines`;
  });
  return `Upgrade which manager? ${choices.join('   ')}   (any other key: done)`;
}

/** How many scenes the player owns, across plays. */
function scenesOwned(state: GameState): number {
  const ids = new Set(state.owned.map((p) => p.split(':')[0]));
  let n = 0;
  for (const id of ids) {
    const play = getPlay(id);
    if (play) n += play.scenes.filter((sc) => ownsScene(state, id, sc)).length;
  }
  return n;
}

/** Permanent bonuses from finished scenes and acts, once there are any. */
function milestoneSummary(state: GameState): string[] {
  const scenesDone = state.scenesDone.filter((k) => getPlay(k.split(':')[0])?.genre !== 'sonnet').length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts = [
    ...(scenesDone > 0 ? [`bananas +${pct(state.pointsBonus)} (${plural(scenesDone, 'scene')} finished)`] : []),
    ...(state.actsDone.length > 0 ? [`typing +${pct(state.speedBonus)} (${plural(state.actsDone.length, 'act')} finished)`] : []),
    ...(state.folios > 0 ? [`Folio bananas +${pct(folioMultiplier(state) - 1)} (${plural(state.folios, 'Folio')} published)`] : []),
  ];
  return parts.length > 0 ? [parts.join('   ')] : [];
}

/** The offer to publish a Folio, once a play is finished. */
export function folioOffer(state: GameState): string[] {
  if (!canPublishFolio(state)) return [];
  const pages = folioPagesNow(state);
  return [`* You can publish a Folio: [f] start over with ${count(pages)} more pages, bananas +${pct(pages * folio.bonusPerPage)} for good.`];
}

/** The question before publishing a Folio. */
export function folioPrompt(state: GameState): string {
  const pages = folioPagesNow(state);
  const after = 1 + (state.folioPages + pages) * folio.bonusPerPage;
  return (
    `Publish a Folio? Everything starts over: monkeys, letters, office, script and currencies. ` +
    `You keep achievements and statistics, and the Folio gains ${count(pages)} pages (one per line written, finished plays twice): ` +
    `bananas x${after.toFixed(2)} for good. Press y to publish, any other key to keep playing.`
  );
}

function lastMilestoneText(state: GameState): string[] {
  const ms = state.lastMilestone;
  const play = ms && getPlay(ms.play);
  if (!ms || !play) return [];
  if (ms.kind === 'scene') {
    return [
      `* ${sceneName(ms.act, ms.scene, play.genre)} of ${play.title} finished! Bananas +${pct(ms.bonus)} for good, ` +
        `+${count(ms.sentences)} Sentences`,
    ];
  }
  if (ms.kind === 'sonnet') return [`* Sonnet ${ms.act} finished! +${count(ms.bonus)} Lines`];
  if (ms.kind === 'act') {
    return [
      `* Act ${ms.act} of ${play.title} finished! Typing +${pct(ms.bonus)} for good, ` +
        (state.unassignedMonkeys > 0
          ? 'and a new monkey is waiting for a department (assign it in the Staff store)'
          : 'and a new monkey joined ([n] to name it)'),
    ];
  }
  return [`* ${play.title} is finished! Every bonus in it is yours.`];
}

function lastLineText(state: GameState): string[] {
  const l = state.lastLine;
  const play = l && getPlay(l.play);
  const line = l && play?.lines[l.index];
  if (!l || !play || !line) return [];
  const lines = play.genre === 'sonnet' ? sonnetRewards.linesPerLine : 1;
  const rewards = [
    ...(l.firstTime ? [`+${formatNumber(l.points)} ${theme.currency}`, `+${lines} Line${lines === 1 ? '' : 's'}`] : ['already written']),
    ...(l.sentence ? ['+1 Sentence'] : []),
  ];
  return [`* A monkey wrote a line! "${line.text}" (${lineLocation(line, play.genre)})  ${rewards.join(', ')}`];
}

/** How many play lines the script browser shows at once. */
export const scriptPageSize = 15;

function lineStatus(state: GameState, play: Play, index: number): string {
  if (state.completed[play.id]?.includes(index)) return 'written';
  if (!ownsLine(state, play, index)) return 'not owned';
  const missing = missingLetters(state, play.lines[index].letters);
  return missing.length > 0 ? `needs ${missing.join(' ')}` : 'within reach';
}

/** What a line still needs, for the NEEDS column: the letters you don't own yet, "in reach", or nothing. */
function lineNeeds(state: GameState, play: Play, index: number): string {
  if (state.completed[play.id]?.includes(index) || !ownsLine(state, play, index)) return '';
  const missing = missingLetters(state, play.lines[index].letters);
  return missing.length > 0 ? missing.join('') : green('in reach');
}

/** Items (which may hold ANSI codes) three spaces apart after `lead`, broken between items to fit a screen `columns` wide. */
function wrapVisible(items: string[], columns: number, lead: string): string[] {
  const rows = [lead];
  for (const item of items) {
    const row = rows[rows.length - 1];
    const fresh = row === lead || plainText(row).trim() === '';
    if (!fresh && columns > 0 && plainText(row).length + 3 + plainText(item).length >= columns) rows.push(' '.repeat(plainText(lead).length) + item);
    else rows[rows.length - 1] += (fresh ? '' : '   ') + item;
  }
  return rows;
}

/** Words of `text` in rows at most `width` long (a word longer than that gets a row of its own). */
function wrapWords(text: string, width: number): string[] {
  const rows: string[] = [];
  for (const word of text.split(' ')) {
    const last = rows.length - 1;
    if (last >= 0 && rows[last].length + 1 + word.length <= width) rows[last] += ` ${word}`;
    else rows.push(word);
  }
  return rows;
}

/**
 * The script browser: a page of one play around the cursor. Each scene has a
 * dim heading with its progress; written lines are green with a +, pinned
 * ones have an @, the cursor's line is inverse, and a NEEDS column lists the
 * letters each line still needs. Lines too long for the screen wrap. Under
 * them, prices to buy the scene, act or play under the cursor.
 */
export function renderScript(state: GameState, playId: string, cursor: number, message = '', columns = 0): string {
  const play = getPlay(playId);
  if (!play) return 'No plays loaded.';
  const done = state.completed[play.id] ?? [];
  const at = Math.max(0, Math.min(cursor, play.lines.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(scriptPageSize / 2), play.lines.length - scriptPageSize));
  const shown = Array.from({ length: Math.min(scriptPageSize, play.lines.length - first) }, (_, k) => first + k);
  const pinned = (i: number) => state.pinned.some((p) => p.play === play.id && p.index === i);
  const speakerWidth = 13;
  const needsWidth = Math.max('NEEDS'.length, ...shown.map((i) => plainText(lineNeeds(state, play, i)).length));
  const longest = Math.max(...shown.map((i) => play.lines[i].text.length));
  // Text gets what the screen leaves after the marks, speaker and NEEDS column.
  const textWidth = columns > 0 ? Math.max(20, Math.min(longest, columns - 1 - 3 - speakerWidth - 1 - 2 - needsWidth)) : longest;
  const rowWidth = 3 + speakerWidth + 1 + textWidth + 2 + needsWidth;

  const rows: string[] = [];
  for (const i of shown) {
    const line = play.lines[i];
    const prev = play.lines[i - 1];
    const sc = sceneOf(play, i)!;
    if (i === first || prev.act !== line.act || prev.scene !== line.scene) {
      const [w, total] = sceneProgress(state, play, sc);
      const status = ownsScene(state, play.id, sc)
        ? `${count(w)} / ${count(total)} written${w === total ? ` ${green('finished')}` : ''}`
        : dim(`${count(total)} line${total === 1 ? '' : 's'}, not owned`);
      const heading = ` ${dim(sceneName(sc.act, sc.scene, play.genre).toUpperCase())}   ${status}`;
      rows.push(...(rows.length > 0 ? [''] : []), padVisible(heading, Math.max(rowWidth - needsWidth, plainText(heading).length + 2)) + dim('NEEDS'));
    }
    const written = done.includes(i);
    const owned = ownsScene(state, play.id, sc);
    const mark = (i === at ? '>' : ' ') + (written ? '+' : pinned(i) ? '@' : ' ');
    const texts = wrapWords(line.text, textWidth);
    const lines = texts.map((t, k) => {
      const text = owned && !written ? slotHighlight(state, t, play.genre) : t;
      const lead = k === 0 ? `${mark} ${(line.speaker || '').padEnd(speakerWidth).slice(0, speakerWidth)}` : ' '.repeat(3 + speakerWidth);
      const needs = k === 0 ? lineNeeds(state, play, i) : '';
      const row = `${lead} ${padVisible(text, textWidth)}  ${needs}`;
      return k === 0 && !written && owned ? row.replace(line.speaker || '\u0000', dim(line.speaker)) : row;
    });
    rows.push(
      ...lines.map((r) => {
        if (i === at) return inverse(padVisible(plainText(r), rowWidth));
        if (written) return green(plainText(r).trimEnd());
        return owned ? r.trimEnd() : dim(plainText(r).trimEnd());
      }),
    );
  }

  const sc = sceneOf(play, at)!;
  const section = (key: string, label: string, n: number) =>
    `${bold(`[${key}]`)} ${label} ${n === 0 ? dim('owned') : state.currency >= n ? green(`* ${bold(formatNumber(n))} ${theme.currency}`) : `${formatNumber(n)} ${theme.currency}`}`;
  const locked = !departmentGenres(state).includes(play.genre);
  return [
    titleBar(state, 'Script', columns),
    '',
    ` ${bold(play.title)}   ${dim(`${genreNames[play.genre]}${locked ? ', locked' : ''}`)}   ${count(done.length)} / ${count(play.lines.length)} lines written`,
    '',
    ...rows,
    '',
    dim(` + written   @ pinned (${state.pinned.length}/${maxPinnedLines})   NEEDS: letters you don't own yet`),
    ...(locked
      ? [` Open a ${genreNames[play.genre]} department to buy these.`]
      : wrapVisible(
          play.genre === 'sonnet'
            ? [section('b', 'this sonnet', sectionPrice(state, play, sc.act, sc.key)), section('w', 'all the sonnets', sectionPrice(state, play))]
            : [
                section('b', 'scene', sectionPrice(state, play, sc.act, sc.key)),
                section('a', `Act ${sc.act}`, sectionPrice(state, play, sc.act)),
                section('w', 'whole play', sectionPrice(state, play)),
              ],
          columns,
          ` ${dim('Buy')}  `,
        )),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow(
      [
        ['up/down', 'line'],
        ['left/right', 'scene'],
        ['pgup/pgdn', 'page'],
        ['enter', 'pin'],
        ['tab', 'contents'],
        ['[/]', 'pinned lines'],
        [',/.', 'scenes you own'],
        ['f', 'shortest line in reach'],
        ['esc', 'back'],
      ],
      columns,
    ),
  ].join('\n');
}

/** Rows of the table of contents shown at once. */
export const contentsPageSize = 20;

/**
 * The script's table of contents: every play (when playId is null), or one
 * play's acts and scenes. `cursor` indexes availablePlays() or play.scenes.
 * The cursor's row is inverse; locked plays and scenes you don't own are dim.
 */
export function renderContents(state: GameState, playId: string | null, cursor: number, message = '', columns = 0): string {
  const play = playId ? getPlay(playId) : undefined;
  const open = departmentGenres(state);
  type Row = { cols: string[]; faded?: boolean; finished?: boolean; header?: string };
  const items: Row[] = play
    ? play.scenes.map((sc, i) => {
        const [w, total] = sceneProgress(state, play, sc);
        const owned = ownsScene(state, play.id, sc);
        const prev = play.scenes[i - 1];
        const header = play.genre !== 'sonnet' && (!prev || prev.act !== sc.act) ? `ACT ${sc.act}` : undefined;
        const name = play.genre === 'sonnet' ? sceneName(sc.act, sc.scene, play.genre) : `Scene ${sc.scene}`;
        return {
          cols: [name, owned ? `${count(w)} / ${count(total)}` : 'not owned', owned ? '' : `${count(total)} line${total === 1 ? '' : 's'}`],
          faded: !owned,
          finished: owned && w === total,
          header,
        };
      })
    : availablePlays().map((p) => {
        const owned = p.scenes.filter((sc) => ownsScene(state, p.id, sc)).length;
        const done = (state.completed[p.id] ?? []).length;
        return open.includes(p.genre)
          ? { cols: [p.title, genreNames[p.genre], `${count(done)} / ${count(p.lines.length)}`, `${count(owned)} / ${count(p.scenes.length)}`] }
          : { cols: [p.title, genreNames[p.genre], 'locked', ''], faded: true };
      });
  const headings = play ? [play.genre === 'sonnet' ? 'SONNET' : 'SCENE', 'WRITTEN', ''] : ['PLAY', 'GENRE', 'WRITTEN', 'SCENES OWNED'];
  const widths = headings.map((h, c) => Math.max(h.length, ...items.map((x) => x.cols[c].length)));
  const right = (c: number) => (play ? c === 1 : c >= 2);
  const line = (mark: string, cols: string[]) => ` ${mark} ` + cols.map((t, c) => (right(c) ? t.padStart(widths[c]) : t.padEnd(widths[c]))).join('   ');
  const at = Math.max(0, Math.min(cursor, items.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(contentsPageSize / 2), items.length - contentsPageSize));
  const rows = items.slice(first, first + contentsPageSize).flatMap((item, k) => {
    const text = line(first + k === at ? '>' : ' ', item.cols) + (item.finished ? '   finished' : '');
    return [
      ...(item.header ? [dim(` ${item.header}`)] : []),
      first + k === at ? inverse(text + ' ') : item.faded ? dim(text.trimEnd()) : item.finished ? text.replace(/finished$/, green('finished')) : text.trimEnd(),
    ];
  });
  return [
    titleBar(state, 'Contents', columns),
    '',
    ...(play ? [` ${bold(play.title)}`, ''] : []),
    dim(line(' ', headings).trimEnd()),
    ...rows,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    play
      ? keyRow([['up/down', 'choose'], ['enter', 'go to this scene'], ['esc', 'all plays'], ['tab', 'close']], columns)
      : keyRow([['up/down', 'choose'], ['enter', "this play's acts and scenes"], ['esc', 'back']], columns),
  ].join('\n');
}

/**
 * Bolds each word of a line that an active word slot will type at that
 * position, e.g. slot "3rd word: NAME" bolds "name" in "Hello my name is Hamlet".
 */
export function slotHighlight(state: GameState, text: string, genre: Genre | undefined): string {
  const slotAt = new Map(
    state.slots.filter((x) => x.on && x.word && slotGenre(state, x) === genre).map((x) => [x.position, x.word]),
  );
  let position = 0;
  return text.replace(/[A-Za-z'\u2019]+/g, (token) => {
    const word = token.replace(/['\u2019]/g, '').toUpperCase();
    if (!word) return token;
    position++;
    return slotAt.get(position) === word ? bold(token) : token;
  });
}

/** Pinned lines for the home screen, with what each still needs. */
function pinnedText(state: GameState): string[] {
  const rows = state.pinned.flatMap((p) => {
    const play = getPlay(p.play);
    const line = play?.lines[p.index];
    if (!play || !line) return [];
    return [`   @ ${play.title} ${lineLocation(line, play.genre)} "${slotHighlight(state, line.text, play.genre)}"   (${lineStatus(state, play, p.index)})`];
  });
  return rows.length === 0 ? [] : ['', dim(' PINNED LINES'), ...rows];
}
