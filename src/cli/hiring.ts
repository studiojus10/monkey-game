import { hr, monkeyStats } from '../game/config';
import { hirePrice, jobFeeling, traitOf } from '../game/logic';
import { createMonkey, type GameState } from '../game/state';
import { formatDuration } from '../format';
import { priceNamed } from './screen';
import { bold, dim, green, inverse, isCursor, keyRow, padVisible, plainText, red, rule, titleBar } from './style';

/** A stat as a percent: green above average, red below. */
function percent(stat: number): string {
  const text = `${Math.round(stat * 100)}%`;
  return stat > 1 ? green(text) : stat < 1 ? red(text) : text;
}

/**
 * HR's list of candidates for a job (a monkeyStats.jobs id) whose usual price
 * is `base`: each one's speed, stamina, feeling about the job, trait (once the
 * manager's book is read), whether it's a temp, and price; [0] hires someone
 * unseen at the usual price.
 */
export function renderCandidates(state: GameState, job: string, title: string, base: number, message = '', columns = 0, cursor = -1): string {
  const jobName = monkeyStats.jobs.find((j) => j.id === job)?.name ?? job;
  const rows = state.candidates.map((c, i) => {
    const f = jobFeeling({ ...createMonkey(), ...c }, job);
    const feeling = f.bonus > 0 ? green(f.name) : f.bonus < 0 ? red(f.name) : f.name;
    const trait = state.managerBook ? (traitOf({ ...createMonkey(), ...c })?.name ?? '?') : dim('?');
    const price = hirePrice(state, base, job, i);
    return [
      ` [${i + 1}]`,
      padVisible(percent(c.speedStat), 7),
      padVisible(percent(c.stamina), 8),
      padVisible(feeling, 9),
      padVisible(trait, 14),
      padVisible(c.tempLeft > 0 ? `temp ${formatDuration(c.tempLeft)}` : 'for good', 11),
      priceNamed(price, state.currency),
    ].join('  ');
  }).map((r, i) => (isCursor(i, cursor) ? inverse(plainText(r)) : r));
  const unseen = ` [0]  someone unseen  ${priceNamed(base, state.currency)}`;
  return [
    titleBar(state, `Hiring: ${title}`, columns),
    '',
    dim(` ${hr.name} found these monkeys, priced by speed, stamina and feeling about ${jobName.toLowerCase()}.`),
    '',
    dim(['    ', 'SPEED  ', 'STAMINA ', jobName.toUpperCase().padEnd(9), 'TRAIT         ', 'STAYS      ', 'PRICE'].join('  ')),
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
