# Changelog

## Unreleased

### Added
- Initial implementation. Combat maneuvers become individually addressable: each has
  its own identity, its own bonuses, its own defense, and its own way to be rolled.
- **Maneuver registry** with the ten core maneuvers (bull rush, dirty trick, disarm,
  drag, grapple, overrun, reposition, steal, sunder, trip). Ids, icons and activation
  costs match PF1 v12's own maneuver registry, so change targets written now keep
  working when the system ships its version. Modules can register their own.
- **Per-maneuver CMB change and context-note targets** (`CMB (Trip)` and so on),
  pulled into the attack roll through the same machinery PF1 uses for melee, ranged
  and natural attack bonuses, so bonus types stack correctly.
- **Per-maneuver CMD and flat-footed CMD change targets** (`CMD vs. Trip`), stored
  as a difference from general CMD so base, BAB, Strength, size, Dexterity and
  negative levels are all included without being re-entered.
- **Maneuver picker on the CMB button.** Left-clicking CMB lists every maneuver plus
  an untyped **Generic** entry, each showing the modifier that actually applies, and
  rolls the chosen one through PF1's ordinary attack pipeline.
- **Maneuver manager on right-click.** Lists every maneuver with an edit button and a
  combat-tab toggle; either action creates the underlying item at that point.
- **Combat Maneuvers category on the combat tab**, with the same `+` create button
  the other attack categories have, so custom maneuvers are made the same way custom
  attacks are.
- **Combat-tab checkbox on maneuver items**, which PF1 does not offer for attack
  items, alongside the quickbar checkbox it already supports.
- **Attack cards show the applicable defense.** A maneuver attack against a target
  with a maneuver-specific CMD shows that number rather than their general CMD.
- **Automatic roll-bonuses tagging.** Maneuver items carry a weapon base type named
  after the maneuver (`Trip`, `Bull Rush`) and a **Deft Maneuvers** or **Powerful
  Maneuvers** weapon group, making them targetable by roll-bonuses' weapon-type and
  weapon-group bonuses with no setup. Tags derive from the maneuver's id rather than
  its translated name, so they match on every client.
- Settings for the generic entry, whether CMB prompts at all, and whether tags are
  kept in sync.
- API at `game.pf1CombatManeuvers`, with a `pf1CombatManeuvers.ready` hook.

### Fixed
- The module ships its own icon set rather than borrowing the system's. Six of the
  ten maneuvers had no icon at all on PF1 v11 — that art only exists in v12 — and
  every available substitute was a white glyph on transparency, invisible against a
  light sheet. The shipped icons are white on near-black, with a border tinted by
  weapon group so Deft, Powerful and ungrouped maneuvers are separable at a glance.

### Notes
- Nothing is written to an actor until a maneuver is deliberately customized, so
  there is no installed state and nothing to clean up on uninstall.
- Requires libWrapper. Four wraps, all of which chain.
