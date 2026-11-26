// Travel and the slice loop (Build Spec → "Game flow and screens", "World map",
// "Rules engine": Travel, Rest, Sleep).
//
// Travel is the hub: after every event the player picks North, East, South,
// or West and the next event begins at once. Each journey takes one part of
// the day. A direction that can't be traveled is Camp (Rest or Sleep) instead,
// so there are no dead options. Places already visited are named.
//
// Pure functions: they return new character and world objects.

import { getEvent, DIRECTIONS } from '../data/events.js';
import { getEnemy } from '../data/enemies.js';
import { createGame } from './state.js';
import { travel, advanceTime, rest, sleep, canSleep, isDefeated, staminaOf } from './rules.js';
import { startCombat, finishCombat } from './combat.js';
import { beginTrial } from './trial.js';
import { createRng } from './random.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// A new run: the character and the world at the Crossroads in the Morning.
export function newRun(creation, seed) {
  const g = createGame(creation, seed);
  return { character: g.character, world: g.world };
}

// The four exits from where the player stands, resolved for the world's flags.
// Each is { dir, to, name, teaser, camp, visited, journeys }.
export function exitsFor(world, eventId = world.eventId) {
  const ev = getEvent(eventId);
  const out = {};
  for (const d of DIRECTIONS) {
    let x = ev.exits[d];
    if (x.requires) x = world.eventFlags[x.requires] ? { to: x.to, teaser: x.teaser } : x.otherwise;
    if (x.camp) out[d] = { dir: d, camp: true, name: 'Camp', teaser: x.teaser };
    else {
      const visited = !!world.visited[x.to];
      out[d] = { dir: d, to: x.to, name: getEvent(x.to).name, teaser: x.teaser, visited, journeys: x.journeys || 1 };
    }
  }
  return out;
}

// What happens on arriving at (or returning to) the current event.
// Returns { screen: 'trial' | 'combat' | 'travel', trialId, enemyId, text }.
export function arrival(world) {
  const ev = getEvent(world.eventId);
  const defeated = (id) => world.defeated[id];
  if (ev.id === 'gorge') {
    if (!world.eventFlags.gorgeCrossed) return { screen: 'trial', trialId: 'gorge', text: ev.text };
    return { screen: 'travel', text: ev.doneText };
  }
  if (ev.id === 'crypt') {
    if (!world.eventFlags.cryptOpen) return { screen: 'trial', trialId: 'crypt', text: ev.text };
    if (!defeated(ev.enemy)) return { screen: 'combat', enemyId: ev.enemy, text: ev.doneText };
    return { screen: 'travel', text: ev.clearedText };
  }
  if (ev.kind === 'combat') {
    if (!defeated(ev.enemy)) return { screen: 'combat', enemyId: ev.enemy, text: ev.text };
    return { screen: 'travel', text: ev.clearedText };
  }
  return { screen: 'travel', text: ev.text };
}

// Travel one direction. A Camp exit doesn't move you: it opens Camp.
// A long way round takes two journeys (two parts of the day).
// Returns { world, camp } or { world, arrival, journeys }.
export function go(worldIn, character, dir) {
  const x = exitsFor(worldIn)[dir];
  if (x.camp) return { world: clone(worldIn), camp: true };
  let w = travel(worldIn, x.to, dir);
  for (let i = 1; i < x.journeys; i++) w = advanceTime(w);
  const arr = arrival(w);
  if (arr.screen === 'trial') w = beginTrial(character, w, arr.trialId);
  return { world: w, arrival: arr, journeys: x.journeys };
}

// Camp: Rest (+50% of each total, one part of the day) or Sleep (Evening or
// Night only: full stamina, clears temporary traits, wakes in the Morning).
// Sleeping somewhere safe (the Village) also treats Injured; sleeping at a
// wild Camp does not.
export function campRest(character, world) {
  return rest(character, world);
}
export function campSleep(character, world) {
  if (!canSleep(world)) return sleep(character, world);
  // Treat injuries first, so the night's sleep fills the restored totals.
  const treated = getEvent(world.eventId).safeSleep ? character.traits.filter(t => t.id === 'injured') : [];
  const c = treated.length ? { ...character, traits: character.traits.filter(t => t.id !== 'injured') } : character;
  return { ...sleep(c, world), treated };
}
export { canSleep };

// Start a fight with the character as they are now (not healed), at this time of day.
export function beginFight(character, worldIn, enemyId) {
  const w = clone(worldIn);
  const rng = createRng(w.rngState);
  const seed = Math.floor(rng.next() * 4294967296) >>> 0;
  w.rngState = rng.getState();
  const combat = startCombat(character, enemyId, { seed, timeOfDay: w.timeOfDay });
  return { world: w, combat };
}

// After a fight: combat fatigue, mark the enemy defeated, and check the run.
// Returns { character, world, fatigue, outcome, runOver: 'victory' | 'defeat' | null }.
export function endFight(character, worldIn, combat) {
  const f = finishCombat(character, combat);
  const w = clone(worldIn);
  if (combat.outcome === 'victory') w.defeated = { ...w.defeated, [combat.enemyId]: true };
  return { character: f.character, world: w, fatigue: f.fatigue, outcome: combat.outcome, runOver: runOutcome(f.character, w) };
}

// The slice ends when both enemies are defeated, or the character is.
export function runOutcome(character, world) {
  if (isDefeated(staminaOf(character))) return 'defeat';
  if (Object.values(world.defeated).every(Boolean)) return 'victory';
  return null;
}

export function enemyName(id) {
  return getEnemy(id).name;
}
