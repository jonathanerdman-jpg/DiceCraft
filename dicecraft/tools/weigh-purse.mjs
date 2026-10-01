// Where the money goes, and whether it ever runs out.
//
// Characters were amassing gold: a floor pays hundreds and the only standing
// cost was five gold a bed for whoever came back tired. This prices a day of
// play — what a floor of a given depth pays against what a company of a given
// size costs to keep — so the upkeep figure is chosen rather than guessed.
//
//   node tools/weigh-purse.mjs [rooms-cleared-per-floor]
//
// Rooms cleared comes from tools/weigh-party.mjs, which plays them: about four
// of seven bare, five to seven kitted.
import { DEPTHS } from '../js/settings.js';
import { upkeepOf } from '../js/data.js';
import { TIERS, tierFor } from '../js/gear.js';
import { lessonsWon } from '../js/training.js';

const CLEARED = Number(process.argv[2] || 5);

// One floor's take, averaged: ordinary rooms at one share, a hoard at two and
// a half, the boss at three and a half, with the roll's spread averaged out.
function floorGold(depth, cleared) {
  const base = depth.gold * 1.25;
  const rooms = Math.max(0, cleared - 2);
  const treasure = cleared >= 2 ? 1 : 0;
  const boss = cleared >= 6 ? 1 : 0;
  return Math.round(base * (rooms + treasure * 2.5 + boss * 3.5));
}

const pad = (v, n) => String(v).padStart(n);
console.log(`a floor cleared to ${CLEARED} rooms, and a night after it\n`);
console.log('depth                 take   lessons   upkeep for a roster of 1 / 2 / 3 / 4      net at 3');
DEPTHS.forEach((depth) => {
  const take = floorGold(depth, CLEARED);
  const lessons = lessonsWon(depth.depth) * Math.max(0, CLEARED - 1) + lessonsWon(depth.depth, true);
  // A companion of about the standing you would take down this floor.
  const rank = Math.max(1, Math.min(30, depth.minLevel * 2));
  const each = upkeepOf({ rank });
  const bill = [1, 2, 3, 4].map((n) => each * n);
  console.log(`${depth.name.padEnd(18)}${pad(take, 6)}${pad(lessons, 10)}   `
    + bill.map((b) => pad(b, 4)).join(' /') + `     ${pad(take - bill[2], 8)}`);
});

console.log('\nand what the take buys, at the grade that depth allows:');
DEPTHS.forEach((depth) => {
  const tier = TIERS.find((t) => t.tier === tierFor(depth.minLevel));
  const take = floorGold(depth, CLEARED);
  console.log(`${depth.name.padEnd(18)} a ${tier.name} piece costs ${pad(tier.price, 4)}`
    + `  =  ${(tier.price / take).toFixed(1)} floors`);
});
