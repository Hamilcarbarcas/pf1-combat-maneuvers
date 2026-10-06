# PF1 Combat Maneuvers

Pathfinder 1e treats every combat maneuver as the same thing. Trip, grapple and
sunder are one undifferentiated "combat maneuver" action, which means a `+2 bonus on
trip attempts` has nowhere to live except a note a human reads. This module makes
each maneuver its own addressable thing: it gets bonuses, it gets a defense, it gets
rolled by name, and other modules can target it.

> **Status:** early development, and not yet tested in a live world.
> See [CHANGELOG.md](CHANGELOG.md) for what has landed.

**Manifest URL:**
`https://github.com/Hamilcarbarcas/pf1-combat-maneuvers/releases/latest/download/module.json`

## Requirements

- **[libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)** (required) — used to
  extend PF1's change resolution, actor data preparation and actor sheet alongside
  other modules rather than in place of them.
- **[roll-bonuses](https://github.com/dmrickey/ckl-roll-bonuses)** (optional) — see
  [Targeting maneuvers from other modules](#targeting-maneuvers-from-other-modules).

## Contents

- [What it does](#what-it-does)
- [Rolling a maneuver](#rolling-a-maneuver)
- [Bonuses to a specific maneuver](#bonuses-to-a-specific-maneuver)
- [Defenses against a specific maneuver](#defenses-against-a-specific-maneuver)
- [Maneuver items and the combat tab](#maneuver-items-and-the-combat-tab)
- [Targeting maneuvers from other modules](#targeting-maneuvers-from-other-modules)
- [Settings](#settings)
- [For module authors](#for-module-authors)
- [Known limitations](#known-limitations)

## What it does

- **Left-click CMB** and pick which maneuver you are attempting, with each option
  showing the modifier that actually applies to it.
- **New change targets** — `CMB (Trip)`, `CMD vs. Trip`, and a flat-footed variant,
  for all ten core maneuvers and any a module adds.
- **A Combat Maneuvers category** on the combat tab, with the same `+` button the
  other attack categories have.
- **Automatic tagging** so bonus modules can target one maneuver, or a group of
  them, without hand-editing weapon types.

Nothing is written to any actor until you deliberately customize something. Install
it, change your mind, uninstall it, and your actors are exactly as they were.

## Rolling a maneuver

Click **CMB** on the character sheet. The picker lists every registered maneuver
plus a **Generic** entry, each with its own modifier, and rolls the one you choose
through PF1's ordinary attack pipeline — attack dialog, targets, chat card and all.

**Generic** is untyped on purpose. It picks up broad CMB bonuses only and is
compared against the target's plain CMD, which is what you want for a maneuver
nobody has written rules for.

The attack card shows the defense that actually applies: attempt a trip against a
target with `+4 CMD vs. Trip` and the card shows the higher number, not their
general CMD.

## Bonuses to a specific maneuver

Add a Change to any item and pick a target under **Combat Maneuvers**. For Improved
Trip, that is `+2 untyped` to `CMB (Trip)`.

These stack with everything else the way an attack bonus normally does — they are
pulled into the roll through the same machinery PF1 uses for melee, ranged and
natural attack bonuses, so bonus types behave as expected.

Context notes work the same way: a note targeting `CMB (Trip)` appears on the card
only when you actually attempt a trip.

## Defenses against a specific maneuver

`CMD vs. Trip` and `Flat-Footed CMD vs. Trip` are change targets like any other.
They are stored as a difference from your general CMD, so everything that already
feeds CMD — base, BAB, Strength, size, Dexterity, negative levels — is included
automatically, and you only enter the part that is specific to the maneuver.

In roll data that reads as `@attributes.cmd.maneuvers.trip.total`.

## Maneuver items and the combat tab

Each maneuver can have its own item, so you can customize one the way you would any
other attack: change the ability score it uses, add damage, attach notes, hang
script calls on it.

Those items are created **on demand**. Right-click **CMB** to open the manager,
which lists every maneuver and lets you edit one or show it on the combat tab —
either action creates the item at that point. Until then nothing exists, and rolling
a maneuver you have never customized still works exactly as if it did.

Once an item exists it behaves like any other attack: it has the quickbar and combat
tab checkboxes, and it appears under **Combat Maneuvers** on the combat tab.

Creating a **custom** maneuver — something the module does not ship, or a variant of
one it does — works exactly like creating a custom attack. Use the `+` on the Combat
Maneuvers category.

## Targeting maneuvers from other modules

Every maneuver item is tagged with a **weapon base type** matching its name — `Trip`,
`Bull Rush`, `Dirty Trick` — and with a **weapon group**:

| Group | Maneuvers |
| --- | --- |
| **Deft Maneuvers** | Dirty Trick, Disarm, Reposition, Steal, Trip |
| **Powerful Maneuvers** | Bull Rush, Drag, Overrun, Sunder |
| *(none)* | Grapple |

Grapple is in neither group on purpose — it sits outside the deft/powerful split,
and a group of one would add nothing its `Grapple` base type does not already give
you. Its icon carries a third accent color to make that visible.

That makes them targetable by roll-bonuses' **weapon type** and **weapon group**
targets with no further setup, including the Elephant in the Room feat-tax groupings
that rely on them. If you were tagging attack items by hand to get this, you can
stop; the module keeps the tags in sync with the registry.

Tags are derived from the maneuver's id, not from its translated name, so they are
the same on every client and keep matching regardless of language.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Offer a generic maneuver | on | Adds the untyped **Generic** entry to the picker. |
| Prompt on CMB click | on | Off restores stock behavior: clicking CMB rolls immediately. |
| Keep maneuver tags in sync | on | Maintains each item's weapon type and groups. Turn off if you curate them by hand. |

## For module authors

The API lives at `game.pf1CombatManeuvers` once the `pf1CombatManeuvers.ready` hook
has fired.

```js
// Register a maneuver at init.
Hooks.once('init', () => {
  game.pf1CombatManeuvers.registry.register('my-module', 'hamstring', {
    name: 'MYMODULE.Hamstring',
    img: 'icons/svg/falling.svg',
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: ['Deft Maneuvers'],
    // baseType defaults to the id written out plainly: "Hamstring".
  });
});
```

Registering a maneuver gives you its change targets, its picker entry, its combat
tab support and its tagging automatically. Ids match PF1 v12's own maneuver registry
where one exists, so `cmb.trip` written today keeps working when the system ships
its own version.

Useful entry points:

| Call | Returns |
| --- | --- |
| `getManeuverCMB(actor, id)` | Total CMB for that maneuver. |
| `getManeuverCMD(actor, id)` | `{ total, ffTotal }` for that maneuver. |
| `findManeuverItem(actor, id)` | The materialized item, or `null`. |
| `getOrSynthesize(actor, id)` | An item to roll, materialized or temporary. |
| `materialize(actor, id)` | Creates the real item and returns it. |
| `prompt(actor, token)` | Opens the picker; resolves to the chosen option or `null`. |

## Known limitations

- **A maneuver-specific bonus and a general one of the same type will stack**, where
  the rules say they should not. A `+2 enhancement` to CMD and a `+2 enhancement` to
  CMD vs. trip come to `+4`. In practice almost nothing grants both halves of one
  bonus type.
- **Nothing resolves a maneuver for you.** The card shows your result and the
  target's applicable CMD side by side; comparing them is still the GM's job. PF1
  does not automate hit-or-miss for attacks either.
- **Grapple's branches are not modeled.** Attempting a grapple works; the states
  that follow from one — pin, move, tie up, release — are a planned phase.
- **No compendium ships.** Maneuver feats need their Change entered by hand for now.
- **Vehicles are out of scope.** They compute CMD through a separate path.

## License

[GPL-3.0](LICENSE).
