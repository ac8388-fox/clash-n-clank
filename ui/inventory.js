// Inventory: ready weapons, pack, armor slots, consumables.
import { WEAPONS, ARMOR, CONSUMABLES } from '../data/items.js';
import { esc } from './render.js';
import { ATTR_WORD } from './common.js';

export function inventoryPanel(g) {
  const c = g.character;
  const inHand = g.combat ? g.combat.player.weaponIndex : 0;
  const dur = (id) => `${c.durability[id] ?? 20}/20`;
  const weapons = c.gear.ready.map((id, i) => id
    ? `<p>${i === inHand ? '▸ ' : ''}${esc(WEAPONS[id].name)} <span class="note">${esc(WEAPONS[id].reach)}, ${esc(WEAPONS[id].speed)}, ${esc(WEAPONS[id].tier)}, ${esc(ATTR_WORD[WEAPONS[id].drains])} · ${dur(id)}</span></p>`
    : `<p class="note">(empty)</p>`).join('');
  const armor = ['head', 'body', 'hands', 'legs'].map(slot => {
    const id = c.gear.armor[slot];
    return `<div class="row"><span>${slot[0].toUpperCase() + slot.slice(1)}</span><span>${id ? `${esc(ARMOR[id].name)} (${esc(ARMOR[id].weight)}) · ${dur(id)}` : '—'}</span></div>`;
  }).join('');
  const pack = c.pack.map(p => `<p>${esc(CONSUMABLES[p.itemId].name)} ×${p.qty} <span class="note">Item action: +${CONSUMABLES[p.itemId].effect.amount} to your lowest bar</span></p>`).join('') || '<p class="note">Empty.</p>';
  return { kind: 'panel', html: `<h2>Inventory</h2><h3>Ready weapons</h3>${weapons}<p class="note">▸ in hand. Plan B switches weapons.</p>
    <h3>Armor</h3>${armor}<div class="row"><span>Shield</span><span>${c.gear.shield ? esc(c.gear.shield) : '—'}</span></div>
    <h3>Pack</h3>${pack}` };
}
