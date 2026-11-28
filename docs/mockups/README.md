# Screen mockups

Design mockups for Slice 1, one 390 × 844 phone screen per file.

- `text/` – the Text display (no pictures)
- `house/` – the Graphic display in the house style (black, white, sky blue #5BC8F5, red #E5383B)
- `full/` – the Graphic display in full color

Each screen exists in all three folders:

| File | Screen |
|---|---|
| Explore.html | An event (the Gorge trial), with the menu open |
| Crypt.html | The Sealed Crypt trial |
| Main.html | Combat, carousel page 1 (Pray, main attack, Block, Item) |
| Abilities.html | Combat, carousel page 2 (the weapon's other attacks, each on the side it hits) |
| Side.html | Combat, choosing where to Block, with the right button mid-hold |
| Travel.html | Travel between events |

Notes for building from these:
- `{{glow}}` in the files means sky blue #5BC8F5 (it is a design-tool placeholder).
- The files use a design-tool wrapper (`<x-dc>`, `support.js`); copy the layout, sizes,
  colors and spacing, not the wrapper.
- Story text, captions and clue lines in the mockups are examples only. Where they reveal
  the enemy's next move, follow the current rules instead (no tells unless an ability,
  trait or item gives one).
- Where a mockup differs from the Build Spec or Core Rules, the docs win.
