import { describe, expect, it } from 'vitest';
import { lineWidth, maxOfflineSeconds, typing } from '../src/game/config';
import {
  applyOfflineProgress,
  buyFasterTyping,
  chooseFirstLetter,
  lettersPerSecond,
  poke,
  tick,
  typeLetter,
  typingUpgradeCost,
} from '../src/game/logic';
import { createInitialState } from '../src/game/state';

const rng = () => 0;

describe('first letter', () => {
  it('can be A or I, and only once', () => {
    const s = createInitialState(0);
    expect(chooseFirstLetter(s, 'z')).toBe(false);
    expect(chooseFirstLetter(s, 'i')).toBe(true);
    expect(chooseFirstLetter(s, 'a')).toBe(false);
    expect(s.letters).toEqual(['I']);
  });

  it('the monkey does not type before a letter is picked', () => {
    const s = createInitialState(0);
    tick(s, 10, rng);
    poke(s, rng);
    expect(s.currency).toBe(0);
    expect(s.monkeys[0].line).toEqual([]);
  });
});

describe('typing', () => {
  it('each one-letter word scores 1 point', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'a');
    typeLetter(s, 0, rng);
    typeLetter(s, 0, rng);
    expect(s.currency).toBe(2);
    expect(s.totalEarned).toBe(2);
    expect(s.wordsTyped).toBe(2);
    expect(s.lastWord).toBe('A');
    expect(s.monkeys[0].line).toEqual([
      { text: 'A', scored: true },
      { text: 'A', scored: true },
    ]);
  });

  it('poking types one extra letter', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    poke(s, rng);
    expect(s.currency).toBe(1);
  });

  it('monkeys type over time, carrying over partial letters', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    tick(s, 10, rng);
    expect(s.currency).toBe(10 * typing.baseLettersPerSecond);
    tick(s, 0.25 / typing.baseLettersPerSecond, rng);
    tick(s, 0.75 / typing.baseLettersPerSecond, rng);
    expect(s.currency).toBe(10 * typing.baseLettersPerSecond + 1);
  });

  it('starts a fresh line when the line is full', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    for (let i = 0; i < lineWidth + 1; i++) typeLetter(s, 0, rng);
    expect(s.monkeys[0].line).toHaveLength(1);
  });

  it('offline typing is credited and capped', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    const earned = applyOfflineProgress(s, (maxOfflineSeconds + 1000) * 1000, rng);
    expect(earned).toBe(maxOfflineSeconds * typing.baseLettersPerSecond);
  });
});

describe('faster typing', () => {
  it('costs points, speeds monkeys up and gets pricier', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    const cost = typingUpgradeCost(0);
    s.currency = cost - 1;
    expect(buyFasterTyping(s)).toBe(false);
    s.currency = cost;
    expect(buyFasterTyping(s)).toBe(true);
    expect(s.currency).toBe(0);
    expect(s.typingLevel).toBe(1);
    expect(typingUpgradeCost(1)).toBeGreaterThan(cost);
    expect(lettersPerSecond(1)).toBe(typing.baseLettersPerSecond * typing.speedPerLevel);
    tick(s, 8, rng);
    expect(s.currency).toBe(Math.floor(8 * lettersPerSecond(1)));
  });
});
