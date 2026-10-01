import test from 'node:test';
import assert from 'node:assert/strict';
import { Encounter, makeChallenge, generateChallenge } from '../js/engine.js';
import { makeBasicDie, makePowerDie } from '../js/dice.js';
import { createRng } from '../js/rng.js';
import { depthByNumber, settingDef } from '../js/settings.js';

const rng = () => createRng(12345);

function rigged(faces) {
  // A one-sided die is the simplest way to script an encounter.
  return { id: `rig-${faces}`, ownerId: 'test', kind: 'basic', sides: 1, proficiency: null, faces: [faces] };
}

test('a match is compulsory while no die has been spent', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
  });
  const actions = e.legalActions();
  assert.equal(actions.canMatch, true);
  assert.equal(actions.canDiscard, false);
  assert.equal(actions.canReroll, false);
  assert.throws(() => e.discard(1), /must take it/);
});

test('a die placed ends the throwing away for that round', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might', 'guard']] }),
    dice: [rigged('might'), rigged('nature'), rigged('nature'), rigged('nature')],
    rng: rng(),
  });
  e.match(0, 0);
  assert.equal(e.availableMatches().length, 0, 'nothing on the table answers the guard slot');
  assert.equal(e.legalActions().canDiscard, false, 'but the round has already cost a die');
  assert.equal(e.legalActions().canReroll, true, 'and the only way on is another throw');
  assert.throws(() => e.discard(0), /already placed/);
  assert.equal(e.diceLeft, 3, 'so nothing else is lost');
  e.reroll();
  assert.equal(e.legalActions().canDiscard, true, 'a fresh throw that answers nothing may be cleared');
});

test('re-rolling requires spending a die first', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard'), rigged('nature')],
    rng: rng(),
  });
  assert.equal(e.legalActions().canReroll, false);
  assert.throws(() => e.reroll(), /spend a die/);
  e.discard(0);
  assert.equal(e.legalActions().canReroll, true);
});

test('matching every symbol wins the encounter', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might', 'guard']] }),
    dice: [rigged('might'), rigged('guard'), rigged('faith')],
    rng: rng(),
  });
  e.match(0, 0);
  const guardIndex = e.tray.findIndex((t) => t.face === 'guard');
  e.match(guardIndex, 1);
  assert.equal(e.status, 'won');
});

test('running out of dice loses the encounter', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might')],
    rng: rng(),
  });
  e.discard(0);
  assert.equal(e.status, 'lost');
  assert.equal(e.diceLeft, 0);
});

test('a hand too small for what is left is called there and then', () => {
  // Two dice, two symbols, and neither die can answer: spending one for
  // nothing leaves one die against two slots, which no throw can fix.
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana', 'arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
  });
  assert.equal(e.symbolsOwed(), 2);
  e.discard(0);
  assert.equal(e.status, 'lost', 'one die cannot answer two symbols');
  assert.equal(e.diceLeft, 1, 'and the last die is never thrown for nothing');
  assert.match(e.log[e.log.length - 1].text, /could have defeated it/);
});

test('symbols still wanted are counted across the trials to come', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might'], ['guard', 'guard']] }),
    dice: [rigged('might'), rigged('guard'), rigged('guard')],
    rng: rng(),
  });
  assert.equal(e.symbolsOwed(), 3, 'this trial and every one after it');
  e.match(0, 0);
  assert.equal(e.status, 'active', 'three dice for three symbols is still alive');
  assert.equal(e.symbolsOwed(), 2);
  e.match(0, 0);
  e.match(0, 1);
  assert.equal(e.status, 'won');
});

test('a room that was never winnable is over before a die is thrown for it', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might'], ['guard']] }),
    dice: [rigged('might')],
    rng: rng(),
  });
  assert.equal(e.status, 'lost', 'one die against two trials');
  assert.throws(() => e.match(0, 0), /encounter is over/);
});

test('a blessing still in hand counts as the die it would call back', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might', 'might']] }),
    dice: [rigged('guard'), rigged('guard')],
    rng: rng(),
    abilities: [{ id: 'blessing', name: 'Blessing', charges: 1, text: 'call a die back' }],
  });
  e.discard(0);
  assert.equal(e.status, 'active', 'one die and a blessing can still answer two symbols');
  assert.equal(e.diceWithin(), 2);
  e.useAbility('blessing');
  assert.equal(e.diceLeft, 2);
});

test('a wild face answers any slot', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['faith']] }),
    dice: [rigged('wild')],
    rng: rng(),
  });
  assert.equal(e.availableMatches().length, 1);
  e.match(0, 0);
  assert.equal(e.status, 'won');
});

test('trials are cleared one at a time and share the dice pool', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might'], ['guard']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
  });
  assert.equal(e.trialIndex, 0);
  e.match(0, 0);
  assert.equal(e.trialIndex, 1);
  assert.equal(e.diceLeft, 1);
  e.match(0, 0);
  assert.equal(e.status, 'won');
});

test('spending the last die on a trial that does not finish the room is a loss', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might'], ['guard']] }),
    dice: [rigged('might'), rigged('might')],
    rng: rng(),
  });
  e.match(0, 0);
  assert.equal(e.status, 'active', 'one die for the one symbol still wanted');
  e.discard(0);
  assert.equal(e.status, 'lost');
  assert.equal(e.diceLeft, 0);
});

test('boss pressure eats a die on every second re-roll', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Boss', trials: [['arcana']], boss: true, pressure: true }),
    dice: [rigged('might'), rigged('guard'), rigged('nature'), rigged('faith'), rigged('cunning')],
    rng: rng(),
  });
  e.discard(0);
  assert.equal(e.diceLeft, 4);
  e.reroll();
  assert.equal(e.diceLeft, 4, 'the first re-roll is free');
  e.discard(0);
  e.reroll();
  assert.equal(e.diceLeft, 2, 'the second re-roll costs a die on top of the one spent');
});

test('an ordinary challenge never applies pressure', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Plain', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard'), rigged('nature'), rigged('faith')],
    rng: rng(),
  });
  for (let i = 0; i < 2; i++) { e.discard(0); e.reroll(); }
  assert.equal(e.diceLeft, 2);
});

test('pressure never removes the final die', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Boss', trials: [['arcana']], boss: true, pressure: true }),
    dice: [rigged('might'), rigged('guard'), rigged('nature')],
    rng: rng(),
  });
  e.discard(0);
  e.reroll();
  e.discard(0);
  e.reroll();
  assert.equal(e.diceLeft, 1, 'a boss cannot strip you of your last die');
});

test('a finished encounter refuses further actions', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might']] }),
    dice: [rigged('might')],
    rng: rng(),
  });
  e.match(0, 0);
  assert.throws(() => e.match(0, 0), /over/);
  assert.deepEqual(e.legalActions(), { canMatch: false, canDiscard: false, canReroll: false });
});

test('generated challenges respect their depth spec', () => {
  const depth = depthByNumber(6);
  for (let seed = 0; seed < 40; seed++) {
    const c = generateChallenge({ spec: depth, pool: null, rng: createRng(seed), name: 'Room' });
    assert.ok(c.trials.length >= depth.trials[0] && c.trials.length <= depth.trials[1]);
    c.trials.forEach((t) => {
      assert.ok(t.required.length >= depth.symbols[0] && t.required.length <= depth.symbols[1]);
    });
  }
  const boss = generateChallenge({
    spec: { trials: depth.boss.trials, symbols: depth.boss.symbols },
    pool: null, rng: createRng(7), name: 'Boss', boss: true,
  });
  assert.equal(boss.boss, true);
  assert.equal(boss.pressure, true);
  assert.equal(boss.trials.length, depth.boss.trials);
});

test('a setting biases which symbols its rooms ask for', () => {
  const thicket = settingDef('thicket');
  const counts = {};
  for (let seed = 0; seed < 300; seed++) {
    const c = generateChallenge({ spec: depthByNumber(4), pool: thicket.pool, rng: createRng(seed), name: 'Room' });
    c.trials.flatMap((t) => t.required).forEach((sym) => { counts[sym] = (counts[sym] || 0) + 1; });
  }
  assert.ok(counts.nature > counts.cunning, 'the Thicket should lean on Nature over Cunning');
  assert.ok(counts.nature > counts.might * 2, 'and far harder than on Might');
  assert.equal(counts.guard, undefined, 'a symbol outside the setting\u2019s pool never appears');
  assert.equal(counts.faith, undefined);
});

test('the same seed produces the same encounter', () => {
  const dice = () => [makeBasicDie('a'), makeBasicDie('a'), makePowerDie('a', 8, 'might')];
  const faces = (seed) => {
    const e = new Encounter({
      challenge: makeChallenge({ name: 'Test', trials: [['might', 'guard']] }),
      dice: dice(),
      rng: createRng(seed),
    });
    return e.tray.map((t) => t.face);
  };
  assert.deepEqual(faces(99), faces(99));
});

// --- Hero abilities ---------------------------------------------------------

const ability = (id, charges = 1) => ({ id, name: id, charges });

test('Second Wind re-rolls one die without spending it', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('secondWind')],
  });
  assert.equal(e.canUse('secondWind'), true);
  e.useAbility('secondWind', { dieIndex: 0 });
  assert.equal(e.diceLeft, 2, 'nothing was spent');
  assert.equal(e.ability('secondWind').left, 0);
  assert.equal(e.canUse('secondWind'), false);
});

test('Transmute only turns a die into something the trial wants', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['faith']] }),
    dice: [rigged('might')],
    rng: rng(),
    abilities: [ability('transmute')],
  });
  assert.throws(() => e.useAbility('transmute', { dieIndex: 0, symbol: 'nature' }), /does not want/);
  e.useAbility('transmute', { dieIndex: 0, symbol: 'faith' });
  assert.equal(e.tray[0].face, 'faith');
  e.match(0, 0);
  assert.equal(e.status, 'won');
});

test('Brace eats the next pressure hit instead of a die', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Boss', trials: [['arcana']], boss: true, pressure: true }),
    dice: [rigged('might'), rigged('guard'), rigged('nature'), rigged('faith')],
    rng: rng(),
    abilities: [ability('brace')],
  });
  e.useAbility('brace');
  e.discard(0);
  e.reroll();
  e.discard(0);
  e.reroll();
  assert.equal(e.diceLeft, 2, 'the pressure hit was absorbed');
  assert.equal(e.braced, false, 'and the brace is used up');
});

test('Brace also catches a die about to be thrown away for nothing', () => {
  // It is not only a boss that takes dice. An ordinary room that answers
  // nothing takes one too, and a paladin's feet are set against that as well.
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Plain', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('brace')],
  });
  assert.equal(e.canUse('brace'), true, 'the trick is not reserved for boss rooms');
  e.useAbility('brace');
  assert.equal(e.legalActions().canDiscard, true, 'nothing on the table answers');
  e.discard(0);
  assert.equal(e.diceLeft, 2, 'the die is put down, not lost');
  assert.equal(e.discarded, 0);
  assert.equal(e.braced, false, 'and the brace is used up');
  assert.equal(e.canUse('brace'), false, 'with nothing left in the pool');
});

test('Read the Ground re-rolls before anything has been spent', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('readGround')],
  });
  assert.equal(e.legalActions().canReroll, false, 'an ordinary re-roll is still illegal');
  e.useAbility('readGround');
  assert.equal(e.diceLeft, 2);
  assert.equal(e.rounds, 2);
});

test('Slip answers a slot and keeps the die that answered it', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might', 'guard']] }),
    dice: [rigged('might'), rigged('guard'), rigged('nature')],
    rng: rng(),
    abilities: [ability('slip')],
  });
  assert.equal(e.legalActions().canDiscard, false, 'an ordinary discard is illegal here');
  e.useAbility('slip');
  assert.equal(e.trial.matched[0], true, 'the might slot is answered');
  assert.equal(e.diceLeft, 3, 'and nothing was paid for it');
  assert.equal(e.discarded, 0);
  assert.equal(e.tray.length, 2, 'the die is off the table until the next throw');
  assert.equal(e.canUse('slip'), false, 'one charge, one slip');
  e.match(e.availableMatches()[0].dieIndex, e.availableMatches()[0].slotIndex);
  assert.equal(e.status, 'won');
});

test('Slip wants a slot the table can already answer', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('slip')],
  });
  assert.equal(e.canUse('slip'), false, 'nothing on the table answers, so there is nothing to slip');
});

test('a slip still in the pool keeps a room from being called hopeless', () => {
  // The arithmetic that gives up early counts dice against symbols owed. A
  // slip answers a symbol and spends no die, so it has to count as one.
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['might', 'might']] }),
    dice: [rigged('might')],
    rng: rng(),
    abilities: [ability('slip')],
  });
  assert.equal(e.status, 'active', 'one die and one slip answers two slots');
  e.useAbility('slip');
  assert.equal(e.legalActions().canReroll, true, 'the die comes back on the next throw');
  e.reroll();
  e.match(0, 1);
  assert.equal(e.status, 'won');
});

test('Blessing calls a spent die back into the hand', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana', 'arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('blessing')],
  });
  assert.equal(e.canUse('blessing'), false, 'nothing has been spent yet');
  e.discard(0);
  assert.equal(e.diceLeft, 1);
  e.useAbility('blessing');
  assert.equal(e.diceLeft, 2);
  assert.equal(e.tray.length, 2);
});

test('an ability with no charges left is refused', () => {
  const e = new Encounter({
    challenge: makeChallenge({ name: 'Test', trials: [['arcana']] }),
    dice: [rigged('might'), rigged('guard')],
    rng: rng(),
    abilities: [ability('secondWind', 0)],
  });
  assert.throws(() => e.useAbility('secondWind', { dieIndex: 0 }), /not available/);
});
