import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, FormCancelationReason, MessageFormData, MessageFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

/**
 * Returns an appropriate icon based on the player's permission level.
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
 * Forces the chat window to close by briefly toggling input permissions.
 * This is a known workaround for Bedrock UI behavior.
 */
export async function forceCloseChat(player: mc.Player): Promise<void> {
    try {
        if (!player.isValid) {
            return;
        }

        // Toggle input permissions briefly to clear chat HUD lock
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, false);
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, false);

        if (mc.system?.runTimeout) {
            await new Promise<void>((resolve) => mc.system.runTimeout(() => resolve(), 2));
        }

        if (player.isValid) {
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, true);
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, true);
        }
    } catch {
        // Ignore errors (e.g. input permissions disabled or client unready)
    }
}

/**
 * Shows a form to a player, handling 'UserBusy' cancelations by automatically retrying.
 * @param player The player to show the form to.
 * @param form The form instance to show.
 * @returns A promise that resolves with the form response.
 */
export async function uiWait(player: mc.Player, form: ActionFormData | ModalFormData | MessageFormData): Promise<ActionFormResponse | ModalFormResponse | MessageFormResponse> {
    if (!player.isValid) {
        return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
    }

    const firstAttempt = await form.show(player);
    if (firstAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return firstAttempt;
    }

    // Attempt to dismiss chat lock
    await forceCloseChat(player);

    if (!player.isValid) {
        return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
    }

    const secondAttempt = await form.show(player);
    if (secondAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return secondAttempt;
    }

    // Notify player if chat/container is still keeping client busy
    player.sendMessage('§eOpening UI... please close chat or inventory to view.§r');

    const startTick = mc.system?.currentTick ?? 0;
    while (mc.system ? mc.system.currentTick - startTick < 1200 : false) {
        if (!player.isValid) {
            break;
        }

        const subsequentAttempt = await form.show(player);
        if (subsequentAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
            return subsequentAttempt;
        }

        if (mc.system?.runTimeout) {
            await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 10));
        } else {
            break;
        }
    }

    return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse;
}

/**
 * Determines the color for the countdown timer based on remaining seconds.
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

/**
 * Plays the click sound for UI interactions.
 * This is a standard feedback sound for the addon.
 */
export function playClickSound(player: mc.Player): void {
    if (player.isValid) {
        player.playSound('random.click', { pitch: 1, volume: 1 });
    }
}
