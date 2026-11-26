// Character creation (Build Spec → "Character creation"): four races offered
// at random from all nine, a lucky number 1–4, four Main occupations offered
// at random from all 28, Plan B or Crusher, and a name.
import { getRace } from '../data/races.js';
import { OCCUPATIONS } from '../data/occupations.js';
import { ABILITIES } from '../data/abilities.js';
import { calcLuck, luckyDiceCount } from '../engine/rules.js';
import { esc } from './render.js';
import { HOLD_HELP, ATTR_WORD } from './common.js';

const DIRS = ['up', 'right', 'down', 'left'];
const occ = (id) => OCCUPATIONS.find(o => o.id === id);

export function creationView(ctx) {
  const cr = ctx.g.creation;
  const v = { art: 'crossroads', always: true, helper: HOLD_HELP() };
  const back = cr.step !== 'race' ? ' Swipe down to go back.' : '';
  if (cr.step === 'race') {
    v.name = { text: 'Choose a race', kind: 'place', right: 'step 1 of 5' };
    v.top = cr.races.map(id => {
      const r = getRace(id), luck = calcLuck({ attrs: r.attrs, raceId: id });
      return { text: `${r.name}: STR ${r.attrs.STR} · AGI ${r.attrs.AGI} · WIS ${r.attrs.WIS} · FAI ${r.attrs.FAI} · Luck ${luck}`, cls: 'dim small' };
    });
    v.diamond = {};
    cr.races.forEach((id, i) => {
      const r = getRace(id), luck = calcLuck({ attrs: r.attrs, raceId: id });
      v.diamond[DIRS[i]] = { label: r.name, sub: `Luck ${luck} · ${luckyDiceCount(luck)} ${luckyDiceCount(luck) === 1 ? 'die' : 'dice'}`, run: () => ctx.act.pick('raceId', id) };
    });
    v.center = { text: 'Who are you?' };
  } else if (cr.step === 'lucky') {
    v.name = { text: 'A lucky number', kind: 'place', right: 'step 2 of 5' };
    v.top = [{ text: 'When Fortune opens a door, you roll lucky dice. Any die that shows your number is a critical.' + back, cls: 'dim' }];
    v.diamond = {};
    DIRS.forEach((d, i) => { v.diamond[d] = { label: String(i + 1), run: () => ctx.act.pick('luckyNumber', i + 1) }; });
    v.center = { text: 'Pick 1 to 4' };
  } else if (cr.step === 'occupation') {
    v.name = { text: 'Your trade', kind: 'place', right: 'step 3 of 5' };
    v.top = cr.occupations.map(id => ({ text: `${occ(id).name} (${ATTR_WORD[occ(id).attr]}): ${occ(id).minor}`, cls: 'dim small' }));
    v.diamond = {};
    cr.occupations.forEach((id, i) => { v.diamond[DIRS[i]] = { label: occ(id).name, sub: ATTR_WORD[occ(id).attr], run: () => ctx.act.pick('occupationId', id) }; });
    v.center = { text: 'Your past?' };
    v.bottom = [{ text: 'Occupations show on your character sheet; their abilities come later.' + back, cls: 'dim' }];
  } else if (cr.step === 'ability') {
    v.name = { text: 'Fighter, Level 1', kind: 'place', right: 'step 4 of 5' };
    v.top = [
      { text: `Plan B (Fair): ${ABILITIES.planB.description}`, cls: 'dim' },
      { text: `Crusher (Drawn): ${ABILITIES.crusher.description}`, cls: 'dim' },
    ];
    v.diamond = {
      up: { label: 'Plan B', sub: 'Fair', icon: 'swap', run: () => ctx.act.pick('classAbility', 'planB') },
      down: { label: 'Crusher', sub: 'Drawn', icon: 'hammer', run: () => ctx.act.pick('classAbility', 'crusher') },
    };
    v.center = { text: 'Your first technique' };
    v.bottom = [{ text: 'You join the Fighters: +2 Strength.' + back, cls: 'dim' }];
  } else {
    const r = getRace(cr.raceId);
    v.name = { text: 'Your name', kind: 'place', right: 'step 5 of 5' };
    v.topHtml = `<p class="label">Type a name (or keep this one)</p><input data-input="name" maxlength="18" value="${esc(cr.name)}" aria-label="Name">`;
    v.bottom = [{ text: `${r.name} Fighter · lucky number ${cr.luckyNumber} · ${occ(cr.occupationId).name} · ${ABILITIES[cr.classAbility].name}.` + back, cls: 'dim' }];
    v.diamond = { up: { label: 'Begin', icon: 'play', run: () => ctx.act.begin() } };
    v.center = { text: 'Ready?' };
  }
  return v;
}
