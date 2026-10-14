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

/**
 * Monkeys start slow; each "Faster typing" level multiplies their speed.
 * Level n costs upgradeBaseCost x upgradeCostGrowth^n.
 */
/** The n-th letter you buy (after your free first one) costs baseCost x costGrowth^(n-1). */
export const letterShop = {
  baseCost: 25,
  costGrowth: 3,
  // Each letter also costs Words: floor(wordsCostFactor x owned^wordsCostPower), so 0, 1, 2, 4, 6, 9, ...
  // Kept gentle early: a poor second or third letter (Q, J) adds few new words, and must not lock you out.
  wordsCostFactor: 0.25,
  wordsCostPower: 2,
};

/**
 * You start with one monkey. More monkeys are paid in Points. Each
 * department has its own price: the n-th monkey bought for the d-th
 * department opened (both from 0) costs
 * baseCost x departmentGrowth^d x costGrowth^n, so every department takes
 * days to fill however many monkeys came before it.
 */
export const monkeyShop = {
  baseCost: 300_000, // scripts/simulate.ts: 2nd monkey after about 2.5h, a full department (10) after about 3 days
  costGrowth: 6,
  departmentGrowth: 100,
};

/**
 * Combos: only words at least minWordLength long raise the multiplier, and it
 * stops at maxMultiplier plus one per cap raise. The n-th cap raise costs
 * capRaiseBaseCost x capRaiseCostGrowth^n Sentences.
 */
export const combo = {
  minWordLength: 4,
  maxMultiplier: 3,
  capRaiseBaseCost: 1,
  capRaiseCostGrowth: 2,
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
 * The script shop, in points. You start with one free scene and buy the
 * rest: a scene costs pointsPerLetter for each letter in its lines; an act
 * or a whole play costs its unowned scenes' total times its discount.
 * starterScenes is how many short scenes of your first department's genre
 * are offered for free at the start.
 */
export const scriptShop = {
  pointsPerLetter: 10,
  actDiscount: 0.8,
  playDiscount: 0.6,
  starterScenes: 3,
};

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
 * squareBaseCost x squareCostGrowth^n. Everything places itself; the office
 * map is there for players who want to design the layout. Costs are placeholders.
 */
export const office = {
  starterWidth: 2,
  starterHeight: 2,
  newRoomWidth: 3,
  newRoomHeight: 3,
  roomBaseCost: 10_000,
  roomCostGrowth: 10,
  squareBaseCost: 500,
  squareCostGrowth: 1.15,
  mapWidth: 18, // squares across the office map before new rooms go below instead
};

/**
 * Furniture, bought with points in the Office and Breakroom stores. Each piece fills one
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
}

/** The kinds of room: a department's room (its monkeys' desks), a break room, or a department's manager's office. */
export type RoomKind = 'department' | 'break' | 'office' | 'lab' | 'hr';

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

export const furnitureKinds: FurnitureKind[] = [
  // Decor: a department's monkeys tire slower (with it in their room or their lounge). Pieces at the same price do as much. `rooms` says where each may stand.
  { id: 'plant', name: 'Potted plant', glyph: 'P', color: 'green', cost: 500, costGrowth: 1.5, drain: 0.03, rest: 0, happiness: 0.01, element: 'wood', rooms: ['department', 'break'], description: 'A leafy friend in a clay pot. Wood, they say, feeds the fire of a busy mind.' },
  { id: 'candle', name: 'Scented candle', glyph: 'I', color: 'red', cost: 500, costGrowth: 1.5, drain: 0.03, rest: 0, happiness: 0.01, element: 'fire', rooms: ['department', 'break'], description: 'It smells faintly of bananas. A small flame, but Fire all the same.' },
  { id: 'clock', name: 'Wall clock', glyph: 'K', color: 'yellow', cost: 500, costGrowth: 1.5, drain: 0.03, rest: 0, happiness: 0.01, element: 'metal', rooms: ['department'], description: 'Tick, tock, type. A brass clock keeps the hours, and Metal keeps the mind sharp.' },
  { id: 'lamp', name: 'Floor lamp', glyph: 'L', color: 'yellow', cost: 2_000, costGrowth: 1.5, drain: 0.04, rest: 0, happiness: 0.01, element: 'metal', rooms: ['department', 'break'], description: 'A brass floor lamp: cold Metal, warm light.' },
  { id: 'fishtank', name: 'Fish tank', glyph: 'F', color: 'cyan', cost: 2_000, costGrowth: 1.5, drain: 0.04, rest: 0, happiness: 0.01, element: 'water', rooms: ['department', 'break'], description: 'Three goldfish, unimpressed by the typing. Moving Water calms the mind.' },
  { id: 'bonsai', name: 'Bonsai tree', glyph: 'Y', color: 'green', cost: 2_000, costGrowth: 1.5, drain: 0.04, rest: 0, happiness: 0.01, element: 'wood', rooms: ['department', 'break'], description: 'A very old, very small tree. Patient Wood, the opposite of a monkey.' },
  { id: 'sandgarden', name: 'Sand garden', glyph: 'Z', color: 'yellow', cost: 2_000, costGrowth: 1.5, drain: 0.04, rest: 0, happiness: 0.01, element: 'earth', rooms: ['department', 'break'], description: 'Raked sand and three smooth stones. Calm, quiet Earth.' },
  { id: 'bookshelf', name: 'Bookshelf', glyph: 'B', color: 'brown', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'wood', rooms: ['department'], description: 'Rows of dusty old books. One of them sticks out a little further than the rest.' },
  { id: 'painting', name: 'Landscape painting', glyph: 'G', color: 'green', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'earth', rooms: ['department', 'break'], description: 'Rolling hills under a wide sky. Pictures of the land bring Earth indoors.' },
  { id: 'mirror', name: 'Mirror', glyph: 'M', color: 'gray', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'metal', rooms: ['department', 'break'], description: 'A silver-framed mirror. The monkeys make faces at it. Polished Metal sends chi back into the room.' },
  { id: 'gong', name: 'Brass gong', glyph: 'O', color: 'yellow', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'metal', rooms: ['department'], description: 'Strictly for emergencies. And lunch. A deep note of Metal.' },
  { id: 'fountain', name: 'Indoor fountain', glyph: 'Q', color: 'blue', cost: 20_000, costGrowth: 1.5, drain: 0.06, rest: 0, happiness: 0.02, element: 'water', rooms: ['department', 'break'], description: 'Water trickles over smooth stones. Flowing Water carries good fortune in.' },
  // Comforts: in a break room, every monkey's breaks go faster. Seats like a wall behind them.
  { id: 'bench', name: 'Bench', glyph: 'H', color: 'brown', cost: 10_000, costGrowth: 1.5, drain: 0, rest: 0.08, happiness: 0.01, size: [2, 1], element: 'earth', rooms: ['break'], seat: true, description: 'A sturdy bench, solid as the Earth. It likes a wall at its back.' },
  { id: 'armchair', name: 'Armchair', glyph: 'A', color: 'brown', cost: 10_000, costGrowth: 1.5, drain: 0, rest: 0.08, happiness: 0.01, element: 'wood', rooms: ['department', 'break'], seat: true, description: 'Carved wood, worn smooth by many naps. Best with a wall at its back.' },
  { id: 'beanbag', name: 'Beanbag', glyph: 'N', color: 'magenta', cost: 10_000, costGrowth: 1.5, drain: 0, rest: 0.08, happiness: 0.01, element: 'earth', rooms: ['break'], seat: true, description: 'Shapeless, squashy and close to the Earth. Best against a wall.' },
  { id: 'cooler', name: 'Water cooler', glyph: 'W', color: 'cyan', cost: 50_000, costGrowth: 2, drain: 0, rest: 0.15, happiness: 0.01, element: 'water', rooms: ['department', 'break'], description: "Glug. The office's only source of Water, and of gossip." },
  { id: 'espresso', name: 'Espresso machine', glyph: 'E', color: 'gray', cost: 50_000, costGrowth: 2, drain: 0, rest: 0.15, happiness: 0.01, element: 'metal', rooms: ['break'], description: 'Chrome, hissing, and far too strong. Monkeys love it.' },
  { id: 'vending', name: 'Vending machine', glyph: 'V', color: 'red', cost: 50_000, costGrowth: 2, drain: 0, rest: 0.15, happiness: 0.01, element: 'metal', rooms: ['break'], description: 'Sells only bananas. A steel box of Metal, humming.' },
  { id: 'couch', name: 'Couch', glyph: 'C', color: 'blue', cost: 200_000, costGrowth: 2, drain: 0, rest: 0.25, happiness: 0.02, size: [2, 1], element: 'earth', rooms: ['break'], seat: true, description: 'Deep, soft and low to the Earth. Monkeys nap best with a wall behind it.' },
  { id: 'fireplace', name: 'Fireplace', glyph: 'R', color: 'red', cost: 200_000, costGrowth: 2, drain: 0, rest: 0.25, happiness: 0.02, element: 'fire', rooms: ['break'], description: 'Crackling logs. The real thing: warm, bright Fire.' },
  { id: 'hammock', name: 'Hammock', glyph: 'J', color: 'brown', cost: 200_000, costGrowth: 2, drain: 0, rest: 0.25, happiness: 0.02, size: [2, 1], element: 'wood', rooms: ['break'], seat: true, description: 'Strung between two wooden posts. Swaying Wood, and the best naps.' },
  { id: 'tv', name: 'Television', glyph: 'T', color: 'gray', cost: 1_000_000, costGrowth: 2, drain: 0, rest: 0.4, happiness: 0.03, element: 'fire', rooms: ['break'], description: 'It only shows nature documentaries about monkeys. Electronics burn with Fire.' },
  { id: 'hottub', name: 'Hot tub', glyph: 'U', color: 'cyan', cost: 1_000_000, costGrowth: 2, drain: 0, rest: 0.4, happiness: 0.03, size: [2, 1], element: 'water', rooms: ['break'], description: 'Nobody remembers approving this. Nobody is complaining.' },
  managerDesk,
];

/**
 * Feng shui: each room has five rules (see logic's roomChi), and its chi is
 * the share it keeps. The office's chi (the average over rooms you can reach)
 * adds up to maxHappiness to happiness once you find the feng shui book,
 * hidden in a bookshelf (inspect one on the office map), which also shows the
 * rules and each room's chi. Fire is the rarest element (the candle and the
 * TV). Placeholders.
 */
export const fengShui = {
  maxHappiness: 0.1,
  hiddenIn: 'bookshelf', // the furniture kind the book is found in
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
  { id: 'couchpotato', name: 'Couch potato', rest: [0.3, 0], text: 'Breaks 30% faster with a couch in its lounge.' },
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
    { id: 'snacks', name: 'Banana snacks', text: 'Breaks 20% faster.', hours: 3, cost: 1_000_000, rest: 0.2 },
    { id: 'spelling', name: 'Spelling theory', text: '+10% bananas.', hours: 8, cost: 10_000_000, points: 0.1 },
    { id: 'ribbons', name: 'Carbon ribbons', text: 'Monkeys type 10% faster.', hours: 16, cost: 100_000_000, speed: 0.1 },
    { id: 'floorplans', name: 'Open floor plans', text: 'Room squares cost 25% less.', hours: 24, cost: 1_000_000_000, squares: 0.25 },
    { id: 'rhythm', name: 'Typing rhythm', text: 'Combo cap +1.', hours: 48, cost: 10_000_000_000, combo: 1 },
    { id: 'tenfinger', name: 'Ten-finger typing', text: 'Monkeys type 20% faster.', hours: 72, cost: 1e11, speed: 0.2 },
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
    { id: 'research', name: 'Research' },
  ],
  feelings: [
    { id: 'loves', name: 'loves', bonus: 0.2, weight: 0.1 },
    { id: 'good', name: 'good', bonus: 0.1, weight: 0.25 },
    { id: 'fine', name: 'fine', bonus: 0, weight: 0.4 },
    { id: 'unsuited', name: 'unsuited', bonus: -0.1, weight: 0.2 },
    { id: 'detests', name: 'detests', bonus: -0.4, weight: 0.05 },
  ],
};

/** The coin flip (Justin, 2026-10-14: "have it start out as 1% win 99% lose"): the chance heads comes up. */
export const coinFlip = { winChance: 0.01 };

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
export const folio = {
  bonusPerPage: 0.001, // +0.1% points a page: a finished Midsummer (2,160 lines, counted twice) is about +432%
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
  { id: 'first-name', name: "What's in a name?", text: 'Name a monkey', stat: 'named', at: 1 },
  { id: 'first-manager', name: 'Middle management', text: 'Hire a manager', stat: 'managers', at: 1 },
  { id: 'first-researcher', name: 'Lab coats', text: 'Hire a researcher', stat: 'researchers', at: 1 },
  { id: 'first-hr', name: 'Human resources', text: 'Hire an HR monkey', stat: 'hrStaff', at: 1 },
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
  { id: 'full-department', name: 'Full house', text: 'Fill a department with 10 monkeys', stat: 'biggestDepartment', at: 10 },
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
}

/** A monkey's face in its icon; a hat goes on its left. All icons are ASCII. */
export const monkeyIcon = '@';

export const hats: Hat[] = [
  { id: 'baseball', name: 'Baseball cap', icon: 'd', cost: 25, costGrowth: 1.5, drain: 0.1, description: 'Worn backwards, naturally.' },
  { id: 'beanie', name: 'Beanie', icon: 'n', cost: 25, costGrowth: 1.5, rest: 0.2, description: 'Warm ears, calm mind.' },
  { id: 'party', name: 'Party hat', icon: 'A', cost: 25, costGrowth: 1.5, speed: 0.05, description: "It is always someone's birthday somewhere." },
  { id: 'tophat', name: 'Top hat', icon: '#', cost: 500, costGrowth: 1.5, points: 0.15, description: 'Very distinguished. Possibly borrowed from a magician.' },
  { id: 'cowboy', name: 'Cowboy hat', icon: '~', cost: 500, costGrowth: 1.5, drain: 0.25, description: 'Yeehaw, but quietly: this is an office.' },
  { id: 'cap', name: 'Thinking cap', icon: '^', cost: 5_000, costGrowth: 2, combo: 1, description: 'It whirs faintly while its wearer thinks.' },
  { id: 'crown', name: 'Crown', icon: 'W', cost: 1_000_000, costGrowth: 3, points: 0.25, speed: 0.25, description: 'Heavy is the head that wears it. Heavier is the price.' },
  { id: 'halo', name: 'Halo', icon: 'o', cost: 1_000_000_000, costGrowth: 10, points: 0.5, speed: 0.5, drain: 0.5, description: 'Nobody knows where it came from. It hums.' },
];

/**
 * Dyes for hats: any monkey's hat can be dyed one of these colours (ANSI
 * codes, so any terminal shows them), for dyeCost Sentences. Just for looks.
 */
export const hatColors = [
  { id: 'red', name: 'Red', ansi: 31 },
  { id: 'green', name: 'Green', ansi: 32 },
  { id: 'yellow', name: 'Yellow', ansi: 33 },
  { id: 'blue', name: 'Blue', ansi: 34 },
  { id: 'magenta', name: 'Magenta', ansi: 35 },
  { id: 'cyan', name: 'Cyan', ansi: 36 },
];
export const dyeCost = 10;

export const departmentRules = {
  monkeysToOpen: [0, 10, 20, 30],
  maxTypists: 10, // typing monkeys per department, plus one manager
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
 * upgraded with Lines.
 */
export const managers = {
  minDepartmentMonkeys: 5,
  // Each upgrade adds bonusPerLevel to the points of every monkey in the
  // manager's department (x1.1, x1.2, ...). Upgrades are deliberately very
  // expensive, since one upgrades the whole department: the n-th costs
  // linesPerMonkey Lines per monkey in the department x upgradeCostGrowth^(n-1).
  bonusPerLevel: 0.1,
  linesPerMonkey: 50,
  upgradeCostGrowth: 2,
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
