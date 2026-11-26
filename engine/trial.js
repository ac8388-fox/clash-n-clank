// Trials (Build Spec → "Trials", "Rules engine": trial check, failure,
// forced lucky attempt; "Character creation": racial ability, slice version).
//
// A trial offers four options, one per direction (Up FAI, Right STR, Down WIS,
// Left AGI). An option succeeds if the attribute's current stamina is at least
// the requirement. A failure drains that attribute by (requirement − stamina),
// at least 2, and the event stays open: try another option or come back later.
//
// Racial ability (slice version): while it is ready, it replaces the weakest
// option (the biggest gap between requirement and the attribute's total) and
// succeeds automatically; then it waits for a Rest.
//
// Lucky attempts: a Fortune opening (5% + Luck%, rolled each attempt) lets the
// player tap the star and hold an option. Any lucky number passes the trial;
// none fails it worse than normal (double damage). When the only option left
// can't be met, it becomes a lucky attempt automatically.
//
// Pure functions: they return new character and world objects. Randomness goes
// through the seeded generator in world.rngState.

import { getTrial, RACIAL_TRIAL_TEXT } from '../data/events.js';
import { getRace } from '../data/races.js';
import {
  attrTotal, trialCheck, trialFailureDamage, isForcedLuckyAttempt, useAttribute,
  damageCharacter, rollFortune, rollLuckyDice, luckyResult, luckOf, isDefeated, staminaOf,
} from './rules.js';
import { createRng } from './random.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// The options as the player sees them now (with the racial ability, if ready).
export function trialOptions(character, trialId) {
  const t = getTrial(trialId);
  const opts = t.options.map(o => ({
    ...o,
    stamina: character.attrs[o.attr].stamina,
    canMeet: trialCheck(character.attrs[o.attr].stamina, o.requirement),
  }));
  if (character.racialReady) {
    let weakest = 0, gap = -Infinity;
    opts.forEach((o, i) => {
      const g = o.requirement - attrTotal(character, o.attr);
      if (g > gap) { gap = g; weakest = i; }
    });
    const race = getRace(character.raceId);
    opts[weakest] = {
      dir: opts[weakest].dir, attr: null, racial: true, label: race.ability,
      requirement: 0, canMeet: true, replaces: opts[weakest].label,
    };
  }
  return opts;
}

// Start (or return to) a trial: roll a Fortune opening for the first attempt.
export function beginTrial(character, world, trialId) {
  const w = clone(world);
  w.trial = { id: trialId, fortune: rollTrialFortune(character, w, trialId) };
  return w;
}

function rollTrialFortune(character, w, trialId) {
  const t = getTrial(trialId);
  const rng = createRng(w.rngState);
  const open = rollFortune(luckOf(character), rng);
  const hint = open ? t.fortuneHints[Math.floor(rng.next() * t.fortuneHints.length)] : null;
  w.rngState = rng.getState();
  return { open, hint };
}

// Attempt one option. choice: { dir, lucky }.
// Returns { character, world, outcome: 'success' | 'failure' | 'defeat', lines, next }.
export function attemptTrial(characterIn, worldIn, choice) {
  let c = clone(characterIn);
  const w = clone(worldIn);
  if (!w.trial) throw new Error('No trial in progress');
  const t = getTrial(w.trial.id);
  const opts = trialOptions(c, t.id);
  const o = opts.find(x => x.dir === choice.dir);
  if (!o) throw new Error('No option that way');
  const lines = [];
  let success = false;

  if (o.racial) {
    c.racialReady = false;
    success = true;
    lines.push(RACIAL_TRIAL_TEXT[c.raceId] || `${o.label}: it works.`);
  } else {
    c = useAttribute(c, o.attr);                          // at 0 stamina it wears Natural down
    const stamina = c.attrs[o.attr].stamina;
    // The only option left (others disabled) and it can't be met: a forced lucky attempt.
    const forced = isForcedLuckyAttempt(opts.filter(x => !x.disabled), c);
    const lucky = forced || (choice.lucky && w.trial.fortune && w.trial.fortune.open);
    let damage = 0;
    if (lucky) {
      const rng = createRng(w.rngState);
      const rolls = rollLuckyDice(luckOf(c), rng);
      w.rngState = rng.getState();
      const res = luckyResult(rolls, c.luckyNumber);
      const shown = rolls.map(r => `d${r.sides}: ${r.value}`).join(', ');
      if (res.success) {
        success = true;
        lines.push(`Lucky! (${shown}) ${o.label} works against the odds.`);
      } else {
        damage = 2 * trialFailureDamage(stamina, o.requirement);
        lines.push(`No luck. (${shown}) It goes badly wrong.`);
      }
    } else if (trialCheck(stamina, o.requirement)) {
      success = true;
      lines.push(`${o.label}: you manage it (${o.attr} ${stamina} against ${o.requirement}).`);
    } else {
      damage = trialFailureDamage(stamina, o.requirement);
      lines.push(`${o.label}: not enough (${o.attr} ${stamina} against ${o.requirement}).`);
    }
    if (!success) {
      const r = damageCharacter(c, o.attr, damage);
      c = r.character;
      lines.push(`${t.failure.text} ${r.applied.map(a => `−${a.amount} ${a.attr}`).join(', ')}.`);
    }
  }

  if (success) {
    lines.push(t.success.text);
    w.eventFlags = { ...w.eventFlags, ...t.success.flags };
    w.trial = null;
    return { character: c, world: w, outcome: 'success', lines, next: t.success.next };
  }
  if (isDefeated(staminaOf(c))) {
    w.trial = null;
    lines.push('You collapse. Your strength is spent.');
    return { character: c, world: w, outcome: 'defeat', lines, next: 'end' };
  }
  w.trial.fortune = rollTrialFortune(c, w, t.id);                // a fresh chance for the next attempt
  return { character: c, world: w, outcome: 'failure', lines, next: 'trial' };
}
