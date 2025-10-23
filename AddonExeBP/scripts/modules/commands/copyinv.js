import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

commandManager.register({
    name: 'copyinv',
    description: "Copies a player's inventory, replacing your own.",
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose inventory to copy.' }
    ],
    /**
     * Executes the /copyinv command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const { target } = args;

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (player.id === targetPlayer.id) {
            sendMessage('§cYou cannot copy your own inventory.', player);
            return;
        }

        try {
            const playerInv = player.getComponent('inventory').container;
            const targetInv = targetPlayer.getComponent('inventory').container;

            playerInv.clearAll();

            for (let i = 0; i < targetInv.size; i++) {
                const item = targetInv.getItem(i);
                if (item) {
                    playerInv.setItem(i, item);
                }
            }
            sendMessage(`§aSuccessfully copied inventory from ${targetPlayer.name}.`, player);
            playSound(player, constants.soundTeleport);
        } catch (e) {
            sendMessage('§cFailed to copy inventory.', player);
            errorLog(`[/copyinv] Error: ${e.stack}`);
        }
    }
});
