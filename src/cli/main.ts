import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { achievements, departmentRules, desk, furnitureKinds, type RoomKind, dyeCost, hatColors, hats, managers, maxMonkeyNameLength, maxPinnedLines, theme } from '../game/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sceneName, type Genre, type PlayData } from '../game/plays';
import {
  applyOfflineProgress,
  dyeHat,
  hatCost,
  wearHat,
  buyFurniture,
  allowedIn,
  readFengShuiBook,
  cellAt,
  pieceSize,
  furnitureSpot,
  furnitureCost,
  moveFurniture,
  rotateFurniture,
  buyRoom,
  expandRoom,
  roomlessDepartments,
  roomCost,
  squareCost,
  canSeatMonkey,
  buyFasterTyping,
  buyTypewriter,
  skillCap,
  typewriterName,
  buyLetter,
  availablePlays,
  currentWork,
  nextOwnedScene,
  buySection,
  getPlay,
  sceneOf,
  starterScenes,
  departmentChoices,
  monkeyGenre,
  canAffordLetter,
  moveMonkey,
  assignMonkey,
  departmentsWithRoom,
  departmentTypists,
  nextMonkeyCost,
  departmentGenres,
  departmentSlots,
  slotGenre,
  toggleManager,
  upgradeManager,
  openDepartment,
  buyCapRaise,
  buyKey,
  buyMonkey,
  monkeyName,
  renameMonkey,
  buySlot,
  chooseStarterScene,
  chooseFirstLetter,
  moveSlot,
  letterCost,
  letterWordsCost,
  poke,
  reachableLines,
  setSlotWord,
  setPlays,
  setWordList,
  setLineWidth,
  publishFolio,
  canPublishFolio,
  folioMultiplier,
  tick,
  togglePin,
  toggleSlot,
} from '../game/logic';
import { load, save } from '../game/save';
import { createInitialState, type Door, type Side } from '../game/state';
import { formatNumber } from '../format';
import { fileStorage } from './fileStorage';
import {
  keyChoices,
  letterPickPrompt,
  genreNames,
  departmentPrompt,
  managerChoices,
  managerUpgradePrompt,
  renderKeysMenu,
  renderScreen,
  folioPrompt,
  lineRoom,
  renderScript,
  renderContents,
  stores,
  storeChoices,
  storePages,
  type Store,
  typists,
  typingPickPrompt,
  renderDevMenu,
  contentsPageSize,
  renderSlotsMenu,
  scriptPageSize,
  renderOptions,
  dyeColorPrompt,
  dyePickPrompt,
  hatPickPrompt,
  inspectItem,
} from './screen';
import { devTools } from '../game/dev';
import { achievementPageRows, dictionaryColumns, dictionaryPageRows, dictionaryRowFor, dictionaryWords, renderAchievements, renderDictionary, renderStats } from './stats';
import { sideName, furnitureName, inspectSquare, renderFengShuiBook, renderOffice, roomName, type Cell } from './office';
import { cycleDoor, cycleWindow, officeBounds, placeDoor, roomAt, takeDoor, toggleHall } from '../game/layout';

const FRAME_MS = 250;
const AUTOSAVE_MS = 10_000;

setWordList(loadWordList());
setPlays(loadPlays());

const savePath = resolve(process.env.IDLE_SAVE ?? 'save.json');
const storage = fileStorage(savePath);

let state = load(storage);
/** Monkey lines run to the screen's edge, then start over. Returns the screen's width. */
function fitLines(): number {
  const columns = process.stdout.columns || 80;
  if (state.monkeys.length > 0) setLineWidth(lineRoom(state, columns));
  return columns;
}

fitLines();
let achievementsSeen = state.achievements.length; // achievements unlocked by now; newer ones get a message
const offline = applyOfflineProgress(state, Date.now());
let message =
  offline >= 1 ? `While you were away your monkeys earned ${formatNumber(offline)} ${theme.currency}.` : '';
let confirmingReset = false;
let confirmingFolio = false;
let pickingLetter = false;
let showingScript = false;
let scriptCursor = 0;
let contents: '' | 'plays' | 'scenes' = ''; // the script's table of contents, when open
let contentsCursor = 0;
let scriptPlay = 0; // index into availablePlays()
let findIndex = -1;
let showingKeys = false;
let showingDev = false;
let showingStats = false;
let showingAchievements = false;
let achievementRow = 0;
let showingOffice = false;
let officeCursor: Cell | null = null; // the selected cell on the office map
let officeGrowing = ''; // id of the room whose new square is being chosen
let buyingRoom = false; // choosing what room to buy on the office map
let showingOptions = false;
let heldFurniture = -1; // index of the furniture being moved on the office map, or -1
let heldTurned = false; // whether it was turned when picked up, for esc
let heldDoor: { from: Door; side: Side } | null = null; // a door being moved on the office map
let showingDictionary = false;
let dictionaryRow = 0;
let shop: Store | null = null; // the open store; the shop starts closed and space opens and closes it
let lastStore: Store = 'typewriters';
let showingSlots = false;
let selectedSlot = 0; // index into state.slots
let slotDept = 0; // index into departmentGenres(state)
let slotWordDraft: string | null = null;
let pickingMonkeyToName = false;
let pickingTyping: '' | 'skill' | 'typewriter' = ''; // choosing a monkey for [1] or [7]
let readingBook = false; // the feng shui book, open from the office map
let offeredBook = -1; // the piece hiding the feng shui book, just inspected: [y] reads it
let inspecting = false; // choosing a store item to inspect
let storePage = 0; // the open store's page, for stores with more than 9 items
let pickingHat = ''; // choosing a monkey for this hat
let pickingDye: string | null = null; // choosing a dye colour (null: not dyeing; '' undyed)
let pickingDyeColor = false; // choosing which colour to dye
let pickingDepartment = false;
let pickingMonkeyToMove = false;
let pickingManager = false;
let pickingDeptFor: '' | 'buy' | 'assign' = ''; // choosing a department for a new monkey
let pickingManagerUpgrade = false;
let namingMonkey = -1; // index of the monkey being named, or -1
let nameDraft = '';

/** Reads data/words.txt: one lowercase word per line. */
function loadWordList(): string[] {
  const path = fileURLToPath(new URL('../../data/words.txt', import.meta.url));
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((w) => w.toUpperCase());
}

/** Reads every data/plays/*.json. */
function loadPlays(): PlayData[] {
  const dir = fileURLToPath(new URL('../../data/plays/', import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as PlayData);
}

/** Acts on a store item chosen with 1-9 (see storeItems). */
function buyItem(id: string): void {
  if (id === 'train' || id === 'typewriter') {
    const what = id === 'train' ? 'skill' : 'typewriter';
    const team = typists(state);
    if (team.length === 1) message = buyTyping(team[0], what);
    else if (team.length > 1) {
      pickingTyping = what;
      message = typingPickPrompt(state, what);
    }
  } else if (id === 'letter') {
    if (state.currency < letterCost(state.letters.length)) {
      message = `Not enough ${theme.currency}.`;
    } else if (state.words < letterWordsCost(state.letters.length)) {
      message = 'Not enough Words. You earn a Word for each different word your monkeys spell.';
    } else {
      pickingLetter = true;
      message = letterPickPrompt(state);
    }
  } else if (id.startsWith('hire:')) {
    const g = id.slice('hire:'.length) as Genre;
    if (state.currency < nextMonkeyCost(state, g)) message = `Not enough ${theme.currency}.`;
    else if (buyMonkey(state, g)) startNaming(state.monkeys.length - 1);
    else message = noSeatMessage();
  } else if (id === 'hire') {
    const rooms = departmentsWithRoom(state);
    if (state.currency < nextMonkeyCost(state)) message = `Not enough ${theme.currency}.`;
    else if (!canSeatMonkey(state)) message = noSeatMessage();
    else if (rooms.length > 1) {
      pickingDeptFor = 'buy';
      message = deptPrompt('Which department gets the new monkey?');
    } else if (buyMonkey(state)) startNaming(state.monkeys.length - 1);
  } else if (id === 'assign') {
    if (!canSeatMonkey(state)) message = noSeatMessage();
    else if (assignMonkey(state)) startNaming(state.monkeys.length - 1);
    else {
      pickingDeptFor = 'assign';
      message = deptPrompt('Which department gets the new monkey?');
    }
  } else if (id === 'combo') {
    if (!buyCapRaise(state)) message = noSentences;
  } else if (id === 'keys') {
    showingKeys = true;
  } else if (id === 'slots') {
    showingSlots = true;
    if (slotDept >= departmentGenres(state).length) slotDept = 0;
    selectedSlot = departmentSlots(state, departmentGenres(state)[slotDept])[0] ?? -1;
  } else if (id === 'department') {
    pickingDepartment = true;
    message = departmentPrompt(state);
  } else if (id === 'manager') {
    pickingManagerUpgrade = true;
    message = managerUpgradePrompt(state);
  } else if (id === 'script') {
    openScript();
  } else if (id.startsWith('hat:')) {
    const what = id.slice('hat:'.length);
    if (state.monkeys.length === 1) message = wearHatOn(0, what);
    else {
      pickingHat = what;
      message = hatPickPrompt(state, what);
    }
  } else if (id === 'dye') {
    if (!state.monkeys.some((m) => m.hat)) message = 'No monkey is wearing a hat to dye.';
    else {
      pickingDyeColor = true;
      message = dyeColorPrompt();
    }
  } else if (id.startsWith('furniture:')) {
    // furniture:<kind>@<room kind>: the store's section says which kind of room it goes in.
    const [kind, where] = id.slice('furniture:'.length).split('@') as [string, RoomKind];
    const rooms = where === 'break' ? 'break room' : "department's room";
    if (!state.office.some((r) => r.kind === where)) message = `You have no ${rooms}. Buy one on the office map ([o], then [r]).`;
    else if (!furnitureSpot(state, kind, where))
      message = `No room for it in a ${rooms}: it needs ${pieceSize(kind).join(' x ')} free squares in one. Make space or grow a room on the office map ([o]).`;
    else if (state.currency < furnitureCost(state, kind)) message = `Not enough ${theme.currency}.`;
    else if (buyFurniture(state, kind, where)) {
      const i = state.furniture.length - 1;
      if (state.settings.autoPlaceFurniture) message = `The ${furnitureName(state, i)} is in. Move it on the office map with [o].`;
      else {
        // Placing it yourself: the map opens with the new piece in hand.
        openOffice();
        const f = state.furniture[i];
        officeCursor = { x: f.x, y: f.y };
        heldFurniture = i;
        message = `Where should the ${furnitureName(state, i)} go? [esc] leaves it here.`;
      }
    }
  }
}

/** Puts hat `id` on monkey `i` (or takes it off); returns the message to show. */
function wearHatOn(i: number, id: string): string {
  const m = state.monkeys[i];
  const name = monkeyName(state, i);
  const hatName = hats.find((h) => h.id === id)!.name.toLowerCase();
  if (m.hat === id) return wearHat(state, i, id) ? `${name} takes off its ${hatName}.` : '';
  const free = m.hats.includes(id);
  if (!free && state.sentences < hatCost(state, id)) return noSentences;
  return wearHat(state, i, id) ? `${name} puts on ${free ? 'its' : 'a new'} ${hatName}.` : noSentences;
}

/** Dyes monkey `i`'s hat `color` ('' washes it out); returns the message to show. */
function dyeHatOn(i: number, color: string): string {
  const m = state.monkeys[i];
  const name = monkeyName(state, i);
  if (!m.hat) return `${name} isn't wearing a hat.`;
  if (m.hatColor === color) return `${name}'s hat is that colour already.`;
  if (color && state.sentences < dyeCost) return noSentences;
  dyeHat(state, i, color);
  return color ? `${name}'s hat is ${hatColors.find((c) => c.id === color)!.name.toLowerCase()} now.` : `${name}'s hat is washed clean.`;
}

const noSentences = 'Not enough Sentences. They come from long chains of words and from lines of the play.';

/** Why a new monkey can't be seated. */
function noSeatMessage(): string {
  const genres = departmentGenres(state);
  return genres.length > 0 && genres.every((g) => departmentTypists(state, g) >= departmentRules.maxTypists)
    ? 'Every department is full. Open another in the Staff store.'
    : "No free square for a desk. Grow a department's room on the office map ([o]).";
}

/** Opens the office map with the cursor in the top-left corner of the first room. */
function openOffice(): void {
  showingOffice = true;
  heldFurniture = -1;
  officeGrowing = '';
  buyingRoom = false;
  message = '';
  if (!officeCursor) {
    const [x, y] = state.office[0].cells[0];
    officeCursor = { x, y };
  }
}

/** Opens the script browser on the play you're working on. */
function openScript(): void {
  showingScript = true;
  contents = '';
  const work = currentWork(state);
  if (work) {
    scriptPlay = Math.max(0, availablePlays().findIndex((p) => p.id === work.play));
    scriptCursor = work.index;
  }
}

/** Buys a skill level or a typewriter for monkey `i`; returns the message to show. */
function buyTyping(i: number, what: 'skill' | 'typewriter'): string {
  const m = state.monkeys[i];
  const name = monkeyName(state, i);
  if (what === 'typewriter') {
    return buyTypewriter(state, i) ? `${name} has a ${typewriterName(m.typewriter)} now.` : `Not enough ${theme.currency}.`;
  }
  if (m.skill >= skillCap(m)) return `${name}'s ${typewriterName(m.typewriter)} can't keep up. Buy a better typewriter in Typewriters.`;
  return buyFasterTyping(state, i) ? '' : `Not enough ${theme.currency}.`;
}

function draw() {
  const columns = fitLines();
  // New achievements get a message (offline ones too, on the first draw).
  const fresh = state.achievements.slice(achievementsSeen);
  if (fresh.length > 0) {
    achievementsSeen = state.achievements.length;
    const names = fresh.map((id) => achievements.find((a) => a.id === id)?.name ?? id);
    message =
      (message ? `${message}   ` : '') +
      (names.length > 3
        ? `${names.length} achievements unlocked! [a] to see them.`
        : `Achievement unlocked: ${names.join(', ')}! [a] to see ${names.length === 1 ? 'it' : 'them'}.`);
  }
  // Clear the screen and move the cursor home, then redraw.
  const screen = showingScript && contents
    ? renderContents(state, contents === 'scenes' ? (availablePlays()[scriptPlay]?.id ?? null) : null, contentsCursor, message)
    : showingOptions
    ? renderOptions(state)
    : showingOffice && readingBook
    ? renderFengShuiBook(state)
    : showingOffice
    ? renderOffice(state, message, officeCursor, heldFurniture, officeGrowing, heldDoor?.side ?? null)
    : showingAchievements
    ? renderAchievements(state, achievementRow)
    : showingStats
    ? renderStats(state)
    : showingDictionary
      ? renderDictionary(state, dictionaryRow)
      : showingScript
    ? renderScript(state, availablePlays()[scriptPlay]?.id ?? '', scriptCursor, message)
    : showingDev
      ? renderDevMenu(message)
      : showingKeys
      ? renderKeysMenu(state, message)
      : showingSlots
        ? renderSlotsMenu(state, departmentGenres(state)[slotDept], selectedSlot, slotWordDraft, message)
        : renderScreen(state, message, shop, columns, storePage);
  process.stdout.write('\x1b[2J\x1b[H' + screen + '\n');
}

function quit() {
  save(state, storage);
  process.stdin.setRawMode?.(false);
  process.stdout.write('\x1b[?25h');
  console.log(`\nSaved to ${savePath}. Bye!`);
  process.exit(0);
}

/** A prompt listing the departments with room, keys 1-4. */
function deptPrompt(question: string): string {
  const choices = departmentsWithRoom(state).map(
    (g, i) => `[${i + 1}] ${genreNames[g]} (${departmentTypists(state, g)}/${departmentRules.maxTypists})`,
  );
  return `${question} ${choices.join('   ')}   (any other key cancels)`;
}

function namePrompt(): string {
  return `Name ${monkeyName(state, namingMonkey)}: ${nameDraft}_   (enter to save, esc to cancel, empty for M-${namingMonkey + 1})`;
}

function startNaming(index: number) {
  namingMonkey = index;
  nameDraft = state.monkeys[index].name;
  message = namePrompt();
}

function handleKey(str: string | undefined, key: { name?: string; ctrl?: boolean }) {
  if (key.ctrl && key.name === 'c') return quit();

  if (confirmingFolio) {
    confirmingFolio = false;
    const next = key.name === 'y' ? publishFolio(state) : null;
    if (next) {
      const gained = next.folioPages - state.folioPages;
      state = next;
      save(state, storage);
      message = `You published Folio #${state.folios}: +${formatNumber(gained)} pages. Points x${folioMultiplier(state).toFixed(2)} for good. The monkeys start again.`;
    } else message = 'Not published. The monkeys keep typing.';
    return draw();
  }

  if (confirmingReset) {
    confirmingReset = false;
    if (key.name === 'y') {
      storage.clear();
      state = createInitialState();
      message = 'Progress reset.';
    } else {
      message = 'Reset cancelled.';
    }
    return draw();
  }

  if (namingMonkey >= 0) {
    if (key.name === 'escape') {
      namingMonkey = -1;
      message = 'Name unchanged.';
    } else if (key.name === 'return' || key.name === 'enter') {
      const i = namingMonkey;
      namingMonkey = -1;
      message = renameMonkey(state, i, nameDraft)
        ? `Say hello to ${monkeyName(state, i)}.`
        : `Names can use letters, numbers, spaces, - and ' (up to ${maxMonkeyNameLength}).`;
    } else {
      if (key.name === 'backspace') nameDraft = nameDraft.slice(0, -1);
      else if (str && /^[A-Za-z0-9 '-]$/.test(str) && nameDraft.length < maxMonkeyNameLength) nameDraft += str;
      message = namePrompt();
    }
    return draw();
  }

  if (pickingDeptFor) {
    const what = pickingDeptFor;
    pickingDeptFor = '';
    const g = departmentsWithRoom(state)[Number(str) - 1];
    const ok = g && (what === 'buy' ? buyMonkey(state, g) : assignMonkey(state, g));
    if (ok) startNaming(state.monkeys.length - 1);
    else message = 'No monkey added.';
    return draw();
  }

  // Picking menus stay open after a purchase so you can buy more; any other key closes them.
  if (pickingManagerUpgrade) {
    const i = managerChoices(state)[Number(str) - 1];
    if (i === undefined) {
      pickingManagerUpgrade = false;
      message = 'Done.';
    } else {
      const result = upgradeManager(state, i) ? `${monkeyName(state, i)}'s department works harder.` : 'Not enough Lines.';
      message = `${result}  ${managerUpgradePrompt(state)}`;
    }
    return draw();
  }

  if (pickingManager) {
    pickingManager = false;
    const i = Number(str) - 1;
    const wasManager = !!state.monkeys[i]?.manager;
    if (str && /^[1-9]$/.test(str) && toggleManager(state, i)) {
      message = wasManager
        ? `${monkeyName(state, i)} is back at the typewriter.`
        : `${monkeyName(state, i)} is now a manager: it picks lines, pins them and fills your word slots.`;
    } else {
      message = `Promoting needs a department with more than ${managers.minDepartmentMonkeys} monkeys and no manager yet.`;
    }
    return draw();
  }

  if (pickingMonkeyToMove) {
    pickingMonkeyToMove = false;
    const i = Number(str) - 1;
    message =
      str && /^[1-9]$/.test(str) && moveMonkey(state, i)
        ? `${monkeyName(state, i)} now works in ${genreNames[monkeyGenre(state, state.monkeys[i])!]}.`
        : 'No monkey moved. Moving needs a second department.';
    return draw();
  }

  if (pickingHat) {
    const what = pickingHat;
    const i = Number(str) - 1;
    if (!str || !/^[1-9]$/.test(str) || i >= state.monkeys.length) {
      pickingHat = '';
      message = 'Done.';
    } else message = `${wearHatOn(i, what)}  ${hatPickPrompt(state, what)}`;
    return draw();
  }

  if (inspecting) {
    inspecting = false;
    const item = shop && str && /^[1-9]$/.test(str) ? storeChoices(state, shop, storePage)[Number(str) - 1] : undefined;
    message = item ? inspectItem(item.id) : 'Nothing inspected.';
    return draw();
  }

  if (pickingDyeColor) {
    pickingDyeColor = false;
    const c = Number(str);
    if (!str || !/^[0-9]$/.test(str) || c > hatColors.length) message = 'No hat dyed.';
    else {
      const color = c === 0 ? '' : hatColors[c - 1].id;
      const wearers = state.monkeys.flatMap((m, i) => (m.hat ? [i] : []));
      if (wearers.length === 1) message = dyeHatOn(wearers[0], color);
      else {
        pickingDye = color;
        message = dyePickPrompt(state, color);
      }
    }
    return draw();
  }

  if (pickingDye !== null) {
    const color = pickingDye;
    const i = Number(str) - 1;
    if (!str || !/^[1-9]$/.test(str) || i >= state.monkeys.length) {
      pickingDye = null;
      message = 'Done.';
    } else message = `${dyeHatOn(i, color)}  ${dyePickPrompt(state, color)}`;
    return draw();
  }

  if (pickingTyping) {
    const what = pickingTyping;
    const i = Number(str) - 1;
    if (!str || !/^[1-9]$/.test(str) || !typists(state).includes(i)) {
      pickingTyping = '';
      message = 'Done.';
    } else message = `${buyTyping(i, what) || `${monkeyName(state, i)} types faster.`}  ${typingPickPrompt(state, what)}`;
    return draw();
  }

  if (pickingMonkeyToName) {
    pickingMonkeyToName = false;
    const i = Number(str) - 1;
    if (str && /^[1-9]$/.test(str) && i < state.monkeys.length) startNaming(i);
    else message = 'No monkey renamed.';
    return draw();
  }

  if (pickingDepartment) {
    pickingDepartment = false;
    const g = departmentChoices(state)[Number(str) - 1];
    message =
      g && openDepartment(state, g)
        ? `The ${genreNames[g]} department is open. Buy in the script ([p]) and move monkeys there with [d].`
        : 'No department opened.';
    return draw();
  }

  if (pickingLetter) {
    const letter = str?.toUpperCase() ?? '';
    if (!/^[A-Z]$/.test(letter) || state.letters.includes(letter)) {
      pickingLetter = false;
      message = 'Done.';
    } else if (buyLetter(state, letter)) {
      pickingLetter = canAffordLetter(state);
      message = pickingLetter ? `You bought ${letter}.  ${letterPickPrompt(state)}` : `You bought ${letter}.`;
    } else {
      pickingLetter = false;
      message = 'Not enough to buy that letter.';
    }
    return draw();
  }

  if (showingScript && contents) {
    message = '';
    const play = availablePlays()[scriptPlay];
    const size = contents === 'plays' ? availablePlays().length : (play?.scenes.length ?? 0);
    if (key.name === 'q') return quit();
    if (key.name === 'tab' || (key.name === 'escape' && contents === 'plays')) {
      contents = '';
    } else if (key.name === 'escape' || key.name === 'backspace' || key.name === 'left') {
      if (contents === 'scenes') {
        contents = 'plays';
        contentsCursor = scriptPlay;
      }
    } else if (key.name === 'up' || key.name === 'k') {
      contentsCursor = Math.max(0, contentsCursor - 1);
    } else if (key.name === 'down' || key.name === 'j') {
      contentsCursor = Math.min(size - 1, contentsCursor + 1);
    } else if (key.name === 'pageup') {
      contentsCursor = Math.max(0, contentsCursor - contentsPageSize);
    } else if (key.name === 'pagedown') {
      contentsCursor = Math.min(size - 1, contentsCursor + contentsPageSize);
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'right') {
      if (contents === 'plays') {
        const chosen = availablePlays()[contentsCursor];
        const sc = chosen && contentsCursor === scriptPlay ? sceneOf(chosen, scriptCursor) : undefined;
        if (contentsCursor !== scriptPlay) scriptCursor = 0;
        scriptPlay = contentsCursor;
        contents = 'scenes';
        contentsCursor = Math.max(0, sc && chosen ? chosen.scenes.indexOf(sc) : 0);
      } else if (play?.scenes[contentsCursor]) {
        scriptCursor = play.scenes[contentsCursor].lines[0];
        findIndex = -1;
        contents = '';
      }
    }
    return draw();
  }

  if (showingScript) {
    message = '';
    const play = availablePlays()[scriptPlay];
    const last = (play?.lines.length ?? 1) - 1;
    const sceneKeyAt = (i: number) => (play ? `${play.lines[i].act}.${play.lines[i].scene}` : '');
    if (key.name === 'escape' || key.name === 'p') {
      showingScript = false;
    } else if (key.name === 'q') {
      return quit();
    } else if (key.name === 'up' || key.name === 'k') {
      scriptCursor = Math.max(0, scriptCursor - 1);
    } else if (key.name === 'down' || key.name === 'j') {
      scriptCursor = Math.min(last, scriptCursor + 1);
    } else if (key.name === 'pageup') {
      scriptCursor = Math.max(0, scriptCursor - scriptPageSize);
    } else if (key.name === 'pagedown') {
      scriptCursor = Math.min(last, scriptCursor + scriptPageSize);
    } else if (key.name === 'left' && play) {
      // Start of this scene, or of the previous one if already there.
      let i = scriptCursor;
      if (i > 0 && sceneKeyAt(i - 1) !== sceneKeyAt(i)) i--;
      while (i > 0 && sceneKeyAt(i - 1) === sceneKeyAt(i)) i--;
      scriptCursor = i;
    } else if (key.name === 'right' && play) {
      let i = scriptCursor;
      while (i < last && sceneKeyAt(i + 1) === sceneKeyAt(i)) i++;
      scriptCursor = Math.min(last, i + 1);
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      if (play && !togglePin(state, play.id, scriptCursor)) {
        message = getPlay(play.id) && sceneOf(play, scriptCursor) && state.pinned.length < maxPinnedLines
          ? 'You can only pin lines from scenes you own.'
          : `You can pin up to ${maxPinnedLines} lines. Unpin one first.`;
      }
    } else if (play && str && ',.<>'.includes(str)) {
      const to = nextOwnedScene(state, play.id, scriptCursor, ',<'.includes(str) ? -1 : 1);
      if (!to) message = 'You don\'t own any scenes yet.';
      else {
        scriptPlay = Math.max(0, availablePlays().findIndex((p) => p.id === to.play));
        scriptCursor = to.index;
        findIndex = -1;
      }
    } else if (key.name === 'tab') {
      contents = 'plays';
      contentsCursor = scriptPlay;
    } else if (play && (str === 'b' || (str === 'a' && play.genre !== 'sonnet') || str === 'w')) {
      const sc = sceneOf(play, scriptCursor)!;
      const [act, scene, what] =
        str === 'b'
          ? [sc.act, sc.key, `${play.title}, ${sceneName(sc.act, sc.scene, play.genre)}`]
          : str === 'a'
            ? [sc.act, undefined, `${play.title}, Act ${sc.act}`]
            : [undefined, undefined, play.title];
      message = buySection(state, play.id, act, scene)
        ? `You bought ${what}.`
        : `Can't buy ${what}: it's owned already or you need more ${theme.currency}.`;
    } else if (key.name === 'f') {
      const reachable = play ? reachableLines(state, play.id) : [];
      if (reachable.length === 0) message = 'No unwritten line is within reach yet. Buy more letters.';
      else {
        findIndex = (findIndex + 1) % reachable.length;
        scriptCursor = reachable[findIndex];
      }
    }
    return draw();
  }

  if (showingSlots) {
    message = '';
    if (slotWordDraft !== null) {
      if (key.name === 'escape') {
        slotWordDraft = null;
      } else if (key.name === 'return' || key.name === 'enter') {
        const word = slotWordDraft;
        slotWordDraft = null;
        if (!setSlotWord(state, selectedSlot, word)) {
          message = `${word || 'That'} isn't a word you can spell with your letters.`;
        }
      } else if (key.name === 'backspace') {
        slotWordDraft = slotWordDraft.slice(0, -1);
      } else if (str && /^[a-z]$/i.test(str)) {
        slotWordDraft += str.toUpperCase();
      }
      return draw();
    }
    if (key.name === 'escape' || key.name === 'q') {
      showingSlots = false;
    } else if (key.name === 'tab') {
      slotDept = (slotDept + 1) % Math.max(1, departmentGenres(state).length);
      selectedSlot = departmentSlots(state, departmentGenres(state)[slotDept])[0] ?? -1;
    } else if (str === 'b') {
      if (buySlot(state, departmentGenres(state)[slotDept])) selectedSlot = state.slots.length - 1;
      else message = 'Not enough Lines (or this department has every slot). Lines come from writing lines of the play.';
    } else if (str && /^[1-9]$/.test(str)) {
      const i = departmentSlots(state, departmentGenres(state)[slotDept])[Number(str) - 1];
      if (i !== undefined) selectedSlot = i;
    } else if (
      state.slots[selectedSlot] &&
      slotGenre(state, state.slots[selectedSlot]) === departmentGenres(state)[slotDept]
    ) {
      if (str === 'w') slotWordDraft = '';
      else if (str === 'o') toggleSlot(state, selectedSlot);
      else if (key.name === 'left') moveSlot(state, selectedSlot, -1);
      else if (key.name === 'right') moveSlot(state, selectedSlot, 1);
    }
    return draw();
  }

  if (showingOptions) {
    if (key.name === 'escape' || key.name === 'q' || str === 'c') showingOptions = false;
    else if (str === '1') state.settings.autoPlaceFurniture = !state.settings.autoPlaceFurniture;
    return draw();
  }

  if (showingOffice && readingBook) {
    if (key.name === 'escape' || key.name === 'q' || str === 'b' || str === 'o') readingBook = false;
    return draw();
  }

  if (showingOffice && officeCursor) {
    message = '';
    const c = officeCursor;
    const here = roomAt(state, c.x, c.y);
    if (offeredBook >= 0) {
      const piece = offeredBook;
      offeredBook = -1;
      if (str === 'y' && readFengShuiBook(state, piece)) readingBook = true;
      else message = 'You leave the book where it was, for now.';
      return draw();
    }
    if (str === 'i' && !officeGrowing) {
      const seen = inspectSquare(state, c.x, c.y, heldFurniture);
      message = seen.text;
      offeredBook = seen.book;
      return draw();
    }
    if (buyingRoom) {
      buyingRoom = false;
      const roomless = roomlessDepartments(state);
      const g = roomless[Number(str) - 1];
      if (str !== 'b' && !g) message = 'No room bought.';
      else if (state.currency < roomCost(state)) message = `Not enough ${theme.currency}.`;
      else if (g ? buyRoom(state, 'department', g) : buyRoom(state, 'break')) {
        const room = state.office[state.office.length - 1];
        Object.assign(c, { x: room.cells[0][0], y: room.cells[0][1] });
        message = `You have a new room, the ${roomName(state, room)}, with a hallway to the rest of the office.`;
      }
      return draw();
    }
    // The cursor roams the office and one square around it.
    const b = officeBounds(state);
    const holding = heldFurniture >= 0 || !!heldDoor;
    if (key.name === 'escape' || key.name === 'q' || str === 'o') {
      if (officeGrowing) officeGrowing = '';
      else if (heldFurniture >= 0) {
        // It stays where it was, turned the way it was.
        const f = state.furniture[heldFurniture];
        if (heldTurned) f.turned = true;
        else delete f.turned;
        heldFurniture = -1;
      } else if (heldDoor) {
        state.doors.push(heldDoor.from);
        heldDoor = null;
      } else showingOffice = false;
    } else if (key.name === 'up') c.y = Math.max(b.minY - 1, c.y - 1);
    else if (key.name === 'down') c.y = Math.min(b.maxY + 1, c.y + 1);
    else if (key.name === 'left') c.x = Math.max(b.minX - 1, c.x - 1);
    else if (key.name === 'right') c.x = Math.min(b.maxX + 1, c.x + 1);
    else if (key.name === 'tab' && !officeGrowing) {
      const rooms = state.office;
      const next = rooms[(rooms.indexOf(here!) + 1) % rooms.length];
      const [x, y] = [...next.cells].sort((p, q) => p[1] - q[1] || p[0] - q[0])[0];
      Object.assign(c, { x, y });
    } else if (str === 'r' && heldFurniture >= 0) {
      if (!rotateFurniture(state, heldFurniture)) message = 'Only pieces bigger than one square turn.';
    } else if (str === 'r' && heldDoor) {
      const turn: Record<Side, Side> = { n: 'e', e: 's', s: 'w', w: 'n' };
      heldDoor.side = turn[heldDoor.side];
    } else if (str === 'x' && !holding) {
      if (officeGrowing) officeGrowing = '';
      else if (here) officeGrowing = here.id;
      else message = 'Put the cursor in the room you want to grow.';
    } else if (str === 'd' && !holding && !officeGrowing) {
      if (!cycleDoor(state, c.x, c.y)) message = here ? 'Doors go in walls onto a hallway or another room.' : 'Doors go on the edge of a room.';
    } else if (str === 'w' && !holding && !officeGrowing) {
      if (!cycleWindow(state, c.x, c.y)) message = here ? 'Windows go in walls that face outside: no hallway or room beyond.' : 'Windows go in the walls of a room.';
    } else if (str === 'b' && !holding && !officeGrowing) {
      if (state.fengShuiBook) readingBook = true;
      else message = 'You have no feng shui book. Perhaps one is hidden somewhere: inspect things with [i].';
    } else if (str === 'h' && !holding && !officeGrowing) {
      if (!toggleHall(state, c.x, c.y)) message = 'That square is part of a room. Hallways go outside rooms.';
    } else if (str === 'r' && !officeGrowing) {
      buyingRoom = true;
      const roomless = roomlessDepartments(state).map((g, i) => `[${i + 1}] a room for ${genreNames[g]}`);
      message = `Buy a room (${formatNumber(roomCost(state))} ${theme.currency}): ${[...roomless, '[b] a break room for furniture'].join('   ')}   (any other key cancels)`;
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      // Space (or enter) picks up and puts down: furniture first, else a door in the square's walls.
      if (officeGrowing) {
        const room = state.office.find((r) => r.id === officeGrowing);
        if (here) message = 'That square is already part of a room. Choose a +.';
        else if (state.currency < squareCost(state)) message = `Not enough ${theme.currency}.`;
        else if (!room || !expandRoom(state, room.id, [c.x, c.y])) message = 'Rooms grow onto empty squares next to them, not touching another room. Choose a +.';
      } else if (heldFurniture >= 0) {
        const f = state.furniture[heldFurniture];
        if (here && moveFurniture(state, heldFurniture, here.id, c.x, c.y)) heldFurniture = -1;
        else if (!here) message = 'Furniture goes inside a room.';
        else if (f.kind === desk.id && f.room !== here.id) message = "Desks stay in their department's room.";
        else if (!allowedIn(state, f.kind, here.id))
          message = `The ${furnitureName(state, heldFurniture)} only goes in ${furnitureKinds.find((k) => k.id === f.kind)?.rooms.includes('break') ? 'break rooms' : "departments' rooms"}.`;
        else message = `It doesn't fit there: every square it takes must be free floor in one room.${pieceSize(f.kind).join() === '1,1' ? '' : ' [r] turns it.'}`;
      } else if (heldDoor) {
        if (placeDoor(state, c.x, c.y, heldDoor.side)) heldDoor = null;
        else message = here ? `No door fits the ${sideName[heldDoor.side]} wall here: it needs a hallway or another room behind it. [r] tries the next wall.` : 'Doors go in the walls of a room.';
      } else {
        const spot = here ? cellAt(state, here.id, c.x, c.y) : null;
        const door = typeof spot === 'number' || !here ? undefined : takeDoor(state, c.x, c.y);
        if (typeof spot === 'number') {
          heldFurniture = spot;
          heldTurned = !!state.furniture[spot].turned;
          // A bigger piece is held by its top left square.
          Object.assign(c, { x: state.furniture[spot].x, y: state.furniture[spot].y });
        } else if (door) heldDoor = { from: door, side: door.side };
        else message = !here ? 'Nothing to pick up there.' : 'No furniture or door there. Buy furniture in the Decor and Comforts stores; [d] adds a door.';
      }
    }
    return draw();
  }

  if (showingStats || showingDictionary || showingAchievements) {
    const maxRow = Math.max(0, Math.ceil(dictionaryWords(state).length / dictionaryColumns) - dictionaryPageRows);
    const turnTo = (page: 't' | 'w' | 'a') => {
      showingStats = page === 't';
      showingDictionary = page === 'w';
      showingAchievements = page === 'a';
    };
    if (key.name === 'escape' || key.name === 'q') {
      showingStats = showingDictionary = showingAchievements = false;
    } else if (!showingDictionary && (str === 't' || str === 'w' || str === 'a')) {
      turnTo(str);
    } else if (showingDictionary && str === 't') {
      turnTo(str);
    } else if (showingAchievements && (key.name === 'up' || key.name === 'down')) {
      const last = Math.max(0, achievements.length - achievementPageRows);
      achievementRow = Math.max(0, Math.min(last, achievementRow + (key.name === 'up' ? -1 : 1)));
    } else if (showingDictionary && key.name === 'up') {
      dictionaryRow = Math.max(0, Math.min(dictionaryRow, maxRow) - 1);
    } else if (showingDictionary && key.name === 'down') {
      dictionaryRow = Math.min(maxRow, dictionaryRow + 1);
    } else if (showingDictionary && key.name === 'pageup') {
      dictionaryRow = Math.max(0, Math.min(dictionaryRow, maxRow) - dictionaryPageRows);
    } else if (showingDictionary && key.name === 'pagedown') {
      dictionaryRow = Math.min(maxRow, dictionaryRow + dictionaryPageRows);
    } else if (showingDictionary && str && /^[a-z]$/i.test(str)) {
      dictionaryRow = Math.min(maxRow, dictionaryRowFor(state, str));
    }
    return draw();
  }

  if (showingDev) {
    message = '';
    const tool = str && /^[1-9]$/.test(str) ? devTools[Number(str) - 1] : undefined;
    if (key.name === 'escape' || str === '`' || key.name === 'q') showingDev = false;
    else if (tool) {
      tool.apply(state);
      message = `Done: ${tool.label}.`;
    }
    return draw();
  }

  if (showingKeys) {
    message = '';
    if (key.name === 'escape' || key.name === 'q') {
      showingKeys = false;
    } else if (str && /^[1-9]$/.test(str)) {
      const k = keyChoices(state)[Number(str) - 1];
      if (k) message = buyKey(state, k) ? `You bought the ${k} key.` : `Not enough ${theme.currency}.`;
    }
    return draw();
  }

  message = '';
  if (key.name === 'q') {
    return quit();
  } else if (state.owned.length === 0 && state.departments.length === 0) {
    const g = departmentChoices(state)[Number(str) - 1];
    if (g) openDepartment(state, g);
  } else if (state.owned.length === 0) {
    const pick = starterScenes(state)[Number(str) - 1];
    if (pick) {
      chooseStarterScene(state, pick.play.id, pick.scene.key);
      scriptPlay = Math.max(0, availablePlays().indexOf(pick.play));
      scriptCursor = pick.scene.lines[0];
    }
  } else if (state.letters.length === 0) {
    if (str) chooseFirstLetter(state, str);
  } else if (key.name === 'return' || key.name === 'enter') {
    const i = poke(state);
    if (i >= 0) message = `You pet ${monkeyName(state, i)}. <3`;
  } else if (key.name === 'space') {
    shop = shop ? null : lastStore;
    storePage = 0;
  } else if (shop && (key.name === 'tab' || key.name === 'right' || key.name === 'left')) {
    const step = key.name === 'left' ? stores.length - 1 : 1;
    shop = lastStore = stores[(stores.indexOf(shop) + step) % stores.length];
    storePage = 0;
  } else if (shop && (key.name === 'up' || key.name === 'down')) {
    const pages = storePages(state, shop);
    storePage = (storePage + (key.name === 'up' ? pages - 1 : 1)) % pages;
  } else if (shop && str === 'i') {
    inspecting = true;
    message = 'Inspect which item? Press 1-9.';
  } else if (shop && str && /^[1-9]$/.test(str)) {
    const item = storeChoices(state, shop, storePage)[Number(str) - 1];
    if (item?.id) buyItem(item.id);
  } else if (str === 'm') {
    pickingManager = true;
    message = `Promote which monkey to manager (or send a manager back to typing)? Press 1-${Math.min(9, state.monkeys.length)}.`;
  } else if (str === 'd') {
    if (state.monkeys.length === 1) message = 'You need more monkeys and departments first.';
    else {
      pickingMonkeyToMove = true;
      message = `Move which monkey to its next department? Press 1-${Math.min(9, state.monkeys.length)}.`;
    }
  } else if (str === 'n') {
    if (state.monkeys.length === 1) startNaming(0);
    else {
      pickingMonkeyToName = true;
      message = `Name which monkey? Press 1-${Math.min(9, state.monkeys.length)}.`;
    }
  } else if (key.name === 'p') {
    openScript();
  } else if (str === '`') {
    showingDev = true;
  } else if (str === 'o') {
    openOffice();
  } else if (str === 'c') {
    showingOptions = true;
  } else if (str === 't') {
    showingStats = true;
  } else if (str === 'a') {
    showingAchievements = true;
  } else if (str === 'w') {
    showingDictionary = true;
    dictionaryRow = 0;
  } else if (str === 'f' && canPublishFolio(state)) {
    confirmingFolio = true;
    message = folioPrompt(state);
  } else if (key.name === 's') {
    save(state, storage);
    message = `Saved to ${savePath}.`;
  } else if (key.name === 'r') {
    confirmingReset = true;
    message = 'Erase all progress? Press y to confirm, any other key to cancel.';
  }
  draw();
}

if (!process.stdin.isTTY) {
  console.error('The game needs an interactive terminal. Run it with `npm start`.');
  process.exit(1);
}

emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', handleKey);
process.stdout.write('\x1b[?25l'); // hide cursor

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  tick(state, (now - last) / 1000);
  last = now;
  draw();
}, FRAME_MS);

setInterval(() => save(state, storage), AUTOSAVE_MS);
process.on('SIGTERM', quit);
draw();
