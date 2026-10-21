import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';
import { achievements, safe, research, hr, marketing, codebreaking, records, library, departmentRules, desk, furnitureKinds, type RoomKind, hatColors, hats, maxMonkeyNameLength, maxPinnedLines, startingLetters, theme } from '../game/config';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isForeign, textToWords, type Genre, type PlayData } from '../game/plays';
import {
  applyOfflineProgress,
  dyeHat,
  hatCost,
  placeStoredFurniture,
  wearHat,
  buyFurniture,
  allowedIn,
  readFengShuiBook,
  readManagerBook,
  officelessDepartments,
  setHour,
  startResearch,
  projectOf,
  canBuildLab,
  canBuildHR,
  canBuildMarketing,
  canRemoveFurniture,
  storeFurniture,
  sellFurniture,
  sellValue,
  sellHat,
  fireBlocker,
  fireMonkey,
  hrRoom,
  isTemp,
  cellAt,
  pieceSize,
  furnitureSpot,
  furnitureCost,
  dyeCost,
  moveFurniture,
  swapFurniture,
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
  nextPin,
  buySection,
  unpinPlayerLines,
  getPlay,
  sceneOf,
  starterPlays,
  starterGenre,
  departmentChoices,
  canAffordLetter,
  moveMonkeyTo,
  posts,
  postOf,
  hireFor,
  type Post,
  assignMonkey,
  departmentsWithRoom,
  departmentTypists,
  departmentGenres,
  departmentSlots,
  slotGenre,
  upgradeManager,
  openDepartment,
  buyComboStart,
  comboCap,
  comboStart,
  buyKey,
  monkeyName,
  renameMonkey,
  buySlot,
  chooseStarterPlay,
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
  flipCoin,
  moveHat,
  hatKey,
  storedFitting,
  swapTypewriters,
  folioMultiplier,
  tick,
  togglePin,
  toggleSlot,
  moveRoomBy,
  newRoomCells,
  roomFitsAt,
  suggestRoomSpot,
  findSafe,
  canBuildCodebreaking,
  canBuildRecords,
  canBuildLibrary,
  libraryGalleries,
  galleryCost,
  libraryFull,
  buyGallery,
  cycleCodebreakFocus,
  switchClassical,
  latinUnlocked,
  noteRevealed,
  labRoom,
} from '../game/logic';
import { deserialize, SAVE_VERSION, save, saveVersions } from '../game/save';
import { GAME_VERSION } from '../version';
import { createInitialState, type Door, type GameState, type Room, type Side } from '../game/state';
import { formatMultiplier, formatNumber, setScientific, formatPrice } from '../format';
import { fileStorage } from './fileStorage';
import {
  keyChoices,
  renderLetterPicker,
  unownedLetters,
  departmentName,
  departmentPrompt,
  upgradeColumns,
  type UpgradeKind,
  renderKeysMenu,
  renderScreen,
  renderHomeKeys,
  homeView,
  homeViews,
  folioPrompt,
  lineRoom,
  renderScript,
  renderContents,
  openStores,
  storeChoices,
  renderShop,
  storePageSize,
  type Store,
  type ScriptSpot,
  homeChosen,
  promptChoices,
  homeMonkeys,
  maxMonkeyLines,
  trainees,
  renderDevMenu,
  contentsPageSize,
  renderSlotsMenu,
  scriptPageSize,
  renderOptions,
  renderCoinFlip,
  renderTelegrams,
  tabPlays,
  textsTabs,
  type TextsTab,
  focusName,
  dyeColorPrompt,
  dyePick,
  hatPick,
  inspectItem,
  pageTabsRow,
  pageNames,
  scriptKeys,
  shopKeys,
  pagesFor,
  revealKeys,
  pageTabs,
  type Page,
  type Tab,
} from './screen';
import { bookRows, renderBook, renderLibrary } from './library';
import { bold, dim, fillHeight, forLightBackground, inverseSpan, placeScreen, screenTop, showCursors } from './style';
import { labelPress, mouseOff, mouseOn, mousePress, parseMouse, targetAt, type MouseEvent } from './mouse';
import { devTools } from '../game/dev';
import { setLexicon } from '../game/grammar';
import { columnBox, keyBox, promptBox, menuBox, overlay, postName, renderCandidates, renderPostPopup } from './hiring';
import { hatChoices, inventoryRows, itemName, renderHatPicker, renderInventory, renderMonkeyPicker, type Holder, type Item } from './inventory';
import { renderRoster, rosterActions, rosterKeys, rosterOrder } from './roster';
import { achievementPageRows, dictionaryColumns, dictionaryPageRows, dictionaryRowFor, dictionaryWords, renderAchievements, renderDictionary, renderStats } from './stats';
import { legendSize, renderFurniturePicker, sideName, furnitureName, inspectSquare, libraryBooks, renderFengShuiBook, renderManagerBook, renderOffice, renderOfficeHelp, roomName, type Cell } from './office';
import { cycleDoor, cycleWindow, doorBetween, loungeOf, officeBounds, placeDoor, roomAt, servedBy, takeDoor, toggleHall, touchingRooms } from '../game/layout';

const FRAME_MS = 250;
const AUTOSAVE_MS = 10_000;

setWordList(loadWordList());
setLexicon(readFileSync(fileURLToPath(new URL('../../data/lexicon.txt', import.meta.url)), 'utf8').split(/\r?\n/));
setPlays(loadPlays());

const savePath = resolve(process.env.IDLE_SAVE ?? 'save.json');
const storage = fileStorage(savePath);

// A save from another version of the game is copied aside before it's updated, so it's never lost.
const savedRaw = storage.read();
const saved = saveVersions(savedRaw);
const fromVersion = saved && saved.gameVersion !== GAME_VERSION ? saved.gameVersion || 'an older version' : '';
const backupPath = fromVersion ? savePath.replace(/(\.json)?$/, `-${saved!.gameVersion ? `v${saved!.gameVersion}` : 'old'}.json`) : '';
if (backupPath && savedRaw && !existsSync(backupPath)) writeFileSync(backupPath, savedRaw);
let state = deserialize(savedRaw);
setScientific(state.settings.scientific);
/** Monkey lines run to the screen's edge, then start over. Returns the screen's width. */
function fitLines(): number {
  const columns = process.stdout.columns || 80;
  if (state.monkeys.length > 0) setLineWidth(lineRoom(state, columns));
  return columns;
}

fitLines();
let achievementsSeen = state.achievements.length; // achievements unlocked by now; newer ones get a message
setHour(new Date().getHours());

/** The temps working now, by M-number, to tell when one leaves. */
function tempsNow(): Map<number, string> {
  return new Map(state.monkeys.flatMap((m, i) => (isTemp(m) ? [[m.number, monkeyName(state, i)] as [number, string]] : [])));
}

/** A message for temps that left since `before` ('' if none). */
function tempsGone(before: Map<number, string>): string {
  const gone = [...before].filter(([n]) => !state.monkeys.some((m) => m.number === n)).map(([, name]) => name);
  return gone.length === 0 ? '' : `${gone.join(', ')} finished ${gone.length === 1 ? 'its' : 'their'} temp job${gone.length === 1 ? '' : 's'} and left. The desk is free.`;
}

const tempsBefore = tempsNow();
const offline = applyOfflineProgress(state, Date.now());
let message = [
  fromVersion
    ? `Your save was updated from ${/^\d/.test(fromVersion) ? `v${fromVersion}` : fromVersion} to v${GAME_VERSION}${saved!.version > SAVE_VERSION ? ' (it came from a newer game; some things may not carry over)' : ''}. The old save is kept in ${backupPath}.`
    : '',
  offline >= 1 ? `While you were away your monkeys earned ${formatNumber(offline)} ${theme.currency}.` : '',
  tempsGone(tempsBefore),
]
  .filter(Boolean)
  .join(' ');
let confirmingReset = false;
let confirmingFolio = false;
let flipping: '' | 'ask' | 'done' = ''; // the coin flip screen ([?] from anywhere): asking, or showing how it went
let flipMessage = '';
let pickingLetter: boolean | 'free' = false; // picking a letter to buy, or to take for a free letter
let showingScript = false;
let scriptCursor = 0;
let contents: '' | 'plays' | 'scenes' = ''; // the script's table of contents, when open
let contentsCursor = 0;
let contentsTab: TextsTab = 'plays'; // the Texts page's tab: plays, foreign texts or codes
let scriptPlay = 0; // index into availablePlays()
let findIndex = -1;
let showingKeys = false;
let showingHelp = false; // the [/] page: every key on the home screen
let showingDev = false;
let showingStats = false;
let showingRoster = false; // the roster of monkeys ([m])
let confirmingFire = false; // [f] in the roster asks first
let rosterCursor = 0; // the chosen monkey's place in rosterOrder
let showingAchievements = false;
let achievementRow = 0;
let showingOffice = false;
let officeLegend: number | null = null; // the office map's legend: null while hidden, else the item its cursor is on
let officeCursor: Cell | null = null; // the selected cell on the office map
let officeGrowing = ''; // id of the room whose new square is being chosen
let buyingRoom = false; // choosing what room to buy on the office map
let placingRoom: { kind: RoomKind; genre?: Genre; at: [number, number] } | null = null; // a new room being put in place with the arrows
let movingRoom: { id: string; dx: number; dy: number } | null = null; // a room picked up to move
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
let upgrading: { kind: UpgradeKind; col: number; row: number } | null = null; // the upgrade popup: Faster typing, a typewriter or a manager, by department
let readingBook = false; // the feng shui book, open from the office map
let readingManagerBook = false; // the manager's book, open from the office map
let officeHelp = false; // the office map's [/] page: how rooms and lounges work
let offeredBook = -1; // the piece hiding a book (feng shui or the manager's), just inspected: [y] reads it
let bookMenu = ''; // its popup: the books you can read there, as a picker prompt
let menuCursor = 0; // the chosen row of the open menu (opening screens, options, dev tools, keys, hiring)
let letterCursor = 0; // the chosen letter in the letter picker, among the letters not owned
let pickCursor = 0; // the chosen choice of a picker on the message line
let homeCursor = 0; // the chosen monkey's row in the home screen's table
let shopCursor = 0; // the chosen item in the open store, counted over all its pages
let officeShop: Store | null = null; // the office map's furniture shop, when open
let lastOfficeStore: Store = 'furniture';
let scriptShop = false; // the script page's shop, when open
let giving: { kind: 'hat'; id: string } | { kind: 'dye'; color: string } | null = null; // the menu of monkeys to give a hat or dye to
let showingInventory = false;
let invRow = 0; // the inventory cursor's row (monkeys, then storage) and item in it
let invCol = 0;
let invHeld: { who: Holder; item: Item } | null = null; // the item being moved in the inventory
// A popup list to pick from: hats for a monkey's hat spot (inventory), or stored furniture for a room (office map).
let picker: { kind: 'hat'; monkey: number } | { kind: 'furniture'; room: string } | null = null;
let pickerCursor = -1;
const pickerChoices = (): string[] => (!picker ? [] : picker.kind === 'hat' ? hatChoices(state, picker.monkey) : storedFitting(state, picker.room));
let pickingDyeColor = false; // choosing which colour to dye
let pickingDepartment = false;
let pickingDeptFor: '' | 'assign' = ''; // choosing a department for a new monkey
let readingTelegrams = false; // the telegrams in Enigma
let showingLibrary = false; // the Library's galleries, from the office map
let libraryCursor = 0; // the gallery chosen
let readingShelf: { id: string; top: number } | null = null; // a book from the Library, open
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

/** Choosing who to hire on HR's list of candidates, before the department popup. */
let hiring = false;
let keyMenu: { title: string; keys: [string, string][] } | null = null; // a popup of keys: a page's every key ([/]) or the roster's actions ([enter])
let keyMenuCursor = -1;
let pageMenu: Page | null = null; // the [tab] menu (a popup of every page), open: the page it was opened from
let pageMenuCursor = -1;
/** The department popup (Justin, 2026-10-18): for a hire (from: the candidate on HR's list, if one), or to move monkey `monkey`. */
let choosingPost: { kind: 'hire'; from?: number } | { kind: 'move'; monkey: number } | null = null;
let postCursor = 0;

/** The departments the popup offers: all of them for a hire, the others (no manager's chair) for a move. */
function postList(): Post[] {
  if (choosingPost?.kind !== 'move') return posts(state);
  const m = state.monkeys[choosingPost.monkey];
  return posts(state, false).filter((p) => !m || p.id !== postOf(state, m));
}

/** Hires a monkey: HR's list of candidates first once there's an HR office, then the department popup. */
function startHire(): void {
  if (!posts(state).some((p) => !p.blocked)) {
    message = noSeatMessage();
    return;
  }
  message = '';
  if (hrRoom(state)) {
    hiring = true;
    menuCursor = 0;
  } else {
    choosingPost = { kind: 'hire' };
    postCursor = 0;
  }
}

/** Opens the department popup to move monkey `i`. */
function startMove(i: number): void {
  if (i < 0 || !state.monkeys[i]) return;
  choosingPost = { kind: 'move', monkey: i };
  if (postList().length === 0) {
    choosingPost = null;
    message = 'There is no other department to move to yet.';
    return;
  }
  postCursor = 0;
  message = '';
}

/** The department popup's lines. */
function postPopup(): string[] {
  const c = choosingPost!;
  const title = c.kind === 'hire' ? 'Which department gets the new monkey?' : `Move ${monkeyName(state, c.monkey)} to which department?`;
  return renderPostPopup(state, title, postList(), postCursor, c.kind === 'hire', c.kind === 'hire' ? c.from : undefined);
}

/** Picks a department in the popup: hires or moves, or says why not. */
function pickPost(p: Post): void {
  const c = choosingPost!;
  if (p.blocked) {
    message = `${postName(state, p)} can't take a monkey: ${p.blocked}.${/office|door|desk|room/.test(p.blocked) ? ' See the office map ([o]).' : ''}`;
    return;
  }
  if (c.kind === 'move') {
    const name = monkeyName(state, c.monkey);
    if (moveMonkeyTo(state, c.monkey, p.id)) message = `${name} now works in ${postName(state, p)}.`;
    // The roster's cursor stays on the monkey that moved.
    rosterCursor = Math.max(0, rosterOrder(state).indexOf(c.monkey));
    choosingPost = null;
    return;
  }
  if (hireFor(state, p, c.from)) {
    choosingPost = null;
    hiring = false;
    welcome(state.monkeys.length - 1);
  } else message = `Not enough ${theme.currency}.`;
}

/** Acts on a store item chosen with 1-9 (see storeItems). */
function buyItem(id: string): void {
  if (id === 'train' || id === 'typewriter') {
    const what = id === 'train' ? 'skill' : 'typewriter';
    const team = trainees(state);
    if (team.length === 0) message = 'Temps can\'t be upgraded.';
    else if (team.length === 1) message = buyTyping(team[0], what);
    else if (team.length > 1) {
      upgrading = { kind: what, col: 0, row: 0 };
      message = '';
    }
  } else if (id === 'letter') {
    if (state.currency < letterCost(state.letters.length)) {
      message = `Not enough ${theme.currency}.`;
    } else if (state.words < letterWordsCost(state.letters.length)) {
      message = 'Not enough Words. You earn a Word for each different word your monkeys spell.';
    } else {
      pickingLetter = true;
      letterCursor = 0;
      message = '';
    }
  } else if (id === 'hire') {
    startHire();
  } else if (id === 'assign') {
    if (!canSeatMonkey(state)) message = noSeatMessage();
    else if (assignMonkey(state)) welcome(state.monkeys.length - 1);
    else {
      pickingDeptFor = 'assign';
      message = deptPrompt('Which department gets the new monkey?');
    }
  } else if (id === 'codefocus') {
    message = cycleCodebreakFocus(state) ? `${codebreaking.name} turns to ${focusName(state.codebreakFocus)}.` : 'Nothing else to work on.';
  } else if (id === 'telegram') {
    readingTelegrams = true;
  } else if (id === 'classical') {
    switchClassical(state);
    message = `The Classical department types ${state.classical === 'greek' ? 'Greek' : 'Latin'} now.`;
  } else if (id.startsWith('research:')) {
    const p = projectOf(id.slice('research:'.length));
    if (!p) return;
    if (state.researching) message = `${research.name} works on one project at a time.`;
    else if (state.currency < p.cost) message = `Not enough ${theme.currency}.`;
    else if (startResearch(state, p.id)) message = `${research.name} is researching ${p.name}.`;
  } else if (id === 'combo') {
    if (!buyComboStart(state)) message = comboStart(state) >= comboCap(state) ? 'Combos already start at the cap.' : noSentences;
  } else if (id === 'keys') {
    showingKeys = true;
    menuCursor = 0;
  } else if (id === 'slots') {
    showingSlots = true;
    if (slotDept >= departmentGenres(state).length) slotDept = 0;
    selectedSlot = departmentSlots(state, departmentGenres(state)[slotDept])[0] ?? -1;
  } else if (id === 'department') {
    pickingDepartment = true;
    message = departmentPrompt(state);
  } else if (id === 'manager') {
    upgrading = { kind: 'manager', col: 0, row: 0 };
    message = '';
  } else if (id.startsWith('section:')) {
    buyScriptText();
  } else if (id.startsWith('hat:')) {
    const what = id.slice('hat:'.length);
    if (state.monkeys.length === 1) message = wearHatOn(0, what);
    else {
      giving = { kind: 'hat', id: what };
      menuCursor = 0;
      message = '';
    }
  } else if (id === 'dye') {
    if (!state.monkeys.some((m) => m.hat)) message = 'No monkey is wearing a hat to dye.';
    else {
      pickingDyeColor = true;
      message = dyeColorPrompt();
    }
  } else if (id.startsWith('furniture:')) {
    // It goes where it works first, else in any room it fits.
    const kind = id.slice('furniture:'.length);
    if (!furnitureSpot(state, kind))
      message = `No room for it: it needs ${pieceSize(kind).join(' x ')} free squares in one room${kind === safe.id ? " (a manager's office without a safe)" : ''}. Make space or grow a room on the office map ([o]).`;
    else if (state.sentences < furnitureCost(state, kind)) message = 'Not enough Sentences.';
    else if (buyFurniture(state, kind)) {
      const i = state.furniture.length - 1;
      if (state.settings.autoPlaceFurniture) message = `The ${furnitureName(state, i)} is in.${officeShop ? '' : ' Move it on the office map with [o].'}`;
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
  if (state.sentences < hatCost(state, id)) return noSentences;
  const old = m.hat ? hats.find((h) => h.id === m.hat)!.name.toLowerCase() : '';
  return wearHat(state, i, id) ? `${name} puts on a new ${hatName}.${old ? ` Its ${old} goes into your inventory.` : ''}` : noSentences;
}

/** Dyes monkey `i`'s hat `color` ('' washes it out); returns the message to show. */
function dyeHatOn(i: number, color: string): string {
  const m = state.monkeys[i];
  const name = monkeyName(state, i);
  if (!m.hat) return `${name} isn't wearing a hat.`;
  if (m.hatColor === color) return `${name}'s hat is that colour already.`;
  if (color && state.sentences < dyeCost(state)) return noSentences;
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

/** Rooms on offer by number on the office map: a room for each department without one, then a manager's office for each without one. */
function roomChoices(): { kind: RoomKind; genre?: Genre }[] {
  return [
    ...roomlessDepartments(state).map((genre) => ({ kind: 'department' as const, genre })),
    ...officelessDepartments(state).map((genre) => ({ kind: 'office' as const, genre })),
    ...(canBuildLab(state) ? [{ kind: 'lab' as const }] : []),
    ...(canBuildHR(state) ? [{ kind: 'hr' as const }] : []),
    ...(canBuildMarketing(state) ? [{ kind: 'marketing' as const }] : []),
    ...(canBuildCodebreaking(state) ? [{ kind: 'codebreaking' as const }] : []),
    ...(canBuildLibrary(state) ? [{ kind: 'library' as const }] : []),
    ...(canBuildRecords(state) ? [{ kind: 'records' as const }] : []),
  ];
}

/** The office as the map shows it: with the room being placed or moved where it would go. */
function officeView(): GameState {
  if (!placingRoom && !movingRoom) return state;
  const view = structuredClone(state);
  if (placingRoom) view.office.push({ id: 'new', kind: placingRoom.kind, department: placingRoom.genre ?? '', cells: newRoomCells(placingRoom.kind, placingRoom.at) });
  else if (movingRoom) {
    const { id, dx, dy } = movingRoom;
    const room = view.office.find((r) => r.id === id)!;
    const inRoom = (x: number, y: number) => room.cells.some(([cx, cy]) => cx === x && cy === y);
    view.windows = view.windows.map((w) => (inRoom(w.x, w.y) ? { ...w, x: w.x + dx, y: w.y + dy } : w));
    view.doors = view.doors.filter((d) => !inRoom(d.x, d.y));
    room.cells = room.cells.map(([x, y]) => [x + dx, y + dy]);
    for (const f of view.furniture) if (f.room === id) Object.assign(f, { x: f.x + dx, y: f.y + dy });
  }
  return view;
}

/** The map's cursor: on the top-left square of a room being placed or moved. */
function roomCursor(): { x: number; y: number } | null {
  if (placingRoom) return { x: placingRoom.at[0], y: placingRoom.at[1] };
  if (movingRoom && officeCursor) return { x: officeCursor.x + movingRoom.dx, y: officeCursor.y + movingRoom.dy };
  return officeCursor;
}

/** Whether the room being placed or moved can stand where it is now. */
function roomSpotOk(): boolean {
  if (placingRoom) return roomFitsAt(state, placingRoom.kind, placingRoom.genre ?? '', newRoomCells(placingRoom.kind, placingRoom.at));
  const room = movingRoom && state.office.find((r) => r.id === movingRoom!.id);
  return !!room && roomFitsAt(state, room.kind, room.department, room.cells.map(([x, y]) => [x + movingRoom!.dx, y + movingRoom!.dy]), room.id);
}

/** The message line while placing or moving a room: whether it fits, and the keys. */
function roomSpotPrompt(): string {
  const what = placingRoom ? 'Placing the new room' : `Moving the ${roomName(state, state.office.find((r) => r.id === movingRoom?.id)!)}`;
  const kind = placingRoom?.kind ?? state.office.find((r) => r.id === movingRoom?.id)?.kind;
  const why = kind === 'office' ? "a manager's office must touch its department's room" : 'rooms need empty floor, and two rooms of one kind keep a hallway apart';
  return `${what}: arrows move it, ${roomSpotOk() ? `[enter] ${placingRoom ? 'builds' : 'puts'} it here` : `it can't go here (${why})`}, [esc] cancels.`;
}

/** What the message line says about a newly built room. */
function newRoomMessage(room: Room): string {
  const next = touchingRooms(state, room).filter((r) => doorBetween(state, room, r)).map((r) => `the ${roomName(state, r)}`);
  const served = room.kind === 'break' ? servedBy(state, room).map((r) => `the ${roomName(state, r)}`) : [];
  const lounge = room.kind === 'department' ? loungeOf(state, room) : undefined;
  return [
    `You have a new room, the ${roomName(state, room)}, ${next.length > 0 ? `with a door straight into ${next.join(' and ')}` : 'with a hallway to the rest of the office'}.`,
    ...(served.length > 0 ? [`It's the lounge of ${served.join(' and ')}.`] : []),
    ...(lounge ? [`Its lounge is the ${roomName(state, lounge)}.`] : []),
    ...(room.kind === 'office' ? ["It comes with a manager's desk. Hire a manager in the Staff store."] : []),
    ...(room.kind === 'lab' ? ['Hire researchers for it in the Staff store.'] : []),
    ...(room.kind === 'hr' ? ['Hire HR monkeys for it in the Staff store.'] : []),
    ...(room.kind === 'marketing' ? ['Hire marketing monkeys for it in the Staff store: they earn royalties on finished scenes and Folios.'] : []),
    ...(room.kind === 'library' ? [`Every finished play, text and Folio is shelved here. [i] on it to go in.${latinUnlocked(state) ? ' A book in Latin waits on its first shelf, and the Greek department is now the Classical department.' : ''}`] : []),
    ...(room.kind === 'codebreaking' ? ['Hire codebreakers for it in the Staff store: they try combinations on a safe you found.'] : []),
    ...(room.kind === 'records' ? [`Hire records clerks for it in the Staff store: they write down the monkeys' grammatical sentences, ${records.bookSize} to a book, and full books go to the ${library.name}.`] : []),
  ].join(' ');
}

/** The office map's furniture shop: under the map when the screen is tall enough for both, else on its own. */
function officeShopScreen(columns: number): string {
  const both = renderOffice(state, '', officeCursor, -1, false, null, columns, renderShop(state, officeShop!, shopCursor, message, columns, true, undefined, true));
  const rows = process.stdout.rows || 0;
  return rows > 0 && both.split('\n').length > rows ? renderShop(state, officeShop!, shopCursor, message, columns, false, undefined, true) : both;
}

/** Rows of a book the screen has room for. */
function bookHeight(): number {
  return Math.max(5, (process.stdout.rows || 30) - 8);
}

/** Opens the office map with the cursor in the top-left corner of the first room. */
/** Closes every screen, menu and popup: back to the home screen. */
function goHome(): void {
  showingScript = showingKeys = showingHelp = showingDev = showingStats = showingRoster = showingAchievements = false;
  showingOffice = showingOptions = showingDictionary = showingSlots = showingInventory = showingLibrary = false;
  readingBook = readingManagerBook = officeHelp = readingTelegrams = scriptShop = hiring = false;
  pickingDyeColor = pickingDepartment = buyingRoom = false;
  upgrading = null;
  confirmingFire = false;
  contents = '';
  pickingDeptFor = '';
  flipping = '';
  shop = officeShop = null;
  giving = picker = choosingPost = readingShelf = invHeld = null;
  officeLegend = null;
  officeGrowing = '';
  offeredBook = -1;
  message = '';
}

/** The page open now, for the navigation bar, or null on a screen inside one (a book, a picker, help, a question). */
function currentPage(): Page | null {
  if (upgrading || flipping || readingTelegrams || readingShelf || showingLibrary || pickingLetter || giving || hiring || picker || choosingPost || keyMenu || pageMenu || pickerOpen()) return null;
  if (namingMonkey >= 0 || confirmingReset || confirmingFolio || confirmingFire || showingHelp || showingDev || showingKeys || showingSlots) return null;
  if (showingOffice) return readingBook || readingManagerBook || officeHelp ? null : 'office';
  if (showingInventory || showingRoster) return 'monkeys';
  if (showingScript) return 'texts';
  if (showingStats || showingDictionary || showingAchievements) return 'records';
  if (showingOptions) return 'options';
  return shop === 'research' ? 'research' : shop ? 'shop' : 'home';
}

/** The open page's tab, on pages that have tabs. */
function currentTab(): Tab | undefined {
  if (showingInventory) return 'inventory';
  if (showingRoster) return 'roster';
  if (showingStats) return 'statistics';
  if (showingAchievements) return 'achievements';
  if (showingDictionary) return 'dictionary';
  return undefined;
}

/** Opens a page of the navigation bar, or one of its tabs. */
function goTo(target: Page | Tab): void {
  goHome();
  if (target === 'shop' || target === 'research') {
    shop = target === 'research' ? 'research' : lastStore;
    shopCursor = 0;
  } else if (target === 'monkeys' || target === 'roster') showingRoster = true;
  else if (target === 'inventory') {
    showingInventory = true;
    invHeld = null;
  } else if (target === 'office') openOffice();
  else if (target === 'texts') openScript();
  else if (target === 'records' || target === 'statistics') showingStats = true;
  else if (target === 'achievements') showingAchievements = true;
  else if (target === 'dictionary') {
    showingDictionary = true;
    dictionaryRow = 0;
  } else if (target === 'options') {
    showingOptions = true;
    menuCursor = 0;
  }
}

function openOffice(): void {
  showingOffice = true;
  officeShop = null;
  officeLegend = null;
  heldFurniture = -1;
  officeGrowing = '';
  buyingRoom = false;
  placingRoom = movingRoom = null;
  message = '';
  if (!officeCursor) {
    const [x, y] = state.office[0].cells[0];
    officeCursor = { x, y };
  }
}

/** Opens the script browser on the play you're working on. */
function openScript(): void {
  showingScript = true;
  scriptShop = false;
  contents = '';
  const work = currentWork(state);
  if (work) {
    scriptPlay = Math.max(0, availablePlays().findIndex((p) => p.id === work.play));
    scriptCursor = work.index;
  }
}

/** Where the script page's cursor is, for its shop. */
function scriptSpot(): ScriptSpot {
  return { play: availablePlays()[scriptPlay]?.id ?? '', line: scriptCursor };
}

/** Buys the whole text (w) under the script page's cursor. */
function buyScriptText(): void {
  const play = availablePlays()[scriptPlay];
  if (!play) return;
  message = buySection(state, play.id)
    ? `You bought ${play.title}.`
    : `Can't buy ${play.title}: it's owned already or you need more ${theme.currency}.`;
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

/** Whether a key is one of the open store's own (see shopKey); other keys still work as on the home screen. */
function isShopKey(str: string | undefined, key: { name?: string }): boolean {
  return ['up', 'down', 'left', 'right', 'return', 'enter', 'escape', 'space'].includes(key.name ?? '') || (!!str && /^[1-9[\]i]$/.test(str));
}

/**
 * A key in an open store (the main shop or the office map's): up/down choose,
 * enter or 1-9 buy, [ ] or left/right switch stores, i inspects, esc (or
 * space, in the main shop) closes. Returns the store now open, or null once closed.
 */
function shopKey(store: Store, str: string | undefined, key: { name?: string }): Store | null {
  const at = store === 'script' ? scriptSpot() : undefined;
  const items = storeChoices(state, store, -1, at);
  const page = Math.floor(shopCursor / storePageSize);
  if (key.name === 'escape' || (key.name === 'space' && (store === shop || store === 'script'))) return null;
  if (key.name === 'up' || key.name === 'down') {
    if (items.length > 0) shopCursor = (shopCursor + (key.name === 'up' ? items.length - 1 : 1)) % items.length;
  } else if (key.name === 'left' || key.name === 'right' || str === '[' || str === ']') {
    const open = openStores(state, store, store === officeShop);
    const back = key.name === 'left' || str === '[';
    shopCursor = 0;
    return open[(open.indexOf(store) + (back ? open.length - 1 : 1)) % open.length];
  } else if (key.name === 'return' || key.name === 'enter') {
    const item = items[shopCursor];
    if (item?.id) buyItem(item.id);
  } else if (str && /^[1-9]$/.test(str)) {
    const at = page * storePageSize + Number(str) - 1;
    if (items[at]?.id) {
      shopCursor = at;
      buyItem(items[at].id!);
    }
  } else if (str === 'i') {
    const item = items[shopCursor];
    message = item ? inspectItem(item.id) : 'Nothing to inspect.';
  }
  // Buying can change what's for sale; keep the cursor on an item.
  shopCursor = Math.max(0, Math.min(shopCursor, storeChoices(state, store, -1, at).length - 1));
  return store;
}

/** The game's height: the tallest screen seen or measured this session (see tallestPage). */
let gameHeight = 0;
let measuredAt = 0;

/** The tallest of the pages in the [tab] menu as they'd look now, each with its tabs row. */
function tallestPage(columns: number): number {
  const play = availablePlays()[scriptPlay]?.id ?? '';
  const pages = [
    renderScreen(state, '', null, columns, -1, 0, homeChosen(state, homeCursor)),
    renderRoster(state, rosterCursor, '', columns) + '\n',
    renderInventory(state, 0, 0, null, '', columns) + '\n',
    renderOffice(officeView(), '', officeCursor, -1, false, null, columns),
    renderScript(state, play, scriptCursor, '', columns),
    renderStats(state, columns) + '\n',
    renderAchievements(state, 0, columns) + '\n',
    renderDictionary(state, 0, columns) + '\n',
    renderOptions(state, columns),
    ...(labRoom(state) ? [renderShop(state, 'research', -1, '', columns)] : []),
  ];
  return Math.max(...pages.map((p) => p.split('\n').length));
}

function draw() {
  const columns = fitLines();
  // Menu items showing now keep their places; ones that show up later go under them.
  noteRevealed(state, revealKeys(state));
  // A free letter pops up the letter picker, once nothing else is waiting on an answer.
  if (!pickingLetter && state.freeLetters > 0 && unownedLetters(state).length > 0 && !pickerOpen() && !giving && namingMonkey < 0 && !confirmingFolio) {
    pickingLetter = 'free';
    letterCursor = 0;
  }
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
  // A picker is a popup (promptBox), not a line on the screen.
  const shown = pickerOpen() ? '' : message;
  const pick = giving && (giving.kind === 'hat' ? hatPick(state, giving.id) : dyePick(state, giving.color));
  const page = currentPage();
  const nav = page ? pageTabsRow(page, currentTab()) : [];
  const navHeight = nav.length;
  const under = flipping
    ? renderCoinFlip(state, flipping === 'ask', flipMessage, columns)
    : readingTelegrams
    ? renderTelegrams(state, columns)
    : readingShelf
    ? renderBook(state, readingShelf.id, readingShelf.top, bookHeight(), columns)
    : showingLibrary
    ? renderLibrary(state, libraryCursor, shown, columns)
    : pickingLetter
    ? renderLetterPicker(state, pickingLetter === 'free', letterCursor, message, columns)
    : pick
    ? renderMonkeyPicker(state, pick.title, pick.notes, menuCursor, shown, columns)
    : showingInventory
    ? renderInventory(state, invRow, invCol, invHeld, shown, columns)
    : hiring
    ? renderCandidates(state, choosingPost ? '' : shown, columns, choosingPost ? -1 : menuCursor)
    : showingScript && contents
    ? renderContents(state, contents === 'scenes' ? (availablePlays()[scriptPlay]?.id ?? null) : null, contentsCursor, shown, columns, contentsTab)
    : showingOptions
    ? renderOptions(state, columns, menuCursor)
    : showingOffice && readingBook
    ? renderFengShuiBook(state)
    : showingOffice && readingManagerBook
    ? renderManagerBook(state, columns)
    : showingOffice && officeHelp
    ? renderOfficeHelp(state, columns)
    : showingOffice && officeShop
    ? officeShopScreen(columns)
    : showingOffice
    ? renderOffice(officeView(), shown, roomCursor(), heldFurniture, officeGrowing, heldDoor?.side ?? null, columns, '', officeLegend)
    : showingAchievements
    ? renderAchievements(state, achievementRow, columns)
    : showingRoster
    ? renderRoster(state, rosterCursor, shown, columns)
    : showingStats
    ? renderStats(state, columns)
    : showingDictionary
      ? renderDictionary(state, dictionaryRow, columns)
      : showingScript && scriptShop
    ? renderScript(state, scriptSpot().play, scriptCursor, '', columns, renderShop(state, 'script', shopCursor, shown, columns, true, scriptSpot()))
    : showingScript
    ? renderScript(state, availablePlays()[scriptPlay]?.id ?? '', scriptCursor, shown, columns)
    : showingDev
      ? renderDevMenu(state, shown, columns, menuCursor)
      : showingKeys
      ? renderKeysMenu(state, shown, columns, menuCursor)
      : showingSlots
        ? renderSlotsMenu(state, departmentGenres(state)[slotDept], selectedSlot, slotWordDraft, shown, columns)
        : showingHelp
          ? renderHomeKeys(state)
          : renderScreen(state, shown, shop, columns, shop ? shopCursor : menuCursor, Math.max(0, (process.stdout.rows || 0) - navHeight), homeChosen(state, homeCursor));
  // The navigation bar, right under the title bar, on every page.
  const withNav = page ? ((lines) => [lines[0], ...nav, ...lines.slice(1)].join('\n'))(under.split('\n')) : under;
  // The department popup over whatever screen it was opened from, with any message under it.
  const upgrade = upgrading && upgradeColumns(state, upgrading.kind);
  const upgradeTitle = upgrading?.kind === 'manager' ? 'Upgrade which manager?' : upgrading?.kind === 'typewriter' ? 'Better typewriter for which monkey?' : 'Faster typing for which monkey?';
  const popup = linePicker() ? promptBox(linePicker(), pickCursor) : upgrade ? columnBox(upgradeTitle, upgrade.cols, upgrading, '[arrows] choose   [enter] buy   [esc] done', columns) : pageMenu ? menuBox('Go to', pagesFor(state).map((p) => (p === pageMenu ? `${pageNames[p]}  ${dim('(here)')}` : pageNames[p])), pageMenuCursor) : keyMenu ? keyBox(keyMenu.title, keyMenu.keys, keyMenuCursor) : choosingPost ? postPopup() : picker?.kind === 'hat' ? renderHatPicker(state, picker.monkey, pickerCursor) : picker ? renderFurniturePicker(state, picker.room, pickerCursor) : null;
  const rows = process.stdout.rows || 0;
  const shownNow = popup ? overlay(withNav, [...popup, ...(message && !pickerOpen() ? ['', ` ${bold(message)}`] : [])], columns) : withNav;
  // Every screen as tall as the tallest, so nothing moves between them; the game still sits at the bottom of the window.
  gameHeight = Math.max(gameHeight, shownNow.split('\n').length);
  if (Date.now() - measuredAt > 2000) {
    measuredAt = Date.now();
    gameHeight = Math.max(gameHeight, tallestPage(columns));
  }
  const screen = fillHeight(shownNow, rows > 0 ? Math.min(gameHeight, rows - 1) : gameHeight);
  drawn = { lines: screen.split('\n'), top: screenTop(screen, rows, state.settings.screenAtTop) };
  // Whatever the mouse is over is highlighted, as the menus' cursor is.
  const lines = [...drawn.lines];
  const over = hoverTarget();
  if (over) lines[over.line] = inverseSpan(lines[over.line], over.from, over.to);
  const shownScreen = lines.join('\n');
  process.stdout.write(
    (state.settings.mouse ? mouseOn : mouseOff) +
      '\x1b[2J\x1b[H' +
      placeScreen(state.settings.lightBackground ? forLightBackground(shownScreen) : shownScreen, rows, state.settings.screenAtTop),
  );
}

/** Where the mouse is (null: not over the game, or the keys moved since), and whether the arrow keys or wheel moved a cursor last. */
let hover: { row: number; col: number } | null = null;
let navigated = false;

function hoverTarget() {
  return state.settings.mouse && hover ? targetAt(drawn.lines, drawn.top, hover.row, hover.col, !!pickingLetter) : undefined;
}

/**
 * Menus hide their cursor until the arrow keys or the wheel move it (Justin,
 * 2026-10-16); enter keeps it, any other key hides it again. Moving the mouse
 * hides it too, since then what's under the mouse is highlighted.
 */
function noteKey(name: string | undefined) {
  if (['up', 'down', 'left', 'right'].includes(name ?? '')) {
    navigated = true;
    hover = null;
  } else if (name !== 'return' && name !== 'enter') navigated = false;
  showCursors(navigated);
}

function onMouse(e: MouseEvent) {
  if (e.kind === 'move') {
    const before = hoverTarget();
    hover = { row: e.row, col: e.col };
    const after = hoverTarget();
    const moved = navigated || before?.line !== after?.line || before?.from !== after?.from;
    navigated = false;
    showCursors(false);
    if (moved) draw();
    return;
  }
  const press = mousePress(e, drawn.lines, drawn.top, !!pickingLetter, navigated);
  if (!press) return;
  pressKey(press.str, { name: press.name });
}

/**
 * The open list's cursor back to its first choice, for the up or down press
 * that shows a hidden cursor (Justin, 2026-10-21: "make sure the highlight
 * starts at the first selection in the list"). False on screens whose arrows
 * move something else (the office map, the script, pages that scroll), which
 * take the press as usual.
 */
function toFirstChoice(): boolean {
  if (upgrading) upgrading.col = upgrading.row = 0;
  else if (pageMenu) pageMenuCursor = 0;
  else if (keyMenu) keyMenuCursor = 0;
  else if (choosingPost) postCursor = 0;
  else if (picker) pickerCursor = 0;
  else if (linePicker()) pickCursor = 0;
  else if (pickingLetter) letterCursor = 0;
  else if (flipping || readingTelegrams || readingShelf || namingMonkey >= 0 || confirmingReset || confirmingFolio || confirmingFire) return false;
  else if (showingLibrary) libraryCursor = 0;
  else if (giving || hiring || showingOptions || showingDev || showingKeys) menuCursor = 0;
  else if (showingInventory) invRow = invCol = 0;
  else if (showingOffice) {
    if (!officeShop) return false;
    shopCursor = 0;
  } else if (showingScript) {
    if (contents) contentsCursor = 0;
    else if (scriptShop) shopCursor = 0;
    else return false;
  } else if (showingRoster) rosterCursor = 0;
  else if (showingStats || showingDictionary || showingAchievements || showingSlots || showingHelp) return false;
  else if (shop) shopCursor = 0;
  else homeCursor = menuCursor = 0;
  return true;
}

/** A key press, from the keyboard or the mouse. */
function pressKey(str: string | undefined, key: { name?: string; ctrl?: boolean }) {
  const showing = !navigated && (key.name === 'up' || key.name === 'down');
  noteKey(key.name);
  if (showing && toFirstChoice()) return draw();
  handleKey(str, key);
}

/** The screen last drawn and the terminal row its first line is on, for mouse clicks. */
let drawn: { lines: string[]; top: number } = { lines: [], top: 1 };

function quit() {
  save(state, storage);
  process.stdin.setRawMode?.(false);
  process.stdout.write(mouseOff + '\x1b[?25h');
  console.log(`\nSaved to ${savePath}. Bye!`);
  process.exit(0);
}

/** A prompt listing the departments with room, keys 1-4. */
function deptPrompt(question: string): string {
  const choices = departmentsWithRoom(state).map(
    (g, i) => `[${i + 1}] ${departmentName(state, g)} (${departmentTypists(state, g)}/${departmentRules.maxTypists})`,
  );
  return `${question} ${choices.join('   ')}   (any other key cancels)`;
}

function namePrompt(): string {
  return `Name ${monkeyName(state, namingMonkey)}: ${nameDraft}_   (enter to save, esc to cancel, empty for a famous name)`;
}

/** A new monkey arrives with a name of its own; [n] renames it any time. */
function welcome(index: number) {
  message = `Say hello to ${monkeyName(state, index)}. ([n] renames a monkey any time.)`;
}

function startNaming(index: number) {
  namingMonkey = index;
  nameDraft = state.monkeys[index].name;
  message = namePrompt();
}

/** Whether a picker is waiting on the message line (which monkey, which department, which letter...). */
/** The open picker's prompt, shown as a popup (promptBox): a picker's message, or the books on a shelf just inspected. */
function linePicker(): string {
  return pickerOpen() ? message : offeredBook >= 0 ? bookMenu : '';
}

function pickerOpen(): boolean {
  return !!(pickingDeptFor || pickingDyeColor || pickingDepartment || buyingRoom);
}

/** Opens the coin flip screen (with nothing to bet it only says so). */
function openFlip() {
  flipping = state.currency > 0 ? 'ask' : 'done';
  flipMessage = state.currency > 0 ? '' : `You have no ${theme.currency} to bet.`;
}

/** Up/down move the open menu's cursor over `n` rows; enter returns the chosen row, any other key -1. */
function menuKey(key: { name?: string }, n: number): number {
  if (n <= 0) return -1;
  if (key.name === 'up' || key.name === 'down') {
    menuCursor = (Math.min(menuCursor, n - 1) + (key.name === 'up' ? n - 1 : 1)) % n;
    return -1;
  }
  return key.name === 'return' || key.name === 'enter' ? Math.min(menuCursor, n - 1) : -1;
}

function handleKey(str: string | undefined, key: { name?: string; ctrl?: boolean }): void {
  if (key.ctrl && key.name === 'c') return quit();

  // The letter picker: a popup until a letter is chosen (free letters can't be put off).
  if (pickingLetter) {
    const open = unownedLetters(state);
    const free = pickingLetter === 'free';
    if (['left', 'right', 'up', 'down'].includes(key.name ?? '')) {
      const back = key.name === 'left' || key.name === 'up';
      letterCursor = (Math.min(letterCursor, open.length - 1) + (back ? open.length - 1 : 1)) % open.length;
      return draw();
    }
    const letter = key.name === 'return' || key.name === 'enter' ? open[Math.min(letterCursor, open.length - 1)] : (str ?? '').toUpperCase();
    if (!open.includes(letter)) {
      if (free) message = /^[A-Z]$/.test(letter) ? `You have ${letter} already. Choose another letter.` : 'Choose a letter first.';
      else {
        pickingLetter = false;
        message = '';
      }
    } else if (buyLetter(state, letter, free)) {
      const done = `You ${free ? 'took' : 'bought'} ${letter}.`;
      pickingLetter = unownedLetters(state).length === 0 ? false : free ? (state.freeLetters > 0 ? 'free' : false) : canAffordLetter(state);
      letterCursor = 0;
      message = pickingLetter && free ? `${done} Another free letter!` : done;
    } else {
      pickingLetter = false;
      message = 'Not enough to buy that letter.';
    }
    return draw();
  }

  // A picker on the message line: arrows move its cursor and enter picks, as if its key were pressed.
  if (!linePicker()) pickCursor = 0;
  else {
    const choices = promptChoices(linePicker());
    if (choices.length > 0 && ['up', 'down', 'left', 'right'].includes(key.name ?? '')) {
      const back = key.name === 'up' || key.name === 'left';
      pickCursor = (Math.min(pickCursor, choices.length - 1) + (back ? choices.length - 1 : 1)) % choices.length;
      return draw();
    }
    if (choices.length > 0 && (key.name === 'return' || key.name === 'enter')) {
      str = choices[Math.min(pickCursor, choices.length - 1)].key;
      key = { name: str.toLowerCase() };
    }
  }

  if (confirmingFolio) {
    confirmingFolio = false;
    const next = key.name === 'y' ? publishFolio(state) : null;
    if (next) {
      const gained = next.folioPages - state.folioPages;
      state = next;
      save(state, storage);
      message = `You published Folio #${state.folios}: +${formatNumber(gained)} pages. Bananas ${formatMultiplier(folioMultiplier(state))} for good. The monkeys start again.`;
    } else message = 'Not published. The monkeys keep typing.';
    return draw();
  }

  // [o] opens the office map and [backspace] goes home from any screen (Justin, 2026-10-18), except while typing,
  // confirming, or carrying something on the office map (esc puts it back first).
  const busy =
    namingMonkey >= 0 || slotWordDraft !== null || confirmingReset || confirmingFire || !!pickingLetter || state.letters.length === 0 ||
    heldFurniture >= 0 || !!heldDoor || !!placingRoom || !!movingRoom;
  const onMap = showingOffice && !officeShop && !readingBook && !readingManagerBook && !officeHelp && !showingLibrary && !readingShelf && !picker;
  if (!busy && ((str === 'o' && !onMap) || key.name === 'backspace')) {
    goHome();
    if (str === 'o') openOffice();
    return draw();
  }

  // The upgrade popup: arrows choose a monkey (up and down in a department, left and right between them), enter buys and it stays open; any other key closes it.
  if (upgrading) {
    const { monkeys } = upgradeColumns(state, upgrading.kind);
    const u = upgrading;
    u.col = Math.min(u.col, Math.max(0, monkeys.length - 1));
    const n = monkeys[u.col]?.length ?? 0;
    if (key.name === 'up' || key.name === 'down') {
      if (n > 0) u.row = (Math.min(u.row, n - 1) + (key.name === 'up' ? n - 1 : 1)) % n;
    } else if (key.name === 'left' || key.name === 'right') {
      if (monkeys.length > 0) u.col = (u.col + (key.name === 'left' ? monkeys.length - 1 : 1)) % monkeys.length;
      u.row = Math.min(u.row, (monkeys[u.col]?.length ?? 1) - 1);
    } else if (key.name === 'return' || key.name === 'enter') {
      const i = monkeys[u.col]?.[u.row];
      if (i !== undefined) {
        if (u.kind === 'manager') message = upgradeManager(state, i) ? `${monkeyName(state, i)}'s department works harder.` : 'Not enough Sentences.';
        else message = buyTyping(i, u.kind) || (u.kind === 'skill' ? `${monkeyName(state, i)} types faster.` : '');
      }
    } else {
      upgrading = null;
      message = '';
    }
    return draw();
  }

  // The [tab] menu (Justin, 2026-10-21: "a popup or dropdown menu button" instead of arrows between pages; "tab opens the menu"): pick a page by number, arrows and [enter], or a click.
  if (pageMenu) {
    const pages = pagesFor(state);
    if (key.name === 'up' || key.name === 'down') {
      pageMenuCursor = (Math.max(0, pageMenuCursor) + (key.name === 'up' ? pages.length - 1 : 1)) % pages.length;
      return draw();
    }
    pageMenu = null;
    const row = key.name === 'return' || key.name === 'enter' ? pageMenuCursor : str && /^[1-9]$/.test(str) ? Number(str) - 1 : -1;
    if (pages[row]) goTo(pages[row]);
    return draw();
  }
  if (!busy && key.name === 'tab') {
    keyMenu = null;
    pageMenu = currentPage() ?? 'home';
    pageMenuCursor = pagesFor(state).indexOf(pageMenu);
    return draw();
  }
  // A popup of keys: arrows and [enter] pick a row, its key does it, any other key closes it and does its own thing.
  if (keyMenu) {
    const menu = keyMenu;
    if (key.name === 'up' || key.name === 'down') {
      keyMenuCursor = (Math.max(0, keyMenuCursor) + (key.name === 'up' ? menu.keys.length - 1 : 1)) % menu.keys.length;
      return draw();
    }
    keyMenu = null;
    if (key.name === 'escape' || str === '/') return draw();
    if (key.name === 'return' || key.name === 'enter') {
      const press = keyMenuCursor >= 0 ? labelPress(menu.keys[keyMenuCursor][0]) : undefined;
      return press ? handleKey(press.str, { name: press.name }) : draw();
    }
  }
  // [/] lists every key of a page whose key row shows only the main ones (Justin, 2026-10-21).
  if (!busy && str === '/') {
    const keys = showingRoster && !showingInventory ? rosterKeys
      : showingScript && scriptShop ? shopKeys(state, 'script')
      : showingScript && !contents ? scriptKeys
      : showingOffice && officeShop ? shopKeys(state, officeShop, true)
      : shop && currentPage() === 'shop' ? shopKeys(state, shop)
      : null;
    if (keys) {
      keyMenu = { title: 'Keys', keys };
      keyMenuCursor = -1;
      return draw();
    }
  }

  // A page's tabs: [ and ] step through them, a click on one opens it.
  const page = busy ? null : currentPage();
  if (key.name?.startsWith('page:')) {
    if (page) goTo(key.name.slice('page:'.length) as Tab);
    return draw();
  }
  const tabs = page && pageTabs[page];
  if (tabs && !invHeld && (str === '[' || str === ']')) {
    const tab = currentTab()!;
    goTo(tabs[(tabs.indexOf(tab) + (str === '[' ? tabs.length - 1 : 1)) % tabs.length]);
    return draw();
  }

  // The coin flip: [?] opens its screen from anywhere (Justin: "a dedicated button that is available at any time", "make the coin flip button ?").
  if (flipping) {
    if (flipping === 'ask' && key.name === 'y') {
      const bet = state.currency;
      const won = flipCoin(state, Math.random);
      flipMessage = won
        ? `Heads! Your ${formatPrice(bet)} ${theme.currency} became ${formatPrice(state.currency)}.`
        : `Tails. ${formatPrice(bet)} ${theme.currency} gone. The monkeys keep typing.`;
      flipping = 'done';
    } else if (flipping === 'done' && str === '?') openFlip();
    else flipping = '';
    return draw();
  }
  if (readingTelegrams && str !== '?') {
    if (key.name === 'escape' || key.name === 'q' || key.name === 'return' || key.name === 'enter') readingTelegrams = false;
    return draw();
  }
  if (str === '?' && namingMonkey < 0 && slotWordDraft === null && !confirmingFolio && !confirmingReset && !confirmingFire) {
    openFlip();
    return draw();
  }
  if (readingShelf) {
    const step = { up: -1, down: 1, pageup: -bookHeight(), pagedown: bookHeight(), k: -1, j: 1 }[key.name ?? ''];
    const last = Math.max(0, bookRows(state, readingShelf.id, process.stdout.columns || 0).length - bookHeight());
    if (step) readingShelf.top = Math.max(0, Math.min(last, readingShelf.top + step));
    else if (key.name === 'escape' || key.name === 'q' || key.name === 'return' || key.name === 'enter') readingShelf = null;
    return draw();
  }
  if (showingLibrary) {
    message = '';
    const galleries = libraryGalleries(state);
    const book = str === '0' ? 'bibliography' : galleries[libraryCursor]?.[Number(str) - 1];
    if (key.name === 'escape' || key.name === 'q') showingLibrary = false;
    else if (key.name === 'left' || key.name === 'up') libraryCursor = Math.max(0, libraryCursor - 1);
    else if (key.name === 'right' || key.name === 'down') libraryCursor = Math.min(galleries.length - 1, libraryCursor + 1);
    else if (book) readingShelf = { id: book, top: 0 };
    else if (str === 'b') {
      const cost = galleryCost(state);
      if (buyGallery(state)) {
        libraryCursor = state.galleries - 1;
        message = `A new gallery, No. ${state.galleries}, opens off the last one.`;
      } else message = libraryFull(state) ? `The ${library.name} is full: ${library.maxBooks} books.` : `A new gallery takes ${formatPrice(cost)} Lines.`;
    }
    return draw();
  }

  if (confirmingReset) {
    confirmingReset = false;
    if (key.name === 'y') {
      storage.clear();
      state = createInitialState();
      setScientific(false);
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

  if (picker) {
    const list = pickerChoices();
    if ((key.name === 'up' || key.name === 'down') && list.length > 0) {
      pickerCursor = (Math.max(0, Math.min(pickerCursor, list.length - 1)) + (key.name === 'up' ? list.length - 1 : 1)) % list.length;
      return draw();
    }
    const at = key.name === 'return' || key.name === 'enter' ? Math.max(0, pickerCursor) : Number(str) - 1;
    const choice = str !== '0' && at >= 0 ? list[at] : undefined;
    const p = picker;
    if (key.name === 'escape' || key.name === 'q') {
      picker = null;
      message = '';
    } else if (choice !== undefined && p.kind === 'hat') {
      const m = state.monkeys[p.monkey];
      const what = choice ? itemName(state, 'storage', { kind: 'hat', key: choice }).toLowerCase() : '';
      const old = m.hat ? itemName(state, p.monkey, { kind: 'hat', key: hatKey(m.hat, m.hatColor) }).toLowerCase() : '';
      const done = choice ? moveHat(state, 'storage', choice, p.monkey) : !!m.hat && moveHat(state, p.monkey, hatKey(m.hat, m.hatColor), 'storage');
      picker = null;
      message = !choice && !old ? `${monkeyName(state, p.monkey)} wears no hat.` : !done ? "That hat can't go there." : choice ? `${monkeyName(state, p.monkey)} wears the ${what} now.${old ? ` Its ${old} is in your inventory.` : ''}` : `The ${old} is in your inventory.`;
    } else if (choice && p.kind === 'furniture' && placeStoredFurniture(state, choice, p.room)) {
      picker = null;
      const i = state.furniture.length - 1;
      const f = state.furniture[i];
      if (officeCursor) Object.assign(officeCursor, { x: f.x, y: f.y });
      heldFurniture = i;
      heldTurned = !!f.turned;
      message = `Where should the ${furnitureName(state, i)} go? [space] puts it down, [esc] leaves it here.`;
    }
    return draw();
  }

  if (choosingPost) {
    const list = postList();
    if (key.name === 'up' || key.name === 'down') {
      postCursor = (Math.min(postCursor, list.length - 1) + (key.name === 'up' ? list.length - 1 : 1)) % list.length;
      return draw();
    }
    const p = key.name === 'return' || key.name === 'enter' ? list[Math.min(postCursor, list.length - 1)] : list[Number(str) - 1];
    if (key.name === 'escape' || key.name === 'q') {
      choosingPost = null;
      message = '';
    } else if (p && str !== '0') pickPost(p);
    return draw();
  }

  if (hiring) {
    const row = menuKey(key, state.candidates.length + 1);
    if (row >= 0) str = String(row === state.candidates.length ? 0 : row + 1);
    const n = Number(str);
    if (key.name === 'escape' || key.name === 'q') {
      hiring = false;
      message = '';
    } else if (str && /^[0-9]$/.test(str) && n <= state.candidates.length) {
      choosingPost = { kind: 'hire', from: n === 0 ? undefined : n - 1 };
      postCursor = 0;
      message = '';
    }
    return draw();
  }

  if (pickingDeptFor) {
    pickingDeptFor = '';
    const g = departmentsWithRoom(state)[Number(str) - 1];
    if (g && assignMonkey(state, g)) welcome(state.monkeys.length - 1);
    else message = 'No monkey added.';
    return draw();
  }

  // Picking menus stay open after a purchase so you can buy more; any other key closes them.

  if (giving) {
    const n = state.monkeys.length;
    let row = menuKey(key, n);
    if (row < 0 && str && /^[1-9]$/.test(str) && Number(str) <= n) row = menuCursor = Number(str) - 1;
    if (row >= 0) message = giving.kind === 'hat' ? wearHatOn(row, giving.id) : dyeHatOn(row, giving.color);
    else if (key.name === 'escape' || key.name === 'q') {
      giving = null;
      message = '';
    }
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
        giving = { kind: 'dye', color };
        menuCursor = 0;
        message = '';
      }
    }
    return draw();
  }


  if (pickingDepartment) {
    pickingDepartment = false;
    const g = departmentChoices(state)[Number(str) - 1];
    message =
      g && openDepartment(state, g)
        ? `The ${departmentName(state, g)} department is open. Buy in the script ([p]) and move monkeys there with [d].`
        : 'No department opened.';
    return draw();
  }


  if (showingScript && contents) {
    message = '';
    const play = availablePlays()[scriptPlay];
    const listed = tabPlays(contentsTab);
    const size = contents === 'plays' ? listed.length : (play?.scenes.length ?? 0);
    if (key.name === 'q') return quit();
    if (str === 'c' || (key.name === 'escape' && contents === 'plays')) {
      contents = '';
    } else if (key.name === 'escape' || key.name === 'backspace' || key.name === 'left') {
      if (contents === 'scenes') {
        contents = 'plays';
        contentsCursor = Math.max(0, listed.indexOf(play!));
      }
    } else if (contents === 'plays' && str && '[]'.includes(str)) {
      const tabs = textsTabs(state);
      contentsTab = tabs[(tabs.indexOf(contentsTab) + (str === ']' ? 1 : tabs.length - 1)) % tabs.length];
      contentsCursor = Math.max(0, tabPlays(contentsTab).indexOf(play!));
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
        const chosen = listed[contentsCursor];
        if (!chosen) return draw(); // the Codes tab: nothing to open
        const index = availablePlays().indexOf(chosen);
        const sc = index === scriptPlay ? sceneOf(chosen, scriptCursor) : undefined;
        if (index !== scriptPlay) scriptCursor = 0;
        scriptPlay = index;
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

  if (showingScript && scriptShop) {
    const next = shopKey('script', str, key);
    if (!next) message = '';
    scriptShop = !!next;
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
    } else if (key.name === 'space') {
      scriptShop = true;
      shopCursor = 0;
    } else if (key.name === 'return' || key.name === 'enter') {
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
    } else if (play && str && '[]'.includes(str)) {
      const to = nextPin(state, play.id, scriptCursor, str === '[' ? -1 : 1);
      if (!to) message = 'You have no pinned lines. [enter] pins the line you are on.';
      else {
        scriptPlay = Math.max(0, availablePlays().findIndex((p) => p.id === to.play));
        scriptCursor = to.index;
        findIndex = -1;
      }
    } else if (str === 'c') {
      contents = 'plays';
      contentsTab = isForeign(play?.genre) ? 'foreign' : 'plays';
      contentsCursor = Math.max(0, tabPlays(contentsTab).indexOf(play!));
    } else if (play && str === 'w') {
      buyScriptText();
    } else if (str === 'u') {
      const n = unpinPlayerLines(state);
      message = n > 0 ? `Unpinned ${n} line${n === 1 ? '' : 's'}.` : 'You have no pinned lines of your own.';
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
      } else if (str && /^\p{L}$/u.test(str)) {
        slotWordDraft += textToWords(str).join(''); // Greek too, without its accents
      }
      return draw();
    }
    if (key.name === 'escape' || key.name === 'q') {
      showingSlots = false;
    } else if (str && '<>,.'.includes(str)) {
      const n = Math.max(1, departmentGenres(state).length);
      slotDept = (slotDept + ('<,'.includes(str) ? n - 1 : 1)) % n;
      selectedSlot = departmentSlots(state, departmentGenres(state)[slotDept])[0] ?? -1;
    } else if (str === 'b') {
      if (buySlot(state, departmentGenres(state)[slotDept])) selectedSlot = state.slots.length - 1;
      else message = 'Not enough Lines (or this department has every slot). Lines come from writing lines of the play.';
    } else if (str && /^[1-9]$/.test(str)) {
      const i = departmentSlots(state, departmentGenres(state)[slotDept])[Number(str) - 1];
      if (i !== undefined) selectedSlot = i;
    } else if (key.name === 'up' || key.name === 'down') {
      const mine = departmentSlots(state, departmentGenres(state)[slotDept]);
      const at = mine.indexOf(selectedSlot) + (key.name === 'up' ? -1 : 1);
      if (mine.length > 0) selectedSlot = mine[Math.max(0, Math.min(mine.length - 1, at))];
    } else if (
      state.slots[selectedSlot] &&
      slotGenre(state, state.slots[selectedSlot]) === departmentGenres(state)[slotDept]
    ) {
      if (str === 'w') slotWordDraft = '';
      else if (key.name === 'space' || key.name === 'return' || key.name === 'enter') toggleSlot(state, selectedSlot);
      else if (key.name === 'left') moveSlot(state, selectedSlot, -1);
      else if (key.name === 'right') moveSlot(state, selectedSlot, 1);
    }
    return draw();
  }

  if (showingOptions) {
    const row = menuKey(key, 5);
    if (row >= 0) str = String(row + 1);
    if (key.name === 'escape' || key.name === 'q' || str === 'c') showingOptions = false;
    else if (str === '1') state.settings.autoPlaceFurniture = !state.settings.autoPlaceFurniture;
    else if (str === '2') state.settings.lightBackground = !state.settings.lightBackground;
    else if (str === '3') setScientific((state.settings.scientific = !state.settings.scientific));
    else if (str === '4') state.settings.screenAtTop = !state.settings.screenAtTop;
    else if (str === '5') state.settings.mouse = !state.settings.mouse;
    return draw();
  }

  if (showingOffice && readingBook) {
    if (key.name === 'escape' || key.name === 'q' || str === 'b' || str === 'o') readingBook = false;
    return draw();
  }

  if (showingOffice && readingManagerBook) {
    if (key.name === 'escape' || key.name === 'q' || str === 'e' || str === 'o') readingManagerBook = false;
    return draw();
  }

  if (showingOffice && officeHelp) {
    if (key.name === 'escape' || key.name === 'q' || str === '/' || str === 'o') officeHelp = false;
    return draw();
  }

  if (showingOffice && officeShop) {
    const next = shopKey(officeShop, str, key);
    if (next !== officeShop) message = '';
    if (showingOffice && officeShop) officeShop = next; // buying with auto-place off closes the shop to place the piece
    if (next) lastOfficeStore = next;
    return draw();
  }

  if (showingOffice && officeCursor && officeLegend !== null) {
    // The legend has the keys while it's open: arrows choose an item (two columns, row by row), [l] or esc closes it.
    const n = legendSize(state);
    const move: Record<string, number> = { up: -2, down: 2, left: -1, right: 1 };
    if (key.name === 'escape' || key.name === 'q' || str === 'l') officeLegend = null;
    else if (move[key.name ?? ''] !== undefined) {
      const next = officeLegend + move[key.name!];
      if (next >= 0 && next < n) officeLegend = next;
    }
    return draw();
  }

  if (showingOffice && officeCursor) {
    message = '';
    const c = officeCursor;
    const here = roomAt(state, c.x, c.y);
    if (offeredBook >= 0) {
      const piece = offeredBook;
      offeredBook = -1;
      bookMenu = '';
      const shelved = libraryBooks(state)[Number(str) - 1];
      if (str === 'y' && readFengShuiBook(state, piece)) readingBook = true;
      else if (str === 'y' && readManagerBook(state, piece)) readingManagerBook = true;
      else if (shelved?.id === 'fengshui') readingBook = true;
      else if (shelved?.id === 'manager') readingManagerBook = true;
      else if (str === 'y' || !shelved) message = 'You leave the books where they are, for now.';
      return draw();
    }
    if (str === 'i' && !officeGrowing && heldFurniture < 0 && here?.kind === 'library') {
      showingLibrary = true;
      libraryCursor = 0;
      return draw();
    }
    if (str === 'i' && !officeGrowing) {
      const here = roomAt(state, c.x, c.y);
      const spot = heldFurniture >= 0 ? heldFurniture : here ? cellAt(state, here.id, c.x, c.y) : null;
      const first = Object.keys(state.safes).length === 0;
      const found = typeof spot === 'number' && findSafe(state, spot, Math.random);
      const seen = inspectSquare(state, c.x, c.y, heldFurniture);
      message = found && first ? `${seen.text}  You can build a ${codebreaking.name} Department now (office map, [r]).` : seen.text;
      offeredBook = seen.book;
      bookMenu = seen.choices?.length ? `Read which book? ${seen.choices.join('   ')}` : '';
      return draw();
    }
    if (placingRoom || movingRoom) {
      const step: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const move = step[key.name ?? ''];
      if (move) {
        if (placingRoom) placingRoom.at = [placingRoom.at[0] + move[0], placingRoom.at[1] + move[1]];
        else if (movingRoom) Object.assign(movingRoom, { dx: movingRoom.dx + move[0], dy: movingRoom.dy + move[1] });
        message = roomSpotPrompt();
      } else if (key.name === 'escape' || key.name === 'q') {
        message = placingRoom ? 'No room bought.' : 'The room stays where it was.';
        placingRoom = movingRoom = null;
      } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
        if (placingRoom) {
          const { kind, genre, at } = placingRoom;
          if (!roomSpotOk()) message = roomSpotPrompt();
          else if (state.sentences < roomCost(state)) {
            placingRoom = null;
            message = noSentences;
          } else if (buyRoom(state, kind, genre, at)) {
            placingRoom = null;
            const room = state.office[state.office.length - 1];
            Object.assign(c, { x: room.cells[0][0], y: room.cells[0][1] });
            message = newRoomMessage(room);
          } else {
            placingRoom = null;
            message = 'No room bought.';
          }
        } else if (movingRoom) {
          const { id, dx, dy } = movingRoom;
          if (dx === 0 && dy === 0) {
            movingRoom = null;
            message = 'The room stays where it was.';
          } else if (moveRoomBy(state, id, dx, dy)) {
            movingRoom = null;
            const room = state.office.find((r) => r.id === id)!;
            Object.assign(c, { x: c.x + dx, y: c.y + dy });
            message = `The ${roomName(state, room)} moved, with everything in it.`;
          } else message = roomSpotPrompt();
        }
      } else message = roomSpotPrompt();
      return draw();
    }
    if (buyingRoom) {
      buyingRoom = false;
      const choice = roomChoices()[Number(str) - 1];
      if (str !== 'b' && !choice) message = 'No room bought.';
      else if (state.sentences < roomCost(state)) message = noSentences;
      else {
        const kind = choice?.kind ?? 'break';
        placingRoom = { kind, genre: choice?.genre, at: suggestRoomSpot(state, kind, choice?.genre ?? '') };
        message = roomSpotPrompt();
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
    else if (str && '<>,.'.includes(str) && !officeGrowing) {
      const rooms = state.office;
      const next = rooms[(rooms.indexOf(here!) + ('<,'.includes(str) ? rooms.length - 1 : 1)) % rooms.length];
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
    } else if (str === 'e' && !holding && !officeGrowing && state.managerBook) {
      readingManagerBook = true;
    } else if (str === '/' && !holding && !officeGrowing) {
      officeHelp = true;
    } else if (str === 'l' && !holding && !officeGrowing) {
      officeLegend = 0;
    } else if (str === 'p' && !holding && !officeGrowing) {
      if (!here) message = 'Put the cursor in the room the furniture is for.';
      else {
        picker = { kind: 'furniture', room: here.id };
        pickerCursor = -1;
      }
    } else if (str === 'f' && !holding && !officeGrowing) {
      officeShop = lastOfficeStore;
      shopCursor = 0;
    } else if ((str === 's' || str === 'v') && !holding && !officeGrowing) {
      const here = roomAt(state, c.x, c.y);
      const spot = here ? cellAt(state, here.id, c.x, c.y) : null;
      if (typeof spot !== 'number') message = 'No furniture there.';
      else if (!canRemoveFurniture(state, spot)) message = 'Desks stay: monkeys work at them.';
      else {
        const name = furnitureName(state, spot);
        const value = sellValue(furnitureKinds.find((k) => k.id === state.furniture[spot].kind)?.cost ?? 0);
        if (str === 's' && storeFurniture(state, spot)) message = `The ${name} is in your inventory ([i]).`;
        else if (str === 'v' && sellFurniture(state, spot)) message = `Sold the ${name} for ${formatPrice(value)} Sentences.`;
      }
    } else if (str === 'm' && !holding && !officeGrowing) {
      if (!here) message = 'Move the cursor onto a room to move it.';
      else {
        movingRoom = { id: here.id, dx: 0, dy: 0 };
        message = roomSpotPrompt();
      }
    } else if (str === 'h' && !holding && !officeGrowing) {
      if (!toggleHall(state, c.x, c.y)) message = 'That square is part of a room. Hallways go outside rooms.';
    } else if (str === 'r' && !officeGrowing) {
      buyingRoom = true;
      const choices = roomChoices().map(
        (c, i) => `[${i + 1}] ${c.kind === 'records' ? `the ${records.name} Department` : c.kind === 'library' ? 'a library for your books' : c.kind === 'codebreaking' ? `the ${codebreaking.name} Department` : c.kind === 'marketing' ? `the ${marketing.name} Department` : c.kind === 'hr' ? `the ${hr.name} Department` : c.kind === 'lab' ? `a lab for ${research.name}` : c.kind === 'office' ? `the ${departmentName(state, c.genre!)} Office, for its manager` : `the ${departmentName(state, c.genre!)} Department`}`,
      );
      message = `Buy a room (${formatPrice(roomCost(state))} Sentences): ${[...choices, '[b] a break room for furniture'].join('   ')}   (any other key cancels)`;
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      // Space (or enter) picks up and puts down: furniture first, else a door in the square's walls.
      if (officeGrowing) {
        const room = state.office.find((r) => r.id === officeGrowing);
        if (here) message = 'That square is already part of a room. Choose a +.';
        else if (state.sentences < squareCost(state)) message = noSentences;
        else if (!room || !expandRoom(state, room.id, [c.x, c.y])) message = 'Rooms grow onto empty squares next to them, not touching another room. Choose a +.';
      } else if (heldFurniture >= 0) {
        const f = state.furniture[heldFurniture];
        const under = here ? cellAt(state, here.id, c.x, c.y) : null;
        if (typeof under === 'number' && under !== heldFurniture) {
          // Put down on another piece: the two swap places, if both fit.
          const other = furnitureName(state, under);
          if (swapFurniture(state, heldFurniture, under)) {
            message = `Swapped the ${furnitureName(state, heldFurniture)} and the ${other}.`;
            heldFurniture = -1;
          } else message = `Not enough space to swap the ${furnitureName(state, heldFurniture)} and the ${other}.`;
        } else if (here && moveFurniture(state, heldFurniture, here.id, c.x, c.y)) heldFurniture = -1;
        else if (!here) message = 'Furniture goes inside a room.';
        else if (f.kind === desk.id && f.room !== here.id) message = "Desks stay in their department's room.";
        else if (!allowedIn(state, f.kind, here.id))
          message = `The ${furnitureName(state, heldFurniture)} only goes in ${(furnitureKinds.find((k) => k.id === f.kind)?.rooms ?? []).map((r) => ({ department: "departments' rooms", break: 'break rooms', office: "managers' offices" })[r as string] ?? r).join(' or ')}.`;
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
        else message = !here ? 'Nothing to pick up there.' : 'No furniture or door there. [f] buys furniture; [d] adds a door.';
      }
    }
    return draw();
  }

  if (showingInventory) {
    message = '';
    const rows = inventoryRows(state);
    invRow = Math.max(0, Math.min(invRow, rows.length - 1));
    const here = rows[invRow];
    const name = (who: Holder) => (typeof who === 'number' ? monkeyName(state, who) : 'your inventory');
    if (key.name === 'escape' || key.name === 'q' || (str === 'i' && !invHeld)) {
      if (invHeld) invHeld = null;
      else showingInventory = false;
    } else if (key.name === 'up' || key.name === 'down') {
      invRow = (invRow + (key.name === 'up' ? rows.length - 1 : 1)) % rows.length;
      invCol = Math.max(0, Math.min(invCol, rows[invRow].items.length - 1));
    } else if ((key.name === 'left' || key.name === 'right') && here.items.length > 0) {
      invCol = (invCol + (key.name === 'left' ? here.items.length - 1 : 1)) % here.items.length;
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      const item = here.items[invCol];
      if (!invHeld && typeof here.who === 'number' && (item?.kind === 'hat' || item?.kind === 'nohat')) {
        picker = { kind: 'hat', monkey: here.who };
        pickerCursor = -1;
      } else if (!invHeld) {
        if (!item || item.kind === 'nohat') message = 'Nothing there to pick up.';
        else if (item.kind === 'furniture') {
          // Furniture goes back in the office: the map opens with it in hand.
          const kind = item.id;
          if (!furnitureSpot(state, kind)) message = `No room for it: it needs ${pieceSize(kind).join(' x ')} free squares in a room it fits. Make space or grow a room on the office map.`;
          else if (placeStoredFurniture(state, kind)) {
            showingInventory = false;
            openOffice();
            const i = state.furniture.length - 1;
            const f = state.furniture[i];
            officeCursor = { x: f.x, y: f.y };
            heldFurniture = i;
            message = `Where should the ${furnitureName(state, i)} go? [esc] leaves it here.`;
          }
        } else if (item.kind === 'typewriter' && isTemp(state.monkeys[here.who as number])) message = 'Temps keep their own typewriter.';
        else invHeld = { who: here.who, item };
      } else if (invHeld.who === here.who) invHeld = null; // put back where it was
      else if (invHeld.item.kind === 'hat') {
        const what = itemName(state, invHeld.who, invHeld.item).toLowerCase();
        const to = here.who === 'furniture' ? 'storage' : here.who;
        if (moveHat(state, invHeld.who as number | 'storage', invHeld.item.key, to)) {
          message = to === 'storage' ? `The ${what} is in your inventory.` : `${name(to)} wears the ${what} now.`;
          invHeld = null;
          invCol = Math.max(0, Math.min(invCol, inventoryRows(state)[invRow].items.length - 1));
        } else message = `That hat can't go there.`;
      } else if (typeof here.who !== 'number') message = 'Typewriters stay with monkeys: put it on another monkey to swap.';
      else if (swapTypewriters(state, invHeld.who as number, here.who)) {
        message = `${name(invHeld.who)} and ${name(here.who)} swapped typewriters.`;
        invHeld = null;
      } else message = 'Temps keep their own typewriter.';
    }
    return draw();
  }

  if (showingRoster) {
    const order = rosterOrder(state);
    const i = order[rosterCursor];
    const firing = confirmingFire;
    confirmingFire = false;
    message = '';
    if (firing) {
      if (key.name === 'y' && i !== undefined) {
        const name = monkeyName(state, i);
        if (fireMonkey(state, i)) {
          message = `${name} has left the office.`;
          rosterCursor = Math.max(0, Math.min(rosterCursor, rosterOrder(state).length - 1));
        }
      } else message = 'Nobody was fired.';
    } else if (key.name === 'escape' || key.name === 'q' || str === 'm') showingRoster = false;
    else if (str === 'f' && i !== undefined) {
      const blocked = fireBlocker(state, i);
      if (blocked) message = `You can't fire ${monkeyName(state, i)}: ${blocked}.`;
      else {
        confirmingFire = true;
        message = `Fire ${monkeyName(state, i)}? It leaves for good; its hat goes into your inventory. [y] fire   (any other key: no)`;
      }
    } else if (str === 'h' && i !== undefined) {
      picker = { kind: 'hat', monkey: i };
      pickerCursor = -1;
    } else if (str === 'v' && i !== undefined) {
      const hat = hats.find((h) => h.id === state.monkeys[i].hat);
      if (!hat) message = `${monkeyName(state, i)} wears no hat to sell.`;
      else if (sellHat(state, i)) message = `Sold the ${hat.name.toLowerCase()} for ${formatPrice(sellValue(hat.cost))} Sentences.`;
    }
    else if (key.name === 'up') rosterCursor = Math.max(0, rosterCursor - 1);
    else if (key.name === 'down') rosterCursor = Math.min(order.length - 1, rosterCursor + 1);
    else if (str === 'n' && order[rosterCursor] !== undefined) startNaming(order[rosterCursor]);
    else if (str === 'd' && i !== undefined) startMove(i);
    else if ((key.name === 'return' || key.name === 'enter') && i !== undefined) {
      keyMenu = { title: monkeyName(state, i), keys: rosterActions };
      keyMenuCursor = 0;
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
    const row = menuKey(key, devTools.length);
    if (row >= 0) str = String(row + 1);
    const tool = str && /^[1-9]$/.test(str) ? devTools[Number(str) - 1] : undefined;
    if (key.name === 'escape' || str === '`' || key.name === 'q') showingDev = false;
    else if (tool) {
      tool.apply(state);
      message = `Done: ${tool.label}.`;
    }
    return draw();
  }

  if (showingHelp) {
    if (key.name === 'escape' || key.name === 'q' || str === '/') showingHelp = false;
    return draw();
  }

  if (showingKeys) {
    message = '';
    const row = menuKey(key, keyChoices(state).length);
    if (row >= 0) str = String(row + 1);
    if (key.name === 'escape' || key.name === 'q') {
      showingKeys = false;
    } else if (str && /^[1-9]$/.test(str)) {
      const k = keyChoices(state)[Number(str) - 1];
      if (k) message = buyKey(state, k) ? `You bought the ${k} key.` : `Not enough ${theme.currency}.`;
    }
    return draw();
  }

  message = '';
  // The opening screens' choices: arrows and enter, or their keys.
  const opening = state.owned.length === 0 && state.departments.length === 0 ? departmentChoices(state).length : starterGenre(state) ? starterPlays(state).length : state.letters.length === 0 ? startingLetters.length : 0;
  if (opening > 0) {
    const row = menuKey(key, opening);
    if (row >= 0) {
      str = state.owned.length > 0 && !starterGenre(state) ? startingLetters[row].toLowerCase() : String(row + 1);
      menuCursor = 0;
    }
  }
  if (key.name === 'q') {
    return quit();
  } else if (state.owned.length === 0 && state.departments.length === 0) {
    const g = departmentChoices(state)[Number(str) - 1];
    if (g) openDepartment(state, g);
  } else if (starterGenre(state)) {
    const pick = starterPlays(state)[Number(str) - 1];
    if (pick) {
      chooseStarterPlay(state, pick.id);
      scriptPlay = Math.max(0, availablePlays().indexOf(pick));
      scriptCursor = 0;
    }
  } else if (state.letters.length === 0) {
    if (str) chooseFirstLetter(state, str);
  } else if (str && '<>,.'.includes(str) && !shop && homeViews(state).length > 1) {
    // < and > (or , and .) step through the departments (Justin, 2026-10-21).
    const views = homeViews(state);
    state.settings.homeDepartment = views[(views.indexOf(homeView(state)!) + ('<,'.includes(str) ? views.length - 1 : 1)) % views.length];
    homeCursor = 0;
  } else if (shop && isShopKey(str, key)) {
    const next = shopKey(shop, str, key);
    if (next !== shop) message = '';
    shop = next;
    if (next && next !== 'research') lastStore = next;
  } else if (key.name === 'up' || key.name === 'down') {
    const n = Math.min(maxMonkeyLines, homeMonkeys(state).length);
    if (n > 0) homeCursor = (Math.min(homeCursor, n - 1) + (key.name === 'up' ? n - 1 : 1)) % n;
  } else if (key.name === 'return' || key.name === 'enter') {
    const i = homeChosen(state, homeCursor);
    if (i >= 0) {
      showingRoster = true;
      rosterCursor = Math.max(0, rosterOrder(state).indexOf(i));
    }
  } else if (str === 'h') {
    const chosen = homeChosen(state, homeCursor);
    const i = poke(state, chosen);
    message = i >= 0 ? `You pet ${monkeyName(state, i)}. <3` : `${monkeyName(state, chosen)} is busy. Only typing monkeys want petting.`;
  } else if (key.name === 'space') {
    shop = lastStore;
    shopCursor = 0;
  } else if (str === 'd') {
    if (state.monkeys.length > 0) startMove(homeChosen(state, homeCursor));
  } else if (str && /^[1-9]$/.test(str) && !shop && homeViews(state).length > 1) {
    const v = homeViews(state)[Number(str) - 1];
    if (v) {
      state.settings.homeDepartment = v;
      homeCursor = 0;
    }
  } else if (str === 'n') {
    startNaming(homeChosen(state, homeCursor));
  } else if (key.name === 'p') {
    openScript();
  } else if (str === '`') {
    showingDev = true;
    menuCursor = 0;
  } else if (str === 'o') {
    openOffice();
  } else if (str === 'c') {
    showingOptions = true;
    menuCursor = 0;
  } else if (str === '/') {
    showingHelp = true;
  } else if (str === 'i') {
    showingInventory = true;
    invHeld = null;
  } else if (str === 'm') {
    showingRoster = true;
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

// Keys reach handleKey through a stream with the mouse's escape sequences taken out;
// each click or wheel turn becomes the key press it stands for.
const keys = new PassThrough();
emitKeypressEvents(keys);
keys.on('keypress', pressKey);
process.stdin.setRawMode(true);
process.stdin.on('data', (chunk: Buffer) => {
  const { events, rest } = parseMouse(chunk.toString('utf8'));
  if (rest) keys.write(rest);
  if (!state.settings.mouse) return;
  for (const e of events) onMouse(e);
});
process.stdout.write('\x1b[?25l'); // hide cursor
showCursors(false);

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  setHour(new Date().getHours());
  const temps = tempsNow();
  const telegrams = state.telegrams.length;
  const read = state.telegrams.filter((t) => t.read).length;
  const greek = state.departments.includes('greek');
  state.stats.secondsOpen += (now - last) / 1000;
  tick(state, (now - last) / 1000);
  message = tempsGone(temps) || message;
  if (state.telegrams.length > telegrams) message = 'A knock at the door: a telegram, with no explanation. Read it in the Staff store.';
  else if (state.telegrams.filter((t) => t.read).length > read) message = `The Bombe found the key: the telegram is read (Staff store).`;
  if (!greek && state.departments.includes('greek')) message = 'The scroll is in Greek! A Greek department can type it out and translate it: build its room on the office map ([o], [r]).';
  last = now;
  draw();
}, FRAME_MS);

setInterval(() => save(state, storage), AUTOSAVE_MS);
process.on('SIGTERM', quit);
draw();
