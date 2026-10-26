// Shared identifiers and the writes this mod makes into pf1.config.
//
// The writes are split across two hooks for two different reasons.
//
// `init`: pf1.config.sheetSections must be populated before PF1's own
// Hooks.once("setup") loop, which stamps id/category/path onto every section and
// localizes its label. A section added after that loop is missing all of it.
//
// `setup`: game.i18n is empty during init, and the change-target labels interpolate
// a maneuver name, so they cannot be static keys. They are localized here and
// passed through as plain strings - localize() returns a non-key unchanged, so a
// second pass by the target picker is harmless.

import { maneuvers } from './registry.mjs';

export const MODULE_ID = 'pf1-combat-maneuvers';

/** Item flag holding the maneuver id. The only durable state this mod writes. */
export const MANEUVER_FLAG = 'maneuver';

/** New attack subtype. Matches no stock combat-tab section, which is the point. */
export const SUBTYPE = 'maneuver';

/** Key of the combat-tab section, and of the change/note category. */
export const SECTION_ID = 'combatManeuver';

/** Root of the per-maneuver CMD deltas, relative to actor `system`. */
export const CMD_PATH = 'attributes.cmd.maneuvers';

/** Sort bases, slotting our targets immediately after PF1's generic cmb/cmd/ffcmd. */
const SORT = { cmb: 150_500, cmd: 151_500, ffcmd: 152_500 };

/** Register the attack subtype and the combat-tab section. Runs at `init`. */
export function registerEarlyConfig() {
  const cfg = pf1.config;

  cfg.attackTypes[SUBTYPE] = 'PF1.Subtypes.Item.attack.maneuver.Single';

  // _prepareItems iterates this object and _onItemCreate reads `create` straight
  // out of it, so this single write buys the section, its header and its + button.
  cfg.sheetSections.combat[SECTION_ID] = {
    label: 'PF1CM.Section',
    filters: [{ type: 'attack', subTypes: [SUBTYPE] }],
    interface: { create: true },
    create: { type: 'attack', system: { subType: SUBTYPE } },
    // Between the stock natural attacks (2_000) and class features (3_000) sections.
    sort: 2_500,
  };
}

/** Register one change and note target per maneuver. Runs at `setup`. */
export function registerChangeTargets() {
  const cfg = pf1.config;
  const section = game.i18n.localize('PF1CM.Section');

  // getBuffTargetDictionary reads categories[category].label without guarding, so
  // the category has to exist before any target claims it.
  cfg.buffTargetCategories[SECTION_ID] = { label: section };
  cfg.contextNoteCategories[SECTION_ID] = { label: section };

  maneuvers.all().forEach((entry, index) => {
    const maneuver = entry.label;

    const cmb = game.i18n.format('PF1CM.Target.CMB', { maneuver });
    const cmd = game.i18n.format('PF1CM.Target.CMD', { maneuver });
    const ffcmd = game.i18n.format('PF1CM.Target.FFCMD', { maneuver });

    cfg.buffTargets[`cmb.${entry.id}`] = { label: cmb, category: SECTION_ID, sort: SORT.cmb + index };
    cfg.buffTargets[`cmd.${entry.id}`] = { label: cmd, category: SECTION_ID, sort: SORT.cmd + index };
    cfg.buffTargets[`ffcmd.${entry.id}`] = { label: ffcmd, category: SECTION_ID, sort: SORT.ffcmd + index };

    cfg.contextNoteTargets[`cmb.${entry.id}`] = { label: cmb, category: SECTION_ID };
    cfg.contextNoteTargets[`cmd.${entry.id}`] = { label: cmd, category: SECTION_ID };
  });
}
