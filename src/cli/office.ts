import { desk, furnitureKinds, monkeyIcon, office as officeRules, theme } from '../game/config';
import {
  departmentMonkeys,
  expansionSquares,
  monkeyName,
  roomCost,
  roomDesks,
  roomGenre,
  roomlessDepartments,
  squareCost,
  drainCut,
  restBoost,
  happiness,
} from '../game/logic';
import { connectedRooms, doorAt, isHall, officeBounds, roomAt } from '../game/layout';
import type { Furniture, GameState, Room, Side } from '../game/state';
import { genreNames, hatOf, monkeyIconLegend, price } from './screen';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Widest the map may get: rooms are placed so the office fits (see office.mapWidth). */
export const officeMapWidth = officeRules.mapWidth * 4 + 1;

/** A square of the office map. (room is ignored: the square says which room it's in.) */
export type Cell = { x: number; y: number; room?: string };

/** A room's name: its department's, or Break room (numbered when there are several). */
export function roomName(state: GameState, room: Room): string {
  if (room.kind === 'department') {
    const g = roomGenre(state, room);
    return g ? `${genreNames[g]} room` : 'Your room';
  }
  const breaks = state.office.filter((r) => r.kind === 'break');
  return breaks.length > 1 ? `Break room ${breaks.indexOf(room) + 1}` : 'Break room';
}

/** The furniture's glyph on the map. */
const glyphOf = (kind: string) => (kind === desk.id ? desk.glyph : (furnitureKinds.find((k) => k.id === kind)?.glyph ?? '?'));

const facingMark: Record<Side, string> = { n: '^', e: '>', s: 'v', w: '<' };
export const facingName: Record<Side, string> = { n: 'north', e: 'east', s: 'south', w: 'west' };

/** A piece of furniture in its square: its glyph, with a mark for the way it faces (< on the left when facing west). */
function pieceCell(f: Furniture): string {
  const g = glyphOf(f.kind);
  const facing = f.facing ?? 's';
  return facing === 'w' ? `<${g} ` : ` ${g}${facingMark[facing]}`;
}

/** The name of a piece of furniture, lower case. */
export function furnitureName(state: GameState, index: number): string {
  const f = state.furniture[index];
  return f?.kind === desk.id ? 'desk' : (furnitureKinds.find((k) => k.id === f?.kind)?.name ?? 'furniture').toLowerCase();
}

/** The room being grown: the one named, or (for true) the one under the cursor, else the first. */
function growingRoom(state: GameState, cursor: Cell | null, growing: string | boolean): Room | undefined {
  if (growing === true) return (cursor && roomAt(state, cursor.x, cursor.y)) || state.office[0];
  return growing ? state.office.find((r) => r.id === growing) : undefined;
}

/**
 * The whole office drawn top-down on one grid: rooms with their desks, who
 * sits where and the furniture, hallways between them, and doors (/) in the
 * walls. Each room's number sits in its top wall. `cursor` marks the selected
 * square; `held` is the furniture being moved (an index into
 * state.furniture), or -1; `growing` shows (as +) where a room can grow;
 * `heldDoor` is the wall of the cursor's square where a door being moved
 * would go.
 */
export function renderOffice(
  state: GameState,
  message = '',
  cursor: Cell | null = null,
  held = -1,
  growing: string | boolean = false,
  heldDoor: Side | null = null,
): string {
  const grow = growingRoom(state, cursor, growing);
  const options = grow ? expansionSquares(state, grow) : [];
  const b = officeBounds(state);
  const pad = grow || cursor ? 1 : 0;
  const [minX, maxX, minY, maxY] = [
    Math.min(b.minX - pad, cursor?.x ?? Infinity),
    Math.max(b.maxX + pad, cursor?.x ?? -Infinity),
    Math.min(b.minY - pad, cursor?.y ?? Infinity),
    Math.max(b.maxY + pad, cursor?.y ?? -Infinity),
  ];

  // What fills each square: a room id, 'hall', or '' for outside.
  const spaceOf = new Map<string, string>();
  for (const r of state.office) for (const [x, y] of r.cells) spaceOf.set(`${x},${y}`, r.id);
  for (const [x, y] of state.halls) spaceOf.set(`${x},${y}`, 'hall');
  const space = (x: number, y: number) => spaceOf.get(`${x},${y}`) ?? '';
  const wall = (ax: number, ay: number, bx: number, by: number) => space(ax, ay) !== space(bx, by);
  const sitters = new Map<string, number[]>();
  for (const r of state.office) if (r.kind === 'department') sitters.set(r.id, departmentMonkeys(state, roomGenre(state, r)));

  const cell = (x: number, y: number): string => {
    const here = cursor?.x === x && cursor.y === y;
    const room = roomAt(state, x, y);
    let text: string;
    if (here && held >= 0) text = ` ${glyphOf(state.furniture[held].kind)} `; // a piece being moved shows under the cursor
    else if (!room) text = options.some(([ox, oy]) => ox === x && oy === y) ? ' + ' : '   ';
    else {
      const f = state.furniture.findIndex((p, i) => i !== held && p.room === room.id && p.x === x && p.y === y);
      if (f < 0) text = ' . ';
      else if (state.furniture[f].kind === desk.id) {
        const monkey = state.monkeys[sitters.get(room.id)?.[roomDesks(state, room).indexOf(f)] ?? -1];
        text = !monkey ? '[ ]' : `${hatOf(monkey) ?? '['}${monkeyIcon}${monkey.manager ? '&' : ']'}`;
      } else text = pieceCell(state.furniture[f]);
    }
    return here ? `>${text[1]}<` : text;
  };
  // Walls run between squares of different spaces; + only where they turn or meet.
  const corner = (x: number, y: number) => {
    const up = wall(x - 1, y - 1, x, y - 1);
    const down = wall(x - 1, y, x, y);
    const left = wall(x - 1, y - 1, x - 1, y);
    const right = wall(x, y - 1, x, y);
    if ((up || down) && (left || right)) return '+';
    return up || down ? '|' : left || right ? '-' : ' ';
  };
  // Each room's number goes in the wall above its first square that has no door.
  const labels = new Map<string, string>();
  state.office.forEach((r, i) => {
    const top = [...r.cells].filter(([x, y]) => !r.cells.some(([cx, cy]) => cx === x && cy === y - 1));
    const [x, y] = top.sort((a, c) => a[1] - c[1] || a[0] - c[0]).find(([tx, ty]) => !doorAt(state, tx, ty, 'n')) ?? top[0];
    labels.set(`${x},${y}`, String(i + 1));
  });
  // A door being moved shows where it would go, on the cursor's square.
  const preview = (x: number, y: number, side: Side) => {
    if (!heldDoor || !cursor) return false;
    const [dx, dy] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[heldDoor];
    const flip: Record<Side, Side> = { n: 's', e: 'w', s: 'n', w: 'e' };
    return (cursor.x === x && cursor.y === y && heldDoor === side) || (cursor.x + dx === x && cursor.y + dy === y && flip[heldDoor] === side);
  };
  const isDoor = (x: number, y: number, side: Side) => !!doorAt(state, x, y, side) || preview(x, y, side);
  const hWall = (x: number, y: number) => {
    if (!wall(x, y - 1, x, y)) return preview(x, y, 'n') ? ' / ' : '   ';
    if (isDoor(x, y, 'n')) return '-/-';
    const label = labels.get(`${x},${y}`);
    return label ? `-${label}`.padEnd(3, '-') : '---';
  };
  const lines: string[] = [];
  for (let y = minY; y <= maxY + 1; y++) {
    let line = '';
    for (let x = minX; x <= maxX; x++) line += corner(x, y) + hWall(x, y);
    lines.push((line + corner(maxX + 1, y)).trimEnd());
    if (y > maxY) break;
    let row = '';
    for (let x = minX; x <= maxX + 1; x++) {
      row += wall(x - 1, y, x, y) ? (isDoor(x, y, 'w') ? '/' : '|') : preview(x, y, 'w') ? '/' : ' ';
      if (x <= maxX) row += cell(x, y);
    }
    lines.push(row.trimEnd());
  }
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const open = connectedRooms(state);
  const summary = state.office.map((r, i) => {
    const size = `${r.cells.length} squares`.padEnd(11);
    const cut = r.kind === 'department' ? drainCut(state, roomGenre(state, r)) : 0;
    const detail =
      r.kind === 'department'
        ? (() => {
            const names = departmentMonkeys(state, roomGenre(state, r)).map((k) => monkeyName(state, k));
            return `${cut > 0 ? `tire ${pct(cut)} slower; ` : ''}${names.length} monkey${names.length === 1 ? '' : 's'}: ${names.join(', ')}`;
          })()
        : (() => {
            const pieces = state.furniture.filter((f) => f.room === r.id).length;
            return `${pieces} piece${pieces === 1 ? '' : 's'} of furniture`;
          })();
    const locked = open.has(r.id) ? '' : '   NO WAY IN: add a door or hallway';
    return `  ${String(i + 1).padStart(2)} ${roomName(state, r).padEnd(18)} ${size} ${detail}${locked}`;
  });
  const furnished = furnitureKinds.filter((k) => state.furniture.some((f) => f.kind === k.id)).map((k) => `${k.glyph} ${k.name.toLowerCase()}`);
  const underCursor = cursor ? roomAt(state, cursor.x, cursor.y) : undefined;
  const pieceHere = cursor && underCursor ? state.furniture.findIndex((f) => f.room === underCursor.id && f.x === cursor.x && f.y === cursor.y) : -1;
  const where = !cursor
    ? ''
    : underCursor
      ? `Cursor: ${roomName(state, underCursor)}${pieceHere >= 0 ? `, ${furnitureName(state, pieceHere)} facing ${facingName[state.furniture[pieceHere].facing ?? 's']}` : ''}.`
      : isHall(state, cursor.x, cursor.y)
        ? 'Cursor: hallway.'
        : 'Cursor: outside.';
  return [
    '=== Office ===',
    '',
    ...lines,
    '',
    [...monkeyIconLegend, '[ ] free desk', '/ door', ...furnished].join('   '),
    '',
    ...summary,
    '',
    "Each monkey gets a desk in its department's room. Every room needs a way in from room 1: doors (/) and hallways.",
    `Breaks go ${pct(restBoost(state))} faster (comforts in break rooms). Happiness: +${pct(happiness(state))} points (all furniture).`,
    ...roomlessDepartments(state).map((g) => `The ${genreNames[g]} department needs a room: press [r] to buy one.`),
    `New room: ${price(roomCost(state), state.currency)} ${theme.currency}. One more square for a room: ${price(squareCost(state), state.currency)} ${theme.currency}.`,
    '',
    ...(grow
      ? [`Growing the ${roomName(state, grow)}: move to a + and press [enter] to buy that square.`, '[arrows] move   [x] or [esc] done']
      : held >= 0
        ? [
            `Moving the ${furnitureName(state, held)}, facing ${facingName[state.furniture[held].facing ?? 's']}.`,
            '[arrows] move   [tab] next room   [space] put it down   [r] rotate   [esc] cancel',
          ]
        : heldDoor
          ? [`Moving a door: the ${facingName[heldDoor]} wall of this square.`, '[arrows] move   [space] put it in   [r] next wall   [esc] cancel']
          : [
              `${where}   [arrows] move   [tab] next room   [space] pick up furniture or a door   [x] grow this room`.trim(),
              '[d] door on this square (again: next wall, then none)   [h] hallway here on/off   [r] buy a room   [esc] back',
            ]),
    '',
    message,
  ].join('\n');
}
