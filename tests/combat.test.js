// Automatic tests for the combat exchange loop (Build Spec → "Combat resolution",
// "Enemy patterns", feints, the repetition counter, and the Step 2 phone checks).
//
// Most tests pin the enemy to the MAIN move of its normal pattern step with
// force() (not a feint, a flinch, or a guard), so the rules can be checked
// exactly; the feint, hiding, and blocking tests pick on purpose.

import { test as baseTest, slowTest, eq, ok, throws } from './harness.js';
import * as C from '../engine/combat.js';
import { staminaOf, MISS, missChance, luckOf as luckOfC, TELLS, tellWorkChance } from '../engine/rules.js';
import * as Rules from '../engine/rules.js';
import * as S from '../engine/state.js';
import { ENEMIES } from '../data/enemies.js';
import { ARMOR } from '../data/items.js';
import { ABILITIES } from '../data/abilities.js';
import { practiceFighter, simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, createRng } from './sim.js';
import { summarize } from './balance.js';

// Chance misses are switched off in most tests so damage can be checked
// exactly (situational misses still apply). missTest runs with them on.
function noChanceMisses(fn) {
  const saved = { ...MISS };
  Object.assign(MISS, { level: 0, perPoint: 0, ahead: 0, enraged: 0 });
  try { return fn(); } finally { Object.assign(MISS, saved); }
}
// Enemies always take their usual Clash direction in most tests, so Clash
// outcomes are exact; the Clash-habit test checks the rest.
function usualClashes(fn) {
  const saved = Object.values(ENEMIES).map(e => e.clashHabit);
  Object.values(ENEMIES).forEach(e => { e.clashHabit = 1; });
  try { return fn(); } finally { Object.values(ENEMIES).forEach((e, i) => { e.clashHabit = saved[i]; }); }
}
const test = (name, fn) => baseTest(name, () => noChanceMisses(() => usualClashes(fn)));
const missTest = baseTest;

const WOLF = ENEMIES.werewolf.attrs;     // { STR: 7, AGI: 7, WIS: 3, FAI: 2 }
const KNIGHT = ENEMIES.barrowKnight.attrs;
// Enemy hit damage, worked out from the enemy settings so tuning can't break the tests:
// weapon tier (Light 1, Medium 2, Heavy 3) + attribute ÷ 5, then the enemy's damage bonus.
const WB = ENEMIES.werewolf.damageBonus, KB = ENEMIES.barrowKnight.damageBonus;
const CLAW_BASE = 1 + Math.floor(WOLF.AGI / 5), BITE_BASE = 2 + Math.floor(WOLF.STR / 5), GS_BASE = 3 + Math.floor(KNIGHT.STR / 5);
const CLAW = CLAW_BASE + WB, BITE = BITE_BASE + WB;
const adv = (base, bonus) => Math.ceil(base * 1.5) + bonus;     // with Advantage
const half = (base, bonus) => Math.floor(base / 2) + bonus;     // with Disadvantage

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
// Run a test with tell sources always working (when the player has one).
function tellsAlways(fn) {
  const saved = { ...TELLS };
  Object.assign(TELLS, { workLo: 1, workHi: 1 });
  try { return fn(); } finally { Object.assign(TELLS, saved); }
}
// Tells only come from sources now, so most tests see none; kept for clarity.
const noHiding = (fn) => fn();
// Give a fighter a pretend tell source of some strength (for tests only).
function withSource(strength, fn) {
  ARMOR.leatherJerkin.tell = strength;
  try { return fn(); } finally { delete ARMOR.leatherJerkin.tell; }
}
const focusedFighter = () => { const c = practiceFighter(); c.traits.push({ id: 'focused', kind: 'TPT', left: 3, gainedAt: 0 }); return c; };
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
// Remove any blessings Pray happened to grant, so damage can be checked exactly.
const plain = (s) => { s.c.traits = s.c.traits.filter(t => t.kind !== 'TPT'); return s; };
const step = (s) => s.cb.current.stepId;
const totalStamina = (c) => Object.values(staminaOf(c)).reduce((a, b) => a + b, 0);

// --- 1. Enemy commits, 2. clues ------------------------------------------------

test('Werewolf opens with step 1: “Its eyes drop to your legs.”', () => {
  const s = fight();
  eq(step(s), 'w1');
  ok(ENEMIES.werewolf.neutralCaptions.includes(s.cb.current.caption), 'a neutral caption');
});
// --- Tells: none by default; only from a source ------------------------------------------

test('Tells: none by default; the caption is neutral and doesn’t depend on the move', () => {
  const captions = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const cb = C.startCombat(practiceFighter(), 'werewolf', { seed });
    eq(cb.current.tells, []);
    eq(cb.current.tell, null);
    ok(ENEMIES.werewolf.neutralCaptions.includes(cb.current.caption), cb.current.caption);
    captions.add(cb.current.caption + '|' + cb.current.variantId);
  }
  const byCaption = {};
  for (const k of captions) { const [cap, v] = k.split('|'); (byCaption[cap] ||= new Set()).add(v); }
  ok(Object.values(byCaption).every(set => set.size >= 2), 'each caption shows up with different moves');
});
test('Tells: Focused gives reverse tells (“It’s avoiding…”) for 3 exchanges, then stops', () => tellsAlways(() => {
  let c = focusedFighter(), cb = C.startCombat(c, 'werewolf', { seed: 2 });
  const got = [];
  const moves = [{ action: 'block', target: 'head' }, { action: 'pray' }, { action: 'block', target: 'left' }, { action: 'block', target: 'right' }];
  for (const m of moves) {
    got.push(cb.current.tells.length);
    if (cb.current.tell) ok(cb.current.tell.text.startsWith("It's avoiding "), cb.current.tell.text);
    const r = C.submitAction(c, cb, m); c = { ...r.character, traits: r.character.traits.filter(t => t.id === 'focused') }; cb = r.combat;
  }
  eq(got, [1, 1, 1, 0]);
}));
test('Tells: Pray can grant Focused, lasting 3 exchanges', () => {
  for (let seed = 1; seed < 400; seed++) {
    const s = fight('werewolf', 'planB', seed);
    const r = C.submitAction(s.c, s.cb, { action: 'pray' });
    const f = r.character.traits.find(t => t.id === 'focused');
    if (f) { eq(f.left, 3); return; }
  }
  throw new Error('Pray never granted Focused');
});
test('Tells: always true — a reverse tell never rules out the spot it attacks', () => tellsAlways(() => {
  for (let seed = 1; seed <= 400; seed++) {
    const cb = C.startCombat(focusedFighter(), 'werewolf', { seed });
    const mv = C.moveFor(cb);
    eq(cb.current.tell.level, 1);
    eq(cb.current.tell.ruledOut.length, 1);
    if (mv.action === 'attack') ok(!cb.current.tell.ruledOut.includes(mv.target), `${mv.id}: ${cb.current.tell.text}`);
  }
}));
test('Tells: a narrow source leaves two options, and the true one is always among them', () => tellsAlways(() => withSource('narrow', () => {
  for (const enemyId of ['werewolf', 'barrowKnight']) {
    for (let seed = 1; seed <= 300; seed++) {
      const cb = C.startCombat(practiceFighter(), enemyId, { seed });
      const mv = C.moveFor(cb), t = cb.current.tell;
      eq(t.level, 2); eq(t.ruledOut.length, 2);
      if (mv.action === 'attack') {
        ok(!t.ruledOut.includes(mv.target) && t.text.startsWith("It's going for "), t.text);
      } else {
        ok(t.text.startsWith("It won't strike "), t.text);
      }
    }
  }
})));
test('Tells: only an exact source names the move', () => tellsAlways(() => withSource('exact', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const cb = C.startCombat(practiceFighter(), 'barrowKnight', { seed });
    const mv = C.moveFor(cb), t = cb.current.tell;
    eq(t.exact, { action: mv.action, target: mv.target || null });
    seen.add(t.text);
  }
  ok([...seen].some(x => x.startsWith("It's going for ")), [...seen].join(' / '));
  // A Block (the knight guarding its legs after it is Blocked) is named too.
  eq(C.moveTell(3, { action: 'block', target: 'legs' }, createRng(1)).text, 'It will guard its legs instead of striking.');
})));
test('Tells: the strongest source a fighter has is the one used', () => withSource('narrow', () => {
  const c = focusedFighter();
  const ts = C.tellSources(c);
  eq(ts.sources.map(x => x.strength), ['narrow', 'reverse']);
  eq(ts.best.strength, 'narrow');
}));
test('Tells: Dazed blocks all tells, even with Focused', () => tellsAlways(() => {
  const c = focusedFighter(); c.traits.push({ id: 'dazed', kind: 'TNT' });
  for (let seed = 1; seed <= 50; seed++) eq(C.startCombat(c, 'werewolf', { seed }).current.tells, []);
  eq(C.readingLabel(c, C.startCombat(c, 'werewolf', { seed: 1 })).label, 'blocked (Dazed)');
}));
test('Tells: one step weaker at Night (Focused gives nothing; narrow becomes reverse)', () => tellsAlways(() => {
  eq(C.startCombat(focusedFighter(), 'werewolf', { seed: 1, timeOfDay: 'Night' }).current.tells, []);
  withSource('narrow', () => {
    eq(C.startCombat(practiceFighter(), 'werewolf', { seed: 1, timeOfDay: 'Night' }).current.tell.level, 1);
  });
}));
function tellRate(character, enemyId, N = 2000, setup = null) {
  let n = 0;
  for (let seed = 1; seed <= N; seed++) {
    let cb = C.startCombat(character, enemyId, { seed });
    if (setup) cb = C.beginExchange(character, setup(cb));
    if (cb.current.tell) n++;
  }
  return n / N;
}
test('Tells: how often a source works comes from the WIS + FAI comparison', () => {
  const c = focusedFighter();
  const expect = C.readingFor(c, C.startCombat(c, 'werewolf', { seed: 1 })).workChance;
  const got = tellRate(c, 'werewolf', 3000);
  ok(Math.abs(got - expect) < 0.03, `${got} vs ${expect}`);
  const sage = focusedFighter(); for (const k of ['WIS', 'FAI']) { sage.attrs[k].natural = 18; sage.attrs[k].stamina = 18; }
  const dull = focusedFighter(); dull.attrs.WIS.stamina = 0; dull.attrs.FAI.stamina = 0;
  const hi = tellRate(sage, 'werewolf'), lo = tellRate(dull, 'werewolf');
  ok(hi > got && got > lo, `lead ${hi} > human ${got} > deficit ${lo}`);
  ok(hi < 1 && lo > 0, 'never always, never never');
});
test('Tells: a worn-down enemy is easier to read; an Enraged one harder', () => {
  const c = focusedFighter();
  const fresh = C.readingFor(c, C.startCombat(c, 'barrowKnight', { seed: 1 })).workChance;
  const cb = C.startCombat(c, 'barrowKnight', { seed: 1 });
  const worn = C.readingFor(c, { ...cb, enemy: { ...cb.enemy, stamina: { ...cb.enemy.stamina, WIS: 0 } } }).workChance;
  const wild = C.readingFor(c, { ...cb, enemy: { ...cb.enemy, enraged: true } }).workChance;
  ok(worn > fresh && wild < fresh, `${worn} > ${fresh} > ${wild}`);
});
test('Tells: any future ability, trait, or item becomes a source just by its data', () => {
  ABILITIES.fortunesFavor.tell = 'exact';   // pretend, for this test only
  try {
    const c = practiceFighter(); c.abilities.push('fortunesFavor');
    eq(C.tellSources(c).best.strength, 'exact');
  } finally { delete ABILITIES.fortunesFavor.tell; }
  eq(C.tellSources(practiceFighter()).best, null, 'a plain Fighter has no source');
});
test('Tells: Clash events give no clue unless a source does; a Clash tell is true', () => {
  const plainClash = () => { const s = act(fight(), { action: 'pray' }); plain(s); return C.submitAction(s.c, s.cb, { action: 'attack', target: 'head' }).combat.pendingClash; };
  eq(plainClash().tells, []);
  tellsAlways(() => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = fight('werewolf', 'planB', seed);
      const b = act({ c: focusedFighter(), cb: s.cb }, { action: 'block', target: 'right' }, 'w2-head');
      b.c.traits = focusedFighter().traits;
      const pc = C.submitAction(b.c, b.cb, { action: 'attack', target: 'head' }).combat.pendingClash;
      ok(pc && pc.tell && !pc.tell.ruledOut.includes(pc.enemyDir), pc && pc.tell && pc.tell.text);
    }
  });
});
test('Reading label: “no tells” without a source; good / fair / poor with one; none at Night', () => {
  const cb = C.startCombat(practiceFighter(), 'werewolf', { seed: 1 });
  eq(C.readingLabel(practiceFighter(), cb).label, 'no tells');
  eq(C.readingLabel(focusedFighter(), cb).label, 'good');
  const dull = focusedFighter(); dull.attrs.WIS.stamina = 0; dull.attrs.FAI.stamina = 1;
  eq(C.readingLabel(dull, cb).label, 'poor');
  eq(C.readingLabel(focusedFighter(), { ...cb, timeOfDay: 'Night' }).label, 'no tells at Night');
});

// --- Feints -------------------------------------------------------------------------

test('Feints: every step has a main move and one or two feints; each enemy has neutral captions', () => {
  for (const e of Object.values(ENEMIES)) {
    for (const st of e.pattern) {
      ok(st.variants.length >= 1 && st.variants.length <= 3, `${st.id} has 0–2 feints`);
      eq(new Set(st.variants.map(v => v.id)).size, st.variants.length, `${st.id} move ids differ`);
    }
    ok(e.neutralCaptions.length >= 2, `${e.id} has neutral captions`);
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
  eq(legs.c.attrs.AGI.stamina, 6 - CLAW);
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
test('Not blocking: the claws rake your legs', () => {
  eq(act(fight(), { action: 'pray' }).c.attrs.AGI.stamina, 6 - CLAW);
});
test('After it is Blocked, the werewolf jumps to step 2 (jaws at your throat)', () => {
  const r = act(fight(), { action: 'block', target: 'legs' });
  eq(step(r), 'w2');
});
test('Blocking step 2 does not loop step 2 forever: it moves on to step 3', () => {
  let s = act(fight(), { action: 'block', target: 'legs' });
  s = act(s, { action: 'block', target: 'head' });
  eq(step(s), 'w3');
});
test('Phone check: when it circles to your right (main action), Block → Right stops the hit', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'block', target: 'left' });
  eq(step(s), 'w3');
  const r = act(s, { action: 'block', target: 'right' });
  eq(staminaOf(r.c), staminaOf(s.c));
});
test('Phone check: the crouching trick (main action) bites your Head, not your legs', () => {
  let s = fight();
  for (const m of [{ action: 'pray' }, { action: 'block', target: 'left' }, { action: 'pray' }]) s = act(s, m);
  eq(step(s), 'w4');
  ok(totalStamina(act(s, { action: 'block', target: 'legs' }).c) < totalStamina(s.c), 'blocking legs fails');
  eq(staminaOf(act(s, { action: 'block', target: 'head' }).c), staminaOf(s.c));
});
test('Below half stamina: it howls at the moon, becomes Enraged, once only', () => {
  let s = fight();
  s.cb.enemy.stamina = { STR: 2, AGI: 2, WIS: 2, FAI: 2 };
  s.cb = C.beginExchange(s.c, s.cb); force(s);
  eq(step(s), 'w5');
  s = act(s, { action: 'pray' });
  ok(s.cb.enemy.enraged, 'Enraged');
  ok(step(s) !== 'w5', 'not repeated');
  eq(s.c.traits.filter(t => t.kind === 'TPT').length, 2, 'Pray gives two TPTs when the enemy took no offensive action');
});
test('Enraged: its attacks deal 1 more damage (and it hides more often: see Hiding)', () => noHiding(() => {
  const s = fight(); s.cb.enemy.enraged = true;
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 0 } }); force(s);
  eq(act(s, { action: 'pray' }).c.attrs.AGI.stamina, 6 - (CLAW + 1));
}));

// --- Enemy blocks ---------------------------------------------------------------------------

test('Enemy Block: a Block on the spot you attack stops your hit; another spot still lands', () => {
  let s = act(fight(), { action: 'pray' }, null);     // to w2
  s = force(s, 'w2-guard');                           // its feint: Block → Head
  eq(act(s, { action: 'attack', target: 'head' }).cb.enemy.stamina, s.cb.enemy.stamina);
  ok(act(s, { action: 'attack', target: 'legs' }).cb.enemy.stamina.STR < s.cb.enemy.stamina.STR, 'legs hit');
});
test('Enemy Block: a tell source can show a Block coming, so you can attack somewhere else', () => tellsAlways(() => withSource('exact', () => {
  let s = act(fight(), { action: 'pray' }, 'w2-guard');
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: s.cb.exchange - 1, player: { ...s.cb.player, history: [] }, enemy: { ...s.cb.enemy, loopIndex: 1, lastStepId: null } });
  s = force(s, 'w2-guard');
  const t = C.moveTell(3, C.moveFor(s.cb), { next: () => 0 });
  eq(t.text, 'It will guard its head instead of striking.');
})));
test('Enemy Block: while it blocks it isn’t attacking, so Pray gives two blessings', () => {
  const s = force(act(fight(), { action: 'pray' }), 'w2-guard');
  s.c.traits = s.c.traits.filter(t => t.kind !== 'TPT');
  eq(act(s, { action: 'pray' }).c.traits.filter(t => t.kind === 'TPT').length, 2);
});
test('Enemy Block: when it is Off-Balance its Block only halves your hit', () => {
  const s = plain(force(act(fight(), { action: 'pray' }), 'w2-guard'));
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
  eq(g.step.variants[0], { id: 'guard-block-left', action: 'block', target: 'left' });
});
test('Guard: both enemies guard a spot you keep striking', () => {
  ok(ENEMIES.barrowKnight.guardChance > 0 && ENEMIES.werewolf.guardChance > 0, 'guard chance');
  eq(C.focusTarget([{ action: 'attack', target: 'legs' }, { action: 'pray', target: null }, { action: 'ability:planB', target: 'legs' }]), 'legs');
  eq(C.focusTarget([{ action: 'attack', target: 'legs' }, { action: 'attack', target: 'head' }, { action: 'block', target: 'legs' }]), null);
});
test('Blocking: the barrow knight blocks more often than the werewolf', () => {
  let wolf = 0, knight = 0, wolfN = 0, knightN = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = createRng(seed);
    const w = simulateFight({ seed, enemyId: 'werewolf', policy: randomPolicy(rng), clashPick: randomClash(rng) }).stats;
    const k = simulateFight({ seed, enemyId: 'barrowKnight', policy: randomPolicy(rng), clashPick: randomClash(rng) }).stats;
    wolf += w.enemyBlocks; wolfN += w.exchanges; knight += k.enemyBlocks; knightN += k.exchanges;
  }
  ok(knight / knightN > 1.2 * (wolf / wolfN), `knight ${(knight / knightN).toFixed(2)}, werewolf ${(wolf / wolfN).toFixed(2)}`);
  ok(wolf > 0, 'the werewolf blocks now and then');
});

// --- Misses ------------------------------------------------------------------------------------

missTest('Miss chance: 3% when level, +1.2% per point the defender is ahead, 2% when the attacker is ahead, never over 20%', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  ok(near(missChance({ attackerAgi: 6, attackerLuck: 8, defenderAgi: 6, defenderLuck: 8 }), 0.03), 'level');
  ok(near(missChance({ attackerAgi: 6, attackerLuck: 4, defenderAgi: 6, defenderLuck: 9 }), 0.03 + 0.012 * 5), 'defender 5 ahead');
  ok(near(missChance({ attackerAgi: 9, attackerLuck: 8, defenderAgi: 2, defenderLuck: 0 }), 0.02), 'attacker ahead');
  ok(near(missChance({ attackerAgi: 0, attackerLuck: 0, defenderAgi: 30, defenderLuck: 30 }), 0.2), 'capped at 20%');
});
missTest('Miss chance: Enraged attackers miss more often (still capped at 20%)', () => {
  const base = { attackerAgi: 7, attackerLuck: 6, defenderAgi: 6, defenderLuck: 8 };
  ok(missChance({ ...base, enraged: true }) > missChance(base) + 0.07, 'more likely');
  ok(missChance({ attackerAgi: 0, defenderAgi: 40, defenderLuck: 20, enraged: true }) <= 0.2, 'cap');
});
missTest('Miss chance: stays between 2% and 20% for every starting Fighter against both enemies', () => {
  for (const race of ['halfling', 'goblin', 'dwarf', 'elf', 'gnome', 'beastborn', 'human', 'dragon', 'ent']) {
    const c = practiceFighter('planB', race);
    for (const e of Object.values(ENEMIES)) {
      for (const [a, d] of [[{ agi: c.attrs.AGI.stamina, luck: null }, { agi: e.attrs.AGI, luck: e.luck }],
                            [{ agi: e.attrs.AGI, luck: e.luck }, { agi: c.attrs.AGI.stamina, luck: null }]]) {
        const p = missChance({
          attackerAgi: a.agi, attackerLuck: a.luck === null ? luckOfC(c) : a.luck,
          defenderAgi: d.agi, defenderLuck: d.luck === null ? luckOfC(c) : d.luck,
        });
        ok(p >= 0.02 && p <= 0.2, `${race} vs ${e.id}: ${p}`);
      }
    }
  }
});
missTest('A chance miss shows clearly in the result line, for you and for the enemy', () => {
  const saved = { ...MISS };
  Object.assign(MISS, { level: 1, ahead: 1, max: 1 });
  try {
    const s = force(act(fight(), { action: 'block', target: 'legs' }));    // w2: bite (Fair) vs sword (Fair)
    const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'legs' });
    ok(r.lines.includes('Your sword swings wide.'), r.lines.join(' | '));
    ok(r.lines.includes('Its bite swings wide.'), r.lines.join(' | '));
    eq(r.combat.enemy.stamina, s.cb.enemy.stamina); eq(staminaOf(r.character), staminaOf(s.c));
    eq(r.combat.stats.playerMisses, 1); eq(r.combat.stats.enemyMisses, 1);
  } finally { Object.assign(MISS, saved); }
});
test('Situational miss: attacking while Off-Balance always misses, for enemies too', () => {
  const s = plain(act(fight(), { action: 'pray' }));
  s.cb.enemy.conditions.push({ id: 'offBalance', until: s.cb.exchange });
  const r = act(s, { action: 'block', target: 'right' });   // its bite (Head) would land
  eq(staminaOf(r.c), staminaOf(s.c));
  ok(r.lines.some(l => l.startsWith('Off-Balance, its bite misses')), r.lines.join(' | '));
});
test('Situational miss: a dagger can’t reach the barrow knight at Approach range; the sword can', () => {
  const s = plain(holdDagger(fight('barrowKnight')));
  const r = act(s, { action: 'attack', target: 'legs' });
  ok(r.lines.includes("Your dagger can't reach it at Approach range."), r.lines.join(' | '));
  const sw = act(plain(fight('barrowKnight')), { action: 'attack', target: 'legs' });
  ok(sw.cb.enemy.stamina.STR < KNIGHT.STR, 'sword reaches');
});
test('Situational miss: attacking a target that shifts position first (or at the same time) misses', () => {
  let s = act(fight(), { action: 'pray' }); s = plain(act(s, { action: 'block', target: 'left' }, 'w3-left'));
  ok(C.moveFor(s.cb).shifts, 'its feint sidesteps');
  const sword = act(s, { action: 'attack', target: 'right' });           // Fair, slower than its Swift claws
  ok(sword.lines.includes('It sidesteps; your sword cuts empty air.'), sword.lines.join(' | '));
  eq(sword.cb.enemy.stamina, s.cb.enemy.stamina);
  const dagger = act(holdDagger(JSON.parse(JSON.stringify(s))), { action: 'attack', target: 'head' });   // Swift = Swift
  eq(dagger.cb.enemy.stamina, s.cb.enemy.stamina, 'same speed: still misses');
  const h = JSON.parse(JSON.stringify(s)); holdDagger(h);
  h.cb.enemy.conditions.push({ id: 'hindered', until: h.cb.exchange });  // its claws slowed to Fair
  ok(act(h, { action: 'attack', target: 'head' }).cb.enemy.stamina.AGI < WOLF.AGI, 'a faster attack lands first');
});
test('A successful lucky attempt never misses, even Off-Balance', () => {
  const { seed, c } = findLucky(true);
  const cb = C.startCombat(c, 'werewolf', { seed });
  cb.player.conditions.push({ id: 'offBalance', until: cb.exchange });
  const r = C.submitAction(c, cb, { action: 'attack', target: 'right', lucky: true });
  ok(r.lines.some(l => l.startsWith('Lucky!')), 'lucky');
  ok(r.combat.enemy.stamina.STR < WOLF.STR, 'it hits: ' + r.lines.join(' | '));
});
test('Fortune’s Favor turns a miss into a hit once per Rest', () => {
  const s = plain(act(fight(), { action: 'pray' }));
  s.c.abilities.push('fortunesFavor');
  ok(!C.availableActions(s.c, s.cb).abilities.some(a => a.id === 'fortunesFavor'), 'passive: not on the carousel');
  s.cb.player.conditions.push({ id: 'offBalance', until: s.cb.exchange });
  const r = act(s, { action: 'attack', target: 'legs' });
  ok(r.cb.enemy.stamina.STR < WOLF.STR, 'turned into a hit');
  ok(r.lines.some(l => l.startsWith("Fortune's Favor!")), r.lines.join(' | '));
  ok(r.c.favorUsed, 'used');
  r.cb.player.conditions.push({ id: 'offBalance', until: r.cb.exchange });
  const again = act(r, { action: 'attack', target: 'head' });
  eq(again.cb.enemy.stamina, r.cb.enemy.stamina, 'only once');
  eq(Rules.rest(again.c, S.createWorld(1)).character.favorUsed, false, 'Rest resets it');
});

// --- Repetition counter -----------------------------------------------------------------

test('Repetition: the same action and target two exchanges running makes its next step a counter', () => noHiding(() => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  s = act(s, { action: 'attack', target: 'left' });
  eq(step(s), 'counter');
}));
test('Repetition: the counter is a fast attack with Advantage', () => {
  let s = act(fight(), { action: 'attack', target: 'left' });
  s = act(s, { action: 'attack', target: 'left' }, 'counter-legs');
  const r = act(s, { action: 'pray' });
  eq(totalStamina(s.c) - totalStamina(r.c), adv(CLAW_BASE, WB));
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
  const s = plain(holdDagger(act(fight(), { action: 'pray' })));   // w2 main: bite
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.c.attrs.STR.stamina, s.c.attrs.STR.stamina - half(BITE_BASE, WB), 'bite halved, plus its bonus');
  eq(r.cb.enemy.stamina.AGI, WOLF.AGI - 2, 'dagger 1 + AGI 6 ÷ 5');
});
test('Speed: Plan B gives the next action a Speed disadvantage', () => {
  let s = plain(act(fight(), { action: 'pray' }));
  s = plain(act(s, { action: 'ability', abilityId: 'planB', target: 'legs' }));
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
// The barrow knight's step 2 (main: Greatsword → Right).
const atKnightStep2 = () => act(fight('barrowKnight'), { action: 'pray' });

test('Attacks meet at equal speed or one step apart; Swift and Drawn never meet', () => {
  const base = { playerTarget: 'head', enemyTarget: 'head', playerWeapon: { id: 'sword' }, enemyWeapon: { id: 'greatsword' } };
  eq(C.attacksInteract({ ...base, playerSpeed: 1, enemySpeed: 1 }), 'clash', 'Fair vs Fair');
  eq(C.attacksInteract({ ...base, playerSpeed: 2, enemySpeed: 1 }), 'clash', 'Swift vs Fair');
  eq(C.attacksInteract({ ...base, playerSpeed: 1, enemySpeed: 0 }), 'clash', 'Fair vs Drawn');
  eq(C.attacksInteract({ ...base, playerSpeed: 2, enemySpeed: 0 }), 'none', 'Swift vs Drawn');
});
test('Only hard weapons Clank: claws and bites are natural and never Clank', () => {
  ok(ENEMIES && !C.canClank({ id: 'claws', natural: true }), 'claws');
  ok(C.canClank({ id: 'sword' }) && C.canClank({ id: 'greatsword' }), 'blades do');
  const side = { playerTarget: 'left', enemyTarget: 'right', playerSpeed: 1, enemySpeed: 1 };
  eq(C.attacksInteract({ ...side, playerWeapon: { id: 'sword' }, enemyWeapon: { id: 'claws', natural: true } }), 'none');
  eq(C.attacksInteract({ ...side, playerWeapon: { id: 'sword' }, enemyWeapon: { id: 'greatsword' } }), 'clank');
});
test('Sword vs claws on opposite sides: no Clank (claws are natural); both hit', () => {
  let s = act(fight(), { action: 'pray' }); s = plain(act(s, { action: 'block', target: 'left' }));   // w3: claws → Right
  const r = act(s, { action: 'attack', target: 'left' });
  ok(!r.lines.some(l => l.startsWith('Clank!')), 'no Clank');
  eq(r.cb.enemy.stamina.STR, s.cb.enemy.stamina.STR - 1, 'sword (slower) halved to 1');
  eq(totalStamina(s.c) - totalStamina(r.c), CLAW, 'claws land');
  eq(r.cb.player.conditions, [], 'not Off-Balance');
});
test('Sword vs greatsword on opposite sides: Clank (Fair and Drawn meet); no damage, both Off-Balance', () => {
  const s = atKnightStep2();
  eq(s.cb.current.stepId, 'k2');
  const r = act(s, { action: 'attack', target: 'left' });
  ok(r.lines.some(l => l.startsWith('Clank!')), 'Clank');
  eq(staminaOf(r.c), staminaOf(s.c)); eq(r.cb.enemy.stamina, s.cb.enemy.stamina);
  ok(r.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  ok(r.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'knight Off-Balance');
  eq(r.c.durability.sword, 19, 'a Clank wears the sword');
});
test('Sword vs bite on the same spot: Clash (natural weapons still Clash)', () => {
  const head = act(act(fight(), { action: 'pray' }), { action: 'attack', target: 'head' }, null);   // w2: bite → Head
  ok(head.cb.pendingClash, 'Head against Head');
  let s = act(act(fight(), { action: 'pray' }), { action: 'block', target: 'left' }, 'w3-legs');  // feint: bite → Legs
  const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'legs' });
  ok(r.combat.pendingClash, 'Legs against Legs');
});
test('Sword vs claws on the same spot: Clash (Fair and Swift are one step apart)', () => {
  const r = C.submitAction(fight().c, fight().cb, { action: 'attack', target: 'legs' });   // w1: claws → Legs
  ok(r.combat.pendingClash, 'Clash');
});
test('Sword vs greatsword on the same spot: Clash', () => {
  const s = fight('barrowKnight');   // k1: greatsword → Head
  ok(C.submitAction(s.c, s.cb, { action: 'attack', target: 'head' }).combat.pendingClash, 'Clash');
});
test('Dagger vs greatsword: no interaction (Swift and Drawn never meet), and the dagger can’t reach it at Approach', () => {
  const s = plain(holdDagger(atKnightStep2()));
  const r = act(s, { action: 'attack', target: 'left' });
  ok(!r.lines.some(l => l.startsWith('Clank!')), 'no Clank');
  ok(r.lines.some(l => l.includes("can't reach it at Approach range")), 'out of reach: ' + r.lines.join(' | '));
  eq(r.cb.enemy.stamina, s.cb.enemy.stamina, 'the dagger misses');
  eq(r.cb.player.conditions, [], 'not Off-Balance');
  const k1 = holdDagger(fight('barrowKnight'));
  ok(!C.submitAction(k1.c, k1.cb, { action: 'attack', target: 'head' }).combat.pendingClash, 'no Clash on the same spot either');
});
test('Off-Balance: your attacks miss for the next exchange, then it clears', () => {
  const s = plain(act(fight(), { action: 'pray' }));      // w2: bite
  s.cb.player.conditions.push({ id: 'offBalance', until: s.cb.exchange });
  const r = act(s, { action: 'attack', target: 'legs' });
  eq(r.cb.enemy.stamina, s.cb.enemy.stamina, 'the sword misses');
  ok(r.lines.includes('Off-Balance, your sword swings wide.'), r.lines.join(' | '));
  eq(r.cb.player.conditions, [], 'cleared');
});
test('No interaction: dagger at Head vs claws at Legs, both hit', () => {
  const r = act(holdDagger(fight()), { action: 'attack', target: 'head' });
  eq(r.cb.enemy.stamina.AGI, WOLF.AGI - 2);
  eq(r.c.attrs.AGI.stamina, 6 - CLAW);
});

// --- 6. Clash -------------------------------------------------------------------------

test('Clash: the same label at equal speed opens a Clash; nothing lands until a direction is picked', () => {
  const s = holdDagger(fight());
  const r = C.submitAction(s.c, s.cb, { action: 'attack', target: 'legs' });
  ok(r.combat.pendingClash, 'Clash waiting');
  eq(r.combat.pendingClash.enemyDir, 'legs', 'from the variant');
  eq(staminaOf(r.character), staminaOf(s.c)); eq(r.combat.enemy.stamina, s.cb.enemy.stamina);
  throws(() => C.submitAction(r.character, r.combat, { action: 'pray' }), 'must answer the Clash first');
});
test('Clash won: your attack lands with its normal damage, its attack does not', () => {
  let s = plain(act(fight(), { action: 'pray' }));   // w2: bite → Head (Fair); sword (Fair)
  const before = totalStamina(s.c);
  s = act(s, { action: 'attack', target: 'head' });  // Clash
  const r = clash(s, 'head');
  eq(r.cb.enemy.stamina.STR, WOLF.STR - 3, 'sword 2 + STR 8 ÷ 5 = 3, drained from its STR');
  eq(totalStamina(r.c), before, 'its bite does not land');
  ok(r.lines.some(l => l.startsWith('Your sword bites its head.')), r.lines.join(' | '));
  eq(r.cb.stats.clashWins, 1);
});
test('Clash won: Advantage on your next attack; the enemy is Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'attack', target: 'head' });
  s = clash(s, 'head');
  ok(s.cb.player.advantageNext, 'Advantage');
  ok(s.cb.enemy.conditions.some(x => x.id === 'offBalance'), 'enemy Off-Balance');
  // w3: sword (slower, but Advantage) → full 3; the Off-Balance werewolf's claws miss.
  plain(s);
  const r = act(s, { action: 'attack', target: 'left' });
  eq(r.cb.enemy.stamina.STR, s.cb.enemy.stamina.STR - 3);
  eq(totalStamina(r.c), totalStamina(s.c), 'its claws miss');
  ok(r.lines.some(l => l.startsWith('Off-Balance, its claws miss')), r.lines.join(' | '));
});
missTest('Clash won: the winning hit cannot miss, even when every other attack would', () => usualClashes(() => {
  const saved = { ...MISS };
  Object.assign(MISS, { level: 1, ahead: 1, max: 1 });
  try {
    let s = plain(act(fight(), { action: 'pray' }));
    s = force({ c: s.c, cb: C.submitAction(s.c, s.cb, { action: 'attack', target: 'head' }).combat });
    const r = C.submitClash(s.c, s.cb, 'head');
    ok(r.combat.enemy.stamina.STR < WOLF.STR, 'it lands: ' + r.lines.join(' | '));
    ok(!r.lines.some(l => l.includes('swings wide')), 'no miss');
  } finally { Object.assign(MISS, saved); }
}));
test('Clash won: damage-changing abilities still apply (Crusher against the knight’s helm)', () => {
  const s = plain(fight('barrowKnight', 'crusher'));   // k1: greatsword → Head (Drawn); Crusher (Drawn)
  const r1 = C.submitAction(s.c, s.cb, { action: 'ability', abilityId: 'crusher', target: 'head' });
  ok(r1.combat.pendingClash, 'Clash');
  const r = C.submitClash(r1.character, r1.combat, r1.combat.pendingClash.enemyDir);
  eq(r.combat.enemy.stamina.STR, KNIGHT.STR - 3, 'sword 3 × 1.5 = 5, Heavy helm −2');
  eq(totalStamina(r.character), totalStamina(s.c), 'its greatsword does not land');
  eq(r.character.cooldowns.crusher, 3, 'Crusher still goes on cooldown');
});
test('Clash lost: its attack lands with its normal damage, yours does not', () => {
  let s = plain(act(fight(), { action: 'pray' }));   // w2: bite → Head
  const before = totalStamina(s.c);
  s = act(s, { action: 'attack', target: 'head' });
  const r = clash(s, 'legs');
  eq(before - totalStamina(r.c), BITE, 'its bite lands for its normal damage');
  eq(r.cb.enemy.stamina, s.cb.enemy.stamina, 'your sword does not land');
  ok(r.lines.some(l => l.startsWith('Its bite snaps at your head.')), r.lines.join(' | '));
  eq(r.cb.stats.clashLosses, 1);
});
test('Clash lost: the enemy gets Advantage and you are Off-Balance', () => {
  let s = act(fight(), { action: 'pray' });
  s = act(s, { action: 'attack', target: 'head' });
  s = plain(clash(s, 'legs'));
  ok(s.cb.enemy.advantageNext, 'enemy Advantage');
  ok(s.cb.player.conditions.some(x => x.id === 'offBalance'), 'player Off-Balance');
  const r = act(s, { action: 'pray' });  // claws with Advantage, plus bonus
  eq(totalStamina(s.c) - totalStamina(r.c), adv(CLAW_BASE, WB));
});
test('Clash lost: Blessed still softens its winning hit', () => {
  let s = plain(act(fight(), { action: 'pray' }));
  s.c.traits.push({ id: 'blessed', kind: 'TPT' });
  const before = totalStamina(s.c);
  s = act(s, { action: 'attack', target: 'head' });
  const r = clash(s, 'legs');
  eq(before - totalStamina(r.c), Math.max(1, Math.floor(BITE * 0.75)));
});

// --- 7. Resolve --------------------------------------------------------------------------

test('Block: Off-Balance only halves the damage (rounded up)', () => {
  const s = fight(); s.cb.player.conditions.push({ id: 'offBalance', until: 1 });
  eq(act(s, { action: 'block', target: 'legs' }).c.attrs.AGI.stamina, 6 - Math.ceil(CLAW / 2));
});
test('Overflow: claws into 1 AGI spill the rest into STR', () => {
  const s = fight(); s.c.attrs.AGI.stamina = 1;
  const r = act(s, { action: 'pray' });
  eq(r.c.attrs.AGI.stamina, 0); eq(r.c.attrs.STR.stamina, 8 - (CLAW - 1));
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
  s.cb = C.beginExchange(s.c, { ...s.cb, exchange: 0, enemy: { ...s.cb.enemy, loopIndex: 1 } }); force(s);  // bite
  eq(act(s, { action: 'block', target: 'legs' }).c.attrs.STR.stamina, 8 - Math.floor(BITE * 0.75));
});
test('Pray: Steeled ignores the next TNT (Off-Balance from a Clank)', () => {
  const s = atKnightStep2();
  s.c.traits = [{ id: 'steeled', kind: 'TPT' }];
  const r = act(s, { action: 'attack', target: 'left' });
  ok(r.lines.some(l => l.startsWith('Clank!')), 'Clank');
  eq(r.cb.player.conditions, []);
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
  eq(step(s), 'k3');
  eq(act(s, { action: 'attack', target: 'legs' }).cb.enemy.stamina, s.cb.enemy.stamina);
});
test('Barrow Knight: the trick (step 4) looks like step 1 but its main swing goes for your legs', () => noHiding(() => {
  let s = act(fight('barrowKnight'), { action: 'block', target: 'head' });  // k1 → k3
  s = act(s, { action: 'pray' });                                          // k3 → k4
  eq(step(s), 'k4');
  const k1 = ENEMIES.barrowKnight.pattern[0], k4 = ENEMIES.barrowKnight.pattern[3];
  eq([k1.variants[0].target, k4.variants[0].target], ['head', 'legs'], 'only counting the swings gives it away');
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
  eq(totalStamina(c) - totalStamina(r.character), 2 * CLAW, 'two claw hits');
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
  eq(act(atKnightStep2(), { action: 'attack', target: 'left' }).c.durability.sword, 19, 'Clank');
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
// Targets (Build Spec → Enemies): a player who knows the patterns wins most fights
// (about 80–90%), but wins are costly; flawless wins are rare; fights last
// 10–20 exchanges; chance misses about 1 in 15; tells only from a source (Focused, via Pray).

for (const enemyId of ['werewolf', 'barrowKnight']) {
  slowTest(`Balance (${enemyId}): wins are likely but costly, flawless wins rare, misses uncommon`, () => {
    const N = 150;
    const L = [], R = [];
    for (let seed = 1; seed <= N; seed++) {
      L.push(simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash }));
      const rng = createRng(seed * 7919);
      R.push(simulateFight({ seed, enemyId, policy: randomPolicy(rng), clashPick: randomClash(rng) }));
    }
    const l = summarize(L), r = summarize(R);
    const p = (x) => (100 * x).toFixed(0) + '%';
    ok(l.winRate >= 0.72 && l.winRate <= 0.95, `learned wins ${p(l.winRate)} (aim 80–90%; full check: node tests/balance.js)`);
    ok(l.leftMedian <= 0.65, `winners usually keep ${p(l.leftMedian)} (aim: lose 40–70%)`);
    // Scrapes: about 1 win in 4 against the werewolf, about 1 in 5 against the knight
    // (Build Spec → Enemies). These limits leave room for the noise of 150 fights.
    ok(l.scrape >= 0.1, `scrapes ${p(l.scrape)} of wins (aim about 25%)`);
    ok(l.flawless < 0.08, `flawless ${p(l.flawless)} of wins (aim under 5%)`);
    ok(l.avgLen >= 9 && l.avgLen <= 20, `average ${l.avgLen.toFixed(1)} exchanges`);
    ok(l.chanceMissRate >= 0.02 && l.chanceMissRate <= 0.1, `chance misses ${p(l.chanceMissRate)} of attacks (aim about 1 in 15)`);
    ok(l.tellRate > 0 && l.tellRate <= l.focusedRate, `tells in ${p(l.tellRate)} of exchanges, only while Focused (${p(l.focusedRate)})`);
    // Random buttons win almost never (aim 15–30%: a known shortfall, Build Spec → Enemies).
    ok(r.winRate < l.winRate - 0.5, `learning helps: learned ${p(l.winRate)} vs random ${p(r.winRate)}`);
  });
}

// --- Setback traits from trials ----------------------------------------------------------------

test('Winded: no Drawn actions (Crusher can’t be used)', () => {
  const s = fight('werewolf', 'crusher');
  s.c.traits.push({ id: 'winded', kind: 'TNT' });
  eq(C.availableActions(s.c, s.cb).abilities[0].enabled, false);
  throws(() => C.submitAction(s.c, s.cb, { action: 'ability', abilityId: 'crusher', target: 'head' }));
});
test('Bruised: your attacks have Disadvantage', () => {
  const s = plain(act(fight(), { action: 'pray' }));      // w2: bite (Fair) vs sword (Fair): no speed penalty
  s.c.traits.push({ id: 'bruised', kind: 'TNT' });
  eq(act(s, { action: 'attack', target: 'legs' }).cb.enemy.stamina.STR, WOLF.STR - 1, 'sword 3 halved to 1');
});
test('Shaken: a Clash you win hits with Disadvantage; Pray clears it', () => {
  let s = plain(act(fight(), { action: 'pray' }));
  s.c.traits.push({ id: 'shaken', kind: 'TNT' });
  s = act(s, { action: 'attack', target: 'head' });
  const r = clash(s, 'head');
  eq(r.cb.enemy.stamina.STR, WOLF.STR - 1, 'sword 3 halved to 1');
  const p = act(plain(fight()), { action: 'pray' });
  const q = fight(); q.c.traits.push({ id: 'shaken', kind: 'TNT' });
  const prayed = act(q, { action: 'pray' });
  ok(!prayed.c.traits.some(t => t.id === 'shaken'), 'cleared by Prayer');
  ok(prayed.lines.some(l => l.includes('no longer Shaken')), prayed.lines.join(' | '));
  ok(p, 'ok');
});

// --- Events for the screen's effects ------------------------------------------------------------

baseTest('Events: every exchange reports what happened where, matching the stamina that changed', () => {
  const T4 = ['head', 'left', 'right', 'legs'];
  const sumE = (cb) => Object.values(cb.enemy.stamina).reduce((a, b) => a + b, 0);
  const seen = new Set();
  for (const enemyId of ['werewolf', 'barrowKnight']) {
    for (let seed = 1; seed <= 25; seed++) {
      let c = practiceFighter(); let cb = C.startCombat(c, enemyId, { seed });
      const rng = createRng(seed * 7);
      for (let i = 0; i < 40 && !cb.outcome; i++) {
        const before = { you: totalStamina(c), it: sumE(cb) };
        const choice = rng.next() < 0.3 ? { action: 'block', target: T4[Math.floor(rng.next() * 4)] }
                                        : { action: 'attack', target: T4[Math.floor(rng.next() * 4)] };
        let r = C.submitAction(c, cb, choice);
        let events = r.events;
        ok(Array.isArray(events), 'events listed');
        if (r.combat.pendingClash) {
          ok(events.some(e => e.type === 'clash'), 'a Clash is reported');
          r = C.submitClash(r.character, r.combat, T4[Math.floor(rng.next() * 4)]);
          ok(r.events.some(e => e.type === 'clashResult'), 'and its result');
          events = events.concat(r.events);
        }
        c = r.character; cb = r.combat;
        for (const e of events) { seen.add(`${e.type}:${e.who || ''}`); if (e.target) ok(T4.includes(e.target), 'a zone'); }
        const dealt = (who) => events.filter(e => e.type === 'hit' && e.who === who).reduce((n, e) => n + e.amount, 0);
        eq(before.it - sumE(cb), dealt('player'), 'enemy stamina lost = your hits');
        eq(before.you - totalStamina(c), dealt('enemy'), 'your stamina lost = its hits');
        if (cb.outcome) ok(events.some(e => e.type === cb.outcome), 'the end is reported');
      }
    }
  }
  for (const k of ['hit:player', 'hit:enemy', 'miss:player', 'block:enemy', 'block:player', 'clash:', 'clashResult:', 'clank:'])
    ok(seen.has(k), 'seen ' + k);
});
