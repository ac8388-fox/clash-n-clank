# 4 Option RPG – Core Rules

Oct 29, 2026 · @Anthony Crockett

## World and design principles

The game is a text-first, four-option RPG for mobile (playable on desktop) in a world built on Christian symbolism with a magic overlay. Class abilities live in the companion doc, *4 Option RPG – Class Abilities*.

- **Four choices everywhere:** four races offered at creation, four occupations offered, four directional options, and eventually four variants per race.
- **One Almighty God.** Lesser spiritual beings exist beneath Him, some loyal and some fallen, in the spirit of C.S. Lewis, Brian Godawa, and Michael Heiser. Miracles are prayers God answers, not spells a character owns.
- **Giant-kin enemies** (the Nephilim idea) appear under a name still to be created.
- **Information, not certainty:** attributes and traits improve the clues a player gets, never the correctness of their choice. The single exception is the Prophet's Foretell miracle.
- **Enemies are deterministic:** each follows a learnable behavior pattern. Rare titled elites adapt to the player, but never randomly.

## Attributes, stamina, and Luck

Four attributes (STR, AGI, WIS, FAI) double as stamina, and Luck is calculated from how lopsided they are.

| Direction | Attribute | Trial option | Combat action |
| --- | --- | --- | --- |
| Up | Faith (FAI) | Faith option | Pray |
| Right | Strength (STR) | Strength option | Attack |
| Down | Wisdom (WIS) | Wisdom option | Block |
| Left | Agility (AGI) | Agility option | Item |

**Attribute layers**

| Layer | Source | Counts for Luck | Pair caps apply |
| --- | --- | --- | --- |
| Natural | Race (fixed 24 points), events, permanent items such as a book or rare tonic | Yes | Yes |
| Class | Class level growth | Yes | No |
| Gear | Equipped items | No (unique "lucky" gear adds Luck directly) | No |
| Temporary | Potions, brews, abilities | No | No |

- **Effective** attributes = all layers combined; they set what a character can do now, and they are what stamina draws from.
- **Pair caps:** Natural STR + AGI ≤ 100, and Natural WIS + FAI ≤ 100.

**Stamina**

- Attributes are stamina. Fights drain them by scale and length, settled by the game, never managed swipe by swipe; single-action events can charge per action.
- **Exhausted:** all class and occupation abilities are unusable until any stamina returns. Returning stamina restores only abilities that don't need Rest, Sleep, or Prayer to reset.

**Damage and fatigue** (there is no health pool)

- **Trials and events:** a failed attempt drains stamina from the attribute attempted. When the only option's requirement can't be met, the player is forced into a lucky attempt.
- **Combat damage:** every weapon and ability carries an attribute, and its hits drain the target's stamina in that attribute, applied as the hits land. If that stamina is already 0, or a hit is bigger than what remains, the excess goes to the leftmost pool that still has stamina, in the order STR, AGI, WIS, FAI, so Faith is always the last to fall. A character is defeated when all four stamina pools reach 0.
- **Combat fatigue:** combat actions cost nothing in the moment. After the fight, stamina drops in proportion to the attributes the character actually used (a mostly-Faith fight drains Faith), on top of any damage taken.
- **Empty stamina:** stamina is the current pool out of the attribute's total (12/36 means 12 stamina of a 36 total). While an attribute's stamina sits at 0, each action using it lowers that total by 1, and the stamina stays at 0. Lost points come off the Natural layer, so Luck recalculates (never below the race floor). Stamina refills through Rest, Sleep, Prayer, and items; the total only grows back through events, class levels, and permanent items. Choices after a fight (Rest, Sleep, Prayer, items) matter most.

**Keeping every ability useful**

- **Predictable:** using the same action two exchanges in a row gives the enemy an extra clue against you and Advantage on its next Block.
- **Cooldowns:** most abilities recover after one or two exchanges, so none can be used every exchange.
- **Resistances and weaknesses:** enemies resist or are weak to particular attributes (armored soldiers resist STR, spirits resist steel but break under FAI, constructs ignore WIS, beasts are weak to AGI).
- **Fatigue:** a fight fought with one attribute drains that attribute afterward, so spreading actions out keeps a character healthy.

**Luck**

- Luck = |STR − AGI| + |WIS − FAI|, using Natural + Class attributes at full value (never current stamina).
- Plus racial modifiers (Human +6, Dragon −10), unique gear, and the lucky classes (Rogue, Bard, Jester, Explorer).
- Luck never falls below the race's starting Luck.

**Lucky attempts** (the only rolls in the game)

Abilities and combat never roll. Luck adds an optional gamble: when a Fortune opening appears, the player can attach a roll to an action for a Critical, at the risk of a penalty.

- **Fortune openings:** a glowing star and a hint in the scene ("He slips on the wet stone"). They appear more often with higher Luck. The Explorer always has one.
- **Gambling:** long-press the action (Shift-click on desktop). Without an opening, a long-press does nothing.
- **Lucky number:** chosen at character creation, 1 to 4 (Explorer: 1 or 2).
- **Dice:** 1, plus 1 per 10 Luck, to a maximum of 7. Each added die is smaller.

| Dice | Most classes | Explorer |
| --- | --- | --- |
| 1 | d20 (5%) | d20 (5%) |
| 2 | + d12 (13%) | + d12 (13%) |
| 3 | + d10 (22%) | + d10 (22%) |
| 4 | + d8 (31%) | + d8 (31%) |
| 5 | + d6 (43%) | + d6 (43%) |
| 6 | + d4 (57%) | + d4 (57%) |
| 7 (max, Luck 60+) | + d4 (68%) | + coin (79%) |

Percentages are the chance of rolling at least one lucky number.

| Lucky dice rolled | Outcome |
| --- | --- |
| None | The enemy counters and you gain a TNT; in a trial, the option fails worse than normal |
| 1 | Critical ×2 |
| 2 | Critical ×3 |
| 3 or more | ×4, and so on |

## Races

Nine races each start with 24 Natural points, one racial ability, one permanent positive trait, and one permanent negative trait; four are offered at character creation.

| Race | STR | AGI | WIS | FAI | Luck | Ability | Positive | Negative | Drink tolerance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Halfling | 3 | 12 | 3 | 6 | 12 | Lucky Escape | Pathfinder | Traditionalist | High |
| Goblin | 5 | 12 | 6 | 1 | 12 | Scavenge | Tenacious | Impulsive | Moderate |
| Dwarf | 10 | 6 | 6 | 2 | 8 | Bedrock | Stout | Stubborn | High |
| Elf | 4 | 6 | 4 | 10 | 8 | Elven Grace | Lightfooted | Arrogant | Low |
| Gnome | 3 | 6 | 10 | 5 | 8 | Invent | Precise | Perfectionist | Low |
| Beastborn | 12 | 7 | 2 | 3 | 6 | Beast Fusion | Resilient | Alienated | Varies |
| Human | 6 | 6 | 6 | 6 | 6 (+6 fixed) | Resourceful | Curious | Mortal | Moderate |
| Dragon | 7 | 3 | 12 | 2 | 4 (−10 modifier) | Word of Power | Keen Senses | Greedy | Moderate |
| Ent | 4 | 2 | 8 | 10 | 4 | Entangling Roots | Ancient | Slow | High |

**Racial abilities**

| Race | Ability | In and out of battle |
| --- | --- | --- |
| Human | Resourceful | Use an ordinary item, or a different attribute than normal, to solve a problem it wasn't meant for |
| Dwarf | Bedrock | Become unbreakable for one exchange or one hazard: reduced damage, can't be moved, knocked Off-Balance, or Staggered; hold a ceiling, withstand a flood, anchor a rope |
| Elf | Elven Grace | Act with fluid precision, avoiding a stumble, hazard, or misstep |
| Halfling | Lucky Escape | When an attack or hazard would hit, a chance to slip free entirely |
| Goblin | Scavenge | Grab a usable item mid-fight; turn up extra supplies and overlooked valuables outside it |
| Gnome | Invent | Rig a quick device in battle (trip line, smoke pouch, makeshift shield); build tools for locks, gaps, repairs, and puzzles |
| Beastborn | Beast Fusion | Outside battle, merge with a beast carcass to gain its attributes, traits, or skills, which then apply everywhere |
| Dragon | Word of Power | An ancient word: halt, humble, or scatter weaker creatures; open sealed doors, command old constructs, speak with ancient beings; scales with WIS against the target's WIS or FAI |
| Ent | Entangling Roots | Bind a target so it can't move or change position |

**Rules**

- In trials, the racial ability replaces the character's weakest option for that trial (by effective attributes against the trial's requirements). In combat, it sits in the ability carousel.
- It resets through Rest, Sleep, an item, or a separate ability.
- Ancient (Ent) resists poison, disease, aging, and spiritual effects. Slow (Ent) acts later in fast situations and struggles in timed trials.
- Drink tolerance also shifts with size, habit, traits, and Beast Fusion. Drinks run Buzzed, Tipsy, Drunk, then Blackout.

## Traits

Traits come in three durations, each with a positive and a negative form.

| Duration | Positive | Negative | Removed by |
| --- | --- | --- | --- |
| Temporary | TPT | TNT | Sleep; some also clear with Rest or Prayer, as listed below |
| Chronic | CPT | CNT | Items, abilities, or events that name what they remove |
| Permanent | PPT | PNT | Not removable |

**Injury ladder**

| Severity | Trait | Type | Effect | Removed by |
| --- | --- | --- | --- | --- |
| Light | Bruised | TNT | Disadvantage on attacks with the bruised limb | Sleep |
| Moderate | Injured | CNT | Weakens one attribute or limb | Herbalist, Physician, items, or events |
| Severe | Maimed | CNT | Seriously weakens a limb or attribute | Physician's Surgery, or a specific item or event |

**Trait list**

| Trait | Type | Effect | Removed by |
| --- | --- | --- | --- |
| Focused | TPT | One extra clue next exchange | Used, or Sleep |
| Emboldened | TPT | Immune to Fear; Advantage on the next attack | Used, or Sleep |
| Steeled | TPT | The next TNT you would gain is ignored | Used, or Sleep |
| Blessed | TPT | The next hit you take deals 25% less damage | Used, or Sleep |
| Nimble | TPT | Speed advantage on your next position change | Used, or Sleep |
| Well-Fed | TPT | Stamina drains 25% slower | Sleep |
| Winded | TNT | Can't use Drawn actions | Rest |
| Dazed | TNT | One fewer clue each exchange | Rest |
| Shaken | TNT | Disadvantage in Clashes | Rest or Prayer |
| Hungover | TNT | Disadvantage on Wisdom actions | Rest |
| Fatigued | TNT | Abilities that reset through Rest don't reset | Sleep only |
| Bleeding | TNT | Lose stamina each exchange | Treatment (Herbalist, Physician, bandages), not Rest |
| Sick | CNT | Lose stamina each day; slower recovery | Physician, Herbalist remedies, or items |
| Defiled | CNT | Pray grants no TPT | Prayer at a holy site, Consecrate, or a Cleric |
| Seasoned | CPT | One extra clue against an enemy type you have beaten many times | Rarely lost; only by named events |
| Favored | CPT | A town or guild trusts you: better prices and quicker help | Lost by betraying that town or guild |

**Existing combat TNTs that clear early**

- Fear and Enraged clear with Rest or Prayer.
- Blinded clears with Rest.
- Bruised clears with Sleep, or with Rest plus a remedy.
- Poisoned clears with an antidote or Herbalist's Remedy, or runs its course.
- Burning clears when put out (water, rolling, smothering).

## Occupations

Each character has one Main occupation, chosen at creation from four offered, and up to four Minor occupations picked up through opportunities in play. Occupations level from 0 to 100, and either a Main or a Minor can satisfy a specialization requirement.

| Level | Main occupation gains | Minor slot gains |
| --- | --- | --- |
| 1 | Minor ability | Minor ability |
| 25 | Major ability 1 | — |
| 50 | Major ability 2 | Minor ability upgrade |
| 75 | Major ability 1 upgrade | — |
| 100 | Major ability 2 upgrade and Mastery | Minor ability mastery |

Level 25 abilities work out of combat; Level 50 abilities are mostly out of combat but can carry into battle.

| Occupation | Attr | Minor | Level 25 | Level 50 |
| --- | --- | --- | --- | --- |
| Knight | STR | Rally: steady allies; command respect | Oath of Service: lodging, nobles, protection | Challenge: force a one-on-one duel |
| Mercenary | STR | Size Up: judge a foe; negotiate contracts | Contract: find and negotiate paid work | Hired Blades: NPC fighters join a battle |
| Blacksmith | STR | Mend: restore gear durability | Forge: craft weapons and armor | Temper: permanently improve gear |
| Miner | STR | Stonesense: weak walls, hidden passages | Excavate: tunnels, ore, buried ways | Undermine: trigger a prepared collapse |
| Woodcutter | STR | Fell: chop through doors and shields | Timber: rafts, bridges, shelters | Deadfall: log traps along routes |
| Porter | STR | Heavy Load: carry more; haul allies out | Pack Train: no heavy-carry penalties | Haul: move or hurl massive objects |
| Mason | STR | Fortify: reinforce; raise quick cover | Stonework: build and repair for pay | Stronghold: fortified camp for Rest and Sleep |
| Hunter | AGI | Track: follow trails; read movement | Field Dress: food, hides, carcasses | Stalk: open fights with an ambush |
| Thief | AGI | Pilfer: lift items; snatch mid-fight | Bypass: locks and simple traps | Case: learn a site's guards and exits |
| Courier | AGI | Shortcut: faster routes; quick repositioning | Dispatch: paid deliveries, official access | Outrun: escape or chase down |
| Sailor | AGI | Sea Legs: balance; resist Off-Balance | Navigate: sail, read sea and stars | Ropework: climb, swing, bind |
| Acrobat | AGI | Tumble: leap and climb; evade | Perform: coin, attention, distraction | Ascend: take the high ground |
| Angler | AGI | Cast Line: snag objects; trip foes | Catch: food and rare fish | Net: entangle an opponent |
| Rider | AGI | Mounted: ride; mounted charges | Break: tame and train mounts | Horsemanship: trick riding, mounted evasion |
| Scholar | WIS | Study: research; identify enemy types | Research: libraries, lore, recipes | Expertise: Advantage against a studied foe |
| Merchant | WIS | Barter: better prices; bribes | Trade Route: buy low, sell high | Patronage: fund shops and caravans |
| Alchemist | WIS | Brew: potions; volatile mixtures | Distill: reagents, purify, identify | Concoct: weapon coatings that apply TNTs |
| Scribe | WIS | Decipher: codes and old documents | Counterfeit: passes, letters, seals | Chronicle: spread your reputation |
| Cartographer | WIS | Chart: map routes; read terrain | Survey: make and sell maps | Wayfinding: never lost; find hidden places |
| Physician | WIS | Treat: heal; stabilize a downed ally | Diagnose: diseases, poisons, CNTs | Surgery: remove injury CNTs, including Maim |
| Jeweler | WIS | Appraise: value; armor weak points | Cut: jewelry for trade or affection | Inlay: unique gear, including Luck items |
| Barkeep | FAI | Round on Me: brew drinks; win affection | Hearth: tavern room, rumors, income | Brewmaster: stronger, longer brews |
| Shepherd | FAI | Herd: drive creatures; push foes | Husbandry: raise and heal animals | Keep Watch: no ambushes during Rest or Sleep |
| Acolyte | FAI | Bless: minor blessing; small boost | Sanctuary: refuge at holy places | Consecrate: hallowed ground hinders the fallen |
| Gravedigger | FAI | Last Rites: lay the dead to rest | Exhume: clues and items from graves | Preserve: bodies, food, and carcasses |
| Pilgrim | FAI | Steadfast: less fatigue; holy shelter | Pilgrimage: blessings at holy sites | Fast: go without food; gain a TPT in battle |
| Herbalist | FAI | Forage: herbs and remedies; quick poultice | Remedy: cure TNTs and common poisons | Cultivate: grow rare herbs |
| Augur | FAI | Discern: truth, danger, spiritual presence, deception | Counsel: comfort NPCs and earn trust | Vision: dreams reveal coming danger |

**Legacy (a dead character's occupation)**

- The inherited occupation becomes the new Main and starts at 10% of the predecessor's level.
- **Family Name:** NPCs and guilds tied to it recognize the lineage.
- **Mentored:** double occupation experience until reaching half the predecessor's level.
- **Inherited Trait:** one random CPT the predecessor acquired (skipped if none).
- **Inherited Technique** (predecessor 25+): one Major ability they unlocked, at reduced strength until its normal level.
- **Heirloom Mastery** (predecessor 100): a legacy-only Mastery variant, and the player chooses the Inherited Technique and CPT instead of rolling them.

## Class entry

A character joins a base class by reaching 20 Natural points in its primary attribute and earning 20 interest points at that class's guild, then passing a final test.

| Guild interaction | Interest |
| --- | --- |
| Visit the guild | +1 |
| Ask two questions | +1 |
| Buy class gear (at outsider prices) | +1 |
| Do a menial task | +2 |
| Complete a class event or meaningful interaction | +2 |
| Assist a guild member (the final test) | Grants entry |

- Every town has four class guilds. The player sees interest grow through how the guild treats them, not as a number.
- **Rogue guild:** the player hears it exists but must search for the entrance; asking the wrong person raises suspicion, and rogues trust no one easily.
- **Explorer:** needs 20 Luck instead of a primary attribute and must specialize at Level 3.
- **Specializations** unlock at class Level 3 or later and need a qualifying occupation (Main or Minor). Once offered, an offer stays open unless the player does something to lose it.

## Gear

A weapon sets the speed, reach, and damage of a Basic Attack; armor protects the four targets an attack can strike; abilities keep their own listed speed.

**Weapons**

Damage tiers are placeholders for playtesting: Light 4, Medium 6, Heavy 9. Heavy and blunt weapons add STR ÷ 5 to damage; finesse and ranged weapons add AGI ÷ 5.

| Weapon | Reach | Speed | Damage | Drains | Hands | Trait |
| --- | --- | --- | --- | --- | --- | --- |
| Hand wraps | Close | Swift | Light | AGI | Both | Pugilist only; can't Clank |
| Gauntlets | Close | Swift | Light | STR | Both | Can Clank; double as hand armor |
| Dagger | Close | Swift | Light | AGI | One | Sharp; throwable |
| Short blade | Close | Swift | Medium | AGI | One | Sharp; finesse (AGI) |
| Sword | Approach | Fair | Medium | STR | One | Sharp; no wrong-reach penalty at Close |
| Axe | Approach | Fair | Medium | STR | One | Sharp; wears down shields twice as fast |
| Mace | Approach | Fair | Medium | WIS | One | Blunt; Bruises on a hit |
| Spear | Approach | Fair | Medium | AGI | Two | Long: a free attack on anyone closing from Ranged |
| Greatsword | Approach | Drawn | Heavy | STR | Two | Sharp; Off-Balance on a hit |
| Warhammer | Approach | Drawn | Heavy | STR | Two | Blunt; breaks Braced |
| Sling | Ranged | Swift | Light | WIS | One | Blunt; Bruises; stone ammo |
| Throwing knives | Ranged | Swift | Light | AGI | One | Sharp; limited count |
| Bow | Ranged | Fair | Medium | AGI | Two | Arrows; finesse (AGI) |
| Crossbow | Ranged | Drawn | Heavy | STR | Two | Bolts; ignores light armor |

Only blessed or holy weapons drain FAI. Abilities drain by their nature: physical blows STR, quick or precise strikes AGI, mental effects and deception WIS, holy and spiritual effects FAI; anything unclear uses the class's primary.

**Gauntlet variants:** cestus (Light), brass knuckles (Light, Bruises), spiked gauntlets (Medium, Bleeding on a hit), weighted gauntlets (Medium, Off-Balance on a Head hit).

**Wrong reach:** a weapon used from a position it doesn't suit gives the attack a Speed disadvantage. Melee weapons can't attack from Ranged unless thrown.

**Ready weapons:** up to three ready weapons (two at hand or belt, one on the back). Plan B and its upgrades switch between them; reaching anything in the pack takes an Item action.

**Armor**

Armor has four slots that match the attack targets.

| Slot | Protects | Notes |
| --- | --- | --- |
| Head | Head attacks | Heavy helms cost one clue per exchange |
| Body | Left and Right attacks | The most protective slot |
| Hands | Disarms, Bruised hands, Wrench | Gauntlets fill this slot |
| Legs | Leg attacks | Heavy leg armor slows climbing and swimming |

| Weight | Damage reduction | Drawback |
| --- | --- | --- |
| Light | −1 | None |
| Medium | −2 | None |
| Heavy | −3 | Two or more Heavy pieces give position changes a Speed disadvantage; full Heavy can't swim |

**Shields**

| Shield | Hands | Effect |
| --- | --- | --- |
| Buckler | One | A correct Block also gains Speed advantage |
| Round shield | One | Can hold a Guard on one direction |
| Tower shield | One | Can Guard two directions; you are Hindered when changing position |

**Durability, bonuses, and unique gear**

- Every item has durability. It wears with Clanks, Blocks, and hits; at 0 the item is broken until repaired (Blacksmith's Mend and Temper, Engineer's Field Repair). Saboteur's Sunder can break it outright.
- Ordinary gear may carry one effective-attribute bonus from +1 to +5. It never grants Luck.
- **Unique gear** (a named, lucky, or favorite item, including Jeweler's Inlay work) can grant Luck directly. A character can benefit from at most two unique items at a time.

## Combat

Combat is simultaneous action with pauses: time stops, the player reads the enemy and chooses, then both sides act at once, ordered by speed.

**The exchange**

1. Time pauses and the player receives clues about the enemy's intent: sight, sound, speech, movement, environment, and habit.
2. The player picks an action (Pray, Attack, Block, Item, or an ability) and, for attacks and blocks, a target: Head, Left, Right, or Legs, always from the player's perspective.
3. Both actions resolve, faster first. A faster attack can stop a slower one only if it carries a trait, such as a Stagger; the slower action takes a disadvantage.

**Pray:** gain one random combat TPT, or two if the enemy didn't attack or use an offensive item or ability that exchange.

**Speed:** Drawn (slow) → Fair (normal) → Swift (fast).

**Positions:** Close (fists, daggers), Approach (most melee), Ranged (bows, thrown weapons). Each weapon has a reach it suits.

**When attacks meet at equal speed** (player's perspective)

| Player | Enemy | Result |
| --- | --- | --- |
| Left | Right, or Right / Left | Clank: no damage; both gain a fitting TNT |
| Left | Left, or Right / Right | Clash event |
| Head | Head, or Legs / Legs | Clash event |
| Head | Legs, or a height against a side | No interaction; both resolve by speed |

A Pugilist without gauntlets can't Clank.

**Clash event:** the enemy has already chosen a direction by its pattern. The player gets indirect clues, scaled by WIS, FAI, Luck, traits, and abilities, and picks a direction. A correct pick gives Advantage on the next attack and inflicts an extra TNT; a wrong one hands those to the enemy. Blocks and evades use the same prediction.

**Conditions and states**

| Term | Type | Effect |
| --- | --- | --- |
| Advantage / Disadvantage | Modifier | Better or worse chance of success |
| Speed advantage / disadvantage | Modifier | Next action counts one tier faster or slower |
| Hindered | TNT | Next action one speed tier slower |
| Off-Balance | TNT | Disadvantage on attacks and Blocks; no counters |
| Stagger | Instant | Cancels an action in progress; breaks Braced, Guard, and Readied |
| Braced | State or TPT | Reduced damage; resists movement and Off-Balance; broken by a Stagger |
| Bedrock | State | Unbreakable Braced (Dwarf) |
| Readied | Stance | Counter if attacked; Advantage on the next attack if not |
| Guard | Defense | A defense lasting beyond one exchange; broken by Bash |
| Grappled | State | Neither fighter can move or use two-handed or reach weapons; break free by Blocking and predicting correctly |
| Fear | TNT | Disadvantage against its source; may hesitate |
| Enraged | TPT + TNT | More damage, less accuracy |
| Ensnared | TNT | Can't change position; Disadvantage on Agility actions |
| Exhausted | State | All class and occupation abilities unusable until stamina returns |

## Travel

The world is traveled event to event: after every event the player picks North, East, South, or West, and the next event begins immediately. There is no empty walking, so every tap leads somewhere that matters.

- **The travel diamond:** Up is North, Right is East, Down is South, Left is West, matching the map. The compass then shows the direction just traveled.
- **Every direction has a teaser:** one line hinting at what lies that way ("Smoke rises above the trees," "A howl from the hills," "The river road"). Places already visited are named.
- **No dead options:** a direction that can't be traveled (a sheer cliff, the sea) is replaced by **Camp**, which leads to Rest or Sleep.
- **Time:** each journey takes one part of the day: Morning, Afternoon, Evening, Night. Four journeys make a day, and Night travel is more dangerous unless the character Sleeps.
- **Fortune openings** can appear while traveling: a hidden path, a shortcut, or a lucky find.
- **The map** (tap the compass) shows visited events and the paths between them.

## Interface

The screen is a tall vertical diamond of four choices under a text-and-pixel-art scene, styled in white on black with a blue offset glow. See the [screen mockups](https://claude.ai/artifact/2pZWKnuAzJGbU8ieVxSMaS).

**Layout**

- **Top left:** a compass showing facing (N, E, S, W) outside combat; tap it for the map.
- **Top bar:** current / total stamina for STR, AGI, WIS, and FAI.
- **Top right:** menu: Settings, Save Game, Journal, Map, Help, and Quit to Title, dropping down over a dimmed screen.
- **Middle:** the scene, with the enemy's name, range, and clues.
- **Bottom:** the diamond carousel, with page dots; character management in the bottom-left corner and inventory in the bottom-right. Enemy scenes show a one-line gaze caption above the enemy's head ("Its eyes drop to your legs.").

**Controls**

| Input | Mobile | Desktop |
| --- | --- | --- |
| Choose an action, ability, or target | Press and hold for one second (a bar fills inside the button) | Hold the mouse button, or hold an arrow key, for one second |
| Page the carousel | Swipe left or right | Mouse wheel or Q / E |
| Back or cancel | Swipe down | Backspace or Esc |
| Details (reserved) | Swipe up | — |

**Carousel**

- Page 1 is always Pray, Attack, Block, Item; every combat-usable ability (class, racial, occupation) fills later pages, four at a time, and the loop returns to page 1.
- New abilities are added to the next open slot; outside combat, the player can rearrange them.
- Spent abilities stay in place, grayed out with their reset condition, so positions never shift.
- After choosing Attack or Block, the diamond becomes Head, Left, Right, Legs. A choice commits only after a one-second hold, which prevents accidental taps and double clicks; letting go early cancels, and swipe down backs out. For a lucky attempt, tap the glowing Fortune star to arm it, then hold the action.

**Style:** four colors only: black background, white text and pixel graphics, light always falls from the upper left, so white highlights sit on top and left edges and a sky blue (#5BC8F5) shadow falls to the lower right of outlines, icons, and objects (never text), and red for danger and heat: enemy names and eyes, blood, fire, torches, and the setting sun. The map is the one place with more detail, in the spirit of old DOS and roguelike maps.

## Parked for later

These are deliberately deferred, not forgotten.

- [ ] A name for the giant-kin enemies
- [ ] The map screen behind the compass
- [ ] The NPC affection system (drinks, gifts, Counsel, Family Name)
- [ ] Drink Strength values and tolerance thresholds
- [ ] Racial subtypes and mixed heritage (four variants per race)
- [ ] Trials that test Natural attributes only
- [ ] How Ent's Slow interacts with the speed tiers
- [ ] Legacy perks for the Gear and Trait legacy options
- [ ] Power limits for Jeweler's Inlay (Luck gear) and Knight's Challenge
- [ ] Unarmed and gauntlet damage values, set in playtesting
- [ ] What a swipe up shows (ability or enemy details)
- [ ] Rethinking the Faith base class name (Cleric is a placeholder)
