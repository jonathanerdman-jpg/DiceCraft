import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor, optionsFor, exitsFor, PIECES, SETS, SET_NAMES } from '../js/tiles.js';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMap } from '../js/map.js';
import { DEPTHS } from '../js/settings.js';
import { createRng } from '../js/rng.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER_SIDES = ['n', 'e', 's', 'w'];

const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

function floors(count = 12) {
  const made = [];
  DEPTHS.forEach((depth) => {
    for (let seed = 0; seed < count; seed++) {
      const map = generateMap({ depth, rng: createRng(seed) });
      Object.values(map.tiles).forEach((tile) => { tile.state = 'seen'; });
      made.push(map);
    }
  });
  return made;
}

// Every side of every piece is declared, because a side nobody declared is a
// side nobody can check.
test('every piece says what each of its four sides is', () => {
  Object.entries(PIECES).forEach(([name, piece]) => {
    ['n', 'e', 's', 'w'].forEach((dir) => {
      assert.ok(['wall', 'door', 'open'].includes(piece.sides[dir]), `${name}.${dir}`);
    });
    // A side the piece opens onto is never a wall, and a wall is never a way out.
    const open = piece.open.toLowerCase();
    ['n', 'e', 's', 'w'].forEach((dir) => {
      const isWay = open.includes(dir);
      assert.equal(piece.sides[dir] !== 'wall', isWay, `${name}.${dir} disagrees with its own shape`);
    });
  });
});

test('a way out is never drawn as a wall, and a wall is never drawn as a way out', () => {
  floors().forEach((map) => {
    const { placed } = layoutFor(map);
    Object.values(map.tiles).forEach((tile) => {
      const spot = placed.get(tile.key);
      if (!spot || !spot.sides) return;          // a crossroads, laid as two pieces
      const exits = exitsFor(map, tile);
      ['n', 'e', 's', 'w'].forEach((dir) => {
        const wayOut = exits.includes(dir);
        assert.equal(spot.sides[dir] !== 'wall', wayOut,
          `${tile.key} is ${wayOut ? 'joined' : 'not joined'} to the ${dir} but drawn ${spot.sides[dir]}`);
      });
    });
  });
});

test('both sides of a join agree about being a join', () => {
  floors().forEach((map) => {
    const { placed } = layoutFor(map);
    Object.values(map.tiles).forEach((tile) => {
      tile.links.forEach((key) => {
        const other = map.tiles[key];
        const mine = placed.get(tile.key);
        const theirs = placed.get(key);
        if (!mine || !theirs || !mine.sides || !theirs.sides) return;
        const dir = other.y < tile.y ? 'n' : other.y > tile.y ? 's' : other.x > tile.x ? 'e' : 'w';
        assert.notEqual(mine.sides[dir], 'wall', 'a corridor may not end at a wall');
        assert.notEqual(theirs.sides[OPPOSITE[dir]], 'wall', 'nor arrive at one');
      });
    });
  });
});

test('the only join this tileset cannot make is a doorway meeting an open side', () => {
  // Counted rather than asserted away: it is the shape of the hole in the art,
  // and it is what an L-bend corridor piece would close.
  const kinds = new Set();
  floors().forEach((map) => {
    layoutFor(map).seams.forEach((seam) => kinds.add([seam.mine, seam.theirs].sort().join('/')));
  });
  assert.deepEqual([...kinds].sort(), ['door/open']);
});

test('a shape the tileset has no piece for still gets drawn', () => {
  // A crossroads: no single piece opens on all four sides, so it is two.
  assert.equal(optionsFor('nesw').length, 0);
  const map = {
    tiles: {
      '1,1': { key: '1,1', x: 1, y: 1, state: 'seen', links: ['1,0', '2,1', '1,2', '0,1'] },
      '1,0': { key: '1,0', x: 1, y: 0, state: 'seen', links: ['1,1'] },
      '2,1': { key: '2,1', x: 2, y: 1, state: 'seen', links: ['1,1'] },
      '1,2': { key: '1,2', x: 1, y: 2, state: 'seen', links: ['1,1'] },
      '0,1': { key: '0,1', x: 0, y: 1, state: 'seen', links: ['1,1'] },
    },
  };
  const { placed } = layoutFor(map);
  assert.equal(placed.get('1,1').stones.length, 2, 'laid back to back');
});

test('both floors can lay every shape a map asks of them', () => {
  for (const set of SET_NAMES) {
    for (const depth of DEPTHS) {
      for (let seed = 0; seed < 12; seed++) {
        const map = generateMap({ depth, rng: createRng(seed * 7 + depth.depth) });
        Object.values(map.tiles).forEach((t) => { t.state = 'seen'; });
        const { placed, seams } = layoutFor(map, { set });
        assert.equal(placed.size, Object.keys(map.tiles).length, `${set} left a cell unlaid`);
        [...placed.values()].forEach((spot) => {
          spot.stones.forEach((stone) => {
            assert.ok(stone.file, `${set} laid a cell with no art`);
            assert.ok(existsSync(join(root, 'assets', 'tiles', `${stone.file}.png`)), `${set}: no such tile ${stone.file}`);
          });
        });
        if (set === 'sewer') {
          assert.equal(seams.length, 0, 'the sewer set is all doors, so nothing should mismatch');
        }
      }
    }
  }
});

test('the sewer floor draws a crossroads the stone floor has to fake', () => {
  // Four exits: the stone set has no such piece and lays two junctions back
  // to back; the sewer set has a real one.
  const stone = optionsFor('nesw', 'stone');
  const sewer = optionsFor('nesw', 'sewer');
  assert.equal(stone.length, 0);
  assert.ok(sewer.length > 0);
  assert.ok(sewer.every((o) => ORDER_SIDES.every((d) => o.sides[d] === 'door')));
});
