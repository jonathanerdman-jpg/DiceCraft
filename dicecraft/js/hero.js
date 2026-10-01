// The player's own character. Unlike a companion, a hero picks a class, keeps
// a once-per-challenge ability, and chooses a path at level 3 that shapes
// every level after it.
import { SLOT_IDS, boonOf, canCarry, emptyRack, fittedAt, liveSockets, socketCount } from './gear.js';
import { addWildFace, makeBasicDie, makePowerDie } from './dice.js';
import { defaultLook, lookById } from './looks.js';

export const DIE_LADDER = [4, 6, 8, 10, 12];
export const MAX_LEVEL = 20;
export const PATH_LEVEL = 3;
// Half a hand each. A room is attempted by two people now, so one character
// carries about half of what one used to: a pair fields roughly what a hero
// alone fielded before, and the challenge tables did not have to move.
//
// The plain dice are what shrank. A class still starts across three areas,
// because that is what a class *is* — what it no longer has is a fistful of
// ordinary dice to paper over the gaps. That is what the other one is for.
export const BASE_PLAIN_DICE = 1;
export const PLAIN_EVERY_LEVELS = 7;

export function stepUp(sides, steps = 1) {
  const i = DIE_LADDER.indexOf(sides);
  return DIE_LADDER[Math.min(DIE_LADDER.length - 1, (i < 0 ? 0 : i) + steps)];
}

// Abilities are resolved inside the encounter; the hero only owns the charges.
//
// `uses` is how many a night starts with, and it is the whole balance of the
// thing. It was not argued out — tools/weigh-abilities plays whole floors with
// and without each trick, across every setting's symbol pool, and reports what
// it is worth in rooms cleared. Every effect here earns between a fifth and a
// full extra room per floor at each of levels 1, 8 and 16 — and the classes
// whose trick sits at the bottom of that band are the ones whose starting hand
// sits at the top of the other, so the floors come out level even when the
// tricks do not. Transmute is the outlier: it hands you a symbol
// without asking the dice anything at all, so it alone is rationed to two.
export const ABILITIES = {
  secondWind: { id: 'secondWind', name: 'Golden Apple', uses: 3, text: 'Throw one die again where it lies — and again, up to three times, until it answers.', target: 'die' },
  brace:      { id: 'brace',      name: 'Shield Block', uses: 3, text: 'Raise the shield: the next die the room would take — torn away or thrown away — is only put down.', target: 'none' },
  transmute:  { id: 'transmute',  name: 'Reforge',     uses: 2, text: 'Put one die on the anvil and turn it to any symbol the trial still wants.', target: 'die+symbol' },
  readGround: { id: 'readGround', name: 'Spyglass', uses: 3, text: 'Look again: re-roll everything you hold, even before you have spent a die.', target: 'none' },
  slip:       { id: 'slip',       name: 'Ender Pearl', uses: 3, text: 'Answer a slot and keep the die: you are somewhere else before the room can take it.', target: 'none' },
  blessing:   { id: 'blessing',   name: 'Splash Potion', uses: 3, text: 'Call one spent die back into your hand.', target: 'none' },
};

const up = (index, steps = 1) => ({ kind: 'upgrade', index, steps });
const power = (symbol, sides) => ({ kind: 'power', symbol, sides });
const plain = (n = 1) => ({ kind: 'plain', n });
const wild = (n = 1) => ({ kind: 'wild', n });
const charge = (n = 1) => ({ kind: 'charge', n });

export const MAX_POWER_DICE = 4;

// What a class trick costs in the fiction is a night's sleep, not a room. The
// pool is held by the character and spent across the whole floor; only a long
// rest fills it again, which is what makes a short rest a real choice — your
// vigor back, but not your trick. How deep the pool starts is the ability's
// own business (see ABILITIES.uses); everyone gets one more of theirs at each
// of these levels.
export const CHARGE_LEVELS = [8, 16];

export function baseCharges(classId) {
  return ABILITIES[classDef(classId).ability].uses;
}

// Starting hands. Everyone carries dice in three areas and leans into their
// own: the focused classes bring one d8 and two d4s, while the Paladin's
// oath spreads evenly across three d6s and specialises later.
export const CLASSES = {
  fighter: {
    id: 'fighter', name: 'Warrior', symbol: 'might', ability: 'secondWind',
    blurb: 'Diamond sword, iron nerve. Answers most questions the same way.',
    dice: [{ symbol: 'might', sides: 8 }, { symbol: 'guard', sides: 4 }, { symbol: 'cunning', sides: 4 }],
    paths: [
      { id: 'champion', name: 'Berserker', blurb: 'Hit the problem harder.', grants: [
        { level: 3, text: 'The sword-arm learns its weight.', effect: up(0) },
        { level: 7, text: 'Endurance built on long roads.', effect: plain(1) },
        { level: 11, text: 'Nothing in reach survives it.', effect: up(0) },
        { level: 15, text: 'You learn to take a hit as well.', effect: up(1) },
        { level: 19, text: 'A second golden apple, saved for later.', effect: charge(1) },
      ] },
      { id: 'warden', name: 'Shieldbearer', blurb: 'Stand where others cannot.', grants: [
        { level: 3, text: 'You learn to hold a line.', effect: up(1) },
        { level: 7, text: 'A second golden apple, saved for later.', effect: charge(1) },
        { level: 11, text: 'The shield becomes the argument.', effect: up(1) },
        { level: 15, text: 'Improvisation, beaten into instinct.', effect: wild(1) },
        { level: 19, text: 'And the sword has not gone anywhere.', effect: up(0) },
      ] },
    ],
  },
  paladin: {
    id: 'paladin', name: 'Knight', symbol: 'guard', ability: 'brace',
    blurb: 'The top rank on the server, full plate, and a very stubborn sense of where the line is.',
    dice: [{ symbol: 'guard', sides: 8 }, { symbol: 'might', sides: 4 }, { symbol: 'faith', sides: 4 }],
    paths: [
      { id: 'bulwark', name: 'Bulwark', blurb: 'Become the wall.', grants: [
        { level: 3, text: 'The shield stops being a shield.', effect: up(0) },
        { level: 7, text: 'Weight of arms behind it.', effect: up(1) },
        { level: 11, text: 'A door that walks.', effect: up(0) },
        { level: 15, text: 'Lungs for a long fight.', effect: plain(1) },
        { level: 19, text: 'And a hand free to swing.', effect: up(1) },
      ] },
      { id: 'banneret', name: 'Banneret', blurb: 'Lead, and others follow.', grants: [
        { level: 3, text: 'The oath answers too.', effect: up(2) },
        { level: 7, text: 'Presence worth a body in the line.', effect: plain(1) },
        { level: 11, text: 'The shield holds regardless.', effect: up(0) },
        { level: 15, text: 'Your word carries further.', effect: up(2) },
        { level: 19, text: 'A banner others rally to.', effect: wild(2) },
      ] },
    ],
  },
  mage: {
    id: 'mage', name: 'Enchanter', symbol: 'arcana', ability: 'transmute',
    blurb: 'Has stared into more enchanting tables than is good for anyone, and remembers every glyph.',
    dice: [{ symbol: 'arcana', sides: 8 }, { symbol: 'faith', sides: 4 }, { symbol: 'cunning', sides: 4 }],
    paths: [
      { id: 'evoker', name: 'Evoker', blurb: 'Point the theory at the problem.', grants: [
        { level: 3, text: 'The focus sharpens.', effect: up(0) },
        { level: 7, text: 'A working knowledge of where to stand.', effect: up(2) },
        { level: 11, text: 'Theory, applied at volume.', effect: up(0) },
        { level: 15, text: 'A second trip to the anvil.', effect: charge(1) },
        { level: 19, text: 'And the wit to aim it.', effect: up(2) },
      ] },
      { id: 'loremaster', name: 'Loremaster', blurb: 'Know the answer beforehand.', grants: [
        { level: 3, text: 'An enchantment for every occasion.', effect: wild(1) },
        { level: 7, text: 'Older rites, half remembered.', effect: up(1) },
        { level: 11, text: 'A second trip to the anvil.', effect: charge(1) },
        { level: 15, text: 'Another trick kept in reserve.', effect: wild(1) },
        { level: 19, text: 'The focus catches up.', effect: up(0) },
      ] },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Explorer', symbol: 'nature', ability: 'readGround',
    blurb: 'Lives in the Outlands between resets, and is suspicious of roofs.',
    dice: [{ symbol: 'nature', sides: 8 }, { symbol: 'cunning', sides: 4 }, { symbol: 'might', sides: 4 }],
    paths: [
      { id: 'hunter', name: 'Pirate Hunter', blurb: 'Nothing crosses your waters unseen.', grants: [
        { level: 3, text: 'A hunter\u2019s eye for the wrong detail.', effect: up(1) },
        { level: 7, text: 'The Outlands tell you more each reset.', effect: up(0) },
        { level: 11, text: 'You see it before it moves.', effect: up(1) },
        { level: 15, text: 'A second look through the spyglass.', effect: charge(1) },
        { level: 19, text: 'The country is simply yours now.', effect: up(0) },
      ] },
      { id: 'wildwarden', name: 'Wild Warden', blurb: 'The country itself takes your side.', grants: [
        { level: 3, text: 'The Outlands tell you more each reset.', effect: up(0) },
        { level: 7, text: 'Old brews of the green.', effect: power('faith', 6) },
        { level: 11, text: 'Hardiness, learned the slow way.', effect: plain(1) },
        { level: 15, text: 'The country is simply yours now.', effect: up(0) },
        { level: 19, text: 'And it answers oddly when asked.', effect: wild(2) },
      ] },
    ],
  },
  rogue: {
    id: 'rogue', name: 'Treasure Hunter', symbol: 'cunning', ability: 'slip',
    blurb: 'Was not on that pirate ship, has never been on that pirate ship, and would like to see your warrant.',
    dice: [{ symbol: 'cunning', sides: 8 }, { symbol: 'arcana', sides: 4 }, { symbol: 'nature', sides: 4 }],
    paths: [
      { id: 'shadow', name: 'Shadow', blurb: 'Be elsewhere by the time it matters.', grants: [
        { level: 3, text: 'Quicker than the eye that follows.', effect: up(0) },
        { level: 7, text: 'A trick up the sleeve.', effect: wild(1) },
        { level: 11, text: 'Gone before the shout.', effect: up(0) },
        { level: 15, text: 'A second ender pearl.', effect: charge(1) },
        { level: 19, text: 'And a poacher\u2019s eye for cover.', effect: up(2) },
      ] },
      { id: 'trickster', name: 'Trickster', blurb: 'Borrow whatever the situation needs.', grants: [
        { level: 3, text: 'Half-learned enchantments, fully used.', effect: up(1) },
        { level: 7, text: 'A second ender pearl.', effect: charge(1) },
        { level: 11, text: 'The borrowed magic sticks.', effect: up(1) },
        { level: 15, text: 'Light fingers, and more of them.', effect: plain(1) },
        { level: 19, text: 'Still the quickest hand in the room.', effect: up(0) },
      ] },
    ],
  },
  cleric: {
    id: 'cleric', name: 'Alchemist', symbol: 'faith', ability: 'blessing',
    blurb: 'Carries the brewing stand, the bandages, and a mace for the unrepentant.',
    dice: [{ symbol: 'faith', sides: 8 }, { symbol: 'arcana', sides: 4 }, { symbol: 'guard', sides: 4 }],
    paths: [
      { id: 'light', name: 'Healer', blurb: 'Shelter the company.', grants: [
        { level: 3, text: 'Armor brewed into the skin.', effect: up(2) },
        { level: 7, text: 'The brew carries further.', effect: up(0) },
        { level: 11, text: 'A second splash potion.', effect: charge(1) },
        { level: 15, text: 'Nothing gets past you to them.', effect: up(2) },
        { level: 19, text: 'And the cauldron does not run dry.', effect: up(0) },
      ] },
      { id: 'oracle', name: 'Oracle', blurb: 'See the shape of what is coming.', grants: [
        { level: 3, text: 'The brew carries further.', effect: up(0) },
        { level: 7, text: 'Visions, mostly unhelpful.', effect: up(1) },
        { level: 11, text: 'You start being right early.', effect: wild(1) },
        { level: 15, text: 'A second splash potion.', effect: charge(1) },
        { level: 19, text: 'The visions sharpen into sight.', effect: up(1) },
      ] },
    ],
  },
};

export const CLASS_LIST = Object.values(CLASSES);

export function classDef(id) {
  const def = CLASSES[id];
  if (!def) throw new Error(`unknown class ${id}`);
  return def;
}

// Heroes need ids as unique as companions': in a shared quest two players'
// characters live side by side in one party, and ownership is by uid.
export function heroUid() {
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Classes that have been folded into another one. A save naming a retired
// class is repaired rather than left to throw on the way in.
export const RETIRED_CLASSES = { knight: 'paladin' };

// Brings a saved character back into line with the classes that exist now:
// a retired class is remapped, the displayed title follows its class, and a
// path that no longer belongs to that class is cleared so it can be chosen
// again rather than silently granting nothing.
export function repairHero(hero, pool = null) {
  if (!hero || typeof hero !== 'object') return hero;
  if (!CLASSES[hero.classId]) hero.classId = RETIRED_CLASSES[hero.classId] || CLASS_LIST[0].id;
  const def = CLASSES[hero.classId];
  hero.title = def.name;
  if (hero.pathId && !def.paths.some((path) => path.id === hero.pathId)) hero.pathId = null;
  // A figure belongs to a calling. A save from before the tokens existed, or
  // one whose class was remapped out from under it, is given the first figure
  // of whatever it is now rather than a blank on the map.
  const figure = lookById(hero.look);
  if (!figure || figure.cls !== def.id) hero.look = defaultLook(def.id).id;
  // A character written down before there was anything to wear gets a rack.
  if (!hero.gear) hero.gear = emptyRack();
  SLOT_IDS.forEach((slot) => { if (!(slot in hero.gear)) hero.gear[slot] = null; });
  // A calling carries what a calling carries. A save written before that was
  // true — or one whose class was repaired out from under it just now — keeps
  // the piece: it is taken off and handed to `pool`, which is the company's,
  // rather than thrown away.
  SLOT_IDS.forEach((slot) => {
    const piece = hero.gear[slot];
    if (piece && !canCarry(hero.classId, piece)) {
      hero.gear[slot] = null;
      if (pool) pool.push(piece);
    }
  });
  return hero;
}

export function createHero(name, classId, look = null) {
  const def = classDef(classId);
  const figure = lookById(look);
  return {
    // Nothing on the rack and nothing in the pack: kit is found below or
    // bought at a hall, and a new character has done neither.
    gear: emptyRack(),
    bag: [],
    look: figure && figure.cls === def.id ? figure.id : defaultLook(def.id).id,
    uid: heroUid(),
    isHero: true,
    name: name || 'The Nameless',
    classId: def.id,
    title: def.name,
    rarity: 'hero',
    level: 1,
    stamina: 10,
    pathId: null,
    adventures: 0,
    charges: ABILITIES[def.ability].uses,
  };
}

export function pathsFor(hero) {
  return classDef(hero.classId).paths;
}

export function chosenPath(hero) {
  if (!hero.pathId) return null;
  return pathsFor(hero).find((p) => p.id === hero.pathId) || null;
}

export function pendingChoice(hero) {
  return hero.level >= PATH_LEVEL && !hero.pathId;
}

export function grantsEarned(hero) {
  const path = chosenPath(hero);
  if (!path) return [];
  return path.grants.filter((g) => hero.level >= g.level);
}

// The hero's whole hand, rebuilt from class, level and path each time it is
// needed, so there is never a stale copy to keep in sync.
//
// --- The kit, folded into the hand ---------------------------------------
//
// Gear never hands you another die. It changes the ones you have: a plain die
// becomes a power die of the piece's own symbol, or a die gives up a face for
// one that answers anything. Which die that happens to used to be decided for
// you, best-first, which was tidy and invisible — you could not see that your
// helm was spending its wild face on a d4 you never threw.
//
// So every piece carries sockets, one per die it can change, and a die is
// fitted into a socket the way a gem is. An empty socket is not dead weight:
// it takes the best die going, exactly as the old code did, and says so. What
// it buys you is the override.
//
// A die is named by where it sits in the hand *before* any kit touches it —
// `plain:2`, `power:0` — because that is the one description of a die that
// survives a level, a mended shield and a reload.

export function plainKey(i) { return `plain:${i}`; }
export function powerKey(i) { return `power:${i}`; }

// Every die the kit could be fitted to, in the order they are thrown.
export function handKeys(loadout) {
  return [...loadout.plainKeys, ...loadout.power.filter((d) => !d.fromGear).map((d) => d.key)];
}

// No die goes in two sockets: a gem is in one setting or another. `taken` is
// what the rest of the kit has already claimed.
function autoKey(fit, loadout, taken) {
  const free = (key) => key && !taken.has(key);
  const plain = loadout.plainKeys.find(free);
  if (plain) return plain;
  const power = loadout.power.filter((d) => free(d.key));
  if (fit.boon.kind === 'wild') return power.length ? power[0].key : null;
  // A raise with no plain die left sharpens something you are already holding:
  // the smallest die of its own symbol, or failing that the smallest there is.
  const room = power.filter((d) => d.sides < 12);
  const own = room.filter((d) => d.symbol === fit.boon.symbol);
  const pool = own.length ? own : room;
  const target = pool.reduce((least, die) => (!least || die.sides < least.sides ? die : least), null);
  return target ? target.key : null;
}

// Every socket in the kit, and the die in it — the one you chose, or the one
// an empty socket takes. This is what the character sheet draws.
function resolveFits(loadout, rack) {
  const valid = new Set(handKeys(loadout));
  const fits = [];
  SLOT_IDS.forEach((slot) => {
    const piece = rack[slot];
    const holes = socketCount(piece);
    const live = liveSockets(piece);
    for (let i = 0; i < holes; i++) {
      fits.push({ slot, socket: i, piece, boon: boonOf(piece), live: i < live, key: null, auto: false });
    }
  });
  const taken = new Set();
  fits.forEach((fit) => {
    if (!fit.live) return;
    const key = fittedAt(fit.piece, fit.socket);
    if (key && valid.has(key) && !taken.has(key)) { fit.key = key; taken.add(key); }
  });
  // What is left is filled for you, the heaviest raise first so it is the one
  // that gets the plain die.
  fits.filter((fit) => fit.live && !fit.key)
    .sort((a, b) => (b.boon.kind === 'raise' ? b.boon.sides : 0) - (a.boon.kind === 'raise' ? a.boon.sides : 0))
    .forEach((fit) => {
      const key = autoKey(fit, loadout, taken);
      if (!key) return;
      fit.key = key;
      fit.auto = true;
      taken.add(key);
    });
  return fits;
}

// Fold a rack of kit into a hand. The hand is a plain description — how many
// plain dice, how many of them carry a wild face, and what the power dice are
// — which is all a hero and a hired sword have in common, and all this needs.
export function fitKit(hand, rack) {
  hand.plainKeys = hand.plainKeys
    || Array.from({ length: hand.plain }, (_, i) => plainKey(i));
  hand.power.forEach((die, i) => { if (!die.key) die.key = powerKey(i); });
  return withGear(hand, rack);
}

// Build the actual dice a hand describes. Every die keeps the name it had
// before the kit touched it, so a socket holding `plain:2` still finds its die
// after a sword turned that same die into a d8 of Might.
export function handDice(uid, hand) {
  const dice = [];
  hand.plainKeys.forEach((key, i) => {
    const die = makeBasicDie(uid, { wild: i < hand.wild });
    die.key = key;
    dice.push(die);
  });
  hand.power.forEach((p, i) => {
    const die = makePowerDie(uid, p.sides, p.symbol);
    die.key = p.key || powerKey(i);
    dice.push(die);
  });
  // A wild piece cuts its faces into the one die its socket names, as many
  // faces as its grade is worth.
  const cuts = (hand.gear && hand.gear.cuts) || [];
  cuts.forEach(({ key, faces }) => {
    const die = dice.find((d) => d.key === key);
    if (!die) return;
    for (let i = 0; i < faces; i++) if (!addWildFace(die)) break;
  });
  return dice;
}

function withGear(loadout, rack) {
  loadout.fits = [];
  if (!rack) { loadout.gear = null; return loadout; }
  // A harness is not fitted to anything: it simply lets you bring more. Those
  // dice are added before the sockets are worked out, so a weapon can take one
  // of them if that is what it wants.
  SLOT_IDS.forEach((slot) => {
    const boon = boonOf(rack[slot]);
    if (!boon || boon.kind !== 'carry') return;
    for (let i = 0; i < boon.dice; i++) {
      loadout.plainKeys.push(plainKey(loadout.plainKeys.length + 100));
      loadout.plain += 1;
    }
  });
  const fits = resolveFits(loadout, rack);
  loadout.fits = fits;
  let raised = 0;
  let sharpened = 0;
  const cuts = [];
  fits.forEach((fit) => {
    if (!fit.key || !fit.live) return;
    if (fit.boon.kind === 'wild') { cuts.push({ key: fit.key, faces: fit.boon.faces }); return; }
    if (fit.key.startsWith('plain:')) {
      loadout.plainKeys = loadout.plainKeys.filter((k) => k !== fit.key);
      loadout.plain -= 1;
      loadout.power.push({ symbol: fit.boon.symbol, sides: fit.boon.sides, fromGear: true, key: fit.key });
      raised += 1;
      return;
    }
    const die = loadout.power.find((d) => d.key === fit.key);
    if (die && die.sides < 12) { die.sides = stepUp(die.sides, 1); sharpened += 1; }
  });
  // A wild talent is cut into a plain die, and a raise may have just taken one.
  loadout.wild = Math.min(loadout.wild, loadout.plain);
  loadout.gear = { raised, sharpened, cuts, wilds: cuts.reduce((n, c) => n + c.faces, 0) };
  return loadout;
}

export function heroLoadout(hero) {
  const def = classDef(hero.classId);
  const loadout = {
    plain: BASE_PLAIN_DICE + Math.floor(hero.level / PLAIN_EVERY_LEVELS),
    wild: 0,
    power: def.dice.map((d) => ({ ...d })),
    charges: baseCharges(hero.classId) + CHARGE_LEVELS.filter((l) => hero.level >= l).length,
  };
  grantsEarned(hero).forEach(({ effect }) => {
    switch (effect.kind) {
      case 'plain': loadout.plain += effect.n; break;
      case 'wild': loadout.wild += effect.n; break;
      case 'charge': loadout.charges += effect.n; break;
      case 'power': loadout.power.push({ symbol: effect.symbol, sides: effect.sides }); break;
      case 'upgrade': {
        const die = loadout.power[effect.index];
        if (die) die.sides = stepUp(die.sides, effect.steps);
        break;
      }
      default: break;
    }
  });
  loadout.wild = Math.min(loadout.wild, loadout.plain);
  // Name every die before the kit touches it; that name is what a socket holds.
  loadout.plainKeys = Array.from({ length: loadout.plain }, (_, i) => plainKey(i));
  loadout.power.forEach((die, i) => { die.key = powerKey(i); });
  withGear(loadout, hero && hero.gear);
  loadout.power = loadout.power.slice(0, MAX_POWER_DICE + (loadout.gear ? loadout.gear.raised : 0));
  return loadout;
}

export function heroDice(hero) {
  return handDice(hero.uid, heroLoadout(hero));
}

// How many uses a character has in a full night, and how many are left of
// them right now. A hero written down before the pool existed wakes up full.
export function abilityMax(hero) {
  return heroLoadout(hero).charges;
}

export function abilityLeft(hero) {
  const max = abilityMax(hero);
  return Math.max(0, Math.min(max, hero.charges === undefined ? max : hero.charges));
}

export function heroAbility(hero) {
  const def = classDef(hero.classId);
  return { ...ABILITIES[def.ability], charges: abilityMax(hero), left: abilityLeft(hero) };
}

export function choosePath(hero, pathId) {
  if (hero.pathId) throw new Error('your path is already set');
  if (hero.level < PATH_LEVEL) throw new Error(`a path opens at level ${PATH_LEVEL}`);
  const path = pathsFor(hero).find((p) => p.id === pathId);
  if (!path) throw new Error('no such path');
  hero.pathId = path.id;
  return path;
}

// Replays a path from level 1 so the choice screen can show exactly what each
// grant does, rather than a hand-written description that drifts.
export function pathSteps(classId, pathId) {
  const def = classDef(classId);
  const path = def.paths.find((p) => p.id === pathId);
  if (!path) throw new Error('no such path');
  const loadout = {
    plain: BASE_PLAIN_DICE,
    wild: 0,
    power: def.dice.map((d) => ({ ...d })),
    charges: baseCharges(classId),
  };
  return path.grants.map(({ level, text, effect }) => {
    let label;
    switch (effect.kind) {
      case 'plain':
        loadout.plain += effect.n;
        label = `+${effect.n} plain ${effect.n === 1 ? 'die' : 'dice'}`;
        break;
      case 'wild':
        loadout.wild += effect.n;
        label = `+${effect.n} wild ${effect.n === 1 ? 'face' : 'faces'}`;
        break;
      case 'charge':
        loadout.charges += effect.n;
        label = `+${effect.n} use of ${ABILITIES[def.ability].name}`;
        break;
      case 'power':
        if (loadout.power.length < MAX_POWER_DICE) loadout.power.push({ symbol: effect.symbol, sides: effect.sides });
        label = `new d${effect.sides} of ${effect.symbol}`;
        break;
      case 'upgrade': {
        const die = loadout.power[effect.index];
        const from = die.sides;
        die.sides = stepUp(die.sides, effect.steps);
        label = from === die.sides ? `${die.symbol} already at d12` : `${die.symbol} d${from} \u2192 d${die.sides}`;
        break;
      }
      default:
        label = '';
    }
    return { level, text, label, symbol: effect.symbol || null };
  });
}
