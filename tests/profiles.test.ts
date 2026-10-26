import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyProfile, deleteProfile, emptyProfile, profileInfo, profilePath, readProfiles, renameProfile, writeProfiles } from '../src/cli/profiles';
import { renderOptions, renderProfiles } from '../src/cli/screen';
import { serialize } from '../src/game/save';
import { startedGame } from './start';

const plain = (text: string) => text.replace(/\x1b\[[\d;]+m/g, '');
const squash = (text: string) => plain(text).replace(/ +/g, ' ');

function folder(): string {
  return join(mkdtempSync(join(tmpdir(), 'profiles-')), 'save.json');
}

describe('save profiles', () => {
  it('keeps the usual save as profile 1, with defaults when there is no profiles file', () => {
    const base = folder();
    expect(profilePath(base, 0)).toBe(base);
    expect(profilePath(base, 2)).toBe(base.replace(/save\.json$/, 'save-3.json'));
    expect(readProfiles(base)).toEqual({ active: 0, names: ['Profile 1', 'Profile 2', 'Profile 3'] });
    writeFileSync(base.replace(/save\.json$/, 'save-profiles.json'), 'not json');
    expect(readProfiles(base).active).toBe(0);
  });

  it('renames, copies into the first empty profile and deletes', () => {
    const base = folder();
    const s = startedGame(0);
    s.currency = 1234;
    writeFileSync(base, serialize(s));
    const profiles = readProfiles(base);
    expect(renameProfile(profiles, 0, '  Big game ')).toBe(true);
    expect(renameProfile(profiles, 0, '')).toBe(false);
    expect(renameProfile(profiles, 0, 'x'.repeat(21))).toBe(false);
    expect(profiles.names[0]).toBe('Big game');
    expect(emptyProfile(base)).toBe(1);
    expect(copyProfile(base, profiles, 1)).toBe(-1); // nothing to copy
    expect(copyProfile(base, profiles, 0)).toBe(1);
    expect(profiles.names[1]).toBe('Big game copy');
    expect(readFileSync(profilePath(base, 1), 'utf8')).toBe(readFileSync(base, 'utf8'));
    expect(copyProfile(base, profiles, 0)).toBe(2);
    expect(copyProfile(base, profiles, 0)).toBe(-1); // every profile in use
    const info = profileInfo(base, profiles);
    expect(info.map((p) => p.empty)).toEqual([false, false, false]);
    expect(info[1]).toMatchObject({ name: 'Big game copy', bananas: 1234, monkeys: s.monkeys.length });
    deleteProfile(base, profiles, 1);
    expect(existsSync(profilePath(base, 1))).toBe(false);
    expect(profiles.names[1]).toBe('Profile 2');
    profiles.active = 2;
    writeProfiles(base, profiles);
    expect(readProfiles(base)).toEqual(profiles);
  });

  it('draws the profiles, the one being played and the chosen one', () => {
    const s = startedGame(0);
    const rows = [
      { name: 'Big game', empty: false, gameVersion: '0.15.1', bananas: 1234, monkeys: 3, seconds: 3600 },
      { name: 'Profile 2', empty: true, gameVersion: '', bananas: 0, monkeys: 0, seconds: 0 },
      { name: 'Profile 3', empty: true, gameVersion: '', bananas: 0, monkeys: 0, seconds: 0 },
    ];
    const text = squash(renderProfiles(s, rows, 0, 1, 'Hello'));
    expect(text).toContain('SAVE PROFILES');
    expect(text).toContain(' [1] Big game playing 1,234 Bananas, 3 monkeys, 1h 0m played (v0.15.1)');
    expect(text).toContain('>[2] Profile 2 empty: [enter] starts a new game here');
    expect(text).toContain('Hello');
    expect(squash(renderOptions(s, 0, -1, 'Big game'))).toContain('[6] Save profiles Big game');
  });
});
