// Winded: every room somebody takes without sitting one out costs them a die
// in the next, and it adds up; one room's rest puts them back to full. Only
// charged when somebody fresh was left outside to go instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, assembleDice, createCompanion, newGameState } from '../js/game.js';
import { makeChallenge } from '../js/engine.js';

function company(size) {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'fighter');
  g.state.renown = 400;
  const mates = Array.from({ length: size - 1 }, () => {
    const mate = createCompanion('sellsword');
    g.state.roster.push(mate);
    return mate;
  });
  g.startExpedition(1, mates.map((m) => m.uid), 7);
  return g;
}

// Stand the party in a fresh room with a challenge big enough that the hand
// is never "hopeless", and ask who goes in.
function aRoom(g) {
  const x = g.expedition;
  const tile = x.map.tiles[x.map.tiles[x.map.position].links[0]];
  Object.assign(tile, { kind: 'room', state: 'seen', hazard: null, chest: null, mob: 'ghoul' });
  tile.challenge = makeChallenge({ name: 'Ghoul', trials: [['faith']], mob: 'ghoul' });
  x.map.position = tile.key;
  x.status = 'choosing';
  return tile;
}

function win(g) {
  g.expedition.encounter.status = 'won';
  g.act(() => {});
}

const hand = (g, uids) => assembleDice(uids.map((u) => g.member(u))).length;

const lost = (g, uids) => Object.fromEntries(g.winded(uids));

test('three rooms straight and you are three dice down; one room off and you are whole', () => {
  const g = company(4);
  const [a, b, c, d] = g.expedition.partyUids;
  // The hero takes room after room with b, c and d taking turns beside them.
  const partners = [b, c, d];
  for (let room = 0; room < 3; room++) {
    aRoom(g);
    const with_ = partners[room];
    const expectA = room;
    const tired = lost(g, [a, with_]);
    assert.equal(tired[a] || 0, expectA, `room ${room + 1}: the hero is ${expectA} down`);
    g.choosePair(a, with_);
    assert.equal(g.expedition.encounter.remaining.length, hand(g, [a, with_]) - expectA);
    win(g);
  }
  aRoom(g);
  assert.equal(lost(g, [a, b])[a], 3, 'three rooms straight, three dice down in the fourth');
  // The hero sits one out...
  g.choosePair(b, c);
  win(g);
  aRoom(g);
  assert.equal(g.member(a).streak, 0);
  assert.equal(lost(g, [a, d])[a], undefined, '...and is back at full strength');
});

test('the charge is only made when somebody fresh is left outside', () => {
  const g = company(3);
  const [a, b, c] = g.expedition.partyUids;
  aRoom(g);
  g.choosePair(a, b);
  win(g);
  aRoom(g);
  assert.deepEqual(lost(g, [a, b]), { [a]: 1, [b]: 1 }, 'leaving c outside costs both');
  assert.deepEqual(lost(g, [a, c]), {}, 'but nobody fresh is left outside once c goes');
  g.choosePair(a, c);
  win(g);
  // a has two rooms straight, c one, and b sat that one out.
  aRoom(g);
  assert.deepEqual(g.fresh().map((m) => m.uid), [b]);
  assert.deepEqual(lost(g, [a, c]), { [a]: 2, [c]: 1 }, 'the same pair again, with b waiting, pays by the room');
  assert.deepEqual(lost(g, [b, a]), {}, 'and taking b spares everybody');
});

test('a party of one or two has nobody to rotate to, so it is never winded', () => {
  [1, 2].forEach((size) => {
    const g = company(size);
    const uids = g.expedition.partyUids;
    for (let room = 0; room < 3; room++) {
      aRoom(g);
      if (g.expedition.status === 'choosing') g.choosePair(...uids);
      assert.equal(g.expedition.encounter.remaining.length,
        assembleDice(uids.map((u) => g.member(u))).length + (size === 1 ? 2 : 0), `room ${room + 1}, party of ${size}`);
      win(g);
    }
  });
});

test('a fresh companion who is down cannot be sent, so leaving them out costs nothing', () => {
  const g = company(3);
  const [a, b, c] = g.expedition.partyUids;
  aRoom(g);
  g.choosePair(a, b);
  win(g);
  g.member(c).down = true;
  aRoom(g);
  assert.equal(g.winded([a, b]).size, 0);
});
