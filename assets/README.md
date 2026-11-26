# Game pictures

There are two art styles while one is being chosen:

- `house/` – white, sky blue, and red on black
- `full/` – full color

Each picture has a normal size (195 × 422) and a `@2x` size (390 × 844).

| File name | Used for |
| --- | --- |
| `crossroads` | The Crossroads (also the Village and the Hills until they get their own) |
| `gorge` | The Gorge trial |
| `crypt` | The Sealed Crypt trial |
| `werewolf` | The werewolf fight |
| `barrow-knight` | The Barrow Knight (outside the fight) |
| `werewolf-bg`, `barrow-knight-bg` | The fight background without the enemy (`@2x` only) |
| `werewolf-sprite`, `barrow-knight-sprite` | The enemy alone, on a transparent background (`@2x` only) |

In a fight, the game draws the `-bg` picture and the `-sprite` picture as separate layers, so the
enemy can flash, recoil, and fade. Where the sprite sits, and its head / left / right / legs zones,
are set in `data/enemyArt.js`: if a new sprite has a different size or pose, adjust those numbers.

**To swap a picture:** upload a new file with exactly the same name into the same folder
(for example `house/werewolf.png` and `house/werewolf@2x.png`). The game picks it up
automatically; no code changes are needed. Keep the same size so it lines up on screen.
