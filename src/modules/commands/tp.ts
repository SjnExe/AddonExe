import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { findPlayerByName } from '../../core/playerCache.js';

const tpCommand: CustomCommand = {
    name: 'tp',
    slashName: 'xtp',
    aliases: ['teleport'],
    description: 'Teleports a player to another player or to coordinates.',
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'arg1', type: 'string' },
        { name: 'arg2', type: 'string', optional: true },
        { name: 'arg3', type: 'string', optional: true },
        { name: 'arg4', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: { arg1?: string, arg2?: string, arg3?: string, arg4?: string }) => {
        const argValues = [args.arg1, args.arg2, args.arg3, args.arg4].filter((arg): arg is string => arg !== undefined);
        const usageMessage = '§cUsage: /tp <target> [destination] OR /tp [target] <x> <y> <z>';

        if (argValues.length === 0) {
            executor.sendMessage(usageMessage);
            return;
        }

        // Case 1: /tp <destinationPlayer>
        if (argValues.length === 1) {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must be a player to teleport yourself.');
                return;
            }
            const destinationPlayer = findPlayerByName(argValues[0]);
            if (!destinationPlayer) {
                executor.sendMessage(`§cPlayer '${argValues[0]}' not found.`);
                return;
            }
            executor.teleport(destinationPlayer.location, { dimension: destinationPlayer.dimension });
            executor.sendMessage(`§aTeleported to ${destinationPlayer.name}.`);
            return;
        }

        // Case 2: /tp <playerToMove> <destinationPlayer>
        if (argValues.length === 2) {
            const playerToMove = findPlayerByName(argValues[0]);
            if (!playerToMove) {
                executor.sendMessage(`§cPlayer '${argValues[0]}' not found.`);
                return;
            }
            const destinationPlayer = findPlayerByName(argValues[1]);
            if (!destinationPlayer) {
                executor.sendMessage(`§cPlayer '${argValues[1]}' not found.`);
                return;
            }
            playerToMove.teleport(destinationPlayer.location, { dimension: destinationPlayer.dimension });
            executor.sendMessage(`§aTeleported ${playerToMove.name} to ${destinationPlayer.name}.`);
            return;
        }

        // Case 3: /tp <x> <y> <z>
        if (argValues.length === 3) {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must be a player to teleport yourself.');
                return;
            }
            const [x, y, z] = argValues.map(Number);
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                executor.sendMessage('§cInvalid coordinates provided.');
                return;
            }
            executor.teleport({ x, y, z });
            executor.sendMessage(`§aTeleported to ${x}, ${y}, ${z}.`);
            return;
        }

        // Case 4: /tp <targetPlayer> <x> <y> <z>
        if (argValues.length === 4) {
            const targetPlayer = findPlayerByName(argValues[0]);
            if (!targetPlayer) {
                executor.sendMessage(`§cPlayer '${argValues[0]}' not found.`);
                return;
            }
            const [x, y, z] = argValues.slice(1).map(Number);
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                executor.sendMessage('§cInvalid coordinates provided.');
                return;
            }
            targetPlayer.teleport({ x, y, z }, { dimension: targetPlayer.dimension });
            executor.sendMessage(`§aTeleported ${targetPlayer.name} to ${x}, ${y}, ${z}.`);
            return;
        }

        executor.sendMessage('§cInvalid syntax for /tp command. Too many arguments.');
    }
};

export default tpCommand;
