import './style.css';
import { applyOfflineProgress, tick } from './game/logic';
import { load, save, wipe } from './game/save';
import { createInitialState } from './game/state';
import { mountUi, showNotice } from './ui/render';
import { formatNumber } from './ui/format';
import { theme } from './game/config';

const AUTOSAVE_MS = 10_000;

const root = document.querySelector<HTMLElement>('#app')!;
let state = load();

const offline = applyOfflineProgress(state, Date.now());

const update = mountUi(root, () => state, {
  onReset() {
    wipe();
    state = createInitialState();
  },
});

if (offline >= 1) {
  showNotice(root, `While you were away you earned ${formatNumber(offline)} ${theme.currency}.`);
}

let last = performance.now();
function frame(now: number) {
  tick(state, (now - last) / 1000);
  last = now;
  update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(() => save(state), AUTOSAVE_MS);
window.addEventListener('beforeunload', () => save(state));
