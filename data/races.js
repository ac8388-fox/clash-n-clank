// The nine races from "Core Rules" → Races.
// attrs are the 24 Natural points each race starts with (STR, AGI, WIS, FAI).
// startingLuck is the race's Luck floor: Luck never drops below it.
// luckModifier is the fixed racial modifier added to Luck (Human +6, Dragon −10).

export const RACES = [
  { id: 'halfling',  name: 'Halfling',  attrs: { STR: 3,  AGI: 12, WIS: 3,  FAI: 6  }, startingLuck: 12, luckModifier: 0,   ability: 'Lucky Escape',     positive: 'Pathfinder',  negative: 'Traditionalist', drinkTolerance: 'High' },
  { id: 'goblin',    name: 'Goblin',    attrs: { STR: 5,  AGI: 12, WIS: 6,  FAI: 1  }, startingLuck: 12, luckModifier: 0,   ability: 'Scavenge',         positive: 'Tenacious',   negative: 'Impulsive',      drinkTolerance: 'Moderate' },
  { id: 'dwarf',     name: 'Dwarf',     attrs: { STR: 10, AGI: 6,  WIS: 6,  FAI: 2  }, startingLuck: 8,  luckModifier: 0,   ability: 'Bedrock',          positive: 'Stout',       negative: 'Stubborn',       drinkTolerance: 'High' },
  { id: 'elf',       name: 'Elf',       attrs: { STR: 4,  AGI: 6,  WIS: 4,  FAI: 10 }, startingLuck: 8,  luckModifier: 0,   ability: 'Elven Grace',      positive: 'Lightfooted', negative: 'Arrogant',       drinkTolerance: 'Low' },
  { id: 'gnome',     name: 'Gnome',     attrs: { STR: 3,  AGI: 6,  WIS: 10, FAI: 5  }, startingLuck: 8,  luckModifier: 0,   ability: 'Invent',           positive: 'Precise',     negative: 'Perfectionist',  drinkTolerance: 'Low' },
  { id: 'beastborn', name: 'Beastborn', attrs: { STR: 12, AGI: 7,  WIS: 2,  FAI: 3  }, startingLuck: 6,  luckModifier: 0,   ability: 'Beast Fusion',     positive: 'Resilient',   negative: 'Alienated',      drinkTolerance: 'Varies' },
  { id: 'human',     name: 'Human',     attrs: { STR: 6,  AGI: 6,  WIS: 6,  FAI: 6  }, startingLuck: 6,  luckModifier: 6,   ability: 'Resourceful',      positive: 'Curious',     negative: 'Mortal',         drinkTolerance: 'Moderate' },
  { id: 'dragon',    name: 'Dragon',    attrs: { STR: 7,  AGI: 3,  WIS: 12, FAI: 2  }, startingLuck: 4,  luckModifier: -10, ability: 'Word of Power',    positive: 'Keen Senses', negative: 'Greedy',         drinkTolerance: 'Moderate' },
  { id: 'ent',       name: 'Ent',       attrs: { STR: 4,  AGI: 2,  WIS: 8,  FAI: 10 }, startingLuck: 4,  luckModifier: 0,   ability: 'Entangling Roots', positive: 'Ancient',     negative: 'Slow',           drinkTolerance: 'High' },
];

export function getRace(id) {
  const race = RACES.find(r => r.id === id);
  if (!race) throw new Error('Unknown race: ' + id);
  return race;
}
