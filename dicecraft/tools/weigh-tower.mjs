// How far up The Iron Tower a company of a given standing actually gets.
//
// A dungeon with no top is only interesting if the top of a good climb lands
// somewhere a player can aim at. Too low and every landing is worth nothing;
// too high and the press-your-luck is gone, because you can walk up to the
// money without ever making a decision. This plays whole climbs with the real
// Game — the same carved floors, the same rooms, the same kit, the same pair
// walking in — and reports where they stop:
//
//   node tools/weigh-tower.mjs [climbs-per-case]
//
// The first table's policy always climbs on, so the number is how far the
// Tower lets a company get rather than how brave they are. The second is the
// one that says whether any of this is a decision: what stopping on each floor
// is worth once the descents that never got there are counted as the nothing
// they are. A press-your-luck with a flat curve there is not one — there
// should be a hump, and it should sit under what a posting of the same
// standing pays, because a posting is work and this is a gamble.
import { Game, createCompanion, newGameState } from '../js/game.js';
import { DEPTHS } from '../js/settings.js';
import { towerDepth, towerGold, towerGrade } from '../js/tower.js';
import { KINDS, kindsFor, kindsForSkills, makePiece, tierFor } from '../js/gear.js';

const RUNS = Number(process.argv[2] || 120);
const LEVELS = [1, 4, 8, 12, 16, 20];

// The kit a character of that standing would be wearing, one piece per slot,
// because a climb is made in what you own rather than in nothing.
function kitOut(who, level) {
  const tier = tierFor(level);
  const may = who.classId ? kindsFor(who.classId) : kindsForSkills(who.proficiencies);
  ['head', 'chest', 'legs', 'feet', 'hand', 'off'].forEach((slot) => {
    const kind = may.find((id) => KINDS[id].slot === slot);
    if (kind) who.gear[slot] = makePiece(kind, tier);
  });
}

// Careful but not clever: take the cheapest match, spend the smallest die when
// nothing answers, and keep throwing while the room lets you.
function playRoom(g) {
  const x = g.expedition;
  let guard = 0;
  while (x.status === 'encounter' && guard++ < 400) {
    const e = x.encounter;
    const matches = e.availableMatches();
    if (matches.length) {
      const cheap = matches.reduce((least, m) => (
        !least || e.tray[m.dieIndex].die.sides < e.tray[least.dieIndex].die.sides ? m : least), null);
      g.match(cheap.dieIndex, cheap.slotIndex);
      continue;
    }
    const acts = e.legalActions();
    if (acts.canDiscard) {
      let at = 0;
      e.tray.forEach((entry, i) => { if (entry.die.sides < e.tray[at].die.sides) at = i; });
      g.discard(at);
      continue;
    }
    if (acts.canReroll) { g.reroll(); continue; }
    break;
  }
}

// A shortest path across a carved floor, because getting to the boss is a
// search rather than a guess.
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

// Everything a floor can stop and ask, answered the same way every time.
// Whether the first creature a floor puts in front of you knocks somebody
// down: the measure of a floor that ambushes rather than warns.
const surprise = { floors: 0, hit: 0 };
function settle(g) {
  const x = g.expedition;
  let guard = 0;
  while (guard++ < 60) {
    if (x.status === 'choosing') {
      const creature = g.tile.challenge && !g.tile.challenge.hazard;
      if (creature && !x.metFirst) {
        x.metFirst = true;
        surprise.floors += 1;
        x.watchFirst = g.downed().length;
      }
      // Fresh hands first, so a bigger company is not winded for nothing.
      const fresh = new Set(g.fresh().map((m) => m.uid));
      const order = [...g.standing()].sort((p, q) => Number(fresh.has(q.uid)) - Number(fresh.has(p.uid)));
      g.choosePair(...order.slice(0, 2).map((m) => m.uid));
      continue;
    }
    if (x.watchFirst !== undefined && x.status !== 'encounter') {
      if (g.downed().length > x.watchFirst || x.status === 'falling') surprise.hit += 1;
      x.watchFirst = undefined;
    }
    if (x.status === 'encounter') { playRoom(g); if (x.status === 'encounter') break; continue; }
    if (x.status === 'falling') { g.takeTheFall(g.actors[g.actors.length - 1].uid); continue; }
    if (x.status === 'spoils') { g.takeBounty(); continue; }
    if (x.status === 'offer') { g.leaveWild(); continue; }
    if (x.status === 'chest') { g.openChest(); continue; }
    return x.status;
  }
  return x.status;
}

// One floor, walked to its boss. Everything on the way is taken, because the
// takings are the prize and a floor half walked is a landing half paid for.
function walkFloor(g) {
  const x = g.expedition;
  let guard = 0;
  while (x.status === 'exploring' && guard++ < 90) {
    const unwalked = Object.values(x.map.tiles)
      .filter((t) => t.state !== 'cleared' && t.kind !== 'boss' && t.kind !== 'passage');
    const aim = unwalked.length ? unwalked[0].key : x.map.boss;
    const path = pathTo(x.map, x.map.position, aim);
    if (!path.length) break;
    g.move(path[0]);
    if (settle(g) !== 'exploring') break;
  }
  return x.status;
}

function climbTower(level, { companions, kitted, seed, stopAt = Infinity }) {
  const g = new Game(newGameState());
  g.createCharacter('Delver', 'fighter');
  g.hero.level = level;
  g.state.renown = 400;
  const mates = Array.from({ length: companions }, () => {
    const mate = createCompanion('sellsword');
    mate.rank = Math.max(1, Math.min(30, level * 2));
    g.state.roster.push(mate);
    return mate;
  });
  if (kitted) [g.hero, ...mates].forEach((m) => { if (m.gear) kitOut(m, level); });
  g.startTower(mates.map((m) => m.uid), seed);
  const x = g.expedition;
  const reached = new Set([1]);
  let guard = 0;
  while (x.status !== 'complete' && x.status !== 'failed' && guard++ < 60) {
    reached.add(x.level);
    if (x.status === 'landing') {
      if (x.level >= stopAt) { g.towerTake(); continue; }
      g.climb();
      x.metFirst = false;
      continue;
    }
    if (walkFloor(g) === 'exploring') break;
  }
  return { best: x.best, gold: g.state.gold - 60, reached: [...reached] };
}

const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;

console.log(`climbs per case: ${RUNS}\n`);
console.log('standing    bare   kitted   +3 mates      (highest floor cleared)');
for (const level of LEVELS) {
  const out = [
    { companions: 1, kitted: false },
    { companions: 1, kitted: true },
    { companions: 3, kitted: true },
  ].map((opts) => avg(Array.from({ length: RUNS }, (_, i) => climbTower(level, { ...opts, seed: 4000 + i }).best)));
  console.log(`${String(level).padStart(5)}     ${out.map((n) => n.toFixed(1).padStart(6)).join('   ')}`);
}

// The number a climber actually feels: having got to a floor, how often you
// get off it. A smooth tower is a slope here; a cliff is a floor where this
// falls off a table.
console.log('\nchance to clear a floor, having reached it (kitted, one mate)');
console.log(`standing  ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `fl ${n}`.padStart(6)).join('')}`);
for (const level of LEVELS) {
  const tries = Array(9).fill(0);
  const wins = Array(9).fill(0);
  for (let i = 0; i < RUNS; i++) {
    const run = climbTower(level, { companions: 1, kitted: true, seed: 4000 + i });
    run.reached.forEach((n) => { if (n <= 8) { tries[n] += 1; if (run.best >= n) wins[n] += 1; } });
  }
  const cells = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (tries[n] >= 5 ? `${Math.round((100 * wins[n]) / tries[n])}%` : '  -').padStart(6));
  console.log(`${String(level).padStart(5)}     ${cells.join('')}`);
}

console.log(`\nthe first creature on a floor knocked somebody down on ${Math.round((100 * surprise.hit) / Math.max(1, surprise.floors))}% of floors`);

console.log('\nexpected take by where you stop (a kitted character and one mate)');
[8, 16].forEach((level) => {
  const posting = DEPTHS.filter((d) => level >= d.minLevel).pop() || DEPTHS[0];
  console.log(`  standing ${level} (a posting at ${posting.name} pays about ${Math.round(posting.gold * 1.25 * 7 * 1.6)}g)`);
  const row = [];
  for (let stop = 1; stop <= 9; stop += 2) {
    const takes = Array.from({ length: RUNS }, (_, i) => (
      climbTower(level, { companions: 1, kitted: true, seed: 4000 + i, stopAt: stop }).gold));
    row.push(`stop ${stop}: ${Math.round(avg(takes)).toString().padStart(4)}g`);
  }
  console.log(`    ${row.join('   ')}`);
});

console.log('\nfloor   a room asks    the boss asks   a room pays   kit it leaves lying about');
[1, 2, 4, 6, 8, 10, 14, 20].forEach((level) => {
  const d = towerDepth(level);
  const say = (t, sym) => `${t[0] === t[1] ? t[0] : `${t[0]}-${t[1]}`}x${sym[0]}-${sym[1]}`;
  console.log(`${String(level).padStart(5)}   ${say(d.trials, d.symbols).padEnd(14)} `
    + `${say(d.boss.trials, d.boss.symbols).padEnd(15)} `
    + `${String(towerGold(level)).padStart(5)}g        tier ${towerGrade(level)}`);
});
