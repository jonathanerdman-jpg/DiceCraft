import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABILITIES, CLASSES, CLASS_LIST, MAX_LEVEL, MAX_POWER_DICE,
  PATH_LEVEL, abilityLeft, abilityMax, baseCharges, chosenPath, choosePath, createHero,
  heroAbility, heroDice, heroLoadout, pathSteps, pendingChoice,
  repairHero, stepUp,
} from '../js/hero.js';
import { WILD } from '../js/dice.js';
import { SLOT_IDS } from '../js/gear.js';

test('a trick that decides a room is rationed against one that nudges a die', () => {
  // The pools were settled by playing, not by argument: tools/weigh-abilities
  // runs whole floors with and without each trick and reports what it is worth
  // in rooms cleared. Transmute is the only one that hands you a symbol with no
  // dice involved at all, so it is the only one rationed below the rest.
  const uses = (id) => ABILITIES[id].uses;
  const rest = ['secondWind', 'brace', 'readGround', 'slip', 'blessing'];
  rest.forEach((id) => assert.ok(uses('transmute') < uses(id), `a guaranteed symbol is dearer than ${id}`));
  assert.equal(new Set(rest.map(uses)).size, 1, 'and the other five are rationed alike');
  CLASS_LIST.forEach((def) => {
    const pool = baseCharges(def.id);
    assert.ok(pool >= 2 && pool <= 5, `${def.id} has a sane pool`);
    assert.equal(pool, ABILITIES[def.ability].uses, `${def.id} draws its pool from its own ability`);
    assert.equal(createHero('X', def.id).charges, pool, `${def.id} starts the night full`);
  });
});

test('every class is coherent', () => {
  CLASS_LIST.forEach((def) => {
    assert.ok(ABILITIES[def.ability], `${def.id} has a real ability`);
    assert.ok(Number.isInteger(ABILITIES[def.ability].uses), `${def.id}'s ability says how often`);
    assert.equal(def.paths.length, 2, `${def.id} offers two directions`);
    def.paths.forEach((path) => {
      assert.equal(path.grants.length, 5);
      const levels = path.grants.map((g) => g.level);
      assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'grants are in level order');
      path.grants.forEach((g) => assert.ok(g.text && g.effect.kind));
    });
  });
});

// What a calling gives you, with the kit taken off: gear is real, but it is
// not the class, and these are the class's rules.
function classHand(hero) {
  const loadout = heroLoadout({ ...hero, gear: null });
  return loadout;
}

test('a new hero starts with dice in three areas, leaning into their class', () => {
  const hero = createHero('Wren', 'ranger');
  const loadout = classHand(hero);
  assert.equal(loadout.power.length, 3);
  assert.equal(new Set(loadout.power.map((d) => d.symbol)).size, 3, 'three different areas');
  assert.equal(loadout.power[0].symbol, 'nature', 'led by their own');
  assert.ok(loadout.power.slice(1).every((d) => d.sides < loadout.power[0].sides), 'which is the biggest');
  assert.equal(loadout.charges, baseCharges('ranger'), 'a full night of the class trick');
  assert.equal(hero.pathId, null);
});

test('every class starts spread across three areas and no class starts twice in one', () => {
  CLASS_LIST.forEach((def) => {
    const loadout = classHand(createHero('X', def.id));
    assert.equal(loadout.power.length, 3, `${def.id} should start with three power dice`);
    assert.equal(new Set(loadout.power.map((d) => d.symbol)).size, 3, `${def.id} repeats a symbol`);
    assert.equal(loadout.power[0].symbol, def.symbol, `${def.id} should lead with its own symbol`);
  });
});

test('the Paladin leads on Guard and keeps Brace', () => {
  const hero = createHero('Dame Yvane', 'paladin');
  const loadout = classHand(hero);
  assert.equal(CLASSES.paladin.name, 'Knight');
  assert.equal(loadout.power[0].symbol, 'guard');
  assert.deepEqual(loadout.power.map((d) => d.symbol), ['guard', 'might', 'faith']);
  assert.equal(heroAbility(hero).id, 'brace');
});

test('the retired hybrid class is gone, and nothing still refers to Smite', () => {
  assert.equal(CLASSES.knight, undefined, 'the Knight was renamed, not kept alongside');
  assert.equal(ABILITIES.smite, undefined);
  CLASS_LIST.forEach((def) => assert.ok(ABILITIES[def.ability], `${def.id} points at a real ability`));
  assert.equal(CLASS_LIST.length, 6);
});

test('a save naming the retired Knight is repaired into the Paladin', () => {
  const hero = { classId: 'knight', pathId: 'bulwark', title: 'Knight', level: 9 };
  repairHero(hero);
  assert.equal(hero.classId, 'paladin');
  assert.equal(hero.title, CLASSES.paladin.name, 'the displayed title follows the class');
  assert.equal(hero.pathId, 'bulwark', 'a path that still exists is kept');
});

test('a path that no longer belongs to its class is cleared so it can be chosen again', () => {
  const hero = { classId: 'paladin', pathId: 'oathkeeper', title: 'Paladin', level: 9 };
  repairHero(hero);
  assert.equal(hero.pathId, null);
  assert.equal(pendingChoice(hero), true, 'and the choice is offered again rather than granting nothing');
});

test('a save naming a class that never existed falls back rather than throwing', () => {
  const hero = { classId: 'necromancer', pathId: 'whatever', level: 4 };
  assert.doesNotThrow(() => repairHero(hero));
  assert.ok(CLASSES[hero.classId], 'it lands on a real class');
  assert.equal(hero.pathId, null);
  assert.equal(repairHero(null), null);
});

test('a hand never grows past four power dice', () => {
  CLASS_LIST.forEach((def) => {
    def.paths.forEach((path) => {
      const hero = createHero('X', def.id);
      hero.level = MAX_LEVEL;
      choosePath(hero, path.id);
      const hand = heroLoadout(hero);
      const own = hand.power.filter((d) => !d.fromGear);
      assert.ok(own.length <= MAX_POWER_DICE, `${def.id}/${path.id} overflows the hand`);
      assert.ok(hand.power.length <= MAX_POWER_DICE + SLOT_IDS.length, 'and the kit cannot double it');
    });
  });
});

test('a path is offered at level 3 and only once', () => {
  const hero = createHero('Wren', 'rogue');
  assert.equal(pendingChoice(hero), false);
  assert.throws(() => choosePath(hero, 'shadow'), /opens at level/);
  hero.level = PATH_LEVEL;
  assert.equal(pendingChoice(hero), true);
  choosePath(hero, 'shadow');
  assert.equal(chosenPath(hero).id, 'shadow');
  assert.equal(pendingChoice(hero), false);
  assert.throws(() => choosePath(hero, 'trickster'), /already set/);
});

test('an unknown path is refused', () => {
  const hero = createHero('Wren', 'cleric');
  hero.level = 5;
  assert.throws(() => choosePath(hero, 'shadow'), /no such path/);
});

test('the two paths of a class diverge', () => {
  const a = createHero('A', 'fighter');
  const b = createHero('B', 'fighter');
  a.level = b.level = MAX_LEVEL;
  choosePath(a, 'champion');
  choosePath(b, 'warden');
  const la = heroLoadout(a);
  const lb = heroLoadout(b);
  assert.equal(la.power[0].sides, 12, 'the Champion drives Might all the way to a d12');
  assert.ok(lb.power[0].sides < la.power[0].sides, 'the Warden stops short of that');
  assert.ok(lb.power[1].sides > la.power[1].sides, 'and builds the shield instead');
  assert.ok(lb.wild > la.wild, 'plus the improvised wild face');
  assert.notDeepEqual(la, lb);
});

test('grants only apply once their level is reached', () => {
  const hero = createHero('Wren', 'mage');
  hero.level = 3;
  choosePath(hero, 'evoker');
  assert.equal(heroLoadout(hero).power[0].sides, 10, 'the level 3 grant has landed');
  hero.level = 10;
  assert.equal(heroLoadout(hero).power[2].sides, 6, 'and the level 7 one');
  assert.equal(heroLoadout(hero).power[0].sides, 10, 'but not the level 11 upgrade');
});

test('wild talents put wild faces on plain dice, never more than there are dice', () => {
  const hero = createHero('Wren', 'mage');
  hero.level = MAX_LEVEL;
  choosePath(hero, 'loremaster');
  const loadout = heroLoadout(hero);
  assert.equal(loadout.wild, 2);
  assert.ok(loadout.wild <= loadout.plain);
  const wilds = heroDice(hero).filter((d) => d.kind === 'basic' && d.faces.includes(WILD));
  assert.equal(wilds.length, 2);
});

test('die sizes step up the ladder and stop at d12', () => {
  assert.equal(stepUp(6), 8);
  assert.equal(stepUp(6, 2), 10);
  assert.equal(stepUp(12), 12);
});

test('a hero carries their ability with the charges their path bought', () => {
  const hero = createHero('Alric', 'fighter');
  assert.equal(heroAbility(hero).id, CLASSES.fighter.ability);
  assert.equal(heroAbility(hero).charges, ABILITIES.secondWind.uses);
  assert.equal(heroAbility(hero).left, ABILITIES.secondWind.uses, 'and starts the night with all of them');
  hero.level = 8;
  choosePath(hero, 'warden');
  assert.equal(heroAbility(hero).charges, ABILITIES.secondWind.uses + 2, 'the level and the path each add one');
});

test('the night\'s pool is what is left of it, never more and never less than none', () => {
  const hero = createHero('Alric', 'fighter');
  hero.charges = 1;
  assert.equal(abilityLeft(hero), 1);
  hero.charges = 99;
  assert.equal(abilityLeft(hero), abilityMax(hero), 'a save cannot hold more than a night holds');
  hero.charges = -3;
  assert.equal(abilityLeft(hero), 0);
  delete hero.charges;
  assert.equal(abilityLeft(hero), abilityMax(hero), 'a character written down before the pool wakes up full');
});

test('a path is described from what it actually grants', () => {
  const steps = pathSteps('paladin', 'bulwark');
  assert.equal(steps.length, 5);
  assert.equal(steps[0].label, 'guard d8 \u2192 d10');
  assert.equal(steps[3].label, '+1 plain die');
  assert.equal(pathSteps('fighter', 'warden')[1].label, '+1 use of Golden Apple');
  steps.forEach((step) => assert.ok(step.label && step.text));
  assert.throws(() => pathSteps('paladin', 'champion'), /no such path/);
});

test('an upgrade that would pass a d12 says so instead of lying', () => {
  CLASS_LIST.forEach((def) => {
    def.paths.forEach((path) => {
      pathSteps(def.id, path.id).forEach((step) => {
        assert.equal(/d\d+ \u2192 d\d+/.test(step.label) && step.label.includes('\u2192 d4'), false);
      });
    });
  });
});

test('two heroes never share an id', () => {
  const ids = new Set(Array.from({ length: 200 }, () => createHero('Same Name', 'fighter').uid));
  assert.equal(ids.size, 200, 'hero ids must be unique or shared quests confuse whose turn it is');
});
