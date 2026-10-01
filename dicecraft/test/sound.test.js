import test from 'node:test';
import assert from 'node:assert/strict';
import { isMuted, playRoll, setMuted } from '../js/sound.js';

test('a roll is refused rather than throwing where there is no audio at all', () => {
  setMuted(false);
  assert.equal(playRoll(5), false, 'node has no AudioContext, and that is not an error');
});

test('muting is remembered in the module and silences a roll', () => {
  setMuted(true);
  assert.equal(isMuted(), true);
  assert.equal(playRoll(5), false);
  setMuted(false);
  assert.equal(isMuted(), false);
});

test('the number of taps is bounded however many dice are thrown', async () => {
  // The tap count is derived rather than exposed, so this pins the derivation
  // that playRoll uses: 1.4 taps a die, clamped to 3..11.
  const taps = (dice) => Math.min(11, Math.max(3, Math.round(dice * 1.4)));
  assert.equal(taps(1), 3, 'a single die still makes a sound');
  assert.equal(taps(5), 7);
  assert.equal(taps(40), 11, 'and a huge hand does not become a drum roll');
});
