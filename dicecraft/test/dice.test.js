import test from 'node:test';
import assert from 'node:assert/strict';
import { powerDieFaces, basicDieFaces, dieOdds, makePowerDie, WILD } from '../js/dice.js';

test('a basic die carries every symbol exactly once', () => {
  const faces = basicDieFaces();
  assert.equal(faces.length, 6);
  assert.equal(new Set(faces).size, 6);
});

test('power dice have the right number of faces', () => {
  for (const sides of [4, 6, 8, 10, 12]) {
    assert.equal(powerDieFaces(sides, 'might').length, sides);
  }
});

test('bigger power dice are strictly better at their proficiency', () => {
  let previous = 0;
  for (const sides of [4, 6, 8, 10, 12]) {
    const faces = powerDieFaces(sides, 'arcana');
    const rate = faces.filter((f) => f === 'arcana' || f === WILD).length / sides;
    assert.ok(rate > previous, `d${sides} should beat the smaller die`);
    previous = rate;
  }
});

test('every power die keeps two off-proficiency faces', () => {
  for (const sides of [4, 6, 8, 10, 12]) {
    const faces = powerDieFaces(sides, 'faith');
    const others = faces.filter((f) => f !== 'faith' && f !== WILD);
    assert.equal(others.length, 2);
  }
});

test('only d8 and larger carry a wild face', () => {
  assert.equal(powerDieFaces(4, 'guard').includes(WILD), false);
  assert.equal(powerDieFaces(6, 'guard').includes(WILD), false);
  assert.equal(powerDieFaces(8, 'guard').filter((f) => f === WILD).length, 1);
  assert.equal(powerDieFaces(12, 'guard').filter((f) => f === WILD).length, 1);
});

test('unsupported die sizes are rejected', () => {
  assert.throws(() => powerDieFaces(20, 'might'), /unsupported/);
});

test('dieOdds counts wild faces as hits', () => {
  const die = makePowerDie('x', 12, 'nature');
  assert.ok(dieOdds(die, ['nature']) > dieOdds(die, ['might']));
  assert.ok(dieOdds(die, ['might']) > 0);
});
