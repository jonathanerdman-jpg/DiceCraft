import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO_DIR, SCENES, ZONE_TRACKS, clamp, trackFor, urlFor } from '../js/music.js';
import { ZONES } from '../js/world.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('every scene the game can be in asks for a track', () => {
  ['select', 'camp', 'hall', 'strand', 'zone', 'floor', 'encounter', 'boss', 'won', 'lost']
    .forEach((scene) => {
      assert.ok(SCENES[scene], `${scene} has no room tone`);
      assert.ok(SCENES[scene].track, `${scene} names no track`);
      assert.ok(SCENES[scene].from, `${scene} does not say which track suits it`);
    });
});

test('a country can have its own air, and every country that names one is real', () => {
  Object.keys(ZONE_TRACKS).forEach((id) => {
    assert.ok(ZONES.some((z) => z.id === id), `${id} is not a country`);
  });
  assert.equal(trackFor('floor', { zone: 'mire' }), ZONE_TRACKS.mire);
  assert.equal(trackFor('zone', { zone: 'ironbacks' }), ZONE_TRACKS.ironbacks);
  assert.equal(trackFor('floor', { zone: 'nowhere' }), SCENES.floor.track, 'an unknown country still gets a floor');
  assert.equal(trackFor('floor'), SCENES.floor.track);
});

test('a boss room overrides whatever country it is in', () => {
  assert.equal(trackFor('encounter', { zone: 'mire', boss: true }), SCENES.boss.track);
  assert.equal(trackFor('encounter', { zone: 'mire' }), SCENES.encounter.track);
});

test('a scene nobody has written a tone for is silence rather than an error', () => {
  assert.equal(trackFor('nonsense'), null);
});

test('volume is a fraction, whatever it is handed', () => {
  assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(9), 1);
  assert.equal(clamp('nonsense'), 0.5, 'a broken save falls back to the middle');
});

test('a track is an ordinary file in the audio folder', () => {
  assert.equal(urlFor('camp'), `${AUDIO_DIR}/camp.mp3`);
  assert.ok(existsSync(join(root, AUDIO_DIR)), 'the folder exists even while it is empty');
});

test('the folder README names every track the game asks for', () => {
  const readme = readFileSync(join(root, AUDIO_DIR, 'README.md'), 'utf8');
  const wanted = new Set([...Object.values(SCENES).map((s) => s.track), ...Object.values(ZONE_TRACKS)]);
  wanted.forEach((track) => {
    assert.ok(readme.includes(`${track}.mp3`), `${track}.mp3 is not documented`);
  });
});
