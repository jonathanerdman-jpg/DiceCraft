import { STORAGE } from './brand.js';
import { createRng } from './rng.js';
import { makeBasicDie, makePowerDie, basicDiceForRank } from './dice.js';
import { Encounter, named, resetChallenge } from './engine.js';
import { generateMap, reveal } from './map.js';
import { DEPTHS, depthByNumber, settingDef, unlockedDepths } from './settings.js';
import {
  KINDS, KIND_IDS, SLOT_IDS, canCarry, emptyRack, fittedAt, isBroken, kindOf,
  giftOf, kindsFor, kindsForSkills, makePiece, nameOf as gearName, pieceId, priceOf,
  repairCost, rollGift, setFitted,
  skillsCanCarry, slotOf, socketCount, tierFor,
} from './gear.js';
import { placeById, zoneById } from './world.js';
import { TOWER, TOWER_STAMINA, ordinal, towerDepth, towerGrade } from './tower.js';
import { LOOT_LOSS, TRINKETS, hazardDef, trinketDef } from './hazards.js';

// The pool a hall draws on, by the country it stands in.
function hiresOf(zoneId) {
  const zone = zoneById(zoneId);
  return zone ? zone.hires : null;
}
import {
  createHero, choosePath as applyPath, MAX_LEVEL, MAX_POWER_DICE, abilityMax,
  ABILITIES, classDef, fitKit, handDice, handKeys, heroAbility, heroDice, heroLoadout,
  heroUid, pendingChoice, repairHero,
} from './hero.js';
import {
  COMPANIONS, MAX_RANK, MAX_STAMINA, RECRUIT_COST, REST_PER_COMPANION, SEALS,
  HUNGER_LEAVES, companionDef, hungerWarning, isWild, partyCapForRenown, powerDiceForRank,
  recruitWeights, upkeepFor, upkeepOf,
} from './data.js';
import { canTrain, lessonsWon, trainingCost } from './training.js';
import { lookById } from './looks.js';

export const SAVE_KEY = `${STORAGE}.save.v2`;

// Two people playing a shared quest in one browser share localStorage, so a
// save lives under a profile. ?p=2 (or #2) gives the second tab its own
// character; it doubles as a slot for a second run of your own.
export function saveKeyFor(profile = '1') {
  return `${SAVE_KEY}:${String(profile).replace(/[^\w-]/g, '').slice(0, 12) || '1'}`;
}
const RECRUIT_SLOTS = 3;
export const LOCAL_PEER = 'local';


const copyMember = (m) => JSON.parse(JSON.stringify(m));

// A member's copy for a floor, marked with what they walked in with, so the
// way out can hand back what was spent rather than a snapshot of what they
// were. On a shared quest the copy is taken when a player joins the lobby,
// and a character who trained or rested after that must not come home as the
// person they were before it.
const onTheFloor = (m) => ({
  ...copyMember(m),
  down: false,
  startCharges: m.charges,
  startStamina: m.stamina,
});

let uidCounter = 0;
const nextUid = () => `c${Date.now().toString(36)}${(++uidCounter).toString(36)}`;

// Anything that walks on two legs and takes wages can be handed a sword. What
// comes out of a lair cannot, so it is worth more without one — and the
// compensation has to be the same shape as a rack, or it stops working at the
// exact point a rack starts mattering. A creature reads its dice a few ranks
// ahead (which does nothing once it is at the top), and on top of that it
// carries dice and wild faces of its own, the way a harness and a helm would.
// tools/weigh-party.mjs plays the two kinds of companion in the same rooms;
// these are the numbers that put them within a few tenths of a room.
export const WILD_RANK_BONUS = 4;

export function wildEdge(rank) {
  return { plain: rank >= 20 ? 2 : 1, wild: rank >= 24 ? 2 : 1 };
}

export function createCompanion(defId) {
  const def = companionDef(defId);
  return {
    uid: nextUid(),
    defId: def.id,
    name: def.name,
    title: def.title,
    rarity: def.rarity,
    proficiencies: def.proficiencies.slice(),
    rank: 1,
    stamina: MAX_STAMINA,
    adventures: 0,
    // A creature has no hands for it; everybody else starts with an empty rack.
    gear: isWild(def.id) ? null : emptyRack(),
  };
}

// What a companion is holding before any kit is folded in: plain dice by rank,
// power dice by rank, handed out to their proficiencies in order.
export function companionHand(companion) {
  const wild = isWild(companion.defId);
  const rank = Math.min(MAX_RANK, companion.rank + (wild ? WILD_RANK_BONUS : 0));
  const edge = wild ? wildEdge(companion.rank) : { plain: 0, wild: 0 };
  const hand = {
    plain: basicDiceForRank(rank) + edge.plain,
    wild: edge.wild,
    power: powerDiceForRank(rank).slice(0, MAX_POWER_DICE).map((sides, i) => ({
      sides,
      symbol: companion.proficiencies[i % companion.proficiencies.length],
    })),
  };
  return fitKit(hand, companion.gear);
}

export function companionDice(companion) {
  if (companion.isHero) return heroDice(companion);
  return handDice(companion.uid, companionHand(companion));
}

// What a floor is told about the company coming down it.
//
// This used to be the gold value of everybody's rack, which measured the wrong
// thing twice over: a rack sitting at camp counted, and the one number that
// actually decides a room — how many dice walk into it — did not. A character
// with a Runed harness turned up at the Black Tier throwing nine dice where a
// bare one throws six, and the floors never noticed. So the bite is the hand
// now: count what the party brings, count what it would bring with the racks
// off, and charge the difference. Anything the kit ever does to a hand is
// priced automatically, including whatever is added to it later.
// What a die of kit costs the party in room, measured rather than guessed:
// tools/weigh-party.mjs puts one more symbol in a room at about 1.2 plain dice
// at every depth, so charging six tenths of a symbol per die hands the party
// back a little under half of what the harness gave them. Every die of kit is
// worth having and none of it is free, which is the whole of the rule.
export const BITE_PER_DIE = 0.5;
export const MAX_BITE = 2;

export function extraDice(members = []) {
  return members.filter(Boolean).reduce((sum, m) => {
    if (!m.gear) return sum;
    return sum + (companionDice(m).length - companionDice({ ...m, gear: null }).length);
  }, 0);
}

export function biteFor(members = []) {
  return Math.min(MAX_BITE, Math.round(extraDice(members) * BITE_PER_DIE * 10) / 10);
}

// The companion who takes the challenge brings their whole hand; everyone
// else in the party lends a single steadying die.
// Nobody lends a die any more: the two who go in bring their own hands, and
// everyone else waits outside. A room is attempted by a pair — or by whoever
// is left, when only one of you can still stand up.
export const PARTY_PER_ROOM = 2;
// Somebody going in alone — because nobody else can stand, or because there
// is nobody else — fights like it. Without this a survivor cannot retake the
// room that just took their friend, and one bad room becomes a wipe.
export const ALONE_DICE = 2;

// An encounter is a live object holding dice by reference — the same die is in
// the tray and in the remaining pool — so it is written down as a catalog of
// dice plus lists of ids, and those references are tied back together on the
// way in. Copies would break `spend`, which finds a die in the pool by identity.
function packEncounter(e) {
  const all = new Map();
  const add = (die) => { if (die && !all.has(die.id)) all.set(die.id, die); };
  e.remaining.forEach(add);
  e.spentDice.forEach(add);
  e.tray.forEach((entry) => add(entry.die));
  return {
    dice: [...all.values()],
    remaining: e.remaining.map((die) => die.id),
    spentDice: e.spentDice.map((die) => die.id),
    tray: e.tray.map((entry) => ({ die: entry.die.id, face: entry.face })),
    abilities: e.abilities,
    braced: e.braced,
    trialIndex: e.trialIndex,
    spentThisRound: e.spentThisRound,
    rounds: e.rounds,
    rerolls: e.rerolls,
    status: e.status,
    log: e.log,
    discarded: e.discarded,
  };
}

function unpackEncounter(data, challenge, rng) {
  const byId = new Map(data.dice.map((die) => [die.id, die]));
  const die = (id) => {
    const found = byId.get(id);
    if (!found) throw new Error('a die went missing from the save');
    return found;
  };
  return Object.assign(Object.create(Encounter.prototype), {
    challenge,
    rng,
    abilities: data.abilities,
    braced: data.braced,
    spentDice: data.spentDice.map(die),
    remaining: data.remaining.map(die),
    tray: data.tray.map((entry) => ({ die: die(entry.die), face: entry.face })),
    trialIndex: data.trialIndex,
    spentThisRound: data.spentThisRound,
    rounds: data.rounds,
    rerolls: data.rerolls,
    status: data.status,
    log: data.log,
    discarded: data.discarded,
  });
}

function unpackExpedition(floor) {
  const rng = createRng(floor.rng.seed, floor.rng.state);
  const x = {
    ...floor,
    rng,
    // The Tower's depth row is built rather than looked up, so it is rebuilt
    // here: it is a function of the floor number and nothing else, which is
    // why it is safe to leave out of the save.
    depth: floor.mode === 'tower' ? towerDepth(floor.level) : depthByNumber(floor.depthNumber),
    encounter: null,
  };
  if (floor.encounter) {
    // The encounter and the tile share one challenge object: the trials it
    // fills in are the ones the map shows.
    x.encounter = unpackEncounter(floor.encounter, x.map.tiles[x.map.position].challenge, rng);
  }
  return x;
}

// One tray out of however many hands are going in. Whose die is whose still
// matters — a die remembers its owner — but they are thrown together.
// What a hall has on the rack today. Three pieces, never above what the
// character could use, and weighted so the thing you are most likely to be
// sold is one grade below the best you could carry — a hall is a hall, not a
// treasury.
export function rollStock(rng, level, zoneId = '', day = 1, classId = 'fighter') {
  const best = tierFor(level);
  const seeded = createRng(hashOf(`${zoneId}:${day}:${best}:${classId}`));
  const pick = seeded || rng;
  // Three different things: a rack with the same helm on it twice is a rack
  // that has wasted two of its three slots.
  const carry = pick.shuffle(kindsFor(classId).slice());
  return carry.slice(0, 3).map((kind) => {
    const roll = pick.range(0, 9);
    const tier = roll < 5 ? Math.max(1, best - 1) : roll < 9 ? best : Math.min(5, best + 1);
    return makePiece(kind, tier);
  });
}

function hashOf(text) {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) {
    n ^= text.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

// A wound from a trap or a hazard costs a die for the rest of the floor. The
// plainest dice go first — a hurt fighter still swings the sword, but has
// less of everything else — and nobody is ever left with nothing to throw.
// `tired` is one more die gone for this room only: see `winded` on the Game.
export function woundedDice(member, tired = 0) {
  const dice = companionDice(member);
  const wounds = Math.min((member.wounds || 0) + tired, dice.length - 1);
  if (wounds <= 0) return dice;
  const order = dice
    .map((die, i) => ({ i, weight: (die.kind === 'basic' ? 0 : 100) + (die.sides || 6) }))
    .sort((a, b) => a.weight - b.weight || b.i - a.i)
    .slice(0, wounds)
    .map((entry) => entry.i);
  const lost = new Set(order);
  return dice.filter((_, i) => !lost.has(i));
}

// `winded` maps a uid to how many dice that member is down for this room.
export function assembleDice(party, extraPlain = 0, winded = new Map()) {
  const going = Array.isArray(party) ? party : [party];
  const dice = going.flatMap((member) => woundedDice(member, winded.get(member.uid) || 0));
  for (let i = 0; i < extraPlain; i++) dice.push(makeBasicDie(going[0].uid));
  return dice;
}

function emptySeals() {
  return { stag: 0, griffon: 0, wyvern: 0, phoenix: 0 };
}

export function newGameState() {
  return {
    version: 2,
    hero: null,
    day: 1,
    gold: 60,
    training: 0,
    seals: emptySeals(),
    renown: 0,
    roster: [],
    // A character made now has never kept anybody for free, so there is
    // nothing to settle.
    settled: true,
    // Everything found or bought that nobody is wearing yet. It is the
    // company's, not any one person's: a helm comes out of a floor into the
    // pool and stays there until somebody is given it.
    bag: [],
    // Curios the company owns, each with the uses it has left until a long
    // rest. Owning one is having a key here at all.
    trinkets: {},
    recruits: {},
    stock: {},
    log: [],
    expedition: null,
  };
}

// Who is drinking in a particular hall. A hall only offers the sort of people
// who would be in it — a Circle Druid in the Mire, a Rune Guard up in the
// Ironbacks — so where you hire is as much a choice as who you hire.
export function rollRecruits(state, rng = createRng(), hires = null) {
  const weights = recruitWeights(state.renown);
  const owned = new Set(state.roster.map((c) => c.defId));
  const local = hires && hires.length ? COMPANIONS.filter((c) => hires.includes(c.id)) : COMPANIONS;
  const picks = [];
  for (let i = 0; i < RECRUIT_SLOTS; i++) {
    const rarity = rng.weighted(weights);
    const pool = local.filter((c) => c.rarity === rarity && !picks.includes(c.id) && !owned.has(c.id));
    const fallback = local.filter((c) => !picks.includes(c.id) && !owned.has(c.id));
    const from = pool.length ? pool : fallback;
    if (from.length) picks.push(from[rng.int(from.length)].id);
  }
  return picks;
}

export function canAfford(state, rarity) {
  const cost = RECRUIT_COST[rarity];
  if (state.gold < cost.gold) return false;
  return Object.entries(cost.seals).every(([seal, n]) => (state.seals[seal] || 0) >= n);
}

// Every character lives under its own save key, so the roster of characters
// is just whatever keys are in storage. Nothing to keep in sync.
export function listProfiles(storage = globalThis.localStorage) {
  const found = [];
  if (!storage) return found;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(`${SAVE_KEY}:`)) continue;
      const id = key.slice(SAVE_KEY.length + 1);
      let hero = null;
      let summary = {};
      try {
        const data = JSON.parse(storage.getItem(key));
        if (data && data.hero) {
          hero = data.hero;
          summary = {
            gold: data.gold, renown: data.renown, day: data.day,
            companions: (data.roster || []).length,
            savedAt: Number(data.savedAt) || 0,
            underground: Boolean(data.expedition),
          };
        }
      } catch { /* an unreadable slot still counts as taken */ }
      found.push({ id, key, hero, ...summary });
    }
  } catch { /* storage blocked entirely */ }
  return found.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function nextProfileId(profiles = []) {
  const taken = new Set(profiles.map((p) => p.id));
  for (let n = 1; n < 1000; n++) if (!taken.has(String(n))) return String(n);
  return String(Date.now());
}

export function forgetProfile(id, storage = globalThis.localStorage) {
  if (!storage) return;
  try { storage.removeItem(saveKeyFor(id)); } catch { /* nothing to do */ }
}

// --- The game object -------------------------------------------------------

export class Game {
  constructor(state, { saveKey = saveKeyFor() } = {}) {
    this.state = state || newGameState();
    this.saveKey = saveKey;
    this.listeners = new Set();
    // The save as it stands, so that merely opening the game — a fresh slot on
    // a new device included — is never mistaken for having played it.
    this.written = JSON.stringify(this.body());
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this.state)); }

  note(text, kind = 'info') {
    this.state.log.unshift({ text, kind, day: this.state.day });
    this.state.log.length = Math.min(this.state.log.length, 60);
  }

  get hero() { return this.state.hero; }

  // The company's pool of unworn kit.
  get pack() {
    if (!Array.isArray(this.state.bag)) this.state.bag = [];
    return this.state.bag;
  }
  get expedition() { return this.state.expedition; }
  get partyCap() { return partyCapForRenown(this.state.renown); }
  get companionSlots() { return this.partyCap - 1; }
  get depths() { return this.hero ? unlockedDepths(this.hero) : []; }
  get needsPathChoice() { return Boolean(this.hero) && pendingChoice(this.hero); }

  // While a floor is in progress the party is a set of copies owned by the
  // expedition. That is what lets two players run the same expedition side by
  // side from the same seed: neither peer touches the other's roster, and
  // only your own characters' gains are merged back when you surface.
  member(uid) {
    const x = this.state.expedition;
    if (x) {
      const copy = x.members.find((m) => m.uid === uid);
      if (copy) return copy;
    }
    return this.homeMember(uid);
  }

  homeMember(uid) {
    if (this.hero && this.hero.uid === uid) return this.hero;
    return this.state.roster.find((c) => c.uid === uid);
  }

  owns(uid) {
    const x = this.state.expedition;
    if (!x) return true;
    return (x.owners[uid] || LOCAL_PEER) === x.localPeer;
  }

  createCharacter(name, classId, look = null) {
    if (this.hero) throw new Error('you already have a character');
    const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    if (!clean) throw new Error('your character needs a name');
    this.state.hero = createHero(clean, classId, look);
    this.state.recruits = {};
    this.note(`${this.state.hero.name} the ${this.state.hero.title} sets out alone.`, 'good');
    this.emit();
    return this.state.hero;
  }

  renameHero(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    if (!clean) throw new Error('your character needs a name');
    if (clean === this.hero.name) return this.hero.name;
    const was = this.hero.name;
    this.hero.name = clean;
    const inParty = this.state.expedition
      && this.state.expedition.members.find((m) => m.uid === this.hero.uid);
    if (inParty) inParty.name = clean;
    this.note(`${was} is known as ${clean} from here on.`, 'info');
    this.emit();
    return clean;
  }

  choosePath(pathId) {
    const path = applyPath(this.hero, pathId);
    this.note(`${this.hero.name} takes the road of the ${path.name}.`, 'good');
    this.emit();
    return path;
  }

  // --- Camp ---------------------------------------------------------------

  // Everyone in the company who is worn out, worst first — the order the
  // night's coin is spent in.
  weary() {
    return this.state.roster
      .filter((c) => c.stamina < MAX_STAMINA)
      .sort((a, b) => a.stamina - b.stamina);
  }

  // Your own character sleeps for nothing; every companion who needs the night
  // eats and is bedded at your expense. A short purse does not stop the night,
  // it just means somebody wakes up as tired as they went to bed.
  restCost() {
    return this.weary().length * REST_PER_COMPANION;
  }

  // A blessed piece lends its trick to whoever is wearing it: one use a night,
  // on top of anything they already had. It is the only way somebody who was
  // never taught a trick gets one.
  giftsOf(member) {
    if (!member || !member.gear) return [];
    const seen = new Set();
    return SLOT_IDS.map((slot) => giftOf(member.gear[slot])).filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  giftLeft(member, id) {
    const left = member.gifts && member.gifts[id];
    return left === undefined ? 1 : Math.max(0, left);
  }

  // What a night costs before anybody sleeps: everyone on the roster eats.
  upkeep() {
    return upkeepFor(this.state.roster);
  }

  // --- Settling the books -------------------------------------------------
  //
  // A character played before the company had to be fed has been keeping
  // people for free, and the purse shows it. This prices those days at what
  // they would cost today, and caps whatever is left at a few floors' takings
  // — because a hoard that no floor could have paid for is a hoard from a
  // different game. Nothing is taken until it is asked for: the figures are
  // offered first, and the button says exactly what it will cost.
  arrears() {
    // Once only: from here on the nightly bill does the work, and a company
    // settled twice is a company robbed twice.
    if (this.state.settled) {
      return {
        nights: 0, owed: 0, ceiling: 0, over: 0, gold: this.state.gold, left: this.state.gold,
        lessons: this.state.training, lessonCap: this.state.training, lessonsOver: 0, done: true,
      };
    }
    const nights = Math.max(0, (this.state.day || 1) - 1);
    const owed = this.upkeep() * nights;
    const deepest = this.depths[this.depths.length - 1] || DEPTHS[0];
    // Three good floors at the deepest place open to you: enough to buy the
    // next thing you want, not enough to buy everything.
    const ceiling = Math.round(deepest.gold * 1.25 * 9) * 3;
    const after = Math.max(0, this.state.gold - owed);
    // Lessons pile up the same way and buy the same thing — ranks — so the
    // pool is capped against the same three floors' teaching.
    const perFloor = lessonsWon(deepest.depth) * 5 + lessonsWon(deepest.depth, true);
    const lessonCap = perFloor * 3;
    return {
      nights,
      owed: Math.min(owed, this.state.gold),
      ceiling,
      over: Math.max(0, after - ceiling),
      gold: this.state.gold,
      left: Math.min(after, ceiling),
      lessons: this.state.training,
      lessonCap,
      lessonsOver: Math.max(0, this.state.training - lessonCap),
    };
  }

  settle() {
    if (this.state.expedition) throw new Error('finish what you started');
    const books = this.arrears();
    if (!books.owed && !books.over && !books.lessonsOver) throw new Error('the books are already straight');
    this.state.gold = books.left;
    this.state.training = Math.min(this.state.training, books.lessonCap);
    this.state.settled = true;
    this.note(
      `The books are settled: ${books.owed} gold in back wages and board for ${books.nights} `
      + `${books.nights === 1 ? 'night' : 'nights'}${books.over
        ? `, and ${books.over} the hall has been carrying for you written off`
        : ''}${books.lessonsOver
        ? `; ${books.lessonsOver} lessons nobody ever sat through go with it`
        : ''}. ${this.state.gold} gold and ${this.state.training} lessons left.`,
      'info',
    );
    this.emit();
    return books;
  }

  // Two ways to spend a night. A long rest is the whole company: you and every
  // companion who needs it, five gold a head. A short rest is your own bedroll
  // and nobody else's — it costs nothing and buys nothing for anyone but you,
  // which is the whole trade. Either way a day goes by and the hall sees new
  // faces in the morning.
  rest({ companions = true } = {}) {
    if (this.state.expedition) throw new Error('finish what you started');
    this.state.day++;
    if (this.hero) {
      this.hero.stamina = MAX_STAMINA;
      // The trick comes back with the night, and only with the night: that is
      // the whole difference between the two kinds of rest.
      if (companions) this.hero.charges = abilityMax(this.hero);
    }
    // A blessed piece is good for one use a night, and the night is over.
    if (companions) [this.hero, ...this.state.roster].forEach((m) => { if (m) m.gifts = {}; });
    // And so is every curio the company carries.
    if (companions) {
      Object.keys(this.trinkets).forEach((id) => { if (TRINKETS[id]) this.trinkets[id] = TRINKETS[id].uses; });
    }

    // Feeding the company comes first, and it comes whichever kind of night
    // this is: they eat on the days you take an hour for yourself too. What
    // the purse cannot cover, somebody goes without — and a companion who has
    // gone without is in no state to follow you down.
    const owed = this.upkeep();
    const fed = Math.min(owed, this.state.gold);
    this.state.gold -= fed;
    const hungry = [];
    if (fed < owed) {
      // A company feeds its old hands first: whoever was hired last is the
      // first to go without, which is at least a rule you can plan around.
      let short = owed - fed;
      [...this.state.roster].reverse().forEach((c) => {
        if (short <= 0) return;
        short -= upkeepOf(c);
        c.stamina = Math.max(0, c.stamina - 3);
        hungry.push(c);
      });
    }
    // The count is what they remember, and a single supper wipes it.
    const starving = new Set(hungry.map((c) => c.uid));
    this.state.roster.forEach((c) => {
      c.unpaid = starving.has(c.uid) ? (c.unpaid || 0) + 1 : 0;
    });
    const walked = [];
    this.state.roster.forEach((c) => {
      if ((c.unpaid || 0) >= HUNGER_LEAVES) { walked.push(c); return; }
      const warning = hungerWarning(c.unpaid || 0);
      if (warning) this.note(warning.say(c.name), warning.tone);
    });
    if (walked.length) {
      const gone = new Set(walked.map((c) => c.uid));
      // What they were wearing is the company's, and it stays: they leave
      // with their name and nothing else.
      let stripped = 0;
      walked.forEach((c) => {
        SLOT_IDS.forEach((slot) => {
          const piece = c.gear && c.gear[slot];
          if (piece) { c.gear[slot] = null; this.pack.push(piece); stripped += 1; }
        });
      });
      this.state.roster = this.state.roster.filter((c) => !gone.has(c.uid));
      this.note(
        `${walked.map((c) => c.name).join(' and ')} ${walked.length === 1 ? 'has' : 'have'} gone, `
        + 'after seven nights unfed.'
        + (stripped ? ` What ${walked.length === 1 ? 'they were' : 'they were'} wearing is in the pool.` : ''),
        'bad',
      );
    }

    const weary = companions ? this.weary() : [];
    const paid = Math.min(weary.length, Math.floor(this.state.gold / REST_PER_COMPANION));
    this.state.gold -= paid * REST_PER_COMPANION;
    weary.slice(0, paid).forEach((c) => { c.stamina = MAX_STAMINA; });
    const left = weary.length - paid;
    if (owed) {
      this.note(hungry.length
        ? `${owed} gold to feed the company and only ${fed} in the purse. ${
          hungry.map((c) => c.name).join(' and ')} ${hungry.length === 1 ? 'goes' : 'go'} without.`
        : `${owed} gold feeds the company for the night.`, hungry.length ? 'bad' : 'info');
    }

    // A night is a night everywhere: every hall the company knows about has
    // new faces in it by morning.
    if (!this.state.recruits || Array.isArray(this.state.recruits)) this.state.recruits = {};
    this.state.stock = {};
    Object.keys(this.state.recruits).forEach((zoneId) => {
      this.state.recruits[zoneId] = rollRecruits(this.state, createRng(), hiresOf(zoneId));
    });
    if (!companions) {
      const tired = this.weary().length;
      this.note(
        `Day ${this.state.day}. You take an hour for yourself and wake with your vigor back, though not your trick.${
          tired ? ` ${tired} ${tired === 1 ? 'companion is' : 'companions are'} still worn, and nothing was spent on them.` : ''}`,
        'info',
      );
      this.emit();
      return;
    }

    const spent = paid ? ` ${paid * REST_PER_COMPANION} gold buys the night for ${paid} of them.` : '';
    if (left) {
      this.note(
        `Day ${this.state.day}. You are rested.${spent} ${left} ${left === 1 ? 'companion goes' : 'companions go'} without, and ${left === 1 ? 'wakes' : 'wake'} no better for it.`,
        'bad',
      );
    } else {
      this.note(`Day ${this.state.day}. The company breaks camp, rested.${spent}`, 'info');
    }
    this.emit();
  }

  shortRest() {
    return this.rest({ companions: false });
  }

  // What is on offer in one hall, rolled the first time anybody walks in.
  hallOf(zoneId) {
    if (!zoneId) return [];
    if (!this.state.recruits || Array.isArray(this.state.recruits)) this.state.recruits = {};
    if (!this.state.recruits[zoneId]) {
      this.state.recruits[zoneId] = rollRecruits(this.state, createRng(), hiresOf(zoneId));
    }
    return this.state.recruits[zoneId];
  }

  // What the smith in this hall has on the rack. Rolled once per hall per day
  // like the hires are, and never above what the character could use: a level
  // three adventurer is not sold runed plate they cannot lift.
  gearOf(zoneId) {
    if (!zoneId || !this.hero) return [];
    if (!this.state.stock || Array.isArray(this.state.stock)) this.state.stock = {};
    if (!this.state.stock[zoneId]) {
      this.state.stock[zoneId] = rollStock(createRng(), this.hero.level, zoneId, this.state.day, this.hero.classId);
    }
    return this.state.stock[zoneId];
  }

  buyGear(pieceId, zoneId) {
    const stock = this.gearOf(zoneId);
    const piece = stock.find((p) => p.id === pieceId);
    if (!piece) throw new Error('not on the rack');
    const price = priceOf(piece);
    if (this.state.gold < price) throw new Error('you cannot pay for that');
    this.state.gold -= price;
    this.state.stock[zoneId] = stock.filter((p) => p.id !== pieceId);
    this.take(piece);
    this.note(`${gearName(piece)} bought for ${price} gold.`, 'good');
    this.emit();
    return piece;
  }

  // --- Curios -------------------------------------------------------------

  get trinkets() {
    if (!this.state.trinkets || typeof this.state.trinkets !== 'object') this.state.trinkets = {};
    return this.state.trinkets;
  }

  ownsTrinket(id) {
    return this.trinkets[id] !== undefined;
  }

  trinketLeft(id) {
    return this.ownsTrinket(id) ? this.trinkets[id] : 0;
  }

  buyTrinket(id) {
    const def = trinketDef(id);
    if (this.state.expedition) throw new Error('the curio-seller is up at the town hall');
    if (this.ownsTrinket(id)) throw new Error('the company already carries one');
    if (this.state.gold < def.price) throw new Error('you cannot pay for that');
    this.state.gold -= def.price;
    this.trinkets[id] = def.uses;
    this.note(`${def.name} bought for ${def.price} gold.`, 'good');
    this.emit();
  }

  // What a curio could do right now, if anything. The screens ask this rather
  // than working it out, so a button is only ever offered when pressing it
  // would do something.
  trinketUse(id) {
    const x = this.state.expedition;
    if (!x || !this.trinketLeft(id) || this.sharedQuest) return null;
    const tile = this.tile;
    if (id === 'wayfarer') {
      return ['exploring', 'choosing', 'encounter', 'falling', 'chest', 'offer', 'spoils'].includes(x.status)
        ? 'escape' : null;
    }
    if (id === 'pole') {
      if (x.status === 'chest' && tile && tile.chest && !tile.chest.known) return 'probe';
      if (x.status === 'choosing' && tile && tile.challenge && tile.challenge.hazard) return 'spring';
      return null;
    }
    if (id === 'salts') {
      return ['exploring', 'choosing'].includes(x.status) && this.downed().length ? 'revive' : null;
    }
    if (id === 'glass') {
      return x.status === 'exploring' && this.scryable().length ? 'scry' : null;
    }
    return null;
  }

  // The rooms next to where the party stands that the glass could look into:
  // not yet entered, not already looked into, and with something in them.
  scryable() {
    const x = this.state.expedition;
    if (!x) return [];
    const here = x.map.tiles[x.map.position];
    return here.links.map((k) => x.map.tiles[k]).filter((t) => t && t.state !== 'cleared' && !t.scried
      && (t.mob || t.chest || (t.challenge && t.challenge.hazard)));
  }

  // What the glass showed of a room, as the screens draw it: the thing in
  // it, and its trials with one symbol put out of sight.
  scryView(tile) {
    if (!tile || !tile.scried) return null;
    const challenge = tile.challenge;
    let at = 0;
    const trials = challenge ? challenge.trials.map((t) => t.required.map((sym) => {
      const shown = at !== tile.scried.hidden;
      at += 1;
      return shown ? sym : null;
    })) : [];
    return {
      name: tile.chest && !tile.chest.mimic ? 'A chest, and only a chest' : challenge ? challenge.name
        : tile.wild ? companionDef(tile.wild.defId).title : 'Something',
      mob: tile.mob || null,
      hazard: challenge && challenge.hazard ? challenge.hazard : null,
      trap: tile.chest && tile.chest.trap ? tile.chest.trap : null,
      wary: Boolean(tile.wild && tile.wild.mode === 'befriend'),
      trials,
    };
  }

  useTrinket(id, uid = null) {
    const x = this.state.expedition;
    const use = this.trinketUse(id);
    if (!use) throw new Error('that will not help here');
    const def = trinketDef(id);
    const tile = this.tile;
    if (use === 'scry') {
      // `uid` names the room to look into when it is the glass.
      const target = this.scryable().find((t) => t.key === uid);
      if (!target) throw new Error('the glass cannot see into that');
      this.trinkets[id] -= 1;
      const count = target.challenge ? target.challenge.trials.reduce((n, t) => n + t.required.length, 0) : 0;
      // One symbol stays dark, so the glass is a good look and not a
      // certainty. Which one is the floor's own dice's choice.
      target.scried = { hidden: count > 1 ? x.rng.int(count) : -1 };
      const seen = this.scryView(target);
      this.note(`Through the ${def.name.replace(/^The /, '')}: ${seen.name}.`, 'info');
      this.emit();
      return seen;
    }
    if (use === 'revive') {
      const who = uid ? this.member(uid) : this.downed()[0];
      if (!who || !who.down || !x.partyUids.includes(who.uid)) throw new Error('nobody by that name is down');
      this.trinkets[id] -= 1;
      who.down = false;
      this.note(`The ${def.name} flares gold, and ${who.name} is back on their feet.`, 'good');
      this.emit();
      return who;
    }
    this.trinkets[id] -= 1;
    if (use === 'escape') {
      x.encounter = null;
      x.actorUids = [];
      x.fallen = null;
      x.status = 'exploring';
      this.note(`The ${def.name.replace(/^The /, '')} spins, and the floor is somewhere else. `
        + 'The company is home, and so is everything it was carrying.', 'good');
      this.bank(false);
      this.emit();
      return x;
    }
    if (use === 'probe') {
      tile.chest.known = true;
      if (tile.chest.mimic) {
        this.note('The stick touches the lid, and the lid flinches. That is no chest.', 'bad');
      } else if (tile.chest.trap) {
        // Prodding a trapped lid from ten feet away is exactly what springs it.
        this.note(`The stick lifts the lid, and a ${hazardDef(tile.chest.trap).name.toLowerCase()} goes off into empty air. It is only a chest now.`, 'good');
        tile.chest.trap = null;
        tile.challenge = null;
      } else {
        this.note('The stick raps on the lid. Planks, and nothing but planks.', 'good');
      }
      this.emit();
      return tile;
    }
    // Sprung from a safe distance: nobody has to go in at all.
    const name = hazardDef(tile.challenge.hazard).name;
    this.note(`${def.name} first: the ${name.toLowerCase()} is sprung, poked or sounded out, and the company goes past it.`, 'good');
    x.actorUids = [];
    this.clearHazard(tile);
    this.emit();
    return tile;
  }

  // Who can be handed a piece of kit: the character, and everyone in the
  // company who has hands for it. The pack is the company's, not any one
  // person's, so a helm bought today can be on somebody else tomorrow.
  bearers() {
    const hero = this.hero;
    if (!hero) return [];
    return [hero, ...this.state.roster.filter((c) => c.gear)];
  }

  bearer(uid) {
    if (!uid || (this.hero && uid === this.hero.uid)) return this.requireHero();
    const found = this.state.roster.find((c) => c.uid === uid);
    if (!found) throw new Error('nobody by that name');
    if (!found.gear) throw new Error(`${found.name} has no hands for it`);
    return found;
  }

  // What this bearer may carry: a calling for the character, a pair of
  // proficiencies for everybody else.
  canBear(who, piece) {
    return who.classId ? canCarry(who.classId, piece) : skillsCanCarry(who.proficiencies, piece);
  }

  // What a bearer is holding before the kit, which is what a socket names.
  handOf(uid) {
    const who = this.bearer(uid);
    return who.classId ? heroLoadout({ ...who, gear: null }) : companionHand({ ...who, gear: null });
  }

  // Into the slot it belongs in, with whatever was there going to the pack.
  equip(pieceId, uid = null) {
    this.requireHero();
    const who = this.bearer(uid);
    const pack = this.pack;
    const at = pack.findIndex((p) => p.id === pieceId);
    if (at < 0) throw new Error('that is not in the pool');
    const piece = pack[at];
    if (isBroken(piece)) throw new Error('it is broken — mend it first');
    if (!this.canBear(who, piece)) {
      throw new Error(who.classId
        ? `a ${classDef(who.classId).name} does not carry that`
        : `${who.name} does not carry that`);
    }
    const slot = slotOf(piece);
    const worn = who.gear[slot];
    pack.splice(at, 1);
    if (worn) pack.push(worn);
    who.gear[slot] = piece;
    this.note(`${who.name} takes up the ${gearName(piece).toLowerCase()}.`, 'info');
    this.emit();
    return piece;
  }

  unequip(slot, uid = null) {
    this.requireHero();
    const who = this.bearer(uid);
    const piece = who.gear[slot];
    if (!piece) throw new Error('nothing there to put down');
    who.gear[slot] = null;
    this.pack.push(piece);
    this.emit();
    return piece;
  }

  // Which die a piece of kit works on. A socket holds one die and one die
  // holds one socket, so fitting a die pulls it out of wherever it was — the
  // same gem cannot sit in two settings.
  fitDie(slot, index, key, uid = null) {
    const who = this.bearer(uid);
    const piece = who.gear[slot];
    if (!piece) throw new Error('nothing in that slot');
    if (!(index >= 0 && index < socketCount(piece))) throw new Error('no such socket');
    if (key) {
      const bare = this.handOf(uid);
      if (!handKeys(bare).includes(key)) throw new Error('that die is not in your hand');
      SLOT_IDS.forEach((id) => {
        const other = who.gear[id];
        if (!other) return;
        for (let i = 0; i < socketCount(other); i++) {
          if (fittedAt(other, i) === key && !(id === slot && i === index)) setFitted(other, i, null);
        }
      });
    }
    setFitted(piece, index, key || null);
    this.emit();
    return piece;
  }

  // Mending is camp work, and it is charged by the damage.
  repair(pieceId) {
    const hero = this.requireHero();
    if (this.state.expedition) throw new Error('not in the middle of a floor');
    const piece = this.pieceById(pieceId);
    if (!piece) throw new Error('no such gear');
    const cost = repairCost(piece);
    if (!cost) throw new Error('it is sound already');
    if (this.state.gold < cost) throw new Error('you cannot pay for that');
    this.state.gold -= cost;
    piece.wear = 0;
    this.note(`${gearName(piece)} mended for ${cost} gold.`, 'good');
    this.emit();
    return piece;
  }

  // Everything at once, which is what a player actually wants at camp: the
  // whole bill or nothing, so there is no half-mended kit to keep track of.
  repairAll() {
    const hero = this.requireHero();
    if (this.state.expedition) throw new Error('not in the middle of a floor');
    const all = [...this.bearers().flatMap((who) => SLOT_IDS.map((slot) => who.gear[slot])),
      ...this.pack].filter((p) => p && p.wear);
    if (!all.length) throw new Error('every piece is sound already');
    const total = all.reduce((sum, piece) => sum + repairCost(piece), 0);
    if (this.state.gold < total) throw new Error('you cannot pay for that');
    this.state.gold -= total;
    all.forEach((piece) => { piece.wear = 0; });
    this.note(`The anvil puts ${all.length} ${all.length === 1 ? 'piece' : 'pieces'} right for ${total} gold.`, 'good');
    this.emit();
    return total;
  }

  pieceById(pieceId) {
    const hero = this.hero;
    if (!hero) return null;
    const worn = this.bearers()
      .flatMap((who) => SLOT_IDS.map((slot) => who.gear[slot]))
      .find((p) => p && p.id === pieceId);
    return worn || this.pack.find((p) => p.id === pieceId) || null;
  }

  take(piece) {
    this.requireHero();
    this.pack.push(piece);
    return piece;
  }

  requireHero() {
    if (!this.hero) throw new Error('make a character first');
    if (!this.hero.gear) this.hero.gear = emptyRack();
    return this.hero;
  }

  // A floor that beats you takes it out of your kit. Everything worn is a
  // little worse for it, and anything already worn through is left behind.
  damageGear(who = null) {
    const wearers = (who ? [who] : this.bearers()).filter((m) => m && m.gear);
    if (!wearers.length) return [];
    const broken = [];
    wearers.forEach((bearer) => {
      SLOT_IDS.forEach((slot) => {
        const piece = bearer.gear[slot];
        if (!piece) return;
        piece.wear += 1;
        if (isBroken(piece)) {
          bearer.gear[slot] = null;
          broken.push(piece);
        }
      });
    });
    if (broken.length) {
      this.note(`${broken.map((p) => gearName(p)).join(' and ')} ${broken.length === 1 ? 'is' : 'are'} ruined past mending.`, 'bad');
    }
    return broken;
  }

  recruit(defId, zoneId) {
    const def = companionDef(defId);
    const hall = this.hallOf(zoneId);
    if (!hall.includes(defId)) throw new Error('not on offer');
    if (!canAfford(this.state, def.rarity)) throw new Error('you cannot pay');
    const cost = RECRUIT_COST[def.rarity];
    this.state.gold -= cost.gold;
    Object.entries(cost.seals).forEach(([seal, n]) => { this.state.seals[seal] -= n; });
    this.state.recruits[zoneId] = hall.filter((id) => id !== defId);
    const companion = createCompanion(defId);
    this.state.roster.push(companion);
    this.note(`${def.name}, ${def.title}, takes your coin and joins the company.`, 'good');
    this.emit();
    return companion;
  }

  // Who you look like on the map. The figure has to belong to your calling —
  // a Ranger does not get to walk around as somebody's archmage.
  chooseLook(lookId) {
    if (!this.hero) throw new Error('make a character first');
    const figure = lookById(lookId);
    if (!figure) throw new Error('no such figure');
    if (figure.cls !== this.hero.classId) throw new Error(`that one is not a ${classDef(this.hero.classId).name}`);
    this.hero.look = figure.id;
    this.emit();
    return figure;
  }

  dismiss(uid) {
    const companion = this.member(uid);
    if (!companion || companion.isHero) throw new Error('you cannot dismiss yourself');
    this.state.roster = this.state.roster.filter((c) => c.uid !== uid);
    this.note(`${companion.name} is dismissed, and sent home.`, 'info');
    this.emit();
  }

  // --- Training -----------------------------------------------------------

  // Spend the pool on one person. This is the only way anybody rises, and it
  // is deliberately a single step at a time: the cost of the next one is
  // printed on the card, so choosing the veteran over the new hire is a thing
  // you do with your eyes open.
  //
  // It happens at camp, between runs. You cannot school somebody halfway down
  // a staircase, and it keeps the pool out of the lockstep a shared quest
  // runs on — training is your own business, like resting.
  train(uid) {
    if (this.state.expedition) throw new Error('not in the middle of a floor');
    const member = this.member(uid);
    if (!member) throw new Error('no such member');
    const cost = trainingCost(member);
    if (cost === null) throw new Error(`${member.name} has nothing left to learn`);
    if (!canTrain(this.state.training, member)) {
      throw new Error(`${cost} lessons are needed and the company has ${this.state.training}`);
    }
    this.state.training -= cost;
    if (member.isHero) member.level = Math.min(MAX_LEVEL, member.level + 1);
    else member.rank = Math.min(MAX_RANK, member.rank + 1);
    this.note(
      `${member.name} trains to ${member.isHero ? `level ${member.level}` : `rank ${member.rank}`}, at ${cost} lessons.`,
      'good',
    );
    this.emit();
    return member;
  }

  // What the pool will buy right now, for the camp screen.
  trainable() {
    return [this.hero, ...this.state.roster].filter(Boolean).map((member) => ({
      member,
      cost: trainingCost(member),
      afford: canTrain(this.state.training, member),
    }));
  }

  // --- Expedition ---------------------------------------------------------

  startExpedition(depthNumber, companionUids = [], seed, placeId = null, upright = false) {
    if (this.state.expedition) throw new Error('you are already underground');
    if (!this.hero) throw new Error('make a character first');
    const depth = depthByNumber(depthNumber);
    if (!depth) throw new Error('no such floor');
    if (!this.depths.includes(depth)) throw new Error('that floor is sealed to you');
    if (companionUids.length > this.companionSlots) throw new Error('your renown will not support so large a party');
    const party = [this.hero, ...companionUids.map((uid) => this.member(uid))];
    if (party.some((m) => !m)) throw new Error('unknown companion');
    if (party.some((m) => m.stamina < depth.stamina)) throw new Error('someone is too worn for this journey');

    party.forEach((m) => { m.stamina -= depth.stamina; m.adventures++; });
    return this.beginExpedition({
      depthNumber,
      placeId,
      seed,
      upright,
      members: party.map(copyMember),
      owners: Object.fromEntries(party.map((m) => [m.uid, LOCAL_PEER])),
      localPeer: LOCAL_PEER,
    });
  }

  // The shared entry point. Both a solo descent and a co-op quest come
  // through here with exactly the same arguments, which is what keeps two
  // peers in step.
  beginExpedition({ depthNumber, placeId = null, seed, members, owners, localPeer = LOCAL_PEER, upright = false }) {
    const depth = depthByNumber(depthNumber);
    const place = placeId ? placeById(placeId) : null;
    const rng = createRng(seed);
    this.state.expedition = {
      depthNumber,
      placeId: place ? place.id : null,
      seed: rng.seed,
      upright,
      localPeer,
      owners: { ...owners },
      members: members.map(onTheFloor),
      map: generateMap({
        depth,
        rng,
        upright,
        // A company in good kit meets rooms that know it: every trial asks
        // for a symbol or two more once the party is carrying real gear.
        bite: biteFor(members),
        owned: this.ownedForFloor(owners),
        settings: place ? place.settings : undefined,
      }),
      partyUids: members.map((m) => m.uid),
      actorUids: [],
      encounter: null,
      multiplier: 1,
      boon: 0,
      fallen: null,
      bounty: 0,
      pending: { gold: 0, training: 0, seals: emptySeals(), companions: [], gear: [] },
      status: 'exploring',
      rng,
    };
    const names = this.state.expedition.map.settings.map((id) => settingDef(id).name).join(' meeting ');
    this.state.expedition.depth = depth;
    this.note(`${place ? `Into ${place.name}` : `Down into ${depth.name}`}: ${names}.`, 'info');
    this.emit();
    return this.state.expedition;
  }

  // --- The Iron Tower -------------------------------------------------------
  //
  // One dungeon with no top. A floor of the Tower is an ordinary floor — the
  // same carved map, the same rooms and hoards and lairs, the same boss at the
  // far end — so it goes through the same walking, the same pair going in and
  // the same person going down, because all of that is the game and none of it
  // should be written twice. Two things are different, and they are the whole
  // of it: the floors never run out and get harder for ever, and beating a
  // boss puts you on a landing rather than back at camp.
  //
  // Climbing on from that landing empties your hands. Only one floor's takings
  // ever leave the Tower, so the press is a floor at a time rather than a room
  // at a time, and everything already won rides on the next one.

  startTower(companionUids = [], seed = Date.now(), upright = false) {
    if (this.state.expedition) throw new Error('you are already out');
    if (!this.hero) throw new Error('make a character first');
    if (companionUids.length > this.companionSlots) throw new Error('your renown will not support so large a party');
    const party = [this.hero, ...companionUids.map((uid) => this.member(uid))];
    if (party.some((m) => !m)) throw new Error('unknown companion');
    if (party.some((m) => m.stamina < TOWER_STAMINA)) throw new Error('someone is too worn for the descent');

    party.forEach((m) => { m.stamina -= TOWER_STAMINA; m.adventures++; });
    return this.beginTower({
      seed,
      upright,
      members: party.map(copyMember),
      owners: Object.fromEntries(party.map((m) => [m.uid, LOCAL_PEER])),
      localPeer: LOCAL_PEER,
    });
  }

  // The climb itself, whoever is making it: one player from startTower, or a
  // shared quest, where every peer calls this with the same seed and the same
  // members and so builds the same tower.
  beginTower({ seed, members, owners, localPeer = LOCAL_PEER, upright = false }) {
    if (this.state.expedition) throw new Error('you are already out');
    const rng = createRng(seed);
    this.state.expedition = {
      mode: 'tower',
      depthNumber: null,
      placeId: null,
      seed: rng.seed,
      upright,
      localPeer,
      owners: { ...owners },
      members: members.map(onTheFloor),
      // Settled at the door and kept, so the twentieth floor is measured
      // against the kit that walked in rather than whatever it has handed out
      // since: a floor the Tower itself armed you for is not a floor.
      bite: biteFor(members),
      level: 0,
      best: 0,
      map: null,
      partyUids: members.map((m) => m.uid),
      actorUids: [],
      encounter: null,
      multiplier: 1,
      boon: 0,
      fallen: null,
      bounty: 0,
      pending: { gold: 0, training: 0, seals: emptySeals(), companions: [], gear: [] },
      status: 'exploring',
      rng,
    };
    this.note(`${TOWER.name}. The door shuts behind you, the gears turn, and the stair goes up.`, 'info');
    this.climb();
    return this.state.expedition;
  }

  // Which creatures a lair should not offer. Alone, the ones you already
  // keep. On a shared floor, none: each player keeps different creatures, and
  // two copies of the same floor built from two different lists would not be
  // the same floor.
  ownedForFloor(owners = {}) {
    const shared = new Set(Object.values(owners)).size > 1;
    return shared ? new Set() : new Set(this.state.roster.map((c) => c.defId));
  }

  get tower() {
    const x = this.state.expedition;
    return x && x.mode === 'tower' ? x : null;
  }

  // Up one floor. Whatever was on the landing stays on the landing: that is
  // the press, and it has to cost the takings or it is not one.
  climb() {
    const x = this.tower;
    if (!x) throw new Error('you are not in the Clocktower');
    if (x.level && x.status !== 'landing') throw new Error('this floor is not finished with you');
    x.level += 1;
    // A landing is a breather: whatever the last floor's traps did heals here.
    x.members.forEach((m) => { m.wounds = 0; });
    // And everybody gets their breath back.
    x.members.forEach((m) => { m.streak = 0; });
    x.pending = { gold: 0, training: 0, seals: emptySeals(), companions: [], gear: [] };
    x.multiplier = 1;
    x.boon = 0;
    x.fallen = null;
    x.bounty = 0;
    x.actorUids = [];
    x.encounter = null;
    const depth = towerDepth(x.level);
    x.depth = depth;
    x.map = generateMap({
      depth,
      rng: x.rng,
      upright: x.upright,
      bite: x.bite,
      owned: this.ownedForFloor(x.owners),
    });
    x.status = 'exploring';
    const names = x.map.settings.map((id) => settingDef(id).name).join(' meeting ');
    this.note(`The ${ordinal(x.level)} floor of the Clocktower: ${names}.`, 'info');
    this.emit();
    return x;
  }

  // A boss down is a landing, not a way out: what the floor paid is on the
  // table and the stair goes on up. Nothing is banked here — that is the next
  // decision, and it is the only one the Tower has.
  towerCleared() {
    const x = this.tower;
    x.best = Math.max(x.best, x.level);
    x.status = 'landing';
    this.note(`The ${ordinal(x.level)} floor is cleared. ${x.pending.gold} gold on the table, `
      + 'and a stair going up past it.', 'good');
  }

  // Taking it. One floor's takings leave the Tower, whichever floor it was.
  towerTake() {
    const x = this.tower;
    if (!x || x.status !== 'landing') throw new Error('there is nothing on the table');
    this.bank(true);
    this.emit();
    return x.pending;
  }

  // Which depth row the run in progress is on. A posting looks its floor up in
  // the table; the Tower builds one for the floor it is standing on, and the
  // difference stops here — everything downstream reads the same row.
  get runDepth() {
    const x = this.state.expedition;
    if (!x) return null;
    return x.mode === 'tower' ? x.depth : depthByNumber(x.depthNumber);
  }

  // Where in the world this is, when it was chosen off the map.
  get place() {
    const x = this.state.expedition;
    return x && x.placeId ? placeById(x.placeId) : null;
  }

  get tile() {
    const x = this.state.expedition;
    return x ? x.map.tiles[x.map.position] : null;
  }

  move(tileKey) {
    const x = this.state.expedition;
    if (!x || x.status !== 'exploring') throw new Error('you cannot move just now');
    const here = x.map.tiles[x.map.position];
    if (!here.links.includes(tileKey)) throw new Error('there is no way through');
    const next = x.map.tiles[tileKey];
    // Which way the party turned, so the token on the map faces the way it
    // walked rather than always north.
    x.facing = next.x > here.x ? 'e' : next.x < here.x ? 'w' : next.y > here.y ? 's' : 'n';
    x.map.position = tileKey;
    x.fallen = null;
    reveal(x.map, tileKey);

    if (next.state === 'cleared' || (next.kind === 'passage' && !next.hazard) || next.kind === 'entrance') {
      next.state = 'cleared';
      this.emit();
      return next;
    }
    if (next.kind === 'passage') {
      // Something between here and the far side. A trap is news; a hazard or
      // an obstacle was on the map, and walking into it was the decision.
      const def = hazardDef(next.hazard.id);
      if (def.kind === 'trap' && !next.hazard.sprung) {
        next.hazard.sprung = true;
        this.note(`A trap! ${def.text}`, 'bad');
      } else {
        this.note(`${def.name}. ${def.text}`, 'info');
      }
      this.askWhoGoesIn();
      return next;
    }
    if (next.kind === 'treasure') {
      // A chest. Whether to open it is up to you; what it is, is up to it.
      x.status = 'chest';
      this.emit();
      return next;
    }
    if (next.kind === 'shrine') {
      next.state = 'cleared';
      x.boon += 2;
      x.partyUids.forEach((uid) => {
        const m = this.member(uid);
        m.stamina = Math.min(MAX_STAMINA, m.stamina + 2);
      });
      this.note('A beacon, still lit. The company stands in its light and takes heart.', 'good');
      this.emit();
      return next;
    }
    if (next.kind === 'lair' && next.wild.mode === 'befriend') {
      // Met, and so worth remembering on the way out. A lair you only ever
      // saw on the map holds a creature you have never laid eyes on.
      next.wild.met = true;
      x.status = 'offer';
      this.emit();
      return next;
    }
    this.askWhoGoesIn();
    return next;
  }

  // --- What is in the chest ------------------------------------------------

  openChest() {
    const x = this.state.expedition;
    if (!x || x.status !== 'chest') throw new Error('there is no chest in front of you');
    const tile = this.tile;
    const chest = tile.chest || { mimic: false, trap: null };
    if (chest.mimic) {
      chest.known = true;
      this.note('The lid lifts, and keeps lifting. There are teeth under it. A mimic!', 'bad');
      this.askWhoGoesIn();
      return tile;
    }
    if (chest.trap) {
      this.note(`A trap! ${hazardDef(chest.trap).text}`, 'bad');
      this.askWhoGoesIn();
      return tile;
    }
    this.lootChest(tile);
    x.status = 'exploring';
    this.emit();
    return tile;
  }

  // Walking away from a chest is always allowed. It will still be there.
  leaveChest() {
    const x = this.state.expedition;
    if (!x || x.status !== 'chest') throw new Error('there is no chest in front of you');
    this.note('The chest is left shut. It will still be here.', 'info');
    x.status = 'exploring';
    this.emit();
  }

  // An honest chest pays less than a mimic does, because nothing had to be
  // beaten for it — but it pays, and it often has kit in it.
  lootChest(tile) {
    const x = this.state.expedition;
    const depth = this.runDepth;
    const rng = x.rng;
    const base = depth.gold + rng.range(0, Math.round(depth.gold / 2));
    const gold = Math.round(base * 2 * x.multiplier);
    x.pending.gold += gold;
    tile.state = 'cleared';
    this.note(`The chest holds ${gold} gold.`, 'good');
    this.findGear(8);
    return gold;
  }

  // A trap got past, a hazard crossed, an obstacle overcome — however it went.
  // A trapped chest is still a chest on the other side of its trap.
  clearHazard(tile) {
    const x = this.state.expedition;
    x.encounter = null;
    if (tile.kind === 'treasure') {
      tile.chest.trap = null;
      tile.challenge = null;
      this.lootChest(tile);
    } else {
      tile.state = 'cleared';
    }
    x.status = 'exploring';
  }

  // What losing to the floor costs. Nobody goes down to a trap; they pay.
  payHazard(tile, going) {
    const x = this.state.expedition;
    const def = hazardDef(tile.challenge.hazard);
    let cost = def.cost;
    if (cost === 'drain') {
      const heroes = going.filter((m) => m.isHero && (m.charges || 0) > 0);
      if (heroes.length) {
        heroes.forEach((m) => {
          m.charges -= 1;
          const home = this.homeMember(m.uid);
          });
        this.note(`The ${def.name.toLowerCase()} feeds: ${this.who(heroes)} ${heroes.length === 1 ? 'loses' : 'lose'} a use of ${heroes.length === 1 ? 'their' : 'their'} trick.`, 'bad');
        return;
      }
      cost = 'wound';
    }
    if (cost === 'loot') {
      const lost = Math.ceil(x.pending.gold * LOOT_LOSS);
      x.pending.gold -= lost;
      this.note(lost
        ? `The ${def.name.toLowerCase()} takes its toll: ${lost} gold out of the pack and gone.`
        : `The ${def.name.toLowerCase()} would have taken gold, if there had been any to take.`, 'bad');
      return;
    }
    going.forEach((m) => { m.wounds = (m.wounds || 0) + 1; });
    this.note(`${this.who(going)} ${going.length === 1 ? 'comes' : 'come'} through the ${def.name.toLowerCase()} hurt: one die fewer each for the rest of this floor.`, 'bad');
  }

  // Who goes into the room. With two or more on their feet that is a decision
  // and the game stops to ask it; with one it is not a decision at all, so the
  // one who is left walks in. This lives here rather than in the screen that
  // draws it, because a co-op peer replaying the move has to reach the same
  // state as the peer that made it.
  askWhoGoesIn() {
    const x = this.state.expedition;
    const standing = this.standing();
    x.status = 'choosing';
    if (standing.length === 1) {
      this.choosePair(standing[0].uid);
      return;
    }
    this.emit();
  }

  // --- Whatever is living down here ---------------------------------------

  // Beating a creature clears its tile, so this cannot depend on the tile
  // being unresolved: the spoils screen still has to know what it beat. The
  // status machine decides when a choice is actually open.
  get wild() {
    const tile = this.tile;
    return tile && tile.kind === 'lair' ? tile.wild || null : null;
  }

  // Two people on one floor keep separate banks, so a shared action that
  // spent one of them would land differently on each machine and break the
  // lockstep. A shared quest pays out of the pack alone.
  get sharedQuest() {
    const x = this.state.expedition;
    return Boolean(x) && new Set(Object.values(x.owners)).size > 1;
  }

  // What the loot in your hands cannot cover, the bank does — a creature you
  // can afford at all is a creature you can have, whether you can afford it
  // the moment you meet it or only after two more rooms. The pack is spent
  // first, so carrying gold still means something down here.
  wildPayment(price) {
    const x = this.state.expedition;
    const fromPack = Math.min(x.pending.gold, price);
    const reachable = this.sharedQuest ? 0 : this.state.gold;
    return { fromPack, fromBank: price - fromPack, short: Math.max(0, price - fromPack - reachable) };
  }

  // A creature you met and walked past is still down there when the floor
  // ends, and a floor that ends is the last chance to go back for it. What is
  // banked is what can be spent: on a floor you climbed out of, that includes
  // everything you carried up; on one that beat you, it does not.
  strandedWild() {
    const x = this.state.expedition;
    if (!x || (x.status !== 'complete' && x.status !== 'failed') || this.sharedQuest) return null;
    // Only a creature the company actually stood in front of. This used to
    // look at every lair on the floor, so a retreat could offer to go back
    // for something nobody had ever found.
    const tile = Object.values(x.map.tiles).find((t) => t.kind === 'lair'
      && t.wild && t.wild.mode === 'befriend' && t.wild.met && t.state !== 'cleared');
    if (!tile) return null;
    return { key: tile.key, wild: tile.wild, afford: this.state.gold >= tile.wild.price };
  }

  claimWild() {
    const stranded = this.strandedWild();
    if (!stranded) throw new Error('there is nothing left to go back for');
    if (!stranded.afford) throw new Error('you cannot raise enough to interest it');
    const x = this.state.expedition;
    this.state.gold -= stranded.wild.price;
    x.map.tiles[stranded.key].state = 'cleared';
    this.adopt(stranded.wild.defId, 'is coaxed out on the way home');
    this.emit();
  }

  befriend() {
    const x = this.state.expedition;
    if (!x || x.status !== 'offer') throw new Error('there is nothing to coax here');
    const wild = this.tile.wild;
    const pay = this.wildPayment(wild.price);
    if (pay.short) throw new Error('you cannot raise enough to interest it');
    x.pending.gold -= pay.fromPack;
    this.state.gold -= pay.fromBank;
    this.adopt(wild.defId, pay.fromBank ? 'is bought with the last of the bank' : 'comes with you for a price');
    this.tile.state = 'cleared';
    x.status = 'exploring';
    this.emit();
  }

  // Walking away is not a decision — the creature stays in its lair, and the
  // offer is open again the moment you come back through with fuller pockets.
  leaveWild() {
    const x = this.state.expedition;
    if (!x || x.status !== 'offer') throw new Error('nothing to leave');
    this.note(`${companionDef(this.tile.wild.defId).name} settles back down. It will still be here.`, 'info');
    x.status = 'exploring';
    this.emit();
  }

  takeWild() {
    const x = this.state.expedition;
    if (!x || x.status !== 'spoils') throw new Error('nothing has been subdued');
    this.adopt(this.tile.wild.defId, 'is sent up to camp');
    x.status = 'exploring';
    this.emit();
  }

  takeBounty() {
    const x = this.state.expedition;
    if (!x || x.status !== 'spoils') throw new Error('nothing has been subdued');
    x.pending.gold += x.bounty;
    this.note(`${companionDef(this.tile.wild.defId).name} is left where it lies. ${x.bounty} gold goes into the pack.`, 'info');
    x.status = 'exploring';
    this.emit();
  }

  // Creatures go straight to camp rather than being carried out, so a run
  // that goes wrong later cannot cost you one.
  adopt(defId, how) {
    const companion = createCompanion(defId);
    this.state.roster.push(companion);
    this.note(`${companion.name}, ${companion.title}, ${how}.`, 'good');
    return companion;
  }

  // Two go in. A room is attempted by a pair, whose hands become one tray;
  // when only one of you can still stand up, that one goes in alone.
  choosePair(first, second = null) {
    const x = this.state.expedition;
    if (!x || x.status !== 'choosing') throw new Error('nothing to attempt');
    const uids = [first, second].filter(Boolean);
    if (!uids.length) throw new Error('somebody has to go');
    if (uids.length !== new Set(uids).size) throw new Error('one of them cannot be both');
    const going = uids.map((uid) => {
      const member = this.member(uid);
      if (!member || !x.partyUids.includes(uid)) throw new Error('not in the party');
      if (member.down) throw new Error('they are unconscious');
      return member;
    });
    const standing = this.standing();
    if (going.length < PARTY_PER_ROOM && standing.length >= PARTY_PER_ROOM) {
      throw new Error('two go in, while two can');
    }

    x.actorUids = going.map((m) => m.uid);
    // Whoever is a hero brings their trick, and the night's pool it comes out
    // of stays theirs — which is why the ability remembers who owns it.
    const abilities = [];
    going.filter((m) => m.isHero).forEach((m) => {
      const ability = heroAbility(m);
      if (!abilities.some((a) => a.id === ability.id)) abilities.push({ ...ability, uid: m.uid });
    });
    // And whatever the kit in the room knows, from whoever is wearing it.
    going.forEach((m) => {
      this.giftsOf(m).forEach((id) => {
        if (abilities.some((a) => a.id === id)) return;
        abilities.push({ ...ABILITIES[id], charges: 1, left: this.giftLeft(m, id), uid: m.uid, gift: true });
      });
    });
    const alone = going.length === 1 ? ALONE_DICE : 0;
    // A shrine's blessing is kept for something that fights back.
    const boon = this.tile.challenge.hazard ? 0 : x.boon;
    const winded = this.winded(going.map((m) => m.uid));
    x.encounter = new Encounter({
      challenge: this.tile.challenge,
      dice: assembleDice(going, boon + alone, winded),
      rng: x.rng,
      abilities,
    });
    // One more room without a rest for whoever went in; a room's rest for
    // everybody standing who did not.
    const inside = new Set(going.map((m) => m.uid));
    this.standing().forEach((m) => { m.streak = inside.has(m.uid) ? (m.streak || 0) + 1 : 0; });
    if (winded.size) {
      const tired = going.filter((m) => winded.has(m.uid))
        .map((m) => `${m.name} ${winded.get(m.uid)} ${winded.get(m.uid) === 1 ? 'die' : 'dice'} short`);
      this.note(`Winded, with somebody fresh left outside: ${tired.join(' and ')}.`, 'info');
    }
    if (boon) this.note(`The beacon's blessing adds ${boon} dice.`, 'good');
    if (alone) this.note(`${going[0].name} goes in alone, and fights like it: ${alone} dice more.`, 'info');
    if (boon) x.boon = 0;
    x.hopeless = false;
    x.status = 'encounter';
    // A hand too small for what the room asks is a room already lost, and the
    // engine says so the moment the dice are counted. Nobody should have to
    // play that out: it is settled here, before a die is thrown.
    if (x.encounter.status === 'lost') {
      const why = x.encounter.log[x.encounter.log.length - 1];
      this.note(`${this.who(going)} count the dice against ${named(this.tile.challenge)}. ${why ? why.text : 'The end was inevitable, nothing you had left could have defeated it.'}`, 'bad');
      this.resolveLoss();
    }
    this.emit();
    return x.encounter;
  }

  // Winded: every room somebody goes into without a room's rest in between
  // costs them a die in the next one, and it adds up — three rooms straight
  // and the fourth is three dice short. Sitting out a single room puts them
  // back at full strength. It is only charged when it was a choice: when
  // somebody fresh (standing, and not in a room since their last rest) is
  // being left outside. Send the fresh one in, or have nobody fresh to send,
  // and nobody pays — so a party of one or two, which never has anybody to
  // rotate to, never pays at all. The rule is there to make a bigger company
  // worth using, not to tax a small one.
  //
  // Returns a Map of uid -> dice lost, for whoever in `goingUids` pays.
  winded(goingUids = []) {
    const going = new Set(goingUids);
    const freshOutside = this.standing().some((m) => !m.streak && !going.has(m.uid));
    const out = new Map();
    if (!freshOutside) return out;
    goingUids.forEach((uid) => {
      const m = this.member(uid);
      if (m && m.streak) out.set(uid, m.streak);
    });
    return out;
  }

  // Everyone standing who is rested: not in a room since they last sat one out.
  fresh() {
    return this.standing().filter((m) => !m.streak);
  }

  // Kept for a single name: one person attempting a room alone.
  chooseActor(uid) {
    return this.choosePair(uid);
  }

  who(members) {
    const names = members.map((m) => m.name);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || 'nobody';
  }

  get actors() {
    const x = this.state.expedition;
    if (!x) return [];
    return (x.actorUids || []).map((uid) => this.member(uid)).filter(Boolean);
  }

  act(fn) {
    const x = this.state.expedition;
    if (!x || x.status !== 'encounter') throw new Error('no encounter in progress');
    fn(x.encounter);
    if (x.encounter.status === 'won') this.resolveWin();
    else if (x.encounter.status === 'lost') this.resolveLoss();
    this.emit();
  }

  match(dieIndex, slotIndex) { this.act((e) => e.match(dieIndex, slotIndex)); }
  discard(dieIndex) { this.act((e) => e.discard(dieIndex)); }
  reroll() { this.act((e) => e.reroll()); }
  // A trick comes out of the character's night, not the room's. The pool is
  // written back the moment it is spent, so it survives the encounter, the
  // floor and the save alike.
  useAbility(id, opts) {
    this.act((e) => {
      e.useAbility(id, opts);
      const used = e.ability(id);
      const owner = used && used.uid ? this.member(used.uid) : null;
      if (!owner || !used) return;
      if (used.gift) {
        // A gift's night is its own: written back on the copy and on the
        // person at home, so it is spent whatever happens to the floor.
        [owner, this.homeMember(owner.uid)].forEach((who) => {
          if (!who) return;
          who.gifts = { ...(who.gifts || {}), [id]: used.left };
        });
      } else if (owner.isHero) {
        owner.charges = used.left;
      }
    });
  }

  resolveWin() {
    const x = this.state.expedition;
    const depth = this.runDepth;
    const tile = this.tile;
    const rng = x.rng;
    const going = this.actors;
    const boss = tile.kind === 'boss';

    // Beating the floor pays nothing but the way through — and whatever was
    // in the chest the trap was guarding.
    if (tile.challenge && tile.challenge.hazard) {
      const def = hazardDef(tile.challenge.hazard);
      this.note(`${this.who(going)} ${def.kind === 'obstacle' ? 'get past' : 'come through'} the ${def.name.toLowerCase()} without a scratch.`, 'good');
      x.actorUids = [];
      x.fallen = null;
      this.clearHazard(tile);
      return;
    }

    const base = depth.gold + rng.range(0, Math.round(depth.gold / 2));
    const share = boss ? 3.5 : tile.kind === 'treasure' ? 2.5 : 1;
    // A lair pays nothing by itself: the creature or its bounty is the prize,
    // and that is a choice, not a payout.
    if (tile.kind === 'lair') x.bounty = Math.round(base * 2.5 * x.multiplier);
    else x.pending.gold += Math.round(base * share * x.multiplier);

    // Nobody is promoted for having been in the room. What the room pays is
    // lessons, into the company's pool, and they are carried out with the
    // gold — which means a run that ends badly teaches nothing at all.
    x.pending.training += lessonsWon(depth.depth, boss);

    // Some of what is down here is worn rather than spent. A hoard nearly
    // always holds a piece; a boss sometimes does; an ordinary room, rarely.
    this.findGear(tile.kind === 'treasure' ? 8 : boss ? 5 : 1);

    this.state.renown += boss ? depth.depth * 3 : depth.depth;
    tile.state = 'cleared';
    x.fallen = null;
    x.multiplier = Math.round((x.multiplier + 0.2) * 100) / 100;
    x.actorUids = [];
    x.encounter = null;

    if (boss) {
      // The Tower issues no seals: those are what a country gives for clearing
      // a floor that had a bottom, and they buy things meant to be earned out
      // there rather than farmed in here.
      if (depth.seal) x.pending.seals[depth.seal] += 1 + Math.floor(depth.depth / 3);
      const owned = new Set(this.state.roster.map((c) => c.defId));
      const drops = COMPANIONS.filter((c) => (c.rarity === 'rare' || c.rarity === 'epic') && !owned.has(c.id));
      if (drops.length && rng.chance(0.06 + depth.depth * 0.015)) {
        x.pending.companions.push(rng.pick(drops).id);
      }
      // A boss out here is the way home. In the Tower it is a landing, with
      // the floor's takings on it and the next floor over it.
      if (x.mode === 'tower') this.towerCleared();
      else this.bank(true);
      return;
    }
    x.status = tile.kind === 'lair' ? 'spoils' : 'exploring';
  }

  // Some of what is down here is worn rather than spent: `odds` in ten that a
  // piece of kit turns up.
  findGear(odds) {
    const x = this.state.expedition;
    const rng = x.rng;
    if (!this.hero || rng.range(1, 10) > odds) return null;
    // Up the Tower the grade is the floor's rather than the climber's,
    // which is the one thing in the game that hands out kit for getting
    // somewhere rather than for being somebody.
    const best = x.mode === 'tower' ? towerGrade(x.level) : tierFor(this.hero.level);
    const tier = rng.range(1, 10) > 7 ? Math.min(5, best + 1) : Math.max(1, best - rng.range(0, 1));
    const found = makePiece(rng.pick(kindsFor(this.hero ? this.hero.classId : 'fighter')), tier,
      { gift: rollGift(rng, tier) });
    x.pending.gear = [...(x.pending.gear || []), found];
    this.note(found.gift
      ? `${gearName(found)}, and there is something in it: it knows ${ABILITIES[found.gift].name}.`
      : `${gearName(found)}, down here with the rest of it.`, 'good');
    return found;
  }

  // A beaten companion goes down rather than ending the run. The floor is
  // only lost when there is nobody left standing — so party size is also how
  // many mistakes you can afford. The room keeps hold of you either way:
  // whoever is left has to walk back into the same room at once, and nobody
  // moves on or climbs out until it is cleared.
  resolveLoss() {
    const x = this.state.expedition;
    const going = this.actors;
    // The floor does not knock anybody out. It charges, and lets you by.
    if (this.tile.challenge && this.tile.challenge.hazard) {
      x.hopeless = false;
      this.payHazard(this.tile, going);
      x.actorUids = [];
      x.fallen = null;
      this.clearHazard(this.tile);
      return;
    }
    // Losing a room is what wears kit out, and now that the whole company can
    // be kitted it wears the kit of whoever was actually in the room. The
    // expedition works on copies, so the wear is put on the people at home.
    // Nothing in the Tower does: it takes the prize instead, which is the only
    // thing it ever takes, and a climb you can lose your kit on is a climb
    // nobody makes twice.
    if (x.mode !== 'tower') {
      going.forEach((m) => {
        const home = m && this.homeMember(m.uid);
        if (home && home.gear) this.damageGear(home);
      });
    }
    // Whether the room was lost by arithmetic or by a bad throw changes what
    // there is to say about it, and the encounter that knew is about to go.
    x.hopeless = Boolean(x.encounter && x.encounter.hopeless);
    x.encounter = null;

    // Two went in and one of them is not walking out. Which one is a decision
    // — protect the hero and spend the sellsword, or keep your best companion
    // on her feet — so the run stops and asks.
    if (going.length > 1) {
      x.status = 'falling';
      this.note(`${this.who(going)} are beaten by ${named(this.tile.challenge)}. One of them is not getting up.`, 'bad');
      this.emit();
      return;
    }
    this.takeTheFall(going[0] ? going[0].uid : null, true);
  }

  // Who goes down. Called by the player when two went in, and by the game
  // itself when only one did.
  takeTheFall(uid, forced = false) {
    const x = this.state.expedition;
    if (!x) throw new Error('nobody is underground');
    if (!forced && x.status !== 'falling') throw new Error('nobody is going down just now');
    const uids = x.actorUids || [];
    if (!forced && !uids.includes(uid)) throw new Error('they were not in that room');
    const fallen = this.member(uid);
    if (!fallen) throw new Error('no such member');

    fallen.down = true;
    x.actorUids = [];
    x.encounter = null;

    const standing = this.standing();
    if (!standing.length) {
      this.note(x.mode === 'tower'
        ? `${fallen.name} goes down, and there is nobody left standing on the ${ordinal(x.level)} floor. `
          + `The ${x.pending.gold} gold this floor paid stays where it is, and so does everything else.`
        : `${fallen.name} goes down, and there is nobody left to carry on. ${x.pending.gold} gold and everything the company learned is left where it lies.`,
        'bad');
      x.fallen = null;
      x.status = 'failed';
      this.emit();
      return;
    }
    this.note(
      `${fallen.name} goes down to ${named(this.tile.challenge)}. ${standing.length} still standing, and the room is not finished with you.`,
      'bad',
    );
    resetChallenge(this.tile.challenge);
    x.fallen = fallen.name;
    this.askWhoGoesIn();
  }

  // Everyone in the party still on their feet.
  standing() {
    const x = this.state.expedition;
    if (!x) return [];
    return x.partyUids.map((uid) => this.member(uid)).filter((m) => m && !m.down);
  }

  downed() {
    const x = this.state.expedition;
    if (!x) return [];
    return x.partyUids.map((uid) => this.member(uid)).filter((m) => m && m.down);
  }

  withdraw() {
    const x = this.state.expedition;
    if (!x || x.status !== 'exploring') throw new Error('you are in no position to withdraw');
    this.bank(false);
    this.emit();
  }

  bank(cleared) {
    const x = this.state.expedition;
    const depth = this.runDepth;
    this.state.gold += x.pending.gold;
    this.state.training += x.pending.training;
    Object.entries(x.pending.seals).forEach(([seal, n]) => { this.state.seals[seal] += n; });
    const found = x.pending.companions.map((defId) => {
      const companion = createCompanion(defId);
      this.state.roster.push(companion);
      return companion;
    });
    // Kit found below is carried out the same way the gold is: it is yours
    // when you climb out, and left down there if you do not.
    const kit = x.pending.gear || [];
    kit.forEach((piece) => this.take(piece));
    x.status = 'complete';
    x.cleared = cleared;
    const sealText = Object.entries(x.pending.seals).filter(([, n]) => n > 0)
      .map(([seal, n]) => `${n} ${SEALS[seal].name}`).join(', ');
    this.note(
      `${x.mode === 'tower'
        ? (cleared
          ? `Down out of the Clocktower from the ${ordinal(x.best)} floor`
          : `Down out of the Clocktower part way through the ${ordinal(x.level)} floor`)
        : cleared ? `${depth.name} is cleared` : `The company climbs out of ${depth.name}`}`
      + ` with ${x.pending.gold} gold${x.pending.training ? `, ${x.pending.training} lessons` : ''}${sealText ? ` and ${sealText}` : ''}.`,
      'good',
    );
    found.forEach((c) => this.note(`${c.name} was found below and joins you.`, 'good'));
    if (kit.length) this.note(`Carried out: ${kit.map((p) => gearName(p)).join(', ')}.`, 'good');
  }

  // Coming back up: keep what your own characters earned, leave the rest.
  endExpedition() {
    const x = this.state.expedition;
    if (x) {
      x.members.forEach((copy) => {
        if (!this.owns(copy.uid)) return;
        const home = this.homeMember(copy.uid);
        if (!home) return;
        // What was spent below comes off what they have now. Level and rank
        // are never written back: nobody is promoted on a floor, and a copy
        // of the character made before they trained must not undo it.
        const spent = (start, now) => (typeof start === 'number' && typeof now === 'number' ? start - now : 0);
        if (typeof home.charges === 'number') {
          home.charges = Math.max(0, home.charges - spent(copy.startCharges, copy.charges));
        }
        // Carried out cold: they come round at camp, good for nothing until
        // the company rests.
        home.stamina = copy.down ? 0 : Math.max(0, Math.min(MAX_STAMINA, home.stamina - spent(copy.startStamina, copy.stamina)));
        home.adventures = Math.max(home.adventures || 0, copy.adventures || 0);
      });
    }
    this.state.expedition = null;
    this.emit();
  }

  // --- Persistence --------------------------------------------------------

  // A floor in progress is part of the save. Without this a reload — a phone
  // putting the tab to sleep, a page republished under the player, a stray
  // refresh — threw away the run and everything it was carrying, which is a
  // harsher punishment than any room in the game.
  //
  // A shared floor is the exception: it lives in two browsers at once and one
  // of them cannot restore it alone, so it is not written down.
  packExpedition() {
    const x = this.state.expedition;
    if (!x || this.sharedQuest) return null;
    const { rng, encounter, depth, ...rest } = x;
    return {
      ...rest,
      rng: { seed: rng.seed, state: rng.state },
      encounter: encounter ? packEncounter(encounter) : null,
    };
  }

  // The save without its timestamp: what the character actually is.
  body() {
    const { expedition, savedAt, ...rest } = this.state;
    return { ...rest, expedition: this.packExpedition() };
  }

  toJSON() {
    return JSON.stringify({ ...this.body(), savedAt: this.state.savedAt || 0 });
  }

  // When this character last *changed* — not when it was last written down.
  // Two devices holding the same character settle their disagreement by this
  // and nothing else, so opening the game must not touch it: a fresh browser
  // that has only ever loaded would otherwise look newer than the real save
  // sitting in the store, and would overwrite it with nothing.
  stamp(at = Date.now()) {
    // Never backward, and never the same twice: two changes inside one
    // millisecond still order the way they happened.
    this.state.savedAt = Math.max(at, (this.state.savedAt || 0) + 1);
    return this.state.savedAt;
  }

  // Take up a save that came from somewhere else — the same character as
  // written down on another device. The state is swapped whole rather than
  // merged: a half-adopted character is nobody.
  adoptSave(raw) {
    const fresh = Game.load({ getItem: () => raw, setItem: () => {} }, this.saveKey);
    if (!fresh) return false;
    this.state = fresh.state;
    // This character is now exactly the one that arrived, timestamp included:
    // adopting is not a change, and must not claim to be a newer one.
    this.written = JSON.stringify(this.body());
    this.emit();
    return true;
  }

  save(storage = globalThis.localStorage) {
    const body = JSON.stringify(this.body());
    if (body !== this.written) {
      this.stamp();
      this.written = body;
    }
    if (!storage) return;
    try { storage.setItem(this.saveKey, this.toJSON()); } catch { /* private mode */ }
  }

  static load(storage = globalThis.localStorage, saveKey = saveKeyFor()) {
    if (!storage) return null;
    let raw;
    try { raw = storage.getItem(saveKey); } catch { return null; }
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data.version !== 2) return null;
      const floor = data.expedition;
      data.expedition = null;
      data.seals = { ...emptySeals(), ...data.seals };
      data.roster = data.roster || [];
      // Saves written before the pool existed carry xp on each character.
      // Nobody loses what they earned: it is swept into the company's pool,
      // where the player gets to decide what it was for.
      data.training = data.training || 0;
      [data.hero, ...data.roster].forEach((member) => {
        if (!member || !member.xp) return;
        data.training += member.xp;
        delete member.xp;
      });
      // Saves written while ids were a counter can already hold two pieces
      // that answer to the same name. Every piece on the way in is checked
      // against the ones before it, and a clash is given a new id — which is
      // safe, because nothing else in the save refers to a piece by id except
      // the sockets, and those name dice rather than pieces.
      const seen = new Set();
      const racks = [data.hero, ...(data.roster || [])].filter(Boolean);
      const everyPiece = [
        ...racks.flatMap((who) => SLOT_IDS.map((slot) => who.gear && who.gear[slot])),
        ...(Array.isArray(data.bag) ? data.bag : []),
        ...(data.hero && Array.isArray(data.hero.bag) ? data.hero.bag : []),
        ...Object.values(data.stock || {}).flat(),
      ].filter(Boolean);
      everyPiece.forEach((piece) => {
        if (!piece.id || seen.has(piece.id)) piece.id = pieceId();
        seen.add(piece.id);
      });
      // A save that predates the nightly bill has books to settle; one written
      // since does not. The flag is what tells the two apart, and the player
      // is offered the sum rather than charged it.
      if (data.settled === undefined) data.settled = false;
      // The pack used to hang off the character. It is the company's pool now,
      // so a save that kept it on the hero hands it over on the way in.
      data.bag = Array.isArray(data.bag) ? data.bag : [];
      if (data.hero && Array.isArray(data.hero.bag)) {
        data.bag = [...data.bag, ...data.hero.bag];
        delete data.hero.bag;
      }
      // Companions written down before anybody could hand them a sword get a
      // rack on the way in; the creatures stay as they are, because they have
      // no hands for it.
      data.roster.forEach((member) => {
        if (member && member.gear === undefined) member.gear = isWild(member.defId) ? null : emptyRack();
      });
      // Early saves gave every hero the same id, which collides in a shared
      // quest. Give those characters a real one on the way in.
      if (data.hero && data.hero.uid === 'hero') data.hero.uid = heroUid();
      repairHero(data.hero, data.bag);
      const game = new Game(data, { saveKey });
      // Anything at all wrong with a stored floor and the player comes back to
      // camp instead — losing a run is bad, but coming back to a broken one is
      // worse.
      try {
        if (floor) game.state.expedition = unpackExpedition(floor);
      } catch {
        game.state.expedition = null;
      }
      // Loading is not changing: remember the body as it was written down, so
      // the first save of a session does not stamp a character nobody has
      // touched and make this browser look newer than it is.
      game.written = JSON.stringify(game.body());
      return game;
    } catch {
      return null;
    }
  }
}
