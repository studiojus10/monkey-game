import { describe, expect, it } from 'vitest';
import { clickPress, mousePress, parseMouse } from '../src/cli/mouse';
import { bold, inverse, screenTop } from '../src/cli/style';

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
