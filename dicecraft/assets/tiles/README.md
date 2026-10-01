# Dungeon Assets

A collection of tile and prop assets for building dungeon maps and encounters in a tabletop RPG videogame.

## Asset Packs

| Folder | Contents |
|---|---|
| `castle/` | Castle rooms, props, stairs, doors, windows |
| `chase/` | Chase scene tiles and textures |
| `city/` | City walls, buildings, street props |
| `city-walls/` | Modular city wall segments and towers |
| `dungeon/` | Dungeon grab-bag props (braziers, chests, cages, portals, etc.) |
| `feywild/` | Feywild-themed tiles and atmospheric props |
| `harbor/` | Harbor, docks, water textures, coastal props |
| `mountainside/` | Mountain terrain tiles and textures |
| `sewer/` | Sewer tunnels, pipes, and underground textures |
| `ships-and-sailing/` | Ship decks, rigging, and sailing props |
| `swamp/` | Swamp terrain, murky water, submerged roads |
| `tokens/` | Creature tokens (with and without shadows) |

## Asset Structure

Most packs follow this internal layout:

`
<theme>/
  Props/          # Placeable objects and decorations
  Rooms/
    Grid/         # Tiles with grid overlay
    No Grid/      # Tiles without grid (for VTT use)
  Textures/       # Seamless background textures
  Walls/          # Wall segments and connectors
  Shadow/         # Drop-shadow variants
  No Shadow/      # Flat/no-shadow variants
`

## Usage

Assets are .png / .jpg image files ready for use in dungeon-building tools,
VTTs (Foundry VTT, Roll20, etc.), or custom game engines.
