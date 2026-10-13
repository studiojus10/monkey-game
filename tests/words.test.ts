import { describe, expect, it } from 'vitest';
import { Dictionary, readLetter, wordPoints, type ReadEvent } from '../src/game/words';

/** Types `stream` letter by letter and returns what was read, plus leftover pending letters. */
function read(words: string[], letters: string, stream: string) {
  const dict = new Dictionary(words, letters);
  const events: ReadEvent[] = [];
  let pending = '';
  for (const ch of stream) pending = readLetter(dict, pending, ch, events);
  return { events: events.map((e) => (e.kind === 'word' ? e.text : `-${e.text}`)), pending };
}

describe('Dictionary', () => {
  it('only keeps words spellable with the owned letters', () => {
    const dict = new Dictionary(['A', 'I', 'IT', 'cat'], 'ACIT');
    expect(dict.isWord('IT')).toBe(true);
    expect(dict.isWord('CAT')).toBe(true);
    expect(new Dictionary(['A', 'I', 'IT'], 'I').isWord('IT')).toBe(false);
    expect(dict.canGrow('I')).toBe(true);
    expect(dict.canGrow('IT')).toBe(false);
    expect(dict.longestWordAtStart('ITX')).toBe('IT');
  });
});

describe('reading the stream', () => {
  it('with only I, every letter is a word straight away', () => {
    expect(read(['A', 'I'], 'I', 'III')).toEqual({ events: ['I', 'I', 'I'], pending: '' });
  });

  it('waits for the next letter when a longer word is still possible', () => {
    // Letters I, T, G: "I" could become "IT", so it waits; G rules that out.
    expect(read(['I', 'IT'], 'ITG', 'I')).toEqual({ events: [], pending: 'I' });
    expect(read(['I', 'IT'], 'ITG', 'IG')).toEqual({ events: ['I', '-G'], pending: '' });
  });

  it('scores a word as soon as nothing longer can follow', () => {
    expect(read(['I', 'IT'], 'ITG', 'IT')).toEqual({ events: ['IT'], pending: '' });
  });

  it('reads leftover letters again after a word', () => {
    // "ITE" might become ITEM; X rules it out, IT scores, and E X is read again as EX.
    expect(read(['IT', 'ITEM', 'EX'], 'ITEMX', 'ITEX')).toEqual({ events: ['IT', 'EX'], pending: '' });
  });

  it('skips letters that do not lead to a word', () => {
    expect(read(['TAN', 'AN'], 'TANX', 'TAX')).toEqual({ events: ['-T', '-A', '-X'], pending: '' });
    expect(read(['TAN', 'AN'], 'TANX', 'TAN')).toEqual({ events: ['TAN'], pending: '' });
  });
});

describe('wordPoints', () => {
  it.each([
    ['I', 1],
    ['IT', 4],
    ['CAT', 15],
    ['ZAP', 42],
    ['QUIZ', 88],
  ])('%s scores %i', (word, points) => {
    expect(wordPoints(word)).toBe(points);
  });
});
