import { describe, expect, it } from 'vitest';
import { hats, hr, managerDesk, managers, traits } from '../src/game/config';
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
  s.currency = s.sentences = 1e15;
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

describe('HR', () => {
  it('opens with an office after the first manager; HR monkeys make typists happier and new monkeys cheaper', async () => {
    const { hr } = await import('../src/game/config');
    const L = await import('../src/game/logic');
    const s = department(managers.minDepartmentMonkeys);
    expect(L.canBuildHR(s)).toBe(false); // no manager yet
    expect(buyRoom(s, 'hr')).toBe(false);
    buyRoom(s, 'office', 'comedy');
    expect(hireManager(s, 'comedy')).toBe(true);
    expect(L.hrBlocker(s)).toBe('HR office needed');
    const happy = L.happiness(s, 'comedy');
    const price = L.nextMonkeyCost(s, 'comedy');
    expect(buyRoom(s, 'hr')).toBe(true);
    expect(buyRoom(s, 'hr')).toBe(false); // one HR office
    expect(L.hireHR(s)).toBe(true);
    expect(L.hireHR(s)).toBe(true);
    const staff = L.hrStaff(s);
    expect(staff).toHaveLength(2);
    expect(L.isTypist(s.monkeys[staff[0]])).toBe(false);
    expect(L.monkeyGenre(s, s.monkeys[staff[0]])).toBeUndefined();
    expect(s.furniture[deskOf(s, staff[1])!].room).toBe(L.hrRoom(s)!.id);
    expect(L.happiness(s, 'comedy')).toBeCloseTo(happy + 2 * hr.happierEach);
    expect(L.nextMonkeyCost(s, 'comedy')).toBe(Math.ceil(price * (1 - 2 * hr.discountEach)));
    while (L.hrStaff(s).length < hr.maxStaff && L.hireHR(s));
    expect(L.hrBlocker(s)).toMatch(/HR full|desk needed/);
    const back = deserialize(serialize(s));
    expect(L.hrStaff(back)).toHaveLength(L.hrStaff(s).length);
    expect(L.hrRoom(back)?.kind).toBe('hr');
  });
});

describe('hidden stats and job feelings', () => {
  it('are picked when a monkey joins, change what it does, and survive saves', async () => {
    const { monkeyStats } = await import('../src/game/config');
    const L = await import('../src/game/logic');
    const s = department(1);
    const m = s.monkeys[0];
    m.trait = 'none';
    giveTraits(s, () => 0); // lowest stats; the first feeling for every job
    expect(m.speedStat).toBe(monkeyStats.min);
    expect(m.stamina).toBe(monkeyStats.min);
    expect(Object.values(m.jobs)).toEqual(Array(monkeyStats.jobs.length).fill(monkeyStats.feelings[0].id));
    expect(L.jobOf(m)).toBe('typing');
    const loves = monkeyStats.feelings[0].bonus;
    const base = monkeySpeed(s, { ...m, speedStat: 1, jobs: {} });
    expect(monkeySpeed(s, m)).toBeCloseTo(base * monkeyStats.min * (1 + loves));
    m.jobs.typing = 'detests';
    expect(L.jobBonus(m)).toBe(-0.4);
    const back = deserialize(serialize(s)).monkeys[0];
    expect(back).toMatchObject({ speedStat: m.speedStat, stamina: m.stamina, jobs: m.jobs });
    expect(deserialize(serialize({ ...s, monkeys: [{ ...m, speedStat: 7, jobs: { typing: 'nonsense' } }] })).monkeys[0]).toMatchObject({ speedStat: 0, jobs: {} }); // picked again
  });

  it("scale a manager's bonus and show once an HR office is built", async () => {
    const L = await import('../src/game/logic');
    const s = department(managers.minDepartmentMonkeys);
    buyRoom(s, 'office', 'comedy');
    hireManager(s, 'comedy');
    const boss = L.managerOf(s, 'comedy')!;
    boss.managerLevel = 1;
    boss.jobs = { managing: 'good' };
    expect(L.managerMultiplier(s, s.monkeys[0])).toBeCloseTo((1 + managers.bonusPerLevel) * 1.1);
    expect(L.statsShown(s)).toBe(false);
    buyRoom(s, 'hr');
    expect(L.statsShown(s)).toBe(true);
  });
});

describe('traits that rub off on a room', () => {
  it("change every other monkey's happiness or speed in the same room, capped", async () => {
    const L = await import('../src/game/logic');
    const { traitRules } = await import('../src/game/config');
    const s = department(3);
    for (const m of s.monkeys) Object.assign(m, { trait: 'none', speedStat: 1, stamina: 1, jobs: {} });
    const happy = L.monkeyHappiness(s, s.monkeys[1]);
    const speed = monkeySpeed(s, s.monkeys[1]);
    s.monkeys[0].trait = 'cheerleader';
    expect(L.monkeyHappiness(s, s.monkeys[1])).toBeCloseTo(happy + 0.05);
    expect(L.monkeyHappiness(s, s.monkeys[0])).toBeCloseTo(happy); // not itself
    s.monkeys[0].trait = 'slacker';
    expect(monkeySpeed(s, s.monkeys[1])).toBeCloseTo(speed * 0.95);
    expect(monkeySpeed(s, s.monkeys[0])).toBeCloseTo(speed * 1.1);
    s.monkeys[2].trait = 'motivator';
    expect(monkeySpeed(s, s.monkeys[1])).toBeCloseTo(speed); // -5% and +5%
    for (let k = 0; k < 15; k++) s.monkeys.push({ ...createMonkey(), department: 'comedy', trait: 'grump' });
    expect(L.roomEffect(s, s.monkeys[1], 'happiness')).toBe(-traitRules.maxRoomEffect);
  });
});

describe('hiring through HR', () => {
  it('draws candidates once there is an HR office, prices them by their stats, and hires them as they are', async () => {
    const { hr } = await import('../src/game/config');
    const L = await import('../src/game/logic');
    const s = department(managers.minDepartmentMonkeys);
    L.drawCandidates(s, 1, () => 0.5);
    expect(s.candidates).toEqual([]); // no HR office yet
    buyRoom(s, 'office', 'comedy');
    hireManager(s, 'comedy');
    buyRoom(s, 'hr');
    let r = 0;
    L.drawCandidates(s, 1, () => ((r += 0.37) % 1));
    expect(s.candidates).toHaveLength(hr.candidatesBase);
    expect(s.candidatesIn).toBe(hr.refreshHours * 3600);
    const best = { trait: 'loner', speedStat: 1.2, stamina: 1.2, jobs: { typing: 'loves', managing: 'fine', hr: 'fine', research: 'fine' }, tempLeft: 0 };
    const worst = { ...best, speedStat: 0.8, stamina: 0.8, jobs: { ...best.jobs, typing: 'detests' } };
    expect(L.candidateFactor(best, 'typing')).toBeCloseTo((1.2 * 1.2) ** 2);
    expect(L.candidateFactor(worst, 'typing')).toBeCloseTo((0.8 * 0.6) ** 2);
    s.candidates = [best, worst];
    const base = L.nextMonkeyCost(s, 'comedy');
    s.currency = Math.ceil(base * L.candidateFactor(best, 'typing'));
    expect(L.buyMonkey(s, 'comedy', 0)).toBe(true);
    expect(s.currency).toBe(0);
    expect(s.monkeys[s.monkeys.length - 1]).toMatchObject({ speedStat: 1.2, stamina: 1.2, department: 'comedy' });
    expect(s.candidates).toEqual([worst]); // taken off the list
    expect(deserialize(serialize(s)).candidates).toEqual([worst]);
    L.drawCandidates(s, hr.refreshHours * 3600, () => 0.5); // a new list after refreshHours
    expect(s.candidates).toHaveLength(hr.candidatesBase);
  });
});

describe('storing, selling and firing', () => {
  it('puts furniture away for free reuse, sells it for half, and keeps desks', async () => {
    const L = await import('../src/game/logic');
    const { furnitureKinds, sellBack } = await import('../src/game/config');
    const s = department(1);
    const plant = furnitureKinds.find((k) => k.id === 'plant')!;
    expect(buyFurniture(s, 'plant')).toBe(true);
    const at = s.furniture.length - 1;
    expect(L.canRemoveFurniture(s, 0)).toBe(false); // a desk
    expect(L.storeFurniture(s, 0)).toBe(false);
    const price = L.furnitureCost(s, 'plant');
    expect(L.storeFurniture(s, at)).toBe(true);
    expect(s.stored.furniture).toEqual({ plant: 1 });
    expect(L.furnitureCost(s, 'plant')).toBe(price); // storing doesn't make the next one cheaper
    const money = s.sentences;
    expect(buyFurniture(s, 'plant')).toBe(true); // out of storage, free
    expect(s.sentences).toBe(money);
    expect(s.stored.furniture).toEqual({});
    expect(L.sellFurniture(s, s.furniture.length - 1)).toBe(true);
    expect(s.sentences).toBe(money + Math.floor(plant.cost * sellBack));
    expect(deserialize(serialize({ ...s, stored: { furniture: { plant: 2, nonsense: 1 }, hats: { crown: 1 } } })).stored).toEqual({ furniture: { plant: 2 }, hats: { crown: 1 } });
  });

  it("sells a monkey's hat, and fires monkeys (never the last typist), keeping their hats in storage", async () => {
    const L = await import('../src/game/logic');
    const { hats, sellBack } = await import('../src/game/config');
    const s = department(2);
    s.sentences = 1e9;
    const cap = hats[0];
    expect(L.wearHat(s, 1, cap.id)).toBe(true);
    const sentences = s.sentences;
    expect(L.sellHat(s, 1)).toBe(true);
    expect(s.monkeys[1]).toMatchObject({ hat: '', hats: [] });
    expect(s.sentences).toBe(sentences + Math.floor(cap.cost * sellBack));
    L.wearHat(s, 1, cap.id);
    expect(L.fireMonkey(s, 1)).toBe(true);
    expect(s.monkeys).toHaveLength(1);
    expect(s.stored.hats).toEqual({ [cap.id]: 1 });
    expect(L.fireBlocker(s, 0)).toBe('your last typing monkey');
    expect(L.fireMonkey(s, 0)).toBe(false);
    const before = s.sentences;
    expect(L.wearHat(s, 0, cap.id)).toBe(true); // out of storage, free
    expect(s.sentences).toBe(before);
    expect(s.stored.hats).toEqual({});
  });
});

describe('M-numbers', () => {
  it('stay with a monkey for good, even when others leave', async () => {
    const L = await import('../src/game/logic');
    const s = department(3);
    s.monkeys.forEach((m, i) => ((m.number = i + 1), (m.name = '')));
    L.fireMonkey(s, 1);
    expect([0, 1].map((i) => L.monkeyName(s, i))).toEqual(['M-1', 'M-3']);
    L.addMonkey(s, { department: 'comedy', name: '' });
    expect(L.monkeyName(s, 2)).toBe('M-4');
    const back = deserialize(serialize(s));
    expect(back.monkeys.map((m) => m.number)).toEqual([1, 3, 4]);
  });
});

describe('monkey names', () => {
  it('every monkey gets a famous monkey name of its own, and can still be renamed', async () => {
    const L = await import('../src/game/logic');
    const { monkeyNames } = await import('../src/game/config');
    const s = department(3);
    for (let i = 0; i < 60; i++) L.addMonkey(s, { department: 'comedy' });
    const names = s.monkeys.slice(3).map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.length > 0 && n.length <= 12)).toBe(true);
    const { monkeyParodies } = await import('../src/game/state');
    const known = new Set([...monkeyNames, ...monkeyParodies()]);
    expect(names.every((n) => known.has(n))).toBe(true);
    expect(names.some((n) => monkeyNames.includes(n))).toBe(true);
    expect(names.some((n) => !monkeyNames.includes(n))).toBe(true); // some parodies too
    expect(s.stats.renamed).toBe(0);
    expect(L.renameMonkey(s, 3, 'Bob')).toBe(true);
    expect(L.monkeyName(s, 3)).toBe('Bob');
    expect(s.stats.renamed).toBe(1);
  });
});

describe('parody names', () => {
  it('swap the sounds before each first vowel, keeping words with no vowel', async () => {
    const { parodyOf, monkeyParodies } = await import('../src/game/state');
    const { monkeyNames } = await import('../src/game/config');
    expect(parodyOf('King Kong', 'B')).toBe('Bing Bong');
    expect(parodyOf('Abu', 'B')).toBe('Babu');
    expect(parodyOf('Mr Teeny', 'Sp')).toBe('Mr Speeny');
    expect(parodyOf('Chim-Chim', 'Fl')).toBe('Flim-Flim');
    expect(monkeyParodies().some((n) => monkeyNames.includes(n))).toBe(false);
  });
});

describe('old saves', () => {
  it('give unnamed monkeys a famous name, and an empty rename gives one back', async () => {
    const L = await import('../src/game/logic');
    const s = department(3);
    s.monkeys.forEach((m) => (m.name = ''));
    const back = deserialize(serialize(s));
    expect(back.monkeys.every((m) => m.name)).toBe(true);
    expect(new Set(back.monkeys.map((m) => m.name)).size).toBe(3);
    expect(L.renameMonkey(back, 0, '')).toBe(true);
    expect(back.monkeys[0].name).not.toBe('');
    expect(back.stats.renamed).toBe(0);
  });
});

describe('temps', () => {
  it('come in HR lists with better stats, cost less, cannot be upgraded, and leave when their time is up', async () => {
    const L = await import('../src/game/logic');
    const s = department(6);
    s.currency = s.sentences = 1e15;
    s.lines = 1e9;
    buyRoom(s, 'office', 'comedy');
    hireManager(s, 'comedy');
    buyRoom(s, 'hr');
    L.drawCandidates(s, 1, () => 0); // rng 0: every candidate a temp
    expect(s.candidates.every((c) => c.tempLeft === hr.tempHours * 3600)).toBe(true);
    const c = s.candidates[0];
    expect(c.speedStat).toBeGreaterThanOrEqual(hr.tempStats.min);
    expect(hr.tempTraits).toContain(c.trait);
    expect(Object.values(c.jobs).every((f) => hr.tempFeelings.includes(f))).toBe(true);
    const base = L.nextMonkeyCost(s, 'comedy');
    expect(L.hirePrice(s, base, 'typing', 0)).toBe(Math.ceil(base * L.candidateFactor(c, 'typing') * hr.tempPrice));
    expect(L.buyMonkey(s, 'comedy', 0)).toBe(true);
    const i = s.monkeys.length - 1;
    const temp = s.monkeys[i];
    expect(L.isTemp(temp)).toBe(true);
    expect(L.buyFasterTyping(s, i)).toBe(false);
    expect(L.buyTypewriter(s, i)).toBe(false);
    temp.hats = [hats[0].id];
    const count = s.monkeys.length;
    expect(L.endTemps(s, hr.tempHours * 3600 - 1)).toEqual([]);
    expect(L.endTemps(s, 1)).toEqual([temp.name]);
    expect(s.monkeys).toHaveLength(count - 1);
    expect(s.stored.hats[hats[0].id]).toBe(1);
    expect(deserialize(serialize(s)).candidates.every((x) => x.tempLeft > 0)).toBe(true);
  });

  it('never leave the office without a typing monkey: the last permanent one cannot be fired', async () => {
    const L = await import('../src/game/logic');
    const s = department(2);
    s.monkeys[1].tempLeft = 100;
    expect(L.fireBlocker(s, 0)).toBe('your last typing monkey');
    expect(L.fireBlocker(s, 1)).toBe('');
  });
});

describe('Marketing', () => {
  it('opens after HR; marketing monkeys earn royalties on finished scenes and Folio pages, raised by tactics', async () => {
    const { marketing, research } = await import('../src/game/config');
    const L = await import('../src/game/logic');
    const { setPlays } = L;
    setPlays([{ id: 'mk', title: 'Mk', genre: 'comedy', lines: [[1, 1, 'A', 'I am'], [1, 1, 'B', 'I'], [1, 2, 'A', 'Am I']] }]);
    const s = department(managers.minDepartmentMonkeys);
    buyRoom(s, 'office', 'comedy');
    hireManager(s, 'comedy');
    expect(L.canBuildMarketing(s)).toBe(false); // HR first
    expect(L.projectsLeft(s).some((p) => p.needs === 'marketing')).toBe(false); // tactics hidden
    buyRoom(s, 'hr');
    expect(L.marketingBlocker(s)).toBe('Marketing office needed');
    expect(buyRoom(s, 'marketing')).toBe(true);
    expect(L.projectsLeft(s).some((p) => p.needs === 'marketing')).toBe(true);
    s.scenesDone = ['mk:1.1'];
    s.folioPages = 3;
    expect(L.popularity(s)).toEqual({ lines: 2, pages: 3 });
    expect(L.royalties(s)).toBe(0); // nobody in Marketing yet
    expect(L.hireMarketer(s)).toBe(true);
    const i = L.marketers(s)[0];
    Object.assign(s.monkeys[i], { jobs: { ...s.monkeys[i].jobs, marketing: 'fine' }, trait: 'bookworm' });
    expect(L.isTypist(s.monkeys[i])).toBe(false);
    expect(s.furniture[deskOf(s, i)!].room).toBe(L.marketingRoom(s)!.id);
    const per = 2 * marketing.perLine + 3 * marketing.perPage;
    expect(L.royalties(s)).toBeCloseTo(per);
    s.researched = research.projects.filter((p) => p.marketing).map((p) => p.id);
    const boost = research.projects.reduce((n, p) => n + (p.marketing ?? 0), 0);
    expect(L.royalties(s)).toBeCloseTo(per * (1 + boost));
    const before = s.currency;
    L.tick(s, 10, () => 0.99);
    expect(s.currency - before).toBeGreaterThanOrEqual(per * (1 + boost) * 10 - 1);
    expect(L.checkAchievements(s)).toEqual([]); // already counted by tick
    expect(s.achievements).toContain('first-marketing');
    const back = deserialize(serialize(s));
    expect(L.marketers(back)).toHaveLength(1);
    expect(L.marketingRoom(back)?.kind).toBe('marketing');
  });
});
