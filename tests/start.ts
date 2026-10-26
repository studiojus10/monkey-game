import { earlyShopKeys } from '../src/game/logic';
import { createInitialState, createMonkey, monkeyNameFor, type GameState } from '../src/game/state';

/**
 * A game past the opening, as most tests want it: its first monkey hired
 * (no newspaper to wait for), no letter yet, and the shop showing everything.
 * createInitialState() itself starts with the player alone typing A.
 */
export function startedGame(now?: number): GameState {
  const state = createInitialState(now);
  state.introSeen = true;
  state.player = null;
  state.letters = [];
  state.monkeys = [{ ...createMonkey(), number: 1, name: monkeyNameFor(1, []) }];
  state.revealed = [...earlyShopKeys];
  return state;
}
