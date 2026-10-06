// The maneuver picker shown when the CMB box is clicked.
//
// Rows are not read off the registry directly: each entry is asked for the rows it
// contributes in the actor's current state, and the results are flattened. Every
// shipped maneuver returns exactly one row, so today this is indistinguishable from
// a straight map - but a state-dependent maneuver (grapple, in Phase 2) can offer a
// different set without the picker needing to know anything about it.

import { maneuvers } from './registry.mjs';
import { getManeuverCMB } from './changes.mjs';
import { findManeuverItem, getCustomManeuvers, materialize, syncActorTraits } from './item.mjs';
import { setting } from './settings.mjs';

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ''));

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);

export class ManeuverPrompt extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ['pf1cm', 'pf1cm-prompt'],
    tag: 'div',
    window: {
      title: 'PF1CM.Prompt.Title',
      icon: 'fa-solid fa-hand-fist',
      resizable: true,
      minimizable: false,
    },
    position: { width: 400, height: 'auto' },
  };

  #actor;
  #token;
  #resolve;
  #settled = false;
  #filter = '';

  constructor({ actor, token, resolve, ...options } = {}) {
    super(options);
    this.#actor = actor;
    this.#token = token;
    this.#resolve = resolve;
  }

  /**
   * Open the picker and resolve with the chosen option, or null if dismissed.
   *
   * @param {Actor} actor
   * @param {Token} [token]
   * @returns {Promise<import('./registry.mjs').ManeuverOption|null>}
   */
  static async open(actor, token) {
    return new Promise((resolve) => {
      new ManeuverPrompt({
        actor,
        token,
        resolve,
        id: `pf1cm-prompt-${actor.id}`,
      }).render(true);
    });
  }

  get title() {
    return game.i18n.format('PF1CM.Prompt.TitleFor', { name: this.#actor?.name ?? '' });
  }

  /** Generic first when enabled, then every row the registry contributes. */
  #rows() {
    const rows = [];

    if (setting('showGenericOption')) {
      rows.push({
        id: '',
        maneuver: null,
        label: game.i18n.localize('PF1CM.Generic'),
        img: 'icons/svg/combat.svg',
        hint: game.i18n.localize('PF1CM.GenericHint'),
        generic: true,
      });
    }

    for (const entry of maneuvers.all()) {
      for (const option of entry.getOptions(this.#actor, this.#token)) {
        rows.push({ ...option, generic: false });
      }
    }

    // Maneuvers made by hand with the combat tab's + button. They have no registry
    // entry, so they are rolled by item rather than by maneuver id.
    for (const item of getCustomManeuvers(this.#actor)) {
      rows.push({
        id: item.id,
        maneuver: null,
        itemId: item.id,
        label: item.name,
        img: item.img,
        generic: false,
      });
    }

    return rows.map((row) => ({
      ...row,
      mod: getManeuverCMB(this.#actor, row.maneuver),
      custom: !!row.itemId || !!(row.maneuver && findManeuverItem(this.#actor, row.maneuver)),
    }));
  }

  async _renderHTML() {
    const rows = this.#rows();
    const needle = this.#filter.trim().toLowerCase();
    const visible = needle ? rows.filter((r) => r.label.toLowerCase().includes(needle)) : rows;

    const list = visible
      .map(
        (row) => `
      <li class="pf1cm-row${row.generic ? ' pf1cm-generic' : ''}" data-option="${esc(row.id)}" data-maneuver="${esc(row.maneuver ?? '')}" data-item="${esc(row.itemId ?? '')}">
        <img class="pf1cm-icon" src="${esc(row.img)}" alt="">
        <span class="pf1cm-label">${esc(row.label)}${row.custom ? ' <i class="fa-solid fa-pen-to-square pf1cm-custom" data-tooltip="PF1CM.Prompt.Customized"></i>' : ''}</span>
        <span class="pf1cm-mod">${esc(fmt(row.mod))}</span>
      </li>`
      )
      .join('');

    return `
      <input type="text" class="pf1cm-filter" placeholder="${esc(game.i18n.localize('PF1CM.Prompt.Filter'))}" value="${esc(this.#filter)}">
      <ul class="pf1cm-list">${list || `<li class="pf1cm-empty">${esc(game.i18n.localize('PF1CM.Prompt.NoMatch'))}</li>`}</ul>
    `;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;

    const filter = content.querySelector('.pf1cm-filter');
    filter?.addEventListener('input', (ev) => {
      this.#filter = ev.currentTarget.value;
      this.render();
    });
    // Re-rendering on every keystroke blurs the box; put the caret back.
    if (this.#filter) {
      filter?.focus();
      filter?.setSelectionRange(this.#filter.length, this.#filter.length);
    }

    for (const li of content.querySelectorAll('.pf1cm-row')) {
      li.addEventListener('click', () => this.#choose(li.dataset));
    }
  }

  #choose({ option, maneuver, item }) {
    if (this.#settled) return;
    this.#settled = true;
    this.#resolve?.({ id: option, maneuver: maneuver || null, itemId: item || null });
    this.close();
  }

  async _preClose(options) {
    if (!this.#settled) {
      this.#settled = true;
      this.#resolve?.(null);
    }
    return super._preClose(options);
  }
}

/**
 * The right-click menu on the CMB box.
 *
 * Lists every registered maneuver with its materialization state, so the item for
 * one can be opened for editing, or shown on the combat tab, without hunting for it.
 */
export class ManeuverEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ['pf1cm', 'pf1cm-editor'],
    tag: 'div',
    window: {
      title: 'PF1CM.Editor.Title',
      icon: 'fa-solid fa-sliders',
      resizable: true,
      minimizable: false,
    },
    position: { width: 420, height: 'auto' },
  };

  #actor;

  constructor({ actor, ...options } = {}) {
    super(options);
    this.#actor = actor;
  }

  static async open(actor) {
    // Bring any already-created items up to date with the registry. Scoped to this
    // one actor and only to items that already exist, rather than sweeping the
    // world on load - nothing should be written to an actor nobody has touched.
    if (setting('autoSyncTraits') && actor?.isOwner) await syncActorTraits(actor);
    return new ManeuverEditor({ actor, id: `pf1cm-editor-${actor.id}` }).render(true);
  }

  get title() {
    return game.i18n.format('PF1CM.Editor.TitleFor', { name: this.#actor?.name ?? '' });
  }

  async _renderHTML() {
    const rows = maneuvers.all().map((entry) => {
      const item = findManeuverItem(this.#actor, entry.id);
      return `
      <li class="pf1cm-row" data-maneuver="${esc(entry.id)}">
        <img class="pf1cm-icon" src="${esc(entry.img)}" alt="">
        <span class="pf1cm-label">${esc(entry.label)}</span>
        <label class="pf1cm-toggle" data-tooltip="PF1CM.Editor.ShowInCombat">
          <input type="checkbox" data-action="combat" ${item?.system?.showInCombat ? 'checked' : ''}>
        </label>
        <a class="pf1cm-edit" data-action="edit" data-tooltip="PF1CM.Editor.Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </a>
      </li>`;
    });

    return `
      <p class="pf1cm-hint">${esc(game.i18n.localize('PF1CM.Editor.Hint'))}</p>
      <ul class="pf1cm-list">${rows.join('')}</ul>
    `;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;

    for (const li of content.querySelectorAll('.pf1cm-row')) {
      const id = li.dataset.maneuver;

      li.querySelector('[data-action="edit"]')?.addEventListener('click', async () => {
        const item = await materialize(this.#actor, id);
        item?.sheet.render(true);
        this.render();
      });

      li.querySelector('[data-action="combat"]')?.addEventListener('change', async (ev) => {
        const show = ev.currentTarget.checked;
        // Ticking the box is a customization, so it materializes the item.
        const item = await materialize(this.#actor, id);
        if (!item) {
          ev.currentTarget.checked = !show;
          return;
        }
        await item.update({ 'system.showInCombat': show });
        this.render();
      });
    }
  }
}
