// Automatic tests: one group per row of the Build Spec's "Rules engine" table,
// plus the race table from Core Rules and save / load.

import { test, eq, ok, throws } from './harness.js';
import * as R from '../engine/rules.js';
import * as S from '../engine/state.js';
import { createRng } from '../engine/random.js';
import { RACES, getRace } from '../data/races.js';
import { WEAPONS } from '../data/items.js';
import { PRAY_TPTS } from '../data/traits.js';

const human = () => S.createCharacter({ name: 'Test', raceId: 'human', luckyNumber: 2, occupationId: 'knight' });
const world = () => S.createWorld(12345);
const raceLuck = (id) => R.calcLuck({ attrs: getRace(id).attrs, raceId: id });

// --- Races: Luck and lucky dice match the Core Rules race table -------------

const EXPECTED = {
  halfling: [12, 2], goblin: [12, 2], dwarf: [8, 1], elf: [8, 1], gnome: [8, 1],
  beastborn: [6, 1], human: [6, 1], dragon: [4, 1], ent: [4, 1],
};
for (const race of RACES) {
  test(`Race: ${race.name} starts with ${EXPECTED[race.id][0]} Luck and ${EXPECTED[race.id][1]} lucky dice`, () => {
    eq(raceLuck(race.id), EXPECTED[race.id][0], 'Luck');
    eq(R.luckyDiceCount(raceLuck(race.id)), EXPECTED[race.id][1], 'dice');
  });
}
test('Race: every race has exactly 24 Natural points', () => {
  for (const r of RACES) eq(r.attrs.STR + r.attrs.AGI + r.attrs.WIS + r.attrs.FAI, 24, r.name);
});

// --- Advantage without rolls ------------------------------------------------

test('Advantage on an attack: +50% damage, rounded up', () => {
  eq(R.applyAttackModifier(3, 'advantage'), 5);
  eq(R.applyAttackModifier(2, 'advantage'), 3);
});
test('Disadvantage on an attack: −50%, rounded down, minimum 1', () => {
  eq(R.applyAttackModifier(5, 'disadvantage'), 2);
  eq(R.applyAttackModifier(1, 'disadvantage'), 1);
});
test('Block: correct Block stops the hit; with Advantage it deals 1 back', () => {
  eq(R.blockResult(4), { taken: 0, dealtBack: 0 });
  eq(R.blockResult(4, 'advantage'), { taken: 0, dealtBack: 1 });
});
test('Block with Disadvantage only halves the damage', () => {
  eq(R.blockResult(4, 'disadvantage').taken, 2);
  eq(R.blockResult(5, 'disadvantage').taken, 3);
});

// --- Starting class and stamina --------------------------------------------

test('Starting class: Fighter Level 1 adds +2 STR (1 fixed + 1 free) on the Class layer', () => {
  const c = human();
  eq(c.attrs.STR.class, 2); eq(c.attrs.AGI.class, 0); eq(c.attrs.WIS.class, 0); eq(c.attrs.FAI.class, 0);
  eq(c.classId, 'fighter'); eq(c.classLevel, 1);
});
test('Starting stamina equals each attribute total', () => {
  const c = human();
  eq(R.staminaOf(c), { STR: 8, AGI: 6, WIS: 6, FAI: 6 });
});
test('Fighter class points count toward Luck (Human Fighter: 2 + 6 = 8)', () => {
  eq(R.luckOf(human()), 8);
});
test('Character creation rejects lucky numbers outside 1 to 4', () => {
  throws(() => S.createCharacter({ name: 'X', raceId: 'elf', luckyNumber: 5, occupationId: 'knight' }));
  throws(() => S.createCharacter({ name: 'X', raceId: 'elf', luckyNumber: 0, occupationId: 'knight' }));
});
test('Starting gear: sword and dagger ready, leather jerkin, 2 herbal draughts', () => {
  const c = human();
  eq(c.gear.ready.slice(0, 2), ['sword', 'dagger']);
  eq(c.gear.armor.body, 'leatherJerkin');
  eq(c.pack, [{ itemId: 'herbalDraught', qty: 2 }]);
});

// --- Weapon damage ----------------------------------------------------------

test('Weapon damage: Light 1, Medium 2, Heavy 3 plus attribute total ÷ 5 (rounded down)', () => {
  const t = { STR: 8, AGI: 6, WIS: 6, FAI: 6 };
  eq(R.weaponDamage(WEAPONS.sword, t), 2 + 1, 'sword uses STR 8');
  eq(R.weaponDamage(WEAPONS.dagger, t), 1 + 1, 'dagger uses AGI 6');
  eq(R.weaponDamage(WEAPONS.greatsword, { STR: 14, AGI: 4, WIS: 8, FAI: 0 }), 3 + 2, 'greatsword STR 14');
  eq(R.weaponDamage(WEAPONS.sword, { STR: 4, AGI: 0, WIS: 0, FAI: 0 }), 2, 'STR 4 adds 0');
});
test('Weapon bonus attribute: heavy and blunt use STR, finesse and ranged use AGI', () => {
  eq(R.bonusAttrFor({ tier: 'Medium', traits: ['blunt'], drains: 'WIS', reach: 'Approach' }), 'STR');
  eq(R.bonusAttrFor({ tier: 'Medium', traits: ['finesse'], drains: 'AGI', reach: 'Close' }), 'AGI');
  eq(R.bonusAttrFor({ tier: 'Medium', traits: [], drains: 'AGI', reach: 'Ranged' }), 'AGI');
  eq(R.bonusAttrFor(WEAPONS.greatsword), 'STR');
});

// --- Armor and resist / weak ------------------------------------------------

test('Armor: Light 0, Medium −1, Heavy −2 to hits on its slot', () => {
  eq(R.applyArmor(5, 'Light'), 5);
  eq(R.applyArmor(5, 'Medium'), 4);
  eq(R.applyArmor(5, 'Heavy'), 3);
  eq(R.applyArmor(5, null), 5);
});
test('Armor: minimum 1 damage', () => {
  eq(R.applyArmor(2, 'Heavy'), 1);
  eq(R.applyArmor(1, 'Medium'), 1);
});
test('Resist and weak multiply damage after armor (×0.5, ×2)', () => {
  eq(R.applyResistWeak(4, 2), 8);
  eq(R.applyResistWeak(5, 0.5), 2);
  eq(R.applyResistWeak(1, 0.5), 1);
  // 3 damage into Heavy armor = 1, then weak ×2 = 2 (armor first, then multiplier)
  eq(R.computeHit({ weapon: WEAPONS.sword, totals: { STR: 5, AGI: 0, WIS: 0, FAI: 0 }, armorWeight: 'Heavy', resistWeak: 2 }), 2);
});
test('Full hit: sword with Advantage into Medium armor', () => {
  // sword 2 + STR 10/5=2 → 4; Advantage → 6; Medium −1 → 5
  eq(R.computeHit({ weapon: WEAPONS.sword, totals: { STR: 10, AGI: 0, WIS: 0, FAI: 0 }, modifier: 'advantage', armorWeight: 'Medium' }), 5);
});
test('Lucky multiplier applies to the final hit', () => {
  eq(R.computeHit({ weapon: WEAPONS.sword, totals: { STR: 5, AGI: 0, WIS: 0, FAI: 0 }, luckyMultiplier: 3 }), 9);
});

// --- Overflow, empty stamina, defeat ---------------------------------------

test('Overflow: damage beyond an empty pool moves to the leftmost pool with stamina', () => {
  const r = R.applyDamage({ STR: 5, AGI: 2, WIS: 4, FAI: 3 }, 'AGI', 5);
  eq(r.stamina, { STR: 2, AGI: 0, WIS: 4, FAI: 3 });
  eq(r.applied, [{ attr: 'AGI', amount: 2 }, { attr: 'STR', amount: 3 }]);
});
test('Overflow follows STR, AGI, WIS, FAI, so Faith falls last', () => {
  const r = R.applyDamage({ STR: 0, AGI: 1, WIS: 2, FAI: 3 }, 'WIS', 6);
  eq(r.stamina, { STR: 0, AGI: 0, WIS: 0, FAI: 0 });
  eq(r.applied.map(a => a.attr), ['WIS', 'AGI', 'FAI']);
});
test('Overflow into an already-empty pool', () => {
  const r = R.applyDamage({ STR: 3, AGI: 0, WIS: 4, FAI: 3 }, 'AGI', 2);
  eq(r.stamina, { STR: 1, AGI: 0, WIS: 4, FAI: 3 });
});
test('Empty stamina: an action using a pool at 0 lowers its Natural total by 1', () => {
  let c = human();
  c.attrs.AGI.stamina = 0;
  c = R.useAttribute(c, 'AGI');
  eq(c.attrs.AGI.natural, 5); eq(c.attrs.AGI.stamina, 0);
  const d = R.useAttribute(human(), 'AGI');
  eq(d.attrs.AGI.natural, 6, 'no loss while stamina remains');
});
test('Empty stamina lowers Luck as Natural changes, but never below the race floor', () => {
  let c = S.createCharacter({ name: 'H', raceId: 'halfling', luckyNumber: 1, occupationId: 'thief' });
  c.attrs.AGI.stamina = 0;
  for (let i = 0; i < 6; i++) c = R.useAttribute(c, 'AGI');
  eq(c.attrs.AGI.natural, 6);
  eq(R.luckOf(c), 12, 'floor of 12');
});
test('Defeat only when all four pools are 0', () => {
  ok(R.isDefeated({ STR: 0, AGI: 0, WIS: 0, FAI: 0 }));
  ok(!R.isDefeated({ STR: 0, AGI: 0, WIS: 0, FAI: 1 }));
});

// --- Luck --------------------------------------------------------------------

test('Luck: |STR − AGI| + |WIS − FAI| on Natural + Class, plus the race modifier', () => {
  eq(R.calcLuck({ attrs: { STR: 7, AGI: 3, WIS: 12, FAI: 2 }, raceId: 'dragon' }), 4, 'Dragon 14 − 10');
  eq(R.calcLuck({ attrs: { STR: 6, AGI: 6, WIS: 6, FAI: 6 }, raceId: 'human' }), 6, 'Human 0 + 6');
  eq(R.calcLuck({ attrs: { STR: 20, AGI: 6, WIS: 6, FAI: 6 }, raceId: 'human' }), 20);
});
test('Luck: never below the race starting Luck', () => {
  eq(R.calcLuck({ attrs: { STR: 6, AGI: 6, WIS: 6, FAI: 6 }, raceId: 'goblin' }), 12);
});
test('Luck: unique gear adds Luck directly (at most two items count)', () => {
  eq(R.calcLuck({ attrs: { STR: 6, AGI: 6, WIS: 6, FAI: 6 }, raceId: 'human', uniqueGearLuck: [3, 2, 1] }), 11);
});
test('Luck ignores current stamina', () => {
  const c = human();
  c.attrs.STR.stamina = 0;
  eq(R.luckOf(c), 8);
});

// --- Clues -------------------------------------------------------------------

test('Clues: 1, +1 per 20 of WIS + FAI total', () => {
  eq(R.cluesShown({ wisTotal: 6, faiTotal: 6, luck: 6, tellCount: 5 }), 1);
  eq(R.cluesShown({ wisTotal: 10, faiTotal: 9, luck: 6, tellCount: 5 }), 1);
  eq(R.cluesShown({ wisTotal: 12, faiTotal: 8, luck: 6, tellCount: 5 }), 2);
  eq(R.cluesShown({ wisTotal: 25, faiTotal: 15, luck: 6, tellCount: 5 }), 3);
});
test('Clues: +1 at Luck 20 and +1 at Luck 40', () => {
  eq(R.cluesShown({ wisTotal: 0, faiTotal: 0, luck: 19, tellCount: 5 }), 1);
  eq(R.cluesShown({ wisTotal: 0, faiTotal: 0, luck: 20, tellCount: 5 }), 2);
  eq(R.cluesShown({ wisTotal: 0, faiTotal: 0, luck: 40, tellCount: 5 }), 3);
});
test('Clues: every starting race sees one clue as a Level 1 Fighter', () => {
  for (const race of RACES) {
    const c = S.createCharacter({ name: 'T', raceId: race.id, luckyNumber: 1, occupationId: 'knight' });
    const t = R.attrTotals(c);
    eq(R.cluesShown({ wisTotal: t.WIS, faiTotal: t.FAI, luck: R.luckOf(c), tellCount: 2 }), 1, race.name);
  }
});
test('Clues: at most the step’s number of tells; one fewer at Night', () => {
  eq(R.cluesShown({ wisTotal: 30, faiTotal: 30, luck: 40, tellCount: 2 }), 2);
  eq(R.cluesShown({ wisTotal: 30, faiTotal: 30, luck: 40, tellCount: 2, night: true }), 1);
  eq(R.cluesShown({ wisTotal: 6, faiTotal: 6, luck: 6, tellCount: 2, night: true }), 0);
});
test('Hiding: high WIS + FAI and Luck lower an enemy’s chance to hide a little, never to zero', () => {
  eq(R.hideChance(0.3, { wisTotal: 0, faiTotal: 0, luck: 0 }), 0.3);
  ok(Math.abs(R.hideChance(0.3, { wisTotal: 6, faiTotal: 6, luck: 8 }) - 0.24) < 1e-9, 'Human Fighter: 20% lower');
  eq(R.hideChance(0.3, { wisTotal: 60, faiTotal: 60, luck: 90 }), 0.15);
  ok(R.hideChance(0.3, { wisTotal: 999, faiTotal: 999, luck: 999 }) > 0, 'never zero');
});

// --- Fortune openings and lucky dice ---------------------------------------

test('Fortune opening: 5% + Luck%, capped at 50%; Explorer always', () => {
  eq(R.fortuneChance(12), 0.17);
  eq(R.fortuneChance(4), 0.09);
  eq(R.fortuneChance(60), 0.5);
  eq(R.fortuneChance(4, { explorer: true }), 1);
});
test('Fortune opening rolls through the seeded random function (same seed, same result)', () => {
  const a = createRng(99), b = createRng(99);
  const ra = [], rb = [];
  for (let i = 0; i < 50; i++) { ra.push(R.rollFortune(12, a)); rb.push(R.rollFortune(12, b)); }
  eq(ra, rb);
  ok(ra.includes(true) && ra.includes(false), 'some open, some do not');
});
test('Lucky dice: 1 + 1 per 10 Luck, max 7', () => {
  eq(R.luckyDiceCount(0), 1); eq(R.luckyDiceCount(9), 1); eq(R.luckyDiceCount(10), 2);
  eq(R.luckyDiceCount(29), 3); eq(R.luckyDiceCount(60), 7); eq(R.luckyDiceCount(200), 7);
});
test('Lucky dice: d20, d12, d10, d8, d6, d4, d4', () => {
  eq(R.luckyDice(5), [20]);
  eq(R.luckyDice(12), [20, 12]);
  eq(R.luckyDice(65), [20, 12, 10, 8, 6, 4, 4]);
});
test('Lucky dice rolls stay within each die’s sides', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    for (const r of R.rollLuckyDice(65, rng)) ok(r.value >= 1 && r.value <= r.sides, 'in range');
  }
});
test('Lucky result: no lucky number is a penalty', () => {
  eq(R.luckyResult([{ sides: 20, value: 7 }], 2), { matches: 0, success: false, multiplier: 1, penalty: true });
});
test('Lucky result: each lucky number adds ×1 (1 = ×2, 2 = ×3, 3 = ×4)', () => {
  eq(R.luckyResult([{ sides: 20, value: 2 }, { sides: 12, value: 5 }], 2).multiplier, 2);
  eq(R.luckyResult([{ sides: 20, value: 2 }, { sides: 12, value: 2 }], 2).multiplier, 3);
  eq(R.luckyResult([{ sides: 20, value: 2 }, { sides: 12, value: 2 }, { sides: 4, value: 2 }], 2).multiplier, 4);
});

// --- Cooldowns ---------------------------------------------------------------

test('Cooldowns: Swift 1 exchange, Fair 2, Drawn 3', () => {
  eq(R.cooldownFor('Swift'), 1); eq(R.cooldownFor('Fair'), 2); eq(R.cooldownFor('Drawn'), 3);
});
test('Cooldowns tick down each exchange and clear at 0', () => {
  let cd = { planB: 2, crusher: 1 };
  cd = R.tickCooldowns(cd); eq(cd, { planB: 1 });
  cd = R.tickCooldowns(cd); eq(cd, {});
});
test('Rest resets the racial ability; Sleep resets everything', () => {
  const c = human(); c.racialReady = false; c.cooldowns = { planB: 2 };
  const w = world(); w.timeOfDay = 'Evening';
  eq(R.rest(c, w).character.racialReady, true);
  const s = R.sleep(c, w).character;
  eq(s.racialReady, true); eq(s.cooldowns, {});
});

// --- Pray ----------------------------------------------------------------------

test('Pray: one combat TPT, or two different ones if the enemy took no offensive action', () => {
  const rng = createRng(3);
  for (let i = 0; i < 30; i++) {
    const one = R.prayTraits(rng, true);
    eq(one.length, 1); ok(PRAY_TPTS.includes(one[0]), 'valid TPT');
    const two = R.prayTraits(rng, false);
    eq(two.length, 2); ok(two[0] !== two[1], 'different');
  }
});

// --- Predictable ---------------------------------------------------------------

test('Predictable: same action at the same target two exchanges running', () => {
  ok(R.isPredictable([{ action: 'attack', target: 'left' }, { action: 'attack', target: 'left' }]));
  ok(!R.isPredictable([{ action: 'attack', target: 'left' }, { action: 'attack', target: 'right' }]));
  ok(!R.isPredictable([{ action: 'block', target: 'left' }, { action: 'attack', target: 'left' }]));
  ok(!R.isPredictable([{ action: 'attack', target: 'left' }]));
  ok(R.isPredictable([{ action: 'pray' }, { action: 'pray' }]));
});

// --- Trials ----------------------------------------------------------------------

test('Trial check: success if current stamina ≥ the requirement', () => {
  ok(R.trialCheck(8, 8)); ok(R.trialCheck(9, 8)); ok(!R.trialCheck(7, 8));
});
test('Trial failure: damage = requirement − stamina, minimum 2', () => {
  eq(R.trialFailureDamage(6, 10), 4);
  eq(R.trialFailureDamage(9, 10), 2);
});
test('Forced lucky attempt: only when the only option can’t be met', () => {
  const c = human(); // STR 8
  ok(R.isForcedLuckyAttempt([{ attr: 'STR', requirement: 10 }], c));
  ok(!R.isForcedLuckyAttempt([{ attr: 'STR', requirement: 8 }], c));
  ok(!R.isForcedLuckyAttempt([{ attr: 'STR', requirement: 10 }, { attr: 'WIS', requirement: 12 }], c));
});

// --- Combat fatigue and action attributes ------------------------------------------

test('Combat fatigue: stamina drops by half the actions that used it, rounded up', () => {
  const c = R.applyCombatFatigue(human(), { STR: 5, WIS: 2, FAI: 1 });
  eq(R.staminaOf(c), { STR: 8 - 3, AGI: 6, WIS: 6 - 1, FAI: 6 - 1 });
});
test('Combat fatigue never takes stamina below 0', () => {
  const c = human(); c.attrs.FAI.stamina = 1;
  eq(R.applyCombatFatigue(c, { FAI: 6 }).attrs.FAI.stamina, 0);
});
test('Action attributes: Pray FAI, Attack = weapon, Block WIS, Item AGI, abilities their own', () => {
  eq(R.actionAttribute('pray'), 'FAI');
  eq(R.actionAttribute('attack', { weapon: WEAPONS.sword }), 'STR');
  eq(R.actionAttribute('attack', { weapon: WEAPONS.dagger }), 'AGI');
  eq(R.actionAttribute('block'), 'WIS');
  eq(R.actionAttribute('item'), 'AGI');
  eq(R.actionAttribute('ability', { ability: { drains: 'STR' } }), 'STR');
});

// --- Rest, Sleep, travel ----------------------------------------------------------

test('Rest: +50% of each total to stamina, never above the total', () => {
  const c = human();
  for (const k of R.ATTRS) c.attrs[k].stamina = 0;
  c.attrs.FAI.stamina = 5;
  const r = R.rest(c, world()).character;
  eq(R.staminaOf(r), { STR: 4, AGI: 3, WIS: 3, FAI: 6 });
});
test('Rest clears Rest-cleared TNTs but keeps others', () => {
  const c = human();
  c.traits.push({ id: 'dazed', kind: 'TNT' }, { id: 'bruised', kind: 'TNT' }, { id: 'focused', kind: 'TPT' });
  const ids = R.rest(c, world()).character.traits.map(t => t.id);
  ok(!ids.includes('dazed'), 'Dazed cleared');
  ok(ids.includes('bruised'), 'Bruised needs Sleep');
  ok(ids.includes('focused'), 'TPTs stay');
});
test('Rest takes one part of the day', () => {
  eq(R.rest(human(), world()).world.timeOfDay, 'Afternoon');
});
test('Rest does not reset Rest abilities while Fatigued', () => {
  const c = human(); c.racialReady = false; c.traits.push({ id: 'fatigued', kind: 'TNT' });
  eq(R.rest(c, world()).character.racialReady, false);
});
test('Sleep: only in the Evening or at Night', () => {
  const w = world();
  eq(R.sleep(human(), w).ok, false);
  w.timeOfDay = 'Afternoon'; eq(R.sleep(human(), w).ok, false);
  w.timeOfDay = 'Evening'; eq(R.sleep(human(), w).ok, true);
  w.timeOfDay = 'Night'; eq(R.sleep(human(), w).ok, true);
});
test('Sleep: full stamina, clears all TPTs and TNTs, wakes in the Morning', () => {
  const c = human();
  for (const k of R.ATTRS) c.attrs[k].stamina = 1;
  c.traits.push({ id: 'bruised', kind: 'TNT' }, { id: 'focused', kind: 'TPT' });
  const w = world(); w.timeOfDay = 'Night';
  const r = R.sleep(c, w);
  eq(R.staminaOf(r.character), { STR: 8, AGI: 6, WIS: 6, FAI: 6 });
  eq(r.character.traits.map(t => t.kind), ['PPT', 'PNT'], 'only permanent traits remain');
  eq(r.world.timeOfDay, 'Morning'); eq(r.world.day, 2);
});
test('Travel: each journey takes one part of the day, looping after Night', () => {
  let w = world();
  const seen = [w.timeOfDay];
  for (let i = 0; i < 4; i++) { w = R.travel(w, 'gorge', 'S'); seen.push(w.timeOfDay); }
  eq(seen, ['Morning', 'Afternoon', 'Evening', 'Night', 'Morning']);
  eq(w.day, 2); eq(w.facing, 'S'); ok(w.visited.gorge, 'marked visited');
});

// --- Durability --------------------------------------------------------------------

test('Durability: 20 for every item, −1 per Clank, Block, or hit; broken at 0', () => {
  let d = human().durability;
  eq(d, { sword: 20, dagger: 20, leatherJerkin: 20 });
  d = R.wearItem(d, 'sword'); eq(d.sword, 19);
  d = R.wearItem(d, 'sword', 19); eq(d.sword, 0); ok(R.isBroken(d, 'sword'));
  d = R.wearItem(d, 'sword'); eq(d.sword, 0, 'not below 0');
  ok(!R.isBroken(d, 'dagger'));
});

// --- State, save and load ------------------------------------------------------------

test('New game starts at the Crossroads in the Morning', () => {
  const g = S.createGame({ name: 'A', raceId: 'elf', luckyNumber: 3, occupationId: 'acolyte' }, 42);
  eq(g.world.eventId, 'crossroads'); eq(g.world.timeOfDay, 'Morning'); eq(g.world.seed, 42);
  eq(g.world.defeated, { werewolf: false, barrowKnight: false });
});
test('Save and load restore the same game', () => {
  const store = {};
  const storage = { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] ?? null, removeItem: (k) => { delete store[k]; } };
  const g = S.createGame({ name: 'A', raceId: 'gnome', luckyNumber: 1, occupationId: 'scribe' }, 7);
  ok(!S.hasSave(storage), 'empty at first');
  ok(S.saveGame(g, storage), 'saved');
  eq(S.loadGame(storage), g);
  S.clearSave(storage);
  eq(S.loadGame(storage), null);
});
test('Engine functions do not change what they are given', () => {
  const c = human(); const before = JSON.stringify(c);
  R.damageCharacter(c, 'STR', 5); R.rest(c, world()); R.useAttribute(c, 'STR'); R.applyCombatFatigue(c, { STR: 4 });
  eq(JSON.stringify(c), before);
});
