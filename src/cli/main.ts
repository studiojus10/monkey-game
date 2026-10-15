import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { achievements, research, hr, marketing, departmentRules, desk, furnitureKinds, type RoomKind, dyeCost, hatColors, hats, maxMonkeyNameLength, maxPinnedLines, startingLetters, theme } from '../game/config';
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
  readManagerBook,
  hireManager,
  managerBlocker,
  managerCost,
  officelessDepartments,
  setHour,
  hireResearcher,
  researcherBlocker,
  researcherCost,
  startResearch,
  projectOf,
  canBuildLab,
  canBuildHR,
  canBuildMarketing,
  hireMarketer,
  marketingBlocker,
  marketingCost,
  canRemoveFurniture,
  storeFurniture,
  sellFurniture,
  sellValue,
  sellHat,
  fireBlocker,
  fireMonkey,
  hrRoom,
  isTemp,
  hireHR,
  hrBlocker,
  hrCost,
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
  nextPin,
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
  flipCoin,
  moveHat,
  swapTypewriters,
  flipChance,
  folioMultiplier,
  tick,
  togglePin,
  toggleSlot,
} from '../game/logic';
import { load, save } from '../game/save';
import { createInitialState, type Door, type Side } from '../game/state';
import { formatMultiplier, formatNumber, setScientific } from '../format';
import { fileStorage } from './fileStorage';
import {
  keyChoices,
  renderLetterPicker,
  unownedLetters,
  genreNames,
  departmentPrompt,
  managerChoices,
  managerUpgradePrompt,
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
  highlightChoice,
  promptChoices,
  homeMonkeys,
  maxMonkeyLines,
  trainees,
  typingPickPrompt,
  renderDevMenu,
  contentsPageSize,
  renderSlotsMenu,
  scriptPageSize,
  renderOptions,
  dyeColorPrompt,
  dyePick,
  hatPick,
  inspectItem,
} from './screen';
import { forLightBackground } from './style';
import { devTools } from '../game/dev';
import { renderCandidates } from './hiring';
import { inventoryRows, itemName, renderInventory, renderMonkeyPicker, type Holder, type Item } from './inventory';
import { renderRoster, rosterOrder } from './roster';
import { achievementPageRows, dictionaryColumns, dictionaryPageRows, dictionaryRowFor, dictionaryWords, renderAchievements, renderDictionary, renderStats } from './stats';
import { sideName, furnitureName, inspectSquare, renderFengShuiBook, renderManagerBook, renderOffice, renderOfficeHelp, roomName, type Cell } from './office';
import { cycleDoor, cycleWindow, doorBetween, loungeOf, officeBounds, placeDoor, roomAt, servedBy, takeDoor, toggleHall, touchingRooms } from '../game/layout';

const FRAME_MS = 250;
const AUTOSAVE_MS = 10_000;

setWordList(loadWordList());
setPlays(loadPlays());

const savePath = resolve(process.env.IDLE_SAVE ?? 'save.json');
const storage = fileStorage(savePath);

let state = load(storage);
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
  offline >= 1 ? `While you were away your monkeys earned ${formatNumber(offline)} ${theme.currency}.` : '',
  tempsGone(tempsBefore),
]
  .filter(Boolean)
  .join(' ');
let confirmingReset = false;
let confirmingFolio = false;
let confirmingFlip = false;
let pickingLetter: boolean | 'free' = false; // picking a letter to buy, or to take for a free letter
let showingScript = false;
let scriptCursor = 0;
let contents: '' | 'plays' | 'scenes' = ''; // the script's table of contents, when open
let contentsCursor = 0;
let scriptPlay = 0; // index into availablePlays()
let findIndex = -1;
let showingKeys = false;
let showingHelp = false; // the [?] page: every key on the home screen
let showingDev = false;
let showingStats = false;
let showingRoster = false; // the roster of monkeys ([m])
let confirmingFire = false; // [f] in the roster asks first
let rosterCursor = 0; // the chosen monkey's place in rosterOrder
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
let pickingTyping: '' | 'skill' | 'typewriter' = ''; // choosing a monkey for [1] or [7]
let readingBook = false; // the feng shui book, open from the office map
let readingManagerBook = false; // the manager's book, open from the office map
let officeHelp = false; // the office map's [?] page: how rooms and lounges work
let offeredBook = -1; // the piece hiding a book (feng shui or the manager's), just inspected: [y] reads it
let menuCursor = 0; // the chosen row of the open menu (opening screens, options, dev tools, keys, hiring)
let letterCursor = 0; // the chosen letter in the letter picker, among the letters not owned
let pickCursor = 0; // the chosen choice of a picker on the message line
let homeCursor = 0; // the chosen monkey's row in the home screen's table
let shopCursor = 0; // the chosen item in the open store, counted over all its pages
let officeShop: Store | null = null; // the office map's furniture shop, when open
let lastOfficeStore: Store = 'department';
let scriptShop = false; // the script page's shop, when open
let giving: { kind: 'hat'; id: string } | { kind: 'dye'; color: string } | null = null; // the menu of monkeys to give a hat or dye to
let showingInventory = false;
let invRow = 0; // the inventory cursor's row (monkeys, then storage) and item in it
let invCol = 0;
let invHeld: { who: Holder; item: Item } | null = null; // the item being moved in the inventory
let pickingDyeColor = false; // choosing which colour to dye
let pickingDepartment = false;
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

/** A hire under way through HR's list of candidates: the job, and the department for a typist or manager. */
interface Hiring {
  job: 'typing' | 'managing' | 'research' | 'hr' | 'marketing';
  genre?: Genre;
}
let hiring: Hiring | null = null;

/** The usual price of a hire, before a candidate's stats change it. */
function hiringBase(h: Hiring): number {
  if (h.job === 'managing') return managerCost(state, h.genre!);
  if (h.job === 'research') return researcherCost(state);
  if (h.job === 'hr') return hrCost(state);
  if (h.job === 'marketing') return marketingCost(state);
  return nextMonkeyCost(state, h.genre);
}

/** What a hire is for, e.g. "a monkey for Comedies". */
function hiringTitle(h: Hiring): string {
  if (h.job === 'managing') return `a manager for ${genreNames[h.genre!]}`;
  if (h.job === 'research') return 'a researcher';
  if (h.job === 'hr') return `an ${hr.name} monkey`;
  if (h.job === 'marketing') return 'a marketing monkey';
  return h.genre ? `a monkey for ${genreNames[h.genre]}` : 'a monkey';
}

/** Makes a hire: candidate `from` on HR's list, or someone unseen. */
function doHire(h: Hiring, from?: number): boolean {
  if (h.job === 'managing') return hireManager(state, h.genre, from);
  if (h.job === 'research') return hireResearcher(state, from);
  if (h.job === 'hr') return hireHR(state, from);
  if (h.job === 'marketing') return hireMarketer(state, from);
  return buyMonkey(state, h.genre, from);
}

/** Hires: through HR's list of candidates once there's an HR office, else straight away. */
function hire(h: Hiring): void {
  if (hrRoom(state)) {
    hiring = h;
    menuCursor = 0;
    message = '';
  } else if (doHire(h)) welcome(state.monkeys.length - 1);
  else message = `Not enough ${theme.currency}.`;
}

/** Acts on a store item chosen with 1-9 (see storeItems). */
function buyItem(id: string): void {
  if (id === 'train' || id === 'typewriter') {
    const what = id === 'train' ? 'skill' : 'typewriter';
    const team = trainees(state);
    if (team.length === 0) message = 'Temps can\'t be upgraded.';
    else if (team.length === 1) message = buyTyping(team[0], what);
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
      letterCursor = 0;
      message = '';
    }
  } else if (id.startsWith('hire:')) {
    const g = id.slice('hire:'.length) as Genre;
    if (!departmentsWithRoom(state).includes(g)) message = noSeatMessage();
    else if (!hrRoom(state) && state.currency < nextMonkeyCost(state, g)) message = `Not enough ${theme.currency}.`;
    else hire({ job: 'typing', genre: g });
  } else if (id === 'hire') {
    const rooms = departmentsWithRoom(state);
    if (!canSeatMonkey(state)) message = noSeatMessage();
    else if (!hrRoom(state) && state.currency < nextMonkeyCost(state)) message = `Not enough ${theme.currency}.`;
    else if (rooms.length > 1) {
      pickingDeptFor = 'buy';
      message = deptPrompt('Which department gets the new monkey?');
    } else hire({ job: 'typing', genre: rooms[0] });
  } else if (id === 'assign') {
    if (!canSeatMonkey(state)) message = noSeatMessage();
    else if (assignMonkey(state)) welcome(state.monkeys.length - 1);
    else {
      pickingDeptFor = 'assign';
      message = deptPrompt('Which department gets the new monkey?');
    }
  } else if (id.startsWith('boss:')) {
    const g = id.slice('boss:'.length) as Genre;
    const blocked = managerBlocker(state, g);
    if (blocked) message = `${genreNames[g]} can't hire a manager yet: ${blocked}.${blocked.includes('office') || blocked.includes('door') || blocked.includes('desk') ? ' See the office map ([o]).' : ''}`;
    else if (!hrRoom(state) && state.currency < managerCost(state, g)) message = `Not enough ${theme.currency}.`;
    else hire({ job: 'managing', genre: g });
  } else if (id === 'researcher') {
    const blocked = researcherBlocker(state);
    if (blocked) message = `Can't hire a researcher: ${blocked}.${blocked === 'lab needed' || blocked === 'desk needed' ? ' See the office map ([o]).' : ''}`;
    else if (!hrRoom(state) && state.currency < researcherCost(state)) message = `Not enough ${theme.currency}.`;
    else hire({ job: 'research' });
  } else if (id === 'hr') {
    const blocked = hrBlocker(state);
    if (blocked) message = `Can't hire an HR monkey: ${blocked}.${blocked === 'HR office needed' || blocked === 'desk needed' ? ' See the office map ([o]).' : ''}`;
    else if (!hrRoom(state) && state.currency < hrCost(state)) message = `Not enough ${theme.currency}.`;
    else hire({ job: 'hr' });
  } else if (id === 'marketing') {
    const blocked = marketingBlocker(state);
    if (blocked) message = `Can't hire a marketing monkey: ${blocked}.${blocked === 'Marketing office needed' || blocked === 'desk needed' ? ' See the office map ([o]).' : ''}`;
    else hire({ job: 'marketing' });
  } else if (id.startsWith('research:')) {
    const p = projectOf(id.slice('research:'.length));
    if (!p) return;
    if (state.researching) message = `${research.name} works on one project at a time.`;
    else if (state.currency < p.cost) message = `Not enough ${theme.currency}.`;
    else if (startResearch(state, p.id)) message = `${research.name} is researching ${p.name}.`;
  } else if (id === 'combo') {
    if (!buyCapRaise(state)) message = noSentences;
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
    pickingManagerUpgrade = true;
    message = managerUpgradePrompt(state);
  } else if (id.startsWith('section:')) {
    buyScriptSection(id.slice('section:'.length));
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
    // furniture:<kind>@<room kind>: the store's section says which kind of room it goes in.
    const [kind, where] = id.slice('furniture:'.length).split('@') as [string, RoomKind];
    const rooms = where === 'break' ? 'break room' : where === 'office' ? "manager's office" : "department's room";
    if (!state.office.some((r) => r.kind === where)) message = `You have no ${rooms}. Buy one on the office map ([o], then [r]).`;
    else if (!furnitureSpot(state, kind, where))
      message = `No room for it in a ${rooms}: it needs ${pieceSize(kind).join(' x ')} free squares in one. Make space or grow a room on the office map ([o]).`;
    else if (!state.stored.furniture[kind] && state.currency < furnitureCost(state, kind)) message = `Not enough ${theme.currency}.`;
    else if (buyFurniture(state, kind, where)) {
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

/** Rooms on offer by number on the office map: a room for each department without one, then a manager's office for each without one. */
function roomChoices(): { kind: RoomKind; genre?: Genre }[] {
  return [
    ...roomlessDepartments(state).map((genre) => ({ kind: 'department' as const, genre })),
    ...officelessDepartments(state).map((genre) => ({ kind: 'office' as const, genre })),
    ...(canBuildLab(state) ? [{ kind: 'lab' as const }] : []),
    ...(canBuildHR(state) ? [{ kind: 'hr' as const }] : []),
    ...(canBuildMarketing(state) ? [{ kind: 'marketing' as const }] : []),
  ];
}

/** The office map's furniture shop: under the map when the screen is tall enough for both, else on its own. */
function officeShopScreen(columns: number): string {
  const both = renderOffice(state, '', officeCursor, -1, false, null, columns, renderShop(state, officeShop!, shopCursor, message, columns, true));
  const rows = process.stdout.rows || 0;
  return rows > 0 && both.split('\n').length > rows ? renderShop(state, officeShop!, shopCursor, message, columns) : both;
}

/** Opens the office map with the cursor in the top-left corner of the first room. */
function openOffice(): void {
  showingOffice = true;
  officeShop = null;
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

/** Buys the scene (b), act (a) or whole play (w) under the script page's cursor. */
function buyScriptSection(which: string): void {
  const play = availablePlays()[scriptPlay];
  const sc = play && sceneOf(play, scriptCursor);
  if (!play || !sc) return;
  const [act, scene, what] =
    which === 'b'
      ? [sc.act, sc.key, `${play.title}, ${sceneName(sc.act, sc.scene, play.genre)}`]
      : which === 'a'
        ? [sc.act, undefined, `${play.title}, Act ${sc.act}`]
        : [undefined, undefined, play.title];
  message = buySection(state, play.id, act, scene)
    ? `You bought ${what}.`
    : `Can't buy ${what}: it's owned already or you need more ${theme.currency}.`;
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
    const open = openStores(state, store);
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

function draw() {
  const columns = fitLines();
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
  const shown = pickerOpen() ? highlightChoice(message, pickCursor) : message;
  const pick = giving && (giving.kind === 'hat' ? hatPick(state, giving.id) : dyePick(state, giving.color));
  const screen = pickingLetter
    ? renderLetterPicker(state, pickingLetter === 'free', letterCursor, message, columns)
    : pick
    ? renderMonkeyPicker(state, pick.title, pick.notes, menuCursor, shown, columns)
    : showingInventory
    ? renderInventory(state, invRow, invCol, invHeld, shown, columns)
    : hiring
    ? renderCandidates(state, hiring.job, hiringTitle(hiring), hiringBase(hiring), shown, columns, menuCursor)
    : showingScript && contents
    ? renderContents(state, contents === 'scenes' ? (availablePlays()[scriptPlay]?.id ?? null) : null, contentsCursor, shown, columns)
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
    ? renderOffice(state, shown, officeCursor, heldFurniture, officeGrowing, heldDoor?.side ?? null, columns)
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
          : renderScreen(state, shown, shop, columns, shop ? shopCursor : menuCursor, process.stdout.rows || 0, homeChosen(state, homeCursor));
  process.stdout.write('\x1b[2J\x1b[H' + (state.settings.lightBackground ? forLightBackground(screen) : screen) + '\n');
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
function pickerOpen(): boolean {
  return !!(pickingDeptFor || pickingManagerUpgrade || pickingDyeColor || pickingTyping || pickingDepartment || buyingRoom);
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

function handleKey(str: string | undefined, key: { name?: string; ctrl?: boolean }) {
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
  if (!pickerOpen()) pickCursor = 0;
  else {
    const choices = promptChoices(message);
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

  if (confirmingFlip) {
    confirmingFlip = false;
    const bet = state.currency;
    const won = key.name === 'y' ? flipCoin(state, Math.random) : null;
    message =
      won === null
        ? 'You keep your bananas.'
        : won
          ? `Heads! Your ${formatNumber(bet)} ${theme.currency} became ${formatNumber(state.currency)}.`
          : `Tails. ${formatNumber(bet)} ${theme.currency} gone. The monkeys keep typing.`;
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

  if (hiring) {
    const row = menuKey(key, state.candidates.length + 1);
    if (row >= 0) str = String(row === state.candidates.length ? 0 : row + 1);
    const n = Number(str);
    if (key.name === 'escape' || key.name === 'q') {
      hiring = null;
      message = '';
    } else if (str && /^[0-9]$/.test(str) && n <= state.candidates.length) {
      const h = hiring;
      if (doHire(h, n === 0 ? undefined : n - 1)) {
        hiring = null;
        welcome(state.monkeys.length - 1);
      } else message = `Not enough ${theme.currency}.`;
    }
    return draw();
  }

  if (pickingDeptFor) {
    const what = pickingDeptFor;
    pickingDeptFor = '';
    const g = departmentsWithRoom(state)[Number(str) - 1];
    if (g && what === 'buy') {
      hire({ job: 'typing', genre: g });
      return draw();
    }
    if (g && assignMonkey(state, g)) welcome(state.monkeys.length - 1);
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

  if (pickingTyping) {
    const what = pickingTyping;
    const i = Number(str) - 1;
    if (!str || !/^[1-9]$/.test(str) || !trainees(state).includes(i)) {
      pickingTyping = '';
      message = 'Done.';
    } else message = `${buyTyping(i, what) || `${monkeyName(state, i)} types faster.`}  ${typingPickPrompt(state, what)}`;
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
    } else if (key.name === 'tab') {
      contents = 'plays';
      contentsCursor = scriptPlay;
    } else if (play && (str === 'b' || (str === 'a' && play.genre !== 'sonnet') || str === 'w')) {
      buyScriptSection(str);
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
    } else if (key.name === 'up' || key.name === 'down') {
      const mine = departmentSlots(state, departmentGenres(state)[slotDept]);
      const at = mine.indexOf(selectedSlot) + (key.name === 'up' ? -1 : 1);
      if (mine.length > 0) selectedSlot = mine[Math.max(0, Math.min(mine.length - 1, at))];
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
    const row = menuKey(key, 3);
    if (row >= 0) str = String(row + 1);
    if (key.name === 'escape' || key.name === 'q' || str === 'c') showingOptions = false;
    else if (str === '1') state.settings.autoPlaceFurniture = !state.settings.autoPlaceFurniture;
    else if (str === '2') state.settings.lightBackground = !state.settings.lightBackground;
    else if (str === '3') setScientific((state.settings.scientific = !state.settings.scientific));
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
    if (key.name === 'escape' || key.name === 'q' || str === '?' || str === 'o') officeHelp = false;
    return draw();
  }

  if (showingOffice && officeShop) {
    const next = shopKey(officeShop, str, key);
    if (next !== officeShop) message = '';
    if (showingOffice && officeShop) officeShop = next; // buying with auto-place off closes the shop to place the piece
    if (next) lastOfficeStore = next;
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
      else if (str === 'y' && readManagerBook(state, piece)) readingManagerBook = true;
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
      const choice = roomChoices()[Number(str) - 1];
      if (str !== 'b' && !choice) message = 'No room bought.';
      else if (state.sentences < roomCost(state)) message = noSentences;
      else if (choice ? buyRoom(state, choice.kind, choice.genre) : buyRoom(state, 'break')) {
        const room = state.office[state.office.length - 1];
        Object.assign(c, { x: room.cells[0][0], y: room.cells[0][1] });
        const next = touchingRooms(state, room).filter((r) => doorBetween(state, room, r)).map((r) => `the ${roomName(state, r)}`);
        const served = room.kind === 'break' ? servedBy(state, room).map((r) => `the ${roomName(state, r)}`) : [];
        const lounge = room.kind === 'department' ? loungeOf(state, room) : undefined;
        message = [
          `You have a new room, the ${roomName(state, room)}, ${next.length > 0 ? `with a door straight into ${next.join(' and ')}` : 'with a hallway to the rest of the office'}.`,
          ...(served.length > 0 ? [`It's the lounge of ${served.join(' and ')}.`] : []),
          ...(lounge ? [`Its lounge is the ${roomName(state, lounge)}.`] : []),
          ...(room.kind === 'office' ? ["It comes with a manager's desk. Hire a manager in the Staff store."] : []),
          ...(room.kind === 'lab' ? ['Hire researchers for it in the Staff store.'] : []),
          ...(room.kind === 'hr' ? ['Hire HR monkeys for it in the Staff store.'] : []),
          ...(room.kind === 'marketing' ? ['Hire marketing monkeys for it in the Staff store: they earn royalties on finished scenes and Folios.'] : []),
        ].join(' ');
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
    } else if (str === 'e' && !holding && !officeGrowing && state.managerBook) {
      readingManagerBook = true;
    } else if (str === '?' && !holding && !officeGrowing) {
      officeHelp = true;
    } else if (str === 'f' && !holding && !officeGrowing) {
      officeShop = lastOfficeStore;
      shopCursor = 0;
    } else if ((str === 's' || str === '$') && !holding && !officeGrowing) {
      const here = roomAt(state, c.x, c.y);
      const spot = here ? cellAt(state, here.id, c.x, c.y) : null;
      if (typeof spot !== 'number') message = 'No furniture there.';
      else if (!canRemoveFurniture(state, spot)) message = 'Desks stay: monkeys work at them.';
      else {
        const name = furnitureName(state, spot);
        const value = sellValue(furnitureKinds.find((k) => k.id === state.furniture[spot].kind)?.cost ?? 0);
        if (str === 's' && storeFurniture(state, spot)) message = `The ${name} is in storage. Buying another from the store takes it out for free.`;
        else if (str === '$' && sellFurniture(state, spot)) message = `Sold the ${name} for ${formatNumber(value)} ${theme.currency}.`;
      }
    } else if (str === 'h' && !holding && !officeGrowing) {
      if (!toggleHall(state, c.x, c.y)) message = 'That square is part of a room. Hallways go outside rooms.';
    } else if (str === 'r' && !officeGrowing) {
      buyingRoom = true;
      const choices = roomChoices().map(
        (c, i) => `[${i + 1}] ${c.kind === 'marketing' ? `an office for ${marketing.name}` : c.kind === 'hr' ? `an office for ${hr.name}` : c.kind === 'lab' ? `a lab for ${research.name}` : c.kind === 'office' ? `an office for ${genreNames[c.genre!]}'s manager` : `a room for ${genreNames[c.genre!]}`}`,
      );
      message = `Buy a room (${formatNumber(roomCost(state))} Sentences): ${[...choices, '[b] a break room for furniture'].join('   ')}   (any other key cancels)`;
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      // Space (or enter) picks up and puts down: furniture first, else a door in the square's walls.
      if (officeGrowing) {
        const room = state.office.find((r) => r.id === officeGrowing);
        if (here) message = 'That square is already part of a room. Choose a +.';
        else if (state.sentences < squareCost(state)) message = noSentences;
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
    const name = (who: Holder) => (who === 'storage' ? 'storage' : monkeyName(state, who));
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
      if (!invHeld) {
        if (!item) message = 'Nothing there to pick up.';
        else if (item.kind === 'typewriter' && isTemp(state.monkeys[here.who as number])) message = 'Temps keep their own typewriter.';
        else invHeld = { who: here.who, item };
      } else if (invHeld.who === here.who) invHeld = null; // put back where it was
      else if (invHeld.item.kind === 'hat') {
        const what = itemName(state, invHeld.who, invHeld.item).toLowerCase();
        if (moveHat(state, invHeld.who, invHeld.item.id, here.who)) {
          message = here.who === 'storage' ? `The ${what} is in storage.` : `${name(here.who)} has the ${what} now. [w] puts it on.`;
          invHeld = null;
          invCol = Math.max(0, Math.min(invCol, inventoryRows(state)[invRow].items.length - 1));
        } else message = `${name(here.who)} has a ${what} already.`;
      } else if (here.who === 'storage') message = 'Typewriters stay with monkeys: put it on another monkey to swap.';
      else if (swapTypewriters(state, invHeld.who as number, here.who)) {
        message = `${name(invHeld.who)} and ${name(here.who)} swapped typewriters.`;
        invHeld = null;
      } else message = 'Temps keep their own typewriter.';
    } else if (str === 'w' && !invHeld) {
      const item = here.items[invCol];
      if (here.who === 'storage') message = 'Give it to a monkey first: pick it up and put it on one.';
      else if (item?.kind !== 'hat') message = 'Choose a hat to wear.';
      else message = wearHatOn(here.who, item.id);
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
        message = `Fire ${monkeyName(state, i)}? It leaves for good; its hats go into storage. [y] fire   (any other key: no)`;
      }
    } else if (str === 'h' && i !== undefined) {
      const hat = hats.find((h) => h.id === state.monkeys[i].hat);
      if (!hat) message = `${monkeyName(state, i)} wears no hat.`;
      else if (wearHat(state, i, hat.id)) message = `${monkeyName(state, i)} took off the ${hat.name.toLowerCase()}; it stays in its wardrobe.`;
    } else if (str === '$' && i !== undefined) {
      const hat = hats.find((h) => h.id === state.monkeys[i].hat);
      if (!hat) message = `${monkeyName(state, i)} wears no hat to sell.`;
      else if (sellHat(state, i)) message = `Sold the ${hat.name.toLowerCase()} for ${formatNumber(sellValue(hat.cost))} Sentences.`;
    }
    else if (key.name === 'up') rosterCursor = Math.max(0, rosterCursor - 1);
    else if (key.name === 'down') rosterCursor = Math.min(order.length - 1, rosterCursor + 1);
    else if (str === 'n' && order[rosterCursor] !== undefined) startNaming(order[rosterCursor]);
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
    if (key.name === 'escape' || key.name === 'q' || str === '?') showingHelp = false;
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
  const opening = state.owned.length === 0 && state.departments.length === 0 ? departmentChoices(state).length : state.owned.length === 0 ? starterScenes(state).length : state.letters.length === 0 ? startingLetters.length : 0;
  if (opening > 0) {
    const row = menuKey(key, opening);
    if (row >= 0) {
      str = state.owned.length > 0 ? startingLetters[row].toLowerCase() : String(row + 1);
      menuCursor = 0;
    }
  }
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
  } else if (key.name === 'tab' && !shop && homeViews(state).length > 1) {
    const views = homeViews(state);
    state.settings.homeDepartment = views[(views.indexOf(homeView(state)!) + 1) % views.length];
    homeCursor = 0;
  } else if (shop && isShopKey(str, key)) {
    const next = shopKey(shop, str, key);
    if (next !== shop) message = '';
    if (next) shop = lastStore = next;
    else shop = null;
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
    const i = homeChosen(state, homeCursor);
    message = moveMonkey(state, i)
      ? `${monkeyName(state, i)} now works in ${genreNames[monkeyGenre(state, state.monkeys[i])!]}.`
      : state.monkeys.length === 1
        ? 'You need more monkeys and departments first.'
        : 'No monkey moved. Moving needs a second department.';
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
  } else if (str === '?') {
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
  } else if (str === '$') {
    if (state.currency <= 0) message = `You have no ${theme.currency} to bet.`;
    else {
      confirmingFlip = true;
      message = `Flip a coin for all ${formatNumber(state.currency)} ${theme.currency}? Heads (a ${(flipChance(state) * 100).toFixed(1)}% chance) doubles them; tails loses them all. [y] flip   (any other key: no)`;
    }
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
  setHour(new Date().getHours());
  const temps = tempsNow();
  state.stats.secondsOpen += (now - last) / 1000;
  tick(state, (now - last) / 1000);
  message = tempsGone(temps) || message;
  last = now;
  draw();
}, FRAME_MS);

setInterval(() => save(state, storage), AUTOSAVE_MS);
process.on('SIGTERM', quit);
draw();
