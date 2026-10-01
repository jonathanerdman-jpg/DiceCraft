// The optional 3D throw.
//
// This plays an animation of a roll that has *already happened*: the engine
// decides every face from the seeded generator, and the physics is merely told
// what to land on. Nothing here can change an outcome, which is what keeps
// floors reproducible and a shared quest in lockstep.
//
// Everything is lazy: the library is a 700KB module that is never fetched
// unless a player asks for physical dice. Any failure at all — no WebGL, a
// blocked import, a throw that never settles — resolves to a refusal, and the
// caller falls back to the CSS throw.

import { SYMBOLS } from './data.js';

const SETTLE_TIMEOUT = 12000;

let loader = null;
let box = null;

export function seemsSupported() {
  try {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Bone dice carrying this game's own symbols. The library letters faces with
// numbers by default, which is a claim these dice never make; it will take an
// image instead, but only when the label is a string ending in a real image
// extension, so the symbols are shipped as files (see tools/render-symbols).
const BONE = '#e0d0aa';
const SYMBOL_ART = 'assets/dice/';

// A d4 is lettered at the corners rather than across the face: the library
// insets each mark and draws it small, so the same artwork that reads well on
// a cube comes out a speck on a tetrahedron. The d4 set is cut tight to make
// up the difference.
export function artFor(sides, symbol) {
  return sides === 4 ? `${SYMBOL_ART}d4/${symbol}.png` : `${SYMBOL_ART}${symbol}.png`;
}

// Bone dice throughout. The color is in the symbols, which are images
// already drawn in their own ink, so nothing here needs to know about them.
function colorset() {
  return {
    name: 'bone',
    description: 'Bone, marked in ink',
    category: 'Delving Dice',
    foreground: '#2b2011',
    background: [BONE],
    outline: 'none',
    texture: 'paper',
  };
}

// Every die in a throw carries its own face table, but the library holds one
// set of faces per die *preset*, not per die. It ships several presets of the
// same shape — a six-sided die numbered, pipped, emoji'd, and as poker cards —
// which are identical geometry with independent labels, so a throw can use as
// many face tables per size as it has presets to put them on.
//
// This is what keeps the throw from ever failing to be drawable. Six symbols
// and a wild make seven, and seven will not fit on a d6: a hand holding a wild
// plain die used to land on all seven often enough to be common, and the whole
// throw fell back to flat dice. Four six-sided presets hold twenty-four.
const PRESETS = {
  4: ['d4', 'dsuit'],
  6: ['d6', 'dpip', 'dsex', 'dpoker'],
  8: ['d8', 'dspanpoker'],
  10: ['d10'],
  12: ['d12'],
};

// The faces one preset will carry: a real face table of a die in the group —
// so a d8 of Might shows its five Mights, its wild and its two strays — with
// any symbol the group actually rolled struck over a repeated face, so every
// die has a side that carries what it landed on.
function facesFor(sides, bucket) {
  const labels = bucket.entries[0].die.faces.slice(0, sides);
  while (labels.length < sides) labels.push(bucket.landed[0]);
  const needed = new Set(bucket.landed);

  bucket.landed.filter((face) => !labels.includes(face)).forEach((face) => {
    const tally = new Map();
    labels.forEach((l) => tally.set(l, (tally.get(l) || 0) + 1));
    // Spare first: a face nothing landed on, then the most repeated one.
    let pick = -1;
    let score = -1;
    labels.forEach((l, i) => {
      if (tally.get(l) > 1 || !needed.has(l)) {
        const value = (needed.has(l) ? 0 : 100) + tally.get(l);
        if (value > score) { score = value; pick = i; }
      }
    });
    if (pick >= 0) labels[pick] = face;
  });

  return bucket.landed.every((face) => labels.includes(face)) ? labels : null;
}

export function labelPlan(dice, faces) {
  const bySize = new Map();
  dice.forEach((die, index) => {
    if (!bySize.has(die.sides)) bySize.set(die.sides, []);
    bySize.get(die.sides).push({ die, face: faces[index], index });
  });

  const groups = [];
  const assign = new Array(dice.length);
  for (const [sides, entries] of bySize) {
    const types = PRESETS[sides];
    if (!types) return null;

    // One bucket per face table, merged down if a size ever holds more tables
    // than there are presets to draw them on.
    const buckets = [];
    entries.forEach((entry) => {
      const key = entry.die.faces.join(',');
      let bucket = buckets.find((b) => b.key === key);
      if (!bucket) { bucket = { key, entries: [], landed: [] }; buckets.push(bucket); }
      bucket.entries.push(entry);
      if (!bucket.landed.includes(entry.face)) bucket.landed.push(entry.face);
    });
    while (buckets.length > types.length) {
      buckets.sort((a, b) => a.entries.length - b.entries.length);
      const [a, b] = buckets.splice(0, 2);
      buckets.push({
        key: a.key,
        entries: [...a.entries, ...b.entries],
        landed: [...new Set([...a.landed, ...b.landed])],
      });
    }

    for (let i = 0; i < buckets.length; i++) {
      const labels = facesFor(sides, buckets[i]);
      if (!labels) return null;
      groups.push({ type: types[i], sides, labels });
      buckets[i].entries.forEach((entry) => { assign[entry.index] = groups.length - 1; });
    }
  }
  return { groups, assign };
}

export function valuesFor(dice, faces, plan) {
  return dice.map((die, i) => plan.groups[plan.assign[i]].labels.indexOf(faces[i]) + 1);
}

// Labels load as images, asynchronously and without a promise, so this waits
// for the preset to actually carry them before anything is thrown.
async function applyLabels(box, plan) {
  const presets = [];
  for (const group of plan.groups) {
    const preset = box.DiceFactory.get(group.type);
    preset.labels = [];
    preset.setLabels(group.labels.map((symbol) => artFor(group.sides, symbol)));
    presets.push(preset);
  }
  box.DiceFactory.materials_cache = {};
  for (let waited = 0; waited < 2000; waited += 25) {
    if (presets.every((preset) => preset.labels.length)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

async function build(selector) {
  const module = await import('./vendor/dice-box-threejs.es.js');
  const DiceBox = module.default || module.DiceBox;
  if (typeof DiceBox !== 'function') throw new Error('dice-box did not load');
  const made = new DiceBox(selector, {
    sounds: false,
    shadows: true,
    theme_material: 'none',
    theme_customColorset: colorset(),
    gravity_multiplier: 900,
    light_intensity: 0.85,
    baseScale: 90,
    strength: 1.1,
  });
  await made.initialize();
  return made;
}

export async function prepare(selector) {
  if (box) return box;
  if (!loader) loader = build(selector).catch((err) => { loader = null; throw err; });
  box = await loader;
  return box;
}

// The order the dice actually reach the table.
//
// A notation is not a list, it is a set of sets: the library folds equal terms
// together — `1d6+1d6+1dpip+1d6` becomes three d6 and then a dpip — and spawns
// them set by set, while the predetermined values after the `@` are handed out
// by position. Writing a term per die in tray order therefore deals the wrong
// face to any hand whose presets interleave, and the die on the table lands
// showing a symbol that is nowhere in the tray. So the dice are grouped by
// preset here, first appearance first, and everything else is written in that
// order too.
export function throwOrder(dice, plan) {
  const order = [];
  dice.forEach((die, i) => {
    const type = plan.groups[plan.assign[i]].type;
    if (order.some((j) => plan.groups[plan.assign[j]].type === type)) return;
    dice.forEach((other, j) => {
      if (plan.groups[plan.assign[j]].type === type) order.push(j);
    });
  });
  return order;
}

export function notationFor(dice, faces, plan, order = throwOrder(dice, plan)) {
  const values = valuesFor(dice, faces, plan);
  const terms = order.map((i) => `1${plan.groups[plan.assign[i]].type}`).join('+');
  return `${terms}@${order.map((i) => values[i]).join(',')}`;
}

// Where each die came to rest, in page coordinates, so the flat dice can be
// slid in from exactly there. The answer is given back in tray order, which is
// not the order they were thrown in — see throwOrder. Anything unexpected in
// the library's internals gives back nothing rather than throwing: the gather
// is a flourish, and the throw must not fail for want of it.
export function landedPoints(box, selector, order = null) {
  try {
    const stage = document.querySelector(selector);
    if (!stage || !box.camera || !Array.isArray(box.diceList)) return [];
    const rect = stage.getBoundingClientRect();
    const thrown = box.diceList.map((entry) => {
      const mesh = entry.mesh || entry;
      const projected = mesh.position.clone().project(box.camera);
      return {
        x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      };
    });
    if (!order) return thrown;
    const inTrayOrder = [];
    order.forEach((die, place) => { inTrayOrder[die] = thrown[place]; });
    return inTrayOrder.length === thrown.length && inTrayOrder.every(Boolean) ? inTrayOrder : thrown;
  } catch {
    return [];
  }
}

// The stage can move and change shape between throws — it is put wherever the
// encounter panel is — and the world's walls are built from the container, so
// they have to be rebuilt when it does. The library only does this on a window
// resize of its own accord.
function fit(box, selector) {
  try {
    const stage = document.querySelector(selector);
    const canvas = box.renderer && box.renderer.domElement;
    if (!stage || !canvas) return;
    if (canvas.width === stage.clientWidth && canvas.height === stage.clientHeight) return;
    box.setDimensions({ x: stage.clientWidth, y: stage.clientHeight });
  } catch { /* the throw is worth more than the fit */ }
}

// Plays the throw and reports what happened:
//   { started, fatal, points }
// `fatal` is true only when the physics cannot run here at all; one throw that
// goes wrong never turns the dice flat for the rest of the session.
// `started` says whether dice actually left the hand, which is the difference
// between a throw the player watched and one that never appeared — the caller
// needs to know, because a throw nobody saw is worth falling back from and a
// throw that merely could not be measured is not. `onThrow` fires at the
// moment the dice are thrown, so the sound and the sight agree; everything
// before it (fetching a 700KB library, striking the faces) is dead air.
export async function play(selector, dice, faces, onThrow) {
  let started = false;
  if (!dice.length) return { started, fatal: false, points: null };
  if (!seemsSupported()) return { started, fatal: true, points: null };
  const plan = labelPlan(dice, faces);
  if (!plan) return { started, fatal: false, points: null };
  let rolling;
  try {
    rolling = await prepare(selector);
  } catch {
    // The library itself could not be fetched or built. Nothing will fix that
    // this session, and only this counts as the physics being unavailable.
    return { started, fatal: true, points: null };
  }
  try {
    if (!(await applyLabels(rolling, plan))) return { started, fatal: false, points: null };
    fit(rolling, selector);
    started = true;
    if (onThrow) onThrow();
    const order = throwOrder(dice, plan);
    const settled = rolling.roll(notationFor(dice, faces, plan, order));
    await Promise.race([
      settled,
      new Promise((_, reject) => setTimeout(() => reject(new Error('the dice never settled')), SETTLE_TIMEOUT)),
    ]);
    return { started, fatal: false, points: landedPoints(rolling, selector, order) };
  } catch {
    return { started, fatal: false, points: null };
  }
}

export function forget() {
  box = null;
  loader = null;
}
