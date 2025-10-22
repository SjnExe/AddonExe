import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { formatString } from '../../core/utils.js';
import { getConfig } from '../../core/configManager.js';

commandManager.register({
    name: 'deathcoords',
    aliases: ['deathlocation', 'lastdeath'],
    description: 'Shows your last death coordinates.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    execute: (player, args) => {
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
            player.sendMessage(message);
        } else {
            player.sendMessage('§cYou have not died yet or your last death location is not available.');
        }
    }
});
