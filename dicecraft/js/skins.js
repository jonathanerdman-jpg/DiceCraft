// Your character wears your Minecraft skin.
//
// The name you give your character is read as a Minecraft username, and the
// face on the map, on the character list and on your own card is that
// account's head, hat layer and all — the same head the server shows over
// you in the tab list. The pictures come from mc-heads.net, which renders
// any Java username's skin; nothing is sent there but the name.
//
// A page can be somewhere that service cannot reach — offline, or inside a
// sandbox that only loads its own files — and a name can be something no
// account is called. Neither leaves a hole. Every head is asked for once,
// in the background; until it has arrived, and for good if it never does,
// the character wears a blockhead drawn here from the name itself, so the
// same name always gets the same stand-in.
//
// Nothing here touches a roll. It is a picture of who is rolling.

export const SKIN_HOST = 'https://mc-heads.net';

// What Mojang allows in a Java username.
export const USERNAME = /^[A-Za-z0-9_]{3,16}$/;

export function isUsername(name) {
  return USERNAME.test(String(name || '').trim());
}

export function headUrl(name, size = 64) {
  return `${SKIN_HOST}/avatar/${encodeURIComponent(String(name).trim())}/${size}`;
}

export function bodyUrl(name, size = 240) {
  return `${SKIN_HOST}/body/${encodeURIComponent(String(name).trim())}/${size}`;
}

// url -> 'loading' | 'ok' | 'bad'
const states = new Map();
let listener = null;

// Called once a head that was being fetched arrives (or fails), so the screen
// can be drawn again with the real face on it.
export function onSkinChange(fn) {
  listener = fn;
}

function ready(url) {
  const state = states.get(url);
  if (state) return state === 'ok';
  if (typeof Image === 'undefined') { states.set(url, 'bad'); return false; }
  states.set(url, 'loading');
  const probe = new Image();
  probe.onload = () => { states.set(url, 'ok'); if (listener) listener(url); };
  probe.onerror = () => { states.set(url, 'bad'); if (listener) listener(url); };
  probe.referrerPolicy = 'no-referrer';
  probe.src = url;
  return false;
}

// --- The stand-in ---------------------------------------------------------
//
// An 8x8 face, the size of a real skin's, picked from the name: a skin tone,
// a hair color and cut, eye color. Drawn as an SVG of squares so it scales
// as crisply as the real thing.
const SKIN_TONES = ['#f2c7a5', '#e0a982', '#c68863', '#9d6b4a', '#6f4a33', '#f5d6b8'];
const HAIR = ['#3b2414', '#6b4423', '#c9a24a', '#1d1d1d', '#a33b1f', '#e8e2cf', '#4a6b8a', '#2e5c2e'];
const EYES = ['#3a5fcd', '#2e8b57', '#5a3a1a', '#6a3fa0', '#1a1a1a', '#2fb8a0'];
const CUTS = [
  ['HHHHHHHH', 'HHHHHHHH', 'H......H'],
  ['HHHHHHHH', 'HHHHHHHH', '........'],
  ['HHHHHHHH', 'HH....HH', 'H......H'],
  ['.HHHHHH.', 'HHHHHHHH', 'HH....HH'],
];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const drawn = new Map();

export function standInHead(name) {
  const key = String(name || '').trim().toLowerCase() || 'blockhead';
  if (drawn.has(key)) return drawn.get(key);
  const h = hash(key);
  const skin = SKIN_TONES[h % SKIN_TONES.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const eye = EYES[(h >>> 7) % EYES.length];
  const cut = CUTS[(h >>> 11) % CUTS.length];
  const rows = [
    ...cut,
    '........',
    '.WE..EW.',
    '...NN...',
    '..MMMM..',
    '........',
  ];
  const color = { H: hair, W: '#ffffff', E: eye, N: '#00000022', M: '#00000055' };
  let rects = `<rect width="8" height="8" fill="${skin}"/>`;
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (color[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color[c]}"/>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${rects}</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  drawn.set(key, url);
  return url;
}

// The face to draw for this name right now: the real head once it has
// loaded, the stand-in until then (and for a name that is not a username).
export function headFor(name, size = 64) {
  if (!isUsername(name)) return standInHead(name);
  const url = headUrl(name, size);
  return ready(url) ? url : standInHead(name);
}

// The whole figure, for the one place there is room for it. Null until it
// has loaded, so the caller can show the head instead.
export function bodyFor(name, size = 240) {
  if (!isUsername(name)) return null;
  const url = bodyUrl(name, size);
  return ready(url) ? url : null;
}
