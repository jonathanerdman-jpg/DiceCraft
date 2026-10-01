// What is actually in the room.
//
// A floor used to name its rooms after places — "Bone Pile", "Weeping Stair" —
// and then draw whatever creature a hash of the tile happened to land on. The
// name, the token and the symbols the trial asked for were three unrelated
// things, so a chapel full of drowned choristers could ask you for Nature while
// a wolf stood in it.
//
// They are one thing now. Each room holds a creature; the creature is the
// token on the plan, the name on the encounter, and the six-symbol pool its
// trials are built from. Beating a shambling mound takes Nature and Guard
// because that is what a shambling mound is. The plan only says that
// something is in there; what it is, you find out in the doorway.
//
// Every token is a blocky head drawn by tools/draw-blocks.mjs, which lays the
// creatures out on one sheet in this order, so the order of this list is the
// order of the sheet and nothing has to be kept in step by hand. Most of the
// names are vanilla mobs; the goblins, the clockwork, the pirates, Akh-Sha-In
// and friends are Blockhead Odyssey's own (see mobs/ at the repository root).
export const SHEET = 'assets/world/bestiary.png';
export const CELL = 112;
export const COLS = 8;

// How much of its cell a creature is drawn at on the floor plan. A stirge and
// a treant are not the same size of problem and should not be the same size of
// picture.
export const SIZES = { small: 0.40, medium: 0.50, large: 0.60, huge: 0.70 };

export const DENIZENS = [
  // --- Might: things that simply hit you ------------------------------------
  { id: 'ogre', name: 'Hammer Goblin', size: 'large', demands: ['might', 'might', 'might', 'might', 'guard', 'nature'] },
  { id: 'troll', name: 'Ravager', size: 'large', demands: ['might', 'might', 'might', 'nature', 'nature', 'faith'] },
  { id: 'ettin', name: 'Goblin Mech', size: 'large', demands: ['might', 'might', 'might', 'guard', 'cunning', 'nature'] },
  { id: 'hillgiant', name: 'Giant', size: 'huge', demands: ['might', 'might', 'might', 'might', 'guard', 'guard'] },
  { id: 'orc', name: 'Vindicator', size: 'medium', demands: ['might', 'might', 'might', 'might', 'guard', 'cunning'] },
  { id: 'bugbear', name: 'Pickaxe Goblin', size: 'medium', demands: ['might', 'might', 'might', 'cunning', 'cunning', 'guard'] },
  { id: 'bear', name: 'Ancient Tortoise', size: 'large', demands: ['might', 'might', 'might', 'nature', 'nature', 'nature'] },
  { id: 'boar', name: 'Hoglin', size: 'medium', demands: ['might', 'might', 'nature', 'nature', 'nature', 'cunning'] },

  // --- Guard: things you have to get through --------------------------------
  { id: 'skeletonwarrior', name: 'Wither Skeleton', size: 'medium', demands: ['guard', 'guard', 'guard', 'might', 'might', 'faith'] },
  { id: 'armor', name: 'Animated Armor', size: 'medium', demands: ['guard', 'guard', 'guard', 'guard', 'arcana', 'arcana'] },
  { id: 'stonegolem', name: 'Copperdeep Sentry', size: 'large', demands: ['guard', 'guard', 'guard', 'guard', 'might', 'arcana'] },
  { id: 'hobgoblin', name: 'Pillager Captain', size: 'medium', demands: ['guard', 'guard', 'guard', 'might', 'might', 'cunning'] },
  { id: 'duergar', name: 'Goblin Engineer', size: 'medium', demands: ['guard', 'guard', 'guard', 'might', 'arcana', 'might'] },
  { id: 'gargoyle', name: 'Clockwork Boar', size: 'medium', demands: ['guard', 'guard', 'guard', 'arcana', 'arcana', 'might'] },
  { id: 'lizardfolk', name: 'Pirate Deckhand', size: 'medium', demands: ['guard', 'guard', 'nature', 'nature', 'nature', 'might'] },
  { id: 'earthelemental', name: 'Groundbreaker Golem', size: 'large', demands: ['guard', 'guard', 'guard', 'nature', 'nature', 'might'] },
  { id: 'basilisk', name: 'Breeze', size: 'medium', demands: ['guard', 'guard', 'guard', 'nature', 'arcana', 'arcana'] },

  // --- Arcana: things that break the rules ----------------------------------
  { id: 'wisp', name: 'Magic Lantern', size: 'small', demands: ['arcana', 'arcana', 'arcana', 'cunning', 'cunning', 'faith'] },
  { id: 'flyingsword', name: 'Cutlass Pirate', size: 'small', demands: ['arcana', 'arcana', 'arcana', 'guard', 'guard', 'might'] },
  { id: 'magen', name: 'Enderman', size: 'medium', demands: ['arcana', 'arcana', 'arcana', 'arcana', 'guard', 'guard'] },
  { id: 'drow', name: 'Evoker', size: 'medium', demands: ['arcana', 'arcana', 'arcana', 'cunning', 'cunning', 'faith'] },
  { id: 'fireelemental', name: 'Blaze', size: 'large', demands: ['arcana', 'arcana', 'arcana', 'might', 'might', 'nature'] },
  { id: 'waterweird', name: 'Guardian', size: 'large', demands: ['arcana', 'arcana', 'arcana', 'nature', 'nature', 'guard'] },
  { id: 'cultist', name: 'Illusioner', size: 'medium', demands: ['arcana', 'arcana', 'faith', 'faith', 'faith', 'cunning'] },

  // --- Nature: things that were here first ----------------------------------
  { id: 'wolf', name: 'Clockwork Wolf', size: 'large', demands: ['nature', 'nature', 'nature', 'might', 'might', 'cunning'] },
  { id: 'spider', name: 'Spider', size: 'large', demands: ['nature', 'nature', 'nature', 'cunning', 'cunning', 'might'] },
  { id: 'shambler', name: 'Bogged', size: 'large', demands: ['nature', 'nature', 'nature', 'nature', 'guard', 'guard'] },
  { id: 'treant', name: 'Creaking', size: 'huge', demands: ['nature', 'nature', 'nature', 'nature', 'might', 'guard'] },
  { id: 'blight', name: 'Silverfish', size: 'small', demands: ['nature', 'nature', 'nature', 'cunning', 'cunning', 'arcana'] },
  { id: 'toad', name: 'Giant Frog', size: 'large', demands: ['nature', 'nature', 'nature', 'might', 'might', 'guard'] },
  { id: 'serpent', name: 'Kraken Tentacle', size: 'large', demands: ['nature', 'nature', 'nature', 'might', 'cunning', 'guard'] },
  { id: 'ravens', name: 'Cave Spiders', size: 'medium', demands: ['nature', 'nature', 'cunning', 'cunning', 'cunning', 'arcana'] },
  { id: 'ankheg', name: 'Mini Ravager', size: 'large', demands: ['nature', 'nature', 'might', 'might', 'might', 'guard'] },
  { id: 'stirge', name: 'Bats', size: 'small', demands: ['nature', 'nature', 'nature', 'cunning', 'cunning', 'cunning'] },

  // --- Cunning: things that would rather you did not see them ---------------
  { id: 'goblin', name: 'Pistol Goblin', size: 'small', demands: ['cunning', 'cunning', 'cunning', 'might', 'might', 'nature'] },
  { id: 'bandit', name: 'Pillager Pirate', size: 'medium', demands: ['cunning', 'cunning', 'cunning', 'might', 'might', 'guard'] },
  { id: 'kobold', name: 'Loot Goblin', size: 'small', demands: ['cunning', 'cunning', 'cunning', 'cunning', 'nature', 'arcana'] },
  { id: 'wererat', name: 'Rodent of Unusual Size', size: 'medium', demands: ['cunning', 'cunning', 'cunning', 'might', 'might', 'faith'] },
  { id: 'rats', name: 'Bomb Goblins', size: 'small', demands: ['cunning', 'cunning', 'cunning', 'nature', 'nature', 'nature'] },
  { id: 'boggle', name: 'Endermite', size: 'small', demands: ['cunning', 'cunning', 'cunning', 'arcana', 'arcana', 'nature'] },
  { id: 'redcap', name: 'Leprechaun', size: 'small', demands: ['cunning', 'cunning', 'cunning', 'might', 'might', 'faith'] },
  { id: 'harpy', name: 'Phantom', size: 'medium', demands: ['cunning', 'cunning', 'cunning', 'arcana', 'nature', 'faith'] },
  { id: 'mimic', name: 'Mimic Chest', size: 'medium', demands: ['cunning', 'cunning', 'cunning', 'might', 'guard', 'guard'] },

  // --- Faith: things that should have stopped -------------------------------
  { id: 'ghoul', name: 'Husk', size: 'medium', demands: ['faith', 'faith', 'faith', 'might', 'might', 'cunning'] },
  { id: 'ghast', name: 'Cursed Tomb Raider', size: 'medium', demands: ['faith', 'faith', 'faith', 'might', 'nature', 'cunning'] },
  { id: 'wight', name: 'Mummy', size: 'medium', demands: ['faith', 'faith', 'faith', 'guard', 'guard', 'might'] },
  { id: 'wraith', name: 'Drowned', size: 'medium', demands: ['faith', 'faith', 'faith', 'arcana', 'arcana', 'cunning'] },
  { id: 'specter', name: 'Avarice Wraith', size: 'medium', demands: ['faith', 'faith', 'faith', 'arcana', 'cunning', 'cunning'] },
  { id: 'banshee', name: 'Wailing Spirit', size: 'medium', demands: ['faith', 'faith', 'faith', 'arcana', 'arcana', 'arcana'] },
  { id: 'zombie', name: 'Zombie', size: 'medium', demands: ['faith', 'faith', 'might', 'might', 'might', 'guard'] },
  { id: 'skeleton', name: 'Skeleton', size: 'medium', demands: ['faith', 'faith', 'guard', 'guard', 'might', 'might'] },

  // --- The ones a floor is named after --------------------------------------
  { id: 'lich', name: 'Shulker Lord', size: 'medium', demands: ['arcana', 'arcana', 'arcana', 'faith', 'faith', 'guard'] },
  { id: 'boneclaw', name: 'Sand Spirit', size: 'large', demands: ['faith', 'faith', 'might', 'might', 'cunning', 'guard'] },
  { id: 'hag', name: 'Swamp Hag', size: 'large', demands: ['arcana', 'arcana', 'nature', 'nature', 'cunning', 'might'] },
  { id: 'irongolem', name: 'Iron Golem', size: 'large', demands: ['guard', 'guard', 'guard', 'arcana', 'arcana', 'might'] },
  { id: 'oni', name: 'Goblin Chopper', size: 'large', demands: ['might', 'might', 'arcana', 'arcana', 'cunning', 'faith'] },
  { id: 'minotaurskeleton', name: 'Piglin Brute', size: 'large', demands: ['might', 'might', 'might', 'guard', 'guard', 'faith'] },
  { id: 'otyugh', name: 'Big Slime', size: 'large', demands: ['nature', 'nature', 'nature', 'might', 'guard', 'cunning'] },
  { id: 'reddragon', name: 'Warden', size: 'huge', demands: ['might', 'might', 'guard', 'guard', 'arcana', 'faith'] },
  { id: 'whitedragon', name: 'Yeti', size: 'huge', demands: ['might', 'might', 'guard', 'guard', 'guard', 'nature'] },

  // --- What a lair holds, when what it holds can be talked to ---------------
  { id: 'warhound', name: 'Wolf', size: 'medium', demands: ['might', 'might', 'nature', 'nature', 'guard', 'cunning'] },
  { id: 'owlbear', name: 'Polar Bear', size: 'large', demands: ['might', 'might', 'might', 'guard', 'guard', 'nature'] },
  { id: 'sprite', name: 'Allay', size: 'small', demands: ['arcana', 'arcana', 'nature', 'nature', 'cunning', 'faith'] },
  { id: 'homunculus', name: 'Clockwork Homunculus', size: 'small', demands: ['arcana', 'arcana', 'guard', 'guard', 'cunning', 'might'] },
  { id: 'eagle', name: 'Pirate Parrot', size: 'large', demands: ['nature', 'nature', 'cunning', 'cunning', 'might', 'guard'] },
  { id: 'pseudodragon', name: 'Lava Tadpole', size: 'small', demands: ['arcana', 'arcana', 'cunning', 'cunning', 'nature', 'faith'] },
  { id: 'griffon', name: 'Happy Ghast', size: 'large', demands: ['might', 'might', 'nature', 'nature', 'cunning', 'guard'] },
  { id: 'shadowmastiff', name: 'Vorpal Bunny', size: 'medium', demands: ['cunning', 'cunning', 'faith', 'faith', 'nature', 'arcana'] },
];

export const BY_ID = Object.fromEntries(DENIZENS.map((d) => [d.id, d]));
export const ROWS = Math.ceil(DENIZENS.length / COLS);

// A creature's id is written into the save, on the room it is standing in, so
// renaming one is a migration rather than a rename. Spellings that have
// changed since keep an entry here and a save written before the change still
// opens on the same creature.
const RENAMED = { armour: 'armor' };

export function denizen(id) {
  const def = BY_ID[id] || BY_ID[RENAMED[id]];
  if (!def) throw new Error(`unknown denizen ${id}`);
  return def;
}

// Where it sits on the sheet. Derived from the order of the list above, which
// is the order the sheet was cut in, so there is nothing to keep in step.
export function cellOf(id) {
  const now = BY_ID[id] ? id : RENAMED[id];
  const at = DENIZENS.findIndex((d) => d.id === now);
  if (at < 0) throw new Error(`unknown denizen ${id}`);
  return { col: at % COLS, row: Math.floor(at / COLS) };
}

export function sizeOf(id) {
  return SIZES[denizen(id).size] || SIZES.medium;
}

// A hoard is a chest, and a chest is a chest right up until it is not. What
// sometimes waits at the end of a dead end is the one creature that looks
// exactly like what you came for, so the plan draws every hoard as a chest
// and the mimic is only a mimic once somebody has put a hand on the lid.
export const MIMIC = 'mimic';

// A lair holds a creature you can take home. The token is the creature, so
// what you walked in on and what walks out behind you are the same animal.
export const WILD_TOKENS = {
  warhound: 'warhound',
  owlbearcub: 'owlbear',
  sprite: 'sprite',
  homunculus: 'homunculus',
  turncoat: 'goblin',
  koboldscout: 'kobold',
  direwolf: 'wolf',
  cavebear: 'bear',
  gianteagle: 'eagle',
  pseudodragon: 'pseudodragon',
  wisp: 'wisp',
  sapling: 'treant',
  griffonchick: 'griffon',
  stonewarden: 'stonegolem',
  wraithhound: 'shadowmastiff',
};
