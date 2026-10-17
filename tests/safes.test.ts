import { describe, expect, it } from 'vitest';
import { codebreaking, safe, safes, translation } from '../src/game/config';
import {
  addSafes,
  buyRoom,
  canBuildCodebreaking,
  codebreakerBlocker,
  codebreakers,
  codebreakingRate,
  crackSafes,
  cycleCodebreakFocus,
  departmentRoom,
  findSafe,
  hireCodebreaker,
  lockedSafes,
  codebreakTargets,
  scrollFound,
  scrollLetters,
  scrollTranslated,
  translatedSentences,
  lockCombinations,
  moveFurniture,
  officeOf,
  safeAt,
  storeFurniture,
} from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey, type GameState } from '../src/game/state';
import { safeText } from '../src/cli/office';
import { renderScroll } from '../src/cli/screen';

/** Comedy and tragedy departments, each with a manager's office (and so a safe), and plenty of bananas. */
function offices(): GameState {
  const s = createInitialState(0);
  s.letters = ['I'];
  s.departments = ['comedy', 'tragedy'];
  s.monkeys[0].department = 'comedy';
  s.currency = s.sentences = 1e15;
  expect(buyRoom(s, 'department', 'tragedy')).toBe(true);
  expect(buyRoom(s, 'office', 'comedy')).toBe(true);
  expect(buyRoom(s, 'office', 'tragedy')).toBe(true);
  return s;
}
const safeIn = (s: GameState, genre: 'comedy' | 'tragedy') => s.furniture.findIndex((f) => f.kind === safe.id && f.room === officeOf(s, genre)!.id);

describe('safes', () => {
  it("come with every manager's office, stay put, and are found by inspecting them", () => {
    const s = offices();
    const c = safeIn(s, 'comedy');
    expect(c).toBeGreaterThanOrEqual(0);
    expect(storeFurniture(s, c)).toBe(false); // it can't go into the inventory
    expect(moveFurniture(s, c, departmentRoom(s, 'comedy')!.id, 0, 0)).toBe(false); // nor out of its office
    expect(safeAt(s, c)).toBeUndefined();
    expect(canBuildCodebreaking(s)).toBe(false);
    expect(findSafe(s, c, () => 0.31)).toBe(true);
    expect(s.safes.comedy).toEqual({ level: 0, combo: '33333', tries: 0, open: false, held: '' });
    expect(findSafe(s, c)).toBe(false); // found already
    expect(s.codebreakFocus).toBe('comedy');
    expect(canBuildCodebreaking(s)).toBe(true);
    expect(safeText(s, c)).toContain('Codebreaking office could crack it');
    expect(safeText(s, c)).toContain('a five-digit dial (100,000 combinations)');
    // Offices from before safes get one.
    s.furniture.splice(safeIn(s, 'tragedy'), 1);
    addSafes(s);
    expect(safeIn(s, 'tragedy')).toBeGreaterThanOrEqual(0);
    const back = deserialize(serialize(s));
    expect(back.safes).toEqual(s.safes);
    expect(back.codebreakFocus).toBe('comedy');
  });

  it('are cracked by codebreakers trying random combinations; the first holds the Greek scroll', () => {
    const s = offices();
    findSafe(s, safeIn(s, 'comedy'));
    findSafe(s, safeIn(s, 'tragedy'), () => 0.5);
    // The second safe found is harder, whichever department it's in; later ones become passwords.
    expect(s.safes.tragedy).toMatchObject({ level: 1, combo: '555555' });
    expect(lockCombinations(1)).toBe(1e6);
    expect(lockCombinations(2)).toBe(26 ** 5);
    expect(lockCombinations(4)).toBe(36 ** 6);
    for (let k = 1; k < 8; k++) expect(lockCombinations(k)).toBeGreaterThan(lockCombinations(k - 1));
    expect(lockedSafes(s)).toEqual(['comedy', 'tragedy']);
    expect(cycleCodebreakFocus(s)).toBe(true);
    expect(s.codebreakFocus).toBe('tragedy');
    expect(codebreakerBlocker(s)).toBe('Codebreaking office needed');
    expect(buyRoom(s, 'codebreaking')).toBe(true);
    expect(canBuildCodebreaking(s)).toBe(false); // one office
    expect(hireCodebreaker(s)).toBe(true);
    expect(codebreakers(s)).toEqual([1]);
    expect(codebreakingRate(s)).toBeCloseTo(codebreaking.triesPerSecond);
    // 10 seconds: 10 tries, opening it with a chance of 1 - (1 - 1e-6)^10.
    const chance = 1 - Math.pow(1 - 1e-6, 10);
    crackSafes(s, 10, () => chance + 1e-9);
    expect(s.safes.tragedy).toMatchObject({ tries: 10, open: false });
    crackSafes(s, 10, () => 0);
    expect(s.safes.tragedy).toMatchObject({ open: true, held: safes.contents[0] }); // the first opened holds the scroll
    expect(s.codebreakFocus).toBe('comedy'); // on to the next locked safe
    crackSafes(s, 1, () => 0);
    expect(s.safes.comedy.held).toBe(safes.contents[1]);
    expect(safeText(s, safeIn(s, 'comedy'))).toContain(safes.contents[1]);
    expect(lockedSafes(s)).toEqual([]);
    expect(s.codebreakFocus).toBe('scroll'); // nothing locked: on to the Greek scroll
    expect(codebreakTargets(s)).toEqual(['scroll']);
    s.monkeys.push({ ...createMonkey(), department: codebreaking.id });
    expect(codebreakers(s)).toEqual([1, 2]);
  });

  it('translate the Greek scroll a sentence at a time, and switch between it and a safe any time', () => {
    const s = offices();
    findSafe(s, safeIn(s, 'comedy'));
    buyRoom(s, 'codebreaking');
    hireCodebreaker(s);
    crackSafes(s, 1, () => 0);
    expect(scrollFound(s)).toBe(true);
    expect(s.codebreakFocus).toBe('scroll');
    expect(translatedSentences(s)).toBe(0);
    const rate = codebreakingRate(s) * translation.lettersPerTry;
    crackSafes(s, scrollLetters[0] / rate - 1);
    expect(translatedSentences(s)).toBe(0);
    crackSafes(s, 1);
    expect(translatedSentences(s)).toBe(1);
    expect(renderScroll(s)).toContain(translation.scroll.sentences[0].english.slice(0, 40));
    // A new safe: switch to it and back.
    findSafe(s, safeIn(s, 'tragedy'));
    expect(s.codebreakFocus).toBe('scroll'); // still on the scroll until you switch
    expect(codebreakTargets(s)).toEqual(['tragedy', 'scroll']);
    cycleCodebreakFocus(s);
    expect(s.codebreakFocus).toBe('tragedy');
    cycleCodebreakFocus(s);
    expect(s.codebreakFocus).toBe('scroll');
    crackSafes(s, 1e9);
    expect(scrollTranslated(s)).toBe(true);
    expect(s.codebreakFocus).toBe('tragedy');
    expect(deserialize(serialize(s)).translated).toBe(s.translated);
  });
});
