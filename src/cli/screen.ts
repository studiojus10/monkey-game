import { letterValues, startingLetters, theme } from '../game/config';
import { letterCost, lettersPerSecond, monkeyCost, typingUpgradeCost } from '../game/logic';
import { wordPoints } from '../game/words';
import type { GameState, MonkeyState } from '../game/state';
import { formatNumber } from '../format';

/**
 * A monkey's current line: scored words in capitals, skipped letters in
 * lower case, then any letters still waiting to become a word and a cursor.
 */
export function renderLine(m: MonkeyState): string {
  return m.line.map((s) => (s.scored ? s.text : s.text.toLowerCase())).join('') + m.pending + '_';
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
  const nextLetter = letterCost(state.letters.length);
  const nextMonkey = monkeyCost(state.monkeys.length);
  const mark = (price: number) => (state.currency >= price ? '*' : ' ');
  lines.push(
    ...state.monkeys
      .slice(0, maxMonkeyLines)
      .map((m, i) => `M-${i + 1}(${speed.toFixed(2)}/s)  ${renderLine(m)}`),
    ...(state.monkeys.length > maxMonkeyLines
      ? [`...and ${state.monkeys.length - maxMonkeyLines} more monkeys typing`]
      : []),
    '',
    `${formatNumber(state.currency)} ${theme.currency}`,
    `Letters: ${state.letters.join(' ')}`,
    '',
    `Words typed: ${formatNumber(state.wordsTyped)}` +
      (state.lastWord ? `   Last word: ${state.lastWord} +${formatNumber(wordPoints(state.lastWord))}` : ''),
    '',
    'Shop',
    `  [1] ${mark(cost)}Faster typing (level ${state.typingLevel}): ` +
      `${speed.toFixed(2)} -> ${nextSpeed.toFixed(2)} letters/sec   cost ${formatNumber(cost)}`,
    ...(unownedLetters(state).length > 0
      ? [`  [2] ${mark(nextLetter)}Buy a letter   cost ${formatNumber(nextLetter)}`]
      : []),
    `  [3] ${mark(nextMonkey)}Buy a monkey (you have ${state.monkeys.length})   cost ${formatNumber(nextMonkey)}`,
    '',
    `[space] ${theme.pokeAction}   [1-3] buy (* = affordable)   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}
