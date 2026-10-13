import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { departmentRules, managers, maxMonkeyNameLength, maxPinnedLines, theme } from '../game/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sceneName, type PlayData } from '../game/plays';
import {
  applyOfflineProgress,
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
  tick,
  togglePin,
  toggleSlot,
} from '../game/logic';
import { load, save } from '../game/save';
import { createInitialState } from '../game/state';
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
  renderScript,
  renderContents,
  stores,
  storeChoices,
  type Store,
  typists,
  typingPickPrompt,
  renderDevMenu,
  contentsPageSize,
  renderSlotsMenu,
  scriptPageSize,
} from './screen';
import { devTools } from '../game/dev';
import { dictionaryColumns, dictionaryPageRows, dictionaryRowFor, dictionaryWords, renderDictionary, renderStats } from './stats';

const FRAME_MS = 250;
const AUTOSAVE_MS = 10_000;

setWordList(loadWordList());
setPlays(loadPlays());

const savePath = resolve(process.env.IDLE_SAVE ?? 'save.json');
const storage = fileStorage(savePath);

let state = load(storage);
const offline = applyOfflineProgress(state, Date.now());
let message =
  offline >= 1 ? `While you were away your monkeys earned ${formatNumber(offline)} ${theme.currency}.` : '';
let confirmingReset = false;
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
let showingDictionary = false;
let dictionaryRow = 0;
let shop: Store | null = null; // the open store; the shop starts closed and space opens and closes it
let lastStore: Store = 'staff';
let showingSlots = false;
let selectedSlot = 0; // index into state.slots
let slotDept = 0; // index into departmentGenres(state)
let slotWordDraft: string | null = null;
let pickingMonkeyToName = false;
let pickingTyping: '' | 'skill' | 'typewriter' = ''; // choosing a monkey for [1] or [7]
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
  } else if (id === 'hire') {
    const rooms = departmentsWithRoom(state);
    if (state.lines < nextMonkeyCost(state)) message = 'Not enough Lines. Lines come from writing lines of the play.';
    else if (departmentGenres(state).length > 0 && rooms.length === 0) message = 'Every department is full. Open another in Real estate.';
    else if (rooms.length > 1) {
      pickingDeptFor = 'buy';
      message = deptPrompt('Which department gets the new monkey?');
    } else if (buyMonkey(state)) startNaming(state.monkeys.length - 1);
  } else if (id === 'assign') {
    if (departmentsWithRoom(state).length === 0) message = 'Every department is full. Open another in Real estate.';
    else if (assignMonkey(state)) startNaming(state.monkeys.length - 1);
    else {
      pickingDeptFor = 'assign';
      message = deptPrompt('Which department gets the new monkey?');
    }
  } else if (id === 'combo') {
    if (!buyCapRaise(state)) message = 'Not enough Sentences. Sentences come from writing lines of 3+ words.';
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
  // Clear the screen and move the cursor home, then redraw.
  const screen = showingScript && contents
    ? renderContents(state, contents === 'scenes' ? (availablePlays()[scriptPlay]?.id ?? null) : null, contentsCursor, message)
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
        : renderScreen(state, message, shop);
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

  if (pickingManagerUpgrade) {
    pickingManagerUpgrade = false;
    const i = managerChoices(state)[Number(str) - 1];
    if (i === undefined) message = 'No manager upgraded.';
    else message = upgradeManager(state, i) ? `${monkeyName(state, i)}'s department works harder.` : 'Not enough Lines.';
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

  if (pickingTyping) {
    const what = pickingTyping;
    pickingTyping = '';
    const i = Number(str) - 1;
    if (!str || !/^[1-9]$/.test(str) || !typists(state).includes(i)) message = 'Nothing bought.';
    else message = buyTyping(i, what);
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
    pickingLetter = false;
    const letter = str?.toUpperCase() ?? '';
    message = buyLetter(state, letter) ? `You bought ${letter}.` : 'No letter bought.';
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

  if (showingStats || showingDictionary) {
    const maxRow = Math.max(0, Math.ceil(dictionaryWords(state).length / dictionaryColumns) - dictionaryPageRows);
    if (key.name === 'escape' || key.name === 'q') {
      showingStats = showingDictionary = false;
    } else if (showingStats && str === 'w') {
      showingStats = false;
      showingDictionary = true;
    } else if (showingDictionary && str === 't') {
      showingDictionary = false;
      showingStats = true;
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
    poke(state);
  } else if (key.name === 'space') {
    shop = shop ? null : lastStore;
  } else if (shop && (key.name === 'tab' || key.name === 'right' || key.name === 'left')) {
    const step = key.name === 'left' ? stores.length - 1 : 1;
    shop = lastStore = stores[(stores.indexOf(shop) + step) % stores.length];
  } else if (shop && str && /^[1-9]$/.test(str)) {
    const item = storeChoices(state, shop)[Number(str) - 1];
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
  } else if (str === 't') {
    showingStats = true;
  } else if (str === 'w') {
    showingDictionary = true;
    dictionaryRow = 0;
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
