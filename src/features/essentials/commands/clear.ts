import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { soundError, soundTeleport } from '@core/utils/constants.js';
import { playSound } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

interface ClearCommandArgs {
    target?: mc.Player[];
}

const clearCommand: CustomCommand = {
    name: 'clear',
    slashName: 'xclear',
    description: 'Clears the inventory of a player or yourself.',
    aliases: ['ci', 'clearinv'],
    permissionNode: 'cmd.clear.admin',
    allowConsole: true,
    parameters: [{ name: 'target', type: 'player', optional: true }],

    execute: (executor: CommandExecutor, args: ClearCommandArgs) => {
        let targetPlayer: mc.Player;
        const targetPlayers = args.target;

        if (targetPlayers && targetPlayers.length > 0) {
            const p = targetPlayers[0];
            // Check for undefined in array if strictness requires
            if (!p) {
                if (executor instanceof mc.Player) {
                    executor.sendMessage('§cInvalid target.');
                }
                return;
            }
            targetPlayer = p;
        } else {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must specify a target player when running this command from the console.');
                return;
            }
            targetPlayer = executor;
        }

        if (executor instanceof mc.Player) {
            if (executor.id !== targetPlayer.id) {
                if (!hasPermission(executor, 'cmd.clear.others')) {
                    sendMessage("§cYou do not have permission to clear another player's inventory.", executor);
                    playSound(executor, soundError);
                    return;
                }

                if (!canTarget(executor, targetPlayer.id)) {
                    sendMessage('§cYou cannot clear the inventory of a player with the same or higher rank than you.', executor);
                    playSound(executor, soundError);
                    return;
                }
            }
        }

        const inventory = targetPlayer.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!inventory) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`);
            }
            return;
        }
        inventory.clearAll();

        if (!(executor instanceof mc.Player) || targetPlayer.id !== executor.id) {
            if (executor instanceof mc.Player) {
                sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§aSuccessfully cleared the inventory of ${targetPlayer.name}.`);
            }
            sendMessage('§eYour inventory has been cleared by an admin.', targetPlayer);
            playSound(targetPlayer, soundTeleport);
        } else {
            sendMessage('§aYour inventory has been cleared.', executor);
        }
        if (executor instanceof mc.Player) {
            playSound(executor, soundTeleport);
        }
    }
};

export default clearCommand;
