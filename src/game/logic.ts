import {
  baseClickValue,
  generators,
  maxOfflineSeconds,
  upgrades,
  type GeneratorDef,
  type UpgradeDef,
} from './config';
import type { GameState } from './state';

function multiplier(state: GameState, kind: UpgradeDef['effect']['kind']): number {
  return upgrades
    .filter((u) => u.effect.kind === kind && state.upgrades.includes(u.id))
    .reduce((m, u) => m * u.effect.value, 1);
}

export function owned(state: GameState, id: string): number {
  return state.generators[id] ?? 0;
}

export function clickValue(state: GameState): number {
  return baseClickValue * multiplier(state, 'clickMultiplier');
}

export function productionPerSecond(state: GameState): number {
  const base = generators.reduce((sum, g) => sum + g.production * owned(state, g.id), 0);
  return base * multiplier(state, 'productionMultiplier');
}

export function generatorCost(def: GeneratorDef, count: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, count));
}

function earn(state: GameState, amount: number): void {
  state.currency += amount;
  state.totalEarned += amount;
}

export function click(state: GameState): void {
  earn(state, clickValue(state));
}

export function tick(state: GameState, seconds: number): void {
  if (seconds > 0) earn(state, productionPerSecond(state) * seconds);
}

export function buyGenerator(state: GameState, id: string): boolean {
  const def = generators.find((g) => g.id === id);
  if (!def) return false;
  const cost = generatorCost(def, owned(state, id));
  if (state.currency < cost) return false;
  state.currency -= cost;
  state.generators[id] = owned(state, id) + 1;
  return true;
}

export function buyUpgrade(state: GameState, id: string): boolean {
  const def = upgrades.find((u) => u.id === id);
  if (!def || state.upgrades.includes(id) || state.currency < def.cost) return false;
  state.currency -= def.cost;
  state.upgrades.push(id);
  return true;
}

/** Credits production for time spent away. Returns the amount earned. */
export function applyOfflineProgress(state: GameState, now: number): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSaved) / 1000), maxOfflineSeconds);
  const before = state.currency;
  tick(state, seconds);
  return state.currency - before;
}
