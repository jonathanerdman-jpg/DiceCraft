// The room tone.
//
// One scene at a time, crossfaded when the game moves somewhere else: the
// Strand has its weather, a country has its own, a floor has the air of
// whatever is under it, and a boss room has something worse.
//
// It comes from two places, in this order.
//
// A **file**, if one is there: `assets/audio/<track>.mp3`. That folder ships
// empty on purpose — the Tabletop Audio tracks the README names are theirs to
// hand out, not ours to re-host or hot-link — so this is the upgrade path for
// anyone who wants proper recorded ambience.
//
// Otherwise the page **makes it**: a few oscillators and a band of noise,
// shaped per scene into wind, water, a drone under stone, a drum. That is a
// couple of hundred lines against several hundred kilobytes a scene, it needs
// no network at all, and it means the game has a voice out of the box rather
// than silence and an instruction.
import { STORAGE } from './brand.js';

export const AUDIO_DIR = 'assets/audio';
const KEY = `${STORAGE}.music`;
const FADE_MS = 900;
const STEP_MS = 60;

// Every scene the game can be in, and the room tone it asks for. `from` names
// the Tabletop Audio track the folder's README suggests for it, which is
// documentation rather than a URL: nothing is fetched from their site.
export const SCENES = {
  select:   { track: 'hall',     from: 'Tavern Inn' },
  camp:     { track: 'camp',     from: 'Camping in the Woods' },
  hall:     { track: 'hall',     from: 'Tavern Inn' },
  strand:   { track: 'strand',   from: 'Ocean Waves / Sailing Ship' },
  zone:     { track: 'strand',   from: 'Ocean Waves / Sailing Ship' },
  floor:    { track: 'dungeon',  from: 'Dungeon II' },
  encounter:{ track: 'encounter',from: 'Battle Drums' },
  boss:     { track: 'boss',     from: 'Dragon Fight' },
  won:      { track: 'camp',     from: 'Camping in the Woods' },
  lost:     { track: 'dungeon',  from: 'Dungeon II' },
};

export const SOURCE = {
  name: 'Tabletop RPG Music',
  repo: 'https://github.com/Tabletop-RPG-Music/tabletop-rpg-music',
  dir: 'music',
  credit: 'https://www.patreon.com/tabletoprpgmusic',
};

export const PICKS = {
  strand: 'TheFirstVoyage',
  harbor: 'Dockside',
  downs: 'TheFrontier',
  swamp: 'DruidicSwamps',
  mountain: 'Kraghammer',
  arcane: 'WizardTower',
  camp: 'CampfireMemories',
  hall: 'YeOldeTavern',
  dungeon: 'DarkDungeon',
  encounter: 'BladesandBows',
  boss: 'TheBigBadEvilGuy',
};

// A country may ask for its own air instead of the plain dungeon one. Any id
// with no file behind it simply falls back to silence, so naming a track here
// costs nothing until somebody puts the file in.
export const ZONE_TRACKS = {
  reach: 'harbor',
  downs: 'downs',
  mire: 'swamp',
  ironbacks: 'mountain',
  spirelands: 'arcane',
};

export function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function urlFor(track) {
  return `${AUDIO_DIR}/${track}.mp3`;
}

// What a scene sounds like, given where in the world it is happening. This is
// the whole of the "it changes when you move" rule: a country has its own air,
// a boss room overrides whatever country it is in, and everything else takes
// the scene's own track.
export function trackFor(scene, { zone = null, boss = false } = {}) {
  if (boss) return SCENES.boss.track;
  if ((scene === 'floor' || scene === 'zone') && zone && ZONE_TRACKS[zone]) return ZONE_TRACKS[zone];
  const def = SCENES[scene];
  return def ? def.track : null;
}

// What the page makes when there is no file: a recipe per track.
//
//   drone   [hz, hz…]  sustained tones, quiet and detuned against each other
//   air     { hz, q, level, sway }  a band of noise — wind, water, a murmur
//   drops   { every, hz, level, spread }  sparse taps: drips, embers, a bell
//   pulse   { bpm, hz, level }  a drum, for when something is happening
const RECIPES = {
  strand:   { drone: [98, 147], air: { hz: 420, q: 0.7, level: 0.16, sway: 0.06 }, drops: null, pulse: null },
  harbor:  { drone: [110, 165], air: { hz: 380, q: 0.6, level: 0.17, sway: 0.05 }, drops: { every: 7, hz: 900, level: 0.05, spread: 3 }, pulse: null },
  downs:    { drone: [87, 131], air: { hz: 700, q: 1.1, level: 0.14, sway: 0.09 }, drops: null, pulse: null },
  swamp:    { drone: [73, 110], air: { hz: 300, q: 1.4, level: 0.11, sway: 0.04 }, drops: { every: 4, hz: 340, level: 0.06, spread: 2 }, pulse: null },
  mountain: { drone: [65, 98], air: { hz: 1100, q: 1.6, level: 0.12, sway: 0.13 }, drops: null, pulse: null },
  arcane:   { drone: [131, 196, 262], air: { hz: 2200, q: 3, level: 0.05, sway: 0.2 }, drops: { every: 6, hz: 1760, level: 0.05, spread: 4 }, pulse: null },
  camp:     { drone: [98, 123], air: { hz: 260, q: 1, level: 0.07, sway: 0.03 }, drops: { every: 2.2, hz: 1400, level: 0.035, spread: 1.4 }, pulse: null },
  hall:     { drone: [110, 138], air: { hz: 520, q: 0.9, level: 0.09, sway: 0.07 }, drops: { every: 3.5, hz: 700, level: 0.04, spread: 2 }, pulse: null },
  dungeon:  { drone: [55, 82], air: { hz: 220, q: 1.8, level: 0.09, sway: 0.05 }, drops: { every: 5, hz: 1200, level: 0.06, spread: 3 }, pulse: null },
  encounter:{ drone: [73, 110], air: { hz: 320, q: 1.2, level: 0.07, sway: 0.05 }, drops: null, pulse: { bpm: 92, hz: 70, level: 0.22 } },
  boss:     { drone: [49, 73, 104], air: { hz: 180, q: 1.4, level: 0.08, sway: 0.04 }, drops: null, pulse: { bpm: 116, hz: 52, level: 0.3 } },
};

export function recipeFor(track) {
  return RECIPES[track] || null;
}

const state = {
  on: false,
  volume: 0.5,
  scene: null,
  opts: {},
  track: null,
  element: null,
  fading: null,
  missing: new Set(),
  ac: null,
  voice: null,
  made: false,
  // The other way to have music: their site, open in a tab of its own, with
  // the game telling it where the party has got to.
};

function remember() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      on: state.on, volume: state.volume,
    }));
  } catch { /* private mode */ }
}

// Off unless something turns it on. The switch is not in Settings yet — the
// whole of this file is wired up and waiting rather than gone.
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      state.on = Boolean(saved.on);
      state.volume = clamp(saved.volume === undefined ? 0.5 : saved.volume);
    }
  } catch { /* private mode */ }
  return settings();
}

export function settings() {
  return {
    on: state.on,
    volume: state.volume,
    playing: state.track,
    made: state.made,
    missing: [...state.missing],
    // What is actually coming out of the page, when it is a recording.
    file: state.element && state.track ? `${state.track}.mp3` : null,
    from: state.element && state.track && PICKS[state.track] ? PICKS[state.track] : null,
  };
}

// --- The page's own voice ----------------------------------------------------

function audio() {
  if (state.ac) return state.ac;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    state.ac = new Ctor();
  } catch {
    return null;
  }
  return state.ac;
}

// Browsers will not make a sound until the player has touched the page, so the
// first gesture after music is switched on is what actually starts it.
export function wake() {
  const ac = state.ac;
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  if (state.on && state.scene && !state.voice && !state.element) {
    scene(state.scene, state.opts);
  }
}

function noiseBuffer(ac) {
  const frames = Math.ceil(ac.sampleRate * 2);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const channel = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    // Brown-ish noise: nearer weather than static.
    last = (last + Math.random() * 2 - 1) * 0.5;
    channel[i] = last;
  }
  return buffer;
}

function build(ac, recipe) {
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(ac.destination);
  const parts = [];

  (recipe.drone || []).forEach((hz, i) => {
    const osc = ac.createOscillator();
    osc.type = i ? 'sine' : 'triangle';
    osc.frequency.value = hz;
    osc.detune.value = i * 4 - 4;
    const gain = ac.createGain();
    gain.gain.value = 0.1 / (i + 1.4);
    // Nothing holds perfectly still: a slow wobble under everything.
    const sway = ac.createOscillator();
    sway.frequency.value = 0.05 + i * 0.017;
    const depth = ac.createGain();
    depth.gain.value = gain.gain.value * 0.35;
    sway.connect(depth).connect(gain.gain);
    osc.connect(gain).connect(out);
    osc.start();
    sway.start();
    parts.push(osc, sway);
  });

  if (recipe.air) {
    const source = ac.createBufferSource();
    source.buffer = noiseBuffer(ac);
    source.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = recipe.air.hz;
    band.Q.value = recipe.air.q;
    const gain = ac.createGain();
    gain.gain.value = recipe.air.level;
    const swell = ac.createOscillator();
    swell.frequency.value = recipe.air.sway;
    const depth = ac.createGain();
    depth.gain.value = recipe.air.level * 0.7;
    swell.connect(depth).connect(gain.gain);
    source.connect(band).connect(gain).connect(out);
    source.start();
    swell.start();
    parts.push(source, swell);
  }

  const timers = [];
  if (recipe.drops) {
    const { every, hz, level, spread } = recipe.drops;
    const drop = () => {
      const at = ac.currentTime + 0.01;
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz * (0.8 + Math.random() * 0.5), at);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.55, at + 0.22);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.34);
      timers.push(setTimeout(drop, (every + Math.random() * spread) * 1000));
    };
    timers.push(setTimeout(drop, 600 + Math.random() * 1200));
  }

  if (recipe.pulse) {
    const { bpm, hz, level } = recipe.pulse;
    const beat = () => {
      const at = ac.currentTime + 0.01;
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz * 1.6, at);
      osc.frequency.exponentialRampToValueAtTime(hz, at + 0.09);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.38);
      timers.push(setTimeout(beat, (60 / bpm) * 1000));
    };
    timers.push(setTimeout(beat, 200));
  }

  return { out, parts, timers };
}

function rampTo(gain, ac, to, seconds) {
  try {
    const now = ac.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(Math.max(0.0001, to), now + seconds);
  } catch { /* the graph is going away */ }
}

function stopVoice() {
  const voice = state.voice;
  state.voice = null;
  state.made = false;
  if (!voice) return;
  const ac = state.ac;
  voice.timers.forEach((t) => clearTimeout(t));
  if (!ac) return;
  rampTo(voice.out.gain, ac, 0.0001, FADE_MS / 1000);
  setTimeout(() => {
    voice.parts.forEach((part) => { try { part.stop(); } catch { /* already done */ } });
    try { voice.out.disconnect(); } catch { /* already gone */ }
  }, FADE_MS + 120);
}

function startVoice(track) {
  const recipe = recipeFor(track);
  if (!recipe) return false;
  const ac = audio();
  if (!ac) return false;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const voice = build(ac, recipe);
  rampTo(voice.out.gain, ac, state.volume * 0.9, FADE_MS / 1000);
  state.voice = voice;
  state.made = true;
  return true;
}

// --- A file, if there is one -------------------------------------------------

function fade(element, to, done) {
  if (state.fading) clearInterval(state.fading);
  const from = element.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let step = 0;
  state.fading = setInterval(() => {
    step++;
    const at = Math.min(1, step / steps);
    try { element.volume = clamp(from + (to - from) * at); } catch { /* detached */ }
    if (at >= 1) {
      clearInterval(state.fading);
      state.fading = null;
      if (done) done();
    }
  }, STEP_MS);
}

function stopFile() {
  const element = state.element;
  state.element = null;
  if (!element) return;
  fade(element, 0, () => { try { element.pause(); } catch { /* gone */ } });
}

// Tries the file first. If nothing answers for it — no such file, or a browser
// that will not play it — the page falls back to making the scene itself, so
// there is always something in the room.
function startFile(track, onFail) {
  if (typeof Audio === 'undefined') { onFail(); return; }
  const element = new Audio();
  element.loop = true;
  element.preload = 'auto';
  element.volume = 0;
  let gaveUp = false;
  const give = () => {
    if (gaveUp) return;
    gaveUp = true;
    state.missing.add(track);
    if (state.element === element) state.element = null;
    onFail();
  };
  element.addEventListener('error', give, { once: true });
  element.addEventListener('canplay', () => {
    if (gaveUp || state.element !== element) return;
    fade(element, state.volume);
  }, { once: true });
  element.src = urlFor(track);
  const played = element.play();
  if (played && typeof played.catch === 'function') played.catch(give);
  state.element = element;
}

// --- Moving the room tone ----------------------------------------------------

// Move the room tone to wherever the game now is. Calling this with the same
// scene twice does nothing, so it is safe to call on every render.
export function scene(name, opts = {}) {
  state.scene = name;
  state.opts = opts;
  const wanted = state.on ? trackFor(name, opts) : null;
  if (wanted === state.track && (state.element || state.voice)) return state.track;
  stopFile();
  stopVoice();
  state.track = wanted;
  if (!wanted) return null;
  if (state.missing.has(wanted)) {
    if (!startVoice(wanted)) state.track = null;
    return state.track;
  }
  startFile(wanted, () => {
    if (state.track === wanted && !startVoice(wanted)) state.track = null;
  });
  return state.track;
}

export function setOn(value) {
  state.on = Boolean(value);
  remember();
  if (!state.on) { stopFile(); stopVoice(); state.track = null; return state.on; }
  if (state.scene) scene(state.scene, state.opts);
  return state.on;
}

export function setVolume(value) {
  state.volume = clamp(value);
  remember();
  if (state.element && !state.fading) {
    try { state.element.volume = state.volume; } catch { /* detached */ }
  }
  if (state.voice && state.ac) rampTo(state.voice.out.gain, state.ac, state.volume * 0.9, 0.12);
  return state.volume;
}

// For the tests, and for a page being torn down.
export function silence() {
  if (state.fading) { clearInterval(state.fading); state.fading = null; }
  const element = state.element;
  state.element = null;
  stopVoice();
  state.track = null;
  state.scene = null;
  if (element) { try { element.pause(); } catch { /* gone */ } }
}
