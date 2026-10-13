import { theme, type Room } from '../game/config';
import { deskCells, deskCount, monkeyName, nextRoom, ownedRooms } from '../game/logic';
import type { GameState } from '../game/state';
import { price } from './screen';

/** Widest the map may get before rooms wrap onto the next row. */
export const officeMapWidth = 76;

/** One room drawn top-down: its name, then a box of cells three characters wide. */
function roomBox(state: GameState, room: Room, firstMonkey: number): string[] {
  const desks = deskCells(room);
  const rows: string[] = [];
  for (let y = 0; y < room.height; y++) {
    let row = '';
    for (let x = 0; x < room.width; x++) {
      const d = desks.findIndex(([dx, dy]) => dx === x && dy === y);
      const m = d < 0 ? undefined : state.monkeys[firstMonkey + d];
      row += d < 0 ? ' . ' : !m ? '[ ]' : m.manager ? '[&]' : '[@]';
    }
    rows.push(`|${row}|`);
  }
  const width = room.width * 3 + 2;
  const wall = `+${'-'.repeat(width - 2)}+`;
  return [room.name.slice(0, width).padEnd(width), wall, ...rows, wall];
}

/** The office map: every room you own with its desks and who sits at them. Read-only for now. */
export function renderOffice(state: GameState, message = ''): string {
  const rooms = ownedRooms(state);
  // Monkeys sit at desks in order: the first monkeys in the first room, and so on.
  const starts: number[] = [];
  rooms.reduce((n, r) => (starts.push(n), n + r.desks), 0);
  const boxes = rooms.map((r, i) => roomBox(state, r, starts[i]));

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

  const seated = rooms.map((r, i) => {
    const names = state.monkeys.slice(starts[i], starts[i] + r.desks).map((_, k) => monkeyName(state, starts[i] + k));
    return `  ${r.name.padEnd(16)} ${`${names.length}/${r.desks} desks`.padEnd(12)} ${names.join(', ')}`.trimEnd();
  });
  const next = nextRoom(state);
  return [
    '=== Office ===',
    '',
    ...map,
    '[@] monkey   [&] manager   [ ] free desk',
    '',
    ...seated,
    '',
    `Desks in use: ${state.monkeys.length} of ${deskCount(state)}. Every monkey, managers included, needs a desk.`,
    next
      ? `Next room: ${next.name}, ${next.desks} desks, for ${price(next.cost, state.currency)} ${theme.currency} in the Real estate store.`
      : 'You own every room.',
    '',
    '[esc] back',
    '',
    message,
  ].join('\n');
}
