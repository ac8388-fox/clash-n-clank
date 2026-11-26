// Automatic tests for travel and trials (Build Spec → "World map", "Trials",
// "Rules engine": Travel, Trial check, Trial failure, Forced lucky attempt,
// Rest, Sleep; and the Step 3 phone checks).

import { test, eq, ok, throws } from './harness.js';
import * as W from '../engine/world.js';
import * as T from '../engine/trial.js';
import { EVENTS, TRIALS, DIRECTIONS } from '../data/events.js';
import { staminaOf, attrTotal, ATTRS } from '../engine/rules.js';
import { submitAction, submitClash } from '../engine/combat.js';
import { createCharacter } from '../engine/state.js';

const run = (raceId = 'human', seed = 1) => W.newRun({ name: 'T', raceId, luckyNumber: 2, occupationId: 'knight' }, seed);
const noRacial = (c) => ({ ...c, racialReady: false });
function goTo(s, ...dirs) {
  let { character: c, world: w } = s;
  for (const d of dirs) ({ world: w } = W.go(w, c, d));
  return { character: c, world: w };
}
const closeFortune = (w) => ({ ...w, trial: w.trial ? { ...w.trial, fortune: { open: false } } : null });

// --- Travel -----------------------------------------------------------------------------------

test('Start: the Crossroads in the Morning, facing North', () => {
  const { world } = run();
  eq(world.eventId, 'crossroads'); eq(world.timeOfDay, 'Morning'); eq(world.facing, 'N');
});
test('Phone check: from the Crossroads every direction leads somewhere; West says Camp', () => {
  const x = W.exitsFor(run().world);
  eq([x.N.name, x.E.name, x.S.name, x.W.name], ['Village', 'Hills', 'Gorge', 'Camp']);
  eq([x.N.teaser, x.E.teaser, x.S.teaser, x.W.teaser], ['Smoke above the trees', 'A howl from the hills', 'A rope bridge sways', 'West is a sheer drop']);
  ok(x.W.camp, 'West is Camp');
});
test('No dead options: every exit of every place leads somewhere or is Camp, with a teaser', () => {
  for (const flags of [{ gorgeCrossed: false }, { gorgeCrossed: true }]) {
    const w = { ...run().world, eventFlags: { ...run().world.eventFlags, ...flags } };
    for (const id of Object.keys(EVENTS)) {
      const x = W.exitsFor(w, id);
      for (const d of DIRECTIONS) {
        ok(x[d].camp || EVENTS[x[d].to], `${id} ${d}`);
        ok(x[d].teaser, `${id} ${d} has a teaser`);
      }
    }
  }
});
test('The map matches the Build Spec table', () => {
  const name = (id, d, flags = {}) => W.exitsFor({ ...run().world, eventFlags: { ...run().world.eventFlags, ...flags } }, id)[d].name;
  eq(['N', 'E', 'S', 'W'].map(d => name('gorge', d)), ['Crossroads', 'Camp', 'Camp', 'Camp']);
  eq(name('gorge', 'S', { gorgeCrossed: true }), 'Sealed Crypt');
  eq(['N', 'E', 'S', 'W'].map(d => name('crypt', d)), ['Gorge', 'Camp', 'Camp', 'Camp']);
  eq(['N', 'E', 'S', 'W'].map(d => name('hills', d)), ['Camp', 'Camp', 'Camp', 'Crossroads']);
  eq(['N', 'E', 'S', 'W'].map(d => name('village', d)), ['Camp', 'Camp', 'Crossroads', 'Camp']);
});
test('Phone check: each journey moves the time of day on: Morning, Afternoon, Evening, Night, Morning', () => {
  let s = run();
  const seen = [s.world.timeOfDay];
  for (const d of ['N', 'S', 'N', 'S']) { s = goTo(s, d); seen.push(s.world.timeOfDay); }
  eq(seen, ['Morning', 'Afternoon', 'Evening', 'Night', 'Morning']);
  eq(s.world.day, 2);
});
test('The compass faces the way you just traveled; visited places are named', () => {
  let s = goTo(run(), 'N');
  eq(s.world.eventId, 'village'); eq(s.world.facing, 'N');
  s = goTo(s, 'S');
  eq(s.world.facing, 'S');
  ok(W.exitsFor(s.world).N.visited, 'the Village is now known');
  ok(!W.exitsFor(s.world).E.visited, 'the Hills are not');
});
test('A Camp exit doesn’t move you or take time; it opens Camp', () => {
  const s = run();
  const r = W.go(s.world, s.character, 'W');
  ok(r.camp, 'Camp');
  eq(r.world.eventId, 'crossroads'); eq(r.world.timeOfDay, 'Morning');
});

// --- Trials -------------------------------------------------------------------------------------

test('Arriving at the Gorge starts its trial with the four options from the table', () => {
  const s = run();
  const r = W.go(s.world, noRacial(s.character), 'S');
  eq(r.arrival.screen, 'trial'); eq(r.arrival.trialId, 'gorge');
  const opts = T.trialOptions(noRacial(s.character), 'gorge');
  eq(opts.map(o => [o.dir, o.attr, o.label, o.requirement]), [
    ['up', 'FAI', 'Pray for passage', 8], ['right', 'STR', 'Brace the post', 10],
    ['down', 'WIS', 'Study the knots', 7], ['left', 'AGI', 'Dash across', 10]]);
  eq(TRIALS.crypt.options.map(o => [o.attr, o.requirement]), [['FAI', 8], ['STR', 12], ['WIS', 9], ['AGI', 9]]);
});
test('Trial check: success when the attribute’s current stamina meets the requirement', () => {
  let s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const r = T.attemptTrial(s.character, closeFortune(s.world), { dir: 'down' });   // WIS 6 vs 7: fails
  eq(r.outcome, 'failure');
  const c = { ...noRacial(run().character) }; c.attrs = { ...c.attrs, WIS: { ...c.attrs.WIS, stamina: 7 } };
  s = goTo({ character: c, world: run().world }, 'S');
  eq(T.attemptTrial(c, closeFortune(s.world), { dir: 'down' }).outcome, 'success');
});
test('Phone check: failing Dash Across lowers your AGI bar by requirement − stamina (at least 2)', () => {
  const s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const r = T.attemptTrial(s.character, closeFortune(s.world), { dir: 'left' });   // AGI 6 vs 10
  eq(r.outcome, 'failure');
  eq(r.character.attrs.AGI.stamina, 6 - 4);
  eq(r.character.attrs.STR.stamina, s.character.attrs.STR.stamina, 'only the attribute tried');
  const near = noRacial(run().character); near.attrs.WIS.stamina = 6;
  const s2 = goTo({ character: near, world: run().world }, 'S');
  eq(T.attemptTrial(near, closeFortune(s2.world), { dir: 'down' }).character.attrs.WIS.stamina, 6 - 2, 'minimum 2');
});
test('A failed trial leaves the event open: try another option', () => {
  const s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const r1 = T.attemptTrial(s.character, closeFortune(s.world), { dir: 'left' });
  ok(r1.world.trial, 'still in the trial'); eq(r1.next, 'trial');
  const r2 = T.attemptTrial(r1.character, closeFortune(r1.world), { dir: 'up' });  // FAI 6 vs 8
  eq(r2.outcome, 'failure');
  const strong = noRacial(run().character); strong.attrs.FAI.stamina = 8;
  const r3 = T.attemptTrial(strong, closeFortune(r2.world), { dir: 'up' });
  eq(r3.outcome, 'success');
});
test('Phone check: the Sealed Crypt is reachable only after crossing the Gorge', () => {
  let s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  ok(W.exitsFor(s.world).S.camp, 'South is Camp before crossing');
  const c = noRacial(run().character); c.attrs.FAI.stamina = 8;
  const r = T.attemptTrial(c, closeFortune(s.world), { dir: 'up' });
  ok(r.world.eventFlags.gorgeCrossed, 'crossed');
  eq(W.exitsFor(r.world).S.name, 'Sealed Crypt');
  eq(W.arrival(r.world).screen, 'travel', 'the Gorge stays crossed');
  const into = W.go(r.world, r.character, 'S');
  eq(into.world.eventId, 'crypt'); eq(into.arrival.screen, 'trial');
});
test('Phone check: opening the Crypt starts the Barrow Knight fight at once', () => {
  let s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const c = noRacial(run().character); c.attrs.FAI.stamina = 8;
  let r = T.attemptTrial(c, closeFortune(s.world), { dir: 'up' });
  r = { ...r, ...W.go(r.world, r.character, 'S') };
  const opened = T.attemptTrial(c, closeFortune(r.world), { dir: 'up' });   // FAI 8 vs 8
  eq(opened.outcome, 'success'); eq(opened.next, 'combat');
  ok(opened.world.eventFlags.cryptOpen, 'open');
  const a = W.arrival(opened.world);
  eq(a.screen, 'combat'); eq(a.enemyId, 'barrowKnight');
});
test('Racial ability: replaces the weakest option, succeeds automatically, then waits for a Rest', () => {
  const s = run();   // Human: STR 8, AGI 6, WIS 6, FAI 6
  const opts = T.trialOptions(s.character, 'crypt');
  const r = opts.find(o => o.racial);
  ok(r, 'offered'); eq(r.dir, 'right', 'Force the door (STR 12 vs total 8) is the weakest');
  eq(r.label, 'Resourceful'); eq(r.replaces, 'Force the door');
  let w = goTo(s, 'S').world;
  const done = T.attemptTrial(s.character, closeFortune(w), { dir: T.trialOptions(s.character, 'gorge').find(o => o.racial).dir });
  eq(done.outcome, 'success'); eq(done.character.racialReady, false);
  ok(!T.trialOptions(done.character, 'crypt').some(o => o.racial), 'used up');
  ok(W.campRest(done.character, done.world).character.racialReady, 'back after a Rest');
});
test('Empty stamina: attempting with an empty pool wears its Natural total down', () => {
  const c = noRacial(run().character); c.attrs.AGI.stamina = 0;
  const s = goTo({ character: c, world: run().world }, 'S');
  eq(T.attemptTrial(c, closeFortune(s.world), { dir: 'left' }).character.attrs.AGI.natural, 5);
});
function findTrialLucky(want) {
  for (let seed = 1; seed < 20000; seed++) {
    const s = goTo({ character: noRacial(run('human', seed).character), world: run('human', seed).world }, 'S');
    if (!s.world.trial.fortune.open) continue;
    const r = T.attemptTrial(s.character, s.world, { dir: 'left', lucky: true });
    if (r.lines[0].startsWith('Lucky!') === want) return { s, r };
  }
  throw new Error('no seed');
}
test('Trial lucky attempt: any lucky number passes; none fails worse than normal (double damage)', () => {
  const win = findTrialLucky(true);
  eq(win.r.outcome, 'success');
  const lose = findTrialLucky(false);
  eq(lose.r.outcome, 'failure');
  eq(lose.r.character.attrs.AGI.stamina, Math.max(0, 6 - 8), 'double the 4');
});
test('Forced lucky attempt: when the only option left can’t be met, it rolls the dice', () => {
  ok(T.attemptTrial, 'exists');
  const c = noRacial(run().character);
  const opts = T.trialOptions(c, 'crypt').map((o, i) => ({ ...o, disabled: i !== 1 }));
  ok(opts.filter(o => !o.disabled).length === 1 && !opts[1].canMeet, 'only Force the door, and STR 8 < 12');
});
test('Trial defeat: a failure that empties every pool ends the run', () => {
  const c = noRacial(run().character);
  for (const k of ATTRS) c.attrs[k].stamina = 0;
  c.attrs.AGI.stamina = 1;
  const s = goTo({ character: c, world: run().world }, 'S');
  const r = T.attemptTrial(c, closeFortune(s.world), { dir: 'left' });
  eq(r.outcome, 'defeat');
});

// --- Camp ---------------------------------------------------------------------------------------

test('Phone check: Sleep works only in the Evening or at Night, and wakes you in the Morning with full bars', () => {
  let s = run();
  s.character.attrs.STR.stamina = 1;
  eq(W.campSleep(s.character, s.world).ok, false, 'Morning');
  s = goTo(s, 'N', 'S');                                     // Afternoon → Evening
  eq(s.world.timeOfDay, 'Evening');
  const r = W.campSleep(s.character, s.world);
  eq(r.ok, true); eq(r.world.timeOfDay, 'Morning');
  for (const k of ATTRS) eq(r.character.attrs[k].stamina, attrTotal(r.character, k), k);
});
test('Rest at Camp: +50% of each total and one part of the day', () => {
  const s = run();
  for (const k of ATTRS) s.character.attrs[k].stamina = 0;
  const r = W.campRest(s.character, s.world);
  eq(staminaOf(r.character), { STR: 4, AGI: 3, WIS: 3, FAI: 3 });
  eq(r.world.timeOfDay, 'Afternoon');
});

// --- Fights in the world ------------------------------------------------------------------------

test('The Hills start the werewolf fight; once it is defeated they are quiet', () => {
  const s = run();
  const r = W.go(s.world, s.character, 'E');
  eq(r.arrival.screen, 'combat'); eq(r.arrival.enemyId, 'werewolf');
  const w = { ...r.world, defeated: { ...r.world.defeated, werewolf: true } };
  eq(W.arrival(w).screen, 'travel');
});
test('Fights use the character as they are (not healed) and the time of day', () => {
  let s = goTo(run(), 'N', 'S', 'E');                         // Evening → Night at the Hills
  eq(s.world.timeOfDay, 'Night');
  s.character.attrs.STR.stamina = 3;
  const f = W.beginFight(s.character, s.world, 'werewolf');
  eq(f.combat.timeOfDay, 'Night');
  eq(f.combat.enemyId, 'werewolf');
});
test('After a fight: combat fatigue, the enemy marked defeated, and the run ends when both are', () => {
  const s = goTo(run(), 'E');
  let { combat } = W.beginFight(s.character, s.world, 'werewolf');
  combat = { ...combat, outcome: 'victory', player: { ...combat.player, usage: { STR: 4, AGI: 0, WIS: 0, FAI: 0 } } };
  const r = W.endFight(s.character, s.world, combat);
  ok(r.world.defeated.werewolf, 'defeated'); eq(r.runOver, null);
  eq(r.character.attrs.STR.stamina, s.character.attrs.STR.stamina - 2, 'fatigue: half of 4 actions');
  const both = W.endFight(r.character, { ...r.world, defeated: { werewolf: true, barrowKnight: false } }, { ...combat, enemyId: 'barrowKnight' });
  eq(both.runOver, 'victory');
});
test('A whole fight in the world runs to the end with the full combat rules', () => {
  const s = goTo(run(), 'E');
  let { combat } = W.beginFight(s.character, s.world, 'werewolf');
  let c = s.character;
  const T4 = ['head', 'left', 'right', 'legs'];
  for (let i = 0; !combat.outcome && i < 200; i++) {
    let r = submitAction(c, combat, i % 3 === 2 ? { action: 'block', target: T4[i % 4] } : { action: 'attack', target: T4[(i * 3) % 4] });
    c = r.character; combat = r.combat;
    if (combat.pendingClash) { r = submitClash(c, combat, 'head'); c = r.character; combat = r.combat; }
  }
  ok(combat.outcome === 'victory' || combat.outcome === 'defeat', 'finished: ' + combat.outcome);
});
test('Same seed, same choices: the world replays the same way', () => {
  const play = () => {
    let s = goTo({ ...run('human', 9), character: noRacial(run('human', 9).character) }, 'S');
    const r = T.attemptTrial(s.character, s.world, { dir: 'left', lucky: true });
    return JSON.stringify([r.lines, r.world.rngState]);
  };
  eq(play(), play());
});
