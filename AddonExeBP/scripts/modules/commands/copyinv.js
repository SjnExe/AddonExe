import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';

commandManager.register({
    name: 'copyinv',
    description: "Copies a player's inventory, replacing your own.",
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose inventory to copy.' }
    ],
    execute: (player, args) => {
        const { target } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot copy your own inventory.');
            return;
        }

        try {
            const playerInv = player.getComponent('inventory').container;
            const targetInv = targetPlayer.getComponent('inventory').container;

            // Clear the admin's inventory first
            playerInv.clearAll();

            // Copy items
            for (let i = 0; i < targetInv.size; i++) {
                const item = targetInv.getItem(i);
                if (item) {
                    playerInv.setItem(i, item);
                }
            }
            player.sendMessage(`§aSuccessfully copied inventory from ${targetPlayer.name}.`);
            playSound(player, 'random.orb');
        } catch (e) {
            player.sendMessage('§cFailed to copy inventory.');
            errorLog(`[/x:copyinv] Error: ${e.stack}`);
        }
    }
});
