import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { formatString } from '../../core/utils.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

const deathCoordsCommand: CustomCommand = {
    name: 'deathcoords',
    aliases: ['deathlocation', 'lastdeath'],
    description: 'Shows your last death coordinates.',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {return;}

        const pData = getPlayer(executor.id);
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
            sendMessage(message, executor, { raw: true });
        } else {
            sendMessage('§cYou have not died yet or your last death location is not available.', executor);
        }
    }
};

export default deathCoordsCommand;
