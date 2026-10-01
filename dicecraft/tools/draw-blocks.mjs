// Draws every picture the game shows that is not a photograph: the creature
// heads, the kit, the map marks, the dungeon pieces, the ground and the props.
// All of it is original pixel art made here from small grids and block
// textures — nothing is cut from a pack — so the output is committed and
// nobody needs to run this to play.
//
//   node tools/draw-blocks.mjs            draws everything
//   node tools/draw-blocks.mjs heads kit  draws only those parts
//
// No dependencies: tools/art/canvas.mjs writes the PNGs itself.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, headCube, icon, shade } from './art/blocks.mjs';
import { FIXED, KIT, MATERIALS } from './art/kit.mjs';
import { HEADS } from './art/heads.mjs';
import { ICONS } from './art/icons.mjs';
import { PROPS, SCRUB } from './art/props.mjs';
import { drawPiece, wildGround } from './art/tiles.mjs';
import { blockField, rng } from './art/blocks.mjs';
import { SETS, WILDS } from '../js/tiles.js';
import { CELL, COLS, DENIZENS, ROWS, SHEET } from '../js/bestiary.js';
import { KIND_IDS, KIT_CELL, KIT_COLS, KIT_SHEET } from '../js/gear.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const want = process.argv.slice(2);
const doing = (part) => !want.length || want.includes(part);

const PARTS = {
  // Sixty-eight creatures, one sheet, in the order js/bestiary.js lists them.
  async heads() {
    const sheet = new Canvas(COLS * CELL, ROWS * CELL);
    DENIZENS.forEach((mob, i) => {
      const head = HEADS[mob.id];
      if (!head) throw new Error(`no head drawn for ${mob.id}`);
      const cube = headCube(head.face, head.pal, { size: 72 });
      const x = (i % COLS) * CELL + Math.round((CELL - cube.w) / 2);
      const y = Math.floor(i / COLS) * CELL + Math.round((CELL - cube.h) / 2);
      sheet.draw(cube, x, y);
    });
    sheet.save(join(root, SHEET));
    return SHEET;
  },

  // The kit sheet: a row per kind in the order js/gear.js declares them, a
  // column per grade, each on an inventory slot.
  async kit() {
    const sheet = new Canvas(KIT_COLS * KIT_CELL, KIND_IDS.length * KIT_CELL);
    KIND_IDS.forEach((kind, row) => {
      const rows = KIT[kind];
      if (!rows) throw new Error(`no sprite for ${kind}`);
      MATERIALS.forEach((mat, col) => {
        const x = col * KIT_CELL;
        const y = row * KIT_CELL;
        const slot = KIT_CELL - 8;
        sheet.rect(x + 4, y + 4, slot, slot, '#1b1430');
        sheet.rect(x + 4, y + 4, slot, 3, '#0d0918');
        sheet.rect(x + 4, y + 4, 3, slot, '#0d0918');
        sheet.rect(x + 4, y + KIT_CELL - 7, slot, 3, '#3a2f5a');
        sheet.rect(x + KIT_CELL - 7, y + 4, 3, slot, '#3a2f5a');
        const pal = { ...FIXED, m: mat.m, M: mat.M, d: mat.d };
        // Netherite is dark enough that its own outline vanishes; the
        // enchanted ones glint.
        if (mat.name === 'netherite') pal.k = '#100c0e';
        const art = icon(rows, pal, KIT_CELL - 14, { pad: 0.04, outline: '#05030a' });
        sheet.draw(art, x + 7, y + 7);
      });
    });
    sheet.save(join(root, KIT_SHEET));
    return KIT_SHEET;
  },

  // The map marks, one file each, named as js/world.js names them.
  async icons() {
    const out = [];
    Object.entries(ICONS).forEach(([name, { pal, rows }]) => {
      const w = Math.max(...rows.map((r) => r.length));
      const k = Math.max(4, Math.min(10, Math.floor(184 / Math.max(w, rows.length))));
      const raw = new Canvas(w * k + 8, rows.length * k + 8);
      const art = new Canvas(w, rows.length);
      art.sprite(rows, pal, 0, 0, 1);
      raw.draw(art.scaled(k), 4, 4);
      const file = `assets/world/${name}.png`;
      raw.outlined('#120a1ce0').save(join(root, file));
      out.push(file);
    });
    return out;
  },

  // Every dungeon piece every set names, at 320 pixels: 20 blocks of 16.
  async tiles() {
    const out = [];
    Object.entries(SETS).forEach(([set, pieces]) => {
      Object.entries(pieces).forEach(([name, piece]) => {
        const room = name === 'chamber' || Object.values(piece.sides).includes('open');
        piece.files.forEach((file, variant) => {
          const art = drawPiece(set, piece.sides, { room, variant, seed: 13 + variant * 101 + file.length * 7 });
          art.save(join(root, `assets/tiles/${file}.png`));
          out.push(file);
        });
      });
    });
    Object.entries(WILDS).forEach(([kind, wild]) => {
      wild.ground.forEach((file, i) => { wildGround(kind, i).save(join(root, `assets/tiles/${file}.png`)); out.push(file); });
      wild.scrub.forEach((file) => {
        const { pal, rows } = SCRUB[file];
        icon(rows, pal, 150, { pad: 0.08, outline: '#0c1408c0' }).save(join(root, `assets/tiles/${file}.png`));
        out.push(file);
      });
    });
    Object.entries(PROPS).forEach(([file, { pal, rows }]) => {
      icon(rows, pal, 200, { pad: 0.06, outline: '#0a0612' }).save(join(root, `assets/tiles/${file}.png`));
      out.push(file);
    });
    return out;
  },

  // The ground each floor is laid on, edge to edge under the plan: twelve
  // blocks of two-pixel texels.
  async floors() {
    const out = [];
    const roll = rng(4242);
    const floors = {
      floor_stone: () => (roll() < 0.12 ? 'cobble' : 'stone'),
      floor_sewer: () => (roll() < 0.2 ? 'prismarine' : 'darkprism'),
      floor_chase: () => (roll() < 0.3 ? 'path' : 'cobble'),
      floor_wood: () => (roll() < 0.1 ? 'path' : 'grass'),
      floor_fen: () => (roll() < 0.45 ? 'murk' : 'mud'),
    };
    Object.entries(floors).forEach(([file, pick]) => {
      const art = blockField(12, 12, pick, { px: 2, seed: file.length });
      art.save(join(root, `assets/tiles/${file}.png`));
      const avg = [0, 0, 0];
      for (let i = 0; i < art.data.length; i += 4) { avg[0] += art.data[i]; avg[1] += art.data[i + 1]; avg[2] += art.data[i + 2]; }
      const n = art.data.length / 4;
      out.push(`${file} ${'#'}${avg.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`);
    });
    console.log(out.join('\n'));
    return out;
  },
};

for (const [name, draw] of Object.entries(PARTS)) {
  if (!doing(name)) continue;
  const out = await draw();
  console.log(`${name}: ${Array.isArray(out) ? `${out.length} files` : out}`);
}
