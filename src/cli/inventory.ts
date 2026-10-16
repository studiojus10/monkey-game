import { furnitureKinds, hatColors, hats } from '../game/config';
import { hatKey, isTemp, monkeyName, splitHatKey, typewriterName } from '../game/logic';
import type { GameState } from '../game/state';
import { dyed, iconOf, paint } from './screen';
import { bold, dim, inverse, isCursor, keyRow, padVisible, plainText, rule, titleBar } from './style';

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

/** Something on the inventory screen: a monkey's typewriter, a hat (by hatKey), a monkey's empty head, or furniture put away. */
export type Item = { kind: 'typewriter' } | { kind: 'hat'; key: string } | { kind: 'nohat' } | { kind: 'furniture'; id: string };

/** Where items are: a monkey (by index), or the player's inventory (hats, furniture). */
export type Holder = number | 'storage' | 'furniture';

const hatRank = (key: string) => hats.findIndex((h) => h.id === splitHatKey(key).id);

/**
 * The inventory screen's rows: each monkey with its typewriter and the hat it
 * wears, then the player's inventory (Justin, 2026-10-16: one inventory for
 * furniture and cosmetics): hats nobody wears, then furniture put away.
 */
export function inventoryRows(state: GameState): { who: Holder; items: Item[] }[] {
  return [
    ...state.monkeys.map((m, i) => ({
      who: i as Holder,
      items: [{ kind: 'typewriter' } as Item, m.hat ? ({ kind: 'hat', key: hatKey(m.hat, m.hatColor) } as Item) : ({ kind: 'nohat' } as Item)],
    })),
    {
      who: 'storage' as Holder,
      items: Object.keys(state.stored.hats)
        .sort((a, b) => hatRank(a) - hatRank(b) || a.localeCompare(b))
        .flatMap((key) => Array.from({ length: state.stored.hats[key] }, (): Item => ({ kind: 'hat', key }))),
    },
    {
      who: 'furniture' as Holder,
      items: furnitureKinds.filter((k) => state.stored.furniture[k.id]).map((k): Item => ({ kind: 'furniture', id: k.id })),
    },
  ];
}

/** An item's name as the inventory shows it. */
export function itemName(state: GameState, who: Holder, item: Item): string {
  if (item.kind === 'typewriter') return typeof who === 'number' ? typewriterName(state.monkeys[who].typewriter) : 'typewriter';
  if (item.kind === 'nohat') return 'no hat';
  if (item.kind === 'furniture') return furnitureKinds.find((k) => k.id === item.id)?.name ?? item.id;
  const { id, color } = splitHatKey(item.key);
  const name = hats.find((h) => h.id === id)?.name ?? id;
  return color ? `${hatColors.find((c) => c.id === color)?.name.toLowerCase() ?? color} ${name.toLowerCase()}` : name;
}

/**
 * The inventory: every monkey with its typewriter and the hat it wears (in
 * its dye), then your inventory: hats nobody wears and furniture put away.
 * The cursor's item is inverse; `held` is the item being moved, shown above
 * the keys.
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
  const width = Math.max('Furniture'.length, ...state.monkeys.map((_, i) => monkeyName(state, i).length));
  const twWidth = Math.max('TYPEWRITER'.length, ...state.monkeys.map((m) => typewriterName(m.typewriter).length));
  const lines = rows.map((r, k) => {
    const cell = (item: Item, c: number) => {
      const name = itemName(state, r.who, item);
      const count = item.kind === 'furniture' ? state.stored.furniture[item.id] ?? 0 : 1;
      const icon = item.kind === 'hat' ? `${hats.find((h) => h.id === splitHatKey(item.key).id)?.icon ?? ''} ` : '';
      const text = `${icon}${name}${count > 1 ? ` x${count}` : ''}`;
      if (isCursor(k, row) && c === col) return inverse(text);
      if (item.kind === 'nohat') return dim(text);
      const color = item.kind === 'hat' ? splitHatKey(item.key).color : '';
      return color ? paint(color, text) : text;
    };
    const items = r.items.map((item, c) => cell(item, c));
    if (typeof r.who !== 'number') {
      const label = r.who === 'storage' ? 'Hats' : 'Furniture';
      const empty = isCursor(k, row) ? inverse('(none)') : dim('(none)');
      return ` ${'   '}${label.padEnd(width)}  ${items.length > 0 ? items.join('   ') : empty}`;
    }
    const m = state.monkeys[r.who];
    const [tw, hat] = items;
    return ` ${dyed(m, iconOf(m))} ${monkeyName(state, r.who).padEnd(width)}  ${padVisible(isTemp(m) ? dim(plainText(tw)) : tw, twWidth)}  ${hat}`;
  });
  const monkeyRows = lines.slice(0, state.monkeys.length);
  const mine = lines.slice(state.monkeys.length);
  const heldText = held
    ? held.item.kind === 'hat'
      ? `Moving: ${bold(itemName(state, held.who, held.item))}${typeof held.who === 'number' ? ` from ${monkeyName(state, held.who)}` : ' from your inventory'}. Put it on a monkey or in your hats.`
      : `Moving: ${bold(itemName(state, held.who, held.item))} from ${monkeyName(state, held.who as number)}. Put it on another monkey to swap.`
    : '';
  return [
    titleBar(state, 'Inventory', columns),
    '',
    dim(' Your monkeys, then everything you own that is put away. Move hats, swap typewriters (skill stays'),
    dim(' with the monkey), and put furniture back in the office.'),
    '',
    dim(` ${'   '}${'MONKEY'.padEnd(width)}  ${'TYPEWRITER'.padEnd(twWidth)}  HAT`),
    ...monkeyRows,
    '',
    dim(` ${'   '}YOUR INVENTORY`),
    ...mine,
    '',
    ...(heldText ? [` ${heldText}`] : []),
    ...(message ? [` ${bold(message)}`] : []),
    rule(columns),
    keyRow(
      held
        ? [['arrows', 'move'], ['enter', held.item.kind === 'hat' ? 'put it here' : 'swap here'], ['esc', 'cancel']]
        : [['arrows', 'move'], ['enter', 'pick up / place'], ['esc', 'back']],
      columns,
    ),
  ].join('\n');
}
