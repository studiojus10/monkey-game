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
  pointsMultiplier,
  publishFolio,
  setPlays,
  shelveBooks,
  tick,
  unshelvedBooks,
} from '../src/game/logic';
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
