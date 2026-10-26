import { GAME_VERSION } from '../version';
import { records, lately as latelyRules, achievements, energyColors, maxMonkeyNameLength, fengShui, hatColors, hats, monkeyIcon, type Hat, type Unlock, furnitureKinds, type FurnitureKind, typing, letterValues, managers, maxPinnedLines, sonnetRewards, startingLetters, theme, traits, typewriterKeys, wordSlots, managerOffice, codebreaking, safe, research, hr, marketing, combo } from '../game/config';
import {
  availableKeys,
  flipChance,
  canPublishFolio,
  folioMultiplier,
  folioMultiplierAfter,
  folioPagesNow,
  furnitureSpot,
  hatCost,
  hatsOwned,
  furnitureOwned,
  furnitureCost,
  dyeCost,
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
  sentenceMultiplier,
  nextDepartmentAt,
  getPlay,
  comboCap,
  comboStart,
  comboStartCost,
  comboMultiplier,
  keyCost,
  wordKeySpellsNeeded,
  keysUnlocked,
  letterCost,
  letterWordsCost,
  canAffordLetter,
  monkeySpeed,
  currentSpeed,
  ownedProgress,
  ownsLine,
  ownsScene,
  sceneOf,
  sceneProgress,
  sectionPrice,
  starterPlays,
  starterGenre,
  missingLetters,
  slotCost,
  slotsUnlocked,
  slotsWanted,
  monkeyName,
  typingUpgradeCost,
  skillCap,
  typewriterCost,
  typewriterName,
  traitOf,
  roomMates,
  traitBonus,
  isResearcher,
  isTemp,
  isTypist,
  canBuildLab,
  canBuildHR,
  canBuildMarketing,
  royalties,
  hrRoom,
  labRoom,
  projectOf,
  projectsLeft,
  researchRate,
  researchSecondsLeft,
  researchShare,
  managerSpeed,
  slotDelay,
  isCodebreaker,
  canBuildCodebreaking,
  codebreakers,
  codebreakingRoom,
  codebreakTargets,
  lockOf,
  lockCombinations,
  officesWithoutSafe,
  bombeBuilt,
  latinUnlocked,
  unreadTelegram,
  telegramCipher,
  telegramSettings,
  telegramText,
  isRecorder,
  recorders,
  recordCount,
  canBuildRecords,
  posts,
  postCost,
  isStaff,
  unlocked,
  unlockNeeds,
  hatsForSale,
  inRevealOrder,
  researchList,
} from '../game/logic';
import { departmentOf, isForeign, lineLocation, sceneName, textToWords, type Genre, type Play } from '../game/plays';
import { devTools } from '../game/dev';

import type { GameState, MonkeyState, Pin } from '../game/state';
import { formatAmount, formatDuration, formatMultiplier, formatNumber, formatPrice } from '../format';
import { inGroups, rotorNames } from '../game/enigma';
import { shortKeyRow, affordable, coverBottom, fillHeight, blue, bold, currencyColors, dim, furnitureColor, green, inverse, cursorsOn, isCursor, keyRow, padVisible, plainText, red, rule, scrollMarks, titleBar, yellow, highlight } from './style';

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


/** A price in bold: in its currency's colour when you can afford it, the terminal's normal text color when you can't. */
export function price(cost: number, have: number, currency: Currency = 'currency'): string {
  const text = bold(formatPrice(cost));
  return have >= cost ? currencyColors[currency](text) : text;
}

/** A price with its currency's name, e.g. "500 Bananas": all in the currency's colour when you can afford it. */
export function priceNamed(cost: number, have: number, currency: Currency = 'currency'): string {
  const text = `${bold(formatPrice(cost))} ${currencyNames[currency]}`;
  return have >= cost ? currencyColors[currency](text) : text;
}

/** Monkey lines shown on screen; the rest are summarized in one line. */
export const maxMonkeyLines = 10;

export function unownedLetters(state: GameState): string[] {
  return Object.keys(letterValues)
    .sort()
    .filter((l) => !state.letters.includes(l));
}

/**
 * The choices in a picker prompt on the message line: each [k] (or, for
 * letters, each A(1)) with where its text starts and ends in the prompt.
 */
export function promptChoices(prompt: string): { key: string; start: number; end: number }[] {
  const found: { key: string; start: number; end: number }[] = [];
  for (const m of prompt.matchAll(/\[([0-9a-z])\] |(?<=[ :])([A-Z])\(\d+\)/g)) {
    const start = m.index!;
    const letter = !!m[2];
    const after = prompt.indexOf(letter ? ' ' : '   ', start + m[0].length);
    found.push({ key: m[1] ?? m[2], start, end: after < 0 ? prompt.length : after });
  }
  return found;
}

/** A picker prompt with its `k`th choice inverse: the picker's cursor. */
export function highlightChoice(prompt: string, k: number): string {
  const c = promptChoices(prompt)[k];
  return c && cursorsOn() ? prompt.slice(0, c.start) + highlight(prompt.slice(c.start, c.end)) + prompt.slice(c.end) : prompt;
}

/**
 * The letter picker, for bought and free letters alike: A to Z with the
 * letters already owned dimmed, and the cursor on one of the letters still
 * to get (`cursor` counts those).
 */
export function renderLetterPicker(state: GameState, free: boolean, cursor: number, message = '', columns = 0): string {
  const open = unownedLetters(state);
  const chosen = open[Math.min(cursor, open.length - 1)];
  const letters = Object.keys(letterValues)
    .sort()
    .map((l) => (state.letters.includes(l) ? dim(l) : isCursor(l, chosen) ? highlight(l) : bold(l)))
    .join(' ');
  const gift = achievements.find((a) => a.id === state.letterGifts[state.letterGifts.length - 1])?.name ?? '';
  const title = free
    ? `A free letter${gift ? ` for "${gift}"` : ''}! Choose one.${state.freeLetters > 1 ? `  (${state.freeLetters} free letters)` : ''}`
    : `Buy a letter for ${priceNamed(letterCost(state.letters.length), state.currency)}${letterWordsCost(state.letters.length) > 0 ? ` and ${priceNamed(letterWordsCost(state.letters.length), state.words, 'words')}` : ''}.`;
  return [
    titleBar(state, 'Letters', columns),
    '',
    ` ${title}`,
    '',
    `   ${letters}`,
    '',
    ` ${dim('Dimmed letters are yours already.')}`,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([['left/right', 'choose'], ['enter', free ? 'take' : 'buy'], ['A-Z', free ? 'take' : 'buy'], ...(free ? [] : [['esc', 'done'] as [string, string]])], columns),
  ].join('\n');
}

/** Exact counts with thousands separators, e.g. 4,011. */
const count = (n: number) => n.toLocaleString('en-US');

/** Genre names for display. */
export const genreNames: Record<Genre, string> = {
  comedy: 'Comedies',
  history: 'Histories',
  tragedy: 'Tragedies',
  sonnet: 'Sonnets',
  greek: 'Greek',
  latin: 'Latin',
};

/** A department's name: its genre's, except that the Greek department is the Classical department once it has Latin too (Justin, 2026-10-17). */
export function departmentName(state: GameState, genre: Genre | string | undefined): string {
  return genre === 'greek' && latinUnlocked(state) ? 'Classical' : genreNames[genre as Genre];
}

/**
 * One of the opening screens (genre, free scene, first letter): the title,
 * a line of story, a dim explanation, the choices with dim details lined up
 * after them, and the keys.
 */
function openingScreen(intro: string, explain: string[], choices: [string, string, string][], keys: [string, string][], message: string, columns: number, cursor = -1): string {
  const width = Math.max(...choices.map(([, name]) => name.length));
  const row = ([key, name, details]: [string, string, string]) => `   ${bold(`[${key}]`)} ${details ? `${name.padEnd(width)}   ${dim(details)}` : name}`;
  return [
    bold(inverse(` ${theme.title.toUpperCase()} `)),
    '',
    ...(intro ? [` ${intro}`] : []),
    ...explain.map((r) => dim(` ${r}`)),
    '',
    ...choices.map((c, k) => (isCursor(k, cursor) ? highlight(row(c)) : row(c))),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow(keys, columns),
  ].join('\n');
}

/** The prompt for unlocking another genre. */
export function departmentPrompt(state: GameState): string {
  return `Open a department: ${departmentChoices(state).map((g, i) => `[${i + 1}] ${departmentName(state, g)}`).join('   ')}   (any other key cancels)`;
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
    return b === 0 ? [] : [`${b > 0 ? '+' : ''}${Math.round(b * 100)}% ${e === 'rest' ? 'faster recovery' : e}`];
  });
  const room = traitOf(m)?.room;
  const mates = room ? roomMates(state, m).length : 0;
  if (room && mates > 0) parts.push(`${roomSign(room) >= 0 ? 'helps' : 'drags down'} ${mates} room-mate${mates === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'no effect right now';
}

/** Whether a trait's effect on its room-mates helps (+) or hurts (-) them. */
const roomSign = (room: { happiness?: number; speed?: number }) => (room.happiness ?? 0) + (room.speed ?? 0);

/** A monkey's trait for the TRAIT column: green while it helps, red while it hurts, dim when it does nothing. */
function traitText(state: GameState, m: MonkeyState): string {
  const text = (traitOf(m)?.name ?? '?').padEnd(col.trait);
  const room = traitOf(m)?.room;
  const net =
    traitBonus(state, m, 'speed') + traitBonus(state, m, 'pay') + traitBonus(state, m, 'rest') + (room && roomMates(state, m).length > 0 ? roomSign(room) : 0);
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
  let text = n >= 1000 ? formatNumber(n) : n.toFixed(n < 10 ? 2 : 1);
  // Never wider than the SPEED column, so the columns after it stay put: drop decimals until it fits.
  while (`${text}/s`.length > col.speed && /\.\d/.test(text)) text = text.replace(/\.(\d*)\d/, (_, d: string) => (d ? `.${d}` : ''));
  return `${text}/s`;
}

/** A typist's energy as a percent, green when fresh, yellow when tiring, red when nearly spent; Resting in blue on a break. */
function energyText(m: MonkeyState): string {
  if (!isTypist(m)) return dim('-'.padStart(col.energy));
  if (m.resting) return blue('Resting'.padStart(col.energy));
  const p = Math.round(m.energy * 100);
  const text = `${p}%`.padStart(col.energy);
  return p > energyColors.green ? green(text) : p > energyColors.yellow ? yellow(text) : red(text);
}

/** The departments < and > go through on the home screen: only the typing departments. */
export function homeViews(state: GameState): string[] {
  return departmentGenres(state); // only typing departments (Justin, 2026-10-18)
}

/** Every department in the roster's order: the typing departments, then R&D and the staff departments that have monkeys. */
export function staffViews(state: GameState): string[] {
  return [
    ...departmentGenres(state),
    ...(state.researchOpen ? [research.id] : []),
    ...[hr.id, marketing.id, codebreaking.id, records.id].filter((id) => state.monkeys.some((m) => m.department === id)),
  ];
}

/** The department whose monkeys the home screen shows: the one chosen with < > or its number, else the first. */
export function homeView(state: GameState): string | undefined {
  const views = homeViews(state);
  return views.find((g) => g === state.settings.homeDepartment) ?? views[0];
}

/** The play department the home screen shows, if it shows one (not R&D, HR, Marketing or Codebreaking). */
export function homeGenre(state: GameState): Genre | undefined {
  const view = homeView(state);
  return departmentGenres(state).find((g) => g === view);
}

/** A department's name by its view id (a genre, or R&D, HR, Marketing, Codebreaking). */
export function viewName(state: GameState, view: string): string {
  const staff: Record<string, string> = { [research.id]: research.name, [hr.id]: hr.name, [marketing.id]: marketing.name, [codebreaking.id]: codebreaking.name, [records.id]: records.name };
  return staff[view] ?? departmentName(state, view as Genre);
}

/** Monkeys by index, managers first, then by seniority: the first hired first (Justin, 2026-10-18). */
export function bySeniority(state: GameState, list: number[]): number[] {
  const m = (i: number) => state.monkeys[i];
  return [...list].sort((a, b) => Number(m(b).manager) - Number(m(a).manager) || (m(a).number || a + 1) - (m(b).number || b + 1));
}

/** The monkeys on the home screen, by index: only the chosen department's, managers first, then by seniority. */
export function homeMonkeys(state: GameState): number[] {
  const view = homeView(state);
  const genre = homeGenre(state);
  const shown = state.monkeys.flatMap((m, i) => (isStaff(m) ? m.department === view : !view || monkeyGenre(state, m) === genre) ? [i] : []);
  return bySeniority(state, shown);
}

/** The monkey at place `cursor` in the home screen's table (kept to the rows shown), or -1 with none. */
export function homeChosen(state: GameState, cursor: number): number {
  const shown = homeMonkeys(state).slice(0, maxMonkeyLines);
  return shown.length === 0 ? -1 : shown[Math.max(0, Math.min(cursor, shown.length - 1))];
}

/** What R&D is up to, in a line: the project under way with how far along and how long it has left. */
export function researchStatus(state: GameState): string {
  const p = projectOf(state.researching);
  if (!p) return projectsLeft(state).length > 0 ? 'No project under way: start one on the Research page ([tab] menu).' : 'Every project is done.';
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
function monkeyRow(state: GameState, i: number, room: number, chosen = false): string {
  const m = state.monkeys[i];
  const dept = hasDeptColumn(state) ? `${isResearcher(m) ? 'R' : departmentName(state, monkeyGenre(state, m)!)[0]} ` : '';
  // The home cursor: the chosen monkey's name inverse.
  const name = `${chosen && cursorsOn() ? highlight(monkeyName(state, i).padEnd(col.name)) : monkeyName(state, i).padEnd(col.name)}${m.petHappiness > 0 ? '<3' : '  '}`;
  const speed = !isTypist(m) ? dim('-'.padStart(col.speed)) : speedText(currentSpeed(state, m)).padStart(col.speed);
  const combo = !isTypist(m) ? dim('-'.padStart(col.combo)) : `x${comboMultiplier(state, m).toFixed(1)}`.padStart(col.combo);
  const trait = hasTraitColumn(state) ? `${traitText(state, m)}  ` : '';
  return ` ${dyed(m, iconOf(m))} ${dept}${name}  ${trait}${speed}  ${energyText(m)}  ${combo}  ${m.manager ? managerLine(m) : isResearcher(m) ? researcherLine(state) : isCodebreaker(m) ? codebreakingStatus(state).toUpperCase() : isRecorder(m) ? recordsStatus(state).toUpperCase() : renderLine(m, room)}`;
}

/** What Records has written down: sentences, and how full the book under way is. */
export function recordsStatus(state: GameState): string {
  const books = state.recordBooks.length;
  return `${count(recordCount(state))} sentences recorded${books > 0 ? ` in ${count(books)} full book${books === 1 ? '' : 's'}` : ''}, this book ${state.recordDraft.length}/${records.bookSize}`;
}

/** The last sentence Records wrote down, as words, or none. */
function lastRecorded(state: GameState): string[] {
  const last = state.recordDraft[state.recordDraft.length - 1] ?? state.recordBooks[state.recordBooks.length - 1]?.slice(-1)[0];
  return last ? last.split(' ') : [];
}

/** A researcher's line on the home screen: what R&D is working on. */
/** What Codebreaking is doing: which safe, and how many combinations it has tried. */
export function codebreakingStatus(state: GameState): string {
  if (state.codebreakFocus === 'telegram') {
    const t = unreadTelegram(state);
    if (t) return `running the Bombe on the telegram: ${formatNumber(Math.floor(t.tested))} of ${formatNumber(telegramSettings(state.telegrams.indexOf(t)))} settings tested`;
  }
  const s = state.safes[state.codebreakFocus];
  if (!s || s.open) return 'no locked safe to crack';
  return `cracking the ${departmentName(state, state.codebreakFocus as Genre) ?? ''} safe: ${formatNumber(Math.floor(s.tries))} combinations tried`;
}

function researcherLine(state: GameState): string {
  const p = projectOf(state.researching);
  return p ? `RESEARCHING ${p.name.toUpperCase()} ${Math.floor(researchShare(state) * 100)}%` : dim('RESEARCHING nothing yet');
}

/** What Codebreaking can turn to, by name: a department's safe, or the scroll. */
export function focusName(focus: string): string {
  return focus === 'telegram' ? 'the telegram' : `the ${genreNames[focus as Genre] ?? ''} safe`;
}

/**
 * The telegrams that came: each in five-letter groups as it came, and once
 * the Bombe finds its key, the key and the plain text.
 */
export function renderTelegrams(state: GameState, columns = 0): string {
  return [titleBar(state, 'Telegrams', columns), '', ...telegramRows(state, columns), rule(columns), keyRow([['esc', 'back']], columns)].join('\n');
}

/** Each telegram, as renderTelegrams shows them (also the Texts page's Codes tab). */
function telegramRows(state: GameState, columns = 0): string[] {
  const width = Math.max(30, (columns > 0 ? Math.min(columns, 100) : 80) - 4);
  const rows = state.telegrams.flatMap((t, n) => {
    const head = ` ${bold(`Telegram ${n + 1}`)}${t.read ? dim(`  key: rotors ${t.key.rotors.map((r) => rotorNames[r]).join(' ')}, start ${t.key.start}, plugs ${t.key.plugs.match(/../g)?.join(' ') ?? 'none'}`) : ''}`;
    const cipher = wrapWords(inGroups(telegramCipher(state, n)), width).map((r) => `  ${t.read ? dim(r) : r}`);
    const plain = t.read
      ? wrapWords(telegramText(n), width).map((r) => `  ${bold(r)}`)
      : [dim(`  ${bombeBuilt(state) ? `${formatNumber(Math.floor(t.tested))} of ${formatNumber(telegramSettings(n))} settings tested${state.codebreakFocus === 'telegram' ? '' : ` (${codebreaking.name} is working on ${focusName(state.codebreakFocus)})`}` : `Enciphered on an Enigma machine. ${research.name} might find a way in.`}`)];
    return [head, ...cipher, ...plain, ''];
  });
  return [dim(' A knock at the door, and a telegram with no explanation.'), '', ...rows];
}

/** The Texts page's Codes tab: every safe found, hardest last, with its combination or password once cracked, then the telegrams. */
function codeRows(state: GameState, columns = 0): string[] {
  const found = Object.entries(state.safes).sort(([, a], [, b]) => a.level - b.level);
  const safeRows = found.map(([g, x]) => {
    const name = `${departmentName(state, g as Genre) ?? 'A'} safe`;
    const lock = `${lockOf(x.level).name} (${formatAmount(lockCombinations(x.level))} combinations)`;
    return x.open
      ? ` ${bold(name)}  ${green(x.combo)}  ${dim(`${lock}, cracked after ${formatAmount(Math.floor(x.tries))} tries`)}`
      : ` ${bold(name)}  ${'?'.repeat(x.combo.length)}  ${dim(`${lock}, ${formatAmount(Math.floor(x.tries))} tried${state.codebreakFocus === g ? '' : ' (not in focus)'}`)}`;
  });
  return [...(found.length > 0 ? [dim(' SAFES'), ...safeRows, ''] : []), ...(state.telegrams.length > 0 ? [dim(' TELEGRAMS'), ...telegramRows(state, columns)] : [])];
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
function latelyLines(state: GameState, message: string, columns = 0): string[] {
  const l = state.lately;
  const room = (columns > 0 ? columns : 80) - 4;
  /** A sentence's words after its label, cut short with ... to fit the line. */
  const sentence = (label: string, words: string[]) => {
    const text = `${label}: ${words.join(' ')}`;
    return dim(text.length <= room ? text : `${text.slice(0, room - 3).replace(/ \S*$/, '')} ...`);
  };
  const rows = [
    ...(state.lastWord ? [dim(`Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}`)] : []),
    ...(l.longWord ? [dim(`Longest word lately: ${l.longWord} (${l.longWord.length} letters)`)] : []),
    ...(l.lastSentence.length > 0 ? [sentence('Last sentence', l.lastSentence)] : []),
    ...(l.longSentence.length > 0 ? [sentence(`Longest sentence lately (${l.longSentence.length} words)`, l.longSentence)] : []),
    ...[...lastLineText(state), ...lastMilestoneText(state)].map((t) => dim(t.replace(/^\* /, ''))),
    ...l.news.filter((n) => state.stats.secondsTyping - n.at <= latelyRules.windowSeconds).map((n) => `* ${n.text}`),
    ...folioOffer(state),
    ...(departmentPicks(state) > 0 ? ['* You can open a new department in the Staff store.'] : []),
    ...(canBuildLab(state) ? ['* You can build an R&D lab on the office map ([o], then [r]).'] : []),
    ...(canBuildHR(state) ? [`* You can build an ${hr.name} Department on the office map ([o], then [r]).`] : []),
    ...(canBuildMarketing(state) ? [`* You can build a ${marketing.name} Department on the office map ([o], then [r]).`] : []),
    ...(canBuildCodebreaking(state) ? [`* You can build a ${codebreaking.name} Department on the office map ([o], then [r]).`] : []),
    ...(canBuildRecords(state) ? [`* You can build a ${records.name} Department on the office map ([o], then [r]): it keeps the monkeys' best sentences in books.`] : []),
    ...(unreadTelegram(state) && !bombeBuilt(state) ? [`* A telegram came, in Enigma: read it in the Staff store; ${research.name} can study it.`] : []),
    ...(codebreakers(state).length > 0 ? [`${codebreaking.name}: ${codebreakingStatus(state)}`] : []),
    ...(recorders(state).length > 0 ? [`${records.name}: ${recordsStatus(state)}`] : []),
    ...(lastRecorded(state).length > 0 && recorders(state).length > 0 ? [sentence('Last recorded', lastRecorded(state))] : []),
    ...(royalties(state) > 0 ? [`${marketing.name}: royalties ${formatNumber(royalties(state))} ${theme.currency}/s`] : []),
    ...(state.researchOpen ? [`${research.name}: ${researchStatus(state)}`] : []),
    ...(message ? [bold(message)] : []),
  ];
  return rows.length === 0 ? [] : ['', dim(' LATELY'), ...rows.map((r) => `   ${r}`)];
}

/**
 * The keys shown under the home screen: only the main ones (Justin,
 * 2026-10-21), since the navigation bar goes everywhere; every key is on the [/] page.
 */
function homeKeys(state: GameState, columns: number): string[] {
  return [
    keyRow([
      ...(homeViews(state).length > 1 ? [['<>', 'department'] as [string, string]] : []),
      ['up/down', 'choose a monkey'],
      ['enter', 'details'],
      ['h', theme.pokeAction],
      ...(canPublishFolio(state) ? [['f', 'publish a Folio'] as [string, string]] : []),
      ['/', 'all keys'],
      ['q', 'quit'],
    ], columns),
  ];
}

/** Every key on the home screen, for the [/] page. */
export function renderHomeKeys(state: GameState): string {
  const group = (title: string, keys: [string, string][]) => [dim(` ${title}`), ...keys.map(([k, what]) => `   ${bold(`[${k}]`.padEnd(9))} ${what}`), ''];
  return [
    titleBar(state, 'Keys'),
    '',
    ...group('GO TO', [
      ['tab', 'the menu of every page, from any screen (or click [tab] menu in the title bar); [ and ] switch a page\'s tabs'],
      ['space', 'the shop (then [up/down] choose, [enter] or [1-9] buy, [[/]] another store, [i] inspect)'],
      ['m', 'your monkeys: each one\'s job, typing, hats and trait (the Monkeys page)'],
      ['i', 'the inventory: your hats and furniture put away; move hats, swap typewriters (a Monkeys tab)'],
      ['p', 'the script: plays, pins and scenes to buy (the Texts page, once you have foreign texts or codes: [c] for its contents, [/] for its tabs)'],
      ['o', 'the office map, from any screen'],
      ['backspace', 'back home, from any screen'],
      ['t', 'statistics (the Records page)'],
      ['a', 'achievements (a Records tab)'],
      ['w', 'the dictionary of words your monkeys have spelled (a Records tab)'],
      ['c', 'options'],
    ]),
    ...group('MONKEYS', [
      ...(homeViews(state).length > 1 ? [['1-9', "show that department's monkeys (the tabs above the table)"] as [string, string], ['<>', "show the department before or after (, and . too)"] as [string, string]] : []),
      ['up/down', 'choose a monkey (its name is highlighted)'],
      ['enter', "the chosen monkey's details"],
      ['h', theme.pokeAction],
      ['n', 'name the chosen monkey'],
      ['d', 'move the chosen monkey to another department (pick it from a list)'],
    ]),
    ...group('ANY TIME', [['?', `flip a coin: double all your ${theme.currency} or lose them all`]]),
    ...group('GAME', [
      ...(canPublishFolio(state) ? [['f', 'publish a Folio and start over'] as [string, string]] : []),
      ['s', 'save now (the game also saves on its own)'],
      ['r', 'reset: start a new game'],
      ['`', 'dev tools'],
      ['q', 'quit'],
    ]),
    dim(` ${theme.title} v${GAME_VERSION}`),
    rule(),
    keyRow([['esc', 'back']]),
  ].join('\n');
}

/**
 * The pages the [tab] menu goes to (Justin, 2026-10-21: the menus were "a mess
 * and difficult to navigate"; then "a popup or dropdown menu button" instead
 * of a bar and arrows). Monkeys and Records each hold a few screens as tabs.
 */
export type Page = 'home' | 'shop' | 'monkeys' | 'office' | 'research' | 'texts' | 'records' | 'options';
export const pages: Page[] = ['home', 'shop', 'monkeys', 'office', 'texts', 'records', 'options', 'research']; // pages unlocked later go last
export const pageNames: Record<Page, string> = { home: 'Home', shop: 'Shop', monkeys: 'Monkeys', office: 'Office', research: 'Research', texts: 'Texts', records: 'Records', options: 'Options' };
/** The pages in the [tab] menu now: Research once the R&D lab is built (Justin, 2026-10-21). */
export function pagesFor(state: GameState): Page[] {
  return pages.filter((p) => p !== 'research' || !!labRoom(state));
}
export type Tab = 'roster' | 'inventory' | 'statistics' | 'achievements' | 'dictionary';
export const pageTabs: Partial<Record<Page, Tab[]>> = { monkeys: ['roster', 'inventory'], records: ['statistics', 'achievements', 'dictionary'] };
const tabNames: Record<Tab, string> = { roster: 'Roster', inventory: 'Inventory', statistics: 'Statistics', achievements: 'Achievements', dictionary: 'Dictionary' };

/** The tabs of a page that has them (Monkeys, Records), the open one lit, each clickable; none for other pages. Every page is in the [tab] menu. */
export function pageTabsRow(page: Page, tab?: Tab): string[] {
  const tabs = pageTabs[page];
  if (!tabs) return [];
  const item = (t: Tab) => (t === tab ? bold(inverse(`[${tabNames[t]}]`)) : `[${tabNames[t]}]`);
  return [` ${tabs.map(item).join(' ')}   ${dim('[ and ] switch tabs')}`];
}

/** Every key of the script page; its key row shows the main ones, [/] the rest. */
export const scriptKeys: [string, string][] = [
  ['up/down', 'line'],
  ['left/right', 'scene'],
  ['pgup/pgdn', 'page'],
  ['enter', 'pin'],
  ['u', 'unpin all yours'],
  ['w', 'buy the whole text'],
  ['space', 'shop'],
  ['c', 'contents'],
  ['[/]', 'pinned lines'],
  [',/.', 'scenes you own'],
  ['f', 'shortest line in reach'],
  ['esc', 'back'],
];

/** Every key of a shop; its key row shows the main ones, [/] the rest. */
export function shopKeys(state: GameState, store: Store, onMap = false): [string, string][] {
  return [['up/down', 'choose'], ['enter', 'buy'], ['1-9', 'buy'], ...(openStores(state, store, onMap).length > 1 ? [['[/]', 'store'] as [string, string]] : []), ['i', 'inspect'], ['esc', 'back']];
}

/** Renders the whole game screen as plain text. `rows` is the game's height, for the shop popup over the home screen (0: no padding). */
export function renderScreen(state: GameState, message = '', shop: Store | null = null, columns = 0, cursor = -1, rows = 0, chosen = -1): string {
  if (state.owned.length === 0 && state.departments.length === 0) {
    const genres = departmentChoices(state);
    return openingScreen(
      'Somewhere, infinite monkeys are trying to write Shakespeare.',
      ['Choose their first department. Each works on one genre; the others', 'open as you gather more monkeys.'],
      genres.map((g, i) => [String(i + 1), genreNames[g], availablePlays().filter((p) => p.genre === g).map((p) => p.title).join(', ')]),
      [['up/down', 'choose'], ['enter', 'pick'], [genres.length === 1 ? '1' : `1-${genres.length}`, 'pick'], ['p', 'save profiles'], ['q', 'quit']],
      message,
      columns,
      cursor,
    );
  }

  const starter = starterGenre(state);
  if (starter) {
    const choices = starterPlays(state);
    return openingScreen(
      state.owned.length === 0 ? 'Choose a free first play for your monkeys to work toward.' : `Choose a free first play for your new ${genreNames[starter]} department.`,
      ['Later you can buy more plays in the script.'],
      choices.map((play, i) => [String(i + 1), play.title, `${count(play.lines.length)} line${play.lines.length === 1 ? '' : 's'}`]),
      [['up/down', 'choose'], ['enter', 'pick'], [choices.length === 1 ? '1' : `1-${choices.length}`, 'pick'], ['p', 'save profiles'], ['q', 'quit']],
      message,
      columns,
      cursor,
    );
  }

  if (state.letters.length === 0) {
    return openingScreen(
      'Your monkey sits at a typewriter with no keys.',
      ['Pick its first letter. It has to be a word on its own.'],
      startingLetters.map((l) => [l.toLowerCase(), l, ''] as [string, string, string]),
      [['up/down', 'choose'], ['enter', 'pick'], [startingLetters.map((l) => l.toLowerCase()).join('/'), 'pick'], ['p', 'save profiles'], ['q', 'quit']],
      message,
      columns,
      cursor,
    );
  }

  // The shop is a popup over the bottom of the home screen; Research is a page of its own.
  if (shop === 'research') return renderShop(state, shop, cursor, message, columns);
  // The home screen is first made as tall as the game (`rows`), its keys at the bottom, so the shop
  // covers only its own height and as much of LATELY as fits stays in sight (Justin, 2026-10-22).
  if (shop) return coverBottom(fillHeight(renderScreen(state, '', null, columns, -1, rows, chosen), rows), renderShop(state, shop, cursor, message, columns, true), columns);
  return [...homeLines(state, message, columns, chosen), '', rule(columns), ...homeKeys(state, columns)].join('\n');
}

/** The home screen's department tabs: each department's number key and name, the shown one inverse; they wrap to the screen. */
function departmentTabs(state: GameState, views: string[], view: string, columns: number): string[] {
  const tabs = views.map((v, i) => {
    const name = `${i < 9 ? `[${i + 1}] ` : ''}${viewName(state, v)}`;
    return v === view ? bold(inverse(` ${name} `)) : ` ${name} `;
  });
  const rows = [''];
  for (const t of tabs) {
    const last = rows.length - 1;
    if (columns > 0 && rows[last] && plainText(rows[last] + t).length >= columns) rows.push(t);
    else rows[last] += t;
  }
  return rows;
}

/** The home screen above its keys: the monkey table, letters, script, LATELY and pins. */
function homeLines(state: GameState, message: string, columns: number, chosen = -1): string[] {
  const [written, ownedLines] = ownedProgress(state);
  const ownedScenes = scenesOwned(state);
  const room = columns > 0 ? lineRoom(state, columns) : Infinity;
  const label = (s: string) => dim(` ${s.padEnd(8)}`);
  const views = homeViews(state);
  const shown = homeMonkeys(state);
  const view = homeView(state);
  const lines = [
    titleBar(state, 'Home', columns),
    '',
    // With several departments, one at a time, picked on a row of tabs (Justin, 2026-10-18): [1]-[9] or < >.
    ...(views.length > 1 && view ? [...departmentTabs(state, views, view, columns), ''] : []),
    monkeyHeadings(state),
    ...shown.slice(0, maxMonkeyLines).map((i) => monkeyRow(state, i, room, i === chosen)),
    ...(shown.length > maxMonkeyLines ? [dim(` ...and ${shown.length - maxMonkeyLines} more monkeys typing`)] : []),
    '',
    // Only an alphabet still to finish (Justin, 2026-10-17): Greek and Latin monkeys have all their letters from the start.
    ...(state.letters.length < Object.keys(letterValues).length ? [`${label('Letters')} ${letterRow(state)}`] : []),
    `${label('Script')} ${count(written)} / ${count(ownedLines)} lines written${dim(`   ${count(ownedScenes)} scene${ownedScenes === 1 ? '' : 's'} owned`)}`,
    ...milestoneSummary(state).map((b) => `${label('Bonuses')} ${b}`),
    ...latelyLines(state, message, columns),
    ...pinnedText(state),
  ];
  return lines;
}

/** Monkeys that type (not managers), by index. */
export function typists(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (isTypist(m) ? [i] : []));
}

/** Typing monkeys that can be upgraded: all but temps. */
export function trainees(state: GameState): number[] {
  return typists(state).filter((i) => !isTemp(state.monkeys[i]));
}

/** Shop items for typing skill and typewriters: spelled out for one monkey, the cheapest for several. */
function typingItems(state: GameState): { skill: ShopItem; typewriter: ShopItem } {
  const team = trainees(state);
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

/** Who an upgrade popup offers: Faster typing or a better typewriter for a typist, or a manager's upgrade. */
export type UpgradeKind = 'skill' | 'typewriter' | 'manager';

/**
 * An upgrade popup's columns, one per department (Justin, 2026-10-21: the
 * monkeys "in vertical columns by department"; managers "with the
 * departments in columns"): each cell a monkey with what it gets and the
 * price, green when you can buy it. `monkeys` holds each cell's monkey.
 */
export function upgradeColumns(state: GameState, kind: UpgradeKind): { cols: { heading: string; cells: string[][] }[]; monkeys: number[][] } {
  const cols: { heading: string; cells: string[][] }[] = [];
  const monkeys: number[][] = [];
  for (const g of departmentGenres(state)) {
    const team = kind === 'manager' ? state.monkeys.flatMap((m, i) => (m.manager && !isTemp(m) && m.department === g ? [i] : [])) : trainees(state).filter((i) => state.monkeys[i].department === g);
    if (team.length === 0) continue;
    cols.push({
      heading: departmentName(state, g),
      cells: team.map((i) => {
        const m = state.monkeys[i];
        if (kind === 'manager') {
          const now = 1 + managers.bonusPerLevel * m.managerLevel;
          const next = managers.secondsPerSlot / (managerSpeed(state, m) + managers.speedPerLevel);
          const cost = managerUpgradeCost(state, m);
          const cell = [monkeyName(state, i), `bananas x${now.toFixed(1)} -> x${(now + managers.bonusPerLevel).toFixed(1)}`, `sentences x${sentenceMultiplier(m).toFixed(1)}`, `a slot ${slotDelay(state, m).toFixed(1)}s -> ${next.toFixed(1)}s`, `${formatPrice(cost)} Sentences`];
          return state.sentences >= cost ? cell.map(affordable) : cell;
        }
        const capped = kind === 'skill' && m.skill >= skillCap(m);
        const cost = kind === 'skill' ? typingUpgradeCost(m.skill) : typewriterCost(m);
        const what = kind === 'skill' ? `skill ${m.skill}/${skillCap(m)}` : `cap ${skillCap(m)} -> ${skillCap(m) + typing.levelsPerTypewriter}`;
        const cell = `${monkeyName(state, i)}  ${what}  ${capped ? 'needs a typewriter' : `${formatPrice(cost)} ${theme.currency}`}`;
        return [!capped && state.currency >= cost ? affordable(cell) : capped ? dim(cell) : cell];
      }),
    });
    monkeys.push(team);
  }
  return { cols, monkeys };
}

/** The main shop's stores, shown as tabs; [ ] (or left and right) switch between them. Furniture is sold on the office map, research on its own page. */
export const stores = ['typewriters', 'staff', 'hats'] as const;
/** The office map's own shop: one store of every piece of furniture (Justin, 2026-10-21: "combine the furniture store into one large store"). */
export const officeStores = ['furniture'] as const;
/** The script page's own shop: the scene, act and play under the cursor. */
export type Store = (typeof stores)[number] | (typeof officeStores)[number] | 'script' | 'research';

/** Where the script page's cursor is, for the Script store. */
export interface ScriptSpot {
  play: string;
  line: number;
}

/** The stores a shop can switch between: the main shop's, the office map's furniture stores, or just the script's or Research's. */
export function openStores(_state: GameState, store: Store = 'typewriters', onMap = false): Store[] {
  if (store === 'script' || store === 'research') return [store];
  if (onMap) return [...officeStores];
  return [...stores];
}
export const storeNames: Record<Store, string> = {
  typewriters: 'Typewriters',
  staff: 'Staff',
  script: 'Script',
  research: 'Research',
  furniture: 'Furniture',
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

/** A store's note on what it doesn't sell yet: how many more pieces there are and what the next one needs. */
function lockedNote(state: GameState, items: { name: string; unlock?: Unlock }[]): ShopItem[] {
  const locked = items.filter((x) => !unlocked(state, x.unlock));
  if (locked.length === 0) return [];
  const next = locked[0];
  return [{ text: `${locked.length} more unlock as you finish scenes, acts and whole texts. Next: ${next.name}, ${unlockNeeds(state, next.unlock)}.` }];
}

/** What a store sells. Numbered items (those with an id) are bought with 1-9 in this order. */
export function storeItems(state: GameState, store: Store, at?: ScriptSpot): ShopItem[] {
  const typingShop = typingItems(state);
  switch (store) {
    case 'staff': {
      const nextStart = comboStartCost(state.comboStartLevel);
      const open = departmentGenres(state);
      // Every hire is one item (Justin, 2026-10-18): the department is chosen after, in a popup, each with its own price.
      const free = posts(state).filter((p) => !p.blocked);
      const cheapest = Math.min(...free.map((p) => postCost(state, p)));
      const hireItem: ShopItem = {
        id: 'hire',
        text: 'Hire a monkey',
        effect: hrRoom(state) ? `from ${hr.name}'s candidates, you have ${state.monkeys.length}` : `random stats and trait, you have ${state.monkeys.length}`,
      };
      // Until a department could take a manager, a note says what it takes.
      const managerNote = open.some((g) => !managerOf(state, g)) && !posts(state).some((p) => p.job === 'managing' && p.have === 0);
      // Items that show up later go after the ones already there (Justin, 2026-10-21), and stay once they show.
      const later: ShopItem[] = [
        ...(managerChoices(state).length > 0
          ? [
              {
                id: 'manager',
                text: 'Upgrade a manager',
                effect: `+${managers.bonusPerLevel}x bananas and base sentences for its department, changes slots +${pct(managers.speedPerLevel)} faster`,
                cost: [[Math.min(...managerChoices(state).map((i) => managerUpgradeCost(state, state.monkeys[i]))), 'sentences']] as [number, Currency][],
                costFrom: managerChoices(state).length > 1,
                star: managerChoices(state).some((i) => state.sentences >= managerUpgradeCost(state, state.monkeys[i])),
              },
            ]
          : []),
        ...(codebreakingRoom(state)
          ? [
              codebreakTargets(state).length > 1
                ? { id: 'codefocus', text: 'Switch focus', effect: `now: ${focusName(state.codebreakFocus)}` }
                : { id: 'codefocus', text: 'Switch focus', effect: `now: ${focusName(state.codebreakFocus)}`, blocked: 'nothing else' },
            ]
          : []),
        ...(state.telegrams.length > 0 ? [{ id: 'telegram', text: state.telegrams.length > 1 ? 'Read the telegrams' : 'Read the telegram', effect: unreadTelegram(state) ? 'in Enigma: not yet read' : `${state.telegrams.length} read` }] : []),
        ...(latinUnlocked(state)
          ? [{ id: 'classical', text: `Switch Classical to ${state.classical === 'greek' ? 'Latin' : 'Greek'}`, effect: `now typing ${state.classical === 'greek' ? 'Greek' : 'Latin'}; slots start over` }]
          : []),
      ];
      return [
        typingShop.skill,
        free.length > 0
          ? { ...hireItem, star: state.currency >= cheapest, cost: [[cheapest, 'currency']], costFrom: free.length > 1 }
          : { ...hireItem, blocked: new Set(posts(state).map((p) => p.blocked)).size === 1 ? posts(state)[0].blocked : 'no room' },
        comboStart(state) >= comboCap(state)
          ? { id: 'combo', text: 'Starting combo', effect: `x${comboStart(state).toFixed(1)}`, blocked: 'at the cap' }
          : {
              id: 'combo',
              star: state.sentences >= nextStart,
              text: 'Starting combo',
              effect: `x${comboStart(state).toFixed(1)} -> x${(comboStart(state) + combo.step).toFixed(1)}`,
              cost: [[nextStart, 'sentences']],
            },
        ...inRevealOrder(state, later, (x) => `staff:${x.id}`),
        // Items that come and go: last, so they never move the others.
        ...(departmentPicks(state) > 0 ? [{ id: 'department', star: true, text: 'Open a new department!' }] : []),
        ...(state.unassignedMonkeys > 0
          ? [
              canSeatMonkey(state)
                ? { id: 'assign', text: `Assign ${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? '' : 's'}`, effect: 'to a department' }
                : { text: `${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? ' is' : 's are'} waiting for a free square for a desk.` },
            ]
          : []),
        ...(departmentPicks(state) === 0 && nextDepartmentAt(state) > 0 ? [{ text: `Next department opens at ${nextDepartmentAt(state)} monkeys.` }] : []),
        ...(managerNote ? [{ text: `A department of ${managers.minDepartmentMonkeys} monkeys can hire a manager, with an office next door.` }] : []),
      ];
    }
    case 'typewriters': {
      const nextLetter = letterCost(state.letters.length);
      const nextLetterWords = letterWordsCost(state.letters.length);
      return [
        // Kept once every letter is owned, so the items under it don't move.
        unownedLetters(state).length > 0
          ? {
              id: 'letter',
              star: canAffordLetter(state),
              text: 'Buy a letter key',
              effect: `you choose it (${unownedLetters(state).length} left)`,
              cost: [[nextLetter, 'currency'], ...(nextLetterWords > 0 ? [[nextLetterWords, 'words'] as [number, Currency]] : [])] as [number, Currency][],
            }
          : { id: 'letter', text: 'Buy a letter key', effect: 'every letter is yours', blocked: 'all owned' },
        typingShop.typewriter,
        keysUnlocked(state)
          ? { id: 'keys', text: 'Typewriter keys...', effect: 'letter combos and whole words' }
          : { text: `Typewriter keys unlock when you own ${typewriterKeys.unlockLetters} letters.` },
        slotsUnlocked(state)
          ? { id: 'slots', text: 'Word slots...', effect: slotRequests(state) || `${state.slots.filter((x) => x.on && x.word).length} active` }
          : { text: `Word slots unlock when you own ${wordSlots.unlockLetters} letters.` },
      ];
    }
    case 'furniture': {
      // Cheapest first among what's for sale from the start, then each piece in the order it unlocked (the safe when it shows up), so new ones go last.
      const forSale = furnitureKinds.filter((k) => k.id !== safe.id || officesWithoutSafe(state).length > 0).sort((a, b) => unlockRank(a) - unlockRank(b) || a.cost - b.cost);
      const kinds = inRevealOrder(state, forSale.filter((k) => unlocked(state, k.unlock)), (k) => `furniture:${k.id}`);
      return [
        { text: 'Any piece can stand in any room. Its effects work only in the rooms it is made for; feng shui counts it everywhere.' },
        ...kinds.map((k): ShopItem => {
          const cost = furnitureCost(state, k.id);
          const owned = furnitureOwned(state, k.id);
          const office = k.rooms.includes('office') && k.happiness > 0 ? [`manager ${pct(k.happiness * managerOffice.speedPerHappiness)} quicker in its office`] : [];
          return {
            id: `furniture:${k.id}`,
            star: !!furnitureSpot(state, k.id) && state.sentences >= cost,
            text: `${k.size ? `${k.name} (${k.size[0]}x${k.size[1]})` : k.name}${owned > 0 ? ` (${owned})` : ''}`,
            glyph: furnitureColor(k.color, k.glyph),
            // Elements mean nothing until the feng shui book explains them.
            ...(state.fengShuiBook ? { element: k.element } : {}),
            effect: k.id === safe.id ? `something inside, in a manager's office` : `${[furnitureEffect(k), ...office].filter(Boolean).join(', ')}; works in ${worksInText(k)}`,
            cost: [[cost, 'sentences']],
          };
        }),
        ...lockedNote(state, forSale),
        { text: state.settings.autoPlaceFurniture ? 'New furniture places itself where it works ([c] options).' : 'New furniture opens the office map so you can place it.' },
      ];
    }
    case 'research': {
      const busy = !!state.researching;
      const rate = researchRate(state);
      return [
        { text: researchStatus(state) },
        // Every project stays in its place, done or under way, so new ones go at the bottom.
        ...researchList(state).map((p): ShopItem => {
          // How long it takes: with today's researchers, or with one if there are none.
          const time = formatDuration((p.hours * 3600) / Math.max(1, rate));
          const item: ShopItem = { id: `research:${p.id}`, text: p.name, effect: `${p.text} ${time}` };
          if (state.researched.includes(p.id)) return { ...item, effect: p.text, blocked: 'done' };
          if (state.researching === p.id) return { ...item, blocked: 'under way' };
          return busy ? { ...item, blocked: 'one at a time' } : { ...item, star: state.currency >= p.cost, cost: [[p.cost, 'currency']] };
        }),
        ...(rate === 0 ? [{ text: 'Nobody is researching: hire researchers in the Staff store.' }] : []),
      ];
    }
    case 'script': {
      const play = at && getPlay(at.play);
      const sc = play && sceneOf(play, at.line);
      if (!play || !sc) return [{ text: 'No plays loaded.' }];
      if (!departmentGenres(state).includes(departmentOf(play.genre))) return [{ text: `Open a ${departmentName(state, departmentOf(play.genre))} department to buy these.` }];
      const section = (id: string, text: string, n: number, effect: string): ShopItem =>
        n === 0 ? { id, text, effect, blocked: 'owned' } : { id, text, effect, star: state.lines >= n, cost: [[n, 'lines']] };
      const lines = (n: number) => `${count(n)} line${n === 1 ? '' : 's'}`;
      return [section('section:w', play.genre === 'sonnet' ? 'All the sonnets' : isForeign(play.genre) ? 'The whole text' : 'The whole play', sectionPrice(state, play), `${play.title}, ${lines(play.lines.length)}`)];
    }
    case 'hats': {
      const team = state.monkeys.map((_, i) => i).filter((i) => i < 9);
      // Dyeing first, so hats unlocked later go at the bottom.
      return [
        {
          id: 'dye',
          star: state.monkeys.some((m) => m.hat) && state.sentences >= dyeCost(state),
          text: 'Dye a hat...',
          effect: hatColors.map((c) => paint(c.id, c.name)).join(', '),
          cost: [[dyeCost(state), 'sentences']],
        },
        ...inRevealOrder(state, hatsForSale(state), (h) => `hat:${h.id}`).map((h): ShopItem => {
          const cost = hatCost(state, h.id);
          const owned = hatsOwned(state, h.id);
          const someone = team.some((i) => state.monkeys[i].hat !== h.id);
          const effect = hatEffect(h);
          return { id: `hat:${h.id}`, star: someone && state.sentences >= cost, text: `${h.name}${owned > 0 ? ` (${owned})` : ''}`, glyph: `${h.icon}${monkeyIcon}`, effect, cost: [[cost, 'sentences']] };
        }),
        ...lockedNote(state, hats),
        { text: 'Hats taken off go into your inventory: [i] puts one back on for free.' },
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
    ...(h.rest ? [`recovers ${pct(h.rest)} faster`] : []),
    ...(h.combo ? [`combo cap +${h.combo}`] : []),
  ].join(', ');
}

/** The monkey menu for giving a hat: its title, and a note for each monkey. */
export function hatPick(state: GameState, id: string): { title: string; notes: string[] } {
  const h = hats.find((x) => x.id === id)!;
  return {
    title: `${h.name} (${priceNamed(hatCost(state, id), state.sentences, 'sentences')}): which monkey gets a new one?`,
    notes: state.monkeys.map((m) =>
      m.hat === id ? 'wearing it: takes it off' : hatOf(m) ? `swaps its ${hats.find((x) => x.id === m.hat)!.name.toLowerCase()} (into your inventory)` : '',
    ),
  };
}

/** The prompt for choosing a dye. */
export function dyeColorPrompt(): string {
  return `Dye which colour? ${hatColors.map((c, i) => `[${i + 1}] ${paint(c.id, c.name)}`).join('   ')}   [0] undyed   (any other key cancels)`;
}

/** The monkey menu for dyeing a hat `color` ('' washes it out). */
export function dyePick(state: GameState, color: string): { title: string; notes: string[] } {
  const name = hatColors.find((c) => c.id === color)?.name ?? 'Undyed';
  return {
    title: `${paint(color, name)} (${color ? priceNamed(dyeCost(state), state.sentences, 'sentences') : 'free'}): which monkey's hat?`,
    notes: state.monkeys.map((m) => (!m.hat ? 'no hat' : m.hatColor === color ? 'already' : '')),
  };
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
    ...(k.rest ? [`recovers ${pct(k.rest)} faster`] : []),
    ...(k.happiness ? [`+${pct(k.happiness)} pay`] : []),
  ].join(', ');
}

/** The numbered (buyable) items of a store, in key order 1-9 on `page`, or all of them when `page` is -1. */
export function storeChoices(state: GameState, store: Store, page = 0, at?: ScriptSpot): ShopItem[] {
  const all = storeItems(state, store, at).filter((x) => x.id);
  return page < 0 ? all : all.slice(page * storePageSize, (page + 1) * storePageSize);
}

/** Numbered items a store shows at once (keys 1-9); a bigger store has pages. */
export const storePageSize = 9;

/** How many pages a store's numbered items fill. */
export function storePages(state: GameState, store: Store, at?: ScriptSpot): number {
  return Math.max(1, Math.ceil(storeItems(state, store, at).filter((x) => x.id).length / storePageSize));
}

/** A price as text, e.g. "from 500 Bananas" or "75 Bananas + 1 Words"; when `affordable`, numbers bold. */
function costText(item: ShopItem, affordable = false): string {
  const parts = (item.cost ?? []).map(([n, c]) => `${affordable ? bold(formatPrice(n)) : formatPrice(n)} ${currencyNames[c]}`);
  return parts.length === 0 ? '' : `${item.costFrom ? 'from ' : ''}${parts.join(' + ')}`;
}

/**
 * The shop, on its own screen: the stores as tabs (the open one inverse, a *
 * on any with something you can afford), then the open store's items in
 * columns with prices on the right. What you can afford is green (the whole
 * row but the glyph) with a *; what you can't yet is dim. Notes are dim too. Feng shui elements show
 * only once the feng shui book is read. `cursor` is the chosen item (counted
 * over every page; its page is the one shown), drawn inverse, or -1 for none.
 * `under` leaves out the title bar, for the shop under another screen.
 */
export function renderShop(state: GameState, store: Store, cursor = -1, message = '', columns = 0, under = false, at?: ScriptSpot, onMap = false, sameHeight = true): string {
  const items = storeItems(state, store, at);
  const numbered = items.filter((x) => x.id);
  const pages = storePages(state, store, at);
  const page = Math.min(pages - 1, Math.floor(Math.max(0, cursor) / storePageSize));
  const tabs = openStores(state, store, onMap).map((x) => {
    const star = storeItems(state, x, at).some((i) => i.star) ? '*' : ' ';
    return x === store ? bold(inverse(` ${storeNames[x]}${star}`)) : dim(` ${storeNames[x]}`) + green(star);
  });

  // Column widths come from every numbered item in the store, so they stay put between pages.
  const width = (f: (x: ShopItem) => string | undefined) => Math.max(0, ...numbered.map((x) => plainText(f(x) ?? '').length));
  const nameWidth = width((x) => x.text);
  const glyphWidth = width((x) => x.glyph);
  const elementWidth = numbered.some((x) => x.element) ? Math.max('ELEMENT'.length, width((x) => x.element)) : 0;
  const costWidth = Math.max('PRICE'.length, width((x) => (x.cost ? `* ${costText(x)}` : (x.blocked ?? ''))));
  // Columns are two spaces apart, or one when that's what fits the screen; an effect too long for what's left wraps.
  const others = [5 + nameWidth, glyphWidth, elementWidth, costWidth].filter((w) => w > 0);
  const fullEffect = width((x) => x.effect);
  const total = (gapWidth: number) => others.reduce((a, b) => a + b, 0) + fullEffect + gapWidth * others.length;
  const gap = columns > 0 && total(2) >= columns ? ' ' : '  ';
  const effectWidth = columns > 0 ? Math.max(12, Math.min(fullEffect, fullEffect + columns - 1 - total(gap.length))) : fullEffect;
  const row = (num: string, name: string, glyph: string, element: string, effect: string, cost: string) => {
    const parts = plainText(effect).length <= effectWidth ? [effect] : wrapWords(effect, effectWidth);
    const cells = (i: number) =>
      [
        i === 0 ? ` ${num.padEnd(4)}${padVisible(name, nameWidth)}` : ' '.repeat(5 + nameWidth),
        ...(glyphWidth > 0 ? [padVisible(i === 0 ? glyph : '', glyphWidth)] : []),
        ...(elementWidth > 0 ? [padVisible(i === 0 ? element : '', elementWidth)] : []),
        padVisible(parts[i], effectWidth),
        padVisible(i === parts.length - 1 ? cost : '', costWidth, 'right'),
      ].join(gap);
    return parts.map((_, i) => cells(i)).join('\n');
  };

  const shopMarks = scrollMarks(page * storePageSize, numbered.length - (page + 1) * storePageSize, 'more items');
  const firstItem = items.findIndex((x) => x.id);
  const intro = items.slice(0, Math.max(0, firstItem));
  let k = 0; // numbered items so far, across pages
  // The page's items, with any notes among them; the scroll marks go right under the last item (Justin, 2026-10-18).
  const list: string[] = [];
  let lastRow = -1;
  for (const x of items.slice(Math.max(0, firstItem))) {
    if (!x.id) {
      list.push(`     ${dim(x.text)}`);
      continue;
    }
    const at = k++;
    const n = at - page * storePageSize;
    if (n < 0 || n >= storePageSize) continue;
    const cost = x.blocked ? red(x.blocked) : !x.cost ? '' : x.star ? `* ${costText(x, true)}` : costText(x);
    const text = row(`[${n + 1}]`, x.text, x.glyph ?? '', x.element ?? '', x.effect ?? '', cost);
    // What you can afford is green from end to end, glyph and number too.
    const style = (t: string) => (isCursor(at, cursor) ? highlight(x.star ? affordable(t) : t) : x.star ? affordable(t) : x.cost ? dim(plainText(t)) : t);
    lastRow = list.push(...text.split('\n').map(style)) - 1;
  }
  list.splice(lastRow + 1, 0, ...shopMarks[1], ...(pages > 1 ? [dim(`     page ${page + 1} of ${pages}`)] : []));

  const shown = [
    ...(under ? [] : [titleBar(state, store === 'research' ? 'Research' : 'Shop', columns), '']),
    ...(store === 'research' || store === 'furniture' ? [] : [tabs.join(' '), '']),
    ...intro.map((x) => ` ${dim(x.text)}`),
    ...(intro.length > 0 ? [''] : []),
    ...(numbered.length > 0 ? [dim(row('', 'ITEM', '', elementWidth > 0 ? 'ELEMENT' : '', 'EFFECT', 'PRICE').trimEnd())] : []),
    ...shopMarks[0],
    ...list,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    shortKeyRow(shopKeys(state, store, onMap), ['up/down', 'enter', '[/]', 'esc'], columns),
  ].join('\n');
  // Every store as tall as the tallest (Justin, 2026-10-21: "so the top of the shop does not move up and down when changing tabs").
  if (!sameHeight) return shown;
  const tallest = Math.max(...openStores(state, store, onMap).map((x) => renderShop(state, x, -1, message, columns, under, at, onMap, false).split('\n').length));
  return fillHeight(shown, tallest);
}

/** The options menu. */
/** The coin flip screen, opened with [?] from any screen: the bet and its odds, then how it went. */
export function renderCoinFlip(state: GameState, asking: boolean, message: string, columns = 0): string {
  return [
    titleBar(state, 'Coin flip', columns),
    '',
    ...(asking
      ? [
          ` Bet all ${bold(formatAmount(state.currency))} ${theme.currency} on a coin flip?`,
          ` Heads (a ${(flipChance(state) * 100).toFixed(1)}% chance) doubles them; tails loses them all.`,
        ]
      : [` ${bold(message)}`]),
    '',
    rule(columns),
    keyRow(asking ? [['y', 'flip'], ['esc', 'no']] : [['?', 'flip again'], ['esc', 'back']], columns),
  ].join('\n');
}

export function renderOptions(state: GameState, columns = 0, cursor = -1, profile = ''): string {
  const onOff = (on: boolean) => (on ? green(bold('ON')) : dim('off'));
  const option = (key: string, label: string, on: boolean, notes: string[]) => {
    const row = ` ${bold(`[${key}]`)} ${label.padEnd(26)}${onOff(on)}`;
    return [isCursor(Number(key) - 1, cursor) ? highlight(row) : row, ...notes.map((n) => dim(`     ${n}`)), ''];
  };
  return [
    titleBar(state, 'Options', columns),
    '',
    ...option('1', 'Furniture places itself', state.settings.autoPlaceFurniture, [
      'On: new furniture goes in the first free square (a break room first).',
      'Off: buying furniture opens the office map so you can place it.',
    ]),
    ...option('2', 'Light background', state.settings.lightBackground, ["On: darker colours that are easy to read when your terminal's theme is light."]),
    ...option('3', 'Scientific numbers', state.settings.scientific, ['On: big numbers as 1.23e45. Off: short names (1.23M, 4.56Qa, 7.89Vg).']),
    ...option('4', 'Screen at the top', state.settings.screenAtTop, ['On: the game starts at the top of the terminal. Off: it sits at the bottom.']),
    ...option('5', 'Mouse', state.settings.mouse, [
      'On: click a [key] to press it, left click elsewhere = enter, right click = back,',
      'the wheel moves up and down. Off: your terminal can select text again.',
    ]),
    ...(() => {
      const row = ` ${bold('[6]')} ${'Save profiles'.padEnd(26)}${profile ? bold(profile) : ''}`;
      return [isCursor(5, cursor) ? highlight(row) : row, dim('     Up to 3 games side by side: switch, rename, copy or delete them.'), ''];
    })(),
    dim(` ${theme.title} v${GAME_VERSION}`),
    rule(columns),
    keyRow([['up/down', 'choose'], ['enter', 'switch'], ['1-6', 'switch'], ['esc', 'back']], columns),
  ].join('\n');
}

/** A profile on the save profiles screen (see cli/profiles.ts). */
export interface ProfileRow {
  name: string;
  empty: boolean;
  gameVersion: string;
  bananas: number;
  monkeys: number;
  seconds: number;
}

/** The save profiles screen (Options [6]): each profile's name and game, the one being played marked, and > at the chosen one (`cursor`), which the keys act on. */
export function renderProfiles(state: GameState, profiles: ProfileRow[], active: number, cursor = -1, message = '', columns = 0): string {
  const rows = profiles.flatMap((p, i) => {
    const what = p.empty
      ? dim('empty: [enter] starts a new game here')
      : `${formatAmount(p.bananas)} ${theme.currency}, ${p.monkeys} monkey${p.monkeys === 1 ? '' : 's'}, ${formatDuration(p.seconds)} played${p.gameVersion ? dim(` (v${p.gameVersion})`) : ''}`;
    const row = `${i === cursor ? bold('>') : ' '}${bold(`[${i + 1}]`)} ${p.name.padEnd(21)}${padVisible(i === active ? green('playing') : '', 9)}${what}`;
    return [isCursor(i, cursor) ? highlight(row) : row, ''];
  });
  return [
    titleBar(state, 'Save profiles', columns),
    '',
    dim(' Each profile is a game of its own. Switching saves the one you are playing first.'),
    '',
    ...rows,
    ...(message ? [` ${bold(message)}`, ''] : []),
    rule(columns),
    keyRow([['up/down', 'choose'], ['enter', 'play'], ['n', 'rename'], ['c', 'copy'], ['d', 'delete'], ['esc', 'back']], columns),
  ].join('\n');
}

/** The development tools menu, for testing features. */
export function renderDevMenu(state: GameState, message = '', columns = 0, cursor = -1): string {
  return [
    titleBar(state, 'Dev tools', columns),
    '',
    dim(' For testing: these change your save.'),
    '',
    ...devTools.map((t, i) => (isCursor(i, cursor) ? highlight(` [${i + 1}] ${t.label}`) : ` ${bold(`[${i + 1}]`)} ${t.label}`)),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([['up/down', 'choose'], ['enter', 'use it'], [`1-${devTools.length}`, 'use a tool'], ['esc', 'back']], columns),
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
    return isCursor(i, selected) ? highlight(row + ' ') : row;
  });
  const managed = !!managerOf(state, genre);
  const wanted = slotsWanted(state, genre);
  const many = departmentGenres(state).length > 1;
  return [
    titleBar(state, 'Word slots', columns),
    '',
    ...(genre ? [` ${bold(`${departmentName(state, genre)} department`)}`, ''] : []),
    dim(' Each slot makes the word at its position in a chain always the word you'),
    dim(' choose, e.g. 3rd word: FRIEND. Switch slots off for fully random typing.'),
    '',
    ...(managed ? [" This department's manager sets these slots for you.", ''] : []),
    ...(wanted > 0 ? [` ${yellow(`The manager asks for ${wanted} more slot${wanted === 1 ? '' : 's'}: its line is longer than the slots.`)}`, ''] : []),
    ...(rows.length > 0 ? rows : [dim('   No slots yet.')]),
    ...(canBuy
      ? ['', state.lines >= next ? ` ${affordable(`${bold('[b]')} buy a slot   * ${bold(formatPrice(next))} Lines`)}` : ` ${bold('[b]')} buy a slot   ${formatPrice(next)} Lines`]
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
            ['enter', 'on/off'],
            ['left/right', 'move position'],
            ...(many ? [['<>', 'department'] as [string, string]] : []),
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
export function renderKeysMenu(state: GameState, message = '', columns = 0, cursor = -1): string {
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
      const row = (name: string) => ` [${i + 1}] ${name}  ${kind.padEnd(11)}  `;
      const shown =
        state.currency >= cost
          ? green(`${row(k.padEnd(keyWidth))}* ${bold(formatPrice(cost))} ${theme.currency}`)
          : dim(`${row(k.padEnd(keyWidth))}  ${formatPrice(cost)} ${theme.currency}`);
      return isCursor(i, cursor) ? highlight(shown) : shown;
    }),
    ...(choices.length === 0 ? [dim('   None available yet.')] : []),
    '',
    ` ${dim('Owned')}  ${owned}`,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow(
      [...(choices.length > 0 ? [['up/down', 'choose'], ['enter', 'buy'], [`1-${choices.length}`, 'buy']] as [string, string][] : []), ['esc', 'back']],
      columns,
    ),
  ].join('\n');
}

/** What a manager shows instead of typing: the line it has its department aiming at. */
function managerLine(m: MonkeyState): string {
  const play = m.target && getPlay(m.target.play);
  const line = play && m.target && play.lines[m.target.index];
  const title = `MANAGER (department x${(1 + managers.bonusPerLevel * m.managerLevel).toFixed(1)}, sentences x${sentenceMultiplier(m).toFixed(1)})`;
  return play && line
    ? `${title}, aiming at ${play.title} ${lineLocation(line, play.genre)}`
    : `${title}, waiting for a line your letters can spell`;
}

/** Managers by monkey index, for the upgrade menu (keys 1-9 in this order). */
export function managerChoices(state: GameState): number[] {
  return state.monkeys.flatMap((m, i) => (m.manager && !isTemp(m) ? [i] : [])).slice(0, 9);
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
    ...(state.folios > 0 ? [`Folio bananas ${formatMultiplier(folioMultiplier(state))} (${plural(state.folios, 'Folio')} published)`] : []),
  ];
  return parts.length > 0 ? [parts.join('   ')] : [];
}

/** The offer to publish a Folio, once a play is finished. */
export function folioOffer(state: GameState): string[] {
  if (!canPublishFolio(state)) return [];
  const pages = folioPagesNow(state);
  return [`* You can publish a Folio: [f] start over with ${count(pages)} more pages, bananas ${formatMultiplier(folioMultiplierAfter(state))} for good.`];
}

/** The question before publishing a Folio. */
export function folioPrompt(state: GameState): string {
  const pages = folioPagesNow(state);
  return (
    `Publish a Folio? Everything starts over: monkeys, letters, office, script and currencies. ` +
    `You keep achievements and statistics, and the Folio gains ${count(pages)} pages (one per line written, finished plays twice): ` +
    `bananas ${formatMultiplier(folioMultiplierAfter(state))} for good (each Folio multiplies the last). Press y to publish, any other key to keep playing.`
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
  const missing = missingLetters(state, play.lines[index].letters, play.genre);
  return missing.length > 0 ? `needs ${missing.join(' ')}` : 'within reach';
}

/** What a line still needs, for the NEEDS column: the letters you don't own yet, "in reach", or nothing. */
function lineNeeds(state: GameState, play: Play, index: number): string {
  if (state.completed[play.id]?.includes(index) || !ownsLine(state, play, index)) return '';
  const missing = missingLetters(state, play.lines[index].letters, play.genre);
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
export function wrapWords(text: string, width: number): string[] {
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
 * them, prices to buy the play (or a sonnet or a foreign text's section or book) under the cursor.
 */
export function renderScript(state: GameState, playId: string, cursor: number, message = '', columns = 0, shop = ''): string {
  if (shop) return coverBottom(renderScript(state, playId, cursor, '', columns), shop, columns);
  const play = getPlay(playId);
  if (!play) return 'No plays loaded.';
  const done = state.completed[play.id] ?? [];
  const at = Math.max(0, Math.min(cursor, play.lines.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(scriptPageSize / 2), play.lines.length - scriptPageSize));
  const shown = Array.from({ length: Math.min(scriptPageSize, play.lines.length - first) }, (_, k) => first + k);
  const pinned = (i: number) => state.pinned.some((p) => p.play === play.id && p.index === i);
  const scriptMarks = scrollMarks(first, play.lines.length - first - shown.length, 'lines');
  const speakerWidth = 13;
  const needsWidth = Math.max('NEEDS'.length, ...shown.map((i) => plainText(lineNeeds(state, play, i)).length));
  // A foreign text's written lines read in English (Justin: "whenever the monkeys completes a line in the original greek, it changes to english").
  const lineText = (i: number) => (done.includes(i) && play.english[i]) || play.lines[i].text;
  const longest = Math.max(...shown.map((i) => lineText(i).length));
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
    const texts = wrapWords(lineText(i), textWidth);
    const lines = texts.map((t, k) => {
      const text = owned && !written ? slotHighlight(state, t, play.genre) : t;
      const lead = k === 0 ? `${mark} ${(line.speaker || '').padEnd(speakerWidth).slice(0, speakerWidth)}` : ' '.repeat(3 + speakerWidth);
      const needs = k === 0 ? lineNeeds(state, play, i) : '';
      const row = `${lead} ${padVisible(text, textWidth)}  ${needs}`;
      return k === 0 && !written && owned ? row.replace(line.speaker || '\u0000', dim(line.speaker)) : row;
    });
    rows.push(
      ...lines.map((r) => {
        if (isCursor(i, at)) return highlight(padVisible(written ? green(plainText(r)) : owned ? r : dim(plainText(r)), rowWidth));
        if (written) return green(plainText(r).trimEnd());
        return owned ? r.trimEnd() : dim(plainText(r).trimEnd());
      }),
    );
  }

  const section = (key: string, label: string, n: number) =>
    state.lines >= n && n > 0
      ? affordable(`${bold(`[${key}]`)} ${label} * ${bold(formatPrice(n))} Lines`)
      : `${bold(`[${key}]`)} ${label} ${n === 0 ? dim('owned') : `${formatPrice(n)} Lines`}`;
  const locked = !departmentGenres(state).includes(departmentOf(play.genre));
  return [
    titleBar(state, isForeign(play.genre) ? 'Text' : 'Script', columns),
    '',
    ` ${bold(play.title)}   ${dim(`${genreNames[play.genre]}${locked ? ', locked' : ''}`)}   ${count(done.length)} / ${count(play.lines.length)} lines written`,
    '',
    ...scriptMarks[0],
    ...rows,
    ...scriptMarks[1],
    '',
    dim(` + written   @ pinned (${state.pinned.length}/${maxPinnedLines})   NEEDS: letters you don't own yet`),
    ...(locked
      ? [` Open a ${departmentName(state, departmentOf(play.genre))} department to buy these.`]
      : wrapVisible(
          [section('w', play.genre === 'sonnet' ? 'all the sonnets' : isForeign(play.genre) ? 'whole text' : 'whole play', sectionPrice(state, play))],
          columns,
          ` ${dim('Buy')}  `,
        )),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    shortKeyRow(scriptKeys, ['up/down', 'enter', 'space', 'c', 'esc'], columns),
  ].join('\n');
}

/** Rows of the table of contents shown at once. */
export const contentsPageSize = 20;

/** The table of contents' tabs: plays, then foreign texts and codes once you have any (Justin: the scripts page "turns into the texts page"). */
export type TextsTab = 'plays' | 'foreign' | 'codes';
const textsTabNames: Record<TextsTab, string> = { plays: 'Plays', foreign: 'Foreign texts', codes: 'Codes' };

export function textsTabs(state: GameState): TextsTab[] {
  const later: TextsTab[] = [...(departmentGenres(state).includes('greek') ? ['foreign' as const] : []), ...(state.telegrams.length > 0 || Object.keys(state.safes).length > 0 ? ['codes' as const] : [])];
  return ['plays', ...inRevealOrder(state, later, (t) => `tab:${t}`)];
}

/** The kinds of room a piece's effects work in, in words: "departments' rooms or break rooms". */
export function worksInText(k: FurnitureKind): string {
  const names = k.rooms.map((r) => ({ department: "departments' rooms", break: 'break rooms', office: "managers' offices" })[r as string] ?? `${r} rooms`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? 'no room';
}

/** How far into the game a piece of furniture or hat unlocks, for listing new ones after older ones. */
function unlockRank(x: { id: string; unlock?: Unlock }): number {
  if (x.id === safe.id) return Infinity;
  const u = x.unlock;
  return !u ? 0 : (u.texts ?? 0) * 10_000 + (u.acts ?? 0) * 100 + (u.scenes ?? 0);
}

/**
 * Every menu item whose place depends on when it showed up (see
 * inRevealOrder), as showing now: the front end notes them (noteRevealed)
 * each time it draws, so ones that show up later go at the bottom.
 */
export function revealKeys(state: GameState): string[] {
  const staff = storeItems(state, 'staff').filter((x) => x.id && ['manager', 'codefocus', 'telegram', 'classical'].includes(x.id));
  const furniture = storeItems(state, 'furniture').flatMap((x) => (x.id?.startsWith('furniture:') ? [x.id] : []));
  return [
    ...posts(state).map((p) => `post:${p.id}`),
    ...researchList(state).map((p) => `research:${p.id}`),
    ...staff.map((x) => `staff:${x.id}`),
    ...furniture,
    ...hatsForSale(state).map((h) => `hat:${h.id}`),
    ...textsTabs(state).slice(1).map((t) => `tab:${t}`),
  ];
}

/** The plays (or foreign texts) a tab lists, in availablePlays() order. */
export function tabPlays(tab: TextsTab): Play[] {
  return tab === 'codes' ? [] : availablePlays().filter((p) => isForeign(p.genre) === (tab === 'foreign'));
}

/**
 * The script's table of contents: every play (when playId is null), or one
 * play's acts and scenes. `cursor` indexes availablePlays() or play.scenes.
 * The cursor's row is inverse; locked plays and scenes you don't own are dim.
 */
export function renderContents(state: GameState, playId: string | null, cursor: number, message = '', columns = 0, tab: TextsTab = 'plays'): string {
  const play = playId ? getPlay(playId) : undefined;
  const tabs = textsTabs(state);
  const tabRow = tabs.length > 1 && !play ? [tabs.map((t) => (t === tab ? bold(inverse(` ${textsTabNames[t]} `)) : dim(` ${textsTabNames[t]} `))).join(' '), ''] : [];
  if (!play && tab === 'codes') {
    return [titleBar(state, 'Texts', columns), '', ...tabRow, ...codeRows(state, columns), ...(message ? [` ${bold(message)}`, ''] : []), rule(columns), keyRow([['[/]', 'tab'], ['esc', 'back']], columns)].join('\n');
  }
  const open = departmentGenres(state);
  type Row = { cols: string[]; faded?: boolean; finished?: boolean; header?: string };
  const items: Row[] = play
    ? play.scenes.map((sc, i) => {
        const [w, total] = sceneProgress(state, play, sc);
        const owned = ownsScene(state, play.id, sc);
        const prev = play.scenes[i - 1];
        const header = play.genre !== 'sonnet' && (!prev || prev.act !== sc.act) ? `${isForeign(play.genre) ? 'BOOK' : 'ACT'} ${sc.act}` : undefined;
        const name = play.genre === 'sonnet' ? sceneName(sc.act, sc.scene, play.genre) : `${play.genre === 'greek' ? 'Chapter' : play.genre === 'latin' ? 'Section' : 'Scene'} ${sc.scene}`;
        return {
          cols: [name, owned ? `${count(w)} / ${count(total)}` : 'not owned', owned ? '' : `${count(total)} line${total === 1 ? '' : 's'}`],
          faded: !owned,
          finished: owned && w === total,
          header,
        };
      })
    : tabPlays(tab).map((p) => {
        const owned = p.scenes.filter((sc) => ownsScene(state, p.id, sc)).length;
        const done = (state.completed[p.id] ?? []).length;
        return open.includes(departmentOf(p.genre))
          ? { cols: [p.title, genreNames[p.genre], `${count(done)} / ${count(p.lines.length)}`, `${count(owned)} / ${count(p.scenes.length)}`] }
          : { cols: [p.title, genreNames[p.genre], 'locked', ''], faded: true };
      });
  const headings = play
    ? [play.genre === 'sonnet' ? 'SONNET' : play.genre === 'greek' ? 'CHAPTER' : play.genre === 'latin' ? 'SECTION' : 'SCENE', 'WRITTEN', '']
    : tab === 'foreign'
    ? ['TEXT', 'LANGUAGE', 'WRITTEN', 'CHAPTERS OWNED']
    : ['PLAY', 'GENRE', 'WRITTEN', 'SCENES OWNED'];
  const widths = headings.map((h, c) => Math.max(h.length, ...items.map((x) => x.cols[c].length)));
  const right = (c: number) => (play ? c === 1 : c >= 2);
  const line = (mark: string, cols: string[]) => ` ${mark} ` + cols.map((t, c) => (right(c) ? t.padStart(widths[c]) : t.padEnd(widths[c]))).join('   ');
  const at = Math.max(0, Math.min(cursor, items.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(contentsPageSize / 2), items.length - contentsPageSize));
  const contentsMarks = scrollMarks(first, items.length - first - contentsPageSize);
  const rows = items.slice(first, first + contentsPageSize).flatMap((item, k) => {
    const text = line(first + k === at ? '>' : ' ', item.cols) + (item.finished ? '   finished' : '');
    return [
      ...(item.header ? [dim(` ${item.header}`)] : []),
      isCursor(first + k, at) ? highlight((item.faded ? dim(text) : item.finished ? text.replace(/finished$/, green('finished')) : text) + ' ') : item.faded ? dim(text.trimEnd()) : item.finished ? text.replace(/finished$/, green('finished')) : text.trimEnd(),
    ];
  });
  return [
    titleBar(state, tabs.length > 1 ? 'Texts' : 'Contents', columns),
    '',
    ...tabRow,
    ...(play ? [` ${bold(play.title)}`, ''] : []),
    dim(line(' ', headings).trimEnd()),
    ...contentsMarks[0],
    ...rows,
    ...contentsMarks[1],
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    play
      ? keyRow([['up/down', 'choose'], ['enter', play.genre === 'greek' ? 'go to this chapter' : play.genre === 'latin' ? 'go to this section' : 'go to this scene'], ['esc', tab === 'foreign' ? 'all texts' : 'all plays'], ['c', 'close']], columns)
      : keyRow([['up/down', 'choose'], ['enter', tab === 'foreign' ? "this text's books and chapters" : "this play's acts and scenes"], ...(tabs.length > 1 ? [['[/]', 'tab'] as [string, string]] : []), ['esc', 'back']], columns),
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
  return text.replace(/[\p{L}\p{M}'\u2019\u02bc]+/gu, (token) => {
    const word = textToWords(token).join('');
    if (!word) return token;
    position++;
    return slotAt.get(position) === word ? bold(token) : token;
  });
}

/** The shop's note on the Word slots item when managers ask for more slots, e.g. "managers ask for 3 more"; '' when none do. */
function slotRequests(state: GameState): string {
  const wanted = departmentGenres(state).reduce((n, g) => n + slotsWanted(state, g), 0);
  return wanted > 0 ? `managers ask for ${wanted} more` : '';
}

/** Pinned lines for the home screen, with what each still needs: the player's pins and every manager's line, marked with its department. */
function pinnedText(state: GameState): string[] {
  const managed = departmentGenres(state).flatMap((g) => {
    const t = managerOf(state, g)?.target;
    return t ? [{ pin: t, genre: g }] : [];
  });
  const same = (a: Pin, b: Pin) => a.play === b.play && a.index === b.index;
  const pins = [...state.pinned, ...managed.map((m) => m.pin).filter((t) => !state.pinned.some((p) => same(p, t)))];
  const rows = pins.flatMap((p) => {
    const play = getPlay(p.play);
    const line = play?.lines[p.index];
    if (!play || !line) return [];
    const bosses = managed.filter((m) => same(m.pin, p)).map((m) => {
      const wanted = slotsWanted(state, m.genre);
      return `${departmentName(state, m.genre)} manager${wanted > 0 ? `, ${yellow(`wants ${wanted} more slot${wanted === 1 ? '' : 's'}`)}` : ''}`;
    });
    const by = bosses.length > 0 ? `   [${bosses.join(', ')}]` : '';
    return [`   @ ${play.title} ${lineLocation(line, play.genre)} "${slotHighlight(state, line.text, play.genre)}"   (${lineStatus(state, play, p.index)})${by}`];
  });
  return rows.length === 0 ? [] : ['', dim(' PINNED LINES'), ...rows];
}
