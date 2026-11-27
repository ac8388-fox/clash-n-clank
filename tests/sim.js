// Simulated players for testing fight balance (no screens involved).
//
// The three the difficulty targets are set against (Build Spec → Enemies):
//
// attentivePlayer – knows only what is on screen. It doesn't know the
//   enemy's pattern, but watches every exchange: it remembers what the enemy
//   did (the attacks it sees land or miss, and Blocks it runs into) and which
//   move tended to follow which, uses any tell, and tries each choice in its
//   head with the real rules against what it expects. It makes the best choice
//   about 75% of the time; otherwise its second or third best. In a Clash it
//   pushes where their attacks met, unless it has seen the enemy go another way.
//
// newPlayer – doesn't know the patterns and doesn't study them: mostly
//   attacks (the main attack half the time), sometimes Blocks (often where it
//   was last hit), now and then prays, and drinks a draught when a bar runs low.
//
// randomPolicy – presses any button it can, at random.
//
// learnedPolicy (the expert, for reference) knows every enemy's pattern and
// feints: from the pattern it knows which moves are possible and how likely,
// narrows them with any tell, tries every choice in its head, and picks the
// best on average.

import {
  startCombat, submitAction, submitClash, availableActions,
  variantOdds, withVariant, focusTarget, TARGETS,
} from '../engine/combat.js';
import { getEnemy } from '../data/enemies.js';
import { createRng } from '../engine/random.js';
import { createCharacter } from '../engine/state.js';
import { ATTRS, attrTotals, attrTotal, computeHit } from '../engine/rules.js';
import { getWeapon, weaponAttack } from '../data/items.js';
import { getAbility } from '../data/abilities.js';
import { SPEED_RANK } from '../engine/combat.js';

export function practiceFighter(classAbility = 'planB', raceId = 'human') {
  return createCharacter({ name: 'Practice', raceId, luckyNumber: 2, occupationId: 'knight', classAbility });
}

const total = (m) => ATTRS.reduce((s, k) => s + m[k], 0);

// Does a move fit a tell? (Tells are always true.)
export function fitsTell(move, tell) {
  if (!tell) return true;
  if (tell.exact) return move.action === tell.exact.action && (move.target || null) === tell.exact.target;
  if (tell.attacking === true && move.action !== 'attack') return false;
  if (tell.attacking === false && move.action === 'attack') return false;
  return !(move.action === 'attack' && tell.ruledOut.includes(move.target));
}

// The enemy moves still possible, with their chances: from the pattern (the
// steps a pattern-knowing player expects, and each step's main move and
// feints), narrowed by this exchange's tell.
export function possibleMoves(combat) {
  const enemy = getEnemy(combat.enemyId);
  const cur = combat.current;
  const list = [];
  for (const { step, p } of cur.options) {
    const odds = variantOdds(enemy, step);
    step.variants.forEach((v, i) => { if (fitsTell(v, cur.tell)) list.push({ v, p: p * odds[i] }); });
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

// Every choice a player could press right now. Attacks carry their own
// target (attackId); abilities too; Block picks a spot.
export function allChoices(character, combat) {
  const acts = availableActions(character, combat);
  const out = [{ action: 'pray' }];
  if (acts.page1[3].enabled) out.push({ action: 'item' });
  for (const a of acts.attacks) if (a.enabled) out.push({ action: 'attack', attackId: a.id, target: a.target });
  for (const t of TARGETS) out.push({ action: 'block', target: t });
  for (const a of acts.abilities) if (a.enabled) out.push({ action: 'ability', abilityId: a.id, target: a.target });
  return out;
}

const sameAsLast = (combat, ch) => {
  const h = combat.player.history;
  if (!h.length) return false;
  const last = h[h.length - 1];
  const name = ch.action === 'ability' ? 'ability:' + ch.abilityId : ch.action;
  return last.action === name && (last.target || null) === (ch.target || null);
};

// Rank choices by their expected score against weighted enemy moves.
function rankChoices(character, combat, choices, weighted, clashGuess) {
  const scored = choices.map(ch => {
    let sc = 0;
    for (const { cb, p } of weighted) sc += p * evaluate(character, cb, ch, clashGuess);
    return { ch, sc: sc - guardRisk(combat, ch) - (sameAsLast(combat, ch) ? 0.15 : 0) };
  });
  return scored.sort((a, b) => b.sc - a.sc);
}

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

const TPT_VALUE = { focused: 2.5, emboldened: 1, blessed: 1, steeled: 0.5, nimble: 0 };

// Value of the edges each side holds (Advantage, Off-Balance, blessings).
function edges(character, combat) {
  let s = 0;
  if (combat.player.advantageNext) s += 1;
  if (combat.player.conditions.some(x => x.id === 'offBalance')) s -= 1;
  if (combat.enemy.conditions.some(x => x.id === 'offBalance')) s += 1;
  if (combat.enemy.advantageNext) s -= 1;
  // Blessings: Focused (tells for a few exchanges) is worth the most.
  for (const t of character.traits.filter(t => t.kind === 'TPT')) s += TPT_VALUE[t.id] ?? 0.75;
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
  const choices = allChoices(character, combat).filter(ch => !sameAsLast(combat, ch));
  const ranked = rankChoices(character, combat, choices, moves.map(({ v, p }) => ({ cb: withVariant(combat, v.id), p })), clashGuess);
  return ranked.length ? ranked[0].ch : { action: 'pray' };
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

// In a Clash the player knows the enemy's move (it attacked the same spot),
// so a pattern-knowing player goes with its usual Clash direction.
// A Clash tell (if any) may rule the usual direction out; then pick among what's left.
export const learnedClash = (combat) => {
  const pc = combat.pendingClash;
  const out = (pc.tell && pc.tell.ruledOut) || [];
  if (pc.usualDir && !out.includes(pc.usualDir)) return pc.usualDir;
  return TARGETS.find(t => !out.includes(t));
};

// A player pressing buttons at random. Like a person mashing, it mostly presses
// whatever is on the page in front of it: page 1 (Pray, the main attack, Block,
// Item) 70% of the time, page 2 (the other three attacks) 20%, the abilities
// page 10%; then any enabled button there at random (Block at a random spot).
export function randomPolicy(rng) {
  return (character, combat) => {
    const acts = availableActions(character, combat);
    const page1 = [{ action: 'pray' }, { action: 'block' }];
    if (acts.page1[1].enabled) page1.push({ action: 'attack', attackId: acts.page1[1].attack.id });
    if (acts.page1[3].enabled) page1.push({ action: 'item' });
    const page2 = acts.attacks.filter(a => a.enabled && !a.main).map(a => ({ action: 'attack', attackId: a.id }));
    const page3 = acts.abilities.filter(a => a.enabled).map(a => ({ action: 'ability', abilityId: a.id }));
    const r = rng.next();
    const page = r < 0.7 || (!page2.length && !page3.length) ? page1 : (r < 0.9 && page2.length) || !page3.length ? page2 : page3;
    const ch = { ...page[Math.floor(rng.next() * page.length)] };
    if (ch.action === 'block') ch.target = TARGETS[Math.floor(rng.next() * 4)];
    return ch;
  };
}

// ---- What a player sees of the enemy's move ----------------------------------------------------
// An attack shows (it lands, is Blocked, or misses), as weapon and spot. A Block
// only shows if you attacked into it. Anything else looks quiet.
export function seenMove(combatBefore, choice) {
  const v = combatBefore.current.step.variants.find(x => x.id === combatBefore.current.variantId);
  if (v.action === 'attack') return `atk:${v.weapon}:${v.target}`;
  if (v.action === 'block' && (choice.action === 'attack' || choice.action === 'ability') && choice.target === v.target) return `blk:${v.target}`;
  return 'quiet';
}
// A pretend enemy move for imagining an exchange.
function moveFromKey(key, enemy) {
  const [kind, a, b] = key.split(':');
  if (kind === 'atk') return { id: 'sim-' + key, action: 'attack', weapon: a, target: b, clash: b };
  if (kind === 'blk') return { id: 'sim-' + key, action: 'block', target: a };
  return null;
}
function imagine(combat, move) {
  const cb = JSON.parse(JSON.stringify(combat));
  cb.current.step = { ...cb.current.step, variants: [move] };
  cb.current.variantId = move.id;
  return cb;
}

// ---- The attentive player ----------------------------------------------------------------------
export function attentivePlayer(rng, { best = 0.75 } = {}) {
  let enemyId = null, last = null, seen = {}, after = {}, clashSeen = {}, seq = [];
  const reset = (id) => { enemyId = id; last = null; seen = {}; after = {}; clashSeen = {}; seq = []; };
  // How well "it repeats every L moves" has held so far (a watching player notices cycles).
  function cycleFit(L) {
    let hit = 0, tries = 0;
    for (let t = L; t < seq.length; t++) { tries++; if (seq[t] === seq[t - L]) hit++; }
    return tries ? (hit + 0.5) / (tries + 1) : 0;
  }
  // What it expects: a little of everything the enemy could do with the weapons it
  // carries, more of what it has seen, more of what has followed the last move,
  // and most of what came one cycle ago when the enemy seems to repeat itself.
  function expect(combat) {
    const enemy = getEnemy(combat.enemyId);
    const w = {};
    const add = (k, x) => { w[k] = (w[k] || 0) + x; };
    for (const wp of enemy.weapons) for (const t of TARGETS) add(`atk:${wp}:${t}`, 0.15);
    for (const t of TARGETS) add(`blk:${t}`, 0.05);
    for (const [k, n] of Object.entries(seen)) if (k !== 'quiet') add(k, 0.5 * n);
    if (last && after[last]) for (const [k, n] of Object.entries(after[last])) if (k !== 'quiet') add(k, 2 * n);
    let bestL = 0, bestFit = 0;
    for (const L of [2, 3, 4, 5]) { const f = cycleFit(L); if (f > bestFit) { bestFit = f; bestL = L; } }
    if (bestL) for (let k = 1; k <= 3; k++) {
      const prev = seq[seq.length - k * bestL];
      if (prev && prev !== 'quiet') add(prev, 6 * bestFit / k);
    }
    const tell = combat.current.tell;
    const list = [];
    for (const [k, x] of Object.entries(w)) {
      const m = moveFromKey(k, enemy);
      if (m && fitsTell(m, tell)) list.push({ m, p: x });
    }
    list.sort((a, b) => b.p - a.p);
    const top = list.slice(0, 6);
    const sum = top.reduce((s, x) => s + x.p, 0);
    return top.map(x => ({ m: x.m, p: x.p / sum }));
  }
  return {
    choose(character, combat) {
      if (combat.enemyId !== enemyId || combat.exchange === 1) reset(combat.enemyId);
      const moves = expect(combat);
      const guess = moves.length ? moves[0].m.target || TARGETS[0] : TARGETS[0];
      const ranked = rankChoices(character, combat, allChoices(character, combat),
        moves.map(({ m, p }) => ({ cb: imagine(combat, m), p })), guess);
      if (rng.next() < best || ranked.length < 2) return ranked[0].ch;
      return ranked[1 + Math.floor(rng.next() * Math.min(2, ranked.length - 1))].ch;
    },
    observe(combatBefore, choice) {
      const k = seenMove(combatBefore, choice);
      seen[k] = (seen[k] || 0) + 1;
      seq.push(k);
      if (last) { after[last] = after[last] || {}; after[last][k] = (after[last][k] || 0) + 1; }
      last = k;
    },
    clash(combat) {
      const pc = combat.pendingClash;
      const met = pc.playerTarget;
      const out = (pc.tell && pc.tell.ruledOut) || [];
      const score = {}; for (const t of TARGETS) score[t] = t === met ? 2 : 0;
      for (const [t, n] of Object.entries(clashSeen[met] || {})) score[t] += n;
      const order = TARGETS.filter(t => !out.includes(t)).sort((a, b) => score[b] - score[a]);
      if (rng.next() < best) return order[0];
      return order[1 + Math.floor(rng.next() * Math.max(1, order.length - 1))] || order[0];
    },
    observeClash(pc) { clashSeen[pc.playerTarget] = clashSeen[pc.playerTarget] || {}; clashSeen[pc.playerTarget][pc.enemyDir] = (clashSeen[pc.playerTarget][pc.enemyDir] || 0) + 1; },
  };
}

// ---- The new player -----------------------------------------------------------------------------
export function newPlayer(rng) {
  let lastHitAt = null;
  return {
    choose(character, combat) {
      const acts = availableActions(character, combat);
      const low = ATTRS.some(k => character.attrs[k].stamina <= Math.max(1, Math.floor(attrTotal(character, k) / 4)));
      if (low && acts.page1[3].enabled && rng.next() < 0.6) return { action: 'item' };
      const r = rng.next();
      const attacks = acts.attacks.filter(a => a.enabled);
      const abilities = acts.abilities.filter(a => a.enabled);
      // Holding a weapon that can't reach: it notices the greyed-out attacks and tries an ability (Plan B switches back).
      if (!attacks.length && abilities.length && rng.next() < 0.7) return { action: 'ability', abilityId: abilities[0].id };
      if (r < 0.6 && (attacks.length || abilities.length)) {
        if (abilities.length && rng.next() < 0.2) return { action: 'ability', abilityId: abilities[Math.floor(rng.next() * abilities.length)].id };
        const main = attacks.find(a => a.main);
        const a = main && rng.next() < 0.5 ? main : attacks[Math.floor(rng.next() * attacks.length)];
        if (a) return { action: 'attack', attackId: a.id };
      }
      if (r < 0.87) return { action: 'block', target: lastHitAt && rng.next() < 0.5 ? lastHitAt : TARGETS[Math.floor(rng.next() * 4)] };
      return { action: 'pray' };
    },
    observe(combatBefore) {
      const v = combatBefore.current.step.variants.find(x => x.id === combatBefore.current.variantId);
      if (v.action === 'attack') lastHitAt = v.target;
    },
    clash(combat) { return rng.next() < 0.5 ? combat.pendingClash.playerTarget : TARGETS[Math.floor(rng.next() * 4)]; },
  };
}

// The expert and random players as player objects too.
export const expertPlayer = () => ({ choose: learnedPolicy, clash: learnedClash });
// The expert, but making its best choice only some of the time (for comparison).
export function sloppyExpert(rng, best = 0.75) {
  return {
    choose(character, combat) {
      const moves = possibleMoves(combat);
      const ranked = rankChoices(character, combat, allChoices(character, combat),
        moves.map(({ v, p }) => ({ cb: withVariant(combat, v.id), p })), guessClash(moves));
      if (rng.next() < best || ranked.length < 2) return ranked[0].ch;
      return ranked[1 + Math.floor(rng.next() * Math.min(2, ranked.length - 1))].ch;
    },
    clash: learnedClash,
  };
}
export const randomPlayer = (rng) => ({ choose: randomPolicy(rng), clash: randomClash(rng) });

// A Human Fighter after a typical trial: the cheapest Gorge option without the
// racial ability is Study the knots (WIS 6 against 7, one short): WIS drops to 0
// and they are Dazed (no tells).
export function afterTrial(character) {
  const c = JSON.parse(JSON.stringify(character));
  c.attrs.WIS.stamina = 0;
  c.traits.push({ id: 'dazed', kind: 'TNT', source: 'trial' });
  return c;
}
export function randomClash(rng) {
  return () => TARGETS[Math.floor(rng.next() * 4)];
}

export function simulateFight({ seed, policy, clashPick, player = null, enemyId = 'werewolf', character = practiceFighter(),
                               timeOfDay = 'Morning', maxExchanges = 200 }) {
  if (player) { policy = player.choose; clashPick = player.clash; }
  let c = character;
  let cb = startCombat(c, enemyId, { seed, timeOfDay });
  const stats = { exchanges: 0, noClue: 0, hidden: 0, twoClues: 0, enemyBlocks: 0, clanks: 0, clashes: 0, tells: 0, focusedExchanges: 0, prays: 0 };
  while (!cb.outcome && cb.exchange <= maxExchanges) {
    stats.exchanges++;
    if (cb.current.tells.length === 0) stats.noClue++;
    if (cb.current.hidden) stats.hidden++;
    if (cb.current.tells.length >= 2) stats.twoClues++;
    if (cb.current.tell) stats.tells++;
    if (c.traits.some(t => t.id === 'focused')) stats.focusedExchanges++;
    if (cb.current.step.variants.find(v => v.id === cb.current.variantId).action === 'block') stats.enemyBlocks++;
    const choice = policy(c, cb);
    if (choice.action === 'pray') stats.prays++;
    const before = cb;
    const r = submitAction(c, cb, choice);
    ({ character: c, combat: cb } = r);
    if (player && player.observe) player.observe(before, { ...choice, target: (r.combat.player.history.at(-1) || {}).target });
    if (r.lines.some(l => l.startsWith('Clank!'))) stats.clanks++;
    if (r.lines.some(l => l.startsWith('CLASH!'))) stats.clashes++;
    if (cb.pendingClash) {
      const pc = cb.pendingClash;
      ({ character: c, combat: cb } = submitClash(c, cb, clashPick(cb)));
      if (player && player.observeClash) player.observeClash(pc);
    }
  }
  const left = ATTRS.reduce((s, k) => s + c.attrs[k].stamina, 0);
  const start = ATTRS.reduce((s, k) => s + character.attrs[k].stamina, 0);
  Object.assign(stats, cb.stats);
  return { outcome: cb.outcome, exchanges: cb.exchange, staminaLeft: left, staminaStart: start,
           leftShare: left / start, character: c, combat: cb, stats };
}

export { createRng };
