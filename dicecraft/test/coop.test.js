import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryTransport, SHARED_ACTIONS, Session, questCode } from '../js/coop.js';
import { Game, createCompanion, newGameState } from '../js/game.js';

function peer(name, classId, transport, host) {
  const game = new Game(newGameState());
  game.createCharacter(name, classId);
  game.hero.uid = `hero-${name}`; // pinned so the assertions below stay readable
  game.hero.level = 8;
  const session = new Session({ game, transport, peerId: name, code: 'TEST', host });
  return { game, session };
}

function twoPlayers() {
  const [ta, tb] = MemoryTransport.pair();
  const a = peer('Ayla', 'fighter', ta, true);
  const b = peer('Brin', 'cleric', tb, false);
  return { a, b };
}

// Compares the parts of two expeditions that must never drift apart.
function snapshot(game) {
  const x = game.expedition;
  return {
    status: x.status,
    position: x.map.position,
    pending: x.pending.gold,
    multiplier: x.multiplier,
    tiles: Object.values(x.map.tiles).map((t) => `${t.key}:${t.kind}:${t.state}`).sort(),
    tray: x.encounter ? x.encounter.tray.map((e) => `${e.die.sides}:${e.face}`) : null,
    matched: x.encounter ? x.encounter.challenge.trials.map((t) => t.matched.join('')) : null,
    training: x.pending.training,
    members: x.members.map((m) => `${m.uid}:${m.level || m.rank}:${m.stamina}`).sort(),
  };
}

test('peers find each other and see the same lobby', () => {
  const { a, b } = twoPlayers();
  assert.equal(a.session.roster.length, 2);
  assert.equal(b.session.roster.length, 2);
  assert.deepEqual(
    a.session.roster.map((r) => r.peerId).sort(),
    b.session.roster.map((r) => r.peerId).sort(),
  );
});

test('only the host may open a floor, and not alone', () => {
  const { a, b } = twoPlayers();
  assert.throws(() => b.session.start({ depthNumber: 1 }), /only the host/);
  const [solo] = MemoryTransport.pair();
  const lonely = peer('Solo', 'mage', solo, true);
  assert.throws(() => lonely.session.start({ depthNumber: 1 }), /nobody else/);
});

test('beginning a quest builds an identical floor for both peers', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 3, seed: 20240 });
  assert.deepEqual(snapshot(a.game), snapshot(b.game));
  assert.equal(a.game.expedition.partyUids.length, 2, 'both heroes are in the party');
  assert.equal(a.game.expedition.localPeer, 'Ayla');
  assert.equal(b.game.expedition.localPeer, 'Brin');
});

test('each peer owns only their own character', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 3, seed: 20240 });
  assert.equal(a.game.owns('hero-Ayla'), true);
  assert.equal(a.game.owns('hero-Brin'), false);
  assert.equal(b.game.owns('hero-Brin'), true);
  assert.equal(b.game.owns('hero-Ayla'), false);
});

test('a move by one peer moves both, and the dice land the same way', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 3, seed: 771 });
  const here = a.game.expedition.map.tiles[a.game.expedition.map.position];
  a.session.dispatch('move', [here.links[0]]);
  assert.deepEqual(snapshot(a.game), snapshot(b.game));

  if (a.game.expedition.status !== 'choosing') return;
  // Two go in while two can stand, and both heroes are on their feet here.
  b.session.dispatch('choosePair', ['hero-Brin', 'hero-Ayla']);
  assert.deepEqual(snapshot(a.game), snapshot(b.game));
  assert.deepEqual(
    a.game.expedition.encounter.tray.map((e) => e.face),
    b.game.expedition.encounter.tray.map((e) => e.face),
    'the same seed must produce the same throw on both machines',
  );
});

test('a whole floor stays in step across many actions', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 4, seed: 9182 });
  const turn = [a, b];
  let who = 0;
  for (let step = 0; step < 120; step++) {
    const x = a.game.expedition;
    if (x.status === 'complete' || x.status === 'failed') break;
    // Whoever is not acting takes the next decision, so both peers drive.
    const actor = turn[who % 2];
    who++;
    if (x.status === 'exploring') {
      const here = x.map.tiles[x.map.position];
      actor.session.dispatch('move', [here.links[step % here.links.length]]);
    } else if (x.status === 'choosing') {
      // Two go in, and only somebody still on their feet can be one of them.
      const up = a.game.standing().map((m) => m.uid);
      const first = up[step % up.length];
      const second = up.find((uid) => uid !== first) || null;
      actor.session.dispatch('choosePair', [first, second]);
    } else if (x.status === 'falling') {
      // Somebody has to stay down, and either peer may say who.
      actor.session.dispatch('takeTheFall', [x.actorUids[step % x.actorUids.length]]);
    } else if (x.status === 'encounter') {
      const e = x.encounter;
      const owner = turn.find((p) => x.actorUids.some((uid) => p.game.owns(uid)));
      const matches = e.availableMatches();
      if (matches.length) owner.session.dispatch('match', [matches[0].dieIndex, matches[0].slotIndex]);
      else if (e.legalActions().canReroll) owner.session.dispatch('reroll', []);
      else owner.session.dispatch('discard', [0]);
    }
    assert.deepEqual(snapshot(a.game), snapshot(b.game), `peers drifted apart at step ${step}`);
  }
  assert.ok(a.session.applied > 5, 'the quest actually ran');
  assert.equal(a.session.desynced, false);
  assert.equal(b.session.desynced, false);
});

test('actions that arrive early wait for their turn instead of being applied out of order', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 1, seed: 5 });
  // Make the neighbouring tile an empty passage on both peers, so stepping
  // back and forth is always legal and the test is about ordering alone.
  const entrance = a.game.expedition.map.position;
  const target = a.game.expedition.map.tiles[entrance].links[0];
  [a, b].forEach((p) => {
    const tile = p.game.expedition.map.tiles[target];
    tile.kind = 'passage';
    tile.challenge = null;
    tile.hazard = null;
  });
  const back = { protocol: 1, kind: 'act', peerId: 'Ayla', seq: 1, action: 'move', args: [entrance] };
  const forth = { protocol: 1, kind: 'act', peerId: 'Ayla', seq: 0, action: 'move', args: [target] };

  b.session.receive(back);
  assert.equal(b.session.applied, 0, 'nothing was applied out of order');
  assert.equal(b.session.queue.size, 1, 'it is being held');
  assert.equal(b.game.expedition.map.position, entrance, 'and the floor has not moved');

  b.session.receive(forth);
  assert.equal(b.session.applied, 2, 'both land, in order, once the gap is filled');
  assert.equal(b.session.desynced, false);
  assert.equal(b.game.expedition.map.position, entrance, 'there and back again');
});

test('an action that cannot be applied is reported rather than silently ignored', () => {
  const { a, b } = twoPlayers();
  a.session.start({ depthNumber: 1, seed: 5 });
  b.session.receive({ protocol: 1, kind: 'act', peerId: 'Ayla', seq: 0, action: 'move', args: ['99,99'] });
  assert.equal(b.session.desynced, true);
  assert.match(b.session.error, /no way through/);
  assert.throws(() => b.session.dispatch('reroll', []), /lost sync/);
});

test('messages from another protocol version are ignored', () => {
  const { b } = twoPlayers();
  const before = b.session.roster.length;
  b.session.receive({ protocol: 99, kind: 'hello', peerId: 'Ghost', member: { uid: 'x' } });
  assert.equal(b.session.roster.length, before);
});

test('leaving removes a peer from everyone else lobby', () => {
  const { a, b } = twoPlayers();
  b.session.leave();
  assert.equal(a.session.roster.length, 1);
});

test('only whitelisted actions can be sent to other peers', () => {
  const { a } = twoPlayers();
  assert.throws(() => a.session.dispatch('recruit', ['sellsword']), /not a shared action/);
  assert.equal(SHARED_ACTIONS.includes('rest'), false, 'resting is your own business');
});

test('quest codes are short and unambiguous', () => {
  const code = questCode(() => 0.5);
  assert.equal(code.length, 4);
  assert.match(questCode(), /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
});

// --- The Iron Tower, climbed together ------------------------------------------

function towerSnapshot(game) {
  const x = game.expedition;
  return { ...snapshot(game), level: x.level, best: x.best, mode: x.mode };
}

test('the Tower can be climbed together, and both peers climb the same tower', () => {
  const { a, b } = twoPlayers();
  // Different companies keep different creatures; the floors must not care.
  b.game.state.roster.push(createCompanion('direwolf'));
  a.session.start({ tower: true, seed: 777 });
  assert.equal(a.game.expedition.mode, 'tower');
  assert.equal(b.game.expedition.mode, 'tower');
  assert.deepEqual(towerSnapshot(a.game), towerSnapshot(b.game), 'the first floor is the same floor');

  // Walk the first floor with both peers driving, and check every step.
  const turn = [a, b];
  for (let step = 0; step < 80; step++) {
    const x = a.game.expedition;
    if (x.status !== 'exploring' && x.status !== 'choosing' && x.status !== 'encounter'
      && x.status !== 'chest' && x.status !== 'falling') break;
    const actor = turn[step % 2];
    if (x.status === 'exploring') {
      const here = x.map.tiles[x.map.position];
      actor.session.dispatch('move', [here.links[step % here.links.length]]);
    } else if (x.status === 'chest') {
      actor.session.dispatch('openChest', []);
    } else if (x.status === 'choosing') {
      const up = a.game.standing().map((m) => m.uid);
      actor.session.dispatch('choosePair', [up[0], up[1] || null]);
    } else if (x.status === 'falling') {
      actor.session.dispatch('takeTheFall', [x.actorUids[0]]);
    } else {
      const e = x.encounter;
      const owner = turn.find((p) => x.actorUids.some((uid) => p.game.owns(uid)));
      const matches = e.availableMatches();
      if (matches.length) owner.session.dispatch('match', [matches[0].dieIndex, matches[0].slotIndex]);
      else if (e.legalActions().canReroll) owner.session.dispatch('reroll', []);
      else owner.session.dispatch('discard', [0]);
    }
    assert.deepEqual(towerSnapshot(a.game), towerSnapshot(b.game), `peers drifted apart at step ${step}`);
  }
  assert.equal(a.session.desynced, false);
  assert.equal(b.session.desynced, false);
});

test('on a landing, either player may climb on or take the table, and both go together', () => {
  const { a, b } = twoPlayers();
  a.session.start({ tower: true, seed: 4242 });
  // Beat the first floor on both copies the same way, and stand on the landing.
  [a, b].forEach((p) => { p.game.expedition.pending.gold = 90; p.game.towerCleared(); });
  b.session.dispatch('climb', []);
  assert.equal(a.game.expedition.level, 2, 'the guest climbed, and the host went with them');
  assert.equal(b.game.expedition.level, 2);
  assert.deepEqual(towerSnapshot(a.game), towerSnapshot(b.game), 'onto the same second floor');

  [a, b].forEach((p) => { p.game.expedition.pending.gold = 140; p.game.towerCleared(); });
  const bankA = a.game.state.gold;
  a.session.dispatch('towerTake', []);
  assert.equal(a.game.expedition.status, 'complete');
  assert.equal(b.game.expedition.status, 'complete', 'the host took it, and both went home');
  assert.equal(a.game.state.gold, bankA + 140);
});

test('each player brings their own companion, and plays it', () => {
  const { a, b } = twoPlayers();
  const wolf = createCompanion('direwolf');
  const squire = createCompanion('squire');
  b.game.state.roster.push(wolf, squire);
  assert.throws(() => b.session.setParty([wolf, squire]), /1 companion/, 'two players bring one companion each');
  b.session.setParty([wolf]);
  assert.deepEqual(a.session.roster.find((r) => r.peerId === 'Brin').party.map((m) => m.uid),
    ['hero-Brin', wolf.uid], 'the host sees what the guest is bringing');
  a.session.start({ depthNumber: 1, seed: 31 });
  [a, b].forEach((p) => {
    assert.deepEqual([...p.game.expedition.partyUids].sort(), ['hero-Ayla', 'hero-Brin', wolf.uid].sort());
  });
  assert.equal(b.game.owns(wolf.uid), true, 'the guest plays their own wolf');
  assert.equal(a.game.owns(wolf.uid), false, 'and the host does not');
  assert.deepEqual(snapshot(a.game), snapshot(b.game));
});

// Three or four players on one bus, for the party-size rules.
function crowd(n) {
  const bus = { peers: [] };
  const names = ['Ayla', 'Brin', 'Cato', 'Dara'].slice(0, n);
  return names.map((name, i) => peer(name, 'fighter', new MemoryTransport(bus), i === 0));
}

test('a party is four at most: one companion each for two, the lead’s for three, none for four', () => {
  const [a, b] = crowd(2);
  assert.equal(a.session.allowance('Ayla'), 1);
  assert.equal(a.session.allowance('Brin'), 1);
  const three = crowd(3);
  assert.equal(three[1].session.allowance('Ayla'), 1, 'with three, the lead may bring one');
  assert.equal(three[0].session.allowance('Brin'), 0, 'and nobody else may');
  assert.equal(three[0].session.allowance('Cato'), 0);
  const four = crowd(4);
  ['Ayla', 'Brin', 'Cato', 'Dara'].forEach((p) => assert.equal(four[0].session.allowance(p), 0, 'four heroes, no companions'));
  assert.ok(a && b);
});

test('a pick that no longer fits is trimmed when somebody else turns up', () => {
  const bus = { peers: [] };
  const a = peer('Ayla', 'fighter', new MemoryTransport(bus), true);
  const b = peer('Brin', 'fighter', new MemoryTransport(bus), false);
  const mate = createCompanion('squire');
  b.game.state.roster.push(mate);
  b.session.setParty([mate]);
  peer('Cato', 'fighter', new MemoryTransport(bus), false);
  assert.deepEqual(b.session.myParty.map((m) => m.uid), ['hero-Brin'], 'with three, only the lead brings anyone');
  assert.deepEqual(a.session.roster.find((r) => r.peerId === 'Brin').party.map((m) => m.uid), ['hero-Brin'],
    'and everybody hears it was trimmed');
});

test('nobody sets out until everybody has agreed where to go', () => {
  const { a, b } = twoPlayers();
  assert.throws(() => a.session.setOut(), /not everybody has agreed/);
  assert.throws(() => b.session.propose({ depthNumber: 1 }), /host proposes/);
  a.session.propose({ depthNumber: 1, placeId: null, label: 'The Shallows' });
  assert.equal(b.session.plan.label, 'The Shallows', 'the guest hears the proposal');
  assert.equal(a.session.everyoneAgreed, false);
  assert.throws(() => a.session.setOut(), /not everybody has agreed/);
  b.session.reject();
  assert.equal(a.session.plan, null, 'somewhere else clears it for everyone');
  assert.equal(a.session.rejectedBy, 'Brin');
  a.session.propose({ depthNumber: 1, label: 'The Shallows' });
  b.session.agree();
  assert.equal(a.session.everyoneAgreed, true);
  a.session.setOut();
  assert.ok(a.game.expedition && b.game.expedition, 'and then both are on the floor');
  assert.equal(a.session.plan, null, 'the plan is used up');
});

test('somebody who joins after the proposal hears it, and has to agree too', () => {
  const bus = { peers: [] };
  const a = peer('Ayla', 'fighter', new MemoryTransport(bus), true);
  const b = peer('Brin', 'fighter', new MemoryTransport(bus), false);
  a.session.propose({ tower: true, label: 'The Iron Tower' });
  b.session.agree();
  assert.equal(a.session.everyoneAgreed, true);
  const c = peer('Cato', 'fighter', new MemoryTransport(bus), false);
  assert.equal(c.session.plan && c.session.plan.label, 'The Iron Tower');
  assert.equal(a.session.everyoneAgreed, false, 'a newcomer has not agreed yet');
  c.session.agree();
  assert.equal(a.session.everyoneAgreed, true);
});

test('a change of mind in the lobby is heard, and a newcomer learns everyone’s party', () => {
  const [ta, tb] = MemoryTransport.pair();
  const a = peer('Ayla', 'fighter', ta, true);
  const mate = createCompanion('squire');
  a.game.state.roster.push(mate);
  a.session.setParty([mate]);
  a.session.setParty([]);
  const b = peer('Brin', 'cleric', tb, false);
  assert.deepEqual(b.session.roster.find((r) => r.peerId === 'Ayla').party.map((m) => m.uid), ['hero-Ayla']);
});

test('coming home from a shared quest never undoes training done while waiting in the lobby', () => {
  const { a, b } = twoPlayers();
  // The floor is built from the copy the guest joined with (level 8); by
  // the time they come home their real character has trained twice and
  // rested. (Set after the start here, since the in-memory transport passes
  // objects by reference rather than as the JSON a real one sends.)
  a.session.start({ depthNumber: 1, seed: 12 });
  const copy = b.game.member('hero-Brin');
  assert.equal(copy.level, 8, 'the floor copy is the one they joined with');
  const walkedIn = copy.charges;
  b.game.hero.level = 10;
  b.game.hero.charges = walkedIn + 1; // and a night's rest put one back
  copy.charges -= 1; // one trick spent below
  b.game.expedition.status = 'failed';
  b.game.endExpedition();
  assert.equal(b.game.hero.level, 10, 'a defeat does not cost the levels trained since');
  assert.equal(b.game.hero.charges, walkedIn, 'and only what was spent below comes off');
});

test('a player who trains while waiting is sent to the others as they are now', () => {
  const { a, b } = twoPlayers();
  b.game.hero.level = 12;
  b.session.refreshParty();
  assert.equal(a.session.roster.find((r) => r.peerId === 'Brin').party[0].level, 12);
});
