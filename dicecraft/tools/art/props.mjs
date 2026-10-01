// What stands in a room on the floor plan, and the scrub out of doors.
const P = (text) => Object.fromEntries(text.trim().split(/\s+/).map((pair) => pair.split('=')));

export const PROPS = {
  // The way in: a ladder down through an open trapdoor.
  prop_stair: { pal: P('b=#8a5a2c B=#5e3c1a k=#140c1e l=#a07a48 L=#6a4a28'), rows: [
    'bbbbbbbbbbbb',
    'bBkkkkkkkkBb',
    'bBkLkkkkLkBb',
    'bBklllllllBb',
    'bBkLkkkkLkBb',
    'bBkLkkkkLkBb',
    'bBklllllllBb',
    'bBkLkkkkLkBb',
    'bBkLkkkkLkBb',
    'bBklllllllBb',
    'bBkLkkkkLkBb',
    'bbbbbbbbbbbb',
  ] },
  // The resting place: a beacon, lit.
  prop_altar: { pal: P('g=#9ad8e8 G=#e8fbff o=#140c1e k=#3a2a5a b=#5ae0ff w=#ffffff'), rows: [
    '.ggggggggg.',
    'ggGGGGGGGgg',
    'gGGbbbbbGGg',
    'gGbbwwwbbGg',
    'gGbwwwwwbGg',
    'gGbbwwwbbGg',
    'gGGbbbbbGGg',
    'ggGGGGGGGgg',
    '.ooooooooo.',
    'okokokokoko',
  ] },
  prop_chest: { pal: P('b=#8a5a2a B=#a86e3a d=#5e3c1a k=#2a1a0a g=#c0c0c0 G=#ffffff'), rows: [
    '.kkkkkkkkkkkk.',
    'kBBBBBBBBBBBBk',
    'kBbbbbbbbbbbBk',
    'kBbbbbbbbbbbBk',
    'kddddddggddddk',
    'kkkkkkkGgkkkkk',
    'kBbbbbbggbbbBk',
    'kBbbbbbbbbbbBk',
    'kBbbbbbbbbbbBk',
    'kddddddddddddk',
    '.kkkkkkkkkkkk.',
  ] },
  prop_hoard: { pal: P('b=#8a5a2a B=#a86e3a d=#5e3c1a k=#2a1a0a g=#f0c419 G=#fff6a0 y=#c89a14 e=#3ad6c6'), rows: [
    '..kkkkkkkkkk..',
    '.kBBBBBBBBBBk.',
    '.kbbbbbbbbbbk.',
    'kkkkkkkkkkkkkk',
    'kgGgygGgegGggk',
    'kgyGgggGgyggGk',
    'kBbbbbbbbbbbBk',
    'kBbbbbbbbbbbBk',
    'kddddddddddddk',
    '.kkkkkkkkkkkk.',
  ] },
  prop_bones: { pal: P('w=#e8e2cf W=#b8b098 k=#3a3a3a'), rows: [
    '.ww.......ww.',
    'wWww.....wwWw',
    '.wwWw...wWww.',
    '...wWw.wWw...',
    '....wWwWw....',
    '.....wWw.....',
    '....wWwWw....',
    '...wWw.wWw...',
    '.wwWw...wWww.',
    'wWww.....wwWw',
    '.ww.......ww.',
  ] },
  // A lantern on a post, which is what lights a passage here.
  prop_brazier: { pal: P('k=#2b2b2b K=#4a4a4a y=#ffd36a Y=#fff3b0 o=#ff9a2a'), rows: [
    '...kk...',
    '..kKKk..',
    '.kKKKKk.',
    '.kyYYyk.',
    '.kyYoyk.',
    '.kyyyyk.',
    '.kKKKKk.',
    '..kkkk..',
  ] },
};

// Out-of-doors scrub, four of each, drawn small and placed by js/tiles.js.
export const SCRUB = {
  fw_s1: { pal: P('l=#3f8a2a L=#2c6a1e D=#1f4a16'), rows: ['..lll..', '.lLlll.', 'llllLll', 'lLlllDl', '.lllLl.', '..lDl..'] },
  fw_s2: { pal: P('l=#3f8a2a L=#2c6a1e r=#d04040 y=#f0d040'), rows: ['.l...l.', 'lrl.lyl', '.l...l.', '...l...', '..lrl..', '...l...'] },
  fw_s3: { pal: P('l=#2c5a1e L=#1f4a16 t=#6a4a28'), rows: ['...L...', '..lLl..', '.llLll.', '..lLl..', '.llLll.', 'lllLlll', '...t...'] },
  fw_s4: { pal: P('l=#5a9a3c L=#4a8a2e'), rows: ['l.l..l.l', '.lLl.lL.', 'lLlLlLlL'] },
  fen_s1: { pal: P('p=#2e7a2a P=#4a9a3a'), rows: ['.pppp.', 'pPPPpp', 'pPPP..', 'pPPPpp', '.pppp.'] },
  fen_s2: { pal: P('r=#5a3a20 g=#4a7a2a G=#6a9a3a'), rows: ['.g..g.', '.r.gr.', 'gr.rg.', '.rg.r.', '.r..r.', '.r..r.'] },
  fen_s3: { pal: P('r=#6a4a2a R=#4a3018 l=#2c6a1e L=#3f8a2a'), rows: ['.llll.', 'lLllLl', '.lLLl.', '..rr..', '.r..r.', 'R....R'] },
  fen_s4: { pal: P('p=#2e7a2a P=#4a9a3a w=#f0f0f0 y=#f0d040'), rows: ['.ppp.', 'pPwPp', 'pwywp', 'pPwPp', '.ppp.'] },
};
