// Automatic tests for travel and trials (Build Spec → "World map", "Trials",
// "Rules engine": Travel, Trial check, Falling short, Lucky only, the detour,
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
  eq(['N', 'E', 'S', 'W'].map(d => name('crypt', d)), ['Camp', 'Hills', 'Camp', 'Camp']);
  eq(name('crypt', 'N', { gorgeCrossed: true }), 'Gorge');
  eq(['N', 'E', 'S', 'W'].map(d => name('hills', d)), ['Camp', 'Camp', 'Sealed Crypt', 'Crossroads']);
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
test('Trial check: meeting the requirement is a clean pass, at no cost', () => {
  const c = noRacial(run().character); c.attrs.WIS.stamina = 7;
  const s = goTo({ character: c, world: run().world }, 'S');
  const r = T.attemptTrial(c, closeFortune(s.world), { dir: 'down' });     // WIS 7 vs 7
  eq(r.outcome, 'success');
  eq(staminaOf(r.character), staminaOf(c)); eq(r.character.traits, c.traits);
  ok(r.world.eventFlags.gorgeCrossed, 'across');
});
test('Falling short: you still get through, that stamina drops to 0, and you gain a TNT (short by 1–3)', () => {
  const s = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const r = T.attemptTrial(s.character, closeFortune(s.world), { dir: 'down' });   // WIS 6 vs 7: short by 1
  eq(r.outcome, 'shortfall');
  ok(r.world.eventFlags.gorgeCrossed, 'still across');
  eq(r.character.attrs.WIS.stamina, 0, 'WIS exhausted');
  eq(r.character.attrs.STR.stamina, s.character.attrs.STR.stamina, 'only the attribute tried');
  ok(r.character.traits.some(t => t.id === 'dazed' && t.kind === 'TNT'), 'Dazed');
  eq(W.arrival(r.world).screen, 'travel', 'the trial is done');
});
test('Lucky only: 4 or more short can’t be chosen without a lucky attempt', () => {
  const s0 = goTo({ ...run(), character: noRacial(run().character) }, 'S');
  const opts = T.trialOptions(s0.character, 'gorge');
  eq(opts.map(o => o.luckyOnly), [false, false, false, true], 'Dash across: AGI 6 vs 10');
  throws(() => T.attemptTrial(s0.character, closeFortune(s0.world), { dir: 'left' }));
  throws(() => T.attemptTrial(s0.character, closeFortune(s0.world), { dir: 'left', lucky: true }), 'no opening, no lucky attempt');
});
test('Lucky only, uses current stamina: resting first can shrink the gap', () => {
  const c = noRacial(run().character); c.attrs.AGI.stamina = 2;            // 8 short: Lucky only
  ok(T.trialOptions(c, 'gorge').find(o => o.dir === 'left').luckyOnly);
  c.attrs.FAI.stamina = 3;                                                  // Pray for passage: 5 short
  const rested = W.campRest(c, run().world).character;                     // +3 each (half of 6)
  eq(rested.attrs.AGI.stamina, 5); eq(rested.attrs.FAI.stamina, 6);
  eq(T.trialOptions(rested, 'gorge').find(o => o.dir === 'up').luckyOnly, false, 'now only 2 short');
});
function findLuckyOnly(want, dir = 'left') {
  for (let seed = 1; seed < 20000; seed++) {
    const s = goTo({ character: noRacial(run('human', seed).character), world: run('human', seed).world }, 'S');
    if (!s.world.trial.fortune.open) continue;
    const r = T.attemptTrial(s.character, s.world, { dir, lucky: true });
    if (r.lines[0].startsWith('Lucky!') === want) return { s, r };
  }
  throw new Error('no seed');
}
test('Lucky only, lucky success: a clean pass', () => {
  const { s, r } = findLuckyOnly(true);
  eq(r.outcome, 'success'); ok(r.world.eventFlags.gorgeCrossed);
  eq(r.character.attrs.AGI.stamina, s.character.attrs.AGI.stamina); eq(r.character.traits, s.character.traits);
});
test('Lucky only, lucky failure: not through, that stamina to 0, and Injured', () => {
  const { r } = findLuckyOnly(false);
  eq(r.outcome, 'blocked'); eq(r.next, 'trial');
  ok(!r.world.eventFlags.gorgeCrossed, 'not across');
  eq(r.character.attrs.AGI.stamina, 0);
  eq(r.character.traits.find(t => t.id === 'injured'), { id: 'injured', kind: 'CNT', attr: 'AGI', source: 'trial' });
  eq(attrTotal(r.character, 'AGI'), 6 - 2, 'AGI total lowered by 2');
  ok(r.world.trial, 'the trial is still there'); eq(r.world.trial.fortune.open, false, 'the opening is spent');
  eq(W.exitsFor(r.world).N.name, 'Crossroads', 'and you can leave');
});
test('The racial ability still always passes, even where every other option is Lucky only', () => {
  const c = run().character; for (const k of ATTRS) c.attrs[k].stamina = 1;
  const s = goTo({ character: c, world: run().world }, 'S');
  const opts = T.trialOptions(c, 'gorge');
  eq(opts.filter(o => o.luckyOnly).length, 3); ok(opts.find(o => o.racial));
  eq(T.attemptTrial(c, closeFortune(s.world), { dir: opts.find(o => o.racial).dir }).outcome, 'success');
});
test('Each attribute has its own temporary setback: Winded (STR), Bruised (AGI), Dazed (WIS), Shaken (FAI)', () => {
  const tries = { up: 'shaken', right: 'winded', down: 'dazed', left: 'bruised' };
  for (const [dir, id] of Object.entries(tries)) {
    const c = noRacial(run().character);
    const o = TRIALS.gorge.options.find(x => x.dir === dir);
    c.attrs[o.attr].stamina = o.requirement - 1;                              // short by 1
    const s = goTo({ character: c, world: run().world }, 'S');
    const r = T.attemptTrial(c, closeFortune(s.world), { dir });
    ok(r.character.traits.some(t => t.id === id), `${o.label} → ${id}`);
  }
});
test('The options show what falling short would cost before you choose', () => {
  const opts = T.trialOptions(noRacial(run().character), 'gorge');
  eq(opts.map(o => [o.shortfall, T.setbackName(o.setback)]), [[2, 'Shaken'], [2, 'Winded'], [1, 'Dazed'], [4, 'Injured (AGI)']]);
});
test('Steeled shrugs off a trial’s TNT; the same TNT doesn’t stack', () => {
  const c = noRacial(run().character); c.traits.push({ id: 'steeled', kind: 'TPT' });
  const s = goTo({ character: c, world: run().world }, 'S');
  const r = T.attemptTrial(c, closeFortune(s.world), { dir: 'down' });
  ok(!r.character.traits.some(t => t.id === 'dazed' || t.id === 'steeled'), 'Steeled used, no Dazed');
});
test('Sleeping at the Village treats Injured; sleeping at a wild Camp does not', () => {
  const night = (eventId) => ({ ...run().world, eventId, timeOfDay: 'Night' });
  const hurt = () => { const c = noRacial(run().character); c.traits.push({ id: 'injured', kind: 'CNT', attr: 'AGI' }); return c; };
  const village = W.campSleep(hurt(), night('village'));
  ok(village.ok && !village.character.traits.some(t => t.id === 'injured'), 'treated at the Village');
  eq(village.treated.map(t => t.attr), ['AGI']);
  eq(attrTotal(village.character, 'AGI'), 6, 'AGI total back to normal');
  eq(village.character.attrs.AGI.stamina, 6, 'and full after the night');
  const camp = W.campSleep(hurt(), night('gorge'));
  ok(camp.ok && camp.character.traits.some(t => t.id === 'injured'), 'still Injured after a wild Camp');
  eq(camp.character.attrs.AGI.stamina, 4, 'sleeps to full, but the total is still 2 lower');
});
test('Rest clears the temporary setbacks; Injured stays', () => {
  const c = noRacial(run().character);
  c.traits.push({ id: 'dazed', kind: 'TNT' }, { id: 'winded', kind: 'TNT' }, { id: 'injured', kind: 'CNT', attr: 'STR' });
  const r = W.campRest(c, run().world);
  eq(r.character.traits.filter(t => t.kind !== 'PPT' && t.kind !== 'PNT').map(t => t.id), ['injured']);
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
  const c = noRacial(run().character); c.attrs.WIS.stamina = 0;
  const s = goTo({ character: c, world: run().world }, 'S');
  const w = { ...s.world, trial: { ...s.world.trial, fortune: { open: true, hint: 'x' } } };
  eq(T.attemptTrial(c, w, { dir: 'down', lucky: true }).character.attrs.WIS.natural, 5);
});
function findTrialLucky(want) {
  for (let seed = 1; seed < 20000; seed++) {
    const s = goTo({ character: noRacial(run('human', seed).character), world: run('human', seed).world }, 'S');
    if (!s.world.trial.fortune.open) continue;
    const r = T.attemptTrial(s.character, s.world, { dir: 'down', lucky: true });
    if (r.lines[0].startsWith('Lucky!') === want) return { s, r };
  }
  throw new Error('no seed');
}
test('Trial lucky attempt: any lucky number is a clean pass; none counts as falling short by the real gap', () => {
  const win = findTrialLucky(true);
  eq(win.r.outcome, 'success'); eq(win.r.character.attrs.WIS.stamina, 6);
  const lose = findTrialLucky(false);                       // Study the knots: WIS 6 vs 7, 1 short
  eq(lose.r.outcome, 'shortfall');
  eq(lose.r.character.attrs.WIS.stamina, 0);
  ok(lose.r.character.traits.some(t => t.id === 'dazed' && t.kind === 'TNT'), 'the TNT for 1 short, as without the dice');
  ok(!lose.r.character.traits.some(t => t.id === 'injured'), 'not Injured');
});
test('Trial lucky attempt with no lucky number, when the requirement is met: still a clean pass', () => {
  for (let seed = 1; seed < 20000; seed++) {
    const c = noRacial(run('human', seed).character); c.attrs.WIS.stamina = 7;
    const s = goTo({ character: c, world: run('human', seed).world }, 'S');
    if (!s.world.trial.fortune.open) continue;
    const r = T.attemptTrial(c, s.world, { dir: 'down', lucky: true });
    if (r.lines[0].startsWith('Lucky!')) continue;
    eq(r.outcome, 'success'); eq(r.character.attrs.WIS.stamina, 7);
    return;
  }
  throw new Error('no seed');
});
test('Trial defeat: getting through on your last stamina ends the run', () => {
  const c = noRacial(run().character);
  for (const k of ATTRS) c.attrs[k].stamina = 0;
  c.attrs.WIS.stamina = 4;                                                  // Study the knots: 3 short
  const s = goTo({ character: c, world: run().world }, 'S');
  const r = T.attemptTrial(c, closeFortune(s.world), { dir: 'down' });
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
    const r = T.attemptTrial(s.character, s.world, { dir: 'down', lucky: true });
    return JSON.stringify([r.lines, r.world.rngState]);
  };
  eq(play(), play());
});

// --- Going round a trial ------------------------------------------------------------------------

test('The long way round: Hills ↔ Sealed Crypt, without crossing the Gorge, takes two parts of the day', () => {
  const s = goTo(run(), 'E');                                   // Crossroads → Hills: Afternoon
  eq(s.world.timeOfDay, 'Afternoon');
  const r = W.go(s.world, s.character, 'S');
  eq(r.world.eventId, 'crypt'); eq(r.journeys, 2);
  eq(r.world.timeOfDay, 'Night', 'two journeys: Evening, then Night');
  ok(!r.world.eventFlags.gorgeCrossed);
  eq(r.arrival.screen, 'trial'); eq(r.arrival.trialId, 'crypt');
  const back = W.go(r.world, r.character, 'E');
  eq(back.world.eventId, 'hills'); eq(back.world.timeOfDay, 'Afternoon'); eq(back.world.day, 2);
});
test('Every trial can be left: the Gorge leads back north, and the Crypt back round by the Hills', () => {
  const g = goTo(run(), 'S').world;
  eq(W.exitsFor(g).N.name, 'Crossroads');
  const c = goTo(run(), 'E', 'S').world;
  eq(W.exitsFor(c).E.name, 'Hills');
});
test('The slice can always be finished: with every Gorge option Lucky only, go round, fight the werewolf, rest, open the Crypt, fight the knight', () => {
  let { character: c, world: w } = run('human', 5);
  c.racialReady = false;
  for (const k of ATTRS) c.attrs[k].stamina = 2;                   // every Gorge option 5–8 short
  let r = W.go(w, c, 'S'); w = r.world;
  ok(T.trialOptions(c, 'gorge').every(o => o.luckyOnly), 'every Gorge option is Lucky only');
  r = W.go(w, c, 'N'); w = r.world;                                // leave: back to the Crossroads
  r = W.go(w, c, 'E'); w = r.world;                                // the Hills: the werewolf
  eq(r.arrival.screen, 'combat');
  let { combat } = W.beginFight(c, w, 'werewolf');
  const f = W.endFight(c, w, { ...combat, outcome: 'victory' });
  c = f.character; w = f.world; eq(f.runOver, null);
  r = W.go(w, c, 'S'); w = r.world;                                // the long way round
  eq(w.eventId, 'crypt'); eq(r.arrival.screen, 'trial');
  const camp = Object.values(W.exitsFor(w)).find(x => x.camp);    // rest at the Crypt
  ok(camp, 'Camp beside the Crypt');
  ({ character: c, world: w } = W.campRest(c, w));
  ok(c.racialReady, 'the racial ability is back after a Rest');
  w = T.beginTrial(c, w, 'crypt');
  const racial = T.trialOptions(c, 'crypt').find(o => o.racial);
  const opened = T.attemptTrial(c, { ...w, trial: { ...w.trial, fortune: { open: false } } }, { dir: racial.dir });
  eq(opened.outcome, 'success'); eq(opened.next, 'combat');
  const a = W.arrival(opened.world);
  eq(a.screen, 'combat'); eq(a.enemyId, 'barrowKnight');
  ok(W.beginFight(opened.character, opened.world, 'barrowKnight').combat, 'the knight fight starts');
});
test('From every place, the Crypt can be reached without crossing the Gorge', () => {
  const w0 = run().world;
  for (const start of Object.keys(EVENTS)) {
    const seen = new Set([start]); const queue = [start];
    while (queue.length) {
      const id = queue.shift();
      for (const x of Object.values(W.exitsFor(w0, id))) if (!x.camp && !seen.has(x.to)) { seen.add(x.to); queue.push(x.to); }
    }
    ok(seen.has('crypt'), `${start} → Sealed Crypt`);
  }
});
