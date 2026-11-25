// The rules engine (Build Spec → "Rules engine").
// Every function here is pure: it takes values or state and returns new
// values or new state, never changing what it was given. That lets the
// automatic tests check each rule without any screens.

import { getRace } from '../data/races.js';
import { WEAPONS, ARMOR } from '../data/items.js';
import { TRAITS, PRAY_TPTS } from '../data/traits.js';
import { rollDie, pickDistinct } from './random.js';

export const ATTRS = ['STR', 'AGI', 'WIS', 'FAI'];          // order everywhere
export const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Night'];
export const DICE_ORDER = [20, 12, 10, 8, 6, 4, 4];          // lucky dice, biggest first
export const MAX_LUCKY_DICE = 7;
export const START_DURABILITY = 20;

const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------
// Attributes and Luck
// ---------------------------------------------------------------------------

// Bonus from equipped gear for one attribute (no slice item has one yet).
export function gearBonus(character, attr) {
  let bonus = 0;
  const g = character.gear || {};
  const ids = [...(g.ready || []), ...Object.values(g.armor || {}), g.shield].filter(Boolean);
  for (const id of ids) {
    const item = WEAPONS[id] || ARMOR[id];
    if (item && item.bonus && item.bonus[attr]) bonus += item.bonus[attr];
  }
  return bonus;
}

// Total = Natural + Class + Gear.
export function attrTotal(character, attr) {
  const a = character.attrs[attr];
  return a.natural + a.class + gearBonus(character, attr);
}

export function attrTotals(character) {
  const out = {};
  for (const k of ATTRS) out[k] = attrTotal(character, k);
  return out;
}

export function staminaOf(character) {
  const out = {};
  for (const k of ATTRS) out[k] = character.attrs[k].stamina;
  return out;
}

// Luck = |STR − AGI| + |WIS − FAI| on Natural + Class, plus the race modifier
// and unique gear Luck (at most two unique items count), never below the
// race's starting Luck.
export function calcLuck({ attrs, raceId, uniqueGearLuck = [] }) {
  const race = getRace(raceId);
  const base = Math.abs(attrs.STR - attrs.AGI) + Math.abs(attrs.WIS - attrs.FAI);
  const gear = uniqueGearLuck.slice().sort((a, b) => b - a).slice(0, 2).reduce((s, n) => s + n, 0);
  return Math.max(race.startingLuck, base + race.luckModifier + gear);
}

// Luck for a character (uses Natural + Class only, never current stamina).
export function luckOf(character) {
  const attrs = {};
  for (const k of ATTRS) attrs[k] = character.attrs[k].natural + character.attrs[k].class;
  const uniqueGearLuck = [];
  const g = character.gear || {};
  const ids = [...(g.ready || []), ...Object.values(g.armor || {}), g.shield].filter(Boolean);
  for (const id of ids) {
    const item = WEAPONS[id] || ARMOR[id];
    if (item && item.unique && item.luck) uniqueGearLuck.push(item.luck);
  }
  return calcLuck({ attrs, raceId: character.raceId, uniqueGearLuck });
}

// ---------------------------------------------------------------------------
// Lucky dice and Fortune openings
// ---------------------------------------------------------------------------

// 1 die, plus 1 per 10 Luck, to a maximum of 7.
export function luckyDiceCount(luck) {
  return Math.min(MAX_LUCKY_DICE, 1 + Math.floor(Math.max(0, luck) / 10));
}

// Which dice: d20, d12, d10, d8, d6, d4, d4 (as numbers of sides).
export function luckyDice(luck) {
  return DICE_ORDER.slice(0, luckyDiceCount(luck));
}

export function rollLuckyDice(luck, rng) {
  return luckyDice(luck).map(sides => ({ sides, value: rollDie(rng, sides) }));
}

// The result of a lucky attempt.
// No lucky number: a penalty (in combat the enemy gets a free Basic Attack
// and you become Off-Balance). Each lucky number adds ×1 (1 = ×2, 2 = ×3...).
export function luckyResult(rolls, luckyNumber) {
  const matches = rolls.filter(r => r.value === luckyNumber).length;
  if (matches === 0) return { matches: 0, success: false, multiplier: 1, penalty: true };
  return { matches, success: true, multiplier: matches + 1, penalty: false };
}

// Chance of a Fortune opening each exchange or trial: 5% + Luck%, capped at
// 50%. The Explorer always gets one. Returned as a fraction (0.17 = 17%).
export function fortuneChance(luck, { explorer = false } = {}) {
  if (explorer) return 1;
  return Math.min(50, 5 + Math.max(0, luck)) / 100;
}

export function rollFortune(luck, rng, opts) {
  return rng.next() < fortuneChance(luck, opts);
}

// ---------------------------------------------------------------------------
// Clues
// ---------------------------------------------------------------------------

// 1, +1 per 15 of (WIS + FAI) total, +1 at Luck 10, +1 at Luck 30; at most the
// step's number of tells; one fewer at Night. `extra` covers traits such as
// Focused (+1) or Dazed (−1).
export function cluesShown({ wisTotal, faiTotal, luck, tellCount, night = false, extra = 0 }) {
  let n = 1 + Math.floor((wisTotal + faiTotal) / 15);
  if (luck >= 10) n += 1;
  if (luck >= 30) n += 1;
  n += extra;
  n = Math.min(n, tellCount);
  if (night) n -= 1;
  return Math.max(0, n);
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export const TIER_DAMAGE = { Light: 1, Medium: 2, Heavy: 3 };
export const ARMOR_REDUCTION = { Light: 0, Medium: 1, Heavy: 2 };

// Which attribute adds its total ÷ 5 to a weapon's damage.
export function bonusAttrFor(weapon) {
  const t = weapon.traits || [];
  if (weapon.tier === 'Heavy' || t.includes('heavy') || t.includes('blunt')) return 'STR';
  if (t.includes('finesse') || weapon.reach === 'Ranged') return 'AGI';
  return weapon.drains;
}

// Base weapon damage: tier (Light 1, Medium 2, Heavy 3) + attribute total ÷ 5, rounded down.
export function weaponDamage(weapon, totals) {
  const attr = bonusAttrFor(weapon);
  return TIER_DAMAGE[weapon.tier] + Math.floor((totals[attr] || 0) / 5);
}

// Advantage: +50% damage, rounded up. Disadvantage: −50%, rounded down, minimum 1.
export function applyAttackModifier(damage, modifier) {
  if (modifier === 'advantage') return Math.ceil(damage * 1.5);
  if (modifier === 'disadvantage') return Math.max(1, Math.floor(damage / 2));
  return damage;
}

// Armor: Light 0, Medium −1, Heavy −2 to hits on its slot; minimum 1 damage.
export function applyArmor(damage, armorWeight) {
  if (!armorWeight) return damage;
  return Math.max(1, damage - ARMOR_REDUCTION[armorWeight]);
}

// Resist / weak multipliers (×0.5 or ×2), applied after armor. Halving rounds
// down but never below 1.
export function applyResistWeak(damage, multiplier = 1) {
  if (multiplier === 1) return damage;
  return Math.max(1, Math.floor(damage * multiplier));
}

// Full hit: weapon damage (× any ability multiplier), then Advantage or
// Disadvantage, armor, resist or weak, then a lucky multiplier.
export function computeHit({ weapon, totals, modifier = null, armorWeight = null,
                             resistWeak = 1, abilityMultiplier = 1, luckyMultiplier = 1 }) {
  let d = weaponDamage(weapon, totals);
  if (abilityMultiplier !== 1) d = Math.ceil(d * abilityMultiplier);
  d = applyAttackModifier(d, modifier);
  d = applyArmor(d, armorWeight);
  d = applyResistWeak(d, resistWeak);
  d = d * luckyMultiplier;
  return d;
}

// A correct Block normally stops the hit. With Advantage it also deals 1
// damage back; with Disadvantage it only halves the damage (rounded up).
export function blockResult(incomingDamage, modifier = null) {
  if (modifier === 'advantage') return { taken: 0, dealtBack: 1 };
  if (modifier === 'disadvantage') return { taken: Math.ceil(incomingDamage / 2), dealtBack: 0 };
  return { taken: 0, dealtBack: 0 };
}

// ---------------------------------------------------------------------------
// Stamina, overflow, defeat
// ---------------------------------------------------------------------------

// Apply damage to a stamina map {STR, AGI, WIS, FAI}. Damage beyond an empty
// pool moves to the leftmost pool with stamina: STR, AGI, WIS, FAI.
// Returns { stamina, applied: [{ attr, amount }] }.
export function applyDamage(stamina, attr, amount) {
  const s = { ...stamina };
  const applied = [];
  let left = amount;
  const take = (k) => {
    const n = Math.min(s[k], left);
    if (n > 0) { s[k] -= n; left -= n; applied.push({ attr: k, amount: n }); }
  };
  take(attr);
  for (const k of ATTRS) { if (left <= 0) break; take(k); }
  return { stamina: s, applied };
}

export function damageCharacter(character, attr, amount) {
  const r = applyDamage(staminaOf(character), attr, amount);
  const c = clone(character);
  for (const k of ATTRS) c.attrs[k].stamina = r.stamina[k];
  return { character: c, applied: r.applied };
}

// Defeat: all four pools at 0.
export function isDefeated(stamina) {
  return ATTRS.every(k => stamina[k] <= 0);
}

// While a pool is 0, each action using it lowers that attribute's Natural
// total by 1 (the stamina stays at 0).
export function useAttribute(character, attr) {
  const c = clone(character);
  if (c.attrs[attr].stamina === 0 && c.attrs[attr].natural > 0) c.attrs[attr].natural -= 1;
  return c;
}

// Restore stamina, never above the attribute's total.
export function restoreStamina(character, attr, amount) {
  const c = clone(character);
  const total = attrTotal(c, attr);
  c.attrs[attr].stamina = Math.min(total, c.attrs[attr].stamina + amount);
  return c;
}

// The pool with the least stamina (first in STR, AGI, WIS, FAI order on a tie).
export function lowestPool(character) {
  let best = ATTRS[0];
  for (const k of ATTRS) if (character.attrs[k].stamina < character.attrs[best].stamina) best = k;
  return best;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

// Pray FAI, Attack = the weapon's attribute, Block WIS, Item AGI, abilities
// their listed attribute.
export function actionAttribute(action, { weapon = null, ability = null } = {}) {
  switch (action) {
    case 'pray': return 'FAI';
    case 'attack': return weapon.drains;
    case 'block': return 'WIS';
    case 'item': return 'AGI';
    case 'ability': return ability.drains;
    default: throw new Error('Unknown action: ' + action);
  }
}

// Cooldowns: Swift 1 exchange, Fair 2, Drawn 3.
export const COOLDOWN_BY_SPEED = { Swift: 1, Fair: 2, Drawn: 3 };
export function cooldownFor(speed) {
  return COOLDOWN_BY_SPEED[speed];
}

// Tick every cooldown down by one exchange; remove those that reach 0.
export function tickCooldowns(cooldowns) {
  const out = {};
  for (const [id, n] of Object.entries(cooldowns)) if (n - 1 > 0) out[id] = n - 1;
  return out;
}

// Predictable: the same action at the same target two exchanges running.
// history is a list of { action, target } with the newest last.
export function isPredictable(history) {
  if (history.length < 2) return false;
  const a = history[history.length - 1];
  const b = history[history.length - 2];
  return a.action === b.action && (a.target || null) === (b.target || null);
}

// Pray: one random combat TPT, or two (different ones) if the enemy took no
// offensive action.
export function prayTraits(rng, enemyTookOffensiveAction) {
  return pickDistinct(rng, PRAY_TPTS, enemyTookOffensiveAction ? 1 : 2);
}

// Combat fatigue: after a fight, each attribute's stamina drops by half the
// number of actions that used it, rounded up. usage = { STR: 3, WIS: 1, ... }
export function applyCombatFatigue(character, usage) {
  const c = clone(character);
  for (const k of ATTRS) {
    const drop = Math.ceil((usage[k] || 0) / 2);
    c.attrs[k].stamina = Math.max(0, c.attrs[k].stamina - drop);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------

// Success if the attribute's current stamina ≥ the requirement.
export function trialCheck(stamina, requirement) {
  return stamina >= requirement;
}

// Failure damage = requirement − stamina, minimum 2.
export function trialFailureDamage(stamina, requirement) {
  return Math.max(2, requirement - stamina);
}

// When a trial's only option can't be met, it becomes a lucky attempt.
// options: [{ attr, requirement }]
export function isForcedLuckyAttempt(options, character) {
  return options.length === 1 &&
    !trialCheck(character.attrs[options[0].attr].stamina, options[0].requirement);
}

// ---------------------------------------------------------------------------
// Time, Rest, Sleep, travel
// ---------------------------------------------------------------------------

export function nextTimeOfDay(time) {
  return TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(time) + 1) % 4];
}

// Advance the world one part of the day (a new day starts after Night).
export function advanceTime(world) {
  const w = clone(world);
  if (w.timeOfDay === 'Night') w.day = (w.day || 1) + 1;
  w.timeOfDay = nextTimeOfDay(w.timeOfDay);
  return w;
}

// Each journey takes one part of the day.
export function travel(world, toEventId, facing) {
  const w = advanceTime(world);
  w.eventId = toEventId;
  if (facing) w.facing = facing;
  w.visited = { ...w.visited, [toEventId]: true };
  return w;
}

function hasTrait(character, id) {
  return (character.traits || []).some(t => t.id === id);
}

// Rest: +50% of each total to stamina (rounded down), clears Rest-cleared
// TNTs, resets Rest abilities (unless Fatigued), takes one part of the day.
export function rest(character, world) {
  let c = clone(character);
  for (const k of ATTRS) c = restoreStamina(c, k, Math.floor(attrTotal(c, k) * 0.5));
  const fatigued = hasTrait(c, 'fatigued');
  c.traits = c.traits.filter(t => {
    if (t.kind !== 'TNT') return true;
    const def = TRAITS[t.id];
    return !(def && def.clearedBy.includes('rest'));
  });
  if (!fatigued) c.racialReady = true;
  return { character: c, world: advanceTime(world) };
}

export function canSleep(world) {
  return world.timeOfDay === 'Evening' || world.timeOfDay === 'Night';
}

// Sleep: Evening or Night only. Full stamina, clears all TPTs and TNTs,
// resets everything, wakes in the Morning.
export function sleep(character, world) {
  if (!canSleep(world)) return { ok: false, reason: 'You can only sleep in the Evening or at Night.', character, world };
  const c = clone(character);
  for (const k of ATTRS) c.attrs[k].stamina = attrTotal(c, k);
  c.traits = c.traits.filter(t => t.kind !== 'TPT' && t.kind !== 'TNT');
  c.racialReady = true;
  c.cooldowns = {};
  const w = clone(world);
  w.day = (w.day || 1) + 1;
  w.timeOfDay = 'Morning';
  return { ok: true, character: c, world: w };
}

// ---------------------------------------------------------------------------
// Durability
// ---------------------------------------------------------------------------

// 20 for every item; −1 per Clank, Block, or hit taken; broken at 0.
export function wearItem(durability, itemId, amount = 1) {
  const cur = durability[itemId] ?? START_DURABILITY;
  return { ...durability, [itemId]: Math.max(0, cur - amount) };
}

export function isBroken(durability, itemId) {
  return (durability[itemId] ?? START_DURABILITY) <= 0;
}
