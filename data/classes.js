// Classes. Slice 1 only has the Fighter (see "Class Abilities" → Fighter,
// and the Build Spec's "Starting class" rule).

export const CLASSES = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    primary: 'STR',
    secondary: 'STR',            // pure class: Primary = Secondary
    // Class-layer points gained at each level: +level to Primary, plus +level
    // free between Primary and Secondary. A pure Fighter puts both into STR.
    growth: {
      1: { STR: 2 },             // Slice value: +1 STR fixed, +1 free (STR)
    },
    level1Choices: ['planB', 'crusher'],
  },
};

export function getClass(id) {
  const cls = CLASSES[id];
  if (!cls) throw new Error('Unknown class: ' + id);
  return cls;
}

// Total class-layer points for a class at a given level.
export function classAttrsAt(classId, level) {
  const cls = getClass(classId);
  const out = { STR: 0, AGI: 0, WIS: 0, FAI: 0 };
  for (let l = 1; l <= level; l++) {
    const g = cls.growth[l] || {};
    for (const k of Object.keys(g)) out[k] += g[k];
  }
  return out;
}
