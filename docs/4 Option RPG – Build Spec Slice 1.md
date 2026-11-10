# 4 Option RPG – Build Spec: Slice 1

Oct 30, 2026 · @Anthony Crockett

## Goal and scope

Slice 1 is the smallest playable loop that proves the game: create a character, travel between events, pass a trial, fight with directional prediction, and recover at camp. Everything else plugs into this loop later.

This spec is for building, not designing: where *Core Rules* or *Class Abilities* leave a number open, the value here is the one to code now, and playtesting will tune it. Slice numbers use a smaller scale than the final game so fights stay short.

**The slice loop**

1. Title screen, then character creation.
2. Start at the Crossroads in the Morning.
3. Travel to the Gorge (trial), the Sealed Crypt (trial, then a Barrow Knight fight), the Hills (werewolf fight), and the Village (safe Sleep).
4. Camp or Sleep to recover.
5. The slice ends when both enemies are defeated, or the character is defeated.

## Tech approach

Plain HTML, CSS, and JavaScript with no build step or dependencies, mobile-first at 390 × 844 and playable on desktop; it can be wrapped with Capacitor later.

**Files**

| File | Holds |
| --- | --- |
| `index.html` | One page with the screen root |
| `style.css` | Black, white, and blue theme; VT323 font (bundled, with a monospace fallback) |
| `data/*.js` | Races, occupations, weapons, armor, abilities, traits, enemies, events, as plain objects |
| `engine/state.js` | The game state and save / load |
| `engine/rules.js` | Luck, damage, overflow, fatigue, Rest and Sleep |
| `engine/combat.js` | The exchange loop, speed, Clank and Clash, prediction, conditions |
| `engine/trial.js` | Trial checks and lucky attempts |
| `ui/*.js` | Screens: title, creation, event, combat, travel, menu, character, inventory |

**Principles**

- One `state` object is the single source of truth; screens only read it and call engine functions.
- Engine functions are pure where possible (state in, state out), so rules can be unit-tested without the UI.
- The only randomness is in race and occupation offers, Prayer's TPT, Fortune openings, and lucky dice. All of it goes through one seeded random function so a run can be replayed.
- Autosave to local storage after every event and every exchange.
- A **Display** setting switches between the Text and Graphic versions of every screen.

## Game flow and screens

Travel is the hub: every event ends by returning to the travel diamond, and the next event starts the moment a direction is chosen.

&#91;embedded content: slice game loop · travel hub, three event types\]

| Screen | What it does | Mockup |
| --- | --- | --- |
| Title | New Game, Continue, Settings | — |
| Character creation | Pick one of four races, a lucky number, one of four Main occupations, a name | — |
| Travel | Four directions with teasers; a blocked direction becomes Camp | Crossroads |
| Trial | Four attribute options; Fortune opening if one appears | Gorge, Sealed Crypt |
| Combat | Diamond carousel, targeting, clues, Clash event, dice overlay | Werewolf, Barrow Knight |
| Camp | Rest or Sleep, results shown | — |
| Menu | Settings (incl. Display), Save Game, Journal, Map, Help, Quit to Title | Gorge (open) |
| Character | Attributes (stamina / total), Luck, traits, class, occupation | — |
| Inventory | Ready weapons, pack, armor slots, consumables | — |
| End | Victory or defeat summary, then Title | — |

Mockups: [screen mockups](https://claude.ai/artifact/2pZWKnuAzJGbU8ieVxSMaS). Screens marked — follow the same layout and style.

## Data model

All content is data, and the engine never hard-codes a race, enemy, or event. Attribute order everywhere is STR, AGI, WIS, FAI.

**Character**

```js
{
  name, raceId, luckyNumber,            // 1–4 (Explorer later: 1–2)
  attrs: {
    STR: { natural, class, stamina },   // total = natural + class + gear
    AGI: {...}, WIS: {...}, FAI: {...}
  },
  classId: 'fighter', classLevel: 1, abilities: ['planB'],
  mainOccupation: { id, level }, minorOccupations: [],
  traits: [{ id, kind: 'TPT'|'TNT'|'CPT'|'CNT'|'PPT'|'PNT', source, expires }],
  gear: { ready: [weaponId, weaponId, weaponId], armor: { head, body, hands, legs }, shield },
  pack: [{ itemId, qty }],
  racialReady: true, cooldowns: { abilityId: exchangesLeft }
}
```

**World state**

```js
{ eventId, facing: 'N', timeOfDay: 'Morning'|'Afternoon'|'Evening'|'Night',
  visited: { eventId: true }, eventFlags: { gorgeCrossed: true, cryptOpen: false },
  defeated: { werewolf: false, barrowKnight: false }, seed }
```

**Event**

```js
{ id, kind: 'travel'|'trial'|'combat'|'camp', name, art: 'gorge', text: [...],
  exits: { N: { to, teaser } | { camp: true, teaser }, E, S, W } }
```

**Trial option**

```js
{ dir: 'up'|'right'|'down'|'left', attr: 'FAI', label, requirement: 8,
  success: { text, flags, next }, failure: { text, damage } }
```

**Ability**

```js
{ id, name, speed: 'Drawn'|'Fair'|'Swift', drains: 'STR', cooldown: 2,
  targets: 'side'|'height'|'any'|'none', effect: 'planB', upgradesTo: ['followUp'] }
```

**Weapon and armor**

```js
{ id, name, reach: 'Close'|'Approach'|'Ranged', speed, tier: 'Light'|'Medium'|'Heavy',
  drains, hands: 1|2, trait, durability: 20 }
{ id, name, slot: 'head'|'body'|'hands'|'legs', weight: 'Light'|'Medium'|'Heavy', durability: 20 }
```

**Enemy**

```js
{ id, name, art, attrs: { STR, AGI, WIS, FAI }, weapons: [...], armor,
  resist: { STR: 1 }, weak: { FAI: 2 },     // damage multipliers
  pattern: [ /* see Enemy patterns */ ], captionFor: { tellId: 'Its eyes drop to your legs.' } }
```

**Enemy pattern step** (deterministic, read in order and looping)

```js
{ tells: ['growlLeft', 'eyesLegs'],       // what the player can perceive
  action: 'attack', weapon: 'claws', target: 'legs',
  when: 'default' | 'afterBlocked' | 'below50' }  // optional condition that jumps to this step
```

## Rules engine

These are the formulas and starting numbers to code. Everything is deterministic except the five random sources named in the tech approach.

**Advantage without rolls.** Since nothing rolls, Advantage and Disadvantage change outcomes directly:

| Modifier | On an attack | On a Block |
| --- | --- | --- |
| Advantage | +50% damage (round up) | A correct Block also deals 1 damage back |
| Disadvantage | −50% damage (round down, minimum 1) | A correct Block only halves the damage |

**Numbers**

| Rule | Slice value |
| --- | --- |
| Starting class | Fighter Level 1 (guild entry is skipped in the slice): +1 STR fixed, +1 free (STR, since Fighter is pure) |
| Starting stamina | Equal to each attribute's total |
| Weapon damage | Light 1, Medium 2, Heavy 3, plus the weapon's attribute total ÷ 5 (STR for heavy and blunt, AGI for finesse and ranged), rounded down |
| Armor | Light 0, Medium −1, Heavy −2 to hits on its slot; minimum 1 damage |
| Resist / weak | Enemy multipliers on damage of that attribute (×0.5 or ×2), applied after armor |
| Overflow | Damage beyond an empty pool moves to the leftmost pool with stamina: STR, AGI, WIS, FAI |
| Empty stamina | While a pool is 0, each action using it lowers that attribute's Natural total by 1 |
| Defeat | All four pools at 0 |
| Luck | \|STR − AGI\| + \|WIS − FAI\| on Natural + Class, plus race modifier and unique gear; never below race starting Luck |
| Clues shown | 1, +1 per 15 of (WIS + FAI) total, +1 at Luck 10, +1 at Luck 30; at most the step's number of tells; one fewer at Night |
| Fortune opening | Seeded chance per exchange or trial: 5% + Luck%, capped at 50% (Explorer: always) |
| Lucky dice | 1 + 1 per 10 Luck, max 7: d20, d12, d10, d8, d6, d4, d4 |
| Lucky result | No lucky number: the enemy gets a free Basic Attack and you become Off-Balance. Each lucky number adds ×1 to the multiplier (1 = ×2, 2 = ×3) |
| Cooldowns | Swift 1 exchange, Fair 2, Drawn 3; Mastery and racial ability once per Rest |
| Pray | One random combat TPT (Focused, Emboldened, Steeled, Blessed, Nimble), or two if the enemy took no offensive action |
| Predictable | Repeating the same action at the same target two exchanges running: the enemy's next Block against it is automatically correct |
| Trial check | Success if the attribute's current stamina ≥ the requirement |
| Trial failure | Damage to that attribute's stamina = requirement − stamina, minimum 2 |
| Forced lucky attempt | When a trial's only option can't be met, the option becomes a lucky attempt |
| Combat fatigue | After a fight, each attribute's stamina drops by half the number of actions that used it, rounded up |
| Action attributes | Pray FAI, Attack = the weapon's attribute, Block WIS, Item AGI, abilities their listed attribute |
| Rest | +50% of each total to stamina, clears Rest-cleared TNTs, resets Rest abilities, takes one part of the day |
| Sleep | Evening or Night only: full stamina, clears all TPTs and TNTs, resets everything, wakes in the Morning |
| Travel | Each journey takes one part of the day |
| Durability | 20 for every item; −1 per Clank, Block, or hit taken; broken at 0 |

## Combat resolution

Each exchange runs the same eight steps, in this order.

1. **Enemy commits.** Read the current pattern step (or jump to a step whose `when` condition is true). Its action, weapon, and target are fixed before the player chooses.
2. **Clues.** Show as many of that step's tells as the player's clue count allows, as text in the narrative and as chips with a gaze caption above the enemy. Roll for a Fortune opening.
3. **Player chooses.** Action (Pray, Attack, Block, Item, or an ability from the carousel), then a target (Head, Left, Right, Legs) for attacks and blocks. A long-press attaches a lucky attempt when an opening is showing.
4. **Order by speed.** Basic Attacks use the weapon's speed and abilities their listed speed; Hindered and Speed advantage shift one tier. The slower side takes Disadvantage.
5. **Attacks meet.** At equal speed: opposite labels (Left vs Right) Clank, so neither deals damage and both become Off-Balance; the same label (Left vs Left, Head vs Head) starts a Clash; Head vs Legs, or a side vs a height, don't interact.
6. **Clash event**, if triggered. The enemy's Clash direction comes from its pattern step; the player sees clues and picks a direction. The winner gets Advantage on the next attack, and the loser becomes Off-Balance. No damage is dealt this exchange.
7. **Resolve.** In speed order: Blocks covering the attacked target stop the hit; anything else deals damage (weapon tier + attribute bonus, then Advantage or Disadvantage, armor, resist or weak, overflow). A hit carrying a Stagger cancels a slower action that hasn't resolved. Apply TPTs, TNTs, and lucky multipliers or penalties.
8. **Clean up.** Tick cooldowns, clear one-exchange conditions (Off-Balance, Hindered), advance the enemy's pattern, autosave, and check for defeat.

After the fight, apply combat fatigue, durability loss, and rewards, then return to Travel.

## Slice content

Five events, two trials, two enemies, and one class are enough to exercise every system in the loop.

**Character creation**

- Four races offered at random from all nine, using the race table in *Core Rules*.
- Lucky number: the player picks 1 to 4.
- Four Main occupations offered at random from all 28. In the slice they are shown on the character sheet only; occupation abilities come later.
- Class: Fighter Level 1, choosing Plan B or Crusher.
- **Racial ability, slice version:** in trials, it replaces the weakest option and succeeds automatically, then waits for a Rest. Racial abilities in combat come later.

**Starting gear**

| Item | Details |
| --- | --- |
| Sword | Approach, Fair, Medium, drains STR, sharp |
| Dagger | Close, Swift, Light, drains AGI, sharp, throwable |
| Leather jerkin | Body, Light |
| Herbal draught × 2 | Item action (Fair): +4 stamina to the lowest pool |

**World map**

| Event | Kind | N | E | S | W |
| --- | --- | --- | --- | --- | --- |
| Crossroads (start, Morning) | Travel hub | Village: “Smoke above the trees” | Hills: “A howl from the hills” | Gorge: “A rope bridge sways” | Camp: “West is a sheer drop” |
| Gorge | Trial | Crossroads | Camp | Sealed Crypt (after crossing): “Steps into the dark” | Camp |
| Sealed Crypt | Trial, then combat | Gorge | Camp | Camp | Camp |
| Hills | Combat | Camp | Camp | Camp | Crossroads |
| Village | Camp (safe Sleep) | Camp | Camp | Crossroads | Camp |

A failed trial deals its damage and leaves the event open, so the player can try another option or come back later.

**Trials**

| Trial | Up (FAI) | Right (STR) | Down (WIS) | Left (AGI) |
| --- | --- | --- | --- | --- |
| Gorge | Pray for passage, 8 | Brace the post, 10 | Study the knots, 7 | Dash across, 10 |
| Sealed Crypt | Pray over the seal, 8 | Force the door, 12 | Read the runes, 9 | Pick the lock, 9 |

Opening the crypt starts the Barrow Knight fight at once.

**Enemies**

|  | Werewolf | Barrow Knight |
| --- | --- | --- |
| STR / AGI / WIS / FAI | 12 / 12 / 6 / 2 | 14 / 4 / 8 / 0 |
| Range | Close | Approach |
| Weapons | Claws (Swift, Light, drains AGI); Bite (Fair, Medium, drains STR) | Greatsword (Drawn, Heavy, drains STR) |
| Armor | None | Heavy head and body, Medium legs |
| Weak / resist | — | Weak to FAI (×2) |
| Line | “Grrrhh…” | “Turn back.” |

**Enemy patterns** (steps loop in order; a `when` jumps to that step)

| Enemy | Step | Tells | Caption | Action |
| --- | --- | --- | --- | --- |
| Werewolf | 1 | Growl from your left; eyes on your legs | “Its eyes drop to your legs.” | Claws → Legs |
| Werewolf | 2 (after it is Blocked) | Hackles rise; jaws open wide | “Its jaws open toward your throat.” | Bite → Head |
| Werewolf | 3 | Circles right; ears flatten | “It circles to your right.” | Claws → Right |
| Werewolf | 4 (the trick) | Crouches low; eyes on your legs | “It crouches, eyes on your legs.” | Bite → Head |
| Werewolf | Below half stamina | Throws its head back | “It howls at the moon.” | Becomes Enraged |
| Barrow Knight | 1 | Visor turns to your head; sword rises | “The visor turns to your head.” | Greatsword → Head |
| Barrow Knight | 2 | Armor creaks on your right; weight shifts | “Its armor creaks on your right.” | Greatsword → Right |
| Barrow Knight | 3 (after it is Blocked) | Plants its feet, blade low | “It plants its feet, blade low.” | Block → Legs |
| Barrow Knight | 4 (the trick) | Visor turns to your head; sword rises | “The visor turns to your head.” | Greatsword → Legs |

Both tricks are learnable: the werewolf's crouch and the knight's every-fourth swing break the obvious read, the way *Core Rules* says normal enemies should.

## Interface implementation

Build the screens to match the mockups exactly; this lists the parts and behaviors the mockups can't show.

**Layout (both versions)**

- The screen root is 390 × 844, scaled to fit the device, with safe-area padding at top and bottom.
- Top bar: compass (top left; facing letter outside combat), four stamina bars or `stamina/total` numbers in the order STR, AGI, WIS, FAI, and the menu (top right).
- Diamond: top button under the top bar, side buttons flush to the screen edges and centered between top and bottom, bottom button above the corner buttons.
- Corner buttons: character (bottom left), inventory (bottom right).
- Graphic version: the scene image fills the screen behind everything, drawn with `image-rendering: pixelated`; buttons sit on a dark backing. Text version: narrative above and below the side buttons, prompt between them.
- Four colors only: black, white, sky blue `#5BC8F5`, and red \`#E5383B\`. Light always comes from the upper left: white highlights on top and left edges, and the sky-blue shadow offset down and to the right (CSS `box-shadow: 3px 3px 0`). No text gets the shadow; only outlines, icons, and borders do. Red marks danger and heat: enemy names, enemy eyes, blood, fire, and damage numbers.

**Controls**

| Input | Mobile | Desktop |
| --- | --- | --- |
| Choose an option | Press and hold 1 second; a bar fills inside the button; letting go early cancels | Hold the mouse button, or hold an arrow key / WASD, 1 second |
| Page the carousel (combat) | Swipe left or right | Q / E or mouse wheel |
| Back or cancel | Swipe down | Backspace or Esc |
| Lucky attempt (when an opening shows) | Tap the glowing Fortune star to arm it, then hold the action | Click the star (or press L), then hold the action |
| Details (reserved) | Swipe up | — |

**Carousel:** page 1 is Pray, Attack, Block, Item; abilities fill later pages four at a time in learning order, and the loop returns to page 1. Spent abilities stay in place, grayed out, showing their reset. Choosing Attack or Block turns the diamond into Head, Left, Right, Legs, and a choice commits only after the one-second hold, so accidental taps and double clicks do nothing.

**Feedback**

- Exchange results print as one or two short lines in the narrative (“Your sword bites its leg. −3 AGI.”), then the bars animate.
- A Clash opens a full-screen “CLASH” prompt with clues and the four directions.
- Lucky dice tumble in a row at the bottom of the scene, and a matching lucky number glows blue.
- The Fortune opening is a small glowing star beside the enemy name plus a hint line.

**Art:** reuse the mockup scenes (Gorge, Crypt, Crossroads, Werewolf, Barrow Knight) as 195 × 422 PNGs shown at 2×. The Village and Hills can reuse the Crossroads art until they have their own.

## Build steps and how to check them

Build in five steps, and make every step end in something that can be opened and tried on a phone, so it can be checked without reading code.

| Step | Ask the tool to build | How to check it |
| --- | --- | --- |
| 1. Rules | A calculator page: pick a race and see its attributes, Luck, and number of lucky dice | Compare with the race table in *Core Rules*: a Halfling shows 12 Luck and 2 dice, a Dragon 4 Luck and 1 die, a Human 6 Luck and 1 die |
| 2. Combat | A practice fight against the werewolf, with a restart button | Its clues follow the pattern table: when its eyes drop to your legs, it attacks your legs, and Blocking Legs stops the hit. A fight lasts a few minutes, not seconds and not forever |
| 3. Trials and travel | The Crossroads with working directions, plus the Gorge and Crypt trials | Every direction leads somewhere and West becomes Camp; the time of day changes with each journey; a failed trial drains the attribute that was tried |
| 4. Screens | Every screen styled like the mockups | Side by side with the mockups on a phone: buttons, corners, top bar, and colors match, and the Display setting switches Text and Graphic |
| 5. Full slice | The whole loop from the title screen | Tick every item in the done checklist below |

**At the end of every step, ask the tool:**

- “What did you build, what did you test, and did anything not match the spec?”
- “How do I open this on my phone?”

Then bring its answer, or a screenshot, back to the design chat to check against this spec. Something that just feels wrong (“the fight feels unfair”) is worth reporting too; it's either a bug or a number to tune.

## Done checklist and out of scope

Slice 1 is done when a new player can finish the loop on a phone without help, and every item below works.

- [ ] Create a character from four random races and four random occupations, with a lucky number
- [ ] Starting Luck and dice count match the race table
- [ ] Travel from the Crossroads in all four directions, including Camp for the blocked West, with time advancing each journey
- [ ] Pass and fail both trials; failure damages the right pool; the racial ability replaces the weakest option
- [ ] Fight the werewolf and the Barrow Knight using the exchange loop, with clues and gaze captions
- [ ] Clank, Clash, Block, Pray, Item, Plan B or Crusher, and cooldowns all behave as specified
- [ ] Overflow follows STR, AGI, WIS, FAI; defeat at all four pools empty
- [ ] A Fortune opening appears, a lucky attempt rolls the right dice, and both outcomes apply
- [ ] Learning each enemy's pattern makes the fight noticeably easier on a second try
- [ ] Combat fatigue, Rest, and Sleep update stamina and traits correctly
- [ ] Menu, character sheet, and inventory open from their buttons
- [ ] The Display setting switches between Text and Graphic versions
- [ ] Autosave restores the run after the app is closed

**Out of scope for Slice 1:** guild entry and other classes, specializations, occupation abilities and leveling, legacy, the map screen's contents, NPCs and affection, drinks and tolerance, racial abilities in combat, ranged combat and positions beyond Close and Approach, durability repair, and shops.
