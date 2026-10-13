/**
 * The office floor plan: rooms, hallway squares and doors on one shared
 * grid. Every room must connect to the first room (the office entrance)
 * through doors and hallways; a room that doesn't can't be used. New rooms are
 * placed and connected automatically, and players can move doors and
 * hallways on the office map. Pure geometry: no prices, no I/O.
 */
import { office as officeRules } from './config';
import type { Door, GameState, Room, Side } from './state';

export type Square = [number, number];

export const sides: Record<Side, Square> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const sideOrder: Side[] = ['n', 'e', 's', 'w'];
const opposite: Record<Side, Side> = { n: 's', e: 'w', s: 'n', w: 'e' };
const at = (x: number, y: number) => `${x},${y}`;
const readingOrder = (a: Square, b: Square) => a[1] - b[1] || a[0] - b[0];

/** What fills each square: a room id, 'hall', or nothing. */
function floorPlan(state: GameState): Map<string, string> {
  const plan = new Map<string, string>();
  for (const r of state.office) for (const [x, y] of r.cells) plan.set(at(x, y), r.id);
  for (const [x, y] of state.halls) plan.set(at(x, y), 'hall');
  return plan;
}

/** The room a square belongs to, if any. */
export function roomAt(state: GameState, x: number, y: number): Room | undefined {
  return state.office.find((r) => r.cells.some(([cx, cy]) => cx === x && cy === y));
}

export function isHall(state: GameState, x: number, y: number): boolean {
  return state.halls.some(([hx, hy]) => hx === x && hy === y);
}

/** The square on the other side of a door. */
export function beyond(door: Door): Square {
  const [dx, dy] = sides[door.side];
  return [door.x + dx, door.y + dy];
}

/** The door in the wall on one side of a square, from either side of that wall. */
export function doorAt(state: GameState, x: number, y: number, side: Side): Door | undefined {
  const [dx, dy] = sides[side];
  return state.doors.find(
    (d) => (d.x === x && d.y === y && d.side === side) || (d.x === x + dx && d.y === y + dy && d.side === opposite[side]),
  );
}

/** Sides of a room square that a door could go in: walls onto a hallway or another room. */
export function doorSides(state: GameState, x: number, y: number): Side[] {
  const plan = floorPlan(state);
  const here = plan.get(at(x, y));
  if (!here || here === 'hall') return [];
  return sideOrder.filter((s) => {
    const there = plan.get(at(x + sides[s][0], y + sides[s][1]));
    return !!there && there !== here;
  });
}

/** Drops doors that no longer lead anywhere (a hallway or room was moved). */
export function tidyDoors(state: GameState): void {
  const plan = floorPlan(state);
  state.doors = state.doors.filter((d) => {
    const here = plan.get(at(d.x, d.y));
    const [bx, by] = beyond(d);
    const there = plan.get(at(bx, by));
    return !!here && !!there && here !== there && here !== 'hall';
  });
}

let reachMemo: { key: string; reach: Reach } | null = null;
type Reach = { rooms: Set<string>; halls: Set<string> };

/**
 * Rooms you can walk to from the first room through doors and hallways.
 * Remembered until the floor plan changes, since points and energy ask often.
 */
export function connectedRooms(state: GameState): Set<string> {
  return reach(state).rooms;
}

/** Rooms and hallway squares ("x,y") reachable from the first room. */
function reach(state: GameState): Reach {
  const key = [
    state.office.map((r) => `${r.id}:${r.cells.length}`).join(','),
    state.halls.map(([x, y]) => at(x, y)).join(';'),
    state.doors.map((d) => `${d.x},${d.y}${d.side}`).join(';'),
  ].join('|');
  if (reachMemo?.key === key) return reachMemo.reach;
  const plan = floorPlan(state);
  const rooms = new Set<string>();
  const halls = new Set<string>();
  const start = state.office[0];
  const queue: string[] = start ? [start.id] : [];
  if (start) rooms.add(start.id);
  // Doors work both ways, so index them by the space on each side.
  const links = new Map<string, string[]>();
  const link = (a: string, b: string) => links.set(a, [...(links.get(a) ?? []), b]);
  for (const d of state.doors) {
    const [bx, by] = beyond(d);
    const here = plan.get(at(d.x, d.y));
    const there = plan.get(at(bx, by));
    if (!here || !there || here === there) continue;
    const a = here === 'hall' ? `h${at(d.x, d.y)}` : here;
    const b = there === 'hall' ? `h${at(bx, by)}` : there;
    link(a, b);
    link(b, a);
  }
  while (queue.length > 0) {
    const node = queue.shift()!;
    const next = [...(links.get(node) ?? [])];
    if (node.startsWith('h')) {
      // Hallway squares open onto the hallway squares beside them.
      const [x, y] = node.slice(1).split(',').map(Number);
      for (const s of sideOrder) {
        const n = at(x + sides[s][0], y + sides[s][1]);
        if (plan.get(n) === 'hall') next.push(`h${n}`);
      }
    }
    for (const n of next) {
      const seen = n.startsWith('h') ? halls : rooms;
      const id = n.startsWith('h') ? n.slice(1) : n;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(n);
    }
  }
  reachMemo = { key, reach: { rooms, halls } };
  return reachMemo.reach;
}

/** Whether a room can be reached from the office entrance (the first room). */
export function isConnected(state: GameState, room: Room | undefined): boolean {
  return !!room && connectedRooms(state).has(room.id);
}

/** The smallest rectangle around the whole office, rooms and hallways. */
export function officeBounds(state: GameState): { minX: number; maxX: number; minY: number; maxY: number } {
  const cells = [...state.office.flatMap((r) => r.cells), ...state.halls];
  if (cells.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Whether a square is free for a room: empty, and not touching another room (rooms keep a hallway's width apart). */
export function roomCanUse(state: GameState, x: number, y: number, room?: Room): boolean {
  const plan = floorPlan(state);
  if (plan.has(at(x, y))) return false;
  return sideOrder.every((s) => {
    const n = plan.get(at(x + sides[s][0], y + sides[s][1]));
    return !n || n === 'hall' || n === room?.id;
  });
}

/**
 * Connects every room to the entrance, in the order they were bought: each
 * unconnected room gets a door and the shortest new hallway to anything
 * already connected (a hallway, or a door into a connected room).
 */
export function autoConnect(state: GameState): void {
  tidyDoors(state);
  for (const room of state.office) {
    if (isConnected(state, room)) continue;
    connectRoom(state, room);
  }
}

function connectRoom(state: GameState, room: Room): void {
  const plan = floorPlan(state);
  const { rooms: connected, halls: linked } = reach(state);
  const b = officeBounds(state);
  const inBounds = (x: number, y: number) => x >= b.minX - 3 && x <= b.maxX + 3 && y >= b.minY - 3 && y <= b.maxY + 3;

  type Step = { square: Square; from: string | null; door: Door };
  const seen = new Map<string, Step>();
  const queue: Step[] = [];
  const finish = (step: Step | null, end: Door | null, first: Door) => {
    const path: Square[] = [];
    for (let s = step; s; s = s.from ? seen.get(s.from)! : null) path.push(s.square);
    for (const sq of path) state.halls.push(sq);
    state.doors.push(first);
    if (end) state.doors.push(end);
  };
  const starts = [...room.cells].sort(readingOrder);
  for (const [x, y] of starts) {
    for (const side of sideOrder) {
      const [nx, ny] = [x + sides[side][0], y + sides[side][1]];
      const there = plan.get(at(nx, ny));
      const door: Door = { x, y, side };
      if (there === room.id) continue;
      if ((there === 'hall' && linked.has(at(nx, ny))) || (there && there !== 'hall' && connected.has(there))) return finish(null, null, door);
      if (!there && !seen.has(at(nx, ny))) {
        const step = { square: [nx, ny] as Square, from: null, door };
        seen.set(at(nx, ny), step);
        queue.push(step);
      }
    }
  }
  while (queue.length > 0) {
    const step = queue.shift()!;
    const [x, y] = step.square;
    for (const side of sideOrder) {
      const [nx, ny] = [x + sides[side][0], y + sides[side][1]];
      const there = plan.get(at(nx, ny));
      if (there === 'hall' && linked.has(at(nx, ny))) return finish(step, null, step.door);
      if (there && there !== 'hall' && there !== room.id && connected.has(there)) {
        return finish(step, { x: nx, y: ny, side: opposite[side] }, step.door);
      }
      if (!there && inBounds(nx, ny) && !seen.has(at(nx, ny))) {
        const next = { square: [nx, ny] as Square, from: at(x, y), door: step.door };
        seen.set(at(nx, ny), next);
        queue.push(next);
      }
    }
  }
}

/** Whether score a comes before b, comparing entry by entry. */
function before(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Where a new w x h room goes: free squares that keep a hallway's width from
 * other rooms, needing the shortest new hallway, then keeping the office
 * compact and within the map's width.
 */
export function placeRoom(state: GameState, width: number, height: number): Square {
  if (state.office.length === 0 && state.halls.length === 0) return [0, 0];
  const plan = floorPlan(state);
  const b = officeBounds(state);
  const { rooms: connected, halls: linkedHalls } = reach(state);
  // Hallway squares needed to reach each empty square from the connected office.
  const dist = new Map<string, number>();
  const queue: Square[] = [];
  const consider = (x: number, y: number, d: number) => {
    if (plan.has(at(x, y)) || dist.has(at(x, y)) || x < b.minX - width - 3 || x > b.maxX + width + 3 || y < b.minY - height - 3 || y > b.maxY + height + 3) return;
    dist.set(at(x, y), d);
    queue.push([x, y]);
  };
  for (const [key, what] of plan) {
    if (what === 'hall' ? !linkedHalls.has(key) : !connected.has(what)) continue;
    const [x, y] = key.split(',').map(Number);
    for (const s of sideOrder) consider(x + sides[s][0], y + sides[s][1], 1);
  }
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const d = dist.get(at(x, y))!;
    for (const s of sideOrder) consider(x + sides[s][0], y + sides[s][1], d + 1);
  }

  let best: { score: number[]; at: Square } | null = null;
  for (let y = b.minY - height - 1; y <= b.maxY + 2; y++) {
    for (let x = b.minX - width - 1; x <= b.maxX + 2; x++) {
      let ok = true;
      for (let dy = 0; dy < height && ok; dy++) for (let dx = 0; dx < width && ok; dx++) ok = roomCanUse(state, x + dx, y + dy);
      if (!ok) continue;
      // The cheapest way in: a hallway beside it (0), or the squares a new hallway needs.
      let hall = Infinity;
      for (let dy = -1; dy <= height; dy++) {
        for (let dx = -1; dx <= width; dx++) {
          const edge = dy === -1 || dy === height || dx === -1 || dx === width;
          const corner = (dy === -1 || dy === height) && (dx === -1 || dx === width);
          if (!edge || corner) continue;
          const k = at(x + dx, y + dy);
          if (plan.get(k) === 'hall' && linkedHalls.has(k)) hall = 0;
          else if (dist.has(k)) hall = Math.min(hall, dist.get(k)!);
        }
      }
      if (hall === Infinity) continue;
      const w = Math.max(b.maxX, x + width - 1) - Math.min(b.minX, x) + 1;
      const h = Math.max(b.maxY, y + height - 1) - Math.min(b.minY, y) + 1;
      const score = [w > officeRules.mapWidth ? 1 : 0, hall, w * h, Math.max(w, h * 2), y, x];
      if (!best || before(score, best.score)) best = { score, at: [x, y] };
    }
  }
  return best?.at ?? [b.maxX + 2, b.minY];
}

/**
 * Turns the door on a room square to its next wall (north, east, south,
 * west), then off. Returns false if the square has no wall a door could go in.
 */
export function cycleDoor(state: GameState, x: number, y: number): boolean {
  const options = doorSides(state, x, y);
  if (options.length === 0) return false;
  const current = options.findIndex((s) => doorAt(state, x, y, s));
  for (const s of options) {
    const d = doorAt(state, x, y, s);
    if (d) state.doors = state.doors.filter((o) => o !== d);
  }
  const next = options[current + 1];
  if (next) state.doors.push({ x, y, side: next });
  return true;
}

/** Lays a hallway square on empty floor, or takes one up. Returns false for a room's square. */
export function toggleHall(state: GameState, x: number, y: number): boolean {
  if (roomAt(state, x, y)) return false;
  if (isHall(state, x, y)) {
    state.halls = state.halls.filter(([hx, hy]) => hx !== x || hy !== y);
    tidyDoors(state);
  } else {
    state.halls.push([x, y]);
  }
  return true;
}

/** Moves a room (with its furniture and doors) so its top-left corner is at x, y. */
function shiftRoom(state: GameState, room: Room, dx: number, dy: number): void {
  room.cells = room.cells.map(([x, y]) => [x + dx, y + dy]);
  for (const f of state.furniture) if (f.room === room.id) Object.assign(f, { x: f.x + dx, y: f.y + dy });
}

/**
 * Makes an office from an older save sit on one grid: rooms that overlap or
 * touch earlier ones move to a free spot, then every room gets connected.
 */
export function layOutOffice(state: GameState): void {
  const rooms = state.office;
  state.office = [];
  for (const room of rooms) {
    const clash = room.cells.some(([x, y]) => !roomCanUse(state, x, y, room));
    if (clash || (state.office.length > 0 && room.cells.length === 0)) {
      const b = { minX: Math.min(...room.cells.map(([x]) => x)), minY: Math.min(...room.cells.map(([, y]) => y)) };
      const w = Math.max(...room.cells.map(([x]) => x)) - b.minX + 1;
      const h = Math.max(...room.cells.map(([, y]) => y)) - b.minY + 1;
      const [px, py] = placeRoom(state, w, h);
      shiftRoom(state, room, px - b.minX, py - b.minY);
    }
    state.office.push(room);
    autoConnect(state);
  }
}
