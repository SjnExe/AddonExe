import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

/**
 * Formats `&` color codes on a sign's front/back text when `survivalQoL.signColors.enabled` is true.
 *
 * @param event Block interaction after event.
 */
export function handleSignColorInteract(event: mc.PlayerInteractWithBlockAfterEvent): void {
  if (!getConfig().survivalQoL?.signColors?.enabled) {
    return;
  }
  const { player, block } = event;
  if (!player.isValid || !block.typeId.includes('sign')) {
    return;
  }
  mc.system.run(() => {
    try {
      const sign = block.getComponent(mc.BlockComponentTypes?.Sign) as mc.BlockSignComponent | undefined;
      if (!isDefined(sign)) {
        return;
      }
      const frontSide = mc.SignSide?.Front ?? ('Front' as mc.SignSide);
      const backSide = mc.SignSide?.Back ?? ('Back' as mc.SignSide);
      const front = sign.getText(frontSide);
      if (front && front.includes('&')) {
        sign.setText(front.replace(/&([0-9a-fk-or])/gi, '§$1'), frontSide);
      }
      const back = sign.getText(backSide);
      if (back && back.includes('&')) {
        sign.setText(back.replace(/&([0-9a-fk-or])/gi, '§$1'), backSide);
      }
    } catch {
      // Ignore unloaded or unsupported sign calls
    }
  });
}
