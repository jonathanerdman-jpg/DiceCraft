// The art a place is shown with, and the ground a floor is laid on, are files.
// A typo in either is invisible in a unit test and very visible on the screen —
// an empty card, a blank sheet — so the check is that the file is there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESK, FLOORS, HAVEN_ZONES, SCENES, backdropUrl, groundUrl, havenUrl, sceneOf } from '../js/scenery.js';
import { PLACES, ZONES, havensOf } from '../js/world.js';
import { SETTINGS } from '../js/settings.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const onDisk = (url) => existsSync(join(root, url));

test('every scene the atlas names has a painting cut for it', () => {
  SCENES.forEach((scene) => {
    assert.ok(onDisk(`assets/world/scenes/${scene}.jpg`), `${scene} has no painting`);
  });
});

test('every place looks out over a scene that exists', () => {
  const havens = ZONES.flatMap((zone) => havensOf(zone));
  [...PLACES, ...havens].forEach((place) => {
    const scene = sceneOf(place);
    assert.ok(SCENES.includes(scene), `${place.id} looks out over nothing`);
    // A place that names a scene should get that scene, not the fallback.
    if (place.scene) {
      const asked = place.scene === 'deep' ? 'deepv' : place.scene;
      assert.equal(scene, asked, `${place.id} asked for ${place.scene} and got ${scene}`);
    }
  });
});

test('every floor is laid on ground that exists, under a view that exists', () => {
  const floors = new Set(Object.values(SETTINGS).map((s) => s.floor || 'stone'));
  floors.forEach((floor) => {
    assert.ok(FLOORS[floor], `${floor} has no ground named`);
    assert.ok(onDisk(groundUrl(floor)), `${groundUrl(floor)} is missing`);
    assert.ok(onDisk(backdropUrl(floor)), `${backdropUrl(floor)} is missing`);
  });
});

test('every country has a hall and a camp of its own, and a desk to read on', () => {
  ZONES.forEach((zone) => {
    assert.ok(HAVEN_ZONES.includes(zone.id), `${zone.id} is not in the haven list`);
    ['hall', 'camp'].forEach((kind) => {
      assert.ok(onDisk(havenUrl(kind, zone.id)), `${havenUrl(kind, zone.id)} is missing`);
    });
  });
  // A country the art does not know still gets a painting rather than a hole.
  assert.ok(onDisk(havenUrl('hall', 'nowhere')));
  assert.ok(onDisk(DESK), 'the desk is missing');
});
