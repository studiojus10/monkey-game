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
import { flipChance } from '../game/logic';

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

/** The shade behind a highlighted row or the field under the mouse (Justin, 2026-10-22: "instead of fully inverting it just shades the area", so a row keeps its colours, green for something you can buy). */
const shadeOn = '\x1b[48;5;236m';

/** Keeps the shade on through codes inside the text that clear the background. */
const keepShade = (s: string) => s.replace(/\x1b\[([0-9;]*)m/g, (code, params: string) => (params === '' || params.split(';').some((p) => p === '0' || p === '49') ? code + shadeOn : code));

/** A highlighted row (a menu's cursor): shaded, keeping its own colours. */
export function highlight(s: string): string {
  return `${shadeOn}${keepShade(s)}\x1b[49m`;
}

/** `line` with its visible columns from..to (ANSI codes not counted) shaded the same way: what the mouse is over. */
export function inverseSpan(line: string, from: number, to: number): string {
  let out = '';
  let col = 0;
  let lit = false;
  for (let i = 0; i < line.length; ) {
    const code = /^\x1b\[[0-9;]*m/.exec(line.slice(i));
    if (code) {
      out += lit ? keepShade(code[0]) : code[0];
      i += code[0].length;
      continue;
    }
    if (col === from) {
      out += shadeOn;
      lit = true;
    }
    out += line[i];
    i++;
    col++;
    if (col === to) {
      out += '\x1b[49m';
      lit = false;
    }
  }
  return out;
}

const color = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[39m`;

/** Something you can buy, green from end to end (Justin, 2026-10-18: "the entire button highlights green"): any colours inside it give way; bold stays. */
export const affordable = (s: string) => `\x1b[32m${s.replace(/\x1b\[(3\d|39)m/g, '')}\x1b[39m`;
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
  return screen.replace(/\x1b\[(3[236])m/g, (_, code: string) => `\x1b[${darker[code]}m`).replaceAll(shadeOn, '\x1b[48;5;255m');
}

/** A room's label on the office map (Justin, 2026-10-21: the letters "blend into the map"): bold white on blue, unlike any wall or furniture. */
export const roomTag = (s: string) => `\x1b[1;97;44m${s}\x1b[22;39;49m`;

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
  // The coin flip, on every screen's title bar: a button the mouse can click any time ([?] works on every screen too).
  // Justin, 2026-10-21: "coin flip", with its chance on the home screen.
  let flip = screen === 'Home' ? `[?] coin flip ${(flipChance(state) * 100).toFixed(1)}%` : '[?] coin flip';
  // The menu button (Justin, 2026-10-21): [tab] opens the popup of every page, from any screen.
  let menu = '[tab] menu';
  let gap = 4; // spaces after the name
  const fits = () => name.length + gap + plainText(totals).length + (flip ? 3 + flip.length : 0) + (menu ? 3 + menu.length : 0) < columns;
  // Too wide: shorter labels first, keeping the coin flip's chance longest.
  if (columns > 0 && !fits()) menu = '[tab]';
  if (screen && columns > 0 && !fits()) name = ` ${screen.toUpperCase()} `;
  if (columns > 0 && !fits()) flip = '[?] coin flip';
  if (columns > 0 && !fits()) flip = '[?]';
  if (columns > 0 && !fits()) flip = ''; // too narrow: the button goes before the totals turn scientific
  if (!screen && columns > 0 && !fits()) name = ' MONKEYS ';
  const biggestFirst = amounts.map((_, i) => i).sort((a, b) => amounts[b][0] - amounts[a][0]);
  for (const i of biggestFirst) {
    if (columns <= 0 || fits() || amounts[i][0] < 1e5) break;
    short.add(i);
    totals = render();
  }
  if (columns > 0 && !fits()) gap = 2;
  if (columns > 0 && !fits()) menu = ''; // tab still opens it
  return `${bold(inverse(name))}${' '.repeat(gap)}${totals}${menu ? `   ${bold(menu)}` : ''}${flip ? `   ${bold(flip)}` : ''}`;
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

/**
 * A screen `height` lines tall, whatever is showing (Justin, 2026-10-21:
 * "retain the height of the game so the lines in the game do not move up
 * and down when changing menus"): blank lines go in above its keys (the last
 * rule), so the title stays on top and the keys (or a popup over the
 * bottom) at the bottom.
 */
export function fillHeight(screen: string, height: number): string {
  const lines = screen.split('\n');
  const missing = height - lines.length;
  if (missing <= 0) return screen;
  // Above a popup over the bottom (coverBottom's border), else above the keys.
  const border = lines.findIndex((l, i) => i > 0 && /^ ={20,}$/.test(plainText(l)));
  let at = border > 0 ? border : lines.length;
  for (let i = lines.length - 1; border < 0 && i > 0; i--) {
    if (/^ -{20,}$/.test(plainText(lines[i]))) {
      at = i;
      break;
    }
  }
  lines.splice(at, 0, ...Array<string>(missing).fill(''));
  return lines.join('\n');
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
export function keyRow(keys: ([string, string] | [string, string, boolean])[], columns = 0): string {
  const rows: string[][] = [[]];
  let width = 0;
  for (const [k, what, buyable] of keys) {
    const item = `[${k}] ${what}`;
    const row = rows[rows.length - 1];
    if (columns > 0 && row.length > 0 && width + 3 + item.length >= columns) {
      rows.push([]);
      width = 0;
    }
    width += (rows[rows.length - 1].length > 0 ? 3 : 1) + item.length;
    const shown = `${bold(`[${k}]`)} ${what}`;
    rows[rows.length - 1].push(buyable ? affordable(shown) : shown);
  }
  return rows.map((r) => ' ' + r.join('   ')).join('\n');
}

/**
 * A screen's short key row (Justin, 2026-10-21: the menus were "a mess"):
 * only its main keys, then [/] for the full list in a popup (see keyBox).
 */
export function shortKeyRow(keys: [string, string][], main: string[], columns = 0, more = 'all keys'): string {
  const shown = keys.filter(([k]) => main.includes(k));
  return keyRow(shown.length < keys.length ? [...shown, ['/', more]] : shown, columns);
}

/**
 * A popup over the bottom of a screen (Justin, 2026-10-21: the shop should
 * "open like a popup and cover the bottom of the screen" instead of moving
 * what's on it): the screen keeps its height and `panel`, under a border,
 * takes its last lines. A panel taller than the screen keeps just the title bar above it.
 */
export function coverBottom(screen: string, panel: string, columns = 0): string {
  const lines = screen.split('\n');
  const box = [bold(' ' + '='.repeat(Math.max(20, Math.min(columns > 0 ? columns - 2 : 90, 90)))), ...panel.split('\n')];
  return [...lines.slice(0, Math.max(1, lines.length - box.length)), ...box].join('\n');
}

/** A dim line across the screen, between a screen's content and its keys. */
export function rule(columns = 0): string {
  return dim(' ' + '-'.repeat(Math.max(20, Math.min(columns > 0 ? columns - 2 : 90, 90))));
}

/**
 * A scrolling list's marks (Justin, 2026-10-18: "an obvious indicator that
 * the menu can be scrolled to show more"): a line before it for what's above,
 * and one after for what's below. A list that fits shows neither; one that
 * scrolls always has both lines (blank at an end) so the screen doesn't jump.
 */
export function scrollMarks(above: number, below: number, what = 'more'): [string[], string[]] {
  if (above <= 0 && below <= 0) return [[], []];
  return [[above > 0 ? ` ${bold('^')} ${above.toLocaleString('en-US')} ${what} above` : ''], [below > 0 ? ` ${bold('v')} ${below.toLocaleString('en-US')} ${what} below` : '']];
}
