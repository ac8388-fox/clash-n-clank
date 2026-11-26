// Events: the trial screen (four attribute options, Fortune opening) and Camp
// (Rest or Sleep, results shown).
//
// Trial options show the attribute's current stamina against the requirement
// and what falling short costs. An option 4 or more short says "Lucky only":
// it can be chosen only while the Fortune star is armed. Swipe down leaves.
import { getEvent, getTrial } from '../data/events.js';
import { trialOptions, setbackName } from '../engine/trial.js';
import { canSleep } from '../engine/world.js';
import { statsFor, resultLines, DIR_WORD, ATTR_WORD } from './common.js';

const OPTION_ICON = {
  'Pray for passage': 'FAI', 'Brace the post': 'post', 'Study the knots': 'WIS', 'Dash across': 'AGI',
  'Pray over the seal': 'FAI', 'Force the door': 'fist', 'Read the runes': 'WIS', 'Pick the lock': 'key',
};

export function trialView(ctx) {
  const { g, ui } = ctx;
  const w = g.world, ev = getEvent(w.eventId), t = getTrial(w.trial.id);
  const fortune = w.trial.fortune;
  const opts = trialOptions(g.character, t.id);
  const luckyOnly = opts.filter(o => o.luckyOnly);
  const armed = ui.armed && fortune.open;
  const luckyNote = luckyOnly.length
    ? `Lucky only: ${luckyOnly.map(o => o.label).join(', ')} (4 or more short). Only a lucky attempt can pass; failing leaves you Injured and not through. Resting first raises your stamina and can shrink the gap.`
    : null;
  const v = {
    art: ev.art,
    topBar: { stats: statsFor(g.character), compass: { facing: w.facing } },
    name: { text: ev.name, kind: 'place', right: `Facing ${DIR_WORD[w.facing]}`, star: fortune.open ? { armed: ui.armed } : null },
    top: [g.text, t.prompt],
    bottom: [
      ...(fortune.open ? [{ text: `★ ${fortune.hint} Tap the star, then hold a choice, for a lucky attempt.`, cls: 'hint' }] : []),
      ...resultLines(g.lines),
      ...(luckyNote ? [{ text: luckyNote, cls: 'dim' }] : []),
      { text: 'Up to 3 short still gets you through, but empties that bar and leaves a setback. Swipe down to leave.', cls: 'dim' },
    ],
    results: [...resultLines(g.lines), ...(luckyNote ? [{ text: luckyNote, cls: '' }] : [])],
    hint: fortune.open ? `★ ${fortune.hint}${armed ? ' Armed: hold a choice.' : ''}` : null,
    diamond: {},
    center: { text: 'What do you do?' },
    helper: 'swipe down to leave',
    corners: true,
  };
  for (const o of opts) {
    const cur = `${o.attr} ${o.stamina}/${o.requirement}`;
    v.diamond[o.dir] = o.racial
      ? { label: o.label, sub: `Racial · sure`, icon: 'mountain', dashed: true, run: () => ctx.act.trial(o.dir) }
      : o.luckyOnly
        ? { label: o.label, icon: OPTION_ICON[o.label] || o.attr, sub: `Lucky only · ${cur}`, enabled: armed, run: () => ctx.act.trial(o.dir) }
        : { label: o.label, icon: OPTION_ICON[o.label] || o.attr,
            sub: `${cur}${o.shortfall ? ` · ${setbackName(o.setback)}` : ' · clean'}`,
            run: () => ctx.act.trial(o.dir) };
  }
  return v;
}

export function campView(ctx) {
  const { g } = ctx;
  const w = g.world, ev = getEvent(w.eventId);
  const sleepOk = canSleep(w);
  return {
    art: ev.art,
    topBar: { stats: statsFor(g.character), compass: { facing: w.facing } },
    name: { text: ev.safeSleep ? `Camp · ${ev.name}` : 'Camp', kind: 'place', right: w.timeOfDay },
    always: true,
    top: [ev.safeSleep ? 'A warm bed and a safe roof. Here, sleep can mend an injury.' : 'You make camp in the open.'],
    bottom: [...resultLines(g.lines),
      { text: sleepOk ? 'Rest restores half of each bar. Sleep restores all of them and wakes you in the Morning.'
                     : 'Rest restores half of each bar and takes part of the day. You can only Sleep in the Evening or at Night.', cls: 'dim' }],
    diamond: {
      up: { label: 'Rest', sub: '+half · time passes', icon: 'fire', run: () => ctx.act.camp('rest') },
      down: { label: 'Sleep', sub: sleepOk ? 'full · wake at dawn' : 'evening or night', icon: 'moon', enabled: sleepOk, run: () => ctx.act.camp('sleep') },
      left: { label: 'Leave', sub: 'break camp', icon: 'leave', run: () => ctx.act.leaveCamp() },
    },
    center: { text: 'Rest or Sleep?' },
    corners: true,
  };
}
