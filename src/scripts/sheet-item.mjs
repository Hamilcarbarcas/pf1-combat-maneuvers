// Item sheet: give maneuver items the combat-tab checkbox.
//
// PF1 gates that checkbox on a render-context boolean that lists weapon/spell/
// equipment/consumable and some feat subtypes, so attack items never get it. The
// sheet is App V1, so the context is gone by the time a hook sees the sheet - the
// label is injected into the rendered markup instead, copying the system's own
// classes so it inherits the sidebar styling. The input carries the real field
// name, so the sheet's ordinary form submission picks it up with no extra wiring.

import { getManeuverId } from './item.mjs';

function injectCombatToggle(app, html) {
  const item = app?.item ?? app?.document;
  if (!item || item.type !== 'attack' || !getManeuverId(item)) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector('.pf1cm-quick-combat')) return;

  const quickbar = root.querySelector('label.descriptor.checkbox.quickbar');
  if (!quickbar) return;

  const label = document.createElement('label');
  label.className = 'descriptor checkbox quick-combat pf1cm-quick-combat';
  label.dataset.tooltip = 'PF1.QuickCombatHint';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'system.showInCombat';
  input.checked = !!item.system.showInCombat;
  input.disabled = !item.isOwner;

  label.append(input, ` ${game.i18n.localize('PF1.QuickCombat')}`);
  quickbar.after(label);
}

export function registerItemSheet() {
  Hooks.on('renderItemSheetPF', injectCombatToggle);
}
