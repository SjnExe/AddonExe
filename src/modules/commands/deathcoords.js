import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { formatString } from '../../core/utils.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'deathcoords',
    aliases: ['deathlocation', 'lastdeath'],
    description: 'Shows your last death coordinates.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    /**
     * Executes the /deathcoords command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const pData = getPlayer(player.id);
        if (pData && pData.lastDeathLocation) {
            const location = pData.lastDeathLocation;
            const config = getConfig();
            const context = {
                x: location.x.toFixed(2),
                y: location.y.toFixed(2),
                z: location.z.toFixed(2),
                dimensionId: location.dimensionId.replace('minecraft:', '')
            };
            const message = formatString(config.playerInfo.deathCoordsMessage, context);
            sendMessage(message, player, { raw: true });
        } else {
            sendMessage('§cYou have not died yet or your last death location is not available.', player);
        }
    }
});
