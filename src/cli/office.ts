import { desk, furnitureKinds, theme } from '../game/config';
import {
  departmentMonkeys,
  expansionSquares,
  monkeyName,
  roomBounds,
  roomCost,
  roomDesks,
  roomGenre,
  roomlessDepartments,
  squareCost,
  drainCut,
  restBoost,
  happiness,
} from '../game/logic';
import type { Furniture, GameState, Room } from '../game/state';
import { genreNames, iconOf, monkeyIconLegend, price } from './screen';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Widest the map may get before rooms wrap onto the next row. */
export const officeMapWidth = 76;

/** A square of the office map: a room and a position on its grid. */
export type Cell = Omit<Furniture, 'kind'>;

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

/**
 * One room drawn top-down, any shape: its name, then its squares three
 * characters wide inside walls. While expanding, the squares it could grow
 * into show as +.
 */
function roomBox(state: GameState, room: Room, cursor: Cell | null, held: number, expanding: boolean): string[] {
  const has = (x: number, y: number) => room.cells.some(([cx, cy]) => cx === x && cy === y);
  const growing = expanding && cursor?.room === room.id;
  const options = growing ? expansionSquares(room) : [];
  const b = roomBounds(room);
  const m = growing ? 1 : 0;
  const [minX, maxX, minY, maxY] = [b.minX - m, b.maxX + m, b.minY - m, b.maxY + m];
  const desks = roomDesks(state, room);
  const sitters = room.kind === 'department' ? departmentMonkeys(state, roomGenre(state, room)) : [];

  const cell = (x: number, y: number): string => {
    const here = cursor?.room === room.id && cursor.x === x && cursor.y === y;
    let text: string;
    if (here && held >= 0) text = ` ${glyphOf(state.furniture[held].kind)} `; // a piece being moved shows under the cursor
    else if (!has(x, y)) text = options.some(([ox, oy]) => ox === x && oy === y) ? ' + ' : '   ';
    else {
      const f = state.furniture.findIndex((p, i) => i !== held && p.room === room.id && p.x === x && p.y === y);
      if (f < 0) text = ' . ';
      else if (state.furniture[f].kind === desk.id) {
        const monkey = state.monkeys[sitters[desks.indexOf(f)]];
        text = !monkey ? '[ ]' : `${monkey.manager ? '&' : ' '}${iconOf(monkey)}`; // icons are two columns wide
      } else text = ` ${glyphOf(state.furniture[f].kind)} `;
    }
    if (!here) return text;
    return text.length === 3 && text.codePointAt(1)! > 0xffff ? `>${text.slice(1)}` : `>${text[1]}<`;
  };
  // Walls run between a square of the room and one outside it; + only where they turn or meet.
  const corner = (x: number, y: number) => {
    const up = has(x - 1, y - 1) !== has(x, y - 1);
    const down = has(x - 1, y) !== has(x, y);
    const left = has(x - 1, y - 1) !== has(x - 1, y);
    const right = has(x, y - 1) !== has(x, y);
    if ((up || down) && (left || right)) return '+';
    return up || down ? '|' : left || right ? '-' : ' ';
  };
  const lines: string[] = [];
  for (let y = minY; y <= maxY + 1; y++) {
    let wall = '';
    for (let x = minX; x <= maxX; x++) wall += corner(x, y) + (has(x, y - 1) !== has(x, y) ? '---' : '   ');
    wall += corner(maxX + 1, y);
    if (/[-+]/.test(wall)) lines.push(wall); // a row of only side walls adds nothing
    if (y > maxY) break;
    let row = '';
    for (let x = minX; x <= maxX; x++) row += (has(x - 1, y) !== has(x, y) ? '|' : ' ') + cell(x, y);
    lines.push(row + (has(maxX, y) ? '|' : ' '));
  }
  const name = roomName(state, room);
  const width = Math.max(name.length, (maxX - minX + 1) * 4 + 1);
  return [name, ...lines].map((l) => l.padEnd(width));
}

/** The name of a piece of furniture, lower case. */
export function furnitureName(state: GameState, index: number): string {
  const f = state.furniture[index];
  return f?.kind === desk.id ? 'desk' : (furnitureKinds.find((k) => k.id === f?.kind)?.name ?? 'furniture').toLowerCase();
}

/**
 * The office map: every room with its desks, who sits at them, and the
 * furniture. `cursor` marks the selected square; `held` is the furniture being
 * moved (an index into state.furniture), or -1; `expanding` shows where the
 * cursor's room can grow.
 */
export function renderOffice(state: GameState, message = '', cursor: Cell | null = null, held = -1, expanding = false): string {
  const boxes = state.office.map((r) => roomBox(state, r, cursor, held, expanding));

  // Rooms side by side, wrapping onto a new row when the map gets too wide.
  const map: string[] = [];
  let row: string[][] = [];
  const flush = () => {
    const height = Math.max(...row.map((b) => b.length));
    for (let y = 0; y < height; y++) map.push(row.map((b) => b[y] ?? ' '.repeat(b[0].length)).join('  ').trimEnd());
    map.push('');
    row = [];
  };
  for (const b of boxes) {
    const width = [...row, b].reduce((n, x) => n + x[0].length + 2, -2);
    if (row.length > 0 && width > officeMapWidth) flush();
    row.push(b);
  }
  if (row.length > 0) flush();

  const summary = state.office.map((r) => {
    const size = `${r.cells.length} squares`.padEnd(11);
    if (r.kind === 'department') {
      const names = departmentMonkeys(state, roomGenre(state, r)).map((i) => monkeyName(state, i));
      const cut = drainCut(state, roomGenre(state, r));
      const decor = cut > 0 ? `tire ${pct(cut)} slower; ` : '';
      return `  ${roomName(state, r).padEnd(18)} ${size} ${decor}${names.length} monkey${names.length === 1 ? '' : 's'}: ${names.join(', ')}`;
    }
    const pieces = state.furniture.filter((f) => f.room === r.id).length;
    return `  ${roomName(state, r).padEnd(18)} ${size} ${pieces} piece${pieces === 1 ? '' : 's'} of furniture`;
  });
  const furnished = furnitureKinds.filter((k) => state.furniture.some((f) => f.kind === k.id)).map((k) => `${k.glyph} ${k.name.toLowerCase()}`);
  const room = state.office.find((r) => r.id === cursor?.room);
  return [
    '=== Office ===',
    '',
    ...map,
    [...monkeyIconLegend, '[ ] free desk', ...furnished].join('   '),
    '',
    ...summary,
    '',
    "Each monkey gets a desk in its department's room, so floor space limits a department.",
    `Breaks go ${pct(restBoost(state))} faster (comforts in break rooms). Happiness: +${pct(happiness(state))} points (all furniture).`,
    ...roomlessDepartments(state).map((g) => `The ${genreNames[g]} department needs a room: buy one in the Real estate store.`),
    `New room: ${price(roomCost(state), state.currency)} ${theme.currency}. One more square for a room: ${price(squareCost(state), state.currency)} ${theme.currency}.`,
    '',
    ...(expanding && room
      ? [
          `Growing the ${roomName(state, room)}: move to a + and press [enter] to buy that square.`,
          '[arrows] move   [tab] next room   [x] or [esc] done',
        ]
      : held >= 0
        ? [`Moving the ${furnitureName(state, held)}.`, '[arrows] move   [tab] next room   [enter] put it down   [esc] cancel']
        : ['[arrows] move   [tab] next room   [enter] pick up furniture   [x] grow a room   [esc] back']),
    '',
    message,
  ].join('\n');
}
