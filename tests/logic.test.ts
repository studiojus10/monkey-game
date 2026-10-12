import { describe, expect, it } from 'vitest';
import { generators, maxOfflineSeconds } from '../src/game/config';
import {
  applyOfflineProgress,
  buyGenerator,
  buyUpgrade,
  click,
  clickValue,
  generatorCost,
  productionPerSecond,
  tick,
} from '../src/game/logic';
import { createInitialState } from '../src/game/state';

const worker = generators[0];

describe('core loop', () => {
  it('clicking earns currency', () => {
    const s = createInitialState(0);
    click(s);
    expect(s.currency).toBe(1);
    expect(s.totalEarned).toBe(1);
  });

  it('cannot buy a generator without enough currency', () => {
    const s = createInitialState(0);
    expect(buyGenerator(s, worker.id)).toBe(false);
    expect(s.generators[worker.id]).toBeUndefined();
  });

  it('buying a generator spends currency and raises the next cost', () => {
    const s = createInitialState(0);
    s.currency = 1000;
    const first = generatorCost(worker, 0);
    expect(buyGenerator(s, worker.id)).toBe(true);
    expect(s.currency).toBe(1000 - first);
    expect(generatorCost(worker, 1)).toBeGreaterThan(first);
  });

  it('generators produce over time', () => {
    const s = createInitialState(0);
    s.generators[worker.id] = 2;
    tick(s, 10);
    expect(s.currency).toBeCloseTo(worker.production * 2 * 10);
  });

  it('upgrades apply once and multiply output', () => {
    const s = createInitialState(0);
    s.currency = 10_000;
    s.generators[worker.id] = 1;
    const baseRate = productionPerSecond(s);
    expect(buyUpgrade(s, 'better-tools')).toBe(true);
    expect(buyUpgrade(s, 'better-tools')).toBe(false);
    expect(clickValue(s)).toBe(2);
    expect(buyUpgrade(s, 'efficiency')).toBe(true);
    expect(productionPerSecond(s)).toBe(baseRate * 2);
  });

  it('offline progress is credited and capped', () => {
    const s = createInitialState(0);
    s.generators[worker.id] = 1;
    const earned = applyOfflineProgress(s, (maxOfflineSeconds + 1000) * 1000);
    expect(earned).toBeCloseTo(worker.production * maxOfflineSeconds);
  });
});
