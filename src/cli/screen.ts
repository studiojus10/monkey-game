import { letterValues, managers, maxPinnedLines, sonnetRewards, startingLetters, theme, typewriterKeys, wordSlots } from '../game/config';
import {
  availableKeys,
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
  heavierCost,
  keyCost,
  keysUnlocked,
  letterCost,
  monkeySpeed,
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
} from '../game/logic';
import { lineLocation, sceneName, type Genre, type Play } from '../game/plays';
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
export function renderScreen(state: GameState, message = '', shopOpen = false): string {
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
  const speed = monkeySpeed(state);
  const shown = state.monkeys.slice(0, maxMonkeyLines);
  // Pad names and multipliers so every monkey's text starts in the same column.
  // With more than one department, each monkey's line starts with its department's initial.
  const tag = (m: MonkeyState) => (departmentGenres(state).length > 1 ? `${genreNames[monkeyGenre(state, m)!][0]} ` : '');
  const labels = shown.map((m, i) => [`${tag(m)}${monkeyName(state, i)}(${speed.toFixed(2)}/s)`, `x${comboMultiplier(state, m)}`]);
  const nameWidth = Math.max(...labels.map(([n]) => n.length));
  const comboWidth = Math.max(...labels.map(([, c]) => c.length));
  lines.push(
    ...shown.map((m, i) => `${labels[i][0].padEnd(nameWidth)} ${labels[i][1].padEnd(comboWidth)}  ${m.manager ? managerLine(m) : renderLine(m)}`),
    ...(state.monkeys.length > maxMonkeyLines
      ? [`...and ${state.monkeys.length - maxMonkeyLines} more monkeys typing`]
      : []),
    '',
    `${bold(`${formatNumber(state.currency)} ${theme.currency}`)}   ${formatNumber(state.sentences)} Sentences   ` +
      `${formatNumber(state.lines)} Lines`,
    `Letters: ${state.letters.join(' ')}`,
    `Script: ${count(ownedScenes)} scene${ownedScenes === 1 ? '' : 's'} owned, ` +
      `${count(written)} / ${count(ownedLines)} lines written`,
    ...milestoneSummary(state),
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(state.lastWordPoints)}` : ''),
    ...lastLineText(state),
    ...lastMilestoneText(state),
    ...pinnedText(state),
    '',
    ...(shopOpen ? shopLines(state) : []),
    `[enter] ${theme.pokeAction}   [space] ${shopOpen ? 'close the shop   [1-6] buy (★ = affordable)' : 'open the shop'}   [p] script, pins & scenes   [t] stats   [w] dictionary   [n] name / [d] move / [m] promote a monkey   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}

/** The shop, shown while it is open. */
function shopLines(state: GameState): string[] {
  const speed = monkeySpeed(state);
  const nextSpeed = monkeySpeed(state, state.typingLevel + 1);
  const cost = typingUpgradeCost(state.typingLevel);
  const nextLetter = letterCost(state.letters.length);
  const nextMonkey = nextMonkeyCost(state);
  const nextCap = capRaiseCost(state.comboCapLevel);
  const mark = (have: number, price: number) => (have >= price ? '★' : ' ');
  return [
    'Shop',
    `  [1] ${mark(state.currency, cost)}Faster typing (level ${state.typingLevel}): ` +
      `${speed.toFixed(2)} -> ${nextSpeed.toFixed(2)} letters/sec   cost ${price(cost, state.currency)} ${theme.currency}`,
    ...(unownedLetters(state).length > 0
      ? [`  [2] ${mark(state.currency, nextLetter)}Buy a letter   cost ${price(nextLetter, state.currency)} ${theme.currency}`]
      : []),
    `  [3] ${mark(state.lines, nextMonkey)}Buy a monkey (you have ${state.monkeys.length})   ` +
      `cost ${price(nextMonkey, state.lines)} Lines`,
    `  [4] ${mark(state.sentences, nextCap)}Raise combo cap (x${comboCap(state)} -> x${comboCap(state) + 1})   ` +
      `cost ${price(nextCap, state.sentences)} Sentences`,
    keysUnlocked(state)
      ? `  [5]  Typewriter keys...`
      : `  [5]  Typewriter keys: unlock when you own ${typewriterKeys.unlockLetters} letters`,
    slotsUnlocked(state)
      ? `  [6]  Word slots... (${state.slots.filter((x) => x.on && x.word).length} active)`
      : `  [6]  Word slots: unlock when you own ${wordSlots.unlockLetters} letters`,
    `  [p]  Buy scenes, acts and plays in the script (${departmentGenres(state).map((g) => genreNames[g]).join(', ')})`,
    ...(state.unassignedMonkeys > 0
      ? [`  [a]  Assign ${state.unassignedMonkeys} new monkey${state.unassignedMonkeys === 1 ? '' : 's'} to a department`]
      : []),
    ...(managerChoices(state).length > 0
      ? [`  [u]  Upgrade a manager: +${managers.bonusPerLevel}x points for its whole department (costs Lines)`]
      : []),
    ...(departmentPicks(state) > 0
      ? [`  [g]  Open a new department!`]
      : nextDepartmentAt(state) > 0
        ? [`       Next department opens at ${nextDepartmentAt(state)} monkeys`]
        : []),
    '',
  ];
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
    ...(canBuy ? [`[b] ${state.lines >= next ? '★' : ' '}buy a slot   cost ${price(next, state.lines)} Lines`] : []),
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

/** The typewriter keys menu: heavier letters, then combination and word keys. */
export function renderKeysMenu(state: GameState, message = ''): string {
  const mark = (price: number) => (state.currency >= price ? '★' : ' ');
  const owned = state.keys.length > 0 ? state.keys.join(' ') : 'none yet';
  return [
    '=== Typewriter keys ===',
    '',
    bold(`${formatNumber(state.currency)} ${theme.currency}`),
    '',
    'Heavier keys: press a letter you own to make it come up more often.',
    '  ' +
      state.letters
        .map((l) => `${mark(heavierCost(state, l))}${l}${state.heavy[l] ? `+${state.heavy[l]}` : ''} ${price(heavierCost(state, l), state.currency)}`)
        .join('   '),
    '',
    'Combination and word keys: each types its whole text in one keystroke.',
    ...keyChoices(state).map((k, i) => {
      const kind = typewriterKeys.words.includes(k) ? 'word' : 'combination';
      return `  [${i + 1}] ${mark(keyCost(state, k))}${k} (${kind})   cost ${price(keyCost(state, k), state.currency)} ${theme.currency}`;
    }),
    ...(keyChoices(state).length === 0 ? ['  None available. Buy letters to unlock more.'] : []),
    `  Owned: ${owned}`,
    '',
    '[esc] back   (★ = affordable)',
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
          ? 'and a new monkey is waiting for a department ([a] to assign it)'
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
    n === 0 ? `${label}: owned` : `${label} ${state.currency >= n ? '★' : ''}${price(n, state.currency)} ${theme.currency}`;
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
          `[w] ${section('all the sonnets', sectionPrice(state, play))}   (★ = affordable)`
        : `Buy  [b] ${section('this scene', sectionPrice(state, play, sc.act, sc.key))}   ` +
          `[a] ${section(`Act ${sc.act}`, sectionPrice(state, play, sc.act))}   ` +
          `[w] ${section('whole play', sectionPrice(state, play))}   (★ = affordable)`,
    '[up/down] line   [left/right] scene   [pgup/pgdn] page   [tab] next play   [enter] pin/unpin',
    '[,/.] previous/next scene you own   [f] next shortest line within reach   [esc] back to the typewriters',
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
