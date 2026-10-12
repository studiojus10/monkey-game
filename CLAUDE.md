# CLAUDE.md

Idle/incremental game, currently a text-based terminal game. TypeScript on Node (run with tsx, no build step), Vitest for tests. A browser front end may be added later, so game logic must stay independent of the terminal.

The game being built is "Infinite Monkeys"; the full design and build plan are in `docs/DESIGN.md`. Read it before adding gameplay.

## Commands

- `npm start` – play in the terminal (`IDLE_SAVE=/tmp/x.json npm start` for a throwaway save)
- `npm run typecheck` – `tsc --noEmit`
- `npm test` – Vitest (tests live in `tests/`)

CI (`.github/workflows/ci.yml`) runs typecheck and tests on every PR. Run both before pushing.

## Structure

```
src/
  format.ts        number formatting (1.23K, 4.56M, ...), shared by any front end
  game/            pure game logic: no terminal, DOM, file system or timers
    config.ts      theme strings + balance data (generators, upgrades, offline cap)
    state.ts       GameState shape and createInitialState()
    logic.ts       click, tick, buyGenerator, buyUpgrade, cost/production formulas, offline progress
    save.ts        versioned JSON (de)serialization; SaveStorage interface; deserialize() tolerates missing/corrupt fields
  cli/             terminal front end
    main.ts        entry: loads save, applies offline progress, raw-mode keypress loop, redraw every 250ms, autosave
    screen.ts      renderScreen() returns the screen as plain text; shopItems() maps keys 1-9 to purchases
    fileStorage.ts SaveStorage backed by a JSON file (atomic write via temp file + rename)
tests/             unit tests for logic, save, formatting and the terminal screen
```

## Conventions

- Game content (names, costs, rates, new generators/upgrades) goes in `config.ts` as data, not as new logic.
- Logic functions mutate the `GameState` passed in and return a boolean for purchases; they never do I/O.
- Keep rendering in `screen.ts` pure (state in, string out) so it stays testable; side effects belong in `cli/main.ts`.
- A new front end (e.g. browser) gets its own folder next to `cli/` and its own `SaveStorage`.
- Adding a field to `GameState`: give it a default in `createInitialState()` and a fallback in `deserialize()` so old saves still load. Bump `SAVE_VERSION` and migrate if a field's meaning changes.
- Time is in seconds inside logic; timestamps (`lastSaved`) are epoch ms.
- Add or update tests in `tests/` alongside logic changes.
