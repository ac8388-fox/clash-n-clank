// Trials (Build Spec → "Trials", "Rules engine": Trial check, Falling short,
// Lucky only; "Character creation": racial ability, slice version).
//
// A trial offers four options, one per direction (Up FAI, Right STR, Down WIS,
// Left AGI). The gap is measured against the attribute's CURRENT stamina:
//   – met (stamina ≥ requirement): a clean pass, at no cost;
//   – 1–3 short: the player still gets through, but that stamina drops to 0
//     and they gain a TNT matched to the attribute (rules.js → trialSetback);
//   – 4 or more short: "Lucky only". It can only be tried as a lucky attempt
//     (when a Fortune opening shows). Any lucky number is a clean pass; none
//     means the player does NOT get through: that stamina drops to 0 and they
//     are Injured in it (−2 to its total until treated by Sleeping at the
//     Village). Resting first raises stamina and can shrink the gap.
// These are the only options that can block the player. The trial screen can
// always be left (swipe down), and the Gorge has a longer way round.
//
// Racial ability (slice version): while it is ready, it replaces the weakest
// option (the biggest gap between requirement and the attribute's total) and
// succeeds cleanly; then it waits for a Rest.
//
// A chosen lucky attempt on an option that isn't Lucky only: any lucky number
// is a clean pass; none counts the same as without the dice (a clean pass if
// the requirement is met, otherwise 1–3 short with its TNT).
//
// Pure functions: they return new character and world objects. Randomness goes
// through the seeded generator in world.rngState.

import { getTrial, RACIAL_TRIAL_TEXT } from '../data/events.js';
import { getRace } from '../data/races.js';
import { TRAITS } from '../data/traits.js';
import {
  attrTotal, trialCheck, trialSetback, isLuckyOnly, useAttribute,
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
    const luckyOnly = isLuckyOnly(shortfall);
    return { ...o, stamina, canMeet: trialCheck(stamina, o.requirement), shortfall, luckyOnly,
             // What it costs: falling short by 1–3, or a failed lucky attempt when Lucky only.
             setback: trialSetback(o.attr, shortfall) };
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
      requirement: 0, canMeet: true, shortfall: 0, luckyOnly: false, setback: null, replaces: opts[weakest].label,
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
// Returns { character, world, outcome, lines, next }:
//   outcome 'success' (clean) | 'shortfall' (through, with a TNT) |
//           'blocked' (a Lucky-only attempt failed: not through, Injured) |
//           'defeat' (every pool empty).
// A blocked attempt leaves the trial in place (its Fortune opening is spent):
// the player can try another option, or leave, rest, and come back.
export function attemptTrial(characterIn, worldIn, choice) {
  let c = clone(characterIn);
  const w = clone(worldIn);
  if (!w.trial) throw new Error('No trial in progress');
  const t = getTrial(w.trial.id);
  const opts = trialOptions(c, t.id);
  const o = opts.find(x => x.dir === choice.dir);
  if (!o) throw new Error('No option that way');
  const fortuneOpen = !!(w.trial.fortune && w.trial.fortune.open);
  const lucky = !o.racial && !!choice.lucky && fortuneOpen;
  if (o.luckyOnly && !lucky) {
    throw new Error(`${o.label} is Lucky only: you are ${o.shortfall} short. Wait for a Fortune opening, or rest first.`);
  }
  const lines = [];
  let clean = false;
  let blocked = false;
  let setback = null;

  if (o.racial) {
    c.racialReady = false;
    clean = true;
    lines.push(RACIAL_TRIAL_TEXT[c.raceId] || `${o.label}: it works.`);
  } else {
    const stamina = c.attrs[o.attr].stamina;
    const shortfall = Math.max(0, o.requirement - stamina);
    c = useAttribute(c, o.attr);                          // at 0 stamina it wears Natural down
    if (lucky) {
      const rng = createRng(w.rngState);
      const rolls = rollLuckyDice(luckOf(c), rng);
      w.rngState = rng.getState();
      w.trial.fortune = { open: false, hint: null };      // one lucky attempt per opening
      const res = luckyResult(rolls, c.luckyNumber);
      const shown = rolls.map(r => `d${r.sides}: ${r.value}`).join(', ');
      if (res.success) {
        clean = true;
        lines.push(`Lucky! (${shown}) ${o.label} works against the odds.`);
      } else if (o.luckyOnly) {
        blocked = true;
        setback = trialSetback(o.attr, shortfall);         // Injured (4+ short)
        lines.push(`No luck. (${shown}) ${o.label}: ${shortfall} short, and it beats you. You don't get through.`);
      } else {
        setback = trialSetback(o.attr, shortfall);         // the real gap: none, or a TNT
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
      lines.push(blocked ? `${o.attr} drops to 0.` : `${t.shortfall.text} ${o.attr} drops to 0.`);
      c.attrs[o.attr].stamina = 0;
      gainSetback(c, setback, lines);
    }
  }

  if (blocked) {
    if (isDefeated(staminaOf(c))) {
      lines.push('You sink down, spent. Your strength is gone.');
      return { character: c, world: w, outcome: 'defeat', lines, next: 'end' };
    }
    lines.push('Try another way, or step back (swipe down) to rest and return, or go round.');
    return { character: c, world: w, outcome: 'blocked', lines, next: 'trial' };
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
