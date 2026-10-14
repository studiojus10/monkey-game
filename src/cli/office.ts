import { desk, elements, fengShui, furnitureKinds, monkeyIcon, office as officeRules, theme } from '../game/config';
import {
  departmentMonkeys,
  expansionSquares,
  monkeyName,
  roomCost,
  roomDesks,
  roomGenre,
  roomlessDepartments,
  squareCost,
  footprint,
  pieceSize,
  drainCut,
  restBoost,
  happiness,
  cellAt,
  hidesBook,
} from '../game/logic';
import { connectedRooms, doorAt, isHall, loungeOf, officeBounds, roomAt, servedBy, windowAt } from '../game/layout';
import { chiHappiness, chiRules, elementOf, officeChi, roomChi, roomRules } from '../game/fengshui';
import type { GameState, MonkeyState, Room, Side } from '../game/state';
import { dyed, genreNames, hatOf, monkeyIconLegend, price } from './screen';

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

export const sideName: Record<Side, string> = { n: 'north', e: 'east', s: 'south', w: 'west' };

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

  // Which piece (an index into state.furniture) stands on each square; the one being moved stands at the cursor.
  const pieceAt = new Map<string, number>();
  state.furniture.forEach((f, i) => {
    const at = i === held ? cursor : f;
    if (at) for (const [x, y] of footprint({ ...f, x: at.x, y: at.y })) pieceAt.set(`${x},${y}`, i);
  });
  const piece = (x: number, y: number) => pieceAt.get(`${x},${y}`) ?? -1;
  /** Whether two squares hold the same bigger piece (drawn joined: C===C across, | down). */
  const joined = (ax: number, ay: number, bx: number, by: number) => piece(ax, ay) >= 0 && piece(ax, ay) === piece(bx, by);

  const cell = (x: number, y: number): string => {
    const here = cursor?.x === x && cursor.y === y;
    const room = roomAt(state, x, y);
    const f = piece(x, y);
    let text: string;
    let wearer: MonkeyState | undefined; // a monkey in a hat sits here: its hat shows in its dye
    if (f >= 0 && state.furniture[f].kind === desk.id && f !== held) {
      const own = state.office.find((r) => r.id === state.furniture[f].room);
      const monkey = own && state.monkeys[sitters.get(own.id)?.[roomDesks(state, own).indexOf(f)] ?? -1];
      text = !monkey ? '[ ]' : `${hatOf(monkey) ?? '['}${monkeyIcon}${monkey.manager ? '&' : ']'}`;
      if (monkey && monkey.hat) wearer = monkey;
    } else if (f >= 0) {
      const left = joined(x - 1, y, x, y) ? '=' : ' ';
      const right = joined(x, y, x + 1, y) ? '=' : ' ';
      text = `${left}${glyphOf(state.furniture[f].kind)}${right}`;
    } else if (!room) text = options.some(([ox, oy]) => ox === x && oy === y) ? ' + ' : '   ';
    else text = ' . ';
    return here ? `>${text[1]}<` : wearer ? dyed(wearer, text) : text;
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
    const [x, y] = top.sort((a, c) => a[1] - c[1] || a[0] - c[0]).find(([tx, ty]) => !doorAt(state, tx, ty, 'n') && !windowAt(state, tx, ty, 'n')) ?? top[0];
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
  // A window in the wall above square x, y, or left of it (stored from the room's side).
  const windowAbove = (x: number, y: number) => !!windowAt(state, x, y, 'n') || !!windowAt(state, x, y - 1, 's');
  const windowLeft = (x: number, y: number) => !!windowAt(state, x, y, 'w') || !!windowAt(state, x - 1, y, 'e');
  const hWall = (x: number, y: number) => {
    if (!wall(x, y - 1, x, y)) return preview(x, y, 'n') ? ' / ' : joined(x, y - 1, x, y) ? ' | ' : '   ';
    if (isDoor(x, y, 'n')) return '-/-';
    const label = labels.get(`${x},${y}`);
    return label ? `-${label}`.padEnd(3, '-') : windowAbove(x, y) ? '===' : '---';
  };
  const lines: string[] = [];
  for (let y = minY; y <= maxY + 1; y++) {
    let line = '';
    for (let x = minX; x <= maxX; x++) line += corner(x, y) + hWall(x, y);
    lines.push((line + corner(maxX + 1, y)).trimEnd());
    if (y > maxY) break;
    let row = '';
    for (let x = minX; x <= maxX + 1; x++) {
      row += wall(x - 1, y, x, y) ? (isDoor(x, y, 'w') ? '/' : windowLeft(x, y) ? ':' : '|') : preview(x, y, 'w') ? '/' : joined(x - 1, y, x, y) ? '=' : ' ';
      if (x <= maxX) row += cell(x, y);
    }
    lines.push(row.trimEnd());
  }
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const open = connectedRooms(state);
  const summary = state.office.map((r, i) => {
    const size = `${r.cells.length} squares`.padEnd(11);
    const detail =
      r.kind === 'department'
        ? (() => {
            const g = roomGenre(state, r);
            const names = departmentMonkeys(state, g).map((k) => monkeyName(state, k));
            const lounge = loungeOf(state, r);
            const effects = [
              ...(drainCut(state, g) > 0 ? [`tire ${pct(drainCut(state, g))} slower`] : []),
              ...(restBoost(state, g) > 0 ? [`breaks ${pct(restBoost(state, g))} faster`] : []),
              ...(happiness(state, g) > 0 ? [`+${pct(happiness(state, g))} happy`] : []),
            ];
            return [
              `lounge: ${lounge ? roomName(state, lounge) : 'none'}`,
              ...(effects.length > 0 ? [effects.join(', ')] : []),
              `${names.length} monkey${names.length === 1 ? '' : 's'}: ${names.join(', ')}`,
            ].join('; ');
          })()
        : (() => {
            const pieces = state.furniture.filter((f) => f.room === r.id).length;
            const serves = servedBy(state, r).map((d) => roomName(state, d));
            return `${pieces} piece${pieces === 1 ? '' : 's'} of furniture; ${serves.length > 0 ? `lounge of ${serves.join(', ')}` : 'lounge of no office: each takes its nearest'}`;
          })();
    const locked = open.has(r.id) ? '' : '   NO WAY IN: add a door or hallway';
    const chi = state.fengShuiBook ? `chi ${pct(roomChi(state, r)).padStart(4)}   ` : '';
    return `  ${String(i + 1).padStart(2)} ${roomName(state, r).padEnd(18)} ${size} ${chi}${detail}${locked}`;
  });
  const furnished = furnitureKinds.filter((k) => state.furniture.some((f) => f.kind === k.id)).map((k) => `${k.glyph} ${k.name.toLowerCase()}`);
  const underCursor = cursor ? roomAt(state, cursor.x, cursor.y) : undefined;
  const pieceHere = cursor && underCursor ? piece(cursor.x, cursor.y) : -1;
  const where = !cursor
    ? ''
    : underCursor
      ? `Cursor: ${roomName(state, underCursor)}${pieceHere >= 0 && pieceHere !== held ? `, ${furnitureName(state, pieceHere)}` : ''}.`
      : isHall(state, cursor.x, cursor.y)
        ? 'Cursor: hallway.'
        : 'Cursor: outside.';
  return [
    '=== Office ===',
    '',
    ...lines,
    '',
    [...monkeyIconLegend, '[ ] free desk', '/ door', '=== : window', ...furnished].join('   '),
    '',
    ...summary,
    '',
    "Each monkey gets a desk in its department's room. Every room needs a way in from room 1: doors (/) and hallways.",
    "A department enjoys the furniture in its room and in its lounge: the nearest break room by a door or hallway",
    `(as near: the biggest, then the most furnished). Happiness: +points, slower tiring, faster breaks.${state.fengShuiBook ? ` Feng shui: chi ${pct(officeChi(state))} adds +${pct(chiHappiness(state))} everywhere.` : ''}`,
    ...(state.fengShuiBook ? ['[b] read the feng shui book again: what each room needs for good chi.'] : []),
    ...roomlessDepartments(state).map((g) => `The ${genreNames[g]} department needs a room: press [r] to buy one.`),
    `New room: ${price(roomCost(state), state.currency)} ${theme.currency}. One more square for a room: ${price(squareCost(state), state.currency)} ${theme.currency}.`,
    '',
    ...(grow
      ? [`Growing the ${roomName(state, grow)}: move to a + and press [enter] to buy that square.`, '[arrows] move   [x] or [esc] done']
      : held >= 0
        ? (() => {
            const [w, h] = pieceSize(state.furniture[held].kind, state.furniture[held].turned);
            const big = w * h > 1;
            return [
              `Moving the ${furnitureName(state, held)}${big ? ` (${w} x ${h} squares, from the top left)` : ''}.`,
              `[arrows] move   [tab] next room   [space] put it down   ${big ? '[r] turn   ' : ''}[i] inspect   [esc] cancel`,
            ];
          })()
        : heldDoor
          ? [`Moving a door: the ${sideName[heldDoor]} wall of this square.`, '[arrows] move   [space] put it in   [r] next wall   [esc] cancel']
          : [
              `${where}   [arrows] move   [tab] next room   [space] pick up furniture or a door   [i] inspect   [x] grow this room`.trim(),
              '[d] door on this square (again: next wall, then none)   [w] window (outside walls)   [h] hallway here on/off   [r] buy a room   [esc] back',
            ]),
    '',
    message,
  ].join('\n');
}

/**
 * What inspecting a square of the office map shows: the piece being held, or
 * the one there (a desk says who sits at it), else a window in its walls, else
 * nothing of interest. `book` is the piece hiding the feng shui book, or -1.
 */
export function inspectSquare(state: GameState, x: number, y: number, held = -1): { text: string; book: number } {
  const room = roomAt(state, x, y);
  const spot = held >= 0 ? held : room ? cellAt(state, room.id, x, y) : 'floor';
  if (typeof spot === 'number') {
    const f = state.furniture[spot];
    if (f.kind === desk.id) {
      const own = state.office.find((r) => r.id === f.room);
      const who = own ? departmentMonkeys(state, roomGenre(state, own))[roomDesks(state, own).indexOf(spot)] : undefined;
      return { text: `${who === undefined ? 'An empty desk.' : `${monkeyName(state, who)}'s desk.`} ${desk.description}`, book: -1 };
    }
    const k = furnitureKinds.find((x) => x.id === f.kind);
    const book = hidesBook(state, spot);
    return { text: [k?.description ?? fengShui.nothing, ...(book ? [fengShui.found, '[y] read it'] : [])].join('  '), book: book ? spot : -1 };
  }
  if (room && (['n', 'e', 's', 'w'] as Side[]).some((s) => windowAt(state, x, y, s))) return { text: fengShui.window, book: -1 };
  return { text: fengShui.nothing, book: -1 };
}

/** The feng shui book: the five rules, the elements, and what each room keeps and lacks. */
export function renderFengShuiBook(state: GameState): string {
  const kinds = [desk, ...furnitureKinds];
  const byElement = elements.map((e) => {
    const names = kinds.filter((k) => elementOf(k.id) === e).map((k) => k.name.toLowerCase());
    return `  ${e[0].toUpperCase()}${e.slice(1).padEnd(6)} ${names.join(', ')}`;
  });
  const open = connectedRooms(state);
  const rooms = state.office.map((r, i) => {
    const kept = roomRules(state, r);
    const lacks = chiRules.filter((x) => !kept[x.id]).map((x) => x.name);
    const state_ = open.has(r.id) ? (lacks.length === 0 ? 'perfect' : `lacks ${lacks.join(', ')}`) : 'no way in: it counts for nothing';
    return `  ${String(i + 1).padStart(2)} ${roomName(state, r).padEnd(18)} chi ${pct(roomChi(state, r)).padStart(4)}   ${state_}`;
  });
  return [
    '=== The Way of the Typewriter: feng shui for monkeys ===',
    '',
    '"Chi enters by the door, wanders the room, and leaves the way it came.',
    ' A monkey who cannot see the door will never truly rest."',
    '',
    'General guidelines for placing furniture. The more of the five a room follows, the better',
    `its chi; good chi across the office makes every monkey happier, up to +${pct(fengShui.maxHappiness)}.`,
    '',
    ...chiRules.map((x) =>
      x.department === x.break
        ? `  ${x.name.padEnd(8)} ${x.department}.`
        : `  ${x.name.padEnd(8)} ${x.department}; in a break room, ${x.break}.`,
    ),
    '',
    'The elements:',
    ...byElement,
    '',
    ...rooms,
    '',
    `Office chi ${pct(officeChi(state))}: +${pct(chiHappiness(state))} happiness.`,
    '',
    '[b] or [esc] back to the map',
  ].join('\n');
}
