// Weapons, armor, and consumables used in Slice 1.
// Slice numbers come from the Build Spec ("Starting gear", "Enemies").
//
// bonusAttr: which attribute's total adds (÷5) to damage. Heavy and blunt
// weapons use STR, finesse and ranged use AGI; other weapons use the
// attribute they drain (sword STR, dagger AGI).

export const WEAPONS = {
  sword:      { id: 'sword',      name: 'Sword',      reach: 'Approach', speed: 'Fair',  tier: 'Medium', drains: 'STR', hands: 1, traits: ['sharp'],              durability: 20 },
  dagger:     { id: 'dagger',     name: 'Dagger',     reach: 'Close',    speed: 'Swift', tier: 'Light',  drains: 'AGI', hands: 1, traits: ['sharp', 'throwable'], durability: 20 },
  // Enemy weapons
  claws:      { id: 'claws',      name: 'Claws',      reach: 'Close',    speed: 'Swift', tier: 'Light',  drains: 'AGI', hands: 2, traits: [],                     durability: 20 },
  bite:       { id: 'bite',       name: 'Bite',       reach: 'Close',    speed: 'Fair',  tier: 'Medium', drains: 'STR', hands: 0, traits: [],                     durability: 20 },
  greatsword: { id: 'greatsword', name: 'Greatsword', reach: 'Approach', speed: 'Drawn', tier: 'Heavy',  drains: 'STR', hands: 2, traits: ['sharp', 'heavy'],     durability: 20 },
};

export const ARMOR = {
  leatherJerkin: { id: 'leatherJerkin', name: 'Leather jerkin', slot: 'body', weight: 'Light', durability: 20 },
};

export const CONSUMABLES = {
  herbalDraught: { id: 'herbalDraught', name: 'Herbal draught', speed: 'Fair', effect: { kind: 'restoreLowest', amount: 4 } },
};

export function getWeapon(id) {
  const w = WEAPONS[id];
  if (!w) throw new Error('Unknown weapon: ' + id);
  return w;
}
