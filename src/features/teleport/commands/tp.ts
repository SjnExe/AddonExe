import { CustomCommand } from '@commands/commandManager.js';
import { soundTeleport } from '@core/utils/constants.js';
import { playSound, resolveTarget } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const command: CustomCommand = {
  name: 'tp',
  slashName: 'xtp',
  aliases: ['teleport', 'xtp'],
  description: 'Teleports a player to another player or to coordinates.',
  category: 'Moderation',
  permissionNode: 'cmd.tp.admin', // Admins only
  allowConsole: false, // This command is complex and safer for players only
  parameters: [
    { name: 'arg1', type: 'string', description: 'Target player or destination player/X-coordinate.' },
    { name: 'arg2', type: 'string', description: 'Destination player or Y-coordinate.', optional: true },
    { name: 'arg3', type: 'string', description: 'Z-coordinate.', optional: true },
    { name: 'arg4', type: 'string', description: 'Z-coordinate if teleporting another player.', optional: true },
  ],
  execute: (executor, args) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const argValues = [args.arg1, args.arg2, args.arg3, args.arg4].filter((arg) => isDefined(arg)) as string[];

    switch (argValues.length) {
      case 1: {
        // /tp <destinationPlayer>
        const targetName = argValues[0];
        if (!isNonEmptyString(targetName)) {
          return;
        }
        const destPlayer1 = resolveTarget(targetName, executor)[0];
        if (!isDefined(destPlayer1)) {
          sendMessage(`§cPlayer '${targetName}' not found.`, executor);
          return;
        }
        saveLastLocation(executor);
        executor.teleport(destPlayer1.location, { dimension: destPlayer1.dimension });
        playSound(executor, soundTeleport);
        sendMessage(`§aTeleported to ${destPlayer1.name}.`, executor);
        break;
      }
      case 2: {
        // /tp <playerToMove> <destinationPlayer>
        const p1Name = argValues[0];
        const p2Name = argValues[1];
        if (!isNonEmptyString(p1Name) || !isNonEmptyString(p2Name)) {
          return;
        }

        const playerToMove = resolveTarget(p1Name, executor)[0];
        const destPlayer2 = resolveTarget(p2Name, executor)[0];
        if (!isDefined(playerToMove)) {
          sendMessage(`§cPlayer '${p1Name}' not found.`, executor);
          return;
        }
        if (!isDefined(destPlayer2)) {
          sendMessage(`§cPlayer '${p2Name}' not found.`, executor);
          return;
        }
        saveLastLocation(playerToMove);
        playerToMove.teleport(destPlayer2.location, { dimension: destPlayer2.dimension });
        playSound(playerToMove, soundTeleport);
        sendMessage(`§aTeleported ${playerToMove.name} to ${destPlayer2.name}.`, executor);
        break;
      }
      case 3: {
        // /tp <x> <y> <z>
        const coords3 = argValues.map(Number);
        const x3 = coords3[0];
        const y3 = coords3[1];
        const z3 = coords3[2];
        if (!isNumber(x3) || !isNumber(y3) || !isNumber(z3)) {
          sendMessage('§cInvalid coordinates provided.', executor);
          return;
        }
        if (!isWithinWorldBorder({ x: x3, z: z3 }, executor.dimension.id) && !canBypassWorldBorder(executor)) {
          sendMessage('§cTarget coordinates are outside the active world border.', executor);
          return;
        }
        saveLastLocation(executor);
        executor.teleport({ x: x3, y: y3, z: z3 });
        playSound(executor, soundTeleport);
        sendMessage(`§aTeleported to ${x3}, ${y3}, ${z3}.`, executor);
        break;
      }
      case 4: {
        // /tp <targetPlayer> <x> <y> <z>
        const tName = argValues[0];
        if (!isNonEmptyString(tName)) {
          return;
        }
        const targetPlayer = resolveTarget(tName, executor)[0];
        if (!isDefined(targetPlayer)) {
          sendMessage(`§cPlayer '${tName}' not found.`, executor);
          return;
        }
        const coords4 = argValues.slice(1).map(Number);
        const x4 = coords4[0];
        const y4 = coords4[1];
        const z4 = coords4[2];
        if (!isNumber(x4) || !isNumber(y4) || !isNumber(z4)) {
          sendMessage('§cInvalid coordinates provided.', executor);
          return;
        }
        if (!isWithinWorldBorder({ x: x4, z: z4 }, targetPlayer.dimension.id) && !canBypassWorldBorder(executor)) {
          sendMessage('§cTarget coordinates are outside the active world border.', executor);
          return;
        }
        saveLastLocation(targetPlayer);
        targetPlayer.teleport({ x: x4, y: y4, z: z4 }, { dimension: targetPlayer.dimension });
        playSound(targetPlayer, soundTeleport);
        sendMessage(`§aTeleported ${targetPlayer.name} to ${x4}, ${y4}, ${z4}.`, executor);
        break;
      }
      default: {
        sendMessage('§cUsage: /tp <target> [destination] OR /tp [target] <x> <y> <z>', executor);
        break;
      }
    }
  },
};

export default command;
