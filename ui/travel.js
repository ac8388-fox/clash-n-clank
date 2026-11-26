// Travel: four directions with teasers; a blocked direction becomes Camp.
// Up is North, Right is East, Down is South, Left is West. The compass shows
// the direction just traveled; visited places are named.
import { getEvent, DIR_FOR_BUTTON } from '../data/events.js';
import { exitsFor, arrival } from '../engine/world.js';
import { statsFor, resultLines, DIR_WORD } from './common.js';

export function travelView(ctx) {
  const { g } = ctx;
  const w = g.world, ev = getEvent(w.eventId);
  const exits = exitsFor(w);
  const v = {
    art: ev.art,
    topBar: { stats: statsFor(g.character), compass: { facing: w.facing } },
    name: { text: ev.name, kind: 'place', right: w.timeOfDay },
    top: [g.text],
    bottom: resultLines(g.lines),
    results: resultLines(g.lines),
    diamond: {},
    center: { text: 'Where to?' },
    helper: 'tap the compass for the map',
    corners: true,
  };
  for (const [btn, dir] of Object.entries(DIR_FOR_BUTTON)) {
    const x = exits[dir];
    v.diamond[btn] = x.camp
      ? { label: 'Camp', sub: x.teaser, dashed: true, run: () => ctx.act.travel(dir) }
      : { label: DIR_WORD[dir], sub: x.visited ? `${x.name}: ${x.teaser}` : x.teaser, run: () => ctx.act.travel(dir) };
  }
  // Standing at an unfinished trial (after stepping back from it): face it again.
  if (arrival(w).screen === 'trial') v.center = { text: 'Face the trial', tap: 'faceTrial' };
  return v;
}
