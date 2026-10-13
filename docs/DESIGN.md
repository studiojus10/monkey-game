# Infinite Monkeys: game design

> "Infinite monkeys typing at random will eventually write Shakespeare."

This is the design every build step works toward. Items marked **(default)** are choices made to keep things moving and can be changed; items under [Open questions](#open-questions) still need a decision. Numbers are starting points for balance and live in `src/game/config.ts` once built.

## The core loop

1. Monkeys type an endless stream of random letters, drawn only from the letters you own.
2. Whenever a real word shows up in a stream, you earn points for it.
3. Points buy more letters (more possible words), more monkeys (more streams) and upgrades.
4. Words typed back to back build a combo multiplier.
5. You open a department for one genre (comedies, histories or tragedies) and get one short scene free; more scenes, acts and whole plays are bought with points. When a monkey types one of its lines word for word, the line is checked off in the script. Finishing lines, scenes and acts pays bonuses; finishing the whole play is a huge, game-changing event.
6. Progression is deliberately slow. Later upgrades (typewriter keys, word slots) let you steer what gets typed so you can target specific lines.

## Letters

- You start with **one letter**, and it has to be a word on its own, so the choice is **A** or **I**.
- More letters are bought with points, one at a time, in any order you like. Price depends on how many letters you already own and grows steeply (starting guess: 10, then roughly ×3 per letter) **(default)**.
- Each monkey picks each letter you own with **equal odds** **(default)**. Buying a rare letter like Z therefore adds high-value words but also dilutes the stream with a letter that rarely fits; that trade-off is intentional. Later in the game, points can change those odds (see [Typewriter keys](#typewriter-keys-shaping-the-odds)).

## Words

### What counts as a word

The dictionary is a public-domain English word list (ENABLE, about 173k words) plus **A** and **I** (which Scrabble-style lists leave out) plus every word in the play you chose, so "thou", "doth" and "Polonius" count **(default)**. Runs of a single letter (AA, AAA, MM) never count, even though the list has AA and MM **(decided)**. Words are compared as lowercase letters only; apostrophes and punctuation are dropped ("'tis" becomes `tis`, "o'er" becomes `oer`).

At any moment only words spellable with your owned letters matter. The game keeps a prefix tree of those words and rebuilds it when you buy a letter.

### When a word scores

A stream has no spaces, so the game reads it left to right and always prefers the **longest** word:

- A word scores as soon as it is certain it can't grow into a longer word. That happens either when the next letter rules a longer word out, or straight away when no longer word is spellable with your letters at all. (Example: with only **I**, every I scores immediately. With **I, T, G**, the stream `IG` scores `I` when the G arrives; `IT` scores as soon as it is typed, because nothing longer starting with IT can be spelled.)
- Letters left over after a scored word are read again from the start, so a letter that could begin the next word is never lost **(default)**.
- A letter that can't begin any word is **skipped**. On screen, the line has no spaces and every letter is a capital; the live run of words is bold.

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

- You start with **one monkey**. More monkeys are a **late-game** upgrade bought with [Lines](#currencies). (Starting guess: 10 Lines, ×2 each.) The screen shows the first 10 monkey lines and sums up the rest.
- Every monkey types its own stream. Monkeys start **slow** (one letter every 2 seconds) and get faster with "Faster typing", bought with points **for each monkey separately** **(decided 2026-10-13)**: it trains that monkey's typing skill (starting guess: ×1.25 speed per level, cost 10 growing ×1.5 per level). It's the first thing you can buy. A monkey's **typewriter** caps its skill: the Rusty typewriter allows 10 levels, and each better typewriter (Portable, Office, Electric, Golden, Diamond, then Mk 7, ...) allows 10 more (starting guess: 1,000 points for the second, ×25 each after). New monkeys start at skill 0 on a Rusty typewriter, so each monkey is its own investment.
- The player can name each monkey when buying it, or later with `n`; unnamed monkeys show as M-1, M-2, ...
- Each monkey works in one [department](#departments).
- Pressing **enter** pets your first monkey into typing one extra letter immediately, so the early game has something to do.

### Typewriter keys: shaping the odds

Beyond buying new letters, points can reshape what the monkeys type:

- **Combination keys.** Buy a key that types a common cluster in one stroke, like `TH`, `ING` or `QU`. Each key is one more option the monkey can hit, with its own odds.
- **Word keys.** Buy a key that types a whole word. A word of 3+ letters becomes available as a key once your monkeys have spelled it 100 times; each word key you own raises that by 10% for the next one **(decided, numbers are placeholders)**. A word key goes through the same word reading as anything else, so `THE` followed by `N` still becomes `THEN`.

Heavier letter keys were dropped (2026-10-13): choosing odds for 26 letters was too abstract to use well. Combination keys come from a curated list: a test with 14 common letters showed `TH, ING, ER, THE, AND` together roughly double points per keystroke, while a junk cluster like `QZ` lowers it by diluting the pool. Keys are placed at random, not "smartly": a version that only pressed `ING` where it fit scored lower, because misplaced clusters still form words when re-read and swapping them out loses letters. Prices are fixed, so owning more letters does not make keys dearer (starting guess: 4M points for a combination key, 4M per letter for a word key). They unlock later (starting guess: 13 letters owned), because progression should be slow: the player builds a bank of letters before worrying about odds. Keys are the mid-game lever; [word slots](#word-slots-steering-the-sentence) are the late-game one.

### The typewriter line and carriage return

Each monkey's line on screen is **60 letters** wide **(default)**. When it's full, the carriage returns and a fresh line starts. This is display only: words and chains carry on across the return, since play lines can be longer than 60 letters.

## Combos

Words typed back to back on the same monkey's line form a chain. The whole chain is worth the sum of its words' points × its multiplier.

- **Only long, different words raise the multiplier.** Each word of **4+ letters** that isn't already in the chain adds one to the multiplier. Shorter words and repeats still join the chain and are paid at the current multiplier, but don't raise it. This keeps the early game slow, when short words are all you can make.
- **The multiplier is capped**, starting at **×3**. Raising the cap is an upgrade bought with [Sentences](#currencies).
- A **skipped letter** breaks the chain.
- Points are paid as the chain grows: when a word lands, you receive whatever brings the chain's total up to (sum of its words) × multiplier.

Example: `CAT` (15) is too short to count, so it pays 15 at ×1. `QUIZ` (88) is the first long word, still ×1. `ZANY` (64) makes it ×2, so the chain total becomes (15 + 88 + 64) × 2 = 334 and ZANY pays 231. Another `CAT` pays 30 (15 at ×2). A repeated `QUIZ` doesn't raise the multiplier.

## Currencies

- **Points** come from every word. They buy letters, typing speed and typewriter keys.
- **Sentences** come from typing any line of the play with **3+ words** word for word, every time, including lines already completed (shorter lines would be farmed). They buy repeatable upgrades such as raising the combo cap.
- **Words** (2026-10-13) come from each **different** word your monkeys spell: one per new entry in the dictionary, so the supply is limited by the word list and your letters. An early-game limited currency. Words are spent on **letters** **(decided)**: each new letter costs points plus floor(¼ × letters owned²) Words (0, 1, 2, 4, 6, 9, ... 156 for the 26th; placeholder). The early steps stay small so a poor early letter like Q or J, which adds few new words, can't lock you out.
- **Lines** come from completing a line of the play for the **first** time: one per line, so the supply is limited by the play's length. They're the rarest currency and buy the biggest, permanent upgrades: new monkeys and word slots.

Lines and Sentences are both rare, so the upgrades they buy can't be reached by grinding points. (Exact split of what each buys is for the balance pass.)

## The play

You don't start with a play. You open your first **department** (see below) and pick one of the three shortest scenes in its genre for free; everything else in the script is bought. Plays are *A Midsummer Night's Dream* (comedy, 2,160 lines), *Richard III* (history, 3,700), *Hamlet* (tragedy, 4,011) and *Macbeth* (tragedy, 2,384). Texts are the public-domain Moby Shakespeare as published by the MIT Shakespeare, stored in `data/plays/`.

### How lines get completed

A line counts only when a monkey actually types it: its words back to back, in order, inside one chain (no skipped letter in between).

- A *line* is a line as printed in the script (one line of verse, or one line of prose). Punctuation and spaces are ignored.
- Matching uses the letters across the chain's words, not where the word breaks fell, so `TOBE` read as `TO` + `BE` or split some other way still counts as "to be".
- A completed line is checked off in the script. The script browser scrolls through the play by line and scene, shows what letters each line still needs, and lets the player **pin** up to 5 lines to the home screen as targets.

By pure chance this is very rare: a specific 30-letter line turns up roughly once in 10^42 letters. That's intended. Early on, only very short lines are realistically possible ("No.", "Ay, my lord."), and only once you own their letters, so completing one is a rare, special event: it's celebrated on screen and checked off in the script, but it pays only a modest bonus so it doesn't speed up the early game. Longer lines need word slots, and that's where line rewards become huge.

### Word slots: steering the sentence

Once you own enough letters to start building sentences, you can buy **word slots**. Each slot locks one position in a chain to a word you choose, and you can change the word any time for free.

- Example: buy slot 3 and set it to `FRIEND`. Whenever a monkey's chain reaches two words, the next word it types is FRIEND.
- A slot can only hold a word you can spell with your letters (or a word from your play).
- A slot always fires while it's **on**, and each slot can be switched off at any time so the monkeys type fully at random. The slot's word is typed as a finished word, so it can't run into the letters after it.
- In pinned lines and the script browser, words that an active slot will type at that position are shown in bold, so the player can compare their slots with the line they're building. Slots get more expensive the more you own, so steering a whole line takes real investment.
- With slots the player targets specific lines: pick a line, set slots for its harder words, and let chance fill in the common ones.

Slots unlock later, alongside typewriter keys (starting guess: 13 letters owned), so the early game is about building a bank of letters.

### Rewards

| Milestone | Reward |
| --- | --- |
| Line complete | A one-off points bonus that grows steeply with the line's size: (the line's word points) × (number of words)² **(default)**. A one- or two-word line pays a few times a normal word; a ten-word line pays a fortune |
| Scene complete | A permanent points bonus that scales with the scene's length: +0.1% per line (a 200-line scene adds +20%), plus Sentences: a quarter of its lines, at least 1 **(default)** |
| Act complete | A permanent typing speed bonus that scales with the act's length: +0.05% per line (an 800-line act adds +40%), plus a free monkey for that genre's department that doesn't raise the monkey price **(default)** |
| Play complete | Every scene and act bonus in it, which you've collected by then. The extra big reward is still open; see [Open questions](#open-questions) |

Bonuses add up (they're summed, not compounded), so the total depends only on what you finished, never on how it was bought: a play bought scene by scene ends with exactly the same bonuses as one bought whole **(decided)**. Scenes are big (Hamlet's median scene is about 200 lines; Macbeth's smallest is 11), so these are long-term goals. The script browser shows each scene's progress in its heading.

### Buying the script

Scenes, acts and whole plays are bought with points in the script browser **(decided)**. A scene costs 10 points per letter in its lines; an act costs its unowned scenes' total less 20%; a whole play its unowned scenes' total less 40% (starting guesses). Only lines of owned scenes can be written, pinned or count toward milestones.

### Departments

Each genre has a **department** **(decided)**. You open the first at the start, which picks your starting genre. A department holds at most **10 typing monkeys plus 1 manager** **(decided, for now)**. The second department opens once you have 10 monkeys (bought or earned), the third at 20, and the [Sonnets department](#the-sonnets-department) last at 30, so each opens just as the ones before it fill up. You choose which department each new monkey joins **(decided)**; it's automatic when only one department is open or only one has room. A free monkey from an act waits (`a` assigns it) when there's a choice. When every open department is full, no more monkeys can be bought. Each department has **its own word slots** **(decided)**, bought and set separately (`tab` in the slots menu switches department), and they only steer that department's monkeys. Numbers are for the balance pass. You can only buy plays in genres you have a department for. Each monkey works in one department and only writes lines of plays in that department's genre, so with all three open you work on a comedy, a history and a tragedy at the same time. `d` moves a monkey to the next department with room; with more than one department, each monkey's line starts with its department's initial.

### Manager monkeys (automation)

For players who don't want to micromanage **(decided)**. A department with more than 5 monkeys can promote one to **manager** (`m`, one per department; `m` again sends it back to typing). A manager stops typing and instead:
- picks an unwritten line of its department's owned scenes and pins it, by priority **(decided)**: within reach (your letters can spell it), then the fewest words, then the earliest in play order. With nothing in reach it pins the shortest out-of-reach line, and switches as soon as a line comes within reach;
- fills your word slots with that line's words by position (slots past the line's length switch off; slot words that need letters you don't own aren't typed; with every owned line written all slots switch off, so typing is random again);
- moves on to the next line as soon as one is written.

A manager sets its own department's slots. Managers can be **upgraded** (`u`): each upgrade adds +0.1× to the points of every monkey in that department. Because one upgrade improves a whole department, they're very expensive: Lines, 50 per monkey in the department, doubling each level (starting guess).

### The Sonnets department

A late-game fourth department for Shakespeare's Sonnets **(built)**, mainly a late way to earn more **Lines**. Verse lines run to a meter rather than ending at sentence breaks, so sonnets score differently:
- It opens only after all three play departments, at 30 monkeys (starting guess).
- Sonnets are bought one at a time (10 points per letter, like scenes) or all 154 at once at the whole-play discount. There are no acts.
- Each new verse line written pays 2 Lines and a smaller points bonus (line word points × words, not words²). No Sentences, since verse lines often aren't complete sentences.
- Finishing a sonnet pays 1 Line per line in it (14 for most) instead of scene and act bonuses; sonnets give no points or speed bonus and no free monkey.
- The text is the MIT Shakespeare's Sonnets, converted with `scripts/import-sonnets.ts` (stored like a play, one sonnet per "act"). The source runs two lines together in sonnets 7 and 93, so those have 13 lines; 99 has 15 and 126 has 12, as Shakespeare wrote them.
- Other poems (*Venus and Adonis*, *The Rape of Lucrece*, ...) could join this department later.

## Screen layout (terminal)

```
=== Infinite Monkeys ===

M-1(0.50/s)         x1  ITIEANTISSSOI_
Bartholomew(0.50/s) x3  INTEEETSITAONAIEIN_
Jo(0.50/s)          x1  INAENEATSTTNIET_

1.2K Points   4 Sentences   12 Lines
...
```

Monkey lines sit right under the title. Each starts with the monkey's name (M-1, M-2, ... until the player names it, up to 12 characters), its speed and its combo multiplier, padded so every monkey's text starts in the same column and the lines read as one block. Letters are always capitals; the live run of words is bold. `p` opens the script browser.

## Saves and offline progress

The save gains: owned letters, the chosen play, which words are checked off, each monkey's current line, chain and pending letters, and upgrades. Offline progress simulates letters for the time away (capped, as now at 8 hours); if that's too many letters to simulate quickly, the rest is estimated from the recent points per letter and words-checked rate.

## Build plan

Each step is a small pull request that you can play with `npm start` before the next one starts.

1. **One monkey, one letter.** Replace the placeholder Worker/Workshop content. At the start you pick A or I; one slow monkey types it on screen, each word scores 1, and "Faster typing" is for sale. Builds the word matcher with tests.
2. **Buying letters.** A letter shop, the real word list, letter values and length scoring, scored words highlighted and skipped letters dimmed.
3. **More monkeys.** A monkey shop that unlocks at 13 letters, one line per monkey on screen, offline progress by simulation.
4. **Combos.** Chains and the multiplier (4+ letter words, capped at ×3), combo shown per monkey. (Built.)
5. **Pick a play.** Play choice at the start, the script view, lines completed when typed word for word, line bonuses, the Sentences and Lines currencies, Sentences buying combo-cap raises and Lines buying monkeys. (Built.)
6. **Typewriter keys.** Combination keys and word keys (earned by spelling a word often), unlocking at 13 letters. (Built.)
7. **Word slots.** Buy slots, set and change their words, switch them on and off, aimed at pinned lines. (Built, along with the script browser and pins.)
8. **Milestones, the script shop and departments.** Length-scaled scene and act rewards, buying scenes/acts/plays, genre departments opened by monkey count, and the Sonnets department. (Built; the big play-completion reward is still open, to decide later.)
9. **Balance pass.** Tune costs and rates so progression is slow and each stage feels paced.

## Open questions

- **Unlock rules for keys and slots.** 13 letters is a placeholder, like the monkey unlock.
- **Play completion reward.** Not decided yet; Justin will decide later (2026-10-12). It should be massive and change how the game plays every time. Ideas: a prestige reset that keeps a "First Folio" giving a permanent multiplier and lets you pick the next play; a golden monkey that types whole words at a time; letters that cost nothing on the next run; a new mechanic per play (e.g. finishing *Macbeth* adds a witches' cauldron that brews letters).
- **Achievements and milestones menu.** Justin wants a page like the statistics (`t`) and dictionary (`w`) pages listing achievements and milestones (2026-10-12). Which achievements, and whether they give rewards, is still to be decided with Justin.
- **Monkey price in Lines.** Starting guess: 10 Lines, ×2 each. For the balance pass.
- **Department thresholds and script prices.** 10 and 30 monkeys, 10 points per letter, 20%/40% discounts are placeholders for the balance pass.
- **Price curves and speeds.** All numbers above are first guesses for the balance pass.
