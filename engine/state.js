// The game state and save / load (Build Spec → Data model, Tech approach).
// One state object is the single source of truth; screens only read it and
// call engine functions to get a new one.

import { getRace } from '../data/races.js';
import { classAttrsAt } from '../data/classes.js';
import { ATTRS, attrTotal, START_DURABILITY } from './rules.js';
import { newSeed } from './random.js';

export const SAVE_KEY = 'clash-n-clank.save';
export const SAVE_VERSION = 1;

// A new character, built from the creation choices.
// Starting class: Fighter Level 1 (+1 STR fixed, +1 free into STR).
// Starting stamina equals each attribute's total.
export function createCharacter({ name, raceId, luckyNumber, occupationId, classAbility = 'planB' }) {
  if (!(luckyNumber >= 1 && luckyNumber <= 4)) throw new Error('Lucky number must be 1 to 4');
  if (!['planB', 'crusher'].includes(classAbility)) throw new Error('Fighter starts with Plan B or Crusher');
  const race = getRace(raceId);
  const cls = classAttrsAt('fighter', 1);

  const character = {
    name,
    raceId,
    luckyNumber,
    attrs: {},
    classId: 'fighter',
    classLevel: 1,
    abilities: [classAbility],
    mainOccupation: { id: occupationId, level: 1 },
    minorOccupations: [],
    traits: [
      { id: race.positive, kind: 'PPT', source: 'race', expires: null },
      { id: race.negative, kind: 'PNT', source: 'race', expires: null },
    ],
    gear: {
      ready: ['sword', 'dagger', null],
      armor: { head: null, body: 'leatherJerkin', hands: null, legs: null },
      shield: null,
    },
    pack: [{ itemId: 'herbalDraught', qty: 2 }],
    durability: { sword: START_DURABILITY, dagger: START_DURABILITY, leatherJerkin: START_DURABILITY },
    racialReady: true,
    cooldowns: {},
  };

  for (const k of ATTRS) {
    character.attrs[k] = { natural: race.attrs[k], class: cls[k], stamina: 0 };
  }
  for (const k of ATTRS) character.attrs[k].stamina = attrTotal(character, k);
  return character;
}

// The world at the start of a run: the Crossroads in the Morning.
export function createWorld(seed = newSeed()) {
  return {
    eventId: 'crossroads',
    facing: 'N',
    timeOfDay: 'Morning',
    day: 1,
    visited: { crossroads: true },
    eventFlags: { gorgeCrossed: false, cryptOpen: false },
    defeated: { werewolf: false, barrowKnight: false },
    seed,
    rngState: seed,
  };
}

export function defaultSettings() {
  return { display: 'text', art: 'house' };
}

// The whole game state.
export function createGame(creation, seed) {
  return {
    version: SAVE_VERSION,
    character: createCharacter(creation),
    world: createWorld(seed),
    combat: null,
    settings: defaultSettings(),
  };
}

// ---------------------------------------------------------------------------
// Save and load (local storage). `storage` can be swapped out for tests.
// ---------------------------------------------------------------------------

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  const state = JSON.parse(text);
  if (!state || state.version !== SAVE_VERSION) return null;
  return state;
}

export function saveGame(state, storage = defaultStorage()) {
  if (!storage) return false;
  try { storage.setItem(SAVE_KEY, serialize(state)); return true; } catch { return false; }
}

export function loadGame(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch { return null; }
}

export function hasSave(storage = defaultStorage()) {
  return loadGame(storage) !== null;
}

export function clearSave(storage = defaultStorage()) {
  if (!storage) return;
  try { storage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
