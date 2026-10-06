// Attack card: show the defense that actually applies.
//
// PF1's target row already swaps AC for CMD when the action is a maneuver, but it
// prints generic CMD. The message is stamped with the maneuver at use time, and the
// row's values are rewritten per target afterwards. Overriding the system partial
// globally is rejected - it would affect cards this mod has nothing to do with.

import { MODULE_ID, MANEUVER_FLAG } from './config.mjs';
import { maneuvers } from './registry.mjs';
import { getManeuverId } from './item.mjs';
import { getManeuverCMD } from './changes.mjs';

/**
 * Stamp the maneuver onto the outgoing message.
 *
 * pf1PreDisplayActionUse is the right seam: shared.chatData is fully assembled by
 * then, whereas pf1PreActionUse fires before getMessageData replaces it wholesale.
 */
function onPreDisplayActionUse(actionUse) {
  const id = getManeuverId(actionUse?.item);
  if (!id) return;
  actionUse.shared.chatData[`flags.${MODULE_ID}.${MANEUVER_FLAG}`] = id;
}

function onRenderMessage(message, html) {
  const id = message?.getFlag?.(MODULE_ID, MANEUVER_FLAG);
  if (!id || !maneuvers.has(id)) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  const targets = root?.querySelectorAll?.('.attack-targets .target');
  if (!targets?.length) return;

  const label = maneuvers.get(id).label;

  for (const target of targets) {
    // Little Helper and friends rewrite neighboring subtrees; bail on anything
    // that does not look like the markup we expect rather than throwing.
    const block = target.querySelector('.cmd');
    if (!block) continue;

    const uuid = target.dataset.uuid;
    if (!uuid) continue;

    const actor = fromUuidSync(uuid)?.actor;
    if (!actor) continue;

    const { total, ffTotal } = getManeuverCMD(actor, id);

    const normal = block.querySelector('.normal .value');
    const flatFooted = block.querySelector('.flatFooted .value');
    if (normal) normal.textContent = String(total);
    if (flatFooted) flatFooted.textContent = String(ffTotal);

    // Say which defense is on screen, so a maneuver-specific number is not
    // mistaken for the target's general CMD.
    block.classList.add('pf1cm-cmd');
    block.dataset.tooltip = game.i18n.format('PF1CM.Card.CMDvs', { maneuver: label });
  }
}

export function registerChat() {
  Hooks.on('pf1PreDisplayActionUse', onPreDisplayActionUse);
  Hooks.on('renderChatMessageHTML', onRenderMessage);
}
