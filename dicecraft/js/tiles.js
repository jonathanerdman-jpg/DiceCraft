// Stonework for the map.
//
// The dungeon pieces are painted on a common 1200x1200 square: a corridor sits
// centered and full width, a room sits inset by the thickness of its own walls,
// a stair-chamber hangs its one doorway off the bottom edge. Because the art is
// already placed on that square, a piece only has to be drawn into a map cell
// at the cell's own size and turned to face the right way — the openings then
// meet across the join, and a floor drawn tile by tile reads as one dungeon.
//
// Each piece is named by the sides it opens onto. Turning it a quarter turn
// clockwise carries those openings with it, so one piece covers every rotation
// of its shape.
const CLOCKWISE = { n: 'e', e: 's', s: 'w', w: 'n' };
const ORDER = ['n', 'e', 's', 'w'];

// Every piece declares what each of its four sides *is*, not merely whether it
// is open, because two open sides do not necessarily meet. There are three
// kinds of side:
//
//   wall  nothing crosses it
//   door  a corridor's width, centered — the narrow opening a passage makes
//   open  floor running the whole side, the way a room continues into the
//         next square of the same room
//
// A join only works when both sides are the same kind. A door against an open
// side is the seam you can see in the art: a corridor arriving at a room's
// flank, with the room's wall stopping dead on either side of it. So the
// layout below never places a piece whose sides disagree with its neighbors'.
// Three floors, each a complete vocabulary of shapes. A floor is laid from one
// set and never from two, so the sets do not have to agree with each other —
// only with themselves.
//
// The stone set's rooms open along a whole side; the sewer's channels and the
// city's streets are one width throughout, so every one of their joins is a
// door meeting a door and they lay a floor without a single mismatched seam.
// Both also bring a crossroads, which the stone set has none of.
export const SETS = {
  stone: {
    // One way out: a chamber, which is where a floor's dead ends want to be.
    chamber: { open: 'S', sides: { n: 'wall', e: 'wall', s: 'door', w: 'wall' }, files: ['dbt_5_1', 'dbt_5_2'] },
    // Straight through.
    passage: { open: 'EW', sides: { n: 'wall', e: 'door', s: 'wall', w: 'door' }, files: ['dbt_4_1', 'dbt_4_2'] },
    // A turn: a room open on two touching sides, which is to say it is one
    // corner of a bigger room rather than a bend in a corridor.
    corner: { open: 'ES', sides: { n: 'wall', e: 'open', s: 'open', w: 'wall' }, files: ['dbt_2_1', 'dbt_2_2'] },
    // Three ways: a corridor junction.
    junction: { open: 'EWS', sides: { n: 'wall', e: 'door', s: 'door', w: 'door' }, files: ['dbt_1_1', 'dbt_1_2'] },
    // A hall: room floor continuing east and south, with a doorway west.
    hall: { open: 'EWS', sides: { n: 'wall', e: 'open', s: 'open', w: 'door' }, files: ['dbt_3_1', 'dbt_3_2'] },
  },
  // Streets between buildings, seen from above: the same vocabulary again, with
  // the roofs as its walls. Its ways through are a street's width, which is the
  // same width all over the set, so it joins as cleanly as the sewer does.
  chase: {
    chamber: { open: 'S', sides: { n: 'wall', e: 'wall', s: 'door', w: 'wall' }, files: ['ct_14', 'ct_18'] },
    passage: { open: 'NS', sides: { n: 'door', e: 'wall', s: 'door', w: 'wall' }, files: ['ct_01', 'ct_20'] },
    corner: { open: 'ES', sides: { n: 'wall', e: 'door', s: 'door', w: 'wall' }, files: ['ct_03'] },
    junction: { open: 'ESW', sides: { n: 'wall', e: 'door', s: 'door', w: 'door' }, files: ['ct_08'] },
    cross: { open: 'NESW', sides: { n: 'door', e: 'door', s: 'door', w: 'door' }, files: ['ct_07'] },
  },
  sewer: {
    chamber: { open: 'S', sides: { n: 'wall', e: 'wall', s: 'door', w: 'wall' }, files: ['sw_05', 'sw_14'] },
    passage: { open: 'NS', sides: { n: 'door', e: 'wall', s: 'door', w: 'wall' }, files: ['sw_01', 'sw_12'] },
    corner: { open: 'ES', sides: { n: 'wall', e: 'door', s: 'door', w: 'wall' }, files: ['sw_04', 'sw_11'] },
    junction: { open: 'ESW', sides: { n: 'wall', e: 'door', s: 'door', w: 'door' }, files: ['sw_09'] },
    // The same three ways drawn the other way up, so a floor is not all one
    // silhouette.
    outfall: { open: 'NES', sides: { n: 'door', e: 'door', s: 'door', w: 'wall' }, files: ['sw_02'] },
    cross: { open: 'NESW', sides: { n: 'door', e: 'door', s: 'door', w: 'door' }, files: ['sw_03', 'sw_17'] },
  },
};

export const SET_NAMES = Object.keys(SETS);

// --- Out of doors -----------------------------------------------------------
//
// A wood and a fen are not laid from pieces. There is no door to line up and
// no wall to stop dead: there is ground, and there is what grows in it. So a
// wild floor says where the ground is, draws the trail between one clearing
// and the next, and puts the scrub in the gaps the trails do not use. The
// player is choosing a path, not a room.
export const WILDS = {
  wood: { ground: ['fw_g1', 'fw_g2', 'fw_g3', 'fw_g4'], scrub: ['fw_s1', 'fw_s2', 'fw_s3', 'fw_s4'] },
  fen: { ground: ['fen_g1', 'fen_g2', 'fen_g3', 'fen_g4'], scrub: ['fen_s1', 'fen_s2', 'fen_s3', 'fen_s4'] },
};

export const WILD_NAMES = Object.keys(WILDS);

export function isWildSet(set) {
  return Object.prototype.hasOwnProperty.call(WILDS, set);
}

// Where the scrub sits along one side of a cell, in units of the cell itself,
// so the caller can draw it at whatever size a cell happens to be. Two clumps
// a side, nudged off center by the cell's own number so a floor is not a
// lattice of identical bushes.
const ALONG = [0.3, 0.7];

// A wild floor, cell by cell: the ground it stands on, and the scrub that
// closes off every side no trail runs through. Sides that a trail does use are
// left open, which is the whole of the map-reading here — you can see where
// you may go because that is where nothing is growing.
export function wildFor(map, { set = 'wood', variantOf = (tile) => tile.x + tile.y * 3 } = {}) {
  const wild = WILDS[set] || WILDS.wood;
  const placed = new Map();
  Object.values(map.tiles)
    .filter((tile) => tile.state !== 'hidden')
    .forEach((tile) => {
      const v = Math.abs(variantOf(tile));
      const exits = exitsFor(map, tile);
      const scrub = [];
      ORDER.forEach((dir, side) => {
        if (exits.includes(dir)) return;
        ALONG.forEach((at, i) => {
          const wobble = ((v + side * 3 + i * 5) % 5) / 25 - 0.08;
          const along = at + wobble;
          const across = 0.5 + (((v + side + i) % 3) - 1) * 0.04;
          const [u, w] = dir === 'n' ? [along, 1 - across]
            : dir === 's' ? [along, across]
              : dir === 'w' ? [1 - across, along]
                : [across, along];
          scrub.push({
            file: wild.scrub[(v + side * 2 + i) % wild.scrub.length],
            u: dir === 'n' || dir === 's' ? u : u,
            v: dir === 'n' ? 0.14 : dir === 's' ? 0.86 : w,
            size: 0.4 + ((v + side + i * 2) % 3) * 0.07,
          });
        });
      });
      placed.set(tile.key, { ground: wild.ground[v % wild.ground.length], scrub });
    });
  return { placed };
}


export const TILE_DIR = 'assets/tiles/';

const key = (dirs) => ORDER.filter((d) => dirs.includes(d)).join('');

function turn(dirs) {
  return key([...dirs].map((d) => CLOCKWISE[d]));
}

function turnSides(sides) {
  const spun = {};
  ORDER.forEach((d) => { spun[CLOCKWISE[d]] = sides[d]; });
  return spun;
}

// Every way a piece can be laid: its shape, turned, with the sides that
// turning carries round with it.
function placements(pieces) {
  const all = [];
  Object.entries(pieces).forEach(([name, piece]) => {
    let open = key(piece.open.toLowerCase());
    let sides = { ...piece.sides };
    for (let quarter = 0; quarter < 4; quarter++) {
      all.push({ name, piece, open, sides, rotation: quarter * 90 });
      open = turn(open);
      sides = turnSides(sides);
    }
  });
  return all;
}

const PLACEMENTS = Object.fromEntries(
  Object.entries(SETS).map(([id, pieces]) => [id, placements(pieces)]),
);

// What a cell could be, given the ways out it must have.
export function optionsFor(exits, set = 'stone') {
  const wanted = key(exits);
  return (PLACEMENTS[set] || PLACEMENTS.stone).filter((p) => p.open === wanted);
}

// Which sides of a cell open onto a neighbor, given the map's own links.
export function exitsFor(map, tile) {
  const dirs = [];
  tile.links.forEach((k) => {
    const other = map.tiles[k];
    if (!other) return;
    if (other.y < tile.y) dirs.push('n');
    else if (other.y > tile.y) dirs.push('s');
    else if (other.x > tile.x) dirs.push('e');
    else if (other.x < tile.x) dirs.push('w');
  });
  return key(dirs);
}

const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

function neighbourOf(map, tile, dir) {
  return Object.values(map.tiles).find((other) => (
    dir === 'n' ? other.x === tile.x && other.y === tile.y - 1
      : dir === 's' ? other.x === tile.x && other.y === tile.y + 1
        : dir === 'e' ? other.y === tile.y && other.x === tile.x + 1
          : other.y === tile.y && other.x === tile.x - 1
  ));
}

// Lay the whole floor at once, rather than a piece at a time, because whether
// a piece fits is a question about its neighbors. Cells are settled in a
// fixed order and each one takes the option that agrees with the sides
// already laid beside it; where nothing agrees, the least bad is taken and
// the join is counted, so a tileset that cannot do a shape says so out loud
// instead of quietly drawing a wall across a corridor.
export function layoutFor(map, { variantOf = (tile) => tile.x + tile.y * 3, set = 'stone' } = {}) {
  const placed = new Map();
  const seams = [];
  const tiles = Object.values(map.tiles)
    .filter((tile) => tile.state !== 'hidden')
    .sort((a, b) => a.y - b.y || a.x - b.x);

  tiles.forEach((tile) => {
    const exits = exitsFor(map, tile);
    const options = optionsFor(exits, set);
    if (!options.length) { placed.set(tile.key, { stones: crossroads(variantOf(tile), set), sides: null }); return; }

    let best = null;
    options.forEach((option) => {
      let agree = 0;
      let clash = 0;
      ORDER.forEach((dir) => {
        const other = neighbourOf(map, tile, dir);
        const settled = other && placed.get(other.key);
        if (!settled || !settled.sides) return;
        const mine = option.sides[dir];
        const theirs = settled.sides[OPPOSITE[dir]];
        if (mine === theirs) agree++;
        else clash++;
      });
      // A room piece where a room piece fits, a corridor where a corridor
      // does: agreement first, and the variant only breaks ties.
      const score = agree * 10 - clash * 10 + (option.rotation === 0 ? 1 : 0);
      if (!best || score > best.score) best = { option, score, clash };
    });

    ORDER.forEach((dir) => {
      const other = neighbourOf(map, tile, dir);
      const settled = other && placed.get(other.key);
      if (!settled || !settled.sides) return;
      const mine = best.option.sides[dir];
      const theirs = settled.sides[OPPOSITE[dir]];
      if (mine !== theirs) seams.push({ at: tile.key, to: other.key, dir, mine, theirs });
    });

    placed.set(tile.key, {
      sides: best.option.sides,
      stones: [{ file: fileOf(best.option, variantOf(tile)), rotation: best.option.rotation }],
    });
  });

  return { placed, seams };
}

// A shape the set has no piece for — in practice a crossroads, which the
// stone set cannot draw — is two junctions laid back to back. Both are
// corridors, so the sides they present are the same doors a junction presents
// and nothing downstream has to know. A set with a real crossroads in it
// never comes through here.
function crossroads(variant, set = 'stone') {
  const [a, b] = [key('esw'), key('new')].map((want) => optionsFor(want, set).find((o) => o.name === 'junction'));
  return [
    { file: fileOf(a, variant), rotation: a.rotation },
    { file: fileOf(b, variant + 1), rotation: b.rotation },
  ];
}

function fileOf(option, variant) {
  const files = option.piece.files;
  return files[Math.abs(variant) % files.length];
}

// The stone set under its old name, so anything that only ever knew one floor
// still works.
export const PIECES = SETS.stone;
