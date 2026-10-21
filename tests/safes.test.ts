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
  unlockGreek,
  departmentGenres,
  getPlay,
  ownsScene,
  keyboard,
  dictionaryFor,
  typeLetter,
} from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey, type GameState } from '../src/game/state';
import { safeText } from '../src/cli/office';
import { renderContents, renderScript, renderTelegrams, storeItems, textsTabs } from '../src/cli/screen';
import { plainText } from '../src/cli/style';
import { readFileSync } from 'node:fs';
import { greekLetters } from '../src/game/plays';
import { wordPoints } from '../src/game/words';

/** What the furniture store sells. */
const sold = (s: GameState) => storeItems(s, 'furniture').map((x) => x.text).join('|');

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
    expect(safeText(s, c)).toContain('Codebreaking Department could crack it');
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
    expect(codebreakerBlocker(s)).toBe('Codebreaking Department needed');
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
    expect(s.codebreakFocus).toBe(''); // nothing left to crack
    // The Texts page's Codes tab lists each safe with its combination once cracked.
    expect(textsTabs(s)).toContain('codes');
    const codes = plainText(renderContents(s, null, 0, '', 0, 'codes'));
    expect(codes).toContain(`Comedies safe  ${s.safes.comedy.combo}`);
    expect(codes).toContain(s.safes.tragedy.combo);
    expect(codebreakTargets(s)).toEqual([]);
    s.monkeys.push({ ...createMonkey(), department: codebreaking.id });
    expect(codebreakers(s)).toEqual([1, 2]);
  });

  it('open the Greek department with the scroll, whose monkeys type Greek that turns into English', () => {
    const text = JSON.parse(readFileSync('data/plays/metaphysics-1-4.json', 'utf8')) as PlayData;
    setPlays([text]);
    try {
      const s = offices();
      findSafe(s, safeIn(s, 'comedy'));
      buyRoom(s, 'codebreaking');
      hireCodebreaker(s);
      expect(unlockGreek(s)).toBe(false); // no scroll yet
      crackSafes(s, 1, () => 0);
      expect(scrollFound(s)).toBe(true);
      expect(unlockGreek(s)).toBe(true);
      expect(unlockGreek(s)).toBe(false);
      expect(departmentGenres(s)).toContain('greek');
      const play = getPlay(translation.firstText)!;
      expect(play.scenes.every((sc) => ownsScene(s, play.id, sc))).toBe(true);
      // Greek monkeys type the 24 Greek capitals, and only the text's own words count.
      expect(keyboard(s, 'greek').map((k) => k.text)).toEqual(greekLetters);
      const dict = dictionaryFor(s, 'greek');
      expect(dict.isWord('ΛΕΥΚΙΠΠΟΣ')).toBe(true);
      expect(dict.isWord('HAMLET')).toBe(false);
      expect(wordPoints('ΛΕΥΚΙΠΠΟΣ')).toBeGreaterThan(0);
      // A Greek monkey types the first line letter by letter: it's written, and reads in English.
      s.monkeys.push({ ...createMonkey(), department: 'greek' });
      const i = s.monkeys.length - 1;
      for (const ch of play.lines[0].letters + 'Α') typeLetter(s, i, () => (greekLetters.indexOf(ch) + 0.5) / greekLetters.length);
      expect(s.completed[play.id]).toContain(0);
      expect(plainText(renderScript(s, play.id, 0))).toContain(play.english[0].slice(0, 30));
      expect(plainText(renderScript(s, play.id, 0))).toContain(play.lines[1].text.slice(0, 10)); // the next is still Greek
      const tabs = textsTabs(s);
      expect(tabs).toContain('foreign');
      expect(plainText(renderContents(s, null, 0, '', 0, 'foreign'))).toContain(play.title);
      expect(plainText(renderContents(s, null, 0, '', 0, 'plays'))).not.toContain(play.title);
    } finally {
      setPlays([]);
    }
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
