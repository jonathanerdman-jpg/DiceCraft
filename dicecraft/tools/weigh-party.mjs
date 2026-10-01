// What a company is worth, measured by playing.
//
// Three things changed at once — the hired swords can be kitted, the creatures
// out of the lairs got a standing bonus instead, and the rooms are supposed to
// notice — and none of them can be judged on their own. This plays whole
// floors with a real party and reports how many rooms they clear:
//
//   bare     nobody carrying anything
//   kit      the character kitted at the grade their level allows
//   company  the character and both companions kitted
//
//   node tools/weigh-party.mjs [floors-per-case]
//
// The number to watch is `company` against `bare`: gear is supposed to be
// worth having, and the floors are supposed to take most of it back, so the
// gap is meant to be small and positive rather than nothing or a landslide.
import { Encounter, generateChallenge, resetChallenge } from '../js/engine.js';
import { createHero, heroAbility, heroDice } from '../js/hero.js';
import { createRng } from '../js/rng.js';
import { DEPTHS, SETTINGS } from '../js/settings.js';
import { WILD } from '../js/dice.js';
import { biteFor, companionDice, createCompanion } from '../js/game.js';
import { KINDS, gearPower, kindsForSkills, kindsFor, makePiece, tierFor } from '../js/gear.js';
import { COMPANIONS, WILD_COMPANIONS } from '../js/data.js';

const FLOORS = Number(process.argv[2] || 400);
const LEVELS = DEPTHS.map((d) => d.minLevel);
const ROOMS_PER_FLOOR = 6;
const POOLS = Object.values(SETTINGS).map((s) => s.pool);

// Kit a bearer out at the best grade their standing allows, one piece per slot.
function kitOut(who, level) {
  const tier = tierFor(level);
  const may = who.classId ? kindsFor(who.classId) : kindsForSkills(who.proficiencies);
  const rack = {};
  ['head', 'chest', 'legs', 'feet', 'hand', 'off'].forEach((slot) => {
    const kind = may.find((id) => KINDS[id].slot === slot);
    rack[slot] = kind ? makePiece(kind, tier) : null;
  });
  who.gear = rack;
  return who;
}

function party(level, { heroKit, mateKit }) {
  const hero = createHero('T', 'fighter');
  hero.level = level;
  hero.gear = null;
  if (heroKit) kitOut(hero, level);
  const rank = Math.max(1, Math.min(30, level * 2));
  const hired = createCompanion(COMPANIONS[0].id);
  hired.rank = rank;
  hired.gear = null;
  if (mateKit) kitOut(hired, level);
  const beast = createCompanion(WILD_COMPANIONS[0].id);
  beast.rank = rank;
  return { hero, hired, beast };
}

function playRoom({ challenge, dice, rng, ability, left }) {
  const abilities = ability && left > 0 ? [{ ...ability, left }] : [];
  const e = new Encounter({ challenge, dice, rng, abilities });
  let guard = 0;
  while (e.status === 'active' && guard++ < 400) {
    const acts = e.legalActions();
    const matches = e.availableMatches();
    const id = ability ? ability.id : null;
    const can = (which) => id === which && e.canUse(which);
    const wanted = () => [...new Set(e.trial.required.filter((_, i) => !e.trial.matched[i]))];
    if (can('brace') && !e.braced) { e.useAbility('brace'); continue; }
    if (matches.length) {
      const cheap = matches.reduce((least, m) => (
        !least || e.tray[m.dieIndex].die.sides < e.tray[least.dieIndex].die.sides ? m : least), null);
      e.match(cheap.dieIndex, cheap.slotIndex);
      continue;
    }
    if (can('transmute') && e.tray.length) { e.useAbility('transmute', { dieIndex: 0, symbol: wanted()[0] }); continue; }
    if (can('blessing') && e.spentDice.length) { e.useAbility('blessing'); continue; }
    if (can('readGround') && e.tray.length) { e.useAbility('readGround'); continue; }
    if (can('secondWind') && e.tray.length) { e.useAbility('secondWind', { dieIndex: 0 }); continue; }
    if (acts.canDiscard) { e.discard(0); continue; }
    if (acts.canReroll) { e.reroll(); continue; }
    break;
  }
  const spent = ability && e.ability(ability.id) ? left - e.ability(ability.id).left : 0;
  return { won: e.status === 'won', left: left - spent };
}

function playFloor({ hero, hired, beast }, { seed, depth, pool, bite = null }) {
  const rng = createRng(seed);
  const ability = heroAbility(hero);
  let left = ability.charges;
  if (bite === null) bite = biteFor([hero, hired, beast]);
  let cleared = 0;
  for (let i = 0; i < ROOMS_PER_FLOOR + 1; i++) {
    const boss = i === ROOMS_PER_FLOOR;
    const challenge = generateChallenge({
      spec: boss ? { trials: depth.boss.trials, symbols: depth.boss.symbols } : depth,
      extra: bite,
      pool,
      rng,
      name: boss ? 'the boss' : `room ${i + 1}`,
      boss,
    });
    resetChallenge(challenge);
    // Two in the room, as the game plays it: the character and one of the two.
    const mate = i % 2 ? hired : beast;
    const hand = [...heroDice(hero), ...companionDice(mate)];
    const out = playRoom({ challenge, dice: hand, rng, ability, left });
    left = out.left;
    if (!out.won) break;
    cleared += 1;
  }
  return cleared;
}

const CASES = [
  ['bare', { heroKit: false, mateKit: false }],
  ['kit', { heroKit: true, mateKit: false }],
  ['company', { heroKit: true, mateKit: true }],
];

const run = (who, depth, bite) => {
  let total = 0;
  for (let i = 0; i < FLOORS; i++) {
    total += playFloor(who, { seed: 9000 + i, depth, pool: POOLS[i % POOLS.length], bite });
  }
  return total / FLOORS;
};

console.log(`floors per case: ${FLOORS}, ${ROOMS_PER_FLOOR} rooms and a boss each`);
for (const level of LEVELS) {
  const depth = [...DEPTHS].reverse().find((d) => level >= d.minLevel) || DEPTHS[0];
  const bare = party(level, { heroKit: false, mateKit: false });
  const kit = party(level, { heroKit: true, mateKit: false });
  const all = party(level, { heroKit: true, mateKit: true });
  const base = run(bare, depth, 0);
  console.log(`\nlevel ${level} (${depth.name})  bare ${base.toFixed(2)} rooms`);
  const power = (who) => biteFor([who.hero, who.hired, who.beast]);
  console.log(`  as shipped: kit (bite ${power(kit)}) ${run(kit, depth, null).toFixed(2)}`
    + `   company (bite ${power(all)}) ${run(all, depth, null).toFixed(2)}`);
  // And the two kinds of companion against each other, in the same rooms: a
  // creature has no hands for a rack, so its standing bonus has to be worth
  // about what a kitted hired sword's rack is.
  const only = (who, which) => ({ hero: who.hero, hired: which === 'hired' ? who.hired : who.beast,
    beast: which === 'hired' ? who.hired : who.beast });
  console.log(`  mates: kitted sword ${run(only(all, 'hired'), depth, power(all)).toFixed(2)}`
    + `   creature ${run(only(all, 'beast'), depth, power(all)).toFixed(2)}`);
}
