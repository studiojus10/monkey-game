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
| `enter` | Pet the monkey into typing an extra letter |
| `space` | Open or close the shop (closed at the start). It opens on the store you used last; `tab` or left/right switch stores and `1`–`9` buy within the store (* marks what you can afford, on items and on store tabs) |
| Staff store | Faster typing for a monkey (pick which if you have several), hire a monkey (costs Sentences: pick its department if more than one has room, then type its name; `enter` keeps M-2, M-3, ...), assign a monkey earned from an act, raise the combo cap (costs Sentences), upgrade a manager (+0.1x points for its whole department, costs Lines) |
| Typewriters store | Letter keys (points, plus Words from the 3rd letter on; then press the letter you want), a better typewriter for a monkey (+10 typing skill cap), typewriter keys menu (once you own 13 letters: `1`–`9` buys a key, `esc` goes back), word slots menu (once you own 13 letters, per department, `tab` switches: `b` buys a slot for Lines, `w` sets its word, `o` switches it on or off, left/right move its position) |
| Furniture store | Potted plants, floor lamps and bookshelves (decor: a department's monkeys tire slower when it stands in their room), water coolers, couches and TVs (comforts: breaks go faster when they stand in a break room); every piece adds a little happiness, a points bonus. With the auto-place option on (the default) each stands in the first free square, a break room first; with it off, the office map opens so you place it yourself |
| Script store | Opens the script browser (same as `p`) |
| Accessories store | Items for one monkey each (pick which), one per slot. Hats change the monkey's icon on the home screen and the office map (` @` bare-headed, the hat on its left): baseball cap `d@` (tires 10% slower), top hat `#@` (its words pay 15% more), thinking cap `^@` (combo cap +1), crown `W@` (+10% points and speed). Others show as letters after its name, e.g. `M-1[gc]`: reading glasses (its words pay 10% more), headphones (tires 15% slower), fuzzy slippers (breaks 30% faster), coffee mug (types 10% faster) |
| Real estate store | Open a new department (at 10 monkeys, then 20, and the Sonnets at 30; each holds up to 10 typing monkeys plus a manager), view and design the office map, buy a room for a department that has none, buy a break room, grow any room by one square (the most compact square, or choose it on the map) |
| `p` | Script browser, opening on the play you are working on (your latest pin, else where your monkeys last wrote): arrows scroll by line and scene, `tab` opens a table of contents (all plays, then `enter` for that play's acts and scenes, `enter` again jumps there; `esc` steps back), `b`/`a`/`w` buy the scene/act/whole play under the cursor, `enter` pins a line to the home screen (up to 5), `,` and `.` jump to the previous or next scene you own (across plays), `f` jumps to the next shortest line within reach, `esc` goes back |
| `o` | Office map: your rooms from above, any shape, with every desk and who sits at it (`[@]` a monkey, `[@&` a manager; a hat replaces the `[`, e.g. `#@]`) and your furniture. Arrows move the cursor, `tab` jumps to the next room, `enter` picks up a piece of furniture and `enter` again puts it down on a free square (`esc` leaves it where it was; desks stay in their department's room), `x` grows the room: move to a `+` and press `enter` to buy that square. `esc` goes back |
| `c` | Options: switch furniture auto-placement on or off |
| `t` | Statistics: time typing, letters typed per letter, words spelled, longest word and chain, longest line written, most spelled words; `w` switches to the dictionary, `esc` goes back |
| `w` | Dictionary: every word your monkeys have spelled, A to Z, with how many times; up/down (or page up/down) scroll, a letter jumps to it, `t` switches to statistics, `esc` goes back |
| `` ` `` | Development tools for testing (add 1 billion points, 1,000 Lines or Sentences, every letter); they change your save, so use a throwaway one (`IDLE_SAVE=/tmp/x.json npm start`) |
| `d` | Move a monkey to its next department |
| `m` | Promote a monkey to manager (department of 6+ monkeys) or send one back to typing; a manager pins the line with the fewest words, preferring lines within reach (earliest first on ties) and fills your word slots |
| `n` | Name a monkey (pick which one with `1`–`9` if you have several) |
| `s` | Save now |
| `r` | Reset progress (asks to confirm) |
| `q` or `Ctrl+C` | Save and quit |

## What's in it

- **A monkey** at a typewriter, typing random letters from the letters you own. It starts slow, one letter every 2 seconds.
- **Your first letter**: A or I, since it has to be a word on its own. Every word the monkey types scores (sum of Scrabble-style letter values) × length, so `I` is 1, `IT` is 4 and `ZAP` is 42. Everything shows in capitals; the live run of words is bold.
- **Combos**: words typed back to back form a chain. Each different word of 4+ letters in it raises the chain's multiplier by one, up to ×3. Sentences raise the cap. A letter that fits no word breaks the chain. A chain of 3+ words of 4+ letters pays a **Sentence** when it breaks, plus one more for every 3 further long words. Each monkey's current multiplier shows next to its line, and the live part of the line is bold.
- **More letters**, bought with points, so longer words become possible. Words come from the public-domain ENABLE list in `data/words.txt`, plus A and I.
- **The script**: you start by opening a department for comedies, histories or tragedies and taking one short scene free. More scenes, acts (20% off) and whole plays (40% off) cost points. Plays: A Midsummer Night's Dream, Richard III, Hamlet, Macbeth. When a monkey types one of its lines word for word (spaces and punctuation don't matter), the line is written into your script. The first time pays a **Line** and a points bonus that grows steeply with the line's length; lines of 3+ words also pay a **Sentence** every time. Texts are the public-domain Moby Shakespeare via [the MIT Shakespeare](https://github.com/TheMITTech/shakespeare), converted with `scripts/import-play.ts`.
- **Milestones**: writing every line of a scene gives a permanent points bonus (bigger for longer scenes) and some Sentences; finishing an act gives a permanent typing speed bonus (bigger for longer acts) and a free monkey. Bonuses add up the same however you bought the scenes.
- **Departments**: one per genre. Each holds up to 10 typing monkeys plus a manager, and has its own word slots; you pick each new monkey's department. The second opens at 10 monkeys and the third at 20; each monkey only writes plays of its department's genre. A fourth, the **Sonnets**, opens last at 30: verse lines pay 2 Lines each, and a finished sonnet pays a Line per line in it.
- **Office space**: you start in a room of 4 squares. Each monkey gets a free desk on a square of its department's room, so floor space limits how many monkeys a department can have. Grow rooms one square at a time, give each new department its own room, and buy break rooms for furniture. Everything places itself, but the office map (`o`) lets you design the layout: choose where rooms grow and where furniture and desks stand.
- **Energy**: monkeys tire as they type. A tired monkey is slower, down to 75% of its speed when worn out, and then takes a one-minute break on its own and comes back rested. Each monkey's speed right now and its energy show next to its name. Furniture helps: decor in a department's room slows tiring, comforts in a break room speed up breaks, and every piece adds happiness (a points bonus).
- **Accessories**: dress up individual monkeys with glasses, headphones, slippers, a coffee mug or a thinking cap, each giving that monkey a small boost.
- **More monkeys**, bought with Sentences. Each types its own line and can be named. The first 10 are shown under the title, their text lined up in one column.
- **Typewriter keys**, once you own 13 letters: combination keys (`TH`, `ING`, `QU`, ...) and word keys type their whole text in one keystroke. A word of 3+ letters becomes a word key once your monkeys have spelled it 100 times (10% more for each word key you own). Only useful keys are offered; a test showed junk clusters dilute the pool, while good keys roughly double points per keystroke.
- **Word slots**, once you own 13 letters, bought with Lines: each locks one position in a chain to a word you choose ("3rd word: FRIEND"), typed as a finished word. Switch slots off any time for fully random typing. Pinned lines show slot words in bold where they match.
- **Faster typing**, bought with points for each monkey separately: each level of a monkey's typing skill makes it type 25% faster and costs more than the last. Its typewriter caps the skill (10 levels on the Rusty typewriter); a better typewriter allows 10 more.
- **Autosave** to `save.json` every 10 seconds and on quit. Set `IDLE_SAVE=path/to/file.json` to use a different file, which is handy for testing from a fresh start.
- **Offline progress**: the monkeys keep typing while you're away, up to 8 hours.

## Development

```bash
npm test           # run unit tests
npm run typecheck  # type-check without running
```

Names and balance numbers are all in [`src/game/config.ts`](src/game/config.ts); the terminal screen picks changes up automatically.
