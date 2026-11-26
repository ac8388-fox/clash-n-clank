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
// Feints: every step has a shared FIRST clue (and caption), then one or more
// variants. variants[0] is the main move; the others are feints. Each variant
// has its own SECOND clue, so a player who perceives two clues can tell the
// main move from a feint. feintChance is how often the enemy picks a feint
// (split evenly between the feints). Some variants are Blocks.
//
// Hiding: hideChance is how often the enemy gives nothing away (no clues, and
// one of its hiddenCaptions instead of the step's caption). High WIS + FAI and
// Luck lower it a little (engine/rules.js → hideChance).
//
// Blocking steps the engine builds when they apply:
//   flinch – right after the player lands a hard hit (hardHit damage or more),
//            with flinchChance (never twice running): usually Blocks the spot
//            that was just hit.
//   guard  – when the player attacks the same spot in 2 of their last 3
//            exchanges: with guardChance, it Blocks that spot.
//   Both have a main Block (second clue names the spot) and an attack feint.
//
// All randomness uses the seeded random function, so a fight can be replayed.
// clash is the direction the enemy picks if that variant's attack starts a Clash.
// art is the picture's file name in assets/house/ and assets/full/.

export const ENEMIES = {
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    art: 'werewolf',
    range: 'Close',
    line: 'Grrrhh…',
    attrs: { STR: 8, AGI: 8, WIS: 4, FAI: 2 },
    damageBonus: 1,
    feintChance: 0.45,
    hideChance: 0.25,
    hiddenCaptions: ['It watches you.', 'It paces, giving nothing away.'],
    hardHit: 3,
    flinchChance: 0.5,
    guardChance: 0.35,
    weapons: ['claws', 'bite'],
    armor: { head: null, body: null, legs: null },
    resist: {},
    weak: {},
    tellText: {
      eyesLegs: 'Its eyes are on your legs',
      shoulderDrops: 'Its shoulder drops low',
      growlLeft: 'A growl from your left',
      hacklesRise: 'Its hackles rise',
      jawsOpen: 'Its jaws open wide',
      pawLifts: 'Its right paw lifts',
      ducksLow: 'It ducks its head low',
      circlesRight: 'It circles to your right',
      earsFlatten: 'Its ears flatten',
      headDips: 'Its head dips low',
      weightLeft: 'Its weight shifts left',
      crouchesLow: 'It crouches low',
      eyesFlickUp: 'Its eyes flick up to your throat',
      clawsDig: 'Its claws dig into the earth',
      throwsHeadBack: 'It throws its head back',
      furBristles: 'Its fur bristles',
      // flinch (after a hard hit)
      flinches: 'It flinches from the blow',
      snarlsBack: 'It snarls and lunges back',
      // guard (after you keep striking one spot)
      watchesStrikes: 'It watches where you strike',
      coilsToStrike: 'It coils to strike instead',
    },
    // Second clue for a Block at each spot (used by flinch and guard).
    blockTells: {
      head: 'It tucks its head down',
      left: 'It curls around its left side',
      right: 'It curls around its right side',
      legs: 'It pulls its legs in',
    },
    flinch: {
      first: 'flinches', caption: 'It flinches back from the blow.',
      feints: [{ second: 'snarlsBack', action: 'attack', weapon: 'bite', target: 'head', clash: 'head' }],
    },
    guard: {
      first: 'watchesStrikes', caption: 'It shifts to guard where you keep striking.',
      feints: [{ second: 'coilsToStrike', action: 'attack', weapon: 'claws', target: 'legs', clash: 'legs' }],
    },
    pattern: [
      { id: 'w1', when: 'default', first: 'eyesLegs', caption: 'Its eyes drop to your legs.',
        variants: [
          { id: 'w1-legs', second: 'shoulderDrops', action: 'attack', weapon: 'claws', target: 'legs', clash: 'legs' },
          { id: 'w1-left', second: 'growlLeft', action: 'attack', weapon: 'claws', target: 'left', clash: 'left' },
        ] },
      { id: 'w2', when: 'afterBlocked', first: 'hacklesRise', caption: 'Its jaws open toward your throat.',
        variants: [
          { id: 'w2-head', second: 'jawsOpen', action: 'attack', weapon: 'bite', target: 'head', clash: 'head' },
          { id: 'w2-right', second: 'pawLifts', action: 'attack', weapon: 'claws', target: 'right', clash: 'right' },
          { id: 'w2-guard', second: 'ducksLow', action: 'block', target: 'head' },
        ] },
      { id: 'w3', when: 'default', first: 'circlesRight', caption: 'It circles to your right.',
        variants: [
          { id: 'w3-right', second: 'earsFlatten', action: 'attack', weapon: 'claws', target: 'right', clash: 'right' },
          { id: 'w3-legs', second: 'headDips', action: 'attack', weapon: 'bite', target: 'legs', clash: 'legs' },
          { id: 'w3-left', second: 'weightLeft', action: 'attack', weapon: 'claws', target: 'left', clash: 'left' },
        ] },
      // The trick: it looks at your legs but bites at your head.
      { id: 'w4', when: 'default', first: 'crouchesLow', caption: 'It crouches, eyes on your legs.',
        variants: [
          { id: 'w4-head', second: 'eyesFlickUp', action: 'attack', weapon: 'bite', target: 'head', clash: 'legs' },
          { id: 'w4-legs', second: 'clawsDig', action: 'attack', weapon: 'claws', target: 'legs', clash: 'head' },
        ] },
      { id: 'w5', when: 'below50', first: 'throwsHeadBack', caption: 'It howls at the moon.',
        variants: [
          { id: 'w5-howl', second: 'furBristles', action: 'enrage' },
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
    attrs: { STR: 9, AGI: 2, WIS: 5, FAI: 0 },
    damageBonus: 1,
    feintChance: 0.45,
    hideChance: 0.29,
    hiddenCaptions: ['The knight stands still.', 'Its visor gives nothing away.'],
    hardHit: 3,
    flinchChance: 0.5,
    guardChance: 0.6,
    weapons: ['greatsword'],
    armor: { head: 'Heavy', body: 'Heavy', legs: 'Medium' },
    resist: {},
    weak: { FAI: 2 },
    tellText: {
      visorHead: 'Its visor turns to your head',
      swordRises: 'Its sword rises high',
      gripLeft: 'Its grip shifts to the left',
      bladeAcross: 'Its blade comes up across its visor',
      creaksRight: 'Armor creaks on your right',
      weightRight: 'Its weight shifts right',
      bladeDrops: 'Its blade drops low',
      shoulderTurns: 'It turns its armored shoulder to you',
      plantsFeet: 'It plants its feet',
      guardsLegs: 'Its blade comes down to guard its legs',
      coilsLow: 'It coils to swing low',
      stepsIn: 'It steps in close',
      // flinch (after a hard hit)
      staggers: 'It staggers, then sets its feet',
      swingsBack: 'It swings back in anger',
      // guard (after you keep striking one spot)
      readsBlade: 'It watches your blade',
      raisesSword: 'It raises its sword to strike',
    },
    blockTells: {
      head: 'Its blade comes up before its visor',
      left: 'Its blade covers its left side',
      right: 'Its blade covers its right side',
      legs: 'Its blade drops to cover its legs',
    },
    flinch: {
      first: 'staggers', caption: 'The knight staggers, then steadies.',
      feints: [{ second: 'swingsBack', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' }],
    },
    guard: {
      first: 'readsBlade', caption: 'The knight shifts to meet your strikes.',
      feints: [{ second: 'raisesSword', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' }],
    },
    pattern: [
      { id: 'k1', when: 'default', first: 'visorHead', caption: 'The visor turns to your head.',
        variants: [
          { id: 'k1-head', second: 'swordRises', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' },
          { id: 'k1-left', second: 'gripLeft', action: 'attack', weapon: 'greatsword', target: 'left', clash: 'left' },
          { id: 'k1-guard', second: 'bladeAcross', action: 'block', target: 'head' },
        ] },
      { id: 'k2', when: 'default', first: 'creaksRight', caption: 'Its armor creaks on your right.',
        variants: [
          { id: 'k2-right', second: 'weightRight', action: 'attack', weapon: 'greatsword', target: 'right', clash: 'left' },
          { id: 'k2-legs', second: 'bladeDrops', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
          { id: 'k2-guard', second: 'shoulderTurns', action: 'block', target: 'right' },
        ] },
      { id: 'k3', when: 'afterBlocked', first: 'plantsFeet', caption: 'It plants its feet, blade low.',
        variants: [
          { id: 'k3-block', second: 'guardsLegs', action: 'block', target: 'legs' },
          { id: 'k3-legs', second: 'coilsLow', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
        ] },
      // The trick: every fourth swing looks exactly like step 1 but goes for your legs.
      { id: 'k4', when: 'default', first: 'visorHead', caption: 'The visor turns to your head.',
        variants: [
          { id: 'k4-legs', second: 'swordRises', action: 'attack', weapon: 'greatsword', target: 'legs', clash: 'legs' },
          { id: 'k4-head', second: 'stepsIn', action: 'attack', weapon: 'greatsword', target: 'head', clash: 'head' },
        ] },
    ],
    fortuneHints: [
      'Its foot slips on the wet stone.',
      'Its old armor catches at the elbow.',
      'Dust falls from the ceiling into its visor.',
    ],
  },
};

// The counter step every enemy uses when the player repeats the same action
// and target two exchanges running (see engine/combat.js).
export const COUNTER = {
  first: 'It watches your every move',
  caption: 'It has read your rhythm.',
  second: {
    head: 'Its eyes fix on your head',
    left: 'It eyes your left side',
    right: 'It eyes your right side',
    legs: 'It eyes your legs',
  },
};

export function getEnemy(id) {
  const e = ENEMIES[id];
  if (!e) throw new Error('Unknown enemy: ' + id);
  return e;
}
