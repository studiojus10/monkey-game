import { hatColors, hats, marketing, codebreaking, records, research, hr, monkeyStats } from '../game/config';
import {
  comboMultiplier,
  currentSpeed,
  isResearcher,
  isHR,
  isMarketer,
  isCodebreaker,
  isRecorder,
  isTemp,
  isTypist,
  jobFeeling,
  jobOf,
  statsShown,
  monkeyGenre,
  monkeyHappiness,
  monkeyName,
  skillCap,
  traitOf,
  typewriterName,
  managerSpeed,
  slotDelay,
} from '../game/logic';
import type { GameState } from '../game/state';
import { bySeniority, codebreakingStatus, recordsStatus, departmentName as deptName, dyed, hatEffect, staffViews, iconOf, speedText, traitNow } from './screen';
import { formatDuration } from '../format';
import { bold, dim, green, isCursor, shortKeyRow, red, rule, scrollMarks, titleBar, highlight, wrapAnsi } from './style';

/** What [enter] offers for the chosen monkey on the roster (Justin, 2026-10-21: an actions menu instead of a long key row). */
export const rosterActions: [string, string][] = [['n', 'Rename'], ['d', 'Move department'], ['h', 'Change hat'], ['v', 'Sell its hat'], ['f', 'Fire']];

/** Every key of the roster; its key row shows the main ones, [/] the rest. */
export const rosterKeys: [string, string][] = [['up/down', 'choose a monkey'], ['enter', 'actions'], ...rosterActions, ['esc', 'back']];

/** Monkeys shown at once in the roster's list; the list scrolls to keep the cursor in view. */
export const rosterPageRows = 12;

/** Every monkey by index, for the roster: department by department (as < > orders them), managers first, then in the order they were hired. */
export function rosterOrder(state: GameState): number[] {
  const viewOf = (i: number) => {
    const m = state.monkeys[i];
    return isResearcher(m) ? research.id : isHR(m) ? hr.id : isMarketer(m) ? marketing.id : isCodebreaker(m) ? codebreaking.id : isRecorder(m) ? records.id : (monkeyGenre(state, m) ?? '');
  };
  const views = staffViews(state);
  const rank = (i: number) => {
    // Departments in < > order, then HR, then Marketing.
    const k = views.indexOf(viewOf(i));
    return k >= 0 ? k : views.length + (viewOf(i) === marketing.id ? 1 : viewOf(i) === codebreaking.id ? 2 : viewOf(i) === records.id ? 3 : 0);
  };
  // Within a department, managers first, then by seniority (Justin, 2026-10-18).
  const senior = bySeniority(state, state.monkeys.map((_, i) => i));
  return senior.sort((a, b) => rank(a) - rank(b) || senior.indexOf(a) - senior.indexOf(b));
}

/** A department's name for the roster: its genre's, or R&D. */
function departmentName(state: GameState, i: number): string {
  const m = state.monkeys[i];
  if (isResearcher(m)) return research.name;
  if (isHR(m)) return hr.name;
  if (isMarketer(m)) return marketing.name;
  if (isCodebreaker(m)) return codebreaking.name;
  if (isRecorder(m)) return records.name;
  const g = monkeyGenre(state, m);
  return g ? deptName(state, g) : 'No department yet';
}

/** A hidden stat as a percent: green above average, red below. */
function statText(stat: number): string {
  const text = `${Math.round((stat || 1) * 100)}%`;
  return stat > 1 ? green(text) : stat && stat < 1 ? red(text) : text;
}

/**
 * The roster: every monkey, grouped by department, with a cursor on one
 * (`cursor` is a position in rosterOrder), and below the list everything
 * about that monkey: its job, typing, energy, hats, trait (once the manager's
 * book is read).
 */
export function renderRoster(state: GameState, cursor: number, message = '', columns = 0, pageRows = rosterPageRows): string {
  const order = rosterOrder(state);
  const at = Math.max(0, Math.min(cursor, order.length - 1));
  const top = Math.max(0, Math.min(at - Math.floor(pageRows / 2), order.length - pageRows));
  const list: string[] = [];
  order.forEach((i, k) => {
    const dept = departmentName(state, i);
    if (k === 0 || departmentName(state, order[k - 1]) !== dept) {
      if (k >= top && k < top + pageRows) list.push(dim(` ${dept.toUpperCase()}`));
    }
    if (k < top || k >= top + pageRows) return;
    const m = state.monkeys[i];
    const role = [m.manager ? 'manager' : isResearcher(m) ? 'researcher' : isHR(m) ? 'HR' : isMarketer(m) ? 'marketing' : isCodebreaker(m) ? 'codebreaker' : isRecorder(m) ? 'records clerk' : '', isTemp(m) ? 'temp' : ''].filter(Boolean).join(', ');
    // The cursor's row is inverse; the others show the hat in its dye.
    const row = `${iconOf(m)} ${monkeyName(state, i)}${role ? `  (${role})` : ''}`;
    list.push(isCursor(k, at) ? `   ${highlight(`${row} `.padEnd(30))}` : `   ${dyed(m, iconOf(m))} ${monkeyName(state, i)}${role ? dim(`  (${role})`) : ''}`);
  });

  const details = order.length > 0 ? detailsOf(state, order[at]) : [];
  // The details are padded to the tallest monkey's (as wrapped to the screen), so the page is as tall
  // whichever monkey is chosen: its rules and keys stay put and its list keeps its size. The others
  // are measured with wide stand-ins for the costly numbers (see detailsOf), never shorter than they are.
  // A message takes two of the padding's lines (more if it wraps), so it doesn't move the keys either.
  const height = (lines: string[]) => lines.reduce((n, l) => n + wrapAnsi(l, columns).length, 0);
  const tallest = Math.max(height(details), ...order.map((k) => height(detailsOf(state, k, false))));
  const note = message ? ['', ` ${bold(message)}`] : [];
  const padding = Array<string>(Math.max(0, tallest + 2 - height(details) - height(note))).fill('');

  return [
    titleBar(state, 'Monkeys', columns),
    '',
    ...scrollMarks(top, order.length - top - pageRows, 'more monkeys')[0],
    ...list,
    ...scrollMarks(top, order.length - top - pageRows, 'more monkeys')[1],
    ...(order.length > pageRows ? [dim(`   ${at + 1} of ${order.length}`)] : []),
    '',
    rule(columns),
    ...details,
    ...note,
    ...padding,
    '',
    rule(columns),
    shortKeyRow(rosterKeys, ['up/down', 'enter', 'esc'], columns),
  ].join('\n');
}

/**
 * Everything about monkey `i`, for the roster's details under its list.
 * Not `exact`: for measuring how many lines they take, with stand-ins as wide
 * as the widest for the numbers that cost a pass over the office (speed,
 * happiness, slot speed), so every monkey can be measured each frame.
 */
function detailsOf(state: GameState, i: number, exact = true): string[] {
  const m = state.monkeys[i];
  const happiness = m && exact ? monkeyHappiness(state, m) : 9.99;
  const label = (s: string) => dim(`   ${s.padEnd(10)}`);
  const hat = hats.find((h) => h.id === m?.hat);
  const trait = m && traitOf(m);
  return !m
    ? []
    : [
        ` ${bold(`${iconOf(m)} ${monkeyName(state, i)}`)}${dim(`   hired #${i + 1}`)}`,
        `${label('Job')} ${m.manager ? `Manager of ${departmentName(state, i)} (level ${m.managerLevel})` : isResearcher(m) ? `Researcher in ${research.name}` : isHR(m) ? `Works in ${hr.name}: keeps the monkeys happy` : isMarketer(m) ? `Works in ${marketing.name}: earns royalties` : isCodebreaker(m) ? `Works in ${codebreaking.name}: ${codebreakingStatus(state)}` : isRecorder(m) ? `Works in ${records.name}: ${recordsStatus(state)}` : `Types for ${departmentName(state, i)}`}`,
        ...(m.manager ? [`${label('Slots')} changes one every ${exact ? slotDelay(state, m).toFixed(1) : '999.9'}s (x${exact ? managerSpeed(state, m).toFixed(2) : '99.99'} speed: upgrades, office furniture${state.fengShuiBook ? ', chi' : ''})`] : []),
        `${label('Worked')} ${formatDuration(m.worked)} at the company`,
        ...(isTemp(m) ? [`${label('Temp')} leaves in ${formatDuration(m.tempLeft)}; temps can't be upgraded`] : []),
        ...(isTypist(m)
          ? [
              `${label('Typing')} skill ${m.skill}/${skillCap(m)} on a ${typewriterName(m.typewriter)}, ${speedText(exact ? currentSpeed(state, m) : 555555)} now`,
              `${label('Energy')} ${m.resting ? 'resting' : `${Math.round(m.energy * 100)}%`}   combo x${comboMultiplier(state, m).toFixed(1)}`,
            ]
          : []),
        `${label('Happiness')} ${happiness < 0 ? '' : '+'}${Math.round(happiness * 100)}%${m.petHappiness > 0 ? dim(`  (petted lately: +${(m.petHappiness * 100).toFixed(1)}%)`) : ''}`,
        `${label('Hat')} ${hat ? `${hat.name}${m.hatColor ? `, dyed ${hatColors.find((c) => c.id === m.hatColor)?.id}` : ''}: ${hatEffect(hat)}` : 'none'}`,
        ...(state.managerBook ? [`${label('Trait')} ${trait ? `${trait.name}: ${traitNow(state, m)}. ${dim(trait.text)}` : '?'}`] : []),
        ...(statsShown(state)
          ? [
              `${label('Stats')} speed ${statText(m.speedStat)}   stamina ${statText(m.stamina)}`,
              `${label('Jobs')} ${monkeyStats.jobs
                .map((j) => {
                  const f = jobFeeling(m, j.id);
                  const text = `${j.name} ${f.name}`;
                  const shown = f.bonus > 0 ? green(text) : f.bonus < 0 ? red(text) : text;
                  return j.id === jobOf(m) ? bold(shown) : shown;
                })
                .join(dim(', '))}`,
            ]
          : [`${label('Stats')} ${dim(`unknown (an ${hr.name} Department would find out)`)}`]),
      ];
}
