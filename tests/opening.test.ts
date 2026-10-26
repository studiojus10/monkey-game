import { describe, expect, it } from 'vitest';
import { introTyped, lettersTyped, renderIntro, renderScreen, openStores, storeItems } from '../src/cli/screen';
import { manuscriptTyped, newspaperTyped, renderManuscript, renderNewspaper, renderNote } from '../src/cli/hiring';
import { opening, typing } from '../src/game/config';
import { buyFasterTyping, buyLetter, deliverManuscript, earlyShopKeys, hireApplicant, manuscriptPlays, nextMonkeyCost, noteRevealed, playerPress, playerTyping, setPlays, shopRevealsNow, tick } from '../src/game/logic';
import { deserialize, serialize } from '../src/game/save';
import { createInitialState } from '../src/game/state';

const plain = (text: string) => text.replace(/\x1b\[[\d;]+m/g, '');
const ids = (s: ReturnType<typeof createInitialState>, store: Parameters<typeof storeItems>[1]) => storeItems(s, store).flatMap((x) => (x.id ? [x.id] : []));
const rng = () => 0;

describe('the opening', () => {
  it('starts with the player alone at the typewriter with A, typing at the slowest pace or by hand', () => {
    const s = createInitialState(0);
    expect(s.monkeys).toEqual([]);
    expect(s.letters).toEqual([opening.letter]);
    expect(playerTyping(s)).toBe(true);
    expect(playerPress(s, rng)).toBe(true);
    expect(s.playerPresses).toBe(1);
    expect(s.wordsTyped).toBe(1); // A is a word
    expect(s.currency).toBeGreaterThan(0);
    // On its own: the slowest pace.
    tick(s, 10, rng);
    expect(s.playerPresses).toBe(1 + 10 * typing.baseLettersPerSecond);
    const screen = plain(renderScreen(s, '', null, 80));
    expect(screen).toContain(opening.playerName);
    expect(screen).toContain(`[h] ${opening.pressAction} A   [space] open shop`);
    expect(screen).not.toContain('Script');
  });

  it('brings the newspaper after enough presses; the monkey hired from it takes the desk and types, Shakespeare set aside', () => {
    setPlays([{ id: 'test', title: 'Test Play', lines: [[1, 1, 'HAMLET', 'I.']] }]);
    const s = createInitialState(0);
    for (let i = 1; i < opening.newspaperAfter; i++) playerPress(s, rng);
    expect(s.newspaper).toEqual([]);
    playerPress(s, rng);
    expect(s.newspaper).toHaveLength(opening.applicants);
    expect(new Set(s.newspaper.map((a) => a.name)).size).toBe(opening.applicants);
    for (const a of s.newspaper) expect(opening.blurbs).toContain(a.blurb);
    const paper = plain(renderNewspaper(s).join('\n'));
    expect(paper).toContain(opening.newspaper.title);
    expect(paper).toContain(`[1] ${s.newspaper[0].name}`);
    // Saved and loaded, it's still waiting.
    expect(deserialize(serialize(s), 0).newspaper).toEqual(s.newspaper);
    const name = s.newspaper[1].name;
    expect(hireApplicant(s, 5)).toBe(false);
    expect(hireApplicant(s, 1)).toBe(true);
    expect(s.monkeys.map((m) => m.name)).toEqual([name]);
    expect(s.player).toBeNull();
    expect(s.newspaper).toEqual([]);
    expect(playerPress(s, rng)).toBe(false);
    // No department or play to choose yet: the monkey types on the home screen.
    tick(s, 10, rng);
    const home = plain(renderScreen(s, '', null, 80));
    expect(home).not.toContain('department');
    expect(home).toContain(name);
    expect(s.monkeys[0].line.length).toBeGreaterThan(0);
    // A loaded game keeps its monkey and doesn't bring the player back.
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.player).toBeNull();
    expect(loaded.monkeys).toHaveLength(1);
  });

  it('sells only letters, then Faster typing once a monkey is hired; the rest show up as they matter and stay', () => {
    const s = createInitialState(0);
    expect(openStores(s)).toEqual(['typewriters']);
    expect(ids(s, 'typewriters')).toEqual(['letter']);
    for (let i = 0; i < opening.newspaperAfter; i++) playerPress(s, rng);
    hireApplicant(s, 0);
    s.departments = ['comedy'];
    expect(openStores(s)).toEqual(['typewriters', 'staff']);
    expect(ids(s, 'typewriters')).toEqual(['letter']);
    expect(ids(s, 'staff')).toEqual(['train']);
    // The hire item once bananas near its price; it stays when they're spent.
    s.currency = nextMonkeyCost(s) * 0.3;
    noteRevealed(s, shopRevealsNow(s));
    s.currency = 0;
    expect(ids(s, 'staff')).toEqual(['train', 'hire']);
    // A better typewriter once the monkey reaches its skill cap.
    s.monkeys[0].skill = typing.levelsPerTypewriter;
    expect(ids(s, 'typewriters')).toEqual(['letter', 'typewriter']);
    // Sentences bring the starting combo and the hats.
    s.sentences = 1;
    expect(ids(s, 'staff')).toEqual(['train', 'hire', 'combo']);
    expect(openStores(s)).toEqual(['typewriters', 'staff', 'hats']);
  });

  it('shows everything in the shop for a save from before the opening', () => {
    const old = JSON.parse(serialize(createInitialState(0)));
    delete old.state.player;
    old.state.monkeys = [{ name: 'Old' }];
    const s = deserialize(JSON.stringify(old), 0);
    expect(s.monkeys).toHaveLength(1);
    for (const k of earlyShopKeys) expect(s.revealed).toContain(k);
  });

  it('types out the intro: a blank screen, the title letter by letter, then the story, page by page', () => {
    const intro = opening.intro;
    expect(plain(renderIntro(0, 0, 80))).not.toContain('I');
    expect(plain(renderIntro(0, intro.pauseMs + 3 * intro.titleMsPerLetter, 80))).toContain(' INF\n');
    expect(introTyped(0, intro.pauseMs + 3 * intro.titleMsPerLetter)).toBe(false);
    const page = plain(renderIntro(0, Infinity, 80));
    expect(page).toContain('INFINITE MONKEYS');
    expect(page).toContain('In the center of town');
    expect(page).toContain('- Enter?');
    expect(page).toContain('[enter] enter');
    expect(introTyped(0, Infinity)).toBe(true);
    const last = plain(renderIntro(1, Infinity, 80));
    expect(last).toContain('The typewriter is broken, save one key.');
    for (const line of last.split('\n')) expect(line.length).toBeLessThanOrEqual(80);
    // Every page keeps its height while it types, so nothing moves.
    expect(renderIntro(1, 0, 80).split('\n')).toHaveLength(last.split('\n').length);
    // The newspaper types out too.
    const s = createInitialState(0);
    for (let i = 0; i < opening.newspaperAfter; i++) playerPress(s, rng);
    expect(newspaperTyped(s, 0)).toBe(false);
    expect(plain(renderNewspaper(s, -1, 0).join('\n'))).not.toContain(opening.newspaper.title);
    expect(newspaperTyped(s, Infinity)).toBe(true);
  });

  it('remembers the intro was read; saves from before it never show it', () => {
    const s = createInitialState(0);
    expect(deserialize(serialize(s), 0).introSeen).toBe(false);
    s.introSeen = true;
    expect(deserialize(serialize(s), 0).introSeen).toBe(true);
    const old = JSON.parse(serialize(createInitialState(0)));
    delete old.state.introSeen;
    expect(deserialize(JSON.stringify(old), 0).introSeen).toBe(true);
  });

  it('slips a manuscript of a random starter play through the mail slot after a 2nd letter and a typing upgrade', () => {
    const line = (text: string): [number, number, string, string] => [1, 1, 'X', text];
    setPlays([
      { id: 'c1', title: 'Short Comedy', genre: 'comedy', lines: [line('A.')] },
      { id: 'c2', title: 'Long Comedy', genre: 'comedy', lines: [line('A.'), line('A A.')] },
      { id: 'h1', title: 'History', genre: 'history', lines: [line('A.')] },
      { id: 't1', title: 'Tragedy', genre: 'tragedy', lines: [line('A.')] },
    ]);
    expect(manuscriptPlays().map((p) => p.id)).toEqual(['c1', 'h1', 't1']);
    const s = createInitialState(0);
    for (let i = 0; i < opening.newspaperAfter; i++) playerPress(s, rng);
    hireApplicant(s, 0);
    s.currency = 1e9;
    s.words = 1e9;
    expect(deliverManuscript(s, rng)).toBe(false);
    expect(buyLetter(s, 'N')).toBe(true);
    expect(deliverManuscript(s, rng)).toBe(false); // the typing upgrade still to come
    expect(buyFasterTyping(s, 0)).toBe(true);
    tick(s, 1, () => 0.5);
    expect(s.manuscript).toBe('h1');
    expect(s.manuscriptNote).toBe(true); // "An old favorite", closed before the manuscript shows
    expect(s.departments).toEqual(['history']);
    expect(s.owned).toEqual(['h1']);
    expect(s.office[0].department).toBe('history');
    expect(deliverManuscript(s, rng)).toBe(false); // only once
    const note = plain(renderManuscript(s).join('\n'));
    expect(note).toContain('History');
    expect(note).toContain('by William Shakespeare');
    expect(manuscriptTyped(s, 0)).toBe(false);
    expect(deserialize(serialize(s), 0).manuscript).toBe('h1');
  });

  it('pauses briefly after each sentence while typing out', () => {
    const ms = opening.msPerLetter;
    expect(lettersTyped(['Hi. Yo'], 3 * ms)).toBe(3);
    // After the full stop, the pause before the next letter.
    expect(lettersTyped(['Hi. Yo'], 4 * ms)).toBe(3);
    expect(lettersTyped(['Hi. Yo'], 4 * ms + opening.sentencePauseMs)).toBe(4);
    // An ellipsis pauses once, at its end.
    expect(lettersTyped(['A...B'], 4 * ms)).toBe(4);
    expect(lettersTyped(['A...B'], 5 * ms + opening.sentencePauseMs)).toBe(5);
    expect(lettersTyped(['Hi.', 'Yo'], Infinity)).toBe(5);
  });

  it('puts a note on top of the newspaper, closed before it opens', () => {
    const s = createInitialState(0);
    for (let i = 0; i < opening.newspaperAfter; i++) playerPress(s, rng);
    expect(s.newspaperNote).toBe(true);
    expect(plain(renderNote(opening.newspaper.note).join('\n'))).toContain(opening.newspaper.note);
    expect(deserialize(serialize(s), 0).newspaperNote).toBe(true);
  });
});
