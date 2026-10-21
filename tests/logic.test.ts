import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { maxSimulatedLettersPerSecond, petting, achievements, folio, combo, departmentRules, managers, managerOffice, sonnetRewards, letterShop, milestones, scriptShop, lineWidth, maxOfflineLetters, maxOfflineSeconds, maxPinnedLines, monkeyShop, sentenceRules, furnitureKinds, office, energy, hats, hatColors, dye, research, typewriterKeys, typing } from '../src/game/config';
import {
  applyOfflineProgress,
  moveRoomBy,
  newRoomCells,
  roomFitsAt,
  chainSentences,
  hatCost,
  unlocked,
  unlockNeeds,
  hatsForSale,
  hatsOwned,
  addRoom,
  rotateFurniture,
  allowedIn,
  achievementValue,
  canPublishFolio,
  folioPagesNow,
  folioMultiplier,
  publishFolio,
  checkAchievements,
  setLineWidth,
  pieceSize,
  footprint,
  fitsAt,
  canReachDesk,
  wearHat,
  moveHat,
  swapTypewriters,
  dyeHat,
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
  dyeCost,
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
  checkLetterGifts,
  buyComboStart,
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
  unpinPlayerLines,
  comboStartCost,
  comboStart,
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
  chooseStarterPlay,
  starterGenre,
  departmentChoices,
  manage,
  managerLine,
  managerSpeed,
  slotDelay,
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
  moveMonkeyTo,
  deskOf,
  posts,
  postCost,
  postOf,
  hireFor,
  nextDepartmentAt,
  monkeySpeed,
  nextMonkeyCost,
  pointsMultiplier,
  sectionPrice,
  starterPlays,
  getPlay,
  openDepartment,
  currentWork,
  nextOwnedScene,
  nextPin,
} from '../src/game/logic';
import { createInitialState, createMonkey, rectangle, type GameState } from '../src/game/state';
import { autoConnect, connectedRooms, cycleDoor, doorBetween, doorSides, isConnected, layOutOffice, loungeOf, placeDoor, servedBy, takeDoor, toggleHall } from '../src/game/layout';
import { sellEverything, withUnlocks } from './unlocks';

sellEverything();

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
  addRoom(s, 'department', genre, 8, 8);
}

const rng = () => 0;

/** No trait, average hidden stats and no feelings about any job: for tests that check exact amounts. */
const plainMonkey = { trait: 'none', speedStat: 1, stamina: 1, jobs: { typing: 'fine', managing: 'fine', hr: 'fine', research: 'fine' } };

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
    poke(s);
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

  it('pets the chosen typing monkey, or the least happy one', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(structuredClone(s.monkeys[0]));
    expect(poke(s, 1)).toBe(1);
    expect(s.monkeys[1].petHappiness).toBeGreaterThan(0);
    expect(poke(s)).toBe(0); // the least happy
    s.monkeys[1].manager = true;
    expect(poke(s, 1)).toBe(-1); // managers don't type
  });

  it('keeps statistics on letters, words, chains and pets', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    poke(s);
    for (let i = 0; i < 3; i++) typeLetter(s, 0, rng);
    tick(s, 2, rng);
    expect(s.stats.pets).toBe(1);
    expect(s.stats.letters).toEqual({ I: 4 });
    expect(s.stats.words).toEqual({ I: 4 });
    expect(s.words).toBe(1); // one Word: I was new only the first time
    expect(s.stats.longestWord).toBe('I');
    expect(s.stats.bestWord).toBe('I');
    expect(s.stats.longestChain).toBe(4);
    expect(s.stats.secondsTyping).toBe(2);
  });

  it('simulates at most a budget of letters a tick, and credits the rest', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey());
    for (const m of s.monkeys) Object.assign(m, { skill: 60, ...plainMonkey }); // far more letters a second than the budget; no trait
    const due = Math.floor(monkeySpeed(s, s.monkeys[0])) * 2;
    tick(s, 1, rng);
    expect(s.stats.letters.I).toBeLessThanOrEqual(maxSimulatedLettersPerSecond + 1);
    expect(s.currency).toBeCloseTo(due, -2); // every I pays 1 point
    expect(s.wordsTyped).toBeCloseTo(due, -2);
  });

  it('petting types nothing: it makes the least happy typist a little happier, which wears off', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey(), createMonkey());
    s.monkeys[0].manager = true;
    expect(poke(s)).toBe(1);
    expect(poke(s)).toBe(2); // now the least happy
    expect(poke(s)).toBe(1);
    expect(s.currency).toBe(0);
    expect(s.monkeys[0].petHappiness).toBe(0); // managers don't get petted
    expect(s.monkeys[1].petHappiness).toBeCloseTo(2 * petting.happinessPerPet);
    for (let i = 0; i < 100; i++) poke(s);
    expect(s.monkeys[1].petHappiness).toBe(petting.maxHappiness);
    expect(s.stats.pets).toBe(103);
    tick(s, 60, rng);
    expect(s.monkeys[1].petHappiness).toBeCloseTo(petting.maxHappiness - petting.fadePerMinute);
  });

  it('happier monkeys tire slower and rest faster', () => {
    const s = createInitialState(0);
    const m = s.monkeys[0];
    const calm = energyRates(s, m);
    m.petHappiness = 0.05;
    const happy = energyRates(s, m);
    expect(happy.drainSeconds).toBeCloseTo(calm.drainSeconds * 1.05);
    expect(happy.breakSeconds).toBeCloseTo(calm.breakSeconds / 1.05);
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

  it('lets a front end set how long a line runs, to fit its screen', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    try {
      setLineWidth(150);
      for (let i = 0; i < 150; i++) typeLetter(s, 0, rng);
      expect(s.monkeys[0].line).toHaveLength(150);
      typeLetter(s, 0, rng);
      expect(s.monkeys[0].line).toHaveLength(1);
    } finally {
      setLineWidth(lineWidth);
    }
  });

  it('offline typing is credited and capped', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    Object.assign(s.monkeys[0], plainMonkey);
    const earned = applyOfflineProgress(s, (maxOfflineSeconds + 1000) * 1000, rng);
    expect(earned).toBe(maxOfflineSeconds * typing.baseLettersPerSecond);
    expect(s.stats.secondsAway).toBe(maxOfflineSeconds + 1000); // the whole time away counts on the timer
    expect(s.monkeys[0].worked).toBeCloseTo(maxOfflineSeconds + 1000); // and on each monkey's time at the company
  });

  it('gives a free letter for each milestone reached, once', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    expect(checkLetterGifts(s)).toEqual([]);
    s.achievements.push('first-hire', 'first-word'); // a second monkey; the first word gives no letter
    expect(checkLetterGifts(s)).toEqual(['first-hire']);
    expect(checkLetterGifts(s)).toEqual([]); // once
    expect(s.freeLetters).toBe(1);
    expect(buyLetter(s, 'z')).toBe(false); // no Bananas or Words to buy one
    expect(buyLetter(s, 'z', true)).toBe(true); // but the free one
    expect(s.freeLetters).toBe(0);
    expect(buyLetter(s, 'q', true)).toBe(false);
    s.freeLetters = 1;
    s.completed = { test: [0] };
    const next = publishFolio(Object.assign(s, { playsDone: ['test'] }))!;
    expect(next.letterGifts).toEqual(['first-hire']); // Folios keep them: each is given once, ever
    expect(next.freeLetters).toBe(1);
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
    s.currency = s.sentences = 1e12;
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
    s.currency = letterCost(1) * 100;
    s.letters.push('A', 'N'); // own 3: the next costs 2 Words
    expect(buyLetter(s, 't')).toBe(false); // no Words yet
    s.words = 3;
    expect(buyLetter(s, 'I')).toBe(false);
    expect(buyLetter(s, '!')).toBe(false);
    expect(buyLetter(s, 't')).toBe(true);
    expect(s.letters).toEqual(['I', 'A', 'N', 'T']);
    expect(s.currency).toBe(letterCost(1) * 100 - letterCost(3));
    expect(s.words).toBe(1);
    expect(buyLetter(s, 'T')).toBe(false);
  });

  it('longer words become possible and score more', () => {
    setWordList(['IT', 'TI']);
    try {
      const s = createInitialState(0);
      chooseFirstLetter(s, 'i');
      s.letters.push('T');
      let n = 0;
      // rng picks I (index 0) or T (index 1) to type I T T I.
      const seq = [0, 0.9, 0.9, 0];
      const next = () => seq[n++];
      for (let i = 0; i < 4; i++) typeLetter(s, 0, next);
      // I T -> IT (4 at x1.1); T I -> TI (4): the chain's 8 at x1.2
      expect(s.currency).toBeCloseTo(8 * 1.2);
      expect(s.monkeys[0].line.map((x) => x.text)).toEqual(['IT', 'TI']);
    } finally {
      setWordList([]);
    }
  });
});

describe('monkeys', () => {
  it('buying a monkey costs points and raises the next price', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.sentences = 1e12;
    s.lines = 1e12;
    expect(buyMonkey(s)).toBe(false); // Sentences and Lines don't buy monkeys
    s.sentences = 0;
    s.currency = monkeyCost(0);
    expect(monkeyCost(0)).toBe(monkeyShop.baseCost);
    expect(buyMonkey(s)).toBe(true);
    expect(s.monkeys).toHaveLength(2);
    expect(s.currency).toBe(0);
    expect(buyMonkey(s)).toBe(false);
    expect(nextMonkeyCost(s)).toBe(monkeyShop.baseCost * monkeyShop.costGrowth);
  });

  it('gives each department its own monkey price, dearer for each later department', () => {
    const s = createInitialState(0);
    s.letters = ['A'];
    s.departments = ['comedy', 'tragedy'];
    s.currency = s.sentences = 1e30;
    roomFor(s, 'comedy');
    roomFor(s, 'tragedy');
    expect(nextMonkeyCost(s, 'comedy')).toBe(monkeyCost(0, 0));
    expect(nextMonkeyCost(s, 'tragedy')).toBe(monkeyCost(0, 1));
    expect(monkeyCost(0, 1)).toBe(monkeyShop.baseCost * monkeyShop.departmentGrowth);
    expect(buyMonkey(s, 'comedy')).toBe(true);
    expect(buyMonkey(s, 'comedy')).toBe(true);
    expect(nextMonkeyCost(s, 'comedy')).toBe(monkeyCost(2, 0));
    expect(nextMonkeyCost(s, 'tragedy')).toBe(monkeyCost(0, 1)); // comedy hires don't raise tragedy's price
  });

  it('monkeys can be renamed, and an empty name gives a famous one back', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    expect(monkeyName(s, 1)).toBe('M-2');
    expect(renameMonkey(s, 1, '  Bubbles  the  Great ')).toBe(false); // too long once trimmed
    expect(renameMonkey(s, 1, ' Bubbles ')).toBe(true);
    expect(monkeyName(s, 1)).toBe('Bubbles');
    expect(renameMonkey(s, 1, 'Bad*Name')).toBe(false);
    expect(renameMonkey(s, 5, 'Nobody')).toBe(false);
    expect(renameMonkey(s, 1, '')).toBe(true);
    expect(monkeyName(s, 1)).not.toMatch(/^(Bubbles|M-2|)$/);
  });

  it('every monkey types its own line', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys.push(createMonkey(), createMonkey());
    for (const m of s.monkeys) Object.assign(m, plainMonkey);
    tick(s, 10, rng);
    expect(s.currency).toBe(3 * 10 * typing.baseLettersPerSecond);
    for (const m of s.monkeys) expect(m.line).toHaveLength(10 * typing.baseLettersPerSecond);
  });

  it('long absences with many monkeys are estimated past the simulation limit', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.monkeys = Array.from({ length: 100 }, () => ({ ...createMonkey(), ...plainMonkey }));
    const letters = 100 * maxOfflineSeconds * typing.baseLettersPerSecond;
    expect(letters).toBeGreaterThan(maxOfflineLetters);
    const earned = applyOfflineProgress(s, maxOfflineSeconds * 1000, rng);
    // With only I, every letter is a 1-point word.
    expect(earned / letters).toBeCloseTo(1, 3);
    expect(s.wordsTyped / letters).toBeCloseTo(1, 3);
  }, 30_000); // simulates hours of 100 monkeys: slow on a busy CI runner
});

describe('combos', () => {
  const letters = ['C', 'A', 'T', 'Q', 'U', 'I', 'Z', 'N', 'Y', 'E', 'X'];
  const typeAll = (s: ReturnType<typeof createInitialState>, text: string) => {
    for (const ch of text) typeLetter(s, 0, () => (letters.indexOf(ch) + 0.5) / letters.length);
  };

  it('adds 0.1 to the multiplier for each word of 2+ letters in a chain, up to the cap', () => {
    setWordList(['CAT', 'QUIZ', 'ZANY']);
    try {
      const s = createInitialState(0);
      s.letters = [...letters];
      const m = s.monkeys[0];
      typeAll(s, 'CAT');
      expect(comboMultiplier(s, m)).toBe(1.1);
      expect(s.lastWordPoints).toBeCloseTo(15 * 1.1);
      typeAll(s, 'QUIZ');
      expect(comboMultiplier(s, m)).toBe(1.2);
      expect(s.lastWordPoints).toBeCloseTo((15 + 88) * 1.2 - 15 * 1.1); // the whole chain at the new multiplier
      typeAll(s, 'CAT');
      expect(comboMultiplier(s, m)).toBe(1.3); // repeats count too
      for (let i = 0; i < 30; i++) typeAll(s, 'ZANY');
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

describe('starting combo', () => {
  it('starts every chain a step higher per upgrade, bought with Sentences, up to the cap', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    expect(comboStart(s)).toBe(1);
    expect(comboMultiplier(s, s.monkeys[0])).toBe(1);
    expect(buyComboStart(s)).toBe(false);
    s.sentences = comboStartCost(0);
    expect(buyComboStart(s)).toBe(true);
    expect(s.sentences).toBe(0);
    expect(comboStart(s)).toBe(1 + combo.step);
    expect(comboMultiplier(s, s.monkeys[0])).toBe(1.1); // an empty chain
    expect(comboMultiplier(s, { ...s.monkeys[0], chainWords: ['AT', 'IT'] })).toBe(1.3);
    expect(comboStartCost(1)).toBeGreaterThan(comboStartCost(0));
    expect(comboCap(s)).toBe(combo.maxMultiplier); // the cap stays put
    s.comboStartLevel = 20; // x3: at the cap
    s.sentences = 1e12;
    expect(buyComboStart(s)).toBe(false);
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
    s.currency = s.sentences = 1e15;
    expect(keysUnlocked(s)).toBe(false);
    expect(availableKeys(s)).toEqual([]);
    s.letters.push(thirteen[typewriterKeys.unlockLetters - 1]);
    expect(keysUnlocked(s)).toBe(true);
  });

  it('offers combination keys spelled with your letters, once each', () => {
    const s = fresh(thirteen);
    s.currency = s.sentences = 1e15;
    expect(availableKeys(s)).toContain('QU');
    expect(availableKeys(s)).not.toContain('THE'); // words must be spelled first
    expect(buyKey(s, 'QU')).toBe(true);
    expect(buyKey(s, 'QU')).toBe(false);
    expect(buyKey(s, 'ZZZ')).toBe(false);
    expect(s.keys).toEqual(['QU']);
  });

  it('unlocks a word key once it is spelled often enough, needing more spells for each word key owned', () => {
    const s = fresh(thirteen);
    s.currency = s.sentences = 1e15;
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
      // Unpinning all of yours keeps a manager's line pinned.
      s.monkeys[0].manager = true;
      s.monkeys[0].target = { play: 'p', index: 1 };
      expect(unpinPlayerLines(s)).toBe(maxPinnedLines - 2);
      expect(s.pinned).toEqual([{ play: 'p', index: 1 }]);
      expect(unpinPlayerLines(s)).toBe(0);
      s.monkeys[0].manager = false;
      s.monkeys[0].target = null;
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

  it("don't wait for letters that aren't a word yet: the monkey drops them and types the slot's word", () => {
    const s = setup();
    setWordList(['AY', 'MY', 'LORD']);
    try {
      s.slots = [
        { department: '', position: 1, word: 'AY', on: true },
        { department: '', position: 2, word: 'MY', on: true },
      ];
      const m = s.monkeys[0];
      const x = () => (letters.indexOf('X') + 0.5) / letters.length;
      m.pending = 'LO'; // on the way to LORD, at the start of a chain
      typeLetter(s, 0, x);
      expect(m.line.map((seg) => seg.text)).toEqual(['AY']);
      m.pending = 'LO'; // and mid-chain
      typeLetter(s, 0, x);
      expect(m.line.map((seg) => seg.text)).toEqual(['AY', 'MY']);
      expect(m.chainLength).toBe(2);
      expect(m.pending).toBe('');
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
      expect(starterPlays(s).map((p) => p.id)).toEqual(['two']);
      expect(chooseStarterPlay(s, 'one')).toBe(false); // wrong genre
      expect(chooseStarterPlay(s, 'two')).toBe(true);
      expect(chooseStarterPlay(s, 'two')).toBe(false); // only once
      expect(s.owned).toEqual(['two']);
      // Each later Shakespeare department gets its own free pick, like the first.
      expect(starterGenre(s)).toBeUndefined();
      s.departments.push('comedy');
      expect(starterGenre(s)).toBe('comedy');
      expect(starterPlays(s).map((p) => p.id)).toEqual(['one']);
      expect(chooseStarterPlay(s, 'two')).toBe(false);
      expect(chooseStarterPlay(s, 'one')).toBe(true);
      expect(starterGenre(s)).toBeUndefined();
      expect(s.owned).toEqual(['two', 'one']);
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

  it('prices texts in Lines by their unowned lines, sells them only whole, and only for open departments', () => {
    try {
      setPlays([one, two]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['one:1.1'];
      const play = getPlay('one')!;
      const unowned = play.scenes.filter((sc) => sc.key !== '1.1').reduce((n, sc) => n + sc.lines.length, 0);
      const price = Math.ceil(unowned * scriptShop.linesPerLine);
      expect(price).toBeGreaterThan(0);
      expect(sectionPrice(s, play)).toBe(price);
      s.currency = 1e9;
      expect(buySection(s, 'one')).toBe(false); // Bananas don't buy texts
      s.lines = 1000;
      expect(buySection(s, 'two')).toBe(false); // no tragedies department
      expect(buySection(s, 'one')).toBe(true);
      expect(s.owned).toEqual(['one']); // the play covers the scene owned before (old saves)
      expect(s.lines).toBe(1000 - price);
      expect(sectionPrice(s, play)).toBe(0);
      expect(buySection(s, 'one')).toBe(false); // owned already
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

  it('upgrades cost Sentences by department size and raise the points of every monkey in the department', () => {
    try {
      const s = setup();
      while (s.monkeys.length <= managers.minDepartmentMonkeys) s.monkeys.push(createMonkey());
      expect(upgradeManager(s, 0)).toBe(false); // not a manager
      toggleManager(s, 0);
      const cost = managerUpgradeCost(s, s.monkeys[0]);
      expect(cost).toBe(managers.sentencesPerMonkey * s.monkeys.length);
      s.currency = s.lines = 1e12;
      s.sentences = cost - 1;
      expect(upgradeManager(s, 0)).toBe(false); // bananas and Lines don't buy it
      s.sentences = cost;
      expect(managerMultiplier(s, s.monkeys[1])).toBe(1);
      expect(upgradeManager(s, 0)).toBe(true);
      expect(s.sentences).toBe(0);
      expect(managerMultiplier(s, s.monkeys[1])).toBeCloseTo(1 + managers.bonusPerLevel);
      expect(managerUpgradeCost(s, s.monkeys[0])).toBe(cost * managers.upgradeCostGrowth);

      s.currency = 0;
      s.slots = [];
      const pick = (ch: string) => () => (s.letters.indexOf(ch) + 0.5) / s.letters.length;
      s.monkeys[1] = createMonkey();
      for (const ch of 'DAY') typeLetter(s, 1, pick(ch)); // no such word here: D is skipped, then AY
      typeLetter(s, 1, pick('D')); // AY scores 10 at combo x1.1, x the bonus
      expect(s.currency).toBeCloseTo(10 * 1.1 * (1 + managers.bonusPerLevel));
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
      // Start over with a known pick: lines 1 and 2 are in reach (line 0 needs Z, U, S), and rng 0 takes the first.
      s.monkeys[0].target = null;
      s.pinned = [];
      s.slots = [
        { department: '', position: 1, word: '', on: false },
        { department: '', position: 2, word: '', on: true },
        { department: '', position: 4, word: 'NO', on: true },
      ];
      s.monkeys[0].slotWait = 0;
      manage(s, 0, () => 0);
      expect(s.monkeys[0].target).toEqual({ play: 'm', index: 1 });
      expect(s.pinned).toEqual([{ play: 'm', index: 1 }]);
      // One slot at a time: the first at once, then one every slotDelay seconds.
      expect(s.slots.map((x) => [x.word, x.on])).toEqual([['AY', true], ['', true], ['NO', true]]);
      const delay = slotDelay(s, s.monkeys[0]);
      expect(delay).toBe(managers.secondsPerSlot);
      manage(s, delay - 1);
      expect(s.slots[1].word).toBe('');
      manage(s, 1);
      expect(s.slots.map((x) => [x.word, x.on])).toEqual([['AY', true], ['MY', true], ['NO', true]]);
      manage(s, delay);
      expect(s.slots[2].on).toBe(false); // the line has only 3 words
      manage(s, 1000); // nothing left to change: ready for the next line at once
      expect(s.monkeys[0].slotWait).toBe(0);

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
      expect(s.slots[1].word).toBe('MY'); // still the old line's, until the next change
      manage(s, delay);
      expect(s.slots[2]).toMatchObject({ on: false });
    } finally {
      setPlays([]);
    }
  });
});

describe('manager monkeys, keeping their line', () => {
  it('keeps its line until it is written, even when a new letter brings a shorter one within reach', () => {
    setWordList([]);
    setPlays([{ id: 'g', title: 'G', genre: 'comedy', lines: [[1, 1, 'A', 'Ay, my lord.'], [1, 1, 'B', 'Go.']] }]);
    try {
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['g'];
      s.letters = ['A', 'Y', 'M', 'L', 'O', 'R', 'D'];
      while (s.monkeys.length <= managers.minDepartmentMonkeys) s.monkeys.push(createMonkey());
      toggleManager(s, 0);
      expect(s.monkeys[0].target).toEqual({ play: 'g', index: 0 }); // GO needs a G
      s.letters.push('G');
      manage(s);
      expect(s.monkeys[0].target).toEqual({ play: 'g', index: 0 });
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
      s.currency = s.sentences = 1e30;
      for (let i = 0; i < 40; i++) s.office[0].cells.push(bestExpansion(s, s.office[0])!);
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

  it('skips to the next or previous pinned line, across plays and wrapping around', () => {
    try {
      const s = setup();
      expect(nextPin(s, 'a', 0, 1)).toBeNull();
      togglePin(s, 'b', 0);
      togglePin(s, 'a', 3);
      togglePin(s, 'a', 0);
      expect(nextPin(s, 'a', 1, 1)).toEqual({ play: 'a', index: 3 });
      expect(nextPin(s, 'a', 3, 1)).toEqual({ play: 'b', index: 0 });
      expect(nextPin(s, 'b', 0, 1)).toEqual({ play: 'a', index: 0 }); // wraps around
      expect(nextPin(s, 'a', 3, -1)).toEqual({ play: 'a', index: 0 });
      expect(nextPin(s, 'a', 0, -1)).toEqual({ play: 'b', index: 0 });
    } finally {
      setPlays([]);
    }
  });
});

describe('manager line choice', () => {
  it('pins nothing until a line is within reach', () => {
    try {
      setPlays([{ id: 'q', title: 'Q', genre: 'comedy', lines: [[1, 1, 'A', 'Zounds.'], [1, 1, 'B', 'Ay, my lord.']] }]);
      const s = createInitialState(0);
      s.departments = ['comedy'];
      s.owned = ['q'];
      s.letters = ['A', 'Y', 'M', 'L', 'O', 'R'];
      s.monkeys = Array.from({ length: managers.minDepartmentMonkeys + 1 }, createMonkey);
      expect(toggleManager(s, 0)).toBe(true);
      expect(s.monkeys[0].target).toBeNull(); // nothing in reach yet
      expect(s.pinned).toEqual([]);
      s.letters.push('D');
      manage(s);
      expect(s.monkeys[0].target).toEqual({ play: 'q', index: 1 });
      expect(s.pinned).toEqual([{ play: 'q', index: 1 }]);
    } finally {
      setPlays([]);
    }
  });

  it('picks a line within reach at random, among those its slots can hold', () => {
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
      // No slots: any line in reach (never Zounds, out of reach), at random.
      expect(managerLine(s, 'comedy', () => 0)).toEqual({ play: 'p', index: 1 });
      expect(managerLine(s, 'comedy', () => 0.99)).toEqual({ play: 'p', index: 4 });
      // Two slots: only lines of up to two words.
      s.slots = [1, 2].map((position) => ({ department: '', position, word: '', on: false }));
      expect(managerLine(s, 'comedy', () => 0)).toEqual({ play: 'p', index: 3 });
      expect(managerLine(s, 'comedy', () => 0.99)).toEqual({ play: 'p', index: 4 });
      s.completed.p = [3, 4];
      expect(managerLine(s, 'comedy', () => 0)).toEqual({ play: 'p', index: 1 }); // none fit: any in reach
      s.completed.p = [1, 2, 3, 4];
      expect(managerLine(s, 'comedy')).toBeNull(); // only Zounds left, out of reach
      // A manager stuck on a line too long for its slots swaps it for one that fits once one is in reach.
      s.completed.p = [];
      s.monkeys[0].department = 'comedy';
      s.monkeys[0].manager = true;
      s.monkeys[0].target = { play: 'p', index: 1 };
      s.slots = [s.slots[0]];
      manage(s, 0, () => 0);
      expect(s.monkeys[0].target).toEqual({ play: 'p', index: 1 }); // no one-word line in reach: it keeps its line
      s.slots = [1, 2].map((position) => ({ department: '', position, word: '', on: false }));
      manage(s, 0, () => 0);
      expect(s.monkeys[0].target).toEqual({ play: 'p', index: 1 }); // only when it's time to change a slot
      manage(s, 1000, () => 0);
      expect(s.monkeys[0].target).toEqual({ play: 'p', index: 3 });
    } finally {
      setPlays([]);
    }
  });
});

describe('office space', () => {
  const comedy = { id: 'c', title: 'C', genre: 'comedy' as const, lines: [[1, 1, 'A', 'No.']] as [number, number, string, string][] };
  const tragedy = { id: 't', title: 'T', genre: 'tragedy' as const, lines: [[1, 1, 'A', 'Lo.']] as [number, number, string, string][] };
  const genreRoom = (s: ReturnType<typeof createInitialState>, g: string) => {
    s.currency = s.sentences = 1e12;
    expect(buyRoom(s, 'department', g as never)).toBe(true);
    return s.office[s.office.length - 1];
  };

  it('starts with one small room and a desk for the first monkey; floor space caps the monkeys', () => {
    const s = createInitialState(0);
    s.letters = ['A'];
    s.lines = 1e9;
    s.currency = s.sentences = 1e30;
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
    s.sentences = squareCost(s) * 10; // squares cost Sentences
    const first = squareCost(s);
    expect(expandRoom(s, room.id)).toBe(true);
    expect(room.cells).toHaveLength(5);
    expect(squareCost(s)).toBeGreaterThan(first);
    expect(expandRoom(s, room.id, [5, 5])).toBe(false); // not next to the room
    expect(expandRoom(s, room.id, [-1, 0])).toBe(true); // a square you choose
    expect(expansionSquares(s, room).some(([x, y]) => x === -2 && y === 0)).toBe(true);
    s.sentences = 0;
    expect(expandRoom(s, room.id)).toBe(false);
  });

  it('gives each department its own room, where its monkeys get desks', () => {
    try {
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.letters = ['A'];
      s.lines = 1e9;
      s.currency = s.sentences = 1e30;
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

  it('lists every department as a post with its count, and moves a monkey to any of them with its desk', () => {
    try {
      setPlays([comedy, tragedy]);
      const s = createInitialState(0);
      s.letters = ['A'];
      s.currency = s.sentences = 1e30;
      expect(openDepartment(s, 'comedy')).toBe(true);
      s.departments.push('tragedy');
      expect(posts(s).map((p) => [p.id, p.have, p.max, p.blocked])).toEqual([
        ['comedy', 1, departmentRules.maxTypists, ''],
        ['tragedy', 0, departmentRules.maxTypists, 'room needed'],
      ]);
      const room = genreRoom(s, 'tragedy');
      const post = posts(s).find((p) => p.id === 'tragedy')!;
      expect(postCost(s, post)).toBe(nextMonkeyCost(s, 'tragedy'));
      expect(hireFor(s, post)).toBe(true);
      expect(postOf(s, s.monkeys[1])).toBe('tragedy');
      expect(moveMonkeyTo(s, 1, 'tragedy')).toBe(false); // already there
      expect(moveMonkeyTo(s, 1, 'comedy')).toBe(true);
      expect(roomDesks(s, room)).toHaveLength(0);
      expect(roomDesks(s, s.office[0])).toHaveLength(2);
      // A monkey takes its own desk along; everyone else stays at theirs, and it sits at the one it brought.
      expect(hireFor(s, posts(s).find((p) => p.id === 'comedy')!)).toBe(true);
      expect(hireFor(s, post)).toBe(true);
      const seats = s.monkeys.map((_, k) => s.furniture[deskOf(s, k)!]);
      expect(moveMonkeyTo(s, 1, 'tragedy')).toBe(true);
      expect(roomDesks(s, s.office[0])).toHaveLength(2);
      expect(roomDesks(s, room)).toHaveLength(2);
      expect(s.furniture).not.toContain(seats[1]);
      expect([0, 2, 3].map((k) => s.furniture[deskOf(s, k)!])).toEqual([seats[0], seats[2], seats[3]]);
      expect(s.furniture[deskOf(s, 1)!].room).toBe(room.id);
      s.researchOpen = true;
      expect(posts(s, false).find((p) => p.id === research.id)?.blocked).toBe('lab needed');
      expect(posts(s, false).some((p) => p.job === 'managing')).toBe(false); // moves don't offer managers' chairs
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
    s.currency = s.sentences = 1e9;
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
  it('buys furniture into a free square where it works, each costing more than the last; some pieces fit only one kind of room', () => {
    const s = createInitialState(0);
    const plant = furnitureKinds[0];
    s.currency = s.sentences = 1e12;
    expect(furnitureCost(s, plant.id)).toBe(plant.cost);
    expect(buyFurniture(s, plant.id)).toBe(true);
    expect(s.furniture[1]).toEqual({ kind: plant.id, room: 'r1', x: 1, y: 0 }); // next to the desk
    expect(furnitureCost(s, plant.id)).toBe(Math.ceil(plant.cost * plant.costGrowth));
    expect(buyFurniture(s, 'tv')).toBe(false); // break rooms only
    expect(buyRoom(s, 'break')).toBe(true);
    expect(buyFurniture(s, plant.id)).toBe(true);
    expect(s.furniture[2].room).toBe('r1'); // decor goes where it works: a department's room
    expect(buyFurniture(s, plant.id, 'break')).toBe(true); // unless asked for a break room
    expect(s.furniture[3].room).toBe('r2');
    expect(buyFurniture(s, 'tv')).toBe(true);
    expect(s.furniture[4].room).toBe('r2');
    expect(buyFurniture(s, 'clock', 'break')).toBe(false); // departments' rooms only
    expect(allowedIn(s, 'tv', 'r1')).toBe(false);
    expect(moveFurniture(s, 4, 'r1', 0, 1)).toBe(false);
    expect(buyFurniture(s, 'nonsense')).toBe(false);
  });

  it('stops when every room is full', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e15;
    while (furnitureSpot(s)) expect(buyFurniture(s, 'plant')).toBe(true);
    expect(buyFurniture(s, 'plant')).toBe(false);
  });

  it('moves furniture onto free squares; desks stay in their room', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break');
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    expect(cellAt(s, 'r1', 0, 0)).toBe(0); // the desk
    expect(moveFurniture(s, 1, 'r1', 0, 0)).toBe(false); // taken
    expect(moveFurniture(s, 1, 'r1', 9, 0)).toBe(false); // off the room
    const [x, y] = s.office[1].cells[8];
    expect(moveFurniture(s, 1, 'r2', x, y)).toBe(true);
    expect(cellAt(s, 'r2', x, y)).toBe(1);
    expect(cellAt(s, 'r1', 1, 0)).toBe('floor');
    expect(moveFurniture(s, 0, 'r2', ...s.office[1].cells[0])).toBe(false); // a desk can't leave its department's room
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
  it('gives a department the furniture in its own room and in its lounge, all of it adding happiness (points and energy)', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e15;
    s.office[0].cells.push([2, 0], [2, 1]);
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 }, { kind: 'armchair', room: 'r1', x: 2, y: 0 });
    expect(drainCut(s, undefined)).toBeCloseTo(0.03);
    expect(restBoost(s, undefined)).toBeCloseTo(0.08);
    expect(buyRoom(s, 'break')).toBe(true);
    const lounge = s.office[1];
    expect(loungeOf(s, s.office[0])).toBe(lounge);
    s.furniture.push(
      { kind: 'tv', room: lounge.id, x: lounge.cells[0][0], y: lounge.cells[0][1] },
      { kind: 'fountain', room: lounge.id, x: lounge.cells[1][0], y: lounge.cells[1][1] },
    );
    expect(restBoost(s, undefined)).toBeCloseTo(0.48);
    expect(drainCut(s, undefined)).toBeCloseTo(0.09);
    expect(happiness(s, undefined)).toBeCloseTo(0.01 + 0.01 + 0.03 + 0.02);
    expect(pointsMultiplier(s, s.monkeys[0])).toBeCloseTo(1.07);
    const rates = energyRates(s, s.monkeys[0]);
    expect(rates.breakSeconds).toBeCloseTo(energy.breakSeconds / 1.48 / 1.07); // happiness helps too
    expect(rates.drainSeconds).toBeCloseTo((energy.drainSeconds * 1.07) / 0.91);
  });

  it("gives each department only its lounge: the nearest break room, then the biggest, then the most furnished", () => {
    const s = createInitialState(0); // room 1: 2x2 at 0,0
    const add = (id: string, x0: number, y0: number) => s.office.push({ id, kind: 'break', department: '', cells: rectangle(2, 2).map(([x, y]) => [x + x0, y + y0]) });
    add('r2', 2, 0); // against room 1's east wall
    add('r3', -4, 0); // two hallway squares west
    s.halls = [[-1, 0], [-2, 0]];
    s.doors = [{ x: 1, y: 0, side: 'e' }, { x: 0, y: 0, side: 'w' }, { x: -3, y: 0, side: 'e' }];
    s.furniture.push({ kind: 'tv', room: 'r3', x: -4, y: 0 });
    expect(loungeOf(s, s.office[0])?.id).toBe('r2'); // a door straight in is nearest
    expect(restBoost(s, undefined)).toBe(0); // so the TV down the hall does nothing
    s.doors.shift();
    expect(loungeOf(s, s.office[0])?.id).toBe('r3');
    expect(restBoost(s, undefined)).toBeCloseTo(0.4);
    expect(servedBy(s, s.office[2]).map((r) => r.id)).toEqual(['r1']);

    s.office.pop();
    s.halls = [];
    add('r3', 0, 2); // against room 1's south wall
    s.doors = [{ x: 1, y: 0, side: 'e' }, { x: 0, y: 1, side: 's' }];
    s.furniture = s.furniture.filter((f) => f.kind === 'desk');
    expect(loungeOf(s, s.office[0])?.id).toBe('r2'); // as near and as big: the first
    s.furniture.push({ kind: 'plant', room: 'r3', x: 0, y: 2 });
    expect(loungeOf(s, s.office[0])?.id).toBe('r3'); // the most furnished
    s.office[1].cells.push([4, 0]);
    expect(loungeOf(s, s.office[0])?.id).toBe('r2'); // the biggest
    expect(drainCut(s, undefined)).toBe(0); // the plant is in the other one
  });

  it('caps each effect', () => {
    const s = createInitialState(0);
    s.office[0].cells = rectangle(10, 10);
    const r2 = addRoom(s, 'break', '', 10, 10);
    for (let i = 0; i < 40; i++) s.furniture.push({ kind: 'tv', room: 'r2', x: r2.cells[i][0], y: r2.cells[i][1] }, { kind: 'bookshelf', room: 'r1', x: i % 10, y: 5 + Math.floor(i / 10) });
    expect(restBoost(s, undefined)).toBe(energy.maxRestBoost);
    expect(drainCut(s, undefined)).toBe(energy.maxDrainCut);
    expect(happiness(s, undefined)).toBe(energy.maxHappiness);
  });
});

describe('placing and moving rooms', () => {
  it('builds a room where the player puts it, if it fits', () => {
    const s = createInitialState(0);
    s.sentences = 1e9;
    expect(buyRoom(s, 'break', undefined, [0, 0])).toBe(false); // on top of room 1
    expect(buyRoom(s, 'break', undefined, [10, 10])).toBe(true);
    const room = s.office[s.office.length - 1];
    expect(room.cells[0]).toEqual([10, 10]);
    expect(isConnected(s, room)).toBe(true); // a hallway leads to it
  });

  it('moves a room with its furniture and windows, and keeps a manager beside its department', () => {
    const s = createInitialState(0);
    s.sentences = 1e9;
    expect(buyRoom(s, 'break', undefined, [10, 0])).toBe(true);
    const lounge = s.office[1];
    s.furniture.push({ kind: 'plant', room: lounge.id, x: 10, y: 0 });
    s.windows.push({ x: 12, y: 0, side: 'n' });
    expect(moveRoomBy(s, lounge.id, 0, 5)).toBe(true);
    expect(lounge.cells[0]).toEqual([10, 5]);
    expect(s.furniture[s.furniture.length - 1]).toMatchObject({ x: 10, y: 5 });
    expect(s.windows).toContainEqual({ x: 12, y: 5, side: 'n' });
    expect(isConnected(s, lounge)).toBe(true);
    expect(moveRoomBy(s, lounge.id, -10, -5)).toBe(false); // onto room 1
    expect(roomFitsAt(s, 'office', 'comedy', newRoomCells('office', [20, 20]))).toBe(false); // nowhere near its department
  });
});

describe('shop unlocks', () => {
  it('sells hats and furniture only once enough scenes, acts and texts are finished', () => {
    withUnlocks(() => {
      const s = createInitialState(0);
      s.sentences = 1e15;
      expect(hatsForSale(s).map((h) => h.id)).toEqual(['baseball']);
      expect(wearHat(s, 0, 'beanie')).toBe(false); // locked
      expect(unlockNeeds(s, { scenes: 1 })).toBe('finish 1 scene more');
      expect(unlockNeeds(s, { acts: 2, texts: 1 })).toBe('finish 2 acts and 1 whole text more');
      s.scenesDone = ['x:1.1'];
      expect(unlocked(s, { scenes: 1 })).toBe(true);
      expect(unlockNeeds(s, { scenes: 1 })).toBe('');
      expect(wearHat(s, 0, 'beanie')).toBe(true);
      buyRoom(s, 'break');
      expect(buyFurniture(s, 'tv', 'break')).toBe(false); // needs a whole text
      s.playsDone = ['x'];
      expect(buyFurniture(s, 'tv', 'break')).toBe(true);
    });
  });
});

describe('hats', () => {
  it('moves hats between monkeys and the inventory, and swaps typewriters', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    s.monkeys[0].hat = 'tophat';
    s.monkeys[0].hatColor = 'red';
    expect(moveHat(s, 0, 'tophat', 1)).toBe(false); // the key names the dye too
    expect(moveHat(s, 0, 'tophat:red', 1)).toBe(true);
    expect(s.monkeys[0].hat).toBe('');
    expect([s.monkeys[1].hat, s.monkeys[1].hatColor]).toEqual(['tophat', 'red']);
    expect(moveHat(s, 0, 'tophat:red', 1)).toBe(false); // M-1 wears none
    expect(moveHat(s, 1, 'tophat:red', 'storage')).toBe(true);
    expect(s.stored.hats).toEqual({ 'tophat:red': 1 });
    s.monkeys[0].hat = 'cowboy';
    expect(moveHat(s, 'storage', 'tophat:red', 0)).toBe(true); // its cowboy hat goes into the inventory
    expect(s.stored.hats).toEqual({ cowboy: 1 });
    expect(s.monkeys[0].hatColor).toBe('red');
    s.monkeys[0].typewriter = 3;
    expect(swapTypewriters(s, 0, 1)).toBe(true);
    expect([s.monkeys[0].typewriter, s.monkeys[1].typewriter]).toEqual([0, 3]);
    s.monkeys[1].tempLeft = 100;
    expect(swapTypewriters(s, 0, 1)).toBe(false); // temps keep theirs
  });

  it('buys a hat with Sentences, each of a kind dearer than the last', () => {
    const s = createInitialState(0);
    s.monkeys.push(createMonkey());
    const top = hats.find((h) => h.id === 'tophat')!;
    s.currency = 1e12;
    expect(wearHat(s, 0, 'tophat')).toBe(false); // hats cost Sentences
    s.sentences = 1e12;
    expect(wearHat(s, 0, 'tophat')).toBe(true);
    expect(s.sentences).toBe(1e12 - top.cost);
    expect(s.monkeys[0].hat).toBe('tophat');
    expect(hatCost(s, 'tophat')).toBe(Math.ceil(top.cost * top.costGrowth));
    expect(wearHat(s, 1, 'tophat')).toBe(true);
    expect(s.sentences).toBe(1e12 - top.cost - Math.ceil(top.cost * top.costGrowth));
    expect(wearHat(s, 0, 'nonsense')).toBe(false);
    s.monkeys[1].manager = true;
    expect(wearHat(s, 1, 'cap')).toBe(true); // managers can dress up too
  });

  it('puts a hat taken off in the inventory: wearing it again is free, picking the one worn takes it off', () => {
    const s = createInitialState(0);
    s.sentences = 1e12;
    const m = s.monkeys[0];
    expect(wearHat(s, 0, 'tophat')).toBe(true);
    expect(wearHat(s, 0, 'cowboy')).toBe(true);
    expect(s.stored.hats).toEqual({ tophat: 1 }); // swapped off into the inventory
    const left = s.sentences;
    expect(wearHat(s, 0, 'tophat', 'tophat')).toBe(true);
    expect(s.sentences).toBe(left); // out of the inventory, free
    expect(m.hat).toBe('tophat');
    expect(s.stored.hats).toEqual({ cowboy: 1 });
    expect(wearHat(s, 0, 'tophat')).toBe(true);
    expect(m.hat).toBe('');
    expect(s.stored.hats).toEqual({ cowboy: 1, tophat: 1 });
    const price = hatCost(s, 'tophat');
    expect(wearHat(s, 0, 'tophat')).toBe(true); // the store always sells a new one
    expect(s.sentences).toBe(left - price);
    expect(s.stored.hats).toEqual({ cowboy: 1, tophat: 1 });
    expect(hatsOwned(s, 'tophat')).toBe(2);
  });

  it('has hats that share a price, and some very dear ones', () => {
    const prices = hats.map((h) => h.cost);
    expect(new Set(prices).size).toBeLessThan(prices.length);
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(1e9);
    for (let i = 1; i < hats.length; i++) expect(hats[i].cost).toBeGreaterThanOrEqual(hats[i - 1].cost); // cheapest first
    expect(new Set(hats.map((h) => h.icon)).size).toBe(hats.length); // each looks different
  });

  it('applies only the worn hat to the monkey wearing it', () => {
    const s = createInitialState(0);
    s.sentences = 1e12;
    const m = s.monkeys[0];
    const base = monkeySpeed(s, m);
    expect(wearHat(s, 0, 'crown')).toBe(true);
    expect(monkeySpeed(s, m)).toBeCloseTo(base * 1.25);
    expect(wearing(m, 'points')).toBeCloseTo(0.25);
    expect(wearHat(s, 0, 'cap')).toBe(true); // a monkey wears one hat at a time
    expect(monkeySpeed(s, m)).toBeCloseTo(base);
    expect(wearing(m, 'points')).toBe(0);
    expect(comboMultiplier(s, { ...m, chainWords: Array(50).fill('AT') })).toBe(comboCap(s) + 1);
    expect(wearHat(s, 0, 'cowboy')).toBe(true);
    energy.drainSeconds = 600;
    expect(energyRates(s, m).drainSeconds).toBeCloseTo(600 / 0.75);
    expect(wearHat(s, 0, 'beanie')).toBe(true);
    expect(energyRates(s, m).breakSeconds).toBeCloseTo(energy.breakSeconds / 1.2);
  });

  it('dyes a worn hat for Sentences, and washes it out for free', () => {
    const s = createInitialState(0);
    const m = s.monkeys[0];
    s.sentences = 2000;
    expect(dyeHat(s, 0, 'red')).toBe(false); // no hat to dye
    expect(wearHat(s, 0, 'baseball')).toBe(true);
    const left = s.sentences;
    expect(dyeHat(s, 0, 'red')).toBe(true);
    expect(m.hatColor).toBe('red');
    expect(s.sentences).toBe(left - dye.cost);
    expect(s.stats.dyes).toBe(1);
    expect(dyeCost(s)).toBe(Math.ceil(dye.cost * dye.costGrowth)); // dearer for every hat already dyed
    expect(dyeHat(s, 0, 'red')).toBe(false); // already red
    expect(dyeHat(s, 0, 'plaid')).toBe(false);
    expect(dyeHat(s, 0, '')).toBe(true);
    expect(m.hatColor).toBe('');
    expect(s.sentences).toBe(left - dye.cost);
    s.sentences = dye.cost - 1;
    expect(dyeHat(s, 0, hatColors[1].id)).toBe(false);
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
      // The words of the longest sentence so far are kept, and each one written is counted.
      expect(s.stats.sentencesWritten).toBe(1);
      expect(s.stats.longestSentence).toEqual(['CATS', 'AT', 'DOGS', 'BIRD', 'CATS']);
      expect(s.monkeys[0].chainAll).toEqual([]);
      typeAll(s, 'DOGSBIRDCATSX'); // a shorter one doesn't replace it
      expect(s.stats.sentencesWritten).toBe(2);
      expect(s.stats.longestSentence).toHaveLength(5);
    } finally {
      setWordList([]);
    }
  });
});


describe('bigger furniture', () => {
  it('gives couches and benches two squares, turned or not', () => {
    expect(pieceSize('couch')).toEqual([2, 1]);
    expect(pieceSize('couch', true)).toEqual([1, 2]);
    expect(pieceSize('bench')).toEqual([2, 1]);
    expect(pieceSize('plant', true)).toEqual([1, 1]);
    expect(footprint({ kind: 'couch', x: 3, y: 4 })).toEqual([[3, 4], [4, 4]]);
    expect(footprint({ kind: 'couch', x: 3, y: 4, turned: true })).toEqual([[3, 4], [3, 5]]);
  });

  it('stands a new couch on two free squares, and both squares hold it', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break');
    const room = s.office[1];
    expect(buyFurniture(s, 'couch')).toBe(true);
    const i = s.furniture.length - 1;
    expect(s.furniture[i].room).toBe(room.id);
    for (const [x, y] of footprint(s.furniture[i])) expect(cellAt(s, room.id, x, y)).toBe(i);
    // Fill the room with couches: each one fits whole, never overlapping another.
    while (buyFurniture(s, 'couch'));
    const squares = s.furniture.filter((f) => f.kind === 'couch').flatMap((f) => footprint(f).map(([x, y]) => `${x},${y}`));
    expect(new Set(squares).size).toBe(squares.length);
  });

  it('only puts a piece down where all its squares are free floor', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break');
    const room = s.office[1];
    const [x, y] = [...room.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    expect(fitsAt(s, room.id, 'couch', x, y)).toBe(true);
    expect(fitsAt(s, room.id, 'couch', x - 1, y)).toBe(false); // half outside the room
    buyFurniture(s, 'plant', 'break');
    const plant = s.furniture.length - 1;
    expect(s.furniture[plant]).toMatchObject({ room: room.id, x, y });
    expect(fitsAt(s, room.id, 'couch', x, y)).toBe(false);
    expect(fitsAt(s, room.id, 'couch', x, y, false, plant)).toBe(true); // the plant being moved doesn't count
  });

  it('turns only bigger pieces, and a piece can move onto its own old squares', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break');
    buyFurniture(s, 'plant');
    expect(rotateFurniture(s, s.furniture.length - 1)).toBe(false);
    expect(rotateFurniture(s, 99)).toBe(false);
    s.furniture.pop();
    buyFurniture(s, 'couch');
    const i = s.furniture.length - 1;
    const room = s.office[1];
    const [x, y] = [...room.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    expect(s.furniture[i]).toMatchObject({ x, y });
    expect(rotateFurniture(s, i)).toBe(true);
    expect(s.furniture[i].turned).toBe(true);
    expect(moveFurniture(s, i, room.id, x, y)).toBe(true); // stands 1 x 2 now
    expect(cellAt(s, room.id, x, y + 1)).toBe(i);
    expect(cellAt(s, room.id, x + 1, y)).toBe('floor');
    expect(rotateFurniture(s, i)).toBe(true);
    expect(s.furniture[i].turned).toBeUndefined();
  });
});

describe('doors and hallways', () => {
  it('places each new room apart from rooms of its kind, with a hallway or a door straight in back to the first room', () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e30;
    s.departments = ['comedy', 'tragedy', 'history'];
    for (let i = 0; i < 4; i++) expect(buyRoom(s, 'break')).toBe(true);
    expect(buyRoom(s, 'department', 'tragedy')).toBe(true);
    expect(buyRoom(s, 'department', 'history')).toBe(true);
    expect(s.halls.length).toBeGreaterThan(0);
    for (const r of s.office) expect(isConnected(s, r)).toBe(true);
    // Rooms of one kind never share a wall; a break room and a department's room that do have a door between them.
    const owner = new Map(s.office.flatMap((r) => r.cells.map(([x, y]) => [`${x},${y}`, r] as const)));
    for (const r of s.office) {
      for (const [x, y] of r.cells) {
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const other = owner.get(`${x + dx},${y + dy}`);
          if (!other || other === r) continue;
          expect(other.kind).not.toBe(r.kind);
          expect(doorBetween(s, r, other)).toBe(true);
        }
      }
    }
    // The first break room went against room 1, and every department has a lounge.
    expect(doorBetween(s, s.office[0], s.office[1])).toBe(true);
    for (const r of s.office.filter((r) => r.kind === 'department')) expect(loungeOf(s, r)).toBeDefined();
  });

  it('puts a door in when a room grows against a room of the other kind', () => {
    const s = createInitialState(0); // room 1: 2x2 at 0,0
    s.currency = s.sentences = 1e30;
    s.office.push({ id: 'r2', kind: 'break', department: '', cells: [[3, 0]] });
    expect(doorBetween(s, s.office[0], s.office[1])).toBe(false);
    expect(expandRoom(s, 'r1', [2, 0])).toBe(true);
    expect(doorBetween(s, s.office[0], s.office[1])).toBe(true);
  });

  it("stops a room's monkeys and furniture working when nothing leads to it", () => {
    const s = createInitialState(0);
    s.currency = s.sentences = 1e30;
    s.letters = ['A'];
    const lounge = addRoom(s, 'break', '', 3, 3);
    s.furniture.push({ kind: 'tv', room: lounge.id, x: lounge.cells[0][0], y: lounge.cells[0][1] });
    expect(restBoost(s, undefined)).toBeGreaterThan(0);
    s.doors = s.doors.filter((d) => !lounge.cells.some(([x, y]) => x === d.x && y === d.y)); // take out its door
    for (const [x, y] of [...s.halls]) toggleHall(s, x, y); // and any hallway
    expect(s.doors).toHaveLength(0); // doors onto nothing go too
    expect(isConnected(s, lounge)).toBe(false);
    expect(restBoost(s, undefined)).toBe(0);
    expect(happiness(s, undefined)).toBe(0);
    autoConnect(s);
    expect(isConnected(s, lounge)).toBe(true);

    s.departments = ['comedy', 'tragedy'];
    const room = addRoom(s, 'department', 'tragedy', 3, 3);
    s.monkeys.push({ ...createMonkey(), department: 'tragedy' });
    const m = s.monkeys[1];
    expect(canReachDesk(s, m)).toBe(true);
    const doors = s.doors.filter((d) => room.cells.some(([x, y]) => x === d.x && y === d.y));
    s.doors = s.doors.filter((d) => !doors.includes(d));
    expect(canReachDesk(s, m)).toBe(false);
    tick(s, 10, rng);
    expect(m.progress).toBe(0); // it can't get to its desk to type
    expect(currentSpeed(s, m)).toBe(0);
  });

  it('picks a door up out of a wall and puts it in another', () => {
    const s = createInitialState(0);
    toggleHall(s, 0, -1);
    toggleHall(s, -1, 0);
    expect(placeDoor(s, 0, 0, 'n')).toBe(true);
    expect(placeDoor(s, 0, 0, 'n')).toBe(false); // already one there
    expect(placeDoor(s, 1, 1, 's')).toBe(false); // nothing behind that wall
    expect(takeDoor(s, 0, 0)).toEqual({ x: 0, y: 0, side: 'n' });
    expect(s.doors).toEqual([]);
    expect(takeDoor(s, 0, 0)).toBeUndefined();
    expect(placeDoor(s, 0, 0, 'w')).toBe(true);
  });

  it('cycles a door around the walls of a square, and lays or lifts hallway squares', () => {
    const s = createInitialState(0); // a 2x2 room at 0,0
    expect(cycleDoor(s, 0, 0)).toBe(false); // nothing beyond its walls yet
    expect(toggleHall(s, 0, 0)).toBe(false); // part of a room
    expect(toggleHall(s, 0, -1)).toBe(true);
    expect(toggleHall(s, -1, 0)).toBe(true);
    expect(doorSides(s, 0, 0)).toEqual(['n', 'w']);
    expect(cycleDoor(s, 0, 0)).toBe(true);
    expect(s.doors).toEqual([{ x: 0, y: 0, side: 'n' }]);
    cycleDoor(s, 0, 0);
    expect(s.doors).toEqual([{ x: 0, y: 0, side: 'w' }]);
    cycleDoor(s, 0, 0);
    expect(s.doors).toEqual([]);
    expect(toggleHall(s, 0, -1)).toBe(true); // lifted again
    expect(s.halls).toEqual([[-1, 0]]);
  });

  it('lays out an older office where every room started at the same corner', () => {
    const s = createInitialState(0);
    s.office.push({ id: 'r2', kind: 'break', department: '', cells: rectangle(3, 3) });
    s.furniture.push({ kind: 'plant', room: 'r2', x: 1, y: 1 });
    layOutOffice(s);
    const r2 = s.office[1];
    expect(r2.cells.some(([x, y]) => s.office[0].cells.some(([a, b]) => a === x && b === y))).toBe(false);
    const plant = s.furniture[1];
    expect(r2.cells.some(([x, y]) => x === plant.x && y === plant.y)).toBe(true); // furniture moved with its room
    expect(connectedRooms(s).has('r2')).toBe(true);
  });
});

describe('achievements', () => {
  it('unlock firsts as they happen, once each, in order', () => {
    const s = createInitialState(0);
    expect(checkAchievements(s)).toEqual([]);
    chooseFirstLetter(s, 'i');
    typeLetter(s, 0, rng);
    poke(s);
    tick(s, 0.1, rng);
    expect(s.achievements).toEqual(['first-word', 'first-pet']);
    expect(checkAchievements(s)).toEqual([]);
    renameMonkey(s, 0, 'Bobo');
    s.stats.pets = 999;
    expect(checkAchievements(s)).toEqual(['first-name', 'pets-100']);
    poke(s);
    expect(s.achievements).toContain('pets-1000');
  });

  it('measures each stat, including secret words and worn hats', () => {
    const s = createInitialState(0);
    s.stats.words = { MONKEY: 2, CAT: 1 };
    s.monkeys[0].hat = 'crown';
    expect(achievementValue(s, 'word:MONKEY')).toBe(2);
    expect(achievementValue(s, 'dictionary')).toBe(2);
    expect(achievementValue(s, 'wearing:crown')).toBe(1);
    expect(achievementValue(s, 'biggestDepartment')).toBe(1);
    checkAchievements(s);
    expect(s.achievements).toEqual(expect.arrayContaining(['word-monkey', 'crown', 'first-hat']));
  });

  it('every achievement has a known measure and a unique id', () => {
    const known = new Set(['wordsSpelled', 'lettersOwned', 'chain', 'chainSentences', 'linesWritten', 'scenes', 'acts', 'plays', 'monkeys', 'named', 'managers', 'departments', 'rooms', 'furniture', 'harmony', 'hats', 'hatKinds', 'dyed', 'skill', 'typewriter', 'keys', 'slots', 'pets', 'happiest', 'longestWord', 'dictionary', 'lettersTyped', 'biggestDepartment', 'hoursTyping', 'points', 'folios', 'researchers', 'researched', 'hrStaff', 'marketers', 'flipsWon', 'flipsLost']);
    for (const a of achievements) expect(known.has(a.stat) || /^(word|wearing):/.test(a.stat), a.id).toBe(true);
    expect(new Set(achievements.map((a) => a.id)).size).toBe(achievements.length);
  });
});

describe('publishing a Folio', () => {
  const play = {
    id: 'folio-test',
    title: 'Folio Test',
    lines: [
      [1, 1, 'A', 'I.'],
      [1, 1, 'B', 'I.'],
      [1, 2, 'A', 'I.'],
    ] as [number, number, string, string][],
  };
  afterEach(() => setPlays([]));

  it('opens once a play is finished, and banks a page per line written plus each finished play again', () => {
    setPlays([play]);
    const s = createInitialState(0);
    expect(canPublishFolio(s)).toBe(false);
    expect(publishFolio(s)).toBeNull();
    s.completed = { 'folio-test': [0, 1, 2], other: [5] };
    s.playsDone = ['folio-test'];
    expect(canPublishFolio(s)).toBe(true);
    expect(folioPagesNow(s)).toBe(4 + 3 * folio.finishedPlayPages);
  });

  it('starts over, keeping achievements, statistics, options and the Folio, which raises points for good', () => {
    setPlays([play]);
    const s = createInitialState(0);
    chooseFirstLetter(s, 'i');
    s.currency = s.sentences = 1e9;
    s.monkeys.push(createMonkey());
    s.completed = { 'folio-test': [0, 1, 2] };
    s.playsDone = ['folio-test'];
    s.stats.pets = 5;
    s.achievements = ['first-pet'];
    s.settings.autoPlaceFurniture = false;
    const next = publishFolio(s)!;
    expect(next.currency).toBe(0);
    expect(next.monkeys).toHaveLength(1);
    expect(next.letters).toEqual([]);
    expect(next.playsDone).toEqual([]);
    expect(next.folios).toBe(1);
    expect(next.folioPages).toBe(6);
    expect(next.stats.pets).toBe(5);
    expect(next.settings.autoPlaceFurniture).toBe(false);
    expect(next.achievements).toEqual(['first-pet', 'first-folio']);
    expect(folioMultiplier(next)).toBeCloseTo(1 + 6 * folio.bonusPerPage);
    // A second Folio multiplies the first.
    next.completed = { 'folio-test': [0, 1, 2] };
    next.playsDone = ['folio-test'];
    const third = publishFolio(next)!;
    expect(third.folios).toBe(2);
    expect(third.folioPages).toBe(12);
    chooseFirstLetter(third, 'i');
    typeLetter(third, 0, rng);
    // Folios multiply each other.
    expect(folioMultiplier(third)).toBeCloseTo((1 + 6 * folio.bonusPerPage) ** 2);
    expect(third.currency).toBeCloseTo((1 + 6 * folio.bonusPerPage) ** 2); // the word I pays 1 point, times the Folios
  });
});

describe('coin flip', () => {
  it('doubles every banana or loses them all, just for fun', async () => {
    const { flipCoin } = await import('../src/game/logic');
    const s = createInitialState(0);
    expect(flipCoin(s, () => 0)).toBeNull(); // nothing to bet
    s.currency = 300;
    expect(flipCoin(s, () => 0.005)).toBe(true);
    expect(s.currency).toBe(600);
    expect(flipCoin(s, () => 0.02)).toBe(false);
    expect(s.currency).toBe(0);
    expect(s.stats).toMatchObject({ flipsWon: 1, flipsLost: 1 });
    expect(s.achievements).toEqual(expect.arrayContaining(['flip-won', 'flip-lost']));
    const { flipChance } = await import('../src/game/logic');
    s.scenesDone = ['a', 'b'];
    expect(flipChance(s)).toBeCloseTo(0.01 + 0.001 * (s.achievements.length + 2 + 1)); // + the flip won
    s.achievements = Array(9999).fill('x');
    expect(flipChance(s)).toBe(0.5);
  });
});

describe('manager speed', () => {
  it('changes slots quicker with upgrades, office furniture and (with the book) chi', () => {
    const s = createInitialState(0);
    s.departments = ['comedy'];
    s.monkeys = Array.from({ length: managers.minDepartmentMonkeys + 1 }, createMonkey);
    s.sentences = 1e9;
    expect(buyRoom(s, 'office', 'comedy')).toBe(true);
    expect(toggleManager(s, 0)).toBe(true);
    const boss = s.monkeys[0];
    expect(managerSpeed(s, boss)).toBe(1);
    expect(upgradeManager(s, 0)).toBe(true); // the one manager upgrade speeds it up too
    expect(managerSpeed(s, boss)).toBeCloseTo(1 + managers.speedPerLevel);
    // A plant goes in the manager's office (the Manager store places it there); a couch can't.
    expect(buyFurniture(s, 'plant', 'office')).toBe(true);
    expect(s.office.find((r) => r.id === s.furniture.at(-1)!.room)!.kind).toBe('office');
    expect(buyFurniture(s, 'couch', 'office')).toBe(false);
    expect(managerSpeed(s, boss)).toBeCloseTo(1 + managers.speedPerLevel + 0.01 * managerOffice.speedPerHappiness);
    expect(slotDelay(s, boss)).toBeCloseTo(managers.secondsPerSlot / managerSpeed(s, boss));
  });
});
