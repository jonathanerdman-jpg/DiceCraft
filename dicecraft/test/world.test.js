import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ART_DIR, ATLAS_SIZE, HEX, PLACES, RIVER, SERPENT, SHIP, TERRAIN, ZONES,
  artFor, atlasExtent, atlasHexes, depthOf, havensAdjacent, havensOf, hexCenter, isOpen,
  openPlaces, placeById, placesIn, settingsOf, sizeOf, terrainAt, tierOf,
  zoneById,
} from '../js/world.js';
import { DEPTHS, SETTING_LIST, floorOf } from '../js/settings.js';
import { SET_NAMES, WILD_NAMES } from '../js/tiles.js';
import { Game, newGameState } from '../js/game.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('every place stands on dry land in its own country, in its own hex', () => {
  for (const zone of ZONES) {
    const seen = new Set();
    const local = [...placesIn(zone), ...havensOf(zone)];
    assert.ok(placesIn(zone).length >= 2, `${zone.id} is worth traveling to`);
    for (const mark of local) {
      const [col, row] = mark.at;
      const ground = terrainAt(col, row, zone.atlas);
      assert.ok(ground, `${mark.id} is off the edge of ${zone.id}`);
      assert.equal(ground.land, true, `${mark.id} is standing in the sea`);
      const key = `${col},${row}`;
      assert.equal(seen.has(key), false, `${zone.id} stacks two things on ${key}`);
      seen.add(key);
    }
  }
  assert.equal(terrainAt(...SHIP.at).land, false, 'the ship is at sea');
  assert.equal(terrainAt(...SERPENT.at).land, false, 'so is the serpent');
});

test('every country is somewhere on the Strand, and every place is in one', () => {
  const seen = new Set();
  ZONES.forEach((zone) => {
    const ground = terrainAt(...zone.at);
    assert.ok(ground && ground.land, `${zone.id} is not on the coast anywhere`);
    const key = zone.at.join(',');
    assert.equal(seen.has(key), false, `two countries share ${key}`);
    seen.add(key);
    assert.ok(zone.name && zone.blurb && zone.weather, `${zone.id} is not described`);
    assert.ok(sizeOf(zone.atlas).cols >= 4 && sizeOf(zone.atlas).rows >= 3, `${zone.id} is too small to walk about in`);
    assert.equal(havensOf(zone).length, 2, `${zone.id} needs a camp and a hall`);
    assert.equal(havensAdjacent(zone), true, `${zone.id} keeps its fire and its hall side by side`);
  });
  PLACES.forEach((place) => {
    assert.ok(zoneById(place.zone), `${place.id} is in no country`);
    assert.ok(placesIn(place.zone).includes(place));
  });
});

test('a country asks for the levels its postings ask for', () => {
  ZONES.forEach((zone) => {
    const tiers = placesIn(zone).map((p) => p.depth);
    assert.ok(Math.max(...tiers) - Math.min(...tiers) <= 2, `${zone.id} spans too many tiers to be one country`);
  });
  const first = ZONES.filter((z) => placesIn(z).some((p) => depthOf(p).unlockLevel === 1));
  assert.ok(first.length >= 2, 'a new character has more than one country to choose between');
});

test('the country holds one place per tier band, in a sensible order', () => {
  const tiers = PLACES.map((p) => p.depth);
  assert.deepEqual([...new Set(tiers)].sort((a, b) => a - b), DEPTHS.map((d) => d.depth));
  for (const place of PLACES) {
    const tier = tierOf(place);
    assert.equal(tier.tier, place.depth);
    assert.ok(tier.stamina > 0);
    assert.ok(tier.to === null || tier.to >= tier.from, `${place.id} has a backward rank band`);
  }
});

test('a place names settings the game actually has', () => {
  for (const place of PLACES) {
    assert.ok(place.settings.length >= 2, `${place.id} needs at least two settings`);
    const defs = settingsOf(place);
    defs.forEach((d) => assert.ok(d.pool.length, `${place.id} names a setting with no dice pool`));
    assert.equal(new Set(place.settings).size, place.settings.length, `${place.id} repeats a setting`);
  }
});

test('every country has room to walk about in, and plenty of ways down', () => {
  ZONES.forEach((zone) => {
    const { cols, rows } = sizeOf(zone.atlas);
    assert.ok(cols >= 6 && rows >= 6, `${zone.id} is ${cols}x${rows}, too cramped for what stands on it`);
    const here = placesIn(zone).length;
    assert.ok(here >= 6, `${zone.id} offers only ${here} ways down`);
    // Every mark has to have a hex of its own, so a country cannot hold more
    // than its ground does.
    const land = zone.atlas.reduce((n, line) => n + [...line].filter((ch) => TERRAIN[ch].land).length, 0);
    assert.ok(here + 2 <= land, `${zone.id} has ${here + 2} marks for ${land} land hexes`);
  });
  assert.ok(PLACES.length >= ZONES.length * 6);
});

test('every floor is used by enough postings to be worth its weight', () => {
  const tally = {};
  PLACES.forEach((place) => {
    const floor = floorOf(place.settings);
    tally[floor] = (tally[floor] || 0) + 1;
  });
  // Every floor a setting can name has to exist, indoors or out.
  SETTING_LIST.forEach((setting) => {
    assert.ok(SET_NAMES.includes(setting.floor) || WILD_NAMES.includes(setting.floor),
      `${setting.id} asks for a floor called ${setting.floor}, and there is none`);
  });
  [...SET_NAMES, ...WILD_NAMES].forEach((floor) => {
    assert.ok(tally[floor] >= 3, `${floor} is drawn by only ${tally[floor] || 0} postings`);
  });
});

test('every posting has art to draw itself with', () => {
  const marks = [...PLACES.map((p) => p.icon), ...ZONES.map((z) => z.art)];
  marks.forEach((icon) => {
    assert.ok(existsSync(join(root, ART_DIR, `${icon}.png`)), `no engraving for ${icon}`);
  });
});

test('level decides what is open, and the first tier is open to everybody', () => {
  const fresh = { level: 1 };
  const open = openPlaces(fresh);
  assert.ok(open.length >= 2, 'a new character has somewhere to go');
  open.forEach((p) => assert.equal(depthOf(p).unlockLevel, 1));
  assert.equal(openPlaces({ level: 20 }).length, PLACES.length, 'everything opens eventually');
  assert.equal(isOpen(placeById('lastgate'), { level: 1 }), false);
  assert.equal(isOpen(placeById('lastgate'), { level: 15 }), true);
  assert.equal(placeById('nowhere'), null);
});

test('the hexes interlock: neighbors touch, and rows are offset by half a hex', () => {
  const a = hexCenter(0, 0);
  const b = hexCenter(1, 0);
  const c = hexCenter(0, 1);
  const w = Math.sqrt(3) * HEX;
  assert.ok(Math.abs(b.x - a.x - w) < 0.01, 'a hex along the row is one width over');
  assert.ok(Math.abs(c.x - a.x - w / 2) < 0.01, 'the next row is shunted half a hex');
  assert.ok(Math.abs(c.y - a.y - HEX * 1.5) < 0.01, 'and sits three quarters down');
  const { width, height } = atlasExtent();
  atlasHexes().forEach(({ col, row }) => {
    const { x, y } = hexCenter(col, row);
    // A pointy-top hex is half a width across and a whole hex tall.
    assert.ok(x - w / 2 > -1 && x + w / 2 < width + 1, `hex ${col},${row} runs off the sheet sideways`);
    assert.ok(y - HEX > -1 && y + HEX < height + 1, `hex ${col},${row} runs off the sheet vertically`);
  });
});

test('the river runs from the sea inland and never leaves the map', () => {
  const mouth = terrainAt(...RIVER[0]);
  assert.equal(mouth.land, false, 'a river has to reach the sea');
  RIVER.slice(1).forEach(([col, row]) => {
    assert.ok(terrainAt(col, row), `the river leaves the atlas at ${col},${row}`);
  });
  assert.equal(RIVER.length, new Set(RIVER.map((r) => r.join(','))).size, 'the river doubles back');
});

test('every engraving the maps ask for is a file that exists', () => {
  // The party walks the floor as the player's own Minecraft skin, so there is
  // no figure to ask for here; everything else is a file.
  const wanted = new Set([SHIP.art, SERPENT.art, 'compass', ...PLACES.map((p) => p.icon)]);
  ZONES.forEach((zone) => {
    wanted.add(zone.art);
    havensOf(zone).forEach((h) => wanted.add(h.art));
  });
  Object.values(TERRAIN).forEach((t) => (t.art || []).forEach((a) => wanted.add(a)));
  // The floor plans draw from the same folder: a mark per setting, and one
  // for each kind of room worth marking.
  SETTING_LIST.forEach((setting) => wanted.add(setting.art));
  ['gate', 'hoard', 'shrine', 'wyrm'].forEach((mark) => wanted.add(mark));
  for (const art of wanted) {
    assert.ok(existsSync(join(root, ART_DIR, `${art}.png`)), `${art}.png is missing from ${ART_DIR}`);
  }
  // And the ground keeps the same cut for the same hex every time it is drawn.
  const first = atlasHexes().map(({ col, row, terrain }) => artFor(terrain, col, row));
  const again = atlasHexes().map(({ col, row, terrain }) => artFor(terrain, col, row));
  assert.deepEqual(first, again);
  assert.equal(artFor(TERRAIN['~'], 0, 0), null, 'the open sea is drawn, not stamped');
});

test('every setting has a mark for its rooms', () => {
  SETTING_LIST.forEach((setting) => {
    assert.ok(setting.art, `${setting.id} has no engraving`);
    assert.ok(setting.motif, `${setting.id} has no drawn motif to fall back on`);
  });
});

test('every atlas is a rectangle of known ground', () => {
  assert.equal(atlasHexes().length, ATLAS_SIZE.cols * ATLAS_SIZE.rows);
  [undefined, ...ZONES.map((z) => z.atlas)].forEach((atlas) => {
    atlasHexes(atlas).forEach(({ col, row, terrain }) => {
      assert.ok(terrain, `no terrain at ${col},${row}`);
      assert.ok(terrain.name, `terrain at ${col},${row} has no name`);
    });
    const { cols, rows } = sizeOf(atlas);
    const { width, height } = atlasExtent(HEX, atlas);
    assert.ok(width > cols * HEX && height > rows * HEX, 'the sheet is big enough to hold it');
  });
});

test('setting out for a place builds that place, not a random floor', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  g.hero.level = 20;
  const place = placeById('chapel');
  const x = g.startExpedition(place.depth, [], 7, place.id);
  assert.equal(x.placeId, 'chapel');
  assert.equal(g.place.name, 'The Drowned Monument');
  place.settings.forEach((id) => assert.ok(x.map.settings.includes(id), `${id} is missing underground`));
  assert.equal(x.depthNumber, place.depth);
});

test('a floor asked for by depth alone is still tiled at random', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  g.hero.level = 20;
  const x = g.startExpedition(1, [], 7);
  assert.equal(x.placeId, null);
  assert.equal(g.place, null);
  assert.equal(x.map.settings.length, 2);
});
