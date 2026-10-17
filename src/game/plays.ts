import { wordPoints } from './words';

export type Genre = 'comedy' | 'history' | 'tragedy' | 'sonnet' | 'greek';
/** Genres whose departments open as your monkeys grow. */
export const genres: Genre[] = ['comedy', 'history', 'tragedy', 'sonnet'];
/** Foreign texts: their department opens when the first such text is found (the Greek scroll, in the first safe opened). */
export const foreignGenres: Genre[] = ['greek'];
export const allGenres: Genre[] = [...genres, ...foreignGenres];
/** The play genres; the sonnet department opens only after all of these. */
export const playGenres: Genre[] = ['comedy', 'history', 'tragedy'];

/** A play as stored in data/plays/<id>.json: [act, scene, speaker, text] per line. */
export interface PlayData {
  id: string;
  title: string;
  genre?: Genre; // comedy if missing
  lines: [number, number, string, string][];
  english?: string[]; // a foreign text's translation, a share for each line ('' for none)
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

/** A scene of a play: which lines it holds and how many letters they add up to. */
export interface Scene {
  act: number;
  scene: number; // 0 is a prologue
  key: string; // "act.scene", e.g. "1.2"
  lines: number[]; // line indices, in order
  letters: number; // letters to type in all its lines
}

export interface Play {
  id: string;
  title: string;
  genre: Genre;
  lines: PlayLine[];
  scenes: Scene[]; // in play order
  acts: number[]; // act numbers, in play order
  /** Line indices by their letters; identical lines share an entry. */
  byLetters: Map<string, number[]>;
  /** Every word in the play, so they can score even if the word list lacks them. */
  words: Set<string>;
  longestLine: number; // in letters
  english: string[]; // a foreign text's translation of each line, shown once it's written ('' for none)
}

/** Splits text into upper-case words; apostrophes are dropped ("o'er" -> OER). Greek loses its accents and breathings (λόγος -> ΛΟΓΟΣ). */
export function textToWords(text: string): string[] {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/['’ʼ]/g, '').split(/[^A-ZΑ-Ω]+/).filter(Boolean);
}

/** The Greek capitals a Greek department's monkeys type: all 24 from the start. */
export const greekLetters = [...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'];

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
  const scenes: Scene[] = [];
  lines.forEach((l, i) => {
    let sc = scenes.find((x) => x.act === l.act && x.scene === l.scene);
    if (!sc) {
      sc = { act: l.act, scene: l.scene, key: `${l.act}.${l.scene}`, lines: [], letters: 0 };
      scenes.push(sc);
    }
    sc.lines.push(i);
    sc.letters += l.letters.length;
  });
  const acts = [...new Set(scenes.map((sc) => sc.act))];
  const english = lines.map((_, i) => data.english?.[i] ?? '');
  return { id: data.id, title: data.title, genre: allGenres.includes(data.genre!) ? data.genre! : 'comedy', lines, scenes, acts, byLetters, words, longestLine, english };
}

/** Where a line sits in the play, e.g. "1.2" for act 1, scene 2 (scene 0 is a prologue), or "Sonnet 18". */
export function lineLocation(line: PlayLine, genre?: Genre): string {
  if (genre === 'sonnet') return `Sonnet ${line.act}`;
  if (genre === 'greek') return `${line.act}.${line.scene}`;
  return line.scene === 0 ? `${line.act} prologue` : `${line.act}.${line.scene}`;
}

/**
 * A scene's name for display, e.g. "Act 1, scene 2" or "Act 2 prologue".
 * The Sonnets are stored one per act, so there it's "Sonnet 18".
 */
export function sceneName(act: number, scene: number, genre?: Genre): string {
  if (genre === 'sonnet') return `Sonnet ${act}`;
  if (genre === 'greek') return `Book ${act}, chapter ${scene}`;
  return scene === 0 ? `Act ${act} prologue` : `Act ${act}, scene ${scene}`;
}
