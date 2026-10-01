// The paintings, and the ground.
//
// Every place on the atlas looks out over something, and every dungeon is
// floored with something. The views are screenshots of the Blockhead Odyssey
// server itself, cut by tools/prepare-scenes.py from the pictures on the
// website in this repository; the ground is block texture drawn by
// tools/draw-blocks.mjs. This file only says which is which.

export const SCENE_DIR = 'assets/world/scenes';
export const GROUND_DIR = 'assets/tiles';

// A place names its scene; a scene names its painting. Two of them share a
// picture — the market of the Street looks up at the cliffs the passes cross —
// so the atlas gets twelve views out of eleven paintings.
export const SCENES = [
  'vault', 'shaft', 'chapel', 'deepv', 'city', 'peaks',
  'town', 'gate', 'downs', 'wood', 'spire', 'fey',
];

const FALLBACK = 'downs';

// 'deep' is what the world calls it and 'deepv' what the art is filed under,
// because 'deep' is also a setting and one word cannot be two things.
export function sceneOf(place) {
  const named = place && place.scene === 'deep' ? 'deepv' : place && place.scene;
  return SCENES.includes(named) ? named : FALLBACK;
}

export function sceneUrl(scene) {
  return `${SCENE_DIR}/${sceneOf({ scene })}.jpg`;
}

// What a floor is made of, and what it is under. The ground tiles edge to edge
// beneath the plan; the view hangs behind the whole sheet, far enough back to
// be weather rather than furniture.
// `tint` is the average color of that floor's own ground, as
// tools/draw-blocks.mjs measures it when it draws the ground. The map is
// washed with it end to end, so ground nobody has walked yet is the same
// country as the ground they have: the fog hides what is in a room, not the
// room.
export const FLOORS = {
  stone: { ground: 'floor_stone.png', scene: 'vault', tint: '#7c7c7c' },
  sewer: { ground: 'floor_sewer.png', scene: 'deepv', tint: '#396760' },
  chase: { ground: 'floor_chase.png', scene: 'city', tint: '#867d6c' },
  wood: { ground: 'floor_wood.png', scene: 'fey', tint: '#679945' },
  fen: { ground: 'floor_fen.png', scene: 'wood', tint: '#455048' },
};

export function tintOf(floor) {
  return (FLOORS[floor] || FLOORS.stone).tint;
}

export function groundUrl(floor) {
  const found = FLOORS[floor] || FLOORS.stone;
  return `${GROUND_DIR}/${found.ground}`;
}

export function backdropUrl(floor) {
  const found = FLOORS[floor] || FLOORS.stone;
  return `${SCENE_DIR}/${found.scene}.jpg`;
}

// The two havens, country by country. A hall in the Reach is a harbor tavern
// and a hall under the Ironbacks is a long dark room with fires down it; the
// camps differ the same way. Four camps cover five countries, so the Mire and
// the Spirelands share the strangest of them.
export const HAVEN_ZONES = ['reach', 'downs', 'mire', 'ironbacks', 'spirelands'];

export function havenUrl(kind, zoneId) {
  const which = kind === 'hall' ? 'hall' : 'camp';
  const zone = HAVEN_ZONES.includes(zoneId) ? zoneId : HAVEN_ZONES[0];
  return `${SCENE_DIR}/${which}_${zone}.jpg`;
}

// The desk the atlas is read on. Not a place: a point of view, and the same
// one wherever in the Strand you are looking.
export const DESK = `${SCENE_DIR}/desk.jpg`;

// The book the company is written in: behind the roster, and on the face of
// the Chronicle in the menu.
export const TOME = `${SCENE_DIR}/tome.jpg`;
