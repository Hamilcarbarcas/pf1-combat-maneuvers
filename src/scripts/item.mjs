// Maneuver identity, lookup, materialization and trait sync.
//
// Actors start with no maneuver items at all. Rolling an unmaterialized maneuver
// builds a throwaway item parented to the actor - the same trick ActorPF#rollAttack
// already uses - so bonuses, defenses and roll-bonuses targeting all behave exactly
// as they would for a real one. A real item is created only when the user
// deliberately customizes something, which is also why there is nothing to migrate
// between versions and nothing to clean up on uninstall.

import { MODULE_ID, MANEUVER_FLAG, SUBTYPE } from './config.mjs';
import { maneuvers } from './registry.mjs';

/** Maneuver id carried by an item, or null. */
export function getManeuverId(item) {
  return item?.getFlag?.(MODULE_ID, MANEUVER_FLAG) ?? null;
}

/** Is this item a maneuver of any kind, registered or hand-made? */
export function isManeuverItem(item) {
  return item?.type === 'attack' && item.system?.subType === SUBTYPE;
}

/**
 * Every maneuver item on an actor.
 *
 * Keyed on the subtype rather than the flag, so hand-made maneuvers created with
 * the combat tab's + button count too. This is the handle later features filter on.
 */
export function getManeuvers(actor) {
  if (!actor) return [];
  return actor.items.filter((i) => isManeuverItem(i));
}

/** Maneuver items with no registry entry behind them - user-made one-offs. */
export function getCustomManeuvers(actor) {
  return getManeuvers(actor).filter((i) => !getManeuverId(i));
}

/** The materialized item for one maneuver, if the actor has one. */
export function findManeuverItem(actor, id) {
  if (!actor || !id) return null;
  return actor.items.find((i) => i.type === 'attack' && getManeuverId(i) === id) ?? null;
}

/** Attack ability for a maneuver: the entry's override, else the actor's CMB ability. */
function attackAbility(actor, entry) {
  return entry.ability || actor?.system?.attributes?.cmbAbility || 'str';
}

/** The single action a maneuver item carries. */
function buildAction(actor, entry) {
  const data = {
    name: entry.label,
    actionType: entry.actionType,
    ability: { attack: attackAbility(actor, entry) },
    activation: foundry.utils.deepClone(entry.activation),
  };
  return new pf1.components.ItemAction(data).toObject();
}

/** Full item data for a maneuver, used for both synthesis and creation. */
export function buildManeuverData(actor, entry) {
  return {
    name: entry.label,
    type: 'attack',
    img: entry.img,
    system: {
      subType: SUBTYPE,
      // These two are what roll-bonuses matches on. _prepareTraits sorts anything
      // absent from pf1.config.weaponGroups into the custom set, so the invented
      // group names work without registering them anywhere.
      baseTypes: entry.baseType ? [entry.baseType] : [],
      weaponGroups: [...entry.weaponGroups],
      proficient: true,
      showInQuickbar: false,
      showInCombat: false,
      actions: [buildAction(actor, entry)],
    },
    flags: { [MODULE_ID]: { [MANEUVER_FLAG]: entry.id } },
  };
}

/** A temporary, unsaved maneuver item parented to the actor. */
export function synthesize(actor, id) {
  const entry = maneuvers.get(id);
  if (!entry) return null;
  return new Item.implementation(buildManeuverData(actor, entry), { parent: actor });
}

/** Create the real embedded item for a maneuver, or return the existing one. */
export async function materialize(actor, id) {
  const existing = findManeuverItem(actor, id);
  if (existing) return existing;

  const entry = maneuvers.get(id);
  if (!entry) return null;
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.format('PF1CM.Warning.NoPermission', { name: actor.name }));
    return null;
  }

  const created = await actor.createEmbeddedDocuments('Item', [buildManeuverData(actor, entry)]);
  return created?.[0] ?? null;
}

/**
 * The item to roll for a maneuver: the real one if it exists, else a throwaway.
 *
 * Both carry the flag, the base type and the weapon groups, so §4, §5 and §9 of the
 * design behave identically either way.
 */
export function getOrSynthesize(actor, id) {
  return findManeuverItem(actor, id) ?? synthesize(actor, id);
}

/** Tag spellings this module wrote before the readable ones, cleared on sync. */
const LEGACY_GROUPS = ['deftManeuvers', 'powerfulManeuvers'];
const legacyBaseType = (id) => `cm_${id}`;

/**
 * Every weapon group this module hands out, across all registered maneuvers.
 *
 * A group in this set but absent from an entry's own list is a stale assignment and
 * gets cleared - otherwise a maneuver that moves between groups, or leaves them
 * entirely, would accumulate both. Groups outside the set were added by the user
 * and are never touched.
 */
function managedGroups() {
  const set = new Set(LEGACY_GROUPS);
  for (const entry of maneuvers) for (const group of entry.weaponGroups) set.add(group);
  return set;
}

/**
 * Images this module assigned before it shipped its own.
 *
 * An image is something a user personalizes, so it is only replaced when the
 * current one is a path this module is known to have written - the same rule the
 * tag pruning follows.
 */
const LEGACY_IMAGES = new Set([
  'icons/svg/direction.svg',
  'icons/svg/blind.svg',
  'icons/svg/sword.svg',
  'icons/svg/thrust.svg',
  'icons/svg/upgrade.svg',
  'icons/svg/falling.svg',
  'systems/pf1/icons/conditions/grappled.svg',
  'systems/pf1/icons/actions/divert.svg',
  'systems/pf1/icons/actions/hand.svg',
  'systems/pf1/icons/actions/battle-gear.svg',
]);

const isLegacyImage = (img) =>
  LEGACY_IMAGES.has(img) || String(img).startsWith('systems/pf1/icons/combat-maneuvers/');

const sameTags = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Bring a materialized item's tags back in line with its registry entry.
 *
 * Only touches the two trait arrays, and only when they actually differ, so a user
 * editing anything else on the item is never fought with. Tags this module used to
 * write are dropped; anything else the user added by hand is left alone, since
 * there is no way to tell a deliberate tag from a stale one.
 */
export async function syncTraits(item) {
  const id = getManeuverId(item);
  const entry = id ? maneuvers.get(id) : null;
  if (!entry || !item.isOwner) return false;

  const update = {};

  const baseTypes = (item.system.baseTypes ?? []).filter((t) => t !== legacyBaseType(id));
  if (entry.baseType && !baseTypes.includes(entry.baseType)) baseTypes.push(entry.baseType);
  if (!sameTags(baseTypes, item.system.baseTypes ?? [])) update['system.baseTypes'] = baseTypes;

  // system.weaponGroups is an array in source but a trait object after preparation.
  const source = item._source.system.weaponGroups ?? [];
  const managed = managedGroups();
  const groups = source.filter((g) => !managed.has(g));
  for (const g of entry.weaponGroups) if (!groups.includes(g)) groups.push(g);
  if (!sameTags(groups, source)) update['system.weaponGroups'] = groups;

  if (entry.img && item.img !== entry.img && isLegacyImage(item.img)) update.img = entry.img;

  if (foundry.utils.isEmpty(update)) return false;
  await item.update(update);
  return true;
}

/** Sync every materialized maneuver on an actor. */
export async function syncActorTraits(actor) {
  let changed = false;
  for (const item of getManeuvers(actor)) {
    if (await syncTraits(item)) changed = true;
  }
  return changed;
}
