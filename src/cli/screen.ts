import { generators, theme, upgrades } from '../game/config';
import { clickValue, generatorCost, owned, productionPerSecond } from '../game/logic';
import type { GameState } from '../game/state';
import { formatNumber } from '../format';

/** A shop entry the player buys by pressing its key. */
export interface ShopItem {
  key: string;
  kind: 'generator' | 'upgrade';
  id: string;
}

/** Generators then unbought upgrades, numbered 1-9. */
export function shopItems(state: GameState): ShopItem[] {
  const items: Omit<ShopItem, 'key'>[] = [
    ...generators.map((g) => ({ kind: 'generator' as const, id: g.id })),
    ...upgrades
      .filter((u) => !state.upgrades.includes(u.id))
      .map((u) => ({ kind: 'upgrade' as const, id: u.id })),
  ];
  return items.slice(0, 9).map((item, i) => ({ ...item, key: String(i + 1) }));
}

/** Renders the whole game screen as plain text. */
export function renderScreen(state: GameState, message = ''): string {
  const c = theme.currency;
  const lines = [
    `=== ${theme.title} ===`,
    '',
    `${formatNumber(state.currency)} ${c}   (+${formatNumber(productionPerSecond(state))}/sec)`,
    '',
  ];

  let section = '';
  for (const item of shopItems(state)) {
    if (item.kind !== section) {
      section = item.kind;
      lines.push(section === 'generator' ? 'Generators' : 'Upgrades');
    }
    if (item.kind === 'generator') {
      const def = generators.find((g) => g.id === item.id)!;
      const cost = generatorCost(def, owned(state, def.id));
      const mark = state.currency >= cost ? '*' : ' ';
      lines.push(
        `  [${item.key}] ${mark}${def.name} x${owned(state, def.id)}  +${formatNumber(def.production)}/s each  cost ${formatNumber(cost)}`,
      );
    } else {
      const def = upgrades.find((u) => u.id === item.id)!;
      const mark = state.currency >= def.cost ? '*' : ' ';
      lines.push(`  [${item.key}] ${mark}${def.name}: ${def.description}  cost ${formatNumber(def.cost)}`);
    }
  }

  lines.push(
    '',
    `[space] ${theme.clickAction} +${formatNumber(clickValue(state))}   [1-9] buy (* = affordable)   [s] save   [r] reset   [q] quit`,
    '',
    message,
  );
  return lines.join('\n');
}
