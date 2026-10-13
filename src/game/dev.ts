import { letterValues } from './config';
import type { GameState } from './state';

/** A development tool for testing: a label and what it does to the game. */
export interface DevTool {
  label: string;
  apply(state: GameState): void;
}

/** Development tools, in menu order ([1], [2], ...). Add new ones here. */
export const devTools: DevTool[] = [
  {
    label: 'Add 1 billion points',
    apply(state) {
      state.currency += 1e9;
      state.totalEarned += 1e9;
    },
  },
  {
    label: 'Add 1,000 Lines',
    apply(state) {
      state.lines += 1000;
    },
  },
  {
    label: 'Add 1,000 Sentences',
    apply(state) {
      state.sentences += 1000;
    },
  },
  {
    label: 'Own every letter',
    apply(state) {
      for (const l of Object.keys(letterValues)) if (!state.letters.includes(l)) state.letters.push(l);
    },
  },
];
