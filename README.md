# Idle Game

A small idle/incremental browser game built with TypeScript and Vite. The theme is deliberately neutral so it can be reskinned.

## What's in it

- **Currency** you earn by clicking.
- **Generators** that produce currency every second; each one costs more than the last.
- **Upgrades** that multiply click value or generator output.
- **Autosave** to `localStorage` every 10 seconds and when the tab closes.
- **Offline progress**: production is credited for time away, capped at 8 hours.

## Running it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
npm test           # run unit tests
npm run build      # typecheck and build to dist/
npm run preview    # serve the production build
```

## Changing the game

Names and balance numbers are all in [`src/game/config.ts`](src/game/config.ts). Rename the currency, add a generator, or tweak costs there; the UI picks the changes up automatically.
