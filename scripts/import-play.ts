// Converts a play page from the MIT Shakespeare (public-domain Moby text,
// https://github.com/TheMITTech/shakespeare) into data/plays/<id>.json.
//
//   npx tsx scripts/import-play.ts <full.html> <id> "<Title>"
//
// Output: { id, title, lines: [act, scene, speaker, text][] }

import { readFileSync, writeFileSync } from 'node:fs';

const [file, id, title] = process.argv.slice(2);
if (!file || !id || !title) {
  console.error('usage: tsx scripts/import-play.ts <full.html> <id> "<Title>"');
  process.exit(1);
}

const html = readFileSync(file, 'utf8');
const lines: [number, number, string, string][] = [];
let speaker = '';
const tag = /<A NAME=speech\d+><b>([^<]*)<\/b><\/a>|<A NAME=(\d+)\.(\d+)\.\d+>([\s\S]*?)<\/A>/gi;
for (const m of html.matchAll(tag)) {
  if (m[1] !== undefined) {
    speaker = m[1].trim();
  } else {
    const text = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]/.test(text)) lines.push([Number(m[2]), Number(m[3]), speaker, text]);
  }
}

writeFileSync(`data/plays/${id}.json`, JSON.stringify({ id, title, lines }) + '\n');
console.log(`${title}: ${lines.length} lines`);
