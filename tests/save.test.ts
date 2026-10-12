import { describe, expect, it } from 'vitest';
import { chooseFirstLetter, typeLetter } from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState } from '../src/game/state';

describe('save/load', () => {
  it('round-trips state', () => {
    const s = createInitialState(123);
    chooseFirstLetter(s, 'i');
    typeLetter(s, 0, () => 0);
    s.monkeys[0].progress = 0.5;
    s.monkeys[0].name = 'Bubbles';
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('falls back to a fresh state on missing or corrupt saves', () => {
    expect(deserialize(null, 5)).toEqual(createInitialState(5));
    expect(deserialize('not json', 5)).toEqual(createInitialState(5));
  });

  it('starts fresh from a save of the old placeholder game', () => {
    const old = JSON.stringify({ version: 1, state: { currency: 500, generators: { worker: 3 } } });
    expect(deserialize(old, 5)).toEqual(createInitialState(5));
  });

  it('loads a version 2 save as owning its whole play, with pins kept', () => {
    const old = JSON.stringify({ version: 2, state: { currency: 7, play: 'hamlet', pinned: [3, 9], letters: ['I'] } });
    const s = deserialize(old, 5);
    expect(s.owned).toEqual(['hamlet']);
    expect(s.pinned).toEqual([
      { play: 'hamlet', index: 3 },
      { play: 'hamlet', index: 9 },
    ]);
    expect(s.currency).toBe(7);
  });

  it('fills in missing fields', () => {
    const s = deserialize(JSON.stringify({ version: 3, state: { currency: 7, letters: ['I', 'bad'] } }), 5);
    expect(s.currency).toBe(7);
    expect(s.letters).toEqual(['I']);
    expect(s.monkeys).toEqual(createInitialState(5).monkeys);
    expect(s.lastSaved).toBe(5);
  });
});
