// The company's schooling, held in one purse.
//
// Rooms used to teach whoever was standing in them, which meant the whole
// party rose together whether or not the player had any say in it. Now a
// cleared room pays *lessons* into a single pool, and nobody advances until
// the player spends them on somebody by name. Rising is a decision.
import { MAX_LEVEL } from './hero.js';
import { MAX_RANK } from './data.js';

// What a cleared room is worth. Depth pays, because the lesson is in the
// difficulty: a boss at the bottom of the fifth tier teaches more in one
// afternoon than a season of easy corridors.
export function lessonsWon(depth, boss = false) {
  return boss ? 40 + depth * 18 : 14 + depth * 11;
}

// What the next step costs. Quadratic, deliberately: a hero's twentieth level
// costs forty-three times their second, and a veteran companion's last rank
// costs ninety times their first. That curve is the whole point — early steps
// are loose change, and the top of the ladder is something you save for and
// give up something else to reach.
export const HERO_BASE = 60;
export const HERO_SLOPE = 8;
export const RANK_BASE = 25;
export const RANK_SLOPE = 3;

export function isMastered(member) {
  return member.isHero ? member.level >= MAX_LEVEL : member.rank >= MAX_RANK;
}

// null means there is nothing left to buy.
export function trainingCost(member) {
  if (isMastered(member)) return null;
  return member.isHero
    ? HERO_BASE + HERO_SLOPE * member.level * member.level
    : RANK_BASE + RANK_SLOPE * member.rank * member.rank;
}

export function canTrain(pool, member) {
  const cost = trainingCost(member);
  return cost !== null && pool >= cost;
}

export function shortfall(pool, member) {
  const cost = trainingCost(member);
  if (cost === null) return 0;
  return Math.max(0, cost - pool);
}

// Everything still owed between here and mastery, for the camp screen to show
// how long a road somebody has left.
export function costToMaster(member) {
  const step = member.isHero
    ? (n) => HERO_BASE + HERO_SLOPE * n * n
    : (n) => RANK_BASE + RANK_SLOPE * n * n;
  const cap = member.isHero ? MAX_LEVEL : MAX_RANK;
  let total = 0;
  for (let n = member.isHero ? member.level : member.rank; n < cap; n++) total += step(n);
  return total;
}
