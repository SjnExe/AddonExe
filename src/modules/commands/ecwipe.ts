import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { playSound } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { findPlayerByName } from '../../core/playerCache.js';

const ecwipeCommand: CustomCommand = {
    name: 'ecwipe',
    description: "Clears a player's Ender Chest.",
    aliases: ['clearec', 'ecclear'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        let targetPlayer: mc.Player;
        const targetName = args.target as string | undefined;

        if (!targetName) {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must specify a target player when running this command from the console.');
                return;
            }
            targetPlayer = executor;
        } else {
            const potentialTarget = findPlayerByName(targetName);
            if (!potentialTarget) {
                if (executor instanceof mc.Player) {
                    sendMessage(`§cPlayer "${targetName}" not found or is offline.`, executor);
                    playSound(executor, 'note.bass');
                } else {
                    executor.sendMessage(`§cPlayer "${targetName}" not found or is offline.`);
                }
                return;
            }
            targetPlayer = potentialTarget;

            if (executor instanceof mc.Player) {
                const executorData = getPlayer(executor.id);
                const targetData = getPlayer(targetPlayer.id);

                if (!executorData || !targetData) {
                    sendMessage('§cCould not retrieve player data for permission check.', executor);
                    playSound(executor, 'note.bass');
                    return;
                }

                if (executorData.permissionLevel > targetData.permissionLevel) {
                    sendMessage('§cYou cannot clear the Ender Chest of a player with a higher rank than you.', executor);
                    playSound(executor, 'note.bass');
                    return;
                }
            }
        }

        try {
            for (let i = 0; i < 27; i++) {
                targetPlayer.runCommand(`replaceitem entity @s slot.enderchest ${i} air 1`);
            }

            if (!(executor instanceof mc.Player) || targetPlayer.id !== executor.id) {
                if (executor instanceof mc.Player) {
                    sendMessage(`§aSuccessfully cleared the Ender Chest of ${targetPlayer.name}.`, executor);
                } else {
                    executor.sendMessage(`§aSuccessfully cleared the Ender Chest of ${targetPlayer.name}.`);
                }
                sendMessage('§eYour Ender Chest has been cleared by an admin.', targetPlayer);
                playSound(targetPlayer, 'random.orb');
            } else {
                sendMessage('§aYour Ender Chest has been cleared.', executor);
            }
            if (executor instanceof mc.Player) {playSound(executor, 'random.orb');}
        } catch (error: any) {
            errorLog(`Failed to clear Ender Chest for ${targetPlayer.name}: ${error}`);
            if (executor instanceof mc.Player) {
                sendMessage('§cAn error occurred while trying to clear the Ender Chest.', executor);
                playSound(executor, 'note.bass');
            } else {
                executor.sendMessage('§cAn error occurred while trying to clear the Ender Chest.');
            }
        }
    }
};

export default ecwipeCommand;
