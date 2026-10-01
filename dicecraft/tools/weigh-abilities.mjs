// What a class trick is actually worth, measured by playing.
//
// The six were written to feel different, not to be equal, and it showed. This
// settles it the only way an argument like that can be settled: it plays whole
// floors, twice — once with the trick and once without — and reports how many
// more rooms the trick wins.
//
//   node tools/weigh-abilities.mjs [floors-per-case]
//
// Three things make the number honest:
//
//   * the real charge pool, not an unlimited one. A trick is worth what it is
//     worth across a floor, and a pool of two is a different thing from a pool
//     of six however good the effect.
//   * a floor, not a room: six ordinary rooms and a boss, in sequence, on one
//     pool, the way the game is actually played — and two in the room, because
//     nobody takes a deep floor alone.
//   * a policy that uses each trick the way it is meant to be used, including
//     Slip, which is for culling a die when the room will not let you discard,
//     and Brace, which is for the boss tearing dice away.
//
// It is the same careful-but-not-perfect policy for every class, so the
// comparison is fair even though no human plays exactly like it.
import { Encounter, generateChallenge, resetChallenge } from '../js/engine.js';
import { CLASS_LIST, createHero, heroAbility, heroDice } from '../js/hero.js';
import { createRng } from '../js/rng.js';
import { DEPTHS, SETTINGS } from '../js/settings.js';
import { WILD } from '../js/dice.js';
import { companionDice, createCompanion } from '../js/game.js';

const FLOORS = Number(process.argv[2] || 600);
const LEVELS = [1, 8, 16];
const ROOMS_PER_FLOOR = 6;
// Every setting in turn, so no class is measured only against the ground it
// happens to suit: a Ranger judged in a barrow full of Might is not judged.
const POOLS = Object.values(SETTINGS).map((s) => s.pool);

// The cheapest die on the table, by index.
function smallest(e) {
  let at = 0;
  e.tray.forEach((entry, i) => { if (entry.die.sides < e.tray[at].die.sides) at = i; });
  return at;
}

// Which die in the tray is likeliest to answer something the trial still
// wants, counted off its own faces rather than guessed at.
function likeliest(e, wants) {
  const odds = (entry) => entry.die.faces.filter((f) => f === WILD || wants.includes(f)).length / entry.die.sides;
  let at = 0;
  e.tray.forEach((entry, i) => { if (odds(entry) > odds(e.tray[at])) at = i; });
  return at;
}

// One room, played out. Returns whether it was cleared; the charge pool is
// carried in and out so a floor is one night's worth of tricks.
function playRoom(hero, { challenge, dice, rng, ability, left }) {
  const abilities = ability && left > 0 ? [{ ...ability, left, uid: hero.uid }] : [];
  const e = new Encounter({ challenge, dice, rng, abilities });
  let guard = 0;
  let windThisRound = 0;
  while (e.status === 'active' && guard++ < 300) {
    const acts = e.legalActions();
    const matches = e.availableMatches();
    const id = ability ? ability.id : null;
    const can = (which) => id === which && e.canUse(which);
    const wanted = () => [...new Set(e.trial.required.filter((_, i) => !e.trial.matched[i]))];

    // Brace: set your feet before anything is taken, in any room.
    if (can('brace') && !e.braced) { e.useAbility('brace'); continue; }

    if (matches.length) {
      // Slip is the one trick taken with a match already on the table: the slot
      // is answered and the die walks. Held back for a die worth keeping, or
      // for a hand thin enough that one die is the whole margin.
      if (can('slip')) {
        const biggest = matches.reduce((big, m) => (
          !big || e.tray[m.dieIndex].die.sides > e.tray[big.dieIndex].die.sides ? m : big), null);
        if (e.tray[biggest.dieIndex].die.sides >= 8 || e.remaining.length <= 3) {
          e.useAbility('slip');
          continue;
        }
      }
      // Answer with the smallest die that can: a d4 spent on a slot a d12 would
      // also have filled is the cheapest room in the game.
      const cheap = matches.reduce((least, m) => (
        !least || e.tray[m.dieIndex].die.sides < e.tray[least.dieIndex].die.sides ? m : least), null);
      // A match cannot be refused, but it can be undercut. If the only answer
      // is an expensive die, throw a cheap one again and hope it answers too —
      // the trick is worth more here than it is on a dead roll.
      if (can('secondWind') && windThisRound < e.rounds && e.tray[cheap.dieIndex].die.sides >= 8) {
        const matching = new Set(matches.map((m) => m.dieIndex));
        const wants = wanted();
        let at = -1; let bestOdds = 0;
        e.tray.forEach((entry, i) => {
          if (matching.has(i) || entry.die.sides >= e.tray[cheap.dieIndex].die.sides) return;
          const odds = entry.die.faces.filter((f) => f === WILD || wants.includes(f)).length / entry.die.sides;
          if (odds >= bestOdds) { bestOdds = odds; at = i; }
        });
        if (at >= 0) {
          windThisRound = e.rounds;
          e.useAbility('secondWind', { dieIndex: at });
          continue;
        }
      }
      e.match(cheap.dieIndex, cheap.slotIndex);
      continue;
    }

    // Nothing answers. This is where the rest of them earn their keep.
    if (can('transmute') && e.tray.length) {
      // The guaranteed match should be paid for with the cheapest die on the
      // table; the big ones can find their own symbols.
      e.useAbility('transmute', { dieIndex: smallest(e), symbol: wanted()[0] });
      continue;
    }
    if (can('blessing') && e.spentDice.length) { e.useAbility('blessing'); continue; }
    if (can('secondWind') && e.tray.length && windThisRound < e.rounds) {
      // Throw the die with the best chance of answering, not the first one —
      // and only when it has a real chance, and only once against a given
      // throw. Chasing one bad roll with the whole night's pool is how a trick
      // like this gets wasted.
      const at = likeliest(e, wanted());
      const entry = e.tray[at];
      const odds = entry.die.faces.filter((f) => f === WILD || wanted().includes(f)).length / entry.die.sides;
      if (odds > 0) {
        windThisRound = e.rounds;
        e.useAbility('secondWind', { dieIndex: at });
        continue;
      }
    }
    if (can('readGround') && e.tray.length) { e.useAbility('readGround'); continue; }
    if (acts.canDiscard) { e.discard(0); continue; }
    if (acts.canReroll) {
      // Under a boss, every second throw is paid for with a die. Reading the
      // ground is a throw the boss does not get to charge you for.
      const taxed = e.challenge.pressure && (e.rerolls + 1) % 2 === 0 && e.remaining.length > 1;
      if (taxed && can('readGround')) { e.useAbility('readGround'); continue; }
      e.reroll();
      continue;
    }
    break;
  }
  const spent = ability ? (e.ability(ability.id) ? left - e.ability(ability.id).left : 0) : 0;
  return { won: e.status === 'won', left: left - spent, spent };
}

// The other one in the room: a sellsword of about the character's standing, so
// the hand being measured is the hand a floor actually meets.
function mate(level) {
  const companion = createCompanion('sellsword');
  companion.rank = Math.max(1, Math.min(30, level * 2));
  return companion;
}

function playFloor(hero, { useTrick, seed, depth, pool }) {
  const rng = createRng(seed);
  const ability = heroAbility(hero);
  let left = useTrick ? ability.charges : 0;
  let cleared = 0;
  let used = 0;
  for (let i = 0; i < ROOMS_PER_FLOOR + 1; i++) {
    const boss = i === ROOMS_PER_FLOOR;
    const challenge = generateChallenge({
      spec: boss ? { trials: depth.boss.trials, symbols: depth.boss.symbols } : depth,
      pool,
      rng,
      name: boss ? 'the boss' : `room ${i + 1}`,
      boss,
    });
    resetChallenge(challenge);
    const hand = [...heroDice(hero), ...companionDice(mate(hero.level))];
    const out = playRoom(hero, { challenge, dice: hand, rng, ability: useTrick ? ability : null, left });
    left = out.left;
    used += out.spent;
    if (!out.won) break;          // a lost room ends the floor, as it does in play
    cleared += 1;
  }
  return { cleared, used };
}

console.log(`floors per case: ${FLOORS}, ${ROOMS_PER_FLOOR} rooms and a boss each`);
for (const level of LEVELS) {
  const depth = [...DEPTHS].reverse().find((d) => level >= d.minLevel) || DEPTHS[0];
  const rows = CLASS_LIST.map((def) => {
    const hero = createHero('T', def.id);
    hero.level = level;
    hero.gear = null;                // the trick alone, with no kit in the way
    let withIt = 0;
    let without = 0;
    let used = 0;
    for (let i = 0; i < FLOORS; i++) {
      const pool = POOLS[i % POOLS.length];
      const on = playFloor(hero, { useTrick: true, seed: 5000 + i, depth, pool });
      withIt += on.cleared;
      used += on.used;
      without += playFloor(hero, { useTrick: false, seed: 5000 + i, depth, pool }).cleared;
    }
    const ability = heroAbility(hero);
    return {
      cls: def.id,
      trick: ability.name,
      uses: ability.charges,
      without: (without / FLOORS).toFixed(2),
      withIt: (withIt / FLOORS).toFixed(2),
      worth: ((withIt - without) / FLOORS).toFixed(2),
      used: (used / FLOORS).toFixed(2),
    };
  });
  console.log(`\n--- level ${level} (${depth.name}) ---`);
  rows.sort((a, b) => Number(b.worth) - Number(a.worth)).forEach((r) => {
    console.log(`${r.cls.padEnd(8)} ${r.trick.padEnd(16)} uses ${String(r.uses).padStart(2)}  `
      + `rooms without ${r.without.padStart(5)}  with ${r.withIt.padStart(5)}  worth ${r.worth.padStart(6)}  spent ${r.used.padStart(5)}/floor`);
  });
}
