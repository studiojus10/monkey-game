import { hatColors, hats, research } from '../game/config';
import {
  comboMultiplier,
  currentSpeed,
  deskOf,
  isResearcher,
  isTypist,
  monkeyGenre,
  monkeyHappiness,
  monkeyName,
  skillCap,
  traitOf,
  typewriterName,
} from '../game/logic';
import type { GameState } from '../game/state';
import { dyed, genreNames, hatEffect, homeViews, iconOf, speedText, traitNow } from './screen';
import { roomName } from './office';
import { bold, dim, inverse, keyRow, rule, titleBar } from './style';

/** Monkeys shown at once in the roster's list; the list scrolls to keep the cursor in view. */
export const rosterPageRows = 12;

/** Every monkey by index, for the roster: department by department (as [tab] orders them), then in the order they were hired. */
export function rosterOrder(state: GameState): number[] {
  const viewOf = (i: number) => {
    const m = state.monkeys[i];
    return isResearcher(m) ? research.id : (monkeyGenre(state, m) ?? '');
  };
  const views = homeViews(state);
  const rank = (i: number) => {
    const k = views.indexOf(viewOf(i));
    return k < 0 ? views.length : k;
  };
  return state.monkeys.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
}

/** A department's name for the roster: its genre's, or R&D. */
function departmentName(state: GameState, i: number): string {
  const m = state.monkeys[i];
  if (isResearcher(m)) return research.name;
  const g = monkeyGenre(state, m);
  return g ? genreNames[g] : 'No department yet';
}

/**
 * The roster: every monkey, grouped by department, with a cursor on one
 * (`cursor` is a position in rosterOrder), and below the list everything
 * about that monkey: its job, typing, energy, hats, trait (once the manager's
 * book is read) and desk.
 */
export function renderRoster(state: GameState, cursor: number, message = '', columns = 0): string {
  const order = rosterOrder(state);
  const at = Math.max(0, Math.min(cursor, order.length - 1));
  const top = Math.max(0, Math.min(at - Math.floor(rosterPageRows / 2), order.length - rosterPageRows));
  const list: string[] = [];
  order.forEach((i, k) => {
    const dept = departmentName(state, i);
    if (k === 0 || departmentName(state, order[k - 1]) !== dept) {
      if (k >= top && k < top + rosterPageRows) list.push(dim(` ${dept.toUpperCase()}`));
    }
    if (k < top || k >= top + rosterPageRows) return;
    const m = state.monkeys[i];
    const role = m.manager ? 'manager' : isResearcher(m) ? 'researcher' : '';
    // The cursor's row is inverse; the others show the hat in its dye.
    const row = `${iconOf(m)} ${monkeyName(state, i)}${role ? `  (${role})` : ''}`;
    list.push(k === at ? `   ${inverse(`${row} `.padEnd(30))}` : `   ${dyed(m, iconOf(m))} ${monkeyName(state, i)}${role ? dim(`  (${role})`) : ''}`);
  });

  const i = order[at];
  const m = state.monkeys[i];
  const label = (s: string) => dim(`   ${s.padEnd(10)}`);
  const desk = i === undefined ? undefined : deskOf(state, i);
  const room = desk === undefined ? undefined : state.office.find((r) => r.id === state.furniture[desk].room);
  const hat = hats.find((h) => h.id === m?.hat);
  const owned = m ? hats.filter((h) => m.hats.includes(h.id)).map((h) => h.name.toLowerCase()) : [];
  const trait = m && traitOf(m);
  const details = !m
    ? []
    : [
        ` ${bold(`${iconOf(m)} ${monkeyName(state, i)}`)}${dim(`   hired #${i + 1}`)}`,
        `${label('Job')} ${m.manager ? `Manager of ${departmentName(state, i)} (level ${m.managerLevel})` : isResearcher(m) ? `Researcher in ${research.name}` : `Types for ${departmentName(state, i)}`}`,
        ...(isTypist(m)
          ? [
              `${label('Typing')} skill ${m.skill}/${skillCap(m)} on a ${typewriterName(m.typewriter)}, ${speedText(currentSpeed(state, m))} now`,
              `${label('Energy')} ${m.resting ? 'resting' : `${Math.round(m.energy * 100)}%`}   combo x${comboMultiplier(state, m)}`,
            ]
          : []),
        `${label('Happiness')} +${Math.round(monkeyHappiness(state, m) * 100)}%${m.petHappiness > 0 ? dim(`  (petted lately: +${(m.petHappiness * 100).toFixed(1)}%)`) : ''}`,
        `${label('Hat')} ${hat ? `${hat.name}${m.hatColor ? `, dyed ${hatColors.find((c) => c.id === m.hatColor)?.id}` : ''}: ${hatEffect(hat)}` : 'none'}`,
        ...(owned.length > 1 ? [`${label('Wardrobe')} ${owned.join(', ')}`] : []),
        `${label('Trait')} ${state.managerBook ? (trait ? `${trait.name}: ${traitNow(state, m)}. ${dim(trait.text)}` : '?') : dim('unknown (perhaps a book somewhere explains monkeys)')}`,
        `${label('Desk')} ${room ? `in the ${roomName(state, room)}` : 'none yet'}`,
      ];

  return [
    titleBar(state, 'Monkeys', columns),
    '',
    ...list,
    ...(order.length > rosterPageRows ? [dim(`   ${at + 1} of ${order.length}`)] : []),
    '',
    rule(columns),
    ...details,
    ...(message ? ['', ` ${bold(message)}`] : []),
    '',
    rule(columns),
    keyRow([['up/down', 'choose a monkey'], ['n', 'rename it'], ['esc', 'back']], columns),
  ].join('\n');
}
