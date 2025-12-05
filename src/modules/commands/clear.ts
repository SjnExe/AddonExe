import * as mc from '@minecraft/server';

import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayer } from '@core/playerDataManager.js';
import { playSound } from '@core/utils.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

interface ClearCommandArgs {
    target?: mc.Player[];
}

const clearCommand: CustomCommand = {
    name: 'clear',
    slashName: 'xclear',
    description: 'Clears the inventory of a player or yourself.',
    aliases: ['ci', 'clearinv'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'player', optional: true }],
    execute: (executor: CommandExecutor, args: ClearCommandArgs) => {
        let targetPlayer: mc.Player;
        const targetPlayers = args.target;

        if (targetPlayers && targetPlayers.length > 0) {
            targetPlayer = targetPlayers[0];
        } else {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must specify a target player when running this command from the console.');
                return;
            }
            targetPlayer = executor;
        }

        if (executor instanceof mc.Player) {
            const executorData = getPlayer(executor.id);
            const targetData = getPlayer(targetPlayer.id);

            if (!executorData || !targetData) {
                sendMessage('§cCould not retrieve player data for permission check.', executor);
                playSound(executor, constants.soundError);
                return;
            }

            if (executorData.permissionLevel > 1 && executor.id !== targetPlayer.id) {
                sendMessage("§cYou do not have permission to clear another player's inventory.", executor);
                playSound(executor, constants.soundError);
                return;
            }
            if (executorData.permissionLevel >= targetData.permissionLevel && executor.id !== targetPlayer.id) {
                sendMessage(
                    '§cYou cannot clear the inventory of a player with the same or higher rank than you.',
                    executor
                );
                playSound(executor, constants.soundError);
                return;
            }
        }

        const inventory = targetPlayer.getComponent('inventory')?.container;
        if (!inventory) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`);
            }
            return;
        }
        for (let i = 0; i < inventory.size; i++) {
            inventory.setItem(i);
        }

        if (!(executor instanceof mc.Player) || targetPlayer.id !== executor.id) {
            if (executor instanceof mc.Player) {
                sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`);
            }
            sendMessage('§eYour inventory has been cleared by an admin.', targetPlayer);
            playSound(targetPlayer, constants.soundTeleport);
        } else {
            sendMessage('§aYour inventory has been cleared.', executor);
        }
        if (executor instanceof mc.Player) {
            playSound(executor, constants.soundTeleport);
        }
    }
};

export default clearCommand;
