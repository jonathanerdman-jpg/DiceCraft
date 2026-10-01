// The Iron Tower: one dungeon that never runs out of floors.
//
// Everywhere else on the Strand a dungeon has a bottom. You walk a floor, take
// the boss, climb out with what you are carrying, and the country offers you
// the next posting. The Tower has no top. Its floors are ordinary floors — the
// same carved map, the same rooms and hoards and lairs, the same boss at the
// far end — and beating one puts you on a landing with the stair up still open
// and one question on it: go home with this floor's takings, or leave them
// where they are and climb for a bigger one.
//
// That is the whole design. **Only one floor's takings ever leave the Tower.**
// Climbing on does not add the next floor's gold to the last floor's — it
// empties your hands and plays for more — and being beaten empties them
// anyway. So every floor is a fresh decision with everything already won
// riding on it, which is what the dungeons outside are only half of: out there
// you press your luck a room at a time, and in here a floor at a time.
//
// Nothing in here wears kit out. The Clocktower is dry brass and turning gears
// rather than a cave, and it is paid for at the door, in stamina, and in
// whatever you were about to carry home.

export const TOWER = {
  id: 'tower',
  name: 'The Clocktower',
  blurb: 'A clockwork tower with no top. Every floor you clear is a floor you can go home from — or leave behind.',
};

// What the door costs. A climb is one expedition's worth of effort however far
// it gets, so it is charged once, at the foot of the tower, and the floors
// after it are free of everything but the risk.
export const TOWER_STAMINA = 4;

// --- How hard the nth floor is ----------------------------------------------
//
// The first floor is The Shallows and the sixth is about The Last Floor, which
// is the whole of the ordinary ladder; past that the Tower keeps going on the
// same slope. Everything below extrapolates the DEPTHS table in js/settings.js
// rather than inventing a second set of numbers, so a Tower floor is a floor
// somebody would recognize.

// Trials stop at four, because a room with ten of them is not harder to beat,
// only longer to play. Past that the trials themselves grow, without limit,
// which is what eventually ends every climb.
export const MAX_TRIALS = 4;

// Symbols asked of a whole room: 2.5 on the first floor, and then a steady
// climb. It used to climb 1.6 a floor, on the slope of the six ordinary
// depths — but those are walked by a company that levels up between them, and
// a climb is walked by the same hands all the way up. At that slope each floor
// asked a quarter more than the last of dice that had not grown, and a climb
// that was winning floor three was being handed floor four as a foregone loss.
export const TOWER_SLOPE = 0.65;

export function towerDemand(level) {
  return 2.5 + TOWER_SLOPE * (level - 1);
}

// The boss asks about a third more than a room on its own floor, which is
// where the ordinary ladder puts its lords too. It used to be the top of the
// floor's trial range with every trial a symbol bigger, and that is not a
// ratio: it was 1.4 times a room on some floors and 1.7 on the next, which is
// exactly where the cliffs were.
export const BOSS_RATIO = 1.25;

// The ladder a floor's rooms are dressed from, easiest first: more trials
// before bigger ones, the way the ordinary depths grow — one trial, one or
// two, two, two or three, up to four — and only once there are four do the
// trials themselves start to swell, half a symbol at a time. Every rung asks a
// little more than the one below it and none asks a lot more, which is what a
// climb needs.
function ladder(minSymbols) {
  const rungs = [];
  for (let t = 1; t <= MAX_TRIALS; t++) {
    [[t, t], [t, t + 1]].forEach((trials) => {
      if (trials[1] > MAX_TRIALS) return;
      rungs.push({ trials, symbols: [minSymbols, minSymbols + 1] });
    });
  }
  return rungs.map((r) => ({ ...r, asks: ((r.trials[0] + r.trials[1]) / 2) * ((r.symbols[0] + r.symbols[1]) / 2) }));
}

// Past four trials the ladder has no top, so its upper rungs are worked out
// rather than listed: four trials, each half a symbol bigger than the last
// rung's, as far up as the target goes.
function topRung(target, minHalves) {
  const half = Math.max(minHalves, Math.round((2 * target) / MAX_TRIALS));
  const symbols = [Math.floor(half / 2), Math.ceil(half / 2)];
  return { trials: [MAX_TRIALS, MAX_TRIALS], symbols, asks: MAX_TRIALS * (half / 2) };
}
const ROOM_LADDER = ladder(2);
// A boss has a set number of trials. A range there is a coin toss between a
// fight and a foregone loss: at the fifth floor one boss in two asked for
// twelve symbols of a pair holding ten, and was lost before a die was thrown.
// So its trials are a count, and between one count and the next the trials
// grow half a symbol at a time instead.
function bossLadder(minSymbols) {
  const rungs = [];
  for (let t = 1; t < MAX_TRIALS; t++) {
    const next = (t + 1) * (minSymbols + 0.5);
    for (let sym = minSymbols; t * sym < next; sym++) {
      [[sym, sym + 1], [sym + 1, sym + 1]].forEach((symbols) => {
        const asks = t * ((symbols[0] + symbols[1]) / 2);
        if (asks < next) rungs.push({ trials: [t, t], symbols, asks });
      });
    }
  }
  // Four trials and up is topRung's.
  return rungs;
}
const BOSS_LADDER = bossLadder(3);

// The rung that asks closest to what the floor should ask. Rounding was where
// the old table went wrong — one floor landed a whole trial over its target
// and the next under it — so the nearest rung is taken, and because the
// targets only climb and the ladder only climbs, so do the floors.
// `minHalves` is the smallest trial the four-trial rungs may ask, counted in
// half symbols: a room's start one above the last listed rung, [2,3]; a
// boss's may be a flat [4,4] so it has a step between three trials and four.
function nearest(target, rungs, minHalves) {
  const all = [...rungs, topRung(target, minHalves)];
  return all.reduce((best, rung) => (Math.abs(rung.asks - target) < Math.abs(best.asks - target) - 1e-9 ? rung : best));
}

// Kept for anything that asked for the trial range on its own.
export function towerTrials(level) {
  return towerSpec(level).trials;
}

// The trials a room of this floor is built from, as a DEPTHS row would say it.
export function towerSpec(level) {
  const { trials, symbols } = nearest(towerDemand(level), ROOM_LADDER, 5);
  return { trials, symbols };
}

// And its boss: a third more than a room, and never trials as small as the
// rooms' own.
export function towerBoss(level) {
  const room = towerSpec(level);
  const floor = room.symbols[0] + 1;
  const rungs = BOSS_LADDER.filter((r) => r.symbols[0] >= floor);
  const { trials, symbols } = nearest(towerDemand(level) * BOSS_RATIO, rungs, 2 * floor);
  return { trials, symbols };
}

// What a room pays. The ordinary ladder runs 12, 16, 22, 30, 40, 52 — about a
// third more each step — and the Tower pays three quarters of that, and very
// nearly stops climbing after the sixth floor.
//
// It has to. A floor's takings are the takings of every room on it with the
// loot multiplier climbing a fifth a room, so a floor pays far more than the
// sum of its rooms: at a quarter of a ladder step per floor, measured, a
// standing-16 company stopping on the fifth floor came out with 2526 gold
// against the 728 a posting at The Last Floor pays. One floor's takings are
// meant to be one posting's. What the higher floors pay better in is kit,
// which is graded by the floor, and that is reason enough to climb.
export const TOWER_SHARE = 0.55;

export function towerGold(level) {
  const ladder = 12 * 1.34 ** (Math.min(level, 6) - 1);
  return Math.max(6, Math.round(ladder * TOWER_SHARE * (1 + 0.06 * Math.max(0, level - 6))));
}

// The grade of kit the floor leaves lying about — by the floor rather than by
// the climber, which is the Tower's own draw. It is behind a veteran and ahead
// of a novice, and it is the only thing in the game that hands out kit for
// getting somewhere rather than for being somebody.
export function towerGrade(level) {
  return Math.max(1, Math.min(5, Math.ceil(level / 3)));
}

// How big a floor is: twelve cells at the bottom, never more than 7x5.
const SIZES = [[4, 3], [4, 3], [5, 3], [4, 4], [5, 4], [5, 4], [6, 4], [6, 4], [6, 5], [6, 5], [7, 5]];
export function towerSize(level) {
  return SIZES[Math.min(SIZES.length, Math.max(1, level)) - 1].slice();
}

// A whole DEPTHS row, built for the floor rather than looked up. Everything
// that reads a depth — the map carver, the lair roll, what a room pays, what
// it teaches — takes this and cannot tell the difference.
export function towerDepth(level) {
  const spec = towerSpec(level);
  return {
    depth: level,
    name: `${TOWER.name}, ${ordinal(level)} floor`,
    stamina: TOWER_STAMINA,
    minLevel: 1,
    unlockLevel: 1,
    // The same sizes the ordinary ladder uses, [4,3] up to [7,5], and then no
    // bigger. Past that a map is more walking rather than more dungeon, the
    // phone cannot draw it, and — the reason it matters — a bigger floor pays
    // superlinearly, because the loot multiplier climbs with every room
    // cleared on it. Floors that grew to [8,6] by the fifth were paying
    // several postings each.
    //
    // And it grows a little every other floor rather than in lurches: the old
    // formula put five more rooms on the fourth floor and eleven on the
    // seventh, and every room is another chance to lose somebody.
    size: towerSize(level),
    settings: level <= 3 ? 2 : 3,
    trials: spec.trials,
    symbols: spec.symbols,
    // The rooms nearest the way in ask what the floor below asked (see
    // js/map.js), so a floor's first fights are a warning, not the blow.
    warmup: level > 1 ? towerSpec(level - 1) : null,
    // A boss is the room at the far end asking a third more, in bigger trials.
    boss: towerBoss(level),
    // The Tower issues no seals. They are what the countries give for clearing
    // a floor that had a bottom, and they buy things that are meant to be
    // earned out there rather than farmed in here.
    seal: null,
    gold: towerGold(level),
  };
}

// The floors are counted the way the floors of a building are.
const SUFFIX = ['th', 'st', 'nd', 'rd'];
export function ordinal(n) {
  const rest = n % 100;
  return `${n}${SUFFIX[(rest - 20) % 10] || SUFFIX[rest] || SUFFIX[0]}`;
}
