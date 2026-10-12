// Converts the MIT Shakespeare's Sonnets (public-domain Moby text,
// https://github.com/TheMITTech/shakespeare, Poetry/sonnet.<roman>.html)
// into data/plays/sonnets.json, stored like a play: each sonnet is "act" N,
// scene 1, so the script browser and shop treat a sonnet as one section.
//
//   npx tsx scripts/import-sonnets.ts <folder with sonnets.html and sonnet.*.html>
//
// Output: { id: 'sonnets', title: 'The Sonnets', genre: 'sonnet', lines: [n, 1, '', text][] }

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: tsx scripts/import-sonnets.ts <folder>');
  process.exit(1);
}

const index = readFileSync(join(dir, 'sonnets.html'), 'utf8');
const files = [...index.matchAll(/HREF="(sonnet\.[IVXLC]+\.html)"/gi)].map((m) => m[1]);
const lines: [number, number, string, string][] = [];
files.forEach((file, i) => {
  const html = readFileSync(join(dir, file), 'utf8');
  const body = /<BLOCKQUOTE>([\s\S]*?)<\/BLOCKQUOTE>/i.exec(html)?.[1] ?? '';
  for (const raw of body.split(/<BR>/i)) {
    const text = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(text)) continue;
    // The source wraps a long line once (sonnet 28); a short line starting in lower case continues the last one.
    const last = lines[lines.length - 1];
    if (/^[a-z]/.test(text) && text.split(' ').length <= 3 && last?.[0] === i + 1) last[3] += ' ' + text;
    else lines.push([i + 1, 1, '', text]);
  }
});

writeFileSync('data/plays/sonnets.json', JSON.stringify({ id: 'sonnets', title: 'The Sonnets', genre: 'sonnet', lines }) + '\n');
console.log(`The Sonnets: ${files.length} sonnets, ${lines.length} lines`);
