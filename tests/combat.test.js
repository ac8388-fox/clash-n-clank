// Automatic tests for the combat exchange loop (Build Spec → "Combat resolution",
// "Enemy patterns", and the Step 2 phone checks).

import { test, eq, ok, throws } from './harness.js';
import * as C from '../engine/combat.js';
import { staminaOf, attrTotals } from '../engine/rules.js';
import { practiceFighter, simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, createRng } from './sim.js';

// Start a werewolf fight with the Fortune opening closed (unless a test opens it).
function fight(enemyId = 'werewolf', ability = 'planB', seed = 1) {
  const c = practiceFighter(ability);
  const cb = C.startCombat(c, enemyId, { seed });
  cb.current.fortune.open = false;
  return { c, cb };
}
function act(s, choice) {
  const r = C.submitAction(s.c, s.cb, choice);
  if (r.combat.current) r.combat.current.fortune.open = false;
  return { c: r.character, cb: r.combat, lines: r.lines };
}
function clash(s, dir) {
  const r = C.submitClash(s.c, s.cb, dir);
  if (r.combat.current) r.combat.current.fortune.open = false;
  return { c: r.character, cb: r.combat, lines: r.lines };
}
const holdDagger = (s) => { s.cb.player.weaponIndex = 1; return s; };
const step = (s) => s.cb.current.stepId;

// --- 1. Enemy commits, 2. clues ------------------------------------------------

test('Werewolf opens with step 1: “Its eyes drop to your legs.”', () => {
  const s = fight();
  eq(step(s), 'w1');
  eq(s.cb.current.caption, 'Its eyes drop to your legs.');
});
test('Clues: a Human Fighter (WIS 6 + FAI 6, Luck 8) sees 1 of 2 tells, plus the caption', () => {
  const s = fight();
  eq(s.cb.current.tells, ['A growl from your left']);
  eq(s.cb.current.tellCount, 2);
});
test('Clues: Focused gives one extra clue for one exchange', () => {
  const c = practiceFighter();
  c.traits.push({ id: 'focused', kind: 'TPT' });
  const cb = C.startCombat(c, 'werewolf', { seed: 1 });
  eq(cb.current.tells.length, 2);
  const r = C.submitAction(c, cb, { action: 'block', target: 'legs' });
  ok(!r.character.traits.some(t => t.id === 'focused'), 'used up');
});
test('Clues: one fewer at Night', () => {
  const cb = C.startCombat(practiceFighter(), 'werewolf', { seed: 1, timeOfDay: 'Night' });
  eq(cb.current.tells.length, 0);
  eq(cb.current.caption, 'Its eyes drop to your legs.');
});

// --- Pattern -----------------------------------------------------------------------

test('Pattern: steps loop 1, 2, 3, 4, 1 when nothing is Blocked', () => {
  let s = fight(); const seen = [step(s)];
  for (let i = 0; i < 4; i++) { s = act(s, { action: 'pray' }); seen.push(step(s)); }
  eq(seen, ['w1', 'w2', 'w3', 'w4', 'w1']);
});
test('Phone check: when its eyes drop to your legs, Block → Legs stops the hit', () => {
  const s = fight();
  const before = staminaOf(s.c);
  const r = act(s, { action: 'block', target: 'legs' });
  eq(staminaOf(r.c), before);
  ok(r.lines.some(l => l.includes('You block its claws')), 'says blocked');
});
test('Not blocking: the claws rake your legs for 3 AGI', () => {
  const r = act(fight(), { action: 'pray' });
  eq(r.c.attrs.AGI.stamina, 6 - 3);
});
test('After it is Blocked, the werewolf jumps to step 2 (bite at your head)', () => {
  const r = act(fight(), { action: 'block', target: 'legs' });
  eq(step(r), 'w2');
  eq(r.cb.current.caption, 'Its jaws open toward your throat.');
});
test('Blocking step 2 does not loop step 2 forever: it moves on to step 3', () => {
  let s = act(fight(), { action: 'block', target: 'legs' });
  s = act(s, { action: 'block', target: 'head' });
  eq(step(s), 'w3');
});
test('Phone check: when it circles to your right, Block → Right stops the hit', () => {
  let s = act(fight(), { action: 'pray' });          // w1 → w2
  s = act(s, { action: 'pray' });                   // w2 → w3
  eq(s.cb.current.caption, 'It circles to your right.');
  const before = staminaOf(s.c);
  s = act(s, { action: 'block', target: 'right' });
  eq(staminaOf(s.c), before);
});
test('Phone check: the crouching trick attacks your Head, not your legs', () => {
  let s = fight();
  for (let i = 0; i < 3; i++) s = act(s, { action: 'pray' });
  eq(s.cb.current.caption, 'It crouches, eyes on your legs.');
  const legs = act(s, { action: 'block', target: 'legs' });
  ok(legs.c.attrs.STR.stamina < s.c.attrs.STR.stamina, 'blocking legs fails');
  const head = act(s, { action: 'block', target: 'head' });
  eq(staminaOf(head.c), staminaOf(s.c));
});
test('Below half stamina: it howls at the moon, becomes Enraged, once only', () => {
  let s = fight();
  s.cb.enemy.stamina = { STR: 4, AGI: 4, WIS: 4, FAI: 3 };
  s.cb = C.beginExchange(s.c, s.cb);
  eq(step(s), 'w5'); eq(s.cb.current.caption, 'It howls at the moon.');
  s = act(s, { action: 'pray' });
  ok(s.cb.enemy.enraged, 'Enraged');
  ok(step(s) !== 'w5', 'not repeated');
  const tptCount = s.c.traits.filter(t => t.kind === 'TPT').length;
  eq(tptCount, 2, 'Pray gives two TPTs when the enemy took no offensive action');
});
test('Enraged: its attacks deal 1 more damage and you see one fewer clue', () => {
  const s = fight(); s.cb.enemy.enraged = true;
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 0 } });
  eq(s.cb.current.tells.length, 0);
  s.cb.current.fortune.open = false;
  eq(act(s, { action: 'pray' }).c.attrs.AGI.stamina, 6 - 4);
});

// --- 4. Speed ---------------------------------------------------------------------

test('Speed: the slower side takes Disadvantage (sword, Fair, vs claws, Swift: 3 → 1)', () => {
  const r = act(fight(), { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina.STR, 12 - 1);
});
test('Speed: dagger (Swift) vs bite (Fair): the bite is halved (4 → 2)', () => {
  let s = act(fight(), { action: 'pray' });       // to w2 (bite)
  holdDagger(s);
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.c.attrs.STR.stamina, s.c.attrs.STR.stamina - 2);
  eq(r.cb.enemy.stamina.AGI, 12 - 2, 'dagger 1 + AGI 6 ÷ 5');
});
test('Speed: Plan B gives the next action a Speed disadvantage', () => {
  let s = act(fight(), { action: 'pray' });       // w2: bite, Fair
  s = act(s, { action: 'ability', abilityId: 'planB', target: 'legs' });
  ok(s.cb.player.speedPenaltyNext, 'penalty set');
  eq(s.cb.player.weaponIndex, 1, 'switched to the dagger');
  // w3: claws (Swift). Dagger would be Swift, but the penalty makes it Fair → Disadvantage.
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina.AGI, s.cb.enemy.stamina.AGI - 1);
});

// --- 5. Attacks meet ---------------------------------------------------------------

test('Attacks meet: opposite sides Clank, same label Clashes, others don’t interact', () => {
  eq(C.attacksMeet('left', 'right'), 'clank');
  eq(C.attacksMeet('right', 'left'), 'clank');
  eq(C.attacksMeet('left', 'left'), 'clash');
  eq(C.attacksMeet('head', 'head'), 'clash');
  eq(C.attacksMeet('legs', 'legs'), 'clash');
  eq(C.attacksMeet('head', 'legs'), 'none');
  eq(C.attacksMeet('left', 'head'), 'none');
});
test('Clank: neither deals damage and both become Off-Balance', () => {
  let s = act(fight(), { action: 'pray' }); s = act(s, { action: 'pray' }); // w3 claws right
  holdDagger(s);
  const r = act(s, { action: 'attack', target: 'left' });
  eq(staminaOf(r.c), staminaOf(s.c)); eq(r.cb.enemy.stamina, s.cb.enemy.stamina);
  ok(r.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  ok(r.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'enemy Off-Balance');
});
test('Off-Balance: Disadvantage on the next exchange only, then it clears', () => {
  let s = act(fight(), { action: 'pray' }); s = act(s, { action: 'pray' });
  holdDagger(s);
  s = act(s, { action: 'attack', target: 'left' });   // Clank at w3; now w4 (bite head)
  const off = act(s, { action: 'attack', target: 'legs' }); // dagger Swift vs bite Fair; Off-Balance halves 2 → 1
  eq(off.cb.enemy.stamina.AGI, s.cb.enemy.stamina.AGI - 1);
  // The werewolf was Off-Balance too, and slower: its bite 4 → 2.
  eq(off.c.attrs.STR.stamina, s.c.attrs.STR.stamina - 2);
  eq(off.cb.player.conditions, [], 'cleared');
});
test('No interaction: dagger at Head vs claws at Legs, both hit', () => {
  const s = holdDagger(fight());
  const r = act(s, { action: 'attack', target: 'head' });
  eq(r.cb.enemy.stamina.AGI, 12 - 2);
  eq(r.c.attrs.AGI.stamina, 6 - 3);
});

// --- 6. Clash -------------------------------------------------------------------------

test('Clash: the same label at equal speed opens a Clash and deals no damage', () => {
  const s = holdDagger(fight());
  const r = act(s, { action: 'attack', target: 'legs' });
  ok(r.cb.pendingClash, 'Clash waiting');
  eq(r.cb.pendingClash.enemyDir, 'left', 'from the pattern step');
  throws(() => C.submitAction(r.c, r.cb, { action: 'pray' }), 'must answer the Clash first');
  const done = clash(r, 'head');
  eq(staminaOf(done.c), staminaOf(s.c)); eq(done.cb.enemy.stamina, s.cb.enemy.stamina);
});
test('Clash won: Advantage on your next attack; the enemy is Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });           // w2 bite head (Fair)
  s = act(s, { action: 'attack', target: 'head' });  // sword Fair vs bite Fair: Clash
  s = clash(s, 'head');
  ok(s.cb.player.advantageNext, 'Advantage');
  ok(s.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'enemy Off-Balance');
  // w3: claws (Swift) vs sword (Fair): slower cancels Advantage → full 3. Claws Off-Balance: 3 → 1.
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina.STR, 12 - 3);
  eq(r.c.attrs.AGI.stamina, s.c.attrs.AGI.stamina - 1);
});
test('Clash lost: the enemy gets Advantage and you are Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'attack', target: 'head' });
  s = clash(s, 'legs');
  ok(s.cb.enemy.advantageNext, 'enemy Advantage');
  ok(s.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  const r = act(s, { action: 'pray' });  // claws 3 with Advantage → 5
  const total = (x) => Object.values(staminaOf(x)).reduce((a, b) => a + b, 0);
  eq(total(s.c) - total(r.c), 5);
});

// --- 7. Resolve --------------------------------------------------------------------------

test('Predictable: the same attack at the same target twice running is blocked the second time', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina, s.cb.enemy.stamina);
  ok(r.lines.some(l => l.includes('reads the repeat')), 'explains why');
  const other = act(s, { action: 'attack', target: 'right' });
  ok(other.cb.enemy.stamina.STR < s.cb.enemy.stamina.STR, 'a different target still hits');
});
test('Block: Off-Balance only halves the damage (rounded up)', () => {
  const s = fight(); s.cb.player.conditions.push({ id: 'offBalance', until: 1 });
  const r = act(s, { action: 'block', target: 'legs' });
  eq(r.c.attrs.AGI.stamina, 6 - 2);
});
test('Overflow: claws for 3 into 1 AGI spill 2 into STR', () => {
  const s = fight(); s.c.attrs.AGI.stamina = 1;
  const r = act(s, { action: 'pray' });
  eq(r.c.attrs.AGI.stamina, 0); eq(r.c.attrs.STR.stamina, 8 - 2);
});
test('Empty stamina: acting with a pool at 0 lowers its Natural total', () => {
  const s = fight(); s.c.attrs.WIS.stamina = 0;
  const r = act(s, { action: 'block', target: 'legs' });
  eq(r.c.attrs.WIS.natural, 5);
});
test('Pray: one TPT when the enemy attacks', () => {
  const r = act(fight(), { action: 'pray' });
  eq(r.c.traits.filter(t => t.kind === 'TPT').length, 1);
});
test('Pray: Emboldened gives Advantage on the next attack, then is used up', () => {
  const s = act(fight(), { action: 'pray' });  // now w2 bite, Fair
  s.c.traits = s.c.traits.filter(t => t.kind !== 'TPT');
  s.c.traits.push({ id: 'emboldened', kind: 'TPT' });
  const r = act(s, { action: 'attack', target: 'legs' });  // sword 3 → Advantage 5
  eq(r.cb.enemy.stamina.STR, 12 - 5);
  ok(!r.c.traits.some(t => t.id === 'emboldened'), 'used');
});
test('Pray: Blessed makes the next hit 25% lighter', () => {
  const s = fight(); s.c.traits.push({ id: 'blessed', kind: 'TPT' });
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 1 } }); // bite 4
  s.cb.current.fortune.open = false;
  const r = act(s, { action: 'block', target: 'legs' });
  eq(r.c.attrs.STR.stamina, 8 - 3);
});
test('Pray: Steeled ignores the next TNT (Off-Balance from a Clank)', () => {
  let s = act(fight(), { action: 'pray' }); s = act(s, { action: 'pray' });
  s.c.traits = [{ id: 'steeled', kind: 'TPT' }];
  holdDagger(s);
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.player.conditions, []);
});
test('Item: a herbal draught gives +4 to the lowest pool and is used up', () => {
  const s = fight(); s.c.attrs.WIS.stamina = 1;
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 1 } });
  s.cb.current.fortune.open = false;
  let r = act(s, { action: 'item' });
  eq(r.c.attrs.WIS.stamina, 5);
  eq(r.c.pack, [{ itemId: 'herbalDraught', qty: 1 }]);
  r = act(r, { action: 'item' });
  eq(r.c.pack, []);
  eq(C.availableActions(r.c, r.cb).page1[3].enabled, false);
  throws(() => C.submitAction(r.c, r.cb, { action: 'item' }));
});
test('Crusher: +50% damage at Drawn speed; armor still applies', () => {
  let s = fight('barrowKnight', 'crusher');
  eq(step(s), 'k1');
  s = act(s, { action: 'block', target: 'head' });   // blocked → jumps to k3 (Block → Legs)
  eq(step(s), 'k3');
  const r = act(s, { action: 'ability', abilityId: 'crusher', target: 'head' });
  // sword 3 × 1.5 = 5, Heavy helm −2 = 3
  eq(r.cb.enemy.stamina.STR, 14 - 3);
});
test('Cooldowns: Plan B (Fair) is unavailable for 2 exchanges, Crusher (Drawn) for 3', () => {
  let s = act(fight(), { action: 'ability', abilityId: 'planB', target: 'head' });
  const avail = [];
  for (let i = 0; i < 3; i++) { avail.push(C.availableActions(s.c, s.cb).abilities[0].enabled); s = act(s, { action: 'pray' }); }
  eq(avail, [false, false, true]);
  throws(() => C.submitAction(act(fight(), { action: 'ability', abilityId: 'planB', target: 'head' }).c,
    act(fight(), { action: 'ability', abilityId: 'planB', target: 'head' }).cb,
    { action: 'ability', abilityId: 'planB', target: 'head' }), 'refused while cooling down');
  let k = act(fight('barrowKnight', 'crusher'), { action: 'ability', abilityId: 'crusher', target: 'legs' });
  const av2 = [];
  for (let i = 0; i < 4; i++) { av2.push(C.availableActions(k.c, k.cb).abilities[0].enabled); k = act(k, { action: 'block', target: 'head' }); }
  eq(av2, [false, false, false, true]);
});
test('Barrow Knight: Block → Legs stops an attack at the legs', () => {
  let s = act(fight('barrowKnight'), { action: 'block', target: 'head' });
  eq(s.cb.current.caption, 'It plants its feet, blade low.');
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.cb.enemy.stamina, s.cb.enemy.stamina);
});
test('Barrow Knight: the trick (step 4) looks like step 1 but swings at your legs', () => {
  let s = act(fight('barrowKnight'), { action: 'block', target: 'head' });  // k1 → k3
  s = act(s, { action: 'pray' });                                          // k3 → k4
  eq(step(s), 'k4');
  eq(s.cb.current.caption, 'The visor turns to your head.');
  const r = act(s, { action: 'block', target: 'legs' });
  eq(staminaOf(r.c), staminaOf(s.c));
});

// --- Fortune and lucky attempts ----------------------------------------------------------

function findLucky(wantSuccess) {
  for (let seed = 1; seed < 20000; seed++) {
    const c = practiceFighter();
    const cb = C.startCombat(c, 'werewolf', { seed });
    if (!cb.current.fortune.open) continue;
    const r = C.submitAction(c, cb, { action: 'attack', target: 'left', lucky: true });
    if (r.lines.some(l => l.startsWith('Lucky!')) === wantSuccess) return { seed, c, cb, r };
  }
  throw new Error('no seed found');
}
test('Fortune opening: shown with a hint, at the rate the seed decides (13% at Luck 8)', () => {
  let open = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const cb = C.startCombat(practiceFighter(), 'werewolf', { seed });
    if (cb.current.fortune.open) { open++; ok(cb.current.fortune.hint, 'has a hint'); }
  }
  ok(open > 200 && open < 330, `about 13% (got ${open} of 2000)`);
});
test('Lucky attempt: rolls the right dice (Luck 8 → one d20)', () => {
  const { r } = findLucky(false);
  ok(/\(d20: \d+\)/.test(r.lines[0]), r.lines[0]);
});
test('Lucky attempt success: the hit is multiplied (×2 for one lucky number)', () => {
  const { c, cb, r } = findLucky(true);
  const plain = C.submitAction(c, { ...cb, current: { ...cb.current, fortune: { open: false } } }, { action: 'attack', target: 'left' });
  eq(12 - r.combat.enemy.stamina.STR, 2 * (12 - plain.combat.enemy.stamina.STR));
});
test('Lucky attempt failure: the enemy gets a free attack and you become Off-Balance', () => {
  const { c, r } = findLucky(false);
  eq(r.character.attrs.AGI.stamina, 6 - 3 - 3, 'claws on the legs, then a free claws attack');
  ok(r.combat.player.conditions.some(x => x.id === 'offBalance'), 'Off-Balance');
});
test('Lucky attempt: does nothing without an opening, and the opening is used up', () => {
  const s = fight();
  const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'left', lucky: true });
  ok(!r.lines.some(l => l.includes('d20')), 'no dice without an opening');
  const { r: used } = findLucky(true);
  ok(used.combat.exchange === 2, 'next exchange');
});
test('Same seed and same choices replay the same fight', () => {
  const run = () => simulateFight({ seed: 77, policy: learnedPolicy, clashPick: learnedClash });
  eq(JSON.stringify(run().combat.log), JSON.stringify(run().combat.log));
});

// --- Durability, defeat, fatigue ----------------------------------------------------------------

test('Durability: a Block wears your weapon, a hit wears the armor on that slot, a Clank wears your weapon', () => {
  const b = act(fight(), { action: 'block', target: 'legs' });
  eq(b.c.durability.sword, 19);
  let s = act(fight(), { action: 'pray' }); s = act(s, { action: 'pray' });  // w3 claws right
  const hit = act(s, { action: 'pray' });
  eq(hit.c.durability.leatherJerkin, 19);
  holdDagger(s);
  eq(act(s, { action: 'attack', target: 'left' }).c.durability.dagger, 19);
});
test('Victory when all four of its pools reach 0', () => {
  const s = act(fight(), { action: 'pray' });   // w2 bite
  s.cb.enemy.stamina = { STR: 2, AGI: 0, WIS: 0, FAI: 0 };
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.cb.outcome, 'victory');
});
test('Defeat when all four of your pools reach 0', () => {
  const s = fight();
  s.c.attrs.STR.stamina = 0; s.c.attrs.AGI.stamina = 2; s.c.attrs.WIS.stamina = 0; s.c.attrs.FAI.stamina = 0;
  eq(act(s, { action: 'pray' }).cb.outcome, 'defeat');
});
test('After the fight: combat fatigue by the attributes you used', () => {
  let s = fight();
  s = act(s, { action: 'block', target: 'legs' });   // WIS
  s = act(s, { action: 'pray' });                    // FAI
  s = act(s, { action: 'attack', target: 'head' });  // STR
  s = act(s, { action: 'block', target: 'legs' });   // WIS
  s = act(s, { action: 'block', target: 'right' });  // WIS
  eq(s.cb.player.usage, { STR: 1, AGI: 0, WIS: 3, FAI: 1 });
  const f = C.finishCombat(practiceFighter(), s.cb);
  eq(f.fatigue, { STR: 1, AGI: 0, WIS: 2, FAI: 1 });
});

// --- Fight length and learning --------------------------------------------------------------------

test('Balance: a player who has learned the pattern beats the werewolf in a few minutes of exchanges', () => {
  const results = [];
  for (let seed = 1; seed <= 40; seed++) results.push(simulateFight({ seed, policy: learnedPolicy, clashPick: learnedClash }));
  const wins = results.filter(r => r.outcome === 'victory');
  ok(wins.length >= 36, `wins ${wins.length} of 40`);
  const avg = wins.reduce((s, r) => s + r.exchanges, 0) / wins.length;
  ok(avg >= 10 && avg <= 40, `average ${avg.toFixed(1)} exchanges`);
});
test('Balance: learning the pattern makes the fight much easier than random play', () => {
  let learnedWins = 0, randomWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (simulateFight({ seed, policy: learnedPolicy, clashPick: learnedClash }).outcome === 'victory') learnedWins++;
    const rng = createRng(seed * 31);
    if (simulateFight({ seed, policy: randomPolicy(rng), clashPick: randomClash(rng) }).outcome === 'victory') randomWins++;
  }
  ok(learnedWins - randomWins >= 15, `learned ${learnedWins}, random ${randomWins}`);
});
