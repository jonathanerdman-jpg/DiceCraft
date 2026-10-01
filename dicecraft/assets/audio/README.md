# audio

The room tone. **This folder ships empty on purpose**, and `*.mp3` in here is
ignored by git: the music that fills it is somebody else's work.

## The quick way

```sh
node tools/fetch-music.mjs
```

That pulls eleven tracks — one per scene — out of the
[Tabletop RPG Music](https://github.com/Tabletop-RPG-Music/tabletop-rpg-music)
library and writes them under the ids below. It is a Foundry module of about
180 original pieces, free to use and kept going by its
[Patreon](https://www.patreon.com/tabletoprpgmusic), which is where to go if
you get any use out of this. About 67 MB, fetched to your machine only.

The picks live in `PICKS` in `js/music.js` — `DarkDungeon` for a floor,
`YeOldeTavern` for the hall, `TheBigBadEvilGuy` for a boss — and the library
has plenty more, so change them to taste and run it again.

Whether you may pass those files on to anyone else is between you and their
author: playing them on your own machine is plainly what they are for, and
re-hosting them is a different question. That is why nothing is committed.

`js/music.js` asks for one file per scene, by id:

| file | played when | a Tabletop Audio track that suits it |
|---|---|---|
| `strand.mp3` | the Ithacan Strand, and any country without its own | Ocean Waves, or Sailing Ship |
| `harbor.mp3` | Amberport Reach | Harbor Town |
| `downs.mp3` | the Hollow Downs | Windswept Moor |
| `swamp.mp3` | the Mistwood Mire | Haunted Swamp |
| `mountain.mp3` | the Ironbacks | Mountain Pass |
| `arcane.mp3` | the Spirelands | Wizard's Tower |
| `camp.mp3` | camp, and the walk home after a floor you survived | Camping in the Woods |
| `hall.mp3` | the guild hall, and the character screen | Tavern Inn |
| `dungeon.mp3` | a floor, and the walk home after one that beat you | Dungeon II |
| `encounter.mp3` | a room being rolled | Battle Drums |
| `boss.mp3` | a boss room | Dragon Fight |

Drop an MP3 in with the matching name and it plays, looped and crossfaded, as
soon as the game moves to that scene.

Leave one out and the page **makes that scene itself** instead — a drone, a
band of noise and, where it suits, a drum, shaped per scene in `js/music.js`.
It is not a recording and does not pretend to be one, but it means the game
has a voice with nothing downloaded, and a file always wins when one is there.

## Why nothing is bundled

[Tabletop Audio](https://tabletopaudio.com/) is free to use and supported by
its listeners, and the files are theirs to hand out rather than ours to
re-host or hot-link — a game linking straight at their server spends their
bandwidth and breaks the moment they'd rather it didn't. So: download the
tracks you want from their site (SoundPad, or the supporter download), rename
them to the ids above, and put them here. Give them the credit; the license
is on their site and it is worth reading before you publish anything.

Any other source works exactly as well — these are ordinary MP3 files with
ordinary names. Keep each one small if the page is going to be published: the
whole page and its files have a budget, and a few minutes of looped ambience
at a modest bitrate is the sensible size.
