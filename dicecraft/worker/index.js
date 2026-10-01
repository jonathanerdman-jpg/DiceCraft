// The game's Worker: it serves the game, and it is the quest relay.
//
// Everything the page loads is a static file in dist/ (built by
// `npm run build:pages`), and Cloudflare serves those straight from its
// assets store without running any code. What reaches this script is the
// little that is not a file:
//
//   /quest-relay   the page asks this before opening a quest; a yes means
//                  shared quests can reach other machines
//   /quest/CODE    the WebSocket for one quest, handed to that code's room
//
// A shared quest is deterministic lockstep (js/coop.js): both players build
// the same floor from the same seed and apply the same ordered actions, so
// the only thing that has to cross the internet is a handful of small JSON
// messages — `hello`, `begin`, `act {seq, action, args}`, `bye`. The relay
// does not understand any of them. It forwards each message from one player
// to everybody else in the same room, in the order it received them, and
// that is all.
//
// Each room is a Durable Object named after its four-letter code, so everyone
// who types the same code lands in the same object on the same machine, and
// messages keep their order. It uses the WebSocket Hibernation API, so an idle
// room costs nothing while two people are staring at a map deciding.

// Big enough for the largest real message (a `begin` carrying every member's
// sheet), small enough that nobody can use a room as a file host.
const MAX_MESSAGE = 64 * 1024;
// A shared quest is two players; this leaves room for more later without
// letting a room fill up with abandoned tabs.
const MAX_PEERS = 8;

export class QuestRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('This is a quest room. Connect with a WebSocket.', { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_PEERS) {
      return new Response('This quest is full.', { status: 429 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    this.ctx.getWebSockets().forEach((other) => {
      if (other === ws) return;
      try { other.send(message); } catch { /* it is going, and close will tidy it */ }
    });
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  webSocketError(ws) {
    try { ws.close(1011, 'error'); } catch { /* already closed */ }
  }
}

// A quest code is four consonants (js/coop.js questCode). Anything else is
// refused before it can make a room.
export function roomName(raw) {
  const code = String(raw || '').toUpperCase();
  return /^[B-DF-HJ-NP-TV-XZ]{4}$/.test(code) ? code : null;
}

// Hand a connection to the room for its code.
export function toRoom(request, namespace, raw) {
  const code = roomName(raw);
  if (!code) return new Response('That is not a quest code.', { status: 400 });
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Connect with a WebSocket.', { status: 426 });
  }
  return namespace.get(namespace.idFromName(code)).fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/quest-relay') {
      return new Response(JSON.stringify({ relay: Boolean(env.QUESTS) }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    const match = url.pathname.match(/^\/quest\/([^/]+)$/);
    if (match) {
      if (!env.QUESTS) return new Response('The quest relay is not bound.', { status: 503 });
      return toRoom(request, env.QUESTS, match[1]);
    }
    // Anything else that is not one of the game's files.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found.', { status: 404 });
  },
};
