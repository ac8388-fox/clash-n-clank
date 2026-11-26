// Enemies for Slice 1 (Build Spec → "Enemies" and "Enemy patterns").
//
// attrs are both the enemy's totals and its starting stamina pools.
// damageBonus is added to every hit the enemy lands (a balance dial).
// resist / weak are damage multipliers by attribute (×0.5 resist, ×2 weak).
// armor gives the weight on each slot (head, body, legs); body covers Left and Right.
//
// Pattern steps run in order and loop. A step's `when` can make the enemy jump to it:
//   'afterBlocked' – right after one of its attacks was Blocked
//   'below50'      – once, when its stamina falls below half (not part of the loop)
//
// Feints: every step has a main move (variants[0]) and one or two feints.
// feintChance is how often the enemy picks a feint (split evenly between the
// feints). Some moves are Blocks.
//
// No tells by default: the caption is always one of neutralCaptions, chosen at
// random, so it never gives the move (or even the step) away. Tells come only
// from a source the player has (a trait, ability, or item; see
// engine/combat.js → tellSources), and say what the enemy WON'T do.
//
// Blocking steps the engine builds when they apply:
//   flinch – right after the player lands a hard hit (hardHit damage or more),
//            with flinchChance (never twice running): usually Blocks the spot
//            that was just hit; its feint attacks instead.
//   guard  – when the player attacks the same spot in 2 of their last 3
//            exchanges: with guardChance, it Blocks that spot (or feints an attack).
//
// luck is the enemy's Luck for the miss chance (engine/rules.js → missChance).
// shifts: true on a move means the enemy changes position as it acts; an
// attack at it that isn't faster than that move misses.
// clash is the direction the enemy usually picks if that move's attack starts
// a Clash; clashHabit is how often it sticks to it (otherwise it goes one of
// the other three directions).
//
// All randomness uses the seeded random function, so a fight can be replayed.
// art is the picture's file name in assets/house/ and assets/full/.

export const ENEMIES = {
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    art: 'werewolf',
    range: 'Close',
    line: 'Grrrhh…',
    attrs: { STR: 9, AGI: 9, WIS: 3, FAI: 2 },
    damageBonus: 2,
    feintChance: 0.47,
    luck: 6,
    clashHabit: 0.9,
    neutralCaptions: [
      'The werewolf paces, watching you.',
      'It circles, low and silent.',
      'Its breath steams in the cold air.',
      'It sways, claws flexing.',
    ],
    hardHit: 3,
    flinchChance: 0.5,
    guardChance: 0.35,
    weapons: ['claws', 'bite'],
    armor: { head: null, body: null, legs: null },
    resist: {},
    weak: {},
    flinch: { feints: [{ action: 'attack', weapon: 'bite', target: 'head', clash: 'head' }] },
    guard: { feints: [{ action: 'attack', weapon: 'claws', target: 'legs', clash: 'legs' }] },
    pattern: [
      { id: 'w1', when: 'default', variants: [
        { id: 'w1-legs', action: 'attack', weapon: 'claws', target: 'legs', clash: 'legs' },
        { id: 'w1-left', action: 'attack', weapon: 'claws', target: 'left', clash: 'left' },
      ] },
      { id: 'w2', when: 'afterBlocked', variants: [
        { id: 'w2-head', action: 'attack', weapon: 'bite', target: 'head', clash: 'head' },
        { id: 'w2-right', action: 'attack', weapon: 'claws', target: 'right', clash: 'right' },
        { id: 'w2-guard', action: 'block', target: 'head' },
      ] },
      { id: 'w3', when: 'default', variants: [
        { id: 'w3-right', action: 'attack', weapon: 'claws', target: 'right', clash: 'right' },
        { id: 'w3-legs', action: 'attack', weapon: 'bite', target: 'legs', clash: 'legs' },
        // It sidesteps as it strikes: a slower or equal attack at it misses.
        { id: 'w3-left', action: 'attack', weapon: 'claws', target: 'left', clash: 'left', shifts: true },
      ] },
      // The trick: after three steps you'd expect claws at your legs again, but its main move bites at your head.
      { id: 'w4', when: 'default', variants: [
        { id: 'w4-head', action: 'attack', weapon: 'bite', target: 'head', clash: 'legs' },
        { id: 'w4-legs', action: 'attack', weapon: 'claws', target: 'legs', clash: 'head' },
      ] },
      { id: 'w5', when: 'below50', variants: [
        { id: 'w5-howl', action: 'enrage' },
      ] },
    ],
    fortuneHints: [
      'Its back paw slips on loose stone.',
      'A branch snaps behind it; its ears twitch away.',
      'Moonlight dazzles its eyes for a moment.',
    ],
  },

  barrowKnight: {
    id: 'barrowKnight',
    name: 'Barrow Knight',
    art: 'barrow-knight',
    range: 'Approach',
    line: 'Turn back.',
    attrs: { STR: 11, AGI: 3, WIS: 4, FAI: 0 },
    damageBonus: 1,
    feintChance: 0.48,
    luck: 6,
    clashHabit: 0.78,
    neutralCaptions: [
      'The knight stands still, blade ready.',
      'Its visor gives nothing away.',
      'Old armor creaks as it shifts its weight.',
      'Dust drifts down around it.',
    ],
    hardHit: 3,
    flinchChance: 0.35,
    guardChance: 0.4,
    weapons: ['greatsword'],
    armor: { head: 'Heavy', body: 'Heavy', legs: 'Medium' },
    resist: {},
    weak: { FAI: 2 },
    flinch: { feints: [{ action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' }] },
    guard: { feints: [{ action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' }] },
    pattern: [
      { id: 'k1', when: 'default', variants: [
        { id: 'k1-head', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' },
        { id: 'k1-left', action: 'attack', weapon: 'greatsword', target: 'left', clash: 'left' },
        { id: 'k1-guard', action: 'block', target: 'head' },
      ] },
      { id: 'k2', when: 'default', variants: [
        { id: 'k2-right', action: 'attack', weapon: 'greatsword', target: 'right', clash: 'left' },
        { id: 'k2-legs', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
        { id: 'k2-guard', action: 'block', target: 'right' },
      ] },
      { id: 'k3', when: 'afterBlocked', variants: [
        { id: 'k3-block', action: 'block', target: 'legs' },
        { id: 'k3-legs', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
      ] },
      // The trick: every fourth swing goes for your legs, where step 1 goes for your head.
      { id: 'k4', when: 'default', variants: [
        { id: 'k4-legs', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
        { id: 'k4-head', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' },
      ] },
    ],
    fortuneHints: [
      'Its foot slips on the wet stone.',
      'Its old armor catches at the elbow.',
      'Dust falls from the ceiling into its visor.',
    ],
  },
};

export function getEnemy(id) {
  const e = ENEMIES[id];
  if (!e) throw new Error('Unknown enemy: ' + id);
  return e;
}
