import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { getPlayerIdByName, getPlayerNameById, updatePlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { soundError, soundTeleport } from '@core/utils/constants.js';
import { playSound, resolveTarget } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

interface ClearCommandArgs {
  target?: mc.Player[] | string;
}

const clearCommand: CustomCommand = {
  name: 'clear',
  slashName: 'xclear',
  description: 'Clears the inventory of an online or offline player, or yourself.',
  aliases: ['ci', 'clearinv'],
  permissionNode: 'cmd.clear.admin',
  allowConsole: true,
  parameters: [{ name: 'target', type: 'string', optional: true }],

  execute: (executor: CommandExecutor, args: ClearCommandArgs) => {
    let targetPlayer: mc.Player | undefined;
    const rawTarget = args.target;

    if (Array.isArray(rawTarget) && rawTarget.length > 0) {
      targetPlayer = rawTarget[0];
    } else if (typeof rawTarget === 'string' && isNonEmptyString(rawTarget)) {
      targetPlayer =
        executor instanceof mc.Player ? resolveTarget(rawTarget, executor)[0] : findPlayerByName(rawTarget);
      if (!isDefined(targetPlayer)) {
        const offlineId = getPlayerIdByName(rawTarget);
        if (!isNonEmptyString(offlineId)) {
          sendMessage(`§cPlayer "${rawTarget}" not found.`, executor);
          return;
        }
        if (executor instanceof mc.Player && executor.id !== offlineId) {
          if (!hasPermission(executor, 'cmd.clear.others') && !hasPermission(executor, 'group.admin')) {
            sendMessage("§cYou do not have permission to clear another player's inventory.", executor);
            playSound(executor, soundError);
            return;
          }
          if (!canTarget(executor, offlineId)) {
            sendMessage(
              '§cYou cannot clear the inventory of a player with the same or higher rank than you.',
              executor,
            );
            playSound(executor, soundError);
            return;
          }
        }
        const displayName = getPlayerNameById(offlineId) ?? rawTarget;
        updatePlayerData(offlineId, (d) => {
          d.offlineInventory = {};
          d.offlineEquipment = {};
          d.pendingInventoryClear = true;
        });
        sendMessage(`§aCleared offline inventory for ${displayName} (will apply on next join).`, executor);
        return;
      }
    } else {
      if (!(executor instanceof mc.Player)) {
        executor.sendMessage('§cYou must specify a target player when running this command from the console.');
        return;
      }
      targetPlayer = executor;
    }

    if (!isDefined(targetPlayer)) {
      sendMessage('§cInvalid target.', executor);
      return;
    }

    if (executor instanceof mc.Player) {
      if (executor.id !== targetPlayer.id) {
        if (!hasPermission(executor, 'cmd.clear.others') && !hasPermission(executor, 'group.admin')) {
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
  },
};

export default clearCommand;
