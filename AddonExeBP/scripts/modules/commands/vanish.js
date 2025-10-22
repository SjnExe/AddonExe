/**
 * @fileoverview
 * This file implements the /vanish command, allowing administrators to become
 * invisible to other players. When vanished, the player is given the 'vanished'
 * tag and the invisibility effect, and a fake "left the game" message is broadcast.
 * Re-running the command reverses the effect.
 *
 * @author AddonExe
 * @version 1.0.0
 */

import { world } from '@minecraft/server';
import { commandManager } from '../../core/commandManager.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

commandManager.register({
    name: 'vanish',
    aliases: ['v'],
    description: 'Makes you invisible to other players.',
    category: 'Moderation',
    permissionLevel: 2, // Admin level required
    allowConsole: false,
    parameters: [],
    /**
     * Executes the /vanish command to toggle the player's visibility.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const isVanished = player.hasTag(Constants.VANISHED_TAG);

        if (isVanished) {
            // Unvanish the player
            player.removeTag(Constants.VANISHED_TAG);
            player.removeEffect('invisibility');
            sendMessage('§aYou are no longer vanished. You are now visible to other players.', player);
            // Announce a fake join message
            world.sendMessage(`§e${player.name} joined the game.`);
        } else {
            // Vanish the player
            player.addTag(Constants.VANISHED_TAG);
            // Apply invisibility for a very long duration (effectively infinite)
            player.addEffect('invisibility', 2000000, { amplifier: 1, showParticles: false });
            sendMessage('§aYou are now vanished. You are hidden from other players.', player);
            // Announce a fake leave message
            world.sendMessage(`§e${player.name} left the game.`);
        }
    }
});
