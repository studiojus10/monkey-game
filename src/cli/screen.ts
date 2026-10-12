import { letterValues, startingLetters, theme, typewriterKeys } from '../game/config';
import {
  activePlay,
  availableKeys,
  availablePlays,
  capRaiseCost,
  comboCap,
  comboMultiplier,
  heavierCost,
  keyCost,
  keysUnlocked,
  letterCost,
  lettersPerSecond,
  monkeyCost,
  typingUpgradeCost,
} from '../game/logic';
import { lineLocation, type Play, type PlayLine } from '../game/plays';
import type { GameState, MonkeyState } from '../game/state';
import { formatNumber } from '../format';

/**
 * A monkey's current line: scored words in capitals, skipped letters in
 * lower case, then any letters still waiting to become a word and a cursor.
 * Uses ANSI bold, which every common terminal supports.
 */
export function renderLine(m: MonkeyState): string {
  const text = m.line.map((s) => (s.scored ? s.text : s.text.toLowerCase()));
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

/** The starter-play menu: keys 1-9 map to plays in this order. */
export function playChoices(): Play[] {
  return availablePlays().slice(0, 9);
}

/** Renders the whole game screen as plain text. */
export function renderScreen(state: GameState, message = ''): string {
  const lines = [`=== ${theme.title} ===`, ''];

  if (!state.play) {
    lines.push(
      'Somewhere, infinite monkeys are trying to write Shakespeare.',
      'Choose the starter play your monkeys will work toward:',
      '',
      ...playChoices().map((p, i) => `  [${i + 1}] ${p.title} (${count(p.lines.length)} lines)`),
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

  const play = activePlay(state);
  const done = state.completed[state.play]?.length ?? 0;
  const speed = lettersPerSecond(state.typingLevel);
  const nextSpeed = lettersPerSecond(state.typingLevel + 1);
  const cost = typingUpgradeCost(state.typingLevel);
  const nextLetter = letterCost(state.letters.length);
  const nextMonkey = monkeyCost(state.monkeys.length);
  const nextCap = capRaiseCost(state.comboCapLevel);
  const mark = (have: number, price: number) => (have >= price ? '*' : ' ');
  lines.push(
    ...state.monkeys
      .slice(0, maxMonkeyLines)
      .map((m, i) => `M-${i + 1}(${speed.toFixed(2)}/s) x${comboMultiplier(state, m)}  ${renderLine(m)}`),
    ...(state.monkeys.length > maxMonkeyLines
      ? [`...and ${state.monkeys.length - maxMonkeyLines} more monkeys typing`]
      : []),
    '',
    `${formatNumber(state.currency)} ${theme.currency}   ${formatNumber(state.sentences)} Sentences   ` +
      `${formatNumber(state.lines)} Lines`,
    `Letters: ${state.letters.join(' ')}`,
    play ? `${play.title}: ${count(done)} / ${count(play.lines.length)} lines written` : '',
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}` : ''),
    ...lastLineText(state),
    '',
    'Shop',
    `  [1] ${mark(state.currency, cost)}Faster typing (level ${state.typingLevel}): ` +
      `${speed.toFixed(2)} -> ${nextSpeed.toFixed(2)} letters/sec   cost ${formatNumber(cost)} ${theme.currency}`,
    ...(unownedLetters(state).length > 0
      ? [`  [2] ${mark(state.currency, nextLetter)}Buy a letter   cost ${formatNumber(nextLetter)} ${theme.currency}`]
      : []),
    `  [3] ${mark(state.lines, nextMonkey)}Buy a monkey (you have ${state.monkeys.length})   ` +
      `cost ${formatNumber(nextMonkey)} Lines`,
    `  [4] ${mark(state.sentences, nextCap)}Raise combo cap (x${comboCap(state)} -> x${comboCap(state) + 1})   ` +
      `cost ${formatNumber(nextCap)} Sentences`,
    keysUnlocked(state)
      ? `  [5]  Typewriter keys...`
      : `  [5]  Typewriter keys: unlock when you own ${typewriterKeys.unlockLetters} letters`,
    '',
    `[space] ${theme.pokeAction}   [1-5] buy (* = affordable)   [p] script   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}

/** Keys 1-9 in the typewriter keys menu buy these, in order. */
export function keyChoices(state: GameState): string[] {
  return availableKeys(state).slice(0, 9);
}

/** The typewriter keys menu: heavier letters, then combination and word keys. */
export function renderKeysMenu(state: GameState, message = ''): string {
  const mark = (price: number) => (state.currency >= price ? '*' : ' ');
  const owned = state.keys.length > 0 ? state.keys.join(' ') : 'none yet';
  return [
    '=== Typewriter keys ===',
    '',
    `${formatNumber(state.currency)} ${theme.currency}`,
    '',
    'Heavier keys: press a letter you own to make it come up more often.',
    '  ' +
      state.letters
        .map((l) => `${mark(heavierCost(state, l))}${l}${state.heavy[l] ? `+${state.heavy[l]}` : ''} ${formatNumber(heavierCost(state, l))}`)
        .join('   '),
    '',
    'Combination and word keys: each types its whole text in one keystroke.',
    ...keyChoices(state).map((k, i) => {
      const kind = typewriterKeys.words.includes(k) ? 'word' : 'combination';
      return `  [${i + 1}] ${mark(keyCost(state, k))}${k} (${kind})   cost ${formatNumber(keyCost(state, k))} ${theme.currency}`;
    }),
    ...(keyChoices(state).length === 0 ? ['  None available. Buy letters to unlock more.'] : []),
    `  Owned: ${owned}`,
    '',
    '[esc] back   (* = affordable)',
    '',
    message,
  ].join('\n');
}

function lastLineText(state: GameState): string[] {
  const l = state.lastLine;
  const line = l && availablePlays().find((p) => p.id === l.play)?.lines[l.index];
  if (!l || !line) return [];
  const rewards = [
    ...(l.firstTime ? [`+${formatNumber(l.points)} ${theme.currency}`, '+1 Line'] : ['already written']),
    ...(l.sentence ? ['+1 Sentence'] : []),
  ];
  return [`* A monkey wrote a line! "${line.text}" (${lineLocation(line)})  ${rewards.join(', ')}`];
}

/** How many lines the script view lists in each section. */
export const scriptListLength = 8;

/**
 * The script view: progress through the play, the latest lines written, and
 * the shortest unwritten lines you already own the letters for.
 */
export function renderScript(state: GameState): string {
  const play = activePlay(state);
  if (!play) return 'No play chosen yet.';
  const done = state.completed[play.id] ?? [];
  const owned = new Set(state.letters);
  const doneSet = new Set(done);
  const reachable = play.lines
    .map((line, i) => ({ line, i }))
    .filter(({ line, i }) => !doneSet.has(i) && [...line.letters].every((c) => owned.has(c)))
    .sort((a, b) => a.line.letters.length - b.line.letters.length)
    .slice(0, scriptListLength);
  const show = (line: PlayLine) =>
    `  ${lineLocation(line).padEnd(11)} ${(line.speaker || '').padEnd(14).slice(0, 14)} ${line.text}`;
  return [
    `=== ${play.title} ===`,
    '',
    `${count(done.length)} of ${count(play.lines.length)} lines written`,
    '',
    'Latest lines written',
    ...(done.length > 0
      ? done.slice(-scriptListLength).reverse().map((i) => show(play.lines[i]))
      : ['  None yet.']),
    '',
    'Shortest lines you have the letters for',
    ...(reachable.length > 0 ? reachable.map(({ line }) => show(line)) : ['  None yet. Buy more letters.']),
    '',
    '[p] back to the typewriters',
  ].join('\n');
}
