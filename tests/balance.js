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
  console.log(`${enemyId.padEnd(13)} ${label.padEnd(30)} wins ${String(wins).padStart(5)}/${N} (${pct(wins)})  exchanges: avg ${avg.toFixed(1)}, median ${median}, middle half ${mid}`);
  return { wins: wins / N, avg, median };
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
    run(enemyId, 'learned, Gnome (2 clues)', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: practiceFighter('planB', 'gnome') }));
    run(enemyId, 'learned, Human, Night', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, timeOfDay: 'Night' }));
    run(enemyId, 'learned, Human, Crusher', (seed) =>
      simulateFight({ seed, enemyId, policy: learnedPolicy, clashPick: learnedClash, character: practiceFighter('crusher') }));
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
