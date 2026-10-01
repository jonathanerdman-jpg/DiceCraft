// The floor pieces, drawn from the very side rules js/tiles.js lays them by.
//
// A piece is 20 blocks square. What each side *is* — wall, door or open —
// decides the shape: a door is a passage six blocks wide down the middle of
// that side, an open side is floor running the whole width of it, and a wall
// is a wall. Because the shapes come from the same table the layout reads,
// a door always meets a door and an open side always meets an open side, and
// the floor reads as one dungeon however it is laid.
import { BLOCKS, Canvas, blockField, rng } from './blocks.mjs';

export const N = 20;
const D0 = 7;
const D1 = 12;
const INSET = 2;

// The cells of a piece: 'f' floor, 'w' wall, '' nothing.
export function layout(sides, { room }) {
  const g = Array.from({ length: N }, () => Array(N).fill(''));
  const floor = (x, y) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = 'f'; };
  if (room) {
    const x0 = sides.w === 'open' ? 0 : INSET;
    const x1 = sides.e === 'open' ? N - 1 : N - 1 - INSET;
    const y0 = sides.n === 'open' ? 0 : INSET;
    const y1 = sides.s === 'open' ? N - 1 : N - 1 - INSET;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor(x, y);
  } else {
    for (let y = D0; y <= D1; y++) for (let x = D0; x <= D1; x++) floor(x, y);
  }
  // Every door is a passage from the middle out to its edge.
  if (sides.n === 'door') for (let y = 0; y <= D1; y++) for (let x = D0; x <= D1; x++) floor(x, y);
  if (sides.s === 'door') for (let y = D0; y < N; y++) for (let x = D0; x <= D1; x++) floor(x, y);
  if (sides.w === 'door') for (let x = 0; x <= D1; x++) for (let y = D0; y <= D1; y++) floor(x, y);
  if (sides.e === 'door') for (let x = D0; x < N; x++) for (let y = D0; y <= D1; y++) floor(x, y);
  // Walls round everything, one block thick.
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && xx >= 0 && yy < N && xx < N && g[yy][xx] === 'f') g[y][x] = 'w';
        }
      }
    }
  }
  return g;
}

// How each tileset dresses that shape.
export const DRESS = {
  // Stone brick halls with deepslate walls, open to the sky between rooms.
  stone: (cell, x, y, r, v) => {
    if (cell === 'w') return 'deepslatebrick';
    if (cell === 'f') {
      const roll = r();
      if (roll < (v ? 0.18 : 0.08)) return 'mossbrick';
      if (roll < 0.16) return 'crackbrick';
      return 'stonebrick';
    }
    return null;
  },
  // Monument channels: prismarine walks either side of running water, set
  // into dark prismarine.
  sewer: (cell, x, y, r, v, g) => {
    if (cell === 'f') {
      const edge = (dx, dy) => { const c = g[y + dy] && g[y + dy][x + dx]; return c === 'w' || c === undefined; };
      const walk = edge(1, 0) || edge(-1, 0) || edge(0, 1) || edge(0, -1);
      return walk ? (v ? 'prismarine' : 'prismbrick') : 'water';
    }
    return 'darkprism';
  },
  // A wharf seen from above: boardwalk and cobble between roofs.
  chase: (cell, x, y, r, v) => {
    if (cell === 'f') return r() < 0.12 ? 'cobble' : (v ? 'planks' : 'path');
    if (cell === 'w') return 'darkplanks';
    const quarter = (x < N / 2 ? 0 : 1) + (y < N / 2 ? 0 : 2);
    return ['roofred', 'roofblue', 'roofslate', 'roofred'][(quarter + v) % 4];
  },
};

export function drawPiece(set, sides, { room, variant = 0, seed = 1, px = 1 }) {
  const g = layout(sides, { room });
  const r = rng(seed);
  return blockField(N, N, (bx, by) => DRESS[set](g[by][bx], bx, by, r, variant, g), { px, seed });
}

// The out-of-doors ground: grass with flowers, or swamp mud and water.
export function wildGround(kind, variant, px = 1) {
  const r = rng(101 + variant * 17 + (kind === 'fen' ? 500 : 0));
  return blockField(N, N, () => {
    const roll = r();
    if (kind === 'fen') return roll < 0.35 ? 'murk' : roll < 0.45 ? 'lilypad' : 'mud';
    return roll < 0.08 ? 'path' : 'grass';
  }, { px, seed: 31 + variant });
}

export { BLOCKS, Canvas };
