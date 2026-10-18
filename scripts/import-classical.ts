// Builds the Greek and Latin texts in data/plays/, stored like plays with genre 'greek' or 'latin':
// "act" is the book, "scene" the chapter, and each line a piece of Greek cut at
// its punctuation, at most maxWords words (Justin, 2026-10-17: lines in texts
// that aren't plays). `english` holds each line's share of the translation
// (a unit's English split across its lines by their Greek letters), or ''.
//
//   npx tsx scripts/import-classical.ts metaphysics
//     Aristotle, Metaphysics I.4 985b4-22 (the scroll), from scripts/greek/metaphysics.json
//   npx tsx scripts/import-classical.ts generatione <bekker.wiki> <joachim.txt>
//     Aristotle, De generatione et corruptione, Bekker's Greek (Aristotelis Opera, Berlin, 1831;
//     public domain) as Greek Wikisource's wikitext: the pages "Περί Γενέσεως και Φθοράς/1" and
//     ".../2" (?action=raw), joined with a line "=== BOOK ===" between them. The English: H. H.
//     Joachim's 1922 translation (public domain) as the MIT Internet Classics Archive's text file,
//     with "BOOK I" before each book and "Part N" before each chapter.
//   npx tsx scripts/import-classical.ts natura <schoemann_djvu.txt> <yonge.txt> <klotz_djvu.txt>...
//     Cicero, De natura deorum, Schömann's Latin (ed. Stickney, Boston: Ginn, 1881; public domain)
//     as the Internet Archive's OCR text of its scan (denaturadeorumli00ciceuoft_djvu.txt), books
//     as acts and sections as scenes. Section starts come from Klotz's Teubner text, OCR text of
//     two public-domain scans (denaturadeorumd00cicegoog, defato00cicegoog). The English: C. D.
//     Yonge's 1878 translation (public domain), Project Gutenberg ebook #14988. Yonge's chapters
//     each span a few of the Latin's sections; lineUp finds which.
//
// Every source is public domain (Justin, 2026-10-18).

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

const [which, source, englishFile, ...klotz] = process.argv.slice(2);
if (which === 'metaphysics') {
  const { sentences } = JSON.parse(readFileSync('scripts/greek/metaphysics.json', 'utf8')) as { sentences: { greek: string; english: string }[] };
  write('metaphysics-1-4', 'Aristotle, Metaphysics I.4', sentences.map((s) => ({ book: 1, chapter: 4, ...s })));
} else if (which === 'generatione' && source && englishFile) {
  // source: the two books' pages as wikitext, Book 1 then Book 2, joined with a line "=== BOOK ===" (see the header).
  const english = englishChapters(readFileSync(englishFile, 'utf8'));
  const units: Unit[] = [];
  readFileSync(source, 'utf8').split(/^=== BOOK ===$/m).forEach((b, bi) => {
    b.split(/^== Κεφάλαιο \d+ ==$/m).slice(1).forEach((c, ci) => {
      const greek = c
        .replace(/\{\{[\s\S]*?\}\}/g, ' ') // page marks ({{χ|314a}}) and any other template
        .replace(/\[\[[^\]]*\]\]/g, ' ') // links to other pages
        .replace(/[[\]<>"]/g, '') // brackets around words doubted or added: keep the words; and quotation marks
        .replace(/\s+/g, ' ')
        .trim();
      units.push({ book: bi + 1, chapter: ci + 1, greek, english: english.get(`${bi + 1}.${ci + 1}`) ?? '' });
    });
  });
  write('generatione', 'Aristotle, De generatione et corruptione', units);
} else if (which === 'natura' && source && englishFile) {
  const books = schoemannSections(readFileSync(source, 'utf8'), klotz.map((f) => readFileSync(f, 'utf8')));
  const english = yongeChapters(readFileSync(englishFile, 'latin1')); // Gutenberg's -8 file is ISO-8859-1
  const units: Unit[] = [];
  books.forEach((sections, bi) => {
    const chapters = english[bi] ?? [];
    const groups = lineUp(sections.map((x) => x.latin), chapters);
    const shares = sections.map(() => '');
    groups.forEach(([from, to], c) => share(sections.slice(from, to).map((x) => x.latin), chapters[c]).forEach((e, k) => (shares[from + k] = e)));
    sections.forEach((x, k) => units.push({ book: bi + 1, chapter: x.n, greek: x.latin, english: shares[k] }));
  });
  write('natura', 'Cicero, De natura deorum', units, 'latin');
} else {
  console.error('usage: tsx scripts/import-classical.ts metaphysics | generatione <bekker.wiki> <joachim.txt> | natura <schoemann_djvu.txt> <yonge.txt>');
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

/**
 * Schömann's De natura deorum (Boston: Ginn, 1881), as the Internet Archive's
 * OCR text of its scan: each book's Latin, between his English introductions,
 * cut into its sections. The scan's margins lose most section numbers, so the
 * sections are found from Klotz's Teubner text (OCR of two scans), which
 * prints each number in the text ("2. Velut in hac"): each section starts
 * where Schömann's text best matches the first words of Klotz's. A section
 * neither shows stays part of the one before it.
 */
function schoemannSections(text: string, klotz: string[]): { n: number; latin: string }[][] {
  const lines = text.replace(/\r/g, '').split('\n');
  // Each book opens on a drop capital the OCR loses (UM for Cum, UAE for Quae) and ends where its last section does.
  const books: [RegExp, string, RegExp][] = [
    [/^UM multae res in philosophia/, 'Cum', /^caritas\.\s*$/],
    [/^UAE cum Cotta dixisset/, 'Quae', /sive simulate\.\s*$/],
    [/^UAE cum Balbus dixisset/, 'Quae', /pensior\.\s*$/],
  ];
  const klotzBooks = klotz.map(klotzSections);
  const out: { n: number; latin: string }[][] = [];
  let from = 0;
  for (const [startAt, dropCap, endAt] of books) {
    const bi = out.length;
    const start = lines.findIndex((l, i) => i >= from && startAt.test(l));
    const end = lines.findIndex((l, i) => i > start && endAt.test(l));
    if (start < 0 || end < 0) throw new Error(`can't find book ${bi + 1}`);
    from = end + 1;
    const words: string[] = [];
    let carry = ''; // the first half of a word broken over two lines
    lines.slice(start, end + 1).forEach((raw, i) => {
      let w = (i === 0 ? raw.replace(/^\w+/, dropCap) : raw).replace(/[|«»"“”‘’*^/\\_<>]/g, ' ').trim().split(/\s+/).filter(Boolean);
      // Page headers ("LIB. I. CAP. I, II. §§ 1-5. 33", "34 DE NATURA DEORUM.") and the scan's noise: no Latin words to speak of.
      if (/\$\$|\bLIB\b|NATURA DEORUM/.test(raw) || w.filter((x) => /^[a-z]{2,}[.,;:?!]*$/i.test(x)).length < Math.max(1, w.length / 2)) return;
      // The margins: line numbers (5, 10, ... read as s, το, zo, 3o) and section or chapter numbers, at either end.
      const margin = /^(\d+|[sxz]{1,2}|[sτzxri][οo\d]|τς|\d[»o]|IO|[xz][sez]|ez|uu|[:.,]+|\p{Script=Greek}{1,3})[.,»]?$/u;
      for (let k = 0; k < 2; k++) {
        if (w.length > 1 && margin.test(w[0])) w = w.slice(1);
        if (w.length > 1 && margin.test(w[w.length - 1])) w.pop();
      }
      w = w
        .map((x) => x.replace(/['\[\]]/g, '')) // quotation marks; the editor's brackets, keeping the words
        .filter((x) => x && !/^[\d—–-]+$/.test(x) && !/^[.,;:]$/.test(x) && !/^(s{1,2}|uu|zz|ez|[xz][sez]|IO|τς)[.,]?$/.test(x)) // stray margin numbers.map((x) => (/\p{L}/u.test(x) ? x.replace(/\d+/g, '') : x));
      if (carry && w.length > 0) w[0] = carry + w[0];
      carry = '';
      if (w.length > 0 && /\p{L}-+$/u.test(w[w.length - 1])) carry = w.pop()!.replace(/-+$/, '');
      // Latin words the OCR read as Greek letters that look like them; Cicero's own Greek stays Greek.
      w = w.map((x) => ({ Αἴ: 'At', Αἱ: 'At', ΑἹ: 'At', Εἰ: 'Et', Τὰ: 'Tu', ἃ: 'a' } as Record<string, string>)[x] ?? x);
      // and its commonest misreadings of whole words (l for I, d for B), whatever punctuation follows.
      const misread: Record<string, string> = { lam: 'iam', Lam: 'Iam', lta: 'ita', Lta: 'Ita', ilud: 'illud', ila: 'illa', ile: 'ille', dalbe: 'Balbe', Dalbe: 'Balbe', dalbus: 'Balbus', Dalbus: 'Balbus' };
      w = w.map((x) => x.replace(/^\p{L}+/u, (m) => misread[m] ?? m));
      words.push(...w.map((x) => (/\p{Script=Greek}/u.test(x) ? x : x.normalize('NFD').replace(/\p{M}/gu, ''))));
    });
    // The scan's spaced punctuation ("potuisse ? aut") goes back on its word.
    for (let k = words.length - 1; k > 0; k--) if (/^[?!;:.,]+$/.test(words[k])) words.splice(k - 1, 2, words[k - 1] + words[k]);
    // Where each section starts in words: the best match of Klotz's opening, searched for after the section before.
    const keys = words.map(key);
    // Only a close match moves the search on, and the starts kept must come in order.
    const candidates: [number, number][] = [[1, 0]];
    let last = 0;
    const numbers = [...new Set(klotzBooks.flatMap((k) => [...(k[bi]?.keys() ?? [])]))].sort((a, b) => a - b);
    for (const n of numbers.filter((x) => x > 1)) {
      let best = { at: -1, cost: Infinity };
      for (const k of klotzBooks) {
        const opening = k[bi]?.get(n);
        if (!opening) continue;
        const want = opening.slice(0, 30);
        for (let at = last + 1; at < Math.min(words.length, last + 700); at++) {
          const cost = distance(want, keys.slice(at, at + 12).join('').slice(0, want.length));
          if (cost < best.cost) best = { at, cost };
        }
      }
      // A rough match can land a few words in: back up to its sentence's start, if that's near.
      if (best.at > 0 && !/[.?!:;]$/.test(words[best.at - 1])) {
        const back = words.slice(Math.max(0, best.at - 9), best.at).findLastIndex((w) => /[.?!:;]$/.test(w));
        if (back >= 0) best.at = Math.max(0, best.at - 9) + back + 1;
      }
      if (best.at >= 0 && best.cost <= 11) candidates.push([n, best.at]);
      if (best.cost <= 3) last = best.at;
    }
    const found = increasing(candidates);
    const sections = found.map(([n, at], k) => ({ n, latin: words.slice(at, found[k + 1]?.[1] ?? words.length).join(' ') }));
    const missing = [];
    for (let k = 1; k < found.length; k++) for (let m = found[k - 1][0] + 1; m < found[k][0]; m++) missing.push(m);
    console.log(`Book ${bi + 1}: ${sections.length} sections, up to ${found[found.length - 1][0]}${missing.length ? `; not found: ${missing.join(', ')}` : ''}`);
    out.push(sections);
  }
  return out;
}

/** The longest run of [n, at] pairs (in n order) whose at also increases. */
function increasing(pairs: [number, number][]): [number, number][] {
  const len = pairs.map(() => 1);
  const prev = pairs.map(() => -1);
  pairs.forEach(([, at], i) => {
    for (let j = 0; j < i; j++) if (pairs[j][1] < at && len[j] + 1 > len[i]) [len[i], prev[i]] = [len[j] + 1, j];
  });
  const out: [number, number][] = [];
  for (let i = len.indexOf(Math.max(...len)); i >= 0; i = prev[i]) out.unshift(pairs[i]);
  return out;
}

/** A word as letters to compare across editions and scans: lower case, u for v, i for j. */
function key(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').replace(/v/g, 'u').replace(/j/g, 'i');
}

/** Klotz's Teubner De natura deorum (OCR text): each book's section numbers and their openings, as key() letters. */
function klotzSections(text: string): Map<number, string>[] {
  const out: Map<number, string>[] = [];
  const heads = [...text.matchAll(/^LIBER (PRIMUS|SECUNDUS|TERTIUS)\.\s*$/gm)].map((m) => m.index!).slice(0, 3);
  heads.forEach((h, bi) => {
    const begin = text.indexOf('I. 1.', h);
    let end = bi + 1 < heads.length ? heads[bi + 1] : text.indexOf('DIVINATIONE', begin);
    if (end < 0) end = text.length;
    const book = text
      .slice(begin, end)
      .split('\n')
      .filter((l) => !/CAP\.|NATURA|Digitized|^\s*\d*\s*$/.test(l)) // page headers and footers
      .join('\n')
      .replace(/-\s*\n\s*/g, '')
      .replace(/\s+/g, ' ');
    const sections = new Map<number, string>();
    let cur = 0;
    for (const m of book.matchAll(/(?<![\w§])(\d{1,3}) ?\. (?=\S)/g)) {
      const n = Number(m[1]);
      if (n <= cur || n > cur + 5) continue;
      cur = n;
      sections.set(n, book.slice(m.index! + m[0].length, m.index! + m[0].length + 80).split(' ').map(key).join(''));
    }
    out.push(sections);
  });
  return out;
}

/** Edit distance between two strings. */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
}
