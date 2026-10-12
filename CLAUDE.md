# CLAUDE.md

Idle/incremental browser game. TypeScript + Vite, no UI framework, Vitest for tests.

## Commands

- `npm run dev` – dev server
- `npm run typecheck` – `tsc --noEmit`
- `npm test` – Vitest (tests live in `tests/`)
- `npm run build` – typecheck + production build

CI (`.github/workflows/ci.yml`) runs typecheck, test and build on every PR. Run all three before pushing.

## Structure

```
src/
  main.ts          entry: loads save, applies offline progress, runs the rAF loop, autosaves
  style.css        all styles; colors are CSS variables with a dark-mode override
  game/            pure game logic, no DOM access (keep it that way so it stays testable)
    config.ts      theme strings + balance data (generators, upgrades, offline cap)
    state.ts       GameState shape and createInitialState()
    logic.ts       click, tick, buyGenerator, buyUpgrade, cost/production formulas, offline progress
    save.ts        versioned JSON save to localStorage; deserialize() tolerates missing/corrupt fields
  ui/
    render.ts      builds the DOM once, returns update() called every frame
    format.ts      number formatting (1.23K, 4.56M, ...)
tests/             unit tests for game logic, save, and formatting
```

## Conventions

- Game content (names, costs, rates, new generators/upgrades) goes in `config.ts` as data, not as new logic.
- Logic functions mutate the `GameState` passed in and return a boolean for purchases; they never touch the DOM or storage.
- Adding a field to `GameState`: give it a default in `createInitialState()` and a fallback in `deserialize()` so old saves still load. Bump `SAVE_VERSION` and migrate if a field's meaning changes.
- Time is in seconds inside logic; timestamps (`lastSaved`) are epoch ms.
- Add or update tests in `tests/` alongside logic changes.
