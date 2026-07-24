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
        if (!player.isValid) return;

        // Toggle permissions to force close UI/Chat
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, false);
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, false);

        // Small delay to let client process the state change
        await new Promise<void>((resolve) => mc.system.runTimeout(() => resolve(), 2));

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (player.isValid) {
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, true);
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, true);
        }
    } catch {
        // Ignore errors (e.g. cheats not enabled, or permissions issue)
    }
}

/**
 * Shows a form to a player, handling the 'UserBusy' case by sending a one-time message and then retrying.
 * @param player The player to show the form to.
 * @param form The form to show.
 * @returns A promise that resolves with the form response, or undefined if it times out or is cancelled for other reasons.
 */
export async function uiWait(player: mc.Player, form: ActionFormData | ModalFormData | MessageFormData): Promise<ActionFormResponse | ModalFormResponse | MessageFormResponse> {
    const firstAttempt = await form.show(player);
    if (firstAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return firstAttempt;
    }

    // Attempt to force close chat if busy
    await forceCloseChat(player);

    const secondAttempt = await form.show(player);
    if (secondAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
        return secondAttempt;
    }

    // If still busy, send the message and start retrying loop.
    player.sendMessage('§eOpening UI... please close chat to view.§r');

    const startTick = mc.system.currentTick;
    while (mc.system.currentTick - startTick < 1200) {
        // 1 minute timeout
        const subsequentAttempt = await form.show(player);
        if (subsequentAttempt.cancelationReason !== FormCancelationReason.UserBusy) {
            return subsequentAttempt;
        }

        // Add a delay to prevent tight loop and allow the client to process the close chat action
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 10));
    }

    return { canceled: true, cancelationReason: FormCancelationReason.UserClosed } satisfies ActionFormResponse; // Timeout
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
