// Settings, with a read-through cache.
//
// game.settings.get is a linear scan of every Setting document, so anything read
// per render or per change is cached here and invalidated on updateSetting.

import { MODULE_ID } from './config.mjs';

const DEFINITIONS = {
  showGenericOption: { type: Boolean, default: true },
  promptOnCmbClick: { type: Boolean, default: true },
  autoSyncTraits: { type: Boolean, default: true },
};

const cache = new Map();

export function setting(key) {
  if (cache.has(key)) return cache.get(key);
  const value = game.settings.get(MODULE_ID, key);
  cache.set(key, value);
  return value;
}

export function registerSettings() {
  for (const [key, def] of Object.entries(DEFINITIONS)) {
    game.settings.register(MODULE_ID, key, {
      name: `PF1CM.Settings.${key}.Name`,
      hint: `PF1CM.Settings.${key}.Hint`,
      scope: 'world',
      config: true,
      requiresReload: false,
      ...def,
    });
  }

  Hooks.on('updateSetting', (doc) => {
    const [namespace, key] = doc.key?.split('.') ?? [];
    if (namespace === MODULE_ID) cache.delete(key);
  });
}
