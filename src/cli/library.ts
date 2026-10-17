import { library } from '../game/config';
import { bookTitle, galleryCost, libraryBonus, libraryGalleries, getPlay, unshelvedBooks } from '../game/logic';
import { sceneName } from '../game/plays';
import type { GameState } from '../game/state';
import { formatNumber } from '../format';
import { genreNames, wrapWords } from './screen';
import { bold, dim, green, inverseSpan, isCursor, keyRow, rule, titleBar } from './style';

/** One gallery as the honeycomb draws it: 10 wide, 5 tall; galleries side by side share a slanted wall. */
const hex = ['  ______  ', ' /      \\ ', '/        \\', '\\        /', ' \\______/ '];

/**
 * The Library (Justin, 2026-10-17): its galleries as a honeycomb, flat-topped
 * hexagons with every other column half a hexagon lower, then the books in
 * the gallery under the cursor.
 */
export function renderLibrary(state: GameState, cursor: number, message = '', columns = 0): string {
  const galleries = libraryGalleries(state);
  const at = Math.max(0, Math.min(cursor, galleries.length - 1));
  const across = Math.max(1, Math.min(8, Math.floor(((columns || 80) - 4) / 8)));
  const spot = (g: number) => ({ x: 1 + (g % across) * 8, y: Math.floor(g / across) * 4 + ((g % across) % 2) * 2 });
  const height = Math.max(...galleries.map((_, g) => spot(g).y)) + hex.length;
  const grid = Array.from({ length: height }, () => Array.from({ length: 2 + across * 8 + 2 }, () => ' '));
  const put = (x: number, y: number, s: string) => [...s].forEach((ch, k) => ch !== ' ' && (grid[y][x + k] = ch));
  galleries.forEach((books, g) => {
    const { x, y } = spot(g);
    hex.forEach((row, k) => put(x, y + k, row));
    const centre = (s: string) => s.padStart(Math.floor((8 + s.length) / 2)).padEnd(8);
    put(x + 1, y + 2, centre(`No. ${g + 1}`));
    put(x + 1, y + 3, centre(books.length >= library.booksPerGallery ? 'full' : `${books.length}/${library.booksPerGallery}`));
  });
  const lines = grid.map((r) => r.join('').trimEnd());
  if (isCursor(at, at)) {
    const { x, y } = spot(at);
    lines[y + 2] = inverseSpan(lines[y + 2].padEnd(x + 9), x + 1, x + 9);
  }
  const books = galleries[at] ?? [];
  const shelves = Array.from({ length: library.booksPerGallery }, (_, k) =>
    books[k] ? ` ${bold(`[${k + 1}]`)} ${bookTitle(books[k])}` : dim(`     an empty shelf`),
  );
  const bonus = libraryBonus(state);
  const waiting = unshelvedBooks(state);
  const cost = galleryCost(state);
  return [
    titleBar(state, library.name, columns),
    '',
    dim(' Every finished play and text, and every Folio, is shelved here. A full gallery adds to bananas.'),
    '',
    ...lines,
    '',
    ` ${bold(`Gallery ${at + 1}`)}   ${books.length} / ${library.booksPerGallery} books`,
    ...shelves,
    '',
    ` ${bonus > 0 ? green(`+${Math.round(bonus * 100)}% bananas`) : dim('No full gallery yet.')}${waiting > 0 ? `   ${waiting} book${waiting === 1 ? ' waits' : 's wait'} for a gallery.` : ''}`,
    ...(message ? ['', ` ${message}`] : []),
    rule(columns),
    keyRow(
      [
        ['arrows', 'gallery'],
        ...(books.length > 0 ? [[`1-${books.length}`, 'read'] as [string, string]] : []),
        ['b', `a new gallery ${state.lines >= cost ? green(`* ${formatNumber(cost)} Lines`) : `${formatNumber(cost)} Lines`}`],
        ['esc', 'back'],
      ],
      columns,
    ),
  ].join('\n');
}

/** Rows of a shelved book: a play's lines with their speakers, a foreign text in its English, a Folio's (placeholder) pages. */
export function bookRows(id: string, columns = 0): string[] {
  const width = Math.max(30, (columns > 0 ? Math.min(columns, 100) : 80) - 4);
  const play = getPlay(id);
  if (!play) return [dim(' Flumph the pages, wibbly and bound. Nothing on them yet but the smell of glue.')];
  const rows: string[] = [];
  play.lines.forEach((line, i) => {
    const prev = play.lines[i - 1];
    if (!prev || prev.act !== line.act || prev.scene !== line.scene) rows.push(...(rows.length > 0 ? [''] : []), ` ${dim(sceneName(line.act, line.scene, play.genre).toUpperCase())}`);
    const text = play.english[i] || line.text;
    const lead = line.speaker ? `${line.speaker}: ` : '';
    rows.push(...wrapWords(lead + text, width).map((r) => `  ${r}`));
  });
  return rows;
}

/** A shelved book open for reading, from row `top`, `height` rows at a time. */
export function renderBook(state: GameState, id: string, top: number, height: number, columns = 0): string {
  const rows = bookRows(id, columns);
  const from = Math.max(0, Math.min(top, rows.length - height));
  const play = getPlay(id);
  return [
    titleBar(state, library.name, columns),
    '',
    ` ${bold(bookTitle(id))}${play ? `   ${dim(genreNames[play.genre])}` : ''}`,
    '',
    ...rows.slice(from, from + height),
    rule(columns),
    keyRow([['up/down', 'scroll'], ['pgup/pgdn', 'page'], ['esc', 'back to the shelves']], columns),
  ].join('\n');
}
