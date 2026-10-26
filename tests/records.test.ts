import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hr, managers, records } from '../src/game/config';
import { isGrammatical, sentencesIn, setLexicon } from '../src/game/grammar';
import {
  buyRoom,
  canBuildRecords,
  chooseFirstLetter,
  hireFor,
  posts,
  publishFolio,
  recordChain,
  recordCount,
  recordsRoom,
  recordsShare,
  setPlays,
  setWordList,
  sentenceMultiplier,
  tempTypewriter,
  typeLetter,
} from '../src/game/logic';
import { bookRows } from '../src/cli/library';
import { deserialize, serialize } from '../src/game/save';
import { createMonkey } from '../src/game/state';
import { startedGame } from './start';

setLexicon(readFileSync(new URL('../data/lexicon.txt', import.meta.url), 'utf8').split('\n'));
const words = (text: string) => text.toUpperCase().split(' ');

describe('the grammar check', () => {
  it.each(['the cat sat on a mat', 'kings love gold', 'he is dead', 'they will eat the red fish', 'she has eaten', 'we did not go', 'it was in the box and i ran'])('passes "%s"', (t) => {
    expect(isGrammatical(words(t))).toBe(true);
  });

  it.each(['cat the sat', 'he love gold', 'the dogs runs', 'is it', 'the cat'])('fails "%s"', (t) => {
    expect(isGrammatical(words(t))).toBe(false);
  });

  it('finds the sentences inside a chain, longest first, without overlaps', () => {
    expect(sentencesIn(words('xu he is dead xu cat sat on it'))).toEqual([words('he is dead'), words('cat sat on it')]);
  });
});

describe('the Records department', () => {
  const play = { id: 'p', title: 'P', lines: [[1, 1, 'A', 'The cat sat on a mat.'] as [number, number, string, string]] };
  function withRecords() {
    setPlays([play]);
    const s = startedGame(0);
    s.departments = ['comedy'];
    s.owned = ['p'];
    chooseFirstLetter(s, 'i');
    s.sentences = s.currency = 1e15;
    s.playsDone = ['p'];
    expect(canBuildRecords(s)).toBe(false); // the Library first
    expect(buyRoom(s, 'library')).toBe(true);
    expect(canBuildRecords(s)).toBe(true);
    expect(buyRoom(s, 'records')).toBe(true);
    return s;
  }

  it('hires clerks who catch a share of the sentences, skipping repeats and lines of the texts', () => {
    const s = withRecords();
    recordChain(s, words('kings love gold'));
    expect(recordCount(s)).toBe(0); // nobody to write it down
    const post = posts(s).find((p) => p.id === records.id)!;
    expect(post.have).toBe(0);
    for (let k = 0; k < 5; k++) expect(hireFor(s, post)).toBe(true);
    s.monkeys.forEach((m) => Object.assign(m, { trait: 'loner', jobs: {} }));
    expect(recordsShare(s)).toBe(1);
    recordChain(s, words('kings love gold'));
    recordChain(s, words('kings love gold')); // a repeat
    recordChain(s, words('the cat sat on a mat')); // a line of the play
    expect(s.recordDraft).toEqual(['KINGS LOVE GOLD']);
  });

  it('fills books of bookSize sentences, shelves them, and keeps them through a Folio and a save', () => {
    const s = withRecords();
    s.monkeys.push({ ...createMonkey(), department: records.id }, { ...createMonkey(), department: records.id });
    s.furniture.push({ kind: 'desk', room: recordsRoom(s)!.id, x: 0, y: 0 }, { kind: 'desk', room: recordsRoom(s)!.id, x: 2, y: 0 });
    expect(recordsShare(s)).toBeCloseTo(2 * records.catchEach);
    s.recordDraft = Array.from({ length: records.bookSize - 1 }, (_, k) => `SENTENCE ${k}`);
    s.recordCatch = 0.9;
    recordChain(s, words('kings love gold'));
    expect(s.recordBooks).toHaveLength(1);
    expect(s.recordDraft).toEqual([]);
    expect(s.shelved).toContain('records-1');
    expect(bookRows(s, 'records-1')[0]).toBe('  1. SENTENCE 0');
    const loaded = deserialize(serialize(s))!;
    expect(loaded.recordBooks).toEqual(s.recordBooks);
    expect(publishFolio(s)!.recordBooks).toEqual(s.recordBooks);
  });
});

describe('temps', () => {
  it("bring the second-best typewriter in the office, or now and then the best", () => {
    const s = startedGame(0);
    s.monkeys = [0, 3, 1, 5].map((typewriter) => ({ ...createMonkey(), typewriter }));
    expect(tempTypewriter(s, hr.tempSecondTypewriter - 0.01)).toBe(3);
    expect(tempTypewriter(s, hr.tempSecondTypewriter)).toBe(5);
    s.monkeys[3].tempLeft = 100; // temps don't count
    expect(tempTypewriter(s, 0)).toBe(1);
  });
});

describe("a manager's Sentences multiplier", () => {
  it('starts at its upgrades, rises with grammatical sentences and falls back to them with the rest', () => {
    setWordList(['KINGS', 'LOVE', 'GOLD', 'LOVES']);
    try {
      const s = startedGame(0);
      s.departments = ['comedy'];
      s.letters = ['K', 'I', 'N', 'G', 'S', 'L', 'O', 'V', 'E', 'D', 'X'];
      s.monkeys[0].department = 'comedy';
      s.monkeys.push({ ...createMonkey(), department: 'comedy', manager: true, managerLevel: 2 });
      const boss = s.monkeys[1];
      expect(sentenceMultiplier(boss)).toBeCloseTo(1 + 2 * managers.sentencePerLevel);
      const type = (text: string) => {
        for (const ch of text) typeLetter(s, 0, () => (s.letters.indexOf(ch) + 0.5) / s.letters.length);
      };
      type('KINGSLOVEGOLDXX'); // "kings love gold": grammatical
      expect(boss.sentenceStreak).toBeCloseTo(managers.sentenceGood);
      expect(s.sentences).toBeCloseTo(1 + 2 * managers.sentencePerLevel + managers.sentenceGood);
      type('GOLDGOLDGOLDXX'); // a Sentence, but not grammatical
      expect(boss.sentenceStreak).toBeCloseTo(managers.sentenceGood - managers.sentenceBad);
      type('GOLDGOLDGOLDXX');
      type('GOLDGOLDGOLDXX');
      expect(boss.sentenceStreak).toBe(0); // never below its base
      expect(deserialize(serialize(s))!.monkeys[1].sentenceStreak).toBe(0);
    } finally {
      setWordList([]);
    }
  });
});
