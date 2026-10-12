import { describe, expect, it } from 'vitest';
import { combo, letterShop, lineWidth, maxOfflineLetters, maxOfflineSeconds, maxPinnedLines, monkeyShop, typewriterKeys, typing } from '../src/game/config';
import {
  applyOfflineProgress,
  buyFasterTyping,
  buyLetter,
  buyCapRaise,
  availableKeys,
  buyHeavier,
  buyKey,
  buyMonkey,
  monkeyName,
  renameMonkey,
  buySlot,
  heavierCost,
  keyCost,
  keyboard,
  keysUnlocked,
  missingLetters,
  moveSlot,
  setSlotWord,
  slotCost,
  toggleSlot,
  reachableLines,
  togglePin,
  capRaiseCost,
  chooseStarterPlay,
  comboCap,
  comboMultiplier,
  monkeyCost,
  letterCost,
  setPlays,
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
  it('buying a monkey costs Lines and raises the next price', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.currency = 1e12;
    expect(buyMonkey(s)).toBe(false); // points don't buy monkeys
    s.lines = monkeyCost(1);
    expect(monkeyCost(1)).toBe(monkeyShop.baseCost);
    expect(buyMonkey(s)).toBe(true);
    expect(s.monkeys).toHaveLength(2);
    expect(s.lines).toBe(0);
    expect(buyMonkey(s)).toBe(false);
    expect(monkeyCost(2)).toBeGreaterThan(monkeyCost(1));
  });

  it('monkeys can be named, and fall back to M-<number>', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    expect(monkeyName(s, 1)).toBe('M-2');
    expect(renameMonkey(s, 1, '  Bubbles  the  Great ')).toBe(false); // too long once trimmed
    expect(renameMonkey(s, 1, ' Bubbles ')).toBe(true);
    expect(monkeyName(s, 1)).toBe('Bubbles');
    expect(renameMonkey(s, 1, 'Bad*Name')).toBe(false);
    expect(renameMonkey(s, 5, 'Nobody')).toBe(false);
    expect(renameMonkey(s, 1, '')).toBe(true);
    expect(monkeyName(s, 1)).toBe('M-2');
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
      expect(comboMultiplier(s, m)).toBe(1); // too short to count
      typeAll(s, 'QUIZ');
      expect(s.lastWordPoints).toBe(88); // first long word: x1
      typeAll(s, 'ZANY');
      expect(comboMultiplier(s, m)).toBe(2);
      expect(s.lastWordPoints).toBe((15 + 88 + 64) * 2 - (15 + 88)); // 231
      typeAll(s, 'CAT');
      expect(s.lastWordPoints).toBe(30); // short word paid at x2
      typeAll(s, 'QUIZ');
      expect(comboMultiplier(s, m)).toBe(2); // repeat doesn't count
      typeAll(s, 'QUAY');
      typeAll(s, 'ZETA');
      expect(comboMultiplier(s, m)).toBe(combo.maxMultiplier);
      typeAll(s, 'X');
      expect(comboMultiplier(s, m)).toBe(1);
      expect(m.chainPoints).toBe(0);
    } finally {
      setWordList([]);
    }
  });

  it('only I never builds a combo', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    for (let i = 0; i < 50; i++) typeLetter(s, 0, rng);
    expect(comboMultiplier(s, s.monkeys[0])).toBe(1);
    expect(s.currency).toBe(50);
  });
});

describe('combo cap', () => {
  it('is raised with Sentences', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    expect(comboCap(s)).toBe(combo.maxMultiplier);
    expect(buyCapRaise(s)).toBe(false);
    s.sentences = capRaiseCost(0);
    expect(buyCapRaise(s)).toBe(true);
    expect(s.sentences).toBe(0);
    expect(comboCap(s)).toBe(combo.maxMultiplier + 1);
    expect(capRaiseCost(1)).toBeGreaterThan(capRaiseCost(0));
  });
});

describe('the play', () => {
  const play = {
    id: 'test',
    title: 'Test',
    lines: [
      [1, 1, 'HAMLET', 'No.'],
      [1, 2, 'POLONIUS', 'Ay, my lord.'],
      [2, 1, 'HAMLET', 'No!'],
    ] as [number, number, string, string][],
  };
  const letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D', 'N', 'X'];
  const typeAll = (s: ReturnType<typeof createInitialState>, text: string) => {
    for (const ch of text) typeLetter(s, 0, () => (letters.indexOf(ch) + 0.5) / letters.length);
  };
  const setup = () => {
    setWordList([]); // only the play's own words can score
    setPlays([play]);
    const s = createInitialState(0);
    expect(chooseStarterPlay(s, 'nope')).toBe(false);
    expect(chooseStarterPlay(s, 'test')).toBe(true);
    expect(chooseStarterPlay(s, 'test')).toBe(false); // only once
    s.letters = [...letters];
    return s;
  };

  it('a line typed word for word pays a Line, a Sentence and a bonus the first time', () => {
    try {
      const s = setup();
      typeAll(s, 'AYMYLORD');
      expect(s.completed.test).toEqual([1]);
      expect(s.lines).toBe(1);
      expect(s.sentences).toBe(1);
      // (AY 10 + MY 14 + LORD 20) x 3 words squared
      expect(s.lastLine).toEqual({ play: 'test', index: 1, firstTime: true, points: 44 * 9, sentence: true });

      typeAll(s, 'XAYMYLORD'); // again: a Sentence, but no Line or bonus
      expect(s.lines).toBe(1);
      expect(s.sentences).toBe(2);
      expect(s.lastLine?.firstTime).toBe(false);
    } finally {
      setPlays([]);
    }
  });

  it('short lines pay a Line but no Sentence, and identical lines are written one at a time', () => {
    try {
      const s = setup();
      typeAll(s, 'NO');
      expect(s.completed.test).toEqual([0]);
      typeAll(s, 'XNO');
      expect(s.completed.test).toEqual([0, 2]);
      typeAll(s, 'XNO');
      expect(s.lines).toBe(2);
      expect(s.sentences).toBe(0);
    } finally {
      setPlays([]);
    }
  });

  it('a line can end a longer chain', () => {
    try {
      const s = setup();
      typeAll(s, 'MYLORDNO');
      expect(s.completed.test).toEqual([0]);
    } finally {
      setPlays([]);
    }
  });

  it('a skipped letter breaks a line', () => {
    try {
      const s = setup();
      typeAll(s, 'AYMYXLORD');
      expect(s.completed.test).toEqual([]);
    } finally {
      setPlays([]);
    }
  });
});

describe('typewriter keys', () => {
  const thirteen = 'ABCDEFGHILNOTRSUWYQ'.split(''); // enough for keys like THE, ING, QU
  const fresh = (letters: string[]) => {
    const s = createInitialState(0);
    s.letters = [...letters];
    return s;
  };

  it('unlock once you own enough letters', () => {
    const s = fresh(thirteen.slice(0, typewriterKeys.unlockLetters - 1));
    s.currency = 1e15;
    expect(keysUnlocked(s)).toBe(false);
    expect(availableKeys(s)).toEqual([]);
    expect(buyHeavier(s, 'A')).toBe(false);
    s.letters.push(thirteen[typewriterKeys.unlockLetters - 1]);
    expect(keysUnlocked(s)).toBe(true);
  });

  it('only offers keys spelled with your letters, once each', () => {
    const s = fresh(thirteen);
    s.currency = 1e15;
    expect(availableKeys(s)).toContain('THE');
    expect(availableKeys(s)).toContain('QU');
    expect(availableKeys(s)).not.toContain('LOVE'); // no V
    expect(buyKey(s, 'THE')).toBe(true);
    expect(buyKey(s, 'THE')).toBe(false);
    expect(buyKey(s, 'ZZZ')).toBe(false);
    expect(s.keys).toEqual(['THE']);
  });

  it('word keys cost more than combination keys, and heavier levels double in price', () => {
    const s = fresh(thirteen);
    expect(keyCost(s, 'THE')).toBeGreaterThan(keyCost(s, 'TH'));
    const first = heavierCost(s, 'E');
    s.currency = first;
    expect(buyHeavier(s, 'E')).toBe(true);
    expect(s.heavy.E).toBe(1);
    expect(heavierCost(s, 'E')).toBeCloseTo(first * 2, -1);
    expect(buyHeavier(s, 'Z')).toBe(false); // not owned
  });

  it('heavier letters and keys change what monkeys press', () => {
    const s = fresh(['A', 'B']);
    s.heavy.A = 2; // A weight 3, B weight 1
    expect(keyboard(s)).toEqual([
      { text: 'A', weight: 3 },
      { text: 'B', weight: 1 },
    ]);
    s.keys.push('AB');
    // total weight 5: rng 0.7 -> 3.5 lands on B, 0.9 -> 4.5 on the AB key
    setWordList(['AB']);
    try {
      typeLetter(s, 0, () => 0.9);
      expect(s.lastWord).toBe('AB');
      expect(s.monkeys[0].line.map((x) => x.text)).toEqual(['AB']);
    } finally {
      setWordList([]);
    }
  });
});

describe('pinned lines', () => {
  it('pin and unpin up to the limit, and know what each line needs', () => {
    setPlays([
      {
        id: 'p',
        title: 'P',
        lines: Array.from({ length: maxPinnedLines + 2 }, (_, i): [number, number, string, string] => [1, 1, 'X', i % 2 ? 'Ay me.' : 'I.']),
      },
    ]);
    try {
      const s = createInitialState(0);
      chooseStarterPlay(s, 'p');
      chooseFirstLetter(s, 'i');
      for (let i = 0; i < maxPinnedLines; i++) expect(togglePin(s, i)).toBe(true);
      expect(togglePin(s, maxPinnedLines)).toBe(false);
      expect(togglePin(s, 0)).toBe(true); // unpin
      expect(s.pinned).not.toContain(0);
      expect(togglePin(s, 999)).toBe(false);
      expect(missingLetters(s, 'AYME')).toEqual(['A', 'E', 'M', 'Y']);
      s.completed.p = [0];
      expect(reachableLines(s)).toEqual([2, 4, 6]);
    } finally {
      setPlays([]);
    }
  });
});

describe('word slots', () => {
  const letters = 'AYMLORDNXEISTH'.split(''); // 14 letters: slots unlocked
  const setup = () => {
    setWordList(['AY', 'MY', 'LORD', 'NO', 'IS', 'THE']);
    const s = createInitialState(0);
    s.letters = [...letters];
    return s;
  };

  it('cost Lines, unlock with enough letters, and start at the first free position', () => {
    const s = setup();
    try {
      expect(buySlot(s)).toBe(false); // no Lines
      s.lines = slotCost(0) + slotCost(1);
      expect(buySlot(s)).toBe(true);
      expect(buySlot(s)).toBe(true);
      expect(s.slots.map((x) => x.position)).toEqual([1, 2]);
      expect(s.lines).toBe(0);
      const few = createInitialState(0);
      few.letters = ['A'];
      few.lines = 100;
      expect(buySlot(few)).toBe(false);
    } finally {
      setWordList([]);
    }
  });

  it('only take words you can spell, and can be moved and switched off', () => {
    const s = setup();
    try {
      s.lines = 100;
      buySlot(s);
      buySlot(s);
      expect(setSlotWord(s, 0, 'lord')).toBe(true);
      expect(setSlotWord(s, 0, 'ZEBRA')).toBe(false);
      expect(s.slots[0].word).toBe('LORD');
      expect(moveSlot(s, 0, 1)).toBe(true); // 2 is taken, so it jumps to 3
      expect(s.slots[0].position).toBe(3);
      expect(moveSlot(s, 1, -1)).toBe(true); // 1 is free now
      expect(moveSlot(s, 1, -1)).toBe(false); // can't go below 1
      expect(toggleSlot(s, 0)).toBe(true);
      expect(s.slots[0].on).toBe(false);
    } finally {
      setWordList([]);
    }
  });

  it('force the word at their position in the chain, and do nothing when off', () => {
    const s = setup();
    try {
      s.slots = [
        { position: 1, word: 'AY', on: true },
        { position: 2, word: 'MY', on: true },
        { position: 3, word: 'LORD', on: true },
      ];
      const x = () => (letters.indexOf('X') + 0.5) / letters.length;
      typeLetter(s, 0, x); // slot 1: AY
      typeLetter(s, 0, x); // slot 2: MY
      typeLetter(s, 0, x); // slot 3: LORD
      expect(s.monkeys[0].line.map((seg) => seg.text)).toEqual(['AY', 'MY', 'LORD']);
      typeLetter(s, 0, x); // no slot 4: random X breaks the chain
      expect(s.monkeys[0].chainLength).toBe(0);
      s.slots.forEach((slot) => (slot.on = false));
      typeLetter(s, 0, x);
      expect(s.monkeys[0].line.at(-1)).toEqual({ text: 'X', scored: false });
    } finally {
      setWordList([]);
    }
  });

  it('type slot words as finished words, even ones that could grow', () => {
    const s = setup();
    setWordList(['AY', 'AYS', 'MY', 'MYTH', 'LORD', 'LORDS']);
    try {
      s.slots = [
        { position: 1, word: 'AY', on: true },
        { position: 2, word: 'MY', on: true },
        { position: 3, word: 'LORD', on: true },
      ];
      const x = () => (letters.indexOf('X') + 0.5) / letters.length;
      for (let i = 0; i < 3; i++) typeLetter(s, 0, x);
      expect(s.monkeys[0].line.map((seg) => seg.text)).toEqual(['AY', 'MY', 'LORD']);
      expect(s.monkeys[0].pending).toBe('');
      s.slots.forEach((slot) => (slot.on = false));
      typeLetter(s, 0, x);
      expect(s.monkeys[0].line.at(-1)).toEqual({ text: 'X', scored: false });
    } finally {
      setWordList([]);
    }
  });
});
