import test from 'node:test';
import assert from 'node:assert/strict';
import { bfs, canMove, generateMap, reveal } from '../js/map.js';
import { DEPTHS, SETTING_LIST, depthByNumber, settingDef } from '../js/settings.js';
import { MIMIC, WILD_TOKENS, denizen } from '../js/bestiary.js';
import { hazardDef, hazardVisible } from '../js/hazards.js';
import { createRng } from '../js/rng.js';
import { Game, newGameState } from '../js/game.js';

const build = (depth, seed) => generateMap({ depth: depthByNumber(depth), rng: createRng(seed) });

test('every generated floor is a single connected space', () => {
  for (const depth of DEPTHS) {
    for (let seed = 0; seed < 25; seed++) {
      const map = build(depth.depth, seed * 31 + depth.depth);
      const tiles = Object.keys(map.tiles);
      const reached = Object.keys(bfs(map, map.entrance));
      assert.equal(reached.length, tiles.length, `depth ${depth.depth} seed ${seed} left tiles stranded`);
    }
  }
});

test('links are always mutual', () => {
  const map = build(5, 99);
  Object.values(map.tiles).forEach((tile) => {
    tile.links.forEach((k) => {
      assert.ok(map.tiles[k], 'a link points at a real tile');
      assert.ok(map.tiles[k].links.includes(tile.key), 'and points back');
    });
  });
});

test('a floor has exactly one way in and one boss, and the boss is the far end', () => {
  for (let seed = 0; seed < 20; seed++) {
    const map = build(4, seed);
    const kinds = Object.values(map.tiles).map((t) => t.kind);
    assert.equal(kinds.filter((k) => k === 'entrance').length, 1);
    assert.equal(kinds.filter((k) => k === 'boss').length, 1);
    const dist = bfs(map, map.entrance);
    const furthest = Math.max(...Object.values(dist));
    assert.equal(dist[map.boss], furthest, 'the boss sits at the far end of the floor');
    assert.ok(furthest >= 2, 'and not next door');
  }
});

test('deeper floors are bigger', () => {
  const small = build(1, 5);
  const large = build(6, 5);
  assert.ok(Object.keys(large.tiles).length > Object.keys(small.tiles).length);
});

test('settings are tiled together, and each room asks for what is standing in it', () => {
  const map = build(6, 12);
  assert.equal(new Set(map.settings).size, depthByNumber(6).settings);
  const used = new Set(Object.values(map.tiles).map((t) => t.setting));
  used.forEach((id) => assert.ok(map.settings.includes(id)));
  Object.values(map.tiles).forEach((tile) => {
    if (!tile.challenge) return;
    if (tile.challenge.hazard) {
      // A trap or a hazard asks for what it is, and there is nobody in it.
      const def = hazardDef(tile.challenge.hazard);
      assert.equal(tile.challenge.trials.length, 1, 'the floor asks one trial, never three');
      tile.challenge.trials[0].required.forEach((sym) => assert.ok(def.demands.includes(sym)));
      return;
    }
    assert.ok(tile.mob, `a ${tile.kind} with a challenge and nothing in it`);
    assert.equal(tile.challenge.mob, tile.mob, 'the encounter and the token are the same creature');
    const mob = denizen(tile.mob);
    assert.equal(tile.challenge.name, tile.kind === 'boss' || tile.kind === 'lair' ? tile.challenge.name : mob.name);
    tile.challenge.trials.flatMap((t) => t.required).forEach((sym) => {
      assert.ok(mob.demands.includes(sym), `${mob.id} asked for ${sym}, which it does not demand`);
    });
  });
});

test('what lives in a room comes from the setting it lives in', () => {
  for (let seed = 0; seed < 8; seed++) {
    const map = build(6, 40 + seed);
    Object.values(map.tiles).forEach((tile) => {
      const setting = settingDef(tile.setting);
      if (tile.kind === 'room') {
        assert.ok(setting.denizens.includes(tile.mob), `${tile.mob} does not live in ${setting.id}`);
      } else if (tile.kind === 'treasure') {
        assert.ok(tile.chest, 'a hoard is a chest');
        if (tile.chest.mimic) assert.equal(tile.mob, MIMIC, 'the only thing that sits in a chest is a mimic');
        else assert.equal(tile.mob, undefined, 'an honest chest has nobody in it');
      } else if (tile.kind === 'boss') {
        assert.ok(setting.bosses.some((b) => b.mob === tile.mob), `${tile.mob} is no lord of ${setting.id}`);
        assert.equal(tile.challenge.sentence, tile.challenge.name, 'a boss has a name of its own');
      } else if (tile.kind === 'lair') {
        assert.equal(tile.mob, WILD_TOKENS[tile.wild.defId], 'the lair holds the creature you can take home');
      }
    });
  }
});

test('a setting still advises the two symbols its creatures actually want', () => {
  // The room asks for what is standing in it, and a place is described by the
  // two symbols it keeps asking for. Those are only the same claim while each
  // setting's roster leans the way its pool says it does — so it is checked
  // rather than assumed.
  const top = (symbols) => {
    const tally = new Map();
    symbols.forEach((s) => tally.set(s, (tally.get(s) || 0) + 1));
    return new Set([...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s));
  };
  SETTING_LIST.forEach((setting) => {
    assert.ok(setting.denizens.length >= 6, `${setting.id} should keep at least six kinds of thing`);
    assert.equal(setting.bosses.length, 2, `${setting.id} should have two lords`);
    const wanted = top(setting.denizens.flatMap((id) => denizen(id).demands));
    top(setting.pool).forEach((symbol) => {
      assert.ok(wanted.has(symbol), `${setting.id} advertises ${symbol} but its denizens do not ask for it`);
    });
  });
});

test('settings form regions rather than confetti', () => {
  // Most tiles should share their setting with at least one neighbor.
  let lonely = 0;
  const map = build(6, 3);
  Object.values(map.tiles).forEach((tile) => {
    const same = tile.links.some((k) => map.tiles[k].setting === tile.setting);
    if (!same) lonely++;
  });
  assert.ok(lonely <= 2, `${lonely} tiles were isolated from their own setting`);
});

test('only the entrance and its neighbors are visible at the start', () => {
  const map = build(3, 8);
  const entrance = map.tiles[map.entrance];
  assert.equal(entrance.state, 'cleared');
  entrance.links.forEach((k) => assert.equal(map.tiles[k].state, 'seen'));
  const hidden = Object.values(map.tiles).filter((t) => t.state === 'hidden');
  assert.ok(hidden.length > 0, 'the rest of the floor is still dark');
});

test('revealing from a tile only lights its own neighbors', () => {
  const map = build(6, 21);
  const far = Object.values(map.tiles).find((t) => t.state === 'hidden' && t.links.length > 1);
  reveal(map, far.key);
  far.links.forEach((k) => assert.notEqual(map.tiles[k].state, 'hidden'));
});

test('you may only step to a tile joined to the one you are on', () => {
  const map = build(2, 4);
  const here = map.tiles[map.position];
  assert.equal(canMove(map, here.links[0]), true);
  const stranger = Object.values(map.tiles).find((t) => !here.links.includes(t.key) && t.key !== here.key);
  if (stranger) assert.equal(canMove(map, stranger.key), false);
});

test('the same seed builds the same floor', () => {
  const a = build(5, 4242);
  const b = build(5, 4242);
  assert.deepEqual(Object.keys(a.tiles).sort(), Object.keys(b.tiles).sort());
  assert.equal(a.boss, b.boss);
  assert.deepEqual(a.settings, b.settings);
});

test('an upright floor is the same dungeon stood on its end', () => {
  const depth = depthByNumber(4); // 6 across, 4 down
  const wide = generateMap({ depth, rng: createRng(4242) });
  const tall = generateMap({ depth, rng: createRng(4242), upright: true });

  assert.deepEqual([wide.width, wide.height], [6, 4]);
  assert.deepEqual([tall.width, tall.height], [4, 6], 'the sides swap');
  assert.ok(tall.height > tall.width, 'and a phone gets a column');
  // The same amount of dungeon, carved the same way, just a different shape.
  assert.equal(Object.keys(tall.tiles).length, Object.keys(wide.tiles).length);
  assert.ok(tall.entrance, 'with a way in');
  assert.ok(Object.values(tall.tiles).some((t) => t.kind === 'boss'), 'and something at the bottom');
});

test('the shape a floor was opened with travels with the expedition', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  const x = g.startExpedition(1, [], 77, null, true);
  assert.equal(x.upright, true);
  assert.ok(x.map.height > x.map.width);
  // It is written down with the floor, so a reload comes back to the same
  // dungeon rather than a landscape one under a portrait screen.
  const back = Game.load({ getItem: () => g.toJSON(), setItem: () => {} }, 'k');
  assert.equal(back.expedition.upright, true);
  assert.deepEqual([back.expedition.map.width, back.expedition.map.height], [x.map.width, x.map.height]);
});

test('a hoard is sometimes a mimic, and a passage is sometimes worse than a passage', () => {
  let mimics = 0;
  let honest = 0;
  const kinds = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const map = build(5, 300 + seed);
    Object.values(map.tiles).forEach((tile) => {
      if (tile.kind === 'treasure') (tile.chest.mimic ? (mimics += 1) : (honest += 1));
      if (tile.kind === 'passage' && tile.hazard) {
        const def = hazardDef(tile.hazard.id);
        kinds.add(def.kind);
        assert.ok(!def.settings || def.settings.includes(tile.setting), `${def.id} does not belong in ${tile.setting}`);
        assert.equal(tile.challenge.hazard, def.id);
        // A trap is not on the map until it has gone off; the rest are.
        assert.equal(hazardVisible(tile), def.kind !== 'trap');
      }
    });
  }
  assert.ok(mimics > 0 && honest > 0, 'both kinds of chest turn up');
  assert.ok(honest > mimics, 'and most chests are honest');
  ['trap', 'hazard', 'obstacle'].forEach((kind) => assert.ok(kinds.has(kind), `no ${kind} ever turned up`));
});

test('rooms are named after what is in them, and nothing else', () => {
  const map = build(6, 21);
  Object.values(map.tiles).forEach((tile) => {
    if (tile.challenge) assert.equal(tile.challenge.where, undefined, 'no place names on the rooms');
  });
});
