import { wordPoints } from './words';

/** A play as stored in data/plays/<id>.json: [act, scene, speaker, text] per line. */
export interface PlayData {
  id: string;
  title: string;
  lines: [number, number, string, string][];
}

export interface PlayLine {
  act: number;
  scene: number;
  speaker: string;
  text: string; // as printed
  words: string[]; // upper case, letters only
  letters: string; // the words joined, which is what a monkey has to type
  points: number; // sum of the words' points
}

export interface Play {
  id: string;
  title: string;
  lines: PlayLine[];
  /** Line indices by their letters; identical lines share an entry. */
  byLetters: Map<string, number[]>;
  /** Every word in the play, so they can score even if the word list lacks them. */
  words: Set<string>;
  longestLine: number; // in letters
}

/** Splits text into upper-case words; apostrophes are dropped ("o'er" -> OER). */
export function textToWords(text: string): string[] {
  return text.toUpperCase().replace(/['’]/g, '').split(/[^A-Z]+/).filter(Boolean);
}

export function buildPlay(data: PlayData): Play {
  const byLetters = new Map<string, number[]>();
  const words = new Set<string>();
  let longestLine = 0;
  const lines = data.lines.map(([act, scene, speaker, text], i) => {
    const w = textToWords(text);
    const letters = w.join('');
    w.forEach((x) => words.add(x));
    longestLine = Math.max(longestLine, letters.length);
    const same = byLetters.get(letters);
    if (same) same.push(i);
    else byLetters.set(letters, [i]);
    return { act, scene, speaker, text, words: w, letters, points: w.reduce((n, x) => n + wordPoints(x), 0) };
  });
  return { id: data.id, title: data.title, lines, byLetters, words, longestLine };
}

/** Where a line sits in the play, e.g. "1.2" for act 1, scene 2 (scene 0 is a prologue). */
export function lineLocation(line: PlayLine): string {
  return line.scene === 0 ? `${line.act} prologue` : `${line.act}.${line.scene}`;
}
