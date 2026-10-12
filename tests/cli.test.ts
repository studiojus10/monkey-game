import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import { letterPickPrompt, maxMonkeyLines, renderLine, renderScreen, renderScript } from '../src/cli/screen';
import { chooseFirstLetter, chooseStarterPlay, setPlays } from '../src/game/logic';
import { load, save } from '../src/game/save';
import { createInitialState, createMonkey } from '../src/game/state';

describe('file storage', () => {
  it('saves and loads through a file, and clears it', () => {
    const storage = fileStorage(join(mkdtempSync(join(tmpdir(), 'idle-')), 'nested', 'save.json'));
    expect(storage.read()).toBeNull();
    const s = createInitialState(0);
    chooseFirstLetter(s, 'a');
    s.currency = 99;
    save(s, storage, 1000);
    expect(load(storage, 2000)).toEqual({ ...s, lastSaved: 1000 });
    storage.clear();
    expect(storage.read()).toBeNull();
  });
});

const testPlay = {
  id: 'test',
  title: 'Test Play',
  lines: [
    [1, 1, 'HAMLET', 'I.'],
    [1, 2, 'POLONIUS', 'Ay, my lord.'],
  ] as [number, number, string, string][],
};

/** A state past the opening choices: the test play and the letter I. */
function started() {
  setPlays([testPlay]);
  const s = createInitialState(0);
  chooseStarterPlay(s, 'test');
  chooseFirstLetter(s, 'i');
  return s;
}

describe('terminal screen', () => {
  it('asks for a starter play first, then the first letter', () => {
    setPlays([testPlay]);
    const s = createInitialState(0);
    expect(renderScreen(s)).toContain('[1] Test Play (2 lines)');
    chooseStarterPlay(s, 'test');
    const text = renderScreen(s);
    expect(text).toContain('[a] A    [i] I');
    expect(text).not.toContain('Points');
  });

  it('shows points, letters, the monkey line and controls', () => {
    const s = started();
    s.currency = 1234;
    s.wordsTyped = 3;
    s.lastWord = 'I';
    s.lastWordPoints = 1;
    s.monkeys[0].line = [{ text: 'I', scored: true }];
    const text = renderScreen(s, 'hello');
    expect(text).toContain('1.23K Points   0 Sentences   0 Lines');
    expect(text).toContain('Letters: I');
    expect(text).toContain('Test Play: 0 / 2 lines written');
    expect(text.split('\n')[2]).toBe('M-1(0.50/s) x1  \x1b[1mI\x1b[22m_');
    expect(text).toContain('Last word: I +1');
    expect(text).toContain('[1] *Faster typing (level 0): 0.50 -> 0.63 letters/sec   cost 10 Points');
    expect(text).toContain('[2] *Buy a letter   cost 25 Points');
    expect(text).toContain('[3]  Buy a monkey (you have 1)   cost 10 Lines');
    expect(text).toContain('[4]  Raise combo cap (x3 -> x4)   cost 1 Sentences');
    expect(text).toContain('[q] quit');
    expect(text).toContain('hello');
  });

  it('celebrates the last line a monkey wrote', () => {
    const s = started();
    s.lastLine = { play: 'test', index: 1, firstTime: true, points: 396, sentence: true };
    expect(renderScreen(s)).toContain('A monkey wrote a line! "Ay, my lord." (1.2)  +396 Points, +1 Line, +1 Sentence');
  });

  it('shows skipped letters in lower case and pending letters before the cursor', () => {
    const line = renderLine({
      ...createMonkey(),
      pending: 'IT',
      line: [
        { text: 'CAT', scored: true },
        { text: 'X', scored: false },
      ],
    });
    expect(line).toBe('CATx\x1b[1mIT\x1b[22m_');
  });

  it('keeps the current run of words bold until a letter breaks it', () => {
    const seg = (text: string, scored = true) => ({ text, scored });
    const line = (segs: { text: string; scored: boolean }[], pending = '') =>
      renderLine({ ...createMonkey(), pending, line: segs });
    expect(line([seg('X', false), seg('CAT'), seg('ZAP')])).toBe('x\x1b[1mCATZAP\x1b[22m_');
    expect(line([seg('CAT'), seg('X', false)])).toBe('CAT\x1b[1mx\x1b[22m_');
    expect(line([seg('CAT'), seg('X', false)], 'Z')).toBe('CATx\x1b[1mZ\x1b[22m_');
    expect(line([])).toBe('_');
  });
});

describe('letter picking', () => {
  it('lists the letters you can still buy with their values', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'a');
    const prompt = letterPickPrompt(s);
    expect(prompt).not.toContain('A(1)');
    expect(prompt).toContain('B(3)');
    expect(prompt).toContain('Z(10)');
  });
});

describe('many monkeys', () => {
  it('shows the first few lines and sums up the rest', () => {
    const s = started();
    s.monkeys = Array.from({ length: maxMonkeyLines + 5 }, createMonkey);
    const text = renderScreen(s);
    expect(text).toContain(`M-${maxMonkeyLines}(`);
    expect(text).not.toContain(`M-${maxMonkeyLines + 1}(`);
    expect(text).toContain('...and 5 more monkeys typing');
  });
});

describe('script view', () => {
  it('shows progress, written lines and the shortest lines within reach', () => {
    const s = started();
    let text = renderScript(s);
    expect(text).toContain('0 of 2 lines written');
    expect(text).toContain('1.1         HAMLET         I.');
    expect(text).not.toContain('Ay, my lord.'); // needs letters you don't own
    s.completed.test = [0];
    s.letters.push('A', 'Y', 'M', 'L', 'O', 'R', 'D');
    text = renderScript(s);
    expect(text).toContain('1 of 2 lines written');
    expect(text.indexOf('I.')).toBeLessThan(text.indexOf('Shortest'));
    expect(text).toContain('POLONIUS       Ay, my lord.');
  });
});
