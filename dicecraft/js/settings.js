// A "setting" is a kind of place. A dungeon map is several of them tiled
// together, which is what makes two expeditions to the same depth feel unlike
// each other: the settings decide which symbols the rooms keep asking for.
//
// `art` is the engraving a room of that setting is marked with, out of
// assets/world; `motif` is the drawn line that preceded it, kept as the thing
// to fall back on if the art ever fails to load.
export const SETTINGS = {
  barrow: {
    id: 'barrow', name: 'Ruined Pyramid', color: '#c9a24a', ink: '#d8c6aa',
    art: 'barrow',
    floor: 'stone',
    motif: 'M2 18q4.5-7 8.5 0M11 18q4-5.5 8 0M6 18v-2M15 18v-2',
    blurb: 'Sand-choked halls, three broken seals, and something still keeping them.',
    pool: ['might', 'might', 'guard', 'faith', 'faith', 'cunning'],
    denizens: ['ghoul', 'wight', 'skeleton', 'zombie', 'boneclaw', 'ghast'],
    bosses: [{ name: 'The High Priest of Akh-Sha-In', mob: 'wight' }, { name: 'Akh-Sha-In, Exposed Bones of the Desert', mob: 'boneclaw' }],
  },
  thicket: {
    id: 'thicket', name: 'Dark Oak Thicket', color: '#4f8f3a', ink: '#c9e2cd',
    art: 'forest-alt',
    floor: 'stone',
    motif: 'M6 19v-4.5M6 14.5 3.2 14.5 6 9.5 8.8 14.5ZM15.5 19v-4M15.5 15l-3.2 0 3.2-5.5 3.2 5.5Z',
    blurb: 'A canopy that never lets the sun in, over paths that do not stay put.',
    pool: ['nature', 'nature', 'nature', 'cunning', 'cunning', 'might'],
    denizens: ['wolf', 'spider', 'blight', 'goblin', 'stirge', 'redcap', 'troll'],
    bosses: [{ name: 'The Swamp Hag', mob: 'hag' }, { name: 'Grulk, Goblin Chief', mob: 'bugbear' }],
  },
  chapel: {
    id: 'chapel', name: 'Drowned Monument', color: '#3a8fa8', ink: '#cfe0f2',
    art: 'church',
    floor: 'sewer',
    motif: 'M6.5 19v-6.5a5.5 5.5 0 0 1 11 0V19M12 3.5v3.6M10.3 5.2h3.4',
    blurb: 'Prismarine halls standing in black water.',
    pool: ['faith', 'faith', 'faith', 'arcana', 'arcana', 'guard'],
    denizens: ['wraith', 'specter', 'banshee', 'cultist', 'wisp', 'waterweird'],
    bosses: [{ name: 'Avarice, the Cursed Thief', mob: 'banshee' }, { name: 'The Elder Guardian', mob: 'waterweird' }],
  },
  pass: {
    id: 'pass', name: 'Frostpeak Pass', color: '#9fb3c2', ink: '#dbe3ea',
    art: 'pass',
    floor: 'stone',
    motif: 'M1.5 18.5 7 9.5l4.2 6.4M8.5 18.5 14 8l6.5 10.5',
    blurb: 'The only road over the peaks, and something up there is charging tolls.',
    pool: ['might', 'might', 'guard', 'guard', 'guard', 'nature'],
    denizens: ['hillgiant', 'orc', 'bandit', 'whitedragon', 'ogre', 'lizardfolk'],
    bosses: [{ name: 'Kragor, Warden of the Peaks', mob: 'hillgiant' }, { name: 'The Yeti', mob: 'whitedragon' }],
  },
  spire: {
    id: 'spire', name: 'End Spire', color: '#8a5cc7', ink: '#ddd0f2',
    art: 'obelisk',
    floor: 'stone',
    motif: 'M12 19V6.5l-3.4 4.6M12 6.5l3.4 4.6M7.5 19h9M12 3v2',
    blurb: 'It was not built. It grew out of the void, and it is still growing.',
    pool: ['arcana', 'arcana', 'arcana', 'cunning', 'cunning', 'faith'],
    denizens: ['magen', 'flyingsword', 'drow', 'wisp', 'boggle', 'harpy'],
    bosses: [{ name: 'The Shulker Lord', mob: 'lich' }, { name: 'The Unfinished Golem', mob: 'irongolem' }],
  },
  deep: {
    id: 'deep', name: 'The Deep Dark', color: '#2f8f96', ink: '#f0cdc0',
    art: 'cavemount',
    floor: 'stone',
    motif: 'M2.5 19a9.5 7.5 0 0 1 19 0M7 19a5 4 0 0 1 10 0M12 19v-3',
    blurb: 'Below the deepslate, sculk on every wall, and something listening for your footsteps.',
    pool: ['guard', 'guard', 'might', 'might', 'arcana', 'faith'],
    denizens: ['irongolem', 'reddragon', 'minotaurskeleton', 'wight', 'stonegolem', 'duergar', 'armor'],
    bosses: [{ name: 'The Warden', mob: 'reddragon' }, { name: 'What Sleeps Under the Ice', mob: 'whitedragon' }],
  },
  mine: {
    id: 'mine', name: 'Goblin Mineshaft', color: '#b87333', ink: '#e6dcb8',
    art: 'mine',
    floor: 'sewer',
    motif: 'M5 18 17 6M6 6l11 11M3.5 5.5h4.5M15.5 15.5h4.5',
    blurb: 'Copperdeep dug it, the goblins took it, and they have been digging ever since.',
    pool: ['guard', 'guard', 'nature', 'nature', 'might', 'cunning'],
    denizens: ['earthelemental', 'ankheg', 'rats', 'duergar', 'otyugh', 'gargoyle', 'basilisk'],
    bosses: [{ name: 'The Goblin Engineer', mob: 'duergar' }, { name: 'The Slime in the Third Shaft', mob: 'otyugh' }],
  },
  warren: {
    id: 'warren', name: 'Ithaca Undercity', color: '#6c63b0', ink: '#d5d7ea',
    art: 'city',
    floor: 'sewer',
    motif: 'M2.5 18 7 12.5 11.5 18M11 18l4.5-5.5L20 18M7 18v-3M15.5 18v-3',
    blurb: 'The sewers under the capital, and they know you are here.',
    pool: ['cunning', 'cunning', 'cunning', 'faith', 'arcana', 'nature'],
    denizens: ['wererat', 'rats', 'shadowmastiff', 'specter', 'goblin', 'ghoul', 'ravens'],
    bosses: [{ name: 'The Rat King', mob: 'wererat' }, { name: 'Fang, Queen of the Cave Spiders', mob: 'spider' }],
  },
  quarter: {
    id: 'quarter', name: 'Smuggler’s Wharf', color: '#9a6a3c', ink: '#ecd9be',
    art: 'town',
    floor: 'chase',
    motif: 'M3 18v-7l4-3 4 3v7M13 18v-5l3.5-2.5L20 13v5M5 18v-3h4v3',
    blurb: 'Docks that keep their own hours, under rigging that keeps worse ones.',
    pool: ['cunning', 'cunning', 'might', 'guard', 'arcana', 'nature'],
    denizens: ['bandit', 'wererat', 'goblin', 'bugbear', 'kobold', 'hobgoblin'],
    bosses: [{ name: 'Captain Blockbeard', mob: 'hobgoblin' }, { name: 'The Phantom of the Rigging', mob: 'harpy' }],
  },
  works: {
    id: 'works', name: 'The Great Forge', color: '#d0662c', ink: '#f2d2bd',
    art: 'mine',
    floor: 'sewer',
    motif: 'M3 18l3-8 3 8M12 18l3-9 3 9M6 10V6M15 9V5',
    blurb: 'Copperdeep’s furnaces. Nobody has fed them in years, and the heat has not gone anywhere.',
    pool: ['might', 'might', 'guard', 'arcana', 'cunning', 'faith'],
    denizens: ['fireelemental', 'irongolem', 'orc', 'stonegolem', 'skeletonwarrior', 'ettin', 'oni'],
    bosses: [{ name: 'The Forge Mummy', mob: 'wight' }, { name: 'Magmimian, the Molten Maw', mob: 'fireelemental' }],
  },
  // Out of doors. These two are laid as ground and trails rather than rooms
  // and corridors, so what you choose at each step is a path.
  glamour: {
    id: 'glamour', name: 'Leprechaun Glade', color: '#9a63c4', ink: '#eddcf5',
    art: 'forest',
    floor: 'wood',
    motif: 'M11 18V8M11 8 6 4M11 8l5-4M11 12l-4-2M11 12l4-2',
    blurb: 'A wood that is paying attention, and a rainbow that was not there before.',
    pool: ['arcana', 'arcana', 'nature', 'nature', 'cunning', 'faith'],
    denizens: ['hag', 'sprite', 'treant', 'wisp', 'pseudodragon', 'shambler'],
    bosses: [{ name: 'The Leprechaun Trickster', mob: 'redcap' }, { name: 'The Swamp Hag Queen', mob: 'hag' }],
  },
  fen: {
    id: 'fen', name: 'Mangrove Swamp', color: '#4f7a4a', ink: '#d6e6d2',
    art: 'marsh',
    floor: 'fen',
    motif: 'M2 15q4-4 8 0t8 0M2 11q4-4 8 0t8 0M6 18v-3M14 18v-3',
    blurb: 'Mangrove roots to the horizon, and a boardwalk that comes and goes.',
    pool: ['nature', 'nature', 'nature', 'guard', 'might', 'cunning'],
    denizens: ['toad', 'serpent', 'shambler', 'lizardfolk', 'otyugh', 'waterweird', 'boar'],
    bosses: [{ name: 'The Slime Father', mob: 'otyugh' }, { name: 'The Bogged King', mob: 'shambler' }],
  },
};

// Which tileset a floor is drawn from. A dungeon takes the floor of its
// leading setting: cisterns, flooded mines and cold foundries are laid from
// the sewer channels, a city quarter from its own streets, a wood and a fen
// from open ground and trails, and everything else is stone.
// What a place will keep asking you for. Each setting's pool is the six
// symbols its rooms are built from, so the commonest across the settings a
// place is tiled from is the die you want in your hand before you go down.
// Ties break by the order the symbols are declared in, so the same place
// always advises the same two.
export function demandOf(settingIds = [], count = 2) {
  const tally = new Map();
  settingIds.map((id) => SETTINGS[id]).filter(Boolean).forEach((setting) => {
    setting.pool.forEach((symbol) => tally.set(symbol, (tally.get(symbol) || 0) + 1));
  });
  const order = [...tally.keys()];
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .slice(0, count)
    .map(([symbol]) => symbol);
}

export function floorOf(settingIds = []) {
  const first = settingIds.map((id) => SETTINGS[id]).find(Boolean);
  return (first && first.floor) || 'stone';
}

export const SETTING_LIST = Object.values(SETTINGS);

export function settingDef(id) {
  const def = SETTINGS[id];
  if (!def) throw new Error(`unknown setting ${id}`);
  return def;
}

// Depth replaces the old fixed tier: it decides the size of the map, how many
// settings are tiled into it, how hard the rooms are, and what they pay.
export const DEPTHS = [
  { depth: 1, name: 'The Topsoil',   stamina: 3,  minLevel: 1,  unlockLevel: 1,  size: [4, 3], settings: 2, trials: [1, 1], symbols: [2, 3], boss: { trials: 1, symbols: [4, 5] }, seal: 'stag',    gold: 12 },
  { depth: 2, name: 'The Stone Layer',    stamina: 4,  minLevel: 3,  unlockLevel: 2,  size: [5, 3], settings: 2, trials: [1, 2], symbols: [2, 3], boss: { trials: 1, symbols: [4, 5] }, seal: 'stag',    gold: 16 },
  { depth: 3, name: 'The Deepslate', stamina: 5,  minLevel: 6,  unlockLevel: 5,  size: [5, 4], settings: 2, trials: [2, 2], symbols: [2, 3], boss: { trials: 2, symbols: [3, 4] }, seal: 'griffon', gold: 22 },
  { depth: 4, name: 'The Long Descent', stamina: 6, minLevel: 9, unlockLevel: 8,  size: [6, 4], settings: 3, trials: [2, 3], symbols: [2, 3], boss: { trials: 2, symbols: [3, 4] }, seal: 'griffon', gold: 30 },
  { depth: 5, name: 'The Bedrock Tier', stamina: 8,  minLevel: 13, unlockLevel: 12, size: [6, 5], settings: 3, trials: [2, 3], symbols: [3, 3], boss: { trials: 3, symbols: [3, 4] }, seal: 'wyvern',  gold: 40 },
  { depth: 6, name: 'The Last Floor', stamina: 10, minLevel: 16, unlockLevel: 15, size: [7, 5], settings: 3, trials: [3, 3], symbols: [3, 4], boss: { trials: 3, symbols: [4, 5] }, seal: 'phoenix', gold: 52 },
];

export function depthByNumber(n) {
  return DEPTHS.find((d) => d.depth === n);
}

export function unlockedDepths(hero) {
  return DEPTHS.filter((d) => hero.level >= d.unlockLevel);
}
