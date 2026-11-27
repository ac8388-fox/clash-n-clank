// Combat (Build Spec → "Combat resolution", "Interface implementation").
// Carousel page 1: Pray (up), the weapon's main attack (right), Block (down),
// Item (left). Page 2: the weapon's other three attacks, each on the side it
// hits. Later pages: abilities four at a time, each on its side where free;
// spent abilities stay in place, greyed, showing their reset. Every attack
// and ability has its own target; only Block turns the diamond into Head,
// Left, Right, Legs. Out of reach, attacks show "can't reach" (greyed). A
// Clash opens a full-screen CLASH prompt with the four directions.
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
import { TRAITS } from '../data/traits.js';
import { availableActions } from '../engine/combat.js';
import { ATTRS } from '../engine/rules.js';
import { statsFor, resultLines, HOLD_HELP } from './common.js';

const DIRS = ['up', 'right', 'down', 'left'];
const TARGET = { up: 'head', left: 'left', right: 'right', down: 'legs' };
const TARGET_LABEL = { head: 'Head', left: '‹ Left', right: 'Right ›', legs: 'Legs' };
const TARGET_ICON = { head: 'head', left: 'left', right: 'right', legs: 'legs' };
const sum = (m) => ATTRS.reduce((s, k) => s + m[k], 0);

// Page 1 (Pray, main attack, Block, Item), page 2 (the weapon's other three
// attacks), then the abilities four at a time.
export function pageCount(character) {
  return 2 + Math.ceil(character.abilities.filter(id => !getAbility(id).passive).length / 4);
}

const DIR_OF = { head: 'up', left: 'left', right: 'right', legs: 'down' };
const SPOT = { head: 'Head', left: 'Left', right: 'Right', legs: 'Legs' };
// A weapon attack as a button: its name, where it hits, its speed (and −1 if it hits lighter).
function attackButton(a, act) {
  return {
    label: a.name, icon: TARGET_ICON[a.target], zone: a.target, enabled: a.enabled,
    sub: a.reach ? `${SPOT[a.target]} · ${a.speed}${a.damage ? ` · ${a.damage}` : ''}` : 'can’t reach',
    run: () => act.fight({ action: 'attack', attackId: a.id }),
  };
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
      targeting: !!clash,
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
    for (const d of DIRS) v.diamond[d] = { label: TARGET_LABEL[TARGET[d]], icon: TARGET_ICON[TARGET[d]], zone: TARGET[d], run: () => act.clash(TARGET[d]) };
    v.helper = HOLD_HELP();
    if (v.enemy) v.enemy.zoneRun = Object.fromEntries(DIRS.map(d => [TARGET[d], v.diamond[d].run]));
    return v;
  }

  // Only Block asks where; every attack and ability has its own target.
  const acts = availableActions(c, cb);
  if (ui.pending && ui.pending.action === 'block') {
    v.diamond = {};
    for (const d of DIRS) v.diamond[d] = { label: TARGET_LABEL[TARGET[d]], icon: TARGET_ICON[TARGET[d]], zone: TARGET[d], run: () => act.fight({ action: 'block', target: TARGET[d] }) };
    v.center = { html: 'Block<br>where?' };
    v.helper = HOLD_HELP();
    if (v.enemy) { v.enemy.targeting = true; v.enemy.zoneRun = Object.fromEntries(DIRS.map(d => [TARGET[d], v.diamond[d].run])); }
    return v;
  }

  const n = pageCount(c);
  v.dots = { n, i: ui.page };
  v.diamond = {};
  if (ui.page === 0) {
    const [pray, , block, item] = acts.page1;
    const main = acts.attacks.find(a => a.main);
    v.diamond = {
      up: { label: 'Pray', sub: 'Faith', icon: 'FAI', enabled: pray.enabled, run: () => act.fight({ action: 'pray' }) },
      right: main ? attackButton(main, act) : { label: 'Attack', sub: 'no weapon', icon: 'STR', enabled: false },
      down: { label: 'Block', sub: 'Wisdom · where?', icon: 'block', enabled: block.enabled, run: () => act.pend({ action: 'block' }) },
      left: { label: 'Item', sub: item.enabled ? `Draught ×${item.detail.split('×')[1]}` : 'none left', icon: 'item', enabled: item.enabled, run: () => act.fight({ action: 'item' }) },
    };
  } else if (ui.page === 1) {
    // The weapon's other three attacks, each on the side it hits.
    for (const a of acts.attacks.filter(x => !x.main)) v.diamond[DIR_OF[a.target]] = attackButton(a, act);
  } else {
    // Abilities, four at a time, each on the side it hits where that side is free.
    const list = acts.abilities.slice((ui.page - 2) * 4, (ui.page - 1) * 4);
    for (const a of list) {
      const want = a.target ? DIR_OF[a.target] : null;
      const d = want && !v.diamond[want] ? want : DIRS.find(x => !v.diamond[x]);
      const spent = a.cooldownLeft > 0 || a.winded;
      v.diamond[d] = {
        label: a.name, icon: a.id === 'crusher' ? 'hammer' : 'swap', dashed: spent, zone: a.target, enabled: a.enabled,
        sub: a.winded ? 'Winded' : a.cooldownLeft ? `ready in ${a.cooldownLeft}` : !a.reach ? 'can’t reach'
          : `${a.target ? SPOT[a.target] + ' · ' : ''}${a.speed}`,
        run: () => act.fight({ action: 'ability', abilityId: a.id }),
      };
    }
  }
  v.center = { text: 'Choose your action' };
  // Graphic: hold a part of the enemy to strike it with the weapon's attack aimed there.
  if (v.enemy) {
    v.enemy.zoneRun = {};
    for (const a of acts.attacks) if (a.enabled) v.enemy.zoneRun[a.target] = () => act.fight({ action: 'attack', attackId: a.id });
  }
  return v;
}
