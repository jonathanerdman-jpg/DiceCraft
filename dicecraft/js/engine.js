import { WILD, rollDie } from './dice.js';
import { SYMBOL_ORDER } from './data.js';

// Bosses punish dithering: every second re-roll costs a die outright.
export const PRESSURE_EVERY = 2;

// A second wind is not one breath, it is getting back up: the die is thrown
// again, and again, until it answers or the wind runs out.
export const SECOND_WIND_THROWS = 3;

// A sentence that begins with the room's own name has to begin with a capital,
// and "the ghoul" is not a name.
const cap = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

// How a room is referred to mid-sentence: "the ghoul", but "Old Rothe,
// Unburied". A save written before rooms were named after what is in them has
// only the bare name to offer, so that is what it gets.
export function named(challenge) {
  if (!challenge) return 'the room';
  return challenge.sentence || challenge.name;
}

// A challenge is one or more trials. A trial is a set of symbol slots that
// must all be matched before the next trial begins; the dice pool carries
// over, so a long challenge is a war of attrition against your own dice.
export function makeChallenge({ name, trials, boss = false, pressure = false, mob = null, proper = false }) {
  return {
    name,
    boss,
    pressure,
    // What is standing in the room. The plan draws this token, the trials are
    // built from what it demands, and the encounter is named after it — the
    // three used to be decided separately, which is how a wolf came to be
    // guarding a flooded nave that wanted Faith.
    mob,
    // The same name, as it reads inside a sentence. A creature is "the ghoul";
    // something with a name of its own is only ever itself.
    sentence: proper ? name : `the ${name.toLowerCase()}`,
    trials: trials.map((required) => ({
      required: required.slice(),
      matched: required.map(() => false),
    })),
  };
}

// `spec` is a tier/depth row: trials as [min,max] (or a fixed count for a
// boss) and symbols as [min,max] per trial. `pool` is the setting's symbol
// bias, so a room in the Thicket keeps asking for Nature.
export function generateChallenge({
  spec, pool, rng, name, boss = false, mob = null, proper = false, extra = 0,
}) {
  const trialCount = Array.isArray(spec.trials)
    ? rng.range(spec.trials[0], spec.trials[1])
    : spec.trials;
  const symbols = pool && pool.length ? pool : SYMBOL_ORDER;
  const trials = [];
  for (let t = 0; t < trialCount; t++) {
    const count = rng.range(spec.symbols[0], spec.symbols[1]);
    const required = [];
    for (let i = 0; i < count; i++) required.push(rng.pick(symbols));
    trials.push(required);
  }
  // A company in good kit meets rooms that know it. `extra` is a count for the
  // whole room rather than a widening of every trial: a deep floor already
  // asks three trials of four, and adding one to each of those cost far more
  // than the kit was ever worth. One more symbol, somewhere in the room.
  //
  // It can be a fraction, and that matters more than it looks. A symbol in a
  // room turns out to cost a party slightly more than an extra die wins them,
  // so charging in whole symbols made the last piece of kit in a company a
  // loss — tools/weigh-party.mjs had a fully outfitted company clearing fewer
  // rooms than a half-outfitted one. A fraction is paid in some rooms and not
  // others, which is the only way the exchange can come out in the party's
  // favor by a little rather than against them by a lot.
  // The throw for the fraction is only taken when there is a fraction to
  // throw for: a floor with no kit walking down it must draw the same rooms it
  // always did, and an rng is a sequence rather than a source.
  const whole = Math.floor(extra);
  const part = extra - whole;
  const rooms = whole + (part > 0 && rng.chance(part) ? 1 : 0);
  for (let i = 0; i < rooms; i++) {
    trials[rng.int(trials.length)].push(rng.pick(symbols));
  }
  return makeChallenge({ name, trials, boss, pressure: boss, mob, proper });
}

// A room that beat you is a room you have to walk back into, and it does not
// remember the slots your last try filled. Trials are mutated in place by an
// encounter, so an abandoned attempt has to be wiped before the next one —
// otherwise a fresh encounter starts on trial one with trial one already
// answered, and there is nothing legal left to do.
export function resetChallenge(challenge) {
  if (!challenge) return challenge;
  challenge.trials.forEach((trial) => { trial.matched = trial.required.map(() => false); });
  return challenge;
}

export class Encounter {
  constructor({ challenge, dice, rng, abilities = [] }) {
    this.challenge = challenge;
    this.rng = rng;
    // A trick is held by the character, not the room: what is left of the
    // night's pool is what walks into this encounter.
    this.abilities = abilities.map((a) => ({ ...a, left: a.left === undefined ? a.charges : a.left }));
    this.braced = false;
    this.slipped = null;
    this.spentDice = [];
    this.remaining = dice.slice();
    this.tray = [];
    this.trialIndex = 0;
    this.spentThisRound = 0;
    this.rounds = 0;
    this.rerolls = 0;
    this.status = 'active';
    this.log = [];
    this.discarded = 0;
    this.roll();
    this.checkHopeless();
  }

  // Every match spends a die, so a hand holding fewer dice than the challenge
  // still asks for cannot finish it however the faces fall. A blessing calls a
  // spent die back, so what it could still recover counts as dice in hand.
  symbolsOwed() {
    let owed = 0;
    for (let i = this.trialIndex; i < this.challenge.trials.length; i++) {
      owed += this.challenge.trials[i].matched.filter((done) => !done).length;
    }
    return owed;
  }

  diceWithin() {
    const blessing = this.ability('blessing');
    const callbacks = blessing ? Math.min(blessing.left, this.spentDice.length) : 0;
    // A slip answers a slot and pays nothing for it, so each one left is worth
    // a die the hand does not have.
    const slip = this.ability('slip');
    const slips = slip ? Math.max(0, slip.left) : 0;
    return this.remaining.length + callbacks + slips;
  }

  // Arithmetic has already decided the room; there is nothing to be gained by
  // throwing the rest of the hand to watch it happen.
  checkHopeless() {
    if (this.status !== 'active') return false;
    const owed = this.symbolsOwed();
    const have = this.diceWithin();
    if (have >= owed) return false;
    this.status = 'lost';
    this.hopeless = true;
    this.note(
      `The end was inevitable, nothing you had left could have defeated it. ${have} ${have === 1 ? 'die' : 'dice'} left and ${owed} symbols still wanted.`,
      'bad',
    );
    return true;
  }

  // How this room is referred to mid-sentence. A save written before rooms
  // were named after what is in them has only the bare name to offer.
  get called() {
    return named(this.challenge);
  }

  get trial() {
    return this.challenge.trials[this.trialIndex];
  }

  get diceLeft() {
    return this.remaining.length;
  }

  note(text, kind = 'info') {
    this.log.push({ text, kind });
  }

  roll() {
    this.tray = this.remaining.map((die) => ({ die, face: rollDie(die, this.rng) }));
    this.spentThisRound = 0;
    this.rounds++;
  }

  // Every (die, slot) pair that could legally be matched right now.
  availableMatches() {
    if (this.status !== 'active') return [];
    const trial = this.trial;
    const pairs = [];
    this.tray.forEach((entry, dieIndex) => {
      trial.required.forEach((symbol, slotIndex) => {
        if (trial.matched[slotIndex]) return;
        if (entry.face === symbol || entry.face === WILD) {
          pairs.push({ dieIndex, slotIndex });
        }
      });
    });
    return pairs;
  }

  // Faithful to the original: you may not decline a match. A die is thrown away
  // only when a fresh roll answers nothing at all — once you have placed one this
  // round the row has done its work, and the only way on is to roll again.
  legalActions() {
    if (this.status !== 'active') return { canMatch: false, canDiscard: false, canReroll: false };
    const hasMatch = this.availableMatches().length > 0;
    return {
      canMatch: hasMatch,
      canDiscard: !hasMatch && this.spentThisRound === 0,
      canReroll: this.spentThisRound > 0 && this.remaining.length > 0,
    };
  }

  match(dieIndex, slotIndex) {
    if (this.status !== 'active') throw new Error('encounter is over');
    const ok = this.availableMatches().some(
      (p) => p.dieIndex === dieIndex && p.slotIndex === slotIndex,
    );
    if (!ok) throw new Error('illegal match');
    const entry = this.tray[dieIndex];
    const symbol = this.trial.required[slotIndex];
    this.trial.matched[slotIndex] = true;
    this.spend(dieIndex);
    this.note(`${entry.face === WILD ? 'A wild face' : 'A die'} answers the ${symbol} slot.`, 'good');
    this.afterSpend();
    return this;
  }

  discard(dieIndex) {
    if (this.status !== 'active') throw new Error('encounter is over');
    if (this.availableMatches().length) throw new Error('a match is available, you must take it');
    if (!this.legalActions().canDiscard) throw new Error('a die is already placed this round; roll again');
    // Braced: the die you were about to lose stays in the bag instead. A
    // paladin's feet are set against whatever the room takes, and a die thrown
    // away for nothing is the commonest thing it takes.
    if (this.braced) {
      this.braced = false;
      const entry = this.tray[dieIndex];
      this.tray.splice(dieIndex, 1);
      this.spentThisRound++;
      this.note(`Braced: the d${entry.die.sides} is not lost, only put down.`, 'good');
      this.afterSpend();
      return this;
    }
    this.spend(dieIndex);
    this.discarded++;
    this.note('No symbol answers. A die is spent for nothing.', 'bad');
    this.afterSpend();
    return this;
  }

  reroll() {
    if (!this.legalActions().canReroll) throw new Error('spend a die before re-rolling');
    this.rerolls++;
    if (this.challenge.pressure && this.rerolls % PRESSURE_EVERY === 0 && this.remaining.length > 1) {
      if (this.braced) {
        this.braced = false;
        this.note('You are braced for it. Nothing is lost.', 'good');
      } else {
        const lost = this.remaining.splice(this.rng.int(this.remaining.length), 1)[0];
        this.note(`${cap(this.called)} presses in — a d${lost.sides} is torn away.`, 'bad');
      }
    }
    this.roll();
    // A boss that tears a die away can put the room out of reach.
    this.checkHopeless();
    return this;
  }

  spend(dieIndex) {
    const entry = this.tray[dieIndex];
    this.spentDice.push(entry.die);
    this.tray.splice(dieIndex, 1);
    const pos = this.remaining.indexOf(entry.die);
    if (pos >= 0) this.remaining.splice(pos, 1);
    this.spentThisRound++;
  }

  // --- Hero abilities ------------------------------------------------------

  ability(id) {
    return this.abilities.find((a) => a.id === id);
  }

  // Which die a slip would take back, and which slot it would answer on the
  // way. The engine decides it rather than the player, so the screen can show
  // the same choice being made before it happens.
  slipWould() {
    return this.availableMatches().reduce((big, p) => (
      !big || this.tray[p.dieIndex].die.sides > this.tray[big.dieIndex].die.sides ? p : big
    ), null);
  }

  canUse(id) {
    const a = this.ability(id);
    if (!a || a.left <= 0 || this.status !== 'active') return false;
    if (id === 'blessing') return this.spentDice.length > 0;
    if (id === 'secondWind' || id === 'transmute') return this.tray.length > 0;
    // Slip answers a slot without paying for it, so it wants a slot the tray
    // can already answer.
    if (id === 'slip') return this.availableMatches().length > 0;
    if (id === 'brace') return !this.braced;
    return true;
  }

  useAbility(id, opts = {}) {
    if (!this.canUse(id)) throw new Error('that trick is not available');
    const a = this.ability(id);
    switch (id) {
      case 'secondWind': {
        const entry = this.tray[opts.dieIndex];
        if (!entry) throw new Error('no such die');
        const wants = this.trial.required.filter((_, i) => !this.trial.matched[i]);
        const answers = () => entry.face === WILD || wants.includes(entry.face);
        let throws = 0;
        do {
          entry.face = rollDie(entry.die, this.rng);
          throws++;
        } while (throws < SECOND_WIND_THROWS && !answers());
        this.windThrows = throws;
        this.note(
          throws === 1
            ? 'Second wind: the die is thrown again where it lies, and answers.'
            : `Second wind: the die is thrown ${throws} times over before you stop.`,
          'good',
        );
        break;
      }
      case 'brace':
        this.braced = true;
        this.note('You set your feet and brace.', 'good');
        break;
      case 'transmute': {
        const entry = this.tray[opts.dieIndex];
        const wanted = this.trial.required.filter((_, i) => !this.trial.matched[i]);
        if (!entry) throw new Error('no such die');
        if (!wanted.includes(opts.symbol)) throw new Error('this trial does not want that');
        entry.face = opts.symbol;
        this.note('The die reshapes itself into what is needed.', 'good');
        break;
      }
      case 'readGround':
        this.note('You read the ground and take the throw again.', 'good');
        this.roll();
        break;
      case 'slip': {
        // The one rule a rogue does not keep: a die that answers has to be paid
        // out. It goes back in the hand instead — the biggest one on the table,
        // because that is the one worth stealing back.
        const pick = this.slipWould();
        const entry = this.tray[pick.dieIndex];
        const symbol = this.trial.required[pick.slotIndex];
        this.trial.matched[pick.slotIndex] = true;
        this.tray.splice(pick.dieIndex, 1);
        this.spentThisRound++;
        this.slipped = pick;
        this.note(`Slipped: the ${symbol} slot is answered and the d${entry.die.sides} stays in hand.`, 'good');
        a.left--;
        this.afterSpend();
        return this;
      }
      case 'blessing': {
        const die = this.spentDice.pop();
        this.remaining.push(die);
        this.tray.push({ die, face: rollDie(die, this.rng) });
        this.note(`A blessing: the d${die.sides} is called back.`, 'good');
        break;
      }
      default:
        throw new Error('unknown ability');
    }
    a.left--;
    return this;
  }

  afterSpend() {
    if (this.trial.matched.every(Boolean)) {
      if (this.trialIndex === this.challenge.trials.length - 1) {
        this.status = 'won';
        this.note(`${cap(this.called)} is overcome.`, 'good');
        return;
      }
      this.trialIndex++;
      if (this.remaining.length === 0) {
        this.status = 'lost';
        this.note('The way holds, and there are no dice left to spend.', 'bad');
        return;
      }
      this.note('The trial gives way. The next begins.', 'info');
      this.roll();
      this.checkHopeless();
      return;
    }
    if (this.remaining.length === 0) {
      this.status = 'lost';
      this.note('The last die is spent. The party falls back.', 'bad');
      return;
    }
    this.checkHopeless();
  }
}
