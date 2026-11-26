// Interface settings (no screen needed).
import { test, eq } from './harness.js';
import { HOLD_SECONDS, HOLD_MS, holdWords } from '../ui/settings.js';
import { HOLD_MS as HOLD_USED } from '../ui/hold.js';

test('Hold to choose: half a second, set in one place and used by the hold controls', () => {
  eq(HOLD_SECONDS, 0.5);
  eq(HOLD_MS, 500);
  eq(HOLD_USED, HOLD_MS, 'ui/hold.js uses the setting');
  eq(holdWords(), 'half a second');
});
