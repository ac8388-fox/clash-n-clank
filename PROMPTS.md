# Clash n' Clank – Prompts for Claude Code

Paste these **one at a time, in order**. Copy everything inside each grey box. After each one, do the check underneath before moving on.

---

## Prompt 0 – Set up (paste first)

```
I'm not a programmer, so explain everything in plain English and never assume I can read code.

Some files in this repository were uploaded from my phone, so they may all be in one place.
First, organize them: put the three files whose names start with "4 Option RPG" into a folder
called docs/, put the pictures starting with "house-" into assets/house/, and put the pictures
starting with "full-" into assets/full/ (remove the "house-" and "full-" from the names).

Then read these before doing anything else:
1. "docs/4 Option RPG – Build Spec Slice 1.md"  (what to build now: follow it exactly)
2. "docs/4 Option RPG – Core Rules.md"  (the full rules)
3. "docs/4 Option RPG – Class Abilities.md"  (only the Fighter is needed for now)

Don't write any game code yet. Reply with a short plain-English summary of Slice 1, anything
unclear in the spec, and confirmation that you'll build it as plain HTML, CSS, and JavaScript
with no dependencies, in the six steps I'll give you, stopping after each one.

For every step from now on: when you finish, save your work to the main branch so my
GitHub Pages site updates, and give me the exact web address to open on my phone.
My site is https://ac8388-fox.github.io/clash-n-clank/
```

**Check:** The summary should mention creating a character, traveling between events, two trials (the Gorge and the Sealed Crypt), two fights (a werewolf and a barrow knight), and resting at camp. If the tool lists unclear points, paste them into the design chat in Claude and bring the answers back.

---

## Prompt 1 – Rules calculator

```
Build Step 1 from the "Build steps" table in docs/4 Option RPG – Build Spec Slice 1.md.

Make engine/state.js and engine/rules.js, with automatic tests for every formula
in the spec's "Rules engine" table.

Also make a simple page called calculator.html where I can pick any of the nine races
and see its four attributes, its Luck, and how many lucky dice it gets.

When finished, tell me in plain English:
- what you built
- whether all the tests passed
- exactly how to open calculator.html on my phone
```

**Check on your phone:**
- Halfling: 12 Luck, 2 dice
- Goblin: 12 Luck, 2 dice
- Dwarf: 8 Luck, 1 die
- Human: 6 Luck, 1 die
- Dragon: 4 Luck, 1 die
- Ent: 4 Luck, 1 die

The tool should say all tests passed.

---

## Prompt 2 – Practice fight

```
Build Step 2 from the "Build steps" table in docs/4 Option RPG – Build Spec Slice 1.md.

Make engine/combat.js following the "Combat resolution" section exactly, with tests.
Then make a page called practice-fight.html: a Human Fighter with a sword and dagger
against the werewolf from the "Slice content" section, with a Restart button.
It doesn't need to look nice yet. Show the clues, the werewolf's caption, both sides'
stamina, and a one-line result after each exchange.

When finished, tell me in plain English what you built, what the tests covered,
and how to open practice-fight.html on my phone.
```

**Check on your phone:**
- When the caption says *"Its eyes drop to your legs,"* Block → Legs stops the hit.
- When it says *"It circles to your right,"* Block → Right stops the hit.
- The crouching trick (*"It crouches, eyes on your legs"*) attacks your **Head**.
- Attacking the same target twice in a row gets blocked the second time.
- A whole fight takes a few minutes. Seconds means too easy; 15+ minutes means too long.

---

## Prompt 3 – Travel and trials

```
Build Step 3 from the "Build steps" table in docs/4 Option RPG – Build Spec Slice 1.md.

Make engine/trial.js and the travel system from the "World map" and "Trials" tables,
with tests. Make a page called world-test.html that starts at the Crossroads in the
Morning and lets me travel, take both trials, fight both enemies, camp, and sleep.
Plain text is fine for now.

When finished, tell me in plain English what you built and how to open it on my phone.
```

**Check on your phone:**
- From the Crossroads, every direction leads somewhere. West says Camp.
- The time of day moves forward each journey: Morning, Afternoon, Evening, Night.
- Failing a trial lowers the bar of the attribute you tried (Dash Across lowers AGI).
- The Sealed Crypt is reachable only after crossing the Gorge, and opening it starts the knight fight.
- Sleep works only in the Evening or at Night and wakes you in the Morning with full bars.

---

## Prompt 4 – Make it look like the mockups

```
Build Step 4 from the "Build steps" table in docs/4 Option RPG – Build Spec Slice 1.md.

Build every screen listed in "Game flow and screens" to match the mockups at
https://claude.ai/artifact/2pZWKnuAzJGbU8ieVxSMaS and the "Interface implementation"
section, in both the Text and Graphic versions, with a Display setting in the menu to
switch between them. For the Graphic version, use the pictures in assets/house/
(white, sky blue, and red on black).

When finished, tell me in plain English what you built and how to open it on my phone.
```

> **Before pasting:** if you chose the full color look instead, change `assets/house/` to `assets/full/` and change the last line to "(full color)".

**Check on your phone,** with the mockups open next to it:
- Top bar: compass on the left, four bars in the order STR, AGI, WIS, FAI, menu on the right.
- The top button sits right under the top bar, and the side buttons touch the screen edges.
- Bottom left is character, bottom right is inventory.
- Choices need a one-second hold; a bar fills inside the button while you hold.
- Text is white with no blue shadow; only borders and icons have the blue edge.
- Settings → Display switches between Text and Graphic.

---

## Prompt 5 – The full slice

```
Build Step 5: connect everything into the full game loop from the title screen,
as described in docs/4 Option RPG – Build Spec Slice 1.md, including character creation and autosave.

Then go through every item in the "Done checklist" at the end of the spec and tell me,
in plain English, which items you believe work and which you couldn't confirm.
Tell me how to open the game on my phone.
```

**Check on your phone:** play from the title screen to the end, twice, and tick every box in the Done checklist at the end of `docs/4 Option RPG – Build Spec Slice 1.md`. The second playthrough should feel easier, because you've learned the enemies' tricks.

---

## If something goes wrong (paste this anytime)

```
Something isn't working. Here's what I did, what I saw, and what I expected:
[describe it in your own words]

Please explain the cause in plain English, fix it, check that nothing else broke,
and tell me how to see the fix on my phone.
```
