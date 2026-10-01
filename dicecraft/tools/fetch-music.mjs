// Fills assets/audio from the Tabletop RPG Music library.
//
//   node tools/fetch-music.mjs            (needs git and a network)
//
// That library is a Foundry module of about 180 original tracks, free to use
// and kept going by its Patreon: https://www.patreon.com/tabletoprpgmusic.
// This fetches only the eleven the game asks for, one per scene, and writes
// them under the ids js/music.js looks for. It does not vendor them into the
// repository — assets/audio/*.mp3 is ignored by git on purpose. Whether you
// may pass those files on to anybody else is between you and their author;
// playing them on your own machine is what they are for.
//
// The whole library is worth a look if these choices are not yours:
//   https://github.com/Tabletop-RPG-Music/tabletop-rpg-music
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICKS, SOURCE } from '../js/music.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'audio');
mkdirSync(outDir, { recursive: true });

const work = mkdtempSync(join(tmpdir(), 'rpgmusic-'));
const git = (args, opts = {}) => execFileSync('git', args, { cwd: work, maxBuffer: 1 << 28, ...opts });

try {
  console.log(`fetching the catalog from ${SOURCE.repo}`);
  // Blobs are left on the server until asked for, so this is a few hundred
  // kilobytes rather than the whole library.
  execFileSync('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', SOURCE.repo, work], { stdio: 'inherit' });

  let total = 0;
  for (const [id, track] of Object.entries(PICKS)) {
    const bytes = git(['cat-file', 'blob', `HEAD:${SOURCE.dir}/${track}.mp3`]);
    writeFileSync(join(outDir, `${id}.mp3`), bytes);
    total += bytes.length;
    console.log(`${id}.mp3  ←  ${track}  (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  console.log(`\n${Object.keys(PICKS).length} tracks, ${(total / 1024 / 1024).toFixed(0)} MB. Music is on in Settings.`);
  console.log(`Credit where it is due: ${SOURCE.credit}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
