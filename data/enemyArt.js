// Enemy pictures for the Graphic displays, split into a background and a separate
// enemy sprite so the enemy can react (flash, recoil, fade, zone highlights).
//
// Files (same names in assets/house/ and assets/full/):
//   <art>-bg@2x.png      the scene without the enemy (390 x 844)
//   <art>-sprite@2x.png  the enemy alone, transparent background
//
// box: where the sprite sits on the 390 x 844 screen, in CSS pixels (x can be
// negative: the sprite may hang off the left edge).
// zones: the four targets as [left, top, width, height] fractions of the sprite box.
// "left" and "right" are the screen's left and right, matching the Left and Right buttons.
// To swap art later: replace the PNGs and adjust these numbers.

export const ENEMY_ART = {
  "barrowKnight": {
    "box": {
      "x": -25,
      "y": 185,
      "w": 440,
      "h": 447
    },
    "zones": {
      "head": [
        0.34,
        0.0,
        0.3,
        0.2
      ],
      "left": [
        0.1,
        0.2,
        0.42,
        0.46
      ],
      "right": [
        0.52,
        0.2,
        0.4,
        0.46
      ],
      "legs": [
        0.18,
        0.66,
        0.66,
        0.34
      ]
    }
  },
  "werewolf": {
    "box": {
      "x": -4,
      "y": 205,
      "w": 410,
      "h": 471
    },
    "zones": {
      "head": [
        0.06,
        0.0,
        0.4,
        0.33
      ],
      "left": [
        0.02,
        0.33,
        0.46,
        0.3
      ],
      "right": [
        0.48,
        0.22,
        0.46,
        0.41
      ],
      "legs": [
        0.08,
        0.63,
        0.86,
        0.37
      ]
    }
  }
};
