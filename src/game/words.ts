import { letterValues } from './config';

/** Points for a word: (sum of letter values) x length. */
export function wordPoints(word: string): number {
  let sum = 0;
  for (const ch of word) sum += letterValues[ch] ?? 0;
  return sum * word.length;
}

interface Node {
  word: boolean;
  next: Map<string, Node>;
}

/** The words spellable with a set of letters, stored as a prefix tree. */
export class Dictionary {
  private root: Node = { word: false, next: new Map() };

  constructor(words: Iterable<string>, letters: Iterable<string>) {
    const owned = new Set(letters);
    for (const raw of words) {
      const w = raw.toUpperCase();
      if (!w || ![...w].every((ch) => owned.has(ch))) continue;
      let node = this.root;
      for (const ch of w) {
        let child = node.next.get(ch);
        if (!child) node.next.set(ch, (child = { word: false, next: new Map() }));
        node = child;
      }
      node.word = true;
    }
  }

  private find(s: string): Node | undefined {
    let node: Node | undefined = this.root;
    for (const ch of s) {
      node = node.next.get(ch);
      if (!node) return undefined;
    }
    return node;
  }

  /** True if some word starts with (or is) `s`. */
  isPrefix(s: string): boolean {
    return this.find(s) !== undefined;
  }

  isWord(s: string): boolean {
    return this.find(s)?.word ?? false;
  }

  /** True if some word is longer than `s` and starts with it. */
  canGrow(s: string): boolean {
    return (this.find(s)?.next.size ?? 0) > 0;
  }

  /** The longest word that `s` starts with, or '' if none. */
  longestWordAtStart(s: string): string {
    let node: Node | undefined = this.root;
    let best = 0;
    for (let i = 0; i < s.length && node; i++) {
      node = node.next.get(s[i]);
      if (node?.word) best = i + 1;
    }
    return s.slice(0, best);
  }
}

/** What reading a letter produced: a scored word or a letter that starts no word. */
export type ReadEvent = { kind: 'word'; text: string } | { kind: 'skip'; text: string };

/**
 * Reads one typed letter. `pending` holds letters that might still become a
 * word; returns the new pending letters and pushes any results onto `out`.
 * A word scores as soon as it can't grow into a longer one; leftover letters
 * are read again so nothing that could start a word is lost.
 */
export function readLetter(dict: Dictionary, pending: string, letter: string, out: ReadEvent[]): string {
  const buf = pending + letter;
  if (dict.isPrefix(buf)) {
    if (dict.isWord(buf) && !dict.canGrow(buf)) {
      out.push({ kind: 'word', text: buf });
      return '';
    }
    return buf;
  }
  if (!pending) {
    out.push({ kind: 'skip', text: letter });
    return '';
  }
  const word = dict.longestWordAtStart(pending);
  if (word) out.push({ kind: 'word', text: word });
  else out.push({ kind: 'skip', text: pending[0] });
  let next = '';
  for (const ch of buf.slice(word.length || 1)) next = readLetter(dict, next, ch, out);
  return next;
}
