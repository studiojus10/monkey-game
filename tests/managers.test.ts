import { describe, expect, it } from 'vitest';
import { managerDesk, managers, traits } from '../src/game/config';
import {
  buyFurniture,
  buyRoom,
  deskOf,
  departmentRoom,
  giveTraits,
  hidesManagerBook,
  hireManager,
  managerBlocker,
  managerCost,
  managerOf,
  monkeySpeed,
  officeOf,
  officelessDepartments,
  pointsMultiplier,
  readManagerBook,
  roomDesks,
  setHour,
  tick,
  traitBonus,
  traitMood,
} from '../src/game/logic';
import { doorBetween, loungeOf } from '../src/game/layout';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey, type GameState } from '../src/game/state';

/** One comedy department with `typists` typing monkeys, each at its desk, and plenty of bananas. */
function department(typists: number): GameState {
  const s = createInitialState(0);
  s.letters = ['I'];
  s.departments = ['comedy'];
  s.monkeys[0].department = 'comedy';
  const room = departmentRoom(s, 'comedy')!;
  room.cells.push([0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]);
  while (s.monkeys.length < typists) {
    s.monkeys.push({ ...createMonkey(), department: 'comedy' });
    const [x, y] = room.cells.find(([cx, cy]) => !s.furniture.some((f) => f.room === room.id && f.x === cx && f.y === cy))!;
    s.furniture.push({ kind: 'desk', room: room.id, x, y });
  }
  s.currency = 1e15;
  return s;
}

describe("managers' offices", () => {
  it('are bought for a department with a room, beside it with a door between, with a manager\'s desk', () => {
    const s = department(1);
    expect(officelessDepartments(s)).toEqual(['comedy']);
    expect(buyRoom(s, 'office')).toBe(false); // which department's?
    expect(buyRoom(s, 'office', 'comedy')).toBe(true);
    const office = officeOf(s, 'comedy')!;
    expect(office.kind).toBe('office');
    expect(doorBetween(s, office, departmentRoom(s, 'comedy')!)).toBe(true);
    expect(s.furniture.filter((f) => f.room === office.id).map((f) => f.kind)).toEqual([managerDesk.id]);
    expect(buyRoom(s, 'office', 'comedy')).toBe(false); // one each
    expect(officelessDepartments(s)).toEqual([]);
    expect(loungeOf(s, departmentRoom(s, 'comedy'))).toBeUndefined(); // an office is no break room
  });

  it("sell spare manager's desks, which only stand in offices", () => {
    const s = department(1);
    expect(buyFurniture(s, managerDesk.id)).toBe(false); // no office yet
    buyRoom(s, 'office', 'comedy');
    s.furniture = s.furniture.filter((f) => f.kind !== managerDesk.id);
    expect(buyFurniture(s, managerDesk.id)).toBe(true);
    expect(s.furniture[s.furniture.length - 1].room).toBe(officeOf(s, 'comedy')!.id);
  });
});

describe('hiring a manager', () => {
  it('needs an office with a door and a desk, and enough typing monkeys; the manager sits in the office', () => {
    const s = department(managers.minDepartmentMonkeys - 1);
    expect(managerBlocker(s, 'comedy')).toBe('office needed');
    buyRoom(s, 'office', 'comedy');
    expect(managerBlocker(s, 'comedy')).toBe('1 more monkey needed');
    expect(hireManager(s, 'comedy')).toBe(false);
    const s2 = department(managers.minDepartmentMonkeys);
    buyRoom(s2, 'office', 'comedy');
    const office = officeOf(s2, 'comedy')!;
    const doors = s2.doors;
    s2.doors = [];
    expect(managerBlocker(s2, 'comedy')).toBe('door needed');
    s2.doors = doors;
    expect(managerBlocker(s2, 'comedy')).toBe('');
    const cost = managerCost(s2, 'comedy');
    const desks = roomDesks(s2, departmentRoom(s2, 'comedy')!).length;
    s2.currency = cost;
    expect(hireManager(s2, 'comedy')).toBe(true);
    expect(s2.currency).toBe(0);
    const boss = s2.monkeys.length - 1;
    expect(managerOf(s2, 'comedy')).toBe(s2.monkeys[boss]);
    expect(s2.furniture[deskOf(s2, boss)!]).toMatchObject({ kind: managerDesk.id, room: office.id });
    expect(roomDesks(s2, departmentRoom(s2, 'comedy')!)).toHaveLength(desks); // no desk taken from the typists
    expect(new Set(s2.monkeys.map((_, i) => deskOf(s2, i))).size).toBe(s2.monkeys.length); // one each
    expect(managerBlocker(s2, 'comedy')).toBe('has a manager');
  });
});

describe("the manager's book", () => {
  it("hides in a manager's desk until read", () => {
    const s = department(1);
    buyRoom(s, 'office', 'comedy');
    const i = s.furniture.findIndex((f) => f.kind === managerDesk.id);
    expect(hidesManagerBook(s, 0)).toBe(false); // a plain desk
    expect(hidesManagerBook(s, i)).toBe(true);
    expect(readManagerBook(s, i)).toBe(true);
    expect(s.managerBook).toBe(true);
    expect(hidesManagerBook(s, i)).toBe(false);
    expect(readManagerBook(s, i)).toBe(false);
  });
});

describe('traits', () => {
  const as = (s: GameState, i: number, trait: string) => {
    s.monkeys[i].trait = trait;
    return s.monkeys[i];
  };

  it('are given at random to every monkey without one, and kept', () => {
    const s = department(3);
    giveTraits(s, () => 0.99);
    expect(s.monkeys.map((m) => m.trait)).toEqual(Array(3).fill(traits[traits.length - 1].id));
    s.monkeys[1].trait = 'nightowl';
    s.monkeys.push(createMonkey());
    tick(s, 1, () => 0);
    expect(s.monkeys.map((m) => m.trait)).toEqual([traits[traits.length - 1].id, 'nightowl', traits[traits.length - 1].id, traits[0].id]);
  });

  it('work whether or not the book has been read', () => {
    const s = department(1);
    const base = monkeySpeed(s, s.monkeys[0]);
    as(s, 0, 'perfectionist');
    expect(s.managerBook).toBe(false);
    expect(monkeySpeed(s, s.monkeys[0])).toBeCloseTo(base * 0.9);
    expect(pointsMultiplier(s, s.monkeys[0])).toBeCloseTo(pointsMultiplier(s) * 1.2);
  });

  it('night owls and early birds go by the clock', () => {
    const s = department(2);
    const owl = as(s, 0, 'nightowl');
    const bird = as(s, 1, 'earlybird');
    try {
      setHour(23);
      expect(traitBonus(s, owl, 'speed')).toBeCloseTo(0.15);
      expect(traitBonus(s, bird, 'speed')).toBeCloseTo(-0.05);
      setHour(9);
      expect(traitBonus(s, owl, 'speed')).toBeCloseTo(-0.05);
      expect(traitBonus(s, bird, 'speed')).toBeCloseTo(0.1);
    } finally {
      setHour(12);
    }
  });

  it('social monkeys like company and loners don\'t', () => {
    const s = department(3);
    expect(traitBonus(s, as(s, 0, 'social'), 'speed')).toBeCloseTo(0.06);
    expect(traitBonus(s, as(s, 1, 'loner'), 'speed')).toBeCloseTo(0.15);
    const crowd = department(8);
    expect(traitBonus(crowd, as(crowd, 0, 'social'), 'speed')).toBeCloseTo(0.15); // capped
    expect(traitBonus(crowd, as(crowd, 1, 'loner'), 'speed')).toBeCloseTo(-0.05);
  });

  it('green thumbs, bookworms and couch potatoes want their furniture', () => {
    const s = department(1);
    const m = as(s, 0, 'greenthumb');
    expect(traitMood(s, m)).toBe(0);
    s.furniture.push({ kind: 'plant', room: 'r1', x: 2, y: 3 });
    expect(traitBonus(s, m, 'speed')).toBeCloseTo(0.1);
    as(s, 0, 'bookworm');
    expect(traitBonus(s, m, 'pay')).toBe(0);
    s.furniture.push({ kind: 'bookshelf', room: 'r1', x: 1, y: 3 });
    expect(traitBonus(s, m, 'pay')).toBeCloseTo(0.1);
    as(s, 0, 'couchpotato');
    buyRoom(s, 'break');
    expect(traitBonus(s, m, 'rest')).toBe(0);
    expect(buyFurniture(s, 'couch', 'break')).toBe(true);
    expect(traitBonus(s, m, 'rest')).toBeCloseTo(0.3);
  });

  it('claustrophobic monkeys want a window by their desk', () => {
    const s = department(1);
    const m = as(s, 0, 'claustrophobic');
    const { x, y } = s.furniture[deskOf(s, 0)!];
    s.windows = [{ x, y, side: 'n' }];
    expect(traitMood(s, m)).toBe(1);
    s.windows = [];
    s.doors = [];
    expect(traitMood(s, m)).toBe(-1);
    s.doors = [{ x: x + 1, y: y + 1, side: 'e' }];
    expect(traitMood(s, m)).toBe(0);
  });
});

describe('traits and offices in saves', () => {
  it('keep traits, offices and the book; unknown traits are dropped', () => {
    const s = department(2);
    buyRoom(s, 'office', 'comedy');
    s.monkeys[0].trait = 'loner';
    s.monkeys[1].trait = 'nonsense';
    s.managerBook = true;
    const back = deserialize(serialize(s));
    expect(back.monkeys.map((m) => m.trait)).toEqual(['loner', '']);
    expect(back.managerBook).toBe(true);
    expect(officeOf(back, 'comedy')?.kind).toBe('office');
    expect(deserialize(serialize(createInitialState(0))).managerBook).toBe(false);
  });
});

describe('R&D', () => {
  it('opens at enough monkeys, needs a lab and researchers, and researches in real time, faster with more researchers', async () => {
    const { research } = await import('../src/game/config');
    const L = await import('../src/game/logic');
    const s = department(research.opensAt - 1);
    expect(L.canBuildLab(s)).toBe(false);
    expect(buyRoom(s, 'lab')).toBe(false);
    s.monkeys.push({ ...createMonkey(), department: 'comedy' });
    expect(L.researcherBlocker(s)).toBe('lab needed');
    expect(buyRoom(s, 'lab')).toBe(true); // building the lab opens R&D
    expect(s.researchOpen).toBe(true);
    expect(buyRoom(s, 'lab')).toBe(false); // one lab
    expect(L.hireResearcher(s)).toBe(true);
    expect(L.hireResearcher(s)).toBe(true);
    const r = L.researchers(s);
    expect(r).toHaveLength(2);
    for (const i of r) s.monkeys[i].trait = 'none';
    expect(L.isTypist(s.monkeys[r[0]])).toBe(false);
    expect(L.monkeyGenre(s, s.monkeys[r[0]])).toBeUndefined();
    const p = research.projects[0];
    expect(L.startResearch(s, p.id)).toBe(true);
    expect(L.startResearch(s, research.projects[1].id)).toBe(false); // one at a time
    expect(L.researchSecondsLeft(s)).toBeCloseTo((p.hours * 3600) / 2);
    L.advanceResearch(s, (p.hours * 3600) / 2);
    expect(s.researched).toEqual([p.id]);
    expect(s.researching).toBe('');
    expect(L.researchBonus(s, 'drain')).toBeCloseTo(p.drain!);
    const back = deserialize(serialize(s));
    expect(back.researched).toEqual([p.id]);
    expect(back.researchOpen).toBe(true);
    expect(L.researchers(back)).toHaveLength(2);
  });
});
