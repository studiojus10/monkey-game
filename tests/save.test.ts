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

  it('fills in missing fields', () => {
    const s = deserialize(JSON.stringify({ version: 2, state: { currency: 7, letters: ['I', 'bad'] } }), 5);
    expect(s.currency).toBe(7);
    expect(s.letters).toEqual(['I']);
    expect(s.monkeys).toEqual(createInitialState(5).monkeys);
    expect(s.lastSaved).toBe(5);
  });
});
