// End: victory or defeat summary, then the title.
import { ATTRS, attrTotal } from '../engine/rules.js';
import { statsFor } from './common.js';

export function endView(ctx) {
  const { g } = ctx;
  const w = g.world, c = g.character;
  const won = g.runOver === 'victory';
  const left = ATTRS.reduce((s, k) => s + c.attrs[k].stamina, 0), tot = ATTRS.reduce((s, k) => s + attrTotal(c, k), 0);
  return {
    art: won ? 'crossroads' : (g.lastEnemyArt || 'crossroads'),
    topBar: { stats: statsFor(c), compass: { facing: w.facing } },
    title: { big: won ? 'VICTORY' : 'DEFEAT', small: won ? 'The road is safe again.' : 'Your strength is spent.' },
    always: true,
    bottom: [
      `${c.name}, Day ${w.day}, ${w.timeOfDay}.`,
      `Werewolf: ${w.defeated.werewolf ? 'defeated' : 'still hunting'}. Barrow Knight: ${w.defeated.barrowKnight ? 'defeated' : 'still waiting'}.`,
      `Stamina left: ${left} of ${tot}.`,
      ...(g.lines || []).slice(-2),
    ],
    diamond: { up: { label: 'Title', icon: 'play', run: () => ctx.act.toTitle() } },
  };
}
