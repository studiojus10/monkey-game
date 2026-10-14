import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStorage } from '../src/cli/fileStorage';
import {
  keyChoices,
  letterPickPrompt,
  maxMonkeyLines,
  renderKeysMenu,
  renderLine,
  folioPrompt,
  lineRoom,
  renderScreen,
  ordinal,
  renderScript,
  renderContents,
  renderSlotsMenu,
  renderOptions,
  hatPickPrompt,
  inspectItem,
  dyeColorPrompt,
  dyePickPrompt,
  slotHighlight,
  stores,
  storeChoices,
  storePages,
  renderHomeKeys,
} from '../src/cli/screen';
import { bold, cyan, forLightBackground, green, inverse, red, yellow } from '../src/cli/style';
import { inspectSquare, officeMapWidth, renderOffice, renderOfficeHelp, renderFengShuiBook, renderManagerBook } from '../src/cli/office';
import { dictionaryRowFor, renderAchievements, renderDictionary, renderStats } from '../src/cli/stats';
import { achievements } from '../src/game/config';
import { poke, typeLetter, buyRoom, hireManager, chooseFirstLetter, chooseStarterScene, renameMonkey, setPlays, togglePin, openDepartment } from '../src/game/logic';
import { load, save } from '../src/game/save';
import { createInitialState, createMonkey } from '../src/game/state';

describe('file storage', () => {
  it('saves and loads through a file, and clears it', () => {
    const storage = fileStorage(join(mkdtempSync(join(tmpdir(), 'idle-')), 'nested', 'save.json'));
    expect(storage.read()).toBeNull();
    const s = createInitialState(0);
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

/** Drops ANSI styling (bold prices and counters) so layout can be checked as plain text. */
const plain = (text: string) => text.replace(/\x1b\[\d+m/g, '');
/** Plain text with each run of spaces as one, for checking shop rows whatever their column widths. */
const squash = (text: string) => plain(text).replace(/ +/g, ' ');

/** A state past the opening choices: the test play and the letter I. */
function started() {
  setPlays([testPlay]);
  const s = createInitialState(0);
  s.departments = ['comedy'];
  s.owned = ['test'];
  chooseFirstLetter(s, 'i');
  return s;
}

describe('terminal screen', () => {
  it('asks for a genre first, then a free scene, then the first letter', () => {
    setPlays([testPlay]);
    const s = createInitialState(0);
    const genres = plain(renderScreen(s, '', null, 80));
    expect(genres.split('\n')[0]).toBe(' INFINITE MONKEYS ');
    expect(genres).toContain('   [1] Comedies   Test Play');
    expect(genres).toContain(' [1] choose   [q] quit');
    openDepartment(s, 'comedy');
    expect(plain(renderScreen(s))).toContain('   [1] Test Play, Act 1, scene 1   1 line');
    chooseStarterScene(s, 'test', '1.1');
    const text = plain(renderScreen(s));
    expect(text).toContain('   [a] A\n   [i] I\n');
    expect(text).toContain(' [a/i] choose   [q] quit');
    expect(text).not.toContain('Bananas');
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
      '\x1b[1m\x1b[7m INFINITE MONKEYS \x1b[27m\x1b[22m    \x1b[1m\x1b[33m1.23K Bananas\x1b[39m\x1b[22m   \x1b[1m\x1b[36m0 Words\x1b[39m\x1b[22m   ' +
        '\x1b[1m\x1b[35m0 Sentences\x1b[39m\x1b[22m   \x1b[1m\x1b[34m0 Lines\x1b[39m\x1b[22m',
    );
    expect(plain(text)).toContain(' Letters  _ _ _ _ _ _ _ _ I _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _   (1 of 26)'); // the alphabet, owned letters in their places
    expect(plain(text)).toContain(' Script   0 / 2 lines written   2 scenes owned');
    const rows = plain(text).split('\n');
    expect(rows[2]).toBe(' MONKEY                SPEED   ENERGY  COMBO  TYPING');
    expect(rows[3]).toBe('  @ M-1               0.50/s     100%     x1  I_');
    expect(plain(text)).toContain('Last word: I +1');
    expect(text).toContain(bold('hello')); // the newest message, under LATELY
    expect(plain(text)).toContain('[q] quit');
    // The shop is its own screen, its items in columns with prices on the right.
    expect(shop).toContain(' INFINITE MONKEYS > SHOP ');
    expect(shop).toContain(' hello'); // messages still show
    expect(shop).toContain('[1] Faster typing M-1: 0.50 -> 0.63/s, skill 0/10 * 10 Bananas\n');
    expect(tools).toContain('[2] Portable typewriter M-1: skill cap 10 -> 20 * 1.00K Bananas\n');
    expect(tools).toContain('[1] Buy a letter key you choose it (25 left) * 25 Bananas\n'); // the 2nd letter costs no Words
    s.letters.push('A');
    expect(squash(renderScreen(s, '', 'typewriters'))).toContain('[1] Buy a letter key you choose it (24 left) 75 Bananas + 1 Words\n');
    expect(shop).toContain('[2] Hire a monkey you have 1 300.00K Bananas\n');
    expect(shop).toContain('[3] Raise combo cap x3 -> x4 1 Sentences\n');
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

  it('lists every key on the [?] page', () => {
    const s = started();
    const keys = plain(renderHomeKeys(s));
    for (const k of ['[space]', '[p]', '[o]', '[t]', '[a]', '[w]', '[c]', '[enter]', '[n]', '[d]', '[s]', '[r]', '[`]', '[q]']) expect(keys).toContain(k);
    expect(plain(renderScreen(s))).not.toContain('[`]'); // the home screen keeps to the everyday keys
  });

  it('keeps the shop closed until space opens it', () => {
    const s = started();
    const closed = plain(renderScreen(s));
    expect(closed).not.toContain('Faster typing');
    expect(closed).toContain('[space] shop   [p] script   [o] office');
    expect(closed).toContain('[enter] pet the monkey   [n] name');
    const open = plain(renderScreen(s, '', 'staff'));
    expect(open).toContain('Faster typing');
    expect(open).toContain('[1-9] buy   [i] inspect   [left/right] store   [esc] back');
    expect(open).not.toContain('[tab]');
    expect(open).not.toContain('SPEED'); // the shop takes the whole screen
    expect(open).toContain('\n Typewriters   Staff   Script   Research   Office   Breakroom   Hats \n');
    expect(renderScreen(s, '', 'staff')).toContain(bold(inverse(' Staff '))); // the open store
    s.currency = 30; // enough for Faster typing and a letter key: a * on those stores
    expect(plain(renderScreen(s, '', 'script'))).toContain('\n Typewriters*  Staff*  Script   Research   Office   Breakroom   Hats \n');
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

describe('letter picking', () => {
  it('lists the letters you can still buy with their values', () => {
    const s = createInitialState(0);
    chooseFirstLetter(s, 'a');
    const prompt = letterPickPrompt(s);
    expect(prompt).not.toContain('A(1)');
    expect(prompt).toContain('B(3)');
    expect(prompt).toContain('Z(10)');
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
    expect(squash(text)).toContain('[b] scene owned');
    expect(squash(text)).toContain('\n ACT 1, SCENE 1 0 / 1 written NEEDS\n');
    expect(squash(text)).toContain('\n ACT 1, SCENE 2 0 / 1 written NEEDS\n');
    expect(squash(text)).toContain('\n HAMLET I. in reach\n');
    expect(squash(text)).toContain('\n> POLONIUS Ay, my lord. ADLMORY \n'); // the letters it needs
    expect(text.split('\n').some((r) => r.startsWith('\x1b[7m>  POLONIUS '))).toBe(true); // the cursor's line is inverse
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
});

describe('buying scenes in the script browser', () => {
  it('shows unowned scenes with prices, and locked genres', () => {
    const s = started();
    s.owned = ['test:1.1'];
    const text = squash(renderScript(s, 'test', 1));
    expect(text).toContain('\n ACT 1, SCENE 2 1 line, not owned NEEDS\n');
    expect(text).toContain('\n> POLONIUS Ay, my lord. \n'); // nothing needed until you own it
    expect(text).toContain('[b] scene 80 Bananas'); // AYMYLORD is 8 letters
    expect(text).toContain('[a] Act 1 64 Bananas'); // only the unowned scene, less 20%
    s.currency = 100;
    expect(renderScript(s, 'test', 1)).toContain(green(`* ${bold('80')} Bananas`)); // affordable
    s.departments = [];
    s.owned = [];
    expect(renderScript(s, 'test', 1)).toContain('Open a Comedies department to buy these.');
  });
});

describe('bold prices', () => {
  it('shows what you can afford in green with a *, and dims the rest', () => {
    const s = started();
    s.currency = 20;
    const staff = renderScreen(s, '', 'staff');
    expect(staff).toContain('\x1b[32m* \x1b[1m10\x1b[22m Bananas\x1b[39m'); // faster typing: affordable, its number bold
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
    expect(text).toMatch(/ \[1\] HE   combination    [\d.]+[KMBT]? Bananas/);
    expect(text).toMatch(/ \[2\] THE  word /);
    s.currency = 1e9;
    expect(renderKeysMenu(s)).toContain('\x1b[32m* \x1b[1m4.00M\x1b[22m Bananas\x1b[39m'); // affordable: green with a *
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
    expect(renderSlotsMenu(s, 'comedy', 0, null)).toContain('\x1b[7m> [1] 3rd'); // the selected slot is inverse
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
    expect(plain(renderStats(s))).toContain('   Longest sentence   -');
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
    s.currency = 1e30;
    const staff = renderScreen(s, '', 'staff');
    expect(squash(staff)).toContain('[2] Hire a monkey you have 4 desk needed\n'); // no price: a desk is what it needs
    expect(staff).toContain(red('desk needed'));
    s.departments = ['comedy', 'tragedy'];
    expect(squash(renderScreen(s, '', 'staff'))).toContain('Hire a monkey for Tragedies (0/10) room needed\n');
  });

  it("shows one department's monkeys at a time on the home screen", () => {
    const s = started();
    s.departments = ['comedy', 'tragedy'];
    s.monkeys[0].name = 'Clown';
    s.monkeys.push({ ...createMonkey(), department: 'tragedy', name: 'Mourner' });
    const first = plain(renderScreen(s));
    expect(first).toContain(' COMEDIES   department 1 of 2\n');
    expect(first).toContain('Clown');
    expect(first).not.toContain('Mourner');
    expect(first).toContain('[tab] department');
    s.settings.homeDepartment = 'tragedy';
    const second = plain(renderScreen(s));
    expect(second).toContain(' TRAGEDIES   department 2 of 2\n');
    expect(second).toContain('Mourner');
    expect(second).not.toContain('Clown');
    s.departments = ['comedy'];
    expect(plain(renderScreen(s))).not.toContain('[tab]'); // one department: no heading, no key
  });

  it('lists a hire line for each department, each with its own price', () => {
    const s = started();
    s.currency = 1e30;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    const staff = squash(renderScreen(s, '', 'staff'));
    expect(staff).toContain('Hire a monkey for Comedies (1/10) * 300.00K Bananas');
    expect(staff).toContain('Hire a monkey for Tragedies (0/10) * 30.00M Bananas');
  });

  it('draws the office on one grid: rooms, their desks and who sits at them', () => {
    const s = started();
    s.monkeys[0].name = 'Bobo';
    const text = plain(renderOffice(s));
    expect(text).toContain(' INFINITE MONKEYS > OFFICE ');
    expect(text).toContain('\n\n+-1-----+\n|[@]  . :\n|       |\n| .   . |\n+-------+');
    expect(squash(text)).toContain('\n 1 Comedies room 4 none - Bobo\n');
    expect(text).toContain('[r] buy a room');
    expect(text).not.toContain('Each monkey gets a desk'); // how rooms work is on the [?] page
    expect(plain(renderOfficeHelp(s))).toContain("Each monkey gets a desk in its department's room.");
  });

  it('draws rooms of any shape, and the squares a room can grow into', () => {
    const s = started();
    s.office[0].cells.push([2, 0]);
    expect(plain(renderOffice(s))).toContain('+-1---------+\n|[@]  .   . |\n|       +---+\n| .   . |\n+-------+');
    const growing = plain(renderOffice(s, '', { x: 2, y: 1 }, -1, 'r1'));
    expect(growing).toContain('Growing the Comedies room');
    expect(growing).toContain('>+<'); // the cursor on a square it can grow into
    expect(growing).toContain(' + ');
  });

  it('draws hallways and doors between rooms, and warns about a room with no way in', () => {
    const s = started();
    s.currency = 1e12;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    const text = plain(renderOffice(s));
    expect(text).toContain('/   /[@]'); // a door, a hallway square, a door into room 1
    expect(text).toContain(' 2  Tragedies room');
    s.doors = [];
    const locked = renderOffice(s).split('\n').find((r) => r.includes('NO WAY IN'))!;
    expect(locked.startsWith('\x1b[31m')).toBe(true); // in red
  });

  it("shows each department's lounge, and the departments each break room is the lounge of", () => {
    const s = started();
    s.currency = 1e12;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    buyRoom(s, 'break'); // against both, with a door into each
    s.furniture.push({ kind: 'tv', room: 'r3', x: s.office[2].cells[0][0], y: s.office[2].cells[0][1] });
    const text = squash(renderOffice(s));
    expect(text).toContain('\n # ROOM SIZE LOUNGE EFFECTS WHO\n');
    expect(text).toContain('\n 1 Comedies room 4 Break room breaks 40% faster, +3% happy M-1\n');
    expect(text).toContain('\n 2 Tragedies room 9 Break room breaks 40% faster, +3% happy\n');
    expect(text).toContain('\n 3 Break room 9 - - lounge of Comedies room, Tragedies room\n');
    // On a narrow screen who works in each room goes under it.
    const narrow = plain(renderOffice(s, '', null, -1, false, null, 80));
    expect(narrow).toContain(' #  ROOM            SIZE  LOUNGE      EFFECTS\n');
    expect(narrow).toContain('\n 3  Break room         9  -           -\n      lounge of Comedies room, Tragedies room\n');
    for (const row of narrow.split('\n')) expect(row.length).toBeLessThan(80);
  });

  it('places rooms to keep the map narrow enough for the terminal', () => {
    const s = started();
    s.currency = 1e30;
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
  it('sells furniture by the kind of room it goes in', () => {
    const s = started();
    s.currency = 600;
    const text = squash(renderScreen(s, '', 'department'));
    expect(text).toContain(' Office* Breakroom Hats');
    expect(text).toContain("Furniture for a department's own room: it helps the monkeys who work there.");
    expect(text).toContain(' ITEM EFFECT PRICE\n'); // no elements before the feng shui book
    expect(text).toContain('[1] Potted plant P tire 3% slower, +1% pay * 500 Bananas\n');
    expect(text).toContain('[2] Scented candle I tire 3% slower, +1% pay * 500 Bananas\n'); // same price, same benefit
    expect(text).toContain('[3] Wall clock K tire 3% slower, +1% pay * 500 Bananas\n');
    expect(text).not.toContain('Television'); // break rooms only
    expect(text).toContain('[up/down] page 1 of 2');
    s.fengShuiBook = true;
    const read = squash(renderScreen(s, '', 'department'));
    expect(read).toContain(' ITEM ELEMENT EFFECT PRICE\n');
    expect(read).toContain('[1] Potted plant P wood tire 3% slower, +1% pay * 500 Bananas\n');
    s.fengShuiBook = false;
    expect(storeChoices(s, 'department', 1).map((x) => x.id)).toContain('furniture:cooler@department'); // fits either room
    const lounge = squash(renderScreen(s, '', 'break'));
    expect(lounge).toContain('Furniture for break rooms: it helps each department whose nearest one it is.');
    expect(lounge).toContain('[1] Potted plant P tire 3% slower, +1% pay 500 Bananas\n'); // fits either room; no * as there's nowhere to put it
    expect(lounge).toContain('You have no break room yet: buy one on the office map ([o], then [r]).');
    expect(lounge).not.toMatch(/\* [0-9.]+K? Bananas/); // nowhere to put any of it
    const last = squash(renderScreen(s, '', 'break', 0, 2));
    expect(last).toContain('[1] Television T breaks 40% faster, +3% pay 1.00M Bananas\n');
    expect(last).toContain('[2] Hot tub (2x1) U breaks 40% faster, +3% pay 1.00M Bananas\n');
    expect(last).toContain('[up/down] page 3 of 3');
    expect(storeChoices(s, 'break', 2).map((x) => x.id)).toEqual(['furniture:tv@break', 'furniture:hottub@break']);
    expect(storePages(s, 'hats')).toBe(1);
  });

  it('fits every store on an 80-column screen, elements and all', () => {
    const s = started();
    s.fengShuiBook = true;
    s.currency = 1e12;
    s.sentences = 1e12;
    for (const store of stores)
      for (let page = 0; page < storePages(s, store); page++)
        for (const row of plain(renderScreen(s, '', store, 80, page)).split('\n')) expect(row).toHaveLength(Math.min(row.length, 79));
  });

  it('draws furniture, the cursor and a piece being moved', () => {
    const s = started();
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    expect(plain(renderOffice(s))).toContain('|[@]  P :');
    expect(plain(renderOffice(s))).toContain('P potted plant');
    expect(plain(renderOffice(s, '', { x: 1, y: 0 }))).toContain('Cursor: Comedies room, potted plant.');
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
    s.settings.autoPlaceFurniture = false;
    expect(squash(renderOptions(s))).toContain('[1] Furniture places itself off');
    expect(squash(renderOptions(s))).toContain('[2] Light background off');
    // On a light background the pale colours turn darker; the rest stay.
    expect(forLightBackground(`${yellow('Bananas')} ${cyan('Words')} ${green('*')} ${red('NO WAY IN')}`)).toBe(
      '\x1b[38;5;130mBananas\x1b[39m \x1b[38;5;30mWords\x1b[39m \x1b[38;5;28m*\x1b[39m \x1b[31mNO WAY IN\x1b[39m',
    );
    expect(plain(renderScreen(s, '', 'department'))).toContain('New furniture opens the office map so you can place it.');
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
    s.currency = 1e12;
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
    expect(plain(renderScreen(started(), '', 'department'))).toContain('[i] inspect');
  });
});

describe('feng shui on screen', () => {
  it('draws windows, hides the book in a bookshelf, and once read shows each room\'s chi', () => {
    const s = started();
    s.windows = [{ x: 0, y: 1, side: 's' }, { x: 1, y: 0, side: 'e' }];
    const map = plain(renderOffice(s));
    expect(map).toContain('|[@]  . :'); // in a side wall
    expect(map).toContain('+===----+'); // in the bottom wall
    expect(map).toContain('=== : window');
    expect(map).not.toContain('chi');
    expect(plain(renderScreen(s, '', 'department'))).not.toContain('Feng shui book'); // not for sale: it hides in a bookshelf
    s.furniture.push({ kind: 'bookshelf', room: 'r1', x: 1, y: 1 });
    const shelf = inspectSquare(s, 1, 1);
    expect(shelf.text).toContain('Rows of dusty old books.');
    expect(shelf.text).toContain('Tucked behind the other books is a slim volume');
    expect(shelf.text).toContain('[y] read it');
    expect(shelf.book).toBe(1);
    expect(inspectSquare(s, 1, 0, 1).book).toBe(1); // held, it can be inspected too
    expect(inspectSquare(s, 0, 0).text).toBe("M-1's desk. A desk and a typewriter. Typewriters are mostly Metal, and so, some say, are good monkeys.");
    expect(inspectSquare(s, 1, 0).text).toBe('A window. Every room wants light, though sunlight is no substitute for a real flame.');
    expect(inspectSquare(s, 0, 2)).toEqual({ text: 'Nothing of interest here.', book: -1 });
    expect(inspectSquare(s, 9, 9).text).toBe('Nothing of interest here.');
    s.furniture.pop();
    s.fengShuiBook = true;
    const read = plain(renderOffice(s));
    expect(squash(read)).toContain(' # ROOM SIZE CHI LOUNGE EFFECTS WHO\n 1 Comedies room 4 80% ');
    expect(read).toContain('[b] book');
    const book = plain(renderFengShuiBook(s));
    expect(book).toContain('  Light    a window.');
    expect(book).toContain('  Metal   desk, wall clock, floor lamp, mirror, brass gong, espresso machine, vending machine');
    expect(book).toContain('  Fire    scented candle, fireplace, television');
    expect(book).toMatch(/1 Comedies room +chi  80% +lacks Balance/);
    expect(book).toContain('Office chi 80%: +8% happiness.');
  });
});

describe('managers and traits on screen', () => {
  /** A department of five typists with an office next door, before any manager. */
  const staffed = () => {
    const s = started();
    s.currency = 1e15;
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
    expect(squash(renderScreen(s, '', 'staff'))).toContain('Hire a manager picks lines, fills slots office needed');
    expect(buyRoom(s, 'office', 'comedy')).toBe(true);
    expect(squash(renderScreen(s, '', 'staff'))).toMatch(/\[\d\] Hire a manager picks lines, fills slots \* [\d.]+\w? Bananas/);
    const map = plain(renderOffice(s));
    expect(map).toContain(' D ');
    expect(squash(map)).toContain('2 Comedies office 4 - - no manager yet');
    expect(hireManager(s, 'comedy')).toBe(true);
    const hired = squash(plain(renderOffice(s)));
    expect(hired).toContain('2 Comedies office 4 - - M-6 (manager)');
    expect(hired).not.toMatch(/Comedies room[^\n]*M-6/);
    const office = Array.from({ length: storePages(s, 'department') }, (_, page) => plain(renderScreen(s, '', 'department', 0, page))).join('\n');
    expect(office).toContain("Manager's desk"); // a spare, in case one's needed
  });

  it("hides the manager's book in the manager's desk; once read, traits show on the home screen, on desks and in the book", () => {
    const s = staffed();
    buyRoom(s, 'office', 'comedy');
    const i = s.furniture.findIndex((f) => f.kind === 'managerdesk');
    const { x, y } = s.furniture[i];
    const desk = inspectSquare(s, x, y);
    expect(desk.text).toContain('Understanding Your Employees');
    expect(desk.text).toContain('[y] read it');
    expect(desk.book).toBe(i);
    expect(plain(renderScreen(s))).not.toContain('TRAIT');
    expect(inspectSquare(s, 0, 0).text).not.toContain('perfectionist');
    s.managerBook = true;
    const home = plain(renderScreen(s, '', null, 100));
    expect(home).toContain('TRAIT');
    expect(home).toContain('Perfectionist');
    expect(inspectSquare(s, 0, 0).text).toContain('M-1 is a perfectionist (-10% speed, +20% pay).');
    expect(inspectSquare(s, x, y).text).not.toContain('[y] read it');
    expect(plain(renderOffice(s))).toContain('[e] employees');
    const book = plain(renderManagerBook(s));
    expect(book).toContain('Night owl');
    expect(book).toMatch(/M-2 +Green thumb +no effect right now/);
    for (const row of plain(renderScreen(s, '', null, 80)).split('\n')) expect(row.length).toBeLessThan(80);
  });
});

describe('hats on screen', () => {
  it('sells hats and dye, and shows each monkey in its hat', () => {
    const s = started();
    s.sentences = 60;
    const store = plain(renderScreen(s, '', 'hats'));
    expect(squash(store)).toContain('[1] Baseball cap d@ tires 10% slower * 25 Sentences\n');
    expect(store).toContain('Crown         W@');
    expect(store).toContain('Dye');
    expect(plain(renderScreen(s))).toContain('  @ M-1 ');
    s.monkeys[0].hats = ['tophat'];
    s.monkeys[0].hat = 'tophat';
    expect(plain(renderScreen(s))).toContain(' #@ M-1 '); // a hat changes the icon
    expect(plain(renderOffice(s))).toContain('|#@]  . :'); // on the map too
    expect(plain(renderOffice(s, '', { x: 0, y: 0 }))).toContain('|>@<  . :');
    s.monkeys[0].hatColor = 'red';
    expect(renderScreen(s)).toContain('\x1b[31m#\x1b[39m@ M-1'); // a dyed hat shows in its colour
    expect(renderOffice(s)).toContain('|\x1b[31m#\x1b[39m@]');
    s.monkeys.push(createMonkey());
    expect(plain(hatPickPrompt(s, 'tophat'))).toBe('Top hat (750 Sentences) for which monkey? [1] M-1 (wearing it: takes it off)   [2] M-2   (any other key: done)');
    s.monkeys[0].hat = 'cap';
    s.monkeys[0].hats.push('cap');
    expect(plain(hatPickPrompt(s, 'tophat'))).toContain('[1] M-1 (has one: free)');
    expect(plain(hatPickPrompt(s, 'crown'))).toContain('[1] M-1 (swaps its thinking cap)');
    expect(plain(dyeColorPrompt())).toContain('[1] Red   [2] Green');
    expect(plain(dyePickPrompt(s, 'red'))).toBe("Red (10 Sentences) for which monkey's hat? [1] M-1 (already)   [2] M-2 (no hat)   (any other key: done)");
    expect(plain(dyePickPrompt(s, ''))).toContain('Undyed (free)');
  });
});

describe('achievements on screen', () => {
  it('lists every achievement, marks unlocked ones, shows progress and hides secrets', () => {
    const s = started();
    s.stats.pets = 37;
    s.achievements = ['first-pet'];
    const text = plain(renderAchievements(s, 0));
    expect(text).toContain(`1 of ${achievements.length} unlocked`);
    expect(text).toMatch(/\[x\] Good monkey +Pet a monkey/);
    expect(plain(renderAchievements(s, 5))).toMatch(/\[ \] Best friends +Pet the monkeys 100 times   37 \/ 100/);
    expect(renderAchievements(s, 0)).toContain('\x1b[32m[x]\x1b[39m'); // unlocked: a green mark
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
    expect(text).toContain('* You can publish a Folio: [f] start over with 4 more pages, bananas +0.4% for good.');
    expect(text).toContain('[f] publish a Folio');
    expect(folioPrompt(s)).toContain('bananas x1.00 for good. Press y to publish');
    s.folios = 1;
    s.folioPages = 500;
    expect(plain(renderScreen(s))).toContain('Folio bananas +50% (1 Folio published)');
  });
});

// Unicode is allowed but ASCII is preferred, so the game runs in any terminal.
// A screen may use only the non-ASCII characters listed here; add one when
// the game starts printing it (Justin, 2026-10-14: "lets allow unicode then").
const allowedUnicode = '';

describe('plain ASCII', () => {
  it('prints only ASCII (plus ANSI codes and the allowed Unicode), so the game runs in any terminal', () => {
    const s = started();
    s.currency = 1e12;
    s.monkeys[0].hats = ['tophat'];
    s.monkeys[0].hat = 'tophat';
    s.monkeys[0].hatColor = 'blue';
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    const screens = [
      ...stores.map((store) => renderScreen(s, '', store)),
      renderOffice(s, '', { x: 0, y: 0 }, -1, true),
      renderOfficeHelp(s),
      renderFengShuiBook(s),
      renderManagerBook(s),
      renderOptions(s),
      renderKeysMenu(s),
      renderStats(s),
      renderDictionary(s, 0),
      renderAchievements(s, 0),
    ];
    for (const text of screens) expect([...plain(text)].filter((c) => c > '\x7f' && !allowedUnicode.includes(c))).toEqual([]);
  });
});

