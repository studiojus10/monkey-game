// Builds the Greek texts in data/plays/, stored like plays with genre 'greek':
// "act" is the book, "scene" the chapter, and each line a piece of Greek cut at
// its punctuation, at most maxWords words (Justin, 2026-10-17: lines in texts
// that aren't plays). `english` holds each line's share of the translation
// (a unit's English split across its lines by their Greek letters), or ''.
//
//   npx tsx scripts/import-greek.ts metaphysics
//     Aristotle, Metaphysics I.4 985b4-22 (the scroll), from scripts/greek/metaphysics.json
//   npx tsx scripts/import-greek.ts generatione <tlg0086.tlg013.1st1K-grc2.xml> [english.txt]
//     Aristotle, De generatione et corruptione, Prantl's 1881 Teubner text from the
//     First1KGreek project (https://github.com/OpenGreekAndLatin/First1KGreek, CC BY-SA 4.0).
//     The English, if given: H. H. Joachim's 1922 translation (public domain) as the MIT Internet
//     Classics Archive's text file, with "BOOK I" before each book and "Part N" before each chapter.

import { readFileSync, writeFileSync } from 'node:fs';

const maxWords = 12;
type Unit = { book: number; chapter: number; greek: string; english: string };

/** Greek text cut into lines: at punctuation, then long pieces into even parts of at most maxWords words. */
function cut(greek: string): string[] {
  const pieces: string[][] = [[]];
  // Latin letters and digits are the editor's (page numbers, stray notes), not Aristotle's.
  for (const w of greek.split(/\s+/).filter((x) => x && !/[A-Za-z0-9]/.test(x))) {
    pieces[pieces.length - 1].push(w);
    if (/[,.;·:]$/.test(w)) pieces.push([]);
  }
  const lines: string[][] = [];
  for (const p of pieces.filter((x) => x.length > 0)) {
    const last = lines[lines.length - 1];
    // A lone word joins the line before it when there's room.
    if (p.length === 1 && last && last.length < maxWords) {
      last.push(...p);
      continue;
    }
    const parts = Math.ceil(p.length / maxWords);
    const size = Math.ceil(p.length / parts);
    for (let i = 0; i < p.length; i += size) lines.push(p.slice(i, i + size));
  }
  return lines.map((l) => l.join(' ')).filter((l) => /\p{L}/u.test(l));
}

/** English split across lines by each line's share of the Greek letters, at word boundaries. */
function share(lines: string[], english: string): string[] {
  const words = english.split(/\s+/).filter(Boolean);
  if (words.length === 0) return lines.map(() => '');
  const letters = lines.map((l) => (l.match(/\p{L}/gu) ?? []).length);
  const total = letters.reduce((a, b) => a + b, 0);
  let done = 0;
  let taken = 0;
  return lines.map((_, i) => {
    done += letters[i];
    const upTo = i === lines.length - 1 ? words.length : Math.round((done / total) * words.length);
    const part = words.slice(taken, Math.max(taken, upTo)).join(' ');
    taken = Math.max(taken, upTo);
    return part;
  });
}

function write(id: string, title: string, units: Unit[]): void {
  const lines: [number, number, string, string][] = [];
  const english: string[] = [];
  for (const u of units) {
    const cutLines = cut(u.greek);
    share(cutLines, u.english).forEach((e) => english.push(e));
    for (const l of cutLines) lines.push([u.book, u.chapter, '', l]);
  }
  writeFileSync(`data/plays/${id}.json`, JSON.stringify({ id, title, genre: 'greek', lines, english }) + '\n');
  const words = lines.reduce((n, l) => n + l[3].split(' ').length, 0);
  console.log(`${title}: ${lines.length} lines, ${words} words, ${english.filter(Boolean).length} with English`);
}

const [which, source, englishFile] = process.argv.slice(2);
if (which === 'metaphysics') {
  const { sentences } = JSON.parse(readFileSync('scripts/greek/metaphysics.json', 'utf8')) as { sentences: { greek: string; english: string }[] };
  write('metaphysics-1-4', 'Aristotle, Metaphysics I.4', sentences.map((s) => ({ book: 1, chapter: 4, ...s })));
} else if (which === 'generatione' && source) {
  const xml = readFileSync(source, 'utf8');
  const books = xml.split(/<div[^>]*subtype="book"[^>]*>/).slice(1);
  const english = englishChapters(englishFile ? readFileSync(englishFile, 'utf8') : '');
  const units: Unit[] = [];
  books.forEach((b, bi) => {
    b.split(/<div[^>]*subtype="chapter"[^>]*>/).slice(1).forEach((c, ci) => {
      const greek = c
        .replace(/<note[\s\S]*?<\/note>/g, '')
        .replace(/<head[\s\S]*?<\/head>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      units.push({ book: bi + 1, chapter: ci + 1, greek, english: english.get(`${bi + 1}.${ci + 1}`) ?? '' });
    });
    // This edition runs Book I's last two chapters together: any English chapters past the Greek's last join it.
    const last = units[units.length - 1];
    for (let k = last.chapter + 1; english.has(`${bi + 1}.${k}`); k++) last.english += ' ' + english.get(`${bi + 1}.${k}`);
  });
  write('generatione', 'Aristotle, De generatione et corruptione', units);
} else {
  console.error('usage: tsx scripts/import-greek.ts metaphysics | generatione <grc2.xml> [english.txt]');
  process.exit(1);
}

/** The English by "book.chapter", from "Book N" and "Part N" headings. */
function englishChapters(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let book = 0;
  let key = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === 'THE END') break;
    const b = /^Book\s+(\w+)\b/i.exec(line);
    const p = /^Part\s+(\d+)\b/i.exec(line);
    if (b) book = /^(I|1)$/i.test(b[1]) ? 1 : /^(II|2)$/i.test(b[1]) ? 2 : book + 1;
    else if (p && book > 0) key = `${book}.${p[1]}`;
    else if (key && line && !/^-+$/.test(line)) out.set(key, `${out.get(key) ?? ''} ${line}`.trim());
  }
  return out;
}
