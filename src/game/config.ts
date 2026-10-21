// All player-facing names and balance numbers live here so the game can be
// reskinned or rebalanced without touching the logic. See docs/DESIGN.md.

export const theme = {
  title: 'Infinite Monkeys',
  currency: 'Bananas',
  pokeAction: 'pet the monkey',
};

/** The player's first letter has to be a word on its own. */
export const startingLetters = ['A', 'I'];

/**
 * Words added on top of the main word list (data/words.txt, the public-domain
 * ENABLE list), which leaves out one-letter words.
 */
export const extraWords = ['A', 'I'];

/** Scrabble-style letter values; a word scores (sum of values) x length. */
export const letterValues: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

/** Values of the Greek capitals the Greek department types, by how rare they are in Greek (like Greek Scrabble). */
export const greekLetterValues: Record<string, number> = {
  Α: 1, Ε: 1, Ι: 1, Ο: 1, Ν: 1, Σ: 1, Τ: 1, Η: 1,
  Κ: 2, Π: 2, Ρ: 2, Υ: 2,
  Λ: 3, Μ: 3, Ω: 3,
  Γ: 4, Δ: 4, Θ: 4,
  Χ: 5, Φ: 5,
  Β: 8,
  Ζ: 10, Ξ: 10, Ψ: 10,
};

/**
 * Monkeys start slow; each "Faster typing" level multiplies their speed.
 * Level n costs upgradeBaseCost x upgradeCostGrowth^n.
 */
/** The n-th letter you buy (after your free first one) costs baseCost x costGrowth^(n-1). */
export const letterShop = {
  baseCost: 25,
  costGrowth: 3.4, // with monkeyShop: the first play takes about a week (2026-10-20 sims)
  // Each letter also costs Words: floor(wordsCostFactor x owned^wordsCostPower), so 0, 1, 2, 4, 6, 9, ...
  // Kept gentle early: a poor second or third letter (Q, J) adds few new words, and must not lock you out.
  wordsCostFactor: 0.25,
  wordsCostPower: 2,
};

/**
 * Free letters, one for each of these achievements (Justin, 2026-10-15: "if
 * letters stall things ... a handful of letters awarded as bonuses for
 * completing other tasks", "at more fun and unique milestones", "8 ways to
 * earn free letters"). The player picks the letter, and can keep free
 * letters for later. Each is given once, ever: Folios keep them.
 */
export const letterGifts: string[] = ['first-hire', 'first-typewriter', 'pets-100', 'first-hat', 'chain-10', 'flip-won', 'word-banana', 'full-department'];

/**
 * You start with one monkey. More monkeys are paid in Points. Each
 * department has its own price: the n-th monkey bought for the d-th
 * department opened (both from 0) costs
 * baseCost x departmentGrowth^d x costGrowth^n, so every department takes
 * days to fill however many monkeys came before it.
 */
export const monkeyShop = {
  baseCost: 1_000_000, // scripts/simulate.ts (2026-10-20): 2nd monkey after about 2h
  costGrowth: 500, // 5 to a department since 2026-10-20: the 5th monkey after about 3 days (scripts/simulate.ts)
  departmentGrowth: 100,
};

/**
 * Combos: each word at least minWordLength long in a chain (repeats too) adds
 * step to the multiplier (Justin, 2026-10-15: small steps, so the meter moves),
 * and it stops at maxMultiplier (raised by research and the thinking cap).
 * Every chain starts at 1 plus step per starting-combo upgrade (Justin,
 * 2026-10-16: the cap raise mattered little, so it became this), up to the
 * cap. The n-th upgrade costs startBaseCost x startCostGrowth^n Sentences.
 */
export const combo = {
  minWordLength: 2,
  step: 0.1,
  maxMultiplier: 3,
  startBaseCost: 1,
  startCostGrowth: 2,
};

/**
 * Sentences from babbling: when a monkey's chain ends, it pays a Sentence if
 * it held at least chainWords words of wordMinLength+ letters, and one more
 * for every extraEvery such words past that. Renewable and slow-paced.
 */
export const sentenceRules = {
  chainWords: 3, // measured with scripts/simulate.ts: about 40 the first hour, about 100 an hour by hour 5
  wordMinLength: 4, // the same long words that raise the combo
  extraEvery: 3,
  maxRecordWords: 500, // the longest-sentence record keeps at most this many words of a chain
};

/**
 * Typing a line of the play word for word: every time it pays a Sentence
 * (lines of at least sentenceMinWords words only, so one-word lines can't be
 * farmed); the first time it pays a Line and a points bonus of
 * (the line's word points) x (number of words)^2.
 */
export const lineRewards = {
  sentenceMinWords: 3,
  pointsScale: 1, // a line's points x words^2 are scaled by this
};

/**
 * Typewriter keys, a mid-game upgrade bought with points once you own
 * unlockLetters letters. Each key is one more option a monkey can hit, and
 * types its whole text in one keystroke:
 * - combination keys come from a curated list (junk clusters would just
 *   dilute the pool);
 * - a word key unlocks once your monkeys have spelled that word enough
 *   times: wordSpellsToUnlock for the first word key, then wordSpellsGrowth
 *   times more for each word key you own (words of wordMinLength+ letters).
 * Prices are fixed, so owning more letters doesn't make keys dearer.
 */
export const typewriterKeys = {
  unlockLetters: 13,
  baseCost: 4_000_000, // points
  combinationCostFactor: 1, // x baseCost
  wordCostPerLetter: 1, // x baseCost per letter of the word
  wordSpellsToUnlock: 100,
  wordSpellsGrowth: 1.1, // +10% per word key owned
  wordMinLength: 3,
  combinations: ['TH', 'HE', 'IN', 'ER', 'AN', 'ST', 'ND', 'OU', 'QU', 'SH', 'CH', 'ING', 'ION', 'ENT'],
};

/**
 * Each monkey has its own typing skill, trained one level at a time with
 * points. Its typewriter caps the skill at levelsPerTypewriter levels per
 * typewriter; a better typewriter (also points) allows another set of levels.
 */
export const typing = {
  baseLettersPerSecond: 0.5,
  speedPerLevel: 1.25,
  upgradeBaseCost: 10,
  upgradeCostGrowth: 1.5,
  levelsPerTypewriter: 10,
  typewriterBaseCost: 1000, // points for the 2nd typewriter
  typewriterCostGrowth: 25, // x per typewriter after that
  typewriters: ['Rusty typewriter', 'Portable typewriter', 'Office typewriter', 'Electric typewriter', 'Golden typewriter', 'Diamond typewriter'],
};

/**
 * Milestones for writing every line of a scene, an act or a play. Rewards
 * scale with length, are permanent, and add up: each scene adds
 * scenePointsPerLine per line to the points bonus and pays
 * sceneSentencesPerLine Sentences per line (at least 1); each act adds
 * actSpeedPerLine per line to the typing speed bonus and brings
 * actFreeMonkeys monkeys (which don't raise the monkey price). A play is
 * all its scenes and acts, so finishing one has paid every bonus in it,
 * however its parts were bought.
 */
export const milestones = {
  scenePointsPerLine: 0.001, // a 200-line scene: +20% points
  sceneSentencesPerLine: 0.25,
  actSpeedPerLine: 0.0005, // an 800-line act: +40% typing speed
  actFreeMonkeys: 1,
};

/**
 * The script shop. Each new Shakespeare department picks one free play of its
 * genre (starterPlays shortest are offered), and the rest are bought whole
 * (Justin, 2026-10-19: "make plays only purchasable or unlockable in
 * entirety") with Lines (Justin, 2026-10-20: writing one text pays for the
 * next): linesPerLine for each line not owned yet. The sonnets and foreign
 * texts also sell only whole ("just have texts unlock in entirety"); texts the
 * story unlocks come whole too. Placeholders.
 */
export const scriptShop = {
  linesPerLine: 0.5,
  starterPlays: 3,
};

/**
 * What it takes for a piece of furniture or a hat to show up in its store
 * (Justin, 2026-10-20: fewer of them, unlocked by finishing scenes, acts and
 * texts, so each feels meaningful): this many finished scenes, acts and whole
 * texts. Without one it's sold from the start.
 */
export interface Unlock {
  scenes?: number;
  acts?: number;
  texts?: number;
}

/**
 * Departments: one per genre (comedies, histories, tragedies, and last the
 * Sonnets). You open the first at the start; the n-th opens once you have
 * monkeysToOpen[n-1] monkeys, bought or earned. A department holds at most
 * maxTypists typing monkeys plus one manager, so the thresholds must stay
 * reachable: the n-th department needs at most (n-1) x maxTypists. You choose
 * each new monkey's department (automatic when only one has room). Each monkey works in one department and only
 * writes lines of plays in that department's genre, and only plays of a
 * department's genre can be bought.
 */
/**
 * Office space. Each department needs its own room, and every monkey needs a
 * desk in its department's room; a desk comes free with each monkey and stands
 * on a free square, so a department's floor space caps its monkeys. Break
 * rooms hold furniture. You start with one small room; new rooms (starting at
 * newRoomWidth x newRoomHeight) cost roomBaseCost x roomCostGrowth^(rooms bought
 * before), and rooms grow one square at a time, the n-th square bought costing
 * squareBaseCost x squareCostGrowth^n. Both are paid in Sentences (Justin,
 * 2026-10-15: Sentences piled up with little to buy). Everything places itself; the office
 * map is there for players who want to design the layout. Costs are placeholders.
 */
export const office = {
  starterWidth: 2,
  starterHeight: 2,
  newRoomWidth: 3,
  newRoomHeight: 3,
  roomBaseCost: 100,
  roomCostGrowth: 10,
  squareBaseCost: 10,
  squareCostGrowth: 1.15,
  mapWidth: 18, // squares across the office map before new rooms go below instead
};

/**
 * Furniture, bought with Sentences (Justin, 2026-10-16: cosmetics soak up
 * Sentences and climb fast) in the office map's Office and Breakroom stores ([f]). Each piece fills one
 * square, placed in the first free square of a break room (else any room); the
 * office map moves it. Each one of a kind costs costGrowth times the last.
 * A department gets the furniture in its own room and in its lounge (the
 * nearest break room, by a door or a hallway; see loungeOf): decor (drain)
 * slows its monkeys' tiring, comfort (rest) speeds up their breaks, and every
 * piece adds a little happiness (see `petting`). Bonuses add up, per
 * department, to the caps in `energy`. All numbers are placeholders.
 */
/** Colours a furniture glyph can be drawn in. */
export type FurnitureColor = 'brown' | 'green' | 'red' | 'yellow' | 'blue' | 'cyan' | 'magenta' | 'gray';

export interface FurnitureKind {
  id: string;
  name: string;
  glyph: string; // one character on the office map
  color?: FurnitureColor; // the glyph's colour on screen, from what the piece looks like (none: the terminal's text colour)
  cost: number;
  costGrowth: number;
  drain: number; // decor: a department's monkeys tire this much slower (0.03 = 3%), with it in their room or their lounge
  rest: number; // comfort: a department's breaks go this much faster (0.15 = 15%), with it in their room or their lounge
  happiness: number; // a department's points x (1 + happiness), added up, with it in their room or their lounge; its monkeys also tire slower and rest faster
  size?: [number, number]; // squares across and down (1 x 1 when missing); turning a piece swaps them
  element: Element; // its feng shui element
  description?: string; // what inspecting it shows
  seat?: boolean; // a seat: feng shui wants a wall behind it in a break room
  rooms: RoomKind[]; // the kinds of room it can stand in
  unlock?: Unlock; // sold only once these are finished
}

/** The kinds of room: a department's room (its monkeys' desks), a break room, or a department's manager's office. */
export type RoomKind = 'department' | 'break' | 'office' | 'lab' | 'hr' | 'marketing' | 'codebreaking' | 'library' | 'records';

/** The five feng shui elements. A room with all five is balanced. */
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** The desk every monkey gets free, in its department's room. Not sold. */
export const desk: FurnitureKind = { id: 'desk', name: 'Desk', glyph: '@', cost: 0, costGrowth: 1, drain: 0, rest: 0, happiness: 0, element: 'metal', rooms: ['department', 'lab', 'hr'], description: 'A desk and a typewriter. Typewriters are mostly Metal, and so, some say, are good monkeys.' };

/**
 * The manager's desk: every manager's office comes with one, and a spare is
 * sold in the Office store. The first one inspected hides a book (see managerBook).
 */
export const managerDesk: FurnitureKind = {
  id: 'managerdesk',
  name: "Manager's desk",
  glyph: 'D',
  color: 'brown',
  cost: 100_000,
  costGrowth: 2,
  drain: 0,
  rest: 0,
  happiness: 0,
  element: 'wood',
  rooms: ['office'],
  description: 'A big oak desk with a nameplate, a stamp and three pens. The bottom drawer is stuck shut, or nearly.',
};

/**
 * A safe for a manager's office (Justin, 2026-10-17: "make safes a purchasable
 * furniture upgrade that only shows up in the menu when a new managers office
 * is placed"): sold in the Manager store while a manager's office has none,
 * one per office; it can't be stored, sold or moved out of its office.
 */
export const safe: FurnitureKind = {
  id: 'safe',
  name: 'Safe',
  glyph: 'S',
  color: 'gray',
  cost: 5_000,
  costGrowth: 2,
  drain: 0,
  rest: 0,
  happiness: 0,
  element: 'metal',
  rooms: ['office'],
  description: 'A heavy steel safe with a five-digit dial.',
};

export const furnitureKinds: FurnitureKind[] = [
  // Decor: a department's monkeys tire slower (with it in their room or their lounge). Pieces at the same price do as much. `rooms` says where each may stand.
  { id: 'plant', name: 'Potted plant', glyph: 'P', color: 'green', cost: 100, costGrowth: 2, drain: 0.03, rest: 0, happiness: 0.01, element: 'wood', rooms: ['department', 'break', 'office'], description: 'A leafy friend in a clay pot. Wood, they say, feeds the fire of a busy mind.' },
  { id: 'candle', name: 'Scented candle', glyph: 'I', color: 'red', cost: 100, costGrowth: 2, drain: 0.03, rest: 0, happiness: 0.01, element: 'fire', rooms: ['department', 'break', 'office'], description: 'It smells faintly of bananas. A small flame, but Fire all the same.' },
  { id: 'clock', name: 'Wall clock', glyph: 'K', color: 'yellow', cost: 100, costGrowth: 2, drain: 0.03, rest: 0, happiness: 0.01, element: 'metal', unlock: { scenes: 1 }, rooms: ['department', 'office'], description: 'Tick, tock, type. A brass clock keeps the hours, and Metal keeps the mind sharp.' },
  { id: 'lamp', name: 'Floor lamp', glyph: 'L', color: 'yellow', cost: 400, costGrowth: 2, drain: 0.04, rest: 0, happiness: 0.01, element: 'metal', unlock: { scenes: 3 }, rooms: ['department', 'break', 'office'], description: 'A brass floor lamp: cold Metal, warm light.' },
  { id: 'fishtank', name: 'Fish tank', glyph: 'F', color: 'cyan', cost: 400, costGrowth: 2, drain: 0.04, rest: 0, happiness: 0.01, element: 'water', unlock: { scenes: 3 }, rooms: ['department', 'break', 'office'], description: 'Three goldfish, unimpressed by the typing. Moving Water calms the mind.' },
  { id: 'bonsai', name: 'Bonsai tree', glyph: 'Y', color: 'green', cost: 400, costGrowth: 2, drain: 0.04, rest: 0, happiness: 0.01, element: 'wood', unlock: { scenes: 6 }, rooms: ['department', 'break', 'office'], description: 'A very old, very small tree. Patient Wood, the opposite of a monkey.' },
  { id: 'sandgarden', name: 'Sand garden', glyph: 'Z', color: 'yellow', cost: 400, costGrowth: 2, drain: 0.04, rest: 0, happiness: 0.01, element: 'earth', unlock: { scenes: 6 }, rooms: ['department', 'break', 'office'], description: 'Raked sand and three smooth stones. Calm, quiet Earth.' },
  { id: 'bookshelf', name: 'Bookshelf', glyph: 'B', color: 'brown', cost: 4_000, costGrowth: 2, drain: 0.06, rest: 0, happiness: 0.02, element: 'wood', unlock: { acts: 1 }, rooms: ['department', 'office'], description: 'Rows of dusty old books. One of them sticks out a little further than the rest.' },
  { id: 'painting', name: 'Landscape painting', glyph: 'G', color: 'green', cost: 4_000, costGrowth: 2, drain: 0.06, rest: 0, happiness: 0.02, element: 'earth', unlock: { acts: 1 }, rooms: ['department', 'break', 'office'], description: 'Rolling hills under a wide sky. Pictures of the land bring Earth indoors.' },
  { id: 'mirror', name: 'Mirror', glyph: 'M', color: 'gray', cost: 4_000, costGrowth: 2, drain: 0.06, rest: 0, happiness: 0.02, element: 'metal', unlock: { acts: 2 }, rooms: ['department', 'break', 'office'], description: 'A silver-framed mirror. The monkeys make faces at it. Polished Metal sends chi back into the room.' },
  { id: 'gong', name: 'Brass gong', glyph: 'O', color: 'yellow', cost: 4_000, costGrowth: 2, drain: 0.06, rest: 0, happiness: 0.02, element: 'metal', unlock: { acts: 3 }, rooms: ['department', 'office'], description: 'Strictly for emergencies. And lunch. A deep note of Metal.' },
  { id: 'fountain', name: 'Indoor fountain', glyph: 'Q', color: 'blue', cost: 4_000, costGrowth: 2, drain: 0.06, rest: 0, happiness: 0.02, element: 'water', unlock: { acts: 3 }, rooms: ['department', 'break', 'office'], description: 'Water trickles over smooth stones. Flowing Water carries good fortune in.' },
  // Comforts: in a break room, every monkey's breaks go faster. Seats like a wall behind them.
  { id: 'bench', name: 'Bench', glyph: 'H', color: 'brown', cost: 2_000, costGrowth: 2, drain: 0, rest: 0.08, happiness: 0.01, size: [2, 1], element: 'earth', rooms: ['break'], seat: true, description: 'A sturdy bench, solid as the Earth. It likes a wall at its back.' },
  { id: 'armchair', name: 'Armchair', glyph: 'A', color: 'brown', cost: 2_000, costGrowth: 2, drain: 0, rest: 0.08, happiness: 0.01, element: 'wood', rooms: ['department', 'break', 'office'], seat: true, description: 'Carved wood, worn smooth by many naps. Best with a wall at its back.' },
  { id: 'beanbag', name: 'Beanbag', glyph: 'N', color: 'magenta', cost: 2_000, costGrowth: 2, drain: 0, rest: 0.08, happiness: 0.01, element: 'earth', unlock: { scenes: 1 }, rooms: ['break'], seat: true, description: 'Shapeless, squashy and close to the Earth. Best against a wall.' },
  { id: 'cooler', name: 'Water cooler', glyph: 'W', color: 'cyan', cost: 10_000, costGrowth: 3, drain: 0, rest: 0.15, happiness: 0.01, element: 'water', unlock: { scenes: 3 }, rooms: ['department', 'break'], description: "Glug. The office's only source of Water, and of gossip." },
  { id: 'espresso', name: 'Espresso machine', glyph: 'E', color: 'gray', cost: 10_000, costGrowth: 3, drain: 0, rest: 0.15, happiness: 0.01, element: 'metal', unlock: { scenes: 6 }, rooms: ['break'], description: 'Chrome, hissing, and far too strong. Monkeys love it.' },
  { id: 'vending', name: 'Vending machine', glyph: 'V', color: 'red', cost: 10_000, costGrowth: 3, drain: 0, rest: 0.15, happiness: 0.01, element: 'metal', unlock: { acts: 1 }, rooms: ['break'], description: 'Sells only bananas. A steel box of Metal, humming.' },
  { id: 'couch', name: 'Couch', glyph: 'C', color: 'blue', cost: 40_000, costGrowth: 3, drain: 0, rest: 0.25, happiness: 0.02, size: [2, 1], element: 'earth', unlock: { acts: 2 }, rooms: ['break'], seat: true, description: 'Deep, soft and low to the Earth. Monkeys nap best with a wall behind it.' },
  { id: 'fireplace', name: 'Fireplace', glyph: 'R', color: 'red', cost: 40_000, costGrowth: 3, drain: 0, rest: 0.25, happiness: 0.02, element: 'fire', unlock: { acts: 3 }, rooms: ['break'], description: 'Crackling logs. The real thing: warm, bright Fire.' },
  { id: 'hammock', name: 'Hammock', glyph: 'J', color: 'brown', cost: 40_000, costGrowth: 3, drain: 0, rest: 0.25, happiness: 0.02, size: [2, 1], element: 'wood', unlock: { texts: 1 }, rooms: ['break'], seat: true, description: 'Strung between two wooden posts. Swaying Wood, and the best naps.' },
  { id: 'tv', name: 'Television', glyph: 'T', color: 'gray', cost: 200_000, costGrowth: 3, drain: 0, rest: 0.4, happiness: 0.03, element: 'fire', unlock: { texts: 1 }, rooms: ['break'], description: 'It only shows nature documentaries about monkeys. Electronics burn with Fire.' },
  { id: 'hottub', name: 'Hot tub', glyph: 'U', color: 'cyan', cost: 200_000, costGrowth: 3, drain: 0, rest: 0.4, happiness: 0.03, size: [2, 1], element: 'water', unlock: { texts: 2 }, rooms: ['break'], description: 'Nobody remembers approving this. Nobody is complaining.' },
  managerDesk,
  safe,
];

/**
 * Feng shui: each room has five rules (see fengshui.ts), and its chi is
 * the share it keeps. The office's chi (the average over rooms you can reach)
 * adds up to maxHappiness to happiness once you find the feng shui book,
 * more than any amount of furniture can give (energy.maxHappiness), so a
 * crowded room of the best pieces never beats a well-arranged one (Justin,
 * 2026-10-16). Also once the book is read, on a sliding scale with no
 * penalties (Justin, 2026-10-16): every empty square in a department's room
 * and lounge multiplies their furniture's effects by perEmptySquare more (up
 * to maxSpaceFactor), and every different kind of piece in them adds perKind
 * to the department's happiness and break speed. The book is hidden in a
 * bookshelf (inspect one on the office map) and shows the rules and each
 * room's chi. Fire is the rarest element (the candle and the TV). Placeholders.
 */
export const fengShui = {
  maxHappiness: 0.6,
  perEmptySquare: 0.1, // Space: each empty square makes furniture x0.1 more effective
  maxSpaceFactor: 3, // up to x3
  perKind: 0.03, // Variety: each different kind of piece (desks aside) adds +3% happiness and break speed
  hiddenIn: 'bookshelf', // the furniture kind the book is found in
  title: 'The Way of the Typewriter: feng shui for monkeys',
  found: 'Tucked behind the other books is a slim volume: "The Way of the Typewriter: feng shui for monkeys".',
  window: 'A window. Every room wants light, though sunlight is no substitute for a real flame.',
  nothing: 'Nothing of interest here.',
};

/**
 * Manager's offices: a small room for one department's manager, sharing a
 * wall and a door with the department's room, with a manager's desk in it.
 * Bought on the office map like other rooms, at the price of a room.
 */
export const managerOffice = {
  width: 2,
  height: 2,
  // Furniture in a manager's office makes it quicker at changing slots
  // (Justin, 2026-10-16): each piece adds its happiness x speedPerHappiness
  // (a +1% piece: +10% speed), up to maxFurnitureSpeed in all; with the feng
  // shui book read, the office's chi adds up to chiSpeed more. Placeholders.
  speedPerHappiness: 10,
  maxFurnitureSpeed: 1,
  chiSpeed: 0.6,
};

/**
 * The book hidden in a manager's desk (Justin, 2026-10-14). Reading it shows
 * every monkey's trait, which works from the day the monkey is hired, seen or not.
 */
export const managerBook = {
  hiddenIn: 'managerdesk',
  title: 'Understanding Your Employees: a field guide for managers of monkeys',
  found: 'In the stuck bottom drawer is a dog-eared paperback: "Understanding Your Employees: a field guide for managers of monkeys".',
};

/**
 * Traits: every monkey has one, picked at random when it joins (Justin,
 * 2026-10-14: "giving individual monkeys random traits"). They work all along
 * but stay hidden until the manager's book is read. `speed`, `pay` (points)
 * and `rest` (break speed) are [bonus when its condition is good, change when
 * it's bad] (0.1 = +10%); when each holds is in traitMood in logic.ts. Day is
 * dayStart to nightStart, by the player's clock. Placeholders.
 */
export interface Trait {
  id: string;
  name: string;
  text: string; // what the book says about it
  speed?: [number, number];
  pay?: [number, number];
  rest?: [number, number];
  /** What it does to every other monkey in its room, all the time (0.05 = +5%): their happiness and their typing speed. */
  room?: { happiness?: number; speed?: number };
}

export const traits: Trait[] = [
  { id: 'claustrophobic', name: 'Claustrophobic', speed: [0.1, -0.1], text: '10% faster with a window by its desk; 10% slower with no door or window within 2 squares of it.' },
  { id: 'nightowl', name: 'Night owl', speed: [0.15, -0.05], text: '15% faster at night (8pm to 6am), 5% slower by day.' },
  { id: 'earlybird', name: 'Early bird', speed: [0.1, -0.05], text: '10% faster by day (6am to 8pm), 5% slower at night.' },
  { id: 'social', name: 'Social', speed: [0.15, 0], text: '3% faster for every other monkey in its room, up to 15%.' },
  { id: 'loner', name: 'Loner', speed: [0.15, -0.05], text: '15% faster with 3 or fewer monkeys in its room, 5% slower with 8 or more.' },
  { id: 'greenthumb', name: 'Green thumb', speed: [0.1, 0], text: '10% faster with a potted plant or a bonsai tree in its room.' },
  { id: 'bookworm', name: 'Bookworm', pay: [0.1, 0], text: 'Its words pay 10% more with a bookshelf in its room.' },
  { id: 'couchpotato', name: 'Couch potato', rest: [0.3, 0], text: 'Recovers 30% faster with a couch in its lounge.' },
  { id: 'perfectionist', name: 'Perfectionist', speed: [-0.1, 0], pay: [0.2, 0], text: '10% slower, but its words pay 20% more.' },
  // Traits that rub off on the rest of its room (Justin, 2026-10-14: "traits that make other monkeys happier or work harder or slower").
  { id: 'cheerleader', name: 'Cheerleader', room: { happiness: 0.05 }, text: 'Every other monkey in its room is 5% happier.' },
  { id: 'grump', name: 'Grump', room: { happiness: -0.05 }, text: 'Every other monkey in its room is 5% less happy.' },
  { id: 'motivator', name: 'Motivator', room: { speed: 0.05 }, text: 'Every other monkey in its room types 5% faster.' },
  { id: 'slacker', name: 'Slacker', speed: [0.1, 0], room: { speed: -0.05 }, text: 'Types 10% faster itself, but every other monkey in its room types 5% slower.' },
];

/**
 * R&D (Justin, 2026-10-14): a department that doesn't type. It opens at
 * opensAt monkeys (before the second play department), needs a lab (a room
 * bought on the office map) and researchers, monkeys hired into it with a
 * desk each, up to maxResearchers. One project runs at a time: it costs
 * bananas to start and takes `hours` of one researcher's work in real time,
 * so two researchers take half as long; it carries on while you're away.
 * Researchers don't type or tire. Effects add up over finished projects:
 * points and speed (0.1 = +10%), drain (tire slower), rest (faster breaks),
 * combo (combo cap), squares (room squares cost less). Placeholders.
 */
export interface ResearchProject {
  id: string;
  name: string;
  text: string;
  hours: number;
  cost: number;
  points?: number;
  speed?: number;
  drain?: number;
  rest?: number;
  combo?: number;
  squares?: number;
  marketing?: number; // a marketing tactic: royalties up by this share
  bombe?: number; // the Bombe tests this share more settings a second
  needs?: 'marketing' | 'telegram'; // listed only once there's a Marketing office, or a telegram has come
  after?: string; // listed only once this project is done
}

export const research = {
  id: 'research', // a researcher's department
  name: 'R&D',
  opensAt: 8,
  maxResearchers: 10,
  hireCost: 1_000_000,
  hireCostGrowth: 3,
  projects: [
    { id: 'chairs', name: 'Ergonomic chairs', text: 'Monkeys tire 10% slower.', hours: 1, cost: 100_000, drain: 0.1 },
    { id: 'snacks', name: 'Banana snacks', text: 'Recovers 20% faster.', hours: 3, cost: 1_000_000, rest: 0.2 },
    { id: 'spelling', name: 'Spelling theory', text: '+10% bananas.', hours: 8, cost: 10_000_000, points: 0.1 },
    { id: 'ribbons', name: 'Carbon ribbons', text: 'Monkeys type 10% faster.', hours: 16, cost: 100_000_000, speed: 0.1 },
    { id: 'floorplans', name: 'Open floor plans', text: 'Room squares cost 25% less.', hours: 24, cost: 1_000_000_000, squares: 0.25 },
    { id: 'rhythm', name: 'Typing rhythm', text: 'Combo cap +1.', hours: 48, cost: 10_000_000_000, combo: 1 },
    { id: 'tenfinger', name: 'Ten-finger typing', text: 'Monkeys type 20% faster.', hours: 72, cost: 1e11, speed: 0.2 },
    // Marketing tactics (Justin, 2026-10-14: "marketing tactics researched in R&D boost it").
    { id: 'posters', name: 'Posters', text: 'Royalties +50%.', hours: 4, cost: 10_000_000, marketing: 0.5, needs: 'marketing' },
    { id: 'radio', name: 'Radio ads', text: 'Royalties +100%.', hours: 24, cost: 1_000_000_000, marketing: 1, needs: 'marketing' },
    { id: 'booktour', name: 'Book tour', text: 'Royalties +200%.', hours: 72, cost: 1e11, marketing: 2, needs: 'marketing' },
    // The Bombe, once a telegram has come (see enigma).
    { id: 'cribs', name: 'Study the telegram', text: 'Finds cribs, words it likely holds: the way in.', hours: 24, cost: 1e12, needs: 'telegram' },
    { id: 'bombe', name: 'Build the Bombe', text: 'Codebreaking can test Enigma settings on a telegram.', hours: 72, cost: 1e13, needs: 'telegram', after: 'cribs' },
    { id: 'bombe2', name: 'Perfect the Bombe', text: 'Tests settings twice as fast.', hours: 96, cost: 1e14, bombe: 1, needs: 'telegram', after: 'bombe' },
    { id: 'bombe3', name: 'More Bombes', text: 'Tests settings +200% faster.', hours: 168, cost: 1e15, bombe: 2, needs: 'telegram', after: 'bombe2' },
  ] as ResearchProject[],
};

/**
 * HR (Justin, 2026-10-14): a department that doesn't type, opened by building
 * its office on the office map once you've hired your first manager. HR
 * monkeys are hired into it with a desk each, up to maxStaff. Each one at its
 * desk makes every typing monkey happierEach happier (so they earn more, tire
 * slower and rest faster) and new typing monkeys discountEach cheaper. They
 * don't type or tire. Placeholders.
 */
export const hr = {
  id: 'hr', // an HR monkey's department
  name: 'HR',
  maxStaff: 5,
  hireCost: 1_000_000,
  hireCostGrowth: 3,
  happierEach: 0.02,
  discountEach: 0.05,
  // Hiring through HR (step 3): with an HR office, hiring shows a list of
  // candidates whose stats you can see, priced by them (see candidateFactor).
  // The list holds candidatesBase plus one per HR monkey (up to 9), and is
  // drawn again every refreshHours.
  candidatesBase: 3,
  maxCandidates: 9,
  refreshHours: 1,
  // Temps (step 4; Justin, 2026-10-14: "temp employees... expire after a
  // while, can't be upgraded, but have higher base stats/positive traits"):
  // each candidate is a temp with tempChance. A temp has stats from
  // tempStats, a trait from tempTraits, and feels good about or loves every
  // job; it costs tempPrice of a candidate's price, leaves after tempHours
  // (its desk free, its hats into storage), and can't get faster typing, a
  // typewriter or a manager upgrade. Placeholders.
  tempChance: 1 / 3,
  tempHours: 8,
  tempPrice: 0.25,
  tempStats: { min: 1.1, max: 1.4 },
  tempTraits: ['cheerleader', 'motivator', 'social', 'greenthumb', 'bookworm', 'couchpotato'],
  tempFeelings: ['good', 'loves'],
  // A temp brings the typewriter of the office's best- or second-best-equipped monkey (Justin, 2026-10-18), the second this often.
  tempSecondTypewriter: 0.8,
};

/**
 * Marketing (Justin, 2026-10-14: "Marketing earns bananas from published
 * Folios by count and popularity"): a department that doesn't type, opened by
 * building its office on the office map once there's an HR office. Marketing
 * monkeys are hired into it with a desk each, up to maxStaff. Each one at its
 * desk earns royalties every second (offline too): perLine for every line of
 * every scene finished this run, and perPage for every page of every Folio
 * published (they stay popular for good). Marketing tactics researched in R&D
 * raise royalties. Placeholders.
 */
/**
 * Safes (Justin, 2026-10-17: "a 5 digit combination safe as an item for the
 * managers office"). You can buy one for each manager's office (see `safe`).
 * Inspecting one ([i] on the office map) finds it,
 * and the first one found lets you build a Codebreaking office. Each safe
 * found is harder than the last, whichever department it's in (Justin:
 * "each safe should get harder than the last. maybe eventually they can work
 * like passwords with letters or numbers"): the n-th takes `locks[n - 1]`,
 * and past the list each adds a character of letters and digits. Codebreakers
 * try random combinations on the safe in focus, so a lock with S symbols and
 * length L takes S^L tries on average. What's inside comes in the same order
 * whichever safe is opened (Justin: "the contents of the safes are unlocked
 * in the same order no matter which department"): the first safe opened holds
 * the first foreign text (Greek, from Aristotle's Metaphysics, for
 * translation later), and so on down `contents`. The notes are placeholder
 * nonsense (Justin: story stuff is nonsense until he specifies it).
 */
export const safes = {
  locks: [
    { length: 5, symbols: '0123456789', name: 'a five-digit dial' },
    { length: 6, symbols: '0123456789', name: 'a six-digit dial' },
    { length: 5, symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', name: 'a five-letter password' },
    { length: 5, symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', name: 'a five-character password of letters and digits' },
  ],
  contents: [
    'a scroll covered in Greek letters, signed with a name: ARISTOTLE. Nobody here can read it. Yet.',
    'a note: "Flibber the wobsnark twelvely. Plonk."',
    'a note: "Grumbleworth sings the teapot backwards on Thursdays."',
    'a note: "Zizzle. Zizzle. Frondabout the custard moon."',
    'a note: "Wimble the snorkpot, quoth the gargleduck."',
  ],
  empty: 'a note: "Blorp. Blorp again. Splendiferous noodlewhip."',
  found: 'A heavy steel safe. Something rattles inside when you tip it.',
  open: 'The safe stands open. Inside:',
};

/**
 * Codebreaking (Justin, 2026-10-17): an office you can build once you've
 * found a safe, with up to maxStaff codebreakers hired in the Staff store.
 * They work on one thing at a time, the one in focus (a safe, or once the
 * first safe is open its scroll, see translation), which you can switch at
 * any time (Justin: "the player has the option at any time to shift the
 * focus of the department from the foreign text to the safe"). Placeholders.
 */
export const codebreaking = {
  id: 'codebreaking', // a codebreaker's department
  name: 'Codebreaking',
  maxStaff: 5,
  hireCost: 1_000_000,
  hireCostGrowth: 3,
  triesPerSecond: 1,
};

/**
 * The Library (Justin, 2026-10-17: "a new type of room for storing books"): a
 * room on the office map, built once a play or text is finished, that opens
 * into hexagonal galleries. Every finished play and text and every published
 * Folio is shelved in the first gallery with room; each full gallery adds
 * fullBonus to points. The library's books and galleries outlast a Folio (the
 * room is rebuilt after one). The first gallery comes with the room; more cost
 * Lines. Placeholders.
 */
export const library = {
  name: 'Library',
  booksPerGallery: 4, // one shelf on each of a gallery's four walls (the other two sides are its doors)
  galleryCost: 100, // Lines for the second gallery
  galleryCostGrowth: 10,
  fullBonus: 0.05, // points for each full gallery
  maxBooks: 500, // Justin, 2026-10-18: a library holds 500 books at most, so 125 galleries
};

/**
 * Records (Justin, 2026-10-18): "in charge of determining what writing from
 * the monkeys is worth keeping and recording it in books that will eventually
 * end up in the libraries when full". An office you can build once the
 * Library stands, with up to maxStaff clerks. Each clerk at its desk catches
 * catchEach of the grammatical sentences the monkeys write (see grammar.ts),
 * and only ones not yet recorded and not a line of a text; bookSize of them
 * fill a book, which goes to the Library. Placeholders.
 */
export const records = {
  id: 'records', // a records clerk's department
  name: 'Records',
  maxStaff: 5,
  hireCost: 1_000_000,
  hireCostGrowth: 3,
  catchEach: 0.2,
  bookSize: 100,
};

/**
 * The Library's Bibliography (Justin, 2026-10-17: "an automatic book in the
 * library ... which cites all of the sources of text not written for the
 * game"): always there, on no shelf. One entry for each outside text; add one
 * with every text imported.
 */
export const bibliography = [
  'William Shakespeare, Hamlet, Macbeth, A Midsummer Night\'s Dream, Richard III and the Sonnets. The Complete Works of William Shakespeare, the MIT edition (the public-domain Moby text), https://github.com/TheMITTech/shakespeare.',
  'ENABLE (Enhanced North American Benchmark Lexicon), the public-domain word list behind the dictionary.',
  'Grady Ward, Moby Part-of-Speech List (Moby Project, 1996), public domain: the parts of speech behind the Records department\'s grammar check.',
  'Aristotle, Metaphysics I.4, 985b4-22. Greek: W. D. Ross, ed., Aristotle\'s Metaphysics (Oxford, 1924), public domain, transcribed from the Internet Archive\'s scan. English: W. D. Ross, trans. (Oxford, 1908), public domain.',
  'Aristotle, De generatione et corruptione. Greek: I. Bekker, ed., Aristotelis Opera (Berlin: Royal Prussian Academy, 1831), public domain, via Greek Wikisource. English: H. H. Joachim, trans., On Generation and Corruption (Oxford, 1922), public domain, via the MIT Internet Classics Archive.',
  'Marcus Tullius Cicero, De natura deorum. Latin: G. F. Schoemann, ed., De natura deorum libri tres, ed. A. Stickney (Boston: Ginn, 1881), public domain, from the Internet Archive\'s scan; section numbers from R. Klotz\'s Teubner text (Leipzig, 1879 and 1886), public domain. English: C. D. Yonge, trans., The Nature of the Gods (London, 1878), public domain, via Project Gutenberg (ebook 14988).',
];

/**
 * Foreign texts (Justin, 2026-10-17): the first safe opened holds a Greek
 * scroll, firstText (Aristotle's Metaphysics I.4), which opens the Greek
 * department. Its monkeys type Greek capitals, and each line they write turns
 * into its English. The texts are data/plays/*.json with genre 'greek', built
 * by scripts/import-classical.ts.
 */
export const translation = {
  firstText: 'metaphysics-1-4',
  language: 'Greek',
  latinText: 'natura', // Cicero's De natura deorum, on the Library's first shelf
};

/**
 * Telegrams in Enigma (Justin, 2026-10-17: "after all of the safes are
 * unlocked, a knock on the door of the office, a telegram with no
 * explanation coded with the enigma machine. the monkeys will then have to
 * research, develop, and perfect the turing computer"). Once every
 * department's safe is open, a telegram comes, enciphered on a real Enigma
 * (enigma.ts) with a random key. R&D studies it and builds the Bombe (see
 * research); then Codebreaking can turn to it, testing settingsPerTry rotor
 * settings for each try it would make at a safe. A telegram's key is
 * somewhere among settings x settingsGrowth^n settings (n counts telegrams
 * before it: rotor orders x starting positions), found after testing up to
 * it; the next telegram comes hoursBetween after one is read, with one
 * more plugboard lead. The texts are placeholder nonsense (Justin: story
 * stuff is nonsense until he specifies it). Placeholders.
 */
export const enigma = {
  settings: 60 * 26 ** 3,
  settingsGrowth: 3,
  settingsPerTry: 20,
  leads: 5,
  hoursBetween: 24,
  telegrams: [
    'WOBBLE THE GRUNTFIG AT DAWN STOP NO SPOONS STOP',
    'FLUMMOX THE TEAPOT TWICE STOP THE MOON IS CUSTARD STOP',
    'SNORKEL BADGER UPSIDE STOP PLINK PLONK PLUNK STOP',
    'GARGLE THE NOODLEWHIP BY THURSDAY STOP BRING ZIZZLES STOP',
  ],
};


export const marketing = {
  id: 'marketing', // a marketing monkey's department
  name: 'Marketing',
  maxStaff: 5,
  hireCost: 10_000_000,
  hireCostGrowth: 3,
  perLine: 10,
  perPage: 100,
};

/**
 * Hidden stats (Justin, 2026-10-14: "monkeys can have hidden stats like typing
 * speed, total energy... specialties in their jobs"). Every monkey gets, at
 * random when it joins: speed (its typing speed x this) and stamina (how long
 * its energy lasts x this), each from min to max; and a feeling about each
 * job, picked by weight, whose bonus applies while it does that job: typing
 * (speed), managing (its department's bananas), hr (its happiness and
 * discount), research (its research speed). They work from the start but
 * only show once an HR office is built. Placeholders.
 */
export const monkeyStats = {
  min: 0.8,
  max: 1.2,
  jobs: [
    { id: 'typing', name: 'Typing' },
    { id: 'managing', name: 'Managing' },
    { id: 'hr', name: 'HR' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'research', name: 'Research' },
    { id: 'codebreaking', name: 'Codebreaking' },
    { id: 'records', name: 'Records' },
  ],
  feelings: [
    { id: 'loves', name: 'loves', bonus: 0.2, weight: 0.1 },
    { id: 'good', name: 'good', bonus: 0.1, weight: 0.25 },
    { id: 'fine', name: 'fine', bonus: 0, weight: 0.4 },
    { id: 'unsuited', name: 'unsuited', bonus: -0.1, weight: 0.2 },
    { id: 'detests', name: 'detests', bonus: -0.4, weight: 0.05 },
  ],
};

/** Selling (Justin, 2026-10-14): furniture and hats sell back for this share of their base price. */
export const sellBack = 0.5;

/**
 * The coin flip (Justin, 2026-10-14: "have it start out as 1% win 99% lose";
 * "every achievement, scene, act, play completed can add .1%. every
 * successful flip can also add .1%"): heads' chance starts at winChance and
 * grows by perThing for each, up to maxChance.
 */
export const coinFlip = { winChance: 0.01, perThing: 0.001, maxChance: 0.5 };

export const traitRules = {
  dayStart: 6, // 6am
  nightStart: 20, // 8pm
  socialPerMonkey: 0.03, // up to the trait's speed bonus
  maxRoomEffect: 0.5, // what room-mates' traits add up to, at most (either way)
  lonerFew: 3, // monkeys in its room, itself included
  lonerCrowd: 8,
  claustrophobicReach: 2, // squares to the nearest door or window
  greenthumbPlants: ['plant', 'bonsai'],
  bookwormBooks: ['bookshelf'],
  couchpotatoSeats: ['couch'],
};

/**
 * Monkey energy, from 1 (100%) to 0. Typing drains it in drainSeconds; a tired
 * monkey types slower, down to (1 - maxSlowdown) of its speed at 0%, when it
 * takes a break on its own and rests back to 100% in breakSeconds. Managers
 * don't type, so they don't tire. Placeholders for the balance pass; furniture
 * will change these rates.
 */
export const energy = {
  drainSeconds: 600,
  breakSeconds: 60,
  maxSlowdown: 0.25,
  maxDrainCut: 0.5, // furniture slows tiring by at most half
  maxRestBoost: 3, // and speeds up breaks by at most +300%
  maxHappiness: 0.5, // and adds at most +50% happiness: points x (1 + happiness), and see `petting`
};

/**
 * A monkey's happiness (its department's, from furniture and feng shui, plus its own from
 * petting) makes it tire slower and rest faster: drain time x (1 + happiness),
 * break time / (1 + happiness). Petting (enter) makes the least happy typing
 * monkey a little happier; it's mostly for fun (Justin: "petting should have
 * very little effect on the gameplay"), so it adds little and wears off.
 */
/**
 * The home screen's LATELY feed (Justin, 2026-10-16: "longest recent word,
 * most recent sentence, and longest recent sentence"). "Lately" is the last
 * windowSeconds of typing time: a longer word or sentence replaces the one
 * shown, and so does any once it is older than that. Sentences keep at most
 * maxSentenceWords words, to keep saves small.
 */
export const lately = { windowSeconds: 3600, maxSentenceWords: 100, maxNews: 3 };

export const petting = {
  happinessPerPet: 0.005,
  maxHappiness: 0.05, // petting adds at most +5% to a monkey's happiness
  fadePerMinute: 0.01, // and wears off this fast
};

/**
 * Publishing a Folio (the prestige reset), open once a whole play is
 * finished (Justin, 2026-10-14: the player chooses when). Everything starts
 * over except achievements, statistics, options and the Folio itself, which
 * keeps a page for every play line written, in every department, plus
 * finishedPlayPages more per line of each finished play. Every page banked
 * raises points by bonusPerPage for good. Placeholders.
 */
/**
 * Folios (Justin, 2026-10-14: "late game numbers get REALLY big; Folios
 * could feed bigger multipliers"): each Folio multiplies bananas by 1 + its
 * pages x bonusPerPage, and Folios multiply each other, so every one
 * published makes the next count for more.
 */
export const folio = {
  bonusPerPage: 0.001, // +0.1% points a page: a finished Midsummer (2,160 lines, counted twice) is about x5.3
  finishedPlayPages: 1,
};

/**
 * Achievements: no reward, just a record on the achievements page ([a]).
 * Each one unlocks when its measure (see achievementValue in logic.ts)
 * reaches `at`. Measures named word:XYZ count how often the monkeys spelled
 * XYZ; wearing:id counts monkeys wearing that hat. Secret ones show as
 * ??? until unlocked.
 */
export interface Achievement {
  id: string;
  name: string;
  text: string;
  stat: string;
  at: number;
  secret?: boolean;
}

export const achievements: Achievement[] = [
  // Every first.
  { id: 'first-word', name: 'Hello, world', text: 'Spell your first word', stat: 'wordsSpelled', at: 1 },
  { id: 'first-letter', name: 'Second letter', text: 'Buy a second letter', stat: 'lettersOwned', at: 2 },
  { id: 'first-combo', name: 'Combo', text: 'Spell two words in a row', stat: 'chain', at: 2 },
  { id: 'first-sentence', name: 'Full stop', text: 'Earn a Sentence from a long chain', stat: 'chainSentences', at: 1 },
  { id: 'first-line', name: 'To be...', text: 'Write your first line of a play', stat: 'linesWritten', at: 1 },
  { id: 'first-scene', name: 'Scene!', text: 'Finish a scene', stat: 'scenes', at: 1 },
  { id: 'first-act', name: 'Curtain call', text: 'Finish an act', stat: 'acts', at: 1 },
  { id: 'first-play', name: 'Exeunt', text: 'Finish a whole play', stat: 'plays', at: 1 },
  { id: 'first-hire', name: 'Company', text: 'Hire a second monkey', stat: 'monkeys', at: 2 },
  { id: 'first-name', name: "What's in a name?", text: 'Rename a monkey', stat: 'named', at: 1 },
  { id: 'first-manager', name: 'Middle management', text: 'Hire a manager', stat: 'managers', at: 1 },
  { id: 'first-researcher', name: 'Lab coats', text: 'Hire a researcher', stat: 'researchers', at: 1 },
  { id: 'first-hr', name: 'Human resources', text: 'Hire an HR monkey', stat: 'hrStaff', at: 1 },
  { id: 'first-marketing', name: 'Now in paperback', text: 'Hire a marketing monkey', stat: 'marketers', at: 1 },
  { id: 'first-research', name: 'Eureka!', text: 'Finish a research project', stat: 'researched', at: 1 },
  { id: 'first-department', name: 'Expansion', text: 'Open a second department', stat: 'departments', at: 2 },
  { id: 'first-room', name: 'Room to breathe', text: 'Buy a new room', stat: 'rooms', at: 2 },
  { id: 'first-furniture', name: 'Interior design', text: 'Buy a piece of furniture', stat: 'furniture', at: 1 },
  { id: 'harmony', name: 'Harmony', text: 'Give a room perfect chi (feng shui)', stat: 'harmony', at: 1 },
  { id: 'first-hat', name: 'Hat trick', text: 'Give a monkey a hat', stat: 'hats', at: 1 },
  { id: 'first-dye', name: 'Dressed to the nines', text: 'Dye a hat', stat: 'dyed', at: 1 },
  { id: 'first-faster', name: 'Practice', text: 'Teach a monkey to type faster', stat: 'skill', at: 1 },
  { id: 'first-typewriter', name: 'Upgrade', text: 'Give a monkey a better typewriter', stat: 'typewriter', at: 1 },
  { id: 'first-key', name: 'Shortcut', text: 'Buy a typewriter key', stat: 'keys', at: 1 },
  { id: 'first-slot', name: 'Fill in the blank', text: 'Buy a word slot', stat: 'slots', at: 1 },
  { id: 'first-pet', name: 'Good monkey', text: 'Pet a monkey', stat: 'pets', at: 1 },
  { id: 'first-folio', name: 'First Folio', text: 'Publish a Folio', stat: 'folios', at: 1 },
  // Just for fun.
  { id: 'pets-100', name: 'Best friends', text: 'Pet the monkeys 100 times', stat: 'pets', at: 100 },
  { id: 'pets-1000', name: 'Pet project', text: 'Pet the monkeys 1,000 times', stat: 'pets', at: 1_000 },
  { id: 'pets-10000', name: 'Spoiled rotten', text: 'Pet the monkeys 10,000 times', stat: 'pets', at: 10_000 },
  { id: 'flip-won', name: 'Double or nothing', text: 'Win a coin flip', stat: 'flipsWon', at: 1 },
  { id: 'flip-lost', name: 'Bananas gone', text: 'Lose a coin flip', stat: 'flipsLost', at: 1 },
  { id: 'happiest', name: 'Over the moon', text: 'Pet a monkey until it can be no happier', stat: 'happiest', at: 1 },
  { id: 'chain-10', name: 'On a roll', text: 'Spell 10 words in a row', stat: 'chain', at: 10 },
  { id: 'word-8', name: 'Big words', text: 'Spell a word of 8 letters', stat: 'longestWord', at: 8 },
  { id: 'word-12', name: 'Sesquipedalian', text: 'Spell a word of 12 letters', stat: 'longestWord', at: 12 },
  { id: 'dictionary-100', name: 'Vocabulary', text: 'Spell 100 different words', stat: 'dictionary', at: 100 },
  { id: 'dictionary-1000', name: 'Lexicon', text: 'Spell 1,000 different words', stat: 'dictionary', at: 1_000 },
  { id: 'dictionary-10000', name: 'Walking dictionary', text: 'Spell 10,000 different words', stat: 'dictionary', at: 10_000 },
  { id: 'letters-1m', name: 'A million monkeys', text: 'Type a million letters', stat: 'lettersTyped', at: 1_000_000 },
  { id: 'alphabet', name: 'A to Z', text: 'Own all 26 letters', stat: 'lettersOwned', at: 26 },
  { id: 'full-department', name: 'Full house', text: 'Fill a department with 5 monkeys', stat: 'biggestDepartment', at: 5 },
  { id: 'day-job', name: 'Day job', text: 'Keep the monkeys typing for 24 hours', stat: 'hoursTyping', at: 24 },
  { id: 'crown', name: 'Long live the king', text: 'Crown a monkey', stat: 'wearing:crown', at: 1 },
  { id: 'halo', name: 'Angelic', text: 'Give a monkey a halo', stat: 'wearing:halo', at: 1 },
  { id: 'hats-all', name: 'Mad hatter', text: 'Own 7 different kinds of hat', stat: 'hatKinds', at: 7 },
  { id: 'billion', name: 'Billionaire', text: 'Earn a billion Bananas', stat: 'points', at: 1e9 },
  { id: 'all-research', name: 'Peer reviewed', text: 'Finish every research project', stat: 'researched', at: research.projects.length },
  // Secrets: words the monkeys might stumble on.
  { id: 'word-monkey', name: 'Self-aware', text: 'The monkeys spelled MONKEY', stat: 'word:MONKEY', at: 1, secret: true },
  { id: 'word-banana', name: 'Snack break', text: 'The monkeys spelled BANANA', stat: 'word:BANANA', at: 1, secret: true },
  { id: 'word-hamlet', name: 'Prince of Denmark', text: 'The monkeys spelled HAMLET', stat: 'word:HAMLET', at: 1, secret: true },
  { id: 'word-bard', name: 'The Bard', text: 'The monkeys spelled BARD', stat: 'word:BARD', at: 1, secret: true },
  { id: 'word-typewriter', name: 'Know your tools', text: 'The monkeys spelled TYPEWRITER', stat: 'word:TYPEWRITER', at: 1, secret: true },
  { id: 'word-infinite', name: 'To infinity', text: 'The monkeys spelled INFINITE', stat: 'word:INFINITE', at: 1, secret: true },
];

/**
 * Hats, the only thing monkeys wear (Justin, 2026-10-14: hats are what
 * change how a monkey looks). Bought with Sentences in the Hats store for one
 * monkey at a time; a monkey keeps every hat it was given and wears one, and
 * changing hats is free. Each one of a kind costs costGrowth times the last,
 * across all monkeys. Hats come in price tiers, several hats to a tier, with
 * two absurdly expensive ones at the top. Effects, for the monkey wearing it:
 * points (its words and lines pay this much more), speed (types faster), drain
 * (tires slower), rest (breaks go faster), combo (its combo cap is this much
 * higher). The icon is the hat's ASCII character, worn on the monkey's icon
 * (#@ for a top hat). Numbers are placeholders.
 */
export interface Hat {
  description?: string; // what inspecting it shows
  id: string;
  name: string;
  icon: string; // one ASCII character, worn left of the monkey's face
  cost: number;
  costGrowth: number;
  points?: number;
  speed?: number;
  drain?: number;
  rest?: number;
  combo?: number;
  unlock?: Unlock; // sold only once these are finished
}

/** A monkey's face in its icon; a hat goes on its left. All icons are ASCII. */
export const monkeyIcon = '@';

export const hats: Hat[] = [
  { id: 'baseball', name: 'Baseball cap', icon: 'd', cost: 1_000, costGrowth: 2.5, drain: 0.1, description: 'Worn backwards, naturally.' },
  { id: 'beanie', name: 'Beanie', icon: 'n', cost: 1_000, costGrowth: 2.5, rest: 0.2, unlock: { scenes: 1 }, description: 'Warm ears, calm mind.' },
  { id: 'party', name: 'Party hat', icon: 'A', cost: 1_000, costGrowth: 2.5, speed: 0.05, unlock: { scenes: 3 }, description: "It is always someone's birthday somewhere." },
  { id: 'tophat', name: 'Top hat', icon: '#', cost: 20_000, costGrowth: 2.5, points: 0.15, unlock: { acts: 1 }, description: 'Very distinguished. Possibly borrowed from a magician.' },
  { id: 'cowboy', name: 'Cowboy hat', icon: '~', cost: 20_000, costGrowth: 2.5, drain: 0.25, unlock: { acts: 2 }, description: 'Yeehaw, but quietly: this is an office.' },
  { id: 'cap', name: 'Thinking cap', icon: '^', cost: 200_000, costGrowth: 4, combo: 1, unlock: { texts: 1 }, description: 'It whirs faintly while its wearer thinks.' },
  { id: 'crown', name: 'Crown', icon: 'W', cost: 10_000_000, costGrowth: 5, points: 0.25, speed: 0.25, unlock: { texts: 2 }, description: 'Heavy is the head that wears it. Heavier is the price.' },
  { id: 'halo', name: 'Halo', icon: 'o', cost: 10_000_000_000, costGrowth: 10, points: 0.5, speed: 0.5, drain: 0.5, unlock: { texts: 3 }, description: 'Nobody knows where it came from. It hums.' },
];

/**
 * Dyes for hats: any monkey's hat can be dyed one of these colours (ANSI
 * codes, so any terminal shows them), for Sentences: dye.cost x
 * dye.costGrowth per hat already dyed. Just for looks.
 */
export const hatColors = [
  { id: 'red', name: 'Red', ansi: 31 },
  { id: 'green', name: 'Green', ansi: 32 },
  { id: 'yellow', name: 'Yellow', ansi: 33 },
  { id: 'blue', name: 'Blue', ansi: 34 },
  { id: 'magenta', name: 'Magenta', ansi: 35 },
  { id: 'cyan', name: 'Cyan', ansi: 36 },
];
export const dye = { cost: 100, costGrowth: 1.5 }; // x per hat already dyed

export const departmentRules = {
  // Halved (Justin, 2026-10-20: too many departments with too many monkeys get cluttered); managers' upgrades were made bigger to make up for it.
  monkeysToOpen: [0, 5, 10, 15],
  maxTypists: 5, // typing monkeys per department, plus one manager
};

/**
 * The sonnet department, opened last (after all three play genres). Verse
 * lines aren't sentences, so sonnets pay mostly in Lines: linesPerLine for
 * each new line written (no Sentences), a smaller points bonus (line word
 * points x words, not words squared), and finishing a sonnet pays
 * linesPerSonnetLine Lines per line in it instead of scene and act bonuses.
 */
export const sonnetRewards = {
  linesPerLine: 2,
  linesPerSonnetLine: 1,
};

/**
 * Manager monkeys: a department with more than minDepartmentMonkeys monkeys
 * can promote one (at most one per department). A manager stops typing and
 * instead keeps its department aimed at the first unwritten line it can
 * spell with your letters: it pins that line and fills your word slots with
 * its words. If several departments have managers, the first department's
 * manager sets the word slots (there's one set of slots). Managers can be
 * upgraded with Sentences.
 */
export const managers = {
  minDepartmentMonkeys: 3,
  // One upgrade does it all (Justin, 2026-10-19: "combine the manager
  // upgrades", "make them cost sentences"): each adds bonusPerLevel to the
  // points of every monkey in the manager's department (x1.1, x1.2, ...),
  // sentencePerLevel to its Sentences base and speedPerLevel to its slot
  // speed. Upgrades are expensive, since one upgrades the whole department:
  // the n-th costs sentencesPerMonkey Sentences per monkey in the department
  // x upgradeCostGrowth^(n-1). Placeholders.
  bonusPerLevel: 0.25, // x2.5 (Justin, 2026-10-20: with half-size departments, make manager upgrades more lucrative)
  // Sentences (Justin, 2026-10-18): a manager multiplies the Sentences its
  // department's chains pay, like the word combo: x1 plus sentencePerLevel for
  // each upgrade as its base, then +sentenceGood for each chain holding a
  // grammatical sentence (see grammar.ts) and -sentenceBad for each without
  // one, never below the base. Placeholders.
  sentencePerLevel: 0.25,
  sentenceGood: 0.2,
  sentenceBad: 0.1,
  sentencesPerMonkey: 50,
  upgradeCostGrowth: 2,
  // Managers change their department's word slots one at a time, one change
  // every secondsPerSlot seconds divided by their speed (Justin, 2026-10-16:
  // "they should change the slots one at a time with a certain delay in
  // between each change"). Speed is x1, plus speedPerLevel for each upgrade,
  // plus its office's furniture and feng shui (managerOffice). Placeholders.
  secondsPerSlot: 30,
  speedPerLevel: 0.5,
};

/** Letters per typewriter line until a front end sets its own (the terminal sets it to reach the screen's edge). */
export const lineWidth = 60;

/**
 * Word slots, a late upgrade bought with Lines once you own unlockLetters
 * letters. Each slot locks one position in a chain (1st word, 2nd word, ...)
 * to a word you choose; it can be switched off to type fully at random.
 * Each department has its own slots, up to maxSlots (the longest play line
 * has 14 words, so every line can be slotted); a department's n-th slot
 * costs baseCost x costGrowth^(n-1) Lines, rounded up. Prices stay below the
 * Lines that the lines a department can slot pay (2026-10-14 balance pass):
 * doubling prices left the slot ladder waiting on lines too long to write.
 */
export const wordSlots = {
  unlockLetters: 13,
  baseCost: 1,
  costGrowth: 1.5, // 1, 2, 3, 4, 6, 8, 12, 18, 26, 39, 58, 87, 130, 195
  maxSlots: 14,
};

/** How many play lines can be pinned to the home screen. */
export const maxPinnedLines = 5;

/** Longest name a player can give a monkey. */
export const maxMonkeyNameLength = 12;

/**
 * Names new monkeys get on their own (Justin, 2026-10-14: "automatically name
 * all the monkeys random names... famous monkeys or monkey inspired names").
 * Each fits maxMonkeyNameLength; players can still rename any monkey.
 */
export const monkeyNames = [
  'Wukong', 'George', 'King Kong', 'Donkey Kong', 'Diddy Kong', 'Dixie Kong', 'Cranky Kong', 'Funky Kong', 'Tiny Kong',
  'Caesar', 'Cornelius', 'Zira', 'Koba', 'Maurice', 'Rafiki', 'Abu', 'Marcel', 'Bubbles', 'Clyde', 'Cheeta',
  'Mojo Jojo', 'Hanuman', 'Koko', 'Kanzi', 'Harambe', 'Ham', 'Enos', 'Able', 'Baker', 'Albert',
  'Nim Chimpsky', 'Bonzo', 'Magilla', 'Grape Ape', 'Mighty Joe', 'Momo', 'Jack', 'Kiki', 'Darwin', 'Judy',
  'Boots', 'Spike', 'Pippi', 'Bobo', 'Lancelot', 'Tarzan', 'Kong', 'Chim-Chim', 'Iago', 'Mr Teeny',
];

/**
 * Parody names (Justin, 2026-10-15: "king kong could be bing bong... sometimes
 * it can be the real name sometimes... a semi-rhyming or sorta similar
 * sounding parody"): a new monkey gets a parody of one of monkeyNames with
 * this chance, and always once every real name is taken. A parody swaps the
 * sounds before the first vowel of every word for one of `onsets` (Kong ->
 * Bong, Abu -> Babu); words with no vowel, like Mr, stay.
 */
export const parodyNames = {
  chance: 0.3,
  onsets: ['B', 'D', 'F', 'G', 'H', 'J', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'Z', 'Bl', 'Br', 'Ch', 'Fl', 'Gr', 'Sh', 'Sn', 'Sp', 'Wh'],
};

/**
 * How a typist's energy shows on the home screen: green above `green` percent,
 * yellow above `yellow`, red at or below it, and Resting (blue) on a break.
 */
export const energyColors = { green: 80, yellow: 20 };

// Offline progress is capped so a long absence doesn't break balance.
export const maxOfflineSeconds = 8 * 60 * 60;

// Offline time is simulated letter by letter up to this many letters; beyond
// that, the rest is estimated from the simulated part so loading stays quick.
export const maxOfflineLetters = 200_000;

/**
 * At most this many letters a second are simulated one by one while playing,
 * shared across all monkeys. Faster typing than that is credited by scaling
 * up the points and words of the letters that were simulated (as offline
 * progress does), so huge speeds don't slow the game down.
 */
export const maxSimulatedLettersPerSecond = 4000;
