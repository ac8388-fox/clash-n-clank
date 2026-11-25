// Enemies for Slice 1 (Build Spec → "Enemies" and "Enemy patterns").
//
// attrs are both the enemy's totals and its starting stamina pools.
// resist / weak are damage multipliers by attribute (×0.5 resist, ×2 weak).
// armor gives the weight on each slot (head, body, legs); body covers Left and Right.
//
// pattern: steps run in order and loop. A step's `when` can make the enemy
// jump to it:
//   'afterBlocked' – jump here right after one of its attacks was Blocked
//   'below50'      – used once, when its stamina falls below half (not part of the loop)
// clash is the direction the enemy picks if this step's attack starts a Clash.
// art is the picture's file name in assets/house/ and assets/full/.

export const ENEMIES = {
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    art: 'werewolf',
    range: 'Close',
    line: 'Grrrhh…',
    attrs: { STR: 12, AGI: 12, WIS: 6, FAI: 2 },
    weapons: ['claws', 'bite'],
    armor: { head: null, body: null, legs: null },
    resist: {},
    weak: {},
    tellText: {
      growlLeft: 'A growl from your left',
      eyesLegs: 'Its eyes are on your legs',
      hacklesRise: 'Its hackles rise',
      jawsOpen: 'Its jaws open wide',
      circlesRight: 'It circles to your right',
      earsFlatten: 'Its ears flatten',
      crouchesLow: 'It crouches low',
      throwsHeadBack: 'It throws its head back',
    },
    pattern: [
      { id: 'w1', tells: ['growlLeft', 'eyesLegs'],    caption: 'Its eyes drop to your legs.',      action: 'attack', weapon: 'claws', target: 'legs',  clash: 'left',  when: 'default' },
      { id: 'w2', tells: ['hacklesRise', 'jawsOpen'],  caption: 'Its jaws open toward your throat.', action: 'attack', weapon: 'bite',  target: 'head',  clash: 'head',  when: 'afterBlocked' },
      { id: 'w3', tells: ['circlesRight', 'earsFlatten'], caption: 'It circles to your right.',      action: 'attack', weapon: 'claws', target: 'right', clash: 'right', when: 'default' },
      { id: 'w4', tells: ['crouchesLow', 'eyesLegs'],  caption: 'It crouches, eyes on your legs.',   action: 'attack', weapon: 'bite',  target: 'head',  clash: 'legs',  when: 'default' },
      { id: 'w5', tells: ['throwsHeadBack'],           caption: 'It howls at the moon.',             action: 'enrage', when: 'below50' },
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
    attrs: { STR: 14, AGI: 4, WIS: 8, FAI: 0 },
    weapons: ['greatsword'],
    armor: { head: 'Heavy', body: 'Heavy', legs: 'Medium' },
    resist: {},
    weak: { FAI: 2 },
    tellText: {
      visorHead: 'Its visor turns to your head',
      swordRises: 'Its sword rises',
      creaksRight: 'Armor creaks on your right',
      weightShifts: 'Its weight shifts',
      plantsFeet: 'It plants its feet',
      bladeLow: 'Its blade drops low',
    },
    pattern: [
      { id: 'k1', tells: ['visorHead', 'swordRises'],  caption: 'The visor turns to your head.',   action: 'attack', weapon: 'greatsword', target: 'head',  clash: 'head', when: 'default' },
      { id: 'k2', tells: ['creaksRight', 'weightShifts'], caption: 'Its armor creaks on your right.', action: 'attack', weapon: 'greatsword', target: 'right', clash: 'left', when: 'default' },
      { id: 'k3', tells: ['plantsFeet', 'bladeLow'],   caption: 'It plants its feet, blade low.',  action: 'block',  target: 'legs', when: 'afterBlocked' },
      { id: 'k4', tells: ['visorHead', 'swordRises'],  caption: 'The visor turns to your head.',   action: 'attack', weapon: 'greatsword', target: 'legs',  clash: 'legs', when: 'default' },
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
