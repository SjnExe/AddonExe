import * as mc from '@minecraft/server';

import { CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { saveLastLocation } from '../teleportUtils.js';

const command: CustomCommand = {
    name: 'tp',
    aliases: ['teleport', 'xtp'],
    description: 'Teleports a player to another player or to coordinates.',
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: false, // This command is complex and safer for players only
    parameters: [
        { name: 'arg1', type: 'string', description: 'Target player or destination player/X-coordinate.' },
        { name: 'arg2', type: 'string', description: 'Destination player or Y-coordinate.', optional: true },
        { name: 'arg3', type: 'string', description: 'Z-coordinate.', optional: true },
        { name: 'arg4', type: 'string', description: 'Z-coordinate if teleporting another player.', optional: true }
    ],
    execute: (executor, args) => {
        if (!(executor instanceof mc.Player)) return;

        const argValues = [args.arg1, args.arg2, args.arg3, args.arg4].filter((arg) => arg !== undefined) as string[];

        switch (argValues.length) {
            case 1: {
                // /tp <destinationPlayer>
                const destPlayer1 = findPlayerByName(argValues[0]);
                if (!destPlayer1) {
                    sendMessage(`§cPlayer '${argValues[0]}' not found.`, executor);
                    return;
                }
                saveLastLocation(executor);
                executor.teleport(destPlayer1.location, { dimension: destPlayer1.dimension });
                sendMessage(`§aTeleported to ${destPlayer1.name}.`, executor);
                break;
            }
            case 2: {
                // /tp <playerToMove> <destinationPlayer>
                const playerToMove = findPlayerByName(argValues[0]);
                const destPlayer2 = findPlayerByName(argValues[1]);
                if (!playerToMove) {
                    sendMessage(`§cPlayer '${argValues[0]}' not found.`, executor);
                    return;
                }
                if (!destPlayer2) {
                    sendMessage(`§cPlayer '${argValues[1]}' not found.`, executor);
                    return;
                }
                saveLastLocation(playerToMove);
                playerToMove.teleport(destPlayer2.location, { dimension: destPlayer2.dimension });
                sendMessage(`§aTeleported ${playerToMove.name} to ${destPlayer2.name}.`, executor);
                break;
            }
            case 3: {
                // /tp <x> <y> <z>
                const [x3, y3, z3] = argValues.map(Number);
                if (isNaN(x3) || isNaN(y3) || isNaN(z3)) {
                    sendMessage('§cInvalid coordinates provided.', executor);
                    return;
                }
                saveLastLocation(executor);
                executor.teleport({ x: x3, y: y3, z: z3 });
                sendMessage(`§aTeleported to ${x3}, ${y3}, ${z3}.`, executor);
                break;
            }
            case 4: {
                // /tp <targetPlayer> <x> <y> <z>
                const targetPlayer = findPlayerByName(argValues[0]);
                if (!targetPlayer) {
                    sendMessage(`§cPlayer '${argValues[0]}' not found.`, executor);
                    return;
                }
                const [x4, y4, z4] = argValues.slice(1).map(Number);
                if (isNaN(x4) || isNaN(y4) || isNaN(z4)) {
                    sendMessage('§cInvalid coordinates provided.', executor);
                    return;
                }
                saveLastLocation(targetPlayer);
                targetPlayer.teleport({ x: x4, y: y4, z: z4 }, { dimension: targetPlayer.dimension });
                sendMessage(`§aTeleported ${targetPlayer.name} to ${x4}, ${y4}, ${z4}.`, executor);
                break;
            }
            default:
                sendMessage('§cUsage: /tp <target> [destination] OR /tp [target] <x> <y> <z>', executor);
                break;
        }
    }
};

export default command;
