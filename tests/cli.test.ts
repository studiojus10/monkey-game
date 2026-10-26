import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import {
  keyChoices,
  homeMonkeys,
  renderLetterPicker,
  maxMonkeyLines,
  renderKeysMenu,
  renderLine,
  folioPrompt,
  lineRoom,
  renderScreen,
  upgradeColumns,
  ordinal,
  renderScript,
  renderContents,
  renderSlotsMenu,
  renderOptions,
  renderCoinFlip,
  renderTelegrams,
  promptChoices,
  highlightChoice,
  hatPick,
  inspectItem,
  dyeColorPrompt,
  dyePick,
  slotHighlight,
  stores,
  openStores,
  pagesFor,
  storeChoices,
  storePages,
  storePageSize,
  renderShop,
  renderHomeKeys,
  speedText,
  pageTabsRow,
  shopKeys,
} from '../src/cli/screen';
import { affordable, bold, coverBottom, fillHeight, highlight, inverseSpan, cyan, forLightBackground, green, lightShade, terminalBackground, inverse, plainText, placeScreen, red, scrollMarks, titleBar, yellow } from '../src/cli/style';
import { labelPress } from '../src/cli/mouse';
import { officeKeys, inspectSquare, officeMapWidth, renderOffice, renderOfficeHelp, renderFengShuiBook, renderManagerBook } from '../src/cli/office';
import { renderRoster, rosterActions, rosterKeys, rosterOrder } from '../src/cli/roster';
import { columnBox, promptBox, keyBox, cheapestHire, overlay, renderCandidates, renderPostPopup } from '../src/cli/hiring';
import { inventoryRows, renderInventory, renderMonkeyPicker } from '../src/cli/inventory';
import { dictionaryRowFor, renderAchievements, renderDictionary, renderStats } from '../src/cli/stats';
import { achievements, lately, monkeyNames, opening } from '../src/game/config';
import { greekLetters, type PlayData } from '../src/game/plays';
import { drainCut, fitsAt, restBoost, posts, postCost, poke, typeLetter, buyRoom, hireManager, chooseFirstLetter, chooseStarterPlay, renameMonkey, setPlays, togglePin, openDepartment, noteLately } from '../src/game/logic';
import { deserialize, load, save, serialize } from '../src/game/save';
import { createMonkey } from '../src/game/state';
import { startedGame } from './start';
import type { Genre } from '../src/game/plays';
import { formatAmount, formatPrice } from '../src/format';
import { sellEverything, withUnlocks } from './unlocks';

sellEverything();

describe('file storage', () => {
  it('saves and loads through a file, and clears it', () => {
    const storage = fileStorage(join(mkdtempSync(join(tmpdir(), 'idle-')), 'nested', 'save.json'));
    expect(storage.read()).toBeNull();
    const s = startedGame(0);
    chooseFirstLetter(s, 'a');
    s.currency = 99;
    save(s, storage, 1000);
    expect(load(storage, 2000)).toEqual({ ...s, lastSaved: 1000 });
    storage.clear();
    expect(storage.read()).toBeNull();
  });
});

const testPlay = {
  id: 'test',
  title: 'Test Play',
  lines: [
    [1, 1, 'HAMLET', 'I.'],
    [1, 2, 'POLONIUS', 'Ay, my lord.'],
  ] as [number, number, string, string][],
};

// Screens below are checked with monkeys under their plain M-numbers, not famous names.
monkeyNames.splice(0);

/** Drops ANSI styling (bold prices and counters) so layout can be checked as plain text. */
const plain = (text: string) => text.replace(/\x1b\[[\d;]+m/g, '');
/** Plain text with each run of spaces as one, for checking shop rows whatever their column widths. */
const squash = (text: string) => plain(text).replace(/ +/g, ' ');
/** The plain text of the highlighted (shaded) lines of a screen. */
const shaded = (text: string) => text.split('\n').filter((l) => l.includes('\x1b[48;5;236m')).map(plain).join('\n');

/** A state past the opening choices: the test play and the letter I. */
function started() {
  setPlays([testPlay]);
  const s = startedGame(0);
  s.departments = ['comedy'];
  s.owned = ['test'];
  chooseFirstLetter(s, 'i');
  return s;
}

describe('terminal screen', () => {
  it('asks for a genre first, then a free play, then the first letter (once Shakespeare is back)', () => {
    setPlays([testPlay]);
    const s = startedGame(0);
    const scriptLetters = opening.scriptLetters;
    opening.scriptLetters = 0;
    onTestFinished(() => {
      opening.scriptLetters = scriptLetters;
    });
    const genres = plain(renderScreen(s, '', null, 80));
    expect(genres.split('\n')[0]).toBe(' INFINITE MONKEYS ');
    expect(genres).toContain('   [1] Comedies   Test Play');
    expect(genres).toContain(' [up/down] choose   [enter] pick   [1] pick   [p] save profiles   [q] quit');
    expect(shaded(renderScreen(s, '', null, 80, 0))).toContain('   [1] Comedies   Test Play'); // the cursor's choice
    openDepartment(s, 'comedy');
    expect(plain(renderScreen(s))).toContain('   [1] Test Play   2 lines');
    chooseStarterPlay(s, 'test');
    const text = plain(renderScreen(s));
    expect(text).toContain('   [a] A\n   [i] I\n');
    expect(text).toContain(' [a/i] pick   [p] save profiles   [q] quit');
    expect(text).not.toContain('Bananas');
  });

  it('finds the choices in a picker prompt and highlights the chosen one', () => {
    const prompt = `Hat for which monkey? [1] ${green('Ann')} (free)   [2] Bob   (any other key: done)`;
    expect(promptChoices(prompt).map((c) => c.key)).toEqual(['1', '2']);
    expect(highlightChoice(prompt, 1)).toContain(highlight('[2] Bob'));
    expect(highlightChoice(prompt, 0)).toContain(highlight(`[1] ${green('Ann')} (free)`));
    expect(promptChoices('Press letters to buy (any other key: done). Values: B(3) C(3)').map((c) => c.key)).toEqual(['B', 'C']);
    expect(highlightChoice('Values: B(3) C(3)', 1)).toBe(`Values: B(3) ${highlight('C(3)')}`);
  });

  it('shows the longest word, the last sentence and the longest sentence lately', () => {
    const s = started();
    noteLately(s, 'word', ['BANANA']);
    noteLately(s, 'word', ['AT']); // shorter: BANANA stays
    noteLately(s, 'sentence', ['THE', 'CAT', 'SAT', 'ON', 'THE', 'MAT']);
    noteLately(s, 'sentence', ['A', 'BIG', 'DOG']);
    const text = plain(renderScreen(s, '', null, 80));
    expect(text).toContain('Longest word lately: BANANA (6 letters)');
    expect(text).toContain('Last sentence: A BIG DOG');
    expect(text).toContain('Longest sentence lately (6 words): THE CAT SAT ON THE MAT');
    s.stats.secondsTyping += lately.windowSeconds + 1; // an hour on, anything replaces them
    noteLately(s, 'word', ['AT']);
    expect(s.lately.longWord).toBe('AT');
    noteLately(s, 'sentence', Array.from({ length: 30 }, () => 'BANANA'));
    expect(plain(renderScreen(s, '', null, 60))).toMatch(/Longest sentence lately \(30 words\): BANANA .*\.\.\./); // cut to fit
    expect(deserialize(serialize(s)).lately).toEqual(s.lately);
  });

  it('shows the currencies, letters, the monkey table and controls', () => {
    const s = started();
    s.currency = 1234;
    s.wordsTyped = 3;
    s.lastWord = 'I';
    s.lastWordPoints = 1;
    s.monkeys[0].line = [{ text: 'I', scored: true }];
    const text = renderScreen(s, 'hello');
    const shop = squash(renderScreen(s, 'hello', 'staff'));
    const tools = squash(renderScreen(s, '', 'typewriters'));
    // A title bar, then every total in bold in its own colour, in this order.
    expect(text.split('\n')[0]).toBe(
      '\x1b[1m\x1b[7m INFINITE MONKEYS > HOME \x1b[27m\x1b[22m    \x1b[1m\x1b[33m1,234 Bananas\x1b[39m\x1b[22m   \x1b[1m\x1b[36m0 Words\x1b[39m\x1b[22m   ' +
        '\x1b[1m\x1b[35m0 Sentences\x1b[39m\x1b[22m   \x1b[1m\x1b[34m0 Lines\x1b[39m\x1b[22m   \x1b[1m[tab] menu\x1b[22m   \x1b[1m[?] coin flip 1.0%\x1b[22m',
    );
    expect(plain(text)).toContain(' Letters  _ _ _ _ _ _ _ _ I _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _   (1 of 26)'); // the alphabet, owned letters in their places
    expect(plain(text)).toContain(' Script   0 / 2 lines written   2 scenes owned');
    // A finished alphabet leaves the home screen.
    expect(plain(renderScreen({ ...s, letters: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] }, '', null))).not.toContain(' Letters ');
    const rows = plain(text).split('\n');
    expect(rows[2]).toBe(' MONKEY                SPEED   ENERGY  COMBO  TYPING');
    expect(rows[3]).toBe('  @ M-1               0.50/s     100%   x1.0  I_');
    expect(plain(text)).toContain('Last word: I +1');
    expect(text).toContain(bold('hello')); // the newest message, under LATELY
    expect(plain(text)).toContain('[q] quit');
    // The shop is a popup over the bottom of the home screen, its items in columns with prices on the right.
    expect(shop.split('\n')[0]).toContain(' INFINITE MONKEYS ');
    expect(shop).toContain('\n ====');
    expect(shop).toContain(' hello'); // messages still show
    expect(shop).toContain('[1] Faster typing M-1: 0.50 -> 0.63/s, skill 0/10 * 10 Bananas\n');
    expect(tools).toContain('[2] Portable typewriter M-1: skill cap 10 -> 20 * 1,000 Bananas\n');
    expect(tools).toContain('[1] Buy a letter key you choose it (25 left) * 25 Bananas\n'); // the 2nd letter costs no Words
    s.letters.push('A');
    expect(squash(renderScreen(s, '', 'typewriters'))).toContain('[1] Buy a letter key you choose it (24 left) 85 Bananas + 1 Words\n');
    expect(shop).toContain('[2] Hire a monkey random stats and trait, you have 1 1,000,000 Bananas\n');
    expect(shop).toContain('[3] Starting combo x1.0 -> x1.1 1 Sentences\n');
  });

  it('colours each typist energy: green when fresh, yellow when tiring, red when nearly spent, blue Resting on a break', () => {
    const s = started();
    const energy = () => renderScreen(s).split('\n')[3];
    for (const [e, code] of [[1, 32], [0.81, 32], [0.8, 33], [0.21, 33], [0.2, 31], [0, 31]] as const) {
      s.monkeys[0].energy = e;
      expect(energy()).toContain(`\x1b[${code}m${`${Math.round(e * 100)}%`.padStart(7)}\x1b[39m`);
    }
    s.monkeys[0].resting = true;
    expect(energy()).toContain('\x1b[34mResting\x1b[39m');
  });

  it('keeps every column the same width whatever the numbers', () => {
    const s = started();
    s.monkeys.push(createMonkey(), createMonkey());
    s.monkeys[1].energy = 0.05;
    s.monkeys[2].resting = true;
    s.monkeys[2].skill = 200;
    s.monkeys[0].chainWords = ['ZZZZ', 'YYYY', 'XXXX', 'WWWW', 'VVVV', 'UUUU', 'TTTT', 'SSSS', 'RRRR', 'QQQQ']; // x13
    const rows = plain(renderScreen(s)).split('\n').slice(2, 6);
    for (const heading of ['SPEED', 'ENERGY', 'COMBO']) {
      const end = rows[0].indexOf(heading) + heading.length;
      for (const r of rows.slice(1)) expect(r[end - 1], `${heading}: ${r}`).not.toBe(' '); // right-aligned under the heading
      for (const r of rows.slice(1)) expect(r[end], `${heading}: ${r}`).toBe(' ');
    }
  });

  it('lists every key on the [/] page', () => {
    const s = started();
    const keys = plain(renderHomeKeys(s));
    for (const k of ['[space]', '[p]', '[o]', '[t]', '[a]', '[w]', '[c]', '[enter]', '[n]', '[d]', '[s]', '[r]', '[`]', '[q]']) expect(keys).toContain(k);
    expect(plain(renderScreen(s))).not.toContain('[`]'); // the home screen keeps to the everyday keys
  });

  it('keeps the shop closed until space opens it', () => {
    const s = started();
    const closed = plain(renderScreen(s));
    expect(closed).not.toContain('Faster typing');
    expect(closed).toContain('[up/down] choose a monkey   [enter] details'); // the main keys only: the navigation bar goes everywhere
    expect(closed).toContain('[/] all keys');
    expect(closed).toContain('[up/down] choose a monkey   [enter] details   [h] pet the monkey   [/] all keys   [q] quit');
    expect(renderScreen(s, '', null, 0, -1, 0, 0)).toMatch(/\x1b\[48;5;236mM-1 *\x1b\[49m/); // the chosen monkey's name
    const open = plain(renderScreen(s, '', 'staff'));
    expect(open).toContain('Faster typing');
    expect(open).toContain('[up/down] choose   [enter] buy   [[/]] store   [esc] back   [/] all keys');
    expect(open).not.toContain('SPEED'); // the shop takes the whole screen
    expect(open).toContain('\n Typewriters   Staff   Hats \n'); // furniture is sold on the office map, research on its own page, scenes on the script page
    expect(renderScreen(s, '', 'staff', 0, 0)).toMatch(/\x1b\[48;5;236m \[1\] Faster typing/); // the cursor's item
    expect(renderScreen(s, '', 'staff')).not.toContain(highlight(' [1]'));
    expect(renderScreen(s, '', 'staff')).toContain(bold(inverse(' Staff '))); // the open store
    s.currency = 30; // enough for Faster typing and a letter key: a * on those stores
    expect(plain(renderScreen(s, '', 'hats'))).toContain('\n Typewriters*  Staff*  Hats \n');
  });

  it('celebrates the last line a monkey wrote', () => {
    const s = started();
    s.lastLine = { play: 'test', index: 1, firstTime: true, points: 396, sentence: true };
    expect(renderScreen(s)).toContain('A monkey wrote a line! "Ay, my lord." (1.2)  +396 Bananas, +1 Line, +1 Sentence');
  });

  it('shows every letter in capitals, with pending letters before the cursor', () => {
    const line = renderLine({
      ...createMonkey(),
      pending: 'IT',
      line: [
        { text: 'CAT', scored: true },
        { text: 'X', scored: false },
      ],
    });
    expect(line).toBe('CATX\x1b[1mIT\x1b[22m_');
  });

  it('starts every monkey line in the same column, whatever the names', () => {
    const s = started();
    s.monkeys.push(createMonkey(), createMonkey());
    renameMonkey(s, 1, 'Bartholomew');
    s.monkeys[2].chainWords = ['ZZZZ', 'YYYY']; // pretend x3 vs x1
    const rows = plain(renderScreen(s)).split('\n').filter((r) => r.endsWith('_') && r.includes('@'));
    expect(rows).toHaveLength(3);
    expect(rows[1].startsWith('  @ Bartholomew ')).toBe(true);
    expect(new Set(rows.map((r) => r.indexOf('_'))).size).toBe(1);
  });

  it('runs monkey lines to the edge of the screen, dropping the oldest letters if the screen is narrower', () => {
    const s = started();
    s.monkeys[0].line = [{ text: 'X'.repeat(200), scored: false }];
    for (const columns of [60, 100, 160]) {
      const row = plain(renderScreen(s, '', null, columns)).split('\n').find((r) => r.endsWith('X_'))!;
      expect(row.length).toBe(columns - 1); // the last column stays free
      expect(lineRoom(s, columns)).toBe(row.length - row.indexOf('X') - 1);
    }
    expect(renderLine({ ...createMonkey(), pending: 'IT', line: [{ text: 'CAT', scored: true }, { text: 'X', scored: false }] }, 4)).toBe(
      'TX\x1b[1mIT\x1b[22m_',
    );
  });

  it('keeps the current run of words bold until a letter breaks it', () => {
    const seg = (text: string, scored = true) => ({ text, scored });
    const line = (segs: { text: string; scored: boolean }[], pending = '') =>
      renderLine({ ...createMonkey(), pending, line: segs });
    expect(line([seg('X', false), seg('CAT'), seg('ZAP')])).toBe('X\x1b[1mCATZAP\x1b[22m_');
    expect(line([seg('CAT'), seg('X', false)])).toBe('CAT\x1b[1mX\x1b[22m_');
    expect(line([seg('CAT'), seg('X', false)], 'Z')).toBe('CATX\x1b[1mZ\x1b[22m_');
    expect(line([])).toBe('_');
  });
});

describe('the Research page', () => {
  it('is in the [tab] menu once the R&D lab is built, a page of its own rather than a shop tab', () => {
    const s = started();
    expect(pagesFor(s)).not.toContain('research');
    s.monkeys.push(...Array.from({ length: 7 }, createMonkey));
    s.currency = s.sentences = 1e12;
    expect(buyRoom(s, 'lab')).toBe(true);
    expect(pagesFor(s)).toEqual(['home', 'shop', 'monkeys', 'office', 'texts', 'records', 'options', 'research']);
    expect(openStores(s)).not.toContain('research');
    const page = plain(renderScreen(s, '', 'research'));
    expect(page).toContain(' INFINITE MONKEYS > RESEARCH ');
    expect(page).not.toContain('Typewriters'); // no store tabs
  });
});

describe('the roster', () => {
  it('lists monkeys by department then hire order, and shows the chosen one in detail', () => {
    const s = started();
    s.departments = ['comedy', 'tragedy'];
    s.monkeys.push({ ...createMonkey(), department: 'tragedy', name: 'Yorick' }, { ...createMonkey(), department: 'comedy', name: 'Puck' });
    s.monkeys[1].trait = 'loner';
    expect(rosterOrder(s)).toEqual([0, 2, 1]);
    const text = plain(renderRoster(s, 2));
    expect(text).toMatch(/COMEDIES[\s\S]*Puck[\s\S]*TRAGEDIES[\s\S]*Yorick/);
    expect(text).toContain('Types for Tragedies');
    expect(text).toContain('Worked     0s at the company');
    s.monkeys[1].worked = 3 * 86400 + 2 * 3600;
    expect(plain(renderRoster(s, 2))).toContain('Worked     3d 2h 0m at the company');
    expect(text).not.toContain('Trait');
    s.managerBook = true;
    expect(plain(renderRoster(s, 2))).toContain('Loner');
    expect(plain(renderRoster(s, 2))).toContain('unknown (an HR Department would find out)');
    Object.assign(s.monkeys[1], { speedStat: 1.12, stamina: 0.9, jobs: { typing: 'loves', managing: 'fine', hr: 'unsuited', research: 'detests', marketing: 'good' } });
    s.office.push({ id: 'r9', kind: 'hr', department: '', cells: [[9, 9]] });
    const shown = renderRoster(s, 2);
    expect(plain(shown)).toContain('speed 112%   stamina 90%');
    expect(plain(shown)).toContain('Typing loves, Managing fine, HR unsuited, Marketing good, Research detests');
    expect(shown).toContain(bold(green('Typing loves'))); // its own job, in bold
    expect(plain(renderHomeKeys(s))).toContain('[m]');
  });
});

const roomTagLike = '\x1b[44mX\x1b[49m';

describe('shop popup', () => {
  it('covers the bottom of the screen without moving what is above it', () => {
    expect(plain(coverBottom('a\nb\nc\nd\ne', 'X\nY', 30))).toBe(`a\nb\n ${'='.repeat(28)}\nX\nY`);
    expect(plain(coverBottom('a\nb', 'X\nY\nZ', 30)).split('\n')).toEqual(['a', ` ${'='.repeat(28)}`, 'X', 'Y', 'Z']); // too tall: just the title bar above it
    const s = started();
    const shop = plain(renderScreen(s, '', 'staff', 80, 0, 60));
    expect(shop.split('\n')[0]).toBe(plain(renderScreen(s, '', null, 80, 0, 60)).split('\n')[0]);
    expect(shop).toContain('Hire a monkey');
  });

  it('covers only its own height of a home screen as tall as the game, so LATELY stays in sight', () => {
    const s = started();
    noteLately(s, 'word', ['HELLO']);
    const home = plain(renderScreen(s, '', null, 80, -1, 0)).split('\n');
    const shop = plain(renderScreen(s, '', 'staff', 80, -1, 60)).split('\n');
    expect(home).toContain(' LATELY');
    expect(shop).toHaveLength(60);
    expect(shop.slice(0, home.indexOf(' LATELY') + 2)).toEqual(home.slice(0, home.indexOf(' LATELY') + 2));
  });

  it('shades a highlighted row, keeping its colours (green for something you can buy)', () => {
    const lit = highlight(affordable(' [1] Plant  * 100 Bananas'));
    expect(lit).toBe(`\x1b[48;5;236m${affordable(' [1] Plant  * 100 Bananas')}\x1b[49m`);
    expect(lit).not.toContain('\x1b[7m');
    expect(highlight(`a${roomTagLike}b`)).toContain('\x1b[49m\x1b[48;5;236mb'); // the shade outlasts codes that clear the background
    expect(inverseSpan(affordable('[1] Plant'), 0, 3)).toBe(`\x1b[32m\x1b[48;5;236m[1]\x1b[49m Plant\x1b[39m`);
    expect(forLightBackground(lit)).toContain('\x1b[48;5;255m');
  });
});

describe('letter picking', () => {
  it('shows A to Z with owned letters dimmed and no values', () => {
    const s = startedGame(0);
    chooseFirstLetter(s, 'a');
    const text = renderLetterPicker(s, false, 0);
    expect(text).toContain('\x1b[2mA\x1b[');
    expect(text).toContain('Z');
    expect(text).not.toContain('B(3)');
    expect(text).toContain('Buy a letter');
    expect(text).toContain('esc');
  });

  it('offers a free letter with no way out', () => {
    const s = startedGame(0);
    chooseFirstLetter(s, 'a');
    s.freeLetters = 2;
    s.letterGifts = ['first-hire'];
    const text = plainText(renderLetterPicker(s, true, 0));
    expect(text).toContain('A free letter for');
    expect(text).toContain('2 free letters');
    expect(text).not.toContain('esc');
  });
});

describe('many monkeys', () => {
  it('shows the first few lines and sums up the rest', () => {
    const s = started();
    s.monkeys = Array.from({ length: maxMonkeyLines + 5 }, createMonkey);
    const text = renderScreen(s);
    expect(text).toContain(`M-${maxMonkeyLines} `);
    expect(text).not.toContain(`M-${maxMonkeyLines + 1} `);
    expect(text).toContain('...and 5 more monkeys typing');
  });
});

describe('script browser and pins', () => {
  it('shows a page of the play with scenes, the cursor and what each line needs', () => {
    const s = started();
    let text = renderScript(s, 'test', 1);
    expect(text).toContain(' INFINITE MONKEYS > SCRIPT ');
    expect(squash(text)).toContain('\n Test Play Comedies 0 / 2 lines written\n');
    expect(squash(text)).toContain('[w] whole play owned');
    expect(squash(text)).not.toContain('[b] scene');
    expect(squash(text)).toContain('\n ACT 1, SCENE 1 0 / 1 written NEEDS\n');
    expect(squash(text)).toContain('\n ACT 1, SCENE 2 0 / 1 written NEEDS\n');
    expect(squash(text)).toContain('\n HAMLET I. in reach\n');
    expect(squash(text)).toContain('\n> POLONIUS Ay, my lord. ADLMORY \n'); // the letters it needs
    expect(shaded(text)).toContain('>  POLONIUS '); // the cursor's line is shaded
    s.completed.test = [0];
    togglePin(s, 'test', 1);
    text = renderScript(s, 'test', 0);
    expect(squash(text)).toContain('\n>+ HAMLET I. \n');
    expect(squash(text)).toContain('\n @ POLONIUS Ay, my lord. ADLMORY\n');
    expect(text).toContain('@ pinned (1/5)');
    expect(renderScript(s, 'test', 1)).toContain('\x1b[32m + HAMLET'); // written lines are green
  });

  it('shows pinned lines on the home screen', () => {
    const s = started();
    expect(renderScreen(s)).not.toContain('Pinned lines');
    togglePin(s, 'test', 1);
    expect(renderScreen(s)).toContain('@ Test Play 1.2 "Ay, my lord."   (needs A D L M O R Y)');
  });

  it("shows managers' lines with the pinned lines, even past the pin limit", () => {
    const s = started();
    s.monkeys[0].manager = true;
    s.monkeys[0].target = { play: 'test', index: 1 };
    expect(plainText(renderScreen(s))).toContain('@ Test Play 1.2 "Ay, my lord."   (needs A D L M O R Y)   [Comedies manager]');
    togglePin(s, 'test', 1);
    expect(plainText(renderScreen(s)).split('Ay, my lord.').length).toBe(2); // shown once
  });
});

describe('buying plays in the script browser', () => {
  it('shows unowned scenes, sells only the whole play with its price, and locked genres', () => {
    const s = started();
    s.owned = ['test:1.1'];
    const text = squash(renderScript(s, 'test', 1));
    expect(text).toContain('\n ACT 1, SCENE 2 1 line, not owned NEEDS\n');
    expect(text).toContain('\n> POLONIUS Ay, my lord. \n'); // nothing needed until you own it
    expect(text).toContain('[w] whole play 1 Lines'); // half a Line for the unowned scene's one line, rounded up
    expect(text).not.toContain('[b] scene');
    expect(text).not.toContain('[a] Act 1');
    s.lines = 1;
    expect(renderScript(s, 'test', 1)).toContain(green(`${bold('[w]')} whole play * ${bold('1')} Lines`)); // affordable: all green, its key too
    s.departments = [];
    s.owned = [];
    expect(renderScript(s, 'test', 1)).toContain('Open a Comedies department to buy these.');
  });
});

describe('bold prices', () => {
  it('shows what you can afford all in green with a *, and dims the rest', () => {
    const s = started();
    s.currency = 20;
    const staff = renderScreen(s, '', 'staff');
    const typing = staff.split('\n').find((r) => r.includes('Faster typing'))!;
    expect(typing).toContain(`* ${bold('10')} Bananas`); // faster typing: affordable, its number bold
    // and the whole row green, from its number to its price, with no colour inside
    expect(typing.startsWith('\x1b[32m') && typing.endsWith('\x1b[39m') && !/\x1b\[3\dm/.test(typing.slice(5, -5))).toBe(true);
    const hire = staff.split('\n').find((r) => r.includes('Hire a monkey'))!;
    expect(hire.startsWith('\x1b[2m') && plain(hire) === hire.slice(4, -5)).toBe(true); // a monkey: not yet, so the whole row is dim
    expect(plain(renderScreen(s, '', 'typewriters'))).not.toContain('* 25 Bananas'); // a letter: not yet
  });
});

describe('typewriter keys menu', () => {
  it('is locked in the shop until you own enough letters', () => {
    expect(plain(renderScreen(started(), '', 'typewriters'))).toContain('     Typewriter keys unlock when you own 13 letters.');
  });

  it('lists the keys you can buy and the words closest to unlocking', () => {
    const s = started();
    s.letters = 'ABDEGHILNORST'.split('');
    s.keys.push('TH');
    s.stats.words = { THE: 100, LORD: 40, NOR: 12 };
    expect(squash(renderScreen(s, '', 'typewriters'))).toContain('[3] Typewriter keys... letter combos and whole words');
    const text = plain(renderKeysMenu(s));
    expect(text).toContain(' Closest LORD 40/100   NOR 12/100');
    expect(text).toContain(' Owned  TH');
    expect(keyChoices(s)).not.toContain('TH');
    expect(keyChoices(s)).toContain('HE');
    expect(text).toMatch(/ \[1\] HE   combination    [\d,]+ Bananas/);
    expect(text).toMatch(/ \[2\] THE  word /);
    s.currency = s.sentences = 1e9;
    expect(renderKeysMenu(s)).toContain(`* ${bold('4,000,000')} Bananas`); // affordable: * and price, all green
    expect(plain(renderKeysMenu(s, '', 80)).split('\n').every((r) => r.length <= 80)).toBe(true);
  });
});

describe('word slots on screen', () => {
  it('bold the words a slot will type in pinned lines', () => {
    const s = started();
    s.slots = [
      { department: '', position: 3, word: 'NAME', on: true },
      { department: '', position: 1, word: 'BYE', on: true },
      { department: '', position: 5, word: 'HAMLET', on: false },
    ];
    expect(slotHighlight(s, 'Hello my name is Hamlet.', 'comedy')).toBe('Hello my \x1b[1mname\x1b[22m is Hamlet.');
    expect(slotHighlight(s, "O'er my name", 'comedy')).toBe("O'er my \x1b[1mname\x1b[22m");
  });

  it('lists slots with their position, word and switch', () => {
    const s = started();
    s.lines = 2;
    s.slots = [{ department: '', position: 3, word: 'FRIEND', on: true }];
    const text = plain(renderSlotsMenu(s, 'comedy', 0, null));
    expect(text).toContain('> [1] 3rd  word  FRIEND           ON');
    expect(shaded(renderSlotsMenu(s, 'comedy', 0, null))).toContain('> [1] 3rd'); // the selected slot is shaded
    expect(text).toContain(' [b] buy a slot   * 2 Lines');
    expect(renderSlotsMenu(s, 'comedy', 0, 'FRI')).toContain('word  FRI_');
    expect(ordinal(1) + ordinal(2) + ordinal(11) + ordinal(22)).toBe('1st2nd11th22nd');
  });
});

describe('statistics and dictionary', () => {
  it('shows totals, records, letter counts and the most spelled words', () => {
    const s = started();
    for (let i = 0; i < 3; i++) typeLetter(s, 0, () => 0);
    const text = plain(renderStats(s));
    expect(text).toContain(' INFINITE MONKEYS > STATS ');
    expect(text).toContain('   Letters typed      3\n');
    expect(text).toContain('   Words spelled      3   1 different');
    expect(text).toContain('   Longest word       I   1 letter\n');
    expect(text).toContain('   Longest line       "I."   Test Play 1.1, 1 letter\n');
    expect(text).toContain('   Scenes finished    1');
    expect(text).toContain('\n LETTERS TYPED\n   I 3\n');
    expect(text).toContain('    1. I           3');
    expect(renderStats(s)).toContain('\x1b[2m TYPING\x1b[22m'); // headings are dim
    s.stats.secondsOpen = 3600;
    s.stats.secondsAway = 7200;
    expect(plain(renderStats(s))).toMatch(/Time played +3h/);
    expect(plain(renderStats(s))).toMatch(/Game open +1h/);
    expect(plain(renderStats(s))).toMatch(/In the background +2h/);
  });

  it('shows Folios only once one is published', () => {
    const s = started();
    expect(plain(renderStats(s))).not.toContain('FOLIOS');
    s.folios = 1;
    s.folioPages = 12;
    expect(plain(renderStats(s))).toContain(' FOLIOS\n   Published          1\n   Pages              12');
  });

  it('lists letters by how often they were typed, most first', () => {
    const s = started();
    s.stats.letters = { A: 5, E: 90, I: 12, T: 12 };
    expect(plain(renderStats(s))).toContain('   E 90        I 12        T 12        A 5');
  });

  it('counts sentences and shows the longest one, wrapped under the values', () => {
    const s = started();
    const fresh = plain(renderStats(s));
    expect(fresh).not.toContain('Longest sentence'); // stats stay hidden until they happen
    expect(fresh).not.toContain('PLAYS');
    expect(fresh).toContain('Nothing yet');
    s.stats.sentencesWritten = 4;
    s.stats.chainSentences = 1;
    s.stats.longestSentence = Array.from({ length: 30 }, () => 'MONKEY');
    const text = plain(renderStats(s, 80));
    expect(text).toContain('   Sentences written  4   1 Sentence earned');
    expect(text).toContain('   Longest sentence   30 words\n                      MONKEY MONKEY');
    expect(text.split('\n').every((r) => r.length <= 80)).toBe(true);
  });

  it('lists every word spelled from A to Z with its count, and jumps to a letter', () => {
    const s = started();
    expect(renderDictionary(s, 0)).toContain('No words yet');
    s.stats.words = { ZAP: 1, CAT: 4, ALE: 2, MOO: 1, BEE: 3 };
    const text = plain(renderDictionary(s, 0));
    expect(text).toContain('5 words spelled');
    expect(text.split('\n')[4].trim().split(/\s{2,}/)).toEqual(['ALE 2', 'BEE 3', 'CAT 4', 'MOO 1']);
    expect(text.split('\n')[5]).toBe(' ZAP 1');
    expect(dictionaryRowFor(s, 'z')).toBe(1);
    expect(dictionaryRowFor(s, 'b')).toBe(0);
  });
});

describe('script contents', () => {
  it('lists every play, then one play\'s acts and scenes, with the cursor', () => {
    const s = started();
    s.owned = ['test:1.1'];
    s.completed.test = [0];
    const plays = squash(renderContents(s, null, 0));
    expect(plays).toContain(' INFINITE MONKEYS > CONTENTS ');
    expect(plays).toContain('\n PLAY GENRE WRITTEN SCENES OWNED\n > Test Play Comedies 1 / 2 1 / 2 \n');
    const scenes = squash(renderContents(s, 'test', 1));
    expect(scenes).toContain('\n ACT 1\n Scene 1 1 / 1 finished\n > Scene 2 not owned 1 line \n');
  });
});

describe('office space on screen', () => {
  it('stops hiring when there is no square for a desk, and points to the office map', () => {
    const s = started();
    s.monkeys.push(createMonkey(), createMonkey(), createMonkey());
    s.furniture.push({ kind: 'desk', room: 'r1', x: 1, y: 0 }, { kind: 'desk', room: 'r1', x: 0, y: 1 }, { kind: 'desk', room: 'r1', x: 1, y: 1 });
    s.currency = s.sentences = 1e30;
    const staff = renderScreen(s, '', 'staff');
    expect(squash(staff)).toContain('[2] Hire a monkey random stats and trait, you have 4 no room\n'); // no price: a desk is what it needs
    expect(plain(renderPostPopup(s, 'x', posts(s), -1, true).join('\n'))).toContain('desk needed');
    s.departments = ['comedy', 'tragedy'];
    expect(squash(renderPostPopup(s, 'x', posts(s), -1, true).map(plain).join('\n'))).toContain('[2] Tragedies (0/5) room needed');
  });

  it("shows one department's monkeys at a time on the home screen", () => {
    const s = started();
    s.departments = ['comedy', 'tragedy'];
    s.monkeys[0].name = 'Clown';
    s.monkeys.push({ ...createMonkey(), department: 'tragedy', name: 'Mourner' });
    const first = renderScreen(s);
    expect(first).toContain(bold(inverse(' [1] Comedies '))); // the shown department's tab
    expect(plain(first)).toContain('\n [1] Comedies  [2] Tragedies \n');
    expect(first).toContain('Clown');
    expect(first).not.toContain('Mourner');
    expect(plain(first)).toContain('[<>] department');
    s.settings.homeDepartment = 'tragedy';
    const second = renderScreen(s);
    expect(second).toContain(bold(inverse(' [2] Tragedies ')));
    expect(second).toContain('Mourner');
    expect(second).not.toContain('Clown');
    s.departments = ['comedy'];
    expect(plain(renderScreen(s))).not.toContain('[<>]'); // one department: no heading, no key
    // Managers first, then by seniority.
    s.monkeys.push({ ...createMonkey(), department: 'comedy', name: 'Junior', number: 3 }, { ...createMonkey(), department: 'comedy', name: 'Boss', number: 4, manager: true });
    s.monkeys[0].number = 1;
    expect(homeMonkeys(s).map((i) => s.monkeys[i].name)).toEqual(['Boss', 'Clown', 'Mourner', 'Junior']); // Mourner's department is closed, so it types for Comedies
  });

  it('lists a hire line for each department, all at one price', () => {
    const s = started();
    s.currency = s.sentences = 1e30;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    expect(squash(renderScreen(s, '', 'staff'))).toContain('[2] Hire a monkey random stats and trait, you have 1 * from 1,000,000 Bananas');
    const popup = squash(renderPostPopup(s, 'x', posts(s), -1, true).map(plain).join('\n'));
    expect(popup).toContain('[1] Comedies (1/5) * 1,000,000 Bananas');
    expect(popup).toContain('[2] Tragedies (0/5) * 1,000,000 Bananas');
  });

  it('draws the office on one grid: rooms, their desks and who sits at them', () => {
    const s = started();
    s.monkeys[0].name = 'Bobo';
    const text = plain(renderOffice(s));
    expect(text).toContain(' INFINITE MONKEYS > OFFICE ');
    expect(text).toContain('\n\n+-C-----+\n|[@]  . :\n|       |\n| .   . |\n+-------+');
    expect(squash(text)).toContain('\n C Comedies Department 4 none - Bobo\n');
    expect(text).toContain('[r] buy a room');
    expect(text).not.toContain('Each monkey gets a desk'); // how rooms work is on the [/] page
    expect(plain(renderOfficeHelp(s))).toContain("Each monkey gets a desk in its department's room.");
  });

  it('draws rooms of any shape, and the squares a room can grow into', () => {
    const s = started();
    s.office[0].cells.push([2, 0]);
    expect(plain(renderOffice(s))).toContain('+-C---------+\n|[@]  .   . |\n|       +---+\n| .   . |\n+-------+');
    const growing = plain(renderOffice(s, '', { x: 2, y: 1 }, -1, 'r1'));
    expect(growing).toContain('Growing the Comedies Department');
    expect(growing).toContain('>+<'); // the cursor on a square it can grow into
    expect(growing).toContain(' + ');
  });

  it('draws hallways and doors between rooms, and warns about a room with no way in', () => {
    const s = started();
    s.currency = s.sentences = 1e12;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    const text = plain(renderOffice(s));
    expect(text).toContain('/   /[@]'); // a door, a hallway square, a door into room 1
    expect(text).toContain(' T  Tragedies Department');
    s.doors = [];
    const locked = renderOffice(s).split('\n').find((r) => r.includes('NO WAY IN'))!;
    expect(locked.startsWith('\x1b[31m')).toBe(true); // in red
  });

  it("shows each department's lounge, and the departments each break room is the lounge of", () => {
    const s = started();
    s.currency = s.sentences = 1e12;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    buyRoom(s, 'break'); // against both, with a door into each
    s.furniture.push({ kind: 'tv', room: 'r3', x: s.office[2].cells[0][0], y: s.office[2].cells[0][1] });
    const text = squash(renderOffice(s));
    expect(text).toContain('\n # ROOM SIZE LOUNGE EFFECTS WHO\n');
    expect(text).toContain('\n C Comedies Department 4 Break room recovers 40% faster, +3% happy M-1\n');
    expect(text).toContain('\n T Tragedies Department 9 Break room recovers 40% faster, +3% happy\n');
    expect(text).toContain('\n B Break room 9 - - lounge of Comedies Department, Tragedies Department\n');
    // On a narrow screen who works in each room goes under it.
    const narrow = plain(renderOffice(s, '', null, -1, false, null, 80));
    expect(narrow).toContain(' #  ROOM                  SIZE  LOUNGE      EFFECTS\n');
    expect(narrow).toContain('\n B  Break room               9  -           -\n      lounge of Comedies Department, Tragedies Department\n');
    for (const row of narrow.split('\n')) expect(row.length).toBeLessThan(80);
  });

  it('places rooms to keep the map narrow enough for the terminal', () => {
    const s = started();
    s.currency = s.sentences = 1e30;
    for (let i = 0; i < 6; i++) buyRoom(s, 'break');
    s.monkeys[0].manager = true;
    const text = plain(renderOffice(s));
    expect(text).toContain('[@&');
    expect(text).toContain('Break room 6');
    const map = text.split('\n\n')[1];
    expect(map.split('\n').length).toBeGreaterThan(10);
    for (const line of map.split('\n')) expect(line.length).toBeLessThanOrEqual(officeMapWidth);
  });
});

describe('furniture', () => {
  it('sells every piece in one store; each works only in the rooms it is made for', () => {
    const s = started();
    s.sentences = 200;
    const text = squash(renderShop(s, 'furniture', -1, '', 0, false, undefined, true));
    expect(openStores(s, 'furniture', true)).toEqual(['furniture']); // one store on the office map
    expect(openStores(s, 'furniture')).toEqual(['typewriters', 'staff', 'hats']); // not in the main shop
    expect(text).not.toContain('Workroom');
    expect(text).toContain('Any piece can stand in any room.');
    expect(text).toContain(' ITEM EFFECT PRICE\n'); // no elements before the feng shui book
    expect(text).toMatch(/\[\d\] Potted plant P tire 3% slower, \+1% pay, manager 10% quicker in its office; works in departments' rooms, break rooms or managers' offices \* 100 Sentences\n/);
    expect(text).toContain('Bench (2x1)'); // break room furniture in the same store
    s.fengShuiBook = true;
    expect(squash(renderShop(s, 'furniture', -1, '', 0, false, undefined, true))).toContain(' ITEM ELEMENT EFFECT PRICE\n');
    s.fengShuiBook = false;
    expect(storeChoices(s, 'furniture', -1).map((x) => x.id)).toContain('furniture:plant');
    expect(storePages(s, 'hats')).toBe(1);
  });

  it('lets any piece stand in any room, its effects working only where it is made for', () => {
    const s = started();
    s.sentences = 1e9;
    const genre = s.departments[0] as Genre;
    expect(drainCut(s, genre)).toBe(0);
    expect(fitsAt(s, 'r1', 'tv', 1, 1)).toBe(true); // a break room piece fits in the department's room
    s.furniture.push({ kind: 'tv', room: 'r1', x: 1, y: 1 });
    expect(restBoost(s, genre)).toBe(0); // it does nothing there
    expect(plain(inspectSquare(s, 1, 1).text)).toContain('Here it only counts for feng shui: it works in break rooms.');
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    expect(drainCut(s, genre)).toBeGreaterThan(0); // decor works where monkeys type
  });

  it('sells only the whole play under the cursor in the script page\'s shop', () => {
    const s = started();
    s.currency = s.sentences = 1e9;
    const at = { play: 'test', line: 0 };
    expect(openStores(s, 'script')).toEqual(['script']);
    expect(storeChoices(s, 'script', 0, at).map((x) => x.id)).toEqual(['section:w']);
    expect(storeChoices(s, 'script', 0, at)[0].blocked).toBe('owned'); // the free first play
    const page = squash(renderScript(s, 'test', 0, '', 0, renderShop(s, 'script', 0, '', 0, true, at)));
    expect(page).toContain(' Script \n');
    expect(page).toContain('[1] The whole play');
    expect(page).not.toContain('[tab] contents'); // the shop takes the place of the keys
    expect(squash(renderScript(s, 'test', 0))).toContain('[space] shop');
  });

  it("opens the office map's furniture shop under the map", () => {
    const s = started();
    const map = plain(renderOffice(s));
    expect(map).toContain('[f] furniture');
    const shop = plain(renderOffice(s, '', null, -1, false, null, 0, renderShop(s, 'furniture', 0, '', 0, true, undefined, true)));
    expect(shop).not.toContain('Workroom'); // the office map's shop: one store of furniture
    expect(shop).toContain('Potted plant');
    expect(shop).not.toContain('[f] furniture'); // the shop takes the place of the room table and keys
    expect(shop.split('\n')[0]).toContain('OFFICE'); // a popup over the bottom of the map's screen
  });

  it('wraps an effect too long for the screen, keeping the price on its last row', () => {
    const s = started();
    s.sentences = 1e12;
    const text = plain(renderScreen(s, '', 'hats', 80));
    expect(text).toMatch(/\[9\] Halo +o@ \+50% pay, \+50% speed, tires 50% +\n +slower +\* 1.00e10 Sentences\n/);
  });

  it('fits every store on an 80-column screen, elements and all', () => {
    const s = started();
    s.fengShuiBook = true;
    s.currency = s.sentences = 1e12;
    s.sentences = 1e12;
    for (const store of stores)
      for (let page = 0; page < storePages(s, store); page++)
        for (const row of plain(renderScreen(s, '', store, 80, page)).split('\n')) expect(row).toHaveLength(Math.min(row.length, 79));
  });

  it('draws furniture, the cursor and a piece being moved', () => {
    const s = started();
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    expect(plain(renderOffice(s))).toContain('|[@]  P :');
    expect(plain(renderOffice(s, '', null, -1, false, null, 120, '', 0))).toContain('P potted plant');
    expect(plain(renderOffice(s, '', { x: 1, y: 0 }))).toContain('Cursor: Comedies Department, potted plant.');
    expect(plain(renderOffice(s, '', { x: 0, y: 1 }))).toContain('|>.<  . |');
    const moving = plain(renderOffice(s, '', { x: 1, y: 1 }, 1));
    expect(moving).toContain('|[@]  . :\n    |       |\n    | .  >P<|');
    expect(moving).toContain('Moving the potted plant.');
    expect(moving).toContain('[space] put it down   [i] inspect   [esc] cancel');
  });

  it('draws bigger pieces joined across their squares, and turned ones down', () => {
    const s = started();
    s.furniture.push({ kind: 'couch', room: 'r1', x: 0, y: 1 });
    expect(plain(renderOffice(s))).toContain('|[@]  . :\n|       |\n| C===C |');
    s.furniture.shift(); // no desk: room for the couch to stand 1 x 2
    s.furniture[0] = { kind: 'couch', room: 'r1', x: 1, y: 0, turned: true };
    expect(plain(renderOffice(s))).toContain('| .   C :\n|     | |\n| .   C |');
    const moving = plain(renderOffice(s, '', { x: 0, y: 0 }, 0));
    expect(moving).toContain('|>C<  . :\n    | |     |\n    | C   . |');
    expect(moving).toContain('Moving the couch (1 x 2 squares, from the top left).');
    expect(moving).toContain('[r] turn');
  });

  it('has an option to place furniture yourself', () => {
    const s = started();
    expect(squash(renderOptions(s))).toContain('[1] Furniture places itself ON');
    expect(shaded(renderOptions(s, 0, 1))).toContain(' [2] Light background');
    s.settings.autoPlaceFurniture = false;
    expect(squash(renderOptions(s))).toContain('[1] Furniture places itself off');
    expect(squash(renderOptions(s))).toContain('[2] Light background off');
    // On a light background the pale colours turn darker; the rest stay.
    expect(forLightBackground(`${yellow('Bananas')} ${cyan('Words')} ${green('*')} ${red('NO WAY IN')}`)).toBe(
      '\x1b[38;5;130mBananas\x1b[39m \x1b[38;5;30mWords\x1b[39m \x1b[38;5;28m*\x1b[39m \x1b[31mNO WAY IN\x1b[39m',
    );
    expect(plain(renderShop(s, 'furniture'))).toContain('New furniture opens the office map so you can place it.');
  });

});

describe('energy on screen', () => {
  it('shows each typist speed and energy, and Resting on a break', () => {
    const s = started();
    s.monkeys[0].energy = 0.5;
    expect(plain(renderScreen(s))).toMatch(/M-1 +0\.44\/s +50% +x1/);
    s.monkeys[0].energy = 0.25;
    s.monkeys[0].resting = true;
    expect(plain(renderScreen(s))).toMatch(/M-1 +0\.00\/s +Resting +x1/);
  });
});

describe('moving doors on the map', () => {
  it('shows a door being moved in the wall it would go in', () => {
    const s = started();
    s.currency = s.sentences = 1e12;
    buyRoom(s, 'break'); // a hallway square west of room 1, with a door into it at 0,0
    s.doors = s.doors.filter((d) => !(d.x === 0 && d.y === 0));
    const text = plain(renderOffice(s, '', { x: 0, y: 0 }, -1, false, 'w'));
    expect(text).toContain('/>@<');
    expect(text).toContain('Moving a door: the west wall of this square.');
    expect(text).toContain('[r] next wall');
  });
});

describe('inspecting', () => {
  it('describes store items, or finds nothing of interest', () => {
    expect(inspectItem('furniture:tv@break')).toBe('It only shows nature documentaries about monkeys. Electronics burn with Fire.');
    expect(inspectItem('hat:cowboy')).toBe('Yeehaw, but quietly: this is an office.');
    expect(inspectItem('combo')).toBe('Nothing of interest here.');
    expect(inspectItem(undefined)).toBe('Nothing of interest here.');
    expect(plain(renderShop(started(), 'furniture'))).toContain('[/] all keys'); // [i] inspect is among them
    expect(shopKeys(started(), 'furniture')).toContainEqual(['i', 'inspect']);
  });
});

describe('feng shui on screen', () => {
  it('draws windows, hides the book in a bookshelf, and once read shows each room\'s chi', () => {
    const s = started();
    s.windows = [{ x: 0, y: 1, side: 's' }, { x: 1, y: 0, side: 'e' }];
    const map = plain(renderOffice(s));
    expect(map).toContain('|[@]  . :'); // in a side wall
    expect(map).toContain('+===----+'); // in the bottom wall
    expect(plain(renderOffice(s, '', null, -1, false, null, 120, '', 0))).toContain('=== : window');
    expect(map).not.toContain('chi');
    expect(plain(renderShop(s, 'furniture'))).not.toContain('Feng shui book'); // not for sale: it hides in a bookshelf
    s.furniture.push({ kind: 'bookshelf', room: 'r1', x: 1, y: 1 });
    const shelf = inspectSquare(s, 1, 1);
    expect(shelf.text).toContain('Rows of dusty old books.');
    expect(shelf.text).toContain('Tucked behind the other books is a slim volume');
    expect(shelf.choices).toContain('[y] read it'); // in a popup
    expect(shelf.book).toBe(1);
    expect(inspectSquare(s, 1, 0, 1).book).toBe(1); // held, it can be inspected too
    expect(inspectSquare(s, 0, 0).text).toBe("M-1's desk. A desk and a typewriter. Typewriters are mostly Metal, and so, some say, are good monkeys.");
    expect(inspectSquare(s, 1, 0).text).toBe('A window. Every room wants light, though sunlight is no substitute for a real flame.');
    expect(inspectSquare(s, 0, 2)).toEqual({ text: 'Nothing of interest here.', book: -1 });
    expect(inspectSquare(s, 9, 9).text).toBe('Nothing of interest here.');
    s.fengShuiBook = true;
    s.managerBook = true;
    const library = inspectSquare(s, 1, 1); // every bookshelf keeps the books found so far
    expect(library.choices).toEqual(['[1] The Way of the Typewriter: feng shui for monkeys', '[2] Understanding Your Employees: a field guide for managers of monkeys']);
    expect(library).toMatchObject({ book: 1, shelf: true });
    s.managerBook = false;
    s.furniture.pop();
    const read = plain(renderOffice(s));
    expect(squash(read)).toContain(' # ROOM SIZE CHI LOUNGE EFFECTS WHO\n C Comedies Department 4 80% ');
    expect(plain(renderOfficeHelp(s))).toContain('[b]       book'); // every key is on the help page
    expect(read).toContain('[/] all keys and help');
    const book = plain(renderFengShuiBook(s));
    expect(book).toContain('  Light    a window.');
    expect(book).toContain('  Metal   desk, wall clock, floor lamp, mirror, brass gong, espresso machine, vending machine');
    expect(book).toContain('  Fire    scented candle, fireplace, television');
    expect(book).toContain('  Variety  every different piece in them adds +3% pay and break speed. Repeats cost nothing.');
    expect(book).toMatch(/C Comedies Department +chi  80% +3 empty +lacks Balance/);
    expect(book).toContain('Office chi 80%: +48% happiness.');
  });
});

describe('managers and traits on screen', () => {
  /** A department of five typists with an office next door, before any manager. */
  const staffed = () => {
    const s = started();
    s.currency = s.sentences = 1e15;
    s.office[0].cells.push([0, 2], [1, 2], [0, 3], [1, 3]);
    for (let k = 1; k < 5; k++) {
      s.monkeys.push({ ...createMonkey(), department: 'comedy' });
      s.furniture.push({ kind: 'desk', room: 'r1', x: k % 2, y: 1 + Math.floor((k - 1) / 2) });
    }
    s.monkeys.forEach((m, i) => (m.trait = i === 0 ? 'perfectionist' : 'greenthumb'));
    return s;
  };

  it("sells a manager once there's an office, says what's missing until then, and puts the manager at the manager's desk", () => {
    const s = staffed();
    const popup = () => squash(renderPostPopup(s, 'x', posts(s), -1, true).map(plain).join('\n'));
    expect(popup()).toContain('[2] Comedies manager (0/1) office needed');
    expect(buyRoom(s, 'office', 'comedy')).toBe(true);
    expect(popup()).toMatch(/\[2\] Comedies manager \(0\/1\) \* [\d,]+ Bananas/);
    const map = plain(renderOffice(s));
    expect(map).toContain(' D ');
    expect(squash(map)).toContain('CO Comedies Office 4 - - no manager yet');
    expect(hireManager(s, 'comedy')).toBe(true);
    const hired = squash(plain(renderOffice(s)));
    expect(hired).toContain('CO Comedies Office 4 - a slot every 30.0s M-6 (manager)');
    expect(hired).not.toMatch(/Comedies Department[^\n]*M-6/);
    const office = Array.from({ length: storePages(s, 'furniture') }, (_, page) => plain(renderShop(s, 'furniture', page * storePageSize))).join('\n');
    expect(office).toContain("Manager's desk"); // a spare, in case one's needed
    expect(squash(office)).toContain('Potted plant'); // decor for the office: it makes the manager quicker
    expect(office).toContain('Couch'); // one store: any piece can go in any room
  });

  it("hides the manager's book in the manager's desk; once read, traits show on the home screen, on desks and in the book", () => {
    const s = staffed();
    buyRoom(s, 'office', 'comedy');
    const i = s.furniture.findIndex((f) => f.kind === 'managerdesk');
    const { x, y } = s.furniture[i];
    const desk = inspectSquare(s, x, y);
    expect(desk.text).toContain('Understanding Your Employees');
    expect(desk.choices).toContain('[y] read it');
    expect(desk.book).toBe(i);
    expect(plain(renderScreen(s))).not.toContain('TRAIT');
    expect(inspectSquare(s, 0, 0).text).not.toContain('perfectionist');
    s.managerBook = true;
    const home = plain(renderScreen(s, '', null, 100));
    expect(home).toContain('TRAIT');
    expect(home).toContain('Perfectionist');
    expect(inspectSquare(s, 0, 0).text).toContain('M-1 is a perfectionist (-10% speed, +20% pay).');
    expect(inspectSquare(s, x, y).choices ?? []).not.toContain('[y] read it');
    expect(officeKeys(s)).toContainEqual(['e', 'employees']);
    const book = plain(renderManagerBook(s));
    expect(book).toContain('Night owl');
    expect(book).toMatch(/M-2 +Green thumb +no effect right now/);
    for (const row of plain(renderScreen(s, '', null, 80)).split('\n')) expect(row.length).toBeLessThan(80);
  });
});

describe('hats on screen', () => {
  it('lists only unlocked hats, with a note on the next one', () => {
    withUnlocks(() => {
      const s = started();
      const store = squash(plain(renderScreen(s, '', 'hats')));
      expect(store).toContain('Baseball cap');
      expect(store).not.toContain('] Beanie');
      expect(store).toContain('7 more unlock as you finish scenes, acts and whole texts. Next: Beanie, finish 1 scene more.');
    });
  });

  it('sells hats and dye, and shows each monkey in its hat', () => {
    const s = started();
    s.sentences = 1600;
    const store = plain(renderScreen(s, '', 'hats'));
    expect(squash(store)).toContain('[2] Baseball cap d@ tires 10% slower * 1,000 Sentences\n');
    expect(store).toContain('Crown         W@');
    expect(store).toContain('Dye');
    expect(plain(renderScreen(s))).toContain('  @ M-1 ');
    s.monkeys[0].hat = 'tophat';
    expect(plain(renderScreen(s))).toContain(' #@ M-1 '); // a hat changes the icon
    expect(plain(renderOffice(s))).toContain('|#@]  . :'); // on the map too
    expect(plain(renderOffice(s, '', { x: 0, y: 0 }))).toContain('|>@<  . :');
    s.monkeys[0].hatColor = 'red';
    expect(renderScreen(s)).toContain('\x1b[31m#\x1b[39m@ M-1'); // a dyed hat shows in its colour
    expect(renderOffice(s)).toContain('|\x1b[31m#\x1b[39m@]');
    s.monkeys.push(createMonkey());
    const top = hatPick(s, 'tophat');
    expect(plain(top.title)).toBe('Top hat (50,000 Sentences): which monkey gets a new one?');
    expect(top.notes).toEqual(['wearing it: takes it off', '']);
    const menu = plain(renderMonkeyPicker(s, top.title, top.notes, 1));
    expect(menu).toContain(' [1]  #@ M-1  wearing it: takes it off');
    expect(menu).toContain('[enter] give');
    expect(shaded(renderMonkeyPicker(s, top.title, top.notes, 1))).toContain(' [2]   @ M-2  '); // the cursor's monkey
    s.monkeys[0].hat = 'cap';
    expect(hatPick(s, 'crown').notes[0]).toBe('swaps its thinking cap (into your inventory)');
    s.stored.hats = { tophat: 1 };
    expect(plain(hatPick(s, 'tophat').title)).toMatch(/^Top hat \(\d.* Sentences\): which monkey gets a new one\?$/); // the store sells new ones at full price
    expect(squash(renderShop(s, 'hats'))).toContain('Top hat (1)');
    expect(plain(dyeColorPrompt())).toContain('[1] Red   [2] Green');
    expect(plain(dyePick(s, 'red').title)).toBe("Red (150 Sentences): which monkey's hat?");
    expect(dyePick(s, 'red').notes).toEqual(['already', 'no hat']);
    expect(plain(dyePick(s, '').title)).toContain('Undyed (free)');
  });

  it('shows the inventory: each monkey with its typewriter and hat, then your hats and furniture', () => {
    const s = started();
    s.monkeys[0].hat = 'cap';
    s.stored.hats = { crown: 1, 'tophat:red': 1 };
    s.stored.furniture = { plant: 2 };
    expect(inventoryRows(s).map((r) => r.items.length)).toEqual([2, 2, 1]);
    const text = plain(renderInventory(s, 0, 1, null));
    expect(text).toContain('M-1');
    expect(text).toContain('Rusty');
    expect(text).toContain('^ Thinking cap');
    expect(text).toContain('YOUR INVENTORY');
    expect(text).toMatch(/Hats +# red top hat   W Crown/); // in shop order, dyed ones by colour
    expect(text).toMatch(/Furniture +Potted plant x2/);
    expect(renderInventory(s, 0, 1, null)).toContain(highlight('^ Thinking cap'));
    expect(plain(renderInventory(s, 1, 0, { who: 0, item: { kind: 'hat', key: 'cap' } }))).toContain('Moving: Thinking cap from M-1');
  });
});

describe('achievements on screen', () => {
  it('lists every achievement, marks unlocked ones, shows progress and hides secrets', () => {
    const s = started();
    s.stats.pets = 37;
    s.achievements = ['first-pet'];
    const text = plain(renderAchievements(s, 0));
    expect(text).toContain(`1 of ${achievements.length} unlocked`);
    expect(plain(renderAchievements(s, 2))).toMatch(/\[x\] Good monkey +Pet a monkey/);
    expect(plain(renderAchievements(s, 5))).toMatch(/\[ \] Best friends +Pet the monkeys 100 times   37 \/ 100/);
    expect(renderAchievements(s, 2)).toContain('\x1b[32m[x]\x1b[39m'); // unlocked: a green mark
    const last = plain(renderAchievements(s, 999));
    expect(last).toMatch(/\[ \] \?\?\? +A secret/);
    expect(last.split('\n').slice(1).join('\n')).not.toContain('MONKEY'); // past the title bar
    s.achievements.push('word-monkey');
    expect(plain(renderAchievements(s, 999))).toContain('Self-aware');
  });

  it('shows a heart by a monkey petted lately', () => {
    const s = started();
    expect(plain(renderScreen(s))).not.toContain('<3');
    poke(s);
    expect(plain(renderScreen(s))).toContain('M-1         <3');
  });
});

describe('publishing a Folio on screen', () => {
  it('offers it once a play is finished, and shows the bonus after', () => {
    const s = started();
    expect(plain(renderScreen(s))).not.toContain('publish a Folio');
    s.completed = { test: [0, 1] };
    s.playsDone = ['test'];
    const text = plain(renderScreen(s));
    expect(text).toContain('* You can publish a Folio: [f] start over with 4 more pages, bananas x1.00 for good.');
    expect(text).toContain('[f] publish a Folio');
    expect(folioPrompt(s)).toContain('bananas x1.00 for good (each Folio multiplies the last). Press y to publish');
    s.folios = 1;
    s.folioPages = 500;
    s.folioBoost = 1.5;
    expect(plain(renderScreen(s))).toContain('Folio bananas x1.50 (1 Folio published)');
  });
});

// Unicode is allowed but ASCII is preferred, so the game runs in any terminal.
// A screen may use only the non-ASCII characters listed here; add one when
// the game starts printing it (Justin, 2026-10-14: "lets allow unicode then").
// Greek, only for the foreign texts and their department (Justin, 2026-10-14: "lets allow unicode then").
const greek = new Set([...greekLetters, ...['metaphysics-1-4', 'generatione'].flatMap((id) => (JSON.parse(readFileSync(`data/plays/${id}.json`, 'utf8')) as PlayData).lines.map((l) => l[3]))].join(''));
const allowedUnicode = [...greek].join('');

describe('plain ASCII', () => {
  it('prints only ASCII (plus ANSI codes and the allowed Unicode), so the game runs in any terminal', () => {
    const s = started();
    s.currency = s.sentences = 1e12;
    s.monkeys[0].hat = 'tophat';
    s.monkeys[0].hatColor = 'blue';
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    const screens = [
      ...stores.map((store) => renderScreen(s, '', store)),
      renderOffice(s, '', { x: 0, y: 0 }, -1, true),
      renderOfficeHelp(s),
      renderFengShuiBook(s),
      renderManagerBook(s),
      renderRoster(s, 0),
      renderOptions(s),
      renderKeysMenu(s),
      renderStats(s),
      renderDictionary(s, 0),
      renderAchievements(s, 0),
      renderTelegrams({ ...s, telegrams: [{ key: { rotors: [0, 1, 2], start: 'AAA', plugs: 'ABCD' }, tested: 1, keyAt: 1, read: true }, { key: { rotors: [3, 4, 0], start: 'QEV', plugs: '' }, tested: 0, keyAt: 9, read: false }] }),
      renderCoinFlip(s, true, ''),
    ];
    for (const text of screens) expect([...plain(text)].filter((c) => c > '\x7f' && !allowedUnicode.includes(c))).toEqual([]);
  });
});


describe('furniture colours', () => {
  it('give every piece but the desk a colour from its looks, drawn on the map', async () => {
    const { furnitureKinds } = await import('../src/game/config');
    expect(furnitureKinds.filter((k) => !k.color)).toEqual([]);
    const s = started();
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 1 });
    expect(renderOffice(s)).toContain(green(' P '));
  });
});

describe('hiring screen', () => {
  it('lists candidates with their stats and lowest prices, and someone unseen at the usual price', () => {
    const s = started();
    s.candidates = [{ trait: 'loner', speedStat: 1.1, stamina: 0.9, jobs: { typing: 'loves', managing: 'fine', hr: 'fine', research: 'fine' }, tempLeft: 0 }];
    s.candidatesIn = 600;
    const text = plain(renderCandidates(s, '', 80));
    expect(text).toContain('HIRING A MONKEY');
    expect(squash(text)).toContain(`[1] 110% 90% loves typing ? for good ${squash(plain(formatPrice(cheapestHire(s, 0))))}`);
    expect(squash(text)).toContain(`[0] someone unseen: random stats and trait from ${formatPrice(cheapestHire(s))} Bananas`);
    expect(text).toContain('New candidates in 10m');
    s.managerBook = true;
    expect(plain(renderCandidates(s))).toContain('Loner');
    expect(text.split('\n').every((r) => r.length <= 80)).toBe(true);
  });
});

describe('the department popup', () => {
  it('lists every department with its count and its price for the monkey, blocked ones in red', () => {
    const s = started();
    s.currency = 1e12;
    const box = renderPostPopup(s, 'Which department gets the new monkey?', posts(s), -1, true).map(plain);
    expect(box[0]).toMatch(/^\+-+\+$/);
    expect(box.join('\n')).toContain('| Which department gets the new monkey?');
    expect(squash(box.join('\n'))).toContain(`[1] Comedies (1/5) * ${formatPrice(postCost(s, posts(s)[0]))} Bananas`);
    expect(new Set(box.map((r) => r.length)).size).toBe(1); // a neat box
    const screen = overlay('a\nb\nc\nd', box, 80).split('\n');
    expect(screen.slice(0, 2)).toEqual(['a', 'b']);
    expect(screen[2].trim()).toBe(box[0]);
  });
});

describe('balances in full', () => {
  it('shows up to 10 digits with commas, then scientific notation, and shortens the biggest when the title bar is too wide', () => {
    expect(formatAmount(1234567890)).toBe('1,234,567,890');
    expect(formatAmount(12345678901)).toBe('1.23e10');
    expect(formatAmount(12.7)).toBe('12');
    const s = startedGame(0);
    s.currency = 1234567890;
    expect(plain(titleBar(s))).toContain('1,234,567,890 Bananas');
    s.sentences = 9876543210;
    s.words = s.lines = 1111111111;
    const bar = plain(titleBar(s, 'Shop', 80));
    expect(bar.length).toBeLessThan(80);
    expect(bar).toContain('9.88e9 Sentences'); // the biggest went short first
  });
});

describe('screen position', () => {
  it('sits at the bottom of the terminal by default, at the top with the option, and from the top when too tall', () => {
    expect(placeScreen('a\nb', 5, false)).toBe('\n\n\na\nb');
    expect(placeScreen('a\nb', 5, true)).toBe('a\nb\n');
    expect(placeScreen('a\nb\nc', 2, false)).toBe('a\nb\nc\n');
    expect(startedGame(0).settings.screenAtTop).toBe(false);
    expect(squash(renderOptions(startedGame(0)))).toContain('[4] Screen at the top off');
  });
});

describe('coin flip any time', () => {
  it('has a [?] button on every title bar while it fits, and its own screen', () => {
    const s = started();
    s.currency = 500;
    expect(plain(titleBar(s, 'Shop', 120))).toMatch(/\[\?\] coin flip$/);
    expect(plain(titleBar(s, 'Shop', 80)).length).toBeLessThan(80);
    s.currency = s.sentences = 1e9;
    expect(plain(titleBar(s, 'Typewriter keys', 80))).not.toContain('[?]'); // too tight: totals stay in full instead
    const ask = plain(renderCoinFlip(s, true, '', 80));
    expect(ask).toContain('COIN FLIP');
    expect(ask).toContain('1,000,000,000 Bananas on a coin flip?');
    expect(ask).toContain('[y] flip');
    expect(plain(renderCoinFlip(s, false, 'Heads!', 80))).toContain('[?] flip again');
  });
});

describe('scrolling lists', () => {
  it('mark what is above and below the part shown, and nothing when the list fits', () => {
    expect(scrollMarks(0, 0)).toEqual([[], []]);
    const [above, below] = scrollMarks(0, 12, 'more lines');
    expect(above).toEqual(['']);
    expect(plain(below[0])).toBe(' v 12 more lines below');
    expect(plain(scrollMarks(3, 0)[0][0])).toBe(' ^ 3 more above');
  });

  it('sit right under the last item of a shop page, above its notes', () => {
    const s = started();
    const rows = plain(renderShop(s, 'furniture', 0)).split('\n');
    const below = rows.findIndex((r) => / more items below$/.test(r));
    expect(below).toBeGreaterThan(0);
    expect(rows[below - 1]).toMatch(/^ \[9\]/);
  });

  it('show on the script when a play runs past the screen', () => {
    setPlays([{ id: 'long', title: 'Long', lines: Array.from({ length: 40 }, (_, i) => [1, 1, 'A', `Line ${i}.`] as [number, number, string, string]) }]);
    const s = startedGame(0);
    const text = plain(renderScript(s, 'long', 20, '', 80));
    expect(text).toMatch(/\^ \d+ lines above/);
    expect(text).toMatch(/v \d+ lines below/);
  });
});


describe('pickers', () => {
  it('lists the inventory hats for a hat spot, with no hat last, and the stored furniture that fits a room', async () => {
    const { renderHatPicker, hatChoices } = await import('../src/cli/inventory');
    const { renderFurniturePicker } = await import('../src/cli/office');
    const { storedFitting, placeStoredFurniture } = await import('../src/game/logic');
    const s = startedGame(0);
    s.stored.hats = { tophat: 2 };
    expect(hatChoices(s, 0)).toEqual(['tophat', '']);
    const box = renderHatPicker(s, 0, 0).join('\n').replace(/\x1b\[[\d;]+m/g, '');
    expect(box).toContain('[1]');
    expect(box).toContain('x2');
    expect(box).toContain('[2]');
    expect(box).toContain('no hat');
    const room = s.office[0].id;
    s.stored.furniture = { plant: 1 };
    expect(storedFitting(s, room)).toEqual(['plant']);
    expect(renderFurniturePicker(s, room, -1).join('\n')).toContain('Potted plant');
    expect(placeStoredFurniture(s, 'plant', room)).toBe(true);
    expect(s.furniture.at(-1)?.room).toBe(room);
    expect(storedFitting(s, room)).toEqual([]);
  });
});

describe('the office legend', () => {
  it('labels rooms by letter (two where they share one) and lights up the chosen item on the map', async () => {
    const { roomLabels, legendSize } = await import('../src/cli/office');
    const s = started();
    buyRoom(s, 'break');
    buyRoom(s, 'break');
    const labels = [...roomLabels(s).values()];
    expect(labels[0]).toBe('C');
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.slice(1).every((l) => l.length === 2 && l[0] === 'B')).toBe(true);
    const closed = plain(renderOffice(s, '', null, -1, false, null, 120));
    expect(closed).not.toContain('free desk');
    expect(officeKeys(s)).toContainEqual(['l', 'legend']);
    const open = renderOffice(s, '', null, -1, false, null, 120, '', 0);
    expect(plain(open)).toContain('C Comedies Department');
    expect(plain(open)).toContain('[ ] free desk');
    expect(open).toContain('\x1b[7m . '); // the room's floor, lit
    expect(legendSize(s)).toBeGreaterThan(6);
  });
});

describe('home department tabs', () => {
  it('show only typing departments, even with staff hired', async () => {
    const { homeViews, homeView } = await import('../src/cli/screen');
    const s = started();
    s.monkeys.push({ ...createMonkey(), department: 'marketing' });
    s.researchOpen = true;
    s.settings.homeDepartment = 'marketing';
    expect(homeViews(s)).toEqual(['comedy']);
    expect(homeView(s)).toBe('comedy');
    expect(rosterOrder(s)).toHaveLength(2);
  });
});

describe('monkey table columns', () => {
  it('keeps every speed within the SPEED column, so the columns after it never move', () => {
    for (const n of [1.5, 99.9, 999.9, 1234, 12345, 123456, 1.2e7, 9.99e8, 1e15, 1e70]) expect(speedText(n).length).toBeLessThanOrEqual(8);
    expect(speedText(123456)).toBe('123.4K/s');
    expect(speedText(1.5)).toBe('1.50/s');
  });
});

describe('page menu and tabs', () => {
  it('puts a [tab] menu button on every title bar', () => {
    expect(plain(titleBar(started(), 'Shop', 120))).toContain('[tab] menu   [?] coin flip');
    expect(plain(titleBar(started(), 'Home', 140))).toMatch(/\[\?\] coin flip \d+\.\d%$/); // its chance on the home screen
    expect(plain(titleBar(started(), 'Shop', 70))).toContain('[tab]');
  });

  it('shows tabs only on pages that have them, the open one lit, each clickable', () => {
    expect(pageTabsRow('home')).toEqual([]);
    const records = pageTabsRow('records', 'achievements');
    expect(plain(records[0])).toContain('[Statistics] [Achievements] [Dictionary]');
    expect(records[0]).toContain(bold(inverse('[Achievements]')));
    expect(labelPress('Inventory')).toEqual({ str: undefined, name: 'page:inventory' });
    expect(labelPress('tab')).toEqual({ str: '\t', name: 'tab' });
  });
});

describe('key popups', () => {
  it("lists a page's keys, and the roster's actions, each pressable", () => {
    const box = keyBox('M-1', rosterActions, 0).map(plain);
    expect(box[1]).toContain('M-1');
    expect(box.some((r) => r.includes('[n] Rename'))).toBe(true);
    expect(box.some((r) => r.includes('[f] Fire'))).toBe(true);
    expect(box.some((r) => r.includes('[enter] do it   [esc] close'))).toBe(true);
    expect(rosterKeys).toContainEqual(['enter', 'actions']);
    expect(plain(renderRoster(started(), 0))).toContain('[up/down] choose a monkey   [enter] actions   [esc] back   [/] all keys');
  });
});

describe('upgrade popups', () => {
  it('shows typists and managers in columns by department, the chosen one lit', () => {
    const s = started();
    s.departments = ['comedy', 'tragedy'];
    Object.assign(s.monkeys[0], { name: 'Clown', department: 'comedy' });
    s.monkeys.push({ ...createMonkey(), department: 'comedy', name: 'Fool' }, { ...createMonkey(), department: 'tragedy', name: 'Mourner' }, { ...createMonkey(), department: 'tragedy', name: 'Boss', manager: true });
    const typists = upgradeColumns(s, 'skill');
    expect(typists.cols.map((c) => c.heading)).toEqual(['Comedies', 'Tragedies']);
    expect(typists.monkeys).toEqual([[0, 1], [2]]);
    const box = columnBox('Faster typing for which monkey?', typists.cols, { col: 1, row: 0 }, '[esc] done', 100).map(plain);
    expect(box[3]).toMatch(/Comedies +Tragedies/);
    expect(box[4]).toMatch(/Clown +skill 0\/10 +10 Bananas +Mourner/);
    expect(box[5]).toContain('Fool');
    expect(columnBox('x', typists.cols, { col: 1, row: 0 }, '', 100).join('\n')).toContain(`\x1b[48;5;236m${typists.cols[1].cells[0][0]}`); // the chosen monkey
    const managers = upgradeColumns(s, 'manager');
    expect(managers.cols.map((c) => c.heading)).toEqual(['Tragedies']);
    expect(plain(managers.cols[0].cells[0].join('\n'))).toMatch(/Boss\nbananas x1.0 -> x1.3/);
  });
});

describe('picker popups', () => {
  it('shows a picker prompt as a vertical popup, one choice per row', () => {
    const box = promptBox('Buy a room (100 Sentences): [1] a room for Comedies   [b] a break room for furniture   (any other key cancels)', 1).map(plain);
    expect(box[1]).toContain('Buy a room (100 Sentences):');
    expect(box[3]).toContain('[1] a room for Comedies');
    expect(box[4]).toContain('[b] a break room for furniture');
    expect(box.join('\n')).not.toContain('any other key');
  });
});

describe('screen height', () => {
  it('pads a screen to the game\'s height, above the keys or a popup over the bottom, so no line moves', () => {
    expect(fillHeight(`T\n b\n ${'-'.repeat(30)}\n [q] quit`, 7).split('\n')).toEqual(['T', ' b', '', '', '', ` ${'-'.repeat(30)}`, ' [q] quit']);
    expect(fillHeight(`T\n b\n ${'='.repeat(30)}\n shop\n ${'-'.repeat(30)}\n keys`, 8).split('\n')[4]).toBe(` ${'='.repeat(30)}`);
    expect(fillHeight('a\nb\nc', 3)).toBe('a\nb\nc'); // tall enough already
  });
});

describe('shop height', () => {
  it('is the same on every tab, so the top of the shop stays put', () => {
    const s = started();
    const heights = openStores(s).map((x) => renderShop(s, x, -1, '', 100, true).split('\n').length);
    expect(new Set(heights).size).toBe(1);
  });
});

describe('terminal background', () => {
  it("reads the terminal's answer about its background out of the input", () => {
    expect(terminalBackground('\x1b]11;rgb:ffff/ffff/ffff\x07a')).toEqual({ light: true, rest: 'a' });
    expect(terminalBackground('b\x1b]11;rgb:1e1e/1e1e/1e1e\x1b\\')).toEqual({ light: false, rest: 'b' });
    expect(terminalBackground('abc')).toEqual({ rest: 'abc' });
    expect(lightShade(highlight('x'))).toContain('\x1b[48;5;255m');
  });
});
