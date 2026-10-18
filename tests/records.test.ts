import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hr, records } from '../src/game/config';
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
  tempTypewriter,
} from '../src/game/logic';
import { bookRows } from '../src/cli/library';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState, createMonkey } from '../src/game/state';

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
    expect(sentencesIn(words('xu he is dead cat sat on it'))).toEqual([words('he is dead'), words('cat sat on it')]);
  });
});

describe('the Records department', () => {
  const play = { id: 'p', title: 'P', lines: [[1, 1, 'A', 'The cat sat on a mat.'] as [number, number, string, string]] };
  function withRecords() {
    setPlays([play]);
    const s = createInitialState(0);
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
    const s = createInitialState(0);
    s.monkeys = [0, 3, 1, 5].map((typewriter) => ({ ...createMonkey(), typewriter }));
    expect(tempTypewriter(s, hr.tempSecondTypewriter - 0.01)).toBe(3);
    expect(tempTypewriter(s, hr.tempSecondTypewriter)).toBe(5);
    s.monkeys[3].tempLeft = 100; // temps don't count
    expect(tempTypewriter(s, 0)).toBe(1);
  });
});
