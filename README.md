# Infinite Monkeys

An idle game about infinite monkeys typing at random until they write Shakespeare. It runs in your terminal and is written in TypeScript. The full design and build plan are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Playing

Requires Node 22.12 or newer.

```bash
npm install
npm start
```

| Key | Action |
| --- | --- |
| `1`–`3` | Pick your first department (genre), then a free first scene (start of the game only) |
| `a` or `i` | Pick your first letter (start of the game only) |
| `space` | Poke the monkey into typing an extra letter |
| `1` | Buy "Faster typing" (`*` marks what you can afford) |
| `2` | Buy a letter, then press the letter you want |
| `3` | Buy another monkey (costs Lines), then type its name (`enter` keeps M-2, M-3, ...) |
| `4` | Raise the combo cap (costs Sentences) |
| `5` | Typewriter keys menu (once you own 13 letters): press a letter to make it heavier, `1`–`9` to buy a key, `esc` to go back |
| `6` | Word slots menu (once you own 13 letters), per department (`tab` switches): `b` buys a slot (costs Lines), `w` sets its word, `o` switches it on or off, left/right move its position |
| `p` | Script browser: arrows scroll by line and scene, `tab` switches play, `b`/`a`/`w` buy the scene/act/whole play under the cursor, `enter` pins a line to the home screen (up to 5), `f` jumps to the next shortest line within reach, `esc` goes back |
| `g` | Open a new department (at 10 monkeys, then 20, and the Sonnets at 30); each holds up to 10 monkeys |
| `d` | Move a monkey to its next department |
| `m` | Promote a monkey to manager (department of 6+ monkeys) or send one back to typing; a manager pins the next reachable line and fills your word slots |
| `u` | Upgrade a manager: +0.1x points for its whole department (costs Lines) |
| `n` | Name a monkey (pick which one with `1`–`9` if you have several) |
| `s` | Save now |
| `r` | Reset progress (asks to confirm) |
| `q` or `Ctrl+C` | Save and quit |

## What's in it

- **A monkey** at a typewriter, typing random letters from the letters you own. It starts slow, one letter every 2 seconds.
- **Your first letter**: A or I, since it has to be a word on its own. Every word the monkey types scores (sum of Scrabble-style letter values) × length, so `I` is 1, `IT` is 4 and `ZAP` is 42. Everything shows in capitals; the live run of words is bold.
- **Combos**: words typed back to back form a chain. Each different word of 4+ letters in it raises the chain's multiplier by one, up to ×3. Sentences raise the cap. A letter that fits no word breaks the chain. Each monkey's current multiplier shows next to its line, and the live part of the line is bold.
- **More letters**, bought with points, so longer words become possible. Words come from the public-domain ENABLE list in `data/words.txt`, plus A and I.
- **The script**: you start by opening a department for comedies, histories or tragedies and taking one short scene free. More scenes, acts (20% off) and whole plays (40% off) cost points. Plays: A Midsummer Night's Dream, Richard III, Hamlet, Macbeth. When a monkey types one of its lines word for word (spaces and punctuation don't matter), the line is written into your script. The first time pays a **Line** and a points bonus that grows steeply with the line's length; lines of 3+ words also pay a **Sentence** every time. Texts are the public-domain Moby Shakespeare via [the MIT Shakespeare](https://github.com/TheMITTech/shakespeare), converted with `scripts/import-play.ts`.
- **Milestones**: writing every line of a scene gives a permanent points bonus (bigger for longer scenes) and some Sentences; finishing an act gives a permanent typing speed bonus (bigger for longer acts) and a free monkey. Bonuses add up the same however you bought the scenes.
- **Departments**: one per genre. Each holds up to 10 monkeys and has its own word slots. The second opens at 10 monkeys and the third at 20; each monkey only writes plays of its department's genre. A fourth, the **Sonnets**, opens last at 30: verse lines pay 2 Lines each, and a finished sonnet pays a Line per line in it.
- **More monkeys**, bought with Lines. Each types its own line and can be named. The first 10 are shown under the title, their text lined up in one column.
- **Typewriter keys**, once you own 13 letters: heavier letters come up more often, and combination keys (`TH`, `ING`, `QU`, ...) and word keys (`THE`, `AND`, `LORD`, ...) type their whole text in one keystroke. Only useful keys are offered; a test showed junk clusters dilute the pool, while good keys roughly double points per keystroke.
- **Word slots**, once you own 13 letters, bought with Lines: each locks one position in a chain to a word you choose ("3rd word: FRIEND"), typed as a finished word. Switch slots off any time for fully random typing. Pinned lines show slot words in bold where they match.
- **Faster typing**, bought with points: each level makes the monkey type 25% faster and costs more than the last.
- **Autosave** to `save.json` every 10 seconds and on quit. Set `IDLE_SAVE=path/to/file.json` to use a different file, which is handy for testing from a fresh start.
- **Offline progress**: the monkeys keep typing while you're away, up to 8 hours.

## Development

```bash
npm test           # run unit tests
npm run typecheck  # type-check without running
```

Names and balance numbers are all in [`src/game/config.ts`](src/game/config.ts); the terminal screen picks changes up automatically.
