// Traits from "Core Rules" → Traits. kind is TPT/TNT/CPT/CNT/PPT/PNT.
// clearedBy lists what removes the trait early (Sleep clears every TPT and TNT).
//
// Reading the enemy: any trait (and any ability or equipped item, see
// engine/combat.js → readingModifiers) can carry
//   read:  points added to the reading score (more tells, fewer hidden moves)
//   clues: a flat change to the number of clues shown

export const TRAITS = {
  // Combat TPTs that Pray can grant
  focused:    { id: 'focused',    name: 'Focused',    kind: 'TPT', effect: 'One extra clue next exchange',            clearedBy: ['used', 'sleep'], clues: 1 },
  emboldened: { id: 'emboldened', name: 'Emboldened', kind: 'TPT', effect: 'Immune to Fear; Advantage on the next attack', clearedBy: ['used', 'sleep'] },
  steeled:    { id: 'steeled',    name: 'Steeled',    kind: 'TPT', effect: 'The next TNT you would gain is ignored',  clearedBy: ['used', 'sleep'] },
  blessed:    { id: 'blessed',    name: 'Blessed',    kind: 'TPT', effect: 'The next hit you take deals 25% less damage', clearedBy: ['used', 'sleep'] },
  nimble:     { id: 'nimble',     name: 'Nimble',     kind: 'TPT', effect: 'Speed advantage on your next position change', clearedBy: ['used', 'sleep'] },
  wellFed:    { id: 'wellFed',    name: 'Well-Fed',   kind: 'TPT', effect: 'Stamina drains 25% slower',               clearedBy: ['sleep'] },

  // TNTs
  winded:     { id: 'winded',     name: 'Winded',     kind: 'TNT', effect: "Can't use Drawn actions",                 clearedBy: ['rest', 'sleep'] },
  dazed:      { id: 'dazed',      name: 'Dazed',      kind: 'TNT', effect: 'One fewer clue each exchange',            clearedBy: ['rest', 'sleep'], clues: -1 },
  shaken:     { id: 'shaken',     name: 'Shaken',     kind: 'TNT', effect: 'Disadvantage in Clashes',                 clearedBy: ['rest', 'prayer', 'sleep'] },
  fatigued:   { id: 'fatigued',   name: 'Fatigued',   kind: 'TNT', effect: "Abilities that reset through Rest don't reset", clearedBy: ['sleep'] },
  bruised:    { id: 'bruised',    name: 'Bruised',    kind: 'TNT', effect: 'Disadvantage on attacks with the bruised limb', clearedBy: ['sleep'] },
  bleeding:   { id: 'bleeding',   name: 'Bleeding',   kind: 'TNT', effect: 'Lose stamina each exchange',              clearedBy: ['treatment', 'sleep'] },
  fear:       { id: 'fear',       name: 'Fear',       kind: 'TNT', effect: 'Disadvantage against its source',         clearedBy: ['rest', 'prayer', 'sleep'] },
  enraged:    { id: 'enraged',    name: 'Enraged',    kind: 'TNT', effect: 'More damage, less accuracy',              clearedBy: ['rest', 'prayer', 'sleep'] },
  offBalance: { id: 'offBalance', name: 'Off-Balance',kind: 'TNT', effect: 'Attacks miss; Disadvantage on Blocks; no counters', clearedBy: ['exchange', 'rest', 'sleep'] },
  hindered:   { id: 'hindered',   name: 'Hindered',   kind: 'TNT', effect: 'Next action one speed tier slower',       clearedBy: ['exchange', 'rest', 'sleep'] },
};

// The five combat TPTs Pray picks from (Build Spec → "Pray").
export const PRAY_TPTS = ['focused', 'emboldened', 'steeled', 'blessed', 'nimble'];
