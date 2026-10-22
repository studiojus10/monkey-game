import { describe, expect, it } from 'vitest';
import { clickPress, mousePress, parseMouse, targetAt } from '../src/cli/mouse';
import { bold, inverse, inverseSpan, isCursor, plainText, screenTop, showCursors } from '../src/cli/style';
import { renderOptions } from '../src/cli/screen';
import { createInitialState } from '../src/game/state';

describe('mouse', () => {
  it('takes clicks, right clicks and the wheel out of the input, leaving the keys', () => {
    const { events, rest } = parseMouse('a\x1b[<0;5;3M\x1b[<0;5;3mb\x1b[<2;1;1M\x1b[<64;1;1M\x1b[<65;1;1M');
    expect(rest).toBe('ab');
    expect(events.map((e) => e.kind)).toEqual(['click', 'rightClick', 'wheelUp', 'wheelDown']);
    expect(events[0]).toMatchObject({ row: 3, col: 5 });
  });

  it('presses the key label clicked, a menu row its key, and otherwise advances', () => {
    const lines = ['TITLE', ` ${bold('[b]')} buy   ${bold('[esc]')} back   [1-9] buy`, inverse(' [2] Faster typing   10 Bananas'), 'nothing here'];
    expect(clickPress(lines, 1, 2, 3)).toEqual({ str: 'b', name: 'b' }); // on [b]
    expect(clickPress(lines, 1, 2, 15)).toMatchObject({ name: 'escape' }); // on [esc]
    expect(clickPress(lines, 1, 2, 9)).toMatchObject({ name: 'return' }); // between labels: advance
    expect(clickPress(lines, 1, 3, 20)).toEqual({ str: '2', name: '2' }); // anywhere on a menu row
    expect(clickPress(lines, 1, 4, 3)).toMatchObject({ name: 'return' });
    expect(clickPress(lines, 10, 4, 3)).toBeUndefined(); // above the screen
    expect(clickPress([' A  B  c'], 1, 1, 2, true)).toEqual({ str: 'A', name: 'a' }); // the letter picker
    expect(mousePress({ kind: 'rightClick', row: 1, col: 1 }, lines, 1)).toMatchObject({ name: 'escape' });
    expect(mousePress({ kind: 'wheelDown', row: 1, col: 1 }, lines, 1)).toMatchObject({ name: 'down' });
  });

  it('knows which terminal row the screen starts on', () => {
    expect(screenTop('a\nb', 10, true)).toBe(1);
    expect(screenTop('a\nb', 10, false)).toBe(9);
    expect(screenTop('a\nb\nc', 2, false)).toBe(-1); // taller than the terminal: the top scrolled away
  });
});

describe('hover and hidden cursors', () => {
  const lines = ['TITLE', ` ${bold('[b]')} buy   ${bold('[esc]')} back`, ' [2] Faster typing   10 Bananas   ', 'plain'];

  it('finds the field under the mouse: a key label, or a whole menu row', () => {
    expect(targetAt(lines, 1, 2, 3)).toMatchObject({ line: 1, from: 1, to: 4 });
    expect(targetAt(lines, 1, 3, 10)).toMatchObject({ line: 2, from: 0, to: 31 });
    expect(targetAt(lines, 1, 4, 2)).toBeUndefined();
    expect(targetAt(lines, 1, 3, 40)).toBeUndefined(); // past the end of the row
    const bar = [' SHOP    10 Bananas   [?] flip'];
    expect(targetAt(bar, 1, 1, 3)).toBeUndefined(); // the title bar is no menu row: only its [?] button
    expect(targetAt(bar, 1, 1, 23)?.press.str).toBe('?');
    const lit = inverseSpan(lines[1], 1, 4);
    expect(plainText(lit)).toBe(plainText(lines[1]));
    expect(lit).toContain('\x1b[1m\x1b[48;5;236m[b]\x1b[49m');
  });

  it('only advances on a click elsewhere when a cursor is showing; moving presses nothing', () => {
    expect(clickPress(lines, 1, 4, 2, false, false)).toBeUndefined();
    expect(clickPress(lines, 1, 4, 2, false, true)).toMatchObject({ name: 'return' });
    expect(parseMouse('\x1b[<35;4;2M').events[0].kind).toBe('move');
    expect(mousePress({ kind: 'move', row: 2, col: 3 }, lines, 1)).toBeUndefined();
  });

  it('hides menu cursors until they are switched on', () => {
    showCursors(false);
    expect(isCursor(1, 1)).toBe(false);
    expect(renderOptions(createInitialState(0), 0, 1)).not.toContain('\x1b[48;5;236m');
    showCursors(true);
    expect(isCursor(1, 1)).toBe(true);
    expect(renderOptions(createInitialState(0), 0, 1)).toContain('\x1b[48;5;236m');
  });
});
