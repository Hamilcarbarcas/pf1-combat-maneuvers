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

/**
 * The Combat Maneuvers section header gets a control that opens the maneuver
 * manager. The header's controls cell is only drawn for owners.
 */
function onRenderActorSheet(app, html) {
  const actor = app.actor;
  if (!actor || actor.system?.config?.noManeuvers) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  const controls = root?.querySelector(
    `.tab.combat ol.item-list[data-list="${SECTION_ID}"] > .item-list-header > .item-controls`
  );
  if (!controls || controls.querySelector('.pf1cm-manage')) return;

  const control = document.createElement('a');
  control.className = 'item-control pf1cm-manage';
  control.dataset.tooltip = 'PF1CM.Editor.Open';
  control.innerHTML = '<i class="fa-solid fa-list-check" inert></i>';
  control.addEventListener('click', (event) => {
    event.preventDefault();
    ManeuverEditor.open(actor);
  });
  controls.append(control);
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
