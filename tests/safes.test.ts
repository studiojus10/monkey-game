import { describe, expect, it } from 'vitest';
import { codebreaking, enigma, safe, safes, translation } from '../src/game/config';
import { encipher, inGroups, randomKey } from '../src/game/enigma';
import type { PlayData } from '../src/game/plays';
import {
  buyFurniture,
  officesWithoutSafe,
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
  deliverTelegrams,
  genresWithPlays,
  projectsLeft,
  telegramCipher,
  telegramSettings,
  telegramText,
  unreadTelegram,
  setPlays,
} from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey, type GameState } from '../src/game/state';
import { safeText } from '../src/cli/office';
import { renderScroll, renderTelegrams, storeItems } from '../src/cli/screen';

/** What the Manager furniture store sells. */
const sold = (s: GameState) => storeItems(s, 'office').map((x) => x.text).join('|');

/** Comedy and tragedy departments, each with a manager's office and a safe bought for it, and plenty of bananas. */
function offices(): GameState {
  const s = createInitialState(0);
  s.letters = ['I'];
  s.departments = ['comedy', 'tragedy'];
  s.monkeys[0].department = 'comedy';
  s.currency = s.sentences = 1e15;
  expect(buyRoom(s, 'department', 'tragedy')).toBe(true);
  expect(buyRoom(s, 'office', 'comedy')).toBe(true);
  expect(buyRoom(s, 'office', 'tragedy')).toBe(true);
  expect(buyFurniture(s, 'safe', 'office')).toBe(true);
  expect(buyFurniture(s, 'safe', 'office')).toBe(true);
  return s;
}
const safeIn = (s: GameState, genre: 'comedy' | 'tragedy') => s.furniture.findIndex((f) => f.kind === safe.id && f.room === officeOf(s, genre)!.id);

describe('safes', () => {
  it("are sold for a manager's office that has none, one each, stay put, and are found by inspecting them", () => {
    const fresh = createInitialState(0);
    fresh.departments = ['comedy'];
    fresh.sentences = 1e15;
    expect(sold(fresh)).not.toContain('Safe');
    expect(buyRoom(fresh, 'office', 'comedy')).toBe(true);
    expect(officesWithoutSafe(fresh)).toHaveLength(1); // offices come without one
    expect(sold(fresh)).toContain('Safe');
    const before = fresh.sentences;
    expect(buyFurniture(fresh, 'safe', 'office')).toBe(true);
    expect(before - fresh.sentences).toBe(safe.cost);
    expect(buyFurniture(fresh, 'safe', 'office')).toBe(false); // one per office
    expect(sold(fresh)).not.toContain('Safe');

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

describe('telegrams', () => {
  it('run on a real Enigma machine', () => {
    // The well-known check: rotors I II III at AAA, reflector B, no plugs.
    expect(encipher({ rotors: [0, 1, 2], start: 'AAA', plugs: '' }, 'AAAAA')).toBe('BDZGO');
    const key = randomKey(enigma.leads, () => 0.37);
    expect(new Set(key.rotors).size).toBe(3);
    expect(key.plugs).toHaveLength(enigma.leads * 2);
    const text = 'FLIBBERTHEWOBSNARK';
    const cipher = encipher(key, text);
    expect(cipher).not.toBe(text);
    expect(encipher(key, cipher)).toBe(text); // the same key reads it back
    expect([...cipher].every((c, i) => c !== text[i])).toBe(true); // Enigma never turns a letter into itself
  });

  it('come once every safe is open, are studied by R&D, and read by the Bombe', () => {
    setPlays(['comedy', 'tragedy'].map((genre) => ({ id: genre, title: genre, genre, lines: [[1, 1, 'A', 'No.']] }) as PlayData));
    try {
      telegramsCome();
    } finally {
      setPlays([]);
    }
  });
});

/** Two departments' safes opened, then telegrams through to the second. */
function telegramsCome() {
  const s = offices();
  findSafe(s, safeIn(s, 'comedy'));
  expect(buyRoom(s, 'codebreaking')).toBe(true);
  expect(hireCodebreaker(s)).toBe(true);
  expect(deliverTelegrams(s, 1)).toBe(false); // not while a safe is locked
  expect(genresWithPlays()).toEqual(['comedy', 'tragedy']);
  findSafe(s, safeIn(s, 'tragedy'));
  crackSafes(s, 1e9, () => 0);
  crackSafes(s, 1e9, () => 0);
  expect(lockedSafes(s)).toEqual([]);
  s.translated = 1e9; // the scroll is done
  expect(deliverTelegrams(s, 1, () => 0.5)).toBe(true);
  expect(deliverTelegrams(s, 1)).toBe(false); // one at a time
  const t = unreadTelegram(s)!;
  expect(t.keyAt).toBe(1 + Math.floor(0.5 * telegramSettings(0)));
  expect(telegramCipher(s, 0)).toBe(encipher(t.key, telegramText(0)));
  expect(renderTelegrams(s)).toContain(inGroups(telegramCipher(s, 0)).slice(0, 23));
  expect(codebreakTargets(s)).toEqual([]); // no Bombe yet
  // R&D: study the telegram, then the Bombe, then perfecting it, in turn.
  const left = () => projectsLeft(s).map((p) => p.id);
  expect(left()).toContain('cribs');
  expect(left()).not.toContain('bombe');
  s.researched.push('cribs');
  expect(left()).toContain('bombe');
  expect(left()).not.toContain('bombe2');
  s.researched.push('bombe');
  expect(codebreakTargets(s)).toEqual(['telegram']);
  const rate = codebreakingRate(s) * enigma.settingsPerTry;
  expect(rate).toBeGreaterThan(0);
  crackSafes(s, 10);
  expect(s.codebreakFocus).toBe('telegram');
  expect(t.tested).toBeCloseTo(10 * rate);
  s.researched.push('bombe2'); // twice as fast
  crackSafes(s, 10);
  expect(t.tested).toBeCloseTo(30 * rate);
  crackSafes(s, 1e9);
  expect(t.read).toBe(true);
  expect(renderTelegrams(s)).toContain(telegramText(0).slice(0, 20));
  // The next comes a while after.
  expect(deliverTelegrams(s, enigma.hoursBetween * 3600 - 1)).toBe(false);
  expect(deliverTelegrams(s, 1, () => 0.5)).toBe(true);
  expect(s.telegrams[1].key.plugs).toHaveLength((enigma.leads + 1) * 2);
  expect(telegramSettings(1)).toBeGreaterThan(telegramSettings(0));
  const back = deserialize(serialize(s));
  expect(back.telegrams).toEqual(s.telegrams);
  expect(back.telegramWait).toBe(s.telegramWait);
}
