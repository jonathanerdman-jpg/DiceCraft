import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  CELL, COLS, DENIZENS, MIMIC, ROWS, SHEET, SIZES, WILD_TOKENS, cellOf, denizen, sizeOf,
} from '../js/bestiary.js';
import { SETTING_LIST } from '../js/settings.js';
import { SYMBOL_IDS } from '../js/dice.js';
import { WILD_COMPANIONS } from '../js/data.js';
import { HEADS } from '../tools/art/heads.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('every creature is a whole creature', () => {
  const ids = new Set();
  DENIZENS.forEach((mob) => {
    assert.ok(mob.id && mob.name, 'a creature has a name');
    assert.equal(ids.has(mob.id), false, `${mob.id} is listed twice`);
    ids.add(mob.id);
    assert.equal(mob.demands.length, 6, `${mob.id} should demand six symbols`);
    mob.demands.forEach((s) => assert.ok(SYMBOL_IDS.includes(s), `${mob.id} demands ${s}, which is not a symbol`));
    assert.ok(SIZES[mob.size], `${mob.id} is an unknown size`);
    assert.ok(HEADS[mob.id], `${mob.id} should have a head drawn for it in tools/art/heads.mjs`);
  });
  assert.throws(() => denizen('sasquatch'), /unknown denizen/);
});

test('the sheet holds every creature and nothing is off the edge of it', () => {
  // The layout is derived from the order of the list, which is the order the
  // sheet was cut in. If the two ever disagree the game draws a badger where
  // it means a lich, so the arithmetic is checked rather than trusted.
  assert.equal(ROWS, Math.ceil(DENIZENS.length / COLS));
  DENIZENS.forEach((mob, i) => {
    const at = cellOf(mob.id);
    assert.equal(at.col, i % COLS);
    assert.equal(at.row, Math.floor(i / COLS));
    assert.ok(at.col < COLS && at.row < ROWS, `${mob.id} sits off the sheet`);
  });
  const sheet = join(root, SHEET);
  assert.ok(existsSync(sheet), `${SHEET} has not been drawn — run tools/draw-blocks.mjs heads`);
  assert.ok(statSync(sheet).size > 50_000, 'and it should not be an empty square');
  assert.ok(CELL >= 64, 'a token drawn smaller than this is a smudge on the plan');
});

test('nothing on the sheet is dead weight, and nothing in the game is missing its picture', () => {
  const asked = new Set();
  SETTING_LIST.forEach((setting) => {
    setting.denizens.forEach((id) => asked.add(id));
    setting.bosses.forEach((lord) => asked.add(lord.mob));
  });
  asked.add(MIMIC);
  Object.values(WILD_TOKENS).forEach((id) => asked.add(id));
  asked.forEach((id) => assert.doesNotThrow(() => denizen(id), `${id} is asked for but has no token`));
  DENIZENS.forEach((mob) => assert.ok(asked.has(mob.id), `${mob.id} is on the sheet but lives nowhere`));
});

test('every creature you can take home has a face', () => {
  WILD_COMPANIONS.forEach((wild) => {
    assert.ok(WILD_TOKENS[wild.id], `${wild.id} can be found in a lair but has no token`);
    assert.doesNotThrow(() => denizen(WILD_TOKENS[wild.id]));
  });
});

test('a bigger thing is drawn bigger', () => {
  assert.ok(sizeOf('treant') > sizeOf('stirge'), 'a treant should not be the size of a stirge');
  assert.ok(sizeOf('ogre') > sizeOf('kobold'));
  Object.values(SIZES).forEach((s) => assert.ok(s > 0.2 && s < 0.9, 'and nothing fills its whole room'));
});
