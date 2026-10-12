import { letterValues, maxPinnedLines, milestones, startingLetters, theme, typewriterKeys, wordSlots } from '../game/config';
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
  monkeySpeed,
  nextMonkeyCost,
  nextPlayChoices,
  pointsMultiplier,
  sceneProgress,
  speedMultiplier,
  missingLetters,
  slotCost,
  slotsUnlocked,
  monkeyName,
  typingUpgradeCost,
} from '../game/logic';
import { lineLocation, type Play } from '../game/plays';
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
  const speed = monkeySpeed(state);
  const nextSpeed = monkeySpeed(state, state.typingLevel + 1);
  const cost = typingUpgradeCost(state.typingLevel);
  const nextLetter = letterCost(state.letters.length);
  const nextMonkey = nextMonkeyCost(state);
  const nextCap = capRaiseCost(state.comboCapLevel);
  const mark = (have: number, price: number) => (have >= price ? '*' : ' ');
  const shown = state.monkeys.slice(0, maxMonkeyLines);
  // Pad names and multipliers so every monkey's text starts in the same column.
  const labels = shown.map((m, i) => [`${monkeyName(state, i)}(${speed.toFixed(2)}/s)`, `x${comboMultiplier(state, m)}`]);
  const nameWidth = Math.max(...labels.map(([n]) => n.length));
  const comboWidth = Math.max(...labels.map(([, c]) => c.length));
  lines.push(
    ...shown.map((m, i) => `${labels[i][0].padEnd(nameWidth)} ${labels[i][1].padEnd(comboWidth)}  ${renderLine(m)}`),
    ...(state.monkeys.length > maxMonkeyLines
      ? [`...and ${state.monkeys.length - maxMonkeyLines} more monkeys typing`]
      : []),
    '',
    `${formatNumber(state.currency)} ${theme.currency}   ${formatNumber(state.sentences)} Sentences   ` +
      `${formatNumber(state.lines)} Lines`,
    `Letters: ${state.letters.join(' ')}`,
    play ? `${play.title}: ${count(done)} / ${count(play.lines.length)} lines written` : '',
    ...milestoneSummary(state),
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}` : ''),
    ...lastLineText(state),
    ...lastMilestoneText(state),
    ...pinnedText(state),
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
    slotsUnlocked(state)
      ? `  [6]  Word slots... (${state.slots.filter((x) => x.on && x.word).length} active)`
      : `  [6]  Word slots: unlock when you own ${wordSlots.unlockLetters} letters`,
    ...(nextPlayChoices(state).length > 0 ? [`  [c]  Choose your next play`] : []),
    '',
    `[space] ${theme.pokeAction}   [1-6] buy (* = affordable)   [p] script & pins   [n] name a monkey   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
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
export function renderSlotsMenu(state: GameState, selected: number, typing: string | null, message = ''): string {
  const next = slotCost(state.slots.length);
  const canBuy = state.slots.length < wordSlots.maxSlots;
  const rows = [...state.slots.entries()]
    .sort(([, a], [, b]) => a.position - b.position)
    .map(([i, x]) => {
      const word = i === selected && typing !== null ? `${typing}_` : x.word || '(no word)';
      return `${i === selected ? '>' : ' '} [${i + 1}] ${ordinal(x.position).padEnd(4)} word: ${word.padEnd(16)} ${x.on ? 'ON' : 'off'}`;
    });
  return [
    '=== Word slots ===',
    '',
    `${formatNumber(state.lines)} Lines`,
    'Each slot makes the word at its position in a chain always the word you choose,',
    'e.g. 3rd word: FRIEND. Switch slots off for fully random typing.',
    '',
    ...(rows.length > 0 ? rows : ['  No slots yet.']),
    '',
    ...(canBuy ? [`[b] ${state.lines >= next ? '*' : ' '}buy a slot   cost ${formatNumber(next)} Lines`] : []),
    typing !== null
      ? 'Type the word, [enter] to set it, [esc] to cancel'
      : '[1-9] select   [w] set word   [o] on/off   [left/right] move position   [esc] back',
    '',
    message,
  ].join('\n');
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

/** Permanent bonuses from finished scenes and acts, once there are any. */
function milestoneSummary(state: GameState): string[] {
  if (state.scenesDone.length === 0) return [];
  const scenes = `${state.scenesDone.length} scene${state.scenesDone.length === 1 ? '' : 's'} finished ` +
    `(x${pointsMultiplier(state).toFixed(1)} points)`;
  const acts = state.actsDone.length === 0 ? '' :
    `   ${state.actsDone.length} act${state.actsDone.length === 1 ? '' : 's'} finished (x${speedMultiplier(state).toFixed(2)} speed)`;
  return [scenes + acts];
}

function lastMilestoneText(state: GameState): string[] {
  const ms = state.lastMilestone;
  const play = ms && availablePlays().find((p) => p.id === ms.play);
  if (!ms || !play) return [];
  if (ms.kind === 'scene') {
    const where = ms.scene === 0 ? `Act ${ms.act} prologue` : `Act ${ms.act}, scene ${ms.scene}`;
    return [`* ${where} of ${play.title} finished! Points +${Math.round(milestones.scenePointsBonus * 100)}% for good, ` +
      `+${count(ms.sentences)} Sentences`];
  }
  if (ms.kind === 'act') {
    return [`* Act ${ms.act} of ${play.title} finished! Typing x${milestones.actSpeedMultiplier} for good, ` +
      `and a new monkey joined ([n] to name it)`];
  }
  return [`* ${play.title} is finished!` + (nextPlayChoices(state).length > 0 ? ' Press [c] to choose your next play.' : '')];
}

/** The next-play prompt: keys 1-9 map to these plays. */
export function nextPlayPrompt(state: GameState): string {
  const choices = nextPlayChoices(state).slice(0, 9).map((p, i) => `[${i + 1}] ${p.title} (${count(p.lines.length)} lines)`);
  return `Choose your next play: ${choices.join('   ')}   (any other key cancels)`;
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

/** How many play lines the script browser shows at once. */
export const scriptPageSize = 15;

function lineStatus(state: GameState, index: number, letters: string): string {
  if (state.completed[state.play]?.includes(index)) return 'written';
  const missing = missingLetters(state, letters);
  return missing.length > 0 ? `needs ${missing.join(' ')}` : 'within reach';
}

/**
 * The script browser: a page of the play around the cursor, with scene
 * headings, marks for written (+) and pinned (@) lines, and what each needs.
 */
export function renderScript(state: GameState, cursor: number, message = ''): string {
  const play = activePlay(state);
  if (!play) return 'No play chosen yet.';
  const done = state.completed[play.id] ?? [];
  const at = Math.max(0, Math.min(cursor, play.lines.length - 1));
  const first = Math.max(0, Math.min(at - Math.floor(scriptPageSize / 2), play.lines.length - scriptPageSize));
  const rows: string[] = [];
  for (let i = first; i < Math.min(first + scriptPageSize, play.lines.length); i++) {
    const line = play.lines[i];
    const prev = play.lines[i - 1];
    if (i === first || prev.act !== line.act || prev.scene !== line.scene) {
      const [written, total] = sceneProgress(state, play, line.act, line.scene);
      const name = line.scene === 0 ? `Act ${line.act}, prologue` : `Act ${line.act}, scene ${line.scene}`;
      rows.push(`  -- ${name} (${count(written)}/${count(total)} written${written === total ? ', finished' : ''}) --`);
    }
    const marks = (i === at ? '>' : ' ') + (done.includes(i) ? '+' : ' ') + (state.pinned.includes(i) ? '@' : ' ');
    const status = done.includes(i) ? '' : `   (${lineStatus(state, i, line.letters)})`;
    rows.push(`${marks} ${(line.speaker || '').padEnd(14).slice(0, 14)} ${slotHighlight(state, line.text)}${status}`);
  }
  return [
    `=== ${play.title} ===   ${count(done.length)} of ${count(play.lines.length)} lines written   ` +
      `line ${count(at + 1)}`,
    '',
    ...rows,
    '',
    `+ written   @ pinned (${state.pinned.length}/${maxPinnedLines})`,
    '[up/down] line   [left/right] scene   [pgup/pgdn] page   [enter] pin/unpin',
    '[f] next shortest line within reach   [esc] back to the typewriters',
    '',
    message,
  ].join('\n');
}

/**
 * Bolds each word of a line that an active word slot will type at that
 * position, e.g. slot "3rd word: NAME" bolds "name" in "Hello my name is Hamlet".
 */
export function slotHighlight(state: GameState, text: string): string {
  const slotAt = new Map(state.slots.filter((x) => x.on && x.word).map((x) => [x.position, x.word]));
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
  const play = activePlay(state);
  if (!play || state.pinned.length === 0) return [];
  return [
    '',
    'Pinned lines',
    ...state.pinned.map((i) => {
      const line = play.lines[i];
      return `  @ ${lineLocation(line)} "${slotHighlight(state, line.text)}"   (${lineStatus(state, i, line.letters)})`;
    }),
  ];
}
