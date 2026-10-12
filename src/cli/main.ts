import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { theme } from '../game/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PlayData } from '../game/plays';
import {
  applyOfflineProgress,
  buyFasterTyping,
  buyLetter,
  buyCapRaise,
  buyHeavier,
  buyKey,
  buyMonkey,
  chooseStarterPlay,
  chooseFirstLetter,
  keysUnlocked,
  letterCost,
  poke,
  setPlays,
  setWordList,
  tick,
} from '../game/logic';
import { load, save } from '../game/save';
import { createInitialState } from '../game/state';
import { formatNumber } from '../format';
import { fileStorage } from './fileStorage';
import {
  keyChoices,
  letterPickPrompt,
  playChoices,
  renderKeysMenu,
  renderScreen,
  renderScript,
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
let showingKeys = false;

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
    ? renderScript(state)
    : showingKeys
      ? renderKeysMenu(state, message)
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

  if (pickingLetter) {
    pickingLetter = false;
    const letter = str?.toUpperCase() ?? '';
    message = buyLetter(state, letter) ? `You bought ${letter}.` : 'No letter bought.';
    return draw();
  }

  if (showingScript) {
    if (key.name === 'q') return quit();
    showingScript = false;
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
    if (!buyMonkey(state)) message = 'Not enough Lines. Lines come from writing lines of the play.';
  } else if (str === '4') {
    if (!buyCapRaise(state)) message = 'Not enough Sentences. Sentences come from writing lines of 3+ words.';
  } else if (str === '5') {
    if (keysUnlocked(state)) showingKeys = true;
    else message = 'Typewriter keys unlock later.';
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
