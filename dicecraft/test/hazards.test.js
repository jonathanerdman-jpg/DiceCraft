import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, assembleDice, companionDice, createCompanion, newGameState, woundedDice } from '../js/game.js';
import { makeChallenge } from '../js/engine.js';
import { HAZARDS, TRINKETS, hazardDef, hazardsFor } from '../js/hazards.js';
import { SETTING_LIST } from '../js/settings.js';
import { denizen } from '../js/bestiary.js';

function started(gold = 2000) {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'fighter');
  g.state.gold = gold;
  return g;
}

// The room next to the way in, dressed as whatever the test needs.
function nextDoor(g) {
  const x = g.expedition;
  const key = x.map.tiles[x.map.position].links[0];
  const tile = x.map.tiles[key];
  Object.assign(tile, { state: 'seen', challenge: null, hazard: null, chest: null, mob: undefined, wild: null });
  return tile;
}

function hazardAt(g, id, symbols = ['might']) {
  const tile = nextDoor(g);
  tile.kind = 'passage';
  tile.hazard = { id, sprung: false };
  tile.challenge = makeChallenge({ name: hazardDef(id).name, trials: [symbols] });
  tile.challenge.hazard = id;
  return tile;
}

function chestAt(g, { mimic = false, trap = null } = {}) {
  const tile = nextDoor(g);
  tile.kind = 'treasure';
  tile.chest = { mimic, trap };
  if (mimic) {
    tile.mob = 'mimic';
    tile.challenge = makeChallenge({ name: 'Mimic', trials: [['cunning']], mob: 'mimic' });
  } else if (trap) {
    tile.challenge = makeChallenge({ name: hazardDef(trap).name, trials: [['cunning']] });
    tile.challenge.hazard = trap;
  }
  return tile;
}

function lose(g) {
  g.expedition.encounter.status = 'lost';
  g.act(() => {});
}

function win(g) {
  g.expedition.encounter.status = 'won';
  g.act(() => {});
}

test('every setting has something to trip over, and every hazard asks for real symbols', () => {
  SETTING_LIST.forEach((s) => assert.ok(hazardsFor(s.id).length >= 3, `${s.id} is too safe`));
  HAZARDS.forEach((h) => {
    assert.ok(['trap', 'hazard', 'obstacle'].includes(h.kind));
    assert.ok(['wound', 'loot', 'drain'].includes(h.cost));
    assert.ok(h.demands.length >= 3);
  });
});

test('a wound costs the plainest die, and never the last one', () => {
  const g = started();
  const hero = g.hero;
  const whole = companionDice(hero);
  hero.wounds = 1;
  const hurt = woundedDice(hero);
  assert.equal(hurt.length, whole.length - 1);
  const plainBefore = whole.filter((d) => d.kind === 'basic').length;
  const plainAfter = hurt.filter((d) => d.kind === 'basic').length;
  assert.equal(plainAfter, plainBefore - 1, 'a plain die goes before a power die');
  hero.wounds = 99;
  assert.equal(woundedDice(hero).length, 1, 'nobody is left with nothing to throw');
  assert.equal(assembleDice([hero]).length, 1);
  hero.wounds = 0;
});

test('a sprung trap wounds whoever went in, and lets them by', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  const tile = hazardAt(g, 'pit');
  g.move(tile.key);
  assert.equal(tile.hazard.sprung, true, 'a trap that has gone off is a trap you know about');
  assert.equal(g.expedition.status, 'encounter', 'alone, the hero walks straight into it');
  lose(g);
  const hero = g.member(g.hero.uid);
  assert.equal(hero.down, false, 'nobody goes down to a trap');
  assert.equal(hero.wounds, 1);
  assert.equal(tile.state, 'cleared');
  assert.equal(g.expedition.status, 'exploring');
});

test('a hazard that takes loot takes a quarter of the pack', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  g.expedition.pending.gold = 100;
  const tile = hazardAt(g, 'flood');
  g.move(tile.key);
  lose(g);
  assert.equal(g.expedition.pending.gold, 75);
});

test('a glyph eats a use of the trick, and wounds a party that has none', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  const before = g.member(g.hero.uid).charges;
  let tile = hazardAt(g, 'glyph');
  g.move(tile.key);
  lose(g);
  assert.equal(g.member(g.hero.uid).charges, before - 1);

  g.move(g.expedition.map.entrance);
  g.member(g.hero.uid).charges = 0;
  tile = hazardAt(g, 'glyph');
  g.move(tile.key);
  lose(g);
  assert.equal(g.member(g.hero.uid).wounds, 1);
  g.withdraw();
  g.endExpedition();
  assert.equal(g.hero.charges, 0, 'and everything spent below is gone at home too, once');
});

test('beating the floor costs nothing and pays nothing', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  g.expedition.pending.gold = 40;
  const mult = g.expedition.multiplier;
  const tile = hazardAt(g, 'chasm');
  g.move(tile.key);
  win(g);
  assert.equal(g.expedition.pending.gold, 40);
  assert.equal(g.expedition.multiplier, mult);
  assert.equal(tile.state, 'cleared');
  assert.equal(g.expedition.status, 'exploring');
});

test('a chest can be left shut, and an honest one pays when it is opened', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  const tile = chestAt(g);
  g.move(tile.key);
  assert.equal(g.expedition.status, 'chest', 'you stop at a chest and decide');
  g.leaveChest();
  assert.equal(g.expedition.status, 'exploring');
  assert.notEqual(tile.state, 'cleared', 'it is still there');
  g.move(g.expedition.map.entrance);
  g.move(tile.key);
  g.openChest();
  assert.ok(g.expedition.pending.gold > 0);
  assert.equal(tile.state, 'cleared');
});

test('a mimic is a fight, and the fight pays like a hoard', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  const tile = chestAt(g, { mimic: true });
  g.move(tile.key);
  assert.equal(g.expedition.status, 'chest', 'from the doorway it is just a chest');
  g.openChest();
  assert.equal(g.expedition.status, 'encounter');
  assert.equal(denizen(g.expedition.encounter.challenge.mob).id, 'mimic');
  win(g);
  assert.ok(g.expedition.pending.gold > 0);
  assert.equal(tile.state, 'cleared');
});

test('a trapped chest is still a chest once the trap is paid for', () => {
  const g = started();
  g.startExpedition(1, [], 7);
  const tile = chestAt(g, { trap: 'darts' });
  g.move(tile.key);
  g.openChest();
  lose(g);
  assert.equal(g.member(g.hero.uid).wounds, 1);
  assert.ok(g.expedition.pending.gold > 0, 'and it still pays');
  assert.equal(tile.state, 'cleared');
});

test('curios are bought once and come back with a long rest, not a short one', () => {
  const g = started(1000);
  g.buyTrinket('wayfarer');
  assert.equal(g.state.gold, 1000 - TRINKETS.wayfarer.price);
  assert.throws(() => g.buyTrinket('wayfarer'), /already/);
  g.trinkets.wayfarer = 0;
  g.shortRest();
  assert.equal(g.trinketLeft('wayfarer'), 0);
  g.rest();
  assert.equal(g.trinketLeft('wayfarer'), 1);
  const poor = started(10);
  assert.throws(() => poor.buyTrinket('salts'), /cannot pay/);
});

test('the Wayfarer’s Stone takes everyone home mid-fight, with the pack', () => {
  const g = started();
  g.buyTrinket('wayfarer');
  const bank = g.state.gold;
  g.startExpedition(1, [], 7);
  g.expedition.pending.gold = 250;
  const tile = chestAt(g, { mimic: true });
  g.move(tile.key);
  g.openChest();
  assert.equal(g.trinketUse('wayfarer'), 'escape');
  g.useTrinket('wayfarer');
  assert.equal(g.expedition.status, 'complete');
  assert.equal(g.state.gold, bank + 250, 'the winnings came home');
  assert.equal(g.trinketLeft('wayfarer'), 0);
  g.endExpedition();
  assert.equal(g.hero.stamina >= 0, true);
});

test('a pole finds the teeth before a hand does, and springs a trap from ten feet', () => {
  const g = started();
  g.buyTrinket('pole');
  g.startExpedition(1, [], 7);
  let tile = chestAt(g, { mimic: true });
  g.move(tile.key);
  g.useTrinket('pole');
  assert.equal(tile.chest.known, true);
  assert.equal(g.expedition.status, 'chest', 'knowing is not opening');
  assert.equal(g.trinketUse('pole'), null, 'there is nothing more to learn from this one');
  g.leaveChest();

  g.move(g.expedition.map.entrance);
  tile = hazardAt(g, 'portcullis');
  g.move(tile.key);
  // Alone, the hero is already in front of it — a pole is for before that.
  g.expedition.status = 'choosing';
  g.expedition.encounter = null;
  g.useTrinket('pole');
  assert.equal(tile.state, 'cleared');
  assert.equal(g.member(g.hero.uid).wounds || 0, 0);
  assert.equal(g.trinketLeft('pole'), 0);
});

test('smelling salts bring somebody round', () => {
  const g = started();
  g.buyTrinket('salts');
  const friend = createCompanion('footman');
  g.state.roster.push(friend);
  g.state.renown = 100;
  g.startExpedition(1, [friend.uid], 7);
  g.member(friend.uid).down = true;
  assert.equal(g.trinketUse('salts'), 'revive');
  g.useTrinket('salts', friend.uid);
  assert.equal(g.member(friend.uid).down, false);
  assert.equal(g.trinketUse('salts'), null);
});

test('a shared floor is walked without curios, so the two games cannot drift', () => {
  const g = started();
  g.buyTrinket('wayfarer');
  g.startExpedition(1, [], 7);
  g.expedition.owners.someoneElse = 'peer-2';
  assert.equal(g.trinketUse('wayfarer'), null);
  assert.throws(() => g.useTrinket('wayfarer'));
});

// --- The Seer's Glass ----------------------------------------------------------

function roomNextDoor(g, trials) {
  const tile = nextDoor(g);
  Object.assign(tile, { kind: 'room', mob: 'ghoul' });
  tile.challenge = makeChallenge({ name: 'Ghoul', trials, mob: 'ghoul' });
  return tile;
}

test('the Seer’s Glass shows the room next door, all but one symbol', () => {
  const g = started();
  g.buyTrinket('glass');
  g.startExpedition(1, [], 7);
  const tile = roomNextDoor(g, [['faith', 'might'], ['faith', 'guard', 'cunning']]);
  assert.equal(g.trinketUse('glass'), 'scry');
  assert.ok(g.scryable().some((t) => t.key === tile.key));
  const view = g.useTrinket('glass', tile.key);
  assert.equal(view.name, 'Ghoul');
  assert.equal(view.mob, 'ghoul');
  const flat = view.trials.flat();
  assert.equal(flat.length, 5, 'every trial, every slot');
  assert.equal(flat.filter((s) => s === null).length, 1, 'with exactly one kept dark');
  const real = tile.challenge.trials.flatMap((t) => t.required);
  flat.forEach((s, i) => { if (s) assert.equal(s, real[i], 'and the rest shown truly'); });
  assert.equal(g.trinketLeft('glass'), 0, 'once a night');
  assert.equal(g.trinketUse('glass'), null);
  g.state.expedition = null;
  g.rest();
  assert.equal(g.trinketLeft('glass'), 1, 'and back after a long rest');
});

test('the glass sees only next door, and tells a mimic from a chest', () => {
  const g = started();
  g.buyTrinket('glass');
  g.startExpedition(1, [], 7);
  const x = g.expedition;
  const far = Object.values(x.map.tiles).find((t) => t.key !== x.map.position
    && !x.map.tiles[x.map.position].links.includes(t.key) && t.mob);
  if (far) assert.throws(() => g.useTrinket('glass', far.key), /cannot see/);
  const chest = chestAt(g, { mimic: true });
  const view = g.useTrinket('glass', chest.key);
  assert.equal(view.name, 'Mimic');
});

test('a glass is not offered on a shared floor', () => {
  const g = started();
  g.buyTrinket('glass');
  g.startExpedition(1, [], 7);
  roomNextDoor(g, [['faith']]);
  g.expedition.owners.someoneElse = 'peer-2';
  assert.equal(g.trinketUse('glass'), null);
});
