import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer, getPlayerIdByName, loadPlayerData, setPlayerRanks } from '@core/playerDataManager.js';
import { getRankById, updatePlayerNameTag } from '@core/rankManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const rankCommand: CustomCommand = {
    name: 'rank',
    description: 'Manage player ranks.',
    category: 'Essentials',
    permissionNode: 'cmd.rank.admin', // Admin
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['set', 'remove', 'list', 'rm', 'ls'] },
        { name: 'target', type: 'string', optional: true },
        { name: 'rank', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        let action = args.action as string;
        if (action === 'rm') action = 'remove';
        if (action === 'ls') action = 'list';

        const targetName = args.target as string | undefined;
        const rankId = args.rank as string | undefined;

        if (action === 'list') {
            if (!isNonEmptyString(targetName)) {
                sendMessage('§cUsage: /rank list <target>', executor);
                return;
            }
            let targetId = getPlayerIdByName(targetName);

            if (!targetId) {
                const targetPlayer = findPlayerByName(targetName);
                if (targetPlayer) targetId = targetPlayer.id;
            }

            if (!targetId) {
                sendMessage('§cPlayer not found.', executor);
                return;
            }

            let pData = getPlayer(targetId);
            if (!pData) {
                pData = loadPlayerData(targetId);
            }

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

        if (!isNonEmptyString(targetName) || !isNonEmptyString(rankId)) {
            sendMessage(`§cUsage: /rank ${action} <target> <rankId>`, executor);
            return;
        }

        const rankDef = getRankById(rankId);
        if (!rankDef) {
            sendMessage(`§cRank "${rankId}" not found. Use /listranks to see available ranks.`, executor);
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

        let pData = getPlayer(targetId);
        if (!pData) {
            pData = loadPlayerData(targetId);
        }

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
                updatePlayerNameTag(targetPlayer, config);
                targetPlayer.sendMessage(`§aYou have been granted the rank §e${rankDef.name}§a.`);
            }
        } else if (action === 'remove') {
            if (!currentRanks.includes(rankId)) {
                sendMessage(`§e${targetName} §7does not have the rank §a${rankDef.name}§7.`, executor);
                return;
            }
            currentRanks = currentRanks.filter((r) => r !== rankId);
            setPlayerRanks(targetId, currentRanks);
            sendMessage(`§aSuccessfully removed rank §e${rankDef.name} §afrom §e${targetName}§a.`, executor);
            if (targetPlayer) {
                updatePlayerNameTag(targetPlayer, config);
                targetPlayer.sendMessage(`§cYour rank §e${rankDef.name} §chas been removed.`);
            }
        }
    }
};

export default rankCommand;
