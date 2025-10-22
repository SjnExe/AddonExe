import { world } from '@minecraft/server';
import { getConfig } from './configManager.js';
import { warnLog } from './logger.js';

/**
 * Sends a consistently formatted message to a player or the entire world.
 * @param {string} message The message to send. Can include color codes.
 * @param {import('@minecraft/server').Player | 'all'} [target=world] - The player to send the message to, or 'all' to broadcast to everyone. Defaults to a world broadcast.
 * @param {object} [options={}] Optional parameters.
 * @param {boolean} [options.raw=false] If true, sends the message without the server name prefix.
 * @param {string} [options.title=null] An optional title to replace the default server name.
 */
export function sendMessage(message, target = world, options = {}) {
    const { raw = false, title = null } = options;
    const serverName = title ?? getConfig()?.serverName ?? 'Server';
    const finalMessage = raw ? message : `${serverName} §8»§r ${message}`;

    try {
        if (target === 'all' || target === world) {
            world.sendMessage(finalMessage);
        } else if (target && typeof target.sendMessage === 'function') {
            target.sendMessage(finalMessage);
        } else {
            warnLog(`[sendMessage] Invalid target provided: ${target}`);
        }
    } catch {
        // Suppress potential errors if the target player is invalid or has left.
    }
}
