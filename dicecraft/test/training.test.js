import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTrain, costToMaster, isMastered, lessonsWon, shortfall, trainingCost,
} from '../js/training.js';
import { Game, createCompanion, newGameState } from '../js/game.js';
import { MAX_LEVEL } from '../js/hero.js';
import { MAX_RANK } from '../js/data.js';

function camp() {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  return g;
}

test('a step costs much more the higher somebody already is', () => {
  const cheap = trainingCost({ isHero: true, level: 1 });
  const dear = trainingCost({ isHero: true, level: 19 });
  assert.ok(dear > cheap * 40, `${dear} should dwarf ${cheap}`);
  // Strictly rising, with no flat stretch anywhere on the ladder.
  for (let level = 1; level < MAX_LEVEL - 1; level++) {
    assert.ok(trainingCost({ isHero: true, level: level + 1 }) > trainingCost({ isHero: true, level }));
  }
  for (let rank = 1; rank < MAX_RANK - 1; rank++) {
    assert.ok(trainingCost({ rank: rank + 1 }) > trainingCost({ rank }));
  }
});

test('somebody at the cap has nothing left to buy', () => {
  assert.equal(trainingCost({ isHero: true, level: MAX_LEVEL }), null);
  assert.equal(trainingCost({ rank: MAX_RANK }), null);
  assert.equal(isMastered({ rank: MAX_RANK }), true);
  assert.equal(costToMaster({ rank: MAX_RANK }), 0);
  assert.equal(canTrain(999999, { rank: MAX_RANK }), false);
  assert.equal(shortfall(0, { rank: MAX_RANK }), 0);
});

test('the road to the top is the sum of every step on it', () => {
  const member = { rank: 28 };
  assert.equal(costToMaster(member), trainingCost({ rank: 28 }) + trainingCost({ rank: 29 }));
});

test('deeper rooms teach more, and a boss teaches most', () => {
  assert.ok(lessonsWon(5) > lessonsWon(1));
  assert.ok(lessonsWon(3, true) > lessonsWon(3));
});

test('training spends the pool and moves exactly one person one step', () => {
  const g = camp();
  const mate = createCompanion('sellsword');
  g.state.roster.push(mate);
  g.state.training = 1000;
  const cost = trainingCost(g.hero);

  g.train(g.hero.uid);
  assert.equal(g.hero.level, 2);
  assert.equal(g.state.training, 1000 - cost);
  assert.equal(mate.rank, 1, 'and nobody else moved with them');
});

test('you cannot train on lessons you do not have', () => {
  const g = camp();
  g.state.training = 10;
  assert.throws(() => g.train(g.hero.uid), /lessons are needed/);
  assert.equal(g.hero.level, 1);
  assert.equal(g.state.training, 10, 'and a refused step costs nothing');
});

test('a mastered character cannot be trained further', () => {
  const g = camp();
  g.hero.level = MAX_LEVEL;
  g.state.training = 999999;
  assert.throws(() => g.train(g.hero.uid), /nothing left to learn/);
  assert.equal(g.hero.level, MAX_LEVEL);
});

test('training happens at camp, not halfway down a staircase', () => {
  const g = camp();
  g.hero.level = 8;
  g.state.training = 9999;
  g.startExpedition(1, [], 4);
  assert.throws(() => g.train(g.hero.uid), /not in the middle of a floor/);
});

test('what the pool will buy is listed for the camp screen', () => {
  const g = camp();
  g.state.roster.push(createCompanion('sellsword'));
  g.state.training = trainingCost({ rank: 1 });
  const rows = g.trainable();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].member.uid, g.hero.uid);
  assert.equal(rows[0].afford, false, 'a level costs more than a rank');
  assert.equal(rows[1].afford, true);
});

test('an old save sweeps whatever everybody had earned into the pool', () => {
  const hero = { uid: 'h1', isHero: true, classId: 'ranger', level: 4, xp: 120, stamina: 10 };
  const mate = { uid: 'c1', defId: 'sellsword', rank: 3, xp: 45, stamina: 10 };
  const raw = JSON.stringify({ version: 2, hero, roster: [mate], gold: 10, seals: {}, renown: 0, day: 1, log: [] });
  const g = Game.load({ getItem: () => raw, setItem: () => {} }, 'k');
  assert.equal(g.state.training, 165, 'nothing anybody earned is thrown away');
  assert.equal(g.hero.xp, undefined, 'but it is no longer theirs alone');
  assert.equal(g.state.roster[0].xp, undefined);
});
