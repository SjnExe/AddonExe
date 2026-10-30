import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { vanishedTag } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { updatePlayerData } from '@core/playerDataManager.js';
import { formatString } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const vanishCommand: CustomCommand = {
    name: 'vanish',
    aliases: ['v'],
    description: 'Makes you invisible to other players.',
    category: 'Moderation',
    permissionNode: 'cmd.vanish.mod',
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const isVanished = executor.hasTag(vanishedTag);
        const config = getConfig();
        const joinLeaveConfig = config.playerInfo.customJoinLeave;

        if (isVanished) {
            executor.removeTag(vanishedTag);
            executor.removeEffect('invisibility');
            updatePlayerData(executor.id, (d) => {
                d.isVanished = false;
            });
            sendMessage('§aYou are no longer vanished. You are now visible to other players.', executor);

            if (isDefined(joinLeaveConfig) && joinLeaveConfig.enabled) {
                const msg = formatString(joinLeaveConfig.joinMessage, { playerName: executor.name });
                mc.world.sendMessage(msg);
            } else {
                mc.world.sendMessage(`§e${executor.name} joined the game.`);
            }
        } else {
            executor.addTag(vanishedTag);
            executor.addEffect('invisibility', 2_000_000, { amplifier: 1, showParticles: false });
            updatePlayerData(executor.id, (d) => {
                d.isVanished = true;
            });
            sendMessage('§aYou are now vanished. You are hidden from other players.', executor);

            if (isDefined(joinLeaveConfig) && joinLeaveConfig.enabled) {
                const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: executor.name });
                mc.world.sendMessage(msg);
            } else {
                mc.world.sendMessage(`§e${executor.name} left the game.`);
            }
        }
    }
};

export default vanishCommand;
