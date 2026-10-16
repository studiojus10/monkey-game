import { describe, expect, it } from 'vitest';
import { buyRoom, chooseFirstLetter, typeLetter } from '../src/game/logic';
import { connectedRooms } from '../src/game/layout';
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

  it('keeps hats, their dye and the inventory; old wardrobes and accessory hats become hats', () => {
    const s = createInitialState(0);
    s.monkeys[0].hat = 'crown';
    s.monkeys[0].hatColor = 'cyan';
    s.stored.hats = { tophat: 1, 'cap:red': 2 };
    s.stats.dyes = 2;
    expect(deserialize(serialize(s))).toEqual(s);
    const raw = JSON.parse(serialize(s));
    raw.state.stored.hats['cap:plaid'] = 1; // no such dye
    raw.state.monkeys[0] = { ...raw.state.monkeys[0], hats: ['tophat', 'crown', 'halo'] }; // a wardrobe, from before the inventory
    const back = deserialize(JSON.stringify(raw));
    expect(back.stored.hats).toEqual({ tophat: 2, 'cap:red': 2, halo: 1 });
    raw.state.monkeys[0] = { ...raw.state.monkeys[0], hats: undefined, hat: undefined, hatColor: 'plaid', accessories: ['glasses', 'cap'] };
    const m = deserialize(JSON.stringify(raw)).monkeys[0];
    expect(m.hat).toBe('cap'); // glasses aren't a hat any more
    expect(m.hatColor).toBe('');
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
    expect(back.settings.lightBackground).toBe(false);
    expect(back.settings.homeDepartment).toBe('');
    expect(back.furniture).toEqual([{ kind: 'desk', room: 'r1', x: 0, y: 0 }, { kind: 'plant', room: 'r2', x: 0, y: 0 }]);
    const old = JSON.parse(serialize(s));
    delete old.state.office;
    delete old.state.settings;
    old.state.monkeys = Array.from({ length: 7 }, () => createMonkey());
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.office).toHaveLength(1);
    expect(loaded.furniture.filter((f) => f.kind === 'desk')).toHaveLength(7);
    expect(loaded.settings.autoPlaceFurniture).toBe(true);
    expect(loaded.settings.lightBackground).toBe(false);
    expect(loaded.settings.homeDepartment).toBe('');
  });

  it('keeps hallways, doors and per-department hiring, and lays out saves from before hallways', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break');
    s.monkeysBought = { comedy: 3 };
    s.folios = 2;
    s.folioPages = 1234;
    s.furniture[0].turned = true;
    const back = deserialize(serialize(s));
    expect(back.furniture[0].turned).toBe(true);
    expect(back.halls).toEqual(s.halls);
    expect(back.doors).toEqual(s.doors);
    expect(back.monkeysBought).toEqual({ comedy: 3 });
    expect([back.folios, back.folioPages]).toEqual([2, 1234]);
    const before = JSON.parse(serialize(s));
    delete before.state.folioBoost;
    expect(deserialize(JSON.stringify(before)).folioBoost).toBeCloseTo(1 + 1234 * 0.001); // a save from before Folios multiplied: all its pages in one
    const old = JSON.parse(serialize(s));
    delete old.state.halls;
    delete old.state.doors;
    old.state.office[1].cells = [[0, 0], [1, 0], [0, 1], [1, 1]]; // every room on its own grid, as before
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.office[1].cells.some(([x, y]) => x === 0 && y === 0)).toBe(false);
    expect(connectedRooms(loaded).has(loaded.office[1].id)).toBe(true);
  });
});

describe('combo upgrades in old saves', () => {
  it("turns an old save's combo cap raises into starting-combo upgrades", () => {
    const old = JSON.parse(serialize(createInitialState(0)));
    delete old.state.comboStartLevel;
    old.state.comboCapLevel = 3;
    expect(deserialize(JSON.stringify(old)).comboStartLevel).toBe(3);
  });
});
