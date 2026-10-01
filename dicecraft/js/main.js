import { TAGLINE, TITLE } from './brand.js';
import { Game, saveKeyFor } from './game.js';
import { createUi } from './ui.js';

// ?p=2 or #2 opens a second character in this browser, which is how two
// people share a quest from two tabs.
// #2 opens the second character directly. A #code= address is not that: it is
// a character arriving from another device, and the UI answers it.
const hash = location.hash.replace('#', '');
const profile = new URLSearchParams(location.search).get('p')
  || (hash.startsWith('code=') ? '' : hash)
  || '1';
const saveKey = saveKeyFor(profile);

const game = Game.load(localStorage, saveKey) || new Game(null, { saveKey });
const ui = createUi(game, document.body);

// One place decides what the game is called.
document.title = TITLE;
document.querySelector('.brand h1').textContent = TITLE;
document.querySelector('.tagline').textContent = TAGLINE;

ui.render();
game.save();

// Handy in the console for poking at a run.
globalThis.dice = game;
