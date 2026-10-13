export interface GameState {
  currency: number;
  totalEarned: number;
  generators: Record<string, number>; // generator id -> owned count
  upgrades: string[]; // purchased upgrade ids
  lastSaved: number; // epoch ms
}

export function createInitialState(now = Date.now()): GameState {
  return {
    currency: 0,
    totalEarned: 0,
    generators: {},
    upgrades: [],
    lastSaved: now,
  };
}
