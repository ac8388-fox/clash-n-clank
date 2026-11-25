// Simulated players for testing fight balance (no screens involved).

import { startCombat, submitAction, submitClash, availableActions } from '../engine/combat.js';
import { getEnemy } from '../data/enemies.js';
import { createRng } from '../engine/random.js';
import { createCharacter } from '../engine/state.js';
import { ATTRS } from '../engine/rules.js';

export function practiceFighter(classAbility = 'planB') {
  return createCharacter({ name: 'Practice', raceId: 'human', luckyNumber: 2, occupationId: 'knight', classAbility });
}

const TARGETS = ['head', 'left', 'right', 'legs'];

// A player who has learned the pattern: blocks the fast claws, meets the bite
// head-on to start a Clash, and reads the Clash correctly.
export function learnedPolicy(character, combat) {
  const enemy = getEnemy(combat.enemyId);
  const step = enemy.pattern.find(s => s.id === combat.current.stepId);
  const low = ATTRS.some(k => character.attrs[k].stamina <= 3);
  const acts = availableActions(character, combat);
  if (low && acts.page1[3].enabled) return { action: 'item' };
  if (step.action !== 'attack') return { action: 'attack', target: 'legs' };
  if (step.weapon === 'bite') return { action: 'attack', target: 'head' };
  if (combat.player.advantageNext) {
    const last = combat.player.history[combat.player.history.length - 1];
    const target = last && last.target === 'left' ? 'legs' : 'left';
    return { action: 'attack', target };
  }
  return { action: 'block', target: step.target };
}
export const learnedClash = (combat) => combat.pendingClash.enemyDir;

// A player pressing buttons at random.
export function randomPolicy(rng) {
  return () => {
    const r = rng.next();
    const target = TARGETS[Math.floor(rng.next() * 4)];
    if (r < 0.5) return { action: 'attack', target };
    if (r < 0.85) return { action: 'block', target };
    return { action: 'pray' };
  };
}

export function simulateFight({ seed, policy, clashPick, enemyId = 'werewolf', character = practiceFighter(), maxExchanges = 200 }) {
  let c = character;
  let cb = startCombat(c, enemyId, { seed });
  while (!cb.outcome && cb.exchange <= maxExchanges) {
    let choice = policy(c, cb);
    try { ({ character: c, combat: cb } = submitAction(c, cb, choice)); }
    catch { ({ character: c, combat: cb } = submitAction(c, cb, { action: 'pray' })); }
    if (cb.pendingClash) ({ character: c, combat: cb } = submitClash(c, cb, clashPick(cb)));
  }
  const left = ATTRS.reduce((s, k) => s + c.attrs[k].stamina, 0);
  return { outcome: cb.outcome, exchanges: cb.exchange, staminaLeft: left, character: c, combat: cb };
}

export function randomClash(rng) {
  return () => TARGETS[Math.floor(rng.next() * 4)];
}

export { createRng };
