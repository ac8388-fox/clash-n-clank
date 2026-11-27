// Character sheet: attributes (stamina / total), Luck, traits, class, occupation.
import { getRace } from '../data/races.js';
import { OCCUPATIONS } from '../data/occupations.js';
import { ABILITIES } from '../data/abilities.js';
import { TRAITS } from '../data/traits.js';
import { ATTRS, attrTotal, luckOf, luckyDice } from '../engine/rules.js';
import { readingLabel } from '../engine/combat.js';
import { getEnemy } from '../data/enemies.js';
import { esc } from './render.js';
import { ATTR_WORD } from './common.js';

export function characterPanel(g) {
  const c = g.character, r = getRace(c.raceId);
  const occ = OCCUPATIONS.find(o => o.id === c.mainOccupation.id);
  const luck = luckOf(c);
  const traitLine = (t) => {
    const def = TRAITS[t.id];
    if (t.kind === 'PPT' || t.kind === 'PNT') return `<p class="${t.kind === 'PPT' ? 'tpt' : 'tnt'}">${esc(t.id)} <span class="note">(${t.kind === 'PPT' ? 'permanent, positive' : 'permanent, negative'})</span></p>`;
    if (!def) return '';
    if (t.id === 'injured') return `<p class="tnt">Injured (${esc(t.attr)}) – sleep at the Village to treat <span class="note">(−2 ${esc(t.attr)})</span></p>`;
    return `<p class="${t.kind.endsWith('PT') ? 'tpt' : 'tnt'}">${esc(def.name)}${t.left ? ` (${t.left})` : ''} <span class="note">${esc(def.effect)}</span></p>`;
  };
  const reading = g.combat ? `<h3>Reading</h3><p>Reading the ${esc(getEnemy(g.combat.enemyId).name.toLowerCase())}: ${esc(readingLabel(c, g.combat).label)}</p>` : '';
  return { kind: 'panel', html: `<h2>${esc(c.name)}</h2>
    <p>${esc(r.name)} · Fighter, Level ${c.classLevel} · ${esc(occ ? occ.name : '')} (Main, Level ${c.mainOccupation.level})</p>
    <h3>Attributes</h3>${ATTRS.map(k => `<div class="row"><span>${ATTR_WORD[k]}</span><span>${c.attrs[k].stamina} / ${attrTotal(c, k)}</span></div>` +
      (c.attrs[k].worn ? `<p class="tnt">${k} −${c.attrs[k].worn} (until you sleep) <span class="note">worn down acting on an empty bar</span></p>` : '')).join('')}
    <h3>Luck</h3><p>Luck ${luck} · lucky number ${c.luckyNumber} · dice ${luckyDice(luck).map(d => 'd' + d).join(', ')}</p>
    <h3>Abilities</h3><p>${c.abilities.map(id => esc(ABILITIES[id].name)).join(', ')} · ${esc(r.ability)} (racial, ${c.racialReady ? 'ready' : 'used: back after a Rest'})</p>
    ${reading}
    <h3>Traits</h3>${c.traits.map(traitLine).join('') || '<p class="note">None.</p>'}
    <p class="note">${esc(occ ? `${occ.name}: ${occ.minor}. Occupation abilities come later.` : '')}</p>` };
}
