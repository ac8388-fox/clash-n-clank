// Draws one screen from a plain description ("view") in the chosen display.
// Screens (ui/title.js, ui/combat.js, …) only describe what to show; this
// file decides how: Text (words) or Graphic (house / full color pictures).
//
// View fields (all optional):
//   art: picture name (assets/<display>/<art>@2x.png), shown in Graphic only
//   topBar: { stats: [{ k, cur, tot }], compass: { rose: true } | { facing: 'N' } }
//   name: { text, kind: 'enemy' | 'place' | 'plain', right, range, star: { armed }, foe }
//   title: { big, small }
//   top / bottom: narrative lines (Text), each a string or { text, cls }
//   always: true – also show the narrative in Graphic (title, creation, camp, end)
//   topHtml: raw HTML for the top narrative (the name box in creation)
//   caption, speech, hint, chips: [..], results: [..] – Graphic overlays
//   diamond: { up | right | down | left: { label, sub, icon, enabled, dashed } }
//   center: { text, tap } – the prompt between the side buttons
//   dots: { n, i }, helper, corners: true, dice: [{ sides, value, lucky }]
//   clash: { tells: [..] }, overlay: { kind: 'menu', items } | { kind: 'panel', html }
//   toast
//   enemy: { sprite, box, zones, health, enraged, targeting, ruledOut, safe, fx, falling }
//          – Graphic fights only: the enemy as its own layer over the background
//            (see enemyLayer below); fx: { id, events } plays once per id.

import { icon, MENU_ICON, CLOSE_ICON, ROSE_ICON, FACING_TRIANGLE } from './icons.js';
import { attachHold } from './hold.js';

const DIRS = ['up', 'right', 'down', 'left'];
const NAMES = { STR: 'STR', AGI: 'AGI', WIS: 'WIS', FAI: 'FAI' };
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let lastFractions = {};
let lastFxId = 0;

// ---- The enemy layer (Graphic fights) --------------------------------------------------------
// Zones are the four targets on the sprite; Up = head, Left = left, Right = right, Down = legs
// ("left" and "right" are the screen's, matching the buttons).
const ZONE_DIR = { head: 'up', left: 'left', right: 'right', legs: 'down' };
const pct = (n) => `${(n * 100).toFixed(2)}%`;
const RECOIL = { head: 'up', left: 'toright', right: 'toleft', legs: 'down' };     // away from the hit
const STEP = 0.14;                                                               // seconds between events

function zoneCenter(en, target) {
  const [l, t, w, h] = en.zones[target];
  return { x: en.box.x + en.box.w * (l + w / 2), y: en.box.y + en.box.h * (t + h / 2) };
}

function enemyLayer(en, display) {
  const fresh = en.fx && en.fx.id !== lastFxId ? en.fx.events : [];
  if (en.fx) lastFxId = en.fx.id;
  const firstHit = fresh.find(e => e.type === 'hit' && e.who === 'player');
  const hitDelay = firstHit ? fresh.indexOf(firstHit) * STEP : 0;
  const clank = fresh.find(e => e.type === 'clank');
  const blocks = new Set(fresh.filter(e => e.type === 'block' && e.who === 'enemy').map(e => e.target));
  const base = `brightness(${(0.4 + 0.6 * Math.max(0, en.health)).toFixed(2)})`;   // darker as it weakens

  const zones = Object.entries(en.zones).map(([z, [l, t, w, h]]) => {
    const cls = ['zone', en.ruledOut.includes(z) ? 'ruled' : '', blocks.has(z) ? 'blockflash' : ''].join(' ');
    return `<div class="${cls}" data-zone="${z}" data-dir="${ZONE_DIR[z]}" aria-label="${z}" ` +
      `style="left:${pct(l)};top:${pct(t)};width:${pct(w)};height:${pct(h)}">` +
      `<span class="fill"></span>${en.safe === z ? '<span class="safe">safe</span>' : ''}</div>`;
  }).join('');

  // Marks on the enemy: damage floats up red, MISS, a shield where it Blocked, sparks on a Clank.
  const marks = fresh.map((e, i) => {
    // On the enemy: your hits and misses, its Blocks, and a Clank.
    const onEnemy = (e.who === 'player' && (e.type === 'hit' || e.type === 'miss')) ||
                    (e.who === 'enemy' && e.type === 'block') || e.type === 'clank';
    if (!onEnemy || !e.target) return '';
    const c = zoneCenter(en, e.target);
    const at = `left:${(c.x - en.box.x).toFixed(0)}px;top:${(c.y - en.box.y).toFixed(0)}px;animation-delay:${(i * STEP).toFixed(2)}s`;
    if (e.type === 'hit') return `<span class="float dmg" style="${at}">−${e.amount}</span>`;
    if (e.type === 'miss') return `<span class="float miss" style="${at}">MISS</span>`;
    if (e.type === 'block') return `<span class="shieldmark" style="${at}">${icon('block', 40)}</span>`;
    if (e.type === 'clank') return `<span class="sparks" style="${at}">${Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45 + 20}deg"></i>`).join('')}</span>`;
    return '';
  }).join('');

  const shakeCls = ['foe-shake', clank ? 'shake' : '', en.enraged ? 'enraged' : ''].join(' ');
  const moveCls = ['foe-move', firstHit ? `recoil-${RECOIL[firstHit.target]}` : '', en.falling ? 'falling' : ''].join(' ');
  const imgCls = firstHit ? 'flash' : '';
  return `<div class="foe${en.targeting ? ' targeting' : ''}" style="left:${en.box.x}px;top:${en.box.y}px;width:${en.box.w}px;height:${en.box.h}px">` +
    `<div class="${shakeCls}"><div class="${moveCls}" style="--d:${hitDelay}s">` +
    `<img class="sprite ${imgCls}" src="assets/${display}/${esc(en.sprite)}@2x.png" alt="" style="--base:${base};--d:${hitDelay}s">` +
    `</div></div>${zones}</div>` +
    // Marks sit above the buttons, so a number near a side button stays readable.
    `<div class="foemarks" style="left:${en.box.x}px;top:${en.box.y}px;width:${en.box.w}px;height:${en.box.h}px">${marks}</div>`;
}

// Screen effects from the same events: the enemy hitting you flashes the edge
// on that side (top for head, left, right, bottom for legs) with the damage; a
// Clash flashes the whole screen before its prompt.
const EDGE = { head: 'top', left: 'left', right: 'right', legs: 'bottom' };
function screenFx(fx) {
  if (!fx) return '';
  return fx.map((e, i) => {
    const d = `animation-delay:${(i * STEP).toFixed(2)}s`;
    if (e.type === 'clash') return '<div class="flashscreen"></div>';
    // On you: its hits and misses, and your Blocks.
    const onYou = (e.who === 'enemy' && (e.type === 'hit' || e.type === 'miss')) || (e.who === 'player' && e.type === 'block');
    if (!onYou || !e.target) return '';
    if (e.type === 'hit') return `<div class="edge ${EDGE[e.target]}" style="${d}"><span class="num">−${e.amount}</span></div>`;
    if (e.type === 'miss') return `<div class="edge ${EDGE[e.target]} missed" style="${d}"><span class="num">MISS</span></div>`;
    if (e.type === 'block') return `<div class="edge ${EDGE[e.target]} blocked" style="${d}"><span class="num">${icon('block', 28)}</span></div>`;
    return '';
  }).join('');
}

function line(l) {
  if (l && typeof l === 'object') return `<p class="${esc(l.cls || '')}">${esc(l.text)}</p>`;
  return `<p>${esc(l)}</p>`;
}

function topBar(tb) {
  const compass = tb.compass && tb.compass.rose
    ? ROSE_ICON
    : `<span class="facing">${FACING_TRIANGLE}<span>${esc(tb.compass ? tb.compass.facing : 'N')}</span></span>`;
  const stats = tb.stats.map(s => {
    const low = s.cur <= Math.ceil(s.tot / 4);
    return `<div class="stat${low ? ' low' : ''}" aria-label="${s.k} ${s.cur} of ${s.tot}">` +
      icon(s.k, 22, 3) +
      `<span class="k">${NAMES[s.k]}</span><span class="v">${s.cur}/${s.tot}</span>` +
      `<div class="meter"><i data-meter="${s.k}" data-to="${s.tot ? Math.round(100 * s.cur / s.tot) : 0}"></i></div></div>`;
  }).join('');
  return `<div class="topbar">
    <button class="iconbtn compass" data-tap="compass" aria-label="Compass. Open the map">${compass}</button>
    <div class="stats">${stats}</div>
    <button class="iconbtn" data-tap="menu" aria-label="Menu">${MENU_ICON}</button>
  </div>`;
}

function nameLine(n) {
  const star = n.star ? `<button id="star" class="${n.star.armed ? 'armed' : ''}" data-tap="star" aria-label="Fortune opening">★</button>` : '';
  const range = n.range
    ? `<span class="rangeword">${esc(n.range)}</span><span class="range" aria-label="Range: ${esc(n.range)}">` +
      ['Close', 'Approach', 'Ranged'].map(r => `<span class="${r === n.range ? 'on' : ''}"></span>`).join('') + '</span>'
    : `<span>${esc(n.right || '')}</span>`;
  const foe = n.foe !== undefined ? `<div class="foebar" aria-label="Enemy stamina"><i data-meter="foe" data-to="${Math.round(100 * n.foe)}"></i></div>` : '';
  return `<div class="nameline"><span class="name ${esc(n.kind || 'plain')}">${esc(n.text)}</span><span class="right">${star}${range}</span></div>${foe}`;
}

function option(dir, o) {
  if (!o) return `<button class="opt ${dir} empty" data-dir="${dir}" disabled aria-hidden="true"></button>`;
  const cls = ['opt', dir, o.dashed ? 'dashed' : '', (o.label || '').length > 9 ? 'long' : ''].join(' ');
  return `<button class="${cls}" data-dir="${dir}" ${o.enabled === false ? 'disabled' : ''} aria-label="${esc(o.label)}${o.sub ? ', ' + esc(o.sub) : ''}">` +
    (o.icon ? icon(o.icon, 38) : '') +
    `<span class="lbl">${esc(o.label)}</span>` + (o.sub ? `<span class="sub">${esc(o.sub)}</span>` : '') +
    `<span class="hold" aria-hidden="true"><span class="fill"></span></span></button>`;
}

export function render(root, view, display, handlers) {
  const v = view;
  const parts = [];
  const graphic = display !== 'text';
  const fxEvents = graphic && v.enemy && v.enemy.fx && v.enemy.fx.id !== lastFxId ? v.enemy.fx.events : null;
  const clankNow = !!(fxEvents && fxEvents.some(e => e.type === 'clank'));
  if (v.art && graphic) parts.push(`<img class="scene${clankNow ? ' shake' : ''}" src="assets/${display}/${esc(v.art)}@2x.png" alt="">`);
  if (v.enemy && graphic) parts.push(enemyLayer(v.enemy, display));
  if (v.topBar) parts.push(topBar(v.topBar));
  if (v.title) parts.push(`<div class="titleword"><span>${esc(v.title.big)}</span><small><span>${esc(v.title.small || '')}</span></small></div>`);
  if (v.name) parts.push(nameLine(v.name));
  if (v.caption) parts.push(`<div class="caption"><span>${esc(v.caption)}</span></div>`);
  if (v.speech) parts.push(`<div class="speech">${esc(v.speech)}</div>`);
  if (v.hint) parts.push(`<div class="hintline"><span>${esc(v.hint)}</span></div>`);
  const always = v.always ? ' always' : '';
  if (v.topHtml || (v.top && v.top.length)) parts.push(`<div class="narr top${always}">${v.topHtml || ''}${(v.top || []).map(line).join('')}</div>`);
  if (v.bottom && v.bottom.length) parts.push(`<div class="narr bottom${always}">${v.bottom.map(line).join('')}</div>`);
  if (!v.always && v.results) parts.push(`<div class="results">${v.results.map(l => `<div class="${esc(l.cls || '')}">${esc(l.text ?? l)}</div>`).join('')}</div>`);
  if (v.chips && v.chips.length) parts.push(`<div class="chips">${v.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>`);
  if (v.diamond) parts.push(DIRS.map(d => option(d, v.diamond[d])).join(''));
  if (v.center) {
    parts.push(`<p class="prompt${v.center.tap ? ' tap' : ''}" ${v.center.tap ? `data-tap="${esc(v.center.tap)}"` : ''}><span>${v.center.html || esc(v.center.text)}</span></p>`);
  }
  if (v.dots && v.dots.n > 1) parts.push(`<div class="dots" aria-label="Carousel page ${v.dots.i + 1} of ${v.dots.n}">` +
    Array.from({ length: v.dots.n }, (_, i) => `<span class="${i === v.dots.i ? 'on' : ''}"></span>`).join('') + '</div>');
  if (v.helper) parts.push(`<p class="helper"><span>${esc(v.helper)}</span></p>`);
  if (v.corners) parts.push(
    `<button class="iconbtn corner left" data-tap="character" aria-label="Character">${icon('person', 28)}</button>` +
    `<button class="iconbtn corner right" data-tap="inventory" aria-label="Inventory">${icon('bag', 28)}</button>`);
  if (v.dice && v.dice.length) parts.push(`<div class="dice">${v.dice.map(d => `<div class="die${d.lucky ? ' lucky' : ''}"><small>d${d.sides}</small>${d.value}</div>`).join('')}</div>`);
  if (v.clash) parts.push(`<div class="clash"><div class="big">CLASH!</div><div class="sub">Your attacks meet. Which way will it go?</div>` +
    `<div class="tells">${(v.clash.tells || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div></div>`);
  if (v.overlay) {
    parts.push('<div class="shade" data-tap="close"></div>');
    parts.push(`<button class="iconbtn closebtn" data-tap="close" aria-label="Close">${CLOSE_ICON}</button>`);
    if (v.overlay.kind === 'menu') {
      parts.push(`<div class="menu">${v.overlay.items.map(i => `<button data-tap="${esc(i.id)}">${esc(i.label)}</button>`).join('')}</div>`);
    } else {
      parts.push(`<div class="panel">${v.overlay.html}</div>`);
    }
  }
  if (fxEvents) parts.push(screenFx(fxEvents));
  if (v.toast) parts.push(`<div class="toast box">${esc(v.toast)}</div>`);

  root.dataset.display = display;
  root.classList.toggle('clashing', !!v.clash);
  root.classList.toggle('clashfresh', !!(v.clash && fxEvents && fxEvents.some(e => e.type === 'clash')));
  root.innerHTML = parts.join('');

  // Bars animate from where they were to where they are now.
  const meters = root.querySelectorAll('[data-meter]');
  meters.forEach(m => { m.style.width = (lastFractions[m.dataset.meter] ?? m.dataset.to) + '%'; });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    meters.forEach(m => { m.style.width = m.dataset.to + '%'; lastFractions[m.dataset.meter] = m.dataset.to; });
  }));

  // Taps (chrome: menu, compass, corners, star, overlay items) and holds (choices).
  root.querySelectorAll('[data-tap]').forEach(el => el.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); handlers.tap(el.dataset.tap);
  }));
  root.querySelectorAll('[data-input]').forEach(el => el.addEventListener('input', () => handlers.input(el.dataset.input, el.value)));
  // While choosing where (Attack, Block, Clash), the enemy's zones are targets too:
  // holding a button fills its zone, and holding a zone fills its button.
  const holds = {};
  const targeting = root.querySelector('.foe.targeting');
  const zoneFill = (dir) => targeting && targeting.querySelector(`.zone[data-dir="${dir}"] .fill`);
  const btnFill = (dir) => root.querySelector(`.opt[data-dir="${dir}"] .fill`);
  const follow = (el) => (f) => { if (el) el.style.transform = `scaleX(${f})`; };
  root.querySelectorAll('.opt').forEach(b => {
    if (b.classList.contains('empty')) return;
    holds[b.dataset.dir] = attachHold(b, () => handlers.choose(b.dataset.dir), { onProgress: follow(zoneFill(b.dataset.dir)) });
  });
  if (targeting) targeting.querySelectorAll('.zone').forEach(z => {
    const b = root.querySelector(`.opt[data-dir="${z.dataset.dir}"]`);
    if (!b || b.disabled) return;
    attachHold(z, () => handlers.choose(z.dataset.dir), { onProgress: follow(btnFill(z.dataset.dir)) });
  });
  return holds;
}

// Scale the 390 × 844 screen to fit the device.
export function fitStage(app) {
  const fit = () => {
    const s = Math.min(window.innerWidth / 390, window.innerHeight / 844);
    app.style.transform = `scale(${s})`;
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();
}
