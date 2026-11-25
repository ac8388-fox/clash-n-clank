// Run the tests on a computer: node tests/run-node.js
import { runAll } from './harness.js';
import './rules.test.js';
import './combat.test.js';

const results = await runAll();
let failed = 0;
for (const r of results) {
  if (r.pass) console.log('  pass  ' + r.name);
  else { failed++; console.log('  FAIL  ' + r.name + '\n        ' + r.error); }
}
console.log(`\n${results.length - failed} of ${results.length} tests passed.`);
process.exit(failed ? 1 : 0);
