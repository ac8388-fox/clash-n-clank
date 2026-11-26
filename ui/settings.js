// Interface settings in one place, so they are easy to change later.

// How long to press and hold to choose anything (options, targets, the
// Fortune star then an action, and any other hold). In seconds.
export const HOLD_SECONDS = 0.5;

// The same, in milliseconds, for code that needs it.
export const HOLD_MS = Math.round(HOLD_SECONDS * 1000);

// Words for the hold time, for help text ("half a second").
export function holdWords() {
  if (HOLD_SECONDS === 0.5) return 'half a second';
  if (HOLD_SECONDS === 1) return 'one second';
  return `${HOLD_SECONDS} seconds`;
}
