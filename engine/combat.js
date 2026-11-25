// The combat exchange loop (Build Spec → "Combat resolution").
//
// Each exchange runs eight steps:
//   1. Enemy commits     – beginExchange()
//   2. Clues + Fortune   – beginExchange()
//   3. Player chooses    – submitAction()
//   4. Order by speed    – submitAction()
//   5. Attacks meet      – submitAction()  (Clank, Clash, or no interaction)
//   6. Clash event       – submitClash()   (only if step 5 started a Clash)
//   7. Resolve           – submitAction()
//   8. Clean up          – cleanup(), then the next exchange begins
// After the fight, finishCombat() applies combat fatigue.
//
// Like the rules engine, every function returns new objects and never
// changes what it was given. Randomness (Fortune openings, lucky dice, Pray)
// goes through the seeded generator stored in combat.rngState.

import { getEnemy } from '../data/enemies.js';
import { getAbility } from '../data/abilities.js';
import { getWeapon, ARMOR, CONSUMABLES } from '../data/items.js';
import { TRAITS, PRAY_TPTS } from '../data/traits.js';
import {
  ATTRS, attrTotals, luckOf, cluesShown, rollFortune, rollLuckyDice, luckyResult,
  computeHit, blockResult, applyDamage, damageCharacter, isDefeated, staminaOf,
  useAttribute, actionAttribute, isPredictable, tickCooldowns, restoreStamina,
  lowestPool, applyCombatFatigue, wearItem, isBroken,
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

export function loopSteps(enemy) {
  return enemy.pattern.filter(s => s.when !== 'below50');
}

function stepById(enemy, id) {
  return enemy.pattern.find(s => s.id === id);
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

// What the attack meeting looks like at equal speed (player's perspective):
// opposite sides Clank; the same label Clashes; anything else doesn't interact.
export function attacksMeet(playerTarget, enemyTarget) {
  if (playerTarget === enemyTarget) return 'clash';
  const sides = new Set([playerTarget, enemyTarget]);
  if (sides.has('left') && sides.has('right')) return 'clank';
  return 'none';
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
      history: [],               // [{ action, target }] for Predictable
      usage: { STR: 0, AGI: 0, WIS: 0, FAI: 0 },  // for combat fatigue
    },
    enemy: {
      stamina: { ...enemy.attrs },
      totals: { ...enemy.attrs },
      conditions: [],
      loopIndex: 0,
      lastStepId: null,
      wasBlocked: false,
      enrageUsed: false,
      enraged: false,
      advantageNext: false,
    },
    current: null,
    pendingClash: null,
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

  // 1. Enemy commits: a `when` condition can jump to its step.
  let step = null;
  const below = enemy.pattern.find(s => s.when === 'below50');
  if (below && !E.enrageUsed && sum(E.stamina) < sum(E.totals) / 2) {
    step = below;
    E.enrageUsed = true;
  } else if (E.wasBlocked) {
    const jump = loop.find(s => s.when === 'afterBlocked');
    if (jump && jump.id !== E.lastStepId) {
      step = jump;
      E.loopIndex = loop.indexOf(jump);
    }
  }
  if (!step) step = loop[E.loopIndex];
  E.wasBlocked = false;

  // 2. Clues: how many of the step's tells the player perceives.
  const totals = attrTotals(c);
  const luck = luckOf(c);
  let extra = 0;
  if (hasTrait(c, 'focused')) extra += 1;
  if (hasTrait(c, 'dazed')) extra -= 1;
  if (E.enraged) extra -= 1;
  const clueCount = cluesShown({
    wisTotal: totals.WIS, faiTotal: totals.FAI, luck,
    tellCount: step.tells.length, night: combat.timeOfDay === 'Night', extra,
  });

  const fortuneOpen = rollFortune(luck, rng);
  const hint = fortuneOpen ? enemy.fortuneHints[Math.floor(rng.next() * enemy.fortuneHints.length)] : null;

  combat.current = {
    stepId: step.id,
    caption: step.caption,
    tells: step.tells.slice(0, clueCount).map(t => enemy.tellText[t]),
    tellCount: step.tells.length,
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
  const abilities = character.abilities.map(id => {
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
  const step = stepById(enemy, cb.current.stepId);
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
  if (step.action === 'attack') eSpeed = SPEED_RANK[getWeapon(step.weapon).speed];
  else if (step.action === 'enrage') eSpeed = SPEED_RANK.Fair;
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
  const playerAttackMod = netModifier(playerAdv, playerSlower || hasCondition(P, 'offBalance'));
  const playerBlockMod = netModifier(false, hasCondition(P, 'offBalance'));
  let enemyAdv = false;
  if (step.action === 'attack') { enemyAdv = E.advantageNext; E.advantageNext = false; }
  const enemyAttackMod = netModifier(enemyAdv, enemySlower || hasCondition(E, 'offBalance'));
  const enemyBlockMod = netModifier(false, hasCondition(E, 'offBalance'));

  // Predictable: repeating the same attack at the same target two exchanges
  // running means the enemy's Block against it is automatically correct.
  const entry = { action: action === 'ability' ? 'ability:' + ability.id : action, target: targeted ? choice.target : null };
  const readsYou = isAttack && isPredictable([...P.history, entry]);
  P.history.push(entry);

  const ctx = { c, cb, enemy, step, ability, entry, lines, rng, lucky };

  // --- 5. Attacks meet (equal speed) ----------------------------------------
  if (isAttack && step.action === 'attack' && !readsYou && pSpeed === eSpeed) {
    const meet = attacksMeet(choice.target, step.target);
    if (meet === 'clank') {
      lines.push(`Clank! Your ${weapon.name.toLowerCase()} meets its ${step.weapon}. You are both Off-Balance.`);
      c.durability = wearItem(c.durability, c.gear.ready[P.weaponIndex]);
      playerGainsTNT(c, cb, 'offBalance', lines);
      addCondition(E, 'offBalance', k);
      if (ability) afterAbility(ctx);
      return cleanup(ctx);
    }
    if (meet === 'clash') {
      lines.push('CLASH! Your attacks meet. Read its next move and pick a direction.');
      cb.pendingClash = {
        enemyDir: step.clash || step.target,
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
  if (step.action === 'attack' || step.action === 'enrage') actors.push({ side: 'enemy', speed: eSpeed });
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
        resolvePlayer(ctx, { action, weapon, ability, target: choice.target, readsYou,
                             playerAttackMod, enemyBlockMod, enemyOffensive: step.action === 'attack' });
      }
      if (a.side === 'enemy' && !enemyDown && step.action === 'enrage') {
        E.enraged = true;
        lines.push('It howls at the moon. It is Enraged!');
      } else if (a.side === 'enemy' && !enemyDown) {
        const staggered = resolveEnemy(ctx, { weaponId: step.weapon, target: step.target, enemyAttackMod,
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
      weaponId: step.action === 'attack' ? step.weapon : enemy.weapons[0],
      target: step.target || 'left',
      enemyAttackMod: null,
      playerBlocking: action === 'block' ? choice.target : null,
      playerBlockMod,
    });
    playerGainsTNT(ctx.c, cb, 'offBalance', lines);
  }

  return cleanup(ctx);
}

function resolvePlayer(ctx, o) {
  const { cb, enemy, step, lines, lucky } = ctx;
  const P = cb.player, E = cb.enemy;
  const mult = lucky && lucky.success ? lucky.multiplier : 1;

  if (o.action === 'attack' || o.action === 'ability') {
    const what = o.ability ? `${o.ability.name} (${o.weapon.name.toLowerCase()})` : `your ${o.weapon.name.toLowerCase()}`;
    if (o.readsYou) {
      lines.push(`It reads the repeat and blocks ${what}.`);
    } else {
      let dmg = computeHit({
        weapon: o.weapon, totals: attrTotals(ctx.c), modifier: o.playerAttackMod,
        armorWeight: enemy.armor[SLOT_FOR[o.target]], resistWeak: damageMultiplier(enemy, o.weapon.drains),
        abilityMultiplier: o.ability && o.ability.multiplier ? o.ability.multiplier : 1, luckyMultiplier: mult,
      });
      if (step.action === 'block' && step.target === o.target) {
        const br = blockResult(dmg, o.enemyBlockMod);
        dmg = br.taken;
        if (dmg === 0) lines.push(`It blocks ${what}.`);
      }
      if (dmg > 0) {
        const r = applyDamage(E.stamina, o.weapon.drains, dmg);
        E.stamina = r.stamina;
        const verb = PLAYER_VERB[o.weapon.id] || 'hits';
        const subject = o.ability ? `${o.ability.name}: your ${o.weapon.name.toLowerCase()}` : `Your ${o.weapon.name.toLowerCase()}`;
        lines.push(`${subject} ${verb} ${ENEMY_PART[o.target]}. ${damageText(r.applied)}`);
      }
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

// Returns true if the hit carried a Stagger.
function resolveEnemy(ctx, o) {
  const { cb, enemy, lines } = ctx;
  const E = cb.enemy;
  const weapon = getWeapon(o.weaponId);

  let dmg = computeHit({
    weapon, totals: E.totals, modifier: o.enemyAttackMod,
    armorWeight: playerArmorWeight(ctx.c, o.target),
  });
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
  const step = stepById(enemy, cb.current.stepId);
  const pc = cb.pendingClash;
  const lines = [];
  const ctx = { c, cb, enemy, step, ability: pc.abilityId ? getAbility(pc.abilityId) : null,
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
  let c = ctx.c;
  const E = cb.enemy, P = cb.player;
  const k = cb.exchange;

  c.cooldowns = tickCooldowns(c.cooldowns);
  if (ability) c.cooldowns[ability.id] = ability.cooldown;

  P.conditions = P.conditions.filter(x => x.until > k);
  E.conditions = E.conditions.filter(x => x.until > k);

  const loop = loopSteps(enemy);
  const idx = loop.indexOf(step);
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
