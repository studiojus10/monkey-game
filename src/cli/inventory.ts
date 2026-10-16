import { hats } from '../game/config';
import { isTemp, monkeyName, typewriterName } from '../game/logic';
import type { GameState } from '../game/state';
import { dyed, iconOf, paint } from './screen';
import { bold, dim, green, inverse, isCursor, keyRow, padVisible, plainText, rule, titleBar } from './style';

/**
 * A menu of monkeys to give something to (a hat, a dye): `notes` says what
 * picking each would do. The cursor's row is inverse.
 */
export function renderMonkeyPicker(state: GameState, title: string, notes: string[], cursor: number, message = '', columns = 0): string {
  const width = Math.max(...state.monkeys.map((_, i) => monkeyName(state, i).length));
  const rows = state.monkeys.map((m, i) => {
    const row = ` ${(i < 9 ? `[${i + 1}]` : '').padEnd(4)} ${dyed(m, iconOf(m))} ${monkeyName(state, i).padEnd(width)}  ${dim(notes[i] ?? '')}`;
    return isCursor(i, cursor) ? inverse(plainText(row)) : row;
  });
  return [
    titleBar(state, 'Give to', columns),
    '',
    ` ${title}`,
    '',
    ...rows,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([['up/down', 'choose'], ['enter', 'give'], ['1-9', 'give'], ['esc', 'done']], columns),
  ].join('\n');
}

/** Something in the inventory: a monkey's typewriter or a hat. */
export type Item = { kind: 'typewriter' } | { kind: 'hat'; id: string };

/** Where items are: a monkey (by index) or storage. */
export type Holder = number | 'storage';

/** The inventory's rows: each monkey's typewriter and hats, then storage's hats. */
export function inventoryRows(state: GameState): { who: Holder; items: Item[] }[] {
  const hatOrder = (a: string, b: string) => hats.findIndex((h) => h.id === a) - hats.findIndex((h) => h.id === b);
  return [
    ...state.monkeys.map((m, i) => ({
      who: i as Holder,
      items: [{ kind: 'typewriter' } as Item, ...[...m.hats].sort(hatOrder).map((id): Item => ({ kind: 'hat', id }))],
    })),
    {
      who: 'storage' as Holder,
      items: Object.keys(state.stored.hats)
        .sort(hatOrder)
        .flatMap((id) => Array.from({ length: state.stored.hats[id] }, (): Item => ({ kind: 'hat', id }))),
    },
  ];
}

/** An item's name as the inventory shows it. */
export function itemName(state: GameState, who: Holder, item: Item): string {
  if (item.kind === 'typewriter') return typeof who === 'number' ? typewriterName(state.monkeys[who].typewriter) : 'typewriter';
  return hats.find((h) => h.id === item.id)?.name ?? item.id;
}

/**
 * The inventory: every monkey with its typewriter and the hats it has (the
 * one it wears green, in its dye), then hats in storage. The cursor's item
 * is inverse; `held` is the item being moved, shown above the keys.
 */
export function renderInventory(
  state: GameState,
  row: number,
  col: number,
  held: { who: Holder; item: Item } | null,
  message = '',
  columns = 0,
): string {
  const rows = inventoryRows(state);
  const width = Math.max('Storage'.length, ...state.monkeys.map((_, i) => monkeyName(state, i).length));
  const twWidth = Math.max('TYPEWRITER'.length, ...state.monkeys.map((m) => typewriterName(m.typewriter).length));
  const lines = rows.map((r, k) => {
    const cell = (item: Item, c: number) => {
      const name = itemName(state, r.who, item);
      const m = typeof r.who === 'number' ? state.monkeys[r.who] : undefined;
      const worn = item.kind === 'hat' && m?.hat === item.id;
      const text = item.kind === 'hat' ? `${hats.find((h) => h.id === item.id)?.icon ?? ''} ${name}${worn ? ' (on)' : ''}` : name;
      if (isCursor(k, row) && c === col) return inverse(text);
      return worn ? green(m!.hatColor ? paint(m!.hatColor, text) : text) : text;
    };
    const items = r.items.map((item, c) => cell(item, c));
    if (r.who === 'storage') {
      const empty = isCursor(k, row) ? inverse('(empty)') : dim('(empty)');
      return ` ${'   '}${'Storage'.padEnd(width)}  ${' '.repeat(twWidth)}  ${items.length > 0 ? items.join('   ') : empty}`;
    }
    const m = state.monkeys[r.who];
    const [tw, ...hatCells] = items;
    return ` ${dyed(m, iconOf(m))} ${monkeyName(state, r.who).padEnd(width)}  ${padVisible(isTemp(m) ? dim(plainText(tw)) : tw, twWidth)}  ${hatCells.length > 0 ? hatCells.join('   ') : dim('no hats')}`;
  });
  return [
    titleBar(state, 'Inventory', columns),
    '',
    dim(' Move hats between monkeys and storage, and swap typewriters. Skill stays with the monkey.'),
    '',
    dim(` ${'   '}${'MONKEY'.padEnd(width)}  ${'TYPEWRITER'.padEnd(twWidth)}  HATS`),
    ...lines,
    '',
    ...(held ? [` Moving: ${bold(itemName(state, held.who, held.item))}${held.who === 'storage' ? ' from storage' : ` from ${monkeyName(state, held.who)}`}. Put it on a monkey${held.item.kind === 'hat' ? ' or in storage' : ''}.`] : []),
    ...(message ? [` ${bold(message)}`] : []),
    rule(columns),
    keyRow(
      held
        ? [['arrows', 'move'], ['enter', held.item.kind === 'hat' ? 'give it here' : 'swap here'], ['esc', 'cancel']]
        : [['arrows', 'move'], ['enter', 'pick up'], ['w', 'wear / take off'], ['esc', 'back']],
      columns,
    ),
  ].join('\n');
}
