import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

commandManager.register({
    name: 'clear',
    slashName: 'xclear',
    description: 'Clears the inventory of a player or yourself.',
    aliases: ['ci', 'clearinv'],
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose inventory to clear.', optional: true }
    ],
    /**
     * Executes the /clear command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.target] The optional target player array.
     */
    execute: (player, args) => {
        let targetPlayer;
        if (args.target && args.target.length > 0) {
            targetPlayer = args.target[0];
        } else {
            if (player.isConsole) {
                sendMessage('§cYou must specify a target player when running this command from the console.', player);
                return;
            }
            targetPlayer = player;
        }

        if (!player.isConsole) {
            const executorData = getPlayer(player.id);
            if (executorData.permissionLevel > 1 && player.id !== targetPlayer.id) {
                sendMessage("§cYou do not have permission to clear another player's inventory.", player);
                playSound(player, Constants.SOUND_ERROR);
                return;
            }
            const targetData = getPlayer(targetPlayer.id);
            if (executorData.permissionLevel >= targetData.permissionLevel && player.id !== targetPlayer.id) {
                sendMessage('§cYou cannot clear the inventory of a player with the same or higher rank than you.', player);
                playSound(player, Constants.SOUND_ERROR);
                return;
            }
        }

        const inventory = targetPlayer.getComponent('inventory').container;
        for (let i = 0; i < inventory.size; i++) {
            inventory.setItem(i);
        }

        if (player.isConsole || targetPlayer.id !== player.id) {
            sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`, player);
            sendMessage('§eYour inventory has been cleared by an admin.', targetPlayer);
            if (!player.isConsole) { playSound(targetPlayer, Constants.SOUND_TELEPORT); }
        } else {
            sendMessage('§aYour inventory has been cleared.', player);
        }
        if (!player.isConsole) { playSound(player, Constants.SOUND_TELEPORT); }
    }
});
