import { describe, expect, it } from 'vitest';
import { chooseFirstLetter, typeLetter } from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey } from '../src/game/state';

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

  it('gives an old save one Word per different word it has spelled', () => {
    const s = createInitialState(0);
    s.stats.words = { CAT: 3, DOG: 1 };
    const raw = JSON.parse(serialize(s));
    delete raw.state.words;
    expect(deserialize(JSON.stringify(raw)).words).toBe(2);
  });

  it('gives every monkey of an old save its shared typing level, with the typewriter it needs', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    const raw = JSON.parse(serialize(s));
    raw.state.typingLevel = 23;
    for (const m of raw.state.monkeys) {
      delete m.skill;
      delete m.typewriter;
    }
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.monkeys.map((m) => [m.skill, m.typewriter])).toEqual([[23, 2], [23, 2]]);
  });

  it('fills in missing fields', () => {
    const s = deserialize(JSON.stringify({ version: 3, state: { currency: 7, letters: ['I', 'bad'] } }), 5);
    expect(s.currency).toBe(7);
    expect(s.letters).toEqual(['I']);
    expect(s.monkeys).toEqual(createInitialState(5).monkeys);
    expect(s.lastSaved).toBe(5);
  });
});

describe('office space in saves', () => {
  it('keeps rooms, squares, furniture and options, and gives saves from before rooms an office', () => {
    const s = createInitialState(0);
    s.office.push({ id: 'r2', kind: 'break', department: '', cells: [[0, 0], [1, 0]] });
    s.squaresBought = 3;
    s.settings.autoPlaceFurniture = false;
    s.furniture.push({ kind: 'plant', room: 'r2', x: 0, y: 0 }, { kind: 'nonsense', room: 'r2', x: 1, y: 0 });
    const back = deserialize(serialize(s));
    expect(back.office).toEqual(s.office);
    expect(back.squaresBought).toBe(3);
    expect(back.settings.autoPlaceFurniture).toBe(false);
    expect(back.furniture).toEqual([{ kind: 'desk', room: 'r1', x: 0, y: 0 }, { kind: 'plant', room: 'r2', x: 0, y: 0 }]);
    const old = JSON.parse(serialize(s));
    delete old.state.office;
    delete old.state.settings;
    old.state.monkeys = Array.from({ length: 7 }, () => createMonkey());
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.office).toHaveLength(1);
    expect(loaded.furniture.filter((f) => f.kind === 'desk')).toHaveLength(7);
    expect(loaded.settings.autoPlaceFurniture).toBe(true);
  });
});
