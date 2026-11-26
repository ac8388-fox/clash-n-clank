// The Slice 1 world (Build Spec → "World map" and "Trials").
//
// Each event has a kind ('travel' | 'trial' | 'combat' | 'camp'), a name, the
// picture it uses (art: file name in assets/house/ and assets/full/), text for
// arriving, and four exits. An exit either leads somewhere ({ to, teaser }) or
// is Camp ({ camp: true, teaser }) – a direction that can't be traveled is
// never a dead option. An exit can depend on a world flag:
//   { requires: 'gorgeCrossed', to, teaser, otherwise: { camp: true, teaser } }
//
// Trial options: one per direction. Up FAI, Right STR, Down WIS, Left AGI.
// success: text, the world flags it sets, and what happens next.

export const EVENTS = {
  crossroads: {
    id: 'crossroads', kind: 'travel', name: 'Crossroads', art: 'crossroads',
    text: 'Four roads meet under a leaning signpost.',
    exits: {
      N: { to: 'village', teaser: 'Smoke above the trees' },
      E: { to: 'hills', teaser: 'A howl from the hills' },
      S: { to: 'gorge', teaser: 'A rope bridge sways' },
      W: { camp: true, teaser: 'West is a sheer drop' },
    },
  },
  gorge: {
    id: 'gorge', kind: 'trial', name: 'Gorge', art: 'gorge', trial: 'gorge',
    text: 'A rope bridge sways over a deep gorge. Far below, the river roars.',
    doneText: 'The bridge creaks behind you. The far side is yours.',
    exits: {
      N: { to: 'crossroads', teaser: 'The road back north' },
      E: { camp: true, teaser: 'A ledge above the drop' },
      S: { requires: 'gorgeCrossed', to: 'crypt', teaser: 'Steps into the dark',
           otherwise: { camp: true, teaser: 'The bridge isn’t crossed yet' } },
      W: { camp: true, teaser: 'Loose scree and wind' },
    },
  },
  crypt: {
    id: 'crypt', kind: 'trial', name: 'Sealed Crypt', art: 'crypt', trial: 'crypt',
    enemy: 'barrowKnight',
    text: 'A stone door, sealed with old runes, set deep into the hillside.',
    doneText: 'The crypt stands open. Cold air breathes out of the dark.',
    clearedText: 'The barrow is still. Nothing stirs in the dark now.',
    exits: {
      N: { to: 'gorge', teaser: 'Back across the bridge' },
      E: { camp: true, teaser: 'Cold stone and old bones' },
      S: { camp: true, teaser: 'The hillside closes in' },
      W: { camp: true, teaser: 'A dead end of fallen rock' },
    },
  },
  hills: {
    id: 'hills', kind: 'combat', name: 'Hills', art: 'crossroads', enemy: 'werewolf',
    text: 'The wind moans across the hills. Something huge rises from the heather.',
    clearedText: 'The hills are quiet now. Only the wind moves.',
    exits: {
      N: { camp: true, teaser: 'High moor, no path' },
      E: { camp: true, teaser: 'Heather and stone' },
      S: { camp: true, teaser: 'A steep bank' },
      W: { to: 'crossroads', teaser: 'Down to the crossroads' },
    },
  },
  village: {
    id: 'village', kind: 'camp', name: 'Village', art: 'crossroads', safeSleep: true,
    text: 'A few cottages around a well. You can rest safely here.',
    exits: {
      N: { camp: true, teaser: 'A cottage with a spare bed' },
      E: { camp: true, teaser: 'The inn’s warm hearth' },
      S: { to: 'crossroads', teaser: 'The road south' },
      W: { camp: true, teaser: 'A hayloft' },
    },
  },
};

export const TRIALS = {
  gorge: {
    id: 'gorge', name: 'Crossing the Gorge',
    prompt: 'How will you cross?',
    options: [
      { dir: 'up',    attr: 'FAI', label: 'Pray for passage', requirement: 8 },
      { dir: 'right', attr: 'STR', label: 'Brace the post',   requirement: 10 },
      { dir: 'down',  attr: 'WIS', label: 'Study the knots',  requirement: 7 },
      { dir: 'left',  attr: 'AGI', label: 'Dash across',      requirement: 10 },
    ],
    success: { text: 'You reach the far side. Steps lead down into the dark to the south.', flags: { gorgeCrossed: true }, next: 'travel' },
    fortuneHints: ['The wind drops for a moment.', 'The bridge steadies between gusts.'],
    failure: { text: 'The bridge bucks under you and you scramble back, bruised.' },
  },
  crypt: {
    id: 'crypt', name: 'The Sealed Crypt',
    prompt: 'How will you open the seal?',
    options: [
      { dir: 'up',    attr: 'FAI', label: 'Pray over the seal', requirement: 8 },
      { dir: 'right', attr: 'STR', label: 'Force the door',     requirement: 12 },
      { dir: 'down',  attr: 'WIS', label: 'Read the runes',     requirement: 9 },
      { dir: 'left',  attr: 'AGI', label: 'Pick the lock',      requirement: 9 },
    ],
    success: { text: 'The seal cracks. Armor grinds in the dark: something was waiting.', flags: { cryptOpen: true }, next: 'combat' },
    fortuneHints: ['A rune flickers, half awake.', 'Something shifts behind the door.'],
    failure: { text: 'The seal holds, and the effort costs you.' },
  },
};

// Racial abilities in trials (slice version): replaces the weakest option and
// succeeds automatically, then waits for a Rest.
export const RACIAL_TRIAL_TEXT = {
  human: 'Resourceful: you find another way.',
  dwarf: 'Bedrock: you hold firm and push through.',
  elf: 'Elven Grace: you move without a misstep.',
  halfling: 'Lucky Escape: somehow, it works out.',
  goblin: 'Scavenge: you find just what you need lying about.',
  gnome: 'Invent: you rig something clever.',
  beastborn: 'Beast Fusion: you draw on a beast’s strength.',
  dragon: 'Word of Power: an ancient word, and it yields.',
  ent: 'Entangling Roots: roots do the work for you.',
};

export const DIRECTIONS = ['N', 'E', 'S', 'W'];
// Diamond buttons for travel: Up is North, Right is East, Down is South, Left is West.
export const DIR_FOR_BUTTON = { up: 'N', right: 'E', down: 'S', left: 'W' };

export function getEvent(id) {
  const e = EVENTS[id];
  if (!e) throw new Error('Unknown event: ' + id);
  return e;
}
export function getTrial(id) {
  const t = TRIALS[id];
  if (!t) throw new Error('Unknown trial: ' + id);
  return t;
}
