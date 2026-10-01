import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/game.js';
import { SHARED_ACTIONS } from '../js/coop.js';

// The screens call the game by name, and a name that is not there fails
// silently behind a button: the Tower's "climb on" called a descend() that
// never existed, and nothing said so until somebody pressed it. Every call
// the UI makes has to land on something real.
const src = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');

function exists(name) {
  const game = new Game();
  for (let p = game; p; p = Object.getPrototypeOf(p)) {
    if (Object.getOwnPropertyDescriptor(p, name)) return true;
  }
  return false;
}

test('every game method a screen calls exists', () => {
  const called = new Set([...src.matchAll(/\bgame\.(\w+)\s*\(/g)].map((m) => m[1]));
  assert.ok(called.size > 20, 'the scan found the calls');
  called.forEach((name) => assert.ok(exists(name), `ui.js calls game.${name}(), which does not exist`));
});

test('every action a screen performs exists and can be shared', () => {
  const performed = new Set([...src.matchAll(/perform\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(performed.size > 5);
  performed.forEach((name) => {
    assert.ok(exists(name), `ui.js performs ${name}, which does not exist`);
    assert.ok(SHARED_ACTIONS.includes(name), `${name} is performed but a shared quest would refuse it`);
  });
});
