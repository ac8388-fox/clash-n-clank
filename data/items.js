// Weapons, armor, and consumables used in Slice 1.
// Slice numbers come from the Build Spec ("Starting gear", "Enemies").
//
// bonusAttr: which attribute's total adds (÷5) to damage. Heavy and blunt
// weapons use STR, finesse and ranged use AGI; other weapons use the
// attribute they drain (sword STR, dagger AGI).
//
// natural: true marks natural weapons (claws, bites, fists, hand wraps).
// They can Clash but never Clank; only hard weapons Clank.
//
// attacks: every player weapon covers all four spots, one attack per
// direction, each with a fixed target, its own speed, and a damage change
// (damage: -1 = one less than the weapon's normal hit). The first is the
// weapon's main attack (page 1 of the carousel); the other three sit on page 2,
// each on the side it hits. Weapons differ by speed and damage, not by reach of
// spots. An attack uses the weapon's attribute (drains).

export const WEAPONS = {
  sword:      { id: 'sword',      name: 'Sword',      reach: 'Approach', speed: 'Fair',  tier: 'Medium', drains: 'STR', hands: 1, traits: ['sharp'],              durability: 20,
                attacks: [
                  { id: 'slash',    name: 'Slash',     target: 'right', speed: 'Fair',  damage: 0, main: true },
                  { id: 'backhand', name: 'Backhand',  target: 'left',  speed: 'Fair',  damage: 0 },
                  { id: 'thrust',   name: 'Thrust',    target: 'head',  speed: 'Swift', damage: -1 },
                  { id: 'lowCut',   name: 'Low Cut',   target: 'legs',  speed: 'Fair',  damage: 0 },
                ] },
  // Light: each hit one less than the sword's (the Light tier); the Jab one less again, like the sword's Thrust.
  dagger:     { id: 'dagger',     name: 'Dagger',     reach: 'Close',    speed: 'Swift', tier: 'Light',  drains: 'AGI', hands: 1, traits: ['sharp', 'throwable'], durability: 20,
                attacks: [
                  { id: 'stab',      name: 'Stab',      target: 'left',  speed: 'Swift', damage: 0, main: true },
                  { id: 'slash',     name: 'Slash',     target: 'right', speed: 'Swift', damage: 0 },
                  { id: 'jab',       name: 'Jab',       target: 'head',  speed: 'Swift', damage: -1 },
                  { id: 'hamstring', name: 'Hamstring', target: 'legs',  speed: 'Swift', damage: 0 },
                ] },
  // Enemy weapons
  claws:      { id: 'claws',      name: 'Claws',      reach: 'Close',    speed: 'Swift', tier: 'Light',  drains: 'AGI', hands: 2, traits: [],                     durability: 20, natural: true },
  bite:       { id: 'bite',       name: 'Bite',       reach: 'Close',    speed: 'Fair',  tier: 'Medium', drains: 'STR', hands: 0, traits: [],                     durability: 20, natural: true },
  greatsword: { id: 'greatsword', name: 'Greatsword', reach: 'Approach', speed: 'Drawn', tier: 'Heavy',  drains: 'STR', hands: 2, traits: ['sharp', 'heavy'],     durability: 20 },
  shield:     { id: 'shield',     name: 'Shield',     reach: 'Approach', speed: 'Fair',  tier: 'Light',  drains: 'STR', hands: 1, traits: ['blunt'],              durability: 20 },
};

export const ARMOR = {
  leatherJerkin: { id: 'leatherJerkin', name: 'Leather jerkin', slot: 'body', weight: 'Light', durability: 20 },
};

export const CONSUMABLES = {
  herbalDraught: { id: 'herbalDraught', name: 'Herbal draught', speed: 'Fair', effect: { kind: 'restoreLowest', amount: 4 } },
};

// A weapon's attacks: the main one, one by id, or the one aimed at a spot.
export function mainAttack(weapon) {
  return (weapon.attacks || []).find(a => a.main) || null;
}
export function weaponAttack(weapon, { attackId = null, target = null } = {}) {
  const list = weapon.attacks || [];
  if (attackId) return list.find(a => a.id === attackId) || null;
  if (target) return list.find(a => a.target === target) || null;
  return mainAttack(weapon);
}

export function getWeapon(id) {
  const w = WEAPONS[id];
  if (!w) throw new Error('Unknown weapon: ' + id);
  return w;
}
