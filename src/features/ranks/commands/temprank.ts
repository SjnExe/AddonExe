import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { getPlayerIdByName, loadPlayerData } from '@core/data/playerDataManager.js';
import { canAssignRankToPlayer, resolveRankIdAlias } from '@core/permissions/permissionEngine.js';
import { getRankById, updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import { rankDefinitions } from '@features/ranks/config.js';
import { grantTempRank, parseTempRankDuration } from '@features/ranks/tempRankManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const tempRankCommand: CustomCommand = {
  name: 'temprank',
  description: 'Grants a temporary rank that automatically expires after a duration (e.g. 30m, 2h, 7d).',
  category: 'Essentials',
  permissionNode: 'cmd.rank.admin',
  allowConsole: true,
  parameters: [
    { name: 'target', type: 'string' },
    {
      name: 'rank',
      type: 'string',
      enumOptions: [...rankDefinitions.filter((r) => r.id !== 'owner').map((r) => r.id), 'mod'],
    },
    { name: 'duration', type: 'string' },
  ],
  execute: (executor: CommandExecutor, args: { target?: string; rank?: string; duration?: string }) => {
    if (!isNonEmptyString(args.target) || !isNonEmptyString(args.rank) || !isNonEmptyString(args.duration)) {
      sendMessage('§cUsage: /temprank <player> <rank> <duration (e.g. 30m, 2h, 7d)>', executor);
      return;
    }

    const durationMs = parseTempRankDuration(args.duration);
    if (!durationMs) {
      sendMessage('§cInvalid duration. Use formats like 30m, 2h, or 7d.', executor);
      return;
    }

    const rankId = resolveRankIdAlias(args.rank.toLowerCase());
    const rankDef = getRankById(rankId);
    if (!rankDef) {
      sendMessage(`§cRank '${args.rank}' not found.`, executor);
      return;
    }

    const online = findPlayerByName(args.target);
    const targetId = online?.id ?? getPlayerIdByName(args.target);
    if (!targetId) {
      sendMessage(`§cPlayer '${args.target}' not found.`, executor);
      return;
    }

    const permCheck = canAssignRankToPlayer(executor, targetId, rankId);
    if (!permCheck.allowed) {
      sendMessage(`§c${permCheck.reason ?? `You do not have permission to assign the '${rankId}' rank.`}`, executor);
      return;
    }
    const loaded = loadPlayerData(targetId);
    if (!loaded) {
      sendMessage(`§cFailed to load player data for '${args.target}'.`, executor);
      return;
    }

    if (!grantTempRank(targetId, rankId, durationMs)) {
      sendMessage('§cFailed to grant temporary rank (player may already hold it permanently).', executor);
      return;
    }
    if (online && online.isValid) {
      updatePlayerNameTag(online, getConfig());
      online.sendMessage(`§aYou have been granted temporary rank §b${rankDef.name}§a for §e${args.duration}§a.`);
    }
    sendMessage(
      `§aGranted §b${rankDef.name}§a to §e${online?.name ?? args.target}§a for §e${args.duration}§a.`,
      executor,
    );
  },
};

export default tempRankCommand;
