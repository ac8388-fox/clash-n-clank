// A tiny test runner with no dependencies. It works both in a browser
// (tests/index.html) and on a computer with Node (node tests/run-node.js).

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn, slow: false });
}

// Slow tests (hundreds of simulated fights) run only on a computer, so the
// test page stays quick on a phone.
export function slowTest(name, fn) {
  tests.push({ name, fn, slow: true });
}

export function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label ? label + ': ' : ''}expected ${e}, got ${a}`);
}

export function ok(value, label = 'expected true') {
  if (!value) throw new Error(label);
}

export function throws(fn, label = 'expected an error') {
  try { fn(); } catch { return; }
  throw new Error(label);
}

export async function runAll({ includeSlow = true } = {}) {
  const results = [];
  for (const t of tests) {
    if (t.slow && !includeSlow) { results.push({ name: t.name, pass: true, skipped: true }); continue; }
    try { await t.fn(); results.push({ name: t.name, pass: true }); }
    catch (e) { results.push({ name: t.name, pass: false, error: e.message }); }
  }
  return results;
}
