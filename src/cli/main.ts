import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { theme } from '../game/config';
import { applyOfflineProgress, chooseFirstLetter, poke, tick } from '../game/logic';
import { load, save } from '../game/save';
import { createInitialState } from '../game/state';
import { formatNumber } from '../format';
import { fileStorage } from './fileStorage';
import { renderScreen } from './screen';

const FRAME_MS = 250;
const AUTOSAVE_MS = 10_000;

const savePath = resolve(process.env.IDLE_SAVE ?? 'save.json');
const storage = fileStorage(savePath);

let state = load(storage);
const offline = applyOfflineProgress(state, Date.now());
let message =
  offline >= 1 ? `While you were away your monkeys earned ${formatNumber(offline)} ${theme.currency}.` : '';
let confirmingReset = false;

function draw() {
  // Clear the screen and move the cursor home, then redraw.
  process.stdout.write('\x1b[2J\x1b[H' + renderScreen(state, message) + '\n');
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

  message = '';
  if (key.name === 'q') {
    return quit();
  } else if (state.letters.length === 0) {
    if (str) chooseFirstLetter(state, str);
  } else if (key.name === 'space') {
    poke(state);
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
