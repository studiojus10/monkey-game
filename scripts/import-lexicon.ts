// Builds data/lexicon.txt, the parts of speech the Records department's
// grammar check uses, from en-lexicon (MIT License, Copyright (c) 2017 Alex
// Corvi, https://github.com/finnlp/en-lexicon; built on Eric Brill's lexicon).
//
//   npx tsx scripts/import-lexicon.ts <en-lexicon's dist/lexicon.js>
//
// Output: one line per word of data/words.txt that the lexicon knows,
// "WORD TAGS" (its two likeliest), each tag one letter (see src/game/grammar.ts):
// N noun, P plural noun, V verb, Z verb with -s, D past tense, E past
// participle, G -ing form, J adjective, R adverb, T determiner, I preposition,
// C conjunction, M modal. Pronouns and helper verbs are in grammar.ts itself.

import { readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage: tsx scripts/import-lexicon.ts <lexicon.js>');
  process.exit(1);
}

// The file is a CommonJS module: `var lexicon = { "word": "TAG|TAG", ... }`.
const text = readFileSync(source, 'utf8');
const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
const lexicon = Function(`return ${body}`)() as Record<string, string>;

const penn: Record<string, string> = {
  NN: 'N', NNP: 'N', NNS: 'P', NNPS: 'P',
  VB: 'V', VBP: 'V', VBZ: 'Z', VBD: 'D', VBN: 'E', VBG: 'G',
  JJ: 'J', JJR: 'J', JJS: 'J',
  RB: 'R', RBR: 'R', RBS: 'R',
  DT: 'T', PDT: 'T', 'PRP$': 'T', WDT: 'T', CD: 'T',
  IN: 'I', TO: 'I', CC: 'C', MD: 'M',
};

const words = new Set(readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean));
words.add('a').add('i');
const out: string[] = [];
for (const [word, tags] of Object.entries(lexicon)) {
  if (!/^[a-z]+$/.test(word) || !words.has(word)) continue;
  // Tags come most likely first; past the first two they're mostly rare uses, which would let too much through.
  const letters = [...new Set(tags.split('|').map((t) => penn[t]).filter(Boolean))].slice(0, 2).join('');
  if (letters) out.push(`${word.toUpperCase()} ${letters}`);
}
out.sort();
writeFileSync(new URL('../data/lexicon.txt', import.meta.url), out.join('\n') + '\n');
console.log(`${out.length} words`);
