// What the floor does to you when nothing is standing in the way.
//
// A passage used to be a gap between two rooms. Some of them are worse than
// that now, in three ways that differ in what you know before you step in:
//
//   trap     — you do not see it. A passage that looks empty clicks under
//              somebody's boot, and the pair at the front of the company has
//              to answer it on the spot.
//   hazard   — the floor itself: rising water, a ceiling that is coming down,
//              vents that breathe fire. You can see it from the next room,
//              and there is no other way through that passage.
//   obstacle — something between you and the far side that has to be got
//              over, under or through: a chasm, a portcullis, a wall of thorn.
//              Also plain to see.
//
// Every one of them is a single trial, answered the way a room is — two go
// in, their hands thrown as one tray — built from the symbols that thing
// actually wants. A pit is Cunning and Nature, a portcullis is Might. What
// none of them does is knock anybody out: the floor is not trying to kill
// you, it is trying to cost you something. Beat it and you walk through for
// free. Lose and you still walk through, and pay what that hazard charges:
//
//   wound — whoever went in is hurt, and carries one die fewer for the rest
//           of the floor. Wounds are per floor and heal on the way home.
//   loot  — a quarter of the gold in the pack is lost down the chasm, under
//           the water, beneath the rockfall.
//   drain — a glyph or a grave-chill eats the night: each hero in the pair
//           loses a use of their trick. Nobody with a trick, and it wounds.

export const HAZARD_KINDS = {
  trap: { id: 'trap', name: 'Trap', badge: 'Trap' },
  hazard: { id: 'hazard', name: 'Hazard', badge: 'Hazard' },
  obstacle: { id: 'obstacle', name: 'Obstacle', badge: 'Obstacle' },
};

export const COSTS = {
  wound: 'Whoever goes in and fails is hurt: one die fewer each, for the rest of this floor.',
  loot: 'Fail, and a quarter of the gold you are carrying is lost.',
  drain: 'Fail, and each hero who went in loses a use of their trick.',
};

// Fraction of the pack a `loot` hazard takes.
export const LOOT_LOSS = 0.25;

// `settings` limits where a hazard turns up; null means anywhere with a roof.
// Traps are set by people, so they are in anything built — which is not the
// wood or the fen. The out-of-doors floors get their own hazards instead.
const BUILT = ['barrow', 'chapel', 'pass', 'spire', 'deep', 'mine', 'warren', 'quarter', 'works'];

export const HAZARDS = [
  // --- Traps: unseen until they are sprung ---------------------------------
  { id: 'pit', name: 'Pressure Plate Pit', kind: 'trap', cost: 'wound', settings: BUILT,
    demands: ['cunning', 'cunning', 'nature', 'guard'],
    text: 'A stone pressure plate clicks, and the floor opens onto a long way down.' },
  { id: 'darts', name: 'Dispenser Volley', kind: 'trap', cost: 'wound', settings: BUILT,
    demands: ['cunning', 'guard', 'guard', 'nature'],
    text: 'A tripwire underfoot, and every dispenser in the wall fires at once.' },
  { id: 'blade', name: 'Piston Crusher', kind: 'trap', cost: 'wound', settings: BUILT,
    demands: ['guard', 'cunning', 'might', 'cunning'],
    text: 'Redstone hums in the walls, and the pistons come out at waist height.' },
  { id: 'glyph', name: 'Cursed Glyph', kind: 'trap', cost: 'drain', settings: BUILT,
    demands: ['arcana', 'arcana', 'faith', 'cunning'],
    text: 'An enchanting glyph on the floor wakes as you cross it, and it is hungry.' },
  { id: 'snare', name: 'Tripwire Snare', kind: 'trap', cost: 'loot', settings: ['thicket', 'glamour', 'fen', 'warren'],
    demands: ['cunning', 'nature', 'nature', 'might'],
    text: 'String in the leaves, and a pack caught up in it.' },
  { id: 'cage', name: 'Iron Bar Cage', kind: 'trap', cost: 'loot', settings: ['warren', 'quarter', 'deep', 'works'],
    demands: ['might', 'might', 'cunning', 'arcana'],
    text: 'Iron bars come down behind you. Something has to be left outside them.' },

  // --- Hazards: the floor itself --------------------------------------------
  { id: 'flood', name: 'Rising Water', kind: 'hazard', cost: 'loot', settings: ['chapel', 'mine', 'fen', 'warren'],
    demands: ['might', 'nature', 'nature', 'guard'],
    text: 'The water is coming in faster than it is going out.' },
  { id: 'rockfall', name: 'Falling Gravel', kind: 'hazard', cost: 'loot', settings: ['barrow', 'pass', 'mine', 'deep'],
    demands: ['guard', 'guard', 'might', 'cunning'],
    text: 'Gravel sifts down with every step. The roof is deciding.' },
  { id: 'fire', name: 'Magma Vents', kind: 'hazard', cost: 'wound', settings: ['deep', 'works', 'spire'],
    demands: ['guard', 'guard', 'nature', 'arcana'],
    text: 'The magma blocks breathe out, and what they breathe is flame.' },
  { id: 'spores', name: 'Sculk Spores', kind: 'hazard', cost: 'wound', settings: ['thicket', 'fen', 'mine', 'glamour'],
    demands: ['nature', 'nature', 'faith', 'guard'],
    text: 'A pale bloom on every block, and the air is thick with it.' },
  { id: 'chill', name: 'Wither Chill', kind: 'hazard', cost: 'drain', settings: ['barrow', 'chapel', 'warren'],
    demands: ['faith', 'faith', 'guard', 'might'],
    text: 'A cold that goes past the skin and settles somewhere deeper.' },
  { id: 'ice', name: 'Packed Ice', kind: 'hazard', cost: 'wound', settings: ['pass'],
    demands: ['nature', 'cunning', 'guard', 'might'],
    text: 'Glass underfoot, and a drop at the edge of it.' },

  // --- Obstacles: something in the way ---------------------------------------
  { id: 'chasm', name: 'Ravine', kind: 'obstacle', cost: 'loot', settings: null,
    demands: ['nature', 'might', 'cunning', 'cunning'],
    text: 'The tunnel stops, and starts again on the far side of a ravine.' },
  { id: 'rubble', name: 'Cave-In', kind: 'obstacle', cost: 'wound', settings: BUILT,
    demands: ['might', 'might', 'guard', 'nature'],
    text: 'The way through is under a hill of cobblestone that has to be mined.' },
  { id: 'portcullis', name: 'Iron Door', kind: 'obstacle', cost: 'wound', settings: BUILT,
    demands: ['might', 'might', 'cunning', 'arcana'],
    text: 'Shut, and no button on this side. Break it, trick it, or find the redstone.' },
  { id: 'thorns', name: 'Berry Bush Wall', kind: 'obstacle', cost: 'wound', settings: ['thicket', 'glamour'],
    demands: ['nature', 'nature', 'might', 'cunning'],
    text: 'Sweet berry bushes as thick as your arm, and growing while you watch.' },
  { id: 'mire', name: 'Sucking Mud', kind: 'obstacle', cost: 'loot', settings: ['fen', 'thicket'],
    demands: ['nature', 'might', 'might', 'guard'],
    text: 'The boardwalk is under the mud here, and the mud wants your boots.' },
];

export const HAZARD_BY_ID = Object.fromEntries(HAZARDS.map((h) => [h.id, h]));

export function hazardDef(id) {
  const def = HAZARD_BY_ID[id];
  if (!def) throw new Error(`unknown hazard ${id}`);
  return def;
}

export function hazardsFor(settingId) {
  return HAZARDS.filter((h) => !h.settings || h.settings.includes(settingId));
}

// How many passages are dangerous. The shallows are mostly just corridors;
// deeper down, more than half of them are something.
export function hazardChance(depth) {
  return Math.min(0.6, 0.3 + depth * 0.05);
}

// A trap or a hazard is one trial of however many symbols a room on this
// floor asks for in one trial — so it is about as hard as a small room, and
// never as hard as the creature at the end of it.
export function hazardSpec(depth) {
  return { trials: 1, symbols: depth.symbols };
}

// Whether the map shows it before you step in. A sprung trap stays shown,
// because now you know it is there.
export function hazardVisible(tile) {
  if (!tile || !tile.hazard) return false;
  return hazardDef(tile.hazard.id).kind !== 'trap' || Boolean(tile.hazard.sprung);
}

// --- What a hoard really is -------------------------------------------------
//
// A chest at the end of a dead end is exactly what you hoped, or it has teeth.
// The two look the same from the doorway, because that is the point of a
// mimic. Some of the honest ones are trapped as well.
export const MIMIC_CHANCE = 0.35;
export const TRAPPED_CHANCE = 0.25;
export const CHEST_TRAPS = ['darts', 'glyph', 'blade'];

// --- Curios ------------------------------------------------------------------
//
// Things the company carries that do something once and then want a night's
// rest before they will do it again. They are company kit rather than
// anybody's rack, so they go wherever the company goes. Each is bought once;
// a long rest makes it good again, a short rest does not.
export const TRINKETS = {
  wayfarer: {
    id: 'wayfarer', name: 'Recovery Compass', price: 450, uses: 1,
    text: 'Spin it anywhere below — mid-fight, mid-fall — and the whole company is back at camp with everything it was carrying.',
    blurb: 'A compass whose needle only ever points at your own campfire. It knows the way home even when you do not.',
  },
  pole: {
    id: 'pole', name: 'Ten-Block Stick', price: 140, uses: 2,
    text: 'Prod a chest before you open it and learn whether it bites, or spring a trap or hazard from a safe distance and walk past it.',
    blurb: 'Ten sticks crafted end to end, and older than anyone in the company. Nobody has ever regretted bringing one.',
  },
  glass: {
    id: 'glass', name: 'Pirate Spyglass', price: 260, uses: 1,
    text: 'Look into a room next to you before you go in: what is waiting there, and every trial it will ask of you, all but one symbol.',
    blurb: 'Taken off a pirate captain. It shows the next room, mostly, and turns green when you are close.',
  },
  salts: {
    id: 'salts', name: 'Totem of Undying', price: 320, uses: 1,
    text: 'Bring one unconscious companion round, on their feet and fit to go in again.',
    blurb: 'A little golden figure that does not like to see anybody stay down.',
  },
};

export const TRINKET_IDS = Object.keys(TRINKETS);

export function trinketDef(id) {
  const def = TRINKETS[id];
  if (!def) throw new Error(`no such curio: ${id}`);
  return def;
}
