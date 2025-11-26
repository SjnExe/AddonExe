import * as mc from '@minecraft/server';

import { warnLog } from './logger.js';

/**
 * Sends a consistently formatted message to a player or the entire world.
 * @param message The message to send. Can include color codes.
 * @param target - The player to send the message to, or 'all' to broadcast to everyone. Defaults to a world broadcast.
 * @param options Optional parameters.
 * @param options.raw If true, sends the message without the server name prefix.
 * @param options.title An optional title to replace the default server name.
 */
export function sendMessage(
    message: string,
    target: mc.Player | 'all' | mc.World = mc.world,

    options: { raw?: boolean; title?: string | null } = {}
) {
    const finalMessage = message;

    try {
        if (target === 'all' || target === mc.world) {
            mc.world.sendMessage(finalMessage);
        } else if (target && typeof (target as mc.Player).sendMessage === 'function') {
            (target as mc.Player).sendMessage(finalMessage);
        } else {
            warnLog(`[sendMessage] Invalid target provided: ${target}`);
        }
    } catch {
        // Suppress potential errors if the target player is invalid or has left.
    }
}
