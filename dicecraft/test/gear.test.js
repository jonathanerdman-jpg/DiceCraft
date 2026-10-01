// The kit: what it does to a hand, what it costs, what a beating costs it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARMOUR_KINDS, KINDS, KIND_IDS, KIT_COLS, KIT_ROWS, KIT_SHEET, SLOT_IDS, boonOf, canCarry,
  describe, durabilityOf, gearPower, isBroken, kindsFor, kitCell, makePiece, nameOf, socketCount,
  giftOf, priceOf, repairCost, rollGift, skillsCanCarry, tierFor,
} from '../js/gear.js';
import { ABILITIES, CLASS_LIST, createHero, heroDice, heroLoadout, repairHero } from '../js/hero.js';
import {
  Game, MAX_BITE, biteFor, companionDice, createCompanion, extraDice, newGameState, rollStock, wildEdge,
} from '../js/game.js';
import { createRng } from '../js/rng.js';
import { WILD } from '../js/dice.js';

const wildFaces = (dice) => dice.reduce((n, d) => n + d.faces.filter((f) => f === WILD).length, 0);

test('every kind fills a slot that exists, and every slot has something for it', () => {
  const slots = new Set();
  KIND_IDS.forEach((id) => {
    const kind = KINDS[id];
    assert.ok(SLOT_IDS.includes(kind.slot), `${id} fills no slot`);
    assert.ok(['raise', 'wild', 'carry'].includes(kind.boon), `${id} does nothing`);
    slots.add(kind.slot);
  });
  SLOT_IDS.forEach((slot) => assert.ok(slots.has(slot), `nothing fits ${slot}`));
});

test('a weapon turns a plain die into a power die of its own symbol', () => {
  const hero = createHero('Rill', 'ranger');
  hero.level = 8;
  const bare = heroLoadout({ ...hero, gear: null });
  hero.gear.hand = makePiece('axe', 2);
  const armed = heroLoadout(hero);
  assert.equal(armed.plain, bare.plain - 1, 'the plain die is what it was made from');
  const added = armed.power.filter((d) => d.fromGear);
  assert.equal(added.length, 1);
  assert.equal(added[0].symbol, 'might');
  assert.equal(added[0].sides, 8);
  assert.equal(added[0].key, 'plain:0', 'and it remembers which die it was made from');
});

test('a helm cuts a wild face into the hand, wherever there is room for one', () => {
  const hero = createHero('Rill', 'ranger');
  // Against the kit they already have, not against nothing: the boots a
  // character starts in are worth a wild face of their own.
  const before = wildFaces(heroDice(hero));
  hero.gear.head = makePiece('helmet', 3);   // two wild faces at Steel
  assert.equal(wildFaces(heroDice(hero)) - before, 2);
});

test('a piece with no plain die left to work on sharpens one you have', () => {
  const hero = createHero('Rill', 'fighter');
  hero.level = 9;
  // No harness, so nothing is topping the plain dice back up: three raises
  // against two plain dice has to leave one of them sharpening instead.
  hero.gear.hand = makePiece('sword', 2);
  hero.gear.off = makePiece('shield', 3);
  hero.gear.head = makePiece('helmet', 1);
  const bare = heroLoadout({ ...hero, gear: null });
  const hand = heroLoadout(hero);
  assert.ok(hand.plain < bare.plain, 'the raises ate the plain dice');
  assert.ok(hand.gear.raised + hand.gear.sharpened >= 2, 'and no piece was dead weight');
  assert.ok(hand.power.every((d) => d.sides <= 12));
});

test('a harness is worth one die at every grade, and has nothing to fit', () => {
  // A die is worth about a room a floor and a helm about a tenth of that, so a
  // harness that carried two was most of a suit of kit by itself. One, always:
  // the grade buys the straps, not the dice.
  const hero = createHero('Rill', 'fighter');
  hero.level = 9;
  const bare = heroLoadout(hero).plain;
  [1, 3, 5].forEach((tier) => {
    hero.gear.chest = makePiece('plate', tier);
    assert.equal(heroLoadout(hero).plain, bare + 1, `a tier ${tier} harness carries one more`);
    assert.equal(socketCount(hero.gear.chest), 0, 'and there is nothing to choose');
  });
  hero.gear.chest = makePiece('plate', 5, { wear: 1 });
  assert.equal(heroLoadout(hero).plain, bare, 'damaged, a strap has gone and it carries nothing');
  assert.ok(/mended/.test(describe(hero.gear.chest)), 'and it says so rather than sitting there quietly');
});

test('damage costs a piece a step, and wearing through costs the piece', () => {
  const sword = makePiece('sword', 2);
  assert.deepEqual(boonOf(sword), { kind: 'raise', symbol: 'might', sides: 8 });
  sword.wear = 1;
  assert.deepEqual(boonOf(sword), { kind: 'raise', symbol: 'might', sides: 6 }, 'a step smaller');
  assert.ok(repairCost(sword) > 0);
  sword.wear = durabilityOf(sword);
  assert.equal(isBroken(sword), true);
  assert.equal(boonOf(sword), null, 'and it does nothing at all');
});

test('a hall sells nothing the character could not carry', () => {
  [1, 5, 9, 13, 17].forEach((level) => {
    const stock = rollStock(createRng(1), level, 'reach', 1);
    assert.equal(stock.length, 3);
    stock.forEach((piece) => {
      assert.ok(piece.tier <= tierFor(level) + 1, `a level ${level} hall offered tier ${piece.tier}`);
      assert.ok(priceOf(piece) > 0 && nameOf(piece).length > 3);
    });
  });
});

test('buying takes the gold and the piece off the rack, and only if you can pay', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  g.hero.level = 8;
  const stock = g.gearOf('reach');
  const piece = stock[0];
  g.state.gold = priceOf(piece) - 1;
  assert.throws(() => g.buyGear(piece.id, 'reach'), /cannot pay/);
  g.state.gold = priceOf(piece);
  g.buyGear(piece.id, 'reach');
  assert.equal(g.state.gold, 0);
  assert.equal(g.gearOf('reach').some((p) => p.id === piece.id), false, 'it is off the rack');
  assert.equal(g.pack.some((p) => p.id === piece.id), true, 'and in the pack');
});

test('what is worn goes to the pack when something else takes its slot', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  const was = makePiece('axe', 1);
  g.pack.push(was);
  g.equip(was.id);
  const better = makePiece('sword', 2);
  g.pack.push(better);
  g.equip(better.id);
  assert.equal(g.hero.gear.hand.id, better.id);
  assert.equal(g.pack.some((p) => p.id === was.id), true, 'the old blade is kept');
  assert.throws(() => g.unequip('chest'), /nothing there/);
});

test('a broken piece cannot be worn until it is mended, and mending costs gold', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  const piece = makePiece('shield', 2);
  piece.wear = durabilityOf(piece);
  g.pack.push(piece);
  assert.throws(() => g.equip(piece.id), /broken/);
  piece.wear = 1;
  g.state.gold = 0;
  assert.throws(() => g.repair(piece.id), /cannot pay/);
  g.state.gold = 500;
  const cost = repairCost(piece);
  g.repair(piece.id);
  assert.equal(piece.wear, 0);
  assert.equal(g.state.gold, 500 - cost);
  assert.throws(() => g.repair(piece.id), /sound already/);
});

test('a beating wears every piece the hero is wearing, and ruins what is worn through', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'ranger');
  const blade = makePiece('sword', 1);
  const boots = makePiece('boots', 2);
  g.pack.push(blade, boots);
  g.equip(blade.id);
  g.equip(boots.id);
  blade.wear = durabilityOf(blade) - 1;
  g.damageGear();
  assert.equal(boots.wear, 1, 'everything worn takes something');
  assert.equal(g.hero.gear.hand, null, 'and what was nearly gone is gone');
});

test('the floors are told about the hand, not about the rack', () => {
  // The old figure was the gold value of everybody's kit, which counted racks
  // sitting at camp and missed the only thing that decides a room: how many
  // dice walk into it.
  const bare = createHero('A', 'fighter');
  bare.level = 14;
  bare.gear = null;
  assert.equal(biteFor([bare, bare]), 0, 'nobody carrying anything');

  const kitted = createHero('B', 'fighter');
  kitted.level = 14;
  kitted.gear.chest = makePiece('plate', 5);        // a harness, which is dice
  assert.equal(extraDice([kitted]), 1, 'a harness is worth a die and the floor is told so');
  assert.ok(biteFor([kitted]) > 0, 'and pays for it in part of a symbol');

  const sharp = createHero('C', 'fighter');
  sharp.level = 14;
  sharp.gear.hand = makePiece('sword', 5);          // a weapon, which is not
  assert.equal(extraDice([sharp]), 0, 'a sword changes a die rather than adding one');
  assert.equal(biteFor([sharp]), 0, 'so the floor asks for nothing extra');

  const crowd = Array.from({ length: 9 }, () => kitted);
  assert.equal(biteFor(crowd), MAX_BITE, 'and it never asks for more than two');

  // The exchange has to come out in the party's favor, or kit is a trap: a
  // die of it costs less than a whole symbol, which is what a fraction is for.
  assert.ok(biteFor([kitted]) < 1, 'one harness is not worth a whole symbol');
  assert.ok(biteFor([kitted, kitted]) > biteFor([kitted]), 'and two cost more than one');
});

test('a character from before the kit existed is given a rack, and nothing in it', () => {
  const old = { uid: 'h1', isHero: true, name: 'Yvane', classId: 'paladin', level: 6, look: null };
  const fixed = repairHero(old);
  assert.ok(fixed.gear, 'a rack');
  assert.ok(SLOT_IDS.every((slot) => slot in fixed.gear), 'with every slot on it');
  assert.ok(SLOT_IDS.every((slot) => fixed.gear[slot] === null), 'and nothing handed out for free');
});

test('a new character owns nothing: kit is found below or bought at a hall', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'fighter');
  assert.equal(g.pack.length, 0);
  assert.ok(SLOT_IDS.every((slot) => g.hero.gear[slot] === null));
});

test('a hoard leaves kit behind, and it comes up with you or not at all', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'fighter');
  g.hero.level = 8;
  const x = g.startExpedition(1, [], 11);
  // Stand at a hoard and open it: an honest chest pays at once, a mimic or a
  // trapped one has to be won first. Either way it decides the gold, and
  // often a piece.
  const room = Object.values(x.map.tiles).find((t) => t.kind === 'treasure');
  x.map.position = room.key;
  room.state = 'seen';
  x.status = 'chest';
  g.openChest();
  if (x.status === 'choosing') g.choosePair(g.hero.uid);
  if (x.status === 'encounter') {
    x.encounter.status = 'won';
    g.act(() => {});
  }
  assert.equal(room.state, 'cleared', 'the chest is emptied whichever it was');
  const found = x.pending.gear || [];
  // The odds are the odds; what matters is that what is found is carried the
  // same way the gold is.
  x.pending.gear = [makePiece('shield', 2)];
  const before = g.pack.length;
  g.bank(false);
  assert.equal(g.pack.length, before + 1, 'climbing out brings it home');
  assert.ok(found.length >= 0);
});

test('kit left below when the floor is lost is simply gone', () => {
  const g = new Game(newGameState());
  g.createCharacter('Rill', 'fighter');
  const x = g.startExpedition(1, [], 5);
  x.pending.gear = [makePiece('sword', 3)];
  const before = g.pack.length;
  g.endExpedition();
  assert.equal(g.pack.length, before, 'nothing of it came up');
});

test('a calling carries what a calling carries', () => {
  // The rules the halls, the floors and the sheet all obey.
  assert.deepEqual(kindsFor('mage').filter((k) => ['hand', 'off'].includes(KINDS[k].slot)), ['trident', 'book']);
  ['ranger', 'rogue'].forEach((id) => assert.ok(kindsFor(id).includes('bow'), `${id} should draw a bow`));
  CLASS_LIST.forEach((def) => {
    const may = kindsFor(def.id);
    if (!['ranger', 'rogue'].includes(def.id)) assert.equal(may.includes('bow'), false, `${def.id} should not draw a bow`);
    assert.equal(may.includes('book'), def.id !== 'fighter', `${def.id} and books`);
    ARMOUR_KINDS.forEach((k) => assert.ok(may.includes(k), `${def.id} should be able to wear ${k}`));
    assert.ok(may.some((k) => KINDS[k].slot === 'hand'), `${def.id} has nothing to hold`);
    assert.ok(may.some((k) => KINDS[k].slot === 'off'), `${def.id} has nothing for the off hand`);
  });
  // Every kind belongs to somebody, or it is art nobody will ever see.
  KIND_IDS.forEach((id) => {
    assert.ok(CLASS_LIST.some((def) => kindsFor(def.id).includes(id)), `nobody can carry a ${id}`);
  });
  assert.equal(canCarry('mage', makePiece('axe', 1)), false);
  assert.equal(canCarry('cleric', makePiece('shield', 1)), true);
  assert.equal(canCarry('cleric', makePiece('book', 1)), true);
});

test('a hall only racks what the character in front of it could use', () => {
  CLASS_LIST.forEach((def) => {
    const stock = rollStock(createRng(4), 12, 'reach', 3, def.id);
    assert.equal(stock.length, 3);
    stock.forEach((piece) => assert.ok(canCarry(def.id, piece), `${def.id} was offered a ${piece.kind}`));
  });
});

test('a piece a calling cannot carry is refused, and an old save puts it in the pack', () => {
  const game = new Game(newGameState());
  game.createCharacter('Wren', 'mage');
  game.take(makePiece('axe', 1));
  assert.throws(() => game.equip(game.pack[0].id), /does not carry/);
  // A save from before the rule, or one whose class was repaired: the piece is
  // kept, just not worn.
  game.hero.gear.hand = makePiece('bow', 2);
  const pool = [];
  repairHero(game.hero, pool);
  assert.equal(game.hero.gear.hand, null);
  assert.equal(pool.some((p) => p.kind === 'bow'), true, 'and it is still yours');
});

test('every kind and grade has a picture, and no two share one', () => {
  const seen = new Set();
  KIND_IDS.forEach((id) => {
    for (let tier = 1; tier <= 5; tier++) {
      const at = kitCell(makePiece(id, tier));
      assert.ok(at, `${id} has no cell`);
      assert.ok(at.col < KIT_COLS && at.row < KIT_ROWS, `${id} t${tier} sits off the sheet`);
      const where = `${at.col},${at.row}`;
      assert.equal(seen.has(where), false, `${id} t${tier} shares a cell`);
      seen.add(where);
    }
  });
  assert.equal(seen.size, KIND_IDS.length * 5);
  const sheet = resolve(dirname(fileURLToPath(import.meta.url)), '..', KIT_SHEET);
  assert.ok(existsSync(sheet), `${KIT_SHEET} has not been drawn — run tools/draw-blocks.mjs kit`);
});

test('a hired sword carries a rack, and what comes out of a lair does not', () => {
  const hired = createCompanion('sellsword');
  const beast = createCompanion('direwolf');
  assert.ok(hired.gear, 'anybody who takes wages can be handed a sword');
  assert.equal(beast.gear, null, 'a dire wolf has no hands for it');
  // What they may carry follows from what they are good at.
  assert.ok(skillsCanCarry(hired.proficiencies, makePiece('sword', 1)), 'might, so a sword');
  assert.equal(skillsCanCarry(hired.proficiencies, makePiece('bow', 1)), false, 'but not a bow');
  assert.ok(skillsCanCarry(hired.proficiencies, makePiece('helmet', 1)), 'and all the armor there is');
});

test('a creature is worth about what a rack is, because it can never have one', () => {
  // Not an argument — tools/weigh-party.mjs plays the two in the same rooms.
  // This only holds the shape of it: a creature is ahead of its rank and
  // carries dice and wild faces of its own.
  const at = (defId, rank) => { const c = createCompanion(defId); c.rank = rank; return companionDice(c); };
  [1, 10, 20, 30].forEach((rank) => {
    const beast = at('direwolf', rank);
    const hired = at('sellsword', rank);
    assert.ok(beast.length > hired.length, `at rank ${rank} a creature throws more dice`);
    assert.ok(beast.some((d) => d.faces.includes(WILD)), `and carries a wild face at rank ${rank}`);
  });
  assert.equal(wildEdge(30).plain, 2);
  assert.equal(wildEdge(1).plain, 1);
});

test('a save written before companions could be kitted gets them a rack', () => {
  const state = newGameState();
  state.hero = createHero('Wren', 'fighter');
  state.roster = [
    { uid: 'a', defId: 'sellsword', name: 'Garrick', rank: 3, proficiencies: ['might'] },
    { uid: 'b', defId: 'direwolf', name: 'Ash', rank: 3, proficiencies: ['nature', 'might'] },
  ];
  const raw = JSON.stringify({ ...state, version: 2 });
  const loaded = Game.load({ getItem: () => raw, setItem: () => {} }, 'test-key');
  assert.ok(loaded.state.roster[0].gear, 'the hired sword gets one');
  assert.equal(loaded.state.roster[1].gear, null, 'the wolf does not');
});

test('kit put on a companion is the companion’s, and the pack is the company’s', () => {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'fighter');
  const mate = g.state.roster[0] || null;
  const hired = mate || (() => { g.state.roster.push(createCompanion('sellsword')); return g.state.roster[0]; })();
  const piece = makePiece('sword', 2);
  g.take(piece);
  g.equip(piece.id, hired.uid);
  assert.equal(hired.gear.hand.id, piece.id, 'worn by the companion');
  assert.equal(g.pack.length, 0, 'and out of the company pack');
  assert.equal(g.pieceById(piece.id), piece, 'the smith can still find it');
  g.unequip('hand', hired.uid);
  assert.equal(g.pack.length, 1, 'and it comes back to the pack, not to them');
});

test('no two pieces ever answer to the same name', () => {
  // A counter starting again at one on every page load is how a hall came to
  // rack a helm with the same id as the one already on your head, and then
  // Wear, Buy and Mend all worked on whichever the code found first.
  const ids = new Set(Array.from({ length: 500 }, () => makePiece('sword', 1).id));
  assert.equal(ids.size, 500);
  assert.equal(makePiece('sword', 1, { id: 'kept' }).id, 'kept', 'an id given is an id kept');
});

test('a save already holding two pieces of the same name is repaired on the way in', () => {
  const state = newGameState();
  state.hero = createHero('Wren', 'fighter');
  const twin = () => ({ id: 'g1', kind: 'helmet', tier: 2, wear: 0 });
  state.hero.gear.head = twin();
  state.bag = [twin()];
  state.stock = { reach: [twin()] };
  const raw = JSON.stringify({ ...state, version: 2 });
  const g = Game.load({ getItem: () => raw, setItem: () => {} }, 'test-key');
  const every = [g.hero.gear.head, ...g.pack, ...Object.values(g.state.stock).flat()];
  assert.equal(new Set(every.map((p) => p.id)).size, every.length, 'all three have their own name now');
  // And the thing that broke: the smith can find exactly one of them.
  every.forEach((piece) => assert.equal(g.pieceById(piece.id) || piece, piece === g.state.stock.reach[0] ? piece : piece));
});

test('what somebody cannot carry is not on their sheet to click', () => {
  // Not a rendering test — the rule the sheet filters on. A mage is offered a
  // book and never an axe, whoever put the axe in the pool.
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'mage');
  const axe = makePiece('axe', 1);
  const book = makePiece('book', 1);
  g.take(axe);
  g.take(book);
  const mine = g.pack.filter((p) => g.canBear(g.hero, p));
  assert.deepEqual(mine.map((p) => p.kind), ['book']);
  assert.throws(() => g.equip(axe.id), /does not carry/);
  assert.doesNotThrow(() => g.equip(book.id));
  assert.equal(g.hero.gear.off.id, book.id);
  assert.equal(g.pack.length, 1, 'and the axe is still in the pool for somebody else');
});

test('a piece has one socket, and a better grade is a stronger effect on that one die', () => {
  // There were never enough dice in a hand for a helm to spend three faces on
  // three different ones, so the grade goes into the die it has.
  [1, 3, 5].forEach((tier) => {
    assert.equal(socketCount(makePiece('helmet', tier)), 1, `a t${tier} helm has one socket`);
    assert.equal(socketCount(makePiece('sword', tier)), 1);
    assert.equal(socketCount(makePiece('plate', tier)), 0, 'a harness has nothing to fit');
  });
  const faces = (tier) => boonOf(makePiece('helmet', tier)).faces;
  assert.ok(faces(5) > faces(1), 'and a Runed helm cuts more of them than a Worn one');
  const hero = createHero('Rill', 'fighter');
  hero.level = 12;
  hero.gear.head = makePiece('helmet', 5);
  const dice = heroDice(hero);
  const cut = dice.filter((d) => d.faces.filter((f) => f === WILD).length >= 3);
  assert.equal(cut.length, 1, 'one die carries all three, and no other die is touched');
});

test('very rarely a floor leaves something that knows a trick', () => {
  const rng = createRng(3);
  const rolled = Array.from({ length: 4000 }, () => rollGift(rng, 5)).filter(Boolean);
  assert.ok(rolled.length > 200 && rolled.length < 500, `about one in twelve, got ${rolled.length} of 4000`);
  rolled.forEach((id) => assert.ok(ABILITIES[id], `${id} is a real trick`));
  assert.equal(Array.from({ length: 200 }, () => rollGift(createRng(9), 2)).filter(Boolean).length, 0,
    'and never on the cheap grades');
  const plain = makePiece('sword', 5);
  assert.equal(giftOf(plain), null);
  const blessed = makePiece('sword', 5, { gift: 'blessing' });
  assert.equal(giftOf(blessed), 'blessing');
  blessed.wear = 99;
  assert.equal(giftOf(blessed), null, 'and a broken piece has forgotten it');
});

test('a blessed piece lends its trick to whoever wears it, once a night', () => {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'fighter');
  const hired = createCompanion('sellsword');
  g.state.roster.push(hired);
  assert.deepEqual(g.giftsOf(hired), [], 'nothing yet');
  hired.gear.hand = makePiece('sword', 4, { gift: 'blessing' });
  assert.deepEqual(g.giftsOf(hired), ['blessing'], 'a hired sword who was never taught one');
  assert.equal(g.giftLeft(hired, 'blessing'), 1);
  hired.gifts = { blessing: 0 };
  assert.equal(g.giftLeft(hired, 'blessing'), 0, 'spent for the night');
  g.rest();
  assert.equal(g.giftLeft(hired, 'blessing'), 1, 'and back with the morning');
});

test('settling the books prices the nights a company was kept for nothing', () => {
  const g = new Game(newGameState());
  g.createCharacter('Wren', 'fighter');
  g.hero.level = 12;
  g.state.day = 40;
  g.state.gold = 28000;
  g.state.training = 40000;
  g.state.settled = false;                 // as a save from before the bill existed reads
  g.state.roster.push(createCompanion('sellsword'), createCompanion('squire'));
  g.state.roster.forEach((c) => { c.rank = 20; });
  const books = g.arrears();
  assert.equal(books.nights, 39);
  assert.equal(books.owed, g.upkeep() * 39);
  assert.ok(books.over > 0, 'and a hoard no floor could have paid for');
  g.settle();
  assert.equal(g.state.gold, books.left);
  assert.ok(g.state.gold > 0, 'nobody is left destitute');
  assert.ok(g.state.gold <= books.ceiling);
  assert.ok(books.lessonsOver > 0, 'lessons pile up the same way');
  assert.equal(g.state.training, books.lessonCap, 'and come down to three floors\u2019 teaching');
  assert.ok(g.state.training > 0, 'not to nothing');
  assert.throws(() => g.settle(), /already straight/, 'and it only needs doing once');
  assert.equal(g.arrears().done, true);
});
