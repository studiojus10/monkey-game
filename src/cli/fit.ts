import { coverBottom, fillUnderList, spreadHeight, wrapAnsi } from './style';

/** The fewest rows a scrolling list shrinks to in a small window. */
export const minListRows = 5;

/**
 * A page whose list is as long as fits in `height` lines (the fill-terminal
 * design: lists grow into a tall window and shrink in a small one). `render`
 * draws the page with its list `rows` long; `base` is the list's default.
 * The page is drawn at `base`, the list given the difference, then trimmed
 * while it's still too tall (headings inside a list can make it grow faster
 * than one line a row), never below `floor`. With no height it's drawn at `base`.
 */
export function fitRows(render: (rows: number) => string, base: number, height: number, floor = minListRows): { screen: string; rows: number } {
  const lines = (s: string) => s.split('\n').length;
  if (height <= 0) return { screen: render(base), rows: base };
  let n = Math.max(floor, base + height - lines(render(base)));
  let screen = render(n);
  while (lines(screen) > height && n > floor) {
    n = Math.max(floor, n - Math.max(1, lines(screen) - height));
    screen = render(n);
  }
  return { screen, rows: n };
}

/** A screen with each line wider than `columns` wrapped at the end of a word, as the terminal front end draws it; 0 columns: unchanged. */
export function wrapScreen(screen: string, columns: number): string {
  return screen
    .split('\n')
    .flatMap((l) => wrapAnsi(l, columns))
    .join('\n');
}

/** What fitPage needs besides the page itself. */
export type PageFit = {
  /** The list's default rows, when the window's height isn't known. */
  base: number;
  /** How many items the list has in all. */
  total: number;
  /** The page's height (the game's, less its tabs row); 0 when the terminal doesn't say. */
  height: number;
  columns?: number;
  /** The message to show on the page. */
  message?: string;
  floor?: number;
  /** A popup over the bottom of the page (the script's shop). */
  panel?: string;
};

/**
 * A page with a scrolling list as the terminal draws it: its list fitted to
 * the height, wrapped to the screen, then brought to the height, so nothing
 * on it moves (Justin's rule) as its cursor moves or a message shows:
 * - With no message, a blank one (' ', not '', which spreadHeight would take
 *   for a gap) keeps its line, so a message showing adds no lines.
 * - A list that scrolls can be a line shorter or longer at one cursor than at
 *   the next (headings, rows that wrap), so its page's spare lines go right
 *   under the list (fillUnderList): the title, the list's first line, what's
 *   under the list and the keys stay put. A list that fits whole is spread.
 * - A `panel` (the script's shop) goes over the bottom of the page as it is
 *   without it and with no message (the message shows in the panel).
 * `scrolls` says which way the page was (or, with no height, should be) padded.
 */
export function fitPage(render: (rows: number, message: string) => string, { base, total, height, columns = 0, message = '', floor = minListRows, panel = '' }: PageFit): { screen: string; rows: number; scrolls: boolean } {
  const slot = (panel ? '' : message) || ' ';
  const fitted = fitRows((n) => wrapScreen(render(n, slot), columns), base, height, floor);
  const scrolls = total > fitted.rows;
  const page = height > 0 ? (scrolls ? fillUnderList : spreadHeight)(fitted.screen, height) : fitted.screen;
  return { screen: panel ? coverBottom(page, wrapScreen(panel, columns), columns) : page, rows: fitted.rows, scrolls };
}
