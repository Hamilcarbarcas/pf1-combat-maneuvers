// The maneuver registry.
//
// Ids, activation costs and icons match PF1 v12's own pf1.registry.actions.maneuver
// so that change targets written now (cmb.trip and so on) keep working after the
// system catches up. `resolveOptions` and `onUse` are additions: both are inert for
// every shipped entry and exist so grapple automation can be added without
// reshaping the registry or the prompt.

// Icons are the module's own. Borrowing them from the system was tried first and
// abandoned twice over: six of the ten only exist in PF1 v12, and every candidate -
// system or Foundry core - is a white glyph on transparency, which disappears
// against a light sheet. These are dark-backed so they read on any background, and
// the border is tinted by weapon group so the two groups are separable at a glance.
import { MANEUVER_TEXT } from './maneuver-text.mjs';

const ICONS = 'modules/pf1-combat-maneuvers/src/assets/icons';

const icon = (name) => `${ICONS}/${name}.svg`;

/** Weapon groups the shipped maneuvers are sorted into, for group-wide bonuses. */
export const GROUP_POWERFUL = 'Powerful Maneuvers';
export const GROUP_DEFT = 'Deft Maneuvers';

/**
 * Default weapon base type for a maneuver: its name, plainly written.
 *
 * Derived from the id rather than from the localized label on purpose. These tags
 * are *data* stored on the item and matched by exact string, so they have to be the
 * same on every client - a localized tag would silently stop matching the moment
 * someone played in another language.
 */
export function titleize(id) {
  return String(id)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** v12's table, plus this mod's tagging and behavior fields. */
const DEFAULTS = {
  bullRush: {
    img: icon('bull-rush'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_POWERFUL],
  },
  dirtyTrick: {
    img: icon('dirty-trick'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_DEFT],
  },
  disarm: {
    img: icon('disarm'),
    activation: { type: 'attack', unchained: { type: 'attack' } },
    weaponGroups: [GROUP_DEFT],
  },
  drag: {
    img: icon('drag'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_POWERFUL],
  },
  grapple: {
    img: icon('grapple'),
    // v12 marks this special because the real cost depends on which branch of the
    // grapple is being used. Phase 2 resolves that; until then it stays special.
    activation: { cost: 1, type: 'special', unchained: { cost: 1, type: 'special' } },
    // Deliberately in neither group. Grapple stands apart from the deft/powerful
    // split, and a group of one would add nothing the `Grapple` base type does not
    // already give you.
    weaponGroups: [],
  },
  overrun: {
    img: icon('overrun'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_POWERFUL],
  },
  reposition: {
    img: icon('reposition'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_DEFT],
  },
  steal: {
    img: icon('steal'),
    activation: { type: 'standard', unchained: { cost: 2, type: 'action' } },
    weaponGroups: [GROUP_DEFT],
  },
  sunder: {
    img: icon('sunder'),
    activation: { type: 'attack', unchained: { type: 'attack' } },
    weaponGroups: [GROUP_POWERFUL],
  },
  trip: {
    img: icon('trip'),
    activation: { type: 'attack', unchained: { type: 'attack' } },
    weaponGroups: [GROUP_DEFT],
  },
};

// A maneuver id becomes a key under system.attributes.cmb, so it must not collide
// with PF1's own fields there.
const RESERVED_IDS = ['total', 'value', 'bonus'];

/** One row the prompt can offer. */
export class ManeuverOption {
  constructor({ id, maneuver, label, img, hint }) {
    this.id = id;
    this.maneuver = maneuver;
    this.label = label;
    this.img = img;
    this.hint = hint ?? '';
  }
}

/** A registered maneuver. Every field but `id` has a usable default. */
export class ManeuverEntry {
  constructor(id, data = {}, namespace = 'pf1-combat-maneuvers') {
    this.id = id;
    this.namespace = namespace;
    this.name = data.name ?? `PF1CM.Maneuvers.${id}`;
    this.img = data.img ?? 'icons/svg/sword.svg';
    this.journal = data.journal ?? null;
    this.activation = foundry.utils.deepClone(data.activation ?? { type: 'standard' });
    this.actionType = data.actionType ?? 'mcman';
    this.ability = data.ability ?? null;
    this.baseType = data.baseType ?? titleize(id);
    this.weaponGroups = [...(data.weaponGroups ?? [])];
    this.description = data.description ?? '';
    this.notes = {
      effect: [...(data.notes?.effect ?? [])],
      footer: [...(data.notes?.footer ?? [])],
    };
    this.resolveOptions = data.resolveOptions ?? null;
    this.onUse = data.onUse ?? null;
  }

  get label() {
    return game.i18n.localize(this.name);
  }

  /**
   * Rows this maneuver contributes to the prompt in the actor's current state.
   *
   * Defaults to one row — the maneuver itself — which is what every shipped entry
   * does. A state-dependent maneuver overrides this to offer a different set.
   *
   * @param {Actor} actor
   * @param {Token} [token]
   * @returns {ManeuverOption[]}
   */
  getOptions(actor, token) {
    if (this.resolveOptions) {
      try {
        const rows = this.resolveOptions(actor, token) ?? [];
        if (rows.length) return rows.map((r) => new ManeuverOption({ maneuver: this.id, ...r }));
      } catch (err) {
        console.error(`[pf1-combat-maneuvers] resolveOptions failed for "${this.id}"`, err);
      }
    }
    return [new ManeuverOption({ id: this.id, maneuver: this.id, label: this.label, img: this.img })];
  }
}

class ManeuverRegistry {
  #entries = new Map();

  /**
   * @param {string} namespace - Registering module id, for traceability.
   * @param {string} id - Maneuver id. Reuse v12's ids where one exists.
   * @param {object} data - Entry data; see ManeuverEntry.
   */
  register(namespace, id, data = {}) {
    if (!namespace) throw new Error('A namespace is required to register a maneuver.');
    if (!id) throw new Error('A maneuver id is required.');
    if (RESERVED_IDS.includes(id)) {
      console.error(`[pf1-combat-maneuvers] "${id}" is a reserved maneuver id; ignoring "${namespace}".`);
      return null;
    }
    if (this.#entries.has(id)) {
      console.error(`[pf1-combat-maneuvers] Maneuver "${id}" is already registered; ignoring "${namespace}".`);
      return this.#entries.get(id);
    }
    const entry = new ManeuverEntry(id, data, namespace);
    this.#entries.set(id, entry);
    return entry;
  }

  unregister(namespace, id) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    if (entry.namespace !== namespace) {
      console.error(`[pf1-combat-maneuvers] "${namespace}" cannot unregister "${id}" owned by "${entry.namespace}".`);
      return false;
    }
    return this.#entries.delete(id);
  }

  get(id) {
    return this.#entries.get(id) ?? null;
  }

  has(id) {
    return this.#entries.has(id);
  }

  get size() {
    return this.#entries.size;
  }

  get ids() {
    return [...this.#entries.keys()];
  }

  /** Entries in display order. */
  all({ sort = true } = {}) {
    const list = [...this.#entries.values()];
    if (!sort) return list;
    const collator = new Intl.Collator(game.i18n?.lang ?? 'en');
    return list.sort((a, b) => collator.compare(a.label, b.label));
  }

  forEach(fn) {
    this.all().forEach(fn);
  }

  [Symbol.iterator]() {
    return this.#entries.values();
  }
}

export const maneuvers = new ManeuverRegistry();

/** Register the ten core maneuvers. Called at `init`, before consumers register. */
export function registerDefaults() {
  for (const [id, data] of Object.entries(DEFAULTS)) {
    maneuvers.register('pf1-combat-maneuvers', id, { ...MANEUVER_TEXT[id], ...data });
  }
}
