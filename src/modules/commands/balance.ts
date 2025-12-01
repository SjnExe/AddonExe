import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { getLeaderboard } from '@core/leaderboardManager.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const balanceCommand: CustomCommand = {
    name: 'balance',
    aliases: ['bal', 'money', 'cash'],
    description: "Checks your or another player's balance.",
    permissionLevel: 1024,
    parameters: [{ name: 'target', type: 'player', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            const message = constants.economyDisabled;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const isConsole = !(executor instanceof mc.Player);
        const targetPlayers = args.target as mc.Player[] | undefined;

        if (isConsole && (!targetPlayers || targetPlayers.length === 0)) {
            executor.sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }

        let targetPlayer: mc.Player;
        if (targetPlayers && targetPlayers.length > 0) {
            targetPlayer = targetPlayers[0];
        } else {
            targetPlayer = executor as mc.Player;
        }

        const pData = getOrCreatePlayer(targetPlayer);
        const balance = pData.balance;

        if (balance === null) {
            const message = `§cCould not retrieve balance for ${targetPlayer.name}.`;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        if (!isConsole && targetPlayer.id === executor.id) {
            sendMessage(`§aYour balance is: §e${formatCurrency(balance)}`, executor);
        } else {
            const message = `§a${targetPlayer.name}'s balance is: §e${formatCurrency(balance)}`;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
        }
    }
};

const baltopCommand: CustomCommand = {
    name: 'baltop',
    aliases: ['topbal', 'leaderboard', 'richlist'],
    description: 'Shows the players with the highest balances on the server.',
    permissionLevel: 1024,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            const message = constants.economyDisabled;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const leaderboard = getLeaderboard();
        const displayLimit = config.economy.baltopLimit ?? 10;
        const topPlayers = leaderboard.slice(0, displayLimit);

        if (topPlayers.length === 0) {
            const message = '§cThe leaderboard is currently empty.';
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

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

export default [balanceCommand, baltopCommand];
