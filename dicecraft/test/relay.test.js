import test from 'node:test';
import assert from 'node:assert/strict';
import { QuestRoom, roomName, toRoom } from '../worker/index.js';
import { WebSocketTransport, relayAvailable, relayUrl, questCode } from '../js/coop.js';

// --- The relay ---------------------------------------------------------------

function fakeRoom() {
  const sockets = [];
  const ctx = { getWebSockets: () => sockets.filter((s) => !s.closed) };
  const room = new QuestRoom(ctx, {});
  const join = () => {
    const socket = { got: [], closed: false, send(m) { this.got.push(m); }, close() { this.closed = true; } };
    sockets.push(socket);
    return socket;
  };
  return { room, join };
}

test('a room passes each note to everybody but its sender, in order', () => {
  const { room, join } = fakeRoom();
  const a = join();
  const b = join();
  const c = join();
  room.webSocketMessage(a, '{"n":1}');
  room.webSocketMessage(a, '{"n":2}');
  room.webSocketMessage(b, '{"n":3}');
  assert.deepEqual(a.got, ['{"n":3}'], 'nobody hears their own voice back');
  assert.deepEqual(b.got, ['{"n":1}', '{"n":2}']);
  assert.deepEqual(c.got, ['{"n":1}', '{"n":2}', '{"n":3}'], 'and the order is kept');
});

test('a room will not carry binary or oversized messages', () => {
  const { room, join } = fakeRoom();
  const a = join();
  const b = join();
  room.webSocketMessage(a, new ArrayBuffer(8));
  room.webSocketMessage(a, 'x'.repeat(70 * 1024));
  assert.deepEqual(b.got, []);
});

test('only a real quest code makes a room', () => {
  const code = questCode();
  assert.equal(roomName(code), code);
  assert.equal(roomName(code.toLowerCase()), code, 'case does not matter');
  ['', 'ABCD', 'BCD', 'BCDFG', '../x', 'BC1D'].forEach((bad) => assert.equal(roomName(bad), null, bad));
  const refused = toRoom(new Request('https://x/quest/nope', { headers: { Upgrade: 'websocket' } }), null, 'nope');
  assert.equal(refused.status, 400);
  const plain = toRoom(new Request('https://x/quest/BCDF'), null, 'BCDF');
  assert.equal(plain.status, 426, 'and only over a WebSocket');
});

// --- The client ---------------------------------------------------------------

class FakeSocket {
  static made = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.made.push(this);
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen(); }
  drop() { this.readyState = 3; this.onclose(); }
  hear(message) { this.onmessage({ data: JSON.stringify(message) }); }
}

test('a message sent before the relay answers waits for it, and messages come back parsed', () => {
  FakeSocket.made = [];
  const statuses = [];
  const t = new WebSocketTransport('wss://game.example/quest/BCDF', { WebSocketImpl: FakeSocket, onStatus: (s) => statuses.push(s) });
  const heard = [];
  t.listen((m) => heard.push(m));
  t.send({ kind: 'hello' });
  const socket = FakeSocket.made[0];
  assert.deepEqual(socket.sent, [], 'nothing goes out before the socket is open');
  socket.open();
  assert.deepEqual(socket.sent, [{ kind: 'hello' }], 'and then it all goes, in order');
  socket.hear({ kind: 'here', peerId: 'b' });
  assert.deepEqual(heard, [{ kind: 'here', peerId: 'b' }]);
  assert.deepEqual(statuses, ['open']);
  t.close();
});

test('a dropped connection is retried, and the session says hello again when it is back', async () => {
  FakeSocket.made = [];
  const t = new WebSocketTransport('wss://game.example/quest/BCDF', { WebSocketImpl: FakeSocket });
  let hellos = 0;
  t.onReconnect = () => { hellos += 1; };
  FakeSocket.made[0].open();
  FakeSocket.made[0].drop();
  assert.equal(t.status, 'reconnecting');
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(FakeSocket.made.length, 2, 'it tried again');
  FakeSocket.made[1].open();
  assert.equal(t.status, 'open');
  assert.equal(hellos, 1);
  t.close();
  FakeSocket.made[1].drop();
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(FakeSocket.made.length, 2, 'and once closed on purpose, it stays closed');
});

test('the relay lives on the page\'s own site, and is only used where it answers', async () => {
  assert.equal(relayUrl('BCDF', { protocol: 'https:', host: 'dice.pages.dev' }), 'wss://dice.pages.dev/quest/BCDF');
  assert.equal(relayUrl('BCDF', { protocol: 'http:', host: 'localhost:8788' }), 'ws://localhost:8788/quest/BCDF');
  const answering = async () => ({ ok: true, json: async () => ({ relay: true }) });
  const missing = async () => ({ ok: false, json: async () => ({}) });
  const blocked = async () => { throw new Error('blocked'); };
  assert.equal(await relayAvailable(answering), true);
  assert.equal(await relayAvailable(missing), false, 'a 404 means tabs in one browser');
  assert.equal(await relayAvailable(blocked), false, 'and so does a page that may not ask');
});

test('the Worker answers the relay question and quest sockets, and leaves everything else to the files', async () => {
  const { default: worker } = await import('../worker/index.js');
  const served = [];
  const env = {
    QUESTS: {
      idFromName: (name) => `id:${name}`,
      get: (id) => ({ fetch: async () => new Response(`room ${id}`) }),
    },
    ASSETS: { fetch: async (request) => { served.push(new URL(request.url).pathname); return new Response('file'); } },
  };
  const ask = await worker.fetch(new Request('https://dice.example/quest-relay'), env);
  assert.deepEqual(await ask.json(), { relay: true });
  const room = await worker.fetch(new Request('https://dice.example/quest/bcdf', { headers: { Upgrade: 'websocket' } }), env);
  assert.equal(await room.text(), 'room id:BCDF', 'every spelling of a code lands in one room');
  await worker.fetch(new Request('https://dice.example/somewhere/else'), env);
  assert.deepEqual(served, ['/somewhere/else']);
  const unbound = await worker.fetch(new Request('https://dice.example/quest-relay'), {});
  assert.deepEqual(await unbound.json(), { relay: false }, 'without the relay bound it says so, and the page falls back to tabs');
});
