# Infinite Monkeys: game design

> "Infinite monkeys typing at random will eventually write Shakespeare."

This is the design every build step works toward. Items marked **(default)** are choices made to keep things moving and can be changed; items under [Open questions](#open-questions) still need a decision. Numbers are starting points for balance and live in `src/game/config.ts` once built.

## The core loop

1. Monkeys type an endless stream of random letters, drawn only from the letters you own.
2. Whenever a real word shows up in a stream, you earn points for it.
3. Points buy more letters (more possible words), more monkeys (more streams) and upgrades.
4. Words typed back to back build a combo multiplier.
5. You pick a Shakespeare play at the start. As monkeys type the words of the play, its lines get checked off in the script. Finishing lines, scenes and acts pays bonuses; finishing the whole play is a huge, game-changing event.

## Letters

- You start with **one letter**, and it has to be a word on its own, so the choice is **A** or **I**.
- More letters are bought with points, one at a time, in any order you like. Price depends on how many letters you already own and grows steeply (starting guess: 10, then roughly ×3 per letter) **(default)**.
- Each monkey picks each letter you own with **equal odds** **(default)**. Buying a rare letter like Z therefore adds high-value words but also dilutes the stream with a letter that rarely fits; that trade-off is intentional. Points can later change those odds (see [Typewriter keys](#typewriter-keys-shaping-the-odds)).

## Words

### What counts as a word

The dictionary is a public-domain English word list (ENABLE, about 173k words) plus **A** and **I** (which Scrabble-style lists leave out) plus every word in the play you chose, so "thou", "doth" and "Polonius" count **(default)**. Words are compared as lowercase letters only; apostrophes and punctuation are dropped ("'tis" becomes `tis`, "o'er" becomes `oer`).

At any moment only words spellable with your owned letters matter. The game keeps a prefix tree of those words and rebuilds it when you buy a letter.

### When a word scores

A stream has no spaces, so the game reads it left to right and always prefers the **longest** word:

- A word scores as soon as it is certain it can't grow into a longer word. That happens either when the next letter rules a longer word out, or straight away when no longer word is spellable with your letters at all. (Example: with only **I**, every I scores immediately. With **I, T, G**, the stream `IG` scores `I` when the G arrives; `IT` scores as soon as it is typed, because nothing longer starting with IT can be spelled.)
- Letters left over after a scored word are read again from the start, so a letter that could begin the next word is never lost **(default)**.
- A letter that can't begin any word is **skipped**. Skipped letters are shown dimmed.

The exact algorithm, per monkey:

```
pending = ""                      # letters that might still become a word
on each new letter c:
  if pending + c is a prefix of some word:
    pending += c
    if pending is a word and no longer word starts with it: score(pending); pending = ""
  else if pending is empty:
    skip(c)
  else:
    w = longest word that pending starts with
    if w: score(w); refeed(pending[len(w):] + c)
    else: skip(pending[0]);         refeed(pending[1:] + c)
```

`refeed` clears `pending` and feeds the given letters back in one at a time.

### Points per word

`points = (sum of letter values) × word length` **(default)**

Letter values follow Scrabble tile values: 1 for A E I O U L N S T R; 2 for D G; 3 for B C M P; 4 for F H V W Y; 5 for K; 8 for J X; 10 for Q Z.

| Word | Letter values | Length | Points |
| --- | --- | --- | --- |
| I | 1 | 1 | **1** |
| IT | 1 + 1 | 2 | **4** |
| CAT | 3 + 1 + 1 | 3 | **15** |
| ZAP | 10 + 1 + 3 | 3 | **42** |
| QUIZ | 10 + 1 + 1 + 10 | 4 | **88** |

## Monkeys

- You start with **one monkey**. More monkeys are bought with points; each costs more than the last (starting guess ×1.15 each) **(default)**.
- Every monkey types its own stream at a base speed (starting guess 2 letters per second), with upgrades that make monkeys type faster.
- Pressing **space** pokes your first monkey into typing one extra letter immediately, so the early game has something to do.

### Typewriter keys: shaping the odds

Beyond buying new letters, points can reshape what the monkeys type:

- **Heavier keys.** Raise how often a letter you own comes up, so you can lean on vowels or on the letters your play needs.
- **Combination keys.** Buy a key that types a common cluster in one stroke, like `TH`, `ING` or `QU`. Each key is one more option the monkey can hit, with its own odds.
- **Word keys.** Buy a key that types a whole common word, like `THE`, `AND` or `YOU`. A word key goes through the same word reading as anything else, so `THE` followed by `N` still becomes `THEN`.

Keys only use letters you own, and each one is priced by how useful it is. They are the mid-game lever; the Muse below is the late-game one.

### The typewriter line and carriage return

Each monkey types on a line **30 letters** wide **(default)**. When the line is full, the carriage returns: the pending letters are settled (the longest word in them scores, the rest are skipped), the combo resets, and a fresh line starts. This keeps the screen readable and caps the combo. Line width can be an upgrade.

## Combos

Words typed back to back on the same monkey's line form a chain. A chain of *N* words is worth the sum of those words' points **× N**: two in a row is double, three in a row is triple, and so on.

- Only words of **two or more letters** build the chain. One-letter words still score their own points but neither add to the chain nor break it **(default)**. Without this, owning only "I" would make every letter a word and the multiplier would grow forever.
- A **skipped letter** or a **carriage return** breaks the chain.
- Points are paid as the chain grows: when the *k*-th word lands, you receive whatever brings the chain's total up to (sum of its words) × *k*.

Example: `CAT` (15) then `ZAP` (42) back to back pays 15, then 99 more, for a chain total of (15 + 42) × 2 = 114.

## The play

At the start you choose a play. Plays differ in length, which is effectively the difficulty: for example *The Comedy of Errors* (shortest), *Macbeth*, *A Midsummer Night's Dream* and *Hamlet* (longest). Texts come from a public-domain edition (Moby Shakespeare / Project Gutenberg) and are stored in the repo as data.

### How lines get completed

Typing a full line by pure chance isn't realistic: a specific 30-letter line turns up roughly once in 10^42 letters, far beyond what any number of monkeys could type. So lines are completed **one word at a time** **(default)**:

- A *line* is a line as printed in the script (one line of verse, or one line of prose).
- Whenever any monkey scores a word, that word is checked off in **every** line of the script that contains it.
- A line is **complete** once all its words are checked. Since a line can only finish when you own all of its letters, letter purchases naturally unlock parts of the play.
- The script view shows the current scene with checked words highlighted and completed lines marked.

### The Muse: typing toward the script

Common words ("the", "is", "my") check off quickly, but long words like `unpregnant` would almost never appear at random. Muse upgrades make that reachable: while a monkey's pending letters match the start of an unchecked word in the script, it has a chance of typing that word's next letter instead of a random one (only if you own the letter). Upgrades raise the chance. This is the main late-game lever for play progress.

### Rewards

| Milestone | Reward |
| --- | --- |
| Line complete | A one-off points bonus based on the line's words |
| Scene complete | A small permanent multiplier |
| Act complete | A larger permanent multiplier |
| Play complete | Massive and game-changing; see [Open questions](#open-questions) |

## Screen layout (terminal)

```
INFINITE MONKEYS                       Points: 12.4K   (+38/s)
Letters: A E I N T S R                 Play: Hamlet  3% (112 / 3,960 lines)

Monkeys (4)
 1  TEA SNARE it x s i             combo x3
 2  ...
Recent words: SNARE +225  TEA +27  IT +4

Shop
 [1] Letter (pick one)   1.2K    [2] Monkey   340    [3] Faster typing   2K
[space] poke  [p] script  [s] save  [q] quit
```

Scored words are highlighted, skipped letters dimmed. `p` toggles a script view of the current scene.

## Saves and offline progress

The save gains: owned letters, the chosen play, which words are checked off, each monkey's current line, chain and pending letters, and upgrades. Offline progress simulates letters for the time away (capped, as now at 8 hours); if that's too many letters to simulate quickly, the rest is estimated from the recent points per letter and words-checked rate.

## Build plan

Each step is a small pull request that you can play with `npm start` before the next one starts.

1. **One monkey, one letter.** Replace the placeholder Worker/Workshop content. At the start you pick A or I; one monkey types it on screen and each word scores 1. Builds the word matcher with tests.
2. **Buying letters.** A letter shop, the real word list, letter values and length scoring, scored words highlighted and skipped letters dimmed.
3. **More monkeys.** A monkey shop, one line per monkey on screen, faster-typing upgrades, offline progress by simulation.
4. **Typewriter keys.** Heavier letter keys, combination keys and word keys in the shop.
5. **Combos.** Chains, the 30-letter line and carriage return, combo shown per monkey.
6. **Pick a play.** Play choice at the start, the script view, words checked off across the script, line bonuses.
7. **The Muse and milestones.** Muse upgrades, scene and act completion with their multipliers.
8. **Finishing the play.** The big reward, once it's decided.
9. **Balance pass.** Tune costs and rates so each stage of the game feels paced.

## Open questions

- **Play completion reward.** Not decided yet; it should be massive and change how the game plays every time. Ideas: a prestige reset that keeps a "First Folio" giving a permanent multiplier and lets you pick the next play; a golden monkey that types whole words at a time; letters that cost nothing on the next run; a new mechanic per play (e.g. finishing *Macbeth* adds a witches' cauldron that brews letters).
- **Line rules.** Should a later upgrade or prestige layer also reward lines typed *verbatim and in order* as a rare jackpot?
- **Price curves and speeds.** All numbers above are first guesses for the balance pass.
