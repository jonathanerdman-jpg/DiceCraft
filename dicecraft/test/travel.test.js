import test from 'node:test';
import assert from 'node:assert/strict';
import { fromCode, toCode } from '../js/travel.js';
import { Game, createCompanion, newGameState } from '../js/game.js';

function played() {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'ranger');
  g.state.roster.push(createCompanion('sellsword'));
  g.state.gold = 321;
  g.state.renown = 40;
  return g;
}

test('a character travels as one line of text and arrives whole', async () => {
  const g = played();
  const code = await toCode(g.toJSON());
  assert.match(code, /^DICE1z?\./);
  assert.equal(/\s/.test(code), false, 'one line, so it survives being pasted anywhere');

  const there = new Game(newGameState());
  assert.equal(there.adoptSave(await fromCode(code)), true);
  assert.equal(there.hero.name, 'Wren');
  assert.equal(there.state.gold, 321);
  assert.equal(there.state.roster.length, 1);
});

test('a code that is not a character is refused, not half-read', async () => {
  const g = played();
  await assert.rejects(() => fromCode(''), /paste a character code/);
  await assert.rejects(() => fromCode('hello'), /does not look like/);
  await assert.rejects(() => fromCode('DICE1.zzzz'), /not a character from this game|damaged/);
  assert.equal(g.hero.name, 'Wren', 'and nothing was touched on the way');
});

test('opening the game is not playing it: the stamp only moves on a change', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const g = played();
  g.save(storage);
  const first = g.state.savedAt;
  assert.ok(first > 0);

  g.save(storage);
  assert.equal(g.state.savedAt, first, 'saving an unchanged character changes nothing');

  const reopened = Game.load(storage, g.saveKey);
  reopened.save(storage);
  assert.equal(reopened.state.savedAt, first, 'nor does opening it on another device');

  reopened.state.gold += 1;
  reopened.save(storage);
  assert.ok(reopened.state.savedAt > first, 'but playing does');
});

test('an adopted character keeps the stamp it arrived with', async () => {
  const g = played();
  g.save({ getItem: () => null, setItem: () => {} });
  const code = await toCode(g.toJSON());

  const there = new Game(newGameState());
  there.adoptSave(await fromCode(code));
  assert.equal(there.state.savedAt, g.state.savedAt, 'adopting is not a change');
});
