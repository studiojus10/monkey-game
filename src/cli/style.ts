/**
 * Terminal styling, with one job for each style so every screen reads the same:
 * inverse is where you are (a screen's title), bold is what's new or live (and
 * keys), dim is what you can skip (explanations, headings, what's not yours
 * yet), and green / yellow / red / blue mean good / getting low / needs you /
 * resting. Each currency has its own colour. All plain ANSI codes, which every
 * common terminal supports.
 */
import { theme } from '../game/config';
import type { GameState } from '../game/state';
import { formatNumber } from '../format';

export const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
export const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
export const inverse = (s: string) => `\x1b[7m${s}\x1b[27m`;
const color = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[39m`;
export const red = color(31);
export const green = color(32);
export const yellow = color(33);
export const blue = color(34);
export const magenta = color(35);
export const cyan = color(36);

/** Text without its ANSI codes. */
export const plainText = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Pads text with ANSI codes to a width, counting only what shows. */
export function padVisible(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  const room = Math.max(0, width - plainText(s).length);
  return align === 'left' ? s + ' '.repeat(room) : ' '.repeat(room) + s;
}

/** Each currency's colour, wherever its total or a price in it shows. */
export const currencyColors = { currency: yellow, words: cyan, sentences: magenta, lines: blue };

/** The bar across the top of a screen: the game's name (and the screen's), then every currency in its colour. */
export function titleBar(state: GameState, screen = ''): string {
  const name = ` ${theme.title.toUpperCase()}${screen ? ` > ${screen.toUpperCase()}` : ''} `;
  const totals = [
    currencyColors.currency(`${formatNumber(state.currency)} ${theme.currency}`),
    currencyColors.words(`${formatNumber(state.words)} Words`),
    currencyColors.sentences(`${formatNumber(state.sentences)} Sentences`),
    currencyColors.lines(`${formatNumber(state.lines)} Lines`),
  ].map(bold);
  return `${bold(inverse(name))}    ${totals.join('   ')}`;
}

/**
 * A row of keys and what they do: [key] in bold, then its words. On a screen
 * `columns` wide it breaks between keys rather than letting the terminal cut one.
 */
export function keyRow(keys: [string, string][], columns = 0): string {
  const rows: string[][] = [[]];
  let width = 0;
  for (const [k, what] of keys) {
    const item = `[${k}] ${what}`;
    const row = rows[rows.length - 1];
    if (columns > 0 && row.length > 0 && width + 3 + item.length >= columns) {
      rows.push([]);
      width = 0;
    }
    width += (rows[rows.length - 1].length > 0 ? 3 : 1) + item.length;
    rows[rows.length - 1].push(`${bold(`[${k}]`)} ${what}`);
  }
  return rows.map((r) => ' ' + r.join('   ')).join('\n');
}

/** A dim line across the screen, between a screen's content and its keys. */
export function rule(columns = 0): string {
  return dim(' ' + '-'.repeat(Math.max(20, Math.min(columns > 0 ? columns - 2 : 90, 90))));
}
