import { achievements, theme } from '../game/config';
import { achievementValue, getPlay } from '../game/logic';
import { lineLocation } from '../game/plays';
import type { GameState } from '../game/state';
import { formatNumber } from '../format';

/** Rows of the dictionary page shown at once. */
export const dictionaryPageRows = 20;
/** Words per row on the dictionary page. */
export const dictionaryColumns = 4;

function duration(seconds: number): string {
  const s = Math.floor(seconds);
  const [d, h, m] = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s % 60}s` : `${s % 60}s`;
}

/** The statistics page: lifetime totals and records. */
export function renderStats(state: GameState): string {
  const st = state.stats;
  const letters = Object.entries(st.letters).sort(([a], [b]) => a.localeCompare(b));
  const lettersTyped = letters.reduce((n, [, c]) => n + c, 0);
  const words = Object.entries(st.words);
  const spelled = words.reduce((n, [, c]) => n + c, 0);
  const top = [...words].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, 10);
  const ll = st.longestLine;
  const play = ll && getPlay(ll.play);
  const line = ll && play?.lines[ll.index];
  const letterCells = letters.map(([l, c]) => `${l} ${formatNumber(c)}`.padEnd(12));
  return [
    '=== Statistics ===',
    '',
    `Time typing:        ${duration(st.secondsTyping)}`,
    `Letters typed:      ${formatNumber(lettersTyped)}`,
    `Words spelled:      ${formatNumber(spelled)} (${formatNumber(words.length)} different)`,
    `Longest word:       ${st.longestWord || '-'}${st.longestWord ? ` (${st.longestWord.length} letters)` : ''}`,
    `Best-paying word:   ${st.bestWord ? `${st.bestWord} +${formatNumber(st.bestWordPoints)} ${theme.currency}` : '-'}`,
    `Longest chain:      ${formatNumber(st.longestChain)} word${st.longestChain === 1 ? '' : 's'} in a row`,
    `Play lines typed:   ${formatNumber(st.linesTyped)} (repeats included)`,
    `Longest line:       ${line && play ? `"${line.text}" (${play.title} ${lineLocation(line, play.genre)}, ${line.letters.length} letters)` : '-'}`,
    `Best line payout:   ${st.bestLinePoints > 0 ? `+${formatNumber(st.bestLinePoints)} ${theme.currency}` : '-'}`,
    `Monkeys petted:     ${formatNumber(st.pets)} time${st.pets === 1 ? '' : 's'}`,
    '',
    'Letters typed',
    ...(letterCells.length > 0
      ? Array.from({ length: Math.ceil(letterCells.length / 6) }, (_, r) => '  ' + letterCells.slice(r * 6, r * 6 + 6).join('').trimEnd())
      : ['  none yet']),
    '',
    'Most spelled words',
    ...(top.length > 0 ? top.map(([w, c], i) => `  ${String(i + 1).padStart(2)}. ${w.padEnd(16)} x${formatNumber(c)}`) : ['  none yet']),
    '',
    '[w] dictionary   [a] achievements   [esc] back',
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

/** The dictionary page: every word spelled so far, alphabetically, with how often. */
export function renderDictionary(state: GameState, row: number): string {
  const words = dictionaryWords(state);
  const rows = Math.ceil(words.length / dictionaryColumns);
  const top = Math.max(0, Math.min(row, rows - dictionaryPageRows));
  const width = Math.max(14, ...words.map(([w, c]) => w.length + formatNumber(c).length + 4));
  const page = Array.from({ length: Math.min(dictionaryPageRows, rows - top) }, (_, r) =>
    words
      .slice((top + r) * dictionaryColumns, (top + r + 1) * dictionaryColumns)
      .map(([w, c]) => `${w} x${formatNumber(c)}`.padEnd(width))
      .join('')
      .trimEnd(),
  );
  const first = top * dictionaryColumns + 1;
  const last = Math.min(words.length, (top + dictionaryPageRows) * dictionaryColumns);
  return [
    `=== Dictionary ===   ${formatNumber(words.length)} word${words.length === 1 ? '' : 's'} spelled` +
      (words.length > 0 ? `   showing ${first}-${last}` : ''),
    '',
    ...(page.length > 0 ? page : ['No words yet. Your monkeys will fill this in.']),
    '',
    '[up/down] scroll   [a-z] jump to a letter   [t] statistics   [esc] back',
  ].join('\n');
}

/** Rows of the achievements page shown at once. */
export const achievementPageRows = 24;

/** A whole number: exact with commas up to a million, then short (1.00M). */
const measure = (n: number) => (n < 1e6 ? Math.floor(n).toLocaleString('en-US') : formatNumber(Math.floor(n)));

/**
 * The achievements page: every achievement, unlocked ones marked [x], with
 * progress toward counts; secret ones show as ??? until unlocked. Then the
 * milestones: scenes, acts and plays finished.
 */
export function renderAchievements(state: GameState, row: number): string {
  const nameWidth = Math.max(...achievements.map((a) => a.name.length)) + 2;
  const all = achievements.map((a) => {
    const done = state.achievements.includes(a.id);
    if (!done && a.secret) return `[ ] ${'???'.padEnd(nameWidth)}A secret`;
    const progress = !done && a.at > 2 ? `   (${measure(Math.min(a.at, achievementValue(state, a.stat)))} / ${measure(a.at)})` : '';
    return `[${done ? 'x' : ' '}] ${a.name.padEnd(nameWidth)}${a.text}${progress}`;
  });
  const top = Math.max(0, Math.min(row, all.length - achievementPageRows));
  const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
  const sonnet = (k: string) => getPlay(k.split(':')[0])?.genre === 'sonnet';
  return [
    '=== Achievements ===',
    '',
    `${state.achievements.length} of ${achievements.length} unlocked`,
    '',
    ...all.slice(top, top + achievementPageRows),
    ...(all.length > achievementPageRows ? [`(${top + 1}-${Math.min(all.length, top + achievementPageRows)} of ${all.length}: [up/down] scroll)`] : []),
    '',
    'Milestones',
    `  Scenes finished: ${formatNumber(state.scenesDone.filter((k) => !sonnet(k)).length)} (points +${Math.round(state.pointsBonus * 1000) / 10}% for good)`,
    `  Acts finished:   ${formatNumber(state.actsDone.length)} (typing +${Math.round(state.speedBonus * 1000) / 10}% for good)`,
    `  Plays finished:  ${formatNumber(state.playsDone.length)}`,
    `  Sonnets:         ${plural(state.scenesDone.filter(sonnet).length, 'sonnet')} finished`,
    '',
    '[t] stats   [w] dictionary   [esc] back',
  ].join('\n');
}
