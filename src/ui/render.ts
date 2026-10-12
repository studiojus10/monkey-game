import { generators, theme, upgrades } from '../game/config';
import {
  buyGenerator,
  buyUpgrade,
  click,
  clickValue,
  generatorCost,
  owned,
  productionPerSecond,
} from '../game/logic';
import type { GameState } from '../game/state';
import { formatNumber } from './format';

export interface UiHandlers {
  onReset: () => void;
}

/** Builds the DOM once and returns an update function to call every frame. */
export function mountUi(root: HTMLElement, getState: () => GameState, handlers: UiHandlers) {
  root.innerHTML = `
    <header>
      <h1>${theme.title}</h1>
      <p class="currency"><span id="currency"></span> ${theme.currency}</p>
      <p class="rate"><span id="rate"></span> ${theme.currency}/sec</p>
      <p id="notice" class="notice" hidden></p>
    </header>
    <button id="click" class="big">${theme.clickAction} (+<span id="click-value"></span>)</button>
    <section>
      <h2>Generators</h2>
      <div id="generators"></div>
    </section>
    <section>
      <h2>Upgrades</h2>
      <div id="upgrades"></div>
    </section>
    <footer><button id="reset" class="link">Reset save</button></footer>
  `;

  // Only touch the DOM when content changes, so hover and click state survive.
  const lastHtml = new WeakMap<HTMLElement, string>();
  const setHtml = (el: HTMLElement, html: string) => {
    if (lastHtml.get(el) === html) return;
    lastHtml.set(el, html);
    el.innerHTML = html;
  };

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  $('#click').addEventListener('click', () => click(getState()));
  $('#reset').addEventListener('click', () => {
    if (confirm('Erase all progress?')) handlers.onReset();
  });

  const genButtons = generators.map((def) => {
    const btn = document.createElement('button');
    btn.className = 'row';
    btn.addEventListener('click', () => buyGenerator(getState(), def.id));
    $('#generators').append(btn);
    return { def, btn };
  });

  const upgButtons = upgrades.map((def) => {
    const btn = document.createElement('button');
    btn.className = 'row';
    btn.addEventListener('click', () => buyUpgrade(getState(), def.id));
    $('#upgrades').append(btn);
    return { def, btn };
  });

  return function update() {
    const state = getState();
    $('#currency').textContent = formatNumber(state.currency);
    $('#rate').textContent = formatNumber(productionPerSecond(state));
    $('#click-value').textContent = formatNumber(clickValue(state));

    for (const { def, btn } of genButtons) {
      const cost = generatorCost(def, owned(state, def.id));
      btn.disabled = state.currency < cost;
      setHtml(btn, `<strong>${def.name} ×${owned(state, def.id)}</strong>
        <span>+${formatNumber(def.production)}/s each</span>
        <span class="cost">${formatNumber(cost)}</span>`);
    }

    for (const { def, btn } of upgButtons) {
      const bought = state.upgrades.includes(def.id);
      btn.hidden = bought;
      btn.disabled = bought || state.currency < def.cost;
      setHtml(btn, `<strong>${def.name}</strong>
        <span>${def.description}</span>
        <span class="cost">${formatNumber(def.cost)}</span>`);
    }
  };
}

export function showNotice(root: HTMLElement, text: string) {
  const el = root.querySelector<HTMLElement>('#notice');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 6000);
}
