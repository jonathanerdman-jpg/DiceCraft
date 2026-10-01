// Builds the game for Cloudflare: a copy of exactly what the page loads,
// in dist/, and nothing else.
//
//   node tools/build-pages.mjs [outDir]
//
// The repository carries the art packs the game's pictures were cut from —
// over two gigabytes of them — and Cloudflare takes at most 20,000 files of at most
// 25 MiB each. So this does not publish the repository; it publishes the page,
// its stylesheet and scripts, and the few folders the game actually reads at
// runtime. What the tools cut from the packs is committed, so no build step is
// needed beyond the copy.
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(root, 'dist'));

// Whole folders the page reads from.
const FOLDERS = ['css', 'js', 'assets/dice', 'assets/world'];
// Folders whose own files are read but whose subfolders are source packs.
const SHALLOW = ['assets/tiles'];
const FILES = ['index.html'];
const RUNTIME = /\.(png|jpe?g|webp|svg|mp3|ogg|json|js|css|html)$/i;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of FILES) await cp(join(root, file), join(out, file));
for (const folder of FOLDERS) {
  await cp(join(root, folder), join(out, folder), {
    recursive: true,
    filter: (src) => !/\/(README\.md|LICENSE[^/]*)$/i.test(src) || src.endsWith('.LICENSE'),
  });
}
for (const folder of SHALLOW) {
  await mkdir(join(out, folder), { recursive: true });
  for (const name of await readdir(join(root, folder))) {
    const src = join(root, folder, name);
    if ((await stat(src)).isFile() && RUNTIME.test(name)) await cp(src, join(out, folder, name));
  }
}

// Music is fetched by a tool and not committed; if it is here, it goes too.
try {
  const audio = join(root, 'assets/audio');
  for (const name of await readdir(audio)) {
    if (/\.(mp3|ogg)$/i.test(name)) {
      await mkdir(join(out, 'assets/audio'), { recursive: true });
      await cp(join(audio, name), join(out, 'assets/audio', name));
    }
  }
} catch { /* no music, which is the normal case */ }

// Say what went out, so a build log shows at a glance that it is the game and
// not the art packs.
let files = 0;
let bytes = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else { files += 1; bytes += (await stat(path)).size; }
  }
}
await walk(out);
console.log(`${out}  (${files} files, ${(bytes / 1048576).toFixed(1)} MB)`);
if (files > 20000) throw new Error('more files than Cloudflare will take');
