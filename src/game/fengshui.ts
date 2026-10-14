/**
 * Feng shui: how well each room is arranged. A room keeps five simple rules,
 * and its chi is the share it keeps. Once you've read the feng shui book (found
 * in a bookshelf), the office's chi (over the rooms you can reach) adds a
 * little happiness. Optional depth: auto-placed offices do fine,
 * and arranging them well earns a small extra. Pure: no prices, no I/O.
 */
import { desk, elements, fengShui, furnitureKinds, type Element } from './config';
import { connectedRooms, doorAt, doorPaths, windowAt, type Square } from './layout';
import type { Furniture, GameState, Room } from './state';

export type ChiRule = 'light' | 'command' | 'flow' | 'entrance' | 'balance';

/** The rules, in the order they're shown, with what each asks of a room (department rooms and break rooms differ on command). */
export const chiRules: { id: ChiRule; name: string; department: string; break: string }[] = [
  { id: 'light', name: 'Light', department: 'a window', break: 'a window' },
  { id: 'command', name: 'Command', department: 'every desk against a wall and out of the path of a door', break: 'every seat (bench, armchair or couch) backed by a wall' },
  { id: 'flow', name: 'Flow', department: 'no door looks straight at a window or another door across the room, unless something stands in between', break: 'no door looks straight at a window or another door across the room, unless something stands in between' },
  { id: 'entrance', name: 'Welcome', department: 'nothing on the square just inside a door', break: 'nothing on the square just inside a door' },
  { id: 'balance', name: 'Balance', department: 'all five elements: wood, fire, earth, metal and water', break: 'all five elements: wood, fire, earth, metal and water' },
];

/** A kind of furniture's element. */
export function elementOf(kind: string): Element | undefined {
  return (kind === desk.id ? desk : furnitureKinds.find((k) => k.id === kind))?.element;
}

/** The squares a piece stands on (bigger pieces reach right and down; turned ones swap). */
function squaresOf(f: Furniture): Square[] {
  const [w0, h0] = (kindOf(f.kind)?.size ?? [1, 1]) as [number, number];
  const [w, h] = f.turned ? [h0, w0] : [w0, h0];
  const out: Square[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([f.x + dx, f.y + dy]);
  return out;
}
const kindOf = (id: string) => (id === desk.id ? desk : furnitureKinds.find((k) => k.id === id));

/** Which of the five rules a room keeps. */
export function roomRules(state: GameState, room: Room): Record<ChiRule, boolean> {
  const inRoom = (x: number, y: number) => room.cells.some(([cx, cy]) => cx === x && cy === y);
  const pieces = state.furniture.filter((f) => f.room === room.id);
  const taken = new Set(pieces.flatMap((f) => squaresOf(f).map(([x, y]) => `${x},${y}`)));
  const paths = doorPaths(state, room);
  const onPath = new Set(paths.flatMap((p) => p.squares.map(([x, y]) => `${x},${y}`)));
  const wallOn = (x: number, y: number, dx: number, dy: number) => !inRoom(x + dx, y + dy);

  const light = room.cells.some(([x, y]) => state.windows.some((w) => w.x === x && w.y === y));

  let command: boolean;
  if (room.kind === 'department') {
    const desks = pieces.filter((f) => f.kind === desk.id);
    command =
      desks.length > 0 &&
      desks.every(
        (f) => !onPath.has(`${f.x},${f.y}`) && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => wallOn(f.x, f.y, dx, dy)),
      );
  } else {
    const seats = pieces.filter((f) => kindOf(f.kind)?.seat);
    // A seat's back is one of its long sides: north or south across, east or west when turned; any side for a one-square seat.
    command =
      seats.length > 0 &&
      seats.every((f) => {
        const [w, h] = (kindOf(f.kind)?.size ?? [1, 1]) as [number, number];
        const backs = w === h ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : f.turned ? [[1, 0], [-1, 0]] : [[0, -1], [0, 1]];
        return backs.some(([dx, dy]) => squaresOf(f).every(([x, y]) => wallOn(x, y, dx, dy)));
      });
  }

  // Chi rushes from a door straight across to a window or door, unless something stands in its path.
  const flow = paths.every((p) => {
    if (p.squares.some(([x, y]) => taken.has(`${x},${y}`))) return true;
    const [x, y] = p.squares[p.squares.length - 1];
    return !windowAt(state, x, y, p.side) && !doorAt(state, x, y, p.side);
  });

  const entrance = paths.every((p) => !taken.has(`${p.squares[0][0]},${p.squares[0][1]}`));

  const have = new Set<Element>(pieces.map((f) => elementOf(f.kind)).filter((e): e is Element => !!e));
  const balance = elements.every((e) => have.has(e));

  return { light, command, flow, entrance, balance };
}

/** A room's chi: the share of the rules it keeps, 0 to 1. */
export function roomChi(state: GameState, room: Room): number {
  const rules = Object.values(roomRules(state, room));
  return rules.filter(Boolean).length / rules.length;
}

let chiMemo: { key: string; chi: number } | null = null;

/**
 * The office's chi: the average over the rooms you can reach (0 with none).
 * Remembered until the layout changes, since points and energy ask often.
 */
export function officeChi(state: GameState): number {
  const key = [
    state.office.map((r) => `${r.id}${r.kind[0]}${r.cells.length}:${r.cells[r.cells.length - 1]}`).join(),
    state.doors.map((d) => `${d.x},${d.y}${d.side}`).join(),
    state.windows.map((d) => `${d.x},${d.y}${d.side}`).join(),
    state.furniture.map((f) => `${f.kind}${f.room}${f.x},${f.y}${f.turned ? 't' : ''}`).join(),
    state.halls.length,
  ].join('|');
  if (chiMemo?.key === key) return chiMemo.chi;
  const open = connectedRooms(state);
  const rooms = state.office.filter((r) => open.has(r.id) && r.kind !== 'office'); // offices are too small to count
  const chi = rooms.length === 0 ? 0 : rooms.reduce((n, r) => n + roomChi(state, r), 0) / rooms.length;
  chiMemo = { key, chi };
  return chi;
}

/** Happiness from feng shui, once you've read the book: up to fengShui.maxHappiness, by the office's chi. */
export function chiHappiness(state: GameState): number {
  return state.fengShuiBook ? fengShui.maxHappiness * officeChi(state) : 0;
}

/**
 * How well a square suits a new piece: 0 is best, 1 lies in a door's path, 2
 * is just inside a door. Auto-placement takes the best squares first.
 */
export function squareRank(state: GameState, room: Room, x: number, y: number): number {
  const paths = doorPaths(state, room);
  if (paths.some((p) => p.squares[0][0] === x && p.squares[0][1] === y)) return 2;
  return paths.some((p) => p.squares.some(([px, py]) => px === x && py === y)) ? 1 : 0;
}
