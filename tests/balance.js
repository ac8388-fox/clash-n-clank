// Balance report: simulate many fights and print the difficulty measures.
// Run on a computer: node tests/balance.js [fights per enemy, default 1200] [--extra]
//
// Targets (Build Spec → Enemies):
//   learned player: wins about 80–90%; about 1 win in 4 is a scrape (under 20%
//   of total stamina left); most wins cost 40–70% of total stamina; flawless
//   wins (under 10% lost) less than 1 in 20; fights last about 10–20 exchanges.
//   random buttons: win about 15–30%, usually barely.
//   Attacks miss about 1 time in 15.

import { simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, practiceFighter, createRng } from './sim.js';

const isNode = typeof process !== 'undefined' && !!process.argv;
const N = (isNode && Number(process.argv[2])) || 1200;
const pct = (x) => (100 * x).toFixed(1) + '%';

export function summarize(res) {
  const n = res.length;
  const wins = res.filter(r => r.outcome === 'victory');
  const lens = res.map(r => r.exchanges).sort((a, b) => a - b);
  const left = wins.map(r => r.leftShare).sort((a, b) => a - b);
  const q = (arr, f) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * f))] : 0;
  const st = res.reduce((a, r) => { for (const k in r.stats) a[k] = (a[k] || 0) + r.stats[k]; return a; }, {});
  const share = (pred) => wins.length ? wins.filter(pred).length / wins.length : 0;
  return {
    winRate: wins.length / n,
    leftMedian: q(left, 0.5), leftQ1: q(left, 0.25), leftQ3: q(left, 0.75),
    scrape: share(r => r.leftShare < 0.2),
    costly: share(r => r.leftShare >= 0.3 && r.leftShare <= 0.6),     // cost 40–70%
    flawless: share(r => r.leftShare > 0.9),                           // lost under 10%
    avgLen: lens.reduce((s, x) => s + x, 0) / n, medLen: q(lens, 0.5), lenQ1: q(lens, 0.25), lenQ3: q(lens, 0.75),
    missRate: (st.playerMisses + st.enemyMisses) / Math.max(1, st.playerAttacks + st.enemyAttacks),
    playerMissRate: st.playerMisses / Math.max(1, st.playerAttacks),
    enemyMissRate: st.enemyMisses / Math.max(1, st.enemyAttacks),
    chanceMissRate: st.chanceMisses / Math.max(1, st.playerAttacks + st.enemyAttacks),
    situationalMissRate: st.situationalMisses / Math.max(1, st.playerAttacks + st.enemyAttacks),
    noClue: st.noClue / st.exchanges, enemyBlocks: st.enemyBlocks / st.exchanges,
    clanks: st.clanks / n, clashes: st.clashes / n,
  };
}

function run(enemyId, label, make) {
  const res = [];
  for (let seed = 1; seed <= N; seed++) res.push(make(seed));
  const s = summarize(res);
  console.log(`${enemyId.padEnd(13)} ${label.padEnd(30)} wins ${pct(s.winRate).padStart(6)} | winners keep ${pct(s.leftMedian)} ` +
    `(middle half ${pct(s.leftQ1)}–${pct(s.leftQ3)}) | scrapes ${pct(s.scrape)}, cost 40–70% ${pct(s.costly)}, flawless ${pct(s.flawless)} ` +
    `| ${s.avgLen.toFixed(1)} exchanges (middle half ${s.lenQ1}–${s.lenQ3}) | misses ${pct(s.missRate)} (by chance ${pct(s.chanceMissRate)}, situational ${pct(s.situationalMissRate)}; you ${pct(s.playerMissRate)}, it ${pct(s.enemyMissRate)}) ` +
    `| no clue ${pct(s.noClue)}, blocks ${pct(s.enemyBlocks)}, Clanks ${s.clanks.toFixed(2)}, Clashes ${s.clashes.toFixed(2)} per fight`);
  return s;
}

const isMain = isNode && process.argv[1] && process.argv[1].endsWith('balance.js');
if (isMain) {
  for (const enemyId of ['werewolf', 'barrowKnight']) {
    run(enemyId, 'learned, Human Fighter', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash }));
    run(enemyId, 'random buttons, Human Fighter', (seed) => {
      const rng = createRng(seed * 7919);
      return simulateFight({ seed, enemyId, policy: randomPolicy(rng), clashPick: randomClash(rng) });
    });
    if (process.argv.includes('--extra')) {
      run(enemyId, 'learned, WIS+FAI 20 (2 clues)', (seed) => {
        const c = practiceFighter();
        c.attrs.WIS.natural = 14; c.attrs.WIS.stamina = 14;
        return simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: c });
      });
      run(enemyId, 'learned, Human, Night', (seed) =>
        simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, timeOfDay: 'Night' }));
      run(enemyId, 'learned, Human, Crusher', (seed) =>
        simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: practiceFighter('crusher') }));
    }
  }
}
