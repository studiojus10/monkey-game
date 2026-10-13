// All player-facing names and balance numbers live here so the game can be
// reskinned or rebalanced without touching the logic.

export const theme = {
  title: 'Idle Game',
  currency: 'Points',
  clickAction: 'Collect',
};

export interface GeneratorDef {
  id: string;
  name: string;
  baseCost: number;
  costGrowth: number; // cost multiplier per owned unit
  production: number; // currency per second per unit
}

export const generators: GeneratorDef[] = [
  { id: 'worker', name: 'Worker', baseCost: 10, costGrowth: 1.15, production: 0.5 },
  { id: 'workshop', name: 'Workshop', baseCost: 100, costGrowth: 1.15, production: 4 },
];

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: { kind: 'clickMultiplier' | 'productionMultiplier'; value: number };
}

export const upgrades: UpgradeDef[] = [
  {
    id: 'better-tools',
    name: 'Better Tools',
    description: 'Clicks are worth 2x.',
    cost: 50,
    effect: { kind: 'clickMultiplier', value: 2 },
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    description: 'All generators produce 2x.',
    cost: 500,
    effect: { kind: 'productionMultiplier', value: 2 },
  },
];

export const baseClickValue = 1;

// Offline progress is capped so a long absence doesn't break balance.
export const maxOfflineSeconds = 8 * 60 * 60;
