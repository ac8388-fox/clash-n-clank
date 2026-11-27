// Balance report: simulate many fights and print the difficulty measures.
// Run on a computer: node tests/balance.js [fights per enemy, default 1200] [--expert] [--quick]
//
// Targets (Build Spec → Enemies), for a Human Fighter with Plan B, starting
// both at full stamina and after a typical trial:
//   attentive player (knows only what is on screen, best choice ~75%):
//     wins 75–85%; about 1 win in 4 a scrape (under 20% of total stamina
//     left); flawless wins (under 10% lost) under 1 in 20;
//   new player (doesn't know the patterns): wins 35–55%;
//   random buttons: wins 10–25%;
//   fights last about 10–20 exchanges.

import { simulateFight, learnedPolicy, learnedClash, randomPolicy, randomClash, practiceFighter, createRng,
         attentivePlayer, newPlayer, randomPlayer, expertPlayer, afterTrial } from './sim.js';

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
    clashWinShare: (st.clashWins || 0) / Math.max(1, (st.clashWins || 0) + (st.clashLosses || 0)),
    tellRate: (st.tells || 0) / st.exchanges, focusedRate: (st.focusedExchanges || 0) / st.exchanges,
    prayRate: (st.prays || 0) / st.exchanges,
  };
}

function run(enemyId, label, make, quiet = false) {
  const res = [];
  for (let seed = 1; seed <= N; seed++) res.push(make(seed));
  const s = summarize(res);
  if (!quiet) console.log(`${enemyId.padEnd(13)} ${label.padEnd(26)} wins ${pct(s.winRate).padStart(6)} | keep ${pct(s.leftMedian)} ` +
    `(${pct(s.leftQ1)}–${pct(s.leftQ3)}) | scrapes ${pct(s.scrape)}, flawless ${pct(s.flawless)} ` +
    `| ${s.avgLen.toFixed(1)} exchanges (${s.lenQ1}–${s.lenQ3}) | misses ${pct(s.missRate)} ` +
    `| tells ${pct(s.tellRate)}, prays ${pct(s.prayRate)}, blocks ${pct(s.enemyBlocks)}, Clanks ${s.clanks.toFixed(2)}, Clashes ${s.clashes.toFixed(2)} (you win ${pct(s.clashWinShare)})`);
  return s;
}

export const PLAYERS = {
  attentive: (seed) => attentivePlayer(createRng(seed * 7907)),
  new: (seed) => newPlayer(createRng(seed * 7919)),
  random: (seed) => randomPlayer(createRng(seed * 7937)),
  expert: () => expertPlayer(),
};
export const STARTS = { full: (c) => c, 'after trial': afterTrial };

export function measure(enemyId, playerName, startName, n = N) {
  const res = [];
  for (let seed = 1; seed <= n; seed++) {
    res.push(simulateFight({ seed, enemyId, player: PLAYERS[playerName](seed), character: STARTS[startName](practiceFighter()) }));
  }
  return summarize(res);
}

const isMain = isNode && process.argv[1] && process.argv[1].endsWith('balance.js');
if (isMain) {
  const names = ['attentive', 'new', 'random', ...(process.argv.includes('--expert') ? ['expert'] : [])];
  for (const enemyId of ['werewolf', 'barrowKnight']) {
    for (const start of Object.keys(STARTS)) {
      for (const p of names) {
        run(enemyId, `${p}, ${start}`, (seed) =>
          simulateFight({ seed, enemyId, player: PLAYERS[p](seed), character: STARTS[start](practiceFighter()) }));
      }
    }
  }
}
