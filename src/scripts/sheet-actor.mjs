// Actor sheet: the CMB button, and the Combat Maneuvers section filter.

import { MODULE_ID, SECTION_ID } from './config.mjs';
import { maneuvers } from './registry.mjs';
import { getOrSynthesize } from './item.mjs';
import { ManeuverPrompt, ManeuverEditor } from './prompt.mjs';
import { setting } from './settings.mjs';

/** True when the clicked element is the CMB box rather than a weapon attack row. */
function isCmbTarget(event) {
  const el = event?.target;
  if (!el?.closest) return false;
  return !!el.closest('[data-attribute="cmb"]');
}

/**
 * Intercept the CMB roll.
 *
 * A renderActorSheet hook binds after PF1's own jQuery handler and so cannot
 * pre-empt it - stopImmediatePropagation from a later-bound handler does not
 * un-run an earlier one - which is why this is a wrap rather than a rebind.
 */
async function onRollAttack(wrapped, event, ...rest) {
  if (!setting('promptOnCmbClick') || !isCmbTarget(event)) return wrapped(event, ...rest);

  event.preventDefault();

  const actor = this.actor;
  if (actor?.system?.config?.noManeuvers) return;

  const token = this.token ?? this.activeToken ?? null;
  const choice = await ManeuverPrompt.open(actor, token);
  if (!choice) return;

  // A hand-made maneuver rolls its own item; it has no registry entry behind it.
  if (choice.itemId) return actor.items.get(choice.itemId)?.use({ token });

  // Generic: no maneuver id, so no cmb.<id> bonuses and plain CMD on the card.
  if (!choice.maneuver) return actor.rollAttack({ maneuver: true, token });

  const item = getOrSynthesize(actor, choice.maneuver);
  if (!item) return;

  const result = await item.use({ token });

  const entry = maneuvers.get(choice.maneuver);
  if (entry?.onUse) {
    try {
      await entry.onUse(result, choice);
    } catch (err) {
      console.error(`[pf1-combat-maneuvers] onUse failed for "${choice.maneuver}"`, err);
    }
  }

  return result;
}

/**
 * Claim maneuver items for the Combat Maneuvers section, and only when they are
 * meant to be shown.
 *
 * Because the maneuver subtype matches no stock section's filters, an unticked
 * maneuver falls through the sheet's section lookup entirely and is simply absent
 * from the tab, rather than being picked up by the weapon-like section.
 */
function applySectionFilter(wrapped, item, section) {
  if (section?.id !== SECTION_ID) return wrapped(item, section);
  if (!wrapped(item, section)) return false;
  return item.document?.system?.showInCombat !== false;
}

/** Right-click the CMB box to manage the maneuver items themselves. */
function onRenderActorSheet(app, html) {
  if (app.actor?.system?.config?.noManeuvers) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  // The summary block and the combat tab each carry their own CMB box.
  for (const box of root?.querySelectorAll('[data-attribute="cmb"]') ?? []) {
    if (box.dataset.pf1cmBound) continue;
    box.dataset.pf1cmBound = 'true';
    box.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      ManeuverEditor.open(app.actor);
    });
  }
}

export function registerActorSheet() {
  libWrapper.register(
    MODULE_ID,
    'pf1.applications.actor.ActorSheetPF.prototype._onRollAttack',
    onRollAttack,
    'MIXED'
  );

  libWrapper.register(
    MODULE_ID,
    'pf1.applications.actor.ActorSheetPF.prototype._applySectionFilter',
    applySectionFilter,
    'MIXED'
  );

  Hooks.on('renderActorSheet', onRenderActorSheet);
}
