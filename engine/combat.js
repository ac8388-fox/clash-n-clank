// The combat exchange loop (Build Spec → "Combat resolution").
//
// Each exchange runs eight steps:
//   1. Enemy commits     – beginExchange(): picks the pattern step, then the
//                          main action or a feint (seeded random)
//   2. Clues + Fortune   – beginExchange(): the shared first clue, then the
//                          variant's second clue if the player perceives it
//   3. Player chooses    – submitAction()
//   4. Order by speed    – submitAction()
//   5. Attacks meet      – submitAction()  (Clank, Clash, or no interaction;
//                          speeds equal or one step apart; only hard weapons Clank)
//   6. Clash event       – submitClash()   (only if step 5 started a Clash)
//   7. Resolve           – submitAction()  (Blocks, then misses, then damage)
//   8. Clean up          – cleanup(), then the next exchange begins
// After the fight, finishCombat() applies combat fatigue.
//
// Repetition: if the player uses the same action and target two exchanges
// running, the enemy's next step is a counter: a fast attack with Advantage,
// aimed where the player isn't guarding.
//
// Misses: an attack that isn't Blocked, Clanked, or Clashed can still miss.
// Always when attacking Off-Balance, out of reach, or at a target that
// shifted position first; otherwise by a small chance (rules.js → missChance).
// A successful lucky attempt never misses; Fortune's Favor saves one miss.
//
// Blocking: besides Block moves inside its pattern, an enemy may flinch after
// a hard hit (usually Blocking the spot just hit) or guard a spot the player
// keeps attacking. Hiding: some exchanges the enemy gives nothing away.
//
// Every function returns new objects and never changes what it was given.
// Randomness (feints, counter aim, Fortune openings, lucky dice, Pray) goes
// through the seeded generator stored in combat.rngState.

import { getEnemy, COUNTER } from '../data/enemies.js';
import { getAbility } from '../data/abilities.js';
import { getWeapon, WEAPONS, ARMOR, CONSUMABLES } from '../data/items.js';
import { ABILITIES } from '../data/abilities.js';
import { TRAITS, PRAY_TPTS } from '../data/traits.js';
import {
  ATTRS, attrTotals, luckOf, cluesShown, rollFortune, rollLuckyDice, luckyResult,
  computeHit, blockResult, applyDamage, damageCharacter, isDefeated, staminaOf,
  tellOdds, readingLead, luckClueBonus,
  useAttribute, actionAttribute, isPredictable, tickCooldowns, restoreStamina,
  lowestPool, applyCombatFatigue, wearItem, isBroken, missChance, inReach,
} from './rules.js';
import { createRng, pickDistinct } from './random.js';

export const TARGETS = ['head', 'left', 'right', 'legs'];
export const SPEED_RANK = { Drawn: 0, Fair: 1, Swift: 2 };
const SPEED_NAME = ['Drawn', 'Fair', 'Swift'];
const SLOT_FOR = { head: 'head', left: 'body', right: 'body', legs: 'legs' };
const ENEMY_PART = { head: 'its head', left: 'its left side', right: 'its right side', legs: 'its legs' };
const YOUR_PART = { head: 'your head', left: 'your left side', right: 'your right side', legs: 'your legs' };
const PLAYER_VERB = { sword: 'bites', dagger: 'cuts' };
const ENEMY_VERB = { claws: 'rake', bite: 'snaps at', greatsword: 'cleaves' };

const clone = (x) => JSON.parse(JSON.stringify(x));
const sum = (m) => ATTRS.reduce((s, k) => s + m[k], 0);

export function speedName(rank) {
  if (rank === null || rank === undefined) return '—';
  if (rank < 0) return 'Drawn−';
  if (rank > 2) return 'Swift+';
  return SPEED_NAME[rank];
}

// ---------------------------------------------------------------------------
// Pattern steps, feints, and the counter
// ---------------------------------------------------------------------------

export function loopSteps(enemy) {
  return enemy.pattern.filter(s => s.when !== 'below50');
}

// The counter step: a fast attack with Advantage. After repeated Blocks it
// aims anywhere except the target being guarded; otherwise anywhere.
export function counterStep(enemy, repeated) {
  const weapon = enemy.weapons.map(getWeapon).sort((a, b) => SPEED_RANK[b.speed] - SPEED_RANK[a.speed])[0];
  const targets = repeated.action === 'block' ? TARGETS.filter(t => t !== repeated.target) : TARGETS;
  return {
    id: 'counter',
    when: 'counter',
    first: 'counter',
    caption: COUNTER.caption,
    evenOdds: true,
    variants: targets.map(t => ({
      id: 'counter-' + t, second: 'counter-' + t,
      action: 'attack', weapon: weapon.id, target: t, clash: t, advantage: true,
    })),
  };
}

// A blocking step (kind 'flinch' or 'guard'): the main move Blocks `target`;
// the feints attack instead.
export function blockStep(enemy, kind, target) {
  const t = enemy[kind];
  return {
    id: kind,
    when: kind,
    first: t.first,
    caption: t.caption,
    variants: [
      { id: `${kind}-block-${target}`, second: 'block-' + target, action: 'block', target },
      ...t.feints.map((f, i) => ({ id: `${kind}-feint-${i}`, ...f })),
    ],
  };
}

// The spot the player keeps attacking: attacked in at least 2 of their last
// 3 exchanges (the most recent wins a tie), or null.
export function focusTarget(history) {
  const recent = history.slice(-3).filter(h => h.target && (h.action === 'attack' || h.action.startsWith('ability:')));
  const count = {};
  let best = null;
  for (const h of recent) {
    count[h.target] = (count[h.target] || 0) + 1;
    if (count[h.target] >= 2) best = h.target;
  }
  return best;
}

// The steps the enemy could take this exchange, with their chances. This is
// everything a player who knows the patterns could work out; the engine then
// picks one with the seeded random function.
export function stepOptions(combat) {
  const enemy = getEnemy(combat.enemyId);
  const E = combat.enemy;
  const h = combat.player.history;
  const loop = loopSteps(enemy);

  const below = enemy.pattern.find(s => s.when === 'below50');
  if (below && !E.enrageUsed && sum(E.stamina) < sum(E.totals) / 2) return [{ step: below, p: 1 }];
  if (h.length >= 2 && isPredictable(h)) return [{ step: counterStep(enemy, h[h.length - 1]), p: 1 }];

  let base = null;
  if (E.wasBlocked) {
    const jump = loop.find(s => s.when === 'afterBlocked');
    if (jump && jump.id !== E.lastStepId) base = jump;
  }
  if (!base) base = loop[E.loopIndex];
  let options = [{ step: base, p: 1 }];

  // After a hard hit it may flinch (never twice running).
  if (enemy.flinch && E.lastHit && E.lastHit.damage >= enemy.hardHit && E.lastStepId !== 'flinch') {
    const f = enemy.flinchChance;
    options = [{ step: blockStep(enemy, 'flinch', E.lastHit.target), p: f }, { step: base, p: 1 - f }];
  }

  // If the player keeps attacking one spot, it may guard that spot instead.
  const focus = focusTarget(h);
  if (focus && enemy.guard) {
    const g = enemy.guardChance;
    const guard = blockStep(enemy, 'guard', focus);
    const out = [];
    let guardP = 0;
    for (const o of options) {
      if (o.step.when === 'flinch') { out.push(o); continue; }
      guardP += o.p * g;
      out.push({ step: o.step, p: o.p * (1 - g) });
    }
    options = [{ step: guard, p: guardP }, ...out];
  }
  return options.filter(o => o.p > 0);
}

// The step the enemy is on this exchange.
export function stepFor(combat) {
  return combat.current.step;
}

// The move the enemy committed to this exchange.
export function moveFor(combat) {
  return stepFor(combat).variants.find(v => v.id === combat.current.variantId);
}

// How likely each variant of a step is: the main move, then the feints.
export function variantOdds(enemy, step) {
  const n = step.variants.length;
  if (n === 1) return [1];
  if (step.evenOdds) return step.variants.map(() => 1 / n);
  const f = enemy.feintChance;
  return step.variants.map((_, i) => (i === 0 ? 1 - f : f / (n - 1)));
}

// The words for a clue.
export function tellText(enemy, id) {
  if (id === 'counter') return COUNTER.first;
  if (id.startsWith('counter-')) return COUNTER.second[id.slice(8)];
  if (id.startsWith('block-')) return enemy.blockTells[id.slice(6)];
  return enemy.tellText[id];
}

// Both clues of a variant, in order: the shared first clue, then its own.
export function variantTells(enemy, step, variant) {
  return [tellText(enemy, step.first), tellText(enemy, variant.second)];
}

// For tests and simulations: the same combat with the enemy committed to a
// particular variant of one of this exchange's possible steps.
export function withVariant(combat, variantId) {
  const cb = clone(combat);
  const opt = cb.current.options.find(o => o.step.variants.some(v => v.id === variantId));
  if (!opt) throw new Error('Not a possible move this exchange: ' + variantId);
  cb.current.step = opt.step;
  cb.current.stepId = opt.step.id;
  cb.current.variantId = variantId;
  return cb;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function hasCondition(side, id) {
  return side.conditions.some(c => c.id === id);
}

// One-exchange conditions (Off-Balance, Hindered) gained during exchange n
// apply through exchange n + 1 and are cleared at the end of it.
function addCondition(side, id, exchange) {
  if (!hasCondition(side, id)) side.conditions.push({ id, until: exchange + 1 });
}

function hasTrait(character, id) {
  return character.traits.some(t => t.id === id);
}

function removeTrait(character, id) {
  const i = character.traits.findIndex(t => t.id === id);
  if (i >= 0) character.traits.splice(i, 1);
}

// The player gains a TNT condition, unless Steeled stops it.
function playerGainsTNT(character, combat, id, lines) {
  if (hasTrait(character, 'steeled')) {
    removeTrait(character, 'steeled');
    lines.push(`Steeled, you shrug off being ${TRAITS[id].name}.`);
    return;
  }
  addCondition(combat.player, id, combat.exchange);
}

function netModifier(adv, dis) {
  if (adv && !dis) return 'advantage';
  if (dis && !adv) return 'disadvantage';
  return null;
}

function damageText(applied) {
  if (applied.length === 0) return 'No effect.';
  return applied.map(a => `−${a.amount} ${a.attr}`).join(', ') + '.';
}

// The weapon in hand. If it is broken, switch to the next usable ready weapon.
function currentWeapon(character, player) {
  const ready = character.gear.ready;
  for (let i = 0; i < ready.length; i++) {
    const idx = (player.weaponIndex + i) % ready.length;
    const id = ready[idx];
    if (id && !isBroken(character.durability, id)) {
      player.weaponIndex = idx;
      return getWeapon(id);
    }
  }
  return null;
}

function nextWeaponIndex(character, player) {
  const ready = character.gear.ready;
  for (let i = 1; i <= ready.length; i++) {
    const idx = (player.weaponIndex + i) % ready.length;
    const id = ready[idx];
    if (id && !isBroken(character.durability, id)) return idx;
  }
  return player.weaponIndex;
}

function playerArmorWeight(character, target) {
  const id = character.gear.armor[SLOT_FOR[target]];
  if (!id || isBroken(character.durability, id)) return null;
  return ARMOR[id].weight;
}

function damageMultiplier(enemy, attr) {
  return (enemy.weak && enemy.weak[attr]) || (enemy.resist && enemy.resist[attr]) || 1;
}

function draughtCount(character) {
  const p = character.pack.find(x => x.itemId === 'herbalDraught');
  return p ? p.qty : 0;
}

// Where two attacks point, from the player's perspective: opposite sides
// (Left against Right) would Clank; the same label (Left against Left, Head
// against Head, Legs against Legs) Clashes; anything else doesn't interact.
export function attacksMeet(playerTarget, enemyTarget) {
  if (playerTarget === enemyTarget) return 'clash';
  const sides = new Set([playerTarget, enemyTarget]);
  if (sides.has('left') && sides.has('right')) return 'clank';
  return 'none';
}

// Only hard weapons Clank (metal meeting metal: blades, hafts, gauntlets,
// shields). Natural weapons (claws, bites, fists, hand wraps) never do.
export function canClank(weapon) {
  return !!weapon && !weapon.natural;
}

// Whether two attacks actually meet, and how. Attacks meet when their speeds
// are equal or one step apart (Swift and Fair, Fair and Drawn); Swift and
// Drawn never meet. A Clank needs two hard weapons; otherwise it is no
// interaction. Clashes work with any weapons.
export function attacksInteract({ playerTarget, enemyTarget, playerSpeed, enemySpeed, playerWeapon, enemyWeapon }) {
  if (Math.abs(playerSpeed - enemySpeed) > 1) return 'none';
  const meet = attacksMeet(playerTarget, enemyTarget);
  if (meet === 'clank' && !(canClank(playerWeapon) && canClank(enemyWeapon))) return 'none';
  return meet;
}

// ---------------------------------------------------------------------------
// Reading the enemy (tells)
// ---------------------------------------------------------------------------

// Reading bonuses from everything the character has: traits (TPT, TNT, CPT,
// CNT, PPT, PNT), learned abilities, and equipped items. Each can carry
// `read` (points on the reading score) and `clues` (a flat change in clues).
export function readingModifiers(character) {
  let read = 0, clues = 0;
  const add = (src) => { if (src) { read += src.read || 0; clues += src.clues || 0; } };
  for (const t of character.traits || []) add(TRAITS[t.id]);
  for (const id of character.abilities || []) add(ABILITIES[id]);
  const g = character.gear || {};
  for (const id of [...(g.ready || []), ...Object.values(g.armor || {}), g.shield].filter(Boolean)) add(WEAPONS[id] || ARMOR[id]);
  return { read, clues };
}

// This exchange's reading: score = WIS + FAI lead + bonuses (an Enraged enemy
// is harder to read: −2), and the odds of none / one / both clues.
export const ENRAGED_READ = -2;
export function readingFor(character, combat) {
  const mods = readingModifiers(character);
  const lead = readingLead(character, combat.enemy.stamina);
  const score = lead + mods.read + (combat.enemy.enraged ? ENRAGED_READ : 0);
  return { lead, score, clues: mods.clues, odds: tellOdds(score) };
}

// A plain word for how well the player is reading the enemy right now:
// expected clues (after Luck, traits, and Night) of 1.25+ is good, under 0.8 poor.
export function readingLabel(character, combat) {
  const rd = readingFor(character, combat);
  const bonus = luckClueBonus(luckOf(character)) + rd.clues;
  const night = combat.timeOfDay === 'Night' ? 1 : 0;
  const count = (t) => Math.max(0, Math.min(2, t + bonus) - night);
  const expected = rd.odds.none * count(0) + rd.odds.one * count(1) + rd.odds.both * count(2);
  return { label: expected >= 1.25 ? 'good' : expected >= 0.8 ? 'fair' : 'poor', expected, odds: rd.odds };
}

// ---------------------------------------------------------------------------
// Start a fight
// ---------------------------------------------------------------------------

export function startCombat(character, enemyId, { seed = 1, timeOfDay = 'Morning' } = {}) {
  const enemy = getEnemy(enemyId);
  const combat = {
    enemyId,
    exchange: 0,
    rngState: seed >>> 0,
    timeOfDay,
    player: {
      weaponIndex: 0,
      conditions: [],
      advantageNext: false,      // won a Clash: Advantage on the next attack
      speedPenaltyNext: false,   // Plan B: next action has a Speed disadvantage
      history: [],               // [{ action, target }] for repetition
      usage: { STR: 0, AGI: 0, WIS: 0, FAI: 0 },  // for combat fatigue
    },
    enemy: {
      stamina: { ...enemy.attrs },
      totals: { ...enemy.attrs },
      conditions: [],
      loopIndex: 0,
      lastStepId: null,
      wasBlocked: false,
      lastHit: null,             // { damage, target } from the player this exchange
      enrageUsed: false,
      enraged: false,
      advantageNext: false,
    },
    current: null,
    pendingClash: null,
    stats: { playerAttacks: 0, playerMisses: 0, enemyAttacks: 0, enemyMisses: 0, chanceMisses: 0, situationalMisses: 0 },
    log: [`${enemy.name}: “${enemy.line}”`],
    outcome: null,
  };
  return beginExchange(character, combat);
}

// Steps 1 and 2: the enemy commits, the player gets clues, Fortune is rolled.
export function beginExchange(character, combatIn) {
  const combat = clone(combatIn);
  const c = clone(character);
  const enemy = getEnemy(combat.enemyId);
  const E = combat.enemy;
  const loop = loopSteps(enemy);
  const rng = createRng(combat.rngState);
  combat.exchange += 1;

  // 1. Enemy commits: which step (see stepOptions), then main move or feint.
  const options = stepOptions(combat);
  let r = rng.next(), si = 0;
  while (si < options.length - 1 && r >= options[si].p) { r -= options[si].p; si++; }
  const step = options[si].step;
  if (step.when === 'below50') E.enrageUsed = true;
  const li = loop.findIndex(s => s.id === step.id);
  if (li >= 0) E.loopIndex = li;
  E.wasBlocked = false;
  E.lastHit = null;

  const odds = variantOdds(enemy, step);
  r = rng.next();
  let pick = 0;
  while (pick < odds.length - 1 && r >= odds[pick]) { r -= odds[pick]; pick++; }
  const variant = step.variants[pick];

  // 2. Clues: roll how much the player reads (none, one, or both clues) from
  //    the WIS + FAI comparison, then apply Luck, traits, and Night.
  const luck = luckOf(c);
  const reading = readingFor(c, combat);
  const r2 = rng.next();
  let tier = r2 < reading.odds.none ? 0 : r2 < reading.odds.none + reading.odds.both ? 2 : 1;
  if (step.when === 'below50') tier = Math.max(tier, 1);      // the howl is never hidden
  const all = variantTells(enemy, step, variant);
  const beforeNight = Math.min(all.length, Math.max(0, tier + luckClueBonus(luck) + reading.clues));
  const hidden = beforeNight === 0 && tier === 0;            // the enemy gives nothing away
  const hiddenCaption = hidden ? enemy.hiddenCaptions[Math.floor(rng.next() * enemy.hiddenCaptions.length)] : null;
  const clueCount = Math.max(0, beforeNight - (combat.timeOfDay === 'Night' ? 1 : 0));

  const fortuneOpen = rollFortune(luck, rng);
  const hint = fortuneOpen ? enemy.fortuneHints[Math.floor(rng.next() * enemy.fortuneHints.length)] : null;

  combat.current = {
    stepId: step.id,
    step,
    variantId: variant.id,
    options,
    hidden,
    caption: hidden ? hiddenCaption : step.caption,
    tells: all.slice(0, clueCount),
    tellCount: all.length,
    usedFocus: hasTrait(c, 'focused'),
    fortune: { open: fortuneOpen, hint },
  };
  combat.rngState = rng.getState();
  return combat;
}

// What the player can choose right now (for the carousel).
export function availableActions(character, combat) {
  const P = clone(combat.player);
  const weapon = currentWeapon(character, P);
  const page1 = [
    { id: 'pray',   name: 'Pray',   enabled: true },
    { id: 'attack', name: 'Attack', enabled: !!weapon, weapon: weapon && weapon.name },
    { id: 'block',  name: 'Block',  enabled: true },
    { id: 'item',   name: 'Item',   enabled: draughtCount(character) > 0, detail: `Herbal draught ×${draughtCount(character)}` },
  ];
  const abilities = character.abilities.filter(id => !getAbility(id).passive).map(id => {
    const a = getAbility(id);
    const cd = character.cooldowns[id] || 0;
    return { id, name: a.name, enabled: cd === 0 && !!weapon, cooldownLeft: cd, speed: a.speed };
  });
  return { page1, abilities, weapon: weapon && weapon.name };
}

// ---------------------------------------------------------------------------
// Steps 3 to 7
// ---------------------------------------------------------------------------

// choice: { action: 'pray'|'attack'|'block'|'item'|'ability', abilityId, target, lucky }
// Returns { character, combat, lines }. If a Clash starts, combat.pendingClash
// is set and the exchange pauses until submitClash().
export function submitAction(characterIn, combatIn, choice) {
  if (combatIn.outcome) throw new Error('The fight is over.');
  if (combatIn.pendingClash) throw new Error('A Clash is waiting for a direction.');

  let c = clone(characterIn);
  const cb = clone(combatIn);
  const enemy = getEnemy(cb.enemyId);
  const step = stepFor(cb);
  const mv = moveFor(cb);
  const P = cb.player;
  const E = cb.enemy;
  const k = cb.exchange;
  const rng = createRng(cb.rngState);
  const lines = [];

  // --- 3. Player chooses -----------------------------------------------------
  const action = choice.action;
  let ability = null;
  if (action === 'ability') {
    ability = getAbility(choice.abilityId);
    if (!c.abilities.includes(ability.id)) throw new Error('You have not learned ' + ability.name);
    if (c.cooldowns[ability.id]) throw new Error(ability.name + ' is cooling down');
  } else if (!['pray', 'attack', 'block', 'item'].includes(action)) {
    throw new Error('Unknown action: ' + action);
  }
  const isAttack = action === 'attack' || action === 'ability';
  const targeted = isAttack || action === 'block';
  if (targeted && !TARGETS.includes(choice.target)) throw new Error('Choose Head, Left, Right, or Legs');
  if (action === 'item' && draughtCount(c) === 0) throw new Error('No items left');

  const weapon = currentWeapon(c, P);
  if (isAttack && !weapon) throw new Error('No usable weapon');

  // Using an attribute: counts toward fatigue; at 0 stamina it wears Natural down.
  const attr = actionAttribute(action, { weapon, ability });
  c = useAttribute(c, attr);
  P.usage[attr] += 1;

  // Focused is used up by the exchange it helped.
  if (cb.current.usedFocus) removeTrait(c, 'focused');

  // Lucky attempt: only when a Fortune opening is showing (not on a Block).
  let lucky = null;
  if (choice.lucky && cb.current.fortune.open && action !== 'block') {
    const rolls = rollLuckyDice(luckOf(c), rng);
    lucky = { rolls, ...luckyResult(rolls, c.luckyNumber) };
    cb.current.fortune.open = false;
    const shown = rolls.map(r => `d${r.sides}: ${r.value}`).join(', ');
    lines.push(lucky.success
      ? `Lucky! (${shown}) Critical ×${lucky.multiplier}.`
      : `No luck. (${shown})`);
  }

  // --- 4. Order by speed -----------------------------------------------------
  let pSpeed = null;
  if (isAttack) pSpeed = SPEED_RANK[action === 'ability' ? ability.speed : weapon.speed];
  else if (action === 'pray') pSpeed = SPEED_RANK.Fair;
  else if (action === 'item') pSpeed = SPEED_RANK[CONSUMABLES.herbalDraught.speed];
  if (pSpeed !== null) {
    if (hasCondition(P, 'hindered')) pSpeed -= 1;
    if (P.speedPenaltyNext) pSpeed -= 1;
  }
  P.speedPenaltyNext = false;

  let eSpeed = null;
  if (mv.action === 'attack') eSpeed = SPEED_RANK[getWeapon(mv.weapon).speed];
  else if (mv.action === 'enrage') eSpeed = SPEED_RANK.Fair;
  if (eSpeed !== null && hasCondition(E, 'hindered')) eSpeed -= 1;

  const bothTimed = pSpeed !== null && eSpeed !== null;
  const playerSlower = bothTimed && pSpeed < eSpeed;
  const enemySlower = bothTimed && eSpeed < pSpeed;

  let playerAdv = false;
  if (isAttack) {
    playerAdv = P.advantageNext || hasTrait(c, 'emboldened');
    P.advantageNext = false;
    removeTrait(c, 'emboldened');
  }
  const playerAttackMod = netModifier(playerAdv, playerSlower);
  const playerBlockMod = netModifier(false, hasCondition(P, 'offBalance'));
  let enemyAdv = false;
  if (mv.action === 'attack') { enemyAdv = E.advantageNext || !!mv.advantage; E.advantageNext = false; }
  const enemyAttackMod = netModifier(enemyAdv, enemySlower);
  const enemyBlockMod = netModifier(false, hasCondition(E, 'offBalance'));

  P.history.push({ action: action === 'ability' ? 'ability:' + ability.id : action, target: targeted ? choice.target : null });

  const ctx = { c, cb, enemy, step, mv, ability, lines, rng, lucky };

  // --- 5. Attacks meet (equal speed, or one step apart) -----------------------
  if (isAttack && mv.action === 'attack') {
    const meet = attacksInteract({
      playerTarget: choice.target, enemyTarget: mv.target, playerSpeed: pSpeed, enemySpeed: eSpeed,
      playerWeapon: weapon, enemyWeapon: getWeapon(mv.weapon),
    });
    if (meet === 'clank') {
      lines.push(`Clank! Your ${weapon.name.toLowerCase()} meets its ${mv.weapon}. You are both Off-Balance.`);
      c.durability = wearItem(c.durability, c.gear.ready[P.weaponIndex]);
      playerGainsTNT(c, cb, 'offBalance', lines);
      addCondition(E, 'offBalance', k);
      if (ability) afterAbility(ctx);
      return cleanup(ctx);
    }
    if (meet === 'clash') {
      lines.push('CLASH! Your attacks meet. Read its next move and pick a direction.');
      cb.pendingClash = {
        enemyDir: mv.clash || mv.target,
        caption: step.caption,
        tells: cb.current.tells,
        abilityId: ability ? ability.id : null,
        lucky,
      };
      cb.rngState = rng.getState();
      cb.log.push(...lines);
      return { character: c, combat: cb, lines };
    }
  }

  // --- 7. Resolve, in speed order ------------------------------------------
  const actors = [];
  if (action !== 'block') actors.push({ side: 'player', speed: pSpeed });
  if (mv.action === 'attack' || mv.action === 'enrage') actors.push({ side: 'enemy', speed: eSpeed });
  actors.sort((a, b) => b.speed - a.speed);

  const canceled = new Set();
  let i = 0;
  while (i < actors.length) {
    const group = actors.filter(a => a.speed === actors[i].speed);
    const enemyDown = isDefeated(E.stamina);
    const playerDown = isDefeated(staminaOf(ctx.c));
    for (const a of group) {
      if (canceled.has(a.side)) continue;
      if (a.side === 'player' && !playerDown) {
        resolvePlayer(ctx, { action, weapon, ability, target: choice.target, pSpeed, eSpeed,
                             playerAttackMod, enemyBlockMod, enemyOffensive: mv.action === 'attack' });
      }
      if (a.side === 'enemy' && !enemyDown && mv.action === 'enrage') {
        E.enraged = true;
        lines.push('It howls at the moon. It is Enraged!');
      } else if (a.side === 'enemy' && !enemyDown) {
        const staggered = resolveEnemy(ctx, { weaponId: mv.weapon, target: mv.target, enemyAttackMod,
                                              playerBlocking: action === 'block' ? choice.target : null, playerBlockMod });
        if (staggered) for (const b of actors.slice(i + group.length)) if (b.side === 'player') canceled.add('player');
      }
    }
    i += group.length;
  }

  // Lucky attempt with no lucky number: a free Basic Attack and Off-Balance.
  if (lucky && !lucky.success && !isDefeated(E.stamina) && !isDefeated(staminaOf(ctx.c))) {
    lines.push('It seizes the opening!');
    resolveEnemy(ctx, {
      weaponId: mv.action === 'attack' ? mv.weapon : enemy.weapons[0],
      target: mv.target || 'left',
      enemyAttackMod: null,
      playerBlocking: action === 'block' ? choice.target : null,
      playerBlockMod,
      free: true,     // the opening it was handed: it can't miss
    });
    playerGainsTNT(ctx.c, cb, 'offBalance', lines);
  }

  return cleanup(ctx);
}

function resolvePlayer(ctx, o) {
  const { cb, enemy, mv, lines, lucky } = ctx;
  const E = cb.enemy;
  const mult = lucky && lucky.success ? lucky.multiplier : 1;

  if (o.action === 'attack' || o.action === 'ability') {
    const what = o.ability ? `${o.ability.name} (${o.weapon.name.toLowerCase()})` : `your ${o.weapon.name.toLowerCase()}`;
    let dmg = computeHit({
      weapon: o.weapon, totals: attrTotals(ctx.c), modifier: o.playerAttackMod,
      armorWeight: enemy.armor[SLOT_FOR[o.target]], resistWeak: damageMultiplier(enemy, o.weapon.drains),
      abilityMultiplier: o.ability && o.ability.multiplier ? o.ability.multiplier : 1, luckyMultiplier: mult,
    });
    let blocked = false;
    if (mv.action === 'block' && mv.target === o.target) {
      const br = blockResult(dmg, o.enemyBlockMod);
      dmg = br.taken;
      blocked = true;
      if (dmg === 0) lines.push(`It blocks ${what}.`);
    }
    if (dmg > 0 && !blocked) {
      cb.stats.playerAttacks += 1;
      const miss = playerMisses(ctx, o);
      if (miss) {
        cb.stats.playerMisses += 1;
        lines.push(miss);
        dmg = 0;
      }
    }
    if (dmg > 0) {
      const r = applyDamage(E.stamina, o.weapon.drains, dmg);
      E.stamina = r.stamina;
      const landed = r.applied.reduce((n, a) => n + a.amount, 0);
      E.lastHit = { damage: ((E.lastHit && E.lastHit.damage) || 0) + landed, target: o.target };
      const verb = PLAYER_VERB[o.weapon.id] || 'hits';
      const subject = o.ability ? `${o.ability.name}: your ${o.weapon.name.toLowerCase()}` : `Your ${o.weapon.name.toLowerCase()}`;
      lines.push(`${subject} ${verb} ${ENEMY_PART[o.target]}. ${damageText(r.applied)}`);
    }
    if (o.ability) afterAbility(ctx);
    return;
  }

  if (o.action === 'pray') {
    const owned = new Set(ctx.c.traits.map(t => t.id));
    const pool = PRAY_TPTS.filter(id => !owned.has(id));
    const count = Math.min(5, (o.enemyOffensive ? 1 : 2) * mult);
    const got = pickDistinct(ctx.rng, pool, count);
    for (const id of got) ctx.c.traits.push({ id, kind: 'TPT', source: 'pray', expires: 'used' });
    lines.push(got.length
      ? `You pray. You feel ${got.map(id => TRAITS[id].name).join(' and ')}.`
      : 'You pray, already blessed in every way you can be.');
    return;
  }

  if (o.action === 'item') {
    const item = CONSUMABLES.herbalDraught;
    const pool = lowestPool(ctx.c);
    const before = ctx.c.attrs[pool].stamina;
    ctx.c = restoreStamina(ctx.c, pool, item.effect.amount * mult);
    const p = ctx.c.pack.find(x => x.itemId === 'herbalDraught');
    p.qty -= 1;
    if (p.qty <= 0) ctx.c.pack = ctx.c.pack.filter(x => x !== p);
    lines.push(`You drink a herbal draught. +${ctx.c.attrs[pool].stamina - before} ${pool}.`);
  }
}

// Plan B: after the Basic Attack, switch weapons; the next action is slower.
function afterAbility(ctx) {
  const { c, cb, ability, lines } = ctx;
  if (ability.effect === 'planB') {
    const P = cb.player;
    const next = nextWeaponIndex(c, P);
    if (next !== P.weaponIndex) {
      P.weaponIndex = next;
      lines.push(`You switch to your ${getWeapon(c.gear.ready[next]).name.toLowerCase()}.`);
    }
    P.speedPenaltyNext = true;
  }
}

// Does the player's attack miss? Returns the result line if it does.
function playerMisses(ctx, o) {
  const { cb, enemy, mv, lucky } = ctx;
  if (lucky && lucky.success) return null;                 // a lucky hit never misses
  const w = o.weapon.name.toLowerCase();
  let line = null;
  if (hasCondition(cb.player, 'offBalance')) line = `Off-Balance, your ${w} swings wide.`;
  else if (!inReach(o.weapon, enemy.range)) line = `Your ${w} can't reach it at ${enemy.range} range.`;
  else if (mv.shifts && o.eSpeed !== null && o.eSpeed >= o.pSpeed) line = `It sidesteps; your ${w} cuts empty air.`;
  if (line) cb.stats.situationalMisses += 1;
  else {
    const p = missChance({
      attackerAgi: ctx.c.attrs.AGI.stamina, attackerLuck: luckOf(ctx.c),
      defenderAgi: cb.enemy.stamina.AGI, defenderLuck: enemy.luck || 0,
      enraged: hasTrait(ctx.c, 'enraged'),
    });
    if (ctx.rng.next() < p) { line = `Your ${w} swings wide.`; cb.stats.chanceMisses += 1; }
  }
  if (line && ctx.c.abilities.includes('fortunesFavor') && !ctx.c.favorUsed) {
    ctx.c.favorUsed = true;
    ctx.lines.push(`Fortune's Favor! ${line.replace(/\.$/, '')}, but luck guides it home.`);
    return null;
  }
  return line;
}

// Does the enemy's attack miss? Returns the result line if it does.
function enemyMisses(ctx, weapon) {
  const { cb, enemy } = ctx;
  const w = weapon.name.toLowerCase();
  if (hasCondition(cb.enemy, 'offBalance')) { cb.stats.situationalMisses += 1; return `Off-Balance, its ${w} miss${w.endsWith('s') ? '' : 'es'} you.`; }
  if (cb.player.shifted) { cb.stats.situationalMisses += 1; return `You slip aside; its ${w} find${w.endsWith('s') ? '' : 's'} nothing.`; }
  const p = missChance({
    attackerAgi: cb.enemy.stamina.AGI, attackerLuck: enemy.luck || 0,
    defenderAgi: ctx.c.attrs.AGI.stamina, defenderLuck: luckOf(ctx.c),
    enraged: cb.enemy.enraged,
  });
  if (ctx.rng.next() < p) { cb.stats.chanceMisses += 1; return `Its ${w} swing${w.endsWith('s') ? '' : 's'} wide.`; }
  return null;
}

// Returns true if the hit carried a Stagger.
function resolveEnemy(ctx, o) {
  const { cb, enemy, lines } = ctx;
  const E = cb.enemy;
  const weapon = getWeapon(o.weaponId);

  let dmg = computeHit({
    weapon, totals: E.totals, modifier: o.enemyAttackMod,
    armorWeight: playerArmorWeight(ctx.c, o.target),
  });
  dmg += enemy.damageBonus || 0;
  if (E.enraged) dmg += 1;

  const verb = ENEMY_VERB[weapon.id] || 'hits';
  if (o.playerBlocking === o.target) {
    const br = blockResult(dmg, o.playerBlockMod);
    E.wasBlocked = true;
    const wid = ctx.c.gear.ready[cb.player.weaponIndex];
    if (wid) ctx.c.durability = wearItem(ctx.c.durability, wid);
    if (br.taken === 0) {
      lines.push(`You block its ${weapon.name.toLowerCase()} at ${YOUR_PART[o.target]}.`);
      return false;
    }
    dmg = br.taken;
    lines.push(`Off-Balance, your Block only softens its ${weapon.name.toLowerCase()}.`);
  }

  cb.stats.enemyAttacks += 1;
  const miss = o.free ? null : enemyMisses(ctx, weapon);
  if (miss) {
    cb.stats.enemyMisses += 1;
    lines.push(miss);
    return false;
  }

  if (hasTrait(ctx.c, 'blessed')) {
    dmg = Math.max(1, Math.floor(dmg * 0.75));
    removeTrait(ctx.c, 'blessed');
  }
  const r = damageCharacter(ctx.c, weapon.drains, dmg);
  ctx.c = r.character;
  const armorId = ctx.c.gear.armor[SLOT_FOR[o.target]];
  if (armorId) ctx.c.durability = wearItem(ctx.c.durability, armorId);
  lines.push(`Its ${weapon.name.toLowerCase()} ${verb} ${YOUR_PART[o.target]}. ${damageText(r.applied)}`);
  return (weapon.traits || []).includes('stagger');
}

// ---------------------------------------------------------------------------
// Step 6: the Clash event
// ---------------------------------------------------------------------------

export function submitClash(characterIn, combatIn, direction) {
  if (!combatIn.pendingClash) throw new Error('There is no Clash right now.');
  if (!TARGETS.includes(direction)) throw new Error('Choose Head, Left, Right, or Legs');
  const c = clone(characterIn);
  const cb = clone(combatIn);
  const enemy = getEnemy(cb.enemyId);
  const pc = cb.pendingClash;
  const lines = [];
  const ctx = { c, cb, enemy, step: stepFor(cb), mv: moveFor(cb),
                ability: pc.abilityId ? getAbility(pc.abilityId) : null,
                lines, rng: createRng(cb.rngState), lucky: pc.lucky };
  cb.pendingClash = null;

  if (direction === pc.enemyDir) {
    cb.player.advantageNext = true;
    addCondition(cb.enemy, 'offBalance', cb.exchange);
    lines.push('You read it and win the Clash! Advantage on your next attack; it is Off-Balance.');
  } else {
    cb.enemy.advantageNext = true;
    lines.push(`It wins the Clash (it went ${pc.enemyDir}). It has Advantage on its next attack.`);
    playerGainsTNT(ctx.c, cb, 'offBalance', lines);
  }
  if (pc.lucky && !pc.lucky.success) playerGainsTNT(ctx.c, cb, 'offBalance', lines);
  if (ctx.ability) afterAbility(ctx);
  return cleanup(ctx);
}

// ---------------------------------------------------------------------------
// Step 8: clean up, then begin the next exchange
// ---------------------------------------------------------------------------

function cleanup(ctx) {
  const { cb, enemy, step, ability, lines, rng } = ctx;
  const c = ctx.c;
  const E = cb.enemy, P = cb.player;
  const k = cb.exchange;

  c.cooldowns = tickCooldowns(c.cooldowns);
  if (ability) c.cooldowns[ability.id] = ability.cooldown;

  P.conditions = P.conditions.filter(x => x.until > k);
  E.conditions = E.conditions.filter(x => x.until > k);

  // Pattern steps advance the loop; a counter or the howl leaves it where it was.
  const loop = loopSteps(enemy);
  const idx = loop.findIndex(s => s.id === step.id);
  if (idx >= 0) E.loopIndex = (idx + 1) % loop.length;
  E.lastStepId = step.id;

  if (isDefeated(E.stamina)) {
    cb.outcome = 'victory';
    lines.push(`The ${enemy.name.toLowerCase()} falls.`);
  } else if (isDefeated(staminaOf(c))) {
    cb.outcome = 'defeat';
    lines.push('You collapse. Your strength is spent.');
  }

  cb.rngState = rng.getState();
  cb.log.push(...lines);
  const next = cb.outcome ? cb : beginExchange(c, cb);
  return { character: c, combat: next, lines };
}

// ---------------------------------------------------------------------------
// After the fight
// ---------------------------------------------------------------------------

// Combat fatigue: each attribute drops by half the actions that used it, rounded up.
export function finishCombat(character, combat) {
  const before = staminaOf(character);
  const after = applyCombatFatigue(character, combat.player.usage);
  const drops = {};
  for (const k of ATTRS) drops[k] = before[k] - after.attrs[k].stamina;
  return { character: after, fatigue: drops, outcome: combat.outcome };
}
