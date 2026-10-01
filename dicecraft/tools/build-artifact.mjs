// Packages the game for a claude.ai Artifact, whose pages are wrapped in
// their own <!doctype>/<head>/<body> skeleton at publish time. So: lift the
// body out of index.html, inline the stylesheet (one less file to go missing),
// and leave js/ to be published alongside as module files.
//
//   node tools/build-artifact.mjs [outDir]
//
// The JS is untouched, so the deployed page and a local `http-server` run are
// the same game.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] || join(root, 'build', 'artifact'));

const html = await readFile(join(root, 'index.html'), 'utf8');
const css = await readFile(join(root, 'css', 'styles.css'), 'utf8');

const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!body) throw new Error('index.html has no <body> to lift');

// Google Fonts is the one stylesheet host an Artifact's CSP admits, so those
// <link> tags come across; every other stylesheet is inlined below.
const fontLinks = (html.match(/<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi) || []).join('\n');

const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, 'Dice Game'])[1].trim();

const page = `<title>${title}</title>
${fontLinks}
<style>
${css.trim()}
</style>
${body[1].trim()}
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'index.html'), page, 'utf8');
console.log(`${join(outDir, 'index.html')}  (${(page.length / 1024).toFixed(1)} KB, title "${title}")`);
