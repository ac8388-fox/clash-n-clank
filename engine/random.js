// The one seeded random function (Build Spec → Tech approach).
// Every random thing in the game goes through here, so a run can be replayed
// from its seed. The generator is "mulberry32": small, fast, and repeatable.

// Pure step: give it a state number, get back a value in [0, 1) and the next state.
export function nextRandom(rngState) {
  let t = (rngState + 0x6D2B79F5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

// Convenience wrapper: an object whose next() returns numbers in [0, 1).
// getState() returns the number to save so the sequence can continue later.
export function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      const r = nextRandom(state);
      state = r.state;
      return r.value;
    },
    getState() { return state; },
  };
}

// A whole number from 1 to sides (a die roll).
export function rollDie(rng, sides) {
  return 1 + Math.floor(rng.next() * sides);
}

// Pick `count` different items from a list.
export function pickDistinct(rng, list, count) {
  const pool = list.slice();
  const out = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

// A fresh seed for a new run.
export function newSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
