import { beforeAll, afterAll } from 'vitest';
import { furnitureKinds, hats, type Unlock } from '../src/game/config';

/**
 * Most tests buy furniture and hats without finishing scenes first: this
 * sells everything from the start for the file's tests, and puts the unlocks
 * back afterwards. withUnlocks() turns them on again inside one test.
 */
const saved = new Map<object, Unlock>();
for (const x of [...furnitureKinds, ...hats]) if (x.unlock) saved.set(x, x.unlock);

function clear(): void {
  for (const x of saved.keys()) delete (x as { unlock?: Unlock }).unlock;
}
function restore(): void {
  for (const [x, u] of saved) (x as { unlock?: Unlock }).unlock = u;
}

export function sellEverything(): void {
  beforeAll(clear);
  afterAll(restore);
}

export function withUnlocks(test: () => void): void {
  restore();
  try {
    test();
  } finally {
    clear();
  }
}
