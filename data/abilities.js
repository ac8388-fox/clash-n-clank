// Class abilities used in Slice 1 (Class Abilities → Fighter, Level 1).
// target: where the ability hits. 'main' = the target of the main attack of
// the weapon in hand (Sword → Right, Dagger → Left); otherwise a fixed spot.
// Abilities with no target (buffs, stances) leave it out.
// cooldown: exchanges the ability is unavailable after use (Swift 1, Fair 2, Drawn 3).

export const ABILITIES = {
  planB: {
    id: 'planB', name: 'Plan B', speed: 'Fair', drains: 'STR', cooldown: 2,
    target: 'main', effect: 'planB', upgradesTo: ['followUp'],
    description: 'Your weapon’s main attack, then switch weapons; your next action has a Speed disadvantage.',
  },
  crusher: {
    id: 'crusher', name: 'Crusher', speed: 'Drawn', drains: 'STR', cooldown: 3,
    target: 'head', effect: 'crusher', multiplier: 1.5, upgradesTo: ['punisher'],
    description: 'A stronger attack (+50% damage), brought down on the head.',
  },
  // Bard (Class Abilities → Bard, Level 4). Not used by the slice's Fighter;
  // the engine supports it so misses can be turned into hits later.
  fortunesFavor: {
    id: 'fortunesFavor', name: "Fortune's Favor", passive: true, reset: 'rest',
    description: 'Once per Rest, turn a miss into a hit.',
  },
};

export function getAbility(id) {
  const a = ABILITIES[id];
  if (!a) throw new Error('Unknown ability: ' + id);
  return a;
}
