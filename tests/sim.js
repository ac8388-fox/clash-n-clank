// Simulated players for testing fight balance (no screens involved).
//
// learnedPolicy plays like a real player who knows every enemy's pattern and
// feints: it narrows the enemy's possible moves using only the clues it can
// see, weighs each remaining move by how likely it is, tries every choice it
// could make in its head (using the real rules), and picks the best on
// average. It never repeats the same action and target twice running.
//
// randomPolicy presses buttons at random.

import {
  startCombat, submitAction, submitClash, availableActions,
  variantOdds, variantTells, withVariant, focusTarget, TARGETS,
} from '../engine/combat.js';
import { getEnemy } from '../data/enemies.js';
import { createRng } from '../engine/random.js';
import { createCharacter } from '../engine/state.js';
import { ATTRS, attrTotals, computeHit } from '../engine/rules.js';
import { getWeapon } from '../data/items.js';
import { SPEED_RANK } from '../engine/combat.js';

export function practiceFighter(classAbility = 'planB', raceId = 'human') {
  return createCharacter({ name: 'Practice', raceId, luckyNumber: 2, occupationId: 'knight', classAbility });
}

const total = (m) => ATTRS.reduce((s, k) => s + m[k], 0);

// The enemy moves still possible given what can be seen, with their chances.
// Uses only what a player who knows the patterns could work out: which steps
// were possible this exchange (and how likely), then the caption and clues.
// When the enemy hides its intent, every move of every possible step remains.
export function possibleMoves(combat) {
  const enemy = getEnemy(combat.enemyId);
  const cur = combat.current;
  const list = [];
  for (const { step, p } of cur.options) {
    if (!cur.hidden && step.caption !== cur.caption) continue;
    const odds = variantOdds(enemy, step);
    step.variants.forEach((v, i) => {
      if (variantTells(enemy, step, v).slice(0, cur.tells.length).every((t, j) => t === cur.tells[j])) {
        list.push({ v, p: p * odds[i] });
      }
    });
  }
  const sum = list.reduce((s, x) => s + x.p, 0);
  return list.map(x => ({ v: x.v, p: x.p / sum }));
}

// Best guess for a Clash direction from what can be seen.
function guessClash(moves) {
  const score = {};
  for (const { v, p } of moves) score[v.clash || v.target] = (score[v.clash || v.target] || 0) + p;
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

function allChoices(character, combat) {
  const acts = availableActions(character, combat);
  const out = [{ action: 'pray' }];
  if (acts.page1[3].enabled) out.push({ action: 'item' });
  for (const t of TARGETS) {
    if (acts.page1[1].enabled) out.push({ action: 'attack', target: t });
    out.push({ action: 'block', target: t });
    for (const a of acts.abilities) if (a.enabled) out.push({ action: 'ability', abilityId: a.id, target: t });
  }
  return out;
}

const sameAsLast = (combat, ch) => {
  const h = combat.player.history;
  if (!h.length) return false;
  const last = h[h.length - 1];
  const name = ch.action === 'ability' ? 'ability:' + ch.abilityId : ch.action;
  return last.action === name && (last.target || null) === (ch.target || null);
};

// How good the position is after one imagined exchange.
function evaluate(character, combat, choice, clashGuess) {
  const cb0 = { ...combat, rngState: 0x9E3779B9 };   // don't peek at real random results
  let r;
  try { r = submitAction(character, cb0, choice); } catch { return -Infinity; }
  if (r.combat.pendingClash) r = submitClash(r.character, r.combat, clashGuess);
  const c = r.character, cb = r.combat;
  if (cb.outcome === 'victory') return 1000;
  if (cb.outcome === 'defeat') return -1000;
  const dealt = total(combat.enemy.stamina) - total(cb.enemy.stamina);
  const staminaNow = ATTRS.reduce((s, k) => s + c.attrs[k].stamina, 0);
  const staminaBefore = ATTRS.reduce((s, k) => s + character.attrs[k].stamina, 0);
  const taken = staminaBefore - staminaNow;
  // A race to zero: damage matters in proportion to what each side has left.
  const enemyLeft = Math.max(1, total(combat.enemy.stamina));
  const playerLeft = Math.max(1, staminaBefore);
  const edgeWeight = (1 / enemyLeft + 1 / playerLeft) / 2;
  let score = dealt / enemyLeft - taken / playerLeft + edgeWeight * (edges(c, cb) - edges(character, combat));
  if (choice.action === 'item') score -= 2.5 * edgeWeight;   // a draught spent is gone for good
  return score;
}

// Value of the edges each side holds (Advantage, Off-Balance, blessings).
function edges(character, combat) {
  let s = 0;
  if (combat.player.advantageNext) s += 1;
  if (combat.player.conditions.some(x => x.id === 'offBalance')) s -= 1;
  if (combat.enemy.conditions.some(x => x.id === 'offBalance')) s += 1;
  if (combat.enemy.advantageNext) s -= 1;
  s += 0.75 * character.traits.filter(t => t.kind === 'TPT').length;
  s += 1.5 * weaponQuality(character, combat);
  return s;
}

// How useful the weapon in hand is against this enemy: its best hit through
// the enemy's armor, halved against enemy weapons that are faster.
function weaponQuality(character, combat) {
  const id = character.gear.ready[combat.player.weaponIndex];
  if (!id) return 0;
  const w = getWeapon(id);
  const enemy = getEnemy(combat.enemyId);
  const totals = attrTotals(character);
  const best = Math.max(...TARGETS.map(t => computeHit({
    weapon: w, totals, armorWeight: enemy.armor[t === 'head' ? 'head' : t === 'legs' ? 'legs' : 'body'],
  })));
  const vs = enemy.weapons.map(getWeapon);
  return vs.reduce((s, e) => s + (SPEED_RANK[w.speed] < SPEED_RANK[e.speed] ? best / 2 : best), 0) / vs.length;
}

export function learnedPolicy(character, combat) {
  const moves = possibleMoves(combat);
  const clashGuess = guessClash(moves);
  let best = null, bestScore = -Infinity;
  for (const ch of allChoices(character, combat)) {
    if (sameAsLast(combat, ch)) continue;
    let s = 0;
    for (const { v, p } of moves) s += p * evaluate(character, withVariant(combat, v.id), ch, clashGuess);
    s -= guardRisk(combat, ch);
    if (s > bestScore) { bestScore = s; best = ch; }
  }
  return best || { action: 'pray' };
}
// Striking the same spot again invites the enemy to guard it next time:
// roughly its guard chance times the hit that would be lost.
function guardRisk(combat, ch) {
  if (!(ch.action === 'attack' || ch.action === 'ability')) return 0;
  const name = ch.action === 'ability' ? 'ability:' + ch.abilityId : ch.action;
  if (!focusTarget([...combat.player.history, { action: name, target: ch.target }])) return 0;
  const enemy = getEnemy(combat.enemyId);
  return (enemy.guardChance || 0) * 2 / Math.max(1, total(combat.enemy.stamina));
}

export const learnedClash = (combat) => guessClash(possibleMoves(combat));

// A player pressing buttons at random.
export function randomPolicy(rng) {
  return (character, combat) => {
    const acts = availableActions(character, combat);
    const options = [];
    for (const a of acts.page1) if (a.enabled) options.push({ action: a.id });
    for (const a of acts.abilities) if (a.enabled) options.push({ action: 'ability', abilityId: a.id });
    const ch = options[Math.floor(rng.next() * options.length)];
    if (['attack', 'block', 'ability'].includes(ch.action)) ch.target = TARGETS[Math.floor(rng.next() * 4)];
    return ch;
  };
}
export function randomClash(rng) {
  return () => TARGETS[Math.floor(rng.next() * 4)];
}

export function simulateFight({ seed, policy, clashPick, enemyId = 'werewolf', character = practiceFighter(),
                               timeOfDay = 'Morning', maxExchanges = 200 }) {
  let c = character;
  let cb = startCombat(c, enemyId, { seed, timeOfDay });
  const stats = { exchanges: 0, noClue: 0, hidden: 0, twoClues: 0, enemyBlocks: 0, clanks: 0, clashes: 0 };
  while (!cb.outcome && cb.exchange <= maxExchanges) {
    stats.exchanges++;
    if (cb.current.tells.length === 0) stats.noClue++;
    if (cb.current.hidden) stats.hidden++;
    if (cb.current.tells.length >= 2) stats.twoClues++;
    if (cb.current.step.variants.find(v => v.id === cb.current.variantId).action === 'block') stats.enemyBlocks++;
    const choice = policy(c, cb);
    const r = submitAction(c, cb, choice);
    ({ character: c, combat: cb } = r);
    if (r.lines.some(l => l.startsWith('Clank!'))) stats.clanks++;
    if (r.lines.some(l => l.startsWith('CLASH!'))) stats.clashes++;
    if (cb.pendingClash) ({ character: c, combat: cb } = submitClash(c, cb, clashPick(cb)));
  }
  const left = ATTRS.reduce((s, k) => s + c.attrs[k].stamina, 0);
  const start = ATTRS.reduce((s, k) => s + character.attrs[k].stamina, 0);
  Object.assign(stats, cb.stats);
  return { outcome: cb.outcome, exchanges: cb.exchange, staminaLeft: left, staminaStart: start,
           leftShare: left / start, character: c, combat: cb, stats };
}

export { createRng };
