import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getPlayer, getPlayerIdByName, getPlayerNameById, loadPlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatString, resolveTarget } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const deathCoordsCommand: CustomCommand = {
  name: 'deathcoords',
  aliases: ['deathlocation', 'lastdeath'],
  description: 'Shows your last death coordinates.',
  category: 'General',
  permissionNode: 'cmd.deathcoords.member',
  allowConsole: true,
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    const config = getConfig();
    const isAdminOrStaff =
      !(executor instanceof mc.Player) ||
      hasPermission(executor, 'cmd.deathcoords.others') ||
      hasPermission(executor, 'group.admin');

    if (!config.playerInfo.enableDeathCoords && !isAdminOrStaff) {
      sendMessage('§cThe Death Coordinates feature is currently disabled globally.', executor);
      return;
    }

    const targetName = args.target as string | undefined;
    let targetId = executor instanceof mc.Player ? executor.id : '';
    let targetDisplayName = 'You';

    if (isNonEmptyString(targetName)) {
      if (!isAdminOrStaff) {
        return sendMessage("§cYou do not have permission to view other players' death coordinates.", executor);
      }

      const onlineTarget = executor instanceof mc.Player ? resolveTarget(targetName, executor)[0] : undefined;
      if (isDefined(onlineTarget)) {
        targetId = onlineTarget.id;
        targetDisplayName = onlineTarget.name;
      } else {
        const offlineId = getPlayerIdByName(targetName);
        if (!isNonEmptyString(offlineId)) {
          return sendMessage('§cPlayer not found.', executor);
        }
        targetId = offlineId;
        targetDisplayName = getPlayerNameById(offlineId) ?? targetName;
      }
    } else if (!(executor instanceof mc.Player)) {
      return sendMessage('§cConsole must specify a player name: /deathcoords <player>', executor);
    }

    const pData = getPlayer(targetId) ?? loadPlayerData(targetId);
    if (isDefined(pData) && isDefined(pData.lastDeathLocation)) {
      const location = pData.lastDeathLocation;
      const context = {
        x: location.x.toFixed(2),
        y: location.y.toFixed(2),
        z: location.z.toFixed(2),
        dimensionId: location.dimensionId.replace(/^minecraft:/, ''),
      };
      const messageRaw = formatString(config.playerInfo.deathCoordsMessage, context);
      const isSelf = executor instanceof mc.Player && targetId === executor.id;
      const prefix = isSelf ? '' : `§e${targetDisplayName}'s Death Coords: §r`;
      sendMessage(prefix + messageRaw, executor, { raw: true });
    } else {
      const isSelf = executor instanceof mc.Player && targetId === executor.id;
      const msg = isSelf
        ? '§cYou have not died yet or your last death location is not available.'
        : `§c${targetDisplayName} has no recorded death location.`;
      sendMessage(msg, executor);
    }
  },
};

export default deathCoordsCommand;
