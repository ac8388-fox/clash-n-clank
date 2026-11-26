// Title screen: New Game, Continue, Settings.
import { HOLD_HELP } from './common.js';

export function titleView(ctx) {
  return {
    art: 'crossroads',
    title: { big: 'CLASH N’ CLANK', small: 'A four-option RPG' },
    always: true,
    bottom: [{ text: ctx.hasSave ? 'A journey is under way. Continue it, or begin again.' : 'Four roads. Two foes. Choose well.', cls: 'dim' }],
    diamond: {
      up: { label: 'New Game', icon: 'play', run: ctx.act.newGame },
      right: { label: 'Settings', icon: 'gear', run: ctx.act.openSettings },
      down: ctx.hasSave ? { label: 'Continue', icon: 'book', run: ctx.act.continueGame } : null,
    },
    helper: HOLD_HELP(),
  };
}
