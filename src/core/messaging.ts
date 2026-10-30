import * as mc from '@minecraft/server';

import { warnLog } from '@core/logger.js';
import { isDefined } from '@lib/guards.js';

/**
 * Sends a consistently formatted message to a player or the entire world.
 * @param message The message to send. Can include color codes.
 * @param target - The player to send the message to, or 'all' to broadcast to everyone. Defaults to a world broadcast.
 * @param options Optional parameters.
 * @param options.raw If true, sends the message without the server name prefix.
 * @param options.title An optional title to replace the default server name.
 */
export function sendMessage(
    message: string | mc.RawMessage,
    target: { sendMessage: (msg: string | mc.RawMessage) => void } | 'all' = mc.world,

    _options: { raw?: boolean; title?: string | undefined } = {}
) {
    const finalMessage = message;

    try {
        if (target === 'all') {
            mc.world.sendMessage(finalMessage);
        } else if (isDefined(target) && typeof target.sendMessage === 'function') {
            target.sendMessage(finalMessage);
        } else {
            warnLog(`[sendMessage] Invalid target provided.`);
        }
    } catch {
        // Suppress potential errors if the target player is invalid or has left.
    }
}
