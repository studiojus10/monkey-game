import { achievements, theme } from '../game/config';
import { achievementValue, folioMultiplier, getPlay } from '../game/logic';
import { lineLocation } from '../game/plays';
import type { GameState } from '../game/state';
import { formatNumber } from '../format';
import { dim, green, keyRow, rule, titleBar } from './style';

/** Rows of the dictionary page shown at once. */
export const dictionaryPageRows = 20;
/** Words per row on the dictionary page. */
export const dictionaryColumns = 4;

function duration(seconds: number): string {
  const s = Math.floor(seconds);
  const [d, h, m] = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s % 60}s` : `${s % 60}s`;
}

/** Words in rows at most `width` long. */
function wrapWords(words: string[], width: number): string[] {
  const rows: string[] = [];
  for (const w of words) {
    const last = rows.length - 1;
    if (last >= 0 && rows[last].length + 1 + w.length <= width) rows[last] += ` ${w}`;
    else rows.push(w);
  }
  return rows;
}

/**
 * The statistics page: lifetime totals and records under dim headings
 * (typing, plays, monkeys, and Folios once one is published), then every
 * letter by how often it was typed and the most spelled words.
 */
export function renderStats(state: GameState, columns = 0): string {
  const st = state.stats;
  const letters = Object.entries(st.letters).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  const lettersTyped = letters.reduce((n, [, c]) => n + c, 0);
  const words = Object.entries(st.words);
  const spelled = words.reduce((n, [, c]) => n + c, 0);
  const top = [...words].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, 10);
  const ll = st.longestLine;
  const play = ll && getPlay(ll.play);
  const line = ll && play?.lines[ll.index];
  const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
  const sonnet = (k: string) => getPlay(k.split(':')[0])?.genre === 'sonnet';
  const labelWidth = 18;
  const stat = (label: string, value: string, note = '') => `   ${label.padEnd(labelWidth)} ${value}${note ? `   ${dim(note)}` : ''}`;
  const section = (title: string, rows: string[]) => ['', dim(` ${title}`), ...rows];
  // The longest sentence's words wrap under its count, lined up with the values.
  const sentenceRows = wrapWords(st.longestSentence, Math.max(20, (columns > 0 ? Math.min(columns, 100) : 80) - 4 - labelWidth - 2)).map((r) => ' '.repeat(4 + labelWidth) + r);
  const letterCells = letters.map(([l, c]) => `${l} ${formatNumber(c)}`.padEnd(12));
  const half = Math.ceil(top.length / 2);
  const wordWidth = Math.max(4, ...top.map(([w]) => w.length));
  const topCell = (k: number) => {
    const [w, c] = top[k];
    return `${String(k + 1).padStart(2)}. ${w.padEnd(wordWidth)}  ${formatNumber(c).padStart(7)}`;
  };
  return [
    titleBar(state, 'Stats', columns),
    ...section('TYPING', [
      stat('Time typing', duration(st.secondsTyping)),
      stat('Letters typed', formatNumber(lettersTyped)),
      stat('Words spelled', formatNumber(spelled), `${formatNumber(words.length)} different`),
      stat('Longest word', st.longestWord || '-', st.longestWord ? plural(st.longestWord.length, 'letter') : ''),
      stat('Best-paying word', st.bestWord || '-', st.bestWord ? `+${formatNumber(st.bestWordPoints)} ${theme.currency}` : ''),
      stat('Longest chain', `${plural(st.longestChain, 'word')} in a row`),
      stat('Sentences written', formatNumber(st.sentencesWritten), `${plural(st.chainSentences, 'Sentence')} earned`),
      stat('Longest sentence', st.longestSentence.length > 0 ? plural(st.longestSentence.length, 'word') : '-'),
      ...sentenceRows,
    ]),
    ...section('PLAYS', [
      stat('Lines typed', formatNumber(st.linesTyped), 'repeats included'),
      stat('Longest line', line ? `"${line.text}"` : '-', line && play ? `${play.title} ${lineLocation(line, play.genre)}, ${plural(line.letters.length, 'letter')}` : ''),
      stat('Best line payout', st.bestLinePoints > 0 ? `+${formatNumber(st.bestLinePoints)} ${theme.currency}` : '-'),
      stat('Scenes finished', formatNumber(state.scenesDone.filter((k) => !sonnet(k)).length), `bananas +${Math.round(state.pointsBonus * 1000) / 10}% for good`),
      stat('Acts finished', formatNumber(state.actsDone.length), `typing +${Math.round(state.speedBonus * 1000) / 10}% for good`),
      stat('Plays finished', formatNumber(state.playsDone.length)),
      stat('Sonnets finished', formatNumber(state.scenesDone.filter(sonnet).length)),
    ]),
    ...section('MONKEYS', [stat('Petted', plural(st.pets, 'time'))]),
    // Folios only once there is one.
    ...(state.folios > 0
      ? section('FOLIOS', [
          stat('Published', formatNumber(state.folios)),
          stat('Pages', formatNumber(state.folioPages), `bananas x${folioMultiplier(state).toFixed(2)} for good`),
        ])
      : []),
    ...section('LETTERS TYPED', [
      ...(letterCells.length > 0
        ? Array.from({ length: Math.ceil(letterCells.length / 6) }, (_, r) => '   ' + letterCells.slice(r * 6, r * 6 + 6).join('').trimEnd())
        : ['   none yet']),
    ]),
    ...section('MOST SPELLED', [
      ...(top.length > 0
        ? Array.from({ length: half }, (_, r) => `   ${topCell(r)}${r + half < top.length ? `      ${topCell(r + half)}` : ''}`)
        : ['   none yet']),
    ]),
    '',
    rule(columns),
    keyRow([['w', 'dictionary'], ['a', 'achievements'], ['esc', 'back']], columns),
  ].join('\n');
}

/** Every word ever spelled, A to Z. */
export function dictionaryWords(state: GameState): [string, number][] {
  return Object.entries(state.stats.words).sort(([a], [b]) => a.localeCompare(b));
}

/** First row (of dictionaryColumns words) whose words start at `letter` or later. */
export function dictionaryRowFor(state: GameState, letter: string): number {
  const words = dictionaryWords(state);
  const i = words.findIndex(([w]) => w >= letter.toUpperCase());
  return Math.floor((i < 0 ? Math.max(0, words.length - 1) : i) / dictionaryColumns);
}

/** The dictionary page: every word spelled so far, alphabetically, with how often (dim). */
export function renderDictionary(state: GameState, row: number, columns = 0): string {
  const words = dictionaryWords(state);
  const rows = Math.ceil(words.length / dictionaryColumns);
  const top = Math.max(0, Math.min(row, rows - dictionaryPageRows));
  const width = Math.max(14, ...words.map(([w, c]) => w.length + formatNumber(c).length + 4));
  const page = Array.from({ length: Math.min(dictionaryPageRows, rows - top) }, (_, r) =>
    ' ' +
    words
      .slice((top + r) * dictionaryColumns, (top + r + 1) * dictionaryColumns)
      .map(([w, c], k, all) => `${w} ${dim(formatNumber(c))}` + (k < all.length - 1 ? ' '.repeat(width - w.length - 1 - formatNumber(c).length) : ''))
      .join(''),
  );
  const first = top * dictionaryColumns + 1;
  const last = Math.min(words.length, (top + dictionaryPageRows) * dictionaryColumns);
  return [
    titleBar(state, 'Dictionary', columns),
    '',
    ` ${formatNumber(words.length)} word${words.length === 1 ? '' : 's'} spelled` +
      (words.length > 0 ? dim(`   showing ${first}-${last}, times spelled after each`) : ''),
    '',
    ...(page.length > 0 ? page : [dim(' No words yet. Your monkeys will fill this in.')]),
    '',
    rule(columns),
    keyRow([['up/down', 'scroll'], ['a-z', 'jump to a letter'], ['t', 'stats'], ['esc', 'back']], columns),
  ].join('\n');
}

/** Rows of the achievements page shown at once. */
export const achievementPageRows = 24;

/** A whole number: exact with commas up to a million, then short (1.00M). */
const measure = (n: number) => (n < 1e6 ? Math.floor(n).toLocaleString('en-US') : formatNumber(Math.floor(n)));

/**
 * The achievements page: every achievement, unlocked ones with a green [x],
 * locked ones dim with progress toward counts; secret ones show as ??? until
 * unlocked. (Milestones are on the statistics page.)
 */
export function renderAchievements(state: GameState, row: number, columns = 0): string {
  const nameWidth = Math.max(...achievements.map((a) => a.name.length)) + 2;
  const all = achievements.map((a) => {
    const done = state.achievements.includes(a.id);
    if (done) return ` ${green('[x]')} ${a.name.padEnd(nameWidth)}${dim(a.text)}`;
    if (a.secret) return dim(` [ ] ${'???'.padEnd(nameWidth)}A secret`);
    const progress = a.at > 2 ? `   ${measure(Math.min(a.at, achievementValue(state, a.stat)))} / ${measure(a.at)}` : '';
    return dim(` [ ] ${a.name.padEnd(nameWidth)}${a.text}`) + progress;
  });
  const top = Math.max(0, Math.min(row, all.length - achievementPageRows));
  const pages = all.length > achievementPageRows;
  return [
    titleBar(state, 'Achievements', columns),
    '',
    ` ${state.achievements.length} of ${achievements.length} unlocked`,
    '',
    ...all.slice(top, top + achievementPageRows),
    ...(pages ? [dim(` ${top + 1}-${Math.min(all.length, top + achievementPageRows)} of ${all.length}`)] : []),
    '',
    rule(columns),
    keyRow([...(pages ? [['up/down', 'scroll'] as [string, string]] : []), ['t', 'stats'], ['w', 'dictionary'], ['esc', 'back']], columns),
  ].join('\n');
}
