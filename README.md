# Idle Game

A small idle/incremental game that runs in your terminal, written in TypeScript. The theme is deliberately neutral so it can be reskinned.

## Playing

Requires Node 22.12 or newer.

```bash
npm install
npm start
```

| Key | Action |
| --- | --- |
| `space` or `c` | Collect currency |
| `1`–`9` | Buy the numbered generator or upgrade (`*` marks what you can afford) |
| `s` | Save now |
| `r` | Reset progress (asks to confirm) |
| `q` or `Ctrl+C` | Save and quit |

## What's in it

- **Currency** you earn by pressing space.
- **Generators** that produce currency every second; each one costs more than the last.
- **Upgrades** that multiply click value or generator output.
- **Autosave** to `save.json` every 10 seconds and on quit. Set `IDLE_SAVE=path/to/file.json` to use a different file, which is handy for testing from a fresh start.
- **Offline progress**: production is credited for time away, capped at 8 hours.

## Development

```bash
npm test           # run unit tests
npm run typecheck  # type-check without running
```

Names and balance numbers are all in [`src/game/config.ts`](src/game/config.ts). Rename the currency, add a generator, or tweak costs there; the terminal screen picks the changes up automatically.
