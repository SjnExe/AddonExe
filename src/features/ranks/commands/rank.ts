import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { getPlayer, getPlayerIdByName, loadPlayerData, setPlayerRanks } from '@core/data/playerDataManager.js';
import { canAssignRankToPlayer, resolveRankIdAlias } from '@core/permissions/permissionEngine.js';
import { getRankById, updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import { rankDefinitions } from '@features/ranks/config.js';
import { isNonEmptyString } from '@lib/guards.js';

const rankCommand: CustomCommand = {
  name: 'rank',
  description: 'Manage player ranks (Owner can grant Admin; Admin can grant Mod & other ranks).',
  category: 'Essentials',
  permissionNode: 'cmd.rank.admin',
  allowConsole: true,
  parameters: [
    { name: 'action', type: 'string', enumOptions: ['set', 'remove', 'list', 'rm', 'ls'] },
    { name: 'target', type: 'string', optional: true },
    {
      name: 'rank',
      type: 'string',
      optional: true,
      enumOptions: [...rankDefinitions.filter((r) => r.id !== 'owner').map((r) => r.id), 'mod'],
    },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    let action = (args.action as string | undefined)?.toLowerCase() ?? 'list';
    if (action === 'rm') {
      action = 'remove';
    }
    if (action === 'ls') {
      action = 'list';
    }

    const targetName = args.target as string | undefined;
    const rawRankId = args.rank as string | undefined;

    if (action === 'list') {
      if (!isNonEmptyString(targetName)) {
        sendMessage('§cUsage: /rank list <target>', executor);
        return;
      }
      let targetId = getPlayerIdByName(targetName);

      if (!targetId) {
        const targetPlayer = findPlayerByName(targetName);
        if (targetPlayer) {
          targetId = targetPlayer.id;
        }
      }

      if (!targetId) {
        sendMessage('§cPlayer not found.', executor);
        return;
      }

      const pData = getPlayer(targetId) ?? loadPlayerData(targetId);
      if (!pData) {
        sendMessage('§cCould not load player data.', executor);
        return;
      }

      const ranks = pData.ranks;
      if (!ranks || ranks.length === 0) {
        sendMessage(`§e${targetName} §7has no custom ranks.`, executor);
        return;
      }

      const formattedRanks = ranks
        .map((id) => {
          const r = getRankById(id);
          return r ? `§a${r.name} §7(ID: ${id})` : `§c${id} (Unknown Rank)`;
        })
        .join('§7, ');

      sendMessage(`§e${targetName}'s Ranks: §r${formattedRanks}`, executor);
      return;
    }

    if (!isNonEmptyString(targetName) || !isNonEmptyString(rawRankId)) {
      sendMessage(`§cUsage: /rank ${action} <target> <rankId>`, executor);
      return;
    }

    const rankId = resolveRankIdAlias(rawRankId);
    const rankDef = getRankById(rankId);
    if (!rankDef) {
      sendMessage(`§cRank "${rawRankId}" not found. Use /listranks to see available ranks.`, executor);
      return;
    }

    let targetId = getPlayerIdByName(targetName);
    const targetPlayer = findPlayerByName(targetName);
    if (targetPlayer && !targetId) {
      targetId = targetPlayer.id;
    }

    if (!targetId) {
      sendMessage('§cPlayer not found.', executor);
      return;
    }

    const assignCheck = canAssignRankToPlayer(executor, targetId, rankId);
    if (!assignCheck.allowed) {
      sendMessage(assignCheck.reason ?? '§cYou do not have permission to modify this rank.', executor);
      return;
    }

    const pData = getPlayer(targetId) ?? loadPlayerData(targetId);
    if (!pData) {
      sendMessage('§cCould not load player data.', executor);
      return;
    }

    let currentRanks = [...(pData.ranks || [])];

    if (action === 'set') {
      if (currentRanks.includes(rankId)) {
        sendMessage(`§e${targetName} §7already has the rank §a${rankDef.name}§7.`, executor);
        return;
      }
      currentRanks.push(rankId);
      setPlayerRanks(targetId, currentRanks);
      sendMessage(`§aSuccessfully added rank §e${rankDef.name} §ato §e${targetName}§a.`, executor);
      if (targetPlayer) {
        updatePlayerNameTag(targetPlayer, getConfig());
        targetPlayer.sendMessage(`§aYou have been granted the rank §e${rankDef.name}§a.`);
      }
    } else if (action === 'remove') {
      if (rankDef.locked) {
        sendMessage(`§cCannot remove core system rank '${rankDef.name}'.`, executor);
        return;
      }
      if (!currentRanks.includes(rankId)) {
        sendMessage(`§e${targetName} §7does not have the rank §a${rankDef.name}§7.`, executor);
        return;
      }
      currentRanks = currentRanks.filter((r) => r !== rankId);
      if (currentRanks.length === 0) {
        currentRanks.push('member');
      }
      setPlayerRanks(targetId, currentRanks);
      sendMessage(`§aSuccessfully removed rank §e${rankDef.name} §afrom §e${targetName}§a.`, executor);
      if (targetPlayer) {
        updatePlayerNameTag(targetPlayer, getConfig());
        targetPlayer.sendMessage(`§cYour rank §e${rankDef.name}§c has been removed.`);
      }
    }
  },
};

export default rankCommand;
