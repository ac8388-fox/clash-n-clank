// Balance report: simulate many fights and print win rates and fight lengths.
// Run on a computer: node tests/balance.js [fights per enemy, default 1200]

import { simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, practiceFighter, createRng } from './sim.js';

const N = Number(process.argv[2]) || 1200;
const pct = (n) => (100 * n / N).toFixed(1) + '%';

function run(enemyId, label, make) {
  const res = [];
  for (let seed = 1; seed <= N; seed++) res.push(make(seed));
  const wins = res.filter(r => r.outcome === 'victory').length;
  const lens = res.map(r => r.exchanges).sort((a, b) => a - b);
  const avg = lens.reduce((s, n) => s + n, 0) / N;
  const median = lens[Math.floor(N / 2)];
  const mid = `${lens[Math.floor(N * 0.25)]}–${lens[Math.floor(N * 0.75)]}`;
  const st = res.reduce((a, r) => { for (const k in r.stats) a[k] = (a[k] || 0) + r.stats[k]; return a; }, {});
  const share = (k) => (100 * st[k] / st.exchanges).toFixed(1) + '%';
  console.log(`${enemyId.padEnd(13)} ${label.padEnd(30)} wins ${String(wins).padStart(5)}/${N} (${pct(wins)})  exchanges: avg ${avg.toFixed(1)}, median ${median}, middle half ${mid}` +
    `  | no clue ${share('noClue')} (hidden ${share('hidden')}), two clues ${share('twoClues')}, enemy blocks ${share('enemyBlocks')}` +
    `  | per fight: Clanks ${(st.clanks / N).toFixed(2)}, Clashes ${(st.clashes / N).toFixed(2)}`);
  return { wins: wins / N, avg, median, noClue: st.noClue / st.exchanges, enemyBlocks: st.enemyBlocks / st.exchanges, clanks: st.clanks / N, clashes: st.clashes / N };
}

const out = {};
for (const enemyId of ['werewolf', 'barrowKnight']) {
  out[enemyId] = {
    learned: run(enemyId, 'learned, Human Fighter', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash })),
    random: run(enemyId, 'random buttons, Human Fighter', (seed) => {
      const rng = createRng(seed * 7919);
      return simulateFight({ seed, enemyId, policy: randomPolicy(rng), clashPick: randomClash(rng) });
    }),
  };
  if (process.argv.includes('--extra')) {
    run(enemyId, 'learned, WIS+FAI 20 (2 clues)', (seed) => {
      const c = practiceFighter();
      c.attrs.WIS.natural = 14; c.attrs.WIS.stamina = 14;   // WIS 14 + FAI 6 = 20
      return simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: c });
    });
    run(enemyId, 'learned, Human, Night', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, timeOfDay: 'Night' }));
    run(enemyId, 'learned, Human, Crusher', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: practiceFighter('crusher') }));
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
