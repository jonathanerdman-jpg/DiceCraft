import { WILD_COMPANIONS, WILD_COST, companionDef } from './data.js';
import { MIMIC, WILD_TOKENS, denizen } from './bestiary.js';
import {
  CHEST_TRAPS, MIMIC_CHANCE, TRAPPED_CHANCE, hazardChance, hazardDef, hazardSpec, hazardsFor,
} from './hazards.js';
import { SETTING_LIST, settingDef } from './settings.js';
import { generateChallenge } from './engine.js';

export const TILE_KINDS = ['entrance', 'room', 'passage', 'treasure', 'shrine', 'boss', 'lair'];

// Something living down here is a rare find, not a fixture of the floor.
export const LAIR_CHANCE = 0.2;
export const BEFRIEND_CHANCE = 0.45;

// Deeper floors turn up stranger company.
function wildWeights(depth) {
  return [
    ['uncommon', Math.max(20, 70 - depth * 8)],
    ['rare', Math.min(55, 20 + depth * 6)],
    ['epic', Math.max(0, depth * 3 - 3)],
  ];
}

export function rollWild(rng, depth, owned = new Set()) {
  const rarity = rng.weighted(wildWeights(depth.depth));
  const wanted = WILD_COMPANIONS.filter((c) => c.rarity === rarity && !owned.has(c.id));
  const any = WILD_COMPANIONS.filter((c) => !owned.has(c.id));
  const pool = wanted.length ? wanted : any;
  if (!pool.length) return null;
  const creature = pool[rng.int(pool.length)];
  return {
    defId: creature.id,
    rarity: creature.rarity,
    mode: rng.chance(BEFRIEND_CHANCE) ? 'befriend' : 'subdue',
    price: WILD_COST[creature.rarity],
  };
}

const key = (x, y) => `${x},${y}`;
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function neighbors(map, tile) {
  return ORTHO
    .map(([dx, dy]) => map.tiles[key(tile.x + dx, tile.y + dy)])
    .filter(Boolean);
}

export function linked(map, tile) {
  return tile.links.map((k) => map.tiles[k]).filter(Boolean);
}

export function bfs(map, fromKey) {
  const dist = { [fromKey]: 0 };
  const queue = [fromKey];
  while (queue.length) {
    const current = queue.shift();
    for (const next of map.tiles[current].links) {
      if (dist[next] === undefined) {
        dist[next] = dist[current] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

// Randomised Prim over the full grid, so every cell starts connected.
function carve(width, height, rng) {
  const all = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) all.push({ x, y, key: key(x, y), links: [] });
  const byKey = Object.fromEntries(all.map((t) => [t.key, t]));
  const inTree = new Set([rng.pick(all).key]);
  const frontier = [];
  const pushFrontier = (tile) => {
    ORTHO.forEach(([dx, dy]) => {
      const other = byKey[key(tile.x + dx, tile.y + dy)];
      if (other && !inTree.has(other.key)) frontier.push([tile, other]);
    });
  };
  pushFrontier(byKey[[...inTree][0]]);
  while (frontier.length) {
    const i = rng.int(frontier.length);
    const [from, to] = frontier.splice(i, 1)[0];
    if (inTree.has(to.key)) continue;
    from.links.push(to.key);
    to.links.push(from.key);
    inTree.add(to.key);
    pushFrontier(to);
  }
  return { all, byKey };
}

// Trimming leaves gives the floor an irregular outline instead of a full
// rectangle, while keeping it a single connected space.
function trimLeaves(tiles, byKey, rng, keepRatio) {
  const target = Math.max(6, Math.round(tiles.length * keepRatio));
  let live = tiles.slice();
  let guard = 0;
  while (live.length > target && guard++ < 500) {
    const leaves = live.filter((t) => t.links.length === 1);
    if (!leaves.length) break;
    const victim = leaves[rng.int(leaves.length)];
    victim.links.forEach((k) => {
      byKey[k].links = byKey[k].links.filter((l) => l !== victim.key);
    });
    victim.links = [];
    live = live.filter((t) => t.key !== victim.key);
  }
  return live;
}

function addLoops(live, byKey, rng, chance) {
  live.forEach((tile) => {
    ORTHO.forEach(([dx, dy]) => {
      const other = byKey[key(tile.x + dx, tile.y + dy)];
      if (!other || !other.links.length) return;
      if (tile.links.includes(other.key)) return;
      if (!rng.chance(chance)) return;
      tile.links.push(other.key);
      other.links.push(tile.key);
    });
  });
}

// Each floor is tiled from two or three settings grown out of seed rooms, so
// the map reads as regions rather than confetti. A place on the world map
// names its own settings — that is what makes a return trip feel like a
// return — and anywhere else takes what the dice give it.
function paintSettings(live, rng, count, fixed) {
  const named = (fixed || []).map((id) => settingDef(id));
  // A place that names fewer settings than the tier tiles together lets the
  // dice fill the rest, so a deep place still has somewhere unfamiliar in it.
  const spare = rng.shuffle(SETTING_LIST.filter((s) => !named.includes(s)));
  const chosen = [...named, ...spare].slice(0, count);
  const seeds = rng.shuffle(live).slice(0, count);
  live.forEach((tile) => {
    let best = 0;
    let bestDist = Infinity;
    seeds.forEach((seed, i) => {
      const d = Math.abs(seed.x - tile.x) + Math.abs(seed.y - tile.y) + rng.next() * 0.6;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    tile.setting = chosen[best].id;
  });
  return chosen.map((s) => s.id);
}

// `upright` turns the floor on its side: the same number of rooms and the
// same carving, laid out taller than it is wide. A floor drawn for a phone is
// a column, not a strip with the screen empty above and below it. It travels
// with the expedition rather than being read off the window, so two people on
// a shared quest walk the same shape of dungeon whatever they are holding.
// A floor is built knowing what is coming down it. Gear makes a hand better,
// so the rooms ask for more — and the `bite` carried down from the expedition
// is how much more. It is spent on the room rather than on the range every
// trial is drawn from: two earlier attempts widened the range instead, and
// both made kit a trap. Widening both ends had a fully outfitted company
// clearing nothing at all in tools/weigh-party.mjs; widening only the top
// still cost more than the kit was worth, because a deep room has three
// trials and each one grew. A bite is a symbol or two added somewhere in the
// room, and js/engine.js does the adding.

export function generateMap({ depth, rng, owned = new Set(), settings: fixed, upright = false, bite = 0 }) {
  const [across, down] = depth.size;
  const [width, height] = upright ? [down, across] : [across, down];
  const { all, byKey } = carve(width, height, rng);
  const live = trimLeaves(all, byKey, rng, 0.78);
  addLoops(live, byKey, rng, 0.14);
  const settings = paintSettings(live, rng, depth.settings, fixed);

  const tiles = Object.fromEntries(live.map((t) => [t.key, t]));
  const map = { width, height, tiles, settings, depth: depth.depth };

  // The way in is on the outer edge; the boss sits as far from it as the
  // floor allows.
  const edge = live.filter((t) => t.x === 0 || t.y === 0 || t.x === width - 1 || t.y === height - 1);
  const entrance = rng.pick(edge.length ? edge : live);
  entrance.kind = 'entrance';
  map.entrance = entrance.key;

  const dist = bfs(map, entrance.key);
  live.forEach((t) => { t.dist = dist[t.key] ?? 0; });
  const ranked = live.filter((t) => t.kind !== 'entrance').sort((a, b) => b.dist - a.dist);
  const boss = ranked[0];
  boss.kind = 'boss';
  map.boss = boss.key;

  const rest = ranked.slice(1);
  const deadEnds = rest.filter((t) => t.links.length === 1);
  deadEnds.slice(0, Math.max(1, Math.round(deadEnds.length / 2))).forEach((t) => { t.kind = 'treasure'; });
  const shrinePool = rest.filter((t) => !t.kind && t.dist >= 2);
  if (shrinePool.length) shrinePool[rng.int(shrinePool.length)].kind = 'shrine';
  rest.forEach((t) => { if (!t.kind) t.kind = rng.chance(0.72) ? 'room' : 'passage'; });

  // Rarely, one of those rooms turns out to be a lair.
  if (rng.chance(LAIR_CHANCE)) {
    const dens = rest.filter((t) => t.kind === 'room' && t.dist >= 2);
    if (dens.length) {
      const den = dens[rng.int(dens.length)];
      const wild = rollWild(rng, depth, owned);
      if (wild) { den.kind = 'lair'; den.wild = wild; }
    }
  }

  // Every room gets what is in it up front, and everything else follows from
  // that: a room is named after the creature standing in it, its trials are
  // built out of what that creature demands, and the encounter is headed with
  // the same creature's token. The plan does not show it. From the next room
  // over you know that something is in there and nothing more; what it is,
  // you find out in the doorway.
  const bossSpec = { trials: depth.boss.trials, symbols: depth.boss.symbols };
  // Dealt from a shuffled bag rather than picked fresh each time: six kinds of
  // thing live in a setting, and a floor should show you all six before it
  // shows you any of them twice.
  const bags = {};
  const deal = (name, list) => {
    if (!bags[name] || !bags[name].length) bags[name] = rng.shuffle(list.slice());
    return bags[name].pop();
  };
  // A trap, a hazard or an obstacle is one trial built from what it wants.
  // A floor that has a lead-in (the Tower's do) asks the floor below's amount
  // in the rooms nearest the way in, and its own the further in you go. The
  // first fights on a new floor are a fair reading of it rather than the full
  // weight of it, so a company that is struggling finds out while it can
  // still turn round and climb out, instead of in the first room it meets.
  const leadIn = Math.max(1, Math.floor(boss.dist / 3));
  const specAt = (tile) => (depth.warmup && tile.dist <= leadIn ? { ...depth, ...depth.warmup } : depth);
  const hazardChallenge = (id, tile) => {
    const def = hazardDef(id);
    const challenge = generateChallenge({ spec: hazardSpec(specAt(tile)), pool: def.demands, rng, name: def.name });
    challenge.hazard = def.id;
    return challenge;
  };
  const hazardOdds = hazardChance(depth.depth);
  live.forEach((tile) => {
    tile.state = 'hidden';
    const setting = settingDef(tile.setting);
    if (tile.kind === 'room') {
      const mob = denizen(deal(tile.setting, setting.denizens));
      tile.mob = mob.id;
      tile.challenge = generateChallenge({
        spec: specAt(tile), pool: mob.demands, rng, name: mob.name, mob: mob.id, extra: bite,
      });
    } else if (tile.kind === 'treasure') {
      // A chest, as far as anybody can tell from the doorway. Some of them are
      // honest, some of the honest ones are trapped, and some of them are not
      // chests at all.
      if (rng.chance(MIMIC_CHANCE)) {
        const mob = denizen(MIMIC);
        tile.mob = mob.id;
        tile.chest = { mimic: true, trap: null };
        tile.challenge = generateChallenge({
          spec: depth, pool: mob.demands, rng, name: mob.name, mob: mob.id, extra: bite,
        });
      } else if (rng.chance(TRAPPED_CHANCE)) {
        const trap = rng.pick(CHEST_TRAPS);
        tile.chest = { mimic: false, trap };
        tile.challenge = hazardChallenge(trap, tile);
      } else {
        tile.chest = { mimic: false, trap: null };
      }
    } else if (tile.kind === 'lair') {
      // A creature is not a boss, but it is not an ordinary room either — and
      // whatever is in the lair is the thing you may be taking home, so the
      // token, the name and the trials are all that creature's.
      const def = companionDef(tile.wild.defId);
      const mob = denizen(WILD_TOKENS[tile.wild.defId] || 'wolf');
      tile.mob = mob.id;
      if (tile.wild.mode === 'subdue') {
        tile.challenge = generateChallenge({
          spec: bossSpec, pool: mob.demands, rng, name: def.title, mob: mob.id, extra: bite,
        });
      }
    } else if (tile.kind === 'boss') {
      const lord = rng.pick(setting.bosses);
      const mob = denizen(lord.mob);
      tile.mob = mob.id;
      tile.challenge = generateChallenge({
        spec: bossSpec, pool: mob.demands, rng, name: lord.name, mob: mob.id, boss: true, proper: true, extra: bite,
      });
    } else if (tile.kind === 'passage') {
      // A passage holds nothing to fight, which is not the same as holding
      // nothing. Some are dressed, and some are the floor trying to cost you
      // something on the way through: a trap you will not see coming, or a
      // hazard or an obstacle you will.
      if (rng.chance(hazardOdds)) {
        const hazard = rng.pick(hazardsFor(tile.setting));
        tile.hazard = { id: hazard.id, sprung: false };
        tile.challenge = hazardChallenge(hazard.id, tile);
        tile.prop = null;
      } else {
        tile.prop = rng.chance(0.42) ? (rng.chance(0.5) ? 'prop_bones' : 'prop_brazier') : null;
      }
    }
  });

  map.position = entrance.key;
  entrance.state = 'cleared';
  reveal(map, entrance.key);
  map.rooms = live.filter((t) => t.kind === 'room' || t.kind === 'treasure').length;
  return map;
}

export function reveal(map, fromKey) {
  const tile = map.tiles[fromKey];
  if (!tile) return;
  tile.links.forEach((k) => {
    const next = map.tiles[k];
    if (next && next.state === 'hidden') next.state = 'seen';
  });
}

export function canMove(map, toKey) {
  const here = map.tiles[map.position];
  return Boolean(here && here.links.includes(toKey));
}

export function cleared(map) {
  return Object.values(map.tiles).filter((t) => t.state === 'cleared').length;
}
