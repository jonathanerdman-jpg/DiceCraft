import {
  HUNGER_LEAVES, MAX_RANK, MAX_STAMINA, PLAIN_DIE_ART, RARITIES, RECRUIT_COST,
  REST_PER_COMPANION, SEALS, SYMBOLS, SYMBOL_ORDER, companionDef,
} from './data.js';
import { DEPTHS, demandOf, floorOf, settingDef } from './settings.js';
import {
  ART_DIR, HEX, PLACES, REGION, SERPENT, SHIP, STRAND, ZONES, artFor,
  atlasExtent, atlasHexes, depthOf, havensOf, hexCenter, hexPoints, isOpen,
  openPlaces, placeById, placesIn, settingsOf, tierOf, towerOf, zoneById,
} from './world.js';
import {
  ABILITIES, CLASS_LIST, PATH_LEVEL, abilityLeft, abilityMax, chosenPath, grantsEarned,
  heroAbility, heroDice, heroLoadout, pathSteps, pathsFor, stepUp,
} from './hero.js';
import { WILD, makePowerDie } from './dice.js';
import {
  ALONE_DICE, Game, PARTY_PER_ROOM, SAVE_KEY, assembleDice, canAfford, companionDice, companionHand,
  forgetProfile, listProfiles, newGameState, nextProfileId, saveKeyFor, woundedDice,
} from './game.js';
import { dieOdds } from './dice.js';
import { costToMaster, trainingCost } from './training.js';
import { defaultLook } from './looks.js';
import {
  KIT_COLS, KIT_ROWS, KIT_SHEET, SLOTS, boonOf, canCarry, describe as describeGear,
  durabilityOf, giftOf, isBroken, kindOf, kitCell, nameOf as gearName, priceOf, repairCost,
  slotDef, socketCount, tierDef,
} from './gear.js';
import { TOWER, TOWER_STAMINA, ordinal, towerDepth } from './tower.js';
import {
  COSTS as HAZARD_COSTS, HAZARD_KINDS, TRINKETS, TRINKET_IDS, hazardDef, hazardVisible,
} from './hazards.js';
import { STORAGE } from './brand.js';
import { bodyFor, headFor, isUsername, onSkinChange } from './skins.js';
import { DESK, SCENE_DIR, TOME, backdropUrl, groundUrl, havenUrl, sceneOf, tintOf } from './scenery.js';
import { play as playThrow, seemsSupported } from './physdice.js';
import { isMuted, playRoll, setMuted } from './sound.js';
import * as music from './music.js';

const SOUND_KEY = `${STORAGE}.muted`;
const CHOICE_KEY = `${STORAGE}.settings`;

// What the player has decided about how the game behaves. Everything here is
// a preference, never a rule: the game plays the same whatever is set.
const CHOICES = {
  physical: { label: 'Physical dice', hint: 'Real dice thrown under physics. Off draws them flat instead.', value: true },
  gather: { label: 'Gather the dice into the tray', hint: 'The flourish where the dice slide from where they landed.', value: true },
};

function loadChoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(CHOICES).forEach((id) => {
        if (typeof saved[id] === 'boolean') CHOICES[id].value = saved[id];
      });
    }
  } catch { /* private mode */ }
}

function saveChoices() {
  try {
    const body = {};
    Object.entries(CHOICES).forEach(([id, c]) => { body[id] = c.value; });
    localStorage.setItem(CHOICE_KEY, JSON.stringify(body));
  } catch { /* private mode */ }
}

export function chose(id) {
  return CHOICES[id] ? CHOICES[id].value : false;
}

function storedMute() {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}

export function applySound() {
  setMuted(storedMute());
  loadChoices();
  music.loadSettings();
}

function toggleSound() {
  const next = !isMuted();
  setMuted(next);
  try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* private mode */ }
}

// A click landing this soon after the screen changed was aimed at whatever
// used to be under the pointer, not at what is there now. It only guards the
// way out of a floor, which is the one click that cannot be taken back.
const CLICK_THROUGH_MS = 400;
// The width at which the layout becomes the phone one, kept in step with the
// media queries in css/styles.css.
const PHONE_WIDTH = 620;

function systemWantsCalm() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// The dice are real dice. There is nothing to choose and nothing to set: the
// only reasons they are ever drawn instead are a browser with no WebGL to
// draw them in, a system asking for reduced motion, and a throw that could
// not get off the ground once — after which this stops trying for the rest
// of the session rather than making every roll wait to fail again.
let physicsRefused = false;

function throwsRealDice() {
  return chose('physical') && !physicsRefused && !systemWantsCalm() && seemsSupported();
}
import {
  BroadcastChannelTransport, Session, WebSocketTransport, questCode, relayAvailable, relayUrl,
} from './coop.js';
import { TILE_DIR, isWildSet, layoutFor, wildFor } from './tiles.js';
import { named } from './engine.js';
import {
  CELL as MOBCELL, COLS as MOBCOLS, ROWS as MOBROWS, SHEET as MOBSHEET, cellOf, sizeOf,
} from './bestiary.js';
import { fromCode, toCode } from './travel.js';
import { codeFromAddress, qrSvg, readCode, shareTarget } from './qr.js';

// "the ghoul" at the head of a sentence is still "The ghoul".
const upper = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A stable 0..1 from a string. Every die tumbles differently, but the same
// die on the same face tumbles the same way — so a redraw does not reshuffle
// the animation, and two peers of a shared quest watch the same throw.
function hashUnit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// How this particular die falls: which way it spins, how long it is in the
// air, how far it drops and when it is thrown.
function tumbleStyle(die, face, index) {
  const a = hashUnit(`${die.id}:${face || ''}:a`);
  const b = hashUnit(`${die.id}:${face || ''}:b`);
  const c = hashUnit(`${die.id}:${face || ''}:c`);
  const sign = (n) => (n < 0.5 ? -1 : 1);
  return [
    `--sx:${sign(a) * (200 + Math.round(a * 340))}deg`,
    `--sy:${sign(b) * (200 + Math.round(b * 340))}deg`,
    `--sz:${sign(c) * (160 + Math.round(c * 280))}deg`,
    `--dur:${460 + Math.round(a * 260)}ms`,
    `--drop:${-20 - Math.round(b * 16)}px`,
    `--delay:${Math.round(index * 52 + c * 60)}ms`,
  ].join(';');
}

// --- Icons -------------------------------------------------------------------

// What a room is marked with on the floor plan. Not the period engravings any
// more — those are the region map's language, and on a painted floor a little
// pen-drawn church reads as a map symbol lying on the ground rather than as
// something in the room. The plan shows the packs' own furniture and the
// creature tokens instead: a chest is a chest, and what is waiting for you is
// a thing with a face.
const TILE_PROP = {
  entrance: 'prop_stair',
  shrine: 'prop_altar',
};

// What is standing in a room is decided when the floor is built, and the plan
// does not say. A room with something in it is marked as a room with
// something in it — a pair of eyes in the dark, larger and redder for the
// thing at the end of the floor — and what it actually is waits for you in
// the doorway. You choose where to go knowing that something is there, never
// what.
//
// A hoard is always drawn as a chest, before and after, because from the
// doorway that is all anybody can say about it. A trap is not drawn at all
// until it has gone off; a hazard or an obstacle is plain to see.
function tileArt(tile) {
  if (TILE_PROP[tile.kind]) return { prop: TILE_PROP[tile.kind], size: 0.5 };
  if (tile.kind === 'treasure') return { prop: 'prop_chest', size: 0.5, spent: tile.state === 'cleared' };
  if (tile.kind === 'boss' && tile.state === 'cleared') return { prop: 'prop_hoard', size: 0.54 };
  if (tile.kind === 'passage') {
    if (tile.hazard && tile.state !== 'cleared' && (hazardVisible(tile) || tile.scried)) {
      return { glyph: hazardDef(tile.hazard.id).kind, size: 0.4 };
    }
    return tile.prop ? { prop: tile.prop, size: 0.34 } : null;
  }
  if (tile.state === 'cleared' || !tile.mob) return null;
  // Looked into through the Pirate Spyglass: the thing itself, not its eyes.
  if (tile.scried) return { mob: tile.mob, size: sizeOf(tile.mob) * (tile.kind === 'boss' ? 1.18 : 1) };
  return { glyph: tile.kind === 'boss' ? 'dread' : 'lurk', size: tile.kind === 'boss' ? 0.5 : 0.4 };
}

// The marks the plan uses for things it will not show you, drawn rather than
// cut from a sheet: they are signs on a map, not things in a room. Each is
// drawn on a 100-unit square around its own center.
const GLYPHS = {
  lurk: `<circle class="g-disc" r="44"/>
    <path class="g-eye" d="M-28 -2q10-11 20 0q-10 7-20 0Z"/>
    <path class="g-eye" d="M8 -2q10-11 20 0q-10 7-20 0Z"/>`,
  dread: `<path class="g-horn" d="M-30 -30q-16-14-14-40q10 22 28 28Z"/>
    <path class="g-horn" d="M30 -30q16-14 14-40q-10 22-28 28Z"/>
    <circle class="g-disc dread" r="44"/>
    <path class="g-eye dread" d="M-32 -4q12-6 24 2q-12 8-24-2Z"/>
    <path class="g-eye dread" d="M8 -2q12-8 24-2q-12 12-24 2Z"/>
    <path class="g-maw" d="M-18 18l6 7 6-7 6 7 6-7 6 7 6-7"/>`,
  hazard: `<path class="g-warn" d="M0 -42L42 34H-42Z"/>
    <path class="g-mark" d="M0 -16V12"/><circle class="g-dot" cy="23" r="4.5"/>`,
  obstacle: `<rect class="g-plank" x="-40" y="-12" width="80" height="22" rx="3"/>
    <path class="g-stripe" d="M-30 10L-14 -12M-6 10L10 -12M18 10L34 -12"/>
    <path class="g-post" d="M-30 10V38M30 10V38M-30 -12V-30M30 -12V-30"/>`,
  trap: `<path class="g-jaw" d="M-40 6a40 30 0 0 0 80 0"/>
    <path class="g-jaw" d="M-40 -2a40 30 0 0 1 80 0"/>
    <path class="g-teeth" d="M-34 -2l6 10 6-10 6 10 6-10 6 10 6-10 6 10 6-10 6 10 6-10"/>`,
};

function glyphMark(kind, x, y, size) {
  const scale = size / 100;
  return `<g class="glyph glyph-${kind}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})">${GLYPHS[kind] || ''}</g>`;
}

// The same mark as a plate beside a heading, for a trap or a hazard: the
// thing you are up against when there is no creature to show.
function glyphPlate(kind, size = 72) {
  return `<svg class="plate glyphplate" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
    aria-hidden="true">${glyphMark(kind, size / 2, size / 2, size * 0.9)}</svg>`;
}

// What a tile is called when you hover it, which must not say more than the
// plan draws.
function tileWord(tile) {
  if (tile.kind === 'treasure') return tile.state === 'cleared' ? 'an emptied chest' : 'a chest';
  if (tile.kind === 'passage') {
    if (tile.hazard && tile.state !== 'cleared' && hazardVisible(tile)) return hazardDef(tile.hazard.id).name.toLowerCase();
    return 'a passage';
  }
  if (tile.kind === 'entrance') return 'the way in';
  if (tile.kind === 'shrine') return 'a beacon';
  if (tile.state === 'cleared') return 'a cleared room';
  if (tile.scried && tile.challenge) return `${tile.challenge.name}, seen through the glass`;
  return tile.kind === 'boss' ? 'something big is in there' : 'something is in there';
}

// Each die size gets its own silhouette so a d12 is recognisable at a glance.
const DIE_SHAPE = {
  4: '50,7 94,88 6,88',
  6: '12,12 88,12 88,88 12,88',
  8: '50,4 92,50 50,96 8,50',
  10: '50,3 94,36 77,92 23,92 6,36',
  12: '50,4 87,25 87,75 50,96 13,75 13,25',
};

function icon(symbolId) {
  const art = symbolId === 'plain' ? PLAIN_DIE_ART : (SYMBOLS[symbolId] || SYMBOLS.wild).art;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${art}"/></svg>`;
}

// A die is drawn as its own polyhedron silhouette with the rolled symbol
// floating inside it.
function dieMarkup(die, face, { mini = false, index = null, state = '', pressed = false, rolling = false, order = 0 } = {}) {
  // Unrolled dice show what they are good at; a plain die shows a blank face.
  const shown = face || die.proficiency || 'plain';
  const color = SYMBOLS[shown] ? SYMBOLS[shown].color : '#8b97a8';
  const art = shown === 'plain' ? PLAIN_DIE_ART : (SYMBOLS[shown] || SYMBOLS.wild).art;
  const tag = index === null ? 'div' : 'button';
  const attrs = index === null
    ? ''
    : ` type="button" data-act="die" data-index="${index}" aria-pressed="${pressed}"`;

  // What this die can actually roll, counted off its own faces, so the sheet
  // can never disagree with the die.
  const tally = die.faces.reduce((acc, f) => { acc[f] = (acc[f] || 0) + 1; return acc; }, {});
  const ordered = Object.entries(tally).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const nameOf = (sym) => (SYMBOLS[sym] ? SYMBOLS[sym].name : sym);
  const rows = ordered.map(([sym, n]) => {
    const tint = SYMBOLS[sym] ? SYMBOLS[sym].color : '#6b5a3c';
    return `<span class="facerow" style="--face:${tint}">${icon(sym)}<em>${esc(nameOf(sym))}</em><b>${n}/${die.sides}</b></span>`;
  }).join('');
  // What makes this die worth keeping, said on the die itself. Two dice of the
  // same size are not the same die: one may lean toward a symbol, another may
  // carry a wild face, and a plain one is neither. Without a mark they are all
  // a d6 showing whatever they rolled, and the difference only shows up in the
  // tooltip — too late, when the question is which one to throw away.
  const special = die.kind === 'power' ? die.proficiency : die.wild ? WILD : null;
  const mark = special
    ? `<span class="mark" style="--mark:${(SYMBOLS[special] || SYMBOLS.wild).color}" aria-hidden="true">${icon(special)}</span>`
    : '';

  const heading = face
    ? `d${die.sides} — showing ${nameOf(face)}`
    : die.proficiency ? `d${die.sides} — favors ${nameOf(die.proficiency)}` : `d${die.sides} — plain die`;
  const nature = die.kind === 'power'
    ? `Favours ${nameOf(die.proficiency)}.`
    : die.wild ? 'Carries a wild face.' : 'A plain die.';
  const label = `${heading}. ${nature} Rolls: ${ordered.map(([sym, n]) => `${nameOf(sym)} ${n} of ${die.sides}`).join(', ')}.`;

  return `<${tag} class="die ${die.kind} ${special ? 'special' : ''} ${mini ? 'mini' : ''} ${state} ${
    rolling ? 'rolling' : ''}"${attrs}
      style="--face:${color}${rolling ? `;${tumbleStyle(die, face, order)}` : ''}" aria-label="${esc(label)}">
    <svg class="shell" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="${DIE_SHAPE[die.sides] || DIE_SHAPE[6]}"/>
      <g transform="translate(30 ${die.sides === 4 ? 36 : 30}) scale(1.66)"><path fill-rule="evenodd" class="pip" d="${art}"/></g>
    </svg>
    <span class="pips">d${die.sides}</span>
    ${mark}
    <span class="facesheet" aria-hidden="true"><em class="fs-head">${esc(heading)}</em><em class="fs-nature">${esc(nature)}</em>${rows}</span>
  </${tag}>`;
}

function meter(value, max, className = '') {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `<span class="meter ${className}"><i style="width:${pct}%"></i></span>`;
}

export function affinity(member, wanted, allies = []) {
  if (!wanted.length) return 0;
  const dice = assembleDice(member, allies);
  return dice.reduce((sum, die) => sum + dieOdds(die, wanted), 0) / dice.length;
}

// --- Cards -------------------------------------------------------------------

// `pool` is the company's lessons, when the caller knows it. Given one, the
// rank row stops being a read-out and becomes a price tag: the bar fills with
// how close the pool is to the next step rather than with anything this
// character has done, because being in rooms is no longer how anybody rises.
// The way into somebody's sheet, on their own card. Creatures have no rack,
// but they still have a hand worth looking at, so everybody gets one.
function sheetLink(member) {
  return `<button class="ghost tiny kitlink" data-act="opensheet" data-uid="${member.uid}" type="button">
    ${member.gear === null ? 'Their hand' : 'Kit &amp; sheet'}</button>`;
}

function memberCard(member, { as = 'div', extra = '', pressed = null, dim = false, act = 'party', pool = null } = {}) {
  const hero = Boolean(member.isHero);
  const rarity = hero ? { color: '#d7a75a', name: 'You' } : RARITIES[member.rarity];
  const level = hero ? member.level : member.rank;
  const cost = trainingCost(member);
  const capped = cost === null;
  const dice = companionDice(member);
  const attrs = as === 'button'
    ? ` type="button" data-act="${act}" data-uid="${member.uid}"${pressed === null ? '' : ` aria-pressed="${pressed}"`}`
    : '';
  const path = hero ? chosenPath(member) : null;
  const title = hero ? `${member.title}${path ? ` — ${path.name}` : ''}` : companionDef(member.defId).title;
  return `<${as} class="companion ${dim ? 'spent' : ''} ${hero ? 'is-hero' : ''}"${attrs} style="--rarity:${rarity.color}">
    <h3>${esc(member.name)}</h3>
    <p class="title">${esc(title)} &middot; <span style="color:${rarity.color}">${rarity.name}</span></p>
    <div class="rank-row"><span>${hero ? 'Level' : 'Rank'} ${level}</span>${capped
      ? '<span>mastered</span>'
      : pool === null
        ? `<span class="cost">${cost} to train</span>`
        : meter(Math.min(pool, cost), cost)}</div>
    <div class="rank-row"><span>Vigor ${member.stamina}/${MAX_STAMINA}</span>${meter(member.stamina, MAX_STAMINA, 'stamina')}</div>
    <div class="dicerow">${dice.map((d) => dieMarkup(d, null, { mini: true })).join('')}</div>
    ${extra}
  </${as}>`;
}

// --- The view ----------------------------------------------------------------

export function createUi(game, root) {
  const view = root.querySelector('#view');
  const purse = root.querySelector('#purse');
  const pinned = root.querySelector('#pinned');
  const logEl = root.querySelector('#log');
  const menuEl = root.querySelector('#menu');
  const dockEl = root.querySelector('#menudock');

  applySound();
  onSkinChange(() => {
    const typing = root.ownerDocument.activeElement && root.ownerDocument.activeElement.id === 'heroname';
    if (!typing) { render(); return; }
    const fig = root.querySelector('.makelook figure');
    const name = ui.creation.name.trim();
    const img = fig && fig.querySelector('img');
    if (img) img.outerHTML = skinFigure(name);
  });

  // Saving is this browser, always. A character goes to another device the
  // one way the game offers: its code, copied here and pasted there.
  function keepSave() {
    game.save();
  }

  // What this browser holds, for the character screen.
  function refreshSlots() {
    ui.slots = listProfiles().filter((slot) => slot.hero).map((slot) => ({
      profile: slot.id,
      name: slot.hero.name,
      title: slot.hero.title,
      // repairHero has not run on these — they are read straight out of
      // storage — so a save older than the figures has none to show.
      summary: {
        level: slot.hero.level, gold: slot.gold, renown: slot.renown,
        day: slot.day, companions: slot.companions, underground: slot.underground,
      },
    }));
  }

  // The stonework is a pile of PNGs, and a page that cannot fetch them should
  // still have a readable map rather than a grid of empty outlines. One piece
  // is asked for at the start: if it arrives, the floors are laid; if it does
  // not, the map stays the drawn one it always was.
  let stoneReady = false;
  (() => {
    if (typeof Image === 'undefined') return;
    const probe = new Image();
    probe.onload = () => { stoneReady = true; render(); };
    probe.src = `${TILE_DIR}dbt_4_1.png`;
  })();

  // A floor restored from a save arrives mid-round: start from the round it is
  // actually on, or the first action after a reload would be read as a throw
  // that never happened. The open floor is also what the player was looking at.
  const open = game.expedition;
  const ui = {
    // Every session opens on the character screen; the tabs are the game.
    stage: 'select', slots: null, settings: false, menu: false, log: false, sheet: false,
    // The map is home: camp and the hall are places in a country, not tabs.
    tab: 'road', zone: null, party: [], place: null, mustering: false, selectedDie: null, notice: '',
    // The last country you stood in. The menu's way into camp and the hall has
    // to mean somewhere, and it should mean where you were, not where the
    // list of countries happens to start.
    lastZone: null,
    pendingAbility: null, transmuteDie: null, reshaped: null, rolling: false,
    // Which socket is open for fitting, as "slot:index", and whose rack the
    // character sheet is showing.
    socket: null, sheetWho: null, confirmSettle: false,
    lastRound: open && open.encounter ? open.encounter.rounds : 0,
    creation: { name: '', classId: null, look: null },
    session: null, joinCode: '', confirmDisband: null, confirmExit: false, throwToken: 0, renderedAt: 0,
    pasting: false, saveCode: '', qr: '', shareLink: false, incoming: null, wide: true,
    settledAt: 0, pair: [],
  };

  // Every action that other players must see goes through here: solo it is a
  // plain method call, in a quest it is a lockstep dispatch.
  function perform(action, args = []) {
    if (ui.session && ui.session.started) ui.session.dispatch(action, args);
    else game[action](...args);
  }

  // During an encounter only the player whose character is rolling may act.
  function myTurn() {
    const x = game.expedition;
    if (!ui.session || !x) return true;
    if (x.status !== 'encounter') return true;
    return (x.actorUids || []).some((uid) => game.owns(uid));
  }

  function peerName(peerId) {
    const entry = ui.session && ui.session.roster.find((r) => r.peerId === peerId);
    return entry ? entry.member.name : 'the other player';
  }

  const say = (message) => { ui.notice = message; render(); };
  const guard = (fn) => { try { ui.notice = ''; fn(); } catch (err) { ui.notice = err.message; render(); } };

  // --- Chrome -------------------------------------------------------------

  function renderPurse() {
    const s = game.state;
    if (!game.hero) { purse.innerHTML = ''; if (pinned) pinned.innerHTML = ''; return; }
    const seals = Object.entries(s.seals).filter(([, n]) => n > 0);
    purse.innerHTML = [
      `<button class="coin" data-act="toselect" type="button" title="Choose another character"><span>Playing</span><b>${esc(game.hero.name)}</b></button>`,
      `<div class="coin"><span>Day</span><b>${s.day}</b></div>`,
      `<div class="coin"><span>Gold</span><b>${s.gold}</b></div>`,
      `<div class="coin"><span>Lessons</span><b>${s.training}</b></div>`,
      `<div class="coin"><span>Renown</span><b>${s.renown}</b></div>`,
      `<div class="coin"><span>Party</span><b>${game.partyCap}</b></div>`,

      ...seals.map(([id, n]) => `<div class="coin"><span>${esc(SEALS[id].short)}</span><b>${n}</b></div>`),
    ].join('');
    // Kept out of the rail: on a phone the coins swipe sideways, and the way
    // into the menu must not swipe away with them.
    if (pinned) {
      pinned.innerHTML = `<button class="coin menucoin" data-act="menu" type="button"
        aria-haspopup="true" aria-expanded="${ui.menu}"><span>Menu</span>${d10Icon()}</button>`;
    }
  }

  // What a screen that asks you to spend has to say for itself. The masthead
  // carries the purse, but full screen takes the masthead away — and a hall
  // full of prices with no sight of what you are holding is a shop with the
  // till turned to the wall. Every screen that spends something shows what it
  // spends, and only what it spends.
  function coinChip(label, value, short = false) {
    return `<div class="coin${short ? ' short' : ''}"><span>${esc(label)}</span><b>${value}</b></div>`;
  }

  function purseBar(kinds, seals = []) {
    const s = game.state;
    const chips = [];
    if (kinds.includes('gold')) chips.push(coinChip('Gold', s.gold, s.gold <= 0));
    if (kinds.includes('training')) chips.push(coinChip('Lessons', s.training, s.training <= 0));
    // A seal you do not hold still belongs on the strip when something in the
    // room is asking for it: "none" is the answer to "can I afford this".
    seals.forEach((id) => {
      const held = s.seals[id] || 0;
      chips.push(coinChip(SEALS[id].short, held, held <= 0));
    });
    if (!chips.length) return '';
    return `<div class="pursebar" role="group" aria-label="What you have to spend">${chips.join('')}</div>`;
  }

  function renderLog() {
    logEl.innerHTML = game.state.log
      .map((e) => `<li class="${e.kind}"><span class="day">D${e.day}</span>${esc(e.text)}</li>`)
      .join('') || '<li>Nothing has happened yet.</li>';
  }

  // --- Character creation -------------------------------------------------

  function startingDice(def) {
    return def.dice
      .map((d) => dieMarkup(makePowerDie('preview', d.sides, d.symbol), null, { mini: true }))
      .join('');
  }

  // The kit sheet is one picture: a row per kind, a column per grade, and a
  // window the size of one cell over whichever piece this is. The URL is
  // resolved against the document once, because a relative url() inside a
  // custom property resolves against whichever stylesheet uses it.
  const kitUrl = new URL(KIT_SHEET, root.ownerDocument.baseURI).href;
  function kitIcon(piece, cls = '') {
    const at = kitCell(piece);
    if (!at) return '';
    return `<span class="kitcell ${cls}" aria-hidden="true" style="--kit:url('${kitUrl}');`
      + ` --kitcols:${KIT_COLS}; --kitrows:${KIT_ROWS}; --col:${at.col}; --row:${at.row}"></span>`;
  }

  // Anything else handed to CSS as a url() needs the same treatment, and for
  // the same reason.
  function assetUrl(path) {
    return new URL(path, root.ownerDocument.baseURI).href;
  }

  // The big picture on the character card: the whole skin once it has
  // loaded, the head until then.
  function skinFigure(name) {
    const body = name && name.trim() ? bodyFor(name) : null;
    return body
      ? `<img class="skinbody" src="${esc(body)}" alt="" width="120" height="240">`
      : `<img class="skinhead big" src="${esc(headFor(name))}" alt="" width="128" height="128">`;
  }

  // Your face, on your own card: the skin your username wears, and how to
  // change it.
  function lookEditor(hero) {
    const real = isUsername(hero.name);
    return `<div class="whoami">
      <img class="skinhead" src="${esc(headFor(hero.name))}" alt="" width="56" height="56">
      <span class="whoami-say">
        <b>${real ? `Wearing ${esc(hero.name)}\u2019s skin` : 'Wearing a blockhead'}</b>
        <em class="hint">${real
          ? 'Your Minecraft username is your face here. Rename them to wear another.'
          : 'Rename them to a Minecraft username and they wear that skin.'}</em>
      </span>
    </div>`;
  }

  // Making a character is one decision at a time, on one large card in the
  // middle of the screen: the calling across the top, the figure who has it
  // in the middle, and their name along the bottom. The card is a carousel —
  // arrows, the dots under it, the arrow keys, or a swipe move to the next
  // calling — and the figure has a carousel of its own. On a wide screen the
  // callings either side lean in at the edges, so there is plainly more.
  function creationClass() {
    const ids = CLASS_LIST.map((d) => d.id);
    if (!ids.includes(ui.creation.classId)) {
      ui.creation.classId = ids[0];
      ui.creation.look = defaultLook(ids[0]).id;
    }
    return CLASS_LIST.find((d) => d.id === ui.creation.classId);
  }

  function stepCreation(dir) {
    const ids = CLASS_LIST.map((d) => d.id);
    const at = ids.indexOf(creationClass().id);
    const next = ids[(at + dir + ids.length) % ids.length];
    ui.creation.classId = next;
    ui.creation.look = defaultLook(next).id;
    render();
  }

  function renderCreation(profiles = []) {
    const others = profiles.filter((slot) => slot.hero && slot.id !== currentProfile());
    const def = creationClass();
    const at = CLASS_LIST.indexOf(def);
    const ability = heroAbility({ classId: def.id, level: 1, pathId: null });
    const lead = def.dice[0];
    const even = def.dice.every((d) => d.sides === lead.sides);
    const named = ui.creation.name.trim().length > 0;
    // The callings either side, leaning in at the edges.
    const neighbor = (dir) => {
      const other = CLASS_LIST[(at + dir + CLASS_LIST.length) % CLASS_LIST.length];
      return `<button class="classpeek ${dir < 0 ? 'before' : 'after'}" data-act="pickclass" data-class="${other.id}" type="button"
          style="--face:${SYMBOLS[other.symbol].color}" aria-label="${esc(other.name)}">
        <span class="classhead">${icon(other.symbol)}<b>${esc(other.name)}</b></span>
        <span class="peekmark">${icon(other.symbol)}</span>
      </button>`;
    };
    const card = `<article class="makecard" style="--face:${SYMBOLS[def.symbol].color}" aria-label="${esc(def.name)}">
      <div class="makeclass">
        <div class="classhead">${icon(def.symbol)}<h3>${esc(def.name)}</h3></div>
        <div class="dicerow">${startingDice(def)}</div>
        <p class="title">${even ? 'Even across three areas' : `Leans ${esc(SYMBOLS[lead.symbol].name)}, with ${def.dice.slice(1).map((d) => esc(SYMBOLS[d.symbol].name)).join(' and ')} behind it`}</p>
        <p class="blurb">${esc(def.blurb)}</p>
        <p class="ability"><b>${esc(ability.name)}</b> &times;${ability.uses} a night &mdash; ${esc(ability.text)}</p>
        <p class="hint">Paths at level ${PATH_LEVEL}: ${def.paths.map((p) => esc(p.name)).join(' or ')}</p>
      </div>
      <div class="makelook">
        <figure>
          ${skinFigure(ui.creation.name)}
          <figcaption><b>${named ? esc(ui.creation.name.trim()) : 'Your skin goes here'}</b><span>${named
            ? (isUsername(ui.creation.name) ? 'Your Minecraft skin' : 'Not a Minecraft username \u2014 a blockhead stands in')
            : 'Type your Minecraft username'}</span></figcaption>
        </figure>
      </div>
      <div class="makename">
        <label class="field"><span>Minecraft username</span>
          <input id="heroname" type="text" maxlength="28" value="${esc(ui.creation.name)}" placeholder="Steve" autocomplete="off" spellcheck="false"></label>
        <button class="ghost" data-act="showskin" type="button">Show my skin</button>
        <button class="action" data-act="create" type="button" ${named ? '' : 'disabled'}>Take to the road</button>
      </div>
      <p class="notice">${esc(ui.notice) || (named ? '' : 'Your username is your name and your face. Type it, and you are ready.')}</p>
    </article>`;
    const dots = CLASS_LIST.map((d) => `<button class="makedot" data-act="pickclass" data-class="${d.id}" type="button"
        aria-pressed="${d.id === def.id}" style="--face:${SYMBOLS[d.symbol].color}" title="${esc(d.name)}"
        aria-label="${esc(d.name)}">${icon(d.symbol)}</button>`).join('');
    return `${others.length ? `<section class="panel">
      <header><div><h2>Your other characters</h2><p class="hint">This slot is empty. You can pick one of these up instead.</p></div></header>
      <div class="buttons">${others.map((slot) => `<button class="ghost" data-act="useprofile" data-profile="${esc(slot.id)}" type="button">${esc(slot.hero.name)} &middot; level ${slot.hero.level}</button>`).join('')}</div>
    </section>` : ''}
    <section class="panel fill making">
      <header><div><h2>Make your character</h2>
        <p class="hint longform">They are the one fixed point of the company. Companions come and go; they do not.</p></div>
        <button class="ghost backmap" data-act="toselect" type="button">&larr; Characters</button></header>
      <div class="makedots" role="group" aria-label="Callings">${dots}</div>
      <div class="makedeck" id="makedeck">
        <button class="deckstep" data-act="classstep" data-dir="-1" type="button" aria-label="Previous calling">&lsaquo;</button>
        ${neighbor(-1)}
        ${card}
        ${neighbor(1)}
        <button class="deckstep" data-act="classstep" data-dir="1" type="button" aria-label="Next calling">&rsaquo;</button>
      </div>
    </section>`;
  }

  function renderPathChoice() {
    const hero = game.hero;
    const cards = pathsFor(hero).map((path) => `
      <button class="classcard" data-act="pickpath" data-path="${path.id}" type="button">
        <div class="classhead"><h3>${esc(path.name)}</h3></div>
        <p class="blurb">${esc(path.blurb)}</p>
        <ul class="grants">${pathSteps(hero.classId, path.id).map((g) => `<li><b>${g.level}</b> ${esc(g.text)} <em>${esc(g.label)}</em></li>`).join('')}</ul>
      </button>`).join('');
    return `<section class="panel">
      <header><div><h2>${esc(hero.name)} has grown into something.</h2><p class="hint">Choose a direction. It cannot be unchosen, and it decides every level from here.</p></div></header>
      ${rail('paths', cards, { back: 'Other path', on: 'Other path' })}
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // --- Camp ---------------------------------------------------------------

  // What the two nights cost, and who goes without if the purse is light.
  function restLine() {
    const hero = game.hero;
    const trick = hero
      ? ` <span class="longform">Your <b>${esc(heroAbility(hero).name)}</b> comes back with a long rest and nothing else:</span> ${
        abilityLeft(hero)} of ${abilityMax(hero)} ${esc(heroAbility(hero).name)} left.`
      : '';
    const weary = game.weary().length;
    if (!weary) return `${trick} <span class="longform">Everyone is fresh; a night costs nothing either way.</span>`;
    const cost = game.restCost();
    const afford = Math.min(weary, Math.floor(game.state.gold / REST_PER_COMPANION));
    const short = weary - afford;
    return ` A <b>long rest</b> beds the whole company: ${weary} ${weary === 1 ? 'companion needs' : 'companions need'} the night at ${REST_PER_COMPANION} gold each, <b>${cost} gold</b>${
      short ? `, and you can only cover ${afford} \u2014 the worst worn are bedded first and <b>${short}</b> ${short === 1 ? 'wakes' : 'wake'} no better.` : '.'
    } A <b>short rest</b> is your own bedroll: free, it wakes nobody else, and your trick stays spent.${trick}`;
  }

  // Every haven is somewhere you walked to, so every haven has a road back.
  function backToMap() {
    const zone = zoneById(ui.zone);
    return `<button class="ghost backmap" data-act="tomapscreen" type="button" title="Back to the map">&larr; Map<span class="longform"> &middot; ${esc(zone ? zone.name : REGION)}</span></button>`;
  }

  // One step, one price, on the card of the person it buys. There is no
  // "spend it all" button on purpose: the interesting part of the pool is
  // that every level you buy is a level somebody else did not get.
  function trainRow(member, also = '') {
    const cost = trainingCost(member);
    const pool = game.state.training;
    if (cost === null) {
      return `<div class="buttons trainrow"><span class="hint">Nothing left to learn.</span>${also}</div>`;
    }
    const afford = pool >= cost;
    const step = member.isHero ? `level ${member.level + 1}` : `rank ${member.rank + 1}`;
    return `<div class="buttons trainrow">
      <button class="${afford ? 'action' : 'ghost'}" data-act="train" data-uid="${member.uid}" type="button"${afford ? '' : ' disabled'}>
        Train to ${step} &middot; ${cost}
      </button>
      <span class="hint">${afford
        ? `${pool - cost} would be left`
        : `${cost - pool} short &middot; ${costToMaster(member)} to the top`}</span>
      ${also}
    </div>`;
  }

  // A row of cards you step through rather than scroll. The arrows are the
  // scrollbar — they gray out at each end — and on a phone they go away and
  // the row is swiped instead, which is what a thumb expects anyway.
  function rail(id, cards, { back = 'Back', on = 'Forward' } = {}) {
    return `<div class="railwrap">
      <button class="stepper" data-act="step" data-target="${id}" data-dir="-1" type="button" aria-label="${back}">&#8249;</button>
      <div class="scroller rail quiet" id="${id}">${cards}</div>
      <button class="stepper" data-act="step" data-target="${id}" data-dir="1" type="button" aria-label="${on}">&#8250;</button>
    </div>`;
  }

  function renderCamp() {
    const s = game.state;
    const hero = game.hero;
    const loadout = heroLoadout(hero);
    const ability = heroAbility(hero);
    const path = chosenPath(hero);
    const legend = SYMBOL_ORDER.map((id) => `<span style="color:${SYMBOLS[id].color}">${icon(id)}${SYMBOLS[id].name}</span>`).join('');
    return `
      <section class="panel campself">
        <header>
          <div><h2>Campfire</h2><p class="hint">${loadout.plain} plain dice${loadout.wild ? ` (${loadout.wild} with a wild face)` : ''} and ${loadout.power.length} power ${loadout.power.length === 1 ? 'die' : 'dice'}.</p></div>
          <span class="namerow">
            <span class="headctl">${backToMap()}${menuButton()}</span>
            <input id="rename" type="text" maxlength="28" value="${esc(hero.name)}" aria-label="Rename your character" autocomplete="off" spellcheck="false">
            <button class="ghost" data-act="rename" type="button">Rename</button>
          </span>
        </header>
        ${purseBar(['gold', 'training'])}
        <div class="scroller quiet" id="campself">
        <div class="grid">${memberCard(hero, {
          pool: s.training,
          extra: `<p class="ability"><b>${esc(ability.name)}</b> ${ability.left} of ${ability.charges} until a long rest &mdash; ${esc(ability.text)}</p>
            ${path ? `<ul class="grants">${pathSteps(hero.classId, path.id).filter((g) => g.level <= hero.level).map((g) => `<li><b>${g.level}</b> ${esc(g.text)} <em>${esc(g.label)}</em></li>`).join('')}</ul>` : `<p class="blurb">A path opens at level ${PATH_LEVEL}.</p>`}
            ${kitLine(hero)}
            ${trainRow(hero, sheetLink(hero))}
            ${mendRow()}
            ${lookEditor(hero)}`,
        })}
        <details class="aside">
          <summary>Symbols</summary>
          <p class="hint">A power die favors its symbol; a plain die shows all six equally. Larger power dice hit more often, and a d8 or better carries a wild face that answers anything.</p>
          <div class="legend">${legend}<span style="color:${SYMBOLS.wild.color}">${icon('wild')}Wild</span></div>
        </details></div>
        </div>
        <div class="steprow" data-for="campself">
          <button class="stepper" data-act="step" data-target="campself" data-dir="-1" type="button" aria-label="Up">&#8963;</button>
          <button class="stepper" data-act="step" data-target="campself" data-dir="1" type="button" aria-label="Down">&#8964;</button>
        </div>
      </section>
      <section class="panel fill company">
        <header>
          <div><h2>The Company</h2>
            <p class="hint">${s.roster.length} companion${s.roster.length === 1 ? '' : 's'} &middot; you may take ${game.companionSlots} of them with you.${
              game.upkeep() ? ` They eat <b>${game.upkeep()}</b> gold a night, whether they go down or not.` : ''}${restLine()}</p>
            ${(() => {
              const starving = s.roster.filter((c) => c.unpaid);
              if (!starving.length) return '';
              const worst = Math.max(...starving.map((c) => c.unpaid));
              return `<p class="hint hungerwarn"><b>${starving.length}</b> going unfed
                &mdash; ${HUNGER_LEAVES - worst <= 1
                  ? 'somebody walks in the morning unless the purse covers supper'
                  : `the longest is ${worst} ${worst === 1 ? 'night' : 'nights'}, and seven is when they leave`}.</p>`;
            })()}
            <p class="hint"><b>${s.training}</b> lessons in the pool<span class="longform"> &mdash; cleared rooms pay into it, and only what you spend here moves anybody up</span>.</p></div>
          <div class="buttons" style="flex-wrap:nowrap">
            <button class="action" data-act="rest" type="button">Long rest${
              game.restCost() + game.upkeep() ? ` &middot; ${game.restCost() + game.upkeep()}g` : ''}</button>
            <button class="ghost" data-act="shortrest" type="button">Short rest</button>
          </div>
        </header>
        ${s.roster.length ? rail('company', s.roster.map((c) => memberCard(c, {
          pool: s.training,
          extra: `<p class="blurb">${esc(companionDef(c.defId).blurb)}</p>
            ${hungerLine(c)}
            ${kitLine(c)}
            ${trainRow(c, `<button class="ghost" data-act="dismiss" data-uid="${c.uid}" type="button">Dismiss</button>${sheetLink(c)}`)}`,
        })).join(''), { back: 'Earlier companions', on: 'Later companions' })
          : '<p class="hint">Nobody yet. The town hall is where you fix that.</p>'}
      </section>`;
  }

  // Everything the player can decide, in one place, reachable from anywhere.
  // Music is built and wired but not offered: js/music.js and the scene calls
  // below are all still here, and putting the switch back is a few lines. It
  // is simply not something the game asks about yet.
  // The Chronicle, as a page rather than a drawer: everything that has
  // happened, read off the book it is written in. The tome is behind the whole
  // page, so the entries are the only thing on it.
  function renderChronicle() {
    const entries = [...game.state.log].reverse();
    const days = [];
    entries.forEach((e) => {
      const last = days[days.length - 1];
      if (last && last.day === e.day) last.lines.push(e);
      else days.push({ day: e.day, lines: [e] });
    });
    const body = days.map((d) => `<section class="chapter">
      <h3>Day ${d.day}</h3>
      <ul>${d.lines.map((e) => `<li class="${e.kind}">${esc(e.text)}</li>`).join('')}</ul>
    </section>`).join('');
    return `<section class="panel chroniclepage fill">
      <header>
        <div><h2>The Chronicle</h2><p class="hint">${game.state.log.length} entr${game.state.log.length === 1 ? 'y' : 'ies'}, newest first &middot; day ${game.state.day}</p></div>
        <span class="headctl"><button class="ghost backmap" data-act="closelog" type="button">&larr; Back</button>${menuButton()}</span>
      </header>
      <div class="scroller quiet" id="chronicle-page">
        ${body || '<p class="hint">Nothing has happened yet. That is what the door is for.</p>'}
      </div>
      <div class="steprow" data-for="chronicle-page">
        <button class="stepper" data-act="step" data-target="chronicle-page" data-dir="-1" type="button" aria-label="Up">&#8963;</button>
        <button class="stepper" data-act="step" data-target="chronicle-page" data-dir="1" type="button" aria-label="Down">&#8964;</button>
      </div>
    </section>`;
  }

  // The character sheet: what you are, what you hold, and what it is doing to
  // your dice. Reached from the menu, and the one place gear is moved about.
  function gearCard(piece, { slot = null, action = null, sockets = false } = {}) {
    if (!piece) {
      return `<div class="kit empty"><b>${esc(slot ? slot.name : 'Empty')}</b><em>Nothing</em></div>`;
    }
    const kind = kindOf(piece);
    const grade = tierDef(piece.tier);
    const worn = piece.wear;
    const max = durabilityOf(piece);
    const cost = repairCost(piece);
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < max - worn ? 'sound' : 'gone'}"></i>`).join('');
    return `<div class="kit ${isBroken(piece) ? 'broken' : worn ? 'worn' : ''}" style="--face:${SYMBOLS[kind.symbol].color}">
      ${kitIcon(piece)}
      <span class="kitsay">
        <b>${esc(gearName(piece))}</b>
        <em>${esc(slot ? slot.name : slotDef(kind.slot).where)}</em>
        <p>${esc(describeGear(piece))}</p>
        ${giftOf(piece) ? `<p class="gift">There is something in it: <b>${esc(ABILITIES[giftOf(piece)].name)}</b>,
          once a night, for whoever wears it.</p>` : ''}
        <span class="wear" title="${max - worn} of ${max} left">${pips}</span>
      </span>
      ${sockets && slot ? socketRow(sockets, slot.id) : ''}
      <span class="kitrow">
        ${action || ''}
        ${cost ? `<button class="ghost tiny" data-act="mend" data-id="${piece.id}" type="button"
          ${game.state.expedition ? 'disabled' : ''}>Mend &middot; ${cost}g</button>` : ''}
      </span>
    </div>`;
  }

  // --- Sockets ----------------------------------------------------------
  //
  // A piece of kit changes one of your dice, and which one used to be decided
  // for you. Now every piece carries a socket per die it can change, and the
  // die goes in it the way a gem does. An empty socket is not dead weight: it
  // takes the best die going and says so, and the point of the socket is that
  // you can overrule it.
  function dieShort(die) {
    if (!die) return 'nothing';
    if (die.kind === 'power') return `d${die.sides} of ${SYMBOLS[die.proficiency].name}`;
    return die.wild ? `plain d${die.sides} with a wild face` : `plain d${die.sides}`;
  }

  function socketSays(fit, die) {
    if (!fit.live) return 'The setting is cracked; mend the piece and it works again.';
    if (!die) return 'Nothing in the hand for it to work on.';
    if (fit.boon.kind === 'wild') return `Your ${dieShort(die)} trades a face for a wild one.`;
    if (die.kind === 'basic') return `Your ${dieShort(die)} becomes a d${fit.boon.sides} of ${SYMBOLS[fit.boon.symbol].name}.`;
    if (die.sides >= 12) return `Your ${dieShort(die)} is already as big as dice get.`;
    return `Your ${dieShort(die)} is sharpened to a d${stepUp(die.sides, 1)}.`;
  }

  function socketRow(who, slotId) {
    const piece = who.gear && who.gear[slotId];
    if (!piece || !socketCount(piece)) return '';
    const loadout = who.classId ? heroLoadout(who) : companionHand(who);
    const bare = companionDice({ ...who, gear: null });
    const byKey = Object.fromEntries(bare.map((d) => [d.key, d]));
    const mine = loadout.fits.filter((fit) => fit.slot === slotId);
    if (!mine.length) return '';
    const open = mine.find((fit) => ui.socket === `${slotId}:${fit.socket}`);
    const wells = mine.map((fit) => {
      const die = byKey[fit.key];
      const cls = ['socket', die ? 'set' : 'hollow', fit.auto ? 'auto' : '', fit.live ? '' : 'cracked',
        ui.socket === `${slotId}:${fit.socket}` ? 'open' : ''].join(' ');
      return `<button class="${cls}" type="button" data-act="socket" data-slot="${slotId}" data-index="${fit.socket}" data-uid="${who.uid}"
        aria-expanded="${ui.socket === `${slotId}:${fit.socket}`}" title="${esc(socketSays(fit, die))}">
        ${die ? dieMarkup(die, null, { mini: true }) : '<span class="hole"></span>'}
      </button>`;
    }).join('');
    const picker = !open ? '' : `<div class="socketpick">
      <p class="hint">Which die does the ${esc(gearName(piece).toLowerCase())} work on?</p>
      <div class="picks">
        ${bare.map((die) => {
          const here = open.key === die.key;
          const elsewhere = !here && loadout.fits.some((f) => f.key === die.key && f.live);
          return `<button class="socketopt ${here ? 'in' : ''} ${elsewhere ? 'elsewhere' : ''}" type="button"
            data-act="fit" data-slot="${slotId}" data-index="${open.socket}" data-uid="${who.uid}" data-key="${die.key}"
            aria-pressed="${here}" title="${esc(elsewhere ? 'Fitted to another piece; this would move it.' : socketSays(open, die))}">
            ${dieMarkup(die, null, { mini: true })}</button>`;
        }).join('')}
        <button class="socketopt clear" type="button" data-act="fit" data-slot="${slotId}"
          data-index="${open.socket}" data-uid="${who.uid}" data-key="">Choose for me</button>
      </div>
      <p class="hint">${esc(socketSays(open, byKey[open.key]))}${open.auto ? ' Chosen for you \u2014 pick one to keep it there.' : ''}</p>
    </div>`;
    // More settings than dice is a real thing that happens to a well-kitted
    // character, and an empty well with no word about it just looks broken.
    const idle = mine.filter((fit) => fit.live && !fit.key).length;
    const note = idle
      ? `<span class="socketnote">${idle === mine.length ? 'Nothing' : `${idle} of these`} left in the hand to work on \u2014 take something else off.</span>`
      : '';
    return `<span class="sockets">${wells}${note}</span>${picker}`;
  }

  // What the hall has for sale today. Three pieces on a rack, and never above
  // what the character could carry — the smith knows a novice when one walks in.
  // Camp is where a smith's work gets done. The card says what it would cost
  // to put the kit right, and the character sheet is where each piece is.
  // What somebody is actually wearing, said on their own card so the company
  // screen is not six cards that all look the same.
  // How close somebody is to walking. Said on their card, because the
  // Chronicle is a thing you read afterward and this is a thing you can fix.
  function hungerLine(member) {
    const nights = member.unpaid || 0;
    if (!nights) return '';
    const left = HUNGER_LEAVES - nights;
    return `<p class="hunger ${nights >= 5 ? 'grim' : ''}">Unfed ${nights} ${nights === 1 ? 'night' : 'nights'} &middot; ${
      left <= 1 ? 'gone in the morning unless they eat tonight' : `walks in ${left} more`}</p>`;
  }

  function kitLine(member) {
    if (!member.gear) return '<p class="blurb">No hands for a rack — what it is, it is.</p>';
    const worn = SLOTS.map((slot) => member.gear[slot.id]).filter(Boolean);
    if (!worn.length) return '<p class="blurb">Carrying nothing. The pool is where you fix that.</p>';
    const hurt = worn.filter((p) => p.wear).length;
    return `<p class="kitline">${worn.map((piece) => kitIcon(piece, 'tiny')).join('')}
      <span class="hint">${worn.length} of ${SLOTS.length} slots${hurt ? `, ${hurt} needing an anvil` : ''}</span></p>`;
  }

  function mendRow() {
    const hurt = game.bearers()
      .flatMap((who) => SLOTS.map((slot) => who.gear[slot.id]))
      .filter((p) => p && p.wear);
    const bagHurt = game.pack.filter((p) => p.wear);
    const all = [...hurt, ...bagHurt];
    if (!all.length) return '<p class="blurb">Every piece of kit is sound.</p>';
    const total = all.reduce((sum, piece) => sum + repairCost(piece), 0);
    const afford = game.state.gold >= total;
    return `<div class="buttons trainrow">
      <button class="${afford ? 'action' : 'ghost'}" data-act="mendall" type="button"${afford ? '' : ' disabled'}>
        Mend everything &middot; ${total}g
      </button>
      <span class="hint">${all.length} ${all.length === 1 ? 'piece needs' : 'pieces need'} an anvil${
        afford ? '' : `, and you are ${total - game.state.gold} gold short`}.</span>
    </div>`;
  }

  function gearRack(zone) {
    if (!zone || !game.hero) return '';
    const stock = game.gearOf(zone.id);
    if (!stock.length) return '<p class="hint">The rack is bare until morning.</p>';
    const cards = stock.map((piece) => gearCard(piece, {
      action: `<button class="action tiny" data-act="buygear" data-id="${piece.id}" type="button"
        ${game.state.gold >= priceOf(piece) ? '' : 'disabled'}>Buy &middot; ${priceOf(piece)}g</button>`,
    })).join('');
    return `<h3 class="setgroup">On the rack</h3>
      <div class="kits">${cards}</div>`;
  }

  // Curios: bought once, carried by the company, good again after a long rest.
  function curioShelf() {
    if (!game.hero) return '';
    const cards = TRINKET_IDS.map((id) => {
      const def = TRINKETS[id];
      const owned = game.ownsTrinket(id);
      const left = game.trinketLeft(id);
      return `<div class="kit curiocard${owned ? ' owned' : ''}">
        <span class="kitsay">
          <b>${esc(def.name)}</b>
          <em>${def.uses === 1 ? 'Once' : `${def.uses} times`} between long rests</em>
          <p>${esc(def.text)}</p>
          <p class="gift">${esc(def.blurb)}</p>
        </span>
        <span class="kitrow">${owned
          ? `<em class="hint">Carried &middot; ${left} of ${def.uses} ready</em>`
          : `<button class="action tiny" data-act="buytrinket" data-id="${id}" type="button"
            ${game.state.gold >= def.price ? '' : 'disabled'}>Buy &middot; ${def.price}g</button>`}</span>
      </div>`;
    }).join('');
    return `<h3 class="setgroup">Curios</h3>
      <p class="hint">Company kit rather than anybody's rack. Each is bought once, and a long rest makes it good again.</p>
      <div class="kits">${cards}</div>`;
  }

  function renderSheet() {
    const hero = game.hero;
    // The sheet is the one place kit is moved about, and the whole company can
    // be kitted now — so it shows whoever you point it at. The creatures are
    // not on the row: they have no hands for a rack.
    // Everybody in the company, creatures included: they have no rack, but
    // their hand is worth reading and the row should not have gaps in it.
    const bearers = [hero, ...game.state.roster];
    const who = bearers.find((m) => m.uid === ui.sheetWho) || hero;
    const isHero = who.uid === hero.uid;
    const racked = Boolean(who.gear);
    const loadout = isHero ? heroLoadout(who) : companionHand(who);
    const path = isHero ? chosenPath(who) : null;
    const ability = isHero ? heroAbility(who) : null;
    const dice = companionDice(who).map((die) => dieMarkup(die, null, { mini: false })).join('');
    const worn = !racked ? '' : SLOTS.map((slot) => gearCard(who.gear[slot.id], {
      slot,
      sockets: who,
      action: who.gear && who.gear[slot.id]
        ? `<button class="ghost tiny" data-act="unequip" data-id="${slot.id}" data-uid="${who.uid}" type="button">Take off</button>`
        : '',
    })).join('');
    // The pool is the company's, but the sheet is one person's: showing them
    // six things they cannot hold is six things to read past. What they cannot
    // carry is counted rather than listed, so nothing vanishes without a word.
    const theirs = game.pack.filter((piece) => racked && game.canBear(who, piece));
    const notTheirs = game.pack.length - theirs.length;
    const bag = theirs.map((piece) => gearCard(piece, {
      action: isBroken(piece)
        ? '<em class="cannot">Broken &mdash; an anvil first</em>'
        : `<button class="ghost tiny" data-act="equip" data-id="${piece.id}" data-uid="${who.uid}" type="button">Wear</button>`,
    })).join('');
    const tabs = bearers.length < 2 ? '' : `<div class="whosekit" role="group" aria-label="Whose kit">
      ${bearers.map((m) => `<button class="kitwho ${m.uid === who.uid ? 'on' : ''}" type="button"
        data-act="sheetwho" data-uid="${m.uid}" aria-pressed="${m.uid === who.uid}">${esc(m.name)}</button>`).join('')}
    </div>`;
    const standing = isHero
      ? `${esc(who.title)}${path ? ` &middot; ${esc(path.name)}` : ''} &middot; level ${who.level}`
      : `${esc(who.title)} &middot; rank ${who.rank}`;
    return `<section class="panel sheetpage fill">
      <header>
        <div><h2>${esc(who.name)}</h2>
        <p class="hint">${standing}
          &middot; ${loadout.plain} plain ${loadout.plain === 1 ? 'die' : 'dice'} and ${loadout.power.length} power ${loadout.power.length === 1 ? 'die' : 'dice'}</p></div>
        <span class="headctl"><button class="ghost backmap" data-act="closesheet" type="button">&larr; Back</button>${menuButton()}</span>
      </header>
      ${tabs}
      <div class="scroller quiet" id="sheet">
        <section class="sheetpart hand">
          <h3 class="setgroup">The hand ${isHero ? 'you throw' : 'they throw'}</h3>
          <div class="dicerow">${dice}</div>
          ${ability ? `<p class="hint"><b>${esc(ability.name)}</b> ${ability.left} of ${ability.charges} until a long rest &mdash; ${esc(ability.text)}</p>` : ''}
        </section>
        <section class="sheetpart worn">
          ${racked ? `<h3 class="setgroup">Worn</h3><div class="kits">${worn}</div>`
            : '<p class="hint">No hands for a rack, and no need of one — what it is, it is.</p>'}
        </section>
        <section class="sheetpart pool">
          <h3 class="setgroup">The pool</h3>
          ${bag ? `<div class="kits">${bag}</div>` : `<p class="hint">${game.pack.length
            ? `Nothing in the pool that ${esc(isHero ? 'you can' : `${who.name} can`)} carry.`
            : 'The pool is empty. A town hall sells kit, and a floor leaves some lying about.'}</p>`}
          <p class="hint">Nothing in the pool is anybody's until it is put on${
            notTheirs ? `, and ${notTheirs} more ${notTheirs === 1 ? 'piece is' : 'pieces are'} in there for somebody else` : ''}.</p>
        </section>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  function renderSettings() {
    const toggles = Object.entries(CHOICES).map(([id, c]) => `<li>
      <button class="switch" data-act="choice" data-id="${id}" type="button" aria-pressed="${c.value}">
        <span class="pip" aria-hidden="true"></span>
        <span><b>${esc(c.label)}</b><em>${esc(c.hint)}</em></span>
      </button>
    </li>`).join('');
    return `<section class="panel settings">
      <header>
        <div><h2>Settings</h2><p class="hint">All of it is taste. None of it changes a roll.</p></div>
        <button class="ghost backmap" data-act="closesettings" type="button">&larr; Back</button>
      </header>

      <h3 class="setgroup">Sound</h3>
      <ul class="switches">
        <li><button class="switch" data-act="sound" type="button" aria-pressed="${!isMuted()}">
          <span class="pip" aria-hidden="true"></span>
          <span><b>Dice</b><em>The clatter of the dice landing.</em></span>
        </button></li>
      </ul>

      ${game.hero ? (() => {
        const books = game.arrears();
        const owing = books.owed + books.over;
        return `<h3 class="setgroup">The books</h3>
          <p class="hint">A company eats. That was not true when this character was made, so one played
            before it has been keeping people for nothing and the purse shows it. Settling prices those
            nights at what they would cost today, and caps whatever is left at three good floors &mdash;
            a hoard no floor could have paid for is a hoard from a different game.</p>
          <p class="hint"><b>${books.gold}</b> gold and <b>${books.lessons}</b> lessons in hand &middot;
            <b>${game.upkeep()}</b> a night for ${game.state.roster.length}
            ${game.state.roster.length === 1 ? 'companion' : 'companions'}
            &middot; ${books.nights} ${books.nights === 1 ? 'night' : 'nights'} on the books.</p>
          ${owing || books.lessonsOver ? `<div class="buttons">
            <button class="${ui.confirmSettle ? 'action' : 'ghost'}" data-act="settle" type="button">${ui.confirmSettle
              ? `Yes &mdash; settle, and leave ${books.left} gold and ${Math.min(books.lessons, books.lessonCap)} lessons`
              : `Settle the books${owing ? ` &middot; ${owing} gold` : ''}${
                books.lessonsOver ? `${owing ? ' and' : ' &middot;'} ${books.lessonsOver} lessons` : ''}`}</button>
            ${ui.confirmSettle ? '<button class="ghost" data-act="settlecancel" type="button">Leave it</button>' : ''}
          </div>
          <p class="hint">${books.owed} in back wages and board${books.over
            ? `, and ${books.over} the hall has been carrying for you`
            : ''}${books.lessonsOver
            ? `; the lesson pool comes down to ${books.lessonCap}, which is three floors' teaching at the deepest place open to you`
            : ''}. It cannot be undone.</p>`
            : '<p class="hint">The books are straight. Nothing to settle.</p>'}`;
      })() : ''}

      <h3 class="setgroup">At the table</h3>
      <ul class="switches">${toggles}</ul>
      <p class="hint">${throwsRealDice()
        ? 'The dice are thrown under physics. The result is decided before anything moves — what you watch is the roll the engine already made.'
        : systemWantsCalm()
          ? 'Your system asks for reduced motion, so the dice arrive without the throw.'
          : physicsRefused || !seemsSupported()
            ? 'This browser has no WebGL to throw dice in, so they are drawn flat.'
            : 'The dice are drawn flat while physical dice are off.'}</p>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // --- Guild hall ---------------------------------------------------------

  // Which seals belong on the hall's strip: the ones anybody drinking here is
  // asking for, plus any you are already carrying.
  function wantedSeals(offered) {
    const wanted = new Set(Object.keys(game.state.seals).filter((id) => game.state.seals[id] > 0));
    offered.forEach((defId) => {
      const cost = RECRUIT_COST[companionDef(defId).rarity];
      Object.entries(cost.seals).forEach(([seal, n]) => { if (n > 0) wanted.add(seal); });
    });
    return Object.keys(SEALS).filter((id) => wanted.has(id));
  }

  function renderHall() {
    const s = game.state;
    const zone = zoneById(ui.zone);
    const offered = game.hallOf(ui.zone);
    if (!offered.length) {
      return `<section class="panel">
        <header><div><h2>Town Hall</h2><p class="hint">The hall is empty. Rest a day and new faces will drift in.</p></div>${backToMap()}</header>
      </section>`;
    }
    const cards = offered.map((defId) => {
      const def = companionDef(defId);
      const cost = RECRUIT_COST[def.rarity];
      const rarity = RARITIES[def.rarity];
      const sealText = Object.entries(cost.seals).map(([seal, n]) => `${n} &times; ${esc(SEALS[seal].name)}`).join(', ');
      return `<div class="companion" style="--rarity:${rarity.color}">
        <h3>${esc(def.name)}</h3>
        <p class="title">${esc(def.title)} &middot; <span style="color:${rarity.color}">${rarity.name}</span></p>
        <div class="dicerow">${def.proficiencies.map((pid) => `<div class="die mini power" style="--face:${SYMBOLS[pid].color}">${icon(pid)}</div>`).join('')}</div>
        <p class="blurb">${esc(def.blurb)}</p>
        <p class="hint" style="margin-top:10px">${cost.gold} gold${sealText ? ` &amp; ${sealText}` : ''}</p>
        <div class="buttons" style="margin-top:8px">
          <button class="action" data-act="recruit" data-def="${defId}" type="button" ${canAfford(s, def.rarity) ? '' : 'disabled'}>Recruit</button>
        </div>
      </div>`;
    }).join('');
    return `<section class="panel fill">
      <header><div><h2>${esc(zone ? zone.name : '')} Town Hall</h2><p class="hint longform">${
        zone ? `${esc(zone.weather)} ` : ''}Who drinks here depends on where here is, and rarer sorts take an interest as your renown grows.</p></div><span class="headctl">${backToMap()}${menuButton()}</span></header>
      ${purseBar(['gold'], wantedSeals(offered))}
      ${rail('hall', cards, { back: 'Earlier faces', on: 'Later faces' })}
      ${gearRack(zone)}
      ${curioShelf()}
      ${ui.notice ? `<p class="notice">${esc(ui.notice)}</p>` : ''}
    </section>`;
  }

  // --- Venturing forth ----------------------------------------------------

  function renderCoop() {
    const session = ui.session;
    // Until somebody opens one, this is an invitation, not a decision — and
    // an invitation should not take the top of the map every time you look
    // at it. Once a quest is live it becomes a panel again, because then it
    // is state the player needs in front of them.
    if (!session) {
      // Open or shut is remembered, because every render rebuilds this, and
      // the menu can open it too: full screen hides the panel otherwise.
      return `<details class="panel invite${ui.coop ? ' shown' : ''}"${ui.coop ? ' open' : ''}>
        <summary data-act="coop"><b>Play together</b><span class="hint longform"> &mdash; open a quest, or join one with a code</span></summary>
        <p class="hint">${ui.relay
          ? 'Anyone with the code walks the same floor with you, from their own computer or phone &mdash; no account needed.'
          : 'Anyone with the code, in another tab or window on this machine, walks the same floor with you &mdash; no server, no account.'}</p>
        <div class="buttons">
          <button class="action" data-act="host" type="button">Open a quest</button>
          <span class="joinrow"><input id="joincode" maxlength="4" placeholder="CODE" value="${esc(ui.joinCode)}" autocomplete="off">
          <button class="ghost" data-act="join" type="button" ${ui.joinCode.length === 4 ? '' : 'disabled'}>Join</button></span>
        </div>
        <p class="notice">${esc(ui.notice)}</p>
      </details>`;
    }
    // Once a quest is open it is one slim bar over the map, not a panel that
    // pushes the map off the screen: the code, who is here, what happens next,
    // and the two buttons. Anything that needs saying at length is a notice.
    const who = session.roster.map((r) => {
      const extra = Math.max(0, (r.party || []).length - 1);
      return `<span class="qwho${r.peerId === session.peerId ? ' you' : ''}" title="${esc((r.party || []).map((m) => m.name).join(', '))}">${
        esc(r.member.name)}${extra ? ` <b>+${extra}</b>` : ''}${r.peerId === session.peerId ? ' <em>you</em>' : ''}</span>`;
    }).join('');
    const mine = game.state.roster.length;
    const alone = session.roster.length < 2;
    const plan = session.plan;
    const waitingOn = plan ? session.roster.filter((r) => !session.agreed.has(r.peerId)).map((r) => r.member.name) : [];
    const next = alone && session.host ? `Waiting for someone to join${ui.relay ? ' \u2014 share the code' : ''}.`
      : plan ? (waitingOn.length ? `${esc(plan.label)}? Waiting on ${esc(waitingOn.join(' and '))}.` : `Everyone agrees: ${esc(plan.label)}.`)
        : session.host ? 'Pick a place on the map, then propose it.' : 'The host proposes where you go.';
    const link = ui.link && ui.link !== 'open'
      ? (ui.link === 'connecting' ? 'Connecting\u2026' : 'Connection lost. Reconnecting\u2026') : '';
    return `<section class="panel questbar">
      <span class="qcode">Quest <b class="code">${esc(session.code)}</b></span>
      <span class="qparty">${who}</span>
      ${next ? `<span class="hint qnext">${next}</span>` : ''}
      <span class="qbuttons">${!game.expedition
        ? `<button class="ghost tiny" data-act="loadout" type="button" aria-pressed="${Boolean(ui.coopScreen)}">Party${
          session.plan ? ' &amp; plan' : ''}</button>` : ''}${session.host && !game.expedition
        ? (session.everyoneAgreed
          ? '<button class="action tiny" data-act="setout" type="button">Set out</button>'
          : ui.place && (!session.plan || session.plan.placeId !== ui.place) && !ui.coopScreen
            ? `<button class="action tiny" data-act="proposeplace" type="button" ${alone ? 'disabled' : ''}>Propose ${esc(placeById(ui.place).name)}</button>`
            : '')
        : ''}
        <button class="ghost tiny" data-act="leave" type="button">Leave</button></span>
      ${link ? `<p class="notice qnote">${link}</p>` : ''}
      ${session.desynced ? `<p class="notice qnote">This quest lost sync (${esc(session.error || 'unknown')}). Leave and start a fresh one.</p>` : ''}
      ${ui.notice && !ui.coopScreen ? `<p class="notice qnote">${esc(ui.notice)}</p>` : ''}
    </section>`;
  }

  // The load screen: where the quest is going, who has agreed to it, and
  // who each player is bringing. Everybody picks their own companion here,
  // within what the size of the party allows, and the host sets out only
  // once everyone has agreed.
  function renderLoadout() {
    const session = ui.session;
    const plan = session.plan;
    const place = plan && plan.placeId ? placeById(plan.placeId) : null;
    const iAgreed = plan && session.agreed.has(session.peerId);
    const where = !plan
      ? `<p class="hint">${session.rejectedBy && session.rejectedBy !== session.peerId
        ? `<b>${esc(peerName(session.rejectedBy))}</b> would rather go somewhere else. ` : ''}${session.host
        ? 'Pick a posting on the map, or the Clocktower, and propose it.'
        : 'The host has not proposed anywhere yet.'}</p>`
      : `<div class="planwhere">
          <h3>${esc(plan.label)}</h3>
          ${place ? `<p class="hint">Tier ${tierOf(place).tier} &middot; ${esc(place.bounty)}</p>${asksMarkup(place.settings)}`
            : `<p class="hint">${esc(TOWER.blurb)}</p>`}
        </div>`;
    const votes = plan ? `<div class="votes">${session.roster.map((r) => `<span class="vote ${session.agreed.has(r.peerId) ? 'yes' : ''}">${
      esc(r.member.name)} ${session.agreed.has(r.peerId) ? '&#10003; agreed' : '&hellip; deciding'}</span>`).join('')}</div>` : '';
    const choice = !plan ? ''
      : session.host
        ? `<div class="buttons"><button class="action" data-act="setout" type="button" ${session.everyoneAgreed ? '' : 'disabled'}>Set out</button>
            <span class="hint">${session.everyoneAgreed ? '' : 'Everyone has to agree first.'}</span></div>`
        : iAgreed ? '<p class="hint">You have agreed. The host sets out.</p>'
          : `<div class="buttons"><button class="action" data-act="agree" type="button">Agree</button>
              <button class="ghost" data-act="reject" type="button">Somewhere else</button></div>`;
    const columns = session.roster.map((r) => {
      const mine = r.peerId === session.peerId;
      const room = session.allowance(r.peerId);
      const bring = (r.party || []).slice(1);
      const allowText = room === 0 ? 'Heroes only, with this many' : room === Infinity ? '' : `May bring ${room} companion${room === 1 ? '' : 's'}`;
      const picks = mine && room > 0 && game.state.roster.length
        ? rail(`loadout-${r.peerId}`, game.state.roster.map((c) => memberCard(c, { as: 'button', pressed: bring.some((m) => m.uid === c.uid) })).join(''),
          { back: 'Earlier companions', on: 'Later companions' })
        : '';
      return `<div class="loadcol ${mine ? 'mine' : ''}">
        <p class="trayowner"><b>${mine ? 'You' : esc(r.member.name)}</b>${allowText ? ` &middot; ${allowText}` : ''}</p>
        <ul class="loadwho"><li><b>${esc(r.member.name)}</b> <em>${esc(r.member.title || '')}</em></li>${
          bring.map((m) => `<li>${esc(m.name)} <em>${esc(m.title || '')}</em></li>`).join('')}</ul>
        ${picks}
        ${mine && room > 0 && !game.state.roster.length ? '<p class="hint">No companions yet. The town hall is where you fix that.</p>' : ''}
      </div>`;
    }).join('');
    return `<section class="panel fill loadout">
      <header><div><h2>Setting out</h2><p class="hint">Where the quest is going, and who is bringing whom. Four at most in a party.</p></div>
        <button class="ghost" data-act="loadout" type="button">Back to the map</button></header>
      <div class="scroller">
        ${where}${votes}${choice}
        <div class="loadcols">${columns}</div>
        <p class="notice">${esc(ui.notice)}</p>
      </div>
    </section>`;
  }

  // The country, drawn as the guild's hex atlas. A place is somewhere you go,
  // not a floor you unlock: the map is the first screen, the place card the
  // second, the party the third, and then you are gone.
  // Each place looks out over something, and what it looks out over is a
  // painting: the band cut for its scene, with the tint of the dungeon
  // underneath washed over it so a card in the Mire and a card in the
  // Ironbacks are still read as two pages of one atlas.
  function vista(place) {
    const tint = settingDef(place.settings[0]).color;
    return `<div class="vista" role="img" aria-label="${esc(place.name)}">
      <img src="${SCENE_DIR}/${sceneOf(place)}.jpg" alt="" loading="lazy" decoding="async">
      <span class="wash" style="--wash:${tint}"></span>
    </div>`;
  }

  // The ground and the places are period map engravings, out of the pen packs
  // in assets/world: a piece fitted into a box on the hex, its own shape kept.
  // One class attribute, not two: a second one would be dropped on the floor
  // by the parser and the styling with it.
  function engraving(art, cx, cy, size, cls = '') {
    const w = size;
    const h = size;
    return `<image class="cut ${cls}" href="${ART_DIR}/${art}.png" x="${(cx - w / 2).toFixed(1)}"
      y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
      preserveAspectRatio="xMidYMid meet"/>`;
  }

  // One figure off the sheet: the whole sheet is drawn with the wanted cell
  // over the spot, and a clip the size of one cell hides the other
  // sixty-eight. So every figure in the game costs one request.
  //
  // A nested <svg> with a viewBox is the tidier way to say this and it does
  // not clip here, so this says it with a clipPath, which does.
  function figure(name, cx, cy, size, cls = '') {
    const x = cx - size / 2;
    const y = cy - size / 2;
    return `<g class="figure ${cls}">
      <rect class="headrim" x="${(x - 1.5).toFixed(1)}" y="${(y - 1.5).toFixed(1)}" width="${(size + 3).toFixed(1)}" height="${(size + 3).toFixed(1)}"/>
      <image href="${esc(headFor(name))}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${size.toFixed(1)}" height="${size.toFixed(1)}" preserveAspectRatio="none"/>
    </g>`;
  }

  // The same trick again, for the bestiary: sixty-eight creatures on one sheet
  // and a window the size of one cell over whichever of them is in this room.
  let mobIds = 0;
  function mobToken(id, cx, cy, size) {
    let at;
    try { at = cellOf(id); } catch (err) { return ''; }
    const clip = `mob${mobIds++}`;
    const x = cx - size / 2;
    const y = cy - size / 2;
    const scale = size / MOBCELL;
    return `<g class="held" clip-path="url(#${clip})">
      <defs><clipPath id="${clip}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${size.toFixed(1)}" height="${size.toFixed(1)}"/></clipPath></defs>
      <image href="${MOBSHEET}"
        x="${(x - at.col * MOBCELL * scale).toFixed(1)}"
        y="${(y - at.row * MOBCELL * scale).toFixed(1)}"
        width="${(MOBCOLS * MOBCELL * scale).toFixed(1)}"
        height="${(MOBROWS * MOBCELL * scale).toFixed(1)}"
        preserveAspectRatio="none"/>
    </g>`;
  }

  // The thing itself, beside its own name. What the plan showed you standing
  // in the room is what the encounter is headed with, so there is never a
  // moment where the picture and the fight are two different creatures.
  function mobPlate(mob, size = 72) {
    if (!mob) return '';
    return `<svg class="plate" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
      aria-hidden="true">${mobToken(mob, size / 2, size / 2, size)}</svg>`;
  }

  // What heads an encounter: the creature, once you are in the room with it,
  // or the mark of the trap or hazard when there is no creature at all.
  function foePlate(challenge, size = 72) {
    if (challenge && challenge.hazard) return glyphPlate(hazardDef(challenge.hazard).kind, size);
    return mobPlate(challenge && challenge.mob, size);
  }

  function foeBadges(challenge, { pressing = false } = {}) {
    const tile = game.tile;
    const badges = [];
    if (challenge.boss) badges.push('<span class="badge">Boss</span>');
    if (challenge.hazard) badges.push(`<span class="badge warn">${esc(HAZARD_KINDS[hazardDef(challenge.hazard).kind].badge)}</span>`);
    else if (tile && tile.kind === 'treasure') badges.push('<span class="badge warn">Mimic</span>');
    if (pressing && challenge.pressure) badges.push('<span class="badge warn">Pressing</span>');
    return badges.join('');
  }

  // What a trap or a hazard wants, and what it costs to fail it.
  function hazardHint(challenge) {
    const def = hazardDef(challenge.hazard);
    return `${esc(def.text)} <b>${esc(HAZARD_COSTS[def.cost])}</b>`;
  }

  // Which way a room lies from where the party stands, in words.
  function bearingTo(tile) {
    const here = game.tile;
    if (!here) return 'nearby';
    if (tile.x > here.x) return 'to the east';
    if (tile.x < here.x) return 'to the west';
    if (tile.y > here.y) return 'to the south';
    return 'to the north';
  }

  // The Seer's Glass: a button for each room it could look into, and what it
  // has already shown of the rooms still waiting next to you — every trial,
  // with the one symbol it kept dark drawn as a question mark.
  function scryPanel() {
    const x = game.expedition;
    const here = x.map.tiles[x.map.position];
    const seen = here.links.map((k) => x.map.tiles[k])
      .filter((t) => t && t.scried && t.state !== 'cleared')
      .map((t) => {
        const view = game.scryView(t);
        const rows = view.trials.map((trial, i) => `<div class="trial"><span class="label">Trial ${i + 1}</span>${
          trial.map((sym) => (sym
            ? `<div class="slot" style="--face:${SYMBOLS[sym].color}" title="${esc(SYMBOLS[sym].name)}">${icon(sym)}</div>`
            : '<div class="slot hidden" title="The glass did not show this one">?</div>')).join('')}</div>`).join('');
        const plate = view.mob ? mobPlate(view.mob, 56) : view.hazard ? glyphPlate(hazardDef(view.hazard).kind, 56) : '';
        const note = view.wary ? 'Wary rather than hostile: it will want paying, not fighting.'
          : view.trap ? `Honest, but trapped: ${esc(hazardDef(view.trap).name.toLowerCase())}.`
            : !view.trials.length ? 'Nothing in it to fight.' : '';
        return `<div class="scried"><div class="foe">${plate}<div><b>${esc(view.name)}</b>
          <span class="hint"> &middot; ${esc(bearingTo(t))}</span>${note ? `<p class="hint">${note}</p>` : ''}</div></div>
          ${rows ? `<div class="trials">${rows}</div>` : ''}</div>`;
      }).join('');
    const def = TRINKETS.glass;
    const buttons = game.trinketUse('glass')
      ? game.scryable().map((t) => `<button class="ghost curio" data-act="trinket" data-id="glass" data-uid="${t.key}" type="button"
          title="${esc(def.text)}">Look ${esc(bearingTo(t))} with the ${esc(def.name)} <b>&times;${game.trinketLeft('glass')}</b></button>`).join('')
      : '';
    if (!seen && !buttons) return '';
    return `${seen}${buttons ? `<div class="buttons curios">${buttons}</div>` : ''}`;
  }

  // The curios that would do something right now, as buttons. Nothing is
  // offered that would not work.
  function trinketButtons(ids) {
    return ids.map((id) => {
      const use = game.trinketUse(id);
      if (!use) return '';
      const def = TRINKETS[id];
      const left = game.trinketLeft(id);
      if (use === 'revive') {
        return game.downed().map((m) => `<button class="ghost curio" data-act="trinket" data-id="${id}" data-uid="${m.uid}"
          type="button" title="${esc(def.text)}">${esc(def.name)} for ${esc(m.name)} <b>&times;${left}</b></button>`).join('');
      }
      const label = use === 'escape' ? `Break the ${def.name}`
        : use === 'probe' ? `Prod it with the ${def.name}`
          : `Spring it with the ${def.name}`;
      return `<button class="ghost curio${use === 'escape' ? ' escape' : ''}" data-act="trinket" data-id="${id}" type="button"
        title="${esc(def.text)}">${esc(label)} <b>&times;${left}</b></button>`;
    }).join('');
  }

  // One hex renderer for both maps: the Strand with its five countries on it,
  // and a country with its own camp, hall and postings. `marks` are whatever
  // sits on top — a zone, a place, a haven — each already knowing how it is
  // drawn and what it does when pressed.
  function hexSvg({ atlas, marks, river = null, sea = false, label }) {
    const { width, height } = atlasExtent(HEX, atlas);
    const hexes = atlasHexes(atlas);

    const ground = hexes.map(({ col, row, terrain }) => {
      const { x, y } = hexCenter(col, row);
      return `<polygon class="cell t-${terrain.id}" points="${hexPoints(x, y)}"/>`;
    }).join('');

    // The engravings ride above every hex fill, so a mountain that overhangs
    // its own hex is not clipped by the next one.
    const cuts = hexes.map(({ col, row, terrain }) => {
      const art = artFor(terrain, col, row);
      if (!art) return '';
      const { x, y } = hexCenter(col, row);
      return engraving(art, x, y + HEX * 0.08, HEX * 1.7 * (terrain.scale || 0.8));
    }).join('');

    const water = !river ? '' : `<path class="river" d="${river.map(([col, row], i) => {
      const { x, y } = hexCenter(col, row);
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ')}"/>`;

    let seamarks = '';
    if (sea) {
      const sail = hexCenter(...SHIP.at);
      const coil = hexCenter(...SERPENT.at);
      // A sea with nothing in it is a sea nobody drew. Here there be monsters.
      seamarks = `<g class="seamarks" aria-hidden="true">
        ${engraving(SHIP.art, sail.x, sail.y, HEX * 1.3)}
        ${engraving(SERPENT.art, coil.x + HEX * 0.4, coil.y, HEX * 2.1)}
      </g>`;
    }

    // Seats first, names last: a label that strays over a neighbouring hex
    // should still be read, not disappear under it.
    const seats = [];
    const labels = [];
    marks.forEach((mark) => {
      const { x, y } = hexCenter(...mark.at);
      const at = `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
      const press = mark.act
        ? `data-act="${mark.act}" data-id="${mark.id}" role="button" tabindex="0"${mark.on === undefined ? '' : ` aria-pressed="${mark.on}"`}`
        : '';
      seats.push(`<g class="place ${mark.kind || ''} ${mark.locked ? 'locked' : ''} ${mark.on ? 'on' : ''}" transform="${at}">
        <polygon class="seat" points="${hexPoints(0, 0, HEX - 3)}"/>
        <polygon class="rim" points="${hexPoints(0, 0, HEX - 8)}"/>
        ${engraving(mark.art, 0, -HEX * 0.16, HEX * 1.08 * (mark.scale || 1), 'sign')}
        <polygon class="hit" points="${hexPoints(0, 0, HEX - 3)}" ${press}><title>${esc(mark.tip)}</title></polygon>
      </g>`);
    });

    // Names, written across the bottom of the hex they name.
    //
    // They used to be laid on the nearest free line beside their hex, marching
    // up or down until they cleared their neighbours. On an empty country that
    // works; on a busy one it put "The Drowned Saltworks" 121px from its own
    // hex and 66px from the Guild Hall's, and a name nearer somebody else's
    // hex than its own is not a crowded map, it is a wrong one. Widening the
    // search, shrinking the type and running leader lines back to the hex all
    // helped and none of it fixed the thing itself: there is no free line near
    // a hex that has neighbours.
    //
    // On the hex there is no question. Every name is over its own art, at the
    // same place on every hex, so density cannot make it ambiguous — and the
    // whole search goes away with it. Long names wrap and set smaller, and the
    // art sits up a little to leave them the room.
    const wrap = (text, per) => {
      const out = [];
      text.split(' ').forEach((word) => {
        const last = out[out.length - 1];
        if (last && `${last} ${word}`.length <= per) out[out.length - 1] = `${last} ${word}`;
        else out.push(word);
      });
      return out;
    };
    // Wide enough to use the hex and the gap beside it, no wider: two names in
    // one row must not meet.
    const ROOM = HEX * 1.5;
    const fit = (name) => {
      let size = 12.5;
      let lines = wrap(name, 99);
      for (; size >= 8.5; size -= 0.5) {
        lines = wrap(name, Math.max(4, Math.floor(ROOM / (size * 0.53))));
        if (lines.length <= 3 && lines.every((line) => line.length * size * 0.53 <= ROOM)) break;
      }
      return { lines, size };
    };
    marks.filter((m) => m.name).forEach((mark) => {
      const { x, y } = hexCenter(...mark.at);
      const { lines, size } = fit(mark.name);
      const step = size * 1.1;
      // Sat on the lower half of the hex, the last line just inside the rim.
      const first = y + HEX * 0.66 - (lines.length - 1) * step;
      labels.push(`<text class="name ${mark.kind || ''} ${mark.on ? 'on' : ''}"
        x="${x.toFixed(1)}" y="${first.toFixed(1)}" style="font-size:${size}px">${lines
          .map((line, i) => `<tspan x="${x.toFixed(1)}"${i ? ` dy="${step.toFixed(1)}"` : ''}>${esc(line)}</tspan>`)
          .join('')}</text>`);
    });

    return `<svg class="world" viewBox="0 0 ${width} ${height + 18}" role="group" aria-label="${esc(label)}">
      ${mapDefs(width, height)}
      <g class="ground">${ground}</g>
      ${water}
      <g class="cuts">${cuts}</g>
      <rect class="grain" width="${width}" height="${height}" filter="url(#grain)"/>
      <rect class="vig" width="${width}" height="${height}" fill="url(#vignette)"/>
      ${seamarks}
      <g class="places">${seats.join('')}</g>
      <g class="labels">${labels.join('')}</g>
      ${compassRose(width - 60, 58, 62)}
    </svg>`;
  }

  // The Strand is a chart, not a grid: a coast with bays in it, rivers off the
  // mountains, and a seal where each country is. Nothing here is a hex, which
  // is how you know at a glance which map you are looking at.
  function strandSvg() {
    const hero = game.hero;
    const { width, height } = STRAND;

    const scatter = STRAND.scatter
      .map(([art, x, y, size]) => engraving(art, x, y, size))
      .join('');
    const waves = STRAND.waves.map((d) => `<path class="wave" d="${d}"/>`).join('');
    const rivers = STRAND.rivers.map((d) => `<path class="river" d="${d}"/>`).join('');

    const countries = ZONES.map((zone) => {
      const open = placesIn(zone).filter((p) => isOpen(p, hero));
      const shut = open.length === 0;
      const [sx, sy] = zone.seal;
      const [lx, ly] = zone.label;
      const tip = shut
        ? `${zone.name} — nothing here is open to you yet`
        : `${zone.name} — ${zone.blurb}`;
      return `<g class="country ${shut ? 'locked' : ''}" style="--tint:${zone.tint}">
        <path class="patch" d="${zone.patch}"/>
        <g class="seal" transform="translate(${sx} ${sy})">
          <circle class="disc" r="46"/>
          <circle class="ring" r="39"/>
          ${engraving(zone.art, 0, 2, 74, 'sign')}
        </g>
        <text class="country-name" x="${lx}" y="${ly}">${esc(zone.name)}</text>
        <circle class="hit" cx="${sx}" cy="${sy}" r="52" data-act="zone" data-id="${zone.id}"
          role="button" tabindex="0"><title>${esc(tip)}</title></circle>
      </g>`;
    }).join('');

    const [shipX, shipY] = STRAND.ship;
    const [coilX, coilY] = STRAND.serpent;

    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(REGION)}">
      ${mapDefs(width, height)}
      <rect class="ocean" width="${width}" height="${height}"/>
      <g class="swell">${waves}</g>
      <g class="seamarks" aria-hidden="true">
        ${engraving(SHIP.art, shipX, shipY, 96)}
        ${engraving(SERPENT.art, coilX, coilY, 132)}
      </g>
      <path class="coast" d="${STRAND.land}" filter="url(#ink-rough)"/>
      <g class="rivers">${rivers}</g>
      <g class="cuts">${scatter}</g>
      <rect class="grain" width="${width}" height="${height}" filter="url(#grain)"/>
      <rect class="vig" width="${width}" height="${height}" fill="url(#vignette)"/>
      <g class="countries">${countries}</g>
      ${compassRose(STRAND.compass[0], STRAND.compass[1], 78)}
      <rect class="rule outer" x="10" y="10" width="${width - 20}" height="${height - 20}"/>
      <rect class="rule inner" x="16" y="16" width="${width - 32}" height="${height - 32}"/>
    </svg>`;
  }

  function zoneSvg(zone) {
    const hero = game.hero;
    const marks = placesIn(zone).map((place) => {
      const open = isOpen(place, hero);
      const tier = tierOf(place);
      return {
        id: place.id, at: place.at, art: place.icon, kind: '', act: 'place',
        name: open ? place.name : null, up: place.up, on: ui.place === place.id, locked: !open,
        tip: open ? `${place.name} — Tier ${tier.tier}` : `Sealed until level ${tier.opens}`,
      };
    });
    havensOf(zone).forEach((haven) => marks.push({
      id: haven.id, at: haven.at, art: haven.art, scale: haven.scale, kind: 'haven',
      act: 'goto', name: haven.name, tip: `${haven.name} — ${haven.tip}`,
    }));
    // And the tower. There is one in every country and it is the same tower,
    // which is a thing the map states plainly and declines to explain.
    const tower = towerOf(zone);
    marks.push({
      id: tower.id, at: tower.at, art: tower.art, scale: tower.scale, kind: 'tower',
      act: `to${tower.tab}`, name: tower.name, tip: `${tower.name} — ${tower.tip}`,
    });
    return hexSvg({ atlas: zone.atlas, marks, label: zone.name });
  }

  function placeCard(place) {
    const tier = tierOf(place);
    const depth = depthOf(place);
    const rank = tier.to ? `Rank ${tier.from}–${tier.to}` : `Rank ${tier.from}+`;
    const ready = game.hero.stamina >= tier.stamina;
    const settings = settingsOf(place).map((d) => `<span class="chip" style="--tint:${d.color}">${esc(d.name)}</span>`).join('');
    return `<aside class="placecard">
      ${vista(place)}
      <h3>${esc(place.name)}</h3>
      <p class="tierline"><span>Tier ${tier.tier} (${rank})</span><span class="cost">Stamina Cost <b>${tier.stamina}</b></span></p>
      <p class="bounty">${esc(place.bounty)}</p>
      <p class="finds-label">What the rooms will ask for:</p>
      ${asksMarkup(place.settings)}
      <p class="finds-label">During this adventure, you might find:</p>
      <div class="finds">
        <span class="find gold"><b>${depth.gold * 8}</b> gold</span>
        <span class="find seal">${esc(SEALS[depth.seal].name)}</span>
        <span class="find curio">${esc(place.finds)}</span>
      </div>
      <p class="under">Underneath: ${settings}</p>
      <button class="action" data-act="muster" type="button" ${ready ? '' : 'disabled'}>Choose Your Party</button>
      ${ready ? '' : `<p class="hint">${esc(game.hero.name)} is too worn for this — rest at camp first.</p>`}
    </aside>`;
  }

  // The Strand: five countries, and which of them is worth your level.
  function renderStrand() {
    const hero = game.hero;
    return `<section class="panel worldpanel fill">
      <header><div><h2>${esc(REGION)}</h2><p class="hint longform">Five regions, each with its own campfire, its own town hall and its own trouble. Choose where to go.</p></div>
        <span class="headctl"><span class="meta">Level ${hero.level} &middot; ${openPlaces(hero).length}/${PLACES.length} postings open to you</span>${menuButton()}</span></header>
      <div class="scroller">
      <div class="chartwrap">${strandSvg()}</div>
      <p class="bounty chartline longform">Every region of Odyssia keeps a town hall, a campfire to sleep by, and something underneath it that nobody wants to talk about.</p>
      <div class="countrycards">
        <ul class="zonelist">${ZONES.map((zone) => {
            const open = placesIn(zone).filter((p) => isOpen(p, hero)).length;
            const tiers = placesIn(zone).map((p) => p.depth);
            return `<li><button class="zonerow ${open ? '' : 'shut'}" data-act="zone" data-id="${zone.id}" type="button" style="--tint:${zone.tint}">
              <b>${esc(zone.name)}</b>
              <span>${open ? `Tier ${Math.min(...tiers)}\u2013${Math.max(...tiers)} &middot; ${open} open` : 'Nothing open to you yet'}</span>
            </button></li>`;
          }).join('')}</ul>
      </div>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // One country: its camp, its hall, and the two ways underground.
  function renderZone() {
    const zone = zoneById(ui.zone);
    if (!zone) { ui.zone = null; return renderStrand(); }
    const hero = game.hero;
    const place = ui.place ? placeById(ui.place) : null;
    const shown = place && place.zone === zone.id && isOpen(place, hero) ? place : null;
    return `<section class="panel worldpanel fill">
      <header>
        <div><h2>${esc(zone.name)}</h2><p class="hint longform">${esc(zone.weather)}</p></div>
        <span class="headctl"><button class="ghost backmap" data-act="tostrand" type="button" title="Back to the region">&larr; Map<span class="longform"> &middot; ${esc(REGION)}</span></button>${menuButton()}</span>
      </header>
      <div class="worldgrid scroller${shown ? ' has-place' : ''}">
        ${shown ? placeCard(shown) : `<aside class="placecard empty">
          <h3>${esc(zone.name)}</h3>
          <p class="bounty">${esc(zone.blurb)}</p>
          <p class="hint">The campfire is your camp and the roof is the town hall. Click a marked hex to read a posting.</p>
        </aside>`}
        <div class="worldmap">${zoneSvg(zone)}</div>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // Who goes. Its own screen, between the map and the way down, so nobody
  // sets out having forgotten to bring anybody.
  // The two symbols a place keeps asking for, as chips. Said on the posting
  // and again while the party is being chosen, because that is the moment it
  // is for: who to bring depends on what they will be asked.
  function asksMarkup(settings) {
    return `<div class="asks">${demandOf(settings).map((id) => `<span class="ask" style="--face:${SYMBOLS[id].color}">
      ${icon(id)}<b>${esc(SYMBOLS[id].name)}</b></span>`).join('')}</div>`;
  }

  function renderMuster() {
    const place = placeById(ui.place);
    const tier = tierOf(place);
    const hero = game.hero;
    const worn = game.state.roster.filter((c) => c.stamina < tier.stamina).length;
    const roster = game.state.roster.map((c) => memberCard(c, {
      as: 'button',
      pressed: ui.party.includes(c.uid),
      dim: c.stamina < tier.stamina,
      extra: c.stamina < tier.stamina ? '<p class="blurb">Too worn for this journey.</p>' : '',
    })).join('');
    const slots = [hero, ...ui.party.map((uid) => game.member(uid))];
    const empties = Math.max(0, game.companionSlots - ui.party.length);
    const order = [
      ...slots.map((m, i) => `<div class="slot ${i ? '' : 'lead'}"><b>${esc(m.name)}</b><span>${i ? 'companion' : 'you'}</span></div>`),
      ...Array.from({ length: empties }, () => '<div class="slot empty"><b>Empty</b><span>&nbsp;</span></div>'),
    ].join('');
    return `<section class="panel muster">
      <header>
        <span class="headctl"><button class="ghost backmap" data-act="tomap" type="button">&larr; Map</button>${menuButton()}</span>
        <div><h2>Choose Your Party</h2><p class="hint">${esc(place.name)} &middot; Tier ${tier.tier}</p></div>
        <button class="action" data-act="embark" type="button">Begin Adventure</button>
      </header>
      <p class="required">Required Stamina: <b>${tier.stamina}</b>${worn ? ` &middot; ${worn} too worn to come` : ''}</p>
      <div class="musterasks"><span class="required">The rooms will ask for</span>${asksMarkup(place.settings)}</div>
      ${game.state.roster.length
        ? rail('muster', roster, { back: 'Earlier companions', on: 'Later companions' })
        : '<p class="hint">Nobody to take yet. The town hall is where you fix that.</p>'}
      <div class="marching">${order}</div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // --- The map ------------------------------------------------------------

  const CELL = 78;
  const PAD = 42;

  // The floor is drawn the way a surveyor would have inked it: tinted
  // parchment, a rough pen line, hills and woods and peaks instead of flat
  // fills, and a compass in the corner.
  function mapDefs(w, h) {
    return `<defs>
      <filter id="ink-rough" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="t"/>
        <feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="ink-rough-line" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="t"/>
        <feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="11"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
      </filter>
      <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
        <stop offset="55%" stop-color="#6b5428" stop-opacity="0"/>
        <stop offset="100%" stop-color="#6b5428" stop-opacity="0.34"/>
      </radialGradient>
    </defs>`;
  }

  function compassRose(x, y, size = 46) {
    return `<g class="compass" aria-hidden="true">
      ${engraving('compass', x, y, size)}
    </g>`;
  }

  // The party, standing where it stands. The figure is the one the player
  // chose and the base carries the calling's own color and symbol, so a
  // glance says both where you are and who you are.
  //
  // These tokens are drawn looking south — whatever a figure holds in front
  // of it, a bow or a shield, is at the bottom of the cell — so facing north
  // is half a turn. Facing the way the party walked means facing into the
  // room it has just entered, not back at the door it came through.
  const FACING = { n: 180, e: 270, s: 0, w: 90 };

  function partyToken(x, y) {
    const hero = game.hero;
    const turn = FACING[(game.expedition && game.expedition.facing) || 'n'] || 0;
    const def = hero ? CLASS_LIST.find((c) => c.id === hero.classId) : null;
    const symbol = def ? def.symbol : 'might';
    const tint = SYMBOLS[symbol] ? SYMBOLS[symbol].color : 'var(--oxblood)';
    const r = CELL * 0.3;
    return `<g class="party" aria-hidden="true" style="--tint:${tint}">
      <ellipse class="shade" cx="${x}" cy="${(y + CELL * 0.21).toFixed(1)}" rx="${(r * 0.85).toFixed(1)}" ry="${(r * 0.3).toFixed(1)}"/>
      <circle class="base" cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>
      <g class="turned" data-facing="${turn}">
        ${figure(hero ? hero.name : '', x, y - CELL * 0.02, CELL * 0.4, 'token')}
      </g>
      <g class="badge" transform="translate(${(x + r * 0.62).toFixed(1)} ${(y + r * 0.62).toFixed(1)})">
        <circle r="${(CELL * 0.13).toFixed(1)}"/>
        <path transform="translate(-${(CELL * 0.1).toFixed(1)} -${(CELL * 0.1).toFixed(1)}) scale(${(CELL * 0.0083).toFixed(3)})"
          d="${SYMBOLS[symbol].art}"/>
      </g>
    </g>`;
  }

  function renderMap(over = '') {
    const x = game.expedition;
    const map = x.map;
    const w = map.width * CELL + PAD * 2;
    const h = map.height * CELL + PAD * 2;
    const cx = (t) => PAD + t.x * CELL + CELL / 2;
    const cy = (t) => PAD + t.y * CELL + CELL / 2;
    const here = map.tiles[map.position];
    const depth = game.runDepth;

    const corridors = [];
    Object.values(map.tiles).forEach((tile) => {
      tile.links.forEach((k) => {
        const other = map.tiles[k];
        if (!other || other.key < tile.key) return;
        const dark = tile.state === 'hidden' && other.state === 'hidden';
        corridors.push(`<line class="corridor ${dark ? 'unsurveyed' : ''}" x1="${cx(tile)}" y1="${cy(tile)}" x2="${cx(other)}" y2="${cy(other)}"/>`);
      });
    });

    // The floor itself, piece by piece. Each cell takes the painted piece whose
    // openings match the ways out of that cell, turned to face them, so what is
    // drawn is one connected dungeon rather than a row of unrelated rooms. Only
    // ground the party has seen is laid down; the rest of the map keeps its
    // surveyor's dashes.
    // The floor is laid as a whole, not a piece at a time: which piece fits a
    // cell is a question about the cells beside it, so the layout is settled
    // first and drawn second.
    // A floor under the Mire should not look like a floor under the Ironbacks:
    // the country's own color lies over the stone.
    const zone = game.place ? zoneById(game.place.zone) : null;
    const zoneTint = zone ? zone.tint : null;
    // A flooded mine and the cisterns under a city are laid from the sewer
    // channels; everything drier is stone. The floor follows the dungeon, not
    // the country, so two postings in the same place can feel different.
    const floorSet = floorOf(map.settings);
    const outdoors = isWildSet(floorSet);
    const laid = stoneReady && !outdoors ? layoutFor(map, {
      variantOf: (tile) => tile.x + tile.y * 3 + (tile.kind === 'passage' ? 1 : 0),
      set: floorSet,
    }) : null;
    const wild = stoneReady && outdoors ? wildFor(map, {
      variantOf: (tile) => tile.x + tile.y * 3,
      set: floorSet,
    }) : null;

    // Under the plan, the pack's own ground. Each set ships its floor as art —
    // brick under the sewers, cobble under the chase, grass and fen water out
    // of doors — so the sheet is floored with a square of it laid edge to edge
    // rather than left blank. Behind that hangs the view the dungeon sits in,
    // far enough back to be weather: it says what country you are under
    // without arguing with the ink.
    const groundwork = !stoneReady ? '' : `
        <defs>
          <pattern id="ground-${floorSet}" width="${CELL * 2}" height="${CELL * 2}" patternUnits="userSpaceOnUse">
            <image href="${groundUrl(floorSet)}" width="${CELL * 2}" height="${CELL * 2}" preserveAspectRatio="xMidYMid slice"/>
          </pattern>
        </defs>
        <image class="backdrop" href="${backdropUrl(floorSet)}" x="0" y="0" width="${w}" height="${h}"
          preserveAspectRatio="xMidYMid slice"/>`;
    // Out of doors there is ground, the trails between one clearing and the
    // next, and scrub in every gap a trail does not use. Drawn in that order,
    // so a trail runs over the grass and the scrub closes over both.
    const wildwork = !wild ? '' : (() => {
      // No ground drawn per cell any more: the sheet already has the country on
      // it, edge to edge. A second copy of the same grass laid over the top of
      // it only showed where its square ended.
      const cells = '';
      // The path. Out here there are no corridors to draw, so what joins one
      // clearing to the next is the ground people have worn walking between
      // them — and it is drawn over the whole map, not only the part the party
      // has seen. A wood is not a secret: you can see where the trail goes,
      // you just do not know what is standing in the next clearing. The ways
      // nobody has walked yet are the faint ones, which is the same thing the
      // stone maps say with their surveyor's dashes.
      //
      // Two strokes, not one: worn earth under a paler tread, so it reads as
      // a path rather than a ruled line. And no segment is straight — each
      // bends by an amount taken from the two cells it joins, so the same
      // pair always bends the same way and the map is the same map every
      // time it is drawn.
      const walked = (tile) => tile.state !== 'hidden';
      // A walked path wanders. One bend in the middle still read as a ruled
      // line with a kink in it, so each trail is a cubic with its two control
      // points pushed to opposite sides: the path leans one way out of a
      // clearing and the other way into the next. Both amounts come from the
      // two cells being joined, so a trail bends the same way every time the
      // map is drawn, and no two trails bend alike.
      const wobble = (a, b, salt) => {
        const n = (a.x * 73856093 + a.y * 19349663 + b.x * 83492791 + b.y * 6151 + salt * 2654435761) % 1000;
        return ((n + 1000) % 1000) / 1000;
      };
      const trailPath = (a, b) => {
        const x1 = cx(a);
        const y1 = cy(a);
        const x2 = cx(b);
        const y2 = cy(b);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        // Two sideways pushes, opposed, and two points along the run that are
        // not quite a third and two thirds of the way.
        const lean = 9 + wobble(a, b, 1) * 13;
        const back = -(6 + wobble(a, b, 2) * 12);
        const at1 = 0.26 + wobble(a, b, 3) * 0.12;
        const at2 = 0.62 + wobble(a, b, 4) * 0.12;
        const c1x = x1 + dx * at1 + nx * lean;
        const c1y = y1 + dy * at1 + ny * lean;
        const c2x = x1 + dx * at2 + nx * back;
        const c2y = y1 + dy * at2 + ny * back;
        return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} `
          + `${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      };
      const beds = [];
      const treads = [];
      const seen = new Set();
      Object.values(map.tiles).forEach((tile) => {
        tile.links.forEach((k) => {
          const other = map.tiles[k];
          if (!other) return;
          const pair = [tile.key, other.key].sort().join('|');
          if (seen.has(pair)) return;
          seen.add(pair);
          const faint = walked(tile) && walked(other) ? '' : ' unwalked';
          const d = trailPath(tile, other);
          beds.push(`<path class="trail bed${faint}" d="${d}"/>`);
          treads.push(`<path class="trail tread${faint}" d="${d}"/>`);
        });
      });
      const trails = [...beds, ...treads];
      const scrub = [...wild.placed.entries()].map(([key, spot]) => {
        const tile = map.tiles[key];
        const ox = PAD + tile.x * CELL;
        const oy = PAD + tile.y * CELL;
        return spot.scrub.map((bit) => {
          const size = CELL * bit.size;
          return `<image class="scrub ${tile.state === 'seen' ? 'unlit' : ''}" href="${TILE_DIR}${bit.file}.png"
            x="${(ox + bit.u * CELL - size / 2).toFixed(1)}" y="${(oy + bit.v * CELL - size / 2).toFixed(1)}"
            width="${size.toFixed(1)}" height="${size.toFixed(1)}"/>`;
        }).join('');
      }).join('');
      return `<g class="wildground">${cells}</g><g class="trails">${trails.join('')}</g><g class="scrubs">${scrub}</g>`;
    })();

    const stonework = !laid ? '' : [...laid.placed.entries()].map(([key, spot]) => {
      const tile = map.tiles[key];
      const ox = PAD + tile.x * CELL;
      const oy = PAD + tile.y * CELL;
      return spot.stones.map((stone) => `<image
        class="stone ${tile.state === 'seen' ? 'unlit' : ''}" href="${TILE_DIR}${stone.file}.png"
        x="${ox}" y="${oy}" width="${CELL}" height="${CELL}" preserveAspectRatio="none"
        ${stone.rotation ? `transform="rotate(${stone.rotation} ${ox + CELL / 2} ${oy + CELL / 2})"` : ''}/>`).join('');
    }).join('');

    const size = CELL - 16;
    const tiles = Object.values(map.tiles).map((tile) => {
      const setting = settingDef(tile.setting);
      const reachable = here.links.includes(tile.key) && x.status === 'exploring';
      const hidden = tile.state === 'hidden';
      const current = tile.key === map.position;
      const cls = ['tile', `state-${tile.state}`, hidden ? '' : `kind-${tile.kind}`,
        reachable ? 'reachable' : '', current ? 'current' : ''].join(' ');
      const label = hidden ? 'Unsurveyed' : `${setting.name} \u2014 ${tileWord(tile)}`;
      // What is in a room is never drawn — only that something is.
      const standing = hidden ? null : tileArt(tile);
      const mark = !standing ? '' : (() => {
        const size = CELL * standing.size;
        if (standing.glyph) return `<g class="holds">${glyphMark(standing.glyph, cx(tile), cy(tile), size)}</g>`;
        if (standing.prop) {
          return `<g class="holds"><image class="held${standing.spent ? ' spent' : ''}" href="${TILE_DIR}${standing.prop}.png"
            x="${(cx(tile) - size / 2).toFixed(1)}" y="${(cy(tile) - size / 2).toFixed(1)}"
            width="${size.toFixed(1)}" height="${size.toFixed(1)}"
            preserveAspectRatio="xMidYMid meet"/></g>`;
        }
        if (standing.mob) return `<g class="holds">${mobToken(standing.mob, cx(tile), cy(tile), size)}</g>`;
        return '';
      })();
      return `<g class="${cls}" style="--tint:${setting.color}"
          ${reachable ? `data-act="move" data-key="${tile.key}" role="button" tabindex="0"` : ''}>
        <title>${esc(label)}</title>
        <rect class="hit" x="${PAD + tile.x * CELL + 1}" y="${PAD + tile.y * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}"/>
        <rect class="floor" x="${PAD + tile.x * CELL + 8}" y="${PAD + tile.y * CELL + 8}" width="${size}" height="${size}" rx="4"/>
        ${mark}
        ${current ? partyToken(cx(tile), cy(tile)) : ''}
        ${tile.state === 'cleared' && tile.challenge ? `<path class="done" d="M${cx(tile) + 10} ${cy(tile) - 20} l4 5 8-9"/>` : ''}
      </g>`;
    }).join('');

    // Which way you can go, drawn as a way rather than as a box: an arrow in
    // the gap between this room and the next, pointing at it. The arrow is the
    // control; the room behind it stays clickable for a forgiving aim.
    const ways = x.status !== 'exploring' ? '' : here.links.map((key) => {
      const next = map.tiles[key];
      if (!next) return '';
      const dx = Math.sign(next.x - here.x);
      const dy = Math.sign(next.y - here.y);
      const turn = dx === 1 ? 0 : dx === -1 ? 180 : dy === 1 ? 90 : 270;
      const mx = (cx(here) + cx(next)) / 2;
      const my = (cy(here) + cy(next)) / 2;
      const seen = next.state !== 'hidden';
      const where = next.state === 'cleared' ? 'Back through' : seen ? 'On to' : 'Into';
      const what = next.state === 'hidden' ? 'somewhere unsurveyed' : esc(tileWord(next));
      return `<g class="way ${next.state === 'cleared' ? 'known' : ''}" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${turn})"
          data-act="move" data-key="${key}" role="button" tabindex="0">
        <title>${where} ${what}</title>
        <circle class="pad" r="17"/>
        <path class="barb" d="M-7 -9 6 0 -7 9 -3 0Z"/>
      </g>`;
    }).join('');

    // Region names lettered across the country they cover, as a map would.
    // The settings a floor is tiled from used to be written across it, one
    // name floating over the middle of each one's cells. On a surveyor's sheet
    // that read as a region label; on painted ground it reads as a caption
    // nobody asked for, naming country the party has not seen yet. The floor
    // says what it is by looking like what it is, and the place's own name is
    // on the cartouche in the corner.

    return `<section class="panel floorpanel fill">
      <header>
        <div><h2>${esc(game.place ? game.place.name : depth.name)}</h2>
        <p class="hint">${esc(depth.name)} &middot; carrying <b>${x.pending.gold}</b> gold<span class="longform"> that is not yours yet</span> &middot; loot &times;${x.multiplier}</p></div>
        <span class="buttons">${ui.confirmExit && x.status === 'exploring'
          ? `<button class="action" data-act="withdraw-go" type="button">Climb out for good</button>
             <button class="ghost" data-act="withdraw-stay" type="button">Stay down here</button>`
          : `${menuButton()}<button class="ghost" data-act="withdraw-ask" type="button" ${x.status === 'exploring' ? '' : 'disabled'}>${
            x.mode === 'tower' ? 'Leave' : 'Climb out'} with ${x.pending.gold}</button>`}</span>
      </header>
      <div class="maprail scroller"><svg class="map ${stonework || wildwork ? 'stone-floor' : ''} ${outdoors ? 'out-of-doors' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Map of ${esc(depth.name)}">
        ${mapDefs(w, h)}
        <rect class="vellum" x="0" y="0" width="${w}" height="${h}"/>
        ${groundwork}
        <rect class="grain" x="0" y="0" width="${w}" height="${h}"/>
        <rect class="rule outer" x="10" y="10" width="${w - 20}" height="${h - 20}"/>
        <rect class="rule inner" x="15" y="15" width="${w - 30}" height="${h - 30}"/>
        <!-- Out of doors the country runs end to end: the floor's own ground
             tiled across the whole sheet, with its average color under it for
             a page that cannot fetch the art. Fog of war hides what is in a
             clearing, not that there is grass there, so walked and unwalked
             are the same ground and only what stands on it changes.
             A dungeon is the other way round. Nobody expects to see the far
             end of a barrow before they have walked it, and tiling stone over
             the whole sheet made the unwalked parts look surveyed — so down
             there the sheet stays the vellum it is drawn on, and the stone
             appears room by room as you find it. -->
        ${stoneReady && outdoors ? `<rect class="fog" x="0" y="0" width="${w}" height="${h}" fill="${tintOf(floorSet)}"/>
        <rect class="everyground" x="0" y="0" width="${w}" height="${h}" fill="url(#ground-${floorSet})"/>` : ''}
        <g class="stonework">${stonework}${wildwork}</g>
        ${zoneTint ? `<rect class="weather" width="${w}" height="${h}" fill="${zoneTint}"/>` : ''}
        <g class="corridors">${corridors}</g>${tiles}
        <g class="ways">${ways}</g>
        ${compassRose(w - PAD - 14, PAD + 20, 50)}
        <text class="cartouche" x="${PAD - 12}" y="${h - 18}">${esc(game.place ? game.place.name : depth.name)}</text>
        <rect class="vignette" x="0" y="0" width="${w}" height="${h}"/>
      </svg>${over}</div>
    </section>`;
  }

  // --- Encounter ----------------------------------------------------------

  // Where you are and what is at stake, for the states that hide the map.
  function bearings() {
    const x = game.expedition;
    const tile = game.tile;
    const out = game.downed();
    if (x.mode === 'tower') {
      return `<p class="bearings">${esc(TOWER.name)} &middot; ${esc(settingDef(tile.setting).name)}
        &middot; the <b>${ordinal(x.level)}</b> floor &middot; carrying <b>${x.pending.gold}</b> gold${
        (x.pending.gear || []).length ? ` and <b>${x.pending.gear.length}</b> ${x.pending.gear.length === 1 ? 'piece of kit' : 'pieces of kit'}` : ''}${
        out.length ? ` &middot; <b class="outcold">${out.map((m) => esc(m.name)).join(', ')} down</b>` : ''}
        <span class="bearings-ctl">${menuButton()}</span></p>`;
    }
    const depth = game.runDepth;
    return `<p class="bearings">${esc(game.place ? game.place.name : depth.name)} &middot; ${esc(settingDef(tile.setting).name)}
      &middot; carrying <b>${x.pending.gold}</b> gold${(x.pending.gear || []).length
        ? ` and <b>${x.pending.gear.length}</b> ${x.pending.gear.length === 1 ? 'piece of kit' : 'pieces of kit'}` : ''} &middot; loot &times;${x.multiplier}${
        out.length ? ` &middot; <b class="outcold">${out.map((m) => esc(m.name)).join(', ')} down</b>` : ''}
      <span class="bearings-ctl">${menuButton()}</span></p>`;
  }

  // The masthead and the Chronicle are a third of a wide screen between them,
  // and every screen here would rather have it — the floor plan most of all,
  // but the maps and the camp rail too. This is the pair that takes it and
  // gives it back, with a door into Settings for while the masthead is away.
  // Whichever way it is set, it stays set.
  // One button, not a row of glyphs. Full screen, the Chronicle and Settings
  // were three small symbols in every header, each of which had to be learned;
  // they are three lines of plain English behind a button that says Menu.
  // Exactly one of these is on the screen at a time: the masthead carries the
  // menu while it is showing, and a header carries it once full screen has
  // taken the masthead away. Two buttons both saying Menu is one too many.
  // The menu wears a d10 with three of the game's own symbols painted on its
  // faces. Traced off the drawing in assets/decoration rather than shown as
  // one: a path takes its color from the button around it, stays sharp at
  // any size, and costs nothing to fetch.
  //
  // The geometry is the drawing's, read off it: apex, two equator shoulders,
  // the low middle vertex where the near faces meet, and the bottom point.
  const D10 = {
    outline: 'M50 3 L97 57 L50 97 L3 57 Z',
    facets: ['M50 3 L26.5 47 L50 55.5 L73.5 47 Z', 'M3 57 L26.5 47 L50 55.5 L50 97 Z',
      'M97 57 L73.5 47 L50 55.5 L50 97 Z'],
    pips: [['wild', 50, 33, 27], ['might', 30, 69, 18], ['arcana', 70, 69, 18]],
  };

  function d10Icon() {
    const pip = ([id, px, py, size]) => {
      const k = size / 24;
      return `<g transform="translate(${(px - size / 2).toFixed(1)} ${(py - size / 2).toFixed(1)}) scale(${k.toFixed(3)})"
        style="--face:${SYMBOLS[id].color}"><path class="pip" fill-rule="evenodd" d="${SYMBOLS[id].art}"/></g>`;
    };
    return `<svg class="d10" viewBox="0 0 100 100" aria-hidden="true">
      <path class="shell" d="${D10.outline}"/>
      ${D10.facets.map((d) => `<path class="facet" d="${d}"/>`).join('')}
      ${D10.pips.map(pip).join('')}
    </svg>`;
  }

  // Which picture the page is wearing. Dim rooms and lit desks are told apart
  // by the class, because a scrim that works over a candle-lit hall washes out
  // a photograph of a table in daylight.
  const SCENE_KINDS = ['tome', 'desk', 'camp', 'hall', 'mouth', 'delve'];
  const SHADES = ['stone', 'sewer', 'chase', 'wood', 'fen'];

  function pageScene() {
    const zone = zoneById(ui.zone);
    if (!game.hero || ui.stage === 'select' || ui.log) return { kind: 'tome', url: TOME };
    if (ui.settings) return { kind: 'desk', url: DESK };
    if (game.needsPathChoice || ui.tab === 'camp') {
      return { kind: 'camp', url: havenUrl('camp', zone && zone.id) };
    }
    if (ui.tab === 'hall') return { kind: 'hall', url: havenUrl('hall', zone && zone.id) };
    if (game.expedition) {
      const floor = floorOf(game.expedition.map.settings);
      return { kind: 'delve', url: backdropUrl(floor), shade: floor };
    }
    if (ui.tab === 'tower') return { kind: 'delve', url: backdropUrl('stone'), shade: 'stone' };
    if (ui.mustering && ui.place) {
      const place = placeById(ui.place);
      if (place) return { kind: 'mouth', url: `${SCENE_DIR}/${sceneOf(place)}.jpg` };
    }
    return { kind: 'desk', url: DESK };
  }

  // Where the menu's camp and hall lead: the country you are in, then the last
  // one you were in, and only failing both the first on the map.
  function menuZone() {
    return ui.zone || ui.lastZone || (ZONES[0] && ZONES[0].id) || null;
  }

  // One button, in the same corner of the window on every screen. It used to
  // be repeated in each panel's header, which put it somewhere slightly
  // different every time you needed it; the hand wants one place.
  function menuButton() {
    return '';
  }

  function renderDock() {
    if (!dockEl) return;
    const show = Boolean(game.hero) && ui.stage !== 'select' && !ui.settings && !game.needsPathChoice;
    dockEl.hidden = !show;
    if (!show) { dockEl.innerHTML = ''; return; }
    dockEl.innerHTML = `<button class="ghost menubtn" data-act="menu" type="button"
      aria-haspopup="true" aria-expanded="${ui.menu}">${d10Icon()}<span>Menu</span></button>`;
  }

  // The menu is a sheet over the page rather than anything inside a panel:
  // every screen rebuilds its own markup, and a menu that lived in a header
  // would be torn down and rebuilt under the hand that opened it.
  function renderMenu() {
    if (!menuEl) return;
    menuEl.hidden = !ui.menu;
    if (menuEl.hidden) { menuEl.innerHTML = ''; return; }
    const item = (act, label, hint, on, off = false) => `<button class="menuitem" data-act="${act}" type="button"
      ${off ? 'disabled' : ''}${on === undefined ? '' : ` aria-pressed="${on}"`}><b>${label}</b><em>${hint}</em></button>`;
    // Camp and the hall are places in a country rather than tabs, which is
    // right on the map and wrong everywhere else: from inside a floor plan or
    // a character sheet they were three screens away. The menu is the one
    // thing on every screen, so it is where the short way in belongs.
    const zone = zoneById(menuZone());
    const under = Boolean(game.expedition);
    menuEl.innerHTML = `<div class="menuback" data-act="menuclose"></div>
      <div class="menucard" role="menu">
        ${item('wide', ui.wide ? 'Show the masthead' : 'Full screen',
          ui.wide ? 'Bring back the title bar and the Chronicle.' : 'Give the whole window to the board.', ui.wide)}
        ${game.hero && under ? item('carryon', 'Carry on', 'Back to the floor, where your party is waiting.',
          ui.tab === 'road' && !ui.sheet && !ui.log && !ui.settings) : ''}
        ${game.hero && !under ? item('tomapscreen', 'Map',
          ui.zone ? `Back out to ${esc(zoneById(ui.zone).name)} and the road.` : 'Odyssia, and everywhere in it.',
          ui.tab === 'road' && !ui.sheet && !ui.log) : ''}
        ${game.hero && zone ? item('gocamp', 'Campfire',
          under ? 'You are underground. Finish what you started.'
            : `Rest, train and mend your kit at the ${esc(zone.name)} campfire.`, ui.tab === 'camp', under) : ''}
        ${game.hero && zone ? item('gohall', 'Town Hall',
          under ? 'You are underground. Finish what you started.'
            : `Hire, and see what the anvil has, at ${esc(zone.name)}.`, ui.tab === 'hall', under) : ''}
        ${game.hero ? item('totower', 'The Clocktower', under
          ? 'You are already out. Finish what you started.'
          : 'A clockwork tower with no top, and a landing on every floor to stop on.', ui.tab === 'tower', under) : ''}
        ${game.hero ? item('sheet', 'Character sheet', 'Your dice, your kit, and what it is doing to them.', ui.sheet) : ''}
        ${item('toselect', 'Change character', game.hero
          ? `Put ${esc(game.hero.name)} down and play somebody else.`
          : 'Choose who you are playing.', ui.stage === 'select', under)}
        ${game.hero ? item('coopmenu', 'Play together', under
          ? 'You are underground. Finish what you started.'
          : ui.relay ? 'Open a quest, or join a friend\u2019s with their code.' : 'Open a quest in two tabs, or join one with a code.',
          ui.coop, under) : ''}
        ${item('chronicle', 'Chronicle', 'Everything that has happened so far.', ui.log)}
        ${item('settings', 'Settings', 'Sound, and how the dice behave.')}
      </div>`;
  }

  function trialsMarkup() {
    const x = game.expedition;
    const challenge = x.encounter ? x.encounter.challenge : game.tile.challenge;
    const at = x.encounter ? x.encounter.trialIndex : 0;
    const picking = ui.selectedDie !== null || ui.transmuteDie !== null;
    return challenge.trials.map((trial, i) => {
      const cls = i === at ? 'current' : i < at ? 'done' : '';
      const slots = trial.required.map((sym, slotIndex) => {
        const filled = trial.matched[slotIndex];
        let choosable = false;
        if (picking && i === at && !filled && x.encounter) {
          choosable = ui.transmuteDie !== null
            ? true
            : x.encounter.availableMatches().some((p) => p.dieIndex === ui.selectedDie && p.slotIndex === slotIndex);
        }
        const tag = choosable ? 'button' : 'div';
        const attrs = choosable ? ` type="button" data-act="slot" data-index="${slotIndex}" data-symbol="${sym}"` : '';
        return `<${tag} class="slot ${filled ? 'filled' : ''} ${choosable ? 'choosable' : ''}"${attrs}
          style="--face:${SYMBOLS[sym].color}" title="${esc(SYMBOLS[sym].name)}">${icon(sym)}</${tag}>`;
      }).join('');
      return `<div class="trial ${cls}"><span class="label">Trial ${i + 1}</span>${slots}</div>`;
    }).join('');
  }

  function renderActorPicker() {
    const x = game.expedition;
    const tile = game.tile;
    const wanted = tile.challenge.trials.flatMap((t) => t.required.filter((_, i) => !t.matched[i]));
    const party = x.partyUids.map((uid) => game.member(uid));
    const standing = party.filter((m) => !m.down);
    const wants = Math.min(PARTY_PER_ROOM, standing.length);
    const chosen = ui.pair.filter((uid) => standing.some((m) => m.uid === uid));
    const going = chosen.map((uid) => game.member(uid));
    // Who fought the last room, who sat it out, and — for the pair chosen so
    // far — who would go in winded. The count below is the real one.
    const fresh = game.fresh();
    const rotating = standing.some((m) => m.streak) && fresh.length > 0 && standing.length > PARTY_PER_ROOM;
    const winded = game.winded(chosen);
    const boon = tile.challenge.hazard ? 0 : x.boon;
    const alone = going.length === 1 ? ALONE_DICE : 0;
    const pool = going.length ? assembleDice(going, boon + alone, winded).length : 0;
    const short = going.length === wants && pool < wanted.length;

    // One compact row each, so the whole choice sits above the fold however
    // many companions you brought.
    const picks = party.map((m) => {
      if (m.down) {
        return `<div class="pick out">
          <span class="pick-who"><b>${esc(m.name)}</b><em>${esc(m.title)}</em></span>
          <span class="pick-dice"><em class="outcold">Unconscious</em></span>
        </div>`;
      }
      const on = chosen.includes(m.uid);
      const score = Math.round(affinity(m, wanted, standing.filter((o) => o.uid !== m.uid)) * 100);
      const tired = winded.get(m.uid) || 0;
      const dice = woundedDice(m, tired).map((d) => dieMarkup(d, null, { mini: true })).join('');
      const rooms = m.streak || 0;
      const breath = !rotating ? ''
        : tired ? ` &middot; <span class="hurt">winded, &minus;${tired}</span>`
          : rooms ? ` &middot; <span class="tiredtag">${rooms} ${rooms === 1 ? 'room' : 'rooms'} without a rest</span>`
            : ' &middot; <span class="freshtag">fresh</span>';
      return `<button class="pick ${on ? 'chosen' : ''}" data-act="actor" data-uid="${m.uid}"
          type="button" aria-pressed="${on}">
        <span class="pick-who"><b>${esc(m.name)}</b><em>${esc(m.title)} &middot; ${
          m.isHero ? 'level' : 'rank'} ${m.isHero ? m.level : m.rank}${
          m.wounds ? ` &middot; <span class="hurt">wounded, &minus;${m.wounds}</span>` : ''}${breath}</em></span>
        <span class="pick-dice">${dice}</span>
        <span class="pick-fit"><i style="width:${score}%"></i></span>
        <span class="pick-score">${score}%</span>
      </button>`;
    }).join('');

    const ready = going.length === wants;
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div class="foe">${foePlate(tile.challenge)}<div><h2>${esc(tile.challenge.name)}${foeBadges(tile.challenge)}</h2>
        <p class="hint">${tile.challenge.hazard ? hazardHint(tile.challenge) : esc(settingDef(tile.setting).blurb)}</p></div></div></header>
      <div class="trials">${trialsMarkup()}</div>
      <h3 style="margin-top:14px">${wants > 1 ? 'Who takes this, and who goes with them?' : 'Who takes this?'}</h3>
      <p class="hint">${tile.challenge.hazard
        ? (wants > 1
          ? 'Two go at it and throw their hands together as one tray. Nobody goes down to it: beat it and you pass for free, fail it and you pass anyway, and pay.'
          : 'Only one of you can go at it. Nobody goes down to it: beat it and you pass for free, fail it and you pass anyway, and pay.')
        : x.fallen
        ? `<b>${esc(x.fallen)} went down here.</b> The room has not let you go: whoever is still standing has to take it, from the top. There is no walking past it and no climbing out until it is cleared.`
        : wants > 1
          ? 'Two go in and throw their hands together as one tray. If the room beats them, one of the two does not get up — and you choose which.'
          : 'Nobody else can stand, so this one goes in alone.'}</p>
      ${rotating ? `<p class="hint">While somebody fresh waits outside, everyone else goes in <b>winded</b>: a die short for every room they have taken without sitting one out. Fresh: <b>${esc(game.who(fresh))}</b>.</p>` : ''}
      <div class="picks">${picks}</div>
      <div class="launch">
        <span class="meta">${going.length
          ? `${esc(game.who(going))} — <b>${pool}</b> dice against <b>${wanted.length}</b> ${wanted.length === 1 ? 'symbol' : 'symbols'}${
            short ? ', which cannot finish it' : ''}`
          : `Choose ${wants === 1 ? 'who goes' : 'two'}.`}</span>
        <button class="action" data-act="sendin" type="button" ${ready ? '' : 'disabled'}>Go in</button>
      </div>
      ${(() => {
        const curios = trinketButtons(['pole', 'salts', 'wayfarer']);
        return curios ? `<div class="buttons curios">${curios}</div>` : '';
      })()}
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // Two went in; one of them is not walking out, and which is the player's.
  function renderFalling() {
    const x = game.expedition;
    const going = game.actors;
    const cards = going.map((m) => `<button class="pick" data-act="fall" data-uid="${m.uid}" type="button">
      <span class="pick-who"><b>${esc(m.name)}</b><em>${esc(m.title)} &middot; ${
        m.isHero ? 'level' : 'rank'} ${m.isHero ? m.level : m.rank}</em></span>
      <span class="pick-dice">${companionDice(m).map((d) => dieMarkup(d, null, { mini: true })).join('')}</span>
    </button>`).join('');
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div class="foe">${foePlate(game.tile.challenge, 64)}<div><h2>Beaten</h2>
        <p class="hint">${esc(upper(named(game.tile.challenge)))} has the better of them.</p></div></div></header>
      ${x.hopeless ? '<p class="doomed">The end was inevitable, nothing you had left could have defeated it.</p>' : ''}
      <h3 style="margin-top:6px">Who does not get up?</h3>
      <p class="hint">One of the two is carried out cold and is good for nothing until the company rests. The other walks back into this room, because the room is not finished with you.</p>
      <div class="picks">${cards}</div>
      ${(() => {
        const out = trinketButtons(['wayfarer']);
        return out ? `<p class="hint" style="margin-top:12px">Or nobody stays down here at all: the whole company goes home, with everything it is carrying.</p>
          <div class="buttons curios">${out}</div>` : '';
      })()}
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  function renderEncounter() {
    const x = game.expedition;
    const e = x.encounter;
    const going = game.actors;
    const actor = going[0] || game.hero;
    const actions = e.legalActions();
    const matches = e.availableMatches();
    const rolling = ui.rolling;

    // The hand, sorted by what it can do. A die that answers the trial is a
    // decision; a die that cannot is a cost. Mixed into one row they read as
    // the same thing, so the ones that can be played sit above the ones that
    // cannot — the order inside each row is the order they were thrown, and
    // every die keeps its own index whichever row it is in.
    const targeting = ui.pendingAbility !== null;
    // When a die could answer more than one symbol — a wild face, or a die
    // being transmuted — the choices open on the die itself, where the eye
    // already is, instead of lighting up slots somewhere above it. The slots
    // still answer a click, for anybody who would rather aim at them.
    const choicesFor = (i) => {
      let options = [];
      if (ui.transmuteDie === i) {
        options = wantedSymbols(e).map((sym) => ({
          sym, slot: e.trial.required.findIndex((r, j) => !e.trial.matched[j] && r === sym),
        }));
      } else if (ui.selectedDie === i && ui.reshaped === null) {
        const seen = new Set();
        matches.filter((p) => p.dieIndex === i).forEach((p) => {
          const sym = e.trial.required[p.slotIndex];
          if (!seen.has(sym)) { seen.add(sym); options.push({ sym, slot: p.slotIndex }); }
        });
      }
      if (!options.length) return '';
      return `<span class="facepick" role="group" aria-label="${ui.transmuteDie === i ? 'Turn it into' : 'Answer'}">
        ${options.map(({ sym, slot }) => `<button class="pickface" type="button" data-act="slot" data-index="${slot}"
          data-symbol="${sym}" style="--face:${SYMBOLS[sym].color}" title="${esc(SYMBOLS[sym].name)}"
          aria-label="${esc(SYMBOLS[sym].name)}">${icon(sym)}</button>`).join('')}
        <button class="pickface shut" type="button" data-act="unpick" title="Not this die" aria-label="Not this die">&times;</button>
      </span>`;
    };
    const drawDie = (entry, i) => {
      const die = dieMarkup(entry.die, entry.face, {
        index: i,
        state: [
          ui.reshaped === i ? 'reshaped' : '',
          targeting ? 'targetable' : matches.some((p) => p.dieIndex === i) ? 'matchable' : actions.canDiscard ? '' : 'dead',
          game.owns(entry.die.ownerId) ? '' : 'theirs',
        ].join(' '),
        pressed: ui.selectedDie === i || ui.transmuteDie === i,
        rolling,
        order: i,
      });
      const choices = choicesFor(i);
      return choices ? `<span class="diepick">${die}${choices}</span>` : die;
    };
    const live = [];
    const idle = [];
    e.tray.forEach((entry, i) => {
      (matches.some((p) => p.dieIndex === i) ? live : idle).push(drawDie(entry, i));
    });
    // Sorted on the throw itself, not a beat later: the first look at a fresh
    // hand is exactly when it helps to see what answers and what does not.
    // While an ability is picking a target every die is a target, so there is
    // nothing to sort.
    const sorted = !targeting && live.length > 0 && idle.length > 0;
    // A shared quest with one player's character in the room beside the
    // other's: each plays only the dice their own people brought. Both hands
    // are on the table for everybody to see, a column per player headed with
    // who they are and who of theirs is in the room, and the other player's
    // column cannot be pressed.
    const partner = going.find((m) => !game.owns(m.uid));
    const split = Boolean(partner);
    const column = (mine) => {
      const rowLive = [];
      const rowIdle = [];
      e.tray.forEach((entry, i) => {
        if (game.owns(entry.die.ownerId) !== mine) return;
        (!targeting && matches.some((p) => p.dieIndex === i) ? rowLive : rowIdle).push(drawDie(entry, i));
      });
      const people = going.filter((m) => game.owns(m.uid) === mine);
      const peer = !mine && people[0] ? x.owners[people[0].uid] : null;
      const player = mine ? 'You' : (peer && ui.session ? peerName(peer) : people.map((m) => m.name).join(' and '));
      return `<div class="traycol ${mine ? 'mine' : 'theirs'}">
        <p class="trayowner"><b>${esc(player)}</b>${people.length && game.who(people) !== player ? ` &middot; ${esc(game.who(people))}` : ''}${
          mine ? '' : ' &middot; <em>they play these</em>'}</p>
        <div class="tray">${[...rowLive, ...rowIdle].join('') || '<span class="tray-empty">Nothing left in this hand.</span>'}</div>
      </div>`;
    };
    const tray = split
      ? `<div class="traycols">${column(true)}${column(false)}</div>`
      : sorted
      ? `<div class="tray live">${live.join('')}</div><div class="tray idle">${idle.join('')}</div>`
      : `<div class="tray">${[...e.tray.map(drawDie)].join('') || '<span class="tray-empty">The tray is empty.</span>'}</div>`;

    // The one button you press most, put where you are already looking. On a
    // wide screen the throw sits in the middle of the table with the dice that
    // answer directly under it; the foot keeps its copy for a phone, where the
    // table has no room to spare and the thumb is at the bottom anyway.
    const rollHere = `<div class="rollhere">
      <button class="action" data-act="reroll" type="button" ${actions.canReroll ? '' : 'disabled'}>Roll again</button>
    </div>`;

    // A trick belongs to whoever it came from; on a shared quest only its
    // owner may spend it.
    const abilities = e.abilities.map((a) => `<button class="ghost ability-btn" data-act="ability" data-id="${a.id}" type="button"
        aria-pressed="${ui.pendingAbility === a.id}" ${e.canUse(a.id) && (!a.uid || game.owns(a.uid)) ? '' : 'disabled'}
        title="${esc(a.text)} \u2014 ${a.left} of ${a.charges} left until a long rest">${esc(a.name)} <b>&times;${a.left}</b></button>`).join('');

    const instruction = ui.reshaped !== null
      ? 'The die turns into what the trial wants, and goes where it was turned for.'
      : ui.transmuteDie !== null
      ? 'Choose on the die the symbol it should become.'
      : ui.pendingAbility
        ? 'Choose a die to use it on.'
        : ui.selectedDie !== null
          ? 'That die shows a wild face — choose on the die which symbol it answers.'
          : split && actions.canMatch && !matches.some((p) => game.owns(e.tray[p.dieIndex].die.ownerId))
            ? `The match on the table is in ${partner.name}\u2019s dice. ${partner.name} has to play it.`
          : actions.canMatch
            ? (e.spentThisRound === 0 ? 'A match is on the table. You must take it.' : 'Take another match, or push your luck and roll again.')
            : e.spentThisRound === 0
              ? (split ? `Nothing answers. You or ${partner.name} spends one of your own dice to clear it, then roll again.`
                : 'Nothing answers. Spend a die to clear it, then roll again.')
              : 'Nothing else answers, and the die is already placed. Roll again.';

    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div class="foe">${foePlate(e.challenge, 64)}<div><h2>${esc(e.challenge.name)}${foeBadges(e.challenge, { pressing: true })}</h2>
        <p class="hint"><b>${esc(game.who(going))}</b> hold <b>${e.diceLeft}</b> dice &middot; round ${e.rounds}${e.discarded ? ` &middot; ${e.discarded} wasted` : ''}</p></div></div></header>
      <div class="trials">${trialsMarkup()}</div>
      <div class="scroller tabletop">${rollHere}${tray}</div>
      <div class="panelfoot encfoot">
        <button class="action rollfoot" data-act="reroll" type="button" ${actions.canReroll ? '' : 'disabled'}>Roll again</button>
        ${abilities}
        ${trinketButtons(['wayfarer'])}
        <p class="hint instruction">${instruction}${e.challenge.pressure ? ' Every second roll here costs a die.' : ''}${
          e.challenge.hazard ? ` ${esc(HAZARD_COSTS[hazardDef(e.challenge.hazard).cost])}` : ''}</p>
        <p class="notice">${esc(ui.notice)}</p>
      </div>
    </section>`;
  }

  function renderWatching() {
    const x = game.expedition;
    const e = x.encounter;
    const actor = game.actors[0] || game.hero;
    const tray = e.tray.map((entry, i) => dieMarkup(entry.die, entry.face, { state: 'dead', rolling: ui.rolling, order: i })).join('');
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div class="foe">${foePlate(e.challenge, 64)}<div><h2>${esc(e.challenge.name)}</h2>
      <p class="hint"><b>${esc(actor.name)}</b> is rolling. ${e.diceLeft} dice left, round ${e.rounds}.</p></div></div></header>
      <div class="trials">${trialsMarkup()}</div>
      <div class="tray">${tray}</div>
      <p class="hint">Watching. Your turn comes with your own character.</p>
    </section>`;
  }

  // A creature found on a floor: the same card whether you are coaxing it or
  // deciding what to do with it once it has given in.
  function creatureCard(wild) {
    const def = companionDef(wild.defId);
    const rarity = RARITIES[def.rarity];
    return `<div class="companion" style="--rarity:${rarity.color}">
      <h3>${esc(def.name)}</h3>
      <p class="title">${esc(def.title)} &middot; <span style="color:${rarity.color}">${rarity.name}</span></p>
      <div class="dicerow">${def.proficiencies.map((pid) => dieMarkup(makePowerDie('preview', 6, pid), null, { mini: true })).join('')}</div>
      <p class="blurb">${esc(def.blurb)}</p>
    </div>`;
  }

  // A chest at the end of a dead end, and nothing to say what it is. Open it
  // or leave it; a pole, if the company carries one, can ask it first.
  function renderChest() {
    const x = game.expedition;
    const tile = game.tile;
    const chest = tile.chest || {};
    const known = chest.known
      ? (chest.mimic
        ? '<p class="doomed">The stick found teeth. Open it and it is a fight: two go in, and it pays like a hoard if they win.</p>'
        : '<p class="hint"><b>The stick found planks, and only planks.</b> Whatever else it is, it is a chest.</p>')
      : '<p class="hint">It looks like what you came for. So does the one thing down here that has learned to look like what you came for. Some honest chests are trapped as well.</p>';
    const curios = trinketButtons(['pole', 'wayfarer']);
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div class="foe"><svg class="plate" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
        <image href="${TILE_DIR}prop_chest.png" x="4" y="4" width="64" height="64" preserveAspectRatio="xMidYMid meet"/></svg>
        <div><h2>A chest<span class="badge">Hoard</span></h2>
        <p class="hint">At the end of the passage, where nobody would leave anything by accident.</p></div></div></header>
      ${known}
      <div class="buttons" style="margin-top:12px">
        <button class="action" data-act="openchest" type="button">Open it</button>
        <button class="ghost" data-act="leavechest" type="button">Leave it shut</button>
      </div>
      ${curios ? `<div class="buttons curios">${curios}</div>` : ''}
      <p class="hint" style="margin-top:10px">Left shut, it waits here. Open, it is either gold and perhaps kit &mdash; or a fight.</p>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  function renderOffer() {
    const x = game.expedition;
    const wild = game.wild;
    const pay = game.wildPayment(wild.price);
    const afford = !pay.short;
    const split = pay.fromBank && afford
      ? `<b>${pay.fromPack}</b> out of the <b>${x.pending.gold}</b> in the pack and <b>${pay.fromBank}</b> sent up from the <b>${game.state.gold}</b> banked at camp`
      : `<b>${wild.price}</b> out of the <b>${x.pending.gold}</b> you are carrying`;
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div><h2>Something is living here<span class="badge">Lair</span></h2>
        <p class="hint">It is wary rather than hostile. Coin, or something shiny out of the pack, would settle it.</p></div></header>
      <div class="pursebar" role="group" aria-label="What you have to spend">${
        coinChip('In the pack', x.pending.gold, x.pending.gold <= 0)}${
        game.sharedQuest ? '' : coinChip('Banked', game.state.gold, game.state.gold <= 0)}</div>
      <div class="grid" style="margin-top:10px">${creatureCard(wild)}</div>
      <p class="hint" style="margin-top:12px">It wants <b>${wild.price}</b> gold: ${split}. Pay and the creature is sent straight up to camp \u2014 safe even if this floor goes badly.</p>
      <div class="buttons" style="margin-top:10px">
        <button class="action" data-act="befriend" type="button" ${afford ? '' : 'disabled'}>Pay ${wild.price} gold${pay.fromBank ? ' (pack &amp; bank)' : ''}</button>
        <button class="ghost" data-act="leavewild" type="button">Leave it for now</button>
        <span class="hint" style="align-self:center">${afford
          ? 'It stays in its lair either way \u2014 come back through with fuller pockets and the offer stands.'
          : game.sharedQuest
            ? `A shared floor pays out of the pack alone, and you are <b>${pay.short}</b> short. It waits here: earn the rest below and walk back.`
            : `Pack and bank together come to <b>${x.pending.gold + game.state.gold}</b>, <b>${pay.short}</b> short. It waits here: earn the rest on this floor and walk back.`}</span>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  function renderSpoils() {
    const x = game.expedition;
    const wild = game.wild;
    return `<section class="panel encounter fill">
      ${bearings()}
      <header><div><h2>It gives in<span class="badge">Lair</span></h2>
        <p class="hint">Beaten, and watching you decide.</p></div></header>
      <div class="grid" style="margin-top:10px">${creatureCard(wild)}</div>
      <p class="hint" style="margin-top:12px">Send it up to camp and it is yours for good, whatever happens down here. Leave it and take <b>${x.bounty}</b> gold instead \u2014 which rides on the rest of this floor with everything else you are carrying.</p>
      <div class="buttons" style="margin-top:10px">
        <button class="action" data-act="takewild" type="button">Send it to camp</button>
        <button class="ghost" data-act="takebounty" type="button">Leave it, take ${x.bounty} gold</button>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  function renderResolution() {
    const x = game.expedition;
    const depth = game.runDepth;
    const won = x.status === 'complete';
    const seals = Object.entries(x.pending.seals).filter(([, n]) => n > 0)
      .map(([id, n]) => `${n} &times; ${esc(SEALS[id].name)}`).join(', ');

    // One last look at the creature you walked past. The purse it is bought
    // out of is the bank, which on a floor that beat you is all you have left.
    const stranded = game.strandedWild();
    const offer = !stranded ? '' : (() => {
      const def = companionDef(stranded.wild.defId);
      return `<div class="lastcall">
        <p><b>${esc(def.name)}</b> is still down there, ${esc(def.title)} &middot; <b>${stranded.wild.price}</b> gold.</p>
        ${stranded.afford
          ? `<button class="ghost" data-act="claimwild" type="button">Go back for ${esc(def.name)}</button>`
          : `<p class="hint">You have ${game.state.gold} gold in the bank. Not enough, and the walk home is long.</p>`}
      </div>`;
    })();

    return `<div class="mapover">
      <div class="outcome ${won ? 'good' : 'bad'}">
        <h3>${won ? (x.cleared ? `${esc(game.place ? game.place.name : depth.name)} is cleared.` : 'You climb out, purse in hand.') : 'Driven back.'}</h3>
        ${!won && x.hopeless ? '<p class="doomed">The end was inevitable, nothing you had left could have defeated it.</p>' : ''}
        ${won && (x.pending.gear || []).length
          ? `<p class="carried">Carried out: ${x.pending.gear.map((p) => esc(gearName(p))).join(', ')}.</p>` : ''}
        <p>${won ? `Banked: <b>${x.pending.gold}</b> gold${seals ? ` and ${seals}` : ''}.`
          : 'Everything you were carrying is left down there. The experience, at least, is yours.'}</p>
        ${offer}
        <div class="buttons"><button class="action" data-act="finish" type="button">Back to camp</button></div>
      </div>
    </div>`;
  }

  // --- The Iron Tower -------------------------------------------------------

  // The door. Who is coming, what it costs to walk in, and one paragraph of
  // the rule, because the rule is the whole game up there and nobody should
  // have to find it out by losing a climb.
  function renderTower() {
    const hero = game.hero;
    const worn = game.state.roster.filter((c) => c.stamina < TOWER_STAMINA).length;
    const ready = hero.stamina >= TOWER_STAMINA;
    const roster = game.state.roster.map((c) => memberCard(c, {
      as: 'button',
      pressed: ui.party.includes(c.uid),
      dim: c.stamina < TOWER_STAMINA,
      extra: c.stamina < TOWER_STAMINA ? '<p class="blurb">Too worn for the climb.</p>' : '',
    })).join('');
    const slots = [hero, ...ui.party.map((uid) => game.member(uid))];
    const empties = Math.max(0, game.companionSlots - ui.party.length);
    const order = [
      ...slots.map((m, i) => `<div class="slot ${i ? '' : 'lead'}"><b>${esc(m.name)}</b><span>${i ? 'companion' : 'you'}</span></div>`),
      ...Array.from({ length: empties }, () => '<div class="slot empty"><b>Empty</b><span>&nbsp;</span></div>'),
    ].join('');
    // With a quest open the Tower is climbed together: the host takes the
    // party up once somebody has joined, and everybody brings their own
    // character and whichever of their own companions they pick here.
    const session = ui.session;
    const together = Boolean(session);
    const gathered = together ? session.roster : [];
    const startButton = !together
      ? `<button class="action" data-act="towerstart" type="button" ${ready ? '' : 'disabled'}>Begin the climb</button>`
      : session.host
        ? `<button class="action" data-act="towerstart" type="button" ${gathered.length > 1 ? '' : 'disabled'}>Propose the Clocktower</button>`
        : '<span class="hint">The host takes the party up.</span>';
    const party = !together ? '' : `<div class="towerparty">
      <p class="hint">Quest <b class="code">${esc(session.code)}</b> &middot; ${gathered.length > 1
        ? `${esc(gathered.map((r) => r.member.name).join(' and '))} climb together.`
        : 'Waiting for somebody to join with the code.'}</p>
    </div>`;
    return `<section class="panel muster tower">
      <header>
        <span class="headctl"><button class="ghost backmap" data-act="tomapscreen" type="button">&larr; Map</button>${menuButton()}</span>
        <div><h2>${esc(TOWER.name)}</h2><p class="hint">${esc(TOWER.blurb)}</p></div>
        ${startButton}
      </header>
      ${party}
      <p class="required">Required Stamina: <b>${TOWER_STAMINA}</b>${worn ? ` &middot; ${worn} too worn to come` : ''}${
        ready ? '' : ' &middot; you are too worn yourself'}</p>
      <div class="towerrule">
        <p><b>One clocktower, and no top.</b> Every floor is a floor like any other &mdash; rooms, hoards,
        a boss at the far end &mdash; and each one is harder than the floor below it, for ever.</p>
        <p><b>Only one floor's takings ever leave.</b> Beat the boss and you are on a landing with what
        that floor paid on the table: take it and go home, or leave it there and climb for a bigger
        one. Climbing on empties your hands, and being beaten empties them anyway.</p>
        <p><b>Nothing in here wears your kit out.</b> You pay at the door, in stamina, and in whatever
        you were about to carry home.</p>
      </div>
      ${game.state.roster.length
        ? rail('towermuster', roster, { back: 'Earlier companions', on: 'Later companions' })
        : '<p class="hint">Nobody to take yet. The town hall is where you fix that.</p>'}
      <div class="marching">${order}</div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // A landing. The one decision the Tower is built out of, so it is the whole
  // screen: what this floor paid, what the next one asks, and two buttons.
  function renderLanding() {
    const x = game.expedition;
    const under = towerDepth(x.level + 1);
    const asks = Math.round(((under.trials[0] + under.trials[1]) / 2)
      * ((under.symbols[0] + under.symbols[1]) / 2));
    const here = towerDepth(x.level);
    const hereAsks = Math.round(((here.trials[0] + here.trials[1]) / 2)
      * ((here.symbols[0] + here.symbols[1]) / 2));
    const kit = x.pending.gear || [];
    const found = (x.pending.companions || []).map((id) => companionDef(id).name);
    return `<section class="panel encounter landing fill">
      ${bearings()}
      <header><div><h2>The ${esc(ordinal(x.level))} landing</h2>
        <p class="hint">The floor is cleared. What is on the table is yours the moment you turn round.</p></div></header>
      <div class="onthetable">
        <p class="take"><b>${x.pending.gold}</b> gold${x.pending.training
          ? `, <b>${x.pending.training}</b> lessons` : ''}</p>
        ${kit.map((piece) => `<p class="carried prizekit">${kitIcon(piece)}<span><b>${esc(gearName(piece))}</b><br>
          <em>${esc(describeGear(piece))}</em></span></p>`).join('')}
        ${found.length ? `<p class="carried prizekit"><span><b>${esc(found.join(', '))}</b><br>
          <em>Found up here, and willing</em></span></p>` : ''}
      </div>
      <p class="hint">Above you, the <b>${esc(ordinal(x.level + 1))}</b> floor: ${asks > hereAsks
        ? `rooms of about <b>${asks}</b> symbols against this floor's <b>${hereAsks}</b>`
        : `rooms asking about what this floor's did, <b>${asks}</b> symbols`}, and everything in it pays more.
        <b>Nothing on this table survives the stair.</b></p>
      ${(() => {
        // The honest sum, before the stair and not after it: what the two
        // best hands still standing throw between them, against what the
        // next floor's boss will ask. Wounds heal on the landing, so they
        // are left out.
        const hands = game.standing().map((m) => companionDice(m).length).sort((a, b) => b - a);
        const pair = hands.slice(0, PARTY_PER_ROOM).reduce((sum, n) => sum + n, 0)
          + (hands.length === 1 ? ALONE_DICE : 0);
        const boss = under.boss;
        const bossAsks = Math.round(((boss.trials[0] + boss.trials[1]) / 2) * ((boss.symbols[0] + boss.symbols[1]) / 2));
        const tight = bossAsks >= pair * 0.8;
        const who = hands.length > 1 ? 'Your two strongest throw'
          : x.partyUids.length > 1 ? 'Your last one standing throws' : 'You throw';
        return `<p class="hint${tight ? ' warnline' : ''}">${who}
          <b>${pair}</b> dice; the boss up there asks about <b>${bossAsks}</b> symbols.${
          bossAsks > pair ? ' More than you hold: short of tricks that give dice back, that boss cannot be beaten.'
            : tight ? ' That is close to all you have.' : ''}</p>`;
      })()}
      <div class="buttons">
        <button class="action" data-act="towertake" type="button">Take it and go home</button>
        <button class="ghost" data-act="towerclimb" type="button">Leave it, climb on</button>
      </div>
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // The foot of the tower, either way.
  function renderClimbEnd() {
    const x = game.expedition;
    const won = x.status === 'complete';
    return `<section class="panel encounter fill">
      <header><div><h2>${won ? `Down from the ${esc(ordinal(x.best || x.level))} floor` : `Beaten on the ${esc(ordinal(x.level))} floor`}</h2>
        <p class="hint">${esc(TOWER.name)}</p></div></header>
      <div class="outcome ${won ? 'good' : 'bad'}">
        ${won
          ? `${(x.pending.gear || []).length
            ? `<p class="carried">Carried out: ${x.pending.gear.map((p) => esc(gearName(p))).join(', ')}.</p>` : ''}
            <p>Banked: <b>${x.pending.gold}</b> gold${x.pending.training ? ` and <b>${x.pending.training}</b> lessons` : ''}.</p>`
          : `<p>${x.best ? `${esc(upper(ordinal(x.best)))} floor cleared, and nothing carried down from it.` : 'Not one floor cleared.'}
             Everything the Clocktower paid is still up there.</p>`}
        <div class="buttons"><button class="action" data-act="finish" type="button">Back to camp</button></div>
      </div>
    </section>`;
  }

  function renderVenture() {
    const x = game.expedition;
    if (!x) {
      if (ui.session && ui.coopScreen) return renderCoop() + renderLoadout();
      if (ui.mustering && ui.place) return renderCoop() + renderMuster();
      return renderCoop() + (ui.zone ? renderZone() : renderStrand());
    }
    if (x.mode === 'tower') {
      if (x.status === 'complete' || x.status === 'failed') return renderClimbEnd();
      if (x.status === 'landing') return renderLanding();
    }
    if (x.status === 'complete' || x.status === 'failed') return renderMap(renderResolution());
    if (x.status === 'chest') return renderChest();
    if (x.status === 'offer') return renderOffer();
    if (x.status === 'spoils') return renderSpoils();
    if (x.status === 'choosing') return renderActorPicker();
    if (x.status === 'falling') return renderFalling();
    if (x.status === 'encounter') return myTurn() ? renderEncounter() : renderWatching();
    const out = game.downed();
    const aside = [
      out.length
        ? `<p class="hint"><b class="outcold">${out.map((m) => esc(m.name)).join(' and ')} ${out.length === 1 ? 'is' : 'are'} unconscious</b> and will be carried out. ${game.standing().length} still standing \u2014 the floor is lost only when nobody is.</p>`
        : '',
      (() => {
        const salts = trinketButtons(['salts']);
        return salts ? `<div class="buttons curios">${salts}</div>` : '';
      })(),
      scryPanel(),
      (() => {
        const hurt = game.standing().filter((m) => m.wounds);
        return hurt.length ? `<p class="hint"><span class="hurt">${hurt.map((m) => `${esc(m.name)} &minus;${m.wounds}`).join(', ')}</span> \u2014 wounded, and throwing that many dice fewer until this floor is behind you.</p>` : '';
      })(),
      `<p class="hint longform">Pick a room you can reach. Cleared rooms are safe to walk back through; a fresh one is a fresh throw of the dice.</p>`,
      ui.notice ? `<p class="notice">${esc(ui.notice)}</p>` : '',
    ].join('');
    // An empty panel is worse than none: on a phone the standing instruction
    // is folded away, and if nothing else is happening there is nothing to say.
    return renderMap() + (aside.trim() ? `<section class="panel floornote">${aside}</section>` : '');
  }

  // --- Wiring -------------------------------------------------------------

  // Where the game is, as the room tone hears it.
  function sceneNow() {
    const x = game.expedition;
    if (ui.stage === 'select' || !game.hero) return music.scene('select');
    if (x) {
      const zone = game.place ? game.place.zone : null;
      if (x.status === 'complete') return music.scene('won', { zone });
      if (x.status === 'failed') return music.scene('lost', { zone });
      if (x.status === 'encounter') {
        const boss = Boolean(game.tile && game.tile.challenge && game.tile.challenge.boss);
        return music.scene('encounter', { zone, boss });
      }
      return music.scene('floor', { zone });
    }
    if (ui.tab === 'camp') return music.scene('camp');
    if (ui.tab === 'hall') return music.scene('hall');
    if (ui.zone) return music.scene('zone', { zone: ui.zone });
    return music.scene('strand');
  }

  // A throw that was still in the air when the room ended has nothing to land
  // on: clear the table rather than leave a die lying over the next screen.
  function clearTable() {
    const x = game.expedition;
    if (x && x.status === 'encounter') return;
    ui.throwToken++;
    document.body.classList.remove('throwing');
    const stage = root.querySelector('#dicestage');
    if (stage) { stage.hidden = true; stage.classList.remove('waiting'); }
  }

  function render() {
    ui.renderedAt = performance.now();
    clearTable();
    if (!ui.settings) sceneNow();
    // The board, given the whole window. Settings and the character list are
    // their own screens and want the masthead back while they are open.
    // Making a character takes the whole window too: the card is the only
    // thing on that screen, and it has to fit.
    const making = !game.hero && ui.stage !== 'select';
    root.ownerDocument.body.classList.toggle(
      'wide',
      (making || (ui.wide && Boolean(game.hero))) && !ui.settings && ui.stage !== 'select',
    );
    root.ownerDocument.body.classList.toggle('making-hero', making && !ui.settings);
    // The hall is a room you walk into, not a page about a room: the painting
    // takes the whole window and the panel sits on it like a notice board. The
    // page carries it rather than the panel, so the picture runs behind the
    // masthead and the Chronicle too.
    // No screen is blank paper. Every state names the place it is happening
    // in, and the page wears it: the roster is read out of a book, a posting is
    // chosen at a desk, a party is mustered at the mouth of the place it is
    // going into, and a floor is walked in the country it was cut from.
    const body = root.ownerDocument.body;
    const scene = pageScene();
    SCENE_KINDS.forEach((kind) => body.classList.toggle(`s-${kind}`, scene.kind === kind));
    // The shade over a picture takes its color from the ground underneath it:
    // a brown wash over a wood turns a green place the color of everywhere
    // else, which is the one thing a wood should not be.
    SHADES.forEach((shade) => body.classList.toggle(`shade-${shade}`, scene.shade === shade));
    body.classList.add('scened');
    body.style.setProperty('--scene', `url('${assetUrl(scene.url)}')`);

    const profiles = listProfiles();
    renderPurse();
    renderLog();
    renderMenu();
    renderDock();
    if (ui.settings) { view.innerHTML = renderSettings(); return; }
    if (ui.stage === 'select') {
      if (!ui.slots) refreshSlots();
      view.innerHTML = renderSelect();
      return;
    }
    if (!game.hero) { view.innerHTML = renderCreation(profiles); return; }
    if (game.needsPathChoice) { view.innerHTML = renderPathChoice(); return; }
    if (ui.log) { view.innerHTML = renderChronicle(); refreshSteppers(); return; }
    if (ui.sheet) { view.innerHTML = renderSheet(); refreshSteppers(); return; }
    keepingPlace(() => {
      view.innerHTML = ui.tab === 'camp' ? carryOnBanner() + renderCamp()
        : ui.tab === 'hall' ? carryOnBanner() + renderHall()
        : ui.tab === 'tower' && !game.expedition ? renderTower()
        : renderVenture();
    });
    refreshSteppers();
    ui.rolling = false;
  }

  // An arrow that cannot take you anywhere says so. Run after every redraw and
  // whenever one of these boxes scrolls, so the pair at the end of a rail or
  // the foot of a column grays out rather than pretending.
  function refreshSteppers() {
    view.querySelectorAll('[data-act="step"]').forEach((btn) => {
      const box = view.querySelector(`#${CSS.escape(btn.dataset.target)}`);
      if (!box) return;
      const back = Number(btn.dataset.dir) < 0;
      const across = box.classList.contains('rail');
      const at = across ? box.scrollLeft : box.scrollTop;
      const most = across ? box.scrollWidth - box.clientWidth : box.scrollHeight - box.clientHeight;
      btn.disabled = most <= 1 || (back ? at <= 1 : at >= most - 1);
    });
    // A column with nothing to scroll shows no arrows at all rather than a
    // pair of dead ones.
    view.querySelectorAll('.steprow').forEach((row) => {
      const box = view.querySelector(`#${CSS.escape(row.dataset.for)}`);
      row.hidden = !box || box.scrollHeight - box.clientHeight <= 1;
    });
  }

  view.addEventListener('scroll', (event) => {
    if (event.target && event.target.classList && event.target.classList.contains('scroller')) refreshSteppers();
  }, true);

  // The view is rebuilt from scratch on every change, which throws away where
  // each scroller had got to — so training the fourth companion flung the
  // rail back to the first one, and the answer to "what did that cost me"
  // scrolled off the screen as you asked it. Anything with an id keeps its
  // place across the rebuild.
  function keepingPlace(redraw) {
    const before = new Map();
    view.querySelectorAll('[id]').forEach((el) => {
      if (el.scrollLeft || el.scrollTop) before.set(el.id, [el.scrollLeft, el.scrollTop]);
    });
    redraw();
    before.forEach(([left, top], id) => {
      const el = view.querySelector(`#${CSS.escape(id)}`);
      if (!el) return;
      // Put it back where it was rather than gliding there: the rail scrolls
      // smoothly when somebody asks it to, not when it is being redrawn.
      const was = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollLeft = left;
      el.scrollTop = top;
      el.style.scrollBehavior = was;
    });
  }

  // Dice only tumble when the tray is actually re-thrown, not on every redraw.
  function renderAfterAction() {
    const e = game.expedition && game.expedition.encounter;
    const thrown = Boolean(e) && e.rounds !== ui.lastRound;
    // When the row last changed under the pointer.
    ui.settledAt = performance.now();
    const physical = throwsRealDice();
    if (thrown) {
      ui.lastRound = e.rounds;
      // Real dice clatter when they land on the table, not when the library
      // starts loading: the sound waits for the throw. The tray is held back
      // from the same moment, so the faces cannot flash before they are shown,
      // and it needs no animation of its own — the throw and the gather are
      // the motion. Drawn dice tumble in instead.
      ui.rolling = !physical;
      if (physical) document.body.classList.add('throwing');
      else playRoll(e.tray.length);
    }
    render();
    if (thrown && physical) playPhysical(e);
  }

  // The 3D throw is theater over a result the engine already decided. The tray
  // is held back while it plays and revealed when the dice stop; if anything
  // at all goes wrong, the drawn throw takes over and says so.
  async function playPhysical(encounter) {
    const stage = root.querySelector('#dicestage');
    if (!stage) { document.body.classList.remove('throwing'); return; }
    const token = ++ui.throwToken;
    const dice = encounter.tray.map((entry) => entry.die);
    const faces = encounter.tray.map((entry) => entry.face);
    // Laid out but blank while the library loads and the faces are struck:
    // the world is built from the stage's size, so it cannot be display:none
    // when that happens, and an empty lit table is not a throw.
    stage.hidden = false;
    stage.classList.add('waiting');
    const thrown = await playThrow('#dicestage', dice, faces, () => {
      if (token !== ui.throwToken) return;
      stage.classList.remove('waiting');
      playRoll(dice.length);
    });
    if (token !== ui.throwToken) return; // a newer throw has taken over
    stage.hidden = true;
    stage.classList.remove('waiting');
    document.body.classList.remove('throwing');
    if (thrown.points && chose('gather')) { gather(thrown.points); return; }
    if (thrown.points) { render(); return; }
    // The dice were thrown and watched; only their resting places were lost,
    // and the gather is a flourish. Nothing to say and nothing to change.
    if (thrown.started) { render(); return; }
    // Nothing ever reached the table. Make the noise the throw owed and draw
    // the dice for this roll. Only a browser that cannot run the physics at
    // all gives up on it; one odd throw does not.
    if (thrown.fatal) physicsRefused = true;
    playRoll(dice.length);
    ui.rolling = true;
    render();
  }

  // The dice you just threw slide from where they stopped into the line under
  // the symbols, so the row you click really is the roll you watched. Position
  // first, then animate to nothing: the tray keeps its own layout, and every
  // die stays a button the whole way.
  function gather(points) {
    if (!points.length || systemWantsCalm()) return;
    const dice = [...root.querySelectorAll('.tray .die')];
    const moving = dice.filter((el, i) => Boolean(points[i]));
    const distances = [];
    moving.forEach((el, i) => {
      const box = el.getBoundingClientRect();
      const from = points[i];
      const dx = Math.round(from.x - (box.left + box.width / 2));
      const dy = Math.round(from.y - (box.top + box.height / 2));
      distances[i] = Math.hypot(dx, dy);
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      moving.forEach((el, i) => {
        const travel = distances[i];
        const ms = Math.round(Math.min(1000, 420 + travel * 0.7));
        el.style.transition = `transform ${ms}ms cubic-bezier(.22, .68, .24, 1) ${i * 45}ms`;
        el.style.transform = '';
        el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
      });
    }));
  }

  // Transmute asks two questions: which die, and what to turn it into. When
  // there is only one die in the tray the first question has one answer, and
  // when the trial wants only one symbol so does the second. A question with
  // one answer is not a question, so the ability spends itself and plays the
  // die where it was always going to go.
  function wantedSymbols(e) {
    const trial = e.trial;
    if (!trial) return [];
    return [...new Set(trial.required.filter((_, i) => !trial.matched[i]))];
  }

  // A slip takes no aim from the player — the engine knows which die is worth
  // stealing back. All the screen owes is a moment where you can see which one
  // it was, before it leaves the table with the slot already answered.
  function autoSlip(e) {
    const pick = e.slipWould();
    if (!pick) return;
    ui.pendingAbility = null;
    ui.selectedDie = pick.dieIndex;
    ui.reshaped = pick.dieIndex;
    render();
    window.setTimeout(() => {
      ui.reshaped = null;
      ui.selectedDie = null;
      const now = game.expedition && game.expedition.encounter;
      if (!now || now !== e || !e.canUse('slip')) { render(); return; }
      guard(() => perform('useAbility', ['slip']));
    }, systemWantsCalm() ? 220 : 480);
  }

  function autoTransmute(e, dieIndex) {
    const wanted = wantedSymbols(e);
    if (wanted.length !== 1) return false;
    const symbol = wanted[0];
    const slot = e.trial.required.findIndex((sym, i) => !e.trial.matched[i] && sym === symbol);
    if (slot < 0) return false;
    ui.transmuteDie = null;
    ui.pendingAbility = null;
    // Played rather than resolved. Doing both halves in one tick left the room
    // simply over, with no sign of what had happened to end it: the die turns
    // first, and is seen to turn, and only then is it laid in the slot it was
    // turned for.
    guard(() => {
      perform('useAbility', ['transmute', { dieIndex, symbol }]);
      ui.reshaped = dieIndex;
      ui.selectedDie = dieIndex;
      render();
      window.setTimeout(() => {
        ui.reshaped = null;
        ui.selectedDie = null;
        // The room can end under you while the die is still turning — a peer
        // acting in co-op, or the player pressing on. Only lay it down if it
        // is still there to lay.
        const now = game.expedition && game.expedition.encounter;
        if (!now || now !== e || !e.tray[dieIndex] || e.trial.matched[slot]) { render(); return; }
        guard(() => perform('match', [dieIndex, slot]));
      }, systemWantsCalm() ? 260 : 620);
    });
    return true;
  }

  function onDieClick(index) {
    const e = game.expedition.encounter;
    // On a shared quest you play your own people's dice and nobody else's.
    const clicked = e.tray[index];
    if (clicked && !game.owns(clicked.die.ownerId)) {
      const owner = game.member(clicked.die.ownerId);
      const peer = owner && game.expedition.owners[owner.uid];
      const player = peer && ui.session ? peerName(peer) : owner ? owner.name : 'the other player';
      say(`That is ${owner ? owner.name : 'somebody else'}\u2019s die \u2014 ${player} plays it.`);
      return;
    }
    if (ui.pendingAbility) {
      const id = ui.pendingAbility;
      if (id === 'transmute') {
        ui.pendingAbility = null;
        if (autoTransmute(e, index)) return;
        ui.transmuteDie = index;
        render();
        return;
      }
      guard(() => { ui.pendingAbility = null; perform('useAbility', [id, { dieIndex: index }]); });
      return;
    }
    const mine = e.availableMatches().filter((p) => p.dieIndex === index);
    if (!mine.length) {
      if (!e.legalActions().canDiscard) {
        say(e.availableMatches().length
          ? 'A match is on the table \u2014 you must take it.'
          : 'A die is already placed this round. Nothing more is lost here \u2014 roll again.');
        return;
      }
      // A die placed is a die gone from the row, and everything after it
      // shuffles up under the pointer. A click that lands in that moment was
      // aimed at the die that just left, not at the one that took its place.
      if (performance.now() - ui.settledAt < CLICK_THROUGH_MS) return;
      // A power die and a wild face each carry their own mark in the row, so
      // spending one is a visible decision already. It used to take a second
      // press; the die now says what it is, which is the same warning without
      // the click in the way of it.
      guard(() => {
        ui.selectedDie = null;
        perform('discard', [index]);
      });
      return;
    }
    const symbols = new Set(mine.map((p) => e.trial.required[p.slotIndex]));
    if (symbols.size === 1) guard(() => { ui.selectedDie = null; perform('match', [index, mine[0].slotIndex]); });
    else { ui.selectedDie = index; render(); }
  }

  function currentProfile() {
    return game.saveKey.startsWith(`${SAVE_KEY}:`) ? game.saveKey.slice(SAVE_KEY.length + 1) : '1';
  }

  // Characters are swapped in place rather than by reloading: the UI is
  // already wired to this state object, and a sandboxed page cannot be relied
  // on to navigate itself. The address bar is corrected to match.
  // `save` is a character that came from somewhere other than this browser —
  // the shared store, or a pasted code — which is taken up as this slot.
  // Back to the floor the party is standing on, from wherever the screen
  // wandered off to. A floor in progress is never somewhere you can be locked
  // out of: camp, the hall, the sheet, the Chronicle and the character list
  // all lead back here.
  function showFloor() {
    ui.stage = 'play';
    ui.tab = 'road';
    ui.sheet = false;
    ui.log = false;
    ui.settings = false;
    ui.menu = false;
    ui.mustering = false;
    ui.notice = '';
  }

  // The load screen, from wherever the player is.
  function showLoadout() {
    ui.stage = 'play';
    ui.tab = 'road';
    ui.sheet = false;
    ui.log = false;
    ui.settings = false;
    ui.menu = false;
    ui.mustering = false;
    ui.coopScreen = true;
  }

  function carryOnBanner() {
    const x = game.expedition;
    if (!x) return '';
    const where = x.mode === 'tower' ? TOWER.name : game.place ? game.place.name : game.runDepth.name;
    return `<section class="panel carryon">
      <p><b>Your party is still out</b> in ${esc(where)}${game.sharedQuest ? ', with the rest of the quest waiting on you' : ''}.</p>
      <button class="action" data-act="carryon" type="button">Carry on</button>
    </section>`;
  }

  function useProfile(id, save = null) {
    // The character already being played, mid-floor: go back to the floor.
    // Loading it again from storage would throw a shared quest away, since a
    // shared floor is never written down.
    if (game.expedition && id === currentProfile()) { showFloor(); render(); return; }
    if (game.expedition && id !== currentProfile()) throw new Error('climb out of the floor first');
    const key = saveKeyFor(id);
    const loaded = save
      ? Game.load({ getItem: () => save, setItem: () => {} }, key)
      : Game.load(globalThis.localStorage, key);
    const fresh = loaded || new Game(null, { saveKey: key });
    game.saveKey = key;
    Object.assign(game.state, newGameState(), fresh.state);
    game.written = JSON.stringify(game.body());
    try { history.replaceState(null, '', `?p=${encodeURIComponent(id)}`); } catch { /* sandboxed */ }
    ui.tab = 'road';
    ui.stage = 'play';
    ui.confirmDisband = null;
    ui.party = [];
    ui.place = null;
    ui.mustering = false;
    ui.saveCode = '';
    ui.pasting = false;
    ui.creation = { name: '', classId: null };
    if (ui.session) { ui.session.leave(); ui.session = null; }
    game.save();
    ui.slots = null;
    game.emit();
  }

  function disbandProfile(id) {
    if (game.expedition) throw new Error('climb out of the floor first');
    ui.confirmDisband = null;
    if (id === currentProfile()) {
      Object.assign(game.state, newGameState());
      ui.creation = { name: '', classId: null };
      ui.tab = 'characters';
      game.save();
      game.emit();
      return;
    }
    forgetProfile(id);
    render();
  }

  // A character who arrived by scanned link: offered, never taken up behind
  // the player's back — this browser may already have characters in it. Left
  // until the first draw is done, so that greeting them cannot run before the
  // screen it greets them on exists.
  function greetArrival() {
    // What the address says now, or what it said when the page loaded — the
    // game rewrites the address to name the character being played, so the
    // second is how an arrival survives that.
    const arriving = readCode() || codeFromAddress();
    if (!arriving) return;
    fromCode(arriving)
      .then((json) => {
        let who = 'Somebody';
        try { who = JSON.parse(json).hero.name; } catch { /* named below */ }
        ui.incoming = { json, who };
        ui.stage = 'select';
        render();
      })
      .catch(() => { /* a link that is not a character is not worth a word */ })
      .then(() => {
        // The address goes back to being an address: a character should not
        // arrive again every time the page is reloaded.
        try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sandboxed */ }
      });
  }
  setTimeout(greetArrival, 0);
  // Escape closes the menu, which is what every other menu on the machine does.
  // On the character card the arrow keys turn the carousel — unless the
  // name is being typed, when they belong to the text.
  root.ownerDocument.addEventListener('keydown', (event) => {
    if (game.hero || ui.stage === 'select' || ui.settings) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const typing = event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName);
    if (typing || !root.querySelector('#makedeck')) return;
    event.preventDefault();
    stepCreation(event.key === 'ArrowLeft' ? -1 : 1);
  });

  // And a swipe across the card does the same on a phone.
  let swipeFrom = null;
  root.addEventListener('touchstart', (event) => {
    swipeFrom = event.target.closest && event.target.closest('#makedeck') && !event.target.closest('input')
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY, look: Boolean(event.target.closest('.makelook')) } : null;
  }, { passive: true });
  root.addEventListener('touchend', (event) => {
    if (!swipeFrom) return;
    const dx = event.changedTouches[0].clientX - swipeFrom.x;
    const dy = event.changedTouches[0].clientY - swipeFrom.y;
    const from = swipeFrom;
    swipeFrom = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // Anywhere on the card but the skin, it turns the calling.
      if (!from.look) stepCreation(dx > 0 ? -1 : 1);
    }
  }, { passive: true });

  root.ownerDocument.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !ui.menu) return;
    ui.menu = false;
    render();
  });

  if (typeof window !== 'undefined') window.addEventListener('hashchange', greetArrival);

  // The screen the game opens on. One list, and one way to move a character to
  // another device: its code, copied here and pasted there.
  function renderSelect() {
    const slots = ui.slots || [];
    const cards = !slots.length
      ? '<p class="hint">No characters in this browser yet.</p>'
      : rail('characters', slots.map((slot) => {
        const s2 = slot.summary || {};
        const confirming = ui.confirmDisband === slot.profile;
        const playing = slot.profile === currentProfile() && game.hero;
        return `<div class="companion ${playing ? 'is-hero' : ''}" style="--rarity:${playing ? 'var(--oxblood)' : 'var(--rule)'}">
          <div class="whorow">
            <img class="skinhead" src="${esc(headFor(slot.name))}" alt="" width="48" height="48">
            <span><h3>${esc(slot.name || 'Unnamed')}</h3>
            <p class="title">${esc(slot.title || 'Adventurer')}${s2.level ? ` &middot; level ${s2.level}` : ''}</p></span>
          </div>
          <p class="hint">${s2.day ? `Day ${s2.day} &middot; ` : ''}${s2.gold || 0} gold &middot; ${s2.renown || 0} renown &middot; ${s2.companions || 0} companion${s2.companions === 1 ? '' : 's'}${
            s2.underground ? ' &middot; <b>underground</b>' : ''}</p>
          ${confirming
            ? `<p class="notice">This wipes ${esc(slot.name || 'this character')} for good.</p>
               <div class="buttons"><button class="action" data-act="forget-go" data-profile="${esc(slot.profile)}" type="button">Wipe them</button>
               <button class="ghost" data-act="disband-cancel" type="button">Keep them</button></div>`
            : `<div class="buttons" style="margin-top:11px">
                <button class="action" data-act="playslot" data-profile="${esc(slot.profile)}" type="button">${playing ? 'Carry on' : 'Play'}</button>
                <button class="ghost" data-act="copyslot" data-profile="${esc(slot.profile)}" type="button">Send to another device</button>
                <button class="ghost" data-act="disband-ask" data-profile="${esc(slot.profile)}" type="button">Wipe</button>
              </div>`}
        </div>`;
      }).join(''), { back: 'Earlier characters', on: 'Later characters' });

    const free = nextProfileId(slots.map((slot) => ({ id: slot.profile })));
    const code = ui.saveCode
      ? `<div class="sendrow">
          <div class="sendcode">
            <textarea id="savecode" rows="5" spellcheck="false" readonly>${esc(ui.saveCode)}</textarea>
            <p class="hint">${ui.shareLink
              ? 'Scan the square with the other device and the game opens with this character in hand. No camera? Paste the line instead: <b>Bring one in</b>, over there.'
              : 'Point the other device\u2019s camera at the square to read the line off it, or paste the line into <b>Bring one in</b> over there.'} They arrive exactly as they are here \u2014 company, purse, and the floor they are standing on.</p>
          </div>
          <figure class="sendqr">${ui.qr}<figcaption>${ui.shareLink ? 'Scan to play them there' : 'The same line, as a square'}</figcaption></figure>
        </div>`
      : ui.pasting
        ? `<div style="margin-top:12px">
            <textarea id="savecode" rows="4" spellcheck="false" placeholder="Paste the code from the other device"
              style="width:100%;font-family:ui-monospace,monospace;font-size:12px"></textarea>
            <div class="buttons" style="margin-top:8px">
              <button class="action" data-act="usecode" data-profile="${esc(free)}" type="button">Bring them in</button>
              <button class="ghost" data-act="pastecode" type="button">Never mind</button>
            </div>
          </div>`
        : '';

    const incoming = ui.incoming ? `<section class="panel">
      <header><div><h2>${esc(ui.incoming.who)} has arrived</h2>
        <p class="hint">Sent from another device. Bring them in and they take a slot here; nothing already in this browser is touched.</p></div></header>
      <div class="buttons">
        <button class="action" data-act="takeincoming" type="button">Bring ${esc(ui.incoming.who)} in</button>
        <button class="ghost" data-act="dropincoming" type="button">Not now</button>
      </div>
    </section>` : '';

    return `${incoming}<section class="panel">
      <header><div><h2>Choose a character</h2>
        <p class="hint">Characters live in this browser. To play one somewhere else, send it across with a code.</p></div>
        <span class="buttons">
          <button class="ghost" data-act="pastecode" type="button">Bring one in</button>
          <button class="action" data-act="newchar" data-profile="${esc(free)}" type="button">New character</button>
        </span>
      </header>
      ${cards}
      ${code}
      <p class="notice">${esc(ui.notice)}</p>
    </section>`;
  }

  // Whether shared quests can reach other machines. Asked once, when the page
  // loads: deployed to Cloudflare the answer is yes, and anywhere else — a
  // local file server, the claude.ai page — it is no, and a quest is two tabs
  // in one browser, as it always was.
  ui.relay = false;
  relayAvailable().then((yes) => { ui.relay = yes; if (yes) render(); });

  function openSession(code, host) {
    if (!game.hero) throw new Error('make a character first');
    let transport;
    if (ui.relay) {
      transport = new WebSocketTransport(relayUrl(code), {
        onStatus: (status) => { ui.link = status; render(); },
      });
      ui.link = transport.status;
    } else {
      if (typeof BroadcastChannel === 'undefined') throw new Error('this browser cannot share quests between tabs');
      transport = new BroadcastChannelTransport(code);
      ui.link = null;
    }
    // The moment the host opens the floor, everybody is taken to it — from
    // camp, the hall, the character list, wherever they were waiting.
    let onFloor = Boolean(game.expedition);
    ui.session = new Session({
      game,
      transport,
      peerId: `${game.hero.name}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      host,
      onChange: () => {
        // A new proposal opens the load screen for everybody, so nobody has
        // to go looking for what they are being asked to agree to.
        const plan = ui.session && ui.session.plan;
        if (plan && plan.id !== ui.seenPlan && !game.expedition) { ui.seenPlan = plan.id; showLoadout(); }
        if (game.expedition && !onFloor) { ui.coopScreen = false; showFloor(); }
        onFloor = Boolean(game.expedition);
        renderAfterAction();
      },
    });
    // Anybody already picked on Choose Your Party comes along.
    const picked = ui.party.map((u) => game.member(u)).filter(Boolean);
    if (picked.length) ui.session.setParty(picked);
    render();
  }

  // A floor is drawn to the shape of the screen it is opened on. A phone held
  // upright gets an upright dungeon: the same rooms, stacked into a column,
  // so the map fills the board instead of sitting in a strip with dead
  // parchment above and below it. Decided once, when you set out — turning
  // the phone sideways later does not rebuild the floor under your feet.
  function uprightFloor() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return w <= PHONE_WIDTH && h > w;
  }

  // One face sheet for the whole page, living at the end of <body>.
  //
  // It used to hang inside the die it described, where two things cut it in
  // half: the panel the die sat in clipped it, and a die under a filter or a
  // transform is its own stacking context, so the sheet went under whatever
  // was drawn after it. A single element outside all of that has nothing to
  // be clipped by and nothing to be buried under. The copy inside each die is
  // kept as the source to fill it from, and is never drawn.
  const tip = root.ownerDocument.getElementById('tip');
  let openDie = null;

  function hideSheet() {
    if (!openDie) return;
    if (tip) tip.classList.remove('shown');
    openDie = null;
  }

  // Over the die if there is room above it, under it if there is not, and
  // always inside the edges of the screen.
  function placeTip() {
    if (!openDie || !tip) return;
    const d = openDie.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(
      d.left + d.width / 2 - box.width / 2,
      window.innerWidth - box.width - margin,
    ));
    const above = d.top - box.height - 8;
    const top = above >= margin ? above : Math.min(d.bottom + 8, window.innerHeight - box.height - margin);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(Math.max(margin, top))}px`;
  }

  function placeSheet(target) {
    const die = target && target.closest && target.closest('.die');
    const sheet = die && die.querySelector('.facesheet');
    if (!sheet || !tip) { hideSheet(); return; }
    if (die === openDie) return;
    tip.innerHTML = sheet.innerHTML;
    openDie = die;
    tip.classList.add('shown');
    placeTip();
  }

  root.addEventListener('mouseover', (event) => placeSheet(event.target));
  root.addEventListener('focusin', (event) => placeSheet(event.target));
  root.addEventListener('mouseout', (event) => {
    const to = event.relatedTarget;
    if (!to || !to.closest || !to.closest('.die')) hideSheet();
  });
  root.addEventListener('focusout', () => hideSheet());
  // A panel scrolling under an open sheet takes the die with it, so the sheet
  // follows rather than hanging there — and goes away once the die has left.
  window.addEventListener('scroll', () => {
    if (!openDie) return;
    const box = openDie.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) hideSheet();
    else placeTip();
  }, true);

  root.addEventListener('input', (event) => {
    if (event.target.id === 'heroname') {
      ui.creation.name = event.target.value;
      const go = root.querySelector('[data-act="create"]');
      if (go) go.disabled = !ui.creation.name.trim();
      // The face follows the name as it is typed, a beat after the typing
      // stops, without redrawing the field out from under the cursor.
      clearTimeout(ui.skinTimer);
      ui.skinTimer = setTimeout(() => {
        const fig = root.querySelector('.makelook figure');
        if (!fig) return;
        const name = ui.creation.name.trim();
        fig.innerHTML = `${skinFigure(name)}<figcaption><b>${name ? esc(name) : 'Your skin goes here'}</b><span>${name
          ? (isUsername(name) ? 'Your Minecraft skin' : 'Not a Minecraft username \u2014 a blockhead stands in')
          : 'Type your Minecraft username'}</span></figcaption>`;
      }, 350);
    }
    if (event.target.id === 'savecode') ui.saveCode = event.target.value;
    if (event.target.id === 'joincode') {
      ui.joinCode = event.target.value.toUpperCase().slice(0, 4);
      root.querySelector('[data-act="join"]').disabled = ui.joinCode.length !== 4;
    }
  });

  root.addEventListener('input', (event) => {
    const el = event.target.closest('[data-act="musicvol"]');
    if (!el) return;
    music.setVolume(Number(el.value) / 100);
    const shown = el.parentElement && el.parentElement.querySelector('b');
    if (shown) shown.textContent = String(Math.round(music.settings().volume * 100));
  });

  root.addEventListener('click', (event) => {
    // A browser will not make a sound until the page has been touched; this
    // is the touch.
    music.wake();
    const el = event.target.closest('[data-act]');
    if (!el) return;
    const { act, uid, def, index, key, id, symbol } = el.dataset;
    // Arming the way out lasts exactly until you do anything else.
    if (ui.confirmExit && act !== 'withdraw-go' && act !== 'withdraw-ask') ui.confirmExit = false;
    // The Chronicle is a page you are reading, and the only things on it are
    // the way back and the arrows. Press anything else — anywhere — and you
    // have stopped reading.
    if (ui.log && !['chronicle', 'menu', 'menuclose', 'step'].includes(act)) ui.log = false;
    // The character sheet is a page you are reading as well, but the things on
    // it — putting a sword on, mending a shield — are meant to be done from it.
    if (ui.sheet && !['sheet', 'menu', 'menuclose', 'step', 'equip', 'unequip', 'mend', 'socket', 'fit', 'sheetwho', 'opensheet'].includes(act)) ui.sheet = false;

    switch (act) {
      case 'pickclass':
        ui.creation.classId = el.dataset.class;
        // A calling still carries a figure in the save, though your skin is
        // what is drawn; start it on the calling's first.
        ui.creation.look = defaultLook(el.dataset.class).id;
        render();
        break;
      case 'showskin': render(); break;
      case 'classstep': stepCreation(Number(el.dataset.dir)); break;
      case 'useprofile': guard(() => useProfile(el.dataset.profile)); break;
      case 'newprofile': guard(() => useProfile(nextProfileId(listProfiles()))); break;
      case 'toselect':
        if (game.expedition) { ui.menu = false; say('You are underground. Finish what you started.'); return; }
        ui.stage = 'select';
        ui.menu = false;
        ui.sheet = false;
        ui.log = false;
        ui.notice = '';
        ui.confirmDisband = null;
        ui.saveCode = '';
        ui.qr = '';
        ui.pasting = false;
        refreshSlots();
        render();
        break;
      case 'playslot': guard(() => useProfile(el.dataset.profile)); break;
      case 'newchar':
        guard(() => {
          useProfile(el.dataset.profile);
          ui.stage = 'play';
        });
        break;
      case 'forget-go':
        guard(() => {
          const profile = el.dataset.profile;
          ui.confirmDisband = null;
          forgetProfile(profile);
          if (profile === currentProfile()) Object.assign(game.state, newGameState());
          refreshSlots();
          render();
        });
        break;
      case 'copyslot': {
        const profile = el.dataset.profile;
        let raw = null;
        try { raw = localStorage.getItem(saveKeyFor(profile)); } catch { raw = null; }
        if (!raw) { say('That character could not be read.'); break; }
        toCode(raw).then((code) => {
          const target = shareTarget(code);
          ui.saveCode = code;
          ui.shareLink = target !== code;
          ui.qr = qrSvg(target);
          ui.pasting = false;
          const copied = navigator.clipboard && navigator.clipboard.writeText
            ? navigator.clipboard.writeText(code).then(() => true).catch(() => false)
            : Promise.resolve(false);
          return copied.then((ok) => {
            // Shown as well as copied: a page in a frame is often refused the
            // clipboard, and a code you cannot see is no use to anybody.
            say(ok ? 'Copied. Paste it into the game on the other device.' : 'Copy this whole line into the game on the other device.');
            const box = root.querySelector('#savecode');
            if (box) box.select();
          });
        }).catch((err) => say(err.message));
        break;
      }
      case 'pastecode':
        ui.pasting = !ui.pasting;
        ui.saveCode = '';
        ui.qr = '';
        render();
        break;
      case 'takeincoming':
        guard(() => {
          const { json, who } = ui.incoming;
          ui.incoming = null;
          useProfile(nextProfileId((ui.slots || []).map((slot) => ({ id: slot.profile }))), json);
          say(`${esc(who)} takes up where they left off.`);
        });
        break;
      case 'dropincoming': ui.incoming = null; render(); break;
      case 'usecode': {
        const box = root.querySelector('#savecode');
        const code = box ? box.value : '';
        const into = el.dataset.profile || currentProfile();
        fromCode(code).then((json) => {
          guard(() => {
            useProfile(into, json);
            say(`${game.hero ? game.hero.name : 'That character'} takes up where they left off.`);
          });
        }).catch((err) => say(err.message));
        break;
      }
      case 'disband-ask': ui.confirmDisband = el.dataset.profile; render(); break;
      case 'disband-cancel': ui.confirmDisband = null; render(); break;
      case 'disband-go': guard(() => disbandProfile(el.dataset.profile)); break;
      case 'disband-current':
        ui.tab = 'characters';
        ui.confirmDisband = currentProfile();
        render();
        break;
      case 'rename': guard(() => game.renameHero(root.querySelector('#rename').value)); break;
      case 'create': guard(() => {
        ui.tab = 'camp';
        game.createCharacter(ui.creation.name, ui.creation.classId, ui.creation.look);
      }); break;
      case 'pickpath': guard(() => game.choosePath(el.dataset.path)); break;
      // The Chronicle has its own column on a wide screen; on a phone it comes
      // up over the board and the next press anywhere puts it away again.
      case 'menu': ui.menu = !ui.menu; render(); break;
      case 'menuclose': ui.menu = false; render(); break;
      case 'chronicle': ui.log = true; ui.sheet = false; ui.menu = false; ui.notice = ''; render(); break;
      case 'closelog': ui.log = false; render(); break;
      case 'sheet': ui.sheet = true; ui.log = false; ui.menu = false; ui.notice = ''; render(); break;
      // The menu's short way into a country's two havens. It sets the country
      // as well as the tab, because everything bought in either of them —
      // a recruit, a piece of the smith's stock — is bought from a place.
      case 'gocamp':
      case 'gohall': {
        if (game.expedition) { ui.menu = false; say('You are underground. Finish what you started.'); return; }
        const zoneId = menuZone();
        if (!zoneId) break;
        ui.zone = zoneId;
        ui.lastZone = zoneId;
        ui.place = null;
        ui.mustering = false;
        ui.tab = act === 'gocamp' ? 'camp' : 'hall';
        ui.sheet = false;
        ui.log = false;
        ui.menu = false;
        ui.notice = '';
        render();
        break;
      }
      case 'closesheet': ui.sheet = false; render(); break;
      case 'equip': guard(() => game.equip(id, el.dataset.uid || null)); break;
      case 'sheetwho': ui.sheetWho = el.dataset.uid; ui.socket = null; render(); break;
      case 'opensheet':
        ui.sheetWho = el.dataset.uid || null;
        ui.sheet = true;
        ui.log = false;
        ui.menu = false;
        ui.socket = null;
        ui.notice = '';
        render();
        break;
      case 'socket': {
        const at = `${el.dataset.slot}:${el.dataset.index}`;
        ui.socket = ui.socket === at ? null : at;
        render();
        break;
      }
      case 'fit': {
        const { slot: fitSlot, index: fitAt, key: fitKey, uid: fitWho } = el.dataset;
        ui.socket = null;
        guard(() => game.fitDie(fitSlot, Number(fitAt), fitKey || null, fitWho || null));
        break;
      }
      case 'unequip': guard(() => game.unequip(id, el.dataset.uid || null)); break;
      case 'mend': guard(() => game.repair(id)); break;
      case 'mendall': guard(() => game.repairAll()); break;
      case 'buygear': guard(() => game.buyGear(id, ui.zone)); break;
      case 'wide': ui.wide = !ui.wide; ui.menu = false; render(); break;
      case 'settle':
        if (!ui.confirmSettle) { ui.confirmSettle = true; render(); break; }
        ui.confirmSettle = false;
        guard(() => game.settle());
        break;
      case 'settlecancel': ui.confirmSettle = false; render(); break;
      // One stepper for both directions: a rail steps by a card, a column by
      // most of a screenful.
      case 'step': {
        const box = root.querySelector(`#${CSS.escape(el.dataset.target)}`);
        if (!box) break;
        const dir = Number(el.dataset.dir || 1);
        if (box.classList.contains('rail')) {
          const card = box.firstElementChild;
          const by = card ? card.getBoundingClientRect().width + 12 : box.clientWidth * 0.8;
          box.scrollBy({ left: by * dir, behavior: 'smooth' });
        } else {
          box.scrollBy({ top: box.clientHeight * 0.8 * dir, behavior: 'smooth' });
        }
        break;
      }
      case 'settings': ui.settings = true; ui.menu = false; ui.notice = ''; render(); break;
      case 'closesettings': ui.settings = false; ui.notice = ''; render(); break;
      case 'choice': {
        const choice = CHOICES[id];
        if (!choice) break;
        choice.value = !choice.value;
        saveChoices();
        render();
        break;
      }
      case 'music': {
        // Switching it on is the press a browser needs before it will make a
        // sound, so this is also where the room tone starts.
        const on = music.setOn(!music.settings().on);
        if (on) { music.wake(); sceneNow(); }
        render();
        break;
      }
      case 'sound': toggleSound(); render(); break;
      case 'train': guard(() => game.train(uid)); break;
      case 'rest': guard(() => game.rest()); break;
      case 'shortrest': guard(() => game.shortRest()); break;
      case 'dismiss': guard(() => { ui.party = ui.party.filter((p) => p !== uid); game.dismiss(uid); }); break;
      case 'recruit': guard(() => game.recruit(def, ui.zone)); break;
      case 'place': {
        const place = placeById(id);
        if (!place) break;
        if (!isOpen(place, game.hero)) { say(`${place.name} is sealed until level ${tierOf(place).opens}.`); return; }
        ui.place = place.id;
        ui.notice = '';
        render();
        // The posting the click just opened takes the focus, so the next
        // press — the one that musters the party — is a keystroke away.
        const go = root.querySelector('[data-act="muster"]');
        if (go) go.focus({ preventScroll: true });
        break;
      }
      case 'zone': {
        const zone = zoneById(id);
        if (!zone) break;
        if (!placesIn(zone).some((p) => isOpen(p, game.hero))) {
          say(`Nothing in ${zone.name} is open to you yet.`);
          return;
        }
        ui.zone = zone.id;
        ui.lastZone = zone.id;
        ui.place = null;
        ui.notice = '';
        render();
        break;
      }
      case 'tostrand':
        ui.zone = null;
        ui.place = null;
        ui.notice = '';
        render();
        break;
      case 'goto': {
        if (game.expedition) { say('You are underground. Finish what you started.'); return; }
        const zone = zoneById(ui.zone);
        const haven = zone && havensOf(zone).find((h) => h.id === id);
        if (!haven) break;
        ui.tab = haven.tab;
        ui.notice = '';
        render();
        break;
      }
      case 'coop':
        // The summary would toggle itself and then be rebuilt shut; it is
        // remembered here instead.
        event.preventDefault();
        ui.coop = !ui.coop;
        render();
        break;
      case 'carryon': showFloor(); render(); break;
      case 'coopmenu':
        if (game.expedition) { ui.menu = false; say('You are underground. Finish what you started.'); return; }
        ui.coop = true;
        ui.tab = 'road';
        ui.menu = false;
        ui.sheet = false;
        ui.log = false;
        ui.notice = '';
        render();
        break;
      case 'tomapscreen':
        if (game.expedition) { ui.menu = false; say('You are underground. Finish what you started.'); return; }
        ui.tab = 'road';
        ui.menu = false;
        ui.sheet = false;
        ui.log = false;
        ui.notice = '';
        render();
        break;
      case 'muster':
        if (!ui.place) break;
        // On a quest, choosing a party for a posting is proposing it.
        if (ui.session) {
          guard(() => {
            if (!ui.session.host) throw new Error('the host proposes where the quest goes');
            const place = placeById(ui.place);
            ui.session.propose({ placeId: place.id, depthNumber: place.depth, label: place.name });
            showLoadout();
          });
          render();
          break;
        }
        ui.mustering = true;
        ui.notice = '';
        render();
        break;
      case 'tomap':
        ui.mustering = false;
        ui.notice = '';
        render();
        break;
      case 'party':
        // On a quest the pick lives in the lobby, and it is checked against
        // what the size of the party allows.
        if (ui.session && !game.expedition) {
          guard(() => {
            const now = ui.session.myParty.slice(1).map((m) => m.uid);
            const next = now.includes(uid) ? now.filter((p) => p !== uid) : [...now, uid];
            if (next.length > game.companionSlots) throw new Error(`your renown supports ${game.companionSlots}`);
            ui.session.setParty(next.map((u) => game.member(u)).filter(Boolean));
            ui.party = next;
          });
          render();
          break;
        }
        if (ui.party.includes(uid)) ui.party = ui.party.filter((p) => p !== uid);
        else if (ui.party.length >= game.companionSlots) { say(`Your renown supports ${game.companionSlots} companion${game.companionSlots === 1 ? '' : 's'}.`); return; }
        else ui.party = [...ui.party, uid];
        render();
        break;
      case 'loadout':
        if (ui.coopScreen) { ui.coopScreen = false; render(); break; }
        showLoadout();
        render();
        break;
      case 'proposeplace': guard(() => {
        const place = placeById(ui.place);
        ui.session.propose({ placeId: place.id, depthNumber: place.depth, label: place.name });
        showLoadout();
      }); break;
      case 'agree': guard(() => ui.session.agree()); break;
      case 'reject': guard(() => { ui.session.reject(); }); break;
      case 'setout': guard(() => {
        ui.lastRound = 0;
        ui.coopScreen = false;
        ui.session.setOut({ upright: uprightFloor() });
      }); break;
      case 'embark': guard(() => {
        const place = placeById(ui.place);
        // With a quest open this is the quest setting out, not a solo run.
        if (ui.session) {
          ui.session.propose({ placeId: place.id, depthNumber: place.depth, label: place.name });
          showLoadout();
          return;
        }
        game.startExpedition(place.depth, ui.party, undefined, place.id, uprightFloor());
        ui.party = [];
        ui.mustering = false;
        ui.lastRound = 0;
      }); break;
      // The Tower. Solo only: it is a ladder with one decision on it, and that
      // decision belongs to whoever is carrying the prize down.
      case 'totower':
        if (game.expedition) { ui.menu = false; say('You are already out. Finish what you started.'); return; }
        ui.tab = 'tower';
        ui.menu = false;
        ui.sheet = false;
        ui.log = false;
        ui.mustering = false;
        ui.notice = '';
        render();
        break;
      case 'towerstart': guard(() => {
        if (ui.session) {
          ui.session.propose({ tower: true, label: TOWER.name });
          showLoadout();
          return;
        }
        game.startTower(ui.party, undefined, uprightFloor());
        ui.party = [];
        ui.lastRound = 0;
      }); break;
      case 'towerclimb': guard(() => { ui.lastRound = 0; perform('climb'); }); break;
      case 'towertake': guard(() => perform('towerTake')); break;
      case 'host': guard(() => openSession(questCode(), true)); break;
      case 'join': guard(() => openSession(ui.joinCode.toUpperCase(), false)); break;
      case 'opengate': guard(() => {
        // Kept for any old button still on screen: a quest's place is now
        // proposed and agreed rather than simply taken.
        const place = placeById(ui.place);
        ui.session.propose({ placeId: place.id, depthNumber: place.depth, label: place.name });
        showLoadout();
      }); break;
      case 'leave': guard(() => { ui.session.leave(); ui.session = null; ui.link = null; ui.coopScreen = false; }); break;
      case 'move': guard(() => perform('move', [key])); break;
      // 0, not 1: a new encounter opens on round 1, and pre-setting it to 1 made
      // the first throw of every room land without ever being thrown.
      // Picking is local until the pair is sent in: only the going is shared.
      case 'actor': {
        const x = game.expedition;
        const standing = x.partyUids.map((id) => game.member(id)).filter((m) => m && !m.down);
        const wants = Math.min(PARTY_PER_ROOM, standing.length);
        if (ui.pair.includes(uid)) ui.pair = ui.pair.filter((id) => id !== uid);
        else ui.pair = [...ui.pair, uid].slice(-wants);
        ui.notice = '';
        render();
        break;
      }
      case 'sendin': guard(() => {
        ui.lastRound = 0;
        const [a, b] = ui.pair;
        ui.pair = [];
        perform('choosePair', [a, b || null]);
      }); break;
      case 'fall': guard(() => perform('takeTheFall', [uid])); break;
      case 'die': onDieClick(Number(index)); break;
      case 'unpick': ui.selectedDie = null; ui.transmuteDie = null; render(); break;
      case 'slot':
        if (ui.transmuteDie !== null) {
          const die = ui.transmuteDie;
          guard(() => { ui.transmuteDie = null; perform('useAbility', ['transmute', { dieIndex: die, symbol }]); });
        } else {
          const die = ui.selectedDie;
          guard(() => { ui.selectedDie = null; perform('match', [die, Number(index)]); });
        }
        break;
      case 'ability': {
        const e = game.expedition.encounter;
        const ability = e.abilities.find((a) => a.id === id);
        if (ui.pendingAbility === id) { ui.pendingAbility = null; render(); return; }
        if (id === 'slip') { autoSlip(e); break; }
        if (ability.target === 'none') { guard(() => perform('useAbility', [id])); break; }
        // One die in hand means the die is decided; one symbol wanted means
        // the symbol is too, and then the whole thing plays itself.
        if (id === 'transmute' && e.tray.length === 1) {
          ui.selectedDie = null;
          if (autoTransmute(e, 0)) break;
          ui.pendingAbility = null;
          ui.transmuteDie = 0;
          render();
          break;
        }
        ui.pendingAbility = id;
        ui.selectedDie = null;
        render();
        break;
      }
      case 'reroll': guard(() => { ui.selectedDie = null; ui.pendingAbility = null; perform('reroll'); }); break;
      case 'withdraw-ask': ui.confirmExit = true; render(); break;
      case 'withdraw-stay': ui.confirmExit = false; render(); break;
      case 'withdraw-go':
        // A click that lands within a few frames of the button appearing was
        // aimed at whatever was there before the screen changed under it.
        if (performance.now() - ui.renderedAt < CLICK_THROUGH_MS) return;
        guard(() => { ui.confirmExit = false; perform('withdraw'); });
        break;
      case 'befriend': guard(() => perform('befriend')); break;
      case 'openchest': guard(() => perform('openChest')); break;
      case 'leavechest': guard(() => perform('leaveChest')); break;
      case 'trinket': guard(() => {
        ui.selectedDie = null;
        ui.pendingAbility = null;
        perform('useTrinket', el.dataset.uid ? [id, el.dataset.uid] : [id]);
      }); break;
      case 'buytrinket': guard(() => game.buyTrinket(id)); break;
      case 'leavewild': guard(() => perform('leaveWild')); break;
      case 'takewild': guard(() => perform('takeWild')); break;
      case 'takebounty': guard(() => perform('takeBounty')); break;
      case 'claimwild': guard(() => game.claimWild()); break;
      // The button says back to camp, so it goes back to camp. The screen is
      // set first: ending the floor draws the page itself.
      case 'finish': guard(() => {
        ui.place = null;
        ui.mustering = false;
        ui.tab = 'camp';
        game.endExpedition();
      }); break;
      default: break;
    }
  });

  game.subscribe(() => {
    ui.notice = '';
    // Trained, rested, re-kitted while the lobby waits: the others hear it.
    if (ui.session && !game.expedition) ui.session.refreshParty();
    renderAfterAction();
    keepSave();
  });

  return { render, ui };
}
