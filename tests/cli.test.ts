import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import { renderScreen, shopItems } from '../src/cli/screen';
import { load, save } from '../src/game/save';
import { createInitialState } from '../src/game/state';

describe('file storage', () => {
  it('saves and loads through a file, and clears it', () => {
    const storage = fileStorage(join(mkdtempSync(join(tmpdir(), 'idle-')), 'nested', 'save.json'));
    expect(storage.read()).toBeNull();
    const s = createInitialState(0);
    s.currency = 99;
    save(s, storage, 1000);
    expect(load(storage, 2000)).toEqual({ ...s, lastSaved: 1000 });
    storage.clear();
    expect(storage.read()).toBeNull();
  });
});

describe('terminal screen', () => {
  it('numbers generators then unbought upgrades', () => {
    const s = createInitialState(0);
    expect(shopItems(s).map((i) => `${i.key}:${i.id}`)).toEqual([
      '1:worker',
      '2:workshop',
      '3:better-tools',
      '4:efficiency',
    ]);
    s.upgrades.push('better-tools');
    expect(shopItems(s).map((i) => i.id)).not.toContain('better-tools');
  });

  it('shows currency, shop and controls', () => {
    const s = createInitialState(0);
    s.currency = 1234;
    const text = renderScreen(s, 'hello');
    expect(text).toContain('1.23K Coins');
    expect(text).toContain('[1] *Worker x0');
    expect(text).toContain('[q] quit');
    expect(text).toContain('hello');
  });
});
