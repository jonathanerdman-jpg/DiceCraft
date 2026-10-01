// Dice construction. Every companion carries a handful of plain basic dice
// plus up to four "power dice" weighted toward what they are good at.
export const SYMBOL_IDS = ['might', 'guard', 'arcana', 'nature', 'cunning', 'faith'];
export const WILD = 'wild';

// Basic dice grow slowly with rank; power dice grow in steps. Together they
// set the ceiling on how many symbols a companion can possibly answer, since
// every match costs a die.
export const BASE_BASIC_DICE = 2;
export const BASIC_EVERY_RANKS = 12;

export function basicDiceForRank(rank) {
  return BASE_BASIC_DICE + Math.floor(rank / BASIC_EVERY_RANKS);
}

// A power die's proficiency face count grows with its size, so a d12 is
// strictly better than a d4 at producing the symbol you want.
const PROFICIENCY_FACES = { 4: 2, 6: 4, 8: 5, 10: 7, 12: 9 };
const WILD_FACES = { 4: 0, 6: 0, 8: 1, 10: 1, 12: 1 };

export function basicDieFaces() {
  return SYMBOL_IDS.slice();
}

export function powerDieFaces(sides, proficiency) {
  const profCount = PROFICIENCY_FACES[sides];
  if (profCount === undefined) throw new Error(`unsupported die size d${sides}`);
  const faces = [];
  for (let i = 0; i < profCount; i++) faces.push(proficiency);
  for (let i = 0; i < WILD_FACES[sides]; i++) faces.push(WILD);
  const others = SYMBOL_IDS.filter((s) => s !== proficiency);
  let k = 0;
  while (faces.length < sides) faces.push(others[k++ % others.length]);
  return faces;
}

let dieCounter = 0;

export function makeBasicDie(ownerId, { wild = false } = {}) {
  const faces = basicDieFaces();
  // A "wild" plain die trades one ordinary face for a face that answers
  // anything. Talents and a few trinkets hand these out.
  if (wild) faces[faces.length - 1] = WILD;
  return {
    id: `d${++dieCounter}`,
    ownerId,
    kind: 'basic',
    wild,
    sides: 6,
    proficiency: null,
    faces,
  };
}

// One more face that answers anything, cut into a die that already exists.
// Gear does this: a helm or a pair of boots does not hand you another die, it
// changes one you are already holding. The face given up is never the die's
// own symbol — a sword's die stays a sword's die — and a die that is already
// all wild is left alone.
export function addWildFace(die) {
  const at = die.faces.findIndex((face) => face !== WILD && face !== die.proficiency);
  if (at < 0) return false;
  die.faces[at] = WILD;
  die.wild = true;
  return true;
}

export function makePowerDie(ownerId, sides, proficiency) {
  return {
    id: `d${++dieCounter}`,
    ownerId,
    kind: 'power',
    sides,
    proficiency,
    faces: powerDieFaces(sides, proficiency),
  };
}

export function rollDie(die, rng) {
  return die.faces[rng.int(die.sides)];
}

// Odds that a single die shows one of `wanted` (used for the "best companion
// for the job" hint in the roster UI).
export function dieOdds(die, wanted) {
  const set = new Set(wanted);
  const hits = die.faces.filter((f) => f === WILD || set.has(f)).length;
  return hits / die.sides;
}
