import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { getPlayer } from '../../core/playerDataManager.js';

commandManager.register({
    name: 'clear',
    slashName: 'xclear',
    description: 'Clears the inventory of a player or yourself.',
    aliases: ['ci', 'clearinv'],
    category: 'Moderation',
    permissionLevel: 2, // Admin-only to prevent accidental self-clearing
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose inventory to clear.', optional: true }
    ],
    execute: (player, args) => {
        let targetPlayer;
        if (args.target && args.target.length > 0) {
            targetPlayer = args.target[0];
        } else {
            if (player.isConsole) {
                player.sendMessage('§cYou must specify a target player when running this command from the console.');
                return;
            }
            targetPlayer = player;
        }

        if (!player.isConsole) {
            const executorData = getPlayer(player.id);
            if (executorData.permissionLevel > 1 && player.id !== targetPlayer.id) {
                player.sendMessage("§cYou do not have permission to clear another player's inventory.");
                playSound(player, 'note.bass');
                return;
            }
            const targetData = getPlayer(targetPlayer.id);
            if (executorData.permissionLevel >= targetData.permissionLevel && player.id !== targetPlayer.id) {
                player.sendMessage('§cYou cannot clear the inventory of a player with the same or higher rank than you.');
                playSound(player, 'note.bass');
                return;
            }
        }

        const inventory = targetPlayer.getComponent('inventory').container;
        for (let i = 0; i < inventory.size; i++) {
            inventory.setItem(i);
        }

        if (player.isConsole || targetPlayer.id !== player.id) {
            player.sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`);
            targetPlayer.sendMessage('§eYour inventory has been cleared by an admin.');
            if (!player.isConsole) {playSound(targetPlayer, 'random.orb');}
        } else {
            player.sendMessage('§aYour inventory has been cleared.');
        }
        if (!player.isConsole) {playSound(player, 'random.orb');}
    }
});
