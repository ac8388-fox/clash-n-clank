// Combat (Build Spec → "Combat resolution", "Interface implementation").
// Carousel page 1: Pray (up), Attack (right), Block (down), Item (left);
// abilities fill later pages four at a time; spent abilities stay in place,
// greyed, showing their reset. Choosing Attack, Block, or an attacking
// ability turns the diamond into Head, Left, Right, Legs. A Clash opens a
// full-screen CLASH prompt with the four directions.
//
// The caption is always neutral; tells (clue chips, reverse style) appear only
// when a tell source gives one. Result lines show hits, misses, Clanks,
// Clashes, and Clash damage.
//
// Graphic displays draw the enemy as its own layer (data/enemyArt.js): the
// four zones are the targets (outlined while choosing where; hold one to
// choose it), tells dim the zones they rule out, and the last exchange's
// events (ui.fx) play as short effects on the zones and the screen edges.
import { getEnemy } from '../data/enemies.js';
import { ENEMY_ART } from '../data/enemyArt.js';
import { getAbility } from '../data/abilities.js';
import { getWeapon } from '../data/items.js';
import { TRAITS } from '../data/traits.js';
import { availableActions } from '../engine/combat.js';
import { ATTRS } from '../engine/rules.js';
import { statsFor, resultLines, ATTR_WORD, HOLD_HELP } from './common.js';

const DIRS = ['up', 'right', 'down', 'left'];
const TARGET = { up: 'head', left: 'left', right: 'right', down: 'legs' };
const TARGET_LABEL = { head: 'Head', left: '‹ Left', right: 'Right ›', legs: 'Legs' };
const TARGET_ICON = { head: 'head', left: 'left', right: 'right', legs: 'legs' };
const sum = (m) => ATTRS.reduce((s, k) => s + m[k], 0);

export function pageCount(character) {
  return 1 + Math.ceil(character.abilities.filter(id => !getAbility(id).passive).length / 4);
}

// Short status: conditions and blessings that matter this exchange.
function statusLine(c, cb) {
  const bits = [];
  for (const x of cb.player.conditions) bits.push(TRAITS[x.id].name);
  if (cb.player.advantageNext) bits.push('Advantage on your next attack');
  if (cb.player.speedPenaltyNext) bits.push('your next action is slower');
  for (const t of c.traits) {
    if (t.kind === 'TPT') bits.push(`${TRAITS[t.id].name}${t.left ? ` (${t.left})` : ''}`);
    if (t.kind === 'TNT') bits.push(TRAITS[t.id].name);
  }
  const foe = [];
  for (const x of cb.enemy.conditions) foe.push(TRAITS[x.id].name);
  if (cb.enemy.enraged) foe.push('Enraged');
  const parts = [];
  if (bits.length) parts.push(`You: ${bits.join(', ')}.`);
  if (foe.length) parts.push(`It: ${foe.join(', ')}.`);
  return parts.join(' ');
}

export function combatView(ctx) {
  const { g, ui, act } = ctx;
  const c = g.character, cb = g.combat, e = getEnemy(cb.enemyId);
  const fortune = cb.current.fortune;
  const clash = cb.pendingClash;
  const tells = clash ? clash.tells : cb.current.tells;
  const status = statusLine(c, cb);
  const results = resultLines(g.lines);
  const v = {
    art: e.art,
    topBar: { stats: statsFor(c), compass: { rose: true } },
    name: { text: e.name, kind: 'enemy', range: e.range,
            star: fortune.open && !clash ? { armed: ui.armed } : null,
            foe: sum(cb.enemy.stamina) / sum(cb.enemy.totals) },
    caption: cb.current.caption,
    speech: cb.exchange === 1 && !g.lines.length ? `“${e.line}”` : null,
    hint: fortune.open && !clash ? `★ ${fortune.hint}${ui.armed ? ' Armed: hold a choice.' : ''}` : null,
    chips: clash ? [] : tells,
    top: [cb.current.caption, ...(cb.exchange === 1 && !g.lines.length ? [`“${e.line}”`] : []),
          ...tells.map(t => ({ text: t, cls: 'tell' }))],
    bottom: [
      ...(fortune.open && !clash ? [{ text: `★ ${fortune.hint} ${ui.armed ? 'Armed: hold a choice.' : 'Tap the star, then hold a choice, for a lucky attempt.'}`, cls: 'hint' }] : []),
      ...results,
      ...(status ? [{ text: status, cls: 'dim' }] : []),
    ],
    results: [...results, ...(status ? [{ text: status, cls: '' }] : [])],
    dice: ui.dice,
    corners: true,
  };

  const ea = ENEMY_ART[cb.enemyId];
  if (ea) {
    const tell = clash ? clash.tell : cb.current.tell;
    v.art = `${e.art}-bg`;
    v.enemy = {
      sprite: `${e.art}-sprite`, box: ea.box, zones: ea.zones,
      health: sum(cb.enemy.stamina) / sum(cb.enemy.totals),
      enraged: !!cb.enemy.enraged,
      targeting: !!clash || !!(ui.pending && ['attack', 'block', 'ability'].includes(ui.pending.action)),
      ruledOut: tell ? tell.ruledOut : [],
      safe: tell && tell.level === 1 ? tell.ruledOut[0] : null,
      fx: ui.fx || null,
      falling: cb.outcome === 'victory',
    };
  }

  if (clash) {
    v.clash = { tells };
    v.caption = null; v.speech = null; v.hint = null;
    v.top = [];
    v.bottom = [...results];
    v.diamond = {};
    for (const d of DIRS) v.diamond[d] = { label: TARGET_LABEL[TARGET[d]], icon: TARGET_ICON[TARGET[d]], run: () => act.clash(TARGET[d]) };
    v.helper = HOLD_HELP();
    return v;
  }

  if (ui.pending) {
    const what = ui.pending.action === 'block' ? 'Block' : ui.pending.action === 'attack' ? 'Attack' : getAbility(ui.pending.abilityId).name;
    v.diamond = {};
    for (const d of DIRS) v.diamond[d] = { label: TARGET_LABEL[TARGET[d]], icon: TARGET_ICON[TARGET[d]], run: () => act.fight({ ...ui.pending, target: TARGET[d] }) };
    v.center = { html: `${what}<br>where?` };
    v.helper = HOLD_HELP();
    return v;
  }

  const acts = availableActions(c, cb);
  const n = pageCount(c);
  v.dots = { n, i: ui.page };
  if (ui.page === 0) {
    const [pray, attack, block, item] = acts.page1;
    const weapon = acts.weapon ? getWeapon(c.gear.ready[cb.player.weaponIndex]) : null;
    v.diamond = {
      up: { label: 'Pray', sub: 'Faith', icon: 'FAI', enabled: pray.enabled, run: () => act.fight({ action: 'pray' }) },
      right: { label: 'Attack', sub: weapon ? `${weapon.name} · ${ATTR_WORD[weapon.drains]}` : 'no weapon', icon: 'STR', enabled: attack.enabled, run: () => act.pend({ action: 'attack' }) },
      down: { label: 'Block', sub: 'Wisdom', icon: 'block', enabled: block.enabled, run: () => act.pend({ action: 'block' }) },
      left: { label: 'Item', sub: item.enabled ? `Draught ×${item.detail.split('×')[1]}` : 'none left', icon: 'item', enabled: item.enabled, run: () => act.fight({ action: 'item' }) },
    };
    v.center = { text: 'Choose your action' };
  } else {
    v.diamond = {};
    acts.abilities.slice((ui.page - 1) * 4, ui.page * 4).forEach((a, i) => {
      const spent = a.cooldownLeft > 0 || a.winded;
      v.diamond[DIRS[i]] = {
        label: a.name, icon: a.id === 'crusher' ? 'hammer' : 'swap', dashed: spent,
        sub: a.winded ? 'Winded' : a.cooldownLeft ? `ready in ${a.cooldownLeft}` : a.speed,
        enabled: a.enabled, run: () => act.pend({ action: 'ability', abilityId: a.id }),
      };
    });
    v.center = { text: 'Choose your action' };
  }
  return v;
}
