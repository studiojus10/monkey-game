import { hr, monkeyStats, theme } from '../game/config';
import { hirePrice, jobFeeling, postCost, posts, traitOf, type Post } from '../game/logic';
import { createMonkey, type GameState } from '../game/state';
import { formatDuration, formatPrice } from '../format';
import { priceNamed, viewName } from './screen';
import { affordable, bold, dim, green, inverse, isCursor, keyRow, padVisible, plainText, red, rule, titleBar, yellow } from './style';

/** A stat as a percent: green above average, red below. */
function percent(stat: number): string {
  const text = `${Math.round(stat * 100)}%`;
  return stat > 1 ? green(text) : stat < 1 ? red(text) : text;
}

/** The cheapest a candidate (from: its index in state.candidates, or none for someone unseen) costs for any post with room, or Infinity with none. */
export function cheapestHire(state: GameState, from?: number): number {
  return Math.min(...posts(state).filter((p) => !p.blocked).map((p) => hirePrice(state, postCost(state, p), p.job, from)));
}

/**
 * HR's list of candidates for a new monkey: each one's speed, stamina, the
 * job it likes best, trait (once the manager's book is read), whether it's a
 * temp, and its lowest price (each department's comes next, in the popup);
 * [0] hires someone unseen.
 */
export function renderCandidates(state: GameState, message = '', columns = 0, cursor = -1): string {
  const rows = state.candidates.map((c, i) => {
    const monkey = { ...createMonkey(), ...c };
    const best = monkeyStats.jobs.map((j) => ({ j, f: jobFeeling(monkey, j.id) })).sort((a, b) => b.f.bonus - a.f.bonus)[0];
    const likes = best.f.bonus > 0 ? green(`${best.f.name} ${best.j.name.toLowerCase()}`) : 'nothing much';
    const trait = state.managerBook ? (traitOf(monkey)?.name ?? '?') : dim('?');
    const price = cheapestHire(state, i);
    return [
      ` [${i + 1}]`,
      padVisible(percent(c.speedStat), 6),
      padVisible(percent(c.stamina), 8),
      padVisible(likes, 19),
      padVisible(trait, 15),
      padVisible(c.tempLeft > 0 ? `temp ${formatDuration(c.tempLeft)}` : 'for good', 11),
      Number.isFinite(price) ? bold(state.currency >= price ? yellow(formatPrice(price)) : formatPrice(price)) : red('no room'),
    ].join(' ');
  }).map((r, i) => (isCursor(i, cursor) ? inverse(plainText(r)) : r));
  const unseenPrice = cheapestHire(state);
  const unseen = ` [0]  someone unseen: random stats and trait   ${Number.isFinite(unseenPrice) ? `from ${priceNamed(unseenPrice, state.currency)}` : red('no room')}`;
  return [
    titleBar(state, 'Hiring a monkey', columns),
    '',
    dim(` ${hr.name} found these monkeys, priced by speed, stamina and feeling about the job.`),
    dim(` Lowest price in ${theme.currency} of any department; pick the department next.`),
    '',
    dim(['    ', 'SPEED ', 'STAMINA ', 'LIKES BEST         ', 'TRAIT          ', 'STAYS      ', 'PRICE FROM'].join(' ')),
    ...(rows.length > 0 ? rows : [dim('     Nobody right now.')]),
    '',
    isCursor(cursor, state.candidates.length) ? inverse(plainText(unseen)) : unseen,
    ...(state.candidates.some((c) => c.tempLeft > 0)
      ? ['', dim(` Temps cost less and work better, but leave in time and can't be upgraded.`)]
      : []),
    '',
    dim(` New candidates in ${formatDuration(state.candidatesIn)}.`),
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([['up/down', 'choose'], ['enter', 'hire'], [rows.length > 0 ? `0-${rows.length}` : '0', 'hire'], ['esc', 'back']], columns),
  ].join('\n');
}

/** A post's name in the department popup: its department, or "<department> manager". */
export function postName(state: GameState, p: Post): string {
  return p.job === 'managing' ? `${viewName(state, p.genre!)} manager` : viewName(state, p.genre ?? p.id) || 'The office';
}

/**
 * The popup that asks which department a monkey goes to (Justin, 2026-10-18):
 * every department with its count (x/y monkeys) and, for a hire, its price
 * for that monkey (`from`: its place on HR's list). Full or blocked ones say
 * why in red. Lines of a box, to lay over the screen with overlay().
 */
export function renderPostPopup(state: GameState, title: string, list: Post[], cursor = -1, hiring = false, from?: number): string[] {
  const nameWidth = Math.max(10, ...list.map((p) => postName(state, p).length));
  const rows = list.map((p, i) => {
    const key = i < 9 ? `[${i + 1}]` : '   ';
    const count = `(${p.have}/${p.max})`.padEnd(8);
    const cost = hiring ? hirePrice(state, postCost(state, p), p.job, from) : 0;
    const name = `${key} ${postName(state, p).padEnd(nameWidth)} ${count}`;
    if (p.blocked) return { text: `${name} ${red(p.blocked)}`, plain: `${name} ${p.blocked}`, can: false };
    const price = hiring ? `${state.currency >= cost ? '* ' : '  '}${formatPrice(cost)} Bananas` : '';
    return { text: hiring && state.currency >= cost ? affordable(`${name} ${price}`) : `${name} ${price}`, plain: `${name} ${price}`, can: true };
  });
  const width = Math.max(title.length, 'up/down choose  enter pick  esc cancel'.length, ...rows.map((r) => r.plain.trimEnd().length)) + 2;
  const line = (text: string, plain = plainText(text)) => `|${text}${' '.repeat(Math.max(0, width - plain.length))}|`;
  return [
    `+${'-'.repeat(width)}+`,
    line(` ${bold(title)}`, ` ${title}`),
    line(''),
    ...rows.map((r, i) => (isCursor(i, cursor) ? line(inverse(` ${r.plain.trimEnd()}`), ` ${r.plain.trimEnd()}`) : line(` ${r.text.trimEnd()}`, ` ${r.plain.trimEnd()}`))),
    line(''),
    line(dim(` ${list.length > 9 ? '' : `[1-${list.length}] `}pick   [esc] cancel`)),
    `+${'-'.repeat(width)}+`,
  ];
}

/** Lays a popup's lines over a screen, from its third line, a few columns in; the rows it covers are replaced. */
export function overlay(screen: string, box: string[], columns = 0): string {
  const lines = screen.split('\n');
  const boxWidth = Math.max(...box.map((b) => plainText(b).length));
  const indent = ' '.repeat(Math.max(1, Math.min(4, Math.floor(((columns || 80) - boxWidth) / 2))));
  while (lines.length < box.length + 2) lines.push('');
  box.forEach((b, k) => (lines[2 + k] = indent + b));
  return lines.join('\n');
}
