// Small helpers the screens share.
import { ATTRS, attrTotal } from '../engine/rules.js';
import { holdWords } from './settings.js';

export const ATTR_WORD = { STR: 'Strength', AGI: 'Agility', WIS: 'Wisdom', FAI: 'Faith' };
export const DIR_WORD = { N: 'North', E: 'East', S: 'South', W: 'West' };
export const HOLD_HELP = () => `hold ${holdWords()} to choose`;

// The four stamina bars for the top bar.
export function statsFor(character) {
  return ATTRS.map(k => ({ k, cur: character.attrs[k].stamina, tot: attrTotal(character, k) }));
}

// Result lines, marked so harm to the player stands out (red) in both displays.
export function resultLines(lines) {
  return (lines || []).map(t => ({
    text: t,
    cls: /^(Its |It wins the Clash|You collapse|Off-Balance, your|Your .* (swings wide|can't reach)|It sidesteps|No luck|It seizes)/.test(t) ? 'bad' : '',
  }));
}

// Dice from a lucky-attempt line such as "Lucky! (d20: 2, d12: 7) …".
export function diceFrom(lines, luckyNumber) {
  for (const t of lines || []) {
    const m = t.match(/^(Lucky!|No luck\.) \(([^)]*)\)/);
    if (m) {
      return [...m[2].matchAll(/d(\d+): (\d+)/g)].map(x => ({ sides: +x[1], value: +x[2], lucky: +x[2] === luckyNumber }));
    }
  }
  return null;
}
