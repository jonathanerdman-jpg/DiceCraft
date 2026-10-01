import { SYMBOL_IDS, WILD } from './dice.js';

export const SYMBOLS = {
  might:   { id: 'might', name: 'Combat', color: '#d8492f', art: 'M18 0h6v2h-6zM16 2h8v2h-8zM14 4h8v2h-8zM12 6h8v2h-8zM10 8h8v2h-8zM2 10h2v2h-2zM8 10h8v2h-8zM2 12h4v2h-4zM8 12h6v2h-6zM4 14h8v2h-8zM6 16h4v2h-4zM4 18h8v2h-8zM2 20h4v2h-4zM10 20h4v2h-4zM0 22h4v2h-4z' },
  guard:   { id: 'guard', name: 'Armor', color: '#5b8fc4', art: 'M2 0h6v2h-6zM16 0h6v2h-6zM0 2h8v2h-8zM16 2h8v2h-8zM0 4h10v2h-10zM14 4h10v2h-10zM2 6h20v2h-20zM2 8h20v2h-20zM2 10h20v2h-20zM6 12h12v2h-12zM6 14h12v2h-12zM6 16h12v2h-12zM6 18h12v2h-12zM6 20h12v2h-12zM6 22h12v2h-12z' },
  arcana:  { id: 'arcana', name: 'Enchant', color: '#a066e6', art: 'M10 0h4v2h-4zM10 2h4v2h-4zM8 4h8v2h-8zM8 6h8v2h-8zM4 8h16v2h-16zM0 10h24v2h-24zM0 12h24v2h-24zM4 14h16v2h-16zM8 16h8v2h-8zM8 18h8v2h-8zM10 20h4v2h-4zM10 22h4v2h-4z' },
  nature:  { id: 'nature', name: 'Wilds', color: '#52ab3c', art: 'M8 0h8v2h-8zM4 2h16v2h-16zM2 4h20v2h-20zM2 6h8v2h-8zM14 6h8v2h-8zM4 8h6v2h-6zM14 8h6v2h-6zM10 10h4v2h-4zM2 12h4v2h-4zM10 12h4v2h-4zM18 12h4v2h-4zM2 14h6v2h-6zM10 14h4v2h-4zM16 14h6v2h-6zM4 16h16v2h-16zM10 18h4v2h-4zM10 20h4v2h-4zM6 22h12v2h-12z' },
  cunning: { id: 'cunning', name: 'Ender', color: '#1fa591', art: 'M8 0h8v2h-8zM4 2h16v2h-16zM2 4h20v2h-20zM2 6h8v2h-8zM14 6h8v2h-8zM0 8h8v2h-8zM16 8h8v2h-8zM0 10h6v2h-6zM18 10h6v2h-6zM0 12h6v2h-6zM18 12h6v2h-6zM0 14h8v2h-8zM16 14h8v2h-8zM2 16h8v2h-8zM14 16h8v2h-8zM2 18h20v2h-20zM4 20h16v2h-16zM8 22h8v2h-8z' },
  faith:   { id: 'faith', name: 'Potion', color: '#dd9d22', art: 'M8 0h8v2h-8zM10 2h4v2h-4zM10 4h4v2h-4zM8 6h8v2h-8zM6 8h12v2h-12zM4 10h16v2h-16zM2 12h20v2h-20zM2 14h4v2h-4zM10 14h12v2h-12zM2 16h4v2h-4zM8 16h14v2h-14zM2 18h20v2h-20zM4 20h16v2h-16zM6 22h12v2h-12z' },
  wild:    { id: 'wild', name: 'Star', color: '#a39a88', art: 'M10 0h4v2h-4zM10 2h4v2h-4zM2 4h2v2h-2zM8 4h8v2h-8zM20 4h2v2h-2zM4 6h16v2h-16zM4 8h16v2h-16zM0 10h24v2h-24zM0 12h24v2h-24zM4 14h16v2h-16zM4 16h16v2h-16zM2 18h2v2h-2zM8 18h8v2h-8zM20 18h2v2h-2zM10 20h4v2h-4zM10 22h4v2h-4z' },
};

export const SYMBOL_ORDER = SYMBOL_IDS;

// A plain die at rest, before it has been rolled.
export const PLAIN_DIE_ART = 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm0 2v14h14V5zm3 2.4a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zm8 0a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zm-8 6a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zm8 0a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2z';

// --- Progression -----------------------------------------------------------

export const MAX_RANK = 30;
export const MAX_STAMINA = 10;

// Power dice a companion owns at each rank breakpoint. Sizes are handed out
// to the companion's proficiencies in order, cycling if they have fewer.
export const POWER_DICE_BY_RANK = [
  { rank: 1,  dice: [4] },
  { rank: 4,  dice: [6] },
  { rank: 8,  dice: [6, 4] },
  { rank: 12, dice: [8, 4] },
  { rank: 16, dice: [8, 6] },
  { rank: 20, dice: [10, 6, 4] },
  { rank: 24, dice: [10, 8, 6] },
  { rank: 27, dice: [12, 8, 6] },
  { rank: 30, dice: [12, 10, 8, 4] },
];

export function powerDiceForRank(rank) {
  let found = POWER_DICE_BY_RANK[0].dice;
  for (const step of POWER_DICE_BY_RANK) {
    if (rank >= step.rank) found = step.dice;
  }
  return found;
}

// Renown gates how many companions you may send at once. You begin alone.
export const PARTY_CAP_THRESHOLDS = [0, 20, 60, 140];

export function partyCapForRenown(renown) {
  let cap = 1;
  PARTY_CAP_THRESHOLDS.forEach((threshold, i) => {
    if (renown >= threshold) cap = i + 1;
  });
  return cap;
}

// --- Seals -----------------------------------------------------------------

export const SEALS = {
  stag:     { id: 'stag',     name: 'Copper Cog',          short: 'Cogs' },
  griffon:  { id: 'griffon',  name: 'Gold Doubloon',       short: 'Doubloons' },
  wyvern:   { id: 'wyvern',   name: 'Pirate Treasure Key', short: 'Keys' },
  phoenix:  { id: 'phoenix',  name: 'Seal of Anubis',      short: 'Anubis Seals' },
};

// --- Companions ------------------------------------------------------------

export const RARITIES = {
  common:    { id: 'common',    name: 'Common',    color: '#b3ada2' },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  color: '#62c24c' },
  rare:      { id: 'rare',      name: 'Rare',      color: '#52a8ec' },
  epic:      { id: 'epic',      name: 'Epic',      color: '#b671f2' },
};

// A companion's bed and board for the night. Your own character costs
// nothing — you can always sleep, whatever the purse says.
export const REST_PER_COMPANION = 5;

// --- What a company costs to keep --------------------------------------------
//
// Everybody eats, whether or not they went down a hole that day, and a veteran
// eats better than a novice. This is the only automatic reason not to keep
// every face you have ever hired: a roster larger than the party you can take
// is a standing bill against a purse that is only filled by floors.
export const UPKEEP_BASE = 6;
export const UPKEEP_PER_RANK = 1.5;

export function upkeepOf(companion) {
  if (!companion) return 0;
  return Math.round(UPKEEP_BASE + (companion.rank || 1) * UPKEEP_PER_RANK);
}

export function upkeepFor(roster = []) {
  return roster.reduce((sum, c) => sum + upkeepOf(c), 0);
}

// Nobody walks out over one bad night. A week of them is another matter, and
// the company is told well before it happens: a word on the third night, a
// harder one on the fifth, a last one on the sixth, and on the seventh they
// are gone. Feed them once and the count goes back to nothing.
// Seven, and the sentences that say so are written out in words rather than
// built from the number — so a test holds the two together.
export const HUNGER_LEAVES = 7;
export const HUNGER_WARNINGS = [
  { nights: 3, tone: 'info', say: (name) => `${name} has gone three nights unfed and has started asking about it.` },
  { nights: 5, tone: 'bad', say: (name) => `Five nights now, and ${name} is asking in front of the others. Two more and they walk.` },
  { nights: 6, tone: 'bad', say: (name) => `${name} has their pack by the door. Feed them tonight or they are gone in the morning.` },
];

export function hungerWarning(nights) {
  return HUNGER_WARNINGS.find((w) => w.nights === nights) || null;
}

export const RECRUIT_COST = {
  common:   { gold: 120,  seals: {} },
  uncommon: { gold: 340,  seals: { stag: 2 } },
  rare:     { gold: 780,  seals: { griffon: 3 } },
  epic:     { gold: 1600, seals: { wyvern: 3, phoenix: 1 } },
};

export const COMPANIONS = [
  // Common
  { id: 'squire',       name: 'Tobin Cobblestone', title: 'Wanderer of Ithaca',     rarity: 'common',   proficiencies: ['might', 'guard'],   blurb: 'A wooden sword, a borrowed shield, and he never once ran.' },
  { id: 'footman',      name: 'Bram Ironwall',     title: 'Ithaca Harbor Watch',    rarity: 'common',   proficiencies: ['guard', 'might'],   blurb: 'Twenty years on the harbor wall taught him where to stand.' },
  { id: 'hedgewitch',   name: 'Mirel Mossbottle',  title: 'Swamp Witch',            rarity: 'common',   proficiencies: ['arcana', 'nature'], blurb: 'Her potions work. Mostly. Ask about the pig.' },
  { id: 'poacher',      name: 'Fenn Quickfletch',  title: 'Outlands Trapper',       rarity: 'common',   proficiencies: ['cunning', 'nature'],blurb: 'Knows every tripwire in the Outlands, having strung most of them.' },
  { id: 'acolyte',      name: 'Sister Ilva',       title: 'Apprentice Brewer',      rarity: 'common',   proficiencies: ['faith'],            blurb: 'Still learning the recipes. Brews them anyway.' },
  { id: 'sellsword',    name: 'Garrick Ash',       title: 'Hired Blade',            rarity: 'common',   proficiencies: ['might'],            blurb: 'Paid by the day, loyal by the hour.' },
  // Uncommon
  { id: 'ranger',       name: 'Thalia Greenmarch', title: 'Outlands Surveyor',      rarity: 'uncommon', proficiencies: ['nature', 'cunning'],blurb: 'Reads a biome the way a clerk reads a ledger.' },
  { id: 'shieldbearer', name: 'Durn Copperbeard',  title: 'Copperdeep Shieldwall',  rarity: 'uncommon', proficiencies: ['guard'],            blurb: 'A door that walks, and complains about the sky.' },
  { id: 'burglar',      name: 'Pip Underbarrel',   title: 'Harbor Pickpocket',      rarity: 'uncommon', proficiencies: ['cunning', 'arcana'],blurb: 'Small, quiet, and already holding your purse.' },
  { id: 'warpriest',    name: 'Brother Kael',      title: 'Battle Brewer',          rarity: 'uncommon', proficiencies: ['faith', 'might'],   blurb: 'Preaches mercy with a very heavy mace and a splash of Harming.' },
  { id: 'illusionist',  name: 'Sable',             title: 'Enderwalker',            rarity: 'uncommon', proficiencies: ['arcana', 'cunning'],blurb: 'Nobody is certain she was ever actually hired. She keeps teleporting into the payroll.' },
  { id: 'houndmaster',  name: 'Rurik Vane',        title: 'Wolf Tamer',             rarity: 'uncommon', proficiencies: ['nature', 'might'],  blurb: 'Travels with four tamed wolves and answers for all five.' },
  // Rare
  { id: 'paladin',      name: 'Dame Yvane',        title: 'Knight of Ithaca',       rarity: 'rare',     proficiencies: ['faith', 'guard'],   blurb: 'Reached Knight rank the hard way. Her order is gone; her oath is not.' },
  { id: 'archmage',     name: 'Erevan Sol',        title: 'Master Enchanter',       rarity: 'rare',     proficiencies: ['arcana', 'faith'],  blurb: 'Speaks of level thirty enchantments the way you speak of breakfast.' },
  { id: 'shadowblade',  name: 'The Gray Fox',      title: 'Reformed Pirate',        rarity: 'rare',     proficiencies: ['cunning', 'might'], blurb: 'Three ports want them hanged. All three would hire them.' },
  { id: 'druid',        name: 'Mother Wren',       title: 'Grove Keeper',           rarity: 'rare',     proficiencies: ['nature', 'faith'],  blurb: 'The rain asks her permission first.' },
  // Epic
  { id: 'sorcerer',     name: 'Vashti Emberkin',   title: 'Blaze-Touched Sorcerer', rarity: 'epic',     proficiencies: ['arcana', 'might'],  blurb: 'Came back from Hades with the fire still in her.' },
  { id: 'runeguard',    name: 'Hjalmar Stonebound',title: 'Copperdeep Runesmith',   rarity: 'epic',     proficiencies: ['guard', 'arcana'],  blurb: 'The runes hammered into his armor were forged before Ithaca had a harbor.' },
  { id: 'seraph',       name: 'Lysandra',          title: 'Warden of Asgard',       rarity: 'epic',     proficiencies: ['faith', 'arcana', 'guard'], blurb: 'Came down from the End for one war and stayed for the next.' },
];

// Found underground, never in the town hall: tamed mobs, clockwork, and the
// odd goblin turncoat. They come cheaper than a hall recruit and never want
// seals, because the only way to meet one is to go down and find it.
export const WILD_COMPANIONS = [
  { id: 'warhound',    name: 'Grimjaw',            title: 'Tamed Wolf',           rarity: 'uncommon', proficiencies: ['might', 'nature'],   blurb: 'Somebody gave him a red collar and then lost the war.' },
  { id: 'owlbearcub',  name: 'Tuft',               title: 'Polar Bear Cub',       rarity: 'uncommon', proficiencies: ['might', 'guard'],    blurb: 'Affectionate, and already heavier than you.' },
  { id: 'sprite',      name: 'Pip-of-the-Glade',   title: 'Allay',                rarity: 'uncommon', proficiencies: ['arcana', 'nature'],  blurb: 'Brings you things you did not ask for and ignores the ones you did.' },
  { id: 'homunculus',  name: 'Tally',              title: 'Clockwork Homunculus', rarity: 'uncommon', proficiencies: ['arcana', 'guard'],   blurb: 'Counts everything. Will tell you the total, unprompted.' },
  { id: 'turncoat',    name: 'Skiv',               title: 'Goblin Turncoat',      rarity: 'uncommon', proficiencies: ['cunning', 'might'],  blurb: 'Left the Copperdeep goblins twice already. Says the third time is the charm.' },
  { id: 'koboldscout', name: 'Yip',                title: 'Loot Goblin',          rarity: 'uncommon', proficiencies: ['cunning', 'nature'], blurb: 'Small, fast, and terribly proud of the sack she stole.' },
  { id: 'direwolf',    name: 'Ash',                title: 'Clockwork Wolf',       rarity: 'rare',     proficiencies: ['nature', 'might'],   blurb: 'Walks a little behind you. Ticks a little, too.' },
  { id: 'cavebear',    name: 'Old Shell',          title: 'Ancient Tortoise',     rarity: 'rare',     proficiencies: ['guard', 'nature'],   blurb: 'You are, as far as she is concerned, a very slow hatchling.' },
  { id: 'gianteagle',  name: 'Polly',              title: 'Pirate Parrot',        rarity: 'rare',     proficiencies: ['nature', 'cunning'], blurb: 'Consents to the arrangement. Does not consider it employment. Repeats everything.' },
  { id: 'pseudodragon',name: 'Ember',              title: 'Lava Tadpole',         rarity: 'rare',     proficiencies: ['arcana', 'cunning'], blurb: 'Sleeps in the cauldron and objects loudly to the lid.' },
  { id: 'wisp',        name: 'The Lantern',        title: 'Magic Lantern',        rarity: 'rare',     proficiencies: ['arcana', 'faith'],   blurb: 'It led three miners into the deep dark. It seems sorry about it.' },
  { id: 'sapling',     name: 'Lucky',              title: 'Leprechaun Ally',      rarity: 'rare',     proficiencies: ['nature', 'guard'],   blurb: 'Keeps pace, keeps count, and keeps a pot of gold he will not discuss.' },
  { id: 'griffonchick',name: 'Gale',               title: 'Happy Ghast',          rarity: 'epic',     proficiencies: ['might', 'nature'],   blurb: 'Somebody tied a basket to it once. It has been looking for that somebody ever since.' },
  { id: 'stonewarden', name: 'Nine',               title: 'Copperdeep Sentry',    rarity: 'epic',     proficiencies: ['guard', 'faith'],    blurb: 'Nine of nine still standing. It does not discuss the other eight.' },
  { id: 'wraithhound', name: 'Silence',            title: 'Vorpal Bunny',         rarity: 'epic',     proficiencies: ['cunning', 'faith'],  blurb: 'Casts no shadow, leaves no print, insists on being scratched. Do not look at the teeth.' },
];

// Cheaper than the hall, and never any seals.
export const WILD_COST = { uncommon: 180, rare: 420, epic: 850 };

export const ALL_COMPANIONS = [...COMPANIONS, ...WILD_COMPANIONS];

export function isWild(defId) {
  return WILD_COMPANIONS.some((c) => c.id === defId);
}

export const STARTER_COMPANION_ID = 'squire';

export function companionDef(id) {
  const def = ALL_COMPANIONS.find((c) => c.id === id);
  if (!def) throw new Error(`unknown companion ${id}`);
  return def;
}

// Rarer recruits show up in the town hall as your renown grows.
export function recruitWeights(renown) {
  return [
    ['common',   Math.max(10, 70 - renown / 3)],
    ['uncommon', Math.min(45, 20 + renown / 4)],
    ['rare',     Math.min(30, renown / 6)],
    ['epic',     Math.min(14, Math.max(0, (renown - 80) / 10))],
  ];
}

// --- Adventures ------------------------------------------------------------
//
// The first table of places, from before the world map. Nothing reads it any
// more but the helpers below, and it is kept so an old save that names a tier
// still has something to find.
export const TIERS = [
  { tier: 1, name: 'The Ruined Pyramid', region: 'The Outlands', stamina: 3, minRank: 1, maxRank: 5, unlockRank: 1, seal: 'stag',
    challenges: 3, trials: [1, 1], symbols: [2, 2], boss: { trials: 1, symbols: [3, 3] },
    flavor: 'Sand-choked halls, and something still keeping them.', encounters: [], bosses: ['The High Priest'] },
  { tier: 2, name: 'Dark Oak Thicket', region: 'The Outlands', stamina: 4, minRank: 6, maxRank: 10, unlockRank: 4, seal: 'stag',
    challenges: 3, trials: [1, 2], symbols: [2, 2], boss: { trials: 1, symbols: [3, 4] },
    flavor: 'The canopy never lets the sun in.', encounters: [], bosses: ['The Swamp Hag'] },
  { tier: 3, name: 'The Drowned Monument', region: 'The Drowned Bayou', stamina: 5, minRank: 11, maxRank: 15, unlockRank: 9, seal: 'griffon',
    challenges: 4, trials: [2, 2], symbols: [2, 2], boss: { trials: 2, symbols: [2, 3] },
    flavor: 'Prismarine halls under black water.', encounters: [], bosses: ['The Sky Guardian'] },
  { tier: 4, name: 'Frostpeak Pass', region: 'Copperdeep', stamina: 6, minRank: 16, maxRank: 20, unlockRank: 14, seal: 'griffon',
    challenges: 4, trials: [2, 2], symbols: [3, 3], boss: { trials: 2, symbols: [3, 4] },
    flavor: 'The only road over the peaks.', encounters: [], bosses: ['Kragor, Warden of the Peaks'] },
  { tier: 5, name: 'The End Spire', region: 'Asgard', stamina: 8, minRank: 21, maxRank: 25, unlockRank: 19, seal: 'wyvern',
    challenges: 5, trials: [2, 3], symbols: [2, 3], boss: { trials: 3, symbols: [2, 3] },
    flavor: 'It was not built. It grew, out of the void.', encounters: [], bosses: ['The Shulker Lord'] },
  { tier: 6, name: 'The Deep Dark', region: 'Copperdeep', stamina: 10, minRank: 26, maxRank: 30, unlockRank: 24, seal: 'phoenix',
    challenges: 5, trials: [3, 3], symbols: [3, 3], boss: { trials: 3, symbols: [3, 4] },
    flavor: 'Below the deepslate, something is listening.', encounters: [], bosses: ['The Warden'] },
];

export function tierByNumber(n) {
  return TIERS.find((t) => t.tier === n);
}

export function unlockedTiers(roster) {
  const best = roster.reduce((m, c) => Math.max(m, c.rank), 0);
  return TIERS.filter((t) => best >= t.unlockRank);
}

// Rare companions occasionally turn up as boss loot.
export const BOSS_COMPANION_DROPS = {
  4: { id: 'shadowblade', chance: 0.06 },
  5: { id: 'druid',       chance: 0.08 },
  6: { id: 'runeguard',   chance: 0.10 },
};

export const WILD_SYMBOL = WILD;
