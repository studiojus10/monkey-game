import { enigma, letterValues, safes } from './config';
import { randomKey } from './enigma';
import { getPlay, telegramSettings, unlockGreek } from './logic';
import type { GameState } from './state';

/** A development tool for testing: a label and what it does to the game. */
export interface DevTool {
  label: string;
  apply(state: GameState): void;
}

/** Development tools, in menu order ([1], [2], ...). Add new ones here. */
export const devTools: DevTool[] = [
  {
    label: 'Add 1 billion bananas',
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
  {
    label: 'Finish the first play you own (to try publishing a Folio)',
    apply(state) {
      const play = getPlay(state.owned[0]?.split(':')[0] ?? '');
      if (!play) return;
      state.completed[play.id] = play.lines.map((_, i) => i);
      if (!state.playsDone.includes(play.id)) state.playsDone.push(play.id);
    },
  },
  {
    label: 'Find the Greek scroll (opens the Greek department)',
    apply(state) {
      if (!Object.values(state.safes).some((x) => x.open && x.held === safes.contents[0])) state.safes['dev'] = { level: 0, combo: '00000', tries: 0, open: true, held: safes.contents[0] };
      unlockGreek(state);
    },
  },
  {
    label: 'Send a telegram in Enigma, with the Bombe built',
    apply(state) {
      const n = state.telegrams.length;
      state.telegrams.push({ key: randomKey(enigma.leads + n, Math.random), tested: 0, keyAt: 1 + Math.floor(Math.random() * telegramSettings(n)), read: false });
      for (const id of ['cribs', 'bombe']) if (!state.researched.includes(id)) state.researched.push(id);
    },
  },
];
