import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { maxMonkeyNameLength, maxPinnedLines, theme } from '../game/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PlayData } from '../game/plays';
import {
  applyOfflineProgress,
  buyFasterTyping,
  buyLetter,
  activePlay,
  buyCapRaise,
  buyHeavier,
  buyKey,
  buyMonkey,
  chooseNextPlay,
  nextPlayChoices,
  monkeyName,
  renameMonkey,
  buySlot,
  chooseStarterPlay,
  chooseFirstLetter,
  keysUnlocked,
  moveSlot,
  letterCost,
  poke,
  reachableLines,
  setSlotWord,
  slotsUnlocked,
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
  playChoices,
  nextPlayPrompt,
  renderKeysMenu,
  renderScreen,
  renderScript,
  renderSlotsMenu,
  scriptPageSize,
  unownedLetters,
} from './screen';

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
let findIndex = -1;
let showingKeys = false;
let showingSlots = false;
let selectedSlot = 0;
let slotWordDraft: string | null = null;
let pickingMonkeyToName = false;
let pickingNextPlay = false;
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

function draw() {
  // Clear the screen and move the cursor home, then redraw.
  const screen = showingScript
    ? renderScript(state, scriptCursor, message)
    : showingKeys
      ? renderKeysMenu(state, message)
      : showingSlots
        ? renderSlotsMenu(state, selectedSlot, slotWordDraft, message)
        : renderScreen(state, message);
  process.stdout.write('\x1b[2J\x1b[H' + screen + '\n');
}

function quit() {
  save(state, storage);
  process.stdin.setRawMode?.(false);
  process.stdout.write('\x1b[?25h');
  console.log(`\nSaved to ${savePath}. Bye!`);
  process.exit(0);
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

  if (pickingMonkeyToName) {
    pickingMonkeyToName = false;
    const i = Number(str) - 1;
    if (str && /^[1-9]$/.test(str) && i < state.monkeys.length) startNaming(i);
    else message = 'No monkey renamed.';
    return draw();
  }

  if (pickingNextPlay) {
    pickingNextPlay = false;
    const play = nextPlayChoices(state)[Number(str) - 1];
    message = play && chooseNextPlay(state, play.id) ? `Your monkeys turn to ${play.title}.` : 'No play chosen.';
    return draw();
  }

  if (pickingLetter) {
    pickingLetter = false;
    const letter = str?.toUpperCase() ?? '';
    message = buyLetter(state, letter) ? `You bought ${letter}.` : 'No letter bought.';
    return draw();
  }

  if (showingScript) {
    message = '';
    const play = activePlay(state);
    const last = (play?.lines.length ?? 1) - 1;
    const sceneOf = (i: number) => (play ? `${play.lines[i].act}.${play.lines[i].scene}` : '');
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
      if (i > 0 && sceneOf(i - 1) !== sceneOf(i)) i--;
      while (i > 0 && sceneOf(i - 1) === sceneOf(i)) i--;
      scriptCursor = i;
    } else if (key.name === 'right' && play) {
      let i = scriptCursor;
      while (i < last && sceneOf(i + 1) === sceneOf(i)) i++;
      scriptCursor = Math.min(last, i + 1);
    } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
      if (!togglePin(state, scriptCursor)) message = `You can pin up to ${maxPinnedLines} lines. Unpin one first.`;
    } else if (key.name === 'f') {
      const reachable = reachableLines(state);
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
    } else if (str === 'b') {
      if (buySlot(state)) selectedSlot = state.slots.length - 1;
      else message = 'Not enough Lines. Lines come from writing lines of the play.';
    } else if (str && /^[1-9]$/.test(str) && Number(str) <= state.slots.length) {
      selectedSlot = Number(str) - 1;
    } else if (state.slots[selectedSlot]) {
      if (str === 'w') slotWordDraft = '';
      else if (str === 'o') toggleSlot(state, selectedSlot);
      else if (key.name === 'left') moveSlot(state, selectedSlot, -1);
      else if (key.name === 'right') moveSlot(state, selectedSlot, 1);
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
    } else if (str && /^[a-z]$/i.test(str)) {
      const l = str.toUpperCase();
      if (!state.letters.includes(l)) message = `You don't own ${l} yet.`;
      else message = buyHeavier(state, l) ? `${l} is heavier now.` : `Not enough ${theme.currency}.`;
    }
    return draw();
  }

  message = '';
  if (key.name === 'q') {
    return quit();
  } else if (!state.play) {
    const play = playChoices()[Number(str) - 1];
    if (play) chooseStarterPlay(state, play.id);
  } else if (state.letters.length === 0) {
    if (str) chooseFirstLetter(state, str);
  } else if (key.name === 'space') {
    poke(state);
  } else if (str === '1') {
    if (!buyFasterTyping(state)) message = `Not enough ${theme.currency}.`;
  } else if (str === '2' && unownedLetters(state).length > 0) {
    if (state.currency < letterCost(state.letters.length)) {
      message = `Not enough ${theme.currency}.`;
    } else {
      pickingLetter = true;
      message = letterPickPrompt(state);
    }
  } else if (str === '3') {
    if (buyMonkey(state)) startNaming(state.monkeys.length - 1);
    else message = 'Not enough Lines. Lines come from writing lines of the play.';
  } else if (str === '4') {
    if (!buyCapRaise(state)) message = 'Not enough Sentences. Sentences come from writing lines of 3+ words.';
  } else if (str === '5') {
    if (keysUnlocked(state)) showingKeys = true;
    else message = 'Typewriter keys unlock later.';
  } else if (str === '6') {
    if (slotsUnlocked(state)) showingSlots = true;
    else message = 'Word slots unlock later.';
  } else if (str === 'c' && nextPlayChoices(state).length > 0) {
    pickingNextPlay = true;
    message = nextPlayPrompt(state);
  } else if (str === 'n') {
    if (state.monkeys.length === 1) startNaming(0);
    else {
      pickingMonkeyToName = true;
      message = `Name which monkey? Press 1-${Math.min(9, state.monkeys.length)}.`;
    }
  } else if (key.name === 'p') {
    showingScript = true;
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
