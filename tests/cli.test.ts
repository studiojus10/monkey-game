import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import { letterPickPrompt, maxMonkeyLines, renderLine, renderScreen } from '../src/cli/screen';
import { chooseFirstLetter } from '../src/game/logic';
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

describe('terminal screen', () => {
  it('asks for the first letter before anything else', () => {
    const text = renderScreen(createInitialState(0));
    expect(text).toContain('[a] A    [i] I');
    expect(text).not.toContain('Points');
  });

  it('shows points, letters, the monkey line and controls', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.currency = 1234;
    s.wordsTyped = 3;
    s.lastWord = 'I';
    s.lastWordPoints = 1;
    s.monkeys[0].line = [{ text: 'I', scored: true }];
    const text = renderScreen(s, 'hello');
    expect(text).toContain('1.23K Points');
    expect(text).toContain('Letters: I');
    expect(text.split('\n')[2]).toBe('M-1(0.50/s) x1  \x1b[1mI\x1b[22m_');
    expect(text).toContain('Last word: I +1');
    expect(text).toContain('[1] *Faster typing (level 0): 0.50 -> 0.63 letters/sec   cost 10');
    expect(text).toContain('[2] *Buy a letter   cost 25');
    expect(text).toContain('[3]  Buy a monkey: unlocks when you own 13 letters');
    expect(text).toContain('[q] quit');
    expect(text).toContain('hello');
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
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys = Array.from({ length: maxMonkeyLines + 5 }, createMonkey);
    const text = renderScreen(s);
    expect(text).toContain(`M-${maxMonkeyLines}(`);
    expect(text).not.toContain(`M-${maxMonkeyLines + 1}(`);
    expect(text).toContain('...and 5 more monkeys typing');
  });
});
