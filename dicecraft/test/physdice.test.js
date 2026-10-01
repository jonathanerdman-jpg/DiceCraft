import test from 'node:test';
import assert from 'node:assert/strict';
import { labelPlan, landedPoints, notationFor, seemsSupported, throwOrder, valuesFor } from '../js/physdice.js';
import { makeBasicDie, makePowerDie, SYMBOL_IDS } from '../js/dice.js';

test('each die is named on its own so values line up with the throw', () => {
  const dice = [makeBasicDie('a'), makePowerDie('a', 8, 'arcana'), makePowerDie('a', 4, 'might')];
  const faces = ['guard', 'arcana', 'might'];
  const plan = labelPlan(dice, faces);
  const [terms, values] = notationFor(dice, faces, plan).split('@');
  assert.equal(terms, '1d6+1d8+1d4', 'one term per die');
  assert.equal(values.split(',').length, dice.length);
});

// The bug this guards: the library folds equal terms of a notation into one
// set and spawns set by set, but hands out the values after the `@` by
// position. A hand whose presets interleave used to deal a face to the wrong
// die, and a die on the table landed showing a symbol that was nowhere in the
// tray.
test('dice are asked for in the order the library will throw them', () => {
  const dice = [
    makeBasicDie('a'), makeBasicDie('a'), makeBasicDie('a', { wild: true }),
    makeBasicDie('a'), makePowerDie('a', 12, 'arcana'),
  ];
  const faces = ['arcana', 'arcana', 'wild', 'guard', 'arcana'];
  const plan = labelPlan(dice, faces);
  const types = dice.map((die, i) => plan.groups[plan.assign[i]].type);
  assert.ok(new Set(types).size < types.length, 'this hand really does share presets');
  assert.notDeepEqual(types, [...types].sort(), 'and really does interleave them');

  const order = throwOrder(dice, plan);
  assert.deepEqual([...order].sort((x, y) => x - y), dice.map((_, i) => i), 'every die is thrown once');
  const thrown = order.map((i) => types[i]);
  thrown.forEach((type, place) => {
    assert.equal(thrown.indexOf(type), thrown.lastIndexOf(type) - (thrown.filter((t) => t === type).length - 1),
      'each preset is asked for in one unbroken run');
  });

  const [terms, values] = notationFor(dice, faces, plan).split('@');
  assert.deepEqual(terms.split('+'), thrown.map((t) => `1${t}`), 'the notation is written in that order');
  const asked = values.split(',').map(Number);
  const wanted = valuesFor(dice, faces, plan);
  order.forEach((die, place) => {
    assert.equal(asked[place], wanted[die], 'and every value goes with the die it belongs to');
    assert.equal(plan.groups[plan.assign[die]].labels[asked[place] - 1], faces[die]);
  });
});

test('where the dice came to rest is reported in tray order', () => {
  const dice = [makeBasicDie('a'), makeBasicDie('a', { wild: true }), makeBasicDie('a')];
  const faces = ['might', 'wild', 'guard'];
  const plan = labelPlan(dice, faces);
  const order = throwOrder(dice, plan);
  assert.notDeepEqual(order, [0, 1, 2], 'this hand is thrown out of tray order');

  // A stand-in for the library: three dice at known places, in throw order.
  const box = {
    camera: {},
    diceList: order.map((die) => ({
      position: { clone: () => ({ project: () => ({ x: die / 10, y: die / 10 }) }) },
    })),
  };
  global.document = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) };
  try {
    const points = landedPoints(box, '#stage', order);
    assert.equal(points.length, dice.length);
    points.forEach((point, die) => {
      assert.equal(Math.round(point.x), Math.round((die / 10) * 0.5 * 100 + 50), `die ${die} is gathered from its own place`);
    });
  } finally {
    delete global.document;
  }
});

// A die's group is the preset its faces were drawn on.
const labelsOf = (plan, i) => plan.groups[plan.assign[i]].labels;

test('a die lands on a side that really carries the symbol it rolled', () => {
  const dice = [makePowerDie('a', 12, 'nature'), makePowerDie('a', 12, 'nature')];
  const faces = ['nature', 'wild'];
  const plan = labelPlan(dice, faces);
  valuesFor(dice, faces, plan).forEach((value, i) => {
    assert.ok(value >= 1 && value <= 12, 'a legal side');
    assert.equal(labelsOf(plan, i)[value - 1], faces[i], 'and the side carries the rolled symbol');
  });
});

test('a physical die carries a whole face table, not copies of what it rolled', () => {
  [4, 6, 8, 10, 12].forEach((sides) => {
    const die = makePowerDie('a', sides, 'might');
    const plan = labelPlan([die], ['might']);
    const labels = labelsOf(plan, 0);
    assert.equal(labels.length, sides, `a d${sides} is drawn with d${sides} faces`);
    assert.deepEqual(labels, die.faces, 'and they are the faces the die really has');
    assert.ok(new Set(labels).size > 1, `a d${sides} shows more than one symbol`);
    assert.equal(labels[valuesFor([die], ['might'], plan)[0] - 1], 'might');
  });
});

test('dice with the same face table share one drawn die', () => {
  const dice = [makeBasicDie('a'), makeBasicDie('a'), makeBasicDie('a')];
  const faces = ['might', 'might', 'guard'];
  const plan = labelPlan(dice, faces);
  assert.equal(plan.groups.length, 1, 'one preset for three identical dice');
  assert.deepEqual(plan.groups[0].labels, makeBasicDie('a').faces, 'a plain die is all six symbols');
  const values = valuesFor(dice, faces, plan);
  assert.equal(values[0], values[1], 'two dice on the same symbol land on the same side');
  values.forEach((value, i) => assert.equal(labelsOf(plan, i)[value - 1], faces[i]));
});

test('a hand of seven symbols on six-sided dice is still thrown', () => {
  // The bug this guards: six symbols and a wild is seven, seven will not fit
  // on a d6, and the whole throw used to fall back to flat dice.
  const dice = [
    makeBasicDie('a'), makeBasicDie('a'), makeBasicDie('a'),
    makeBasicDie('a'), makeBasicDie('a'), makeBasicDie('a'),
    makeBasicDie('a', { wild: true }),
  ];
  const faces = ['might', 'guard', 'arcana', 'nature', 'cunning', 'faith', 'wild'];
  const plan = labelPlan(dice, faces);
  assert.ok(plan, 'the throw can be drawn');
  assert.ok(plan.groups.length > 1, 'across more than one six-sided preset');
  const types = plan.groups.map((g) => g.type);
  assert.equal(new Set(types).size, types.length, 'and no preset is asked to be two dice at once');
  valuesFor(dice, faces, plan).forEach((value, i) => {
    assert.equal(labelsOf(plan, i)[value - 1], faces[i], 'every die carries what it rolled');
  });
});

test('every symbol in the game fits on every die size', () => {
  // Seven symbols is the most there can ever be, and no size has fewer faces
  // to spread them over, so no hand can be undrawable.
  const symbols = [...SYMBOL_IDS, 'wild'];
  [4, 6, 8, 10, 12].forEach((sides) => {
    const dice = symbols.map((symbol) => (sides === 6 && symbol === 'wild'
      ? makeBasicDie('a', { wild: true })
      : makePowerDie('a', sides, symbol === 'wild' ? 'might' : symbol)));
    const faces = symbols.slice();
    const plan = labelPlan(dice, faces);
    assert.ok(plan, `seven symbols fit across the d${sides} presets`);
    valuesFor(dice, faces, plan).forEach((value, i) => {
      assert.equal(labelsOf(plan, i)[value - 1], faces[i]);
    });
  });
});

test('a symbol a die of that size actually rolled is struck onto the face table', () => {
  const dice = [makeBasicDie('a'), makeBasicDie('a', { wild: true })];
  const faces = ['guard', 'wild'];
  const plan = labelPlan(dice, faces);
  valuesFor(dice, faces, plan).forEach((value, i) => {
    assert.equal(labelsOf(plan, i)[value - 1], faces[i]);
  });
});

test('sizes are planned independently of one another', () => {
  const dice = [makePowerDie('a', 4, 'might'), makeBasicDie('a')];
  const faces = ['might', 'faith'];
  const plan = labelPlan(dice, faces);
  assert.equal(labelsOf(plan, 0).length, 4);
  assert.equal(labelsOf(plan, 1).length, 6);
  valuesFor(dice, faces, plan).forEach((value, i) => {
    assert.equal(labelsOf(plan, i)[value - 1], faces[i]);
  });
});

test('the notation names the preset each die was drawn on', () => {
  const dice = [makeBasicDie('a'), makePowerDie('a', 8, 'arcana')];
  const faces = ['guard', 'arcana'];
  const plan = labelPlan(dice, faces);
  const [terms, values] = notationFor(dice, faces, plan).split('@');
  assert.equal(terms.split('+').length, 2, 'one term per die');
  terms.split('+').forEach((term, i) => {
    assert.equal(term, `1${plan.groups[plan.assign[i]].type}`);
  });
  assert.equal(values.split(',').length, 2);
});

test('support is reported as false rather than throwing when there is no document', () => {
  assert.equal(typeof seemsSupported(), 'boolean');
  assert.equal(seemsSupported(), false, 'no DOM under node, so no WebGL');
});
