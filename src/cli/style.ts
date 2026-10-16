/**
 * Terminal styling, with one job for each style so every screen reads the same:
 * inverse is where you are (a screen's title), bold is what's new or live (and
 * keys), dim is what you can skip (explanations, headings, what's not yours
 * yet), and green / yellow / red / blue mean good / getting low / needs you /
 * resting. Each currency has its own colour. All plain ANSI codes, which every
 * common terminal supports.
 */
import { theme, type FurnitureColor } from '../game/config';
import type { GameState } from '../game/state';
import { formatAmount } from '../format';

export const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
export const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
export const inverse = (s: string) => `\x1b[7m${s}\x1b[27m`;

let cursorsShown = true;

/**
 * Whether menus draw their cursor (inverse). The game hides it until the
 * arrow keys or the wheel are used (Justin, 2026-10-16); renderers draw it by
 * default, so tests see it.
 */
export function showCursors(on: boolean): void {
  cursorsShown = on;
}

/** Whether the cursor is on this row (`at` is the row, `cursor` the menu's cursor) and drawn. */
export function isCursor<T>(at: T, cursor: T): boolean {
  return cursorsShown && at === cursor;
}

/** Whether menu cursors are drawn at all. */
export const cursorsOn = () => cursorsShown;

/** `line` with its visible columns from..to (ANSI codes not counted) drawn inverse: what the mouse is over. */
export function inverseSpan(line: string, from: number, to: number): string {
  let out = '';
  let col = 0;
  for (let i = 0; i < line.length; ) {
    const code = /^\x1b\[[0-9;]*m/.exec(line.slice(i));
    if (code) {
      out += code[0];
      i += code[0].length;
      continue;
    }
    if (col === from) out += '\x1b[7m';
    out += line[i];
    i++;
    col++;
    if (col === to) out += '\x1b[27m';
  }
  return out;
}
const color = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[39m`;
export const red = color(31);
export const green = color(32);
export const yellow = color(33);
export const blue = color(34);
export const magenta = color(35);
export const cyan = color(36);
const brown = (s: string) => `\x1b[38;5;130m${s}\x1b[39m`;
const gray = color(90);

/** A furniture glyph in the colour of what the piece looks like (e.g. green plants, brown wood). */
export function furnitureColor(kind: FurnitureColor | undefined, s: string): string {
  return kind ? { brown, green, red, yellow, blue, cyan, magenta, gray }[kind](s) : s;
}

/**
 * A screen recoloured for a terminal with a light background: yellow, cyan
 * and green are too pale on white, so they become darker shades (256-colour
 * codes, which every common terminal supports). Everything else stays.
 */
export function forLightBackground(screen: string): string {
  const darker: Record<string, string> = { '32': '38;5;28', '33': '38;5;130', '36': '38;5;30' };
  return screen.replace(/\x1b\[(3[236])m/g, (_, code: string) => `\x1b[${darker[code]}m`);
}

/** Text without its ANSI codes. */
export const plainText = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Pads text with ANSI codes to a width, counting only what shows. */
export function padVisible(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  const room = Math.max(0, width - plainText(s).length);
  return align === 'left' ? s + ' '.repeat(room) : ' '.repeat(room) + s;
}

/** Each currency's colour, wherever its total or a price in it shows. */
export const currencyColors = { currency: yellow, words: cyan, sentences: magenta, lines: blue };

/**
 * The bar across the top of a screen: the game's name (and the screen's), then
 * every currency in its colour, in full up to 10 digits (1,234,567,890). On
 * a screen `columns` wide that can't fit it all, a screen other than home
 * shows just its own name, then the biggest totals switch to scientific
 * notation (1.23e9) until it fits.
 */
export function titleBar(state: GameState, screen = '', columns = 0): string {
  const amounts: [number, keyof typeof currencyColors, string][] = [
    [state.currency, 'currency', theme.currency],
    [state.words, 'words', 'Words'],
    [state.sentences, 'sentences', 'Sentences'],
    [state.lines, 'lines', 'Lines'],
  ];
  const short = new Set<number>(); // indexes of totals shown short
  const render = () => amounts.map(([n, c, label], i) => bold(currencyColors[c](`${short.has(i) ? n.toExponential(2).replace('e+', 'e') : formatAmount(n)} ${label}`))).join('   ');
  let totals = render();
  let name = ` ${theme.title.toUpperCase()}${screen ? ` > ${screen.toUpperCase()}` : ''} `;
  // The coin flip, on every screen's title bar: a button the mouse can click any time ([$] works on every screen too).
  let flip = '[$] flip';
  const fits = () => name.length + 4 + plainText(totals).length + (flip ? 3 + flip.length : 0) < columns;
  if (columns > 0 && !fits()) flip = '[$]';
  if (screen && columns > 0 && !fits()) name = ` ${screen.toUpperCase()} `;
  if (columns > 0 && !fits()) flip = ''; // too narrow: the button goes before the totals turn scientific
  const biggestFirst = amounts.map((_, i) => i).sort((a, b) => amounts[b][0] - amounts[a][0]);
  for (const i of biggestFirst) {
    if (columns <= 0 || fits()) break;
    short.add(i);
    totals = render();
  }
  return `${bold(inverse(name))}    ${totals}${flip ? `   ${bold(flip)}` : ''}`;
}

/**
 * A whole screen as written to a terminal `rows` tall: at the bottom (blank
 * lines above it, so it sits just over the prompt like other terminal output)
 * or, with `atTop`, from the top line down. A screen taller than the
 * terminal starts at the top either way.
 */
export function placeScreen(screen: string, rows: number, atTop: boolean): string {
  const lines = screen.split('\n').length;
  if (atTop || rows <= lines) return screen + '\n';
  return '\n'.repeat(rows - lines) + screen;
}

/** The terminal row (1-based) that placeScreen's first line lands on; below 1 when the top has scrolled away. */
export function screenTop(screen: string, rows: number, atTop: boolean): number {
  const lines = screen.split('\n').length;
  if (rows <= 0) return 1;
  if (rows <= lines) return rows - lines;
  return atTop ? 1 : rows - lines + 1;
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
