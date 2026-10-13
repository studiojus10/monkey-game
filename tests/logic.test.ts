import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { maxSimulatedLettersPerSecond, combo, departmentRules, managers, sonnetRewards, letterShop, milestones, scriptShop, lineWidth, maxOfflineLetters, maxOfflineSeconds, maxPinnedLines, monkeyShop, sentenceRules, furnitureKinds, office, energy, accessories, typewriterKeys, typing } from '../src/game/config';
import {
  applyOfflineProgress,
  chainSentences,
  accessoryCost,
  buyAccessory,
  wearing,
  drainCut,
  energyRates,
  happiness,
  restBoost,
  breakLeft,
  currentSpeed,
  spendEnergy,
  buyFurniture,
  cellAt,
  furnitureSpot,
  furnitureCost,
  moveFurniture,
  buyRoom,
  expandRoom,
  bestExpansion,
  expansionSquares,
  furnishOffice,
  hasDeskSpace,
  roomDesks,
  squareCost,
  departmentRoom,
  canSeatMonkey,
  buyFasterTyping,
  buyTypewriter,
  skillCap,
  typewriterCost,
  typewriterName,
  buyLetter,
  buyCapRaise,
  availableKeys,
  buyKey,
  buyMonkey,
  monkeyName,
  renameMonkey,
  buySlot,
  keyCost,
  wordKeySpellsNeeded,
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
  comboCap,
  comboMultiplier,
  monkeyCost,
  letterCost,
  letterWordsCost,
  setPlays,
  setWordList,
  chooseFirstLetter,
  lettersPerSecond,
  poke,
  tick,
  typeLetter,
  typingUpgradeCost,
  buySection,
  chooseStarterScene,
  departmentChoices,
  manage,
  managerLine,
  departmentMonkeys,
  departmentsWithRoom,
  departmentTypists,
  assignMonkey,
  managerMultiplier,
  managerUpgradeCost,
  toggleManager,
  upgradeManager,
  dictionaryFor,
  departmentGenres,
  departmentPicks,
  monkeyGenre,
  moveMonkey,
  nextDepartmentAt,
  monkeySpeed,
  nextMonkeyCost,
  pointsMultiplier,
  sectionPrice,
  starterScenes,
  getPlay,
  openDepartment,
  currentWork,
  nextOwnedScene,
} from '../src/game/logic';
import { createInitialState, createMonkey, rectangle, type GameState } from '../src/game/state';

// Most tests check typing exactly, so monkeys don't tire unless a test says so.
const drainSeconds = energy.drainSeconds;
beforeEach(() => {
  energy.drainSeconds = Infinity;
});
afterEach(() => {
  energy.drainSeconds = drainSeconds;
});

/** Gives a department a big room, so floor space doesn't get in a test's way. */
function roomFor(s: GameState, genre: string): void {
  s.office.push({ id: `r${s.office.length + 1}`, kind: 'department', department: genre, cells: rectangle(8, 8) });
}

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

  it('runs of one letter (AA, AAA, MM) are never words, even if the word list has them', () => {
    try {
      setWordList(['AA', 'AAA', 'MM', 'AM']);
      const s = createInitialState(0);
      chooseFirstLetter(s, 'a');
      s.letters.push('M');
      expect(dictionaryFor(s).isWord('AA')).toBe(false);
      expect(dictionaryFor(s).isWord('AAA')).toBe(false);
      expect(dictionaryFor(s).isWord('MM')).toBe(false);
      expect(dictionaryFor(s).isWord('AM')).toBe(true);
      for (let i = 0; i < 3; i++) typeLetter(s, 0, rng); // AAA: A, A, and an A that may still become AM
      expect(s.wordsTyped).toBe(2);
      expect(s.lastWord).toBe('A');
      expect(s.monkeys[0].pending).toBe('A');
    } finally {
      setWordList([]);
    }
  });

  it('keeps statistics on letters, words, chains and pets', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    poke(s, rng);
    for (let i = 0; i < 3; i++) typeLetter(s, 0, rng);
    tick(s, 2, rng);
    expect(s.stats.pets).toBe(1);
    expect(s.stats.letters).toEqual({ I: 5 });
    expect(s.stats.words).toEqual({ I: 5 });
    expect(s.words).toBe(1); // one Word: I was new only the first time
    expect(s.stats.longestWord).toBe('I');
    expect(s.stats.bestWord).toBe('I');
    expect(s.stats.longestChain).toBe(5);
    expect(s.stats.secondsTyping).toBe(2);
  });

  it('simulates at most a budget of letters a tick, and credits the rest', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey());
    for (const m of s.monkeys) m.skill = 60; // far more letters a second than the budget
    const due = Math.floor(monkeySpeed(s, s.monkeys[0])) * 2;
    tick(s, 1, rng);
    expect(s.stats.letters.I).toBeLessThanOrEqual(maxSimulatedLettersPerSecond + 1);
    expect(s.currency).toBeCloseTo(due, -2); // every I pays 1 point
    expect(s.wordsTyped).toBeCloseTo(due, -2);
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
    expect(s.monkeys[0].skill).toBe(1);
    expect(typingUpgradeCost(1)).toBeGreaterThan(cost);
    expect(lettersPerSecond(1)).toBe(typing.baseLettersPerSecond * typing.speedPerLevel);
    tick(s, 8, rng);
    expect(s.currency).toBe(Math.floor(8 * lettersPerSecond(1)));
  });

  it('is per monkey and capped by its typewriter, which can be upgraded', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey());
    s.currency = 1e12;
    expect(buyFasterTyping(s, 1)).toBe(true);
    expect(s.monkeys.map((m) => m.skill)).toEqual([0, 1]);
    expect(monkeySpeed(s, s.monkeys[1])).toBeGreaterThan(monkeySpeed(s, s.monkeys[0]));
    while (buyFasterTyping(s, 1));
    expect(s.monkeys[1].skill).toBe(typing.levelsPerTypewriter); // the first typewriter's cap
    expect(skillCap(s.monkeys[1])).toBe(typing.levelsPerTypewriter);
    const price = typewriterCost(s.monkeys[1]);
    expect(price).toBe(typing.typewriterBaseCost);
    const before = s.currency;
    expect(buyTypewriter(s, 1)).toBe(true);
    expect(s.currency).toBe(before - price);
    expect(typewriterName(s.monkeys[1].typewriter)).toBe(typing.typewriters[1]);
    expect(typewriterCost(s.monkeys[1])).toBe(price * typing.typewriterCostGrowth);
    expect(buyFasterTyping(s, 1)).toBe(true);
    expect(s.monkeys[1].skill).toBe(typing.levelsPerTypewriter + 1);
    expect(buyFasterTyping(s, 5)).toBe(false); // no such monkey
  });
});

describe('buying letters', () => {
  it('costs more points and Words for each letter you own', () => {
    expect(letterCost(1)).toBe(letterShop.baseCost);
    expect(letterCost(2)).toBe(letterShop.baseCost * letterShop.costGrowth);
    expect([1, 2, 3, 4, 13].map(letterWordsCost)).toEqual([0, 1, 2, 4, 42]);
  });

  it('adds a new letter for points, once', () => {
    const s = createInitialState(0);
    expect(buyLetter(s, 't')).toBe(false); // no first letter yet
    chooseFirstLetter(s, 'i');
    s.currency = letterCost(1) * 10;
    s.letters.push('A', 'N'); // own 3: the next costs 2 Words
    expect(buyLetter(s, 't')).toBe(false); // no Words yet
    s.words = 3;
    expect(buyLetter(s, 'I')).toBe(false);
    expect(buyLetter(s, '!')).toBe(false);
    expect(buyLetter(s, 't')).toBe(true);
    expect(s.letters).toEqual(['I', 'A', 'N', 'T']);
    expect(s.currency).toBe(letterCost(1) * 10 - letterCost(3));
    expect(s.words).toBe(1);
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
      // Unwritable lines keep every scene unfinished, so milestones stay out of these tests.
      [1, 1, 'GHOST', 'Swear.'],
      [1, 2, 'GHOST', 'Swear.'],
      [2, 1, 'GHOST', 'Swear.'],
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
    s.owned = ['test'];
    s.completed.test = [];
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
    s.letters.push(thirteen[typewriterKeys.unlockLetters - 1]);
    expect(keysUnlocked(s)).toBe(true);
  });

  it('offers combination keys spelled with your letters, once each', () => {
    const s = fresh(thirteen);
    s.currency = 1e15;
    expect(availableKeys(s)).toContain('QU');
    expect(availableKeys(s)).not.toContain('THE'); // words must be spelled first
    expect(buyKey(s, 'QU')).toBe(true);
    expect(buyKey(s, 'QU')).toBe(false);
    expect(buyKey(s, 'ZZZ')).toBe(false);
    expect(s.keys).toEqual(['QU']);
  });

  it('unlocks a word key once it is spelled often enough, needing more spells for each word key owned', () => {
    const s = fresh(thirteen);
    s.currency = 1e15;
    const first = typewriterKeys.wordSpellsToUnlock;
    expect(wordKeySpellsNeeded(s)).toBe(first);
    s.stats.words = { THE: first, AND: first + 5, LORD: first - 1, AT: 500 };
    expect(availableKeys(s)).toContain('THE');
    expect(availableKeys(s)).toContain('AND');
    expect(availableKeys(s)).not.toContain('LORD'); // not spelled enough yet
    expect(availableKeys(s)).not.toContain('AT'); // too short to be a word key
    expect(buyKey(s, 'AND')).toBe(true);
    expect(wordKeySpellsNeeded(s)).toBe(Math.ceil(first * typewriterKeys.wordSpellsGrowth));
    expect(availableKeys(s)).not.toContain('THE'); // now needs more spells
    expect(buyKey(s, 'TH')).toBe(true); // combination keys don't raise it
    expect(wordKeySpellsNeeded(s)).toBe(Math.ceil(first * typewriterKeys.wordSpellsGrowth));
  });

  it('word keys cost by length', () => {
    const s = fresh(thirteen);
    expect(keyCost(s, 'TH')).toBe(typewriterKeys.baseCost * typewriterKeys.combinationCostFactor);
    expect(keyCost(s, 'LORD')).toBe(typewriterKeys.baseCost * typewriterKeys.wordCostPerLetter * 4);
  });

  it('keys change what monkeys press', () => {
    const s = fresh(['A', 'B']);
    expect(keyboard(s)).toEqual([
      { text: 'A', weight: 1 },
      { text: 'B', weight: 1 },
    ]);
    s.keys.push('AB');
    // total weight 3: rng 0.9 -> 2.7 lands on the AB key
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
      expect(togglePin(s, 'p', 0)).toBe(false); // not owned
      s.owned = ['p'];
      chooseFirstLetter(s, 'i');
      for (let i = 0; i < maxPinnedLines; i++) expect(togglePin(s, 'p', i)).toBe(true);
      expect(togglePin(s, 'p', maxPinnedLines)).toBe(false);
      expect(togglePin(s, 'p', 0)).toBe(true); // unpin
      expect(s.pinned.some((p) => p.index === 0)).toBe(false);
      expect(togglePin(s, 'p', 999)).toBe(false);
      expect(missingLetters(s, 'AYME')).toEqual(['A', 'E', 'M', 'Y']);
      s.completed.p = [0];
      expect(reachableLines(s, 'p')).toEqual([2, 4, 6]);
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
        { department: '', position: 1, word: 'AY', on: true },
        { department: '', position: 2, word: 'MY', on: true },
        { department: '', position: 3, word: 'LORD', on: true },
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
        { department: '', position: 1, word: 'AY', on: true },
        { department: '', position: 2, word: 'MY', on: true },
        { department: '', position: 3, word: 'LORD', on: true },
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

describe('departments, the scene shop and milestones', () => {
  const one = {
    id: 'one',
    title: 'One',
    genre: 'comedy' as const,
    lines: [
      [1, 1, 'A', 'Ay, my lord.'],
      [1, 2, 'B', 'No.'],
      [1, 2, 'C', 'Lord.'],
      [2, 1, 'D', 'Normal.'],
    ] as [number, number, string, string][],
  };
  const two = {
    id: 'two',
    title: 'Two',
    genre: 'tragedy' as const,
    lines: [[1, 1, 'E', 'Nay, my lord.']] as [number, number, string, string][],
  };
  const letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D', 'N', 'X'];
  const typeAll = (s: ReturnType<typeof createInitialState>, text: string, monkey = 0) => {
    for (const ch of text) typeLetter(s, monkey, () => (letters.indexOf(ch) + 0.5) / letters.length);
  };

  it('starts with a department and a free scene from its genre', () => {
    try {
      setPlays([one, two]);
      const s = createInitialState(0);
      expect(departmentPicks(s)).toBe(1);
      expect(openDepartment(s, 'tragedy')).toBe(true);
      expect(openDepartment(s, 'comedy')).toBe(false); // the next one needs more monkeys
      expect(starterScenes(s).map((x) => x.play.id)).toEqual(['two']);
      expect(chooseStarterScene(s, 'one', '1.2')).toBe(false); // wrong genre
      expect(chooseStarterScene(s, 'two', '1.1')).toBe(true);
      expect(chooseStarterScene(s, 'two', '1.1')).toBe(false); // only once
      expect(s.owned).toEqual(['two:1.1']);
    } finally {
      setPlays([]);
    }
  });

  it('opens more departments as monkeys grow; each monkey writes only its own genre', () => {
    try {
      setWordList([]);
      setPlays([one, two]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['one', 'two'];
      s.letters = [...letters];
      expect(departmentGenres(s)).toEqual(['comedy', 'tragedy']); // an owned play counts (old saves)
      s.owned = ['one'];
      expect(nextDepartmentAt(s)).toBe(departmentRules.monkeysToOpen[1]);
      while (s.monkeys.length < departmentRules.monkeysToOpen[1]) s.monkeys.push(createMonkey());
      expect(departmentPicks(s)).toBe(1);
      expect(openDepartment(s, 'tragedy')).toBe(true);
      expect(departmentPicks(s)).toBe(0);
      roomFor(s, 'tragedy');
      s.owned = ['one', 'two'];

      typeAll(s, 'NAYMYLORDX', 0); // monkey 0 is in comedies: the tragedy's line doesn't count
      expect(s.completed.two ?? []).toEqual([]);
      expect(moveMonkey(s, 0)).toBe(true);
      expect(monkeyGenre(s, s.monkeys[0])).toBe('tragedy');
      typeAll(s, 'NAYMYLORDX', 0);
      expect(s.completed.two).toEqual([0]);
      s.completed.one = [];
      typeAll(s, 'AYMYLORDX', 0); // and now comedies don't
      expect(s.completed.one).toEqual([]);
    } finally {
      setPlays([]);
    }
  });

  it('prices scenes by letters, discounts acts and plays, and only sells open departments', () => {
    try {
      setPlays([one, two]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['one:1.1'];
      const play = getPlay('one')!;
      expect(sectionPrice(s, play, 1, '1.1')).toBe(0); // owned
      expect(sectionPrice(s, play, 1, '1.2')).toBe(6 * scriptShop.pointsPerLetter); // NO + LORD
      expect(sectionPrice(s, play, 1)).toBe(Math.ceil(60 * scriptShop.actDiscount));
      expect(sectionPrice(s, play)).toBe(Math.ceil((60 + 60) * scriptShop.playDiscount)); // + NORMAL
      expect(buySection(s, 'one', 1)).toBe(false); // can't afford
      s.currency = 1000;
      expect(buySection(s, 'one', 1)).toBe(true);
      expect(s.owned).toEqual(['one:1']); // the act covers the scene bought before
      expect(s.currency).toBe(1000 - 48);
      expect(buySection(s, 'one', 1)).toBe(false); // owned already
      expect(buySection(s, 'two')).toBe(false); // no tragedies department
      expect(buySection(s, 'one')).toBe(true);
      expect(s.owned).toEqual(['one']);
    } finally {
      setPlays([]);
    }
  });

  it('only owned scenes can be written', () => {
    try {
      setWordList([]);
      setPlays([one]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['one:2.1'];
      s.letters = [...letters];
      typeAll(s, 'AYMYLORDX'); // two lines of act 1, not owned
      expect(s.completed.one ?? []).toEqual([]);
      typeAll(s, 'NORMALX');
      expect(s.completed.one).toEqual([3]);
    } finally {
      setPlays([]);
    }
  });

  it('finishing scenes and acts pays bonuses that scale with length and add up however they were bought', () => {
    const fresh = (owned: string[]) => {
      setWordList([]);
      setPlays([one, two]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = owned;
      s.letters = [...letters];
      return s;
    };
    try {
      const s = fresh(['one']);
      typeAll(s, 'AYMYLORD'); // all of scene 1.1 (1 line)
      expect(s.scenesDone).toEqual(['one:1.1']);
      expect(s.sentences).toBe(1 + 1); // the line's Sentence + the scene's (at least 1)
      expect(s.lastMilestone?.kind).toBe('scene');
      expect(pointsMultiplier(s)).toBeCloseTo(1 + milestones.scenePointsPerLine);

      const cost = nextMonkeyCost(s);
      const speed = monkeySpeed(s, s.monkeys[0]);
      typeAll(s, 'XNOXLORD'); // scene 1.2 (2 lines), which finishes act 1 (3 lines)
      expect(s.scenesDone).toEqual(['one:1.1', 'one:1.2']);
      expect(pointsMultiplier(s)).toBeCloseTo(1 + 3 * milestones.scenePointsPerLine);
      expect(s.actsDone).toEqual(['one:1']);
      expect(s.lastMilestone?.kind).toBe('act');
      expect(s.monkeys).toHaveLength(1 + milestones.actFreeMonkeys);
      expect(s.monkeys[1].department).toBe('comedy');
      expect(nextMonkeyCost(s)).toBe(cost); // free monkeys don't raise the price
      expect(monkeySpeed(s, s.monkeys[0])).toBeCloseTo(speed * (1 + 3 * milestones.actSpeedPerLine));

      typeAll(s, 'XNORMALX'); // the last line: act 2 and the play
      expect(s.playsDone).toEqual(['one']);
      expect(s.lastMilestone?.kind).toBe('play');

      // The same play bought scene by scene ends with exactly the same bonuses.
      const t = fresh(['one:1.2', 'one:2.1', 'one:1.1']);
      typeAll(t, 'NOXLORDXNORMALXAYMYLORDX');
      expect(t.playsDone).toEqual(['one']);
      expect(t.pointsBonus).toBeCloseTo(s.pointsBonus);
      expect(t.speedBonus).toBeCloseTo(s.speedBonus);
    } finally {
      setPlays([]);
    }
  });
});

describe('the sonnet department', () => {
  const comedy = { id: 'c', title: 'C', genre: 'comedy' as const, lines: [[1, 1, 'A', 'No.']] as [number, number, string, string][] };
  const tragedy = { id: 't', title: 'T', genre: 'tragedy' as const, lines: [[1, 1, 'A', 'Lo.']] as [number, number, string, string][] };
  const sonnets = {
    id: 'sonnets',
    title: 'The Sonnets',
    genre: 'sonnet' as const,
    lines: [
      [1, 1, '', 'Ay, my lord.'],
      [1, 1, '', 'Nay, my lord.'],
      [2, 1, '', 'Normal.'],
    ] as [number, number, string, string][],
  };
  const letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D', 'N', 'X'];
  const typeAll = (s: ReturnType<typeof createInitialState>, text: string) => {
    for (const ch of text) typeLetter(s, 0, () => (letters.indexOf(ch) + 0.5) / letters.length);
  };

  it('opens only after every play genre, at the last monkey threshold', () => {
    try {
      setPlays([comedy, tragedy, sonnets]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      while (s.monkeys.length < departmentRules.monkeysToOpen[1]) s.monkeys.push(createMonkey());
      expect(departmentChoices(s)).toEqual(['tragedy']);
      expect(openDepartment(s, 'sonnet')).toBe(false);
      expect(openDepartment(s, 'tragedy')).toBe(true);
      expect(departmentChoices(s)).toEqual(['sonnet']);
      expect(openDepartment(s, 'sonnet')).toBe(false); // not enough monkeys yet
      while (s.monkeys.length < departmentRules.monkeysToOpen[2]) s.monkeys.push(createMonkey());
      expect(openDepartment(s, 'sonnet')).toBe(true);
    } finally {
      setPlays([]);
    }
  });

  it('pays Lines for verse lines and finished sonnets, with no Sentences or scene bonuses', () => {
    try {
      setWordList([]);
      setPlays([sonnets]);
      const s = createInitialState(0);
      s.departments = ['sonnet'];
      s.owned = ['sonnets'];
      s.letters = [...letters];
      typeAll(s, 'AYMYLORDX');
      expect(s.lines).toBe(sonnetRewards.linesPerLine);
      expect(s.sentences).toBe(0);
      expect(s.lastLine?.points).toBe((10 + 14 + 20) * 3); // word points x words, not squared
      typeAll(s, 'NAYMYLORDX'); // finishes sonnet 1 (2 lines)
      expect(s.lines).toBe(2 * sonnetRewards.linesPerLine + 2 * sonnetRewards.linesPerSonnetLine);
      expect(s.lastMilestone?.kind).toBe('sonnet');
      expect(s.pointsBonus).toBe(0);
      expect(s.speedBonus).toBe(0);
      expect(s.monkeys).toHaveLength(1);
    } finally {
      setPlays([]);
    }
  });
});

describe('manager monkeys', () => {
  const play = {
    id: 'm',
    title: 'M',
    genre: 'comedy' as const,
    lines: [
      [1, 1, 'A', 'Zounds, my lord.'], // needs Z, U, S: out of reach
      [1, 1, 'B', 'Ay, my lord.'],
      [1, 1, 'C', 'No, my lord.'],
    ] as [number, number, string, string][],
  };
  const setup = () => {
    setWordList([]);
    setPlays([play]);
    const s = createInitialState(0);
    s.departments = ['comedy'];
    s.owned = ['m'];
    s.letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D', 'N'];
    return s;
  };

  it('can be promoted only in a department of more than 5 monkeys, one per department', () => {
    try {
      const s = setup();
      while (s.monkeys.length < managers.minDepartmentMonkeys) s.monkeys.push(createMonkey());
      expect(toggleManager(s, 0)).toBe(false);
      s.monkeys.push(createMonkey());
      expect(toggleManager(s, 0)).toBe(true);
      expect(toggleManager(s, 1)).toBe(false); // the department already has one
      expect(s.monkeys[0].manager).toBe(true);
      expect(toggleManager(s, 0)).toBe(true); // back to typing
      expect(s.monkeys[0].manager).toBe(false);
    } finally {
      setPlays([]);
    }
  });

  it('upgrades cost Lines by department size and raise the points of every monkey in the department', () => {
    try {
      const s = setup();
      while (s.monkeys.length <= managers.minDepartmentMonkeys) s.monkeys.push(createMonkey());
      expect(upgradeManager(s, 0)).toBe(false); // not a manager
      toggleManager(s, 0);
      const cost = managerUpgradeCost(s, s.monkeys[0]);
      expect(cost).toBe(managers.linesPerMonkey * s.monkeys.length);
      s.currency = 1e12;
      expect(upgradeManager(s, 0)).toBe(false); // points don't buy it
      s.lines = cost;
      expect(managerMultiplier(s, s.monkeys[1])).toBe(1);
      expect(upgradeManager(s, 0)).toBe(true);
      expect(s.lines).toBe(0);
      expect(managerMultiplier(s, s.monkeys[1])).toBeCloseTo(1 + managers.bonusPerLevel);
      expect(managerUpgradeCost(s, s.monkeys[0])).toBe(cost * managers.upgradeCostGrowth);

      s.currency = 0;
      s.slots = [];
      const pick = (ch: string) => () => (s.letters.indexOf(ch) + 0.5) / s.letters.length;
      s.monkeys[1] = createMonkey();
      for (const ch of 'DAY') typeLetter(s, 1, pick(ch)); // no such word here: D is skipped, then AY
      typeLetter(s, 1, pick('D')); // AY scores 10 x the bonus
      expect(s.currency).toBeCloseTo(10 * (1 + managers.bonusPerLevel));
    } finally {
      setPlays([]);
    }
  });

  it("pins the first reachable line, fills the word slots, doesn't type, and moves on when the line is written", () => {
    try {
      const s = setup();
      while (s.monkeys.length <= managers.minDepartmentMonkeys) s.monkeys.push(createMonkey());
      s.slots = [
        { department: '', position: 1, word: '', on: false },
        { department: '', position: 2, word: '', on: true },
        { department: '', position: 4, word: 'NO', on: true },
      ];
      expect(toggleManager(s, 0)).toBe(true);
      expect(s.monkeys[0].target).toEqual({ play: 'm', index: 1 }); // line 0 needs Z, U, S
      expect(s.pinned).toEqual([{ play: 'm', index: 1 }]);
      expect(s.slots).toEqual([
        { department: '', position: 1, word: 'AY', on: true },
        { department: '', position: 2, word: 'MY', on: true },
        { department: '', position: 4, word: 'NO', on: false }, // the line has only 3 words
      ]);

      tick(s, 1, () => 0.99);
      expect(s.monkeys[0].line).toEqual([]); // managers don't type
      s.monkeys[1] = createMonkey();
      const pick = (ch: string) => () => (s.letters.indexOf(ch) + 0.5) / s.letters.length;
      typeLetter(s, 1, pick('X')); // slot 1: AY
      typeLetter(s, 1, pick('X')); // slot 2: MY
      for (const ch of 'LORD') typeLetter(s, 1, pick(ch));
      expect(s.completed.m).toEqual([1]);
      manage(s);
      expect(s.monkeys[0].target).toEqual({ play: 'm', index: 2 });
      expect(s.pinned).toEqual([{ play: 'm', index: 2 }]);
      expect(s.slots[0].word).toBe('NO');
    } finally {
      setPlays([]);
    }
  });
});

describe('department limits and slots', () => {
  const comedy = { id: 'c', title: 'C', genre: 'comedy' as const, lines: [[1, 1, 'A', 'Ay, my lord.']] as [number, number, string, string][] };
  const tragedy = { id: 't', title: 'T', genre: 'tragedy' as const, lines: [[1, 1, 'A', 'No, my lord.']] as [number, number, string, string][] };

  it('caps each department at 10 typists plus a manager; you choose where new monkeys go', () => {
    try {
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.letters = ['A'];
      s.lines = 1e9;
      for (let i = 0; i < 40; i++) s.office[0].cells.push(bestExpansion(s.office[0]));
      while (s.monkeys.length < departmentRules.maxTypists) expect(buyMonkey(s)).toBe(true); // one department: automatic
      expect(buyMonkey(s)).toBe(false); // full of typists
      expect(toggleManager(s, 0)).toBe(true); // a manager frees a typing seat
      expect(buyMonkey(s)).toBe(true);
      expect(departmentMonkeys(s, 'comedy')).toHaveLength(departmentRules.maxTypists + 1);
      expect(toggleManager(s, 0)).toBe(false); // no seat to go back to

      expect(openDepartment(s, 'tragedy')).toBe(true);
      roomFor(s, 'tragedy');
      expect(buyMonkey(s)).toBe(true); // only tragedies have room: automatic
      expect(monkeyGenre(s, s.monkeys[s.monkeys.length - 1])).toBe('tragedy');
      s.monkeys.splice(1, 1); // a seat opens in comedies too
      expect(departmentsWithRoom(s)).toEqual(['comedy', 'tragedy']);
      expect(buyMonkey(s)).toBe(false); // two choices: the player must pick
      expect(buyMonkey(s, 'tragedy')).toBe(true);
      expect(moveMonkey(s, 1)).toBe(true); // tragedies have room
      expect(departmentTypists(s, 'tragedy')).toBe(3);
    } finally {
      setPlays([]);
    }
  });

  it('holds an earned monkey until you pick its department, when there is a choice', () => {
    try {
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.departments = ['comedy', 'tragedy'];
      roomFor(s, 'tragedy');
      s.unassignedMonkeys = 1;
      expect(assignMonkey(s)).toBe(false); // two departments with room
      expect(assignMonkey(s, 'tragedy')).toBe(true);
      expect(s.unassignedMonkeys).toBe(0);
      expect(monkeyGenre(s, s.monkeys[1])).toBe('tragedy');
      expect(assignMonkey(s, 'tragedy')).toBe(false); // none waiting
    } finally {
      setPlays([]);
    }
  });

  it('gives each department its own word slots', () => {
    try {
      setWordList([]);
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.departments = ['comedy', 'tragedy'];
      s.owned = ['c', 't'];
      s.letters = 'AYMLORDNXEISTH'.split('');
      s.lines = 100;
      expect(buySlot(s, 'comedy')).toBe(true);
      expect(buySlot(s, 'tragedy')).toBe(true);
      expect(s.slots.map((x) => x.position)).toEqual([1, 1]); // each starts at its own 1st position
      expect(s.lines).toBe(100 - 2 * slotCost(0)); // each department's first slot is the cheap one
      expect(setSlotWord(s, 0, 'AY')).toBe(true);
      expect(setSlotWord(s, 1, 'AY')).toBe(false); // not a word in the tragedy's department
      expect(setSlotWord(s, 1, 'NO')).toBe(true);
      s.monkeys.push({ ...createMonkey(), department: 'tragedy' });
      typeLetter(s, 0, () => 0);
      typeLetter(s, 1, () => 0);
      expect(s.monkeys[0].line[0].text).toBe('AY');
      expect(s.monkeys[1].line[0].text).toBe('NO');
    } finally {
      setPlays([]);
    }
  });
});

describe('finding your place in the script', () => {
  const playA = {
    id: 'a',
    title: 'A',
    lines: [
      [1, 1, 'X', 'No.'],
      [1, 1, 'X', 'Ay.'],
      [1, 2, 'X', 'No.'],
      [2, 1, 'X', 'Ay.'],
    ] as [number, number, string, string][],
  };
  const playB = { id: 'b', title: 'B', lines: [[1, 1, 'X', 'No.']] as [number, number, string, string][] };
  const setup = () => {
    setPlays([playA, playB]);
    const s = createInitialState(0);
    s.owned = ['a:1.1', 'a:2.1', 'b'];
    return s;
  };

  it('opens on the latest pin, else the first unwritten line where monkeys last wrote', () => {
    try {
      const s = setup();
      expect(currentWork(s)).toEqual({ play: 'a', index: 0 });
      s.completed.a = [0];
      expect(currentWork(s)).toEqual({ play: 'a', index: 1 });
      s.lastLine = { play: 'b', index: 0, firstTime: true, points: 1, sentence: false };
      expect(currentWork(s)).toEqual({ play: 'b', index: 0 });
      togglePin(s, 'a', 3);
      expect(currentWork(s)).toEqual({ play: 'a', index: 3 });
      s.owned = [];
      s.pinned = [];
      s.lastLine = null;
      expect(currentWork(s)).toBeNull();
    } finally {
      setPlays([]);
    }
  });

  it('skips to the next or previous owned scene, across plays and wrapping around', () => {
    try {
      const s = setup();
      expect(nextOwnedScene(s, 'a', 1, 1)).toEqual({ play: 'a', index: 3 }); // skips unowned 1.2
      expect(nextOwnedScene(s, 'a', 2, 1)).toEqual({ play: 'a', index: 3 }); // from an unowned scene too
      expect(nextOwnedScene(s, 'a', 3, 1)).toEqual({ play: 'b', index: 0 });
      expect(nextOwnedScene(s, 'b', 0, 1)).toEqual({ play: 'a', index: 0 });
      expect(nextOwnedScene(s, 'a', 3, -1)).toEqual({ play: 'a', index: 0 });
      expect(nextOwnedScene(s, 'a', 1, -1)).toEqual({ play: 'b', index: 0 });
      s.owned = [];
      expect(nextOwnedScene(s, 'a', 0, 1)).toBeNull();
    } finally {
      setPlays([]);
    }
  });
});

describe('manager line choice', () => {
  it('switches from an out-of-reach line once a line comes within reach', () => {
    try {
      setPlays([{ id: 'q', title: 'Q', genre: 'comedy', lines: [[1, 1, 'A', 'Zounds.'], [1, 1, 'B', 'Ay, my lord.']] }]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['q'];
      s.letters = ['A', 'Y', 'M', 'L', 'O', 'R'];
      s.monkeys = Array.from({ length: managers.minDepartmentMonkeys + 1 }, createMonkey);
      expect(toggleManager(s, 0)).toBe(true);
      expect(s.monkeys[0].target).toEqual({ play: 'q', index: 0 }); // nothing in reach yet
      expect(s.pinned).toEqual([{ play: 'q', index: 0 }]);
      manage(s);
      expect(s.monkeys[0].target).toEqual({ play: 'q', index: 0 });
      s.letters.push('D');
      manage(s);
      expect(s.monkeys[0].target).toEqual({ play: 'q', index: 1 });
      expect(s.pinned).toEqual([{ play: 'q', index: 1 }]);
    } finally {
      setPlays([]);
    }
  });

  it('picks a line within reach, then the fewest words, then the earliest in the play', () => {
    try {
      setPlays([
        {
          id: 'p',
          title: 'P',
          genre: 'comedy',
          lines: [
            [1, 1, 'A', 'Zounds.'], // one word, but needs Z, U, S
            [1, 1, 'B', 'Ay, my lord.'],
            [1, 1, 'C', 'No, my lord.'],
            [1, 1, 'D', 'Ay, no.'],
            [1, 1, 'E', 'My lord.'],
          ],
        },
      ]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['p'];
      s.letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D', 'N'];
      expect(managerLine(s, 'comedy')).toEqual({ play: 'p', index: 3 }); // 2 words, before line 4
      s.completed.p = [3];
      expect(managerLine(s, 'comedy')).toEqual({ play: 'p', index: 4 });
      s.completed.p = [3, 4];
      expect(managerLine(s, 'comedy')).toEqual({ play: 'p', index: 1 }); // 3 words each: play order
      s.completed.p = [1, 2, 3, 4];
      expect(managerLine(s, 'comedy')).toEqual({ play: 'p', index: 0 }); // nothing in reach: shortest out of reach
      s.completed.p = [0, 1, 2, 3, 4];
      expect(managerLine(s, 'comedy')).toBeNull();
    } finally {
      setPlays([]);
    }
  });
});

describe('office space', () => {
  const comedy = { id: 'c', title: 'C', genre: 'comedy' as const, lines: [[1, 1, 'A', 'No.']] as [number, number, string, string][] };
  const tragedy = { id: 't', title: 'T', genre: 'tragedy' as const, lines: [[1, 1, 'A', 'Lo.']] as [number, number, string, string][] };
  const genreRoom = (s: ReturnType<typeof createInitialState>, g: string) => {
    s.currency = 1e12;
    expect(buyRoom(s, 'department', g as never)).toBe(true);
    return s.office[s.office.length - 1];
  };

  it('starts with one small room and a desk for the first monkey; floor space caps the monkeys', () => {
    const s = createInitialState(0);
    s.letters = ['A'];
    s.lines = 1e9;
    expect(s.office).toHaveLength(1);
    expect(s.office[0].cells).toHaveLength(office.starterWidth * office.starterHeight);
    expect(roomDesks(s, s.office[0])).toHaveLength(1);
    while (canSeatMonkey(s)) expect(buyMonkey(s)).toBe(true);
    expect(s.monkeys).toHaveLength(office.starterWidth * office.starterHeight); // a desk on every square
    expect(roomDesks(s, s.office[0])).toHaveLength(s.monkeys.length);
    expect(buyMonkey(s)).toBe(false);
  });

  it('grows a room one square at a time, compact unless you choose the square', () => {
    const s = createInitialState(0);
    const room = s.office[0];
    s.currency = squareCost(s) * 10;
    const first = squareCost(s);
    expect(expandRoom(s, room.id)).toBe(true);
    expect(room.cells).toHaveLength(5);
    expect(squareCost(s)).toBeGreaterThan(first);
    expect(expandRoom(s, room.id, [5, 5])).toBe(false); // not next to the room
    expect(expandRoom(s, room.id, [-1, 0])).toBe(true); // a square you choose
    expect(expansionSquares(room).some(([x, y]) => x === -2 && y === 0)).toBe(true);
    s.currency = 0;
    expect(expandRoom(s, room.id)).toBe(false);
  });

  it('gives each department its own room, where its monkeys get desks', () => {
    try {
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.letters = ['A'];
      s.lines = 1e9;
      expect(openDepartment(s, 'comedy')).toBe(true);
      expect(departmentRoom(s, 'comedy')).toBe(s.office[0]); // the first department takes the starter room
      s.departments.push('tragedy');
      expect(hasDeskSpace(s, 'tragedy')).toBe(false); // no room yet
      expect(buyMonkey(s, 'tragedy')).toBe(false);
      expect(buyRoom(s, 'department', 'comedy')).toBe(false); // already has one
      const room = genreRoom(s, 'tragedy');
      expect(buyMonkey(s, 'tragedy')).toBe(true);
      expect(roomDesks(s, room)).toHaveLength(1);
      expect(moveMonkey(s, s.monkeys.length - 1)).toBe(true); // back to comedies: the desk moves too
      expect(roomDesks(s, room)).toHaveLength(0);
      expect(roomDesks(s, s.office[0])).toHaveLength(2);
    } finally {
      setPlays([]);
    }
  });

  it('holds an earned monkey until there is a square for its desk', () => {
    const s = createInitialState(0);
    s.letters = ['A'];
    s.office[0].cells = [[0, 0]];
    s.unassignedMonkeys = 1;
    expect(assignMonkey(s)).toBe(false);
    s.currency = 1e9;
    expect(expandRoom(s, s.office[0].id)).toBe(true);
    expect(s.unassignedMonkeys).toBe(0);
    expect(s.monkeys).toHaveLength(2);
  });

  it('builds an office for saves from before rooms', () => {
    const s = createInitialState(0);
    s.departments = ['comedy', 'tragedy'];
    s.monkeys = Array.from({ length: 6 }, (_, i) => ({ ...createMonkey(), department: i < 5 ? 'comedy' : 'tragedy' }));
    s.office = [];
    furnishOffice(s);
    expect(s.office.map((r) => r.department)).toEqual(['comedy', 'tragedy']);
    expect(roomDesks(s, s.office[0])).toHaveLength(5);
    expect(roomDesks(s, s.office[1])).toHaveLength(1);
  });
});

describe('furniture', () => {
  it('buys furniture into a free square, a break room first, each costing more than the last', () => {
    const s = createInitialState(0);
    const plant = furnitureKinds[0];
    s.currency = 1e12;
    expect(furnitureCost(s, plant.id)).toBe(plant.cost);
    expect(buyFurniture(s, plant.id)).toBe(true);
    expect(s.furniture[1]).toEqual({ kind: plant.id, room: 'r1', x: 1, y: 0 }); // next to the desk
    expect(furnitureCost(s, plant.id)).toBe(Math.ceil(plant.cost * plant.costGrowth));
    expect(buyRoom(s, 'break')).toBe(true);
    expect(buyFurniture(s, plant.id)).toBe(true);
    expect(s.furniture[2].room).toBe('r2');
    expect(buyFurniture(s, 'nonsense')).toBe(false);
  });

  it('stops when every room is full', () => {
    const s = createInitialState(0);
    s.currency = 1e15;
    while (furnitureSpot(s)) expect(buyFurniture(s, 'plant')).toBe(true);
    expect(buyFurniture(s, 'plant')).toBe(false);
  });

  it('moves furniture onto free squares; desks stay in their room', () => {
    const s = createInitialState(0);
    s.currency = 1e12;
    buyRoom(s, 'break');
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    expect(cellAt(s, 'r1', 0, 0)).toBe(0); // the desk
    expect(moveFurniture(s, 1, 'r1', 0, 0)).toBe(false); // taken
    expect(moveFurniture(s, 1, 'r1', 9, 0)).toBe(false); // off the room
    expect(moveFurniture(s, 1, 'r2', 2, 2)).toBe(true);
    expect(cellAt(s, 'r2', 2, 2)).toBe(1);
    expect(cellAt(s, 'r1', 1, 0)).toBe('floor');
    expect(moveFurniture(s, 0, 'r2', 0, 0)).toBe(false); // a desk can't leave its department's room
    expect(moveFurniture(s, 0, 'r1', 1, 1)).toBe(true);
  });
});

describe('energy', () => {
  it('tires a typing monkey, slowing it, until it takes a break and comes back rested', () => {
    energy.drainSeconds = drainSeconds;
    const s = createInitialState(0);
    s.letters = ['I'];
    const m = s.monkeys[0];
    expect(currentSpeed(s, m)).toBeCloseTo(typing.baseLettersPerSecond);
    const worth = spendEnergy(m, energy.drainSeconds / 2);
    expect(m.energy).toBeCloseTo(0.5);
    expect(worth).toBeLessThan(energy.drainSeconds / 2);
    expect(currentSpeed(s, m)).toBeCloseTo(typing.baseLettersPerSecond * (1 - energy.maxSlowdown / 2));
    spendEnergy(m, energy.drainSeconds / 2);
    expect(m.resting).toBe(true);
    expect(currentSpeed(s, m)).toBe(0);
    expect(breakLeft(m)).toBeCloseTo(energy.breakSeconds);
    expect(spendEnergy(m, energy.breakSeconds / 2)).toBe(0); // no typing on a break
    spendEnergy(m, energy.breakSeconds / 2);
    expect(m.resting).toBe(false);
    expect(m.energy).toBe(1);
  });

  it('works out long stretches exactly, breaks included', () => {
    energy.drainSeconds = drainSeconds;
    const cycle = energy.drainSeconds + energy.breakSeconds;
    const one = spendEnergy(createMonkey(), cycle);
    expect(one).toBeCloseTo(energy.drainSeconds * (1 - energy.maxSlowdown / 2));
    const m = createMonkey();
    expect(spendEnergy(m, cycle * 10)).toBeCloseTo(one * 10);
    expect(m.energy).toBeCloseTo(1);
    let steps = 0;
    const n = createMonkey();
    for (let t = 0; t < cycle * 2; t += 0.25) steps += spendEnergy(n, 0.25);
    expect(steps).toBeCloseTo(one * 2, 3);
  });
});

describe('furniture effects', () => {
  it('decor slows tiring in its department room, comforts speed up breaks in break rooms, all of it adds happiness', () => {
    const s = createInitialState(0);
    s.currency = 1e15;
    s.office[0].cells.push([2, 0], [2, 1]);
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 }, { kind: 'couch', room: 'r1', x: 2, y: 0 }); // a couch at work does nothing for breaks
    expect(drainCut(s, undefined)).toBeCloseTo(0.03);
    expect(restBoost(s)).toBe(0);
    expect(buyRoom(s, 'break')).toBe(true);
    s.furniture.push({ kind: 'tv', room: 'r2', x: 0, y: 0 }, { kind: 'bookshelf', room: 'r2', x: 1, y: 0 }); // decor in a break room only adds happiness
    expect(restBoost(s)).toBeCloseTo(0.4);
    expect(drainCut(s, undefined)).toBeCloseTo(0.03);
    expect(happiness(s)).toBeCloseTo(0.01 + 0.02 + 0.03 + 0.02);
    expect(pointsMultiplier(s)).toBeCloseTo(1.08);
    const rates = energyRates(s, s.monkeys[0]);
    expect(rates.breakSeconds).toBeCloseTo(energy.breakSeconds / 1.4);
    expect(rates.drainSeconds).toBeCloseTo(energy.drainSeconds / 0.97);
  });

  it('caps each effect', () => {
    const s = createInitialState(0);
    s.office.push({ id: 'r2', kind: 'break', department: '', cells: rectangle(10, 10) });
    s.office[0].cells = rectangle(10, 10);
    for (let i = 0; i < 40; i++) s.furniture.push({ kind: 'tv', room: 'r2', x: i % 10, y: Math.floor(i / 10) }, { kind: 'bookshelf', room: 'r1', x: i % 10, y: 5 + Math.floor(i / 10) });
    expect(restBoost(s)).toBe(energy.maxRestBoost);
    expect(drainCut(s, undefined)).toBe(energy.maxDrainCut);
    expect(happiness(s)).toBe(energy.maxHappiness);
  });
});

describe('accessories', () => {
  it('buys an accessory for one typing monkey, one per slot, each of a kind dearer than the last', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    const glasses = accessories.find((a) => a.id === 'glasses')!;
    s.currency = 1e12;
    expect(buyAccessory(s, 0, 'glasses')).toBe(true);
    expect(s.currency).toBe(1e12 - glasses.cost);
    expect(buyAccessory(s, 0, 'glasses')).toBe(false); // already wears them
    expect(accessoryCost(s, 'glasses')).toBe(Math.ceil(glasses.cost * glasses.costGrowth));
    expect(buyAccessory(s, 1, 'glasses')).toBe(true);
    expect(buyAccessory(s, 0, 'nonsense')).toBe(false);
    s.monkeys[1].manager = true;
    expect(buyAccessory(s, 1, 'mug')).toBe(false); // managers don't type
  });

  it('applies its effects to the monkey wearing it', () => {
    const s = createInitialState(0);
    s.currency = 1e12;
    const m = s.monkeys[0];
    const base = monkeySpeed(s, m);
    for (const id of ['glasses', 'headphones', 'slippers', 'mug', 'crown']) expect(buyAccessory(s, 0, id)).toBe(true);
    expect(monkeySpeed(s, m)).toBeCloseTo(base * 1.2); // mug and crown
    expect(wearing(m, 'points')).toBeCloseTo(0.2); // glasses and crown
    expect(buyAccessory(s, 0, 'cap')).toBe(true); // a new hat replaces the crown: one per slot
    expect(m.accessories).toHaveLength(5);
    expect(m.accessories).not.toContain('crown');
    expect(comboMultiplier(s, { ...m, chainWords: ['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE'] })).toBe(comboCap(s) + 1);
    energy.drainSeconds = 600;
    const rates = energyRates(s, m);
    expect(rates.drainSeconds).toBeCloseTo(600 / 0.85);
    expect(rates.breakSeconds).toBeCloseTo(energy.breakSeconds / 1.3);
  });
});

describe('sentences from long chains', () => {
  const typeAll = (s: GameState, text: string) => {
    for (const ch of text) typeLetter(s, 0, () => (s.letters.indexOf(ch) + 0.5) / s.letters.length);
  };

  it('pays a Sentence for a chain of enough long words, and more for longer chains', () => {
    const n = sentenceRules.chainWords;
    expect(chainSentences(n - 1)).toBe(0);
    expect(chainSentences(n)).toBe(1);
    expect(chainSentences(n + sentenceRules.extraEvery)).toBe(2);
  });

  it('pays when the chain breaks, counting only long words', () => {
    setWordList(['CATS', 'DOGS', 'BIRD', 'AT']);
    try {
      const s = createInitialState(0);
      s.letters = ['C', 'A', 'T', 'S', 'D', 'O', 'G', 'B', 'I', 'R', 'X'];
      typeAll(s, 'CATSATDOGSBIRDCATS'); // 4 long words (and AT)
      expect(s.monkeys[0].chainCounted).toBe(4);
      expect(s.sentences).toBe(0);
      typeAll(s, 'XX'); // a letter that fits no word ends the chain
      expect(s.sentences).toBe(chainSentences(4));
      expect(s.stats.chainSentences).toBe(chainSentences(4));
      expect(s.monkeys[0].chainCounted).toBe(0);
    } finally {
      setWordList([]);
    }
  });
});

