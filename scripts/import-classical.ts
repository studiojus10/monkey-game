// Builds the Greek and Latin texts in data/plays/, stored like plays with genre 'greek' or 'latin':
// "act" is the book, "scene" the chapter, and each line a piece of Greek cut at
// its punctuation, at most maxWords words (Justin, 2026-10-17: lines in texts
// that aren't plays). `english` holds each line's share of the translation
// (a unit's English split across its lines by their Greek letters), or ''.
//
//   npx tsx scripts/import-classical.ts metaphysics
//     Aristotle, Metaphysics I.4 985b4-22 (the scroll), from scripts/greek/metaphysics.json
//   npx tsx scripts/import-classical.ts generatione <tlg0086.tlg013.1st1K-grc2.xml> [english.txt]
//     Aristotle, De generatione et corruptione, Prantl's 1881 Teubner text from the
//     First1KGreek project (https://github.com/OpenGreekAndLatin/First1KGreek, CC BY-SA 4.0).
//     The English, if given: H. H. Joachim's 1922 translation (public domain) as the MIT Internet
//     Classics Archive's text file, with "BOOK I" before each book and "Part N" before each chapter.
//   npx tsx scripts/import-classical.ts natura <phi0474.phi050.perseus-lat2.xml> [yonge.txt]
//     Cicero, De natura deorum, Plasberg's 1917 Teubner text from Perseus
//     (https://github.com/PerseusDL/canonical-latinLit, CC BY-SA 4.0), books as acts and sections as
//     scenes. The English, if given: C. D. Yonge's 1878 translation (public domain), Project Gutenberg
//     ebook #14988. Yonge's chapters each span a few of the Latin's sections; lineUp finds which.

import { readFileSync, writeFileSync } from 'node:fs';

const maxWords = 12;
type Unit = { book: number; chapter: number; greek: string; english: string }; // greek: the original, Greek or Latin

/** Greek text cut into lines: at punctuation, then long pieces into even parts of at most maxWords words. */
function cut(greek: string, latin = false): string[] {
  const pieces: string[][] = [[]];
  // In a Greek text Latin letters and digits are the editor's (page numbers, stray notes), not Aristotle's; in a Latin one, digits and Greek.
  for (const w of greek.split(/\s+/).filter((x) => x && !(latin ? /[0-9\p{Script=Greek}]/u : /[A-Za-z0-9]/).test(x))) {
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

function write(id: string, title: string, units: Unit[], genre = 'greek'): void {
  const lines: [number, number, string, string][] = [];
  const english: string[] = [];
  for (const u of units) {
    const cutLines = cut(u.greek, genre === 'latin');
    share(cutLines, u.english).forEach((e) => english.push(e));
    for (const l of cutLines) lines.push([u.book, u.chapter, '', l]);
  }
  writeFileSync(`data/plays/${id}.json`, JSON.stringify({ id, title, genre, lines, english }) + '\n');
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
} else if (which === 'natura' && source) {
  const xml = readFileSync(source, 'utf8');
  const books = xml.split(/<div[^>]*subtype="book"[^>]*>/).slice(1);
  const english = englishFile ? yongeChapters(readFileSync(englishFile, 'latin1')) : []; // Gutenberg's -8 file is ISO-8859-1
  const units: Unit[] = [];
  books.forEach((b, bi) => {
    const parts = b.split(/<div[^>]*subtype="section"[^>]*n="(\w+)"[^>]*>/);
    const sections = Array.from({ length: (parts.length - 1) / 2 }, (_, k) => ({ n: Number(parts[1 + 2 * k]), c: parts[2 + 2 * k] })).map(({ n, c }) => ({
      n,
      latin: c
        .replace(/<(note|del|foreign|bibl|head)[\s\S]*?<\/\1>/g, '') // notes, the editor's deletions, Cicero's Greek
        .replace(/<[^>]+>/g, ' ')
        .replace(/[†*<>[\]]/g, '')
        .replace(/\s*—\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim(),
    }));
    const chapters = english[bi] ?? [];
    const groups = chapters.length > 0 ? lineUp(sections.map((x) => x.latin), chapters) : [];
    const shares = sections.map(() => '');
    groups.forEach(([from, to], c) => share(sections.slice(from, to).map((x) => x.latin), chapters[c]).forEach((e, k) => (shares[from + k] = e)));
    sections.forEach((x, k) => units.push({ book: bi + 1, chapter: x.n, greek: x.latin, english: shares[k] }));
  });
  write('natura', 'Cicero, De natura deorum', units, 'latin');
} else {
  console.error('usage: tsx scripts/import-classical.ts metaphysics | generatione <grc2.xml> [english.txt] | natura <lat2.xml> [yonge.txt]');
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

/** Yonge's De natura deorum: each book's chapters (I., II., ...), without footnote marks or italics. */
function yongeChapters(text: string): string[][] {
  text = text.replace(/\r/g, '');
  const start = text.indexOf('THE NATURE OF THE GODS.\n');
  const end = text.indexOf('ON THE COMMONWEALTH.', start);
  const books: string[][] = [];
  for (const line of text.slice(start, end).split(/\r?\n/)) {
    const l = line.trim();
    if (/^BOOK [IVX]+\.$/.test(l)) books.push([]);
    else if (books.length === 0 || !l || /^\*/.test(l)) continue;
    else {
      const chapter = /^([IVXL]+)\. (.*)$/.exec(l);
      const chapters = books[books.length - 1];
      if (chapter) chapters.push(chapter[2]);
      else if (chapters.length > 0) chapters[chapters.length - 1] += ' ' + l;
    }
  }
  // In ASCII, as the game prints: Æneas as Aeneas, Thalês as Thales.
  const ascii = (t: string) => t.replace(/Æ/g, 'Ae').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{M}/gu, '');
  return books.map((b) => b.map((c) => ascii(c).replace(/\[\d+\]/g, '').replace(/_/g, '').replace(/\s+/g, ' ').trim()));
}

/**
 * Which sections each chapter spans, as [from, to) per chapter, in order:
 * the split where each chapter's English is closest to the same multiple of
 * its sections' Latin in length, and shares the most names with it.
 */
function lineUp(sections: string[], chapters: string[]): [number, number][] {
  const S = sections.length;
  const C = chapters.length;
  const lat = sections.map((x) => x.length);
  const ratio = chapters.reduce((n, c) => n + c.length, 0) / lat.reduce((a, b) => a + b, 0);
  const names = (t: string) => new Set((t.match(/\b[A-Z][a-z]{3,}/g) ?? []).map((w) => w.slice(0, 5).toLowerCase()));
  const secNames = sections.map(names);
  const chapNames = chapters.map(names);
  const cost = (c: number, from: number, to: number) => {
    let len = 0;
    const seen = new Set<string>();
    for (let k = from; k < to; k++) {
      len += lat[k];
      secNames[k].forEach((n) => seen.add(n));
    }
    let shared = 0;
    chapNames[c].forEach((n) => seen.has(n) && shared++);
    return Math.log(chapters[c].length / (len * ratio)) ** 2 - 0.3 * shared;
  };
  // best[c][s]: the cheapest split of the first c chapters over the first s sections.
  const best = Array.from({ length: C + 1 }, () => new Array<number>(S + 1).fill(Infinity));
  const from = Array.from({ length: C + 1 }, () => new Array<number>(S + 1).fill(0));
  best[0][0] = 0;
  for (let c = 1; c <= C; c++)
    for (let s = c; s <= S - (C - c); s++)
      for (let f = Math.max(c - 1, s - 12); f < s; f++) {
        const v = best[c - 1][f] + cost(c - 1, f, s);
        if (v < best[c][s]) [best[c][s], from[c][s]] = [v, f];
      }
  const out: [number, number][] = [];
  for (let c = C, s = S; c > 0; s = from[c][s], c--) out.unshift([from[c][s], s]);
  return out;
}
