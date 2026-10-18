/**
 * A rough grammar check for the Records department (Justin, 2026-10-18): it
 * tags each word with its likely parts of speech (data/lexicon.txt, from
 * en-lexicon; see scripts/import-lexicon.ts) and walks the tags through a
 * small set of English sentence patterns:
 *
 *   subject (determiner, adjectives, a noun, a prepositional phrase; or a pronoun)
 *   verb agreeing with it (or a modal, "do", "have" or "be" helping one)
 *   then maybe an object, a complement, prepositional phrases and an adverb,
 *   and "and"/"but"/"or" with another whole sentence.
 *
 * It judges form, not sense: "the green ideas sleep" passes. It misses plenty
 * and lets some odd ones through, which is fine for a fun record of the
 * monkeys' writing. Words are upper case, as the game types them.
 */

/** One-letter tags: see scripts/import-lexicon.ts. */
const lexicon = new Map<string, string>();

/** Loads the lexicon: lines of "WORD TAGS". */
export function setLexicon(lines: readonly string[]): void {
  lexicon.clear();
  for (const line of lines) {
    const [word, tags] = line.split(' ');
    if (word && tags) lexicon.set(word, tags);
  }
}

/** Whether a lexicon is loaded (without one, nothing passes). */
export function hasLexicon(): boolean {
  return lexicon.size > 0;
}

// Small word classes, given here rather than taken from the lexicon, whose tags for them are noisy.
// Number: s = he, she, it or one thing; p = they, we, you or several; 1 = I.
const closed: Record<string, string[]> = {
  determiner: 'THE A AN THIS THAT THESE THOSE MY YOUR HIS HER ITS OUR THEIR THY EVERY EACH SOME ANY NO ALL BOTH MANY FEW SEVERAL MUCH MORE MOST SUCH ANOTHER EITHER NEITHER ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN'.split(' '),
  preposition: 'IN ON AT BY FOR WITH FROM TO OF INTO ONTO UPON OVER UNDER ABOUT AFTER BEFORE THROUGH WITHOUT WITHIN BETWEEN AMONG AGAINST NEAR BEHIND BEYOND ACROSS ALONG AROUND TOWARD TOWARDS SINCE UNTIL LIKE BENEATH ABOVE BELOW'.split(' '),
  conjunction: 'AND OR BUT YET SO'.split(' '),
  modal: 'CAN COULD WILL WOULD SHALL SHOULD MAY MIGHT MUST'.split(' '),
  object: 'ME YOU HIM HER IT US THEM THEE'.split(' '),
};
const subjects: Record<string, string> = { I: '1', YOU: 'p', WE: 'p', THEY: 'p', HE: 's', SHE: 's', IT: 's' };
// Helping verbs, each with the subjects it agrees with ('' for any).
const be: Record<string, string> = { AM: '1', IS: 's', ARE: 'p', WAS: 's1', WERE: 'p' };
const have: Record<string, string> = { HAS: 's', HAVE: 'p1', HAD: '' };
const doo: Record<string, string> = { DOES: 's', DO: 'p1', DID: '' };
const special = new Set([...Object.values(closed).flat(), ...Object.keys(subjects), ...Object.keys(be), ...Object.keys(have), ...Object.keys(doo), 'BE', 'BEEN', 'NOT']);

/** What a word can be, as tokens the patterns below read: lexicon tags plus the small classes. */
function tokens(word: string): string[] {
  const out: string[] = [];
  if (closed.determiner.includes(word)) out.push('T');
  if (closed.preposition.includes(word)) out.push('I');
  if (closed.conjunction.includes(word)) out.push('C');
  if (closed.modal.includes(word)) out.push('M');
  if (closed.object.includes(word)) out.push('O');
  if (subjects[word]) out.push(`S${subjects[word]}`);
  if (be[word] !== undefined) out.push(`B${be[word]}`);
  if (have[word] !== undefined) out.push(`H${have[word]}`);
  if (doo[word] !== undefined) out.push(`X${doo[word]}`);
  if (word === 'BE') out.push('b');
  if (word === 'BEEN') out.push('e');
  if (word === 'NOT') out.push('!');
  if (word === 'TO') out.push('2');
  if (!special.has(word)) out.push(...(lexicon.get(word) ?? ''));
  return out;
}

/** Whether a helper's agreement letters ('' for any) fit a subject's number. */
const agrees = (letters: string, x: string) => letters === '' || letters.includes(x);

/**
 * The next states from `state` on token `t`. States are names; those after a
 * subject carry its number as their last letter (s, p or 1).
 */
function step(state: string, t: string): string[] {
  const x = state.slice(-1);
  const noun = t === 'N' || t === 'P';
  const nounState = (prefix: string) => (t === 'N' ? [`${prefix}s`] : t === 'P' ? [`${prefix}p`] : []);
  // A subject's verb: agreeing with it, or helped.
  const verb = (): string[] => {
    if (t === 'Z' && x === 's') return ['VP'];
    if (t === 'V' && (x === 'p' || x === '1')) return ['VP'];
    if (t === 'D') return ['VP'];
    if (t === 'M') return ['MOD'];
    if (t[0] === 'B' && agrees(t.slice(1), x)) return ['COP'];
    if (t[0] === 'H' && agrees(t.slice(1), x)) return ['HAV'];
    if (t[0] === 'X' && agrees(t.slice(1), x)) return ['DO', 'VP'];
    if (t === 'R') return [state];
    return [];
  };
  // What may follow a verb: an object, a phrase, an adverb, another sentence.
  const after = (): string[] => {
    if (t === 'T') return ['OD'];
    if (t === 'J') return ['OA'];
    if (noun || t === 'O') return ['OBJ'];
    if (t === 'I') return ['PP'];
    if (t === '2') return ['PP', 'INF'];
    if (t === 'R') return ['END'];
    if (t === 'C') return ['START'];
    return [];
  };
  switch (state) {
    case 'START':
      if (t === 'T') return ['SD'];
      if (t === 'J') return ['SA'];
      if (t[0] === 'S') return [`SUB${t.slice(1)}`];
      return nounState('SN');
    case 'SD':
    case 'SA':
      return t === 'J' ? ['SA'] : nounState('SN');
    case 'MOD':
      return t === 'V' ? ['VP'] : t === 'b' ? ['COP'] : t === 'Hp1' ? ['HAV'] : t === '!' || t === 'R' ? ['MOD'] : [];
    case 'DO':
      return t === 'V' ? ['VP'] : t === '!' ? ['DO'] : [];
    case 'HAV':
      return t === 'E' ? ['VP'] : t === 'e' ? ['COP'] : t === '!' ? ['HAV'] : after();
    case 'COP':
      if (t === 'J') return ['COMP'];
      if (t === 'G' || t === 'E') return ['VP'];
      if (t === '!' || t === 'R') return ['COP'];
      if (t === 'C') return [];
      return after();
    case 'INF':
      return t === 'V' ? ['VP'] : t === 'b' ? ['COP'] : [];
    case 'VP':
    case 'END':
    case 'COMP':
      return after().filter((s) => state === 'VP' || s === 'PP' || s === 'START' || (state === 'COMP' && s === 'END'));
    case 'OD':
    case 'OA':
      return t === 'J' ? ['OA'] : noun ? ['OBJ'] : [];
    case 'OBJ':
    case 'PPO':
      return t === 'I' || t === '2' ? ['PP'] : t === 'R' ? ['END'] : t === 'C' ? ['START'] : [];
    case 'PP':
      return t === 'T' ? ['PD'] : t === 'J' ? ['PA'] : noun || t === 'O' ? ['PPO'] : [];
    case 'PD':
    case 'PA':
      return t === 'J' ? ['PA'] : noun ? ['PPO'] : [];
  }
  // Subjects: SUBx after a pronoun, SNx after a noun (a phrase may follow), SPx in a phrase after it. One noun at a time: noun after noun lets too much through.
  if (state.startsWith('SUB')) return verb();
  if (state.startsWith('SN')) {
    if (t === 'I' || t === '2') return [`SP${x}`];
    return verb();
  }
  if (state.startsWith('SPD') || state.startsWith('SPA')) return t === 'J' ? [`SPA${x}`] : noun ? [`SN${x}`] : [];
  if (state.startsWith('SP')) return t === 'T' ? [`SPD${x}`] : t === 'J' ? [`SPA${x}`] : noun || t === 'O' ? [`SN${x}`] : [];
  return [];
}

const accepting = new Set(['VP', 'END', 'COMP', 'OBJ', 'PPO', 'HAV']);

/** Fewest words a sentence needs to count. */
export const minSentenceWords = 3;

/** Whether words (upper case) make a grammatical sentence, as far as these patterns go. */
export function isGrammatical(words: readonly string[]): boolean {
  if (words.length < minSentenceWords || !hasLexicon()) return false;
  let states = new Set(['START']);
  for (const w of words) {
    const next = new Set<string>();
    for (const s of states) for (const t of tokens(w)) for (const n of step(s, t)) next.add(n);
    if (next.size === 0) return false;
    states = next;
  }
  return [...states].some((s) => accepting.has(s));
}

/**
 * The grammatical sentences in a chain of words: the longest run starting at
 * each place, taken left to right without overlapping. At most `maxWords` long.
 */
export function sentencesIn(words: readonly string[], maxWords = 20): string[][] {
  const found: string[][] = [];
  let i = 0;
  while (i <= words.length - minSentenceWords) {
    let best = 0;
    for (let n = Math.min(maxWords, words.length - i); n >= minSentenceWords; n--) {
      if (isGrammatical(words.slice(i, i + n))) {
        best = n;
        break;
      }
    }
    if (best > 0) {
      found.push(words.slice(i, i + best));
      i += best;
    } else i++;
  }
  return found;
}
