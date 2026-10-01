// The Iron Tower: one dungeon with no top. The floors themselves are
// ordinary floors and are tested as such elsewhere — what is worth testing
// hard here is the ladder they sit on and the one decision on every landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, createCompanion, newGameState } from '../js/game.js';
import {
  MAX_TRIALS, TOWER_STAMINA, ordinal, towerDemand, towerDepth, towerGold, towerGrade,
} from '../js/tower.js';
import { DEPTHS } from '../js/settings.js';
import { MAX_STAMINA } from '../js/data.js';
import { generateMap } from '../js/map.js';
import { createRng } from '../js/rng.js';

function climber(level = 8, mates = 1) {
  const g = new Game(newGameState());
  g.createCharacter('Climber', 'fighter');
  g.hero.level = level;
  g.state.renown = 400;
  const party = Array.from({ length: mates }, () => {
    const mate = createCompanion('sellsword');
    g.state.roster.push(mate);
    return mate;
  });
  return { g, uids: party.map((m) => m.uid) };
}

// Walks a floor by force: a shortest path to the boss, every room on the way
// decided rather than played. The map is carved, so getting there is a search
// rather than a guess.
function pathTo(map, from, to) {
  const back = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (at === to) break;
    map.tiles[at].links.forEach((key) => {
      if (key in back) return;
      back[key] = at;
      queue.push(key);
    });
  }
  const out = [];
  for (let at = to; at && at !== from; at = back[at]) out.unshift(at);
  return out;
}

function settle(g) {
  const x = g.expedition;
  let guard = 0;
  while (guard++ < 40) {
    if (x.status === 'choosing') { g.choosePair(...g.standing().slice(0, 2).map((m) => m.uid)); continue; }
    if (x.status === 'encounter') { x.encounter = null; g.resolveWin(); continue; }
    if (x.status === 'spoils') { g.takeBounty(); continue; }
    if (x.status === 'offer') { g.leaveWild(); continue; }
    return x.status;
  }
  return x.status;
}

function clearTheFloor(g) {
  const x = g.expedition;
  const boss = x.map.boss;
  let guard = 0;
  while (x.status === 'exploring' && guard++ < 80) {
    const path = pathTo(x.map, x.map.position, boss);
    if (!path.length) break;
    g.move(path[0]);
    if (settle(g) !== 'exploring') break;
  }
  return x.status;
}

// What a room (or a boss) asks, on average.
const asks = (spec) => ((spec.trials[0] + spec.trials[1]) / 2) * ((spec.symbols[0] + spec.symbols[1]) / 2);

test('the floors start where The Shallows does, and keep going', () => {
  const first = towerDepth(1);
  assert.deepEqual(first.trials, DEPTHS[0].trials, 'the first floor asks what The Shallows asks');
  assert.deepEqual(first.symbols, DEPTHS[0].symbols);

  let last = 0;
  [1, 2, 3, 6, 12, 40, 200].forEach((level) => {
    const asked = towerDemand(level);
    assert.ok(asked > last, `floor ${level} asks more than the one below`);
    last = asked;
    const depth = towerDepth(level);
    assert.ok(depth.trials[0] >= 1 && depth.trials[1] <= MAX_TRIALS, 'trials stop at a playable number');
    assert.ok(depth.symbols[0] >= 2 && depth.symbols[1] >= depth.symbols[0]);
    assert.ok(depth.boss.symbols[0] > depth.symbols[0], 'the boss always asks bigger trials than a room');
    assert.ok(asks(depth.boss) > asks(depth), 'and more of them in all');
    assert.equal(depth.boss.trials[0], depth.boss.trials[1],
      'a boss has a set number of trials, so it is never a coin toss between a fight and a foregone loss');
  });
  // Past the cap on trials it has to be the trials themselves that grow, or
  // the ladder stops being one.
  assert.ok(towerDepth(40).symbols[0] > towerDepth(10).symbols[0]);
  assert.ok(towerDepth(4000).symbols[0] > towerDepth(400).symbols[0], 'and it never stops');
});

test('the Tower is a slope, not a staircase with a cliff in it', () => {
  // A climb is made with the same hands all the way up, so no floor may ask
  // much more than the one below it. The old table put the fourth floor's boss
  // at half as much again as the third's, and a company winning most of its
  // fights met one it could not win before a die was thrown.
  for (let level = 2; level <= 200; level++) {
    const below = towerDepth(level - 1);
    const here = towerDepth(level);
    assert.ok(asks(here) >= asks(below), `floor ${level}'s rooms ask no less than the floor below`);
    assert.ok(asks(here.boss) >= asks(below.boss), `floor ${level}'s boss asks no less than the one below`);
    if (level >= 3) {
      assert.ok(asks(here) <= asks(below) * 1.35, `floor ${level}'s rooms jump ${asks(below)} -> ${asks(here)}`);
      assert.ok(asks(here.boss) <= asks(below.boss) * 1.3, `floor ${level}'s boss jumps ${asks(below.boss)} -> ${asks(here.boss)}`);
    }
    const [w, h] = here.size;
    const [bw, bh] = below.size;
    assert.ok(w * h - bw * bh <= 6, `floor ${level} grows by ${w * h - bw * bh} rooms at once`);
  }
});

test('a Tower floor is drawable and tileable however high it goes', () => {
  [1, 8, 50, 5000].forEach((level) => {
    const depth = towerDepth(level);
    assert.ok(depth.size[0] <= 8 && depth.size[1] <= 6, `floor ${level} still fits on a phone`);
    assert.ok(depth.settings >= 2 && depth.settings <= 3);
    assert.equal(depth.seal, null, 'and hands out no seals, ever');
  });
});

test('what a floor pays climbs, but not compounding for ever', () => {
  let last = 0;
  [1, 2, 3, 6, 10, 20, 60].forEach((level) => {
    const gold = towerGold(level);
    assert.ok(gold > last, `floor ${level} pays more than the one below`);
    last = gold;
  });
  // A room down here pays under what a room of the ordinary ladder pays, and
  // it very nearly stops climbing past the sixth floor. Both on purpose: a
  // floor's takings are every room on it with the loot multiplier climbing,
  // so a floor pays far more than the sum of its rooms, and one floor of the
  // Tower is meant to be worth about one posting.
  assert.ok(towerGold(6) < DEPTHS[5].gold, 'a Tower room pays under an ordinary one');
  assert.ok(towerGold(6) > DEPTHS[4].gold * 0.6, 'but not so far under that the sixth floor is charity');
  assert.ok(towerGold(20) < towerGold(6) * 2, 'and the twentieth has not run away with the economy');
});

test('kit is graded by the floor, not by the climber', () => {
  assert.equal(towerGrade(1), 1);
  assert.ok(towerGrade(12) > towerGrade(3), 'higher floors leave better things lying about');
  assert.equal(towerGrade(60), 5, 'and it stops at the best there is');
});

test('a climb costs stamina at the door and nothing after it', () => {
  const { g, uids } = climber(8, 1);
  const before = g.hero.stamina;
  g.startTower(uids);
  assert.equal(g.hero.stamina, before - TOWER_STAMINA);
  const x = g.expedition;
  assert.equal(x.mode, 'tower');
  assert.equal(x.level, 1, 'and opens on the first floor');
  assert.equal(x.status, 'exploring', 'at the entrance of a floor to walk');
  assert.ok(Object.keys(x.map.tiles).length > 3, 'which is a carved map, not a room');
  assert.ok(Object.values(x.map.tiles).some((t) => t.kind === 'boss'), 'with a boss at the far end');
});

test('somebody too worn cannot climb', () => {
  const { g, uids } = climber(8, 1);
  g.hero.stamina = TOWER_STAMINA - 1;
  assert.throws(() => g.startTower(uids), /too worn/);
  assert.equal(g.expedition, null, 'and nothing is started');
});

test('the boss of a Tower floor is a landing, not a way out', () => {
  const { g, uids } = climber(12, 1);
  g.startTower(uids, 11);
  assert.equal(clearTheFloor(g), 'landing', 'the floor ends on a landing');
  const x = g.expedition;
  assert.equal(x.best, 1);
  assert.ok(x.pending.gold > 0, 'with what the floor paid still on the table');
  assert.equal(g.state.gold, 60, 'and not a coin of it banked yet');
});

test('climbing on empties your hands', () => {
  const { g, uids } = climber(12, 1);
  g.startTower(uids, 12);
  clearTheFloor(g);
  const x = g.expedition;
  const firstFloor = x.pending.gold;
  assert.ok(firstFloor > 0);
  g.climb();
  assert.equal(x.level, 2);
  assert.equal(x.pending.gold, 0, 'the first floor’s takings are gone the moment you leave it');
  assert.equal(x.pending.training, 0);
  assert.deepEqual(x.pending.gear, []);
  assert.equal(x.status, 'exploring', 'and there is a new floor to walk');
  assert.ok(x.map.width >= towerDepth(1).size[0], 'a bigger one');
});

test('one floor’s takings leave the Tower, and it is the floor you stopped on', () => {
  const { g, uids } = climber(12, 1);
  const gold = g.state.gold;
  g.startTower(uids, 13);
  clearTheFloor(g);
  g.climb();
  clearTheFloor(g);
  const took = g.expedition.pending.gold;
  const lessons = g.expedition.pending.training;
  g.towerTake();
  assert.equal(g.state.gold, gold + took, 'the second floor’s gold, not both floors’');
  assert.equal(g.state.training, lessons);
  assert.equal(g.expedition.status, 'complete');
  assert.equal(g.expedition.best, 2);
});

test('being beaten leaves the floor’s takings on the floor', () => {
  const { g, uids } = climber(12, 0);
  const gold = g.state.gold;
  g.startTower(uids, 14);
  clearTheFloor(g);
  const x = g.expedition;
  assert.ok(x.pending.gold > 0);
  g.climb();
  g.takeTheFall(g.hero.uid, true);
  assert.equal(x.status, 'failed');
  assert.equal(g.state.gold, gold, 'and not a coin of it comes down');
});

test('nothing in the Tower wears kit out', () => {
  const { g, uids } = climber(8, 0);
  g.hero.gear.chest = { id: 'p1', kind: 'plate', tier: 3, wear: 0, sockets: [] };
  g.startTower(uids, 15);
  g.takeTheFall(g.hero.uid, true);
  assert.equal(g.state.hero.gear.chest.wear, 0, 'a floor that beat you costs the takings and nothing else');
});

test('a climb in progress survives being written down and read back', () => {
  const { g, uids } = climber(12, 1);
  g.startTower(uids, 16);
  clearTheFloor(g);
  const back = new Game(newGameState());
  assert.equal(back.adoptSave(g.toJSON()), true);
  const x = back.expedition;
  assert.equal(x.mode, 'tower');
  assert.equal(x.status, 'landing');
  assert.equal(x.level, 1);
  assert.equal(x.pending.gold, g.expedition.pending.gold);
  // The depth row is rebuilt rather than saved, so it has to come back right.
  assert.deepEqual(back.runDepth, towerDepth(1));
  back.climb();
  assert.equal(back.expedition.level, 2, 'and it can be climbed on from there');
});

test('a full stamina bar is worth more than one climb', () => {
  assert.ok(MAX_STAMINA >= TOWER_STAMINA * 2, 'or nobody ever climbs twice in a day');
});

test('a floor warns before it hurts: the rooms by the way in ask what the floor below did', () => {
  // The first fights on a new floor are a reading of it, so a company that is
  // struggling can climb out before it has walked into the full weight of it.
  const inRange = (n, [lo, hi]) => n >= lo && n <= hi;
  let near = 0;
  let far = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const map = generateMap({ depth: towerDepth(6), rng: createRng(seed) });
    const lead = Math.max(1, Math.floor(map.tiles[map.boss].dist / 3));
    Object.values(map.tiles).forEach((tile) => {
      if (tile.kind !== 'room' || !tile.challenge) return;
      const spec = tile.dist <= lead ? towerDepth(5) : towerDepth(6);
      assert.ok(inRange(tile.challenge.trials.length, spec.trials),
        `a room ${tile.dist} from the door has ${tile.challenge.trials.length} trials`);
      tile.challenge.trials.forEach((t) => assert.ok(inRange(t.required.length, spec.symbols)));
      if (tile.dist <= lead) near += 1; else far += 1;
    });
  }
  assert.ok(near > 10 && far > 10, 'both kinds of room turned up');
  assert.equal(towerDepth(1).warmup, null, 'and the first floor has nothing below it to borrow from');
});
