import { describe, expect, it } from 'vitest';
import { fengShui, furnitureKinds } from '../src/game/config';
import { chiHappiness, officeChi, roomChi, roomRules, squareRank } from '../src/game/fengshui';
import { addWindow, cycleWindow, doorPaths, toggleHall, windowSides } from '../src/game/layout';
import { buyRoom, hidesBook, readFengShuiBook, checkAchievements, expandRoom, furnitureHappiness, furnitureSpot, happiness } from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, rectangle } from '../src/game/state';

describe('windows', () => {
  it('go in outside walls only, and [w] cycles one through them', () => {
    const s = createInitialState(0);
    expect(s.windows).toEqual([{ x: 1, y: 0, side: 'e' }]); // room 1 starts with one
    expect(windowSides(s, 0, 0)).toEqual(['n', 'w']);
    expect(cycleWindow(s, 0, 0)).toBe(true);
    expect(s.windows).toContainEqual({ x: 0, y: 0, side: 'n' });
    expect(cycleWindow(s, 0, 0)).toBe(true);
    expect(s.windows).toContainEqual({ x: 0, y: 0, side: 'w' });
    expect(cycleWindow(s, 0, 0)).toBe(true); // then none
    expect(s.windows.filter((w) => w.x === 0 && w.y === 0)).toEqual([]);
    expect(cycleWindow(s, 5, 5)).toBe(false); // outside the office
  });

  it('go when a hallway covers their outside, and a room that grows through one gets another', () => {
    const s = createInitialState(0);
    toggleHall(s, 2, 0);
    expect(s.windows).toEqual([]);
    expect(windowSides(s, 1, 0)).toEqual(['n']);
    toggleHall(s, 2, 0);
    s.windows = [{ x: 1, y: 0, side: 'e' }];
    s.currency = 1e9;
    expect(expandRoom(s, 'r1', [2, 0])).toBe(true);
    expect(s.windows).toHaveLength(1);
    const [w] = s.windows;
    expect(windowSides(s, w.x, w.y)).toContain(w.side);
  });

  it('are placed where no door looks straight at them', () => {
    const s = createInitialState(0);
    s.windows = [];
    s.doors = [{ x: 0, y: 0, side: 'w' }]; // its path runs east along the top row
    addWindow(s, s.office[0]);
    expect(s.windows).toEqual([{ x: 1, y: 1, side: 'e' }]);
  });
});

describe('feng shui', () => {
  it('finds the straight path in from each door, from either side of its wall', () => {
    const s = createInitialState(0);
    s.doors = [{ x: -1, y: 1, side: 'e' }]; // stored from the hallway's side
    expect(doorPaths(s, s.office[0])).toEqual([{ door: s.doors[0], side: 'e', squares: [[0, 1], [1, 1]] }]);
  });

  it('checks light, commanding desks, flow and a clear entrance', () => {
    const s = createInitialState(0);
    const room = s.office[0];
    expect(roomRules(s, room)).toEqual({ light: true, command: true, flow: true, entrance: true, balance: false });
    s.doors = [{ x: 0, y: 0, side: 'w' }];
    // The desk sits just inside the door, in its path.
    expect(roomRules(s, room)).toMatchObject({ command: false, entrance: false, flow: true });
    s.furniture[0] = { kind: 'desk', room: 'r1', x: 0, y: 1 };
    // Now chi rushes straight from the door to the window across the room.
    expect(roomRules(s, room)).toMatchObject({ command: true, entrance: true, flow: false });
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 }); // something in between
    expect(roomRules(s, room)).toMatchObject({ flow: true, entrance: true });
    s.windows = [];
    expect(roomRules(s, room).light).toBe(false);
  });

  it('wants desks against a wall, and every seat backed by one', () => {
    const s = createInitialState(0);
    s.office[0].cells = rectangle(3, 3);
    s.furniture = [{ kind: 'desk', room: 'r1', x: 1, y: 1 }]; // the middle: no wall
    expect(roomRules(s, s.office[0]).command).toBe(false);
    s.office.push({ id: 'r2', kind: 'break', department: '', cells: rectangle(3, 3).map(([x, y]) => [x + 5, y]) });
    const lounge = s.office[1];
    expect(roomRules(s, lounge).command).toBe(false); // no seats
    s.furniture.push({ kind: 'couch', room: 'r2', x: 5, y: 1 });
    expect(roomRules(s, lounge).command).toBe(false); // floor on both long sides
    s.furniture[1] = { kind: 'couch', room: 'r2', x: 5, y: 1, turned: true };
    expect(roomRules(s, lounge).command).toBe(true); // its back to the west wall
    s.furniture[1] = { kind: 'bench', room: 'r2', x: 5, y: 2 };
    expect(roomRules(s, lounge).command).toBe(true); // its back to the south wall
    s.furniture[1] = { kind: 'armchair', room: 'r2', x: 6, y: 1 };
    expect(roomRules(s, lounge).command).toBe(false); // an armchair in the middle of the room
    s.furniture[1] = { kind: 'armchair', room: 'r2', x: 6, y: 0 };
    expect(roomRules(s, lounge).command).toBe(true);
    s.furniture.push({ kind: 'cooler', room: 'r2', x: 6, y: 1 }); // not a seat: no wall needed
    expect(roomRules(s, lounge).command).toBe(true);
  });

  it('balances a room with all five elements; a window is light, not fire', () => {
    const s = createInitialState(0);
    s.office[0].cells = rectangle(3, 3);
    s.furniture.push(
      { kind: 'plant', room: 'r1', x: 2, y: 0 },
      { kind: 'cooler', room: 'r1', x: 2, y: 2 },
      { kind: 'bench', room: 'r1', x: 0, y: 2 },
    );
    expect(roomRules(s, s.office[0]).balance).toBe(false); // no fire: the desk is metal, the window only light
    s.furniture.push({ kind: 'candle', room: 'r1', x: 1, y: 0 });
    expect(roomRules(s, s.office[0]).balance).toBe(true);
    s.windows = [];
    expect(roomRules(s, s.office[0]).balance).toBe(true);
    expect(roomChi(s, s.office[0])).toBeCloseTo(0.8); // no light
  });

  it('makes fire the rarest element, and every store has all five', () => {
    const count = (e: string) => furnitureKinds.filter((k) => k.element === e).length;
    const fire = count('fire');
    for (const e of ['wood', 'earth', 'metal', 'water']) expect(count(e)).toBeGreaterThan(fire);
    for (const decor of [true, false]) {
      const store = furnitureKinds.filter((k) => (k.drain > 0) === decor);
      expect(new Set(store.map((k) => k.element)).size).toBe(5);
    }
    expect(Object.fromEntries(['fire', 'water', 'wood', 'earth', 'metal'].map((e) => [e, count(e)]))).toEqual({ fire: 3, water: 4, wood: 5, earth: 5, metal: 6 });
    expect(new Set(furnitureKinds.map((k) => k.glyph)).size).toBe(furnitureKinds.length); // each looks different on the map
  });

  it('hides the book in a bookshelf, and makes monkeys happier only once it is read', () => {
    const s = createInitialState(0);
    expect(officeChi(s)).toBeCloseTo(0.8);
    expect(chiHappiness(s)).toBe(0);
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 1 }, { kind: 'bookshelf', room: 'r1', x: 0, y: 1 });
    expect(hidesBook(s, 1)).toBe(false);
    expect(readFengShuiBook(s, 1)).toBe(false); // plants hide no books
    expect(hidesBook(s, 2)).toBe(true);
    expect(readFengShuiBook(s, 2)).toBe(true);
    expect(s.fengShuiBook).toBe(true);
    expect(hidesBook(s, 2)).toBe(false); // read: nothing more to find
    expect(chiHappiness(s)).toBeCloseTo(fengShui.maxHappiness * officeChi(s));
    expect(happiness(s, undefined)).toBeCloseTo(furnitureHappiness(s, undefined) + chiHappiness(s));
  });

  it('places new pieces out of the way of doors', () => {
    const s = createInitialState(0);
    s.doors = [{ x: 0, y: 0, side: 'w' }];
    s.furniture[0] = { kind: 'desk', room: 'r1', x: 0, y: 1 };
    expect(squareRank(s, s.office[0], 0, 0)).toBe(2); // just inside the door
    expect(squareRank(s, s.office[0], 1, 0)).toBe(1); // in its path
    expect(squareRank(s, s.office[0], 1, 1)).toBe(0);
    expect(furnitureSpot(s)).toEqual({ room: 'r1', x: 1, y: 1 });
  });

  it('unlocks Harmony for a room with perfect chi', () => {
    const s = createInitialState(0);
    expect(checkAchievements(s)).not.toContain('harmony');
    s.office[0].cells = rectangle(3, 3);
    s.furniture.push(
      { kind: 'plant', room: 'r1', x: 2, y: 0 },
      { kind: 'cooler', room: 'r1', x: 2, y: 2 },
      { kind: 'bench', room: 'r1', x: 0, y: 2 },
      { kind: 'candle', room: 'r1', x: 1, y: 0 },
    );
    expect(checkAchievements(s)).toContain('harmony');
  });

  it('saves windows and the book; older saves get a window in every room', () => {
    const s = createInitialState(0);
    s.fengShuiBook = true;
    s.windows = [{ x: 0, y: 1, side: 's' }];
    expect(deserialize(serialize(s))).toEqual(s);
    const raw = JSON.parse(serialize(s));
    delete raw.state.windows;
    delete raw.state.fengShuiBook;
    const old = deserialize(JSON.stringify(raw));
    expect(old.windows).toHaveLength(1);
    expect(old.fengShuiBook).toBe(false);
  });
});

describe('windows and new rooms', () => {
  it('keeps every window facing outside when a new room and its hallway arrive', () => {
    const s = createInitialState(0);
    s.currency = 1e12;
    for (let i = 0; i < 4; i++) expect(buyRoom(s, 'break')).toBe(true);
    for (const r of s.office) expect(s.windows.filter((w) => r.cells.some(([x, y]) => x === w.x && y === w.y)).length, r.id).toBeGreaterThan(0);
    for (const w of s.windows) expect(windowSides(s, w.x, w.y)).toContain(w.side);
  });
});
