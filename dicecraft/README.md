# Blockhead Odyssey: DiceCraft

A press-your-luck dice game set in **Odyssia**, the world of the
[Blockhead Odyssey](https://blockheadodyssey.com) Minecraft server. You make a
character, pick somewhere worth going, take it apart room by room, and decide
with every room whether to go deeper or climb out with what you are carrying.

DiceCraft is a reskin of **Delving Dice** (`jonathanerdman-jpg/dice-`). The
rules, the numbers, the engine, shared quests and the save format are the same
code and play exactly the same; what changed is the theme: names, words,
pictures and colors. The ids underneath are unchanged on purpose, so the test
suite still proves the mechanics are the original's.

```
npx http-server -p 8123     # or: python3 -m http.server 8123, from this folder
npm test                    # node:test, nothing to install
npm run build:pages         # the site for Cloudflare, in dist/
npm run build:artifact      # the page packaged for a claude.ai Artifact
```

## Your character is your skin

The name you give your character is read as your **Minecraft username**, and
your character wears that account's skin: the head on the map token, on the
character list and on your campfire card, and the whole body on the creation
card. Heads come from [mc-heads.net](https://mc-heads.net) (only the name is
sent). If that service cannot be reached (offline, or a sandboxed page that only
loads its own files) or the name is not a valid username, the character wears
a blockhead drawn from the name instead, so the same name always gets the same
stand-in. Renaming the character changes the skin. All of this is in
`js/skins.js`.

## What is what

| Delving Dice | DiceCraft |
|---|---|
| Might, Guard, Arcana, Nature, Cunning, Faith, Wild | Combat, Armor, Enchant, Wilds, Ender, Potion, Star |
| Fighter, Paladin, Mage, Ranger, Rogue, Cleric | Warrior, Knight, Enchanter, Explorer, Treasure Hunter, Alchemist |
| Second Wind, Brace, Transmute, Read the Ground, Slip, Blessing | Golden Apple, Shield Block, Reforge, Spyglass, Ender Pearl, Splash Potion |
| The Ithacan Strand | Odyssia |
| Amberport Reach, Hollow Downs, Mistwood Mire, Ironbacks, Spirelands | **Ithaca**, The Outlands, The Drowned Bayou, **Copperdeep**, Asgard |
| Camp / Guild Hall | Campfire / Town Hall |
| The Iron Tower | The Clocktower |
| Seals of the Stag, Griffon, Wyvern, Phoenix | Copper Cogs, Gold Doubloons, Pirate Treasure Keys, Seals of Anubis |
| Wayfarer's Stone, Ten-Foot Pole, Seer's Glass, Smelling Salts | Recovery Compass, Ten-Block Stick, Pirate Spyglass, Totem of Undying |
| Worn / Iron / Steel / Silvered / Runed kit | Stone / Copper / Iron / Diamond / Netherite kit |
| Shrine | Beacon |

**Ithaca** is the capital: harbor cellars, the Undercity sewers, pirate hulks
and Lantern Row, with Assistant Mayor Angie in the town hall. **Copperdeep** is
the dwarf hold under the mountains: the Great Forge and the First Forge
(forging), the Airship Dig Site and the Goblin-Held Docks (airship
archaeology), and goblins throughout. The Outlands hold the Ruined Pyramid,
the Trial Chambers and a Pillager Outpost; the Bayou has Captain Blockbeard's
hoard and the Drowned Monument; Asgard is the permanent End.

The twelve dungeon settings are the Ruined Pyramid, Dark Oak Thicket, Drowned
Monument, Frostpeak Pass, End Spire, the Deep Dark, Goblin Mineshaft, Ithaca
Undercity, Smuggler's Wharf, the Great Forge, Leprechaun Glade and Mangrove
Swamp. Each asks for the same symbols its original did.

The 68 creatures are vanilla mobs and the server's own, from the `mobs/` folder
at the repository root: the Copperdeep goblins (Pickaxe, Pistol, Bomb and
Hammer Goblins, the Goblin Engineer, Mech and Chopper, the Loot Goblin), the
Copperdeep Sentry, the Clockwork Wolf and Boar, the pillager pirates and
Captain Blockbeard, Akh-Sha-In and the tomb raiders of the pyramid, the
Leprechaun, Kragor and the Yeti of the peaks, Magmimian, Avarice, the Rodent of
Unusual Size, the Vorpal Bunny and more. Every creature demands exactly what
its original did.

## How it looks

The look is the website's: deep indigo, the site's decorative capitals
(Uncial Antiqua standing in for its display face) over Lato, copper for
anything that commits you and gold for everything else. Every screen sits on a
screenshot of the server taken from the website in this repository.

Everything else is original pixel art, drawn by code rather than copied from
Minecraft's textures:

- `tools/draw-blocks.mjs` draws the creature heads (as block heads, from 8x8
  faces in `tools/art/heads.mjs`), the kit sheet, the map marks, the dungeon
  floor pieces, the out-of-doors ground and the props. It needs nothing
  installed; `tools/art/canvas.mjs` writes the PNGs. The floor pieces are drawn
  from the same side rules `js/tiles.js` lays them by, so every join lines up.
- `tools/prepare-scenes.py` (Pillow) cuts the backdrops out of the pictures
  embedded in the website's pages.
- `tools/pixel-paths.mjs` turns the pixel symbols into the path data in
  `js/data.js`, and `tools/render-symbols.mjs` (Playwright) rasterises them
  for the 3D dice.

All of their output is committed, so nobody needs to run them to play.

## The rules

Unchanged from Delving Dice. In short:

- **The dice.** Six symbols. Plain d6s carry each once; power dice (d4 to d12)
  lean toward one symbol, and a d8 or bigger carries a wild Star face.
- **A room** is one to three trials of symbol slots. Roll everything; if any die
  matches you must take a match; if nothing matches you must throw a die away;
  once you have spent a die you may keep matching or re-roll. Fill every slot
  before you run out. Bosses tear a die away every second re-roll.
- **Two go into every room**, their hands thrown as one tray. Somebody who
  takes rooms back to back goes in winded. When a pair is beaten you choose who
  does not get up; the floor is lost only when nobody is standing.
- **Press or climb out.** Every cleared room raises the loot multiplier by a
  fifth; nothing is banked until you surface or beat the boss.
- **Floors** are generated fresh every time from two or three settings, with
  chests (some of them mimics), lairs, traps, hazards and obstacles, a beacon
  that blesses the next fight, and a boss at the far end.
- **The Clocktower** is one dungeon with no top: clear a floor and stand on the
  landing, then take what it paid home or leave it and climb for more.
- **Your character** levels by spending lessons, picks a path at level 3, wears
  kit from the town hall or the floors, and carries one class trick a night.
  Companions are hired in town halls with gold and seals, or found in lairs.
  Everybody eats; a company left unfed walks.
- **Shared quests**: open a quest, share the four-letter code, and up to four
  players walk the same floor in deterministic lockstep, from two tabs anywhere
  or from different devices when deployed to Cloudflare.

## Deploying to Cloudflare

The same as Delving Dice, with the game in this folder: Workers & Pages,
Create, Import a repository, choose this repository, set the **root
directory to `dicecraft`**, build command `npm run build:pages`, deploy command
`npx wrangler deploy`. The Worker is named `dicecraft` in `wrangler.toml`. The
build publishes only what the page loads, about 160 files and 7 MB.

## Saves

Characters are saved in the browser under `dicecraft.save.v2:<slot>`, apart
from Delving Dice's, so the two games can be served from one address without
reading each other's characters. Moving a character to another device works
the same way as before: a code, or the QR square.

## Layout

```
index.html         page shell
css/styles.css     everything visual (the Blockhead Odyssey layer is at the end)
js/brand.js        the title, the tagline and the storage namespace
js/skins.js        Minecraft usernames to skin heads, and the stand-in head
js/data.js         symbols, companions, seals, rarities
js/settings.js     the twelve dungeon settings and the six depths
js/bestiary.js     every creature, its name and what it demands
js/hero.js         classes, abilities, paths
js/world.js        Odyssia: the regions, the places, the Clocktower
js/hazards.js      traps, hazards, obstacles, chests and curios
js/gear.js         the kit
js/engine.js, js/game.js, js/map.js, js/coop.js ...  the rules, unchanged
assets/            what the page loads
tools/             the art generators and the build scripts
test/              node:test suites
```

Blockhead Odyssey is an independent Minecraft server. This game is not an
official Minecraft product and is not approved by or associated with Mojang or
Microsoft.
