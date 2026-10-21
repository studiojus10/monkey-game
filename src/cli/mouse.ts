/**
 * Mouse support for the terminal: the terminal reports clicks and the
 * scroll wheel as escape sequences (SGR mouse mode), and a click turns into
 * the key press it points at, so every screen works with the mouse without
 * knowing about it. Pure functions; main.ts turns the mode on and feeds them.
 */
import { plainText } from './style';

/** Turns mouse reporting on (clicks, the wheel and movement, for hovering; SGR coordinates) or off. */
export const mouseOn = '\x1b[?1003h\x1b[?1006h';
export const mouseOff = '\x1b[?1006l\x1b[?1003l\x1b[?1000l';

export interface MouseEvent {
  kind: 'click' | 'rightClick' | 'wheelUp' | 'wheelDown' | 'move';
  row: number; // 1-based terminal row
  col: number; // 1-based terminal column
}

/** A key press as the game's key handler takes it. */
export interface Press {
  str: string | undefined;
  name: string | undefined;
}

const sgr = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** Splits terminal input into its mouse events and the rest (ordinary keys). Releases are dropped; drags count as moves. */
export function parseMouse(input: string): { events: MouseEvent[]; rest: string } {
  const events: MouseEvent[] = [];
  const rest = input.replace(sgr, (_, b: string, x: string, y: string, kind: string) => {
    const button = Number(b);
    const at = { row: Number(y), col: Number(x) };
    if (button & 32) events.push({ kind: 'move', ...at });
    else if (button === 64) events.push({ kind: 'wheelUp', ...at });
    else if (button === 65) events.push({ kind: 'wheelDown', ...at });
    else if (button === 0 && kind === 'M') events.push({ kind: 'click', ...at });
    else if (button === 2 && kind === 'M') events.push({ kind: 'rightClick', ...at });
    return '';
  });
  return { events, rest };
}

const navLabels = ['Home', 'Shop', 'Monkeys', 'Office', 'Texts', 'Records', 'Options', 'Roster', 'Inventory', 'Statistics', 'Achievements', 'Dictionary'];

/** What a key label on screen presses: [3] -> 3, [esc] -> escape. Labels for several keys ([1-9], [up/down]) press nothing. */
export function labelPress(label: string): Press | undefined {
  const named: Record<string, Press> = {
    esc: { str: '\x1b', name: 'escape' },
    enter: { str: '\r', name: 'return' },
    space: { str: ' ', name: 'space' },
    tab: { str: '\t', name: 'tab' },
    up: { str: undefined, name: 'up' },
    down: { str: undefined, name: 'down' },
    left: { str: undefined, name: 'left' },
    right: { str: undefined, name: 'right' },
  };
  if (named[label.toLowerCase()]) return named[label.toLowerCase()];
  // The navigation bar's pages and tabs ([Home], [Records], [Statistics], ...) press a key of their own.
  if (navLabels.includes(label)) return { str: undefined, name: `page:${label.toLowerCase()}` };
  if (label.length !== 1) return undefined;
  return { str: label, name: /[a-z0-9]/i.test(label) ? label.toLowerCase() : undefined };
}

/** A field the mouse can point at: the key it presses and where it is on its line (visible columns). */
export interface Target {
  press: Press;
  line: number; // index into the screen's lines
  from: number;
  to: number;
}

/**
 * What is under the mouse: a key label such as [b] (it presses that key), or
 * anywhere on a line whose only label is a key (a menu row: the whole line;
 * not the title bar on top, whose one key is its [?] button),
 * or with `letters` (the letter picker) a lone capital letter. `lines` are
 * the screen's lines as drawn, `top` the terminal row its first line is on.
 */
export function targetAt(lines: string[], top: number, row: number, col: number, letters = false): Target | undefined {
  const line = row - top;
  if (lines[line] === undefined) return undefined;
  const text = plainText(lines[line]);
  const at = col - 1;
  const labels = [...text.matchAll(/\[([^\]\s]+|\[|\])\]/g)].map((m) => ({ from: m.index!, to: m.index! + m[0].length, press: labelPress(m[1]) }));
  const hit = labels.find((l) => at >= l.from && at < l.to);
  if (hit) return hit.press ? { press: hit.press, line, from: hit.from, to: hit.to } : undefined;
  const keys = labels.filter((l) => l.press);
  if (keys.length === 1 && line > 0 && at < text.trimEnd().length) return { press: keys[0].press!, line, from: 0, to: text.trimEnd().length };
  if (letters && /[A-Z]/.test(text[at] ?? '') && !/[A-Za-z]/.test(text[at - 1] ?? '') && !/[A-Za-z]/.test(text[at + 1] ?? '')) {
    return { press: labelPress(text[at])!, line, from: at, to: at + 1 };
  }
  return undefined;
}

/**
 * The key a click presses: the field under it (targetAt), or anywhere else
 * enter, to advance (Justin, 2026-10-16: "make left click advance and right
 * click back"), when `advance` (a menu's cursor is showing, so there is
 * something to advance to).
 */
export function clickPress(lines: string[], top: number, row: number, col: number, letters = false, advance = true): Press | undefined {
  return targetAt(lines, top, row, col, letters)?.press ?? (advance && lines[row - top] !== undefined ? labelPress('enter') : undefined);
}

/** What a mouse event presses: a click as clickPress, a right click goes back (esc), the wheel moves up and down; moving presses nothing. */
export function mousePress(e: MouseEvent, lines: string[], top: number, letters = false, advance = true): Press | undefined {
  if (e.kind === 'rightClick') return labelPress('esc');
  if (e.kind === 'wheelUp') return labelPress('up');
  if (e.kind === 'wheelDown') return labelPress('down');
  if (e.kind === 'move') return undefined;
  return clickPress(lines, top, e.row, e.col, letters, advance);
}
