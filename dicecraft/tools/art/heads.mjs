// Every creature in js/bestiary.js as a block head: an 8x8 face, the size of
// a real skin's, drawn here by hand. `pal` maps each letter to a color; the
// top and sides of the head are taken from the face's own edges, so only the
// front has to be drawn.
//
// The vanilla mobs are drawn from memory of what they look like, not copied
// from any texture; the goblins, the clockwork, the pirates, Akh-Sha-In and
// the rest are Blockhead Odyssey's own (see mobs/ at the repository root).
const P = (text) => Object.fromEntries(text.trim().split(/\s+/).map((pair) => pair.split('=')));
const F = (text) => text.trim().split(/\s+/);

// The goblins of Copperdeep share a face and differ in their hats.
const GOB = 'g=#6fae3f G=#579230 e=#f4d03f k=#1b1b1b n=#4f8a2a m=#3a1d0e t=#f0ead6';
const GOBFACE = ['gekggkeg', 'ggGnnGgg', 'gGmmmmGg', 'gtggggtg', 'gggggggg'];

export const HEADS = {
  // --- Might ------------------------------------------------------------------
  ogre: { pal: P(`${GOB} i=#9aa0a6 I=#6b7177`), face: ['iiiiiiii', 'iIiiiiIi', 'IIIIIIII', ...GOBFACE] }, // Hammer Goblin
  troll: { pal: P('d=#4f4844 D=#6e6762 h=#e8e2cf k=#1b1b1b n=#3d3633 m=#24191a t=#f0ead6'),
    face: F('hddddddh dDDDDDDd DDDDDDDD DkkDDkkD DDDnnDDD DmmmmmmD DtmmmmtD dDDDDDDd') }, // Ravager
  ettin: { pal: P('m=#8a8f94 M=#6b7075 o=#ff8a2a O=#ffd27a r=#b87333 k=#2b2b2b'),
    face: F('mmmmmmmm mMMMMMMm MooooooM MoOOOOoM MMMMMMMM MrMMMMrM MkMkMkMM mMMMMMMm') }, // Goblin Mech
  hillgiant: { pal: P('b=#5a4630 s=#b09272 w=#f0f0f0 e=#3b5bb0 n=#8a6d52 m=#6b3f2a B=#6b5a44'),
    face: F('bbbbbbbb bssssssb ssssssss swessews sssnnsss ssmmmmss sBBBBBBs BBBBBBBB') }, // Giant
  orc: { pal: P('k=#2b2b2b s=#a1a7a8 K=#1a1a1a w=#f0f0f0 e=#2f6b3a n=#868b8c m=#4a4a4a'),
    face: F('kkkkkkkk kssssssk sKKKKKKs swessews sssnnsss sssnnsss ssmmmmss ssssssss') }, // Vindicator
  bugbear: { pal: P(`${GOB} y=#e0b21c l=#fff6a0 Y=#b88f12`), face: ['yyyyyyyy', 'yyylYyyy', 'YYYYYYYY', ...GOBFACE] }, // Pickaxe Goblin
  bear: { pal: P('G=#3f7a3a g=#5aa04a k=#1a1a1a w=#e8f0e0 y=#d8c27a Y=#b8a05a'),
    face: F('GGGGGGGG GggggggG gwkggkwg gggggggg gggggggg ggyyyygg gGYYYYGg GGGGGGGG') }, // Ancient Tortoise
  boar: { pal: P('b=#7a4e40 B=#a86e5a k=#1a1a1a p=#d79a8a n=#6a3a32 t=#f0ead6'),
    face: F('bbbbbbbb bBBBBBBb BkBBBBkB BBBBBBBB BppppppB BpnppnpB tBBBBBBt tbbbbbbt') }, // Hoglin

  // --- Guard ------------------------------------------------------------------
  skeletonwarrior: { pal: P('d=#242424 D=#3c3c3c k=#080808'),
    face: F('dddddddd dDDDDDDd DkkDDkkD DkkDDkkD DDDkkDDD DDDDDDDD DkDkDkDD dddddddd') }, // Wither Skeleton
  armor: { pal: P('i=#c0c6cc I=#a3aab0 k=#111111 p=#7a4fb8'),
    face: F('iiiiiiii iIIIIIIi IIIIIIII IkpkkpkI IIIkkIII IIIkkIII IiIkkIiI iiiiiiii') }, // Animated Armor
  stonegolem: { pal: P('c=#c06a3a C=#a5552e o=#4fa38a k=#2a1a12 n=#8e4524 l=#e0904a'),
    face: F('ccclcccc cCCoCCCc CCCCCCCC CkkCCkkC CCCnnCCC CoCnnCCC CCCCCoCC cccccccc') }, // Copperdeep Sentry
  hobgoblin: { pal: P('r=#8a1c1c R=#5e1212 w=#f0ead6 k=#2b2b2b s=#a1a7a8 K=#1a1a1a e=#3a6b3a n=#868b8c m=#4a4a4a W=#f8f8f8'),
    face: F('rrrrrrrr rRRwwRRr kssssssk sKKKKKKs sWessWes sssnnsss ssmmmmss ssssssss') }, // Pillager Captain
  duergar: { pal: P(`${GOB} b=#8a6a2a O=#7fd3e8`), face: ['gggggggg', 'GGGGGGGG', 'bOObbOOb', 'ggGnnGgg', 'gGmmmmGg', 'gtggggtg', 'gggggggg', 'gggggggg'] }, // Goblin Engineer
  gargoyle: { pal: P('b=#b08a3a B=#8a6a2a r=#e0432a p=#6b5020 k=#2a2a2a t=#e8e2cf g=#d9c36a'),
    face: F('bbbbbbbb bBBBBBBb BrBBBBrB BBBgBBBB BppppppB BpkppkpB tBBggBBt tbbbbbbt') }, // Clockwork Boar
  lizardfolk: { pal: P('r=#b22222 R=#f0ead6 w=#e3e3dc k=#222222 W=#c8c8bc'),
    face: F('rrrrrrrr rRrrrrRr wwwwwwww wkkwwkkw wkkwwkkw wwwkkwww WkWkWkWW wwwwwwww') }, // Pirate Deckhand
  earthelemental: { pal: P('S=#6a5a48 s=#8f7d64 K=#5a4c3c r=#e0702a n=#6a5a48 M=#4f7a3a'),
    face: F('SSSSSSSS SssssssS sKKKKKKs srrssrrs sssnnsss sssnnsss sMssssMs SSSSSSSS') }, // Groundbreaker Golem
  basilisk: { pal: P('c=#9fd8e8 C=#7ab8d0 k=#2a4a6a w=#e8f8ff'),
    face: F('cccccccc cCCCCCCc CkkCCkkC CCCCCCCC CwwwwwwC CCwwwwCC cCCCCCCc cccccccc') }, // Breeze

  // --- Arcana -----------------------------------------------------------------
  wisp: { pal: P('k=#2b2b2b K=#4a4a4a y=#ffd36a Y=#fff3b0 o=#ff9a2a'),
    face: F('kkkkkkkk kKKKKKKk KyyyyyyK KyYYYYyK KyYooYyK KyyyyyyK kKKKKKKk kkkkkkkk') }, // Magic Lantern
  flyingsword: { pal: P('b=#2a4a8a B=#f0ead6 s=#a1a7a8 K=#111111 w=#f0f0f0 e=#3a3a3a n=#868b8c m=#4a4a4a'),
    face: F('bbbbbbbb bBbbbbBb ssssssss sKKsswes sKKnnsss sssnnsss ssmmmmss ssssssss') }, // Cutlass Pirate
  magen: { pal: P('k=#161616 K=#1f1f1f p=#cc66ff P=#e0a8ff'),
    face: F('kkkkkkkk kKkkkkKk kkkkkkkk kkkkkkkk pPpkkpPp kkkkkkkk kkkkkkkk kkkkkkkk') }, // Enderman
  drow: { pal: P('k=#1e1e2a s=#a1a7a8 b=#2a2a2a w=#f0f0f0 e=#3a3a8a n=#868b8c m=#4a4a4a y=#d9b24a'),
    face: F('kkkkkkkk kssssssk sbbbbbbs swessews sssnnsss sssnnsss ssmmmmss yyyyyyyy') }, // Evoker
  fireelemental: { pal: P('y=#f0c419 Y=#e8a317 k=#2a1a0a o=#c4620d'),
    face: F('yyyyyyyy yYYYYYYy YkkYYkkY YYYYYYYY YooooooY YYooooYY yYYYYYYy yyyyyyyy') }, // Blaze
  waterweird: { pal: P('t=#5a9c8e T=#4a8a7c s=#e0a060 w=#f0f0f0 k=#ff7a2a'),
    face: F('tsttttst tTTTTTTt TTwwwwTT TwwkkwwT TTwwwwTT TTTTTTTT tTTTTTTt tsttttst') }, // Guardian
  cultist: { pal: P('b=#2a4a9a s=#a1a7a8 K=#2a2a2a w=#f0f0f0 e=#3a6ab8 n=#868b8c m=#4a4a4a'),
    face: F('bbbbbbbb bssssssb sKKKKKKs swessews sssnnsss sssnnsss ssmmmmss bbbbbbbb') }, // Illusioner

  // --- Nature -----------------------------------------------------------------
  wolf: { pal: P('b=#b08a3a B=#8a6a2a r=#e04a2a k=#2a2a2a g=#d9c36a'),
    face: F('bBbbbbBb bbbbbbbb brrbbrrb bbbgbbbb bbBBBBbb bBBkkBBb bbbbbbbb bgbbbbgb') }, // Clockwork Wolf
  spider: { pal: P('k=#2a2420 K=#3a322c r=#c0261b'),
    face: F('kkkkkkkk kKKKKKKk KrrKKrrK KKKKKKKK KrKrrKrK KKKKKKKK kKKKKKKk kkkkkkkk') }, // Spider
  shambler: { pal: P('m=#4f7a3a M=#6a9a4a w=#c8c8b8 k=#2a3a2a'),
    face: F('mmMmmmMm mwmmmmwm wwwwwwww wkkwwkkw wkkwwkkw wwwkkwww mkwkwkwm mmwwwwmm') }, // Bogged
  treant: { pal: P('b=#4a3a2c B=#3a2c20 o=#ff8a1a'),
    face: F('bbbbbbbb bBbbBbbB BbBBbBBb BooBBooB BbBBbBBb bBbbBbBb BbbBbbBB bbbbbbbb') }, // Creaking
  blight: { pal: P('g=#7a7a7a G=#a0a0a0 k=#2a2a2a'),
    face: F('gggggggg gGGGGGGg GkGGGGkG GGGGGGGG gggggggg GGGGGGGG gggggggg GgGgGgGg') }, // Silverfish
  toad: { pal: P('o=#c8823a O=#e0a050 k=#1a1a1a m=#5a3a1a y=#e8d08a'),
    face: F('okkookko oOOooOOo oooooooo oooooooo mmmmmmmm oooooooo oyyyyyyo oooooooo') }, // Giant Frog
  serpent: { pal: P('p=#8a3a8a P=#a04aa0 y=#f0d040 k=#1a1a1a s=#e0a0d0'),
    face: F('pppppppp pPPPPPPp PyyPPyyP PykPPkyP PPPPPPPP PsPsPsPs pPpPpPpP pppppppp') }, // Kraken Tentacle
  ravens: { pal: P('t=#1f3a3f T=#2a4f55 r=#c0261b'),
    face: F('tttttttt tTTTTTTt TrrTTrrT TTTTTTTT TrTrrTrT TTTTTTTT tTTTTTTt tttttttt') }, // Cave Spiders
  ankheg: { pal: P('d=#6a5040 D=#8a6a52 h=#e8e2cf k=#1b1b1b n=#5a4234 m=#2a1a14 t=#f0ead6'),
    face: F('hddddddh dDDDDDDd DDDDDDDD DkkDDkkD DDDnnDDD DmmmmmmD DtmmmmtD dDDDDDDd') }, // Mini Ravager
  stirge: { pal: P('b=#4a3a2c B=#3a2c20 k=#e0d8c0 m=#2a1a10'),
    face: F('bBbbbbBb bBbbbbBb bbbbbbbb bkkbbkkb bbbbbbbb bbbmmbbb bbbbbbbb bbbbbbbb') }, // Bats

  // --- Cunning ----------------------------------------------------------------
  goblin: { pal: P(`${GOB} h=#1e1e1e H=#d9b24a`), face: ['hhhhhhhh', 'hHhhhhHh', 'gggggggg', ...GOBFACE] }, // Pistol Goblin
  bandit: { pal: P('r=#b22222 R=#f0ead6 k=#2b2b2b s=#a1a7a8 K=#1a1a1a w=#f0f0f0 e=#3a3a3a n=#868b8c m=#4a4a4a'),
    face: F('rrrrrrrr rRrrrrRr kssssssk sKKKKKKs swessews sssnnsss skmmmmks ssssssss') }, // Pillager Pirate
  kobold: { pal: P(`${GOB} b=#b09060 B=#8a6a40 y=#f0c419`), face: ['bbbbbbbb', 'bBbbbbBb', 'gggggggg', 'gekggkeg', 'ggGnnGgg', 'gGmmmmGg', 'gyggggyg', 'gggggggg'] }, // Loot Goblin
  wererat: { pal: P('b=#6a5040 B=#d08a8a r=#d02020 p=#e0a0a0 w=#d8d0c0 t=#f0ead6'),
    face: F('bBbbbbBb bbbbbbbb brrbbrrb bbbbbbbb wbbppbbw bbbbbbbb bbbttbbb bbbbbbbb') }, // Rodent of Unusual Size
  rats: { pal: P(`${GOB} r=#c0392b w=#f0f0f0 f=#3a3a3a`), face: ['rrrfrrrr', 'rrwwwwrr', 'gggggggg', ...GOBFACE] }, // Bomb Goblins
  boggle: { pal: P('p=#3a1a4a P=#5a2a6a m=#b060e0'),
    face: F('pppppppp pPPPPPPp PmPPPPmP PPPPPPPP pppppppp PPPPPPPP pppppppp PpPpPpPp') }, // Endermite
  redcap: { pal: P('g=#2e8b2e G=#3aa03a k=#1a1a1a y=#f0c419 s=#f0c0a0 w=#f0f0f0 e=#2e6b2e n=#e0a080 O=#d2691e m=#8a3a1a'),
    face: F('gggggggg gGGGGGGg kkkyykkk swessews sssnnsss sOmmmmOs OOOOOOOO OOOOOOOO') }, // Leprechaun
  harpy: { pal: P('p=#4a5a8a P=#5a6a9a g=#7cf07c w=#e0e0e0'),
    face: F('pppppppp pPPPPPPp PggPPggP PPPPPPPP PwPwwPwP PPPPPPPP pPPPPPPp pppppppp') }, // Phantom
  mimic: { pal: P('b=#7a4a1e B=#a86e3a r=#e02a2a t=#f0ead6 g=#c0c0c0 m=#2a0a0a'),
    face: F('bbbbbbbb bBBBBBBb BrBBBBrB BBBBBBBB tttggttt mmmmmmmm tmtmtmtm bbbbbbbb') }, // Mimic Chest

  // --- Faith ------------------------------------------------------------------
  ghoul: { pal: P('h=#6a5a40 s=#b8a070 k=#2a2a2a S=#9a8458'),
    face: F('hhhhhhhh hssssssh ssssssss skksskks sssSSsss sSkkkkSs ssssssss ssssssss') }, // Husk
  ghast: { pal: P('w=#d8ccb0 W=#b8ac90 y=#d9b24a o=#f0c419 k=#1a1a1a'),
    face: F('wwwwwwww wWwwWwwW yyyyyyyy wokwwkow wwwWWwww wWkkkkWw wwwwwwww WwWwWwWw') }, // Cursed Tomb Raider
  wight: { pal: P('w=#e0d8c0 W=#b8b098 g=#4ae04a K=#2a2a2a'),
    face: F('wwwwwwww wWwwwwWw WwwWwWww wggwwggw wWwwWwWw wwKKKKww WwwWwwWw wwwwwwww') }, // Mummy
  wraith: { pal: P('d=#1f5a5a s=#5aa0a0 c=#60ffff S=#4a8a8a'),
    face: F('dddddddd dssssssd ssssssss sccsscss sssSSsss ssSSSSss ssssssss dsdssdsd') }, // Drowned
  specter: { pal: P('v=#9ab0c0 V=#b8cfdc y=#f0c419 k=#2a3a4a'),
    face: F('vvvvvvvv vVVVVVVv VyyVVyyV VVVVVVVV VVkkkkVV vVVVVVVv vvVvvVvv vvvvvvvv') }, // Avarice Wraith
  banshee: { pal: P('w=#e8eef2 W=#d0dce4 k=#1a1a2a'),
    face: F('wwwwwwww wWWWWWWw WkkWWkkW WWWWWWWW WWkkkkWW WWkkkkWW wWWWWWWw wwwwwwww') }, // Wailing Spirit
  zombie: { pal: P('g=#3e6e30 G=#62a050 k=#1a1a1a d=#4a8a3a'),
    face: F('gggggggg gGGGGGGg GGGGGGGG GkkGGkkG GGGddGGG GGddddGG GGGGGGGG GGGGGGGG') }, // Zombie
  skeleton: { pal: P('w=#bdbdbd W=#dcdcdc k=#3a3a3a'),
    face: F('wwwwwwww wWWWWWWw WkkWWkkW WkkWWkkW WWWkkWWW WWWWWWWW WkWkWkWW wwwwwwww') }, // Skeleton

  // --- The ones a floor is named after -----------------------------------------
  lich: { pal: P('p=#8a5aa0 P=#a070b8 y=#e8e070 k=#2a2a2a'),
    face: F('pppppppp pPPPPPPp PPPPPPPP pppppppp yyyyyyyy ykkyykky yyyyyyyy pppppppp') }, // Shulker Lord
  boneclaw: { pal: P('y=#d9b24a b=#2a4a9a w=#e8e2cf o=#ff9a2a k=#1a1a1a'),
    face: F('yyyyyyyy ybbbbbby ywwwwwwy woowwoow wwwkkwww wkwkwkww ywwwwwwy yyyyyyyy') }, // Sand Spirit (Akh-Sha-In)
  hag: { pal: P('p=#4a2a6a P=#6a3a8a s=#8aa060 w=#f0f0f0 e=#3a6a2a n=#6a8a40 W=#4a6a2a m=#3a2a1a'),
    face: F('pppppppp PPPPPPPP ssssssss swessews sssnnsss sssnnWss ssmmmmss ssssssss') }, // Swamp Hag
  irongolem: { pal: P('i=#c8c0b0 I=#b0a898 K=#8a8278 r=#9a2a1a n=#9a9088 v=#4a7a3a'),
    face: F('iiiiiiii iIIIIIIi IKKKKKKI IrrIIrrI IIInnIII IIInnIII IvIIIIvI iiiiiiii') }, // Iron Golem
  oni: { pal: P(`${GOB} b=#6a4a2a O=#9ad8e8`), face: ['bbbbbbbb', 'bOObbOOb', 'gggggggg', ...GOBFACE] }, // Goblin Chopper
  minotaurskeleton: { pal: P('k=#1e1e1e y=#d9b24a p=#d8908a w=#f0f0f0 K=#1a1a1a P=#c07a72 n=#5a2a2a t=#f0ead6'),
    face: F('kkkkkkkk kyykkyyk pppppppp pwKppKwp pPPPPPPp PPnPPnPP tPPPPPPt pppppppp') }, // Piglin Brute
  otyugh: { pal: P('l=#5ab83a L=#86d466 k=#2a5a2a'),
    face: F('llllllll lLLLLLLl LkkLLkkL LkkLLkkL LLLLLLLL LLLkkLLL lLLLLLLl llllllll') }, // Big Slime
  reddragon: { pal: P('h=#2fb8c0 d=#0f2a30 D=#1a3a42 c=#3ae0e8 m=#0a1a1e'),
    face: F('hddddddh dDDDDDDd DDDDDDDD DDccccDD DcDDDDcD DDDDDDDD DDDmmDDD dddddddd') }, // Warden
  whitedragon: { pal: P('w=#f0f4f8 W=#dfe8f0 b=#7aa0c8 k=#1a1a1a m=#2a3a5a t=#ffffff'),
    face: F('wwwwwwww wWWWWWWw WbbbbbbW bkbbbbkb bbbbbbbb bbmmmmbb WbtbbtbW wwwwwwww') }, // Yeti

  // --- What a lair holds ----------------------------------------------------
  warhound: { pal: P('g=#c8c8c8 G=#a8a8a8 k=#2a2a2a w=#f4f4f4 r=#c0392b'),
    face: F('gGggggGg gggggggg gwkggkwg gggggggg ggGGGGgg gGGkkGGg gggggggg rrrrrrrr') }, // Wolf
  owlbear: { pal: P('w=#f0f0ec W=#d8d8d0 k=#1a1a1a'),
    face: F('wWwwwwWw wwwwwwww wkwwwwkw wwwwwwww wwWWWWww wwWkkWww wwwwwwww wwwwwwww') }, // Polar Bear
  sprite: { pal: P('c=#7ad0f0 C=#a0e4ff k=#1a2a5a m=#5aa8d0'),
    face: F('cccccccc cCCCCCCc CkCCCCkC CkCCCCkC CCCCCCCC CCCmmCCC cCCCCCCc cccccccc') }, // Allay
  homunculus: { pal: P('b=#b08a3a B=#c9a24a O=#9ad8e8 o=#2a2a2a k=#5a4020'),
    face: F('bbbbbbbb bBBBBBBb BOoBBoOB BooBBooB BBBBBBBB BBkkkkBB BBkBBkBB bbbbbbbb') }, // Clockwork Homunculus
  eagle: { pal: P('r=#d02a2a R=#e04040 k=#1a1a1a y=#f0c419 b=#2a6ad0'),
    face: F('rrrrrrrr rRRRRRRr RkRRRRkR RRRyyRRR RRyyyyRR RRRyyRRR bRRRRRRb bbrrrrbb') }, // Pirate Parrot
  pseudodragon: { pal: P('o=#8a2a12 y=#ffb030 k=#1a0a00'),
    face: F('oooooooo oyoooyoo ooyoyooo okkookko oooooooo ooyyyyoo oooyoooo oooooooo') }, // Lava Tadpole
  griffon: { pal: P('w=#f4f4f4 W=#e4e4e4 k=#2a2a2a b=#f0a0b0 m=#3a3a3a'),
    face: F('wwwwwwww wWWWWWWw WkkWWkkW WbWWWWbW WWWWWWWW WWWmmWWW wWWWWWWw wwwwwwww') }, // Happy Ghast
  shadowmastiff: { pal: P('w=#f4f4f4 P=#f0a0b0 r=#d01010 t=#ffffff b=#c01010'),
    face: F('wPwwwwPw wPwwwwPw wwwwwwww wrwwwwrw wwwPPwww wwbttbww wwwwwwww wwwwwwww') }, // Vorpal Bunny
};
