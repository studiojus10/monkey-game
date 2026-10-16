/**
 * Mouse support for the terminal: the terminal reports clicks and the
 * scroll wheel as escape sequences (SGR mouse mode), and a click turns into
 * the key press it points at, so every screen works with the mouse without
 * knowing about it. Pure functions; main.ts turns the mode on and feeds them.
 */
import { plainText } from './style';

/** Turns mouse reporting on (clicks and the wheel, SGR coordinates) or off. */
export const mouseOn = '\x1b[?1000h\x1b[?1006h';
export const mouseOff = '\x1b[?1006l\x1b[?1000l';

export interface MouseEvent {
  kind: 'click' | 'rightClick' | 'wheelUp' | 'wheelDown';
  row: number; // 1-based terminal row
  col: number; // 1-based terminal column
}

/** A key press as the game's key handler takes it. */
export interface Press {
  str: string | undefined;
  name: string | undefined;
}

const sgr = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** Splits terminal input into its mouse events and the rest (ordinary keys). Releases and drags are dropped. */
export function parseMouse(input: string): { events: MouseEvent[]; rest: string } {
  const events: MouseEvent[] = [];
  const rest = input.replace(sgr, (_, b: string, x: string, y: string, kind: string) => {
    const button = Number(b);
    const at = { row: Number(y), col: Number(x) };
    if (button === 64) events.push({ kind: 'wheelUp', ...at });
    else if (button === 65) events.push({ kind: 'wheelDown', ...at });
    else if (button === 0 && kind === 'M') events.push({ kind: 'click', ...at });
    else if (button === 2 && kind === 'M') events.push({ kind: 'rightClick', ...at });
    return '';
  });
  return { events, rest };
}

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
  if (label.length !== 1) return undefined;
  return { str: label, name: /[a-z0-9]/i.test(label) ? label.toLowerCase() : undefined };
}

/**
 * The key a click on the screen presses. `lines` are the screen's lines as
 * drawn, `top` the terminal row its first line is on. A click on a key label
 * such as [b] presses it; a click elsewhere on a line whose only label is a
 * key presses that one (a menu row); with `letters` (the letter picker), a
 * click on a lone letter types it. Anywhere else a click advances, like
 * enter (Justin, 2026-10-16: "make left click advance and right click back").
 */
export function clickPress(lines: string[], top: number, row: number, col: number, letters = false): Press | undefined {
  const line = lines[row - top];
  if (line === undefined) return undefined;
  const text = plainText(line);
  const at = col - 1;
  const labels = [...text.matchAll(/\[([^\]\s]+|\[|\])\]/g)].map((m) => ({ from: m.index!, to: m.index! + m[0].length, label: m[1] }));
  const hit = labels.find((l) => at >= l.from && at < l.to);
  if (hit) return labelPress(hit.label);
  const keys = labels.filter((l) => labelPress(l.label));
  if (keys.length === 1) return labelPress(keys[0].label);
  if (letters && /[A-Z]/.test(text[at] ?? '') && !/[A-Za-z]/.test(text[at - 1] ?? '') && !/[A-Za-z]/.test(text[at + 1] ?? '')) return labelPress(text[at]);
  return labelPress('enter');
}

/** What a mouse event presses: a click as clickPress, a right click goes back (esc), the wheel moves up and down. */
export function mousePress(e: MouseEvent, lines: string[], top: number, letters = false): Press | undefined {
  if (e.kind === 'rightClick') return labelPress('esc');
  if (e.kind === 'wheelUp') return labelPress('up');
  if (e.kind === 'wheelDown') return labelPress('down');
  return clickPress(lines, top, e.row, e.col, letters);
}
