// Menu (top right): Settings (incl. Display), Save Game, Journal, Map, Help,
// Quit to Title – dropping down over a dimmed screen.
import { EVENTS, getEvent } from '../data/events.js';
import { exitsFor } from '../engine/world.js';
import { esc } from './render.js';
import { holdWords } from './settings.js';
import { DIR_WORD } from './common.js';

export const DISPLAYS = [
  { id: 'text', label: 'Text', note: 'Words only, no pictures.' },
  { id: 'house', label: 'Graphic (house)', note: 'White, sky blue, and red on black.' },
  { id: 'full', label: 'Graphic (full color)', note: 'The same scenes in full color.' },
];

export function menuOverlay(inRun) {
  const items = [{ id: 'settings', label: 'Settings' }];
  if (inRun) items.push({ id: 'save', label: 'Save Game' }, { id: 'journal', label: 'Journal' }, { id: 'map', label: 'Map' });
  items.push({ id: 'help', label: 'Help' });
  if (inRun) items.push({ id: 'quit', label: 'Quit to Title' });
  return { kind: 'menu', items };
}

export function settingsPanel(settings) {
  return { kind: 'panel', html: `<h2>Settings</h2><h3>Display</h3>` +
    DISPLAYS.map(d => `<button class="choice${settings.display === d.id ? ' on' : ''}" data-tap="display:${d.id}">${esc(d.label)}<br><span class="note">${esc(d.note)}</span></button>`).join('') +
    `<h3>Motion</h3>` +
    [['full', 'Full motion', 'Hits recoil, Clanks shake the scene.'], ['reduce', 'Reduce motion', 'No shakes or recoils; flashes and numbers stay.']]
      .map(([id, label, note]) => `<button class="choice${(settings.motion || 'full') === id ? ' on' : ''}" data-tap="motion:${id}">${esc(label)}<br><span class="note">${esc(note)}</span></button>`).join('') +
    `<h3>Controls</h3><p class="note">Hold to choose: ${esc(holdWords())}.</p>` };
}

export function journalPanel(log) {
  const lines = log.slice().reverse().slice(0, 120);
  return { kind: 'panel', html: `<h2>Journal</h2>` + (lines.length ? lines.map(l => `<p>${esc(l)}</p>`).join('') : '<p class="note">Nothing written yet.</p>') };
}

// The slice map: the five places, the roads between them, and the long way
// round the Gorge (Hills ↔ Sealed Crypt, two journeys). Places not yet
// visited show "?"; you are where the blue box is.
const MAP_SPOTS = {
  village:    { x: 150, y: 24 },
  crossroads: { x: 150, y: 94 },
  hills:      { x: 262, y: 94 },
  gorge:      { x: 150, y: 164 },
  crypt:      { x: 150, y: 234 },
};
function mapSvg(world) {
  const W = 96, H = 30;
  const box = (id) => {
    const p = MAP_SPOTS[id], ev = EVENTS[id], here = world.eventId === id;
    const known = world.visited[id] || here;
    const foe = ev.enemy && world.defeated[ev.enemy] ? ' ✓' : '';
    return `<rect x="${p.x - W / 2}" y="${p.y - H / 2}" width="${W}" height="${H}" class="${here ? 'here' : ''}"/>` +
      `<text x="${p.x}" y="${p.y + 6}">${esc(known ? ev.name : '?')}${foe}</text>`;
  };
  const road = (a, b, cls = '') => {
    const p = MAP_SPOTS[a], q = MAP_SPOTS[b];
    return `<line class="${cls}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
  };
  const h = MAP_SPOTS.hills, c = MAP_SPOTS.crypt;
  const bridge = world.eventFlags.gorgeCrossed ? '' : 'uncrossed';
  return `<svg class="map" viewBox="0 0 320 260" role="img" aria-label="Map of the slice">
    ${road('village', 'crossroads')}${road('crossroads', 'hills')}${road('crossroads', 'gorge')}${road('gorge', 'crypt', bridge)}
    <path class="detour" d="M ${h.x + 30} ${h.y + 15} V ${c.y} H ${c.x + W / 2}"/>
    <text class="small" x="${h.x - 22}" y="${(h.y + c.y) / 2 - 4}">long way</text>
    <text class="small" x="${h.x - 22}" y="${(h.y + c.y) / 2 + 14}">round</text>
    <text class="small" x="${h.x - 22}" y="${(h.y + c.y) / 2 + 32}">(2 journeys)</text>
    <text class="small" x="${c.x - 70}" y="${(MAP_SPOTS.gorge.y + c.y) / 2 + 5}">${bridge ? 'bridge' : ''}</text>
    ${Object.keys(MAP_SPOTS).map(box).join('')}
  </svg>`;
}

export function mapPanel(world) {
  const here = getEvent(world.eventId);
  const exits = exitsFor(world);
  return { kind: 'panel', html: `<h2>Map</h2>
    <p>You are at the <b>${esc(here.name)}</b>, facing ${esc(DIR_WORD[world.facing])}. Day ${world.day}, ${esc(world.timeOfDay)}.</p>
    ${mapSvg(world)}
    <p class="note">The dashed road goes round the Gorge: Hills to Sealed Crypt, two journeys instead of one, through the werewolf’s hills.</p>
    <h3>From here</h3>${['N', 'E', 'S', 'W'].map(d => `<p>${DIR_WORD[d]}: ${esc(exits[d].camp ? 'Camp' : exits[d].visited ? exits[d].name : '?')} – ${esc(exits[d].teaser)}${exits[d].journeys > 1 ? ' (2 journeys)' : ''}</p>`).join('')}` };
}

export function helpPanel() {
  return { kind: 'panel', html: `<h2>Help</h2>
    <h3>Choosing</h3><p>Hold a button for ${esc(holdWords())}; a bar fills inside it. Let go early to cancel. On a computer, hold an arrow key or W A S D.</p>
    <h3>In a fight</h3><p>Every attack hits its own spot: the button says where (Slash → Right). Page 1 has your weapon's main attack; swipe left or right (or Q / E) for its other three attacks, each on the side it hits, then your abilities. Only Block asks where. In the Graphic displays you can also hold a part of the enemy to strike it there. Swipe down (or Esc) to go back.</p>
    <p>Enemies give nothing away unless something helps you read them (Pray may make you Focused). Learn their patterns.</p>
    <h3>Luck</h3><p>When a ★ appears, tap it (or press L), then hold a choice for a lucky attempt.</p>
    <h3>Corners</h3><p>Bottom left: your character. Bottom right: your inventory. Top left: the map. Top right: this menu.</p>` };
}
