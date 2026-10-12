import { describe, expect, it } from 'vitest';
import { combo, letterShop, lineWidth, maxOfflineLetters, maxOfflineSeconds, monkeyShop, typing } from '../src/game/config';
import {
  applyOfflineProgress,
  buyFasterTyping,
  buyLetter,
  buyMonkey,
  comboMultiplier,
  monkeyCost,
  letterCost,
  setWordList,
  chooseFirstLetter,
  lettersPerSecond,
  poke,
  tick,
  typeLetter,
  typingUpgradeCost,
} from '../src/game/logic';
import { createInitialState, createMonkey } from '../src/game/state';

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

describe('buying letters', () => {
  it('costs more for each letter you own', () => {
    expect(letterCost(1)).toBe(letterShop.baseCost);
    expect(letterCost(2)).toBe(letterShop.baseCost * letterShop.costGrowth);
  });

  it('adds a new letter for points, once', () => {
    const s = createInitialState(0);
    expect(buyLetter(s, 't')).toBe(false); // no first letter yet
    chooseFirstLetter(s, 'i');
    s.currency = letterCost(1) * 10;
    expect(buyLetter(s, 'I')).toBe(false);
    expect(buyLetter(s, '!')).toBe(false);
    expect(buyLetter(s, 't')).toBe(true);
    expect(s.letters).toEqual(['I', 'T']);
    expect(s.currency).toBe(letterCost(1) * 9);
    expect(buyLetter(s, 'T')).toBe(false);
  });

  it('longer words become possible and score more', () => {
    setWordList(['IT', 'TI']); // two-letter words: no combo
    try {
      const s = createInitialState(0);
      chooseFirstLetter(s, 'i');
      s.letters.push('T');
      let n = 0;
      // rng picks I (index 0) or T (index 1) to type I T T I.
      const seq = [0, 0.9, 0.9, 0];
      const next = () => seq[n++];
      for (let i = 0; i < 4; i++) typeLetter(s, 0, next);
      // I T -> IT (4); T I -> TI (4)
      expect(s.currency).toBe(8);
      expect(s.monkeys[0].line.map((x) => x.text)).toEqual(['IT', 'TI']);
    } finally {
      setWordList([]);
    }
  });
});

describe('monkeys', () => {
  it('buying a monkey adds a typist and raises the next price', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.currency = monkeyCost(1);
    expect(buyMonkey(s)).toBe(false); // locked until enough letters
    s.letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, monkeyShop.unlockLetters);
    expect(monkeyCost(1)).toBe(monkeyShop.baseCost);
    expect(buyMonkey(s)).toBe(true);
    expect(s.monkeys).toHaveLength(2);
    expect(s.currency).toBe(0);
    expect(buyMonkey(s)).toBe(false);
    expect(monkeyCost(2)).toBeGreaterThan(monkeyCost(1));
  });

  it('every monkey types its own line', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey(), createMonkey());
    tick(s, 10, rng);
    expect(s.currency).toBe(3 * 10 * typing.baseLettersPerSecond);
    for (const m of s.monkeys) expect(m.line).toHaveLength(10 * typing.baseLettersPerSecond);
  });

  it('long absences with many monkeys are estimated past the simulation limit', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys = Array.from({ length: 100 }, createMonkey);
    const letters = 100 * maxOfflineSeconds * typing.baseLettersPerSecond;
    expect(letters).toBeGreaterThan(maxOfflineLetters);
    const earned = applyOfflineProgress(s, maxOfflineSeconds * 1000, rng);
    // With only I, every letter is a 1-point word.
    expect(earned / letters).toBeCloseTo(1, 3);
    expect(s.wordsTyped / letters).toBeCloseTo(1, 3);
  });
});

describe('combos', () => {
  const letters = ['C', 'A', 'T', 'Q', 'U', 'I', 'Z', 'N', 'Y', 'E', 'X'];
  const typeAll = (s: ReturnType<typeof createInitialState>, text: string) => {
    for (const ch of text) typeLetter(s, 0, () => (letters.indexOf(ch) + 0.5) / letters.length);
  };

  it('multiplies a chain by its number of different long words, up to the cap', () => {
    setWordList(['CAT', 'QUIZ', 'ZANY', 'QUAY', 'ZETA']);
    try {
      const s = createInitialState(0);
      s.letters = [...letters];
      const m = s.monkeys[0];
      typeAll(s, 'CAT');
      expect(s.lastWordPoints).toBe(15);
      expect(comboMultiplier(m)).toBe(1); // too short to count
      typeAll(s, 'QUIZ');
      expect(s.lastWordPoints).toBe(88); // first long word: x1
      typeAll(s, 'ZANY');
      expect(comboMultiplier(m)).toBe(2);
      expect(s.lastWordPoints).toBe((15 + 88 + 64) * 2 - (15 + 88)); // 231
      typeAll(s, 'CAT');
      expect(s.lastWordPoints).toBe(30); // short word paid at x2
      typeAll(s, 'QUIZ');
      expect(comboMultiplier(m)).toBe(2); // repeat doesn't count
      typeAll(s, 'QUAY');
      typeAll(s, 'ZETA');
      expect(comboMultiplier(m)).toBe(combo.maxMultiplier);
      typeAll(s, 'X');
      expect(comboMultiplier(m)).toBe(1);
      expect(m.chainPoints).toBe(0);
    } finally {
      setWordList([]);
    }
  });

  it('only I never builds a combo', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    for (let i = 0; i < 50; i++) typeLetter(s, 0, rng);
    expect(comboMultiplier(s.monkeys[0])).toBe(1);
    expect(s.currency).toBe(50);
  });
});
