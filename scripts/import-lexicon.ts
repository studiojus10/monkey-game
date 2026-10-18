// Builds data/lexicon.txt, the parts of speech the Records department's
// grammar check uses, from the Moby Part-of-Speech list by Grady Ward
// (public domain, Moby Project; mobypos.txt, as packaged for example in the
// npm package moby-pos). Moby lists mostly base words, so plurals, -s, -ed and
// -ing forms of the dictionary's words are worked out here from their bases,
// and common irregular verbs' past forms are listed here.
//
//   npx tsx scripts/import-lexicon.ts <mobypos.txt>
//
// Output: one line per word of data/words.txt with a part of speech,
// "WORD TAGS", each tag one letter (see src/game/grammar.ts):
// N noun, P plural noun, V verb, Z verb with -s, D past tense, E past
// participle, G -ing form, J adjective, R adverb, T determiner, I preposition,
// C conjunction. Pronouns and helper verbs are in grammar.ts itself.

import { readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage: tsx scripts/import-lexicon.ts <mobypos.txt>');
  process.exit(1);
}

// Moby's codes: N noun, p plural, V, t and i verbs, A adjective, v adverb, C conjunction, P preposition, D and I articles.
const moby: Record<string, string> = { N: 'N', p: 'P', t: 'V', i: 'V', V: 'V', A: 'J', v: 'R', C: 'C', P: 'I', D: 'T', I: 'T' };

// Common irregular verbs, past tense then past participle, which Moby tags only as verbs.
const irregular = `arise arose arisen,awake awoke awoken,bear bore borne,beat beat beaten,become became become,begin began begun,bend bent bent,bet bet bet,bind bound bound,bite bit bitten,bleed bled bled,blow blew blown,break broke broken,breed bred bred,bring brought brought,build built built,burn burnt burnt,burst burst burst,buy bought bought,cast cast cast,catch caught caught,choose chose chosen,cling clung clung,come came come,cost cost cost,creep crept crept,cut cut cut,deal dealt dealt,dig dug dug,draw drew drawn,dream dreamt dreamt,drink drank drunk,drive drove driven,dwell dwelt dwelt,eat ate eaten,fall fell fallen,feed fed fed,feel felt felt,fight fought fought,find found found,flee fled fled,fling flung flung,fly flew flown,forbid forbade forbidden,forget forgot forgotten,forgive forgave forgiven,freeze froze frozen,get got gotten,give gave given,go went gone,grind ground ground,grow grew grown,hang hung hung,hear heard heard,hide hid hidden,hit hit hit,hold held held,hurt hurt hurt,keep kept kept,kneel knelt knelt,know knew known,lay laid laid,lead led led,lean leant leant,leap leapt leapt,learn learnt learnt,leave left left,lend lent lent,let let let,lie lay lain,light lit lit,lose lost lost,make made made,mean meant meant,meet met met,pay paid paid,put put put,quit quit quit,read read read,rend rent rent,ride rode ridden,ring rang rung,rise rose risen,run ran run,say said said,see saw seen,seek sought sought,sell sold sold,send sent sent,set set set,shake shook shaken,shed shed shed,shine shone shone,shoot shot shot,show showed shown,shrink shrank shrunk,shut shut shut,sing sang sung,sink sank sunk,sit sat sat,slay slew slain,sleep slept slept,slide slid slid,sling slung slung,smite smote smitten,speak spoke spoken,speed sped sped,spend spent spent,spin spun spun,spit spat spat,split split split,spread spread spread,spring sprang sprung,stand stood stood,steal stole stolen,stick stuck stuck,sting stung stung,stink stank stunk,stride strode stridden,strike struck struck,string strung strung,strive strove striven,swear swore sworn,sweep swept swept,swell swelled swollen,swim swam swum,swing swung swung,take took taken,teach taught taught,tear tore torn,tell told told,think thought thought,throw threw thrown,thrust thrust thrust,tread trod trodden,wake woke woken,wear wore worn,weave wove woven,weep wept wept,win won won,wind wound wound,wring wrung wrung,write wrote written`
  .split(',').map((v) => v.split(' '));
const extra = new Map<string, Set<string>>();
const add = (word: string, tag: string) => extra.set(word, new Set([...(extra.get(word) ?? []), tag]));
for (const [, past, participle] of irregular) {
  add(past, 'D');
  add(participle, 'E');
}

const base = new Map<string, string>();
for (const line of readFileSync(source, 'utf8').split(/[\r\n]+/)) {
  const [word, codes] = line.split('×');
  if (!word || !codes || !/^[a-z]+$/.test(word)) continue;
  const tags = [...new Set([...codes].flatMap((c) => [...(moby[c] ?? '')]))].join('');
  if (tags) base.set(word, tags);
}

const words = readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
words.push('a', 'i');

/** The bases a word could come from by an ending, e.g. "cries" -> "cry", "stopped" -> "stop", "making" -> "make". */
function basesOf(word: string, ending: string): string[] {
  if (!word.endsWith(ending) || word.length <= ending.length + 1) return [];
  const stem = word.slice(0, -ending.length);
  const out = [stem];
  if (ending === 's' && stem.endsWith('e')) out.push(stem.slice(0, -1)); // boxes -> box
  if ((ending === 's' && stem.endsWith('ie')) || (ending === 'ed' && stem.endsWith('i'))) out.push(stem.slice(0, stem.endsWith('ie') ? -2 : -1) + 'y'); // cries, cried -> cry
  if (ending !== 's') {
    out.push(stem + 'e'); // made from make, making
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1)); // stopped -> stop
  }
  return out;
}

const tagged = (b: string, tag: string) => (base.get(b) ?? '').includes(tag);
const out: string[] = [];
for (const word of words) {
  const tags = new Set([...(base.get(word) ?? ''), ...(extra.get(word) ?? [])]);
  for (const b of basesOf(word, 's')) {
    if (tagged(b, 'N')) tags.add('P');
    if (tagged(b, 'V')) tags.add('Z');
  }
  for (const b of [...basesOf(word, 'ed'), ...basesOf(word, 'd')]) {
    if (tagged(b, 'V')) {
      tags.add('D');
      tags.add('E');
    }
  }
  for (const b of basesOf(word, 'ing')) if (tagged(b, 'V')) tags.add('G');
  if (tags.size > 0) out.push(`${word.toUpperCase()} ${[...tags].join('')}`);
}
out.sort();
writeFileSync(new URL('../data/lexicon.txt', import.meta.url), out.join('\n') + '\n');
console.log(`${out.length} words`);
