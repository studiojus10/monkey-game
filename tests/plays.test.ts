import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlay, lineLocation, textToWords, type PlayData } from '../src/game/plays';

describe('plays', () => {
  it('reduces text to upper-case words, dropping apostrophes and punctuation', () => {
    expect(textToWords("O'er the hills, 'tis hey-day!")).toEqual(['OER', 'THE', 'HILLS', 'TIS', 'HEY', 'DAY']);
  });

  it('indexes lines by their letters, sharing entries for identical lines', () => {
    const play = buildPlay({
      id: 't',
      title: 'T',
      lines: [
        [1, 1, 'A', 'No.'],
        [1, 2, 'B', 'Ay, my lord.'],
        [2, 0, 'C', 'No!'],
      ],
    });
    expect(play.byLetters.get('NO')).toEqual([0, 2]);
    expect(play.lines[1]).toMatchObject({ words: ['AY', 'MY', 'LORD'], letters: 'AYMYLORD', points: 44 });
    expect(play.words.has('LORD')).toBe(true);
    expect(play.longestLine).toBe(8);
    expect(lineLocation(play.lines[1])).toBe('1.2');
    expect(lineLocation(play.lines[2])).toBe('2 prologue');
  });

  it('ships playable data files', () => {
    const dir = new URL('../data/plays/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as PlayData;
      expect(data.id + '.json').toBe(f);
      expect(data.lines.length).toBeGreaterThan(1000);
      const play = buildPlay(data);
      expect(play.lines.every((l) => l.letters.length > 0)).toBe(true);
    }
  });
});
