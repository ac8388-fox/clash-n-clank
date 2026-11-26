// Trials (Build Spec → "Trials", "Rules engine": Trial check, Falling short,
// Forced lucky attempt; "Character creation": racial ability, slice version).
//
// A trial offers four options, one per direction (Up FAI, Right STR, Down WIS,
// Left AGI). Whatever the player chooses, they get through:
//   – meet the requirement (the attribute's current stamina is at least it):
//     a clean pass, at no cost;
//   – fall short: they still get through, but that attribute's stamina drops
//     to 0 and they gain a negative trait (rules.js → trialSetback): a TNT
//     for a shortfall of 1–3, or a CNT (Injured, −2 to that total) for 4+.
//     Injured is treated by Sleeping at the Village (engine/world.js).
//
// Racial ability (slice version): while it is ready, it replaces the weakest
// option (the biggest gap between requirement and the attribute's total) and
// succeeds cleanly; then it waits for a Rest.
//
// Lucky attempts: a Fortune opening (5% + Luck%, rolled each visit) lets the
// player tap the star and hold an option. Any lucky number is a clean pass;
// none counts the same as without the dice: a clean pass if the requirement
// is met, otherwise falling short by the real gap.
// When the only option left can't be met, it becomes a lucky attempt.
//
// Pure functions: they return new character and world objects. Randomness goes
// through the seeded generator in world.rngState.

import { getTrial, RACIAL_TRIAL_TEXT } from '../data/events.js';
import { getRace } from '../data/races.js';
import { TRAITS } from '../data/traits.js';
import {
  attrTotal, trialCheck, trialSetback, isForcedLuckyAttempt, useAttribute,
  rollFortune, rollLuckyDice, luckyResult, luckOf, isDefeated, staminaOf,
} from './rules.js';
import { createRng } from './random.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// The options as the player sees them now (with the racial ability, if ready).
// Each shows what falling short would cost: shortfall and setback.
export function trialOptions(character, trialId) {
  const t = getTrial(trialId);
  const opts = t.options.map(o => {
    const stamina = character.attrs[o.attr].stamina;
    const shortfall = Math.max(0, o.requirement - stamina);
    return { ...o, stamina, canMeet: trialCheck(stamina, o.requirement), shortfall, setback: trialSetback(o.attr, shortfall) };
  });
  if (character.racialReady) {
    let weakest = 0, gap = -Infinity;
    opts.forEach((o, i) => {
      const g = o.requirement - attrTotal(character, o.attr);
      if (g > gap) { gap = g; weakest = i; }
    });
    const race = getRace(character.raceId);
    opts[weakest] = {
      dir: opts[weakest].dir, attr: null, racial: true, label: race.ability,
      requirement: 0, canMeet: true, shortfall: 0, setback: null, replaces: opts[weakest].label,
    };
  }
  return opts;
}

// Words for a setback trait ("Bruised", "Injured (STR)").
export function setbackName(setback) {
  if (!setback) return '';
  return setback.attr ? `${TRAITS[setback.id].name} (${setback.attr})` : TRAITS[setback.id].name;
}

// Start (or return to) a trial: roll a Fortune opening.
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

// Gain a setback trait (Steeled ignores the next TNT; the same TNT doesn't stack).
function gainSetback(c, setback, lines) {
  if (setback.kind === 'TNT') {
    if (c.traits.some(t => t.id === 'steeled')) {
      c.traits = c.traits.filter(t => t.id !== 'steeled');
      lines.push(`Steeled, you shrug off being ${TRAITS[setback.id].name}.`);
      return;
    }
    if (c.traits.some(t => t.id === setback.id)) { lines.push(`You are still ${TRAITS[setback.id].name}.`); return; }
  }
  c.traits.push({ ...setback, source: 'trial' });
  lines.push(setback.kind === 'CNT'
    ? `It costs you: you are ${setbackName(setback)}, −2 to your ${setback.attr} total until you sleep at the Village.`
    : `It costs you: you are ${TRAITS[setback.id].name} (${TRAITS[setback.id].effect}).`);
}

// Attempt one option. choice: { dir, lucky }.
// Returns { character, world, outcome: 'success' | 'shortfall' | 'defeat', lines, next }.
export function attemptTrial(characterIn, worldIn, choice) {
  let c = clone(characterIn);
  const w = clone(worldIn);
  if (!w.trial) throw new Error('No trial in progress');
  const t = getTrial(w.trial.id);
  const opts = trialOptions(c, t.id);
  const o = opts.find(x => x.dir === choice.dir);
  if (!o) throw new Error('No option that way');
  const lines = [];
  let clean = false;
  let setback = null;

  if (o.racial) {
    c.racialReady = false;
    clean = true;
    lines.push(RACIAL_TRIAL_TEXT[c.raceId] || `${o.label}: it works.`);
  } else {
    c = useAttribute(c, o.attr);                          // at 0 stamina it wears Natural down
    const stamina = c.attrs[o.attr].stamina;
    const shortfall = Math.max(0, o.requirement - stamina);
    // The only option left (others disabled) and it can't be met: a forced lucky attempt.
    const forced = isForcedLuckyAttempt(opts.filter(x => !x.disabled), c);
    const lucky = forced || (choice.lucky && w.trial.fortune && w.trial.fortune.open);
    if (lucky) {
      const rng = createRng(w.rngState);
      const rolls = rollLuckyDice(luckOf(c), rng);
      w.rngState = rng.getState();
      const res = luckyResult(rolls, c.luckyNumber);
      const shown = rolls.map(r => `d${r.sides}: ${r.value}`).join(', ');
      if (res.success) {
        clean = true;
        lines.push(`Lucky! (${shown}) ${o.label} works against the odds.`);
      } else {
        // No lucky number: it counts as falling short by the real gap (no cost if there is none).
        setback = trialSetback(o.attr, shortfall);
        clean = !setback;
        lines.push(clean
          ? `No luck. (${shown}) ${o.label}: no matter, you manage it anyway (${o.attr} ${stamina} against ${o.requirement}).`
          : `No luck. (${shown}) ${o.label}: short by ${shortfall}. You force your way through.`);
      }
    } else if (shortfall === 0) {
      clean = true;
      lines.push(`${o.label}: you manage it (${o.attr} ${stamina} against ${o.requirement}).`);
    } else {
      setback = trialSetback(o.attr, shortfall);
      lines.push(`${o.label}: short by ${shortfall} (${o.attr} ${stamina} against ${o.requirement}). You force your way through.`);
    }
    if (!clean) {
      lines.push(`${t.shortfall.text} ${o.attr} drops to 0.`);
      c.attrs[o.attr].stamina = 0;
      gainSetback(c, setback, lines);
    }
  }

  lines.push(t.success.text);
  w.eventFlags = { ...w.eventFlags, ...t.success.flags };
  w.trial = null;
  if (isDefeated(staminaOf(c))) {
    lines.push('You collapse on the far side. Your strength is spent.');
    return { character: c, world: w, outcome: 'defeat', lines, next: 'end' };
  }
  return { character: c, world: w, outcome: clean ? 'success' : 'shortfall', lines, next: t.success.next };
}
