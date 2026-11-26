// Automatic tests for the combat exchange loop (Build Spec → "Combat resolution",
// "Enemy patterns", feints, the repetition counter, and the Step 2 phone checks).
//
// Most tests pin the enemy to the MAIN move of its normal pattern step with
// force() (not a feint, a flinch, or a guard), so the rules can be checked
// exactly; the feint, hiding, and blocking tests pick on purpose.

import { test, slowTest, eq, ok, throws } from './harness.js';
import * as C from '../engine/combat.js';
import { staminaOf } from '../engine/rules.js';
import { ENEMIES } from '../data/enemies.js';
import { practiceFighter, simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, createRng } from './sim.js';

const WOLF = ENEMIES.werewolf.attrs;     // { STR: 7, AGI: 7, WIS: 3, FAI: 2 }
const KNIGHT = ENEMIES.barrowKnight.attrs;

// Pin the enemy to the main move of its normal step (the last option; guard
// and flinch come first), or to a named variant.
function force(s, variantId) {
  if (s.cb.current) {
    const opts = s.cb.current.options;
    s.cb = C.withVariant(s.cb, variantId || opts[opts.length - 1].step.variants[0].id);
    s.cb.current.fortune.open = false;
  }
  return s;
}
// Run a test with hiding switched off, so clue counts can be checked exactly.
function noHiding(fn) {
  const saved = Object.values(ENEMIES).map(e => e.hideChance);
  Object.values(ENEMIES).forEach(e => { e.hideChance = 0; });
  try { fn(); } finally { Object.values(ENEMIES).forEach((e, i) => { e.hideChance = saved[i]; }); }
}
// A Human Fighter with WIS 14 (WIS + FAI = 20): sees two clues.
function sharpFighter() {
  const c = practiceFighter();
  c.attrs.WIS.natural = 14; c.attrs.WIS.stamina = 14;
  return c;
}
function fight(enemyId = 'werewolf', ability = 'planB', seed = 1, raceId = 'human') {
  const c = practiceFighter(ability, raceId);
  return force({ c, cb: C.startCombat(c, enemyId, { seed }) });
}
function act(s, choice, variantId) {
  const r = C.submitAction(s.c, s.cb, choice);
  return force({ c: r.character, cb: r.combat, lines: r.lines }, variantId);
}
function clash(s, dir) {
  const r = C.submitClash(s.c, s.cb, dir);
  return force({ c: r.character, cb: r.combat, lines: r.lines });
}
const holdDagger = (s) => { s.cb.player.weaponIndex = 1; return s; };
const step = (s) => s.cb.current.stepId;
const totalStamina = (c) => Object.values(staminaOf(c)).reduce((a, b) => a + b, 0);

// --- 1. Enemy commits, 2. clues ------------------------------------------------

test('Werewolf opens with step 1: “Its eyes drop to your legs.”', () => {
  const s = fight();
  eq(step(s), 'w1');
  eq(s.cb.current.caption, 'Its eyes drop to your legs.');
});
test('Clues: a starting Human Fighter sees one clue, the shared first clue', () => noHiding(() => {
  const cb = C.startCombat(practiceFighter(), 'werewolf', { seed: 1 });
  eq(cb.current.tells, ['Its eyes are on your legs']);
  eq(cb.current.tellCount, 2);
}));
test('Clues: with WIS + FAI 20, the second clue tells the main move apart from the feint', () => noHiding(() => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const cb = C.startCombat(sharpFighter(), 'werewolf', { seed });
    eq(cb.current.tells[0], 'Its eyes are on your legs');
    const second = cb.current.tells[1];
    eq(second, cb.current.variantId === 'w1-legs' ? 'Its shoulder drops low' : 'A growl from your left');
    seen.add(second);
  }
  eq(seen.size, 2, 'both the main move and the feint showed up');
}));
test('Clues: Focused gives one extra clue for one exchange', () => noHiding(() => {
  const c = practiceFighter();
  c.traits.push({ id: 'focused', kind: 'TPT' });
  const cb = C.startCombat(c, 'werewolf', { seed: 1 });
  eq(cb.current.tells.length, 2);
  const r = C.submitAction(c, cb, { action: 'block', target: 'legs' });
  ok(!r.character.traits.some(t => t.id === 'focused'), 'used up');
}));
test('Clues: one fewer at Night (the caption still shows)', () => noHiding(() => {
  const h = C.startCombat(practiceFighter(), 'werewolf', { seed: 1, timeOfDay: 'Night' });
  eq(h.current.tells.length, 0);
  eq(h.current.caption, 'Its eyes drop to your legs.');
  eq(C.startCombat(sharpFighter(), 'werewolf', { seed: 1, timeOfDay: 'Night' }).current.tells.length, 1);
}));

// --- Hiding intent ----------------------------------------------------------------------

function hideRate(enemyId, character, N = 3000) {
  let hidden = 0;
  for (let seed = 1; seed <= N; seed++) if (C.startCombat(character, enemyId, { seed }).current.hidden) hidden++;
  return hidden / N;
}
test('Hiding: some exchanges show no clues and a neutral caption, but the enemy still commits a move', () => {
  let found = null;
  for (let seed = 1; !found && seed < 500; seed++) {
    const cb = C.startCombat(practiceFighter(), 'werewolf', { seed });
    if (cb.current.hidden) found = cb;
  }
  ok(found, 'a hidden exchange happened');
  eq(found.current.tells, []);
  ok(ENEMIES.werewolf.hiddenCaptions.includes(found.current.caption), 'neutral caption: ' + found.current.caption);
  ok(C.moveFor(found), 'it still committed to a move');
});
test('Hiding: happens at the set rate for a Human Fighter (base chance less 20%)', () => {
  for (const id of ['werewolf', 'barrowKnight']) {
    const expect = ENEMIES[id].hideChance * 0.8;
    const got = hideRate(id, practiceFighter());
    ok(Math.abs(got - expect) < 0.03, `${id}: ${got.toFixed(3)} vs ${expect.toFixed(3)}`);
  }
});
test('Hiding: the barrow knight hides more often than the werewolf', () => {
  ok(ENEMIES.barrowKnight.hideChance > ENEMIES.werewolf.hideChance, 'base chance');
  ok(hideRate('barrowKnight', practiceFighter(), 2000) > hideRate('werewolf', practiceFighter(), 2000), 'in play');
});
test('Hiding: high WIS + FAI and Luck lower the chance, but never to zero', () => {
  const sage = practiceFighter();
  sage.attrs.WIS.natural = 40; sage.attrs.WIS.stamina = 40;   // WIS + FAI + Luck well over 50
  const base = hideRate('werewolf', practiceFighter(), 2000);
  const low = hideRate('werewolf', sage, 2000);
  ok(low < base, `${low.toFixed(3)} < ${base.toFixed(3)}`);
  ok(low > 0.08, 'still hides: ' + low.toFixed(3));
});
test('Hiding: an Enraged enemy hides more often; the howl itself is never hidden', () => {
  let calm = 0, wild = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const cb = C.startCombat(practiceFighter(), 'werewolf', { seed });
    if (cb.current.hidden) calm++;
    const e = C.beginExchange(practiceFighter(), { ...cb, exchange: 0, enemy: { ...cb.enemy, enraged: true, enrageUsed: true, loopIndex: 0 } });
    if (e.current.hidden) wild++;
  }
  ok(wild > calm * 1.3, `${wild} vs ${calm}`);
  for (let seed = 1; seed <= 300; seed++) {
    const s = fight('werewolf', 'planB', seed);
    s.cb.enemy.stamina = { STR: 2, AGI: 2, WIS: 2, FAI: 2 };
    const b = C.beginExchange(s.c, s.cb);
    eq(b.current.stepId, 'w5'); ok(!b.current.hidden, 'howl shown');
  }
});

// --- Feints -------------------------------------------------------------------------

test('Feints: every step’s variants share the first clue and caption; second clues all differ', () => {
  for (const e of Object.values(ENEMIES)) {
    for (const st of e.pattern) {
      ok(e.tellText[st.first], `${st.id} first clue has words`);
      const seconds = st.variants.map(v => v.second);
      eq(new Set(seconds).size, seconds.length, `${st.id} second clues differ`);
      for (const v of st.variants) ok(e.tellText[v.second], `${v.id} second clue has words`);
      ok(st.variants.length === 1 || (st.variants.length >= 2 && st.variants.length <= 3), `${st.id} has 1–2 feints`);
    }
    for (const t of C.TARGETS) ok(e.blockTells[t], `${e.id} has a Block clue for ${t}`);
  }
});
test('Feints: the enemy usually does the main action; feints come at the set rate', () => {
  const f = ENEMIES.werewolf.feintChance;
  let feints = 0;
  const N = 3000;
  for (let seed = 1; seed <= N; seed++) {
    if (C.startCombat(practiceFighter(), 'werewolf', { seed }).current.variantId !== 'w1-legs') feints++;
  }
  ok(Math.abs(feints / N - f) < 0.03, `feint rate ${(feints / N).toFixed(3)} vs ${f}`);
  ok(f < 0.5, 'main action is the most likely');
});
test('Feints: with two feints, each comes up about equally often', () => {
  const odds = C.variantOdds(ENEMIES.werewolf, ENEMIES.werewolf.pattern[2]);
  eq(odds.length, 3);
  ok(Math.abs(odds[1] - odds[2]) < 1e-9 && odds[0] > odds[1], 'main most likely, feints equal');
  ok(Math.abs(odds.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'adds to 1');
});
test('Feints: chosen by the seeded random function (same seed, same choice)', () => {
  const a = [], b = [];
  for (let seed = 1; seed <= 50; seed++) {
    a.push(C.startCombat(practiceFighter(), 'werewolf', { seed }).current.variantId);
    b.push(C.startCombat(practiceFighter(), 'werewolf', { seed }).current.variantId);
  }
  eq(a, b);
});
test('Feints: when it feints left instead of clawing your legs, Block → Legs fails and Block → Left works', () => {
  const s = force(fight(), 'w1-left');
  const legs = act(s, { action: 'block', target: 'legs' });
  eq(legs.c.attrs.AGI.stamina, 6 - 3);
  const left = act(s, { action: 'block', target: 'left' });
  eq(staminaOf(left.c), staminaOf(s.c));
});

// --- Pattern -------------------------------------------------------------------------

test('Pattern: steps loop 1, 2, 3, 4, 1 when nothing is Blocked', () => {
  let s = fight(); const seen = [step(s)];
  const moves = [{ action: 'pray' }, { action: 'block', target: 'left' }];
  for (let i = 0; i < 4; i++) { s = act(s, moves[i % 2]); seen.push(step(s)); }
  eq(seen, ['w1', 'w2', 'w3', 'w4', 'w1']);
});
test('Phone check: when its eyes drop to your legs (main action), Block → Legs stops the hit', () => {
  const s = fight();
  const r = act(s, { action: 'block', target: 'legs' });
  eq(staminaOf(r.c), staminaOf(s.c));
  ok(r.lines.some(l => l.includes('You block its claws')), 'says blocked');
});
test('Not blocking: the claws rake your legs for 3 AGI', () => {
  eq(act(fight(), { action: 'pray' }).c.attrs.AGI.stamina, 6 - 3);
});
test('After it is Blocked, the werewolf jumps to step 2 (jaws at your throat)', () => {
  const r = act(fight(), { action: 'block', target: 'legs' });
  eq(step(r), 'w2');
  eq(r.cb.current.caption, 'Its jaws open toward your throat.');
});
test('Blocking step 2 does not loop step 2 forever: it moves on to step 3', () => {
  let s = act(fight(), { action: 'block', target: 'legs' });
  s = act(s, { action: 'block', target: 'head' });
  eq(step(s), 'w3');
});
test('Phone check: when it circles to your right (main action), Block → Right stops the hit', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'block', target: 'left' });
  eq(s.cb.current.caption, 'It circles to your right.');
  const r = act(s, { action: 'block', target: 'right' });
  eq(staminaOf(r.c), staminaOf(s.c));
});
test('Phone check: the crouching trick (main action) bites your Head, not your legs', () => {
  let s = fight();
  for (const m of [{ action: 'pray' }, { action: 'block', target: 'left' }, { action: 'pray' }]) s = act(s, m);
  eq(s.cb.current.caption, 'It crouches, eyes on your legs.');
  ok(act(s, { action: 'block', target: 'legs' }).c.attrs.STR.stamina < s.c.attrs.STR.stamina, 'blocking legs fails');
  eq(staminaOf(act(s, { action: 'block', target: 'head' }).c), staminaOf(s.c));
});
test('Below half stamina: it howls at the moon, becomes Enraged, once only', () => {
  let s = fight();
  s.cb.enemy.stamina = { STR: 2, AGI: 2, WIS: 2, FAI: 2 };
  s.cb = C.beginExchange(s.c, s.cb); force(s);
  eq(step(s), 'w5'); eq(s.cb.current.caption, 'It howls at the moon.');
  s = act(s, { action: 'pray' });
  ok(s.cb.enemy.enraged, 'Enraged');
  ok(step(s) !== 'w5', 'not repeated');
  eq(s.c.traits.filter(t => t.kind === 'TPT').length, 2, 'Pray gives two TPTs when the enemy took no offensive action');
});
test('Enraged: its attacks deal 1 more damage (and it hides more often: see Hiding)', () => noHiding(() => {
  const s = fight(); s.cb.enemy.enraged = true;
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 0 } }); force(s);
  eq(s.cb.current.tells.length, 1, 'clues are not taken away');
  eq(act(s, { action: 'pray' }).c.attrs.AGI.stamina, 6 - 4);
}));

// --- Enemy blocks ---------------------------------------------------------------------------

test('Enemy Block: a Block on the spot you attack stops your hit; another spot still lands', () => {
  let s = act(fight(), { action: 'pray' }, null);     // to w2
  s = force(s, 'w2-guard');                           // its feint: Block → Head
  eq(act(s, { action: 'attack', target: 'head' }).cb.enemy.stamina, s.cb.enemy.stamina);
  ok(act(s, { action: 'attack', target: 'legs' }).cb.enemy.stamina.STR < s.cb.enemy.stamina.STR, 'legs hit');
});
test('Enemy Block: has its own second clue, so a careful player can see it coming', () => {
  const w2 = ENEMIES.werewolf.pattern[1];
  const g = w2.variants.find(v => v.action === 'block');
  eq(C.variantTells(ENEMIES.werewolf, w2, g), ['Its hackles rise', 'It ducks its head low']);
});
test('Enemy Block: while it blocks it isn’t attacking, so Pray gives two blessings', () => {
  const s = force(act(fight(), { action: 'pray' }), 'w2-guard');
  s.c.traits = s.c.traits.filter(t => t.kind !== 'TPT');
  eq(act(s, { action: 'pray' }).c.traits.filter(t => t.kind === 'TPT').length, 2);
});
test('Enemy Block: when it is Off-Balance its Block only halves your hit', () => {
  const s = force(act(fight(), { action: 'pray' }), 'w2-guard');
  s.cb.enemy.conditions.push({ id: 'offBalance', until: s.cb.exchange });
  eq(act(s, { action: 'attack', target: 'head' }).cb.enemy.stamina.STR, WOLF.STR - 2, 'sword 3, halved up to 2');
});
test('Flinch: after a hard hit it may flinch, and its main move Blocks the spot just hit', () => {
  let s = act(fight(), { action: 'pray' });                 // w2: bite (Fair) vs sword (Fair)
  s = act(s, { action: 'attack', target: 'legs' });          // sword lands 3 on the legs: a hard hit
  const opts = s.cb.current.options;
  const fl = opts.find(o => o.step.when === 'flinch');
  ok(fl, 'flinch is possible');
  eq(fl.p, ENEMIES.werewolf.flinchChance);
  eq(fl.step.variants[0].action, 'block'); eq(fl.step.variants[0].target, 'legs');
  eq(C.variantTells(ENEMIES.werewolf, fl.step, fl.step.variants[0]), ['It flinches from the blow', 'It pulls its legs in']);
});
test('Flinch: never twice running', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'attack', target: 'legs' }, 'flinch-block-legs');
  eq(s.cb.current.stepId, 'flinch');
  s = act(s, { action: 'attack', target: 'head' });          // lands 3 on the head while it guards its legs
  ok(!s.cb.current.options.some(o => o.step.when === 'flinch'), 'no second flinch');
});
test('Flinch: an ordinary hit below the hard-hit mark does not cause one', () => {
  const s = act(fight(), { action: 'attack', target: 'left' });  // sword slowed: 1 damage
  ok(!s.cb.current.options.some(o => o.step.when === 'flinch'), 'no flinch');
});
test('Guard: attacking the same spot in 2 of your last 3 exchanges makes it likely to Block there', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  s = act(s, { action: 'block', target: 'head' });
  s = act(s, { action: 'attack', target: 'left' });
  const g = s.cb.current.options.find(o => o.step.when === 'guard');
  ok(g, 'guard is possible');
  ok(Math.abs(g.p - ENEMIES.werewolf.guardChance) < 1e-9, 'at its guard chance');
  eq(g.step.variants[0], { id: 'guard-block-left', second: 'block-left', action: 'block', target: 'left' });
});
test('Guard: the barrow knight guards more readily than the werewolf', () => {
  ok(ENEMIES.barrowKnight.guardChance > ENEMIES.werewolf.guardChance, 'guard chance');
  eq(C.focusTarget([{ action: 'attack', target: 'legs' }, { action: 'pray', target: null }, { action: 'ability:planB', target: 'legs' }]), 'legs');
  eq(C.focusTarget([{ action: 'attack', target: 'legs' }, { action: 'attack', target: 'head' }, { action: 'block', target: 'legs' }]), null);
});
test('Blocking: the barrow knight blocks far more often than the werewolf', () => {
  let wolf = 0, knight = 0, wolfN = 0, knightN = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = createRng(seed);
    const w = simulateFight({ seed, enemyId: 'werewolf', policy: randomPolicy(rng), clashPick: randomClash(rng) }).stats;
    const k = simulateFight({ seed, enemyId: 'barrowKnight', policy: randomPolicy(rng), clashPick: randomClash(rng) }).stats;
    wolf += w.enemyBlocks; wolfN += w.exchanges; knight += k.enemyBlocks; knightN += k.exchanges;
  }
  ok(knight / knightN > 2 * (wolf / wolfN), `knight ${(knight / knightN).toFixed(2)}, werewolf ${(wolf / wolfN).toFixed(2)}`);
  ok(wolf > 0, 'the werewolf blocks now and then');
});

// --- Repetition counter -----------------------------------------------------------------

test('Repetition: the same action and target two exchanges running makes its next step a counter', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  s = act(s, { action: 'attack', target: 'left' });
  eq(step(s), 'counter');
  eq(s.cb.current.caption, 'It has read your rhythm.');
  eq(s.cb.current.tells, ['It watches your every move']);
});
test('Repetition: the counter is a fast attack with Advantage (claws 2 → 3, +1 = 4)', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  s = act(s, { action: 'attack', target: 'left' }, 'counter-legs');
  const r = act(s, { action: 'pray' });
  eq(totalStamina(s.c) - totalStamina(r.c), 4);
  ok(r.lines.some(l => l.includes('claws')), 'uses its fastest weapon');
});
test('Repetition: after repeated Blocks, the counter never aims at the guarded target', () => {
  let s = act(fight(), { action: 'block', target: 'head' });
  s = act(s, { action: 'block', target: 'head' });
  eq(step(s), 'counter');
  ok(!C.stepFor(s.cb).variants.some(v => v.target === 'head'), 'head is never the target');
  eq(C.stepFor(s.cb).variants.length, 3);
});
test('Repetition: praying twice running also draws a counter', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'pray' });
  eq(step(s), 'counter');
});
test('Repetition: changing the action or the target avoids the counter', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  ok(step(act(s, { action: 'attack', target: 'right' })) !== 'counter', 'different target');
  ok(step(act(s, { action: 'block', target: 'left' })) !== 'counter', 'different action');
});
test('Repetition: a counter does not move the pattern on; the loop resumes where it was', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });  // w1 → w2
  s = act(s, { action: 'attack', target: 'left' });            // w2 → counter
  eq(step(s), 'counter');
  s = act(s, { action: 'block', target: 'right' });            // counter → w3
  eq(step(s), 'w3');
});

// --- 4. Speed ---------------------------------------------------------------------

test('Speed: the slower side takes Disadvantage (sword, Fair, vs claws, Swift: 3 → 1)', () => {
  eq(act(fight(), { action: 'attack', target: 'left' }).cb.enemy.stamina.STR, WOLF.STR - 1);
});
test('Speed: dagger (Swift) vs bite (Fair): the bite is halved', () => {
  const s = holdDagger(act(fight(), { action: 'pray' }));   // w2 main: bite
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.c.attrs.STR.stamina, s.c.attrs.STR.stamina - 2, 'bite 3 halved to 1, +1');
  eq(r.cb.enemy.stamina.AGI, WOLF.AGI - 2, 'dagger 1 + AGI 6 ÷ 5');
});
test('Speed: Plan B gives the next action a Speed disadvantage', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'ability', abilityId: 'planB', target: 'legs' });
  ok(s.cb.player.speedPenaltyNext, 'penalty set');
  eq(s.cb.player.weaponIndex, 1, 'switched to the dagger');
  const r = act(s, { action: 'attack', target: 'left' });   // w3 claws: dagger slowed to Fair
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
  let s = act(fight(), { action: 'pray' }); s = holdDagger(act(s, { action: 'block', target: 'left' }));  // w3 claws right
  const r = act(s, { action: 'attack', target: 'left' });
  eq(staminaOf(r.c), staminaOf(s.c)); eq(r.cb.enemy.stamina, s.cb.enemy.stamina);
  ok(r.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  ok(r.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'enemy Off-Balance');
});
test('Off-Balance: Disadvantage on the next exchange only, then it clears', () => {
  let s = act(fight(), { action: 'pray' }); s = holdDagger(act(s, { action: 'block', target: 'left' }));
  s = act(s, { action: 'attack', target: 'left' });     // Clank at w3; now w4 (bite head)
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.cb.enemy.stamina.AGI, s.cb.enemy.stamina.AGI - 1, 'dagger 2 halved');
  eq(r.c.attrs.STR.stamina, s.c.attrs.STR.stamina - 2, 'bite 3 halved to 1, +1');
  eq(r.cb.player.conditions, [], 'cleared');
});
test('No interaction: dagger at Head vs claws at Legs, both hit', () => {
  const r = act(holdDagger(fight()), { action: 'attack', target: 'head' });
  eq(r.cb.enemy.stamina.AGI, WOLF.AGI - 2);
  eq(r.c.attrs.AGI.stamina, 6 - 3);
});

// --- 6. Clash -------------------------------------------------------------------------

test('Clash: the same label at equal speed opens a Clash and deals no damage', () => {
  const s = holdDagger(fight());
  const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'legs' });
  ok(r.combat.pendingClash, 'Clash waiting');
  eq(r.combat.pendingClash.enemyDir, 'legs', 'from the variant');
  throws(() => C.submitAction(r.character, r.combat, { action: 'pray' }), 'must answer the Clash first');
  const done = C.submitClash(r.character, r.combat, 'head');
  eq(staminaOf(done.character), staminaOf(s.c)); eq(done.combat.enemy.stamina, s.cb.enemy.stamina);
});
test('Clash won: Advantage on your next attack; the enemy is Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });           // w2 bite head (Fair)
  s = act(s, { action: 'attack', target: 'head' });  // sword Fair vs bite Fair: Clash
  s = clash(s, 'head');
  ok(s.cb.player.advantageNext, 'Advantage');
  ok(s.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'enemy Off-Balance');
  // w3: sword (slower, but Advantage) → full 3; claws Off-Balance 2 → 1, +1.
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina.STR, WOLF.STR - 3);
  eq(totalStamina(s.c) - totalStamina(r.c), 2);
});
test('Clash lost: the enemy gets Advantage and you are Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'attack', target: 'head' });
  s = clash(s, 'legs');
  ok(s.cb.enemy.advantageNext, 'enemy Advantage');
  ok(s.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  const r = act(s, { action: 'pray' });  // claws 2 with Advantage → 3, +1
  eq(totalStamina(s.c) - totalStamina(r.c), 4);
});

// --- 7. Resolve --------------------------------------------------------------------------

test('Block: Off-Balance only halves the damage (rounded up)', () => {
  const s = fight(); s.cb.player.conditions.push({ id: 'offBalance', until: 1 });
  eq(act(s, { action: 'block', target: 'legs' }).c.attrs.AGI.stamina, 6 - 2);
});
test('Overflow: claws for 3 into 1 AGI spill 2 into STR', () => {
  const s = fight(); s.c.attrs.AGI.stamina = 1;
  const r = act(s, { action: 'pray' });
  eq(r.c.attrs.AGI.stamina, 0); eq(r.c.attrs.STR.stamina, 8 - 2);
});
test('Empty stamina: acting with a pool at 0 lowers its Natural total', () => {
  const s = fight(); s.c.attrs.WIS.stamina = 0;
  eq(act(s, { action: 'block', target: 'legs' }).c.attrs.WIS.natural, 5);
});
test('Pray: one TPT when the enemy attacks', () => {
  eq(act(fight(), { action: 'pray' }).c.traits.filter(t => t.kind === 'TPT').length, 1);
});
test('Pray: Emboldened gives Advantage on the next attack, then is used up', () => {
  const s = act(fight(), { action: 'pray' });   // w2 bite, Fair
  s.c.traits = s.c.traits.filter(t => t.kind !== 'TPT').concat([{ id: 'emboldened', kind: 'TPT' }]);
  const r = act(s, { action: 'attack', target: 'legs' });   // sword 3 → 5
  eq(r.cb.enemy.stamina.STR, WOLF.STR - 5);
  ok(!r.c.traits.some(t => t.id === 'emboldened'), 'used');
});
test('Pray: Blessed makes the next hit 25% lighter', () => {
  const s = fight(); s.c.traits.push({ id: 'blessed', kind: 'TPT' });
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 1 } }); force(s);  // bite 4
  eq(act(s, { action: 'block', target: 'legs' }).c.attrs.STR.stamina, 8 - 3);
});
test('Pray: Steeled ignores the next TNT (Off-Balance from a Clank)', () => {
  let s = act(fight(), { action: 'pray' }); s = holdDagger(act(s, { action: 'block', target: 'left' }));
  s.c.traits = [{ id: 'steeled', kind: 'TPT' }];
  eq(act(s, { action: 'attack', target: 'left' }).cb.player.conditions, []);
});
test('Item: a herbal draught gives +4 to the lowest pool and is used up', () => {
  const s = fight(); s.c.attrs.WIS.stamina = 1;
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 1 } }); force(s);
  let r = act(s, { action: 'item' });
  eq(r.c.attrs.WIS.stamina, 5);
  eq(r.c.pack, [{ itemId: 'herbalDraught', qty: 1 }]);
  r = act(r, { action: 'block', target: 'left' });
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
  // sword 3 × 1.5 = 5, Heavy helm −2 = 3
  eq(act(s, { action: 'ability', abilityId: 'crusher', target: 'head' }).cb.enemy.stamina.STR, KNIGHT.STR - 3);
});
test('Cooldowns: Plan B (Fair) is unavailable for 2 exchanges, Crusher (Drawn) for 3', () => {
  let s = act(fight(), { action: 'ability', abilityId: 'planB', target: 'head' });
  const avail = [];
  const moves = [{ action: 'pray' }, { action: 'block', target: 'left' }];
  for (let i = 0; i < 3; i++) { avail.push(C.availableActions(s.c, s.cb).abilities[0].enabled); s = act(s, moves[i % 2]); }
  eq(avail, [false, false, true]);
  const used = act(fight(), { action: 'ability', abilityId: 'planB', target: 'head' });
  throws(() => C.submitAction(used.c, used.cb, { action: 'ability', abilityId: 'planB', target: 'head' }), 'refused while cooling down');
  let k = act(fight('barrowKnight', 'crusher'), { action: 'ability', abilityId: 'crusher', target: 'legs' });
  const av2 = [];
  for (let i = 0; i < 4; i++) { av2.push(C.availableActions(k.c, k.cb).abilities[0].enabled); k = act(k, moves[i % 2]); }
  eq(av2, [false, false, false, true]);
});
test('Barrow Knight: Block → Legs (main action) stops an attack at the legs', () => {
  const s = act(fight('barrowKnight'), { action: 'block', target: 'head' });
  eq(s.cb.current.caption, 'It plants its feet, blade low.');
  eq(act(s, { action: 'attack', target: 'legs' }).cb.enemy.stamina, s.cb.enemy.stamina);
});
test('Barrow Knight: the trick (step 4) looks like step 1 but its main swing goes for your legs', () => noHiding(() => {
  let s = act(fight('barrowKnight'), { action: 'block', target: 'head' });  // k1 → k3
  s = act(s, { action: 'pray' });                                          // k3 → k4
  eq(step(s), 'k4');
  eq(s.cb.current.caption, 'The visor turns to your head.');
  const k1 = ENEMIES.barrowKnight.pattern[0], k4 = ENEMIES.barrowKnight.pattern[3];
  eq(k4.first, k1.first, 'same first clue');
  eq(k4.variants[0].second, k1.variants[0].second, 'same second clue: only counting tells them apart');
  eq(staminaOf(act(s, { action: 'block', target: 'legs' }).c), staminaOf(s.c));
}));

// --- Fortune and lucky attempts ----------------------------------------------------------

function findLucky(wantSuccess) {
  for (let seed = 1; seed < 20000; seed++) {
    const c = practiceFighter();
    const cb = C.startCombat(c, 'werewolf', { seed });
    if (!cb.current.fortune.open) continue;
    const r = C.submitAction(c, cb, { action: 'attack', target: 'right', lucky: true });
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
  const plain = C.submitAction(c, { ...cb, current: { ...cb.current, fortune: { open: false } } }, { action: 'attack', target: 'right' });
  eq(WOLF.STR - r.combat.enemy.stamina.STR, 2 * (WOLF.STR - plain.combat.enemy.stamina.STR));
});
test('Lucky attempt failure: the enemy gets a free attack and you become Off-Balance', () => {
  const { c, r } = findLucky(false);
  eq(totalStamina(c) - totalStamina(r.character), 6, 'two claw hits of 3');
  ok(r.combat.player.conditions.some(x => x.id === 'offBalance'), 'Off-Balance');
});
test('Lucky attempt: does nothing without an opening', () => {
  const s = fight();
  const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'left', lucky: true });
  ok(!r.lines.some(l => l.includes('d20')), 'no dice without an opening');
});

// --- Durability, defeat, fatigue ----------------------------------------------------------------

test('Durability: a Block wears your weapon, a hit wears the armor on that slot, a Clank wears your weapon', () => {
  eq(act(fight(), { action: 'block', target: 'legs' }).c.durability.sword, 19);
  let s = act(fight(), { action: 'pray' }); s = act(s, { action: 'block', target: 'left' });  // w3 claws right
  eq(act(s, { action: 'pray' }).c.durability.leatherJerkin, 19);
  eq(act(holdDagger(s), { action: 'attack', target: 'left' }).c.durability.dagger, 19);
});
test('Victory when all four of its pools reach 0', () => {
  const s = act(fight(), { action: 'pray' });
  s.cb.enemy.stamina = { STR: 2, AGI: 0, WIS: 0, FAI: 0 };
  eq(act(s, { action: 'attack', target: 'legs' }).cb.outcome, 'victory');
});
test('Defeat when all four of your pools reach 0', () => {
  const s = fight();
  Object.assign(s.c.attrs.STR, { stamina: 0 }); s.c.attrs.AGI.stamina = 2; s.c.attrs.WIS.stamina = 0; s.c.attrs.FAI.stamina = 0;
  eq(act(s, { action: 'pray' }).cb.outcome, 'defeat');
});
test('After the fight: combat fatigue by the attributes you used', () => {
  let s = fight();
  for (const m of [{ action: 'block', target: 'legs' }, { action: 'pray' }, { action: 'attack', target: 'head' },
                   { action: 'block', target: 'legs' }, { action: 'block', target: 'right' }]) s = act(s, m);
  eq(s.cb.player.usage, { STR: 1, AGI: 0, WIS: 3, FAI: 1 });
  eq(C.finishCombat(practiceFighter(), s.cb).fatigue, { STR: 1, AGI: 0, WIS: 2, FAI: 1 });
});
test('Same seed and same choices replay the same fight, feints included', () => {
  const run = () => {
    const rng = createRng(5);
    return simulateFight({ seed: 77, policy: randomPolicy(rng), clashPick: randomClash(rng) }).combat.log;
  };
  eq(JSON.stringify(run()), JSON.stringify(run()));
});

// --- Balance (slow: run on a computer with node tests/run-node.js) ---------------------------

for (const enemyId of ['werewolf', 'barrowKnight']) {
  slowTest(`Balance (${enemyId}): a player who knows the pattern wins about 7 fights in 12; random buttons almost never win; about 1 exchange in 4 or 5 shows no clue`, () => {
    const N = 150;
    let learned = 0, random = 0, length = 0, ex = 0, noClue = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash });
      if (r.outcome === 'victory') learned++;
      length += r.exchanges; ex += r.stats.exchanges; noClue += r.stats.noClue;
      const rng = createRng(seed * 7919);
      if (simulateFight({ seed, enemyId, policy: randomPolicy(rng), clashPick: randomClash(rng) }).outcome === 'victory') random++;
    }
    ok(learned / N >= 0.45 && learned / N <= 0.72, `learned wins ${(100 * learned / N).toFixed(0)}% (expect ~58%; full check: node tests/balance.js)`);
    ok(random / N < 0.1, `random wins ${(100 * random / N).toFixed(0)}%`);
    ok(length / N >= 10 && length / N <= 20, `average ${(length / N).toFixed(1)} exchanges`);
    ok(noClue / ex >= 0.15 && noClue / ex <= 0.3, `no clue in ${(100 * noClue / ex).toFixed(0)}% of exchanges (aim: 1 in 4 or 5)`);
  });
}
