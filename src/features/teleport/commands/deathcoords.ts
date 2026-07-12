import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayer } from '@core/playerDataManager.js';
import { formatString, resolveTarget } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const deathCoordsCommand: CustomCommand = {
    name: 'deathcoords',
    aliases: ['deathlocation', 'lastdeath'],
    description: 'Shows your last death coordinates.',
    category: 'General',
    permissionNode: 'cmd.deathcoords.owner',
    parameters: [{ name: 'target', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = getConfig();
        if (!config.playerInfo.enableDeathCoords) {
            sendMessage('§cThe Death Coordinates feature is currently disabled globally.', executor);
            return;
        }

        const targetName = args.target as string | undefined;
        let targetId = executor.id;
        let targetDisplayName = 'You';

        if (isNonEmptyString(targetName)) {
            // Check permission
            const executorData = getPlayer(executor.id);
            if (!isDefined(executorData) || !hasPermission(executor, 'cmd.deathcoords.others')) {
                return sendMessage("§cYou do not have permission to view other players' death coordinates.", executor);
            }

            const targets = resolveTarget(targetName, executor);
            const target = targets[0];
            if (!isDefined(target)) {
                return sendMessage('§cPlayer not found.', executor);
            }
            targetId = target.id;
            targetDisplayName = target.name;
        }

        const pData = getPlayer(targetId);
        if (isDefined(pData) && isDefined(pData.lastDeathLocation)) {
            const location = pData.lastDeathLocation;
            const context = {
                x: location.x.toFixed(2),
                y: location.y.toFixed(2),
                z: location.z.toFixed(2),
                dimensionId: location.dimensionId.replace(/^minecraft:/, '')
            };
            const messageRaw = formatString(config.playerInfo.deathCoordsMessage, context);
            const prefix = targetId === executor.id ? '' : `§e${targetDisplayName}'s Death Coords: §r`;
            sendMessage(prefix + messageRaw, executor, { raw: true });
        } else {
            const msg = targetId === executor.id ? '§cYou have not died yet or your last death location is not available.' : `§c${targetDisplayName} has no recorded death location.`;
            sendMessage(msg, executor);
        }
    }
};

export default deathCoordsCommand;
