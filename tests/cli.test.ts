import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import { renderLine, renderScreen } from '../src/cli/screen';
import { chooseFirstLetter } from '../src/game/logic';
import { load, save } from '../src/game/save';
import { createInitialState } from '../src/game/state';

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
    s.monkeys[0].line = [{ text: 'I', scored: true }];
    const text = renderScreen(s, 'hello');
    expect(text).toContain('1.23K Points');
    expect(text).toContain('Letters: I');
    expect(text).toContain('  1  I _');
    expect(text).toContain('Last word: I +1');
    expect(text).toContain('[1] *Faster typing (level 0): 0.50 -> 0.63 letters/sec   cost 10');
    expect(text).toContain('[q] quit');
    expect(text).toContain('hello');
  });

  it('shows skipped letters in lower case and pending letters before the cursor', () => {
    const line = renderLine({
      pending: 'IT',
      line: [
        { text: 'CAT', scored: true },
        { text: 'X', scored: false },
      ],
      progress: 0,
    });
    expect(line).toBe('CAT x IT_');
  });
});
