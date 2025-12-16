import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { getLeaderboard } from '@core/leaderboardManager.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer, getPlayerIdByName, getPlayerNameById, loadPlayerData } from '@core/playerDataManager.js';
import { formatCurrency, resolveTarget } from '@core/utils.js';

const balanceCommand: CustomCommand = {
    name: 'balance',
    aliases: ['bal', 'money', 'cash'],
    description: "Checks your or another player's balance.",
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [{ name: 'targets', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) return sendMessage(constants.economyDisabled, executor);

        const targetStr = args.targets as string | undefined;

        if (!targetStr) {
            // Self check
            if (executor instanceof mc.Player) {
                const pData = getOrCreatePlayer(executor);
                sendMessage(`§aYour balance is: §e${formatCurrency(pData.balance)}`, executor);
            } else {
                executor.sendMessage('§cConsole must specify a target.');
            }
            return;
        }

        if (executor instanceof mc.Player) {
            const targets = resolveTarget(targetStr, executor);
            if (targets.length === 0) {
                // Could act as obalance redirect?
                // For now just error to keep it simple, suggest obalance.
                sendMessage('§cPlayer not found (must be online). Use /obalance for offline players.', executor);
                return;
            }

            for (const target of targets) {
                const pData = getOrCreatePlayer(target);
                sendMessage(`§a${target.name}'s balance is: §e${formatCurrency(pData.balance)}`, executor);
            }
        }
    }
};

const oBalanceCommand: CustomCommand = {
    name: 'obalance',
    aliases: ['obal', 'offlinebalance'],
    description: "Checks an offline player's balance.",
    category: 'Economy',
    permissionLevel: 1024,
    allowConsole: true,
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) return sendMessage(constants.economyDisabled, executor);

        const targetName = args.target as string;
        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);

        const displayName = getPlayerNameById(targetId) || targetName;
        const pData = loadPlayerData(targetId);

        if (!pData) return sendMessage(`§cCould not load data for ${displayName}.`, executor);

        sendMessage(`§a${displayName}'s balance is: §e${formatCurrency(pData.balance)} (Offline)`, executor);
    }
};

const baltopCommand: CustomCommand = {
    name: 'baltop',
    aliases: ['topbal', 'leaderboard', 'richlist'],
    description: 'Shows the players with the highest balances on the server.',
    category: 'Economy',
    permissionLevel: 1024,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const config = getConfig();
        if (!config.economy.enabled) return sendMessage(constants.economyDisabled, executor);

        const leaderboard = getLeaderboard();
        const displayLimit = config.economy.baltopLimit ?? 10;
        const topPlayers = leaderboard.slice(0, displayLimit);

        if (topPlayers.length === 0) return sendMessage('§cThe leaderboard is currently empty.', executor);

        const rankColors: { [key: number]: string } = {
            1: '§4', // Dark Red
            2: '§c', // Red
            3: '§6' // Gold
        };
        const defaultColor = '§e'; // Yellow

        let message = '§l§b--- Top Balances ---\n';
        topPlayers.forEach((entry, index) => {
            const rank = index + 1;
            const color = rankColors[rank] || defaultColor;
            message += `${color}#${rank}§r ${entry.name}: §a${formatCurrency(entry.balance)}\n`;
        });

        if (executor instanceof mc.Player) {
            sendMessage(message.trim(), executor, { raw: true });
        } else {
            executor.sendMessage(message.trim());
        }
    }
};

export default [balanceCommand, oBalanceCommand, baltopCommand];
