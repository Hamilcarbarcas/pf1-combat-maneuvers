// Entry point: register the maneuver registry, the config writes, the wraps, and
// the public API.

import { MODULE_ID, registerEarlyConfig, registerChangeTargets } from './config.mjs';
import { maneuvers, registerDefaults, ManeuverOption } from './registry.mjs';
import { registerChanges, getManeuverCMB, getManeuverCMD, getManeuverNotes } from './changes.mjs';
import {
  getManeuverId,
  getManeuvers,
  findManeuverItem,
  materialize,
  synthesize,
  getOrSynthesize,
  syncTraits,
  syncActorTraits,
} from './item.mjs';
import { registerActorSheet } from './sheet-actor.mjs';
import { registerItemSheet } from './sheet-item.mjs';
import { registerChat } from './chat.mjs';
import { registerSettings, setting } from './settings.mjs';
import { ManeuverPrompt, ManeuverEditor } from './prompt.mjs';

// Everything mechanical registers at `init`.
//
// pf1.config.sheetSections has to be written before PF1's own Hooks.once("setup")
// pass, which stamps id/category/path onto every section. And the data-prep wrap
// has to be in place before any actor prepares, or the per-maneuver buckets are
// missing on the first pass.
Hooks.once('init', () => {
  registerDefaults();
  registerSettings();
  registerEarlyConfig();

  if (!game.modules.get('lib-wrapper')?.active) {
    console.error('[pf1-combat-maneuvers] libWrapper is not active. The module is disabled.');
    Hooks.once('ready', () =>
      ui.notifications.error(game.i18n.localize('PF1CM.Warning.NoLibWrapper'), { permanent: true })
    );
    return;
  }

  registerChanges();
  registerActorSheet();
  registerItemSheet();
  registerChat();
});

// Change targets interpolate maneuver names, so they wait for i18n.
Hooks.once('setup', () => {
  registerChangeTargets();
});

Hooks.once('ready', () => {
  game.pf1CombatManeuvers = {
    registry: maneuvers,
    ManeuverOption,

    // Identity and items
    getManeuverId,
    getManeuvers,
    findManeuverItem,
    materialize,
    synthesize,
    getOrSynthesize,
    syncTraits,
    syncActorTraits,

    // Numbers
    getManeuverCMB,
    getManeuverCMD,
    getManeuverNotes,

    // UI
    prompt: (actor, token) => ManeuverPrompt.open(actor, token),
    editor: (actor) => ManeuverEditor.open(actor),

    setting,
    MODULE_ID,
  };

  Hooks.callAll('pf1CombatManeuvers.ready', game.pf1CombatManeuvers);
});

// Keep a materialized item's roll-bonuses tags in step with its registry entry.
Hooks.on('createItem', (item) => {
  if (!setting('autoSyncTraits')) return;
  if (!item.actor || !getManeuverId(item)) return;
  syncTraits(item);
});
