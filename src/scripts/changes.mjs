// Per-maneuver CMB and CMD.
//
// CMB rides PF1's existing context-change machinery: `cmb.<id>` is pulled into the
// attack roll through getContextStack, exactly as v12 does it, and also lands in a
// flat `attributes.cmb.<id>` bucket that PF1's own stacking rules fill for us.
//
// CMD is stored as a *delta from generic CMD*, never as a standalone total. v11
// assembles CMD from three unlike places: a seeded 10 in _resetInherentTotals, a
// pile of `cmd`-targeted changes, and a direct mutation for Dex inside
// prepareSpecificDerivedData - which runs *after* applyChanges. Storing a delta
// means none of that needs mirroring: base, BAB, Str, energy drain, size and Dex
// are all already inside cmd.total by the time anything reads a maneuver's value,
// and the totals below are live getters, so the ordering cannot bite.

import { MODULE_ID, MANEUVER_FLAG, CMD_PATH } from './config.mjs';
import { maneuvers } from './registry.mjs';

/** Bonus types that PF1 applies to normal CMD only, never to flat-footed. */
const NORMAL_ONLY = ['dodge', 'haste'];

/**
 * Map this mod's change targets onto actor data paths.
 *
 * Mirrors PF1's own dodge/haste carve-out for CMD: a `cmd` change writes both the
 * normal and flat-footed values unless it is dodge or haste, and `ffcmd` writes
 * only the flat-footed one.
 */
function onGetChangeFlat(result, target, modifierType, value, actor) {
  if (typeof target !== 'string') return;
  const sep = target.indexOf('.');
  if (sep < 0) return;

  const key = target.slice(0, sep);
  const id = target.slice(sep + 1);
  if (!maneuvers.has(id)) return;

  switch (key) {
    case 'cmb':
      result.push(`system.attributes.cmb.${id}`);
      break;
    case 'cmd':
      result.push(`system.${CMD_PATH}.${id}.delta`);
      if (!NORMAL_ONLY.includes(modifierType)) result.push(`system.${CMD_PATH}.${id}.ffDelta`);
      break;
    case 'ffcmd':
      result.push(`system.${CMD_PATH}.${id}.ffDelta`);
      break;
  }
}

/**
 * Seed the per-maneuver buckets and define the live total getters.
 *
 * Wraps _resetInherentTotals rather than _getInherentTotalsKeys so the seeding and
 * the getter definition happen together: PF1 rebuilds `system` from source on every
 * prepareData, so the getters have to be re-attached each pass anyway.
 */
function resetInherentTotals(wrapped, ...args) {
  const result = wrapped(...args);

  const system = this.system;
  const cmd = system?.attributes?.cmd;
  // Vehicles compute CMD through their own path and are out of scope.
  if (!cmd || this.type === 'vehicle') return result;

  system.attributes.cmb ??= {};
  const root = (system.attributes.cmd.maneuvers = {});

  for (const entry of maneuvers) {
    const id = entry.id;

    // Flat display bucket for cmb.<id>; PF1's change application fills it with
    // correct typed stacking once changeOverrides exist for the path.
    system.attributes.cmb[id] = 0;

    const node = { delta: 0, ffDelta: 0 };
    // Enumerable so the values reach roll data through getRollData's deep clone,
    // which is the point of having them. That makes them visible to anything
    // walking actor data, though - and a getter-only property throws the moment
    // something assigns to it, which mergeObject onto a subtree of `system` does
    // routinely in this ecosystem. The no-op setters absorb that: these are
    // derived from cmd.total plus the delta, so a write to them is meaningless
    // and the delta is the thing that was always meant to be written.
    Object.defineProperties(node, {
      total: {
        get: () => (cmd.total ?? 0) + node.delta,
        set: () => {},
        enumerable: true,
        configurable: true,
      },
      ffTotal: {
        get: () => (cmd.flatFootedTotal ?? 0) + node.ffDelta,
        set: () => {},
        enumerable: true,
        configurable: true,
      },
    });
    root[id] = node;
  }

  return result;
}

/**
 * Pull `cmb.<id>` bonuses into the attack roll for a maneuver item.
 *
 * getContextStack is a plain method with identical source in v11 and v12, and
 * nothing else wraps it. On v12 this becomes a redundant Set.add of a string the
 * system already put there, so it is safe to leave in place through the migration.
 */
function getContextStack(wrapped, contexts) {
  const result = wrapped(contexts);
  if (!result.has('cmb')) return result;

  const id = this.getFlag(MODULE_ID, MANEUVER_FLAG);
  if (id && maneuvers.has(id)) result.add(`cmb.${id}`);

  return result;
}

/** Context notes registered against `cmb.<id>`, for the attack card footer. */
export async function getManeuverNotes(actor, id, rollData) {
  if (!actor || !id) return [];
  return (await actor.getContextNotesParsed(`cmb.${id}`, { rollData })) ?? [];
}

/** Generic CMB plus this maneuver's own bonuses, as PF1 stacked them. */
export function getManeuverCMB(actor, id) {
  const attributes = actor?.system?.attributes;
  if (!attributes) return 0;
  const base = attributes.cmb?.total ?? 0;
  if (!id) return base;
  return base + (attributes.cmb?.[id] ?? 0);
}

/** This maneuver's CMD and flat-footed CMD, falling back to generic. */
export function getManeuverCMD(actor, id) {
  const cmd = actor?.system?.attributes?.cmd;
  if (!cmd) return { total: 0, ffTotal: 0 };
  const node = id ? cmd.maneuvers?.[id] : null;
  return {
    total: node?.total ?? cmd.total ?? 0,
    ffTotal: node?.ffTotal ?? cmd.flatFootedTotal ?? 0,
  };
}

export function registerChanges() {
  Hooks.on('pf1GetChangeFlat', onGetChangeFlat);

  libWrapper.register(
    MODULE_ID,
    'pf1.documents.actor.ActorPF.prototype._resetInherentTotals',
    resetInherentTotals,
    'WRAPPER'
  );

  libWrapper.register(
    MODULE_ID,
    'pf1.documents.item.ItemPF.prototype.getContextStack',
    getContextStack,
    'WRAPPER'
  );
}
