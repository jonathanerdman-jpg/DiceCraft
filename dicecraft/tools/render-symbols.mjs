// Rasterises the dice symbols to PNGs for the 3D dice.
//
// The physics library will only treat a face label as an image when the string
// ends in a real image extension — data URIs are rejected — so the symbols
// have to exist as files. They are generated from the same path data the flat
// dice use in js/data.js, so the two can never drift apart.
//
//   node tools/render-symbols.mjs        (needs playwright; dev-time only)
//
// Output is committed, so nobody needs to run this to play.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { SYMBOLS } from '../js/data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'dice');
const SIZE = 256;
// Each symbol is drawn in its own ink. The dice are bone; the mark is what
// carries the color, the same way the flat dice do it.
//
// Two cuts of every symbol, because the library draws a d4 differently from
// everything else. A cube, an octahedron and the rest take the image stretched
// across the whole face, so the margin has to be baked into the artwork. A d4
// instead draws three small marks near the corners of each face, already inset
// — margin baked in on top of that leaves a speck, so those get a tight crop.
const CUTS = [
  { dir: outDir, box: '-16 -16 56 56' },
  { dir: join(outDir, 'd4'), box: '-2 -2 28 28' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });

for (const cut of CUTS) {
  await mkdir(cut.dir, { recursive: true });
  for (const symbol of Object.values(SYMBOLS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${cut.box}">
      <path fill-rule="evenodd" shape-rendering="crispEdges" fill="#1a1020" stroke="#1a1020" stroke-width="1.1" stroke-linejoin="miter" d="${symbol.art}"/><path fill-rule="evenodd" shape-rendering="crispEdges" fill="${symbol.color}" d="${symbol.art}"/>
    </svg>`;
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg}</body>`,
      { waitUntil: 'load' },
    );
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(join(cut.dir, `${symbol.id}.png`), png);
    console.log(`${cut.dir.slice(root.length + 1)}/${symbol.id}.png  ${(png.length / 1024).toFixed(1)} KB`);
  }
}

await browser.close();
