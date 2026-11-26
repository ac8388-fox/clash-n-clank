// The game shell: one state, screens that read it, and engine calls that
// change it (Build Spec → Tech approach: screens only read the state and
// call engine functions). Autosaves after every event and every exchange.

import { render, fitStage } from './render.js';
import { attachKeyboard, attachSwipes } from './hold.js';
import { titleView } from './title.js';
import { creationView } from './creation.js';
import { travelView } from './travel.js';
import { trialView, campView } from './event.js';
import { combatView, pageCount } from './combat.js';
import { endView } from './end.js';
import { menuOverlay, settingsPanel, journalPanel, mapPanel, helpPanel } from './menu.js';
import { characterPanel } from './character.js';
import { inventoryPanel } from './inventory.js';
import { diceFrom } from './common.js';

import { RACES } from '../data/races.js';
import { OCCUPATIONS } from '../data/occupations.js';
import { getEvent } from '../data/events.js';
import { getEnemy } from '../data/enemies.js';
import { createRng, newSeed, pickDistinct } from '../engine/random.js';
import { newRun, go, arrival, campRest, campSleep, beginFight, endFight } from '../engine/world.js';
import { attemptTrial, beginTrial } from '../engine/trial.js';
import { submitAction, submitClash } from '../engine/combat.js';
import { ATTRS } from '../engine/rules.js';

const GAME_KEY = 'clash-n-clank.game';
const GAME_VERSION = 1;
const SETTINGS_KEY = 'clash-n-clank.settings';
const NAMES = ['Wren', 'Aldric', 'Tamsin', 'Bram', 'Isolde', 'Corin', 'Mira', 'Osric', 'Elsbeth', 'Garrick', 'Nell', 'Rowan'];

const app = document.getElementById('app');
fitStage(app);

// ---- Saved state ------------------------------------------------------------------------------
function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode: play on */ } }
const loadGame = () => { const s = read(GAME_KEY); return s && s.v === GAME_VERSION && s.screen !== 'end' ? s : null; };

let settings = { display: 'text', ...(read(SETTINGS_KEY) || {}) };
let g = null;                                 // the run (null on the title screen)
let ui = freshUi();
let holds = {};
let view = null;
function freshUi() { return { page: 0, pending: null, armed: false, overlay: null, dice: null, toast: null }; }
function save() { if (g) write(GAME_KEY, g); }

// ---- Helpers ----------------------------------------------------------------------------------
function say(lines) { g.lines = lines; g.log.push(...lines); if (g.log.length > 300) g.log = g.log.slice(-300); }
function addLines(lines) { g.lines = [...g.lines, ...lines]; g.log.push(...lines); }

function arrive(a) {
  g.text = a.text;
  if (a.screen === 'trial') { g.screen = 'trial'; if (!g.world.trial) g.world = beginTrial(g.character, g.world, a.trialId); }
  else if (a.screen === 'combat') startFight(a.enemyId);
  else g.screen = 'travel';
}
function startFight(enemyId) {
  const f = beginFight(g.character, g.world, enemyId);
  g.world = f.world; g.combat = f.combat; g.screen = 'combat'; g.lastEnemyArt = getEnemy(enemyId).art;
  ui.page = 0; ui.pending = null; ui.armed = false;
}
function finish(outcome) { g.screen = 'end'; g.runOver = outcome; g.combat = null; }

// ---- Actions (what the screens can ask for) --------------------------------------------------
const act = {
  newGame() {
    const seed = newSeed();
    const rng = createRng(seed);
    const races = pickDistinct(rng, RACES.map(r => r.id), 4);
    const occupations = pickDistinct(rng, OCCUPATIONS.map(o => o.id), 4);
    const name = NAMES[Math.floor(rng.next() * NAMES.length)];
    g = { v: GAME_VERSION, screen: 'creation', creation: { seed, step: 'race', races, occupations, name }, log: [], lines: [] };
    ui = freshUi();
  },
  continueGame() { g = loadGame(); ui = freshUi(); },
  openSettings() { ui.overlay = 'settings'; },
  pick(field, value) {
    const cr = g.creation;
    cr[field] = value;
    cr.step = { raceId: 'lucky', luckyNumber: 'occupation', occupationId: 'ability', classAbility: 'name' }[field];
  },
  begin() {
    const cr = g.creation;
    const name = (cr.name || '').trim() || 'Wanderer';
    const run = newRun({ name, raceId: cr.raceId, luckyNumber: cr.luckyNumber, occupationId: cr.occupationId, classAbility: cr.classAbility }, cr.seed);
    g = { v: GAME_VERSION, screen: 'travel', character: run.character, world: run.world, combat: null,
          text: getEvent('crossroads').text, lines: [], log: [], runOver: null };
    say([`${name} sets out from the Crossroads. It is Morning.`]);
  },
  travel(dir) {
    const r = go(g.world, g.character, dir);
    g.world = r.world;
    if (r.camp) { g.screen = 'camp'; say(['You make camp.']); return; }
    say([`You travel ${{ N: 'north', E: 'east', S: 'south', W: 'west' }[dir]} to the ${getEvent(g.world.eventId).name}. It is ${g.world.timeOfDay}.`]);
    arrive(r.arrival);
  },
  faceTrial() { arrive(arrival(g.world)); },
  trial(dir) {
    const lucky = ui.armed && g.world.trial && g.world.trial.fortune.open;
    const r = attemptTrial(g.character, g.world, { dir, lucky });
    g.character = r.character; g.world = r.world; ui.armed = false;
    ui.dice = diceFrom(r.lines, g.character.luckyNumber);
    say(r.lines);
    if (r.outcome === 'defeat') return finish('defeat');
    const ev = getEvent(g.world.eventId);
    if (r.next === 'combat') { g.text = ev.doneText; startFight(ev.enemy); }
    else { g.screen = 'travel'; g.text = ev.doneText || g.text; }
  },
  camp(which) {
    if (which === 'rest') {
      const r = campRest(g.character, g.world);
      g.character = r.character; g.world = r.world;
      say([`You rest. Your strength comes back a little. It is ${g.world.timeOfDay}.`]);
    } else {
      const r = campSleep(g.character, g.world);
      if (!r.ok) { say([r.reason]); return; }
      g.character = r.character; g.world = r.world;
      const healed = r.treated && r.treated.length ? ` Your injuries are tended: no longer Injured (${r.treated.map(t => t.attr).join(', ')}).` : '';
      const still = !healed && g.character.traits.some(t => t.id === 'injured') ? ' Your injury still aches; it needs the Village.' : '';
      say([`You sleep and wake in the Morning, fully rested. Day ${g.world.day}.${healed}${still}`]);
    }
    act.leaveCamp(true);
  },
  leaveCamp(keepLines) {
    if (!keepLines) say(['You break camp.']);
    arrive(arrival(g.world));
  },
  pend(choice) { ui.pending = choice; },
  fight(choice) {
    const lucky = ui.armed && g.combat.current.fortune.open && choice.action !== 'block';
    let r;
    try { r = submitAction(g.character, g.combat, { ...choice, lucky }); }
    catch (e) { say([e.message]); ui.pending = null; return; }
    g.character = r.character; g.combat = r.combat;
    ui.pending = null; ui.armed = false; ui.page = 0;
    ui.dice = diceFrom(r.lines, g.character.luckyNumber);
    say(r.lines);
    afterExchange();
  },
  clash(dir) {
    const r = submitClash(g.character, g.combat, dir);
    g.character = r.character; g.combat = r.combat;
    addLines(r.lines);
    afterExchange();
  },
  toTitle() { if (g && g.screen === 'end') { try { localStorage.removeItem(GAME_KEY); } catch {} } g = null; ui = freshUi(); },
};

function afterExchange() {
  if (!g.combat.outcome) return;
  const f = endFight(g.character, g.world, g.combat);
  g.character = f.character; g.world = f.world;
  const drops = ATTRS.filter(k => f.fatigue[k]).map(k => `−${f.fatigue[k]} ${k}`).join(', ') || 'none';
  addLines([g.combat.outcome === 'victory' ? `Victory! Combat fatigue: ${drops}.` : 'You are defeated.']);
  g.combat = null;
  if (f.runOver) return finish(f.runOver);
  g.screen = 'travel';
  g.text = arrival(g.world).text;
}

// ---- Drawing ----------------------------------------------------------------------------------
function currentView() {
  const ctx = { g, ui, act, hasSave: !!loadGame() };
  let v;
  if (!g) v = titleView(ctx);
  else if (g.screen === 'creation') v = creationView(ctx);
  else if (g.screen === 'travel') v = travelView(ctx);
  else if (g.screen === 'trial') v = trialView(ctx);
  else if (g.screen === 'camp') v = campView(ctx);
  else if (g.screen === 'combat') v = combatView(ctx);
  else v = endView(ctx);
  const inRun = !!(g && g.character && g.screen !== 'end');
  if (ui.overlay === 'menu') v.overlay = menuOverlay(inRun);
  else if (ui.overlay === 'settings') v.overlay = settingsPanel(settings);
  else if (ui.overlay === 'journal') v.overlay = journalPanel(g.log);
  else if (ui.overlay === 'map') v.overlay = mapPanel(g.world);
  else if (ui.overlay === 'help') v.overlay = helpPanel();
  else if (ui.overlay === 'character') v.overlay = characterPanel(g);
  else if (ui.overlay === 'inventory') v.overlay = inventoryPanel(g);
  if (ui.toast) v.toast = ui.toast;
  return v;
}

function draw() {
  view = currentView();
  holds = render(app, view, settings.display, { choose, tap, input });
}

function choose(dir) {
  if (ui.overlay) return;
  const slot = view.diamond && view.diamond[dir];
  if (!slot || slot.enabled === false || !slot.run) return;
  ui.toast = null;
  if (!['pend'].includes(slot.run.name)) ui.dice = ui.dice && g && g.screen === 'combat' ? ui.dice : null;
  slot.run();
  save();
  draw();
}

function tap(id) {
  const inRun = !!(g && g.character && g.screen !== 'end');
  if (id === 'close') ui.overlay = null;
  else if (id === 'menu') ui.overlay = ui.overlay === 'menu' ? null : 'menu';
  else if (id === 'compass') ui.overlay = inRun ? 'map' : null;
  else if (id === 'character' || id === 'inventory') ui.overlay = inRun ? id : null;
  else if (['settings', 'journal', 'map', 'help'].includes(id)) ui.overlay = id;
  else if (id === 'save') { save(); ui.overlay = null; ui.toast = 'Game saved.'; setTimeout(() => { ui.toast = null; draw(); }, 1500); }
  else if (id === 'quit') { save(); g = null; ui = freshUi(); }
  else if (id.startsWith('display:')) { settings.display = id.split(':')[1]; write(SETTINGS_KEY, settings); }
  else if (id === 'star') toggleLucky();
  else if (id === 'faceTrial') { act.faceTrial(); save(); }
  draw();
}

function input(id, value) {
  if (id === 'name' && g && g.creation) { g.creation.name = value; save(); }
}

function toggleLucky() {
  if (!g) return;
  const open = g.screen === 'combat' ? g.combat.current.fortune.open && !g.combat.pendingClash
    : g.screen === 'trial' ? g.world.trial.fortune.open : false;
  if (open) ui.armed = !ui.armed;
}

function back() {
  if (ui.overlay) { ui.overlay = null; draw(); return; }
  if (!g) return;
  if (g.screen === 'combat' && ui.pending) { ui.pending = null; draw(); return; }
  if (g.screen === 'creation') {
    const order = ['race', 'lucky', 'occupation', 'ability', 'name'];
    const i = order.indexOf(g.creation.step);
    if (i > 0) { g.creation.step = order[i - 1]; draw(); }
    return;
  }
  if (g.screen === 'trial') { g.screen = 'travel'; say(['You step back from it for now.']); save(); draw(); }
}

function turnPage(d) {
  if (!g || g.screen !== 'combat' || ui.pending || g.combat.pendingClash || ui.overlay) return;
  const n = pageCount(g.character);
  ui.page = (ui.page + d + n) % n;
  draw();
}

attachKeyboard({ getHold: (d) => (ui.overlay ? null : holds[d]), onPage: turnPage, onBack: back, onLucky: () => { toggleLucky(); draw(); } });
attachSwipes(app, { onPage: turnPage, onBack: back });

// Start on the title screen (Continue offers the saved run).
draw();
