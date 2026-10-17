/**
 * An Enigma machine (the army's three-rotor Enigma I): plugboard, three of
 * the five rotors left to right, reflector B, with the middle rotor's double
 * step. Ring settings stay at A. Enciphering is its own inverse, so the same
 * key turns a telegram back into its plain text.
 */

const A = 'A'.charCodeAt(0);
const rotorWirings = ['EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'AJDKSIRUXBLHWTMCQGZNPYFVOE', 'BDFHJLCPRTXVZNYEIWGAKMUSQO', 'ESOVPZJAYQUIRHXLNFTGKDCMWB', 'VZBRGITYUPSDNHLXAWMJQOFECK'];
const notches = 'QEVJZ';
const reflectorB = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

/** The rotor names, I to V. */
export const rotorNames = ['I', 'II', 'III', 'IV', 'V'];

/** A day's key: which rotors stand left to right (0-4), their starting letters, and the plugboard's leads as letter pairs ("AB CD" written "ABCD"). */
export interface EnigmaKey {
  rotors: number[];
  start: string;
  plugs: string;
}

const forward = rotorWirings.map((w) => [...w].map((c) => c.charCodeAt(0) - A));
const backward = forward.map((f) => {
  const inv: number[] = [];
  f.forEach((to, from) => (inv[to] = from));
  return inv;
});
const reflect = [...reflectorB].map((c) => c.charCodeAt(0) - A);

/** Runs text through the machine with this key. Letters only (anything else is dropped); returns capitals. */
export function encipher(key: EnigmaKey, text: string): string {
  const plug = [...Array(26).keys()];
  for (let i = 0; i + 1 < key.plugs.length; i += 2) {
    const a = key.plugs.charCodeAt(i) - A;
    const b = key.plugs.charCodeAt(i + 1) - A;
    plug[a] = b;
    plug[b] = a;
  }
  const pos = [...key.start].map((c) => c.charCodeAt(0) - A);
  const atNotch = (k: number) => pos[k] === notches.charCodeAt(key.rotors[k]) - A;
  let out = '';
  for (const ch of text.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') continue;
    // The double step: a middle rotor at its notch turns itself and the left one.
    if (atNotch(1)) {
      pos[0] = (pos[0] + 1) % 26;
      pos[1] = (pos[1] + 1) % 26;
    } else if (atNotch(2)) pos[1] = (pos[1] + 1) % 26;
    pos[2] = (pos[2] + 1) % 26;
    let c = plug[ch.charCodeAt(0) - A];
    for (let k = 2; k >= 0; k--) c = (forward[key.rotors[k]][(c + pos[k]) % 26] - pos[k] + 26) % 26;
    c = reflect[c];
    for (let k = 0; k < 3; k++) c = (backward[key.rotors[k]][(c + pos[k]) % 26] - pos[k] + 26) % 26;
    out += String.fromCharCode(plug[c] + A);
  }
  return out;
}

/** A random key: three different rotors, random starting letters and this many plugboard leads. */
export function randomKey(leads: number, rng: () => number): EnigmaKey {
  const pick = <T>(list: T[]) => list.splice(Math.floor(rng() * list.length), 1)[0];
  const rotors = [0, 1, 2, 3, 4];
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  return {
    rotors: [pick(rotors), pick(rotors), pick(rotors)],
    start: [0, 1, 2].map(() => letters[Math.floor(rng() * 26)]).join(''),
    plugs: Array.from({ length: Math.min(13, leads) * 2 }, () => pick(letters)).join(''),
  };
}

/** Text in the telegraph's five-letter groups. */
export function inGroups(text: string): string {
  return text.match(/.{1,5}/g)?.join(' ') ?? '';
}
