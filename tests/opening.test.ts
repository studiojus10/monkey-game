import { describe, expect, it } from 'vitest';
import { renderScreen, openStores, storeItems } from '../src/cli/screen';
import { renderNewspaper } from '../src/cli/hiring';
import { opening, typing } from '../src/game/config';
import { earlyShopKeys, hireApplicant, nextMonkeyCost, noteRevealed, playerPress, playerTyping, setPlays, shopRevealsNow, tick } from '../src/game/logic';
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
    expect(screen).toContain(`[h] ${opening.pressAction} A`);
    expect(screen).not.toContain('Script');
  });

  it('brings the newspaper after enough presses; the monkey hired from it takes the desk, then the department is chosen', () => {
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
    expect(plain(renderScreen(s, '', null, 80))).toContain('Choose its department');
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
});
