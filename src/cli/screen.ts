import { accessories, monkeyIcon, type Accessory, furnitureKinds, type FurnitureKind, typing, letterValues, managers, maxPinnedLines, sonnetRewards, startingLetters, theme, typewriterKeys, wordSlots } from '../game/config';
import {
  availableKeys,
  furnitureSpot,
  accessoryCost,
  accessoryIn,
  furnitureCost,
  canSeatMonkey,
  roomCost,
  roomlessDepartments,
  squareCost,
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
  breakLeft,
  energyRates,
  nextMonkeyCost,
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
} from '../game/logic';
import { lineLocation, sceneName, type Genre, type Play } from '../game/plays';
import { devTools } from '../game/dev';
import { roomName } from './office';
import type { GameState, MonkeyState } from '../game/state';
import { formatNumber } from '../format';

/**
 * A monkey's current line, all capitals: scored words and skipped letters,
 * then any letters still waiting to become a word and a cursor.
 * Uses ANSI bold, which every common terminal supports.
 */
export function renderLine(m: MonkeyState): string {
  const text = m.line.map((s) => s.text.toUpperCase());
  // The live part is bold: the current run of back-to-back words plus any
  // letters still forming a word. If the newest letter was skipped, just it.
  let lastSkip = m.line.length - 1;
  while (lastSkip >= 0 && m.line[lastSkip].scored) lastSkip--;
  if (lastSkip === m.line.length - 1 && !m.pending) lastSkip--;
  const settled = text.slice(0, lastSkip + 1).join('');
  const live = text.slice(lastSkip + 1).join('') + m.pending;
  return settled + (live ? bold(live) : '') + '_';
}

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;

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
  return `Press the letter to buy, any other key cancels. Values: ${choices.join(' ')}`;
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

function genreMenu(state: GameState): string[] {
  return departmentChoices(state).map(
    (g, i) =>
      `  [${i + 1}] ${genreNames[g]}: ${availablePlays()
        .filter((p) => p.genre === g)
        .map((p) => p.title)
        .join(', ')}`,
  );
}

/** The prompt for unlocking another genre. */
export function departmentPrompt(state: GameState): string {
  return `Open a department: ${departmentChoices(state).map((g, i) => `[${i + 1}] ${genreNames[g]}`).join('   ')}   (any other key cancels)`;
}

/** A bonus as a percentage, e.g. 0.215 -> "21.5%". */
const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;

/** Renders the whole game screen as plain text. */
export function renderScreen(state: GameState, message = '', shop: Store | null = null): string {
  const lines = [`=== ${theme.title} ===`, ''];

  if (state.owned.length === 0 && state.departments.length === 0) {
    lines.push(
      'Somewhere, infinite monkeys are trying to write Shakespeare.',
      'Choose their first department. Each department works on one genre;',
      'the others open as you gather more monkeys.',
      '',
      ...genreMenu(state),
      '',
      '[q] quit',
      '',
      message,
    );
    return lines.join('\n');
  }

  if (state.owned.length === 0) {
    lines.push(
      'Choose a free first scene for your monkeys to work toward:',
      '',
      ...starterScenes(state).map(
        ({ play, scene }, i) =>
          `  [${i + 1}] ${play.title}, ${sceneName(scene.act, scene.scene)} (${count(scene.lines.length)} lines)`,
      ),
      '',
      'Later you can buy more scenes, acts and whole plays in the script.',
      '',
      '[q] quit',
      '',
      message,
    );
    return lines.join('\n');
  }

  if (state.letters.length === 0) {
    lines.push(
      'Your monkey sits at a typewriter with no keys.',
      'Pick its first letter. It has to be a word on its own:',
      '',
      '  ' + startingLetters.map((l) => `[${l.toLowerCase()}] ${l}`).join('    '),
      '',
      '[q] quit',
      '',
      message,
    );
    return lines.join('\n');
  }

  const [written, ownedLines] = ownedProgress(state);
  const ownedScenes = scenesOwned(state);
  const shown = state.monkeys.slice(0, maxMonkeyLines);
  // Pad names and multipliers so every monkey's text starts in the same column.
  // With more than one department, each monkey's line starts with its department's initial.
  const tag = (m: MonkeyState) => (departmentGenres(state).length > 1 ? `${genreNames[monkeyGenre(state, m)!][0]} ` : '');
  // A typist shows its speed now and its energy; on a break, how long is left.
  const status = (m: MonkeyState) =>
    m.manager
      ? `${monkeySpeed(state, m).toFixed(2)}/s`
      : m.resting
        ? `break ${Math.ceil(breakLeft(m, energyRates(state, m)))}s`
        : `${currentSpeed(state, m).toFixed(2)}/s ${Math.round(m.energy * 100)}%`;
  // Each monkey has an icon, its hat if it wears one; other accessories show as letters after its name.
  const worn = (m: MonkeyState) => {
    const glyphs = accessories.filter((a) => !a.icon && m.accessories.includes(a.id)).map((a) => a.glyph).join('');
    return glyphs ? `[${glyphs}]` : '';
  };
  const labels = shown.map((m, i) => [`${iconOf(m)} ${tag(m)}${monkeyName(state, i)}${worn(m)}(${status(m)})`, `x${comboMultiplier(state, m)}`]);
  const nameWidth = Math.max(...labels.map(([n]) => n.length));
  const comboWidth = Math.max(...labels.map(([, c]) => c.length));
  lines.push(
    ...shown.map((m, i) => `${labels[i][0].padEnd(nameWidth)} ${labels[i][1].padEnd(comboWidth)}  ${m.manager ? managerLine(m) : renderLine(m)}`),
    ...(state.monkeys.length > maxMonkeyLines
      ? [`...and ${state.monkeys.length - maxMonkeyLines} more monkeys typing`]
      : []),
    '',
    `${bold(`${formatNumber(state.currency)} ${theme.currency}`)}   ${formatNumber(state.sentences)} Sentences   ` +
      `${formatNumber(state.lines)} Lines   ${formatNumber(state.words)} Words`,
    `Letters: ${state.letters.join(' ')}`,
    `Script: ${count(ownedScenes)} scene${ownedScenes === 1 ? '' : 's'} owned, ` +
      `${count(written)} / ${count(ownedLines)} lines written`,
    ...milestoneSummary(state),
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}` : ''),
    ...lastLineText(state),
    ...lastMilestoneText(state),
    ...(departmentPicks(state) > 0 ? ['* You can open a new department in the Real estate store.'] : []),
    ...pinnedText(state),
    '',
    ...(shop ? shopLines(state, shop) : []),
    `[enter] ${theme.pokeAction}   [space] ${shop ? 'close the shop   [tab] next store   [1-9] buy (* = affordable)' : 'open the shop'}   [p] script, pins & scenes   [o] office   [c] options   [t] stats   [w] dictionary   [n] name / [d] move / [m] promote a monkey   [s] save   [r] reset   [\`] dev tools   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}

/** Monkeys that type (not managers), by index. */
export function typists(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (m.manager ? [] : [i]));
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
              text:
                `Faster typing for ${name} (skill ${m.skill}/${skillCap(m)}): ` +
                `${monkeySpeed(state, m).toFixed(2)} -> ${monkeySpeed(state, m, m.skill + 1).toFixed(2)} letters/sec   cost ${price(cost, state.currency)} ${theme.currency}`,
            }
          : { id: 'train', text: `${name}'s ${typewriterName(m.typewriter)} can't keep up: skill ${m.skill}/${skillCap(m)}. Buy a better typewriter in Typewriters` },
      typewriter: {
        id: 'typewriter',
        star: can(writer),
        text: `${typewriterName(m.typewriter + 1)} for ${name} (skill cap ${skillCap(m)} -> ${skillCap(m) + typing.levelsPerTypewriter})   cost ${price(writer, state.currency)} ${theme.currency}`,
      },
    };
  }
  return {
    skill:
      trainable.length > 0
        ? { id: 'train', star: can(cheapestSkill), text: `Faster typing for a monkey   from ${price(cheapestSkill, state.currency)} ${theme.currency}` }
        : { id: 'train', text: "Faster typing: every monkey's typewriter is maxed out. Buy better ones in Typewriters" },
    typewriter: { id: 'typewriter', star: can(cheapestWriter), text: `Better typewriter for a monkey   from ${price(cheapestWriter, state.currency)} ${theme.currency}` },
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
  return `${what === 'skill' ? 'Faster typing' : 'Better typewriter'} for which monkey? ${rows.join('   ')}`;
}

/** The shop's stores, shown as tabs; tab or left/right switches between them. */
export const stores = ['staff', 'typewriters', 'furniture', 'script', 'accessories', 'estate'] as const;
export type Store = (typeof stores)[number];
export const storeNames: Record<Store, string> = {
  staff: 'Staff',
  typewriters: 'Typewriters',
  furniture: 'Furniture',
  script: 'Script',
  accessories: 'Accessories',
  estate: 'Real estate',
};

/** Something for sale in a store. Items without an id are information only and get no number. */
export interface ShopItem {
  id?: string;
  star?: boolean;
  text: string;
}

/** What a store sells. Numbered items (those with an id) are bought with 1-9 in this order. */
export function storeItems(state: GameState, store: Store): ShopItem[] {
  const typingShop = typingItems(state);
  switch (store) {
    case 'staff': {
      const nextMonkey = nextMonkeyCost(state);
      const nextCap = capRaiseCost(state.comboCapLevel);
      return [
        typingShop.skill,
        canSeatMonkey(state)
          ? { id: 'hire', star: state.lines >= nextMonkey, text: `Hire a monkey (you have ${state.monkeys.length})   cost ${price(nextMonkey, state.lines)} Lines` }
          : { text: "Hire a monkey: no free square for its desk. Grow its department's room in Real estate." },
        ...(state.unassignedMonkeys > 0
          ? [
              canSeatMonkey(state)
                ? { id: 'assign', text: `Assign ${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? '' : 's'} to a department` }
                : { text: `${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? ' is' : 's are'} waiting for a free square for a desk.` },
            ]
          : []),
        { id: 'combo', star: state.sentences >= nextCap, text: `Raise combo cap (x${comboCap(state)} -> x${comboCap(state) + 1})   cost ${price(nextCap, state.sentences)} Sentences` },
        ...(managerChoices(state).length > 0
          ? [{ id: 'manager', text: `Upgrade a manager: +${managers.bonusPerLevel}x points for its whole department (costs Lines)` }]
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
                text:
                  `Buy a letter key   cost ${price(nextLetter, state.currency)} ${theme.currency}` +
                  (nextLetterWords > 0 ? ` + ${price(nextLetterWords, state.words)} Words` : ''),
              },
            ]
          : []),
        typingShop.typewriter,
        keysUnlocked(state)
          ? { id: 'keys', text: 'Typewriter keys...' }
          : { text: `Typewriter keys: unlock when you own ${typewriterKeys.unlockLetters} letters` },
        slotsUnlocked(state)
          ? { id: 'slots', text: `Word slots... (${state.slots.filter((x) => x.on && x.word).length} active)` }
          : { text: `Word slots: unlock when you own ${wordSlots.unlockLetters} letters` },
      ];
    }
    case 'furniture': {
      const spot = !!furnitureSpot(state);
      return [
        ...furnitureKinds.map((k) => {
          const cost = furnitureCost(state, k.id);
          return { id: `furniture:${k.id}`, star: spot && state.currency >= cost, text: `${k.name} [${k.glyph}]: ${furnitureEffect(k)}   cost ${price(cost, state.currency)} ${theme.currency}` };
        }),
        {
          text: !spot
            ? 'No free floor left: buy a break room or grow a room in the Real estate store.'
            : [
                state.settings.autoPlaceFurniture ? 'New furniture places itself, in a break room first ([c] options).' : 'New furniture opens the office map so you can place it.',
                ...(state.office.some((r) => r.kind === 'break') ? [] : ['With no break room, it takes a square a desk could use.']),
              ].join(' '),
        },
      ];
    }
    case 'script':
      return [{ id: 'script', text: `Browse and buy scenes, acts and plays (${departmentGenres(state).map((g) => genreNames[g]).join(', ')})` }];
    case 'accessories': {
      const team = typists(state);
      return [
        ...accessories.map((a) => {
          const cost = accessoryCost(state, a.id);
          const someone = team.some((i) => !state.monkeys[i].accessories.includes(a.id));
          return { id: `accessory:${a.id}`, star: someone && state.currency >= cost, text: `${a.name} [${a.icon ?? a.glyph}], ${a.slot}: ${accessoryEffect(a)}   cost ${price(cost, state.currency)} ${theme.currency}` };
        }),
        { text: "Each is for one monkey, one per slot (head, eyes, ears, hands, feet). A hat changes the monkey's icon; the rest show as letters after its name." },
      ];
    }
    case 'estate': {
      const roomPrice = roomCost(state);
      const squarePrice = squareCost(state);
      return [
        ...(departmentPicks(state) > 0
          ? [{ id: 'department', text: 'Open a new department!' }]
          : nextDepartmentAt(state) > 0
            ? [{ text: `Next department opens at ${nextDepartmentAt(state)} monkeys` }]
            : []),
        { id: 'map', text: 'View and design the office map' },
        ...roomlessDepartments(state).map((g) => ({
          id: `room:${g}`,
          star: state.currency >= roomPrice,
          text: `Buy a room for the ${genreNames[g]} department   cost ${price(roomPrice, state.currency)} ${theme.currency}`,
        })),
        { id: 'room:break', star: state.currency >= roomPrice, text: `Buy a break room for furniture   cost ${price(roomPrice, state.currency)} ${theme.currency}` },
        ...state.office.map((r) => ({
          id: `grow:${r.id}`,
          star: state.currency >= squarePrice,
          text: `Grow the ${roomName(state, r)} by a square (${r.cells.length} now)   cost ${price(squarePrice, state.currency)} ${theme.currency}`,
        })),
      ];
    }
  }
}

/** How monkeys show on the office map: at a desk [@], a hat in place of the [, & marking a manager. */
export const monkeyIconLegend = [`[${monkeyIcon}] monkey`, `[${monkeyIcon}& manager`, `#${monkeyIcon}] in a hat`];

/** A monkey's hat character, if it wears one. */
export function hatOf(m: MonkeyState): string | undefined {
  return accessoryIn(m, 'head')?.icon;
}

/** A monkey's icon, two ASCII characters: its hat (or a space) and its face, e.g. #@. */
export function iconOf(m: MonkeyState): string {
  return `${hatOf(m) ?? ' '}${monkeyIcon}`;
}

/** What an accessory does for the monkey wearing it, in a few words. */
export function accessoryEffect(a: Accessory): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    ...(a.points ? [`its words pay ${pct(a.points)} more`] : []),
    ...(a.speed ? [`it types ${pct(a.speed)} faster`] : []),
    ...(a.drain ? [`it tires ${pct(a.drain)} slower`] : []),
    ...(a.rest ? [`its breaks go ${pct(a.rest)} faster`] : []),
    ...(a.combo ? [`its combo cap +${a.combo}`] : []),
  ].join(', ');
}

/** The prompt for choosing which monkey gets an accessory. */
export function accessoryPickPrompt(state: GameState, id: string): string {
  const a = accessories.find((x) => x.id === id)!;
  const rows = typists(state)
    .filter((i) => i < 9)
    .map((i) => {
      const m = state.monkeys[i];
      const worn = accessoryIn(m, a.slot);
      const note = m.accessories.includes(id) ? ' (has one)' : worn ? ` (swaps its ${worn.name.toLowerCase()})` : '';
      return `[${i + 1}] ${monkeyName(state, i)}${note}`;
    });
  return `${a.name} for which monkey? ${rows.join('   ')}`;
}

/** What a kind of furniture does, in a few words. */
export function furnitureEffect(k: FurnitureKind): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    ...(k.drain ? [`a department's monkeys tire ${pct(k.drain)} slower`] : []),
    ...(k.rest ? [`in a break room, breaks go ${pct(k.rest)} faster`] : []),
    ...(k.happiness ? [`+${pct(k.happiness)} points`] : []),
  ].join(', ');
}

/** The numbered (buyable) items of a store, in key order 1-9. */
export function storeChoices(state: GameState, store: Store): ShopItem[] {
  return storeItems(state, store).filter((x) => x.id);
}

/** The open store: a tab row, then its items. */
function shopLines(state: GameState, store: Store): string[] {
  let n = 0;
  return [
    // A * on a tab means that store has something you can afford.
    'Shop   ' +
      stores
        .map((x) => {
          const name = `${storeNames[x]}${storeItems(state, x).some((i) => i.star) ? '*' : ''}`;
          return x === store ? bold(`[${name}]`) : ` ${name} `;
        })
        .join(' ')
        .trimEnd(),
    ...storeItems(state, store).map((x) => (x.id ? `  [${++n}] ${x.star ? '*' : ' '}${x.text}` : `       ${x.text}`)),
    '',
  ];
}

/** The options menu. */
export function renderOptions(state: GameState): string {
  const onOff = (on: boolean) => (on ? bold('ON') : 'off');
  return [
    '=== Options ===',
    '',
    `  [1] Furniture places itself: ${onOff(state.settings.autoPlaceFurniture)}`,
    '      On: new furniture goes in the first free square (a break room first).',
    '      Off: buying furniture opens the office map so you can place it.',
    '',
    '[1] switch   [esc] back',
  ].join('\n');
}

/** The development tools menu, for testing features. */
export function renderDevMenu(message = ''): string {
  return [
    '=== Development tools ===   (for testing; these change your save)',
    '',
    ...devTools.map((t, i) => `  [${i + 1}] ${t.label}`),
    '',
    `[1-${devTools.length}] use a tool   [esc] back`,
    '',
    message,
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
): string {
  const mine = departmentSlots(state, genre);
  const next = slotCost(mine.length);
  const canBuy = mine.length < wordSlots.maxSlots;
  const rows = mine.map((i, k) => {
    const x = state.slots[i];
    const word = i === selected && typing !== null ? `${typing}_` : x.word || '(no word)';
    return `${i === selected ? '>' : ' '} [${k + 1}] ${ordinal(x.position).padEnd(4)} word: ${word.padEnd(16)} ${x.on ? 'ON' : 'off'}`;
  });
  const managed = !!managerOf(state, genre);
  const many = departmentGenres(state).length > 1;
  return [
    `=== Word slots${genre ? `: ${genreNames[genre]} department` : ''} ===`,
    '',
    `${formatNumber(state.lines)} Lines`,
    'Each slot makes the word at its position in a chain always the word you choose,',
    'e.g. 3rd word: FRIEND. Switch slots off for fully random typing.',
    '',
    ...(managed ? ["This department's manager sets these slots for you."] : []),
    ...(rows.length > 0 ? rows : ['  No slots yet.']),
    '',
    ...(canBuy ? [`[b] ${state.lines >= next ? '*' : ' '}buy a slot   cost ${price(next, state.lines)} Lines`] : []),
    typing !== null
      ? 'Type the word, [enter] to set it, [esc] to cancel'
      : `[1-9] select   [w] set word   [o] on/off   [left/right] move position${many ? '   [tab] next department' : ''}   [esc] back`,
    '',
    message,
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
export function renderKeysMenu(state: GameState, message = ''): string {
  const mark = (price: number) => (state.currency >= price ? '*' : ' ');
  const owned = state.keys.length > 0 ? state.keys.join(' ') : 'none yet';
  return [
    '=== Typewriter keys ===',
    '',
    bold(`${formatNumber(state.currency)} ${theme.currency}`),
    '',
    'Each key types its whole text in one keystroke.',
    `A word of ${typewriterKeys.wordMinLength}+ letters becomes a key once your monkeys have spelled it ${wordKeySpellsNeeded(state)} times` +
      ` (+${Math.round((typewriterKeys.wordSpellsGrowth - 1) * 100)}% for each word key you own).`,
    ...nextWordKeys(state),
    '',
    ...keyChoices(state).map((k, i) => {
      const kind = typewriterKeys.combinations.includes(k) ? 'combination' : 'word';
      return `  [${i + 1}] ${mark(keyCost(state, k))}${k} (${kind})   cost ${price(keyCost(state, k), state.currency)} ${theme.currency}`;
    }),
    ...(keyChoices(state).length === 0 ? ['  None available yet.'] : []),
    `  Owned: ${owned}`,
    '',
    '[esc] back   (* = affordable)',
    '',
    message,
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
  return `Upgrade which manager? ${choices.join('   ')}   (any other key cancels)`;
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
  if (scenesDone === 0) return [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const scenes = `Bonuses: points +${pct(state.pointsBonus)} (${plural(scenesDone, 'scene')} finished)`;
  const acts =
    state.actsDone.length === 0
      ? ''
      : `   typing +${pct(state.speedBonus)} (${plural(state.actsDone.length, 'act')} finished)`;
  return [scenes + acts];
}

function lastMilestoneText(state: GameState): string[] {
  const ms = state.lastMilestone;
  const play = ms && getPlay(ms.play);
  if (!ms || !play) return [];
  if (ms.kind === 'scene') {
    return [
      `* ${sceneName(ms.act, ms.scene, play.genre)} of ${play.title} finished! Points +${pct(ms.bonus)} for good, ` +
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

/**
 * The script browser: a page of one play around the cursor, with scene
 * headings (progress, or price if not owned), marks for written (+) and
 * pinned (@) lines, what each needs, and prices to buy the scene, act or
 * play under the cursor.
 */
export function renderScript(state: GameState, playId: string, cursor: number, message = ''): string {
  const play = getPlay(playId);
  if (!play) return 'No plays loaded.';
  const done = state.completed[play.id] ?? [];
  const at = Math.max(0, Math.min(cursor, play.lines.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(scriptPageSize / 2), play.lines.length - scriptPageSize));
  const pinned = (i: number) => state.pinned.some((p) => p.play === play.id && p.index === i);
  const rows: string[] = [];
  for (let i = first; i < Math.min(first + scriptPageSize, play.lines.length); i++) {
    const line = play.lines[i];
    const prev = play.lines[i - 1];
    if (i === first || prev.act !== line.act || prev.scene !== line.scene) {
      const sc = sceneOf(play, i)!;
      const [w, total] = sceneProgress(state, play, sc);
      const status = ownsScene(state, play.id, sc)
        ? `${count(w)}/${count(total)} written${w === total ? ', finished' : ''}`
        : `${count(total)} lines, not owned`;
      rows.push(`  -- ${sceneName(sc.act, sc.scene, play.genre)} (${status}) --`);
    }
    const marks = (i === at ? '>' : ' ') + (done.includes(i) ? '+' : ' ') + (pinned(i) ? '@' : ' ');
    const status = done.includes(i) ? '' : `   (${lineStatus(state, play, i)})`;
    rows.push(`${marks} ${(line.speaker || '').padEnd(14).slice(0, 14)} ${slotHighlight(state, line.text, play.genre)}${status}`);
  }
  const sc = sceneOf(play, at)!;
  const section = (label: string, n: number) =>
    n === 0 ? `${label}: owned` : `${label} ${state.currency >= n ? '*' : ''}${price(n, state.currency)} ${theme.currency}`;
  const locked = !departmentGenres(state).includes(play.genre);
  return [
    `=== ${play.title} (${genreNames[play.genre]}${locked ? ', locked' : ''}) ===   ` +
      `${count(done.length)} of ${count(play.lines.length)} lines written   ` +
      `line ${count(at + 1)}`,
    '',
    ...rows,
    '',
    `+ written   @ pinned (${state.pinned.length}/${maxPinnedLines})`,
    locked
      ? `Open a ${genreNames[play.genre]} department to buy these.`
      : play.genre === 'sonnet'
        ? `Buy  [b] ${section('this sonnet', sectionPrice(state, play, sc.act, sc.key))}   ` +
          `[w] ${section('all the sonnets', sectionPrice(state, play))}   (* = affordable)`
        : `Buy  [b] ${section('this scene', sectionPrice(state, play, sc.act, sc.key))}   ` +
          `[a] ${section(`Act ${sc.act}`, sectionPrice(state, play, sc.act))}   ` +
          `[w] ${section('whole play', sectionPrice(state, play))}   (* = affordable)`,
    '[up/down] line   [left/right] scene   [pgup/pgdn] page   [tab] contents   [enter] pin/unpin',
    '[,/.] previous/next scene you own   [f] next shortest line within reach   [esc] back to the typewriters',
    '',
    message,
  ].join('\n');
}

/** Rows of the table of contents shown at once. */
export const contentsPageSize = 20;

/**
 * The script's table of contents: every play (when playId is null), or one
 * play's acts and scenes. `cursor` indexes availablePlays() or play.scenes.
 */
export function renderContents(state: GameState, playId: string | null, cursor: number, message = ''): string {
  const play = playId ? getPlay(playId) : undefined;
  const open = departmentGenres(state);
  const items: { text: string; header?: string }[] = play
    ? play.scenes.map((sc, i) => {
        const [w, total] = sceneProgress(state, play, sc);
        const status = ownsScene(state, play.id, sc)
          ? `${count(w)}/${count(total)} written${w === total ? ', finished' : ''}`
          : `${count(total)} lines, not owned`;
        const prev = play.scenes[i - 1];
        const header = play.genre !== 'sonnet' && (!prev || prev.act !== sc.act) ? `Act ${sc.act}` : undefined;
        const name = play.genre === 'sonnet' ? sceneName(sc.act, sc.scene, play.genre) : `  Scene ${sc.scene}`;
        return { text: `${name.padEnd(12)} ${status}`, header };
      })
    : availablePlays().map((p) => {
        const owned = p.scenes.filter((sc) => ownsScene(state, p.id, sc)).length;
        const done = (state.completed[p.id] ?? []).length;
        const status = !open.includes(p.genre)
          ? 'locked'
          : `${count(done)}/${count(p.lines.length)} lines written, ${count(owned)} of ${count(p.scenes.length)} ${p.genre === 'sonnet' ? 'sonnets' : 'scenes'} owned`;
        return { text: `${p.title.padEnd(28)} ${genreNames[p.genre].padEnd(10)} ${status}` };
      });
  const at = Math.max(0, Math.min(cursor, items.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(contentsPageSize / 2), items.length - contentsPageSize));
  const rows = items.slice(first, first + contentsPageSize).flatMap((item, k) => [
    ...(item.header ? [`  ${item.header}`] : []),
    `${first + k === at ? '>' : ' '}   ${item.text}`,
  ]);
  return [
    play ? `=== Contents: ${play.title} ===` : '=== Contents: all plays ===',
    '',
    ...rows,
    '',
    play
      ? '[up/down] choose   [enter] go to this scene   [esc] back to all plays   [tab] close'
      : '[up/down] choose   [enter] open this play\'s contents   [esc/tab] close',
    '',
    message,
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
    return [`  @ ${play.title} ${lineLocation(line, play.genre)} "${slotHighlight(state, line.text, play.genre)}"   (${lineStatus(state, play, p.index)})`];
  });
  return rows.length === 0 ? [] : ['', 'Pinned lines', ...rows];
}
