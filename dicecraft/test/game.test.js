import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALONE_DICE, Game, PARTY_PER_ROOM, assembleDice, canAfford, companionDice,
  createCompanion, forgetProfile, listProfiles, newGameState, nextProfileId,
  SAVE_KEY, saveKeyFor,
} from '../js/game.js';
import {
  COMPANIONS, MAX_RANK, MAX_STAMINA, RECRUIT_COST, WILD_COMPANIONS, WILD_COST,
  HUNGER_LEAVES, HUNGER_WARNINGS, isWild, partyCapForRenown, powerDiceForRank, upkeepOf,
} from '../js/data.js';
import { makePiece } from '../js/gear.js';
import { basicDiceForRank } from '../js/dice.js';
import { depthByNumber } from '../js/settings.js';
import { PATH_LEVEL, abilityLeft, abilityMax } from '../js/hero.js';
import { ZONES, zoneById } from '../js/world.js';
import { lessonsWon, trainingCost } from '../js/training.js';

function started(classId = 'fighter', level = 1) {
  const g = new Game(newGameState());
  g.createCharacter('Wren', classId);
  g.hero.level = level;
  return g;
}

// Plays out whatever is in front of the party with omniscient dice, so the
// meta-game can be tested without fighting the random number generator.
// Two go in whenever two can stand; one goes alone when that is all there is.
// The game walks a lone member in by itself, so a test that wants to name the
// one who goes has to check there is still a choice to make.
function enter(g, uid) {
  return g.expedition.status === 'choosing' ? g.chooseActor(uid) : null;
}

function sendIn(g, lead = g.hero.uid) {
  const x = g.expedition;
  // One on their feet is not a choice, and the game has already walked them
  // in by the time this is called.
  if (x.status !== 'choosing') return null;
  const standing = x.partyUids.map((uid) => g.member(uid)).filter((m) => m && !m.down);
  const first = standing.find((m) => m.uid === lead) || standing[0];
  const second = standing.find((m) => m.uid !== first.uid);
  return g.choosePair(first.uid, second ? second.uid : null);
}

// Spends the whole hand on a challenge nothing can answer. Only one die goes
// in the bin per round, so each throw-away is followed by another throw.
function burnDown(g) {
  const x = g.expedition;
  while (x.status === 'encounter') {
    x.encounter.tray.forEach((entry) => { entry.face = null; });
    g.discard(0);
    if (x.status === 'encounter' && x.encounter.legalActions().canReroll) g.reroll();
  }
}

function forceWin(g) {
  while (g.expedition.status === 'encounter') {
    g.expedition.encounter.tray.forEach((entry) => { entry.face = 'wild'; });
    const [pair] = g.expedition.encounter.availableMatches();
    g.match(pair.dieIndex, pair.slotIndex);
  }
}

test('a run begins with a hero and nobody else', () => {
  const g = started('cleric');
  assert.equal(g.hero.name, 'Wren');
  assert.equal(g.hero.classId, 'cleric');
  assert.equal(g.state.roster.length, 0);
  assert.equal(g.partyCap, 1);
  assert.equal(g.companionSlots, 0);
  assert.throws(() => g.createCharacter('Other', 'mage'), /already have/);
});

test('party size is gated on renown, and the hero always holds a place', () => {
  assert.equal(partyCapForRenown(0), 1);
  assert.equal(partyCapForRenown(20), 2);
  assert.equal(partyCapForRenown(140), 4);
  const g = started();
  g.state.renown = 60;
  assert.equal(g.partyCap, 3);
  assert.equal(g.companionSlots, 2);
});

test('the hero cannot be dismissed', () => {
  const g = started();
  assert.throws(() => g.dismiss(g.hero.uid), /cannot dismiss yourself/);
});

test('a companion carries basic dice plus its rank power dice', () => {
  const c = createCompanion('ranger');
  assert.equal(companionDice(c).length, basicDiceForRank(1) + powerDiceForRank(1).length);
  c.rank = 30;
  assert.equal(companionDice(c).length, basicDiceForRank(30) + Math.min(4, powerDiceForRank(30).length));
});

test('a pair throws both hands as one tray, and a shrine boon adds more', () => {
  const one = createCompanion('sellsword');
  const two = createCompanion('acolyte');
  const alone = assembleDice([one]).length;
  const together = assembleDice([one, two]).length;
  assert.equal(together, alone + companionDice(two).length, 'both hands, nothing lent and nothing lost');
  assert.equal(assembleDice([one, two], 2).length, together + 2, 'and the shrine adds to the pile');
  // A die still knows whose it is, which is what lets the tray be read.
  const owners = new Set(assembleDice([one, two]).map((d) => d.ownerId));
  assert.deepEqual([...owners].sort(), [one.uid, two.uid].sort());
  assert.equal(assembleDice(one).length, alone, 'one person on their own is still a hand');
});

test('resting restores everyone, advances the day and refreshes the hall', () => {
  const g = started();
  g.hero.stamina = 1;
  const before = g.hallOf('reach').join(',');
  g.rest();
  assert.equal(g.state.day, 2);
  assert.equal(g.hero.stamina, MAX_STAMINA);
  assert.ok(g.hallOf('reach').length > 0, 'the hall you know about still has faces in it');
  assert.ok(before.length > 0);
});

test('each country hires its own sort, and a hall fills the first time you walk in', () => {
  const g = started();
  assert.deepEqual(g.state.recruits, {}, 'no hall is rolled until somebody walks into one');
  const reach = g.hallOf('reach');
  const spires = g.hallOf('spirelands');
  assert.equal(reach.length, 3);
  assert.deepEqual(g.hallOf('reach'), reach, 'and what is on offer stays on offer until the night');
  const zoneHires = (id) => zoneById(id).hires;
  reach.forEach((id) => assert.ok(zoneHires('reach').includes(id), `${id} does not drink in Amberport`));
  spires.forEach((id) => assert.ok(zoneHires('spirelands').includes(id), `${id} does not drink in the Spirelands`));
  assert.ok(ZONES.every((z) => z.hires.length >= 5), 'every hall has a crowd to draw on');
});

test('recruiting costs gold and seals, and refuses what you cannot pay for', () => {
  const g = started();
  g.state.recruits = { reach: ['sellsword'] };
  g.state.gold = RECRUIT_COST.common.gold;
  g.recruit('sellsword', 'reach');
  assert.equal(g.state.gold, 0);
  assert.equal(g.state.roster.length, 1);
  assert.throws(() => g.recruit('sellsword', 'reach'), /not on offer/);
  assert.throws(() => g.recruit('sellsword', 'mire'), /not on offer/, 'and a hall two countries away never had them');

  g.state.recruits = { spirelands: ['paladin'] };
  g.state.gold = 100000;
  assert.equal(canAfford(g.state, 'rare'), false);
  assert.throws(() => g.recruit('paladin', 'spirelands'), /cannot pay/);
});

test('an expedition spends stamina, builds a floor and refuses an exhausted party', () => {
  const g = started();
  const x = g.startExpedition(1, [], 42);
  assert.equal(g.hero.stamina, MAX_STAMINA - depthByNumber(1).stamina);
  assert.ok(Object.keys(x.map.tiles).length >= 6);
  assert.equal(x.status, 'exploring');
  assert.throws(() => g.startExpedition(1, [], 1), /already underground/);
  g.endExpedition();
  g.hero.stamina = 0;
  assert.throws(() => g.startExpedition(1, [], 42), /too worn/);
});

test('sealed floors and oversized parties are refused', () => {
  const g = started();
  assert.throws(() => g.startExpedition(6, [], 1), /sealed/);
  const c = createCompanion('sellsword');
  g.state.roster.push(c);
  assert.throws(() => g.startExpedition(1, [c.uid], 1), /renown/);
});

test('you may only walk to a joined tile, and empty ones cost nothing', () => {
  const g = started();
  const x = g.startExpedition(1, [], 42);
  const here = x.map.tiles[x.map.position];
  const stranger = Object.values(x.map.tiles).find((t) => !here.links.includes(t.key) && t.key !== here.key);
  if (stranger) assert.throws(() => g.move(stranger.key), /no way through/);
  const next = g.move(here.links[0]);
  assert.equal(x.map.position, next.key);
  assert.equal(['exploring', 'choosing', 'encounter'].includes(x.status), true);
});

test('stepping into a room opens it and then hands you the dice', () => {
  const g = started('fighter', 8);
  const x = g.startExpedition(3, [], 5);
  const room = walkTo(g, (t) => t.kind === 'room');
  assert.ok(room, 'the floor should have a room somewhere');
  // Alone, there is nobody to choose between: the room has you already.
  assert.equal(x.status, 'encounter');
  assert.throws(() => g.move(x.map.position), /cannot move just now/);
  assert.ok(x.encounter.diceLeft > 0);
});

// Walks the floor to the nearest tile matching `want`, clearing any room it
// has to pass through on the way, and stops *on* the target without resolving
// it so the caller can drive that encounter itself.
function walkTo(g, want) {
  const x = g.expedition;
  const seen = new Set([x.map.position]);
  const queue = [x.map.position];
  const parent = {};
  let target = null;
  while (queue.length) {
    const key = queue.shift();
    if (key !== x.map.position && want(x.map.tiles[key])) { target = key; break; }
    x.map.tiles[key].links.forEach((k) => {
      if (!seen.has(k)) { seen.add(k); parent[k] = key; queue.push(k); }
    });
  }
  if (!target) return null;
  const path = [];
  for (let k = target; k !== x.map.position; k = parent[k]) path.unshift(k);
  for (const k of path) {
    if (x.status !== 'exploring') return null;
    g.move(k);
    if (k !== target && (x.status === 'choosing' || x.status === 'encounter')) {
      sendIn(g);
      forceWin(g);
    }
  }
  return x.map.position === target ? x.map.tiles[target] : null;
}

test('a hero brings their class ability into an encounter, a companion does not', () => {
  const g = started('mage', 8);
  g.startExpedition(3, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  assert.equal(g.expedition.encounter.abilities.length, 1);
  assert.equal(g.expedition.encounter.abilities[0].id, 'transmute');
});

test('clearing a room banks nothing yet but raises the multiplier', () => {
  const g = started('fighter', 8);
  const x = g.startExpedition(3, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  forceWin(g);
  assert.equal(x.status, 'exploring');
  assert.ok(x.pending.gold > 0);
  assert.equal(g.state.gold, 60, 'nothing is banked while you are still down there');
  assert.equal(x.multiplier, 1.2);
  assert.ok(x.pending.training > 0, 'the room pays the pool');
  assert.equal(g.state.training, 0, 'and none of it is the company\'s until you surface');
  assert.equal(g.member(g.hero.uid).level, g.hero.level, 'nobody rose for having stood there');
});

test('withdrawing banks the pending loot', () => {
  const g = started('fighter', 8);
  const x = g.startExpedition(3, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  forceWin(g);
  const pending = x.pending.gold;
  g.withdraw();
  assert.equal(x.status, 'complete');
  assert.equal(x.cleared, false);
  assert.equal(g.state.gold, 60 + pending);
});

test('losing a room forfeits everything not yet banked', () => {
  const g = started('fighter', 8);
  const x = g.startExpedition(3, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  x.pending.gold = 500;
  burnDown(g);
  assert.equal(x.status, 'failed');
  assert.equal(g.state.gold, 60);
  assert.throws(() => g.withdraw(), /in no position/);
});

test('a shrine restores vigor and blesses the next encounter with extra dice', () => {
  const g = started('fighter', 12);
  const x = g.startExpedition(4, [], 5);
  const inParty = g.member(g.hero.uid);
  inParty.stamina = 1;
  const shrine = walkTo(g, (t) => t.kind === 'shrine');
  if (!shrine) return; // not every seed lays one down
  assert.equal(inParty.stamina, 3);
  assert.equal(x.boon, 2);
  const room = walkTo(g, (t) => t.kind === 'room' && t.state !== 'cleared');
  if (!room) return;
  const before = assembleDice([inParty]).length;
  sendIn(g);
  // Alone on this floor, so the hand, the blessing and the dice of going in
  // by yourself all land in the same tray.
  assert.equal(x.encounter.diceLeft, before + 2 + ALONE_DICE);
  assert.equal(x.boon, 0, 'the blessing is spent');
});

test('beating the boss banks everything and ends the expedition', () => {
  const g = started();
  const x = g.startExpedition(1, [], 42);
  walkTo(g, (t) => t.kind === 'boss');
  sendIn(g);
  forceWin(g);
  assert.equal(x.status, 'complete');
  assert.equal(x.cleared, true);
  assert.ok(g.state.gold > 60);
  assert.ok(g.state.seals.stag > 0);
  assert.ok(g.state.renown > 0);
});

test('levelling to 3 puts a path choice in front of the player', () => {
  const g = started('rogue');
  assert.equal(g.needsPathChoice, false);
  g.hero.level = PATH_LEVEL;
  assert.equal(g.needsPathChoice, true);
  g.choosePath('shadow');
  assert.equal(g.needsPathChoice, false);
  assert.equal(g.hero.pathId, 'shadow');
});

function memoryStore() {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
}

test('a save round-trips, and the floor you are standing on comes back with it', () => {
  const storage = memoryStore();
  const g = started('paladin');
  g.state.gold = 777;
  const x = g.startExpedition(1, [], 16);
  walkTo(g, (t) => t.kind === 'passage' || t.kind === 'room');
  x.pending.gold = 240;
  const where = x.map.position;
  const seen = Object.values(x.map.tiles).filter((t) => t.state !== 'hidden').length;
  g.save(storage);

  const loaded = Game.load(storage);
  assert.equal(loaded.state.gold, 777);
  assert.equal(loaded.hero.classId, 'paladin');
  const back = loaded.expedition;
  assert.ok(back, 'the run is still there');
  assert.equal(back.depthNumber, 1);
  assert.equal(back.map.position, where, 'standing where you were');
  assert.equal(back.pending.gold, 240, 'still carrying what you had');
  assert.equal(Object.values(back.map.tiles).filter((t) => t.state !== 'hidden').length, seen);
  assert.equal(typeof back.rng.next, 'function', 'and the dice carry on from where they were');
});

test('a floor reloaded mid-encounter keeps the dice in hand', () => {
  const storage = memoryStore();
  const g = started('fighter', 6);
  const x = g.startExpedition(1, [], 21);
  const room = walkTo(g, (t) => t.kind === 'room');
  if (!room) return;
  sendIn(g);
  const e = x.encounter;
  const before = { rounds: e.rounds, tray: e.tray.map((t) => t.face), left: e.diceLeft, trial: e.trialIndex };
  g.save(storage);

  const loaded = Game.load(storage);
  const after = loaded.expedition.encounter;
  assert.ok(after, 'the encounter is still open');
  assert.equal(after.rounds, before.rounds);
  assert.deepEqual(after.tray.map((t) => t.face), before.tray, 'the same faces on the table');
  assert.equal(after.diceLeft, before.left);
  assert.equal(after.trialIndex, before.trial);
  assert.equal(after.challenge, loaded.tile.challenge, 'and it is the room the map shows');

  // The restored encounter is a working one: spending a die still removes it
  // from the pool, which only holds if the tray and the pool share their dice.
  const matches = after.availableMatches();
  if (matches.length) {
    loaded.match(matches[0].dieIndex, matches[0].slotIndex);
  } else {
    loaded.discard(0);
  }
  assert.equal(after.diceLeft, before.left - 1, 'a spent die really leaves the hand');
});

test('the same seed carries on, so a reloaded floor rolls what it would have', () => {
  const storage = memoryStore();
  const g = started('fighter', 6);
  g.startExpedition(1, [], 33);
  const rng = g.expedition.rng;
  rng.next(); rng.next(); rng.next();
  const wouldBe = [rng.next(), rng.next()];

  // Save from the state *before* those two draws by rewinding a copy: save,
  // load, and the loaded generator must produce the same next numbers.
  const fresh = started('fighter', 6);
  fresh.startExpedition(1, [], 33);
  fresh.expedition.rng.next(); fresh.expedition.rng.next(); fresh.expedition.rng.next();
  fresh.save(storage);
  const loaded = Game.load(storage);
  assert.deepEqual([loaded.expedition.rng.next(), loaded.expedition.rng.next()], wouldBe);
});

test('a shared floor is not written down, since one browser cannot restore it', () => {
  const storage = memoryStore();
  const g = started('fighter', 6);
  const hero = g.hero;
  g.beginExpedition({
    depthNumber: 1,
    seed: 4,
    members: [hero],
    owners: { [hero.uid]: 'peer-a', other: 'peer-b' },
    localPeer: 'peer-a',
  });
  g.save(storage);
  assert.equal(Game.load(storage).state.expedition, null);
});

test('a corrupt or stale save is ignored rather than crashing', () => {
  assert.equal(Game.load({ getItem: () => '{not json', setItem: () => {} }), null);
  assert.equal(Game.load({ getItem: () => JSON.stringify({ version: 1 }), setItem: () => {} }), null);
});

test('save profiles keep two characters apart in one browser', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const one = new Game(newGameState(), { saveKey: saveKeyFor('1') });
  one.createCharacter('Ayla', 'fighter');
  one.save(storage);
  const two = new Game(newGameState(), { saveKey: saveKeyFor('2') });
  two.createCharacter('Brin', 'cleric');
  two.save(storage);

  assert.equal(Game.load(storage, saveKeyFor('1')).hero.name, 'Ayla');
  assert.equal(Game.load(storage, saveKeyFor('2')).hero.name, 'Brin');
  assert.equal(store.size, 2);
});

test('a profile name cannot escape its own key', () => {
  assert.equal(saveKeyFor('../../etc'), `${SAVE_KEY}:etc`);
  assert.equal(saveKeyFor(''), `${SAVE_KEY}:1`);
});

test('a save from before heroes had unique ids is repaired on load', () => {
  const g = new Game(newGameState());
  g.createCharacter('Old', 'fighter');
  g.hero.uid = 'hero';
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  g.save(storage);
  const loaded = Game.load(storage, g.saveKey);
  assert.notEqual(loaded.hero.uid, 'hero');
  assert.equal(loaded.hero.name, 'Old');
});

test('the save namespace does not follow the title, so renaming the game is safe', async () => {
  const { TITLE, STORAGE } = await import('../js/brand.js');
  assert.ok(SAVE_KEY.startsWith(`${STORAGE}.`));
  assert.equal(SAVE_KEY.toLowerCase().includes(TITLE.toLowerCase().replace(/\s+/g, '')), false);
});

test('a character must be named, and the name is tidied', () => {
  const g = new Game(newGameState());
  assert.throws(() => g.createCharacter('   ', 'paladin'), /needs a name/);
  g.createCharacter('  Dame   Yvane  ', 'paladin');
  assert.equal(g.hero.name, 'Dame Yvane');
  assert.equal(g.hero.classId, 'paladin');
});

test('a character can be renamed later', () => {
  const g = started();
  g.renameHero('Wren Ashdown');
  assert.equal(g.hero.name, 'Wren Ashdown');
  assert.throws(() => g.renameHero('  '), /needs a name/);
  assert.equal(g.hero.name, 'Wren Ashdown', 'a refused rename changes nothing');
});

test('renaming mid-expedition renames the character on the floor too', () => {
  const g = started();
  g.startExpedition(1, [], 4);
  g.renameHero('Someone Else');
  assert.equal(g.member(g.hero.uid).name, 'Someone Else');
  g.endExpedition();
  assert.equal(g.hero.name, 'Someone Else');
});

test('a very long name is cut rather than allowed to break the layout', () => {
  const g = started();
  g.renameHero('x'.repeat(200));
  assert.equal(g.hero.name.length, 28);
});

function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('the character roster is read straight out of storage', () => {
  const storage = fakeStorage();
  const one = new Game(newGameState(), { saveKey: saveKeyFor('1') });
  one.createCharacter('Ayla', 'fighter');
  one.state.gold = 240;
  one.save(storage);
  const three = new Game(newGameState(), { saveKey: saveKeyFor('3') });
  three.createCharacter('Brin', 'paladin');
  three.save(storage);
  storage.setItem('something.else', 'not ours');

  const profiles = listProfiles(storage);
  assert.deepEqual(profiles.map((p) => p.id), ['1', '3'], 'only our own keys, in order');
  assert.equal(profiles[0].hero.name, 'Ayla');
  assert.equal(profiles[0].gold, 240);
  assert.equal(profiles[1].hero.classId, 'paladin');
});

test('slots are numbered naturally, not as strings', () => {
  const storage = fakeStorage();
  ['2', '10'].forEach((id) => {
    const g = new Game(newGameState(), { saveKey: saveKeyFor(id) });
    g.createCharacter(`Hero ${id}`, 'rogue');
    g.save(storage);
  });
  assert.deepEqual(listProfiles(storage).map((p) => p.id), ['2', '10']);
});

test('a new character takes the first free slot', () => {
  assert.equal(nextProfileId([]), '1');
  assert.equal(nextProfileId([{ id: '1' }, { id: '2' }]), '3');
  assert.equal(nextProfileId([{ id: '2' }]), '1', 'a gap is filled before the end');
});

test('an unreadable slot still counts as taken rather than being handed out again', () => {
  const storage = fakeStorage({ [saveKeyFor('1')]: '{broken' });
  const profiles = listProfiles(storage);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].hero, null);
  assert.equal(nextProfileId(profiles), '2');
});

test('forgetting a character removes only that slot', () => {
  const storage = fakeStorage();
  ['1', '2'].forEach((id) => {
    const g = new Game(newGameState(), { saveKey: saveKeyFor(id) });
    g.createCharacter(`Hero ${id}`, 'cleric');
    g.save(storage);
  });
  forgetProfile('1', storage);
  assert.deepEqual(listProfiles(storage).map((p) => p.id), ['2']);
});

test('listing survives storage being blocked outright', () => {
  const blocked = { get length() { throw new Error('denied'); }, key: () => null, getItem: () => null, setItem: () => {} };
  assert.deepEqual(listProfiles(blocked), []);
  assert.deepEqual(listProfiles(null), []);
});

// --- Creatures found on a floor ---------------------------------------------

// Finds a seed whose floor holds a lair of the wanted kind, then walks to it.
// One run up to the door of a lair of the given kind, or null if this seed
// has no such lair or no way to walk to it.
function lairRun(mode, depth, level, seed) {
  const g = started('fighter', level);
  g.startExpedition(depth, [], seed);
  const den = Object.values(g.expedition.map.tiles).find((t) => t.kind === 'lair' && t.wild.mode === mode);
  if (!den) { g.endExpedition(); return null; }
  const tile = walkTo(g, (t) => t.kind === 'lair');
  if (!tile) { g.endExpedition(); return null; }
  return { g, tile };
}

// A lair the party can actually attempt.
//
// A hand too small for what the room asks is settled before a die is thrown,
// so a seed that hands back a hopeless fight makes the test that follows
// prove nothing. The seed is walked twice: once to find out whether the fight
// is winnable at all, and then again from scratch to hand back a lair nobody
// has stepped into yet. The floor is the same both times because the seed is.
function withLair(mode, depth = 4, level = 12) {
  for (let seed = 0; seed < 400; seed++) {
    const probe = lairRun(mode, depth, level, seed);
    if (!probe) continue;
    // A creature that will be reasoned with has no fight to lose, so there is
    // nothing to probe; one that will not does, and a hopeless one is no use.
    if (mode === 'subdue') {
      sendIn(probe.g);
      if (probe.g.expedition.status === 'failed') continue;
    }
    return lairRun(mode, depth, level, seed);
  }
  throw new Error(`no winnable ${mode} lair found in 400 seeds`);
}

test('the company eats every night, and a worn one is bedded on top of that', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'), createCompanion('squire'));
  g.state.gold = 1000;
  g.hero.stamina = 2;
  g.state.roster[0].stamina = 3;
  g.state.roster[1].stamina = MAX_STAMINA;

  const food = g.upkeep();
  assert.ok(food > 0, 'two mouths are not free');
  assert.equal(g.restCost(), 5, 'only the one who needs the night is charged for a bed');
  g.rest();
  assert.equal(g.hero.stamina, MAX_STAMINA, 'your own character sleeps for nothing');
  assert.equal(g.state.roster[0].stamina, MAX_STAMINA);
  assert.equal(g.state.gold, 1000 - food - 5, 'supper for both, a bed for one');
  assert.equal(g.restCost(), 0, 'nobody is owed a bed now');
  const before = g.state.gold;
  g.rest();
  assert.equal(g.state.gold, before - food, 'and a night with nobody weary still costs supper');
});

test('a bigger company is a bigger bill, whether or not it goes anywhere', () => {
  const g = started();
  assert.equal(g.upkeep(), 0, 'nobody to feed');
  g.state.roster.push(createCompanion('sellsword'));
  const one = g.upkeep();
  g.state.roster.push(createCompanion('squire'), createCompanion('acolyte'));
  assert.equal(g.upkeep(), one * 3, 'three of them at the same rank cost three times as much');
  g.state.roster[0].rank = 20;
  assert.ok(g.upkeep() > one * 3, 'and a veteran eats better than a novice');
  // The point of it: a roster past the party you can take is a standing bill.
  assert.ok(g.state.roster.length > g.companionSlots, 'more hired than can go');
});

test('a light purse beds the worst worn first and leaves the rest tired', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'), createCompanion('squire'), createCompanion('acolyte'));
  const [weariest, middling, freshest] = g.state.roster;
  weariest.stamina = 1;
  middling.stamina = 4;
  freshest.stamina = 7;
  g.hero.stamina = 0;
  g.state.gold = g.upkeep() + 12; // supper, then two nights' worth of the three owed

  assert.equal(g.restCost(), 15);
  const day = g.state.day;
  g.rest();
  assert.equal(g.state.day, day + 1, 'the night happens either way');
  assert.equal(g.hero.stamina, MAX_STAMINA, 'and you are rested whatever the purse says');
  assert.equal(weariest.stamina, MAX_STAMINA);
  assert.equal(middling.stamina, MAX_STAMINA);
  assert.equal(freshest.stamina, 7, 'the one who could still march goes without');
  assert.equal(g.state.gold, 2, 'paid for two beds, not three');
});

test('resting with nothing in the purse still turns the day, and somebody goes hungry', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'));
  g.state.gold = 0;
  g.hero.stamina = 1;
  g.state.roster[0].stamina = 6;
  g.rest();
  assert.equal(g.hero.stamina, MAX_STAMINA);
  assert.equal(g.state.roster[0].stamina, 3, 'unfed, and in no state to follow you down');
  assert.equal(g.state.gold, 0);
});

test('a short rest is your own bedroll: nobody else wakes better, but they still eat', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'), createCompanion('squire'));
  g.hero.stamina = 1;
  g.state.roster[0].stamina = 2;
  g.state.roster[1].stamina = 3;
  g.state.gold = 500;
  const day = g.state.day;
  const food = g.upkeep();

  g.shortRest();
  assert.equal(g.hero.stamina, MAX_STAMINA, 'you wake fresh');
  assert.equal(g.state.gold, 500 - food, 'it buys nobody a bed, but supper is supper');
  assert.equal(g.state.roster[0].stamina, 2, 'the company is no better for it');
  assert.equal(g.state.roster[1].stamina, 3);
  assert.equal(g.state.day, day + 1, 'but a day still goes by');
  assert.equal(g.restCost(), 10, 'and the long rest is still owed');

  g.rest();
  assert.equal(g.state.roster[0].stamina, MAX_STAMINA, 'which the long rest then pays for');
  assert.equal(g.state.gold, 500 - food * 2 - 10, 'two suppers and two beds');
});

test('neither rest happens with a floor unfinished', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  assert.throws(() => g.rest(), /finish what you started/);
  assert.throws(() => g.shortRest(), /finish what you started/);
});

test('a room nobody can answer is called as they step in, not played out', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  const room = walkTo(g, (t) => t.kind === 'room');
  if (!room) return;
  // More symbols than the party could ever spend dice on.
  room.challenge.trials = [Array.from({ length: 40 }, () => 'might')].map((required) => ({
    required, matched: required.map(() => false),
  }));

  const actor = g.standing()[0];
  sendIn(g, actor.uid);
  assert.equal(x.encounter, null, 'no dice are thrown for it');
  assert.equal(x.status, 'falling', 'the pair is beaten before a die is thrown');
  g.takeTheFall(actor.uid);
  assert.equal(actor.down, true, 'and the one you pick is the one who stays down');
  assert.equal(x.status, 'failed', 'the one left is walked in, beaten too, and the floor is lost');
  assert.match(g.state.log[1].text, /not getting up|could have defeated it/);
});

test('creatures found on a floor are never on offer in the guild hall', () => {
  const g = started();
  for (let day = 0; day < 40; day++) {
    g.state.renown = day * 8;
    g.rest();
    ZONES.forEach((zone) => g.hallOf(zone.id)
      .forEach((id) => assert.equal(isWild(id), false, `${id} should not reach the hall`)));
  }
  assert.ok(WILD_COMPANIONS.length > 0);
  WILD_COMPANIONS.forEach((c) => assert.equal(COMPANIONS.some((h) => h.id === c.id), false));
});

test('a wild costs less than a hall recruit of the same rarity, and never seals', () => {
  Object.entries(WILD_COST).forEach(([rarity, price]) => {
    assert.ok(price < RECRUIT_COST[rarity].gold, `${rarity} should be cheaper found than hired`);
  });
  assert.equal(Object.keys(WILD_COST).includes('common'), false, 'nothing common lives down there');
});

test('a wary creature is paid for out of the pack first, and goes straight to camp', () => {
  const { g, tile } = withLair('befriend');
  const x = g.expedition;
  assert.equal(x.status, 'offer');
  assert.equal(g.wild.defId, tile.wild.defId);

  x.pending.gold = tile.wild.price + 40;
  g.state.gold = 500;
  g.befriend();
  assert.equal(x.pending.gold, 40, 'the price comes out of the pack');
  assert.equal(g.state.gold, 500, 'and the bank is only touched when the pack is short');
  assert.equal(g.state.roster.length, 1);
  assert.equal(g.state.roster[0].defId, tile.wild.defId);
  assert.equal(x.status, 'exploring');
  assert.equal(tile.state, 'cleared');
});

test('what the pack cannot cover, the bank does', () => {
  const { g, tile } = withLair('befriend');
  const x = g.expedition;
  const price = tile.wild.price;

  x.pending.gold = 10;
  g.state.gold = price - 11;
  assert.throws(() => g.befriend(), /cannot raise enough/);
  assert.equal(g.state.roster.length, 0, 'and nothing is part-paid');
  assert.equal(x.pending.gold, 10);

  g.state.gold = price - 10 + 25;
  g.befriend();
  assert.equal(x.pending.gold, 0, 'the pack is emptied first');
  assert.equal(g.state.gold, 25, 'the rest comes up from camp');
  assert.equal(g.state.roster.length, 1);
});

test('the sum on offer is the pack and the bank together', () => {
  const { g, tile } = withLair('befriend');
  g.expedition.pending.gold = 30;
  g.state.gold = 12;
  const price = tile.wild.price;
  const pay = g.wildPayment(price);
  assert.equal(pay.fromPack, 30);
  assert.equal(pay.fromBank, price - 30);
  assert.equal(pay.short, price - 42);
  g.state.gold = price;
  assert.equal(g.wildPayment(price).short, 0);
});

test('a creature sent to camp survives a run that goes wrong afterward', () => {
  const { g, tile } = withLair('befriend');
  g.expedition.pending.gold = tile.wild.price + 500;
  g.befriend();
  const room = walkTo(g, (t) => t.kind === 'room' && t.state !== 'cleared');
  if (!room) return;
  sendIn(g);
  burnDown(g);
  assert.equal(g.expedition.status, 'failed');
  assert.equal(g.state.roster.length, 1, 'the creature is already at camp');
});

test('a creature you walk away from stays, and the offer is open when you return', () => {
  const { g, tile } = withLair('befriend');
  const x = g.expedition;
  x.pending.gold = 0;
  g.state.gold = 0;
  g.leaveWild();
  assert.equal(g.state.roster.length, 0);
  assert.notEqual(tile.state, 'cleared', 'the lair is not spent by declining it');
  assert.equal(x.status, 'exploring');

  // Walk off and come back with the price in hand: the same creature is there.
  const away = x.map.tiles[x.map.position].links[0];
  g.move(away);
  if (x.status !== 'exploring') return; // the neighbor picked a fight; enough is proved
  g.move(tile.key);
  assert.equal(x.status, 'offer', 'it is on offer again');
  assert.equal(g.wild.defId, tile.wild.defId);
  x.pending.gold = tile.wild.price;
  g.befriend();
  assert.equal(g.state.roster.length, 1);
  assert.equal(tile.state, 'cleared');
});

test('a hostile creature must be beaten before any choice is offered', () => {
  const { g, tile } = withLair('subdue');
  const x = g.expedition;
  assert.equal(x.status, 'encounter', 'it does not negotiate, and the one left walks in');
  assert.ok(tile.challenge, 'there is a fight');
  assert.throws(() => g.takeWild(), /nothing has been subdued/);
  const carried = x.pending.gold; // whatever the rooms on the way paid
  sendIn(g);
  forceWin(g);
  assert.equal(x.status, 'spoils');
  assert.ok(x.bounty > 0, 'a bounty is on the table');
  assert.equal(x.pending.gold, carried, 'and the lair itself pays nothing until you choose');
});

test('a beaten creature can be sent to camp, or left for the bounty', () => {
  const keep = withLair('subdue');
  const keptCarried = keep.g.expedition.pending.gold;
  enter(keep.g, keep.g.hero.uid);
  forceWin(keep.g);
  keep.g.takeWild();
  assert.equal(keep.g.state.roster.length, 1);
  assert.equal(keep.g.state.roster[0].defId, keep.tile.wild.defId);
  assert.equal(keep.g.expedition.pending.gold, keptCarried, 'you took the creature, not the coin');
  assert.equal(keep.g.expedition.status, 'exploring');

  const sell = withLair('subdue');
  const soldCarried = sell.g.expedition.pending.gold;
  enter(sell.g, sell.g.hero.uid);
  forceWin(sell.g);
  const bounty = sell.g.expedition.bounty;
  sell.g.takeBounty();
  assert.equal(sell.g.state.roster.length, 0);
  assert.equal(sell.g.expedition.pending.gold, soldCarried + bounty, 'the coin rides with the rest of the floor');
  assert.equal(sell.g.expedition.status, 'exploring');
});

test('a floor never offers a creature you already have', () => {
  const g = started('fighter', 16);
  WILD_COMPANIONS.slice(0, WILD_COMPANIONS.length - 1).forEach((c) => g.state.roster.push(createCompanion(c.id)));
  const last = WILD_COMPANIONS[WILD_COMPANIONS.length - 1].id;
  let seen = 0;
  for (let seed = 0; seed < 200; seed++) {
    g.startExpedition(6, [], seed);
    const den = Object.values(g.expedition.map.tiles).find((t) => t.kind === 'lair');
    if (den) { seen++; assert.equal(den.wild.defId, last, 'only the one you are missing'); }
    g.endExpedition();
    g.hero.stamina = MAX_STAMINA;
  }
  assert.ok(seen > 0, 'some floors should have had a lair');
});

test('lairs are rare', () => {
  const g = started('fighter', 16);
  let lairs = 0;
  const runs = 300;
  for (let seed = 0; seed < runs; seed++) {
    g.startExpedition(6, [], seed + 5000);
    if (Object.values(g.expedition.map.tiles).some((t) => t.kind === 'lair')) lairs++;
    g.endExpedition();
    g.hero.stamina = MAX_STAMINA;
  }
  const rate = lairs / runs;
  assert.ok(rate > 0.08 && rate < 0.35, `one floor in ${(1 / rate).toFixed(1)} held a lair, which should be uncommon but not unheard of`);
});

test('the creature is still named after the fight that cleared its tile', () => {
  const { g, tile } = withLair('subdue');
  sendIn(g);
  forceWin(g);
  assert.equal(g.expedition.status, 'spoils');
  assert.equal(tile.state, 'cleared', 'the fight is over');
  assert.ok(g.wild, 'but the game can still say what you beat');
  assert.equal(g.wild.defId, tile.wild.defId);
});

// --- Going down --------------------------------------------------------------

// Walks to a room and loses it deliberately, with dice that can never match.
function loseARoom(g, who = null) {
  const x = g.expedition;
  const actor = who ? g.member(who) : g.standing()[0];
  sendIn(g, actor.uid);
  burnDown(g);
  // Two going in means somebody has to be chosen to stay down.
  if (x.status === 'falling') g.takeTheFall(actor.uid);
  return actor;
}

test('a beaten companion goes down instead of ending the floor', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  x.pending.gold = 140;
  walkTo(g, (t) => t.kind === 'room');

  const fallen = loseARoom(g);
  assert.equal(fallen.down, true);
  assert.equal(x.status, 'encounter', 'the room still has you, and you are already back in it');
  assert.equal(x.fallen, fallen.name);
  assert.equal(x.pending.gold, 140, 'and what you were carrying is still yours');
  assert.equal(g.standing().length, 1);
  assert.equal(g.downed()[0].uid, fallen.uid);
});

test('a room that beats you has to be taken again on the spot', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  const room = walkTo(g, (t) => t.kind === 'room');
  loseARoom(g);

  // One left standing, so the game does not ask who goes back in.
  assert.equal(x.status, 'encounter');
  assert.equal(x.map.position, room.key, 'you have not moved an inch');
  assert.equal(room.state !== 'cleared', true);
  assert.throws(() => g.move(room.links[0]), /cannot move/);
  assert.throws(() => g.withdraw(), /no position to withdraw/);

  // The second attempt starts from the top: nothing the first one filled counts.
  assert.equal(room.challenge.trials.every((t) => t.matched.every((m) => m === false)), true);
  const standing = g.standing()[0];
  enter(g, standing.uid);
  assert.equal(x.encounter.trialIndex, 0);
  forceWin(g);
  assert.equal(x.status, 'exploring', 'clearing it lets you move on');
  assert.equal(x.fallen, null);
});

test('the floor is only lost once nobody is left standing', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  x.pending.gold = 140;

  walkTo(g, (t) => t.kind === 'room');
  loseARoom(g);
  assert.equal(x.status, 'encounter', 'the same room, with whoever is left already in it');

  loseARoom(g);
  assert.equal(g.standing().length, 0);
  assert.equal(x.status, 'failed');
  assert.equal(g.state.gold, 60, 'a wipe forfeits everything carried');
});

test('somebody unconscious can neither take a room nor lend a die', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  walkTo(g, (t) => t.kind === 'room');
  const fallen = loseARoom(g);

  assert.equal(x.status, 'encounter', 'the one still up is already back in the room');

  const standing = g.standing()[0];
  const alone = assembleDice([standing]).length;
  enter(g, standing.uid);
  assert.equal(x.encounter.diceLeft, alone + ALONE_DICE, 'their own hand, and the dice of going in alone');
});

test('the unconscious are carried out and are good for nothing until a rest', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  g.startExpedition(3, [g.state.roster[0].uid], 5);
  walkTo(g, (t) => t.kind === 'room');
  const fallen = loseARoom(g);
  const wasHero = fallen.isHero;
  enter(g, g.standing()[0].uid);
  forceWin(g);
  g.withdraw();
  g.endExpedition();

  const home = wasHero ? g.hero : g.state.roster[0];
  assert.equal(home.stamina, 0, 'they come round with nothing left in them');
  g.rest();
  assert.equal(home.stamina, MAX_STAMINA, 'a night puts them right');
});

test('going alone means one bad room still ends the floor', () => {
  const g = started('fighter', 12);
  const x = g.startExpedition(3, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  loseARoom(g);
  assert.equal(x.status, 'failed', 'with a party of one there is nobody to carry on');
});

// --- The night's pool --------------------------------------------------------

test('a class trick is spent from the night, not refilled by the next room', () => {
  const g = started('fighter', 1);
  const full = abilityMax(g.hero);
  assert.ok(full >= 2, 'there is a pool to spend');
  const x = g.startExpedition(1, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  assert.equal(x.encounter.ability('secondWind').left, full, 'the room opens with what the night has left');

  g.useAbility('secondWind', { dieIndex: 0 });
  assert.equal(g.member(g.hero.uid).charges, full - 1, 'and the character carries the cost');
  forceWin(g);

  const next = walkTo(g, (t) => t.kind === 'room' && t.state !== 'cleared');
  if (!next) return;
  sendIn(g);
  assert.equal(x.encounter.ability('secondWind').left, full - 1, 'the next room does not hand it back');
});

test('the pool follows you home and only a long rest fills it', () => {
  const g = started('ranger', 1);
  const full = abilityMax(g.hero);
  const x = g.startExpedition(1, [], 9);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  g.useAbility('readGround');
  forceWin(g);
  g.withdraw();
  g.endExpedition();
  assert.equal(abilityLeft(g.hero), full - 1, 'what was spent underground stays spent');

  g.hero.stamina = 1;
  g.shortRest();
  assert.equal(g.hero.stamina, MAX_STAMINA, 'a short rest buys back vigor');
  assert.equal(abilityLeft(g.hero), full - 1, 'and nothing else');

  g.rest();
  assert.equal(abilityLeft(g.hero), full, 'the night gives the trick back');
});

test('a trick cannot be spent past the end of the night', () => {
  const g = started('mage', 1);
  // The party is copied when it sets out, so the night's pool has to be short
  // before the floor begins, the way it would be on a second trip out.
  g.hero.charges = 1;
  const x = g.startExpedition(1, [], 11);
  walkTo(g, (t) => t.kind === 'room');
  sendIn(g);
  const e = x.encounter;
  const wanted = e.trial.required.find((_, i) => !e.trial.matched[i]);
  g.useAbility('transmute', { dieIndex: 0, symbol: wanted });
  assert.equal(e.canUse('transmute'), false, 'the pool is empty');
  assert.throws(() => g.useAbility('transmute', { dieIndex: 1, symbol: wanted }), /not available/);
});

// --- One last look at what you walked past -----------------------------------

test('a lair nobody ever walked into is not offered on the way out', () => {
  // A floor with a befriendable lair the company never reaches: withdrawing
  // must not offer to go back for a creature they have never seen.
  for (let seed = 0; seed < 400; seed++) {
    const g = started('fighter', 12);
    const x = g.startExpedition(4, [], seed);
    const den = Object.values(x.map.tiles).find((t) => t.kind === 'lair' && t.wild && t.wild.mode === 'befriend');
    if (!den || den.key === x.map.position) { g.endExpedition(); continue; }
    g.state.gold = den.wild.price + 100;
    g.withdraw();
    assert.equal(den.wild.met, undefined, 'nobody met it');
    assert.equal(g.strandedWild(), null, 'so there is nothing to go back for');
    return;
  }
  throw new Error('no unvisited befriend lair found in 400 seeds');
});

test('a creature you left behind can be bought on the way home', () => {
  const { g, tile } = withLair('befriend');
  const x = g.expedition;
  x.pending.gold = 0;
  g.state.gold = 0;
  g.leaveWild();
  assert.equal(g.strandedWild(), null, 'nothing is offered while the floor is still open');

  g.state.gold = tile.wild.price + 40;
  x.pending.gold = 0;
  g.withdraw();
  const stranded = g.strandedWild();
  assert.ok(stranded, 'the floor ends with the creature still down there');
  assert.equal(stranded.wild.defId, tile.wild.defId);
  assert.equal(stranded.afford, true);

  g.claimWild();
  assert.equal(g.state.roster.length, 1, 'it comes home');
  assert.equal(g.state.roster[0].defId, tile.wild.defId);
  assert.equal(g.state.gold, 40, 'and is paid for out of the bank');
  assert.equal(g.strandedWild(), null, 'the offer closes behind it');
  assert.throws(() => g.claimWild(), /nothing left to go back for/);
});

test('what you cannot pay for is offered but not sold', () => {
  const { g, tile } = withLair('befriend');
  g.expedition.pending.gold = 0;
  g.state.gold = tile.wild.price - 1;
  g.leaveWild();
  g.withdraw();
  const stranded = g.strandedWild();
  assert.equal(stranded.afford, false);
  assert.throws(() => g.claimWild(), /cannot raise enough/);
  assert.equal(g.state.roster.length, 0);
});

test('a floor that beat you still lets you go back for it, out of the bank', () => {
  const { g, tile } = withLair('befriend');
  const x = g.expedition;
  g.leaveWild();
  const room = walkTo(g, (t) => t.kind === 'room' && t.state !== 'cleared');
  if (!room) return;
  x.pending.gold = 500;
  g.state.gold = tile.wild.price;
  loseARoom(g);
  assert.equal(x.status, 'failed', 'nobody else was along to carry on');
  const stranded = g.strandedWild();
  assert.ok(stranded, 'the creature does not vanish with the run');
  assert.equal(stranded.afford, true, 'the bank is what is left to spend');
  g.claimWild();
  assert.equal(g.state.roster.length, 1);
  assert.equal(g.state.gold, 0);
});

test('a creature you already took is not offered twice', () => {
  const { g, tile } = withLair('befriend');
  g.expedition.pending.gold = tile.wild.price + 10;
  g.befriend();
  g.withdraw();
  assert.equal(g.strandedWild(), null);
});

// --- Two go in --------------------------------------------------------------

test('a room is attempted by a pair, and their hands are one tray', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  walkTo(g, (t) => t.kind === 'room');

  const [one, two] = g.standing();
  g.choosePair(one.uid, two.uid);
  assert.deepEqual(x.actorUids, [one.uid, two.uid]);
  assert.equal(x.encounter.diceLeft, companionDice(one).length + companionDice(two).length,
    'both hands, and nothing lent by anybody waiting outside');
  const owners = new Set(x.encounter.remaining.map((d) => d.ownerId));
  assert.deepEqual([...owners].sort(), [one.uid, two.uid].sort(), 'a die still knows whose it is');
});

test('one may not go in while two can stand', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  g.startExpedition(3, [g.state.roster[0].uid], 5);
  walkTo(g, (t) => t.kind === 'room');
  assert.throws(() => g.choosePair(g.hero.uid), /two go in/);
  assert.throws(() => g.choosePair(g.hero.uid, g.hero.uid), /cannot be both/);
});

test('the last one standing goes in alone, and fights like it', () => {
  const g = started('fighter', 12);
  const x = g.startExpedition(1, [], 5);
  walkTo(g, (t) => t.kind === 'room');
  const alone = assembleDice([g.member(g.hero.uid)]).length;
  if (x.status === 'choosing') g.choosePair(g.hero.uid);
  assert.equal(x.encounter.diceLeft, alone + ALONE_DICE, 'their hand and the dice of being on their own');
});

test('one on their feet is walked in rather than asked who goes', () => {
  const g = started('fighter', 12);
  const x = g.startExpedition(1, [], 5);
  const room = walkTo(g, (t) => t.kind === 'room');
  assert.ok(room);
  assert.equal(x.status, 'encounter', 'no choice is offered when there is none to make');
  assert.deepEqual(x.actorUids, [g.hero.uid]);
  // And with two on their feet it is a decision again.
  const pair = started('fighter', 12);
  pair.state.roster.push(createCompanion('sellsword'));
  pair.state.renown = 60;
  const y = pair.startExpedition(3, [pair.state.roster[0].uid], 5);
  assert.ok(walkTo(pair, (t) => t.kind === 'room'));
  assert.equal(y.status, 'choosing');
});

test('when a pair is beaten the player says who stays down', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'));
  g.state.renown = 60;
  const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
  walkTo(g, (t) => t.kind === 'room');
  const [one, two] = g.standing();
  g.choosePair(one.uid, two.uid);
  burnDown(g);

  assert.equal(x.status, 'falling', 'the run stops and asks');
  assert.equal(one.down, false, 'nobody is down until you say so');
  assert.equal(two.down, false);
  assert.throws(() => g.takeTheFall(g.hero.uid === one.uid ? 'nobody' : 'nobody'), /no such member|not in that room/);

  g.takeTheFall(two.uid);
  assert.equal(two.down, true, 'the one you chose');
  assert.equal(one.down, false, 'and not the other');
  assert.equal(x.status, 'encounter', 'the room is not finished with you, and you are back in it');
  assert.equal(x.fallen, two.name);
});

test('a hero can be the one you protect, or the one you spend', () => {
  const pick = (who) => {
    const g = started('fighter', 12);
    g.state.roster.push(createCompanion('sellsword'));
    g.state.renown = 60;
    const x = g.startExpedition(3, [g.state.roster[0].uid], 5);
    walkTo(g, (t) => t.kind === 'room');
    const [one, two] = g.standing();
    g.choosePair(one.uid, two.uid);
    burnDown(g);
    g.takeTheFall(who === 'hero' ? g.hero.uid : g.standing().find((m) => !m.isHero).uid);
    return g;
  };
  const given = pick('hero');
  assert.equal(given.member(given.hero.uid).down, true, 'the hero can be the one who stays down');

  const spent = pick('companion');
  assert.equal(spent.member(spent.hero.uid).down, false, 'or the hero walks and the sellsword does not');
  assert.equal(spent.downed().length, 1);
  assert.equal(spent.downed()[0].isHero, undefined, 'and it is the companion lying there');
});

test('a cleared room pays the pool, not the people who were standing in it', () => {
  const g = started('fighter', 12);
  g.state.roster.push(createCompanion('sellsword'), createCompanion('acolyte'));
  g.state.renown = 140;
  const x = g.startExpedition(1, g.state.roster.map((c) => c.uid), 5);
  walkTo(g, (t) => t.kind === 'room');
  const [one, two, three] = x.partyUids.map((uid) => g.member(uid));
  const ranks = [one, two, three].map((m) => m.level || m.rank);
  g.choosePair(one.uid, two.uid);
  forceWin(g);
  assert.equal(x.pending.training, lessonsWon(1), 'the room is worth its depth');
  assert.deepEqual([one, two, three].map((m) => m.level || m.rank), ranks,
    'and nobody moved a step, in the room or outside it');
});

test('a companion who goes unfed is warned three times and then walks', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'));
  const hired = g.state.roster[0];
  hired.gear.hand = makePiece('sword', 2);
  g.state.gold = 0;

  const nights = [];
  for (let i = 1; i <= 6; i++) {
    g.rest();
    nights.push(hired.unpaid);
    assert.equal(g.state.roster.length, 1, `still with you on night ${i}`);
  }
  assert.deepEqual(nights, [1, 2, 3, 4, 5, 6], 'the count is the nights, not the days');
  // The warnings are in the Chronicle, at three, five and six.
  const said = g.state.log.map((l) => l.text).join(' | ');
  assert.match(said, /three nights unfed/);
  assert.match(said, /Five nights now/);
  assert.match(said, /pack by the door/);

  g.rest();
  assert.equal(g.state.roster.length, 0, 'and on the seventh they are gone');
  assert.match(g.state.log.map((l) => l.text).join(' | '), /gone, after seven nights unfed/);
  assert.equal(g.pack.some((p) => p.kind === 'sword'), true, 'the kit they wore stays with the company');
});

test('the week the prose promises is the week the code counts', () => {
  // Every one of those sentences spells its number out, so the number and the
  // words have to be checked against each other rather than hoped about.
  assert.equal(HUNGER_LEAVES, 7, 'the notices all say seven');
  assert.deepEqual(HUNGER_WARNINGS.map((w) => w.nights), [3, 5, 6]);
  assert.match(HUNGER_WARNINGS[0].say('X'), /three/);
  assert.match(HUNGER_WARNINGS[1].say('X'), /Five/);
  HUNGER_WARNINGS.forEach((w) => assert.ok(w.nights < HUNGER_LEAVES, 'a warning comes before the door'));
});

test('one supper wipes the slate', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'));
  const hired = g.state.roster[0];
  g.state.gold = 0;
  g.rest();
  g.rest();
  assert.equal(hired.unpaid, 2);
  g.state.gold = 1000;
  g.rest();
  assert.equal(hired.unpaid, 0, 'fed once, and they have forgotten it');
  g.state.gold = 0;
  g.rest();
  assert.equal(hired.unpaid, 1, 'and the count starts again from there');
});

test('a short purse feeds the old hands first', () => {
  const g = started();
  g.state.roster.push(createCompanion('sellsword'), createCompanion('squire'));
  const [old, fresh] = g.state.roster;
  // Enough for one of the two.
  g.state.gold = upkeepOf(old);
  g.rest();
  assert.equal(old.unpaid, 0, 'the one who has been with you longest eats');
  assert.equal(fresh.unpaid, 1, 'the last one hired goes without');
});
