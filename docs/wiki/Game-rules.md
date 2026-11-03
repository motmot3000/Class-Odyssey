# Game rules

## The principle

Each hero starts at level 1, with 0 XP, 5/5 HP and 0 virtual coins. The teacher
awards rewards and applies consequences; the application does not mark
schoolwork and does not evaluate behaviour automatically.

- **XP** moves a hero up levels. The first level-up costs 1,000 XP, then each
  level-up costs 200 XP more. The XP shown is the remainder in the current
  level, not the historical total.
- **Levelling up** restores HP to the maximum. It unlocks purchases but does not
  grant paid items or coins automatically.
- **HP** stays between zero and the hero's maximum. The default text mentions
  elimination at zero; the software never deletes the character or its data.
- **Coins** are virtual rewards, independent of XP. There is no real-money
  purchase in the current game.
- **A purchase** requires the right level and enough coins. It debits the price
  once, adds the item to the inventory and equips it. A preview never buys.

## Rewards and sanctions

Class Odyssey separates two gestures that are often mixed up:

| Gesture | What it does | What it is not |
| --- | --- | --- |
| **Reward** | Adds XP and/or coins to one student or the whole class | Not a grade, not a proof of learning |
| **Sanction** | Removes HP, up to visual elimination at zero | Not deletion, not an automatic procedure, not a server-side ban |

A sanction is a visible classroom signal. The teacher decides when it applies,
how much HP it removes and whether HP is restored. The platform keeps the data,
the inventory and the student's access intact. A level-up also restores HP, so
the consequence is never permanent.

Rules for use:

- announce the reward and sanction rules before using them;
- apply them to everyone in the same way;
- keep them proportionate and reversible;
- never use HP loss to single out or humiliate a student;
- remember that the app cannot see what actually happened in class.

## Classroom use

Navigation: **Class → Hero page → Wardrobe / Shop**. The teacher console
selects one hero at a time; **Whole class** is an explicit toggle for collective
rewards. The teacher unlock lasts five minutes after confirmation and is not
extended by collapsing the panel.

This lock is a protection against accidental manipulation. It is not a separate
student account and not a separate server permission. Do not share teacher
credentials.

Pedagogical texts can be customised per account in French and English. They do
not change the calculations. The classroom frame should be explicit, suited to
the group and should avoid reducing participation to a ranking.

The [full rules guide](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/game-rules.md)
gives the formula, examples, limits, selections and backups. The reference
catalogue is `SHOP_ITEMS` in `src/domain.mjs`, not a manually maintained copy of
prices in this wiki.

Next: [Architecture](Architecture) · [Backend and data](Backend-and-data)
