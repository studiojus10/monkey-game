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
| `a` or `i` | Pick your first letter (start of the game only) |
| `space` | Poke the monkey into typing an extra letter |
| `1` | Buy "Faster typing" (`*` marks what you can afford) |
| `2` | Buy a letter, then press the letter you want |
| `3` | Buy another monkey |
| `s` | Save now |
| `r` | Reset progress (asks to confirm) |
| `q` or `Ctrl+C` | Save and quit |

## What's in it

- **A monkey** at a typewriter, typing random letters from the letters you own. It starts slow, one letter every 2 seconds.
- **Your first letter**: A or I, since it has to be a word on its own. Every word the monkey types scores (sum of Scrabble-style letter values) × length, so `I` is 1, `IT` is 4 and `ZAP` is 42. Scored words show in capitals and skipped letters in lower case.
- **More letters**, bought with points, so longer words become possible. Words come from the public-domain ENABLE list in `data/words.txt`, plus A and I.
- **More monkeys**, a late upgrade that unlocks once you own 13 letters. Each types its own line. The first 10 are shown under the title.
- **Faster typing**, bought with points: each level makes the monkey type 25% faster and costs more than the last.
- **Autosave** to `save.json` every 10 seconds and on quit. Set `IDLE_SAVE=path/to/file.json` to use a different file, which is handy for testing from a fresh start.
- **Offline progress**: the monkeys keep typing while you're away, up to 8 hours.

## Development

```bash
npm test           # run unit tests
npm run typecheck  # type-check without running
```

Names and balance numbers are all in [`src/game/config.ts`](src/game/config.ts); the terminal screen picks changes up automatically.
