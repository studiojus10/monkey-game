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
  dyeColorPrompt,
  dyePickPrompt,
  slotHighlight,
  stores,
} from '../src/cli/screen';
import { officeMapWidth, renderOffice, renderFengShuiBook } from '../src/cli/office';
import { dictionaryRowFor, renderAchievements, renderDictionary, renderStats } from '../src/cli/stats';
import { achievements } from '../src/game/config';
import { poke, typeLetter, buyRoom, chooseFirstLetter, chooseStarterScene, renameMonkey, setPlays, togglePin, openDepartment } from '../src/game/logic';
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
    expect(renderScreen(s)).toContain('[1] Comedies: Test Play');
    openDepartment(s, 'comedy');
    expect(renderScreen(s)).toContain('[1] Test Play, Act 1, scene 1 (1 lines)');
    chooseStarterScene(s, 'test', '1.1');
    const text = renderScreen(s);
    expect(text).toContain('[a] A    [i] I');
    expect(text).not.toContain('Points');
  });

  it('shows points, letters, the monkey line and controls', () => {
    const s = started();
    s.currency = 1234;
    s.wordsTyped = 3;
    s.lastWord = 'I';
    s.lastWordPoints = 1;
    s.monkeys[0].line = [{ text: 'I', scored: true }];
    const text = renderScreen(s, 'hello', 'staff');
    const tools = plain(renderScreen(s, '', 'typewriters'));
    expect(text).toContain('\x1b[1m1.23K Points\x1b[22m   \x1b[1m0 Words\x1b[22m   \x1b[1m0 Sentences\x1b[22m   \x1b[1m0 Lines\x1b[22m'); // every total in bold, in this order
    expect(text).toContain('Letters: I');
    expect(text).toContain('Script: 2 scenes owned, 0 / 2 lines written');
    expect(text.split('\n')[2]).toBe(' @ M-1(0.50/s 100%) x1  \x1b[1mI\x1b[22m_');
    expect(text).toContain('Last word: I +1');
    expect(plain(text)).toMatch(/^Shop +Typewriters\* +\[Staff\*\] +Script +Furniture\* +Hats$/m); // letters come first
    expect(plain(text)).toContain('[1] *Faster typing for M-1 (skill 0/10): 0.50 -> 0.63 letters/sec   cost 10 Points');
    expect(tools).toContain('[2] *Portable typewriter for M-1 (skill cap 10 -> 20)   cost 1.00K Points');
    expect(tools).toContain('[1] *Buy a letter key   cost 25 Points'); // the 2nd letter costs no Words
    s.letters.push('A');
    expect(plain(renderScreen(s, '', 'typewriters'))).toContain('[1]  Buy a letter key   cost 75 Points + 1 Words');
    expect(plain(text)).toContain('[2]  Hire a monkey (you have 1)   cost 300.00K Points');
    expect(plain(text)).toContain('[3]  Raise combo cap (x3 -> x4)   cost 1 Sentences');
    expect(text).toContain('[q] quit');
    expect(text).toContain('hello');
  });

  it('keeps the shop closed until space opens it', () => {
    const s = started();
    const closed = plain(renderScreen(s));
    expect(closed).not.toContain('Faster typing');
    expect(closed).toContain('[enter] pet the monkey   [space] open the shop');
    const open = plain(renderScreen(s, '', 'staff'));
    expect(open).toContain('Faster typing');
    expect(open).toContain('[space] close the shop   [tab] next store   [1-9] buy');
    expect(open).toMatch(/^Shop +Typewriters +\[Staff\] +Script +Furniture +Hats$/m);
    s.currency = 30; // enough for Faster typing and a letter key: a * on those stores
    expect(plain(renderScreen(s, '', 'script'))).toMatch(/^Shop +Typewriters\* +Staff\* +\[Script\] +Furniture +Hats$/m);
  });

  it('celebrates the last line a monkey wrote', () => {
    const s = started();
    s.lastLine = { play: 'test', index: 1, firstTime: true, points: 396, sentence: true };
    expect(renderScreen(s)).toContain('A monkey wrote a line! "Ay, my lord." (1.2)  +396 Points, +1 Line, +1 Sentence');
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
    const rows = renderScreen(s).split('\n').filter((r) => r.endsWith('_'));
    expect(rows).toHaveLength(3);
    expect(rows[1].startsWith(' @ Bartholomew(')).toBe(true);
    expect(new Set(rows.map((r) => r.indexOf('_'))).size).toBe(1);
  });

  it('runs monkey lines to the edge of the screen, dropping the oldest letters if the screen is narrower', () => {
    const s = started();
    s.monkeys[0].line = [{ text: 'X'.repeat(200), scored: false }];
    for (const columns of [60, 100, 160]) {
      const row = plain(renderScreen(s, '', null, columns)).split('\n').find((r) => r.endsWith('_'))!;
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
    expect(text).toContain(`M-${maxMonkeyLines}(`);
    expect(text).not.toContain(`M-${maxMonkeyLines + 1}(`);
    expect(text).toContain('...and 5 more monkeys typing');
  });
});

describe('script browser and pins', () => {
  it('shows a page of the play with scenes, the cursor and what each line needs', () => {
    const s = started();
    let text = renderScript(s, 'test', 1);
    expect(text).toContain('=== Test Play (Comedies) ===   0 of 2 lines written   line 2');
    expect(text).toContain('[b] this scene: owned');
    expect(text).toContain('-- Act 1, scene 1 (0/1 written) --');
    expect(text).toContain('-- Act 1, scene 2 (0/1 written) --');
    expect(text).toContain('    HAMLET         I.   (within reach)');
    expect(text).toContain('>   POLONIUS       Ay, my lord.   (needs A D L M O R Y)');
    s.completed.test = [0];
    togglePin(s, 'test', 1);
    text = renderScript(s, 'test', 0);
    expect(text).toContain('>+  HAMLET         I.');
    expect(text).toContain('  @ POLONIUS       Ay, my lord.');
    expect(text).toContain('@ pinned (1/5)');
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
    const text = plain(renderScript(s, 'test', 1));
    expect(text).toContain('-- Act 1, scene 2 (1 lines, not owned) --');
    expect(text).toContain('Ay, my lord.   (not owned)');
    expect(text).toContain('[b] this scene 80 Points'); // AYMYLORD is 8 letters
    expect(text).toContain('[a] Act 1 64 Points'); // only the unowned scene, less 20%
    s.departments = [];
    s.owned = [];
    expect(renderScript(s, 'test', 1)).toContain('Open a Comedies department to buy these.');
  });
});

describe('bold prices', () => {
  it('bolds every price in the shop', () => {
    const text = renderScreen(started(), '', 'staff');
    expect(text).toContain('cost \x1b[1m10\x1b[22m Points'); // faster typing
    expect(text).toContain('cost \x1b[1m300.00K\x1b[22m Points'); // a monkey
  });

  it('shows affordable prices in green and the rest in the normal color', () => {
    const s = started();
    s.currency = 20;
    expect(renderScreen(s, '', 'staff')).toContain('cost \x1b[32m\x1b[1m10\x1b[22m\x1b[39m Points'); // faster typing: affordable
    expect(renderScreen(s, '', 'typewriters')).toContain('cost \x1b[1m25\x1b[22m Points'); // a letter: not yet
  });
});

describe('typewriter keys menu', () => {
  it('is locked in the shop until you own enough letters', () => {
    expect(plain(renderScreen(started(), '', 'typewriters'))).toContain('       Typewriter keys: unlock when you own 13 letters');
  });

  it('lists the keys you can buy and the words closest to unlocking', () => {
    const s = started();
    s.letters = 'ABDEGHILNORST'.split('');
    s.keys.push('TH');
    s.stats.words = { THE: 100, LORD: 40, NOR: 12 };
    expect(plain(renderScreen(s, '', 'typewriters'))).toContain('[3]  Typewriter keys...');
    const text = plain(renderKeysMenu(s));
    expect(text).toContain('Closest: LORD 40/100   NOR 12/100');
    expect(text).toContain('Owned: TH');
    expect(keyChoices(s)).not.toContain('TH');
    expect(keyChoices(s)).toContain('HE');
    expect(text).toMatch(/\[1\]  HE \(combination\)   cost [\d.]+[KMBT]? Points/);
    expect(text).toMatch(/\[2\]  THE \(word\)/);
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
    expect(text).toContain('> [1] 3rd  word: FRIEND           ON');
    expect(text).toContain('[b]  buy a slot   cost 6 Lines');
    expect(renderSlotsMenu(s, 'comedy', 0, 'FRI')).toContain('word: FRI_');
    expect(ordinal(1) + ordinal(2) + ordinal(11) + ordinal(22)).toBe('1st2nd11th22nd');
  });
});

describe('statistics and dictionary', () => {
  it('shows totals, records, letter counts and the most spelled words', () => {
    const s = started();
    for (let i = 0; i < 3; i++) typeLetter(s, 0, () => 0);
    const text = renderStats(s);
    expect(text).toContain('Letters typed:      3');
    expect(text).toContain('Words spelled:      3 (1 different)');
    expect(text).toContain('Longest word:       I (1 letters)');
    expect(text).toContain('Longest line:       "I." (Test Play 1.1, 1 letters)');
    expect(text).toContain('  I 3');
    expect(text).toContain('   1. I                x3');
  });

  it('lists every word spelled from A to Z with its count, and jumps to a letter', () => {
    const s = started();
    expect(renderDictionary(s, 0)).toContain('No words yet');
    s.stats.words = { ZAP: 1, CAT: 4, ALE: 2, MOO: 1, BEE: 3 };
    const text = renderDictionary(s, 0);
    expect(text).toContain('5 words spelled');
    expect(text.split('\n')[2].split(/\s{2,}/)).toEqual(['ALE x2', 'BEE x3', 'CAT x4', 'MOO x1']);
    expect(text.split('\n')[3]).toBe('ZAP x1');
    expect(dictionaryRowFor(s, 'z')).toBe(1);
    expect(dictionaryRowFor(s, 'b')).toBe(0);
  });
});

describe('script contents', () => {
  it('lists every play, then one play\'s acts and scenes, with the cursor', () => {
    const s = started();
    s.owned = ['test:1.1'];
    s.completed.test = [0];
    const plays = renderContents(s, null, 0);
    expect(plays).toContain('=== Contents: all plays ===');
    expect(plays).toMatch(/^> {3}Test Play +Comedies +1\/2 lines written, 1 of 2 scenes owned$/m);
    const scenes = renderContents(s, 'test', 1).split('\n');
    expect(scenes).toContain('  Act 1');
    expect(scenes.find((r) => r.includes('Scene 1'))).toMatch(/^ {6}Scene 1 +1\/1 written, finished$/);
    expect(scenes.find((r) => r.includes('Scene 2'))).toMatch(/^> {5}Scene 2 +1 lines, not owned$/);
  });
});

describe('office space on screen', () => {
  it('stops hiring when there is no square for a desk, and points to the office map', () => {
    const s = started();
    s.monkeys.push(createMonkey(), createMonkey(), createMonkey());
    s.furniture.push({ kind: 'desk', room: 'r1', x: 1, y: 0 }, { kind: 'desk', room: 'r1', x: 0, y: 1 }, { kind: 'desk', room: 'r1', x: 1, y: 1 });
    const staff = plain(renderScreen(s, '', 'staff'));
    expect(staff).toContain("Hire a monkey: no free square for its desk. Grow its department's room on the office map ([o]).");
    expect(staff).not.toContain('Hire a monkey (');
  });

  it('lists a hire line for each department, each with its own price', () => {
    const s = started();
    s.currency = 1e30;
    s.departments = ['comedy', 'tragedy'];
    buyRoom(s, 'department', 'tragedy');
    const staff = plain(renderScreen(s, '', 'staff'));
    expect(staff).toContain('Hire a monkey for Comedies (1/10)   cost 300.00K Points');
    expect(staff).toContain('Hire a monkey for Tragedies (0/10)   cost 30.00M Points');
  });

  it('draws the office on one grid: rooms, their desks and who sits at them', () => {
    const s = started();
    s.monkeys[0].name = 'Bobo';
    const text = plain(renderOffice(s));
    expect(text).toContain('=== Office ===\n\n+-1-----+\n|[@]  . :\n|       |\n| .   . |\n+-------+');
    expect(text).toContain('   1 Comedies room      4 squares   1 monkey: Bobo');
    expect(text).toContain('[r] buy a room');
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
    buyRoom(s, 'break');
    const text = plain(renderOffice(s));
    expect(text).toContain('/   /[@]'); // a door, a hallway square, a door into room 1
    expect(text).toContain('   2 Break room');
    s.doors = [];
    expect(plain(renderOffice(s))).toContain('NO WAY IN');
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
  it('sells furniture in the Furniture store', () => {
    const s = started();
    s.currency = 600;
    const text = plain(renderScreen(s, '', 'furniture'));
    expect(text).toContain("[1] *Potted plant [P] (wood): a department's monkeys tire 3% slower, +1% points   cost 500 Points");
    expect(text).toContain('[7]  Television [T] (fire): in a break room, breaks go 40% faster, +3% points   cost 1.00M Points');
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
    expect(moving).toContain('[space] put it down   [esc] cancel');
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
    expect(plain(renderOptions(s))).toContain('[1] Furniture places itself: ON');
    s.settings.autoPlaceFurniture = false;
    expect(plain(renderOptions(s))).toContain('[1] Furniture places itself: off');
    expect(plain(renderScreen(s, '', 'furniture'))).toContain('New furniture opens the office map so you can place it.');
  });

});

describe('energy on screen', () => {
  it('shows each typist speed and energy, and the time left on a break', () => {
    const s = started();
    s.monkeys[0].energy = 0.5;
    expect(plain(renderScreen(s))).toContain('M-1(0.44/s 50%) x1');
    s.monkeys[0].energy = 0.25;
    s.monkeys[0].resting = true;
    expect(plain(renderScreen(s))).toContain('M-1(break 45s) x1');
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

describe('feng shui on screen', () => {
  it('draws windows, sells the book, and once read shows each room\'s chi', () => {
    const s = started();
    s.windows = [{ x: 0, y: 1, side: 's' }, { x: 1, y: 0, side: 'e' }];
    const map = plain(renderOffice(s));
    expect(map).toContain('|[@]  . :'); // in a side wall
    expect(map).toContain('+===----+'); // in the bottom wall
    expect(map).toContain('=== : window');
    expect(map).not.toContain('chi');
    s.currency = 6000;
    expect(plain(renderScreen(s, '', 'furniture'))).toContain("[8] *Feng shui book: learn what makes a room's chi flow");
    s.fengShuiBook = true;
    expect(plain(renderScreen(s, '', 'furniture'))).toContain('Feng shui book: yours.');
    const read = plain(renderOffice(s));
    expect(read).toContain('chi  80%');
    expect(read).toContain('[b] read the feng shui book');
    const book = plain(renderFengShuiBook(s));
    expect(book).toContain('  Light    a window.');
    expect(book).toContain('  Metal   desk, floor lamp');
    expect(book).toContain('  Fire    television, windows');
    expect(book).toMatch(/1 Comedies room +chi  80% +lacks Balance/);
    expect(book).toContain('Office chi 80%: +8% happiness.');
  });
});

describe('hats on screen', () => {
  it('sells hats and dye, and shows each monkey in its hat', () => {
    const s = started();
    s.sentences = 60;
    const store = plain(renderScreen(s, '', 'hats'));
    expect(store).toContain('[1] *Baseball cap [d@]: it tires 10% slower   cost 25 Sentences');
    expect(store).toContain('Crown [W@]');
    expect(store).toContain('Dye');
    expect(plain(renderScreen(s))).toContain(' @ M-1(0.50/s 100%)');
    s.monkeys[0].hats = ['tophat'];
    s.monkeys[0].hat = 'tophat';
    expect(plain(renderScreen(s))).toContain('#@ M-1(0.50/s 100%)'); // a hat changes the icon
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
    expect(text).toMatch(/\[ \] Best friends +Pet the monkeys 100 times   \(37 \/ 100\)/);
    const last = plain(renderAchievements(s, 999));
    expect(last).toMatch(/\[ \] \?\?\? +A secret/);
    expect(last).not.toContain('MONKEY');
    s.achievements.push('word-monkey');
    expect(plain(renderAchievements(s, 999))).toContain('Self-aware');
    expect(text).toContain('Milestones');
  });

  it('shows a heart by a monkey petted lately', () => {
    const s = started();
    expect(plain(renderScreen(s))).not.toContain('<3');
    poke(s);
    expect(plain(renderScreen(s))).toContain('M-1<3(');
  });
});

describe('publishing a Folio on screen', () => {
  it('offers it once a play is finished, and shows the bonus after', () => {
    const s = started();
    expect(plain(renderScreen(s))).not.toContain('publish a Folio');
    s.completed = { test: [0, 1] };
    s.playsDone = ['test'];
    const text = plain(renderScreen(s));
    expect(text).toContain('* You can publish a Folio: [f] start over with 4 more pages, points +0.4% for good.');
    expect(text).toContain('[f] publish a Folio');
    expect(folioPrompt(s)).toContain('points x1.00 for good. Press y to publish');
    s.folios = 1;
    s.folioPages = 500;
    expect(plain(renderScreen(s))).toContain('Folio points +50% (1 Folio published)');
  });
});

describe('plain ASCII', () => {
  it('prints only ASCII (plus ANSI codes), so the game runs in any terminal', () => {
    const s = started();
    s.currency = 1e12;
    s.monkeys[0].hats = ['tophat'];
    s.monkeys[0].hat = 'tophat';
    s.monkeys[0].hatColor = 'blue';
    s.furniture.push({ kind: 'plant', room: 'r1', x: 1, y: 0 });
    const screens = [
      ...stores.map((store) => renderScreen(s, '', store)),
      renderOffice(s, '', { x: 0, y: 0 }, -1, true),
      renderFengShuiBook(s),
      renderOptions(s),
      renderKeysMenu(s),
      renderStats(s),
      renderDictionary(s, 0),
      renderAchievements(s, 0),
    ];
    for (const text of screens) expect(plain(text)).toMatch(/^[\x00-\x7f]*$/);
  });
});

