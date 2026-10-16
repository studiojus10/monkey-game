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
  version.ts       GAME_VERSION, shown in the game ([?] and options) and written into every save; package.json's version matches
  format.ts        number formatting (1.23K, 4.56M, ... up to Vg, then 1.23e70; setScientific for the option; formatAmount shows balances in full up to 10 digits, then 1.23e10; formatMultiplier), shared by any front end
  game/            pure game logic: no terminal, DOM, file system or timers
    config.ts      theme strings + balance data (letters, letter values, letter and typing costs, office (room and square costs), furniture (each with a feng shui element and a colour from its looks; managerDesk), fengShui, managerOffice, managerBook, traits and traitRules, research (R&D projects), hr (HR staff and effects, temps), marketing (royalties), monkeyStats (hidden stats and job feelings), monkeyNames and parodyNames, energy, hats (and hatColors, dyeCost), lately (the LATELY feed's window), petting, achievements, folio, milestones, sentenceRules (Sentences from long chains), offline cap, per-second simulation cap)
    state.ts       GameState, MonkeyState and Stats shapes, createInitialState(), monkeyNameFor (famous names and parodyOf them)
    plays.ts       Play data (data/plays/*.json) indexed by each line's letters, for matching typed lines
    words.ts       Dictionary (prefix tree of spellable words), readLetter() word matcher, wordPoints()
    layout.ts      office floor plan on one grid: hallways, doors, windows (windowSides, cycleWindow, addWindow), doorPaths, connectedRooms (rooms reachable from room 1), break rooms touching departments' rooms (doorBetween, touchingRooms, doorToTouching), loungeOf (each department's nearest break room) and servedBy, autoConnect, placeRoom, roomFits and moveRoom, cycleDoor, toggleHall, layOutOffice for old saves
    fengshui.ts    feng shui: roomRules (the five chi rules), roomChi, officeChi, chiHappiness, emptySquares, spaceFactor and varietyBonus (all only with the book), squareRank for auto-placement
    logic.ts       setWordList, setPlays, setLineWidth (the front end fits monkey lines to its screen), achievements (achievementValue, checkAchievements), Folio prestige (canPublishFolio, folioPagesNow, publishFolio, folioMultiplier and folioMultiplierAfter: Folios multiply each other), departments, scene shop (buySection), chooseStarterScene, chooseFirstLetter, buyLetter, office (rooms per department and break rooms, placed where the player chooses (buyRoom at a square, suggestRoomSpot, roomFitsAt, moveRoomBy), expandRoom one square at a time, desks placed with each monkey, buyFurniture (always new), placeStoredFurniture (from the inventory), furnitureOwned, hidesBook and readFengShuiBook (the feng shui book hides in a bookshelf), moveFurniture, bigger pieces (pieceSize, footprint, fitsAt, rotateFurniture), furnishOffice for old saves), buyMonkey, renameMonkey (monkeys get famous names via monkeyNameFor in state.ts), managers' offices (officeOf, buyRoom 'office'), deskOf (who sits where), traits and hidden stats (setHour, giveTraits, traitMood, traitBonus, jobOf, jobFeeling, jobBonus, statsShown, roomMates and roomEffect for traits that rub off on a room), hireManager and managerBlocker, hidesManagerBook and readManagerBook, R&D (openResearch, labRoom, hireResearcher, startResearch, advanceResearch, researchBonus; researchers are monkeys whose department is 'research'), HR (canBuildHR, hrRoom, hireHR, hrHappiness, hrDiscount, drawCandidates, candidateFactor, hirePrice, isTemp and endTemps; every hire takes an optional candidate; HR monkeys' department is 'hr'), Marketing (canBuildMarketing, marketingRoom, hireMarketer, popularity, royalties earned in tick; marketing tactics are research projects with needs: 'marketing'), milestones (scene/act/play), managers (manage, upgradeManager), buyComboStart (starting combo), typeLetter (scoring, combos, play lines), noteLately (the LATELY feed's words and sentences), poke (petting: happiness), flipCoin (the for-fun coin flip), storage and selling (storeFurniture, sellFurniture, sellHat, fireMonkey; state.stored), moveHat and swapTypewriters (the inventory), buyFasterTyping and buyTypewriter (per-monkey skill and typewriter), hats (hatKey and splitHatKey for the inventory, hatsOwned, storedHat, hatCost, wearHat, dyeHat, wearing), energy (spendEnergy: tiring and breaks, exact over any stretch; furniture effects per department from its room and lounge (enjoyedRooms, drainCut, restBoost, happiness, monkeyHappiness)), tick, offline progress (random source injectable as rng)
    dev.ts         development tools (devTools list) shown on the ` menu; add new test tools here
    save.ts        versioned JSON (de)serialization: SAVE_VERSION (the format), gameVersion in every save, migrations (one per format version, run in order on older saves), saveVersions(); SaveStorage interface; deserialize() tolerates missing/corrupt fields
  cli/             terminal front end
    mouse.ts       mouse support: parseMouse() (SGR mouse sequences out of the input), targetAt() (the field under the mouse, highlighted on hover), clickPress()/mousePress() turn a click, right click or wheel into the key press it stands for
    inventory.ts   renderMonkeyPicker() (the menu of monkeys to give a hat or dye), inventoryRows() and renderInventory() (the [i] screen: each monkey's typewriter and hat, then the player's inventory of hats and furniture)
    main.ts        entry: loads data/words.txt and data/plays/*.json into the logic, loads save, applies offline progress, raw-mode keypress loop, redraw every 250ms, autosave
    screen.ts      renderScreen() (the home screen: monkey table with fixed columns, alphabet, LATELY feed, key rows) and renderScript() return screens as text (ANSI bold for the live part of a monkey line); renderHomeKeys() (the [?] page); the shop's stores (storeItems, storePages, inspectItem) and renderShop() (the shop's own screen: tabs, items in columns)
    style.ts       terminal styling with one job per style (bold, dim, inverse, colours; furnitureColor), titleBar() (screen name and currencies), keyRow() (keys that wrap to the screen), rule(), forLightBackground() (the light-background option, applied in main.ts), showCursors()/isCursor() (menu cursors drawn only after arrow keys), inverseSpan() (hover highlight), placeScreen() (the screen at the bottom of the terminal, or the top with the option)
    office.ts      renderOffice(): the office map (rooms of any shape, desks, who sits where, furniture, windows, chi, cursor, grow mode) with a table of rooms; renderOfficeHelp() (its [?] page); inspectSquare() (the [i] inspect text); renderFengShuiBook(); renderManagerBook(); libraryBooks() (books found so far, read again from any bookshelf)
    (screen.ts also has renderOptions(): the options menu, state.settings)
    hiring.ts      renderCandidates(): HR's list of candidates for a hire
    roster.ts      renderRoster() and rosterOrder(): the [m] list of monkeys by department, then hire order, with details of the chosen one
    stats.ts       renderStats(), renderDictionary() and renderAchievements(): the statistics page, the A-Z dictionary of spelled words, the achievements page
    fileStorage.ts SaveStorage backed by a JSON file (atomic write via temp file + rename)
data/words.txt     ENABLE word list (public domain), one lowercase word per line
data/plays/        plays as { id, title, genre, lines: [act, scene, speaker, text][] }, from the MIT Shakespeare
scripts/           simulate.ts plays headlessly with a greedy bot to check pacing (npx tsx scripts/simulate.ts [hours] [seed]); import-play.ts converts an MIT Shakespeare full.html into data/plays/<id>.json; import-sonnets.ts builds data/plays/sonnets.json
tests/             unit tests for logic, save, formatting and the terminal screen
```

## Conventions

- Game content (names, costs, rates, words) goes in `config.ts` as data, not as new logic.
- Logic functions mutate the `GameState` passed in and return a boolean for purchases; they never do I/O. Anything random takes an `rng` argument so tests can fix it.
- Prefer ASCII (plus ANSI bold/colour codes) for everything the game prints, so it runs in any terminal on any system. Unicode is allowed when it's worth it: add each such character to `allowedUnicode` in `tests/cli.test.ts`, whose test checks every screen.
- Keep rendering in `screen.ts` pure (state in, string out) so it stays testable; side effects belong in `cli/main.ts`.
- A new front end (e.g. browser) gets its own folder next to `cli/` and its own `SaveStorage`.
- Every change that gets merged bumps `GAME_VERSION` in `src/version.ts` and `version` in `package.json` together: the patch number for fixes and small tweaks, the minor number for new features.
- Adding a field to `GameState`: give it a default in `createInitialState()` and a fallback in `deserialize()` so old saves still load. If a field's meaning changes or one is replaced, bump `SAVE_VERSION` and add a `migrations[old version]` in save.ts that turns the old save's state into the new one (the game keeps a copy of a save from another game version as `save-v<version>.json` before updating it).
- Time is in seconds inside logic; timestamps (`lastSaved`) are epoch ms.
- Add or update tests in `tests/` alongside logic changes.
