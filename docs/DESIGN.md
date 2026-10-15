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

- You start with **one monkey**. More monkeys are bought with **Points** **(changed in the balance pass, 2026-10-13)**: Lines were so rare that a simulated player was still on one monkey after 24 hours, and Sentences level off at about 40K an hour after the first day, so a rising Sentence price stalls. (Balanced 2026-10-13 with the simulator: 300K points, ×6 each, so the 2nd monkey comes after about 2.5 hours and a full department of 10 after about 3 days.) Each department has its own price (Justin, 2026-10-13), so later departments stay reachable even though points level off: the first monkey for the d-th department opened costs 300K x 100^(d-1), then x6 each (`monkeyShop` in config.ts). The screen shows the first 10 monkey lines and sums up the rest.
- Every monkey types its own stream. Monkeys start **slow** (one letter every 2 seconds) and get faster with "Faster typing", bought with points **for each monkey separately** **(decided 2026-10-13)**: it trains that monkey's typing skill (starting guess: ×1.25 speed per level, cost 10 growing ×1.5 per level). It's the first thing you can buy. A monkey's **typewriter** caps its skill: the Rusty typewriter allows 10 levels, and each better typewriter (Portable, Office, Electric, Golden, Diamond, then Mk 7, ...) allows 10 more (starting guess: 1,000 points for the second, ×25 each after). New monkeys start at skill 0 on a Rusty typewriter, so each monkey is its own investment.
- Every monkey arrives with a name of its own from famous monkeys and monkey-inspired names (`monkeyNames` in config.ts: Wukong, George, King Kong, Caesar, Rafiki, ...; Justin, 2026-10-14: "automatically name all the monkeys random names... famous monkeys or monkey inspired names"), sometimes (30%, and always once the real names are all taken) as a semi-rhyming parody of one (Justin, 2026-10-15: "king kong could be bing bong"): the sounds before each word's first vowel swap for another (`parodyNames` in config.ts), so King Kong can be Bing Bong and Abu Babu; II, III, ... only once even those run out. The player can still rename any monkey any time with `n` (home screen or roster); an empty name gives a famous one back. The "What's in a name?" achievement counts the player's renames. Old saves' unnamed monkeys get a name on load.
- Each monkey works in one [department](#departments).
- Pressing **enter** pets a monkey: the least happy typist gets +0.5% happiness, up to +5%, wearing off at 1% a minute, and shows a heart (`<3`). Justin (2026-10-14): petting doesn't type letters any more; it "should just be for fun to make the player happy" with very little effect on the game.

### Typewriter keys: shaping the odds

Beyond buying new letters, points can reshape what the monkeys type:

- **Combination keys.** Buy a key that types a common cluster in one stroke, like `TH`, `ING` or `QU`. Each key is one more option the monkey can hit, with its own odds.
- **Word keys.** Buy a key that types a whole word. A word of 3+ letters becomes available as a key once your monkeys have spelled it 100 times; each word key you own raises that by 10% for the next one **(decided, numbers are placeholders)**. A word key goes through the same word reading as anything else, so `THE` followed by `N` still becomes `THEN`.

Heavier letter keys were dropped (2026-10-13): choosing odds for 26 letters was too abstract to use well. Combination keys come from a curated list: a test with 14 common letters showed `TH, ING, ER, THE, AND` together roughly double points per keystroke, while a junk cluster like `QZ` lowers it by diluting the pool. Keys are placed at random, not "smartly": a version that only pressed `ING` where it fit scored lower, because misplaced clusters still form words when re-read and swapping them out loses letters. Prices are fixed, so owning more letters does not make keys dearer (starting guess: 4M points for a combination key, 4M per letter for a word key). They unlock later (starting guess: 13 letters owned), because progression should be slow: the player builds a bank of letters before worrying about odds. Keys are the mid-game lever; [word slots](#word-slots-steering-the-sentence) are the late-game one.

### The typewriter line and carriage return

Each monkey's line on screen runs to the edge of the terminal (Justin, 2026-10-14), or 60 letters where a front end doesn't say how wide it is. When it's full, the carriage returns and a fresh line starts. If the window is made narrower, a line's oldest letters drop off the left. This is display only: words and chains carry on across the return, since play lines can be longer than a screen line.

## Combos

Words typed back to back on the same monkey's line form a chain. The whole chain is worth the sum of its words' points × its multiplier.

- **Only long, different words raise the multiplier.** Each word of **4+ letters** that isn't already in the chain adds one to the multiplier. Shorter words and repeats still join the chain and are paid at the current multiplier, but don't raise it. This keeps the early game slow, when short words are all you can make.
- **The multiplier is capped**, starting at **×3**. Raising the cap is an upgrade bought with [Sentences](#currencies).
- A **skipped letter** breaks the chain.
- Points are paid as the chain grows: when a word lands, you receive whatever brings the chain's total up to (sum of its words) × multiplier.

Example: `CAT` (15) is too short to count, so it pays 15 at ×1. `QUIZ` (88) is the first long word, still ×1. `ZANY` (64) makes it ×2, so the chain total becomes (15 + 88 + 64) × 2 = 334 and ZANY pays 231. Another `CAT` pays 30 (15 at ×2). A repeated `QUIZ` doesn't raise the multiplier.

## Currencies

- **Points** (shown as **Bananas** since 2026-10-14) come from every word. They buy letters, typing speed and typewriter keys.
- **Sentences** come from typing any line of the play with **3+ words** word for word, every time, including lines already completed (shorter lines would be farmed). They buy hats for your monkeys and repeatable upgrades such as raising the combo cap.
- **Sentences also come from long chains (balance pass, 2026-10-13)**, so they are a slow but renewable currency: when a chain breaks, it pays 1 Sentence if it held 3+ words of 4+ letters, plus 1 for every 3 more (`sentenceRules` in config.ts). Measured with `scripts/simulate.ts`: about 40 in the first hour, about 100 an hour by hour 5. Looser rules gave far too many (any 3 words: 3K in the first hour); stricter ones (4 long words) almost none.
- **Words** (2026-10-13) come from each **different** word your monkeys spell: one per new entry in the dictionary, so the supply is limited by the word list and your letters. An early-game limited currency. Words are spent on **letters** **(decided)**: each new letter costs points plus floor(¼ × letters owned²) Words (0, 1, 2, 4, 6, 9, ... 156 for the 26th; placeholder). The early steps stay small so a poor early letter like Q or J, which adds few new words, can't lock you out.
- **Lines** come from completing a line of the play for the **first** time: one per line, so the supply is limited by the play's length. They're the rarest currency and buy the biggest, permanent upgrades: word slots and manager upgrades.

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

For players who don't want to micromanage **(decided)**. A department with 5 typing monkeys can **hire** a manager (Justin, 2026-10-14: "the player can hire a manager monkey which requires an office that shares a door into the department"), one per department, in the Staff store at the price of the department's next monkey. It needs a **manager's office**: a 2 x 2 room bought on the office map (`r`), placed beside its department's room with a door between, that comes with a **manager's desk** (`D`; spares are sold in the Office store). The store says what's missing (office, door, desk, monkeys). The manager sits at the manager's desk and doesn't take a typist's place. (Before this, `m` promoted a typist; that key is gone.) A manager doesn't type; instead it:
- picks an unwritten line of its department's owned scenes and pins it, by priority **(decided)**: within reach (your letters can spell it), then the fewest words, then the earliest in play order. With nothing in reach it pins the shortest out-of-reach line, and switches as soon as a line comes within reach;
- fills your word slots with that line's words by position (slots past the line's length switch off; slot words that need letters you don't own aren't typed; with every owned line written all slots switch off, so typing is random again);
- moves on to the next line as soon as one is written.

A manager sets its own department's slots. Managers can be **upgraded** (`u`): each upgrade adds +0.1× to the points of every monkey in that department. Because one upgrade improves a whole department, they're very expensive: Lines, 50 per monkey in the department, doubling each level (starting guess).

### Monkey traits

Every monkey has a **trait** (Justin, 2026-10-14: "giving individual monkeys random traits"), picked at random when it joins. Traits work from the start but are **hidden** until you find the book in a manager's desk (Justin: "if the player inspects the managers desk there will be a hidden book about understanding your employee's needs. reading this book will unlock and display the monkeys traits which are active but hidden until this point"): inspect the desk (`i` on the map), `y` reads "Understanding Your Employees". Then the home screen has a TRAIT column (green while it helps, red while it hurts, dim when it does nothing), inspecting a desk says its monkey's trait, and `e` on the map reopens the book: every trait and what each monkey's is doing now. Traits (placeholders, `traits` in config.ts):
- Claustrophobic: +10% speed with a window by its desk, -10% with no door or window within 2 squares.
- Night owl: +15% speed at night (8pm to 6am on the player's clock), -5% by day. Early bird: +10% by day, -5% at night.
- Social: +3% speed per other monkey in its room, up to 15%. Loner: +15% with 3 or fewer in its room, -5% with 8 or more.
- Green thumb: +10% speed with a potted plant or bonsai in its room. Bookworm: +10% pay with a bookshelf in its room. Couch potato: breaks 30% faster with a couch in its lounge.
- Perfectionist: -10% speed, +20% pay.

Offices are too small for feng shui and don't count toward the office's chi.

### The monkey roster

`m` on the home screen (Justin, 2026-10-14: "a menu where you can look at your roster of monkeys... organized by department then hire order... a cursor... to see specific information about individual monkeys"): every monkey grouped by department (in [tab] order, R&D last), then hire order. Up and down move the cursor; below the list, the chosen monkey's job, typing skill and typewriter, speed, energy, combo, happiness, hat (dye and effect), wardrobe, trait (only once the manager's book is read) and desk. `n` renames it.

### R&D

Built 2026-10-14 (Justin: R&D "mid game, before another play department", needs a room and desks with monkeys, research takes fixed real-world time, more R&D monkeys = faster). R&D opens when you build its lab on the office map (`r`, possible from 8 monkeys); until then the Research store's tab is hidden, and it's the last tab (Justin, 2026-10-14). It needs researchers: real monkeys (names, hats, traits) hired in the Staff store, up to 10, each with a desk in the lab. They don't type or tire. The Research store lists projects; one runs at a time, costs bananas to start, and takes a fixed number of hours for one researcher (two take half as long; a researcher's speed trait counts). Research runs in real time, including the whole time you're away. Finished projects are permanent boosts (`research` in config.ts, placeholders): tire slower, faster breaks, +10% bananas, faster typing, cheaper room squares, combo cap +1. [tab] on the home screen also shows R&D, with the project's progress. The lab doesn't count for feng shui. Marketing tactics will be added as projects when Marketing is built.

### Storing, selling and firing

Justin, 2026-10-14: "options to remove sell furniture items, remove and sell hats, and fire employees... an inventory for the player to store furniture and hats that are not in use". On the office map, `s` puts the piece under the cursor into storage and `$` sells it for half its base price (`sellBack` in config.ts); desks and managers' desks stay. Buying a kind you have in storage takes one out for free (the store shows how many are stored), and stored pieces still count toward the next one's price. In the roster (`m`), `h` takes a monkey's hat off (it stays in its wardrobe), `$` sells the hat it wears for half its base price in Sentences, and `f` fires it after `y`: it leaves for good, its desk stays free, and its hats go into storage, where the Hats store gives them to another monkey for free. Firing pays nothing back and doesn't lower the next hire's price; the last typing monkey can't be fired. Each monkey keeps its number for good (Justin: "keep the names static even when unnamed"): a new monkey gets one past the highest, and its famous name is picked from it.

**Temps** (step 4 of the HR plan; Justin, 2026-10-14: "temp employees... expire after a while, can't be upgraded, but have higher base stats/positive traits"): each candidate in HR's list is a temp a third of the time (`hr.tempChance`). A temp has speed and stamina of 110-140%, a helpful trait (cheerleader, motivator, social, green thumb, bookworm or couch potato), feels good about or loves every job, and costs a quarter of a candidate's price. It works 8 hours of game time (`hr.tempHours`, offline too), then leaves: its desk is free and its hats go into storage, and the game says so. Temps can't get faster typing, a typewriter or a manager upgrade. The list shows how long each candidate stays; the roster marks temps and their time left. The last permanent typing monkey can't be fired, so temps leaving never empties the office.

### Coin flip

Just for fun (Justin, 2026-10-14: "a for-fun gambling mechanic where the player can flip a coin and bet to double all of their points or lose all of their points"): `$` on the home screen asks to bet every banana you have; `y` flips. Heads doubles them, tails loses them all. Heads starts at a 1% chance (Justin: "have it start out as 1% win 99% lose") and gains 0.1% for every achievement, scene, act and play finished and every flip won (Justin: "every achievement, scene, act, play completed can add .1%. every successful flip can also add .1%"), up to 50% (`coinFlip` in config.ts, `flipChance`). The prompt shows the chance. Winnings don't count toward bananas earned, so they unlock no earning achievements. Statistics count flips won and lost; two achievements: win a flip, lose a flip.

### Marketing

Justin, 2026-10-14: "Marketing earns bananas from published Folios by count and popularity; marketing tactics researched in R&D boost it". On 2026-10-15 he picked "Plays and Folios" so it helps mid-game: once there's an HR office, a Marketing office can be built on the office map. Marketing monkeys (Staff store, up to 5, 10M then x3; hired through HR's candidate list like anyone) don't type. Each one at its desk earns royalties every second, offline too: `perLine` (10) bananas for every line of every scene finished this run, plus `perPage` (100) for every page of every Folio published, which stay popular for good. A marketer's feeling about marketing and its speed trait count. R&D gets three marketing tactics, listed once the Marketing office stands: Posters (+50%), Radio ads (+100%), Book tour (+200%). LATELY shows the royalties a second. Numbers in `marketing` in config.ts, placeholders.

### HR

Built 2026-10-14 (Justin: "lets add the HR department. Maybe this can unlock after you hire your first manager?"). Once you've hired a manager, the office map's `r` offers an HR office (a normal room at the normal room price); LATELY says so. HR monkeys are hired in the Staff store (up to 5, 1M bananas then x3 each), each with a desk in the HR office; they don't type or tire, and show in the roster and the office's room table. Each HR monkey who can reach its desk makes every typing monkey 2% happier (so they earn more, tire slower and rest faster) and new typing monkeys 5% cheaper (`hr` in config.ts, placeholders). The HR office doesn't count for feng shui and has no home screen view.

**Hidden stats** (Justin, 2026-10-14: "monkeys can have hidden stats like typing speed, total energy... specialties in their jobs, so that hiring a monkey that is better suited for the job... will have bonuses... minor penalties if unsuited, and major penalties if they detest that job"), step 1 of 4 (then traits that affect other monkeys, hiring from a list of candidates through HR, and temps). Every monkey gets, at random when it joins: speed and stamina (each 80-120%: its typing speed, and how long its energy lasts), and a feeling about each job (typing, managing, HR, research): loves +20%, good +10%, fine, unsuited -10%, detests -40% (`monkeyStats` in config.ts, placeholders). The feeling about the job it does applies: typing speed, a manager's bonus to its department's bananas, an HR monkey's happiness and discount, a researcher's research speed. They work from the start, hidden; building an HR office shows them in the roster (`m`).

**Traits that rub off** (step 2, Justin: "traits that make other monkeys happier or work harder or slower"): four more traits act on every other monkey in the same room, all the time: Cheerleader (+5% happiness), Grump (-5% happiness), Motivator (+5% typing speed), Slacker (types 10% faster itself, room-mates 5% slower). They add up, capped at 50% either way (`room` on each trait, `traitRules.maxRoomEffect`). Like other traits they're hidden until the manager's book is read; then the TRAIT column colours them by whether they help or hurt their room-mates.

**Hiring through HR** (step 3, Justin: "hiring through HR allows the player to look through a roster of potential hires that cost different amounts based on stats"): once there's an HR office, every hire (a typist, a manager, a researcher, an HR monkey) opens HR's list of candidates: each one's speed, stamina, feeling about that job, trait (once the manager's book is read) and price. A candidate's price is the usual price x ((speed + stamina) / 2 x (1 + its feeling about the job))^2: about 2x for the best, a quarter for the worst. `0` hires someone unseen at the usual price. The list holds 3 candidates plus one per HR monkey (up to 9) and is drawn again every hour, while you're away too (`hr` in config.ts, `drawCandidates`, `candidateFactor`). Before HR, hiring is blind as before.

### The Sonnets department

A late-game fourth department for Shakespeare's Sonnets **(built)**, mainly a late way to earn more **Lines**. Verse lines run to a meter rather than ending at sentence breaks, so sonnets score differently:
- It opens only after all three play departments, at 30 monkeys (starting guess).
- Sonnets are bought one at a time (10 points per letter, like scenes) or all 154 at once at the whole-play discount. There are no acts.
- Each new verse line written pays 2 Lines and a smaller points bonus (line word points × words, not words²). No Sentences, since verse lines often aren't complete sentences.
- Finishing a sonnet pays 1 Line per line in it (14 for most) instead of scene and act bonuses; sonnets give no points or speed bonus and no free monkey.
- The text is the MIT Shakespeare's Sonnets, converted with `scripts/import-sonnets.ts` (stored like a play, one sonnet per "act"). The source runs two lines together in sonnets 7 and 93, so those have 13 lines; 99 has 15 and 126 has 12, as Shakespeare wrote them.
- Other poems (*Venus and Adonis*, *The Rape of Lucrece*, ...) could join this department later.

## Screen layout (terminal)

Reworked 2026-10-14 (Justin: "the screens appear cluttered and difficult to parse"; "lets go through each section one at a time starting with home screen"). Mockups and the reasoning: the "Infinite Monkeys Screen Cleanup" artifact. Each kind of styling has one job on every screen (`src/cli/style.ts`): inverse is where you are (the title bar), bold is new or live (and keys), dim is what you can skip (headings, explanations, what you don't own yet); green, yellow, red and blue mean good, getting low, needs you and resting; each currency has its own colour (Bananas yellow, Words cyan, Sentences magenta, Lines blue). The currency is called **Bananas** for now (Justin, 2026-10-14: "to stay on the monkey theme"); code still calls it points.

```
 INFINITE MONKEYS     345.44K Bananas   1.11K Words   179 Sentences   3 Lines

 MONKEY                SPEED   ENERGY  COMBO  TYPING
 A@ M-1               0.00/s  Resting     x1  ELHAORNEIESDIU_
 #@ Bartholomew      421.4/s      98%     x3  EAHHSESDNRELUSENUDRUAAERSAARUTEART_

 Letters  A _ _ D E _ _ H I _ _ L _ N O _ _ R S T U _ _ _ _ _   (12 of 26)
 Script   3 / 2,160 lines written   9 scenes owned

 LATELY
   Last word: LOOED +30
   A monkey wrote a line! "And I." (3.1)  already written
   Bought a potted plant.
 -----------------------------------------------------------------------------
 [space] shop   [p] script   [o] office   [t] stats   [a] achievements   [w] dictionary
 [enter] pet the monkey   [n] name   [d] move   [c] options   [?] all keys   [q] quit
```

- **Monkey table:** columns never change width (Justin: "I want to make sure the columns like monkey speed etc dont change width"): the name column fits the 12-character name limit, and with more than one department a department initial comes before the name. Energy is a percent (Justin preferred it to a bar, which took too much room): green above 80%, yellow above 20%, red at 20% and below, and a blue **Resting** on a break (`energyColors` in config.ts). Managers show `-` for speed, energy and combo, and what they're aiming at.
- **One department at a time** (Justin, 2026-10-14: "I want to be able to change which typing department is displayed on the home screen"): with several departments the table shows one, named above it with "department 2 of 3"; `tab` shows the next. The choice is saved with the options.
- **Letters:** the whole alphabet in order, each letter you own in its place and a dim `_` for the rest (Justin's idea).
- **LATELY:** one feed for news: the last word, the last line written and the last milestone (dim), anything waiting for you (a Folio, a new department), and the newest message in bold.
- **Keys:** two short rows, places to go and things to do, broken between keys to fit the screen. `?` lists every key, including save, reset and dev tools.

**Shop** (Justin, 2026-10-14: rename the furniture stores "Office" and "Breakroom", "use left and right arrow keys to move back and forth between shops", "make sure the element column doesnt show until the fengshui book is read"):

```
 INFINITE MONKEYS > SHOP     345.44K Bananas   1.11K Words   179 Sentences   3 Lines

 Typewriters*  Staff*  Hats*

     ITEM               EFFECT                                     PRICE
 [1] Faster typing      +1 skill for a monkey          * from 10 Bananas
 [2] Hire a monkey      you have 7                     * 300.00K Bananas
 [3] Raise combo cap    x3 -> x4                           * 1 Sentences
 ------------------------------------------------------------------------------
 [up/down] choose   [enter] buy   [1-9] buy   [[/]] store   [i] inspect   [esc] back
```

- **Controls** (Justin, 2026-10-15: "a consistent cursor on all screens so the player can use the arrow keys and enter to navigate the entire game. I still want to be able to use the number keys to select things and [] to change tabs"): the chosen item is inverse; up/down move it (across pages, which follow it), enter buys it, `i` inspects it, 1-9 still buy on the page shown, `[` `]` (or left/right) change stores, esc closes. Keys that aren't the shop's still work as on the home screen. Other menus get the same cursor next.
- **Main shop** (Justin, 2026-10-15: "for now make the main show just typewriter, staff, and hats. research can show up when the department is built. make the script tab a shop that only opens on the script page"): Typewriters, Staff, Hats, then Research once the lab is built. On the script page, `[space]` opens the Script shop under the script: this scene, its act and the whole play (this sonnet and all the sonnets for Sonnets), for the line under the script cursor; `[enter]` still pins, and b/a/w still buy directly.
- **Home cursor** (Justin, 2026-10-15, option 1): up/down choose a monkey in the table (its name inverse); enter opens its details in the monkey roster; `[h]` pets it (petting moved off enter); `[n]` names and `[d]` moves the chosen monkey, with no "which monkey?" prompt.
- **Furniture** is not in the main shop (Justin, 2026-10-15: "remove the furniture tabs from the main shop and instead make the shop in the map screen different"): on the office map, `[f]` opens the map's own shop, Office and Breakroom stores, under the map (or alone when the screen is too short), with the same controls; esc goes back to the map.

- Under the home screen when the terminal is tall enough for both (Justin, 2026-10-14), else its own screen; the open store's tab is inverse, the others dim. Items in columns (item, look, element, effect, price on the right); columns keep their width across a store's pages, and close up to one space apart when that's what fits an 80-column screen. Affordable (Justin, 2026-10-14: "make the currency value have no color when it isnt purchasable, and when it is purchasable the currency value changes to the associated color. the name of the upgrade could turn green"): the item's name green, a green `*`, and the price in its currency's colour (Bananas yellow, Sentences magenta, Lines blue); the same everywhere a price shows (script, typewriter keys, word slots, office map, monkey pickers). Not yet: the whole row dim, the price uncoloured. Furniture glyphs are coloured by what the piece looks like, not its element (Justin, 2026-10-14): green plants, brown wood, red fire, blue and cyan water, gray chrome (`color` on each piece in config.ts), on the map and in the store. Notes are dim. Descriptions stay behind `i`.
- Hire a monkey shows **desk needed** in red where the price goes when its department has no free square for a desk, or **room needed** when it has no room yet (Justin, 2026-10-14).
- The ELEMENT column appears only once the feng shui book is read. A piece bigger than one square says so after its name, e.g. Couch (2x1).

**Office map** (Justin, 2026-10-14: "office map room looks good for now"): the title bar, the map, a dim legend, then a table of rooms (number, name, size, chi once the book is read, lounge, effects, who works there, cut to "+N more" at the screen's edge). A room with no way in, and a department with no room, show in red. Prices for a new room and one more square sit under the table. How rooms and lounges work moved to a `?` page.

**Script** (Justin, 2026-10-14, on the mockup: "can you add a button to skip back and forth between pinned lines?"): the title bar, the play and its progress, a dim heading per scene, written lines green with `+`, pinned lines `@`, the cursor's line inverse, and a NEEDS column of the letters each line still needs (`in reach` in green when none); lines too long for the screen wrap under themselves.

**Light mode** (Justin, 2026-10-14: "is there a setting to swap the entire game to light mode?"): the game never paints a background, so it follows the terminal's theme. Options (`c`) has a **Light background** switch that turns yellow, cyan and green into darker 256-colour shades that read well on white (`forLightBackground` in style.ts, applied to the finished screen in main.ts). `[` and `]` jump to the previous or next pinned line, across plays. The contents page is a table (play, genre, written, scenes owned; or one play's scenes by act), locked plays and unowned scenes dim, the cursor's row inverse.

**Statistics and menus** (Justin, 2026-10-14: "make "folios published" its own section, and make it only appear after the first folio is published. also include stat for longest sentence... for letters typed, can we display all the letters in order of most typed?"): every page and menu has the title bar, dim headings and notes, a dim rule and a key row. Statistics are in sections: TYPING (now with Sentences written and the longest sentence, its words wrapped under the values), PLAYS (lines, plus the scene, act, play and sonnet milestones that used to sit under achievements), MONKEYS, FOLIOS (only once one is published), LETTERS TYPED (every letter, most typed first) and MOST SPELLED (two columns). The game counts sentences and keeps only the longest one's words (up to 500); storing every sentence would grow the save without limit and slow every autosave, so it doesn't. Achievements mark unlocked ones with a green `[x]` and dim the rest; the dictionary dims its counts. Options, typewriter keys, word slots and dev tools share one look: `[n]` keys in bold, ON in green and off dim, affordable prices in their currency's colour with a green `*`. The opening screens (genre, free scene, first letter) list their choices with dim details lined up.

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
10. **Office expansion** (Justin, 2026-10-13), one step at a time:
    1. **Stores.** The shop splits into stores, switched with `tab`: Typewriters first (letter keys first, since collecting letters matters most; better typewriters, typewriter keys, word slots), Staff (departments, training, hiring, combo cap, managers), Script, Furniture and Accessories (Hats since 2026-10-14). (Real estate was folded into the office map in step 5c.) Buying a letter is now buying a letter key for the typewriters. (Built.)
    2. **Office space** (reworked 2026-10-13 at Justin's request). Rooms are any shape (on one shared grid since step 5c). Each department needs its own room, and every monkey gets a free desk on a square of its department's room, so floor space caps a department. You start in a 2x2 room; new 3x3 rooms (for a department, or break rooms for furniture) cost 10K points x10 per room owned, and any room grows one square at a time (500 points x1.15 per square bought). Old saves get an office that fits their monkeys. (Built.)
    3. **Furniture and layout.** A Furniture store sells potted plants, floor lamps, bookshelves, water coolers, couches and TVs for points (each of a kind costs more than the last), one square each. Justin: designing the layout should never be needed to succeed, but lets players go deeper. So everything places itself (new desks, furniture in a break room first, growth on the most compact square), and the office map (`o`) lets players design: move furniture and desks (desks stay in their department's room), and grow rooms on squares they choose (`x`). An options menu (`c`) switches furniture auto-placement off, so buying furniture opens the map with the new piece in hand. Furniture does nothing yet: its effects come with energy (step 5). (Built.)
    4. **Energy.** Each typing monkey's energy drains from 100% to 0% over 10 minutes of typing; speed scales down linearly to 75% at 0%. At 0% it takes a break on its own and rests back to 100% in 1 minute, typing nothing meanwhile. Managers don't tire. Over a full cycle a monkey averages about 80% of its speed. The home screen shows each typist's current speed and energy (or the time left on its break). Offline time is worked out exactly, breaks included. Numbers are in `energy` in config.ts, placeholders that furniture will change. (Built.)
    5. **Furniture effects.** Break rooms filled with furniture raise monkey energy and happiness (Justin, 2026-10-13). Decor (plant 3%, lamp 4%, bookshelf 6%) in a department's room slows its monkeys' tiring, up to 50%. Comforts (bench 8%, water cooler 15%, couch 25%, TV 40%) in a break room speed up every monkey's breaks, up to +300%. (Since 6a, each department gets only its own room's and its lounge's furniture.) Every piece adds happiness (1-3%), a points bonus up to +50%. Happiness also helps energy (Justin, 2026-10-14: "the higher the monkey's happiness the slower their energy drain and the faster their energy gain"): each monkey's happiness (the office's plus its petting) multiplies its drain time by (1 + happiness) and divides its break time by it. Furniture happiness does both (Justin chose both over energy only). The store lists each piece's effect; the office map shows each room's totals. Accessories (monkey items, now hats) came in 5b. Numbers are placeholders. (Built.)
    5b. **Accessories** (built 2026-10-13). Bought with Sentences (points until the 2026-10-13 balance pass) for one typing monkey at a time, one per slot, each of a kind dearer than the last: reading glasses (eyes, its words and lines pay 10% more), headphones (ears, tires 15% slower), fuzzy slippers (feet, breaks 30% faster), coffee mug (hands, types 10% faster), thinking cap (head, combo cap +1). A monkey's accessories show as letters after its name. Hats (Justin, 2026-10-13: "fun icons for the monkeys when they wear different hats"): every monkey has an ASCII icon on the home screen and the office map, `@` with its hat on its left: baseball cap `d@` (tires 10% slower), top hat `#@` (+15% points), thinking cap `^@` (combo cap +1), crown `W@` (+10% points and speed). Everything the game prints is ASCII (Justin, 2026-10-13) so it runs in any terminal. Numbers are placeholders; the feng shui book for step 6 would be sold here too.
    5c. **Hats only** (Justin, 2026-10-14: "instead of having accessories, lets try only having hats, and having many different hat customization options because hats are the only accessories that affect the monkeys visually"; "some of the hats should be the same price"; "but some should be exorbitantly expensive"). The Accessories store became the Hats store; glasses, headphones, slippers and the mug are gone. Eight hats, cheapest first, bought with Sentences, each of a kind dearer than the last: baseball cap `d@` 25 (tires 10% slower), beanie `n@` 25 (breaks 20% faster), party hat `A@` 25 (types 5% faster), top hat `#@` 500 (+15% points), cowboy hat `~@` 500 (tires 25% slower), thinking cap `^@` 5,000 (combo cap +1), crown `W@` 1 million (+25% points and speed), halo `o@` 1 billion (+50% points and speed, tires 50% slower). Customization: each monkey keeps a wardrobe of every hat it was given and wears one (swapping back is free; picking the worn hat takes it off), and a worn hat can be dyed one of six terminal colours (red, green, yellow, blue, magenta, cyan) for 10 Sentences, shown on the home screen and the office map; washing the dye out is free. Managers can wear hats too (they get the look; a manager doesn't type, so most boosts do nothing for it). Old saves keep any hat they had as an accessory. New achievements: dye a hat, a halo, own 7 kinds of hat.
    5c. **Hallways, doors and one office map** (Justin, 2026-10-13: "require the player to have doors and hallways connecting the rooms. Fill this in automatically in the simplest way possible but allow the player to move these things around"). The whole office is one grid. Rooms keep a hallway's width apart (since 6a, break rooms and departments' rooms may share a wall and a door). Every room needs a way in from room 1 (the entrance) through doors and hallway squares; a room without one doesn't work (its monkeys can't reach their desks, its furniture does nothing) and the map marks it NO WAY IN. A new room goes where it needs the shortest new hallway while keeping the office compact and within the map's width (18 squares), and gets a door and the shortest hallway to the rest of the office. On the map, `d` cycles a door through a square's walls and `h` lays or lifts a hallway square, both free. `space` picks up and puts down furniture or a door; while one is held, `r` turns it (Justin, 2026-10-13). One-square pieces have no direction; instead some pieces are bigger (Justin, 2026-10-14: "make some objects like couches and benches larger than one tile, 1x2 for example"): the couch and a new Bench (a cheaper break-room comfort, 10K Points, breaks 8% faster) take 2 x 1 squares, drawn joined (`C===C` across, `|` down), and `r` turns them to stand 1 x 2. A piece needs all its squares free in one room; new ones stand where they fit, turned if only that fits. Where and which way bigger pieces stand does nothing yet, but it should tie into feng shui, the hidden layout bonuses of step 6 (Justin, 2026-10-14). The Real estate store is gone (Justin: room expansion on the map is the way to buy space): rooms are bought (`r`) and grown (`x`) on the map, and opening a department moved to the Staff store. Old saves are laid out on one grid and connected. (Built.)
    6. **Hidden mechanics and lore.** Layout bonuses discovered through flavour text (e.g. a feng shui book).
    6a. **Feng shui and windows** (Justin, 2026-10-14: "lets work on fengshui and furniture... we can also add windows to the game because those can be important for fengshui"; on the proposal: "lets start here. for now, the simpler the better"). Research and the fuller proposal: the project file `infinite-monkeys/feng-shui-research.md`. Built, the simplest version:
        - **Windows** sit in a room's outside walls (no room or hallway beyond), drawn `===` in top and bottom walls and `:` in side walls. `w` on the office map cycles a window through the square's outside walls, free like doors. Room 1 starts with one, every new room gets one where no door looks straight at it, a room that grows through its window gets another, and a hallway laid outside a window removes it.
        - **Elements:** every piece has one, shown in the store once the feng shui book is read. Furniture doubled and more (Justin, 2026-10-14: "double it, and have some at the same price tier as others, and having similar levels of benefit"; "perhaps fire should be the most rare"; "3 fire, 4 water, 5 wood, 5 earth, 6 metal"): 23 pieces, each at the price and benefit of an existing one. Fire (rarest): scented candle, fireplace, TV. Water: fish tank, indoor fountain, water cooler, hot tub. Wood: plant, bonsai, bookshelf, armchair, hammock. Earth: sand garden, landscape painting, bench, beanbag, couch. Metal: wall clock, floor lamp, mirror, brass gong, espresso machine, vending machine (and every desk). Windows are light only, not Fire, so Fire stays rare. Pieces fit only certain kinds of room (Justin, 2026-10-14: "make certain furniture only available in certain rooms, then make the store have different sections based on the rooms in the office... televisions should not be able to be placed in the office, only in the lounge"): the wall clock, bookshelf and gong fit only departments' rooms; the bench, beanbag, espresso and vending machines, couch, fireplace, hammock, TV and hot tub only break rooms; everything else either. The store has a section (tab) per kind of room, Office and Breakroom (renamed from Department rooms and Break rooms, 2026-10-14), each listing what fits there by price and buying into that kind of room; stores with more than 9 items have pages (`up`/`down`). Seats (bench, armchair, beanbag, couch, hammock) want a wall behind them in a break room.
        - **Lounges** (Justin, 2026-10-14: "furniture in the office should only apply benefits to that office room, furniture in lounges should apply benefits to any office that connects directly to that lounge. that way a lounge can connect to multiple offices and apply benefits to all at once"; "option a but also with hallways. furniture benefits within one lounge should stack, but offices should only receive benefits from the closest>largest lounge either sharing a door or a hallway"; "if there are multiple the same size then the one with the most furniture"). Break rooms and departments' rooms may now share a wall, with a door straight between them; rooms of one kind still keep a hallway's width apart. A new break room goes against as many departments' rooms as it can (a new department's room is happy against a break room too), with a door into each, and a room that grows against one gets a door. Each department has one **lounge**: the nearest break room, through a door between them (nearest) or along hallways (fewest hallway squares); if several are as near, the biggest, then the one with the most furniture, then the first built. A department gets every effect (tiring, breaks, happiness) of the furniture in its own room and its lounge, added up and capped per department; other break rooms do nothing for it. Feng shui chi stays office-wide. The office map shows each department's lounge and effects, and which departments each break room is the lounge of.
        - **Five rules per room** (fengshui.ts): Light (a window); Command (every desk against a wall and out of the straight path in from a door; in a break room, at least one seat, each with its back (a long side, for a bigger seat) against a wall); Flow (no door's straight path runs to a window or door in the far wall with nothing standing in it); Welcome (the square just inside each door is empty); Balance (all five elements). A room's chi is the share it keeps.
        - **Effect:** the office's chi (the average over rooms you can reach) adds up to +10% happiness, which raises points and helps energy like furniture happiness. Only once you've read the **feng shui book**: then each room's chi shows on the map and `b` rereads it (general guidelines for placing furniture: the rules, the elements and what each room lacks). This replaced the proposal's "bonus applies unseen without the book", so nobody gets a bonus for free.
        - **Finding the book** (Justin, 2026-10-14: "instead of the book being purchasable directly, instead it can be a hidden element of a bookshelf furniture item... a new command for inspect so that any time any menu item is highlighted, it can be inspected. if there is no description, just say something like nothing of interest here"; "when you buy the book case and pick it up or highlight it, you can inspect it, and it will say that it contains a book"; "the player can then opt to read the book"). `i` inspects: on the office map, the piece under the cursor or the one being held (every furniture kind and the desk have a description in config.ts; a window describes itself; anything else is "Nothing of interest here."); in a store, `i` then the item's number (furniture and hats have descriptions). Inspecting a bookshelf before the book is read finds it, and `y` reads it. Not sold anywhere.
        - **Auto-placement** puts new desks and furniture out of doors' paths (and desks against a wall) when it can. A Harmony achievement marks a room with perfect chi. Later, if wanted: element neighbours (generating and overcoming cycles) and a secret bagua corner bonus. Numbers are placeholders.

## Achievements

Built 2026-10-14 (Justin: "achievements for every first is good. maybe some fun ones too like 1000 pets and other benign stuff like that"). The `a` page lists every achievement, like the statistics and dictionary pages: every first (word, letter bought, combo, Sentence, line, scene, act, play, hire, name, manager, department, room, furniture, hat, faster typing, typewriter, key, slot, pet), fun ones (100, 1,000 and 10,000 pets; a monkey at its happiest; 10-word chain; 8- and 12-letter words; 100, 1,000 and 10,000 different words; a million letters; all 26 letters; a full department; 24 hours typing; a crown; a billion Points) and secret words shown as ??? until spelled (MONKEY, BANANA, HAMLET, BARD, TYPEWRITER, INFINITE). Achievements give no rewards. Unlocking one shows a message; old saves unlock what they've already done. The milestones (scenes, acts, plays and sonnets finished, with their bonuses) moved to the statistics page. The list is data (`achievements` in config.ts), each measured by a stat in `achievementValue`.

## Publishing a Folio (prestige)

Built 2026-10-14. Justin liked a prestige reset but worried how it would work with several departments on different plays at once, and chose to let the player decide when ("lets start with 1"). Finishing any whole play doesn't reset anything; it opens `[f] publish a Folio` on the home screen, usable whenever you like. Publishing starts everything over (monkeys, letters, office, script, currencies, scene and act bonuses) and keeps achievements, statistics, options and the Folio. The Folio banks a page for every play line written in every department, so half-finished plays in other departments still count, plus each finished play's lines once more. Every page is +0.1% points for good: one finished *Midsummer* is 4,320 pages, points x5.32. Folios multiply each other (Justin, 2026-10-15, feature list item 6: "late game numbers get REALLY big; Folios could feed bigger multipliers"): each Folio multiplies bananas by 1 + its pages x 0.1%, on top of every Folio before it (`state.folioBoost`), so ten Midsummers are about x17M rather than x44. Saves from before count all their pages as one Folio. Numbers get short names up to vigintillion (Vg, 1e63) and exponents past that; the **Scientific numbers** option (`c`, `3`) shows everything from a million up as 1.23e45 instead. The home screen shows the pages a Folio would bank before you publish, and the Folio bonus after. Numbers are in `folio` in config.ts (placeholders). The dev menu can finish a play to try it.

## Open questions

- **Unlock rules for keys and slots.** 13 letters is a placeholder, like the monkey unlock.
- **Play completion reward.** The Folio (below) is the first part, built 2026-10-14. More could come per play (Justin liked the prestige idea; the other ideas were a golden monkey that types whole words, letters that cost nothing on the next run, a new mechanic per play such as a witches' cauldron for *Macbeth*).
- **Monkey price in Lines.** Starting guess: 10 Lines, ×2 each. For the balance pass.
- **Department thresholds and script prices.** 10 and 30 monkeys, 10 points per letter, 20%/40% discounts are placeholders for the balance pass.
- **Price curves and speeds.** All numbers above are first guesses for the balance pass.
