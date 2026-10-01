// The Ithacan Strand as the guild keeps it: a hex atlas of the country, and
// the handful of places on it worth taking a party into. A place is not a floor —
// it is somewhere that exists whether or not you go, with its own weather and
// its own reasons. What it decides for the expedition is the difficulty tier
// and which settings the dungeon underneath is tiled from.
import { DEPTHS, depthByNumber, settingDef } from './settings.js';

// What the country is called, wherever the game has to name it.
export const REGION = 'Odyssia';

// --- The atlas ---------------------------------------------------------------
//
// One character per hex, rows laid out odd-r: every second row is shunted half
// a hex east, which is how a rectangle of text becomes a honeycomb.
//
//   ~ open sea    - shallows    . downs      , heath
//   f forest      h hills       m mountains  s marsh
//
export const ATLAS = [
  '~~--,.hhmm',
  '~~-.,.fhmm',
  '~--.,ffhmm',
  '~~-,..fhhm',
  '~--,ffhhmm',
  '~~-s,.fhmm',
  '~~--s,.fhm',
  '~~~--s,.fh',
];

// Ground is engraved, not filled: each land terrain is drawn with a piece of
// period map art out of assets/world, two cuts of it so a run of hills is not
// the same hill stamped six times. `art` is [piece, piece], `lift` nudges the
// piece off the hex center so it sits on the ground rather than floating.
export const TERRAIN = {
  '~': { id: 'sea', name: 'open sea', land: false, art: null },
  '-': { id: 'shallows', name: 'shallows', land: false, art: null },
  '.': { id: 'downs', name: 'downs', land: true, art: ['scrub', 'scrub'], scale: 0.5 },
  ',': { id: 'heath', name: 'heath', land: true, art: ['scrub', 'scrub'], scale: 0.42 },
  f: { id: 'forest', name: 'forest', land: true, art: ['forest', 'forest-alt'], scale: 0.86 },
  h: { id: 'hills', name: 'hills', land: true, art: ['hill', 'hill-alt'], scale: 0.9 },
  m: { id: 'mountains', name: 'mountains', land: true, art: ['mountain', 'mountain-alt'], scale: 0.96 },
  s: { id: 'marsh', name: 'marsh', land: true, art: ['marsh', 'marsh'], scale: 0.62 },
};

export const ART_DIR = 'assets/world';

// Which cut of the two a hex uses. Deterministic, so the country does not
// reshuffle itself every time the screen is drawn.
export function artFor(terrain, col, row) {
  if (!terrain.art) return null;
  return terrain.art[(col * 3 + row * 5) % 2];
}

export const ATLAS_SIZE = { cols: ATLAS[0].length, rows: ATLAS.length };

// A river, as the hexes it runs through, mouth first.
export const RIVER = [[2, 2], [3, 2], [4, 3], [5, 3], [6, 4], [7, 4], [8, 5]];

export function sizeOf(atlas = ATLAS) {
  return { cols: Math.max(...atlas.map((line) => line.length)), rows: atlas.length };
}

export function terrainAt(col, row, atlas = ATLAS) {
  const line = atlas[row];
  if (!line || col < 0 || col >= line.length) return null;
  return TERRAIN[line[col]];
}

export function atlasHexes(atlas = ATLAS) {
  const out = [];
  atlas.forEach((line, row) => {
    [...line].forEach((ch, col) => out.push({ col, row, terrain: TERRAIN[ch] }));
  });
  return out;
}

// --- Geometry ----------------------------------------------------------------
//
// Pointy-top hexes: a point at the top, flat sides left and right, which is
// what lets the rows interlock.
export const HEX = 46;

export function hexCenter(col, row, size = HEX) {
  const w = Math.sqrt(3) * size;
  return { x: w * (col + (row % 2) * 0.5) + w / 2, y: size * 1.5 * row + size };
}

export function hexPoints(cx, cy, size = HEX) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function atlasExtent(size = HEX, atlas = ATLAS) {
  const { cols, rows } = sizeOf(atlas);
  const last = hexCenter(cols - 1, rows - 1, size);
  return { width: Math.round(last.x + Math.sqrt(3) * size), height: Math.round(last.y + size * 1.4) };
}

// --- The Strand itself -------------------------------------------------------
//
// The country map is not a hex grid. A hex grid is for walking about inside a
// country, where the distance from one thing to the next is the point; the
// Strand is a chart of a coast and reads better as one — a coastline with bays
// in it, rivers off the mountains, and five seals marking where the countries
// are. It also means the two maps can never be mistaken for each other, which
// is the other half of why.
export const STRAND = {
  width: 1000,
  height: 660,
  // The coast, drawn once by hand: everything east of this line is land.
  land: 'M300 0C282 42 250 68 266 112 286 152 230 176 246 216 259 251 302 266 286 306 '
    + '271 346 210 360 236 406 259 451 302 470 291 516 281 561 240 590 266 660L1000 660L1000 0Z',
  rivers: [
    'M246 216C340 212 420 250 520 236 620 222 702 196 826 178',
    'M236 406C318 400 372 428 452 420 534 412 600 372 668 330',
  ],
  // What the country looks like, placed by hand rather than rolled: peaks in
  // the east, wood through the middle, marsh in the south, scrub on the downs.
  scatter: [
    ['mountain', 905, 120, 150], ['mountain-alt', 800, 150, 140], ['mountain', 950, 250, 150],
    ['mountain-alt', 860, 300, 140], ['mountain', 930, 400, 145], ['mountain-alt', 820, 440, 135],
    ['mountain', 900, 560, 140], ['hill', 690, 120, 130], ['hill-alt', 640, 240, 130],
    ['hill', 720, 380, 125], ['hill-alt', 700, 540, 125], ['forest', 430, 180, 130],
    ['forest-alt', 520, 300, 110], ['forest', 560, 430, 130], ['forest-alt', 380, 470, 110],
    ['marsh', 330, 560, 90], ['marsh', 430, 600, 85], ['scrub', 420, 110, 95],
    ['scrub', 560, 190, 95], ['scrub', 350, 360, 95], ['scrub', 620, 610, 95],
  ],
  // Waves in the empty water, the way a chart fills a sea.
  waves: [
    'M60 120q26-18 52 0t52 0', 'M100 300q26-18 52 0t52 0',
    'M50 430q26-18 52 0t52 0', 'M120 560q26-18 52 0t52 0',
    'M40 220q26-18 52 0t52 0', 'M150 640q26-18 52 0t52 0',
  ],
  ship: [120, 380],
  serpent: [95, 110],
  compass: [148, 575],
};

// --- The Iron Tower -----------------------------------------------------------
//
// There is an iron tower in every country on this coast, and it is the same
// tower. The guild's surveyors have written it up five times and filed five
// sets of bearings, and no two of them meet. Nobody has an explanation; they
// have all stopped asking for one out loud.
//
// What a party finds inside is the same thing every time — one dungeon with no
// top — so the hex is the same hex wherever it is, and only the note in the
// margin changes as a reader gets further round the coast.
export const TOWER_NOTES = {
  reach: 'A clocktower with no top. The stair inside it goes up, and keeps going.',
  downs: 'A clocktower with no top. This looks oddly familiar.',
  mire: 'A clocktower with no top. Is this the same clocktower?',
  ironbacks: 'A clocktower with no top. The dwarves swear they did not build it. How is it here.',
  spirelands: 'Terminate the Clocktower: this is in no way inspired by a deck-building game '
    + 'of a copyrighted nature, and the town hall will hear no more about it.',
};

export function towerOf(zone) {
  return {
    id: 'tower',
    name: 'The Clocktower',
    tab: 'tower',
    at: zone.tower,
    art: 'obelisk',
    scale: 1.3,
    zone: zone.id,
    tip: TOWER_NOTES[zone.id] || TOWER_NOTES.reach,
  };
}

// --- The zones ---------------------------------------------------------------
//
// The Strand is five countries, not one. A zone has its own small map, its own
// camp and hiring hall, and its own weather: the settings its dungeons are
// tiled from and the sort of people who drink in its hall. Choosing where to
// go is choosing what the next few floors will be made of.
export const ZONES = [
  {
    id: 'reach', name: 'Ithaca', tint: '#3a6d96', at: [3, 2], art: 'ithaca',
    seal: [352, 300], patch: 'M352 300m-118 0a118 96 0 1 0 236 0a118 96 0 1 0 -236 0', label: [352, 416],
    blurb: 'The capital: its harbor, its cellars, and the city underneath the city.',
    weather: 'Salt air, the market bell, and Assistant Mayor Angie handing out plots.',
    atlas: ['~~--,..h', '~~-.,.fh', '~--.,,.f', '~~--,..h', '~~-s,,.h', '~~--s,..'],
    tower: [7, 1],
    camp: [5, 1], hall: [6, 1],
    hires: ['sellsword', 'footman', 'burglar', 'illusionist', 'shadowblade', 'squire', 'acolyte'],
  },
  {
    id: 'downs', name: 'The Outlands', tint: '#a9832f', at: [5, 1], art: 'barrow',
    seal: [524, 128], patch: 'M524 128m-146 0a146 98 0 1 0 292 0a146 98 0 1 0 -292 0', label: [524, 240],
    blurb: 'Wild country that resets with the moon: a ruined pyramid, the trial chambers, and a mine that went too deep.',
    weather: 'Fresh ground every month, and the same old trouble underneath it.',
    atlas: ['..,..hm', '.,...hm', ',..,.hm', '..,,.hh', ',.,..,h', '..,.,.h'],
    tower: [5, 0],
    camp: [0, 2], hall: [1, 2],
    hires: ['squire', 'footman', 'poacher', 'acolyte', 'houndmaster', 'shieldbearer', 'warpriest'],
  },
  {
    id: 'mire', name: 'The Drowned Bayou', tint: '#3f7d45', at: [5, 4], art: 'church',
    seal: [452, 524], patch: 'M452 524m-142 0a142 100 0 1 0 284 0a142 100 0 1 0 -284 0', label: [452, 644],
    blurb: 'Mangrove water, a drowned monument, and boardwalks that move.',
    weather: 'Everything is wet. Something is always watching. Somewhere a pirate is singing.',
    atlas: ['ffs,..f', 'fs,ff.s', 'sf,.ffs', ',sff.,f', 'fs,f.sf', 'sff,.fs'],
    tower: [6, 0],
    camp: [0, 2], hall: [1, 2],
    hires: ['poacher', 'hedgewitch', 'ranger', 'druid', 'houndmaster', 'acolyte', 'illusionist'],
  },
  {
    id: 'ironbacks', name: 'Copperdeep', tint: '#b87333', at: [8, 2], art: 'copperdeep',
    seal: [788, 252], patch: 'M788 252m-150 0a150 118 0 1 0 300 0a150 118 0 1 0 -300 0', label: [788, 390],
    blurb: 'The dwarf hold under the mountain: airship dig sites, the Great Forge, and goblins in every shaft.',
    weather: 'Hammers all night, cold peaks overhead, and the goblins are digging again.',
    atlas: ['hhmmmh', 'hmmmhm', 'hhmmmm', '.hhmmh', 'h.hmmm', '.hhmhm'],
    tower: [4, 0],
    camp: [0, 3], hall: [1, 3],
    hires: ['shieldbearer', 'sellsword', 'houndmaster', 'runeguard', 'warpriest', 'footman', 'paladin'],
  },
  {
    id: 'spirelands', name: 'Asgard', tint: '#6b4f9e', at: [7, 6], art: 'endspire',
    seal: [796, 520], patch: 'M796 520m-138 0a138 104 0 1 0 276 0a138 104 0 1 0 -276 0', label: [796, 642],
    blurb: 'The permanent End: a spire nobody built, and a gate shut from the inside.',
    weather: 'The void hums. The light arrives late, and it arrives purple.',
    atlas: ['.ff,hh.', 'f,.fh.f', '.f,hh,f', 'ff,.h.h', ',f.fh,f', 'f,.hf.h'],
    tower: [5, 0],
    camp: [0, 2], hall: [1, 2],
    hires: ['hedgewitch', 'illusionist', 'archmage', 'sorcerer', 'seraph', 'paladin', 'ranger'],
  },
];

export function zoneById(id) {
  return ZONES.find((z) => z.id === id) || null;
}

// The two places in every zone that are not adventures: where the company
// sleeps and where it hires. They are hexes on the zone's own map, so there is
// nothing to navigate but the country itself.
export function havensOf(zone) {
  return [
    { id: 'hall', name: 'Town Hall', tab: 'hall', at: zone.hall, art: 'hall', scene: 'town', zone: zone.id, up: true,
      tip: `The town hall of ${zone.name}: hiring, kit and curios. New faces every morning.` },
    { id: 'camp', name: 'Campfire', tab: 'camp', at: zone.camp, art: 'tents', scale: 1.5, scene: 'town', zone: zone.id,
      tip: 'Your own campfire: the company, the night, and what you carry.' },
  ];
}

// --- The places --------------------------------------------------------------
//
// Hand-placed, because a country is not a random table. `at` is [col, row] in
// the atlas above; `settings` are the flavours the dungeon underneath is tiled
// from, so the same place always smells the same.
export const PLACES = [
  // --- Amberport Reach — tiers 1 to 3 ---------------------------------------
  {
    id: 'cellars', zone: 'reach', name: 'Harbor Cellars', at: [4, 3], up: false, depth: 1,
    icon: 'cave', scene: 'vault', settings: ['mine', 'barrow'],
    bounty: 'The Harbormaster will pay to know what the smugglers left down there.',
    finds: 'cargo crates',
  },
  {
    id: 'saltworks', zone: 'reach', name: 'The Flooded Saltworks', at: [7, 0], up: true, depth: 1,
    icon: 'mine', scene: 'vault', settings: ['mine', 'chapel'],
    bounty: 'The salt pans flooded a lifetime ago. The pumps are still running.',
    finds: 'salt and sulfate dust',
  },
  {
    id: 'lanternrow', zone: 'reach', name: 'Lantern Row', at: [3, 1], up: true, depth: 2,
    icon: 'town', scene: 'city', settings: ['quarter', 'warren'],
    bounty: 'Four streets the watch will not walk after dark, and they will pay you to.',
    finds: 'purses and promises',
  },
  {
    id: 'hulks', zone: 'reach', name: 'The Pirate Hulks', at: [4, 5], up: false, depth: 2,
    icon: 'fort', scene: 'vault', settings: ['warren', 'mine'],
    bounty: 'Three captured pirate ships, chained together, and nobody ashore counting heads.',
    finds: 'Pieces of Eight',
  },
  {
    id: 'gullwatch', zone: 'reach', name: 'Lighthouse Stair', at: [6, 5], up: false, depth: 3,
    icon: 'city', scene: 'city', settings: ['quarter', 'barrow'],
    bounty: 'The old stair up to the lighthouse, and something has been using it at night.',
    finds: 'roof-run silver',
  },
  {
    id: 'saltmarsh', zone: 'reach', name: 'The Saltmarsh Walk', at: [3, 4], up: false, depth: 2,
    icon: 'marsh', scene: 'wood', settings: ['fen', 'thicket'],
    bounty: 'The causeway to the lighthouse is under water at every tide but one.',
    finds: 'wreck salvage',
  },
  {
    id: 'warren', zone: 'reach', name: 'The Undercity', at: [7, 4], up: false, depth: 3,
    icon: 'gate', scene: 'city', settings: ['warren', 'chapel'],
    bounty: 'Assistant Mayor Angie would like the sewers emptied. Quietly.',
    finds: 'coin and contraband',
  },

  // --- The Hollow Downs — tiers 1 to 3 ---------------------------------------
  {
    id: 'downs', zone: 'downs', name: 'The Ruined Pyramid', at: [3, 1], up: false, depth: 1,
    icon: 'barrow', scene: 'downs', settings: ['barrow', 'thicket'],
    bounty: 'Break three ancient seals and the Temple of Anubis opens. Tomb raiders went in at dusk.',
    finds: 'grave-goods and pottery sherds',
  },
  {
    id: 'tinkercamp', zone: 'downs', name: 'The Wandering Trader Camp', at: [4, 0], up: true, depth: 2,
    icon: 'town', scene: 'city', settings: ['quarter', 'thicket'],
    bounty: 'They came to trade and never packed up the llamas. Nobody has seen them since.',
    finds: 'emeralds',
  },
  {
    id: 'rustwater', zone: 'downs', name: 'Rustwater Mineshaft', at: [5, 3], up: true, depth: 2,
    icon: 'mine', scene: 'shaft', settings: ['mine', 'warren'],
    bounty: 'The miners want their shafts back. Nobody is asking how.',
    finds: 'ore and metal dusts',
  },
  {
    id: 'kestrel', zone: 'downs', name: 'Pillager Outpost', at: [2, 5], up: false, depth: 2,
    icon: 'fort', scene: 'downs', settings: ['barrow', 'pass'],
    bounty: 'A watchtower that stopped answering the beacon chain last reset.',
    finds: 'arms and pay-chests',
  },
  {
    id: 'ninestones', zone: 'downs', name: 'The Trial Chambers', at: [6, 0], up: true, depth: 3,
    icon: 'trial', scene: 'downs', settings: ['barrow', 'spire'],
    bounty: 'Copper and tuff, and the spawners wake up for everyone who walks in.',
    finds: 'trial keys',
  },
  {
    id: 'drownfields', zone: 'downs', name: 'The Drownfields', at: [6, 4], up: false, depth: 3,
    icon: 'marsh', scene: 'chapel', settings: ['chapel', 'thicket'],
    bounty: 'The river took the low fields and the village with them. The bells still ring.',
    finds: 'village plate',
  },

  {
    id: 'blackmere', zone: 'downs', name: 'Blackmere Crossing', at: [4, 4], up: false, depth: 3,
    icon: 'marsh', scene: 'wood', settings: ['fen', 'barrow'],
    bounty: 'The ford is marked on every map. None of them agree where.',
    finds: 'toll-silver',
  },

  // --- The Mistwood Mire — tiers 2 to 4 --------------------------------------
  {
    id: 'stiltmarket', zone: 'mire', name: 'The Stilt Market', at: [3, 0], up: true, depth: 2,
    icon: 'town', scene: 'city', settings: ['quarter', 'thicket'],
    bounty: 'A market town on stilts over the swamp, and the tide is not what rose.',
    finds: 'market takings',
  },
  {
    id: 'mistwood', zone: 'mire', name: 'Dark Oak Thicket', at: [5, 0], up: true, depth: 2,
    icon: 'forest-alt', scene: 'wood', settings: ['thicket', 'warren'],
    bounty: 'A bounty stands on every goblin ear taken from the old forest road.',
    finds: 'furs and charms',
  },
  {
    id: 'chapel', zone: 'mire', name: 'The Drowned Monument', at: [3, 3], up: false, depth: 3,
    icon: 'church', scene: 'chapel', settings: ['chapel', 'barrow'],
    bounty: 'Prismarine under the water, and the guardians have not stopped looking.',
    finds: 'prismarine and sponges',
  },
  {
    id: 'lantern', zone: 'mire', name: 'Lantern Bog', at: [6, 1], up: true, depth: 3,
    icon: 'marsh', scene: 'wood', settings: ['thicket', 'chapel'],
    bounty: 'Lights over the water every night, and a path that is never twice the same.',
    finds: 'bog-silver',
  },
  {
    id: 'weirhouse', zone: 'mire', name: 'The Water Mill', at: [6, 4], up: false, depth: 4,
    icon: 'mine', scene: 'shaft', settings: ['works', 'chapel'],
    bounty: 'The mill that drained the swamp, still turning, with nothing left to drain.',
    finds: 'millwright’s copper',
  },
  {
    id: 'blackfen', zone: 'mire', name: 'Blockbeard’s Hoard', at: [4, 5], up: false, depth: 4,
    icon: 'hoard', scene: 'chapel', settings: ['deep', 'thicket'],
    bounty: 'Captain Blockbeard buried something under the swamp, and something has been guarding it ever since.',
    finds: 'a drowned hoard of doubloons',
  },

  {
    id: 'reedmaze', zone: 'mire', name: 'The Sugar Cane Maze', at: [2, 1], up: true, depth: 3,
    icon: 'marsh', scene: 'wood', settings: ['fen', 'chapel'],
    bounty: 'Cane three blocks tall, and something keeps cutting paths in it.',
    finds: 'swamp amber',
  },
  {
    id: 'willowdrown', zone: 'mire', name: 'The Drowned Mangroves', at: [4, 2], up: false, depth: 4,
    icon: 'forest', scene: 'wood', settings: ['fen', 'thicket'],
    bounty: 'A mangrove wood standing in six blocks of water, and it has not died.',
    finds: 'mangrove silver',
  },

  // --- The Ironbacks — tiers 4 to 6 ------------------------------------------
  {
    id: 'cinderfoundry', zone: 'ironbacks', name: 'The Great Forge', at: [1, 0], up: true, depth: 4,
    icon: 'forge', scene: 'shaft', settings: ['works', 'deep'],
    bounty: 'The forges never went out. Nobody has been down to feed them in years.',
    finds: 'steel and bronze ingots',
  },
  {
    id: 'drakemoor', zone: 'ironbacks', name: 'Frostpeak Pass', at: [3, 0], up: true, depth: 4,
    icon: 'pass', scene: 'peaks', settings: ['pass', 'thicket'],
    bounty: 'The only road over the peaks, and Kragor is charging tolls.',
    finds: 'a season of tolls',
  },
  {
    id: 'tollgate', zone: 'ironbacks', name: 'The Goblin-Held Docks', at: [2, 2], up: false, depth: 5,
    icon: 'airship', scene: 'city', settings: ['quarter', 'pass'],
    bounty: 'The airship mooring towers, and the goblins have taken the gangways.',
    finds: 'airship parts',
  },
  {
    id: 'wyrmhold', zone: 'ironbacks', name: 'The Deep Dark', at: [4, 2], up: false, depth: 5,
    icon: 'cavemount', scene: 'deep', settings: ['deep', 'pass'],
    bounty: 'Below the lowest Copperdeep tunnel the stone turns to sculk, and something in it is awake.',
    finds: 'echo shards',
  },
  {
    id: 'underforge', zone: 'ironbacks', name: 'The First Forge', at: [0, 5], up: false, depth: 6,
    icon: 'forge', scene: 'deep', settings: ['works', 'deep'],
    bounty: 'Below the Great Forge there is an older one, and it was never cold.',
    finds: 'the first ingot',
  },
  {
    id: 'stormeyrie', zone: 'ironbacks', name: 'The Airship Dig Site', at: [5, 5], up: false, depth: 6,
    icon: 'airship', scene: 'peaks', settings: ['pass', 'spire'],
    bounty: 'A sky-wreck buried in the peak, and the brushes are turning up more than pottery.',
    finds: 'airship relics and sherds',
  },

  {
    id: 'greenway', zone: 'ironbacks', name: 'The Leprechaun Vale', at: [5, 0], up: true, depth: 5,
    icon: 'forest-alt', scene: 'fey', settings: ['glamour', 'pass'],
    bounty: 'A green valley where the map says bare rock, and the goats that go in stay in.',
    finds: 'a pot of gold, maybe',
  },

  // --- The Spirelands — tiers 4 to 6 -----------------------------------------
  {
    id: 'spire', zone: 'spirelands', name: 'The End Spire', at: [4, 0], up: true, depth: 4,
    icon: 'endspire', scene: 'spire', settings: ['spire', 'warren'],
    bounty: 'A spire nobody built, and a door that was not there last reset.',
    finds: 'shulker shells',
  },
  {
    id: 'glasswalk', zone: 'spirelands', name: 'The End City', at: [6, 0], up: true, depth: 4,
    icon: 'town', scene: 'city', settings: ['quarter', 'spire'],
    bounty: 'A street of purpur houses. Whoever kept them is still keeping them.',
    finds: 'purpur and elytra scraps',
  },
  {
    id: 'emberworks', zone: 'spirelands', name: 'The Ember Works', at: [2, 0], up: true, depth: 5,
    icon: 'mine', scene: 'shaft', settings: ['works', 'spire'],
    bounty: 'They were making something here that did not need a furnace.',
    finds: 'ember-iron',
  },
  {
    id: 'mirrorhall', zone: 'spirelands', name: 'The Mirrorhall', at: [2, 4], up: false, depth: 5,
    icon: 'shrine', scene: 'spire', settings: ['spire', 'chapel'],
    bounty: 'Every room is the last one. The way out is the room that is wrong.',
    finds: 'silvered glass',
  },
  {
    id: 'cinderreach', zone: 'spirelands', name: 'The Void Reach', at: [6, 3], up: true, depth: 6,
    icon: 'wyrm', scene: 'deep', settings: ['deep', 'spire'],
    bounty: 'The ash falls upward here, and it falls from somewhere.',
    finds: 'chorus fruit and cinder glass',
  },
  {
    id: 'lastgate', zone: 'spirelands', name: 'The End Gateway', at: [4, 5], up: false, depth: 6,
    icon: 'gate', scene: 'gate', settings: ['deep', 'spire', 'chapel'],
    bounty: 'Shut from the inside, and something has begun knocking to be let out.',
    finds: 'what is left of the gate-wards',
  },
  {
    id: 'hawthorn', zone: 'spirelands', name: 'The Chorus Ring', at: [1, 4], up: true, depth: 5,
    icon: 'forest', scene: 'fey', settings: ['glamour', 'spire'],
    bounty: 'Nine chorus plants in a circle. Step in on the wrong night and step out on the wrong reset.',
    finds: 'end-gold, which may keep',
  },
  {
    id: 'longnoon', zone: 'spirelands', name: 'The Long Noon', at: [4, 3], up: false, depth: 6,
    icon: 'forest-alt', scene: 'fey', settings: ['glamour', 'deep'],
    bounty: 'A wood where the sun has not moved since anyone can remember, and something is keeping it there.',
    finds: 'what the summer court owes',
  },
];

// Side by side, always: the fire and the hall are one stop, not two.
export function havensAdjacent(zone) {
  const [cc, cr] = zone.camp;
  const [hc, hr] = zone.hall;
  return cr === hr && Math.abs(cc - hc) === 1;
}

export function placesIn(zone) {
  return PLACES.filter((p) => p.zone === (zone && zone.id ? zone.id : zone));
}

// Two things drawn in the water of the Strand itself, because a sea with
// nothing in it is a sea nobody drew.
export const SHIP = { at: [1, 6], art: 'ship' };
export const SERPENT = { at: [1, 2], art: 'serpent' };

export function placeById(id) {
  return PLACES.find((p) => p.id === id) || null;
}

export function depthOf(place) {
  return depthByNumber(place.depth);
}

// Tiers are how the guild talks about danger: ranks are the levels the place
// is meant for, from the depth that opens it to the one that opens the next.
export function tierOf(place) {
  const depth = depthOf(place);
  const next = DEPTHS.find((d) => d.depth === place.depth + 1);
  return {
    tier: place.depth,
    // The band it is meant for: from the level it starts asking for, up to
    // the level the next tier starts asking for.
    from: depth.minLevel,
    to: next ? Math.max(depth.minLevel, next.minLevel - 1) : null,
    opens: depth.unlockLevel,
    stamina: depth.stamina,
  };
}

export function isOpen(place, hero) {
  return Boolean(hero) && hero.level >= depthOf(place).unlockLevel;
}

export function openPlaces(hero) {
  return PLACES.filter((p) => isOpen(p, hero));
}

// What the country calls the place, for the card: its settings read as the
// company you will be keeping down there.
export function settingsOf(place) {
  return place.settings.map((id) => settingDef(id));
}

export function placeAt(col, row, zone = null) {
  return PLACES.find((p) => p.at[0] === col && p.at[1] === row
    && (!zone || p.zone === (zone.id || zone))) || null;
}
