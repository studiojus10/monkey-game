import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { deserialize, saveVersions } from '../game/save';

/**
 * Save profiles (Justin, 2026-10-21): up to three games side by side, each in
 * its own file next to the usual save. The first profile is the usual save
 * (save.json), so older games carry on as profile 1; the others are
 * save-2.json and save-3.json. Their names and which one is played live in
 * save-profiles.json.
 */
export const profileSlots = 3;
export const maxProfileName = 20;

export interface Profiles {
  active: number; // the profile being played, from 0
  names: string[];
}

/** One profile as the profiles screen shows it. */
export interface ProfileInfo {
  name: string;
  empty: boolean;
  gameVersion: string;
  bananas: number;
  monkeys: number;
  seconds: number; // time with the game open
  saved: number; // epoch ms
}

export const defaultProfileName = (slot: number) => `Profile ${slot + 1}`;

/** The save file of a profile (from 0): the usual save for the first. */
export function profilePath(base: string, slot: number): string {
  return slot === 0 ? base : base.replace(/(\.json)?$/, `-${slot + 1}.json`);
}

const metaPath = (base: string) => base.replace(/(\.json)?$/, '-profiles.json');

/** The profiles' names and the one being played; defaults if the file is missing or broken. */
export function readProfiles(base: string): Profiles {
  const names = Array.from({ length: profileSlots }, (_, i) => defaultProfileName(i));
  try {
    const raw = JSON.parse(readFileSync(metaPath(base), 'utf8')) as Partial<Profiles>;
    const active = Number.isInteger(raw.active) && raw.active! >= 0 && raw.active! < profileSlots ? raw.active! : 0;
    const saved = Array.isArray(raw.names) ? raw.names : [];
    return { active, names: names.map((n, i) => (typeof saved[i] === 'string' && saved[i].trim() ? saved[i].slice(0, maxProfileName) : n)) };
  } catch {
    return { active: 0, names };
  }
}

export function writeProfiles(base: string, profiles: Profiles): void {
  writeFileSync(metaPath(base), JSON.stringify(profiles, null, 2));
}

/** What each profile holds, read from its save. */
export function profileInfo(base: string, profiles: Profiles): ProfileInfo[] {
  return profiles.names.map((name, i) => {
    const path = profilePath(base, i);
    const raw = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const empty = { name, empty: true, gameVersion: '', bananas: 0, monkeys: 0, seconds: 0, saved: 0 };
    if (!raw) return empty;
    const state = deserialize(raw);
    return { name, empty: false, gameVersion: saveVersions(raw)?.gameVersion ?? '', bananas: state.currency, monkeys: state.monkeys.length, seconds: state.stats.secondsOpen, saved: state.lastSaved };
  });
}

/** Renames a profile: letters, numbers, spaces and a little punctuation, up to maxProfileName. False if the name won't do. */
export function renameProfile(profiles: Profiles, slot: number, name: string): boolean {
  const clean = name.trim();
  if (!clean || clean.length > maxProfileName || !/^[A-Za-z0-9 '!?.,-]+$/.test(clean)) return false;
  profiles.names[slot] = clean;
  return true;
}

/** The first profile with no save, or -1 if all are in use. */
export function emptyProfile(base: string): number {
  return Array.from({ length: profileSlots }, (_, i) => i).find((i) => !existsSync(profilePath(base, i))) ?? -1;
}

/** Copies a profile's save into the first empty profile, named "<name> copy". Returns where it went, or -1 if every profile is in use or there's nothing to copy. */
export function copyProfile(base: string, profiles: Profiles, from: number): number {
  const to = emptyProfile(base);
  if (to < 0 || !existsSync(profilePath(base, from))) return -1;
  copyFileSync(profilePath(base, from), profilePath(base, to));
  profiles.names[to] = `${profiles.names[from].slice(0, maxProfileName - 5)} copy`;
  return to;
}

/** Deletes a profile's save and gives it back its default name. */
export function deleteProfile(base: string, profiles: Profiles, slot: number): void {
  rmSync(profilePath(base, slot), { force: true });
  rmSync(`${profilePath(base, slot)}.tmp`, { force: true });
  profiles.names[slot] = defaultProfileName(slot);
}
