// What the character is carrying.
//
// Gear is the one part of the game that is bought, found, worn out and mended,
// and it belongs to the character alone: companions bring their rank and their
// hand, the hero brings their kit. A piece does exactly one thing to the dice,
// and it is one of two things, so a glance at a slot tells you what it is for:
//
//   raise — a plain die of yours becomes a power die favoring the piece's own
//           symbol, at the size the piece is worth. A sword makes a d8 of
//           Might out of a d6 of nothing in particular.
//   wild  — one die trades faces for ones that answer anything. How many
//           faces is the grade: a Runed helm cuts three into a single die
//           rather than one into three, because a hand rarely has three dice
//           spare and a piece spread that thin was doing nothing anywhere.
//   carry — a harness that lets you bring one more die at all, which the chest
//           does and nothing else does. One, at every grade: a die is worth
//           more than everything else a piece of kit does put together —
//           measured, at The Black Tier, at about a room a floor against a
//           tenth of that for a helm — so a harness that handed you two was
//           most of the kit on its own. What the grade buys is how long the
//           straps last, and a harness with any damage in it carries nothing
//           until it is mended.
//
// Everything else about a piece is bookkeeping: which slot it fills, which
// tier it is (which is both how strong it is and when you may buy it), and how
// worn it is. A piece at any wear at all works a step worse than a sound one,
// and a piece worn through is gone.

import { SYMBOLS } from './data.js';

export const SLOTS = [
  { id: 'head', name: 'Helmet', where: 'on the head' },
  { id: 'chest', name: 'Chestplate', where: 'on the chest' },
  { id: 'legs', name: 'Leggings', where: 'on the legs' },
  { id: 'feet', name: 'Boots', where: 'on the feet' },
  { id: 'hand', name: 'Weapon', where: 'in hand' },
  { id: 'off', name: 'Off Hand', where: 'in the off hand' },
];

export function slotDef(id) {
  return SLOTS.find((s) => s.id === id) || SLOTS[0];
}

export const SLOT_IDS = SLOTS.map((s) => s.id);

// Every kind of thing there is to wear or hold. A weapon leans toward what it
// is for — an axe toward Might, a crossbow toward Cunning — and armor
// toward keeping you upright, except boots, which are for going quietly.
export const KINDS = {
  sword: { id: 'sword', name: 'Sword', slot: 'hand', symbol: 'might', boon: 'raise' },
  axe: { id: 'axe', name: 'Axe', slot: 'hand', symbol: 'might', boon: 'raise' },
  hammer: { id: 'hammer', name: 'Warhammer', slot: 'hand', symbol: 'guard', boon: 'raise' },
  mace: { id: 'mace', name: 'Mace', slot: 'hand', symbol: 'faith', boon: 'raise' },
  bow: { id: 'bow', name: 'Bow', slot: 'hand', symbol: 'nature', boon: 'raise' },
  crossbow: { id: 'crossbow', name: 'Crossbow', slot: 'hand', symbol: 'cunning', boon: 'raise' },
  trident: { id: 'trident', name: 'Trident', slot: 'hand', symbol: 'arcana', boon: 'raise' },
  shield: { id: 'shield', name: 'Shield', slot: 'off', symbol: 'guard', boon: 'raise' },
  book: { id: 'book', name: 'Enchanted Book', slot: 'off', symbol: 'arcana', boon: 'raise' },
  helmet: { id: 'helmet', name: 'Helmet', slot: 'head', symbol: 'guard', boon: 'wild' },
  plate: { id: 'plate', name: 'Chestplate', slot: 'chest', symbol: 'guard', boon: 'carry' },
  greaves: { id: 'greaves', name: 'Leggings', slot: 'legs', symbol: 'might', boon: 'wild' },
  boots: { id: 'boots', name: 'Boots', slot: 'feet', symbol: 'cunning', boon: 'wild' },
};

export const KIND_IDS = Object.keys(KINDS);

// Armor asks nothing of you but that it fits, so everybody wears all of it.
// What is in your hands is another matter: a mage does not swing an axe and a
// paladin has never drawn a bow. Each calling names what it may carry, and the
// halls only stock — and the floors only leave lying about — what the
// character in front of them could actually use.
export const ARMOUR_KINDS = KIND_IDS.filter((id) => !['hand', 'off'].includes(KINDS[id].slot));

export const CLASS_KINDS = {
  fighter: ['sword', 'axe', 'hammer', 'crossbow', 'shield'],
  paladin: ['sword', 'hammer', 'mace', 'shield', 'book'],
  ranger: ['bow', 'sword', 'axe', 'shield', 'book'],
  rogue: ['bow', 'crossbow', 'sword', 'book'],
  mage: ['trident', 'book'],
  cleric: ['mace', 'hammer', 'shield', 'book'],
};

// What this calling can be offered, armor included, in the order the table
// declares it.
export function kindsFor(classId) {
  const own = CLASS_KINDS[classId] || CLASS_KINDS.fighter;
  return KIND_IDS.filter((id) => ARMOUR_KINDS.includes(id) || own.includes(id));
}

export function canCarry(classId, piece) {
  const kind = kindOf(piece);
  if (!kind) return false;
  return kindsFor(classId).includes(kind.id);
}

// A hired sword is not a calling, it is a pair of proficiencies — so what they
// may carry follows from what they are good at rather than from a table: all
// the armor, anything for the off hand, and a weapon that leans the way they
// do. Everybody ends up with at least one, because every symbol has a weapon.
export function kindsForSkills(proficiencies = []) {
  const skills = proficiencies.length ? proficiencies : ['might'];
  return KIND_IDS.filter((id) => {
    const kind = KINDS[id];
    if (kind.slot !== 'hand') return true;
    return skills.includes(kind.symbol);
  });
}

export function skillsCanCarry(proficiencies, piece) {
  const kind = kindOf(piece);
  if (!kind) return false;
  return kindsForSkills(proficiencies).includes(kind.id);
}

// Five grades of work. The tier decides what the piece does, what it costs,
// what it survives, and the level you have to reach before a hall will sell it
// to you.
// `sides` starts above a plain die on purpose. A plain d6 answers any of the
// six symbols once; a power d6 answers its own four times and two others once,
// which is worse whenever the room wants something else. A weapon that made
// your hand narrower without making it bigger was a piece of kit you were
// better off not buying, so the ladder starts at d8 — where the extra face and
// the wild face between them beat a plain die whatever the room asks for.
export const TIERS = [
  { tier: 1, name: 'Wooden', armor: 'Leather', minLevel: 1, sides: 8, wilds: 1, carry: 1, durability: 2, price: 120 },
  { tier: 2, name: 'Stone', armor: 'Chainmail', minLevel: 4, sides: 8, wilds: 2, carry: 1, durability: 3, price: 260 },
  { tier: 3, name: 'Iron', armor: 'Iron', minLevel: 8, sides: 10, wilds: 2, carry: 1, durability: 4, price: 520 },
  { tier: 4, name: 'Diamond', armor: 'Diamond', minLevel: 12, sides: 10, wilds: 3, carry: 1, durability: 5, price: 900 },
  { tier: 5, name: 'Netherite', armor: 'Netherite', minLevel: 16, sides: 12, wilds: 3, carry: 1, durability: 6, price: 1400 },
];

// --- What a piece looks like ------------------------------------------------
//
// One sheet, a row per kind and a column per grade, so a Runed Sword and a
// Worn Sword are not the same picture: the grade is something you can see on
// the rack before you read the label. tools/draw-blocks.mjs draws it in the
// order KIND_IDS declares, which is why nothing here has to be
// kept in step by hand.
export const KIT_SHEET = 'assets/world/kit.png';
export const KIT_CELL = 96;
export const KIT_COLS = 5;
export const KIT_ROWS = KIND_IDS.length;

export function kitCell(piece) {
  const kind = kindOf(piece);
  if (!kind) return null;
  return { col: Math.max(0, Math.min(KIT_COLS - 1, piece.tier - 1)), row: KIND_IDS.indexOf(kind.id) };
}

export function tierDef(tier) {
  return TIERS.find((t) => t.tier === tier) || TIERS[0];
}

// The best grade a hall will sell at this level, which is also the best a
// floor will leave lying about.
export function tierFor(level) {
  let best = TIERS[0];
  TIERS.forEach((t) => { if (level >= t.minLevel) best = t; });
  return best.tier;
}

// A piece's id has to be unique against every piece that already exists,
// including the ones in a save written weeks ago. A plain counter is not:
// it starts again at one on every page load, so the first thing a hall racked
// after a reload had the same id as the helm already on your head — and then
// Wear, Buy and Mend all worked on whichever the code happened to find first.
// The clock is in it now, so nothing minted later can collide with anything
// minted earlier.
let pieceCounter = 0;

export function pieceId() {
  return `g${Date.now().toString(36)}${(++pieceCounter).toString(36)}`;
}

export function makePiece(kindId, tier = 1, { wear = 0, id = null, gift = null } = {}) {
  const kind = KINDS[kindId];
  if (!kind) throw new Error(`no such gear: ${kindId}`);
  const grade = tierDef(tier);
  const piece = { id: id || pieceId(), kind: kind.id, tier: grade.tier, wear };
  if (gift) piece.gift = gift;
  return piece;
}

// --- What a floor very occasionally leaves in a chest -----------------------
//
// One piece in however many carries somebody else's trick in it: a sword that
// knows how to slip a blow, a helm that calls a die back. It is worth one use
// a night, on top of whatever the wearer already has, and it is the only thing
// in the game that hands a trick to somebody who was never taught one — a
// hired sword with a blessed helm can bless.
export const GIFT_CHANCE = 12;

export function giftOf(piece) {
  if (!piece || isBroken(piece)) return null;
  return piece.gift || null;
}

// Only what a floor leaves behind is ever blessed, and only the good grades:
// a hall sells work, not luck.
export function rollGift(rng, tier) {
  if (tier < 3) return null;
  if (rng.int(GIFT_CHANCE) !== 0) return null;
  return rng.pick(GIFT_IDS);
}

// The tricks a piece can carry. Named here rather than imported so gear.js
// stays the leaf it is; js/hero.js holds what each one does, and a test keeps
// the two lists honest.
export const GIFT_IDS = ['secondWind', 'brace', 'transmute', 'readGround', 'slip', 'blessing'];

export function kindOf(piece) {
  return piece ? KINDS[piece.kind] : null;
}

export function slotOf(piece) {
  const kind = kindOf(piece);
  return kind ? kind.slot : null;
}

export function nameOf(piece) {
  const kind = kindOf(piece);
  if (!kind) return 'Nothing';
  // Armor is named the way Minecraft names armor — Leather, Chainmail, Iron,
  // Diamond, Netherite — and everything held in the hand the way it names
  // tools. The grade underneath is the same either way.
  const grade = tierDef(piece.tier);
  return `${ARMOUR_KINDS.includes(kind.id) ? grade.armor : grade.name} ${kind.name}`;
}

// How many dice a piece can change, which is how many sockets it carries. A
// weapon reshapes one die; a helm cuts a wild face into one die per grade. The
// count comes from the tier rather than from the piece's condition, so damage
// never spits a die back out — it only stops the setting working until a smith
// has had it.
export function socketCount(piece) {
  const kind = kindOf(piece);
  if (!kind) return 0;
  // A harness hands you a die rather than changing one, so there is nothing
  // to choose and nothing to put in it. Everything else has exactly one
  // socket: a better grade is a stronger effect on one die, never the same
  // effect spread over more of them.
  return kind.boon === 'carry' ? 0 : 1;
}

// And how many of those sockets are actually doing anything right now. A
// damaged piece works a step worse, and for a helm that is one socket fewer:
// the die stays in it, and does nothing until the piece is mended.
export function liveSockets(piece) {
  const boon = boonOf(piece);
  if (!boon || boon.kind === 'carry') return 0;
  return 1;
}

// What is in each socket, as the piece remembers it. A piece that has never
// been fitted has empty ones, which is not the same as doing nothing — an
// empty socket takes the best die going until you say otherwise.
export function fittedAt(piece, index) {
  const fitted = piece && piece.fitted;
  return (fitted && fitted[index]) || null;
}

export function setFitted(piece, index, key) {
  if (!piece) return piece;
  const holes = socketCount(piece);
  if (index < 0 || index >= holes) throw new Error('no such socket');
  const fitted = Array.from({ length: holes }, (_, i) => fittedAt(piece, i));
  fitted[index] = key || null;
  piece.fitted = fitted;
  return piece;
}

export function durabilityOf(piece) {
  return tierDef(piece.tier).durability;
}

export function isBroken(piece) {
  return Boolean(piece) && piece.wear >= durabilityOf(piece);
}

export function isSound(piece) {
  return Boolean(piece) && piece.wear === 0;
}

// What a piece is worth to the dice right now. A piece that has taken any
// damage at all works a step worse than a sound one — a smaller die, or one
// fewer wild face — which is what makes mending it worth gold.
export function boonOf(piece) {
  if (!piece || isBroken(piece)) return null;
  const kind = kindOf(piece);
  const grade = tierDef(piece.tier);
  const hurt = piece.wear > 0;
  if (kind.boon === 'carry') {
    // Every harness carries the same one die, so the only thing a grade can
    // sell is how long it goes on doing it: a strap that has gone carries
    // nothing until somebody sees to it.
    return hurt ? null : { kind: 'carry', dice: grade.carry };
  }
  if (kind.boon === 'wild') {
    const faces = Math.max(0, grade.wilds - (hurt ? 1 : 0));
    return faces ? { kind: 'wild', faces } : null;
  }
  const sizes = [4, 6, 8, 10, 12];
  const at = sizes.indexOf(grade.sides);
  const sides = hurt ? sizes[Math.max(0, at - 1)] : grade.sides;
  return { kind: 'raise', symbol: kind.symbol, sides };
}

export function describe(piece) {
  const boon = boonOf(piece);
  if (!boon) {
    if (isBroken(piece)) return 'Broken, and does nothing until it is mended.';
    if (kindOf(piece).boon === 'carry') return 'A strap has gone, and it carries nothing until it is mended.';
    return 'Does nothing.';
  }
  if (boon.kind === 'carry') {
    return `You can carry ${boon.dice} more plain ${boon.dice === 1 ? 'die' : 'dice'}.`;
  }
  if (boon.kind === 'wild') {
    return `One die trades ${boon.faces} ${boon.faces === 1 ? 'face' : 'faces'} for ${boon.faces === 1 ? 'one' : 'ones'} that answer anything.`;
  }
  const symbol = SYMBOLS[boon.symbol];
  return `A plain die becomes a d${boon.sides} favoring ${symbol ? symbol.name : boon.symbol}.`;
}

export function priceOf(piece) {
  return tierDef(piece.tier).price;
}

// Mending is charged by the damage, not by the piece, so a sound thing costs
// nothing and a nearly-broken one costs what it is worth.
export function repairCost(piece) {
  if (!piece || !piece.wear) return 0;
  return Math.round(tierDef(piece.tier).price * 0.18) * piece.wear;
}

// The empty rack a new character starts with, before anything is put in it.
export function emptyRack() {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null]));
}

// How much the dice owe to the kit, which is what the floors are told so they
// can ask for more. A sound piece is worth its tier; a damaged one rather less.
export function gearPower(rack) {
  if (!rack) return 0;
  return SLOT_IDS.reduce((sum, slot) => {
    const piece = rack[slot];
    if (!piece || isBroken(piece)) return sum;
    return sum + (piece.wear ? piece.tier * 0.5 : piece.tier);
  }, 0);
}

// How much the dice owe to the kit is still worth knowing — the sheet says it
// — but what a floor is told is no longer this. A rack's gold value and the
// hand it produces are different things, and it was the second that made
// floors easy: see biteFor() in js/game.js.
