import { hasPermission } from '@core/permissions/permissionEngine.js';
import * as mc from '@minecraft/server';
import {
  ActionFormData,
  ActionFormResponse,
  FormCancelationReason,
  MessageFormData,
  MessageFormResponse,
  ModalFormData,
  ModalFormResponse,
} from '@minecraft/server-ui';

function isPlayerInvalid(player: mc.Player): boolean {
  return (player as { isValid?: boolean }).isValid === false;
}

/**
 * Returns an appropriate icon based on the player's permission level.
 *
 * @param player The player to evaluate.
 * @returns The path to the texture icon.
 */
export function getPlayerIcon(player: mc.Player): string {
  if (hasPermission(player, 'group.mod')) {
    return 'textures/ui/permissions_op_crown';
  }
  return 'textures/ui/permissions_member_star.png';
}

/**
 * Shows a form to a player, automatically retrying with 1-tick polling if the client is momentarily UserBusy (e.g.
 * during the 1-3 tick slash-command chat close animation or multiplayer board refresh).
 */
export async function uiWait(
  player: mc.Player,
  form: ActionFormData | ModalFormData | MessageFormData,
): Promise<ActionFormResponse | ModalFormResponse | MessageFormResponse> {
  if (isPlayerInvalid(player)) {
    return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
  }

  const firstAttempt = await form.show(player);
  if (firstAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
    return firstAttempt;
  }

  for (let retry = 0; retry < 100; retry++) {
    if (isPlayerInvalid(player)) {
      break;
    }

    const delay = retry < 15 ? 1 : 5;
    if (mc.system && typeof mc.system.waitTicks === 'function') {
      await mc.system.waitTicks(delay);
    } else if (mc.system && typeof mc.system.runTimeout === 'function') {
      await new Promise<void>((resolve) => mc.system.runTimeout(resolve, delay));
    } else {
      break;
    }

    if (isPlayerInvalid(player)) {
      break;
    }

    const attempt = await form.show(player);
    if (attempt.cancelationReason !== FormCancelationReason.UserBusy) {
      return attempt;
    }

    if (retry === 15) {
      player.sendMessage('§eOpening UI... please close chat or inventory to view.§r');
    }
  }

  return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
}

/**
 * Determines the color for the countdown timer based on remaining seconds.
 *
 * @param secondsRemaining
 * @returns The Minecraft color code.
 */
export function getCountdownColor(secondsRemaining: number): string {
  if (secondsRemaining <= 1) {
    return '§4';
  } // Dark Red
  if (secondsRemaining <= 3) {
    return '§c';
  } // Red
  if (secondsRemaining <= 5) {
    return '§6';
  } // Gold
  if (secondsRemaining <= 10) {
    return '§e';
  } // Yellow
  return '§a'; // Green
}

/** Plays the click sound for UI interactions. This is a standard feedback sound for the addon. */
export function playClickSound(player: mc.Player): void {
  if (!isPlayerInvalid(player)) {
    player.playSound('random.click', { pitch: 1, volume: 1 });
  }
}
