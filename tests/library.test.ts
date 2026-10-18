import { describe, expect, it } from 'vitest';
import { library } from '../src/game/config';
import {
  buyGallery,
  buyRoom,
  canBuildLibrary,
  chooseFirstLetter,
  galleryCost,
  libraryBonus,
  libraryGalleries,
  libraryFull,
  bookTitle,
  pointsMultiplier,
  publishFolio,
  setPlays,
  shelveBooks,
  tick,
  unshelvedBooks,
  departmentGenres,
  keyboard,
  latinUnlocked,
  switchClassical,
  textGenre,
  managerLine,
  buySection,
} from '../src/game/logic';
import { departmentName, renderScreen } from '../src/cli/screen';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState } from '../src/game/state';
import { renderBook, renderLibrary } from '../src/cli/library';
import { roomName } from '../src/cli/office';

const plain = (text: string) => text.replace(/\x1b\[[\d;]+m/g, '');
const play = (id: string) => ({ id, title: `Play ${id}`, lines: [[1, 1, 'HAMLET', 'I.'] as [number, number, string, string]] });

function started() {
  setPlays(['a', 'b', 'c', 'd', 'e'].map(play));
  const s = createInitialState(0);
  s.departments = ['comedy'];
  s.owned = ['a'];
  chooseFirstLetter(s, 'i');
  s.sentences = s.currency = 1e12;
  return s;
}

describe('the Library', () => {
  it('can be built once a play is finished, and shelves finished plays as the game runs', () => {
    const s = started();
    expect(canBuildLibrary(s)).toBe(false);
    expect(buyRoom(s, 'library')).toBe(false);
    s.playsDone.push('a');
    tick(s, 1, () => 0.5);
    expect(s.shelved).toEqual(['a']);
    expect(canBuildLibrary(s)).toBe(true);
    expect(buyRoom(s, 'library')).toBe(true);
    expect(roomName(s, s.office[s.office.length - 1])).toBe(library.name);
    expect(canBuildLibrary(s)).toBe(false);
    expect(s.galleries).toBe(1);
    expect(libraryGalleries(s)).toEqual([['a']]);
  });

  it('fills galleries in order; a full gallery adds to points, and more galleries cost Lines', () => {
    const s = started();
    s.playsDone.push('a', 'b', 'c', 'd', 'e');
    shelveBooks(s);
    buyRoom(s, 'library');
    expect(libraryGalleries(s)).toEqual([['a', 'b', 'c', 'd']]);
    expect(unshelvedBooks(s)).toBe(1);
    expect(libraryBonus(s)).toBeCloseTo(library.fullBonus);
    const before = pointsMultiplier(s);
    s.lines = galleryCost(s) - 1;
    expect(buyGallery(s)).toBe(false);
    s.lines += 1;
    expect(buyGallery(s)).toBe(true);
    expect(s.lines).toBe(0);
    expect(libraryGalleries(s)).toEqual([['a', 'b', 'c', 'd'], ['e']]);
    expect(unshelvedBooks(s)).toBe(0);
    expect(galleryCost(s)).toBe(library.galleryCost * library.galleryCostGrowth);
    expect(pointsMultiplier(s)).toBeCloseTo(before);
  });

  it('holds maxBooks books at most', () => {
    const s = started();
    s.playsDone.push('a');
    buyRoom(s, 'library');
    s.galleries = library.maxBooks / library.booksPerGallery - 1;
    s.lines = Infinity;
    expect(buyGallery(s)).toBe(true);
    expect(libraryFull(s)).toBe(true);
    expect(buyGallery(s)).toBe(false);
    expect(s.galleries * library.booksPerGallery).toBe(500);
  });

  it('titles a Records book with its first sentence', () => {
    const s = started();
    s.recordBooks = [['KINGS LOVE GOLD', 'HE IS DEAD']];
    expect(bookTitle('records-1', s)).toBe('"KINGS LOVE GOLD"');
    expect(bookTitle('records-2', s)).toBe('Records, volume 2');
  });

  it('keeps its books and galleries through a Folio, which is shelved too', () => {
    const s = started();
    s.playsDone.push('a');
    buyRoom(s, 'library');
    s.galleries = 3;
    const next = publishFolio(s)!;
    expect(next.shelved).toEqual(['a', 'folio-1']);
    expect(next.galleries).toBe(3);
    expect(canBuildLibrary(next)).toBe(true);
    expect(deserialize(serialize(next))!.shelved).toEqual(['a', 'folio-1']);
  });

  it('draws its galleries as hexagons and opens a shelved book', () => {
    const s = started();
    s.playsDone.push('a');
    shelveBooks(s);
    s.shelved.push('folio-1');
    buyRoom(s, 'library');
    s.galleries = 3;
    const screen = plain(renderLibrary(s, 0, '', 80));
    expect(screen).toContain('\\______/');
    expect(screen).toContain('No. 3');
    expect(screen).toContain('[1] Play a');
    expect(screen).toContain('[2] Folio 1');
    expect(screen).toContain('an empty shelf');
    expect(plain(renderBook(s, 'a', 0, 10, 80))).toContain('HAMLET: I.');
    expect(screen).toContain('[0] Bibliography');
    expect(plain(renderBook(s, 'bibliography', 0, 40, 80))).toContain('Yonge');
    expect([...plain(screen)].filter((c) => c > '\x7f')).toEqual([]);
  });
});

describe('saves', () => {
  it('keep the Greek department and Greek words', () => {
    const s = started();
    s.departments.push('greek');
    s.stats.longestWord = 'ΑΡΧΗ';
    const back = deserialize(serialize(s))!;
    expect(back.departments).toContain('greek');
    expect(back.stats.longestWord).toBe('ΑΡΧΗ');
  });
});

describe('the Latin book', () => {
  const natura = { id: 'natura', title: 'Cicero, De natura deorum', genre: 'latin' as const, lines: [[1, 1, '', 'Cum multae res in philosophia'] as [number, number, string, string]], english: ['There are many things in philosophy'] };
  const scroll = { id: 'metaphysics-1-4', title: 'Scroll', genre: 'greek' as const, lines: [[1, 4, '', 'ΟΥΚ ΑΛΛΑ'] as [number, number, string, string]] };

  it('waits on the Library\'s first shelf and makes the Greek department the Classical department', () => {
    const s = started();
    setPlays([play('a'), natura, scroll]);
    s.departments.push('greek');
    s.playsDone.push('a');
    expect(departmentName(s, 'greek')).toBe('Greek');
    buyRoom(s, 'library');
    expect(latinUnlocked(s)).toBe(true);
    expect(s.shelved).toEqual(['a', 'natura']);
    expect(departmentName(s, 'greek')).toBe('Classical');
    expect(departmentGenres(s)).not.toContain('latin');
    expect(s.lately.news.map((n) => n.text).join(' ')).toContain('Classical department');
    expect(plain(renderScreen(s, '', null, 120))).toContain('De natura deorum');
  });

  it('types Greek until switched to Latin, with Latin letters and lines', () => {
    const s = started();
    setPlays([play('a'), natura, scroll]);
    s.owned.push('metaphysics-1-4:1.4');
    s.departments.push('greek');
    s.playsDone.push('a');
    buyRoom(s, 'library');
    expect(textGenre(s, 'greek')).toBe('greek');
    expect(managerLine(s, 'greek')?.play).toBe('metaphysics-1-4');
    expect(switchClassical(s)).toBe(true);
    expect(textGenre(s, 'greek')).toBe('latin');
    expect(keyboard(s, 'greek').map((k) => k.text)).toContain('P');
    expect(keyboard(s, 'greek').map((k) => k.text)).not.toContain('Α');
    expect(managerLine(s, 'greek')?.play).toBe('natura');
    expect(buySection(s, 'natura')).toBe(false); // already owned
  });

  it('opens the Classical department itself when there is no Greek department yet', () => {
    const s = started();
    setPlays([play('a'), natura, scroll]);
    s.playsDone.push('a');
    buyRoom(s, 'library');
    expect(s.departments).toContain('greek');
    expect(departmentName(s, 'greek')).toBe('Classical');
  });
});
