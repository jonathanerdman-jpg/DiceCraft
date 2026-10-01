// Co-operative quests run as deterministic lockstep: every peer builds the
// same floor from the same seed and applies the same ordered list of actions,
// so nothing but small messages ever crosses the wire. No server is involved.
//
// A Transport is anything that can broadcast an object and hand back the
// objects other peers broadcast. BroadcastChannelTransport joins tabs in one
// browser; MemoryTransport wires peers together inside a test; and
// WebSocketTransport reaches other machines through the quest relay (worker/index.js),
// which is served from the game's own site when it is deployed to Cloudflare.

import { STORAGE } from './brand.js';

export const PROTOCOL = 1;

// Actions a peer may take that must reach everybody, in the order they
// happened. Anything not listed is local and private (browsing your roster,
// resting, recruiting).
export const SHARED_ACTIONS = [
  'move', 'choosePair', 'chooseActor', 'takeTheFall', 'match', 'discard',
  'reroll', 'useAbility', 'withdraw', 'befriend', 'leaveWild', 'takeWild',
  'takeBounty', 'openChest', 'leaveChest', 'useTrinket', 'climb', 'towerTake',
];

export class MemoryTransport {
  constructor(bus = { peers: [] }) {
    this.bus = bus;
    this.bus.peers.push(this);
    this.handlers = new Set();
    this.closed = false;
  }

  static pair() {
    const bus = { peers: [] };
    return [new MemoryTransport(bus), new MemoryTransport(bus)];
  }

  send(message) {
    if (this.closed) return;
    this.bus.peers.forEach((peer) => {
      if (peer !== this && !peer.closed) peer.handlers.forEach((fn) => fn(message));
    });
  }

  listen(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  close() { this.closed = true; this.handlers.clear(); }
}

export class BroadcastChannelTransport {
  constructor(code) {
    this.channel = new BroadcastChannel(`${STORAGE}:quest:${code}`);
    this.handlers = new Set();
    this.channel.onmessage = (event) => this.handlers.forEach((fn) => fn(event.data));
  }

  send(message) { this.channel.postMessage(message); }
  listen(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  close() { this.channel.close(); this.handlers.clear(); }
}

// Through the quest relay: a WebSocket to /quest/CODE on the site the game
// was loaded from. Messages sent before the socket opens wait for it, and a
// dropped connection (a phone putting the tab to sleep, a train going into a
// tunnel) is retried with a growing pause. Whatever the other player did
// while the connection was down is not replayed, so a quest that missed an
// action says it has lost sync rather than quietly drifting.
export class WebSocketTransport {
  constructor(url, { WebSocketImpl = globalThis.WebSocket, onStatus = () => {} } = {}) {
    if (!WebSocketImpl) throw new Error('this browser cannot open a connection to the relay');
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.onStatus = onStatus;
    this.handlers = new Set();
    this.pending = [];
    this.closed = false;
    this.retries = 0;
    this.status = 'connecting';
    this.onReconnect = null;
    this.connect();
  }

  connect() {
    const ws = new this.WebSocketImpl(this.url);
    this.ws = ws;
    ws.onopen = () => {
      const again = this.retries > 0 || this.status === 'reconnecting';
      this.retries = 0;
      this.setStatus('open');
      const waiting = this.pending;
      this.pending = [];
      waiting.forEach((message) => ws.send(JSON.stringify(message)));
      if (again && this.onReconnect) this.onReconnect();
    };
    ws.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      this.handlers.forEach((fn) => fn(message));
    };
    ws.onclose = () => {
      if (this.closed || this.ws !== ws) return;
      this.setStatus('reconnecting');
      const wait = Math.min(8000, 500 * 2 ** this.retries);
      this.retries += 1;
      this.timer = setTimeout(() => { if (!this.closed) this.connect(); }, wait);
    };
    ws.onerror = () => { /* onclose follows, and that is where the retry lives */ };
  }

  setStatus(status) {
    this.status = status;
    this.onStatus(status);
  }

  send(message) {
    if (this.closed) return;
    const open = this.ws && this.ws.readyState === 1;
    if (open) this.ws.send(JSON.stringify(message));
    else this.pending.push(message);
  }

  listen(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }

  close() {
    // A goodbye sent a moment before closing should still go out.
    if (this.ws && this.ws.readyState === 1) {
      this.pending.forEach((message) => this.ws.send(JSON.stringify(message)));
    }
    this.closed = true;
    clearTimeout(this.timer);
    this.handlers.clear();
    try { this.ws.close(1000, 'bye'); } catch { /* already gone */ }
  }
}

// Where the relay for a quest code lives, given the page's own location.
export function relayUrl(code, where = globalThis.location) {
  const scheme = where.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${where.host}/quest/${encodeURIComponent(code)}`;
}

// Whether this page was served somewhere with a relay behind it. Anywhere
// else — a local file server, the claude.ai page — the answer is no, and
// quests stay between tabs in one browser.
export async function relayAvailable(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return false;
  try {
    const response = await fetchImpl('quest-relay', { cache: 'no-store' });
    if (!response.ok) return false;
    const body = await response.json();
    return Boolean(body && body.relay);
  } catch {
    return false;
  }
}

export function questCode(random = Math.random) {
  const letters = 'BCDFGHJKLMNPQRSTVWXZ';
  return Array.from({ length: 4 }, () => letters[Math.floor(random() * letters.length)]).join('');
}

export class Session {
  constructor({ game, transport, peerId, code, host = false, onChange = () => {} }) {
    this.game = game;
    this.transport = transport;
    this.peerId = peerId;
    this.code = code;
    this.host = host;
    this.onChange = onChange;
    this.lobby = new Map();          // peerId -> member (a hero)
    this.parties = new Map();        // peerId -> [hero, ...companions] they bring
    this.hostPeer = host ? peerId : null;
    // Where the host proposes to go, and who has agreed to it. Nobody sets
    // out until everybody in the lobby has.
    this.plan = null;                // { id, placeId, depthNumber, tower, label }
    this.agreed = new Set();
    this.rejectedBy = null;
    this.seq = 0;                    // next sequence number the host will issue
    this.applied = 0;                // how many actions this peer has applied
    this.queue = new Map();          // seq -> message, for anything early
    this.desynced = false;
    this.started = false;
    this.stop = transport.listen((m) => this.receive(m));
    // Back after a dropped connection: say so, so the others know we are here.
    if ('onReconnect' in transport) transport.onReconnect = () => this.announce();
    this.announce();
  }

  get members() { return [...this.lobby.values()]; }
  get roster() {
    return [...this.lobby.entries()].map(([peerId, member]) => ({
      peerId, member, party: this.parties.get(peerId) || (member ? [member] : []),
    }));
  }

  // Everybody brings their own character, and whichever of their own
  // companions they have picked. The party travels with every hello, and a
  // change of mind in the lobby is sent on its own.
  get myParty() {
    return this.parties.get(this.peerId) || (this.game.hero ? [this.game.hero] : []);
  }

  // A party is four at most, heroes first. Two players may each bring one
  // companion; with three, only the lead may; with four, nobody may. Alone
  // in the lobby, a player may pick as many as their own renown allows —
  // what they may actually bring is settled by who else turns up.
  allowance(peerId) {
    const players = this.lobby.size;
    if (players <= 1) return Infinity;
    if (players === 2) return 1;
    if (players === 3) return peerId === this.hostPeer ? 1 : 0;
    return 0;
  }

  // Keep my own pick inside my allowance, and say so if it had to shrink.
  fitParty() {
    const mine = this.parties.get(this.peerId);
    if (!mine) return false;
    const room = this.allowance(this.peerId);
    if (mine.length - 1 <= room) return false;
    this.parties.set(this.peerId, mine.slice(0, 1 + room));
    this.transport.send({ protocol: PROTOCOL, kind: 'party', peerId: this.peerId, party: this.parties.get(this.peerId) });
    return true;
  }

  setParty(members) {
    const hero = this.game.hero;
    const room = this.allowance(this.peerId);
    const picked = members.filter((m) => m && m.uid !== hero.uid);
    if (picked.length > room) {
      throw new Error(room === 0
        ? 'with this many players, the heroes go alone'
        : `with this many players you may bring ${room} companion${room === 1 ? '' : 's'}`);
    }
    const party = [hero, ...picked];
    this.parties.set(this.peerId, party);
    this.transport.send({ protocol: PROTOCOL, kind: 'party', peerId: this.peerId, party });
    this.onChange();
  }

  // The character as they are now. Whatever changes while the lobby waits —
  // a level trained, a night slept — goes to the others, so the floor is
  // built from the player and not from who they were when they joined.
  refreshParty() {
    const hero = this.game.hero;
    if (!hero) return false;
    const now = [hero, ...this.myParty.slice(1)
      .map((m) => this.game.state.roster.find((c) => c.uid === m.uid))
      .filter(Boolean)];
    const was = this.parties.get(this.peerId);
    if (was && JSON.stringify(was) === JSON.stringify(now)) return false;
    if (!was && now.length === 1 && JSON.stringify(this.lobby.get(this.peerId)) === JSON.stringify(hero)) return false;
    this.lobby.set(this.peerId, hero);
    this.parties.set(this.peerId, now);
    this.transport.send({ protocol: PROTOCOL, kind: 'here', peerId: this.peerId, member: hero, party: now, host: this.host });
    return true;
  }

  remember(message) {
    if (message.member) this.lobby.set(message.peerId, message.member);
    if (Array.isArray(message.party)) this.parties.set(message.peerId, message.party);
    if (message.host) this.hostPeer = message.peerId;
  }

  // --- Where we are going -------------------------------------------------

  propose({ placeId = null, depthNumber = null, tower = false, label = '' }) {
    if (!this.host) throw new Error('the host proposes where the quest goes');
    this.plan = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, placeId, depthNumber, tower, label };
    this.agreed = new Set([this.peerId]);
    this.rejectedBy = null;
    this.transport.send({ protocol: PROTOCOL, kind: 'propose', peerId: this.peerId, plan: this.plan, agreed: [...this.agreed] });
    this.onChange();
  }

  agree() {
    if (!this.plan) throw new Error('nothing has been proposed');
    this.agreed.add(this.peerId);
    this.transport.send({ protocol: PROTOCOL, kind: 'agree', peerId: this.peerId, id: this.plan.id });
    this.onChange();
  }

  reject() {
    if (!this.plan) throw new Error('nothing has been proposed');
    const id = this.plan.id;
    this.plan = null;
    this.agreed = new Set();
    this.rejectedBy = this.peerId;
    this.transport.send({ protocol: PROTOCOL, kind: 'reject', peerId: this.peerId, id });
    this.onChange();
  }

  get everyoneAgreed() {
    return Boolean(this.plan) && this.lobby.size > 1 && [...this.lobby.keys()].every((p) => this.agreed.has(p));
  }

  // The host sets out on what everybody agreed to, with everybody's party.
  setOut({ upright = false } = {}) {
    if (!this.host) throw new Error('only the host may open the floor');
    if (!this.everyoneAgreed) throw new Error('not everybody has agreed where to go');
    const { placeId, depthNumber, tower } = this.plan;
    this.start({ placeId, depthNumber, tower, upright });
  }

  announce() {
    const hero = this.game.hero;
    if (hero) this.lobby.set(this.peerId, hero);
    this.transport.send({ protocol: PROTOCOL, kind: 'hello', peerId: this.peerId, member: hero, party: this.myParty, host: this.host });
    this.onChange();
  }

  // --- Outbound -----------------------------------------------------------

  // Applies an action locally and tells everyone else to do the same. Only
  // the peer who owns the character may act, which is also what keeps two
  // people from moving at once.
  dispatch(action, args = []) {
    if (!SHARED_ACTIONS.includes(action)) throw new Error(`${action} is not a shared action`);
    if (this.desynced) throw new Error('this quest has lost sync');
    const seq = this.applied;
    this.applyAction(action, args);
    this.applied = seq + 1;
    this.transport.send({ protocol: PROTOCOL, kind: 'act', peerId: this.peerId, seq, action, args });
    this.onChange();
  }

  // `tower` opens the Iron Tower instead of a posting.
  start({ depthNumber = null, placeId = null, tower = false, seed = (Math.random() * 4294967296) >>> 0, upright = false }) {
    if (!this.host) throw new Error('only the host may open the floor');
    const roster = this.roster;
    if (roster.length < 2) throw new Error('nobody else has joined yet');
    const payload = {
      protocol: PROTOCOL,
      kind: 'begin',
      depthNumber,
      placeId,
      tower,
      seed,
      // The host's screen decides the shape, and everybody gets that shape:
      // the floor has to be identical on both machines or the lockstep breaks.
      upright,
      members: roster.flatMap((r) => r.party.slice(0, 1 + Math.min(r.party.length - 1, this.allowance(r.peerId)))),
      owners: Object.fromEntries(roster.flatMap((r) => r.party.map((m) => [m.uid, r.peerId]))),
    };
    this.transport.send(payload);
    this.begin(payload);
  }

  begin({ depthNumber, placeId = null, tower = false, seed, members, owners, upright = false }) {
    this.started = true;
    this.plan = null;
    this.agreed = new Set();
    this.applied = 0;
    this.queue.clear();
    if (tower) this.game.beginTower({ seed, upright, members, owners, localPeer: this.peerId });
    else this.game.beginExpedition({ depthNumber, placeId, seed, upright, members, owners, localPeer: this.peerId });
    this.onChange();
  }

  // --- Inbound ------------------------------------------------------------

  receive(message) {
    if (!message || message.protocol !== PROTOCOL) return;
    switch (message.kind) {
      case 'hello':
        this.remember(message);
        // Answer a newcomer so they learn about everyone already here — and,
        // from the host, about where the quest is proposing to go.
        if (message.peerId !== this.peerId) {
          this.transport.send({ protocol: PROTOCOL, kind: 'here', peerId: this.peerId, member: this.game.hero, party: this.myParty, host: this.host });
          if (this.host && this.plan) {
            this.transport.send({ protocol: PROTOCOL, kind: 'propose', peerId: this.peerId, plan: this.plan, agreed: [...this.agreed] });
          }
        }
        this.fitParty();
        this.onChange();
        break;
      case 'here':
        this.remember(message);
        this.fitParty();
        this.onChange();
        break;
      case 'propose':
        this.plan = message.plan;
        this.agreed = new Set(message.agreed || [message.peerId]);
        this.rejectedBy = null;
        this.onChange();
        break;
      case 'agree':
        if (this.plan && this.plan.id === message.id) this.agreed.add(message.peerId);
        this.onChange();
        break;
      case 'reject':
        if (this.plan && this.plan.id === message.id) {
          this.plan = null;
          this.agreed = new Set();
          this.rejectedBy = message.peerId;
        }
        this.onChange();
        break;
      case 'party':
        if (Array.isArray(message.party)) this.parties.set(message.peerId, message.party);
        this.onChange();
        break;
      case 'begin':
        this.begin(message);
        break;
      case 'act':
        this.queue.set(message.seq, message);
        this.drain();
        break;
      case 'bye':
        this.lobby.delete(message.peerId);
        this.parties.delete(message.peerId);
        this.agreed.delete(message.peerId);
        this.onChange();
        break;
      default:
        break;
    }
  }

  // Actions are applied strictly in sequence; anything that arrives early
  // waits its turn rather than being applied out of order.
  drain() {
    while (this.queue.has(this.applied)) {
      const message = this.queue.get(this.applied);
      this.queue.delete(this.applied);
      try {
        this.applyAction(message.action, message.args);
        this.applied++;
      } catch (err) {
        this.desynced = true;
        this.error = err.message;
        break;
      }
    }
    this.onChange();
  }

  applyAction(action, args) {
    const fn = this.game[action];
    if (typeof fn !== 'function') throw new Error(`unknown action ${action}`);
    fn.apply(this.game, args);
  }

  leave() {
    this.transport.send({ protocol: PROTOCOL, kind: 'bye', peerId: this.peerId });
    this.stop();
    this.transport.close();
  }
}
