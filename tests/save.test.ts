import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState } from '../src/game/state';

describe('save/load', () => {
  it('round-trips state', () => {
    const s = createInitialState(123);
    s.currency = 42;
    s.generators.worker = 3;
    s.upgrades.push('better-tools');
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('falls back to a fresh state on missing or corrupt saves', () => {
    expect(deserialize(null, 5)).toEqual(createInitialState(5));
    expect(deserialize('not json', 5)).toEqual(createInitialState(5));
  });

  it('fills in missing fields', () => {
    const s = deserialize(JSON.stringify({ version: 1, state: { currency: 7 } }), 5);
    expect(s.currency).toBe(7);
    expect(s.generators).toEqual({});
    expect(s.lastSaved).toBe(5);
  });
});
