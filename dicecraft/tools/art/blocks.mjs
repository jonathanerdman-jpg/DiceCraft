// Shared drawing for the art tool: block heads, item icons, and the block
// textures the floors are laid from.
import { Canvas, hex, mix, rng, shade } from './canvas.mjs';

// --- Block heads ------------------------------------------------------------
//
// A head is a cube seen from a little above and to the right: the face in
// front, the top of the head over it and the right-hand side beside it, both
// carried on from the face's own edge pixels so only the face is drawn by
// hand. `size` is the width of the face in screen pixels.
export function headCube(face, pal, { size = 64, depth = 0.34, outline = '#140c1e' } = {}) {
  const t = Math.round(size * depth);
  const W = size + t + 4;
  const H = size + t + 4;
  const c = new Canvas(W, H);
  const at = (x, y) => pal[face[y][x]];
  const ox = 2;
  const oy = 2 + t;
  // Top: the face's first row, carried back.
  c.quad((x, y) => shade(at(x, 0), 0.14 - y * 0.012), 8, 8, [ox, oy], [size, 0], [t, -t]);
  // Side: the face's last column, carried back and darker.
  c.quad((x, y) => shade(at(7, y), -0.3 - x * 0.012), 8, 8, [ox + size, oy], [t, -t], [0, size]);
  // Face.
  const k = size / 8;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.rect(ox + x * k, oy + y * k, k, k, at(x, y));
  return outline ? c.outlined(outline) : c;
}

// A flat face, square, for the places a cube would be too busy.
export function headFlat(face, pal, size = 64) {
  const c = new Canvas(size, size);
  const k = size / 8;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.rect(x * k, y * k, k, k, pal[face[y][x]]);
  return c;
}

// --- Item icons ---------------------------------------------------------------
//
// A sprite drawn from a grid, trimmed to what is in it and enlarged by whole
// pixels to fit `box`, then centered on a canvas of that size.
export function icon(rows, pal, box, { pad = 0.1, outline = '#120a18', maxScale = 99 } = {}) {
  const w = Math.max(...rows.map((r) => r.length));
  const raw = new Canvas(w, rows.length);
  raw.sprite(rows, pal, 0, 0, 1);
  const bb = raw.bbox();
  if (!bb) return new Canvas(box, box);
  const trimmed = raw.crop(bb.x, bb.y, bb.w, bb.h);
  const room = box * (1 - pad * 2);
  const k = Math.max(1, Math.min(maxScale, Math.floor(room / Math.max(bb.w + 2, bb.h + 2))));
  let big = trimmed.scaled(k);
  const framed = new Canvas(big.w + 4, big.h + 4);
  framed.draw(big, 2, 2);
  big = outline ? framed.outlined(outline) : framed;
  const out = new Canvas(box, box);
  out.draw(big, Math.round((box - big.w) / 2), Math.round((box - big.h) / 2));
  return out;
}

// --- Block textures -----------------------------------------------------------
//
// A block is 16x16 texels. Each kind is a function of (x, y, r) where r is a
// seeded random for this block, so two blocks of stone side by side are not
// the same stone.
const noise = (base, r, amount = 0.08) => shade(base, (r() - 0.5) * amount * 2);

export const BLOCKS = {
  stone: (x, y, r) => noise('#7d7d7d', r, 0.1),
  stonebrick: (x, y, r) => {
    const rowH = 8;
    const by = Math.floor(y / rowH);
    const off = by % 2 ? 8 : 0;
    const bx = (x + off) % 16;
    if (y % rowH === rowH - 1 || bx === 15) return '#4f4f4f';
    if (y % rowH === 0 || bx === 0) return noise('#9a9a9a', r, 0.05);
    return noise('#7e7e7e', r, 0.08);
  },
  mossbrick: (x, y, r) => {
    const base = BLOCKS.stonebrick(x, y, r);
    return r() < 0.22 && base !== '#4f4f4f' ? noise('#5d7d3a', r, 0.12) : base;
  },
  crackbrick: (x, y, r) => {
    const base = BLOCKS.stonebrick(x, y, r);
    return (x === y || x === y + 1) && x > 3 && x < 12 ? '#3e3e3e' : base;
  },
  deepslate: (x, y, r) => (y % 4 === 3 ? noise('#2c2c30', r, 0.08) : noise('#46464c', r, 0.1)),
  deepslatebrick: (x, y, r) => {
    const by = Math.floor(y / 4);
    const bx = (x + (by % 2 ? 4 : 0)) % 8;
    if (y % 4 === 3 || bx === 7) return '#232326';
    return noise('#4a4a52', r, 0.09);
  },
  cobble: (x, y, r) => {
    const v = Math.sin(x * 1.7 + y * 0.9) + Math.sin(y * 2.1 - x * 0.6);
    if (v > 1.3 || v < -1.5) return noise('#4a4a4a', r, 0.06);
    return noise(v > 0 ? '#8a8a8a' : '#6f6f6f', r, 0.1);
  },
  planks: (x, y, r) => {
    if (y % 4 === 3) return '#5a3f22';
    if ((x + Math.floor(y / 4) * 5) % 16 === 0) return '#6a4a28';
    return noise('#a07a48', r, 0.07);
  },
  darkplanks: (x, y, r) => {
    if (y % 4 === 3) return '#2a1c10';
    if ((x + Math.floor(y / 4) * 5) % 16 === 0) return '#33230f';
    return noise('#4e3820', r, 0.08);
  },
  grass: (x, y, r) => noise(r() < 0.12 ? '#6aa84a' : '#5a9a3c', r, 0.1),
  dirt: (x, y, r) => noise(r() < 0.15 ? '#6a4a30' : '#86603e', r, 0.1),
  path: (x, y, r) => noise(r() < 0.2 ? '#9a8050' : '#b49a64', r, 0.08),
  sand: (x, y, r) => noise('#dccf9a', r, 0.06),
  sandstone: (x, y, r) => (y % 8 === 7 ? '#b8a46e' : noise('#d8c890', r, 0.05)),
  mud: (x, y, r) => noise(r() < 0.2 ? '#3a3330' : '#4a4240', r, 0.1),
  water: (x, y, r) => {
    const wave = Math.sin((x + y * 0.5) * 0.8) > 0.85;
    return wave ? '#5a8ad8' : noise('#3466c4', r, 0.05);
  },
  murk: (x, y, r) => (Math.sin((x * 0.7 + y) * 0.9) > 0.9 ? '#4f7a64' : noise('#3a5a4c', r, 0.06)),
  prismarine: (x, y, r) => noise(r() < 0.3 ? '#5aa89a' : '#63b8a6', r, 0.1),
  prismbrick: (x, y, r) => (y % 8 === 7 || x % 8 === 7 ? '#3f7a70' : noise('#6ab8aa', r, 0.06)),
  darkprism: (x, y, r) => (y % 8 === 7 || x % 16 === 15 ? '#1c3a36' : noise('#33605a', r, 0.08)),
  sculk: (x, y, r) => (r() < 0.07 ? '#3ae0e8' : noise('#0f2a30', r, 0.15)),
  copper: (x, y, r) => (r() < 0.08 ? '#4fa38a' : noise('#c06a3a', r, 0.08)),
  cutcopper: (x, y, r) => {
    if (x % 8 === 0 || y % 8 === 0) return '#8e4524';
    return r() < 0.06 ? '#4fa38a' : noise('#c97848', r, 0.06);
  },
  tuff: (x, y, r) => noise(r() < 0.2 ? '#5a5a52' : '#6c6c62', r, 0.08),
  endstone: (x, y, r) => noise(r() < 0.18 ? '#cfcf94' : '#e0e0a8', r, 0.06),
  purpur: (x, y, r) => (x % 8 === 0 || y % 8 === 0 ? '#7a4a7a' : noise('#a678a6', r, 0.06)),
  obsidian: (x, y, r) => noise(r() < 0.1 ? '#3a2a5a' : '#140c1e', r, 0.2),
  netherbrick: (x, y, r) => {
    const by = Math.floor(y / 4);
    const bx = (x + (by % 2 ? 4 : 0)) % 8;
    if (y % 4 === 3 || bx === 7) return '#1a0a0c';
    return noise('#3e1a1e', r, 0.12);
  },
  magma: (x, y, r) => (r() < 0.12 ? '#ffb030' : noise('#6a1e0a', r, 0.18)),
  roofred: (x, y, r) => (y % 4 === 3 ? '#5a1e18' : noise('#8a2e24', r, 0.06)),
  roofblue: (x, y, r) => (y % 4 === 3 ? '#1e2e4a' : noise('#33496e', r, 0.06)),
  roofslate: (x, y, r) => (y % 4 === 3 ? '#2a2a30' : noise('#4a4a54', r, 0.06)),
  leaves: (x, y, r) => (r() < 0.15 ? '#2a5a1e' : noise(r() < 0.3 ? '#4a8a2e' : '#3a7a26', r, 0.1)),
  darkleaves: (x, y, r) => (r() < 0.2 ? '#1a3a12' : noise('#2a5a1e', r, 0.1)),
  lilypad: (x, y, r) => noise('#2e7a2a', r, 0.1),
  ice: (x, y, r) => noise(r() < 0.1 ? '#e8f4ff' : '#a8cff0', r, 0.05),
  snow: (x, y, r) => noise('#f4f8fc', r, 0.03),
  gold: (x, y, r) => ((x + y) % 7 === 0 ? '#fff6a0' : noise('#f0c419', r, 0.06)),
};

// A patch of blocks drawn edge to edge: `pick(bx, by)` names the block for
// each cell, `px` is screen pixels per texel.
export function blockField(cols, rows, pick, { px = 1, seed = 7 } = {}) {
  const c = new Canvas(cols * 16 * px, rows * 16 * px);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const kind = pick(bx, by);
      if (!kind) continue;
      const fn = BLOCKS[kind];
      const r = rng(seed * 7919 + bx * 131 + by * 977 + kind.length);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.rect((bx * 16 + x) * px, (by * 16 + y) * px, px, px, fn(x, y, r));
    }
  }
  return c;
}

export { Canvas, hex, mix, rng, shade };
