import { startingLetters, theme } from '../game/config';
import { lettersPerSecond, typingUpgradeCost } from '../game/logic';
import { wordPoints } from '../game/words';
import type { GameState, MonkeyState } from '../game/state';
import { formatNumber } from '../format';

/**
 * A monkey's current line: scored words in capitals, skipped letters in
 * lower case, then any letters still waiting to become a word and a cursor.
 */
export function renderLine(m: MonkeyState): string {
  const parts = m.line.map((s) => (s.scored ? s.text : s.text.toLowerCase()));
  return [...parts, m.pending + '_'].join(' ');
}

/** Renders the whole game screen as plain text. */
export function renderScreen(state: GameState, message = ''): string {
  const lines = [`=== ${theme.title} ===`, ''];

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

  const speed = lettersPerSecond(state.typingLevel);
  const nextSpeed = lettersPerSecond(state.typingLevel + 1);
  const cost = typingUpgradeCost(state.typingLevel);
  lines.push(
    ...state.monkeys.map((m, i) => `M-${i + 1}(${speed.toFixed(2)}/s)  ${renderLine(m)}`),
    '',
    `${formatNumber(state.currency)} ${theme.currency}`,
    `Letters: ${state.letters.join(' ')}`,
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(wordPoints(state.lastWord))}` : ''),
    '',
    'Shop',
    `  [1] ${state.currency >= cost ? '*' : ' '}Faster typing (level ${state.typingLevel}): ` +
      `${speed.toFixed(2)} -> ${nextSpeed.toFixed(2)} letters/sec   cost ${formatNumber(cost)}`,
    '',
    `[space] ${theme.pokeAction}   [1] buy (* = affordable)   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}
